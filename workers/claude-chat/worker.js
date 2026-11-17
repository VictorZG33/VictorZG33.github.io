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
//   POST   /             { model, effort, messages } -> Claude's reply, streamed as newline-delimited events
//   GET    /chats        -> { chats: [{ id, title, model, effort, updated, version, size }] }, the latest first
//   GET    /chats/:id    -> { id, title, model, effort, updated, version, size, messages } | 404
//   PUT    /chats/:id    { base, keep, append, title, model, effort } -> { version, updated } | 409 { version }
//   DELETE /chats/:id    -> 204, and the files only it carried are deleted from the Files API
//   POST   /files        a file's bytes, with Content-Type and X-File-Name -> { id, name, size, type }
//   DELETE /files/:id    -> 204, for a file of yours no saved conversation carries (one taken off before sending)
//
// `first` marks the first account, which took over the conversations from before there were
// accounts. ../../chat/chat.js checks what the page sends and shapes the Claude request, so the
// models, the prompt and the limits are fixed there, whatever the page sends. The accounts and their
// sessions are kept by the Durable Object in accounts.js, and each user's conversations by one of
// their own, in store.js. See README.md in this folder.

import Anthropic, { toFile } from '@anthropic-ai/sdk';
import { buildChatRequest, checkChatInput, checkSave, checkUpload, checkAccount, NAME, FILE_ID } from '../../chat/chat.js';

export { ChatStore } from './store.js';
export { Accounts } from './accounts.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com'];
const CHATS = /^\/chats(?:\/([a-z0-9]{6,32}))?$/;
const FILES = /^\/files(?:\/([^/]+))?$/;

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
// The files the user's messages carry
const filesIn = (messages) => [...new Set(messages.flatMap((m) => m.role === 'user' && Array.isArray(m.content) ? m.content : [])
  .filter((b) => b.source && b.source.type === 'file').map((b) => b.source.file_id))];

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
    if (pathname === '/') {
      if (method === 'GET') return json(200, { id: me.id, name: me.name, first: me.first });
      if (method !== 'POST') return fail(405, 'GET or POST only');
      return chat(request, env, store, cors, fail);
    }

    const f = pathname.match(FILES);
    if (f) return files(request, env, store, f[1], json, fail, done);
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

async function files(request, env, store, id, json, fail, done) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  if (!id && request.method === 'POST') {
    const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
    let name = '';
    try { name = decodeURIComponent(request.headers.get('X-File-Name') || ''); } catch {}
    name = name.replace(/[\\/\u0000-\u001f]/g, '_').slice(-200) || 'file';
    // The size it says first, so a file too big is turned away before it is read
    let problem = checkUpload(type, Number(request.headers.get('Content-Length')) || 1);
    if (problem) return fail(problem === 'too_big' ? 413 : 415, problem);
    const bytes = await request.arrayBuffer();
    problem = checkUpload(type, bytes.byteLength);
    if (problem) return fail(problem === 'too_big' ? 413 : 400, problem);
    try {
      const up = await client.files.upload({ file: await toFile(bytes, name, { type }) });
      await store.own(up.id);
      return json(200, { id: up.id, name: up.filename, size: up.size_bytes, type: up.mime_type });
    } catch (e) {
      return apiFail(e, fail);
    }
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

async function chat(request, env, store, cors, fail) {
  let input;
  try { input = await request.json(); } catch { return fail(400, 'bad json'); }
  const problem = checkChatInput(input);
  if (problem) return fail(400, problem);
  // Only files of the user's own: the Files API would read anyone's
  const ids = filesIn(input.messages);
  if (ids.length && !(await store.owns(ids))) return fail(403, 'not_your_file');

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream(buildChatRequest(input));
  try {
    await stream.withResponse();   // surfaces an API error (bad key, overload) before any bytes go out
  } catch (e) {
    return apiFail(e, fail);
  }
  // Newline-delimited events, read on the page with BetaMessageStream.fromReadableStream()
  return new Response(keepAlive(stream.toReadableStream()), { headers: { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}

// At high effort Claude can think for minutes before it writes a word, and the stream carries nothing
// meanwhile: the SDK drops the API's own pings. A connection that quiet can be cut on the way, so a
// blank line goes out after every 15 seconds of silence; the page's reader skips blank lines. When
// the page stops listening (its stop button), the request to Claude is cancelled too.
function keepAlive(body) {
  const reader = body.getReader(), blank = new TextEncoder().encode('\n');
  let timer;
  return new ReadableStream({
    async start(controller) {
      const beat = () => { timer = setTimeout(() => { controller.enqueue(blank); beat(); }, 15000); };
      beat();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          clearTimeout(timer);
          controller.enqueue(value);
          beat();
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        clearTimeout(timer);
      }
    },
    cancel(reason) {
      clearTimeout(timer);
      return reader.cancel(reason);
    },
  });
}
