// The saved conversations of 闲聊 Small Talk, for the Worker in worker.js. Each user's live in a
// SQLite-backed Durable Object of their own, the kind the Workers free plan offers: a row per
// conversation in `chats`, a row per message in `messages`, a row per file they uploaded in `files`,
// which is how the Worker tells their files from anyone else's, and in `copies` a copy of each PDF,
// for the page's reader, as the Files API gives none back.
//
// Claude's replies are asked for here too, and read to their end whatever happens to the page that
// asked: a phone that loses its signal, or puts the page away, asks for the rest of the same reply
// once it can, from where it had got to. See `ask` below.
//
// A conversation only ever grows at the end or loses turns from the end (see chat/index.html), so a
// save says how many of the stored messages stay and which follow them. Each save also names the
// version it builds on, and one made from an older copy is refused with the current version, so two
// devices can't overwrite each other's turns. A Durable Object runs one call at a time, and nothing
// in a call waits, so no save can slip in between the check and the write.

import { DurableObject } from 'cloudflare:workers';
import Anthropic from '@anthropic-ai/sdk';
import { buildChatRequest, checkChatInput, costOf } from '../../chat/chat.js';

// The files a user's messages carry
export const filesIn = (messages) => [...new Set(messages.flatMap((m) => m.role === 'user' && Array.isArray(m.content) ? m.content : [])
  .filter((b) => b.source && b.source.type === 'file').map((b) => b.source.file_id))];

// An answer for the Worker to pass on: an error, or an API error with the API's status and message
const answer = (status, error) => Response.json({ error }, { status });
export const apiAnswer = (e) => {
  const api = e instanceof Anthropic.APIError;
  return answer(api && e.status ? e.status : 502, api ? e.error?.error?.message || e.message : 'upstream error');
};

const REPLY_ID = /^[a-z0-9]{6,32}$/;
const KEEP_REPLY = 24 * 60 * 60 * 1000;   // how long a reply's lines are kept, for a page that comes back late
const SAVE_EVERY = 5000;                   // ms between saves of a reply's new lines while it comes
const BEAT = 15000;                        // a blank line after this long without any, as a quiet connection can be cut
// The status of an error the API reports partway through a reply, by its type
const STATUS = { invalid_request_error: 400, authentication_error: 401, permission_error: 403, not_found_error: 404,
  request_too_large: 413, rate_limit_error: 429, api_error: 500, overloaded_error: 529 };
