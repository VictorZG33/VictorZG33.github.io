// Cloudflare Worker behind 闲聊 Small Talk, the private chat page at wentaoz.com/chat/. It holds the
// site's Anthropic API key, keeps each user's conversations and files apart from everyone else's,
// and answers only someone signed in. Anyone with the invite code (the CHAT_PASSCODE secret) can
// open an account.
//
//   POST   /account      { name, password, invite } -> { token, id, name, first } | 403 bad_invite | 409 name_taken
//   POST   /login        { name, password } -> { token, id, name, first } | 401 bad_login
// and then, with the token in "Authorization: Bearer <token>":
//   POST   /logout       -> 204, and the token stops working
//   GET    /             -> { id, name, first }
//   GET    /usage        -> { mine: [{ month, cost, replies, searches }], all?: [{ name, month, … }] }, all for the first account
//   POST   /password     { password, next } -> 204, and the account's other sessions end | 403 bad_password
//   POST   /             { model, effort, messages, reply } -> Claude's reply, streamed as newline-delimited events;
//                         `reply` is the page's id for it, under which it goes on whatever the connection
//   GET    /replies/:id?from=n  -> the same reply's events from the nth on, as they come | 404 no_reply
//   POST   /replies/:id/stop    -> 204, and the reply ends
//   DELETE /replies/:id  -> 204, the reply forgotten once the page has kept it
//   POST   /title        { user, reply } -> { title }: a short name for a new conversation, by Haiku, or ''
//   GET    /search?q=    -> { hits: [{ id, snippet }], pending }: the conversations with q in their title or words
//   GET    /chats        -> { chats: [{ id, title, model, effort, updated, version, size }] }, the latest first
//   GET    /chats/:id    -> { id, title, model, effort, updated, version, size, messages } | 404
//   PUT    /chats/:id    { base, keep, append, title, model, effort } -> { version, updated } | 409 { version }
//   DELETE /chats/:id    -> 204, and the files only it carried are deleted from the Files API
//   POST   /files        a file's bytes, with Content-Type and X-File-Name -> { id, name, size, type }
//   POST   /files/from-link  { url } -> the same, for a PDF fetched from a link
//   GET    /files/:id    -> a PDF's bytes, from the copy kept of each PDF for the page's reader | 404 no_copy
//   DELETE /files/:id    -> 204, for a file of yours no saved conversation carries (one taken off before sending)
//
// `first` marks the first account, which took over the conversations from before there were
// accounts. ../../chat/chat.js checks what the page sends and shapes the Claude request, so the
// models, the prompt and the limits are fixed there, whatever the page sends. The accounts and their
// sessions are kept by the Durable Object in accounts.js, and each user's conversations by one of
// their own, in store.js. See README.md in this folder.

import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { checkSave, checkUpload, checkAccount, costOf, NAME, FILE_ID, MAX_FILE } from '../../chat/chat.js';
import { hashOf, ROUNDS, b64 } from './accounts.js';
import { filesIn } from './store.js';

export { ChatStore } from './store.js';
export { Accounts } from './accounts.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com'];
const CHATS = /^\/chats(?:\/([a-z0-9]{6,32}))?$/;
const FILES = /^\/files(?:\/([^/]+))?$/;
const REPLIES = /^\/replies\/([a-z0-9]{6,32})(\/stop)?$/;

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (s) => b64url(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const newToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));   // 256 random bits

