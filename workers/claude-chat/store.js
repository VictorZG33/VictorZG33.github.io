// The saved conversations of 闲聊 Small Talk, for the Worker in worker.js. They all live in one
// SQLite-backed Durable Object, the kind the Workers free plan offers: a row per conversation in
// `chats`, and a row per message in `messages`.
//
// A conversation only ever grows at the end or loses turns from the end (see chat/index.html), so a
// save says how many of the stored messages stay and which follow them. Each save also names the
// version it builds on, and one made from an older copy is refused with the current version, so two
// devices can't overwrite each other's turns. A Durable Object runs one call at a time, and nothing
// in a call waits, so no save can slip in between the check and the write.

import { DurableObject } from 'cloudflare:workers';

export class ChatStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS chats (id TEXT PRIMARY KEY, title TEXT NOT NULL, model TEXT NOT NULL, updated INTEGER NOT NULL, version INTEGER NOT NULL, size INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS messages (chat TEXT NOT NULL, i INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (chat, i))');
    // Added after the first deploy: a conversation's own effort, '' for its model's. SQLite has no
    // ADD COLUMN IF NOT EXISTS, so this fails, harmlessly, once the column is there.
    try { this.sql.exec("ALTER TABLE chats ADD COLUMN effort TEXT NOT NULL DEFAULT ''"); } catch {}
  }

  // Every conversation without its messages, the latest first
  list() {
    return this.sql.exec('SELECT id, title, model, effort, updated, version, size FROM chats ORDER BY updated DESC').toArray();
  }

  read(id) {
    const chat = this.sql.exec('SELECT id, title, model, effort, updated, version, size FROM chats WHERE id = ?', id).toArray()[0];
    if (!chat) return null;
    chat.messages = this.sql.exec('SELECT data FROM messages WHERE chat = ? ORDER BY i', id).toArray().map((r) => JSON.parse(r.data));
    return chat;
  }

  // { base, keep, append, title, model, effort }, already checked by checkSave in chat/chat.js
  save(id, { base, keep, append, title, model, effort = '' }) {
    const now = this.sql.exec('SELECT version, size FROM chats WHERE id = ?', id).toArray()[0] || { version: 0, size: 0 };
    if (base !== now.version) return { status: 409, error: 'stale', version: now.version };
    if (keep > now.size) return { status: 400, error: 'bad keep' };
    const version = now.version + 1, updated = Date.now(), size = keep + append.length;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM messages WHERE chat = ? AND i >= ?', id, keep);
      append.forEach((m, k) => this.sql.exec('INSERT INTO messages (chat, i, data) VALUES (?, ?, ?)', id, keep + k, JSON.stringify(m)));
      this.sql.exec(`INSERT INTO chats (id, title, model, effort, updated, version, size) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET title = excluded.title, model = excluded.model, effort = excluded.effort,
          updated = excluded.updated, version = excluded.version, size = excluded.size`,
      id, title, model, effort || '', updated, version, size);
    });
    return { status: 200, version, updated };
  }

  remove(id) {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM messages WHERE chat = ?', id);
      this.sql.exec('DELETE FROM chats WHERE id = ?', id);
    });
  }
}
