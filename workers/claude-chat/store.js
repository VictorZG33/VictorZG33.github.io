// The saved conversations of 闲聊 Small Talk, for the Worker in worker.js. Each user's live in a
// SQLite-backed Durable Object of their own, the kind the Workers free plan offers: a row per
// conversation in `chats`, a row per message in `messages`, and a row per file they uploaded in
// `files`, which is how the Worker tells their files from anyone else's.
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, added INTEGER NOT NULL)');
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

  // Deletes a conversation, and returns the files it carried that no other conversation does (a copy
  // made when two devices answered at once carries the same ones), for the Worker to delete too
  remove(id) {
    const files = new Set();
    for (const { data } of this.sql.exec('SELECT data FROM messages WHERE chat = ?', id)) {
      const m = JSON.parse(data);
      if (m.role === 'user' && Array.isArray(m.content)) {
        for (const b of m.content) if (b && b.source && b.source.type === 'file') files.add(b.source.file_id);
      }
    }
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM messages WHERE chat = ?', id);
      this.sql.exec('DELETE FROM chats WHERE id = ?', id);
    });
    const gone = [...files].filter((f) => !this.uses(f));
    for (const f of gone) this.sql.exec('DELETE FROM files WHERE id = ?', f);
    return gone;
  }

  // Whether any stored message carries this file
  uses(fileId) {
    return this.sql.exec('SELECT 1 FROM messages WHERE instr(data, ?) > 0 LIMIT 1', fileId).toArray().length > 0;
  }

  // A file this user just uploaded
  own(fileId) {
    this.sql.exec('INSERT OR IGNORE INTO files (id, added) VALUES (?, ?)', fileId, Date.now());
  }

  // Whether every one of these files is this user's: one they uploaded, or one their own messages
  // carry, as files uploaded before there were accounts are. Those are written down here once found.
  owns(ids) {
    for (const f of ids) {
      if (this.sql.exec('SELECT 1 FROM files WHERE id = ?', f).toArray().length) continue;
      if (!this.uses(f)) return false;
      this.own(f);
    }
    return true;
  }

  // Lets go of a file this user uploaded and no message carries, for the Worker to delete; false if
  // the file isn't theirs or a message carries it
  release(fileId) {
    if (!this.sql.exec('SELECT 1 FROM files WHERE id = ?', fileId).toArray().length || this.uses(fileId)) return false;
    this.sql.exec('DELETE FROM files WHERE id = ?', fileId);
    return true;
  }
}