const encoder = new TextEncoder();

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
    // Added for the reader: each PDF in parts of a megabyte
    this.sql.exec('CREATE TABLE IF NOT EXISTS copies (file TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (file, part))');
    // Added for replies that outlast a lost connection: each reply, and its lines in parts
    this.sql.exec('CREATE TABLE IF NOT EXISTS replies (id TEXT PRIMARY KEY, started INTEGER NOT NULL, state TEXT NOT NULL, lines INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS reply_lines (reply TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (reply, n))');
    this.replies = new Map();   // the replies this object has in memory: id -> { lines, state, saved, parts, waiting, stream, started, stopped }
  }

  // ---------- replies ----------
  // A reply is asked of Claude here, not in the Worker: a Worker's work ends when the page's
  // connection does, while an object asking something of another server stays up until it has its
  // answer (up to 15 minutes), however the page fares. Its events come as newline-delimited JSON,
  // a line each, as BetaMessageStream.fromReadableStream() on the page reads them; they are kept in
  // memory, and saved every few seconds, for a page that has lost its connection to ask for the
  // rest, from the line it had got to, and for a day, for one that comes back late. A reply that
  // fails partway ends with a line { type: 'error', error: { type, message }, status }. What a reply
  // cost goes on its user's month when it ends.

  // `text` is what the page sent: { model, effort, messages, reply }, `reply` the id it gave this
  // reply. The same id asked for again, as by a page whose request may not have got here, gets
  // the same reply: Claude is asked once.
  async ask(text, user) {
    let input;
    try { input = JSON.parse(text); } catch { return answer(400, 'bad json'); }
    const problem = checkChatInput(input);
    if (problem) return answer(400, problem);
    const id = typeof input.reply === 'string' && REPLY_ID.test(input.reply) ? input.reply : crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    if (this.#reply(id)) return this.follow(id, 0);
    // Only files of the user's own: the Files API would read anyone's
    const ids = filesIn(input.messages);
    if (ids.length && !this.owns(ids)) return answer(403, 'not_your_file');
    this.#tidy();
    const stream = new Anthropic({ apiKey: this.env.ANTHROPIC_API_KEY }).beta.messages.stream(buildChatRequest(input));
    try {
      await stream.withResponse();   // an API error (a bad key, an overload) is answered as such, before any line
    } catch (e) {
      return apiAnswer(e);
    }
    if (this.#reply(id)) { stream.abort(); return this.follow(id, 0); }   // asked twice at once: the first one stays
    const r = { lines: [], state: 'running', saved: 0, parts: 0, waiting: new Set(), stream, started: Date.now(), stopped: false };
    this.replies.set(id, r);
    this.sql.exec('INSERT INTO replies (id, started, state, lines) VALUES (?, ?, ?, 0)', id, r.started, r.state);
    this.ctx.waitUntil(this.#run(id, r, input.model, user));
    return this.follow(id, 0);
  }

  // A reply's lines from line `from` on, as they come, until it ends; 404 for one this user hasn't
  async follow(id, from = 0) {
    const r = this.#reply(id);
    if (!r) return answer(404, 'no_reply');
    let at = Math.max(0, Math.min(Math.floor(Number(from)) || 0, r.lines.length)), wake = null, beat = null;
    const quiet = () => { clearTimeout(beat); if (wake) r.waiting.delete(wake); wake = null; };
    const body = new ReadableStream({
      type: 'bytes',
      async pull(controller) {
        for (;;) {
          if (at < r.lines.length) {
            const out = r.lines.slice(at).join('\n') + '\n';
            at = r.lines.length;
            controller.enqueue(encoder.encode(out));
            return;
          }
          if (r.state !== 'running') { controller.close(); return; }
          const beaten = await new Promise((ok) => {
            wake = () => ok(false);
            r.waiting.add(wake);
            beat = setTimeout(() => ok(true), BEAT);
          });
          quiet();
          if (beaten) { controller.enqueue(encoder.encode('\n')); return; }
        }
      },
      cancel: quiet,
    });
    return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
  }

  // The page's stop button: the reply ends here, and stops costing
  stopReply(id) {
    const r = this.replies.get(id);
    if (r && r.state === 'running' && r.stream) { r.stopped = true; r.stream.abort(); }
  }

  // A reply the page has kept in its conversation, and needs no more
  forgetReply(id) {
    this.stopReply(id);
    this.replies.delete(id);
    this.sql.exec('DELETE FROM reply_lines WHERE reply = ?', id);
    this.sql.exec('DELETE FROM replies WHERE id = ?', id);
  }

  // A reply in memory, or read back from storage, as after this object was restarted; null if none
  #reply(id) {
    let r = this.replies.get(id);
    if (r) return r;
    const row = this.sql.exec('SELECT started, state FROM replies WHERE id = ?', id).toArray()[0];
    if (!row) return null;
    const parts = this.sql.exec('SELECT data FROM reply_lines WHERE reply = ? ORDER BY n', id).toArray();
    r = { lines: parts.flatMap((p) => p.data.split('\n')), state: row.state, saved: 0, parts: parts.length, waiting: new Set(), stream: null, started: row.started, stopped: false };
    r.saved = r.lines.length;
    this.replies.set(id, r);
    // One still coming when this object stopped is lost with the connection it was coming on
    if (r.state === 'running') {
      r.state = 'lost';
      r.lines.push(JSON.stringify({ type: 'error', error: { type: 'lost', message: 'the reply was cut off on the server' }, status: 502 }));
      this.#save(id, r);
    }
    return r;
  }

  // Reads a reply to its end, line by line, saving as it goes; then puts what it cost on the user's month
  async #run(id, r, model, user) {
    let seen = null;
    r.stream.on('streamEvent', (e, snapshot) => { seen = snapshot; });
    const saving = setInterval(() => this.#save(id, r), SAVE_EVERY);
    try {
      for await (const event of r.stream) this.#push(r, JSON.stringify(event));
      r.state = 'done';
    } catch (e) {
      // Stopped by the page; cut off on the way from the API; or an error the API sent partway
      const cut = !(e instanceof Anthropic.APIError) || e instanceof Anthropic.APIConnectionError;
      const kind = r.stopped ? 'stopped' : cut ? 'connection_error' : e.error?.error?.type || 'api_error';
      r.state = r.stopped ? 'stopped' : 'failed';
      this.#push(r, JSON.stringify({ type: 'error', error: { type: kind, message: r.stopped ? 'stopped' : cut ? String((e && e.message) || e) : e.error?.error?.message || e.message },
        status: r.stopped ? 499 : cut ? 502 : e.status || STATUS[kind] || 502 }));
    } finally {
      clearInterval(saving);
      this.#save(id, r);
      this.#wake(r);
    }
    // What it cost, from its usage: all of it, or, stopped partway, as far as it got
    const u = (r.stream.receivedMessages.at(-1) || seen || {}).usage;
    if (u) {
      await this.env.ACCOUNTS.get(this.env.ACCOUNTS.idFromName('accounts'))
        .spend(user, costOf(model, u) || 0, (u.server_tool_use && u.server_tool_use.web_search_requests) || 0, 1).catch(() => {});
    }
  }

  #push(r, line) {
    r.lines.push(line);
    this.#wake(r);
  }

  #wake(r) {
    for (const w of r.waiting) w();
    r.waiting.clear();
  }

  // Saves a reply's lines not yet saved, as a part of their own, and its state; not once it is forgotten
  #save(id, r) {
    if (this.replies.get(id) !== r) return;
    if (r.lines.length > r.saved) {
      this.sql.exec('INSERT INTO reply_lines (reply, n, data) VALUES (?, ?, ?)', id, r.parts++, r.lines.slice(r.saved).join('\n'));
      r.saved = r.lines.length;
    }
    this.sql.exec('UPDATE replies SET state = ?, lines = ? WHERE id = ?', r.state, r.saved, id);
  }

  // Lets go of replies older than a day, and of ended ones held in memory for ten minutes
  #tidy() {
    for (const { id } of this.sql.exec('SELECT id FROM replies WHERE started < ?', Date.now() - KEEP_REPLY).toArray()) this.forgetReply(id);
    for (const [id, r] of this.replies) if (r.state !== 'running' && r.started < Date.now() - 10 * 60 * 1000) this.replies.delete(id);
  }

  // A file's copy, a part at a time: put, counted, read back, dropped
  keepPart(fileId, part, data) {
    this.sql.exec('INSERT OR REPLACE INTO copies (file, part, data) VALUES (?, ?, ?)', fileId, part, data);
  }
  parts(fileId) {
    return this.sql.exec('SELECT COUNT(*) AS n FROM copies WHERE file = ?', fileId).one().n;
  }
  part(fileId, part) {
    return (this.sql.exec('SELECT data FROM copies WHERE file = ? AND part = ?', fileId, part).toArray()[0] || {}).data || null;
  }
  dropCopy(fileId) {
    this.sql.exec('DELETE FROM copies WHERE file = ?', fileId);
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
    for (const f of gone) {
      this.sql.exec('DELETE FROM files WHERE id = ?', f);
      this.dropCopy(f);
    }
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
    this.dropCopy(fileId);
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
