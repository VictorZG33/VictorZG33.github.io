// The accounts of 闲聊 Small Talk, for the Worker in worker.js: one SQLite-backed Durable Object with
// every user, every signed-in session, and what each user's replies cost, by month. Each user's
// conversations live in a ChatStore of their own (store.js), named in their row here. The first
// account to register takes over 'chats', the store that held the conversations from before there
// were accounts, and is the one that sees what everyone spends.
//
// A password is kept only as a salted PBKDF2-SHA256 hash, and a session only as the SHA-256 of its
// token, so neither can be read back out of the storage.

import { DurableObject } from 'cloudflare:workers';

// PBKDF2 rounds for a new password. 20,000 take a few milliseconds, inside the 10 ms of CPU time the
// Workers free plan allows a request, which Workers' maximum of 100,000 would overrun. Each row keeps
// its own count, so raising this on a paid plan leaves the passwords set before working.
export const ROUNDS = 20000;
const IDLE = 180 * 24 * 60 * 60 * 1000;   // a session unused this long has ended
const DAY = 24 * 60 * 60 * 1000;
export const b64 = (bytes) => btoa(String.fromCharCode(...bytes));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashOf(password, salt, rounds) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256));
}
// Compares every byte, so the time taken says nothing about where two hashes differ
const same = (a, b) => {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
  return diff === 0;
};
const who = (u) => ({ id: u.id, name: u.name, store: u.store, first: u.store === 'chats' });

export class Accounts extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, rounds INTEGER NOT NULL, store TEXT NOT NULL, created INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user TEXT NOT NULL, seen INTEGER NOT NULL)');
    // Added later: the cost of each user's replies by month (UTC), as the Worker measured it from the usage
    this.sql.exec('CREATE TABLE IF NOT EXISTS spend (user TEXT NOT NULL, month TEXT NOT NULL, cost REAL NOT NULL, replies INTEGER NOT NULL, searches INTEGER NOT NULL, PRIMARY KEY (user, month))');
  }

  // A new account, signed in with the session whose token hashes to `session`; null if the name is
  // taken. The password is hashed first: hashing waits, and other calls can run meanwhile, but from
  // the check on, nothing waits, so two people can't take one name.
  async register(name, password, session) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashOf(password, salt, ROUNDS);
    const id = name.toLowerCase();
    if (this.sql.exec('SELECT 1 FROM users WHERE id = ?', id).toArray().length) return null;
    // A store of its own, never one a closed account left behind under the same name
    const first = !this.sql.exec('SELECT 1 FROM users LIMIT 1').toArray().length;
    const u = { id, name, store: first ? 'chats' : `user:${id}:${crypto.randomUUID()}` };
    this.sql.exec('INSERT INTO users (id, name, salt, hash, rounds, store, created) VALUES (?, ?, ?, ?, ?, ?, ?)', id, name, b64(salt), b64(hash), ROUNDS, u.store, Date.now());
    this.sql.exec('INSERT INTO sessions (hash, user, seen) VALUES (?, ?, ?)', session, id, Date.now());
    return who(u);
  }

  // Signs in; null for a wrong name or password, which take as long as each other
  async login(name, password, session) {
    const u = this.sql.exec('SELECT * FROM users WHERE id = ?', name.toLowerCase()).toArray()[0];
    const hash = await hashOf(password, u ? unb64(u.salt) : new Uint8Array(16), u ? u.rounds : ROUNDS);
    if (!u || !same(hash, unb64(u.hash))) return null;
    this.sql.exec('INSERT INTO sessions (hash, user, seen) VALUES (?, ?, ?)', session, u.id, Date.now());
    return who(u);
  }

  // The user a session belongs to, or null
  session(hash) {
    const s = this.sql.exec('SELECT s.seen, u.id, u.name, u.store FROM sessions s JOIN users u ON u.id = s.user WHERE s.hash = ?', hash).toArray()[0];
    if (!s) return null;
    const now = Date.now();
    if (now - s.seen > IDLE) {
      this.sql.exec('DELETE FROM sessions WHERE hash = ?', hash);
      return null;
    }
    if (now - s.seen > DAY) this.sql.exec('UPDATE sessions SET seen = ? WHERE hash = ?', now, hash);
    return who(s);
  }

  logout(hash) {
    this.sql.exec('DELETE FROM sessions WHERE hash = ?', hash);
  }

  // A new password, given the current one. The new one comes already hashed, by the Worker, so that
  // no one call has two passwords to hash. Every other session of the user ends; `keep` goes on.
  async changePassword(id, password, salt, hash, rounds, keep) {
    const u = this.sql.exec('SELECT salt, hash, rounds FROM users WHERE id = ?', id).toArray()[0];
    if (!u || !same(await hashOf(password, unb64(u.salt), u.rounds), unb64(u.hash))) return false;
    this.sql.exec('UPDATE users SET salt = ?, hash = ?, rounds = ? WHERE id = ?', salt, hash, rounds, id);
    this.sql.exec('DELETE FROM sessions WHERE user = ? AND hash != ?', id, keep);
    return true;
  }

  // Adds a reply's cost (US$) to its user's month
  spend(id, cost, searches, replies) {
    this.sql.exec(`INSERT INTO spend (user, month, cost, replies, searches) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (user, month) DO UPDATE SET cost = cost + excluded.cost, replies = replies + excluded.replies, searches = searches + excluded.searches`,
    id, new Date().toISOString().slice(0, 7), cost, replies, searches);
  }

  // A user's last six months; and, for the first account, everyone's this month and last
  usage(id, everyone) {
    const mine = this.sql.exec('SELECT month, cost, replies, searches FROM spend WHERE user = ? ORDER BY month DESC LIMIT 6', id).toArray();
    if (!everyone) return { mine };
    const d = new Date(), month = d.toISOString().slice(0, 7);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    const all = this.sql.exec('SELECT u.name, s.month, s.cost, s.replies, s.searches FROM spend s JOIN users u ON u.id = s.user WHERE s.month IN (?, ?) ORDER BY s.cost DESC',
      month, d.toISOString().slice(0, 7)).toArray();
    return { mine, all };
  }
}
