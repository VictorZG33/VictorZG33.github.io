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

// The words of a message a search looks in: what the user wrote and the names of their files, and
// Claude's replies; not the thinking, the time notes or the search results
function wordsOf(m) {
  if (!m || m.role === 'system') return '';
  const files = Array.isArray(m.files) ? m.files.map((f) => (f && f.name) || '').join(' ') : '';
  const text = typeof m.content === 'string' ? m.content
    : Array.isArray(m.content) ? m.content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('') : '';
  return (files ? files + ' ' + text : text).slice(0, 20000);
}
const INDEX_EACH = 25;   // older messages given their words per call: a few at a time, each call staying light

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
    // Added for search: a message's words (wordsOf), filled in for older messages a few at a time
    try { this.sql.exec('ALTER TABLE messages ADD COLUMN words TEXT'); } catch {}
  }

  // Gives up to n messages saved before there was search their words; how many still lack them
  index(n) {
    for (const r of this.sql.exec('SELECT chat, i, data FROM messages WHERE words IS NULL LIMIT ?', n).toArray()) {
      this.sql.exec('UPDATE messages SET words = ? WHERE chat = ? AND i = ?', wordsOf(JSON.parse(r.data)), r.chat, r.i);
    }
    return this.sql.exec('SELECT COUNT(*) AS n FROM messages WHERE words IS NULL').one().n;
  }

  // The conversations whose title or words have q in them, each with a snippet of the first message
  // that does (none when only the title matched), the latest first; and how many messages are still
  // without their words, so that the page can look again
  search(q) {
    const pending = this.index(INDEX_EACH);
    const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%', hits = new Map();
    for (const r of this.sql.exec("SELECT id FROM chats WHERE title LIKE ? ESCAPE '\\' ORDER BY updated DESC", like)) hits.set(r.id, '');
    for (const r of this.sql.exec("SELECT m.chat, m.words FROM messages m JOIN chats c ON c.id = m.chat WHERE m.words LIKE ? ESCAPE '\\' ORDER BY c.updated DESC, m.i LIMIT 500", like)) {
      if (!hits.get(r.chat)) hits.set(r.chat, snippet(r.words, q));
    }
    return { hits: [...hits].map(([id, text]) => ({ id, snippet: text })), pending };
  }

  // Every conversation without its messages, the latest first. Each look at the list also gives a few
  // older messages their words, so that search soon finds everything.
  list() {
    this.index(INDEX_EACH);
    return this.sql.exec('SELECT id, title, model, effort, updated, version, size FROM chats ORDER BY updated DESC').toArray();
  }

  read(id) {
    const chat = this.sql.exec('SELECT id, title, model, effort, updated, version, size FROM chats WHERE id = ?', id).toArray()[0];
    if (!chat) return null;
    chat.messages = this.sql.exec('SELECT data FROM messages WHERE chat = ? ORDER BY i', id).toArray().map((r) => JSON.parse(r.data));
    return chat;
  }

  // { base, keep, append, title, model, effort }, already checked by checkSave in chat/chat.js
  // A save that changes only the title, the model or the effort keeps the time, so the conversation
  // keeps its place in the list
  save(id, { base, keep, append, title, model, effort = '' }) {
    const now = this.sql.exec('SELECT version, size, updated FROM chats WHERE id = ?', id).toArray()[0] || { version: 0, size: 0, updated: 0 };
    if (base !== now.version) return { status: 409, error: 'stale', version: now.version };
    if (keep > now.size) return { status: 400, error: 'bad keep' };
    const version = now.version + 1, size = keep + append.length;
    const updated = append.length || keep < now.size || !now.updated ? Date.now() : now.updated;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM messages WHERE chat = ? AND i >= ?', id, keep);
      append.forEach((m, k) => this.sql.exec('INSERT INTO messages (chat, i, data, words) VALUES (?, ?, ?, ?)', id, keep + k, JSON.stringify(m), wordsOf(m)));
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

// Some of the words around the first place q is, without regard to case
function snippet(words, q) {
  const at = words.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return words.slice(0, 60);
  const from = Math.max(0, at - 16), to = Math.min(words.length, at + q.length + 44);
  return (from ? '…' : '') + words.slice(from, to).replace(/\s+/g, ' ') + (to < words.length ? '…' : '');
}