// Compares hashes, so the time taken says nothing about how much of a guess was right
async function sameSecret(given, expected) {
  const [a, b] = (await Promise.all([given, expected].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))))).map((d) => new Uint8Array(d));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const tokenOf = (request) => ((request.headers.get('Authorization') || '').match(/^Bearer ([A-Za-z0-9_-]{20,100})$/) || [])[1] || '';

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    // DEV_ORIGINS (comma-separated) lets a local copy of the page talk to `wrangler dev`
    const allowed = ORIGINS.includes(origin) || (env.DEV_ORIGINS || '').split(',').includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (status, body) => Response.json(body, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });
    const fail = (status, error) => json(status, { error });
    const done = () => new Response(null, { status: 204, headers: cors });

    const { method } = request;
    if (method === 'OPTIONS') return done();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return fail(405, 'method not allowed');
    // Browsers send Origin on every cross-site request, so other websites can't use the Worker.
    // Scripts can fake it, which is what the accounts are for.
    if (!allowed) return fail(403, 'origin not allowed');
    const invite = (env.CHAT_PASSCODE || '').trim();
    if (!env.ANTHROPIC_API_KEY || !invite) return fail(503, 'not_configured');

    // Counted before anything is checked, so it also slows down anyone guessing a password or the invite code
    if (env.CHAT_LIMIT) {
      const { success } = await env.CHAT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return fail(429, 'rate_limited');
    }

    const { pathname } = new URL(request.url);
    const accounts = env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts'));

    // Opening an account and signing in, the only requests that need no token
    if (method === 'POST' && (pathname === '/account' || pathname === '/login')) {
      let x;
      try { x = await request.json(); } catch { return fail(400, 'bad json'); }
      if (!x || typeof x !== 'object') return fail(400, 'bad json');
      const name = typeof x.name === 'string' ? x.name.trim() : '';
      const token = newToken();
      const signedIn = (u) => json(200, { token, id: u.id, name: u.name, first: u.first });
      if (pathname === '/account') {
        if (!(await sameSecret(String(x.invite ?? '').trim(), invite))) return fail(403, 'bad_invite');
        const problem = checkAccount(name, x.password);
        if (problem) return fail(400, problem);
        const u = await accounts.register(name, x.password, await sha256(token));
        return u ? signedIn(u) : fail(409, 'name_taken');
      }
      // A name that couldn't have been registered can't sign in
      if (!NAME.test(name) || typeof x.password !== 'string' || x.password.length > 200) return fail(401, 'bad_login');
      const u = await accounts.login(name, x.password, await sha256(token));
      return u ? signedIn(u) : fail(401, 'bad_login');
    }

    const token = tokenOf(request);
    const session = token && (await sha256(token));
    const me = session ? await accounts.session(session) : null;
    if (!me) return fail(401, 'bad_session');
    const store = env.STORE.get(env.STORE.idFromName(me.store));

    if (pathname === '/logout') {
      if (method !== 'POST') return fail(405, 'POST only');
      await accounts.logout(session);
      return done();
    }
    if (pathname === '/usage') return method === 'GET' ? json(200, await accounts.usage(me.id, me.first)) : fail(405, 'GET only');
    if (pathname === '/password') {
      if (method !== 'POST') return fail(405, 'POST only');
      let x;
      try { x = await request.json(); } catch { return fail(400, 'bad json'); }
      if (!x || typeof x.password !== 'string' || x.password.length > 200) return fail(403, 'bad_password');
      const problem = checkAccount(me.name, x.next);
      if (problem) return fail(400, problem);
      // The new password is hashed here and the current one checked by Accounts: one hash a call,
      // as the free plan allows a call 10 ms of CPU time
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await hashOf(x.next, salt, ROUNDS);
      return (await accounts.changePassword(me.id, x.password, b64(salt), b64(hash), ROUNDS, session)) ? done() : fail(403, 'bad_password');
    }
    if (pathname === '/search') {
      if (method !== 'GET') return fail(405, 'GET only');
      const q = (new URL(request.url).searchParams.get('q') || '').trim();
      if (!q || q.length > 100) return fail(400, 'bad query');
      return json(200, await store.search(q));
    }
    if (pathname === '/title') {
      if (method !== 'POST') return fail(405, 'POST only');
      return title(request, env, ctx, accounts, me, json, fail);
    }
    if (pathname === '/') {
      if (method === 'GET') return json(200, { id: me.id, name: me.name, first: me.first });
      if (method !== 'POST') return fail(405, 'GET or POST only');
      // The reply is asked for, and read to its end, by the user's own object: see store.js. What the
      // page sent goes there as it came, the object checking it; one far too long to be a
      // conversation goes no further.
      const text = await request.text();
      if (text.length > 4000000) return fail(400, 'too_long');
      return relay(await store.ask(text, me.id), cors);
    }
    const r = pathname.match(REPLIES);
    if (r) {
      if (r[2]) {
        if (method !== 'POST') return fail(405, 'POST only');
        await store.stopReply(r[1]);
        return done();
      }
      if (method === 'GET') return relay(await store.follow(r[1], Number(new URL(request.url).searchParams.get('from')) || 0), cors);
      if (method !== 'DELETE') return fail(405, 'GET or DELETE only');
      await store.forgetReply(r[1]);
      return done();
    }

    const f = pathname.match(FILES);
    if (f) return files(request, env, store, f[1], cors, json, fail, done);
    const m = pathname.match(CHATS);
    if (!m) return fail(404, 'not found');
    const id = m[1];
    if (!id) return method === 'GET' ? json(200, { chats: await store.list() }) : fail(405, 'GET only');
    if (method === 'GET') {
      const c = await store.read(id);
      return c ? json(200, c) : fail(404, 'not_found');
    }
    if (method === 'DELETE') {
      const gone = await store.remove(id);
      if (gone.length) {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        ctx.waitUntil(Promise.allSettled(gone.map((fid) => client.files.delete(fid))));
      }
      return done();
    }
    if (method === 'PUT') {
      let x;
      try { x = await request.json(); } catch { return fail(400, 'bad json'); }
      const problem = checkSave(x);
      if (problem) return fail(400, problem);
      // Only files of the user's own: a conversation's files are deleted with it
      if (!(await store.owns(filesIn(x.append)))) return fail(403, 'not_your_file');
      const r = await store.save(id, x);
      return r.status === 200 ? json(200, { version: r.version, updated: r.updated }) : json(r.status, { error: r.error, version: r.version });
    }
    return fail(405, 'method not allowed');
  },
};

// An API error goes back with its status and the API's own words
const apiFail = (e, fail) => {
  const api = e instanceof Anthropic.APIError;
  return fail(api && e.status ? e.status : 502, api ? e.error?.error?.message || e.message : 'upstream error');
};

async function files(request, env, store, id, cors, json, fail, done) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  if (!id && request.method === 'POST') {
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    let name = '';
    try { name = decodeURIComponent(request.headers.get('X-File-Name') || ''); } catch {}
    // The size it says first, so a file too big is turned away before it is read
    let problem = checkUpload(type, Number(request.headers.get('Content-Length')) || 1);
    if (problem) return fail(problem === 'too_big' ? 413 : 415, problem);
    const bytes = await request.arrayBuffer();
    problem = checkUpload(type, bytes.byteLength);
    if (problem) return fail(problem === 'too_big' ? 413 : 400, problem);
    return keep(client, store, bytes, name, type, json, fail);
  }
  if (id === 'from-link' && request.method === 'POST') return fromLink(request, client, store, json, fail);
  if (id && request.method === 'GET') {
    if (!FILE_ID.test(id)) return fail(404, 'not found');
    const parts = await store.parts(id);   // only the user's own store has it
    if (!parts) return fail(404, 'no_copy');
    let n = 0;
    const body = new ReadableStream({
      async pull(controller) {
        const data = await store.part(id, n++);
        if (data) controller.enqueue(new Uint8Array(data));
        if (!data || n >= parts) controller.close();
      },
    });
    return new Response(body, { headers: { ...cors, 'Content-Type': 'application/pdf', 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }
  if (id && request.method === 'DELETE') {
    if (!FILE_ID.test(id)) return fail(404, 'not found');
    if (!(await store.release(id))) return fail(409, 'in_use');   // a saved message carries it, or it isn't theirs
    try {
      await client.files.delete(id);
    } catch (e) {
      if (!(e instanceof Anthropic.NotFoundError)) return apiFail(e, fail);
    }
    return done();
  }
  return fail(405, 'method not allowed');
}

// A file goes up to the Files API and becomes the user's; a PDF is also kept, in parts of PART bytes,
// for the page's reader to show again
const PART = 1 << 20;
async function keep(client, store, bytes, name, type, json, fail) {
  name = String(name).replace(/[\\/\u0000-\u001f]/g, '_').slice(-200) || 'file';
  let up;
  try {
    up = await client.files.upload({ file: await toFile(bytes, name, { type }) });
  } catch (e) {
    return apiFail(e, fail);
  }
  await store.own(up.id);
  // A PDF's copy, for the reader: a part per row. Should that fail, the file still goes with the
  // message, only without a copy, rather than half of one.
  if (type === 'application/pdf') {
    const all = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try {
      for (let at = 0, n = 0; at < all.byteLength; at += PART, n++) await store.keepPart(up.id, n, all.slice(at, at + PART));
    } catch {
      await store.dropCopy(up.id).catch(() => {});
    }
  }
  return json(200, { id: up.id, name: up.filename, size: up.size_bytes, type: up.mime_type });
}

// A PDF from a link, fetched here, as the page can't read other sites itself; then kept as if it had
// been uploaded. At most MAX_FILE.pdf bytes, and it must be a PDF: one starts with %PDF- within its
// first kilobyte.
async function fromLink(request, client, store, json, fail) {
  let x, url;
  try { x = await request.json(); } catch { return fail(400, 'bad json'); }
  try { url = new URL(String((x && x.url) || '').trim()); } catch { return fail(400, 'bad_link'); }
  if (!/^https?:$/.test(url.protocol) || url.href.length > 2000) return fail(400, 'bad_link');
  let res;
  try {
    res = await fetch(url.href, { headers: { Accept: 'application/pdf,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; SmallTalk)' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
  } catch {
    return fail(502, 'link_unreachable');
  }
  if (!res.ok) return fail(502, 'link_status_' + res.status);
  const max = MAX_FILE.pdf;
  if (Number(res.headers.get('Content-Length')) > max) return fail(413, 'too_big');
  const reader = res.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); return fail(413, 'too_big'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  chunks.reduce((at, c) => { bytes.set(c, at); return at + c.byteLength; }, 0);
  const head = String.fromCharCode(...bytes.subarray(0, 1024));
  if (!head.includes('%PDF-')) return fail(415, 'not_pdf');
  // Its name: the one the site gives, or the end of the address it came from
  const given = res.headers.get('Content-Disposition') || '';
  let name = '';
  try {
    const star = given.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/), plain = given.match(/filename\s*=\s*"?([^";]+)"?/);
    name = star ? decodeURIComponent(star[1]) : plain ? plain[1] : decodeURIComponent(new URL(res.url || url.href).pathname.split('/').filter(Boolean).pop() || '');
  } catch {}
  name = (name || url.hostname).trim();
  if (!/\.pdf$/i.test(name)) name += '.pdf';
  return keep(client, store, bytes, name, 'application/pdf', json, fail);
}

// What the user's object answers, passed on as it comes, with the headers this site needs
const relay = (res, cors) => new Response(res.body, { status: res.status, headers: {
  ...cors, 'Content-Type': res.headers.get('Content-Type') || 'application/json', 'Cache-Control': 'no-store' } });

// A name for a new conversation, from its first message and reply, by the smallest model: a
// hundredth of a cent or so, which goes on the user's month too
const TITLE_MODEL = 'claude-haiku-5-5';
const TITLE_PROMPT = "You name conversations for a chat app's list. Reply with a short title for the conversation the user shows you, in the language it is written in: at most 12 characters for Chinese or Japanese, at most 6 words otherwise. No quotes, no full stop, nothing else.";
async function title(request, env, ctx, accounts, me, json, fail) {
  let x;
  try { x = await request.json(); } catch { return fail(400, 'bad json'); }
  const user = typeof x?.user === 'string' ? x.user.slice(0, 2000) : '', reply = typeof x?.reply === 'string' ? x.reply.slice(0, 2000) : '';
  if (!user.trim() && !reply.trim()) return fail(400, 'nothing to name');
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let msg;
  try {
    msg = await client.messages.create({
      model: TITLE_MODEL, max_tokens: 64, thinking: { type: 'disabled' }, output_config: { effort: 'low' }, system: TITLE_PROMPT,
      messages: [{ role: 'user', content: `<user>\n${user}\n</user>\n<assistant>\n${reply}\n</assistant>` }],
    });
  } catch (e) {
    return apiFail(e, fail);
  }
  ctx.waitUntil(accounts.spend(me.id, costOf(TITLE_MODEL, msg.usage) || 0, 0, 0).catch(() => {}));
  const said = msg.stop_reason === 'refusal' ? '' : msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const name = said.replace(/\s+/g, ' ').trim().replace(/^["'“”‘’「」『』《》【】]+|["'“”‘’「」『』《》【】。．.!！?？]+$/g, '').trim().slice(0, 40);
  return json(200, { title: name });   // '' when none came: the page keeps the title it has
}

