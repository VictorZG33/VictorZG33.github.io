// Cloudflare Worker behind 闲聊 Small Talk, the private chat page at wentaoz.com/chat/. It holds the
// site's Anthropic API key and a passcode as secrets, keeps the conversations, and answers only
// someone who sends that passcode, so finding the page is not enough to use it.
//
//   GET    /             -> 204, so the page can check a passcode as it is typed in
//   POST   /             { model, messages } -> Claude's reply, streamed as newline-delimited events
//   GET    /chats        -> { chats: [{ id, title, model, updated, version, size }] }, the latest first
//   GET    /chats/:id    -> { id, title, model, updated, version, size, messages } | 404
//   PUT    /chats/:id    { base, keep, append, title, model } -> { version, updated } | 409 { version }
//   DELETE /chats/:id    -> 204
//
// The passcode goes in "Authorization: Bearer <passcode>", URI-encoded so that any characters work.
// ../../chat/chat.js checks what the page sends and shapes the Claude request, so the models, the
// prompt and the limits are fixed there, whatever the page sends. The conversations are stored by
// the Durable Object in store.js. See README.md in this folder.

import Anthropic from '@anthropic-ai/sdk';
import { buildChatRequest, checkChatInput, checkSave } from '../../chat/chat.js';

export { ChatStore } from './store.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com'];
const CHATS = /^\/chats(?:\/([a-z0-9]{6,32}))?$/;

// Compares hashes, so the time taken says nothing about how much of a guess was right
async function samePasscode(given, expected) {
  const digest = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function passcodeOf(request) {
  const m = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/);
  try { return m ? decodeURIComponent(m[1]).trim() : ''; } catch { return ''; }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    // DEV_ORIGINS (comma-separated) lets a local copy of the page talk to `wrangler dev`
    const allowed = ORIGINS.includes(origin) || (env.DEV_ORIGINS || '').split(',').includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
    // Scripts can fake it, which is what the passcode is for.
    if (!allowed) return fail(403, 'origin not allowed');
    const expected = (env.CHAT_PASSCODE || '').trim();
    if (!env.ANTHROPIC_API_KEY || !expected) return fail(503, 'not_configured');

    // Counted before the passcode is checked, so it also slows down anyone guessing it
    if (env.CHAT_LIMIT) {
      const { success } = await env.CHAT_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return fail(429, 'rate_limited');
    }
    if (!(await samePasscode(passcodeOf(request), expected))) return fail(401, 'bad_passcode');

    const { pathname } = new URL(request.url);
    if (pathname === '/') {
      if (method === 'GET') return done();
      if (method !== 'POST') return fail(405, 'GET or POST only');
      return chat(request, env, cors, fail);
    }

    const m = pathname.match(CHATS);
    if (!m) return fail(404, 'not found');
    const store = env.STORE.get(env.STORE.idFromName('chats'));
    const id = m[1];
    if (!id) return method === 'GET' ? json(200, { chats: await store.list() }) : fail(405, 'GET only');
    if (method === 'GET') {
      const c = await store.read(id);
      return c ? json(200, c) : fail(404, 'not_found');
    }
    if (method === 'DELETE') {
      await store.remove(id);
      return done();
    }
    if (method === 'PUT') {
      let x;
      try { x = await request.json(); } catch { return fail(400, 'bad json'); }
      const problem = checkSave(x);
      if (problem) return fail(400, problem);
      const r = await store.save(id, x);
      return r.status === 200 ? json(200, { version: r.version, updated: r.updated }) : json(r.status, { error: r.error, version: r.version });
    }
    return fail(405, 'method not allowed');
  },
};

async function chat(request, env, cors, fail) {
  let input;
  try { input = await request.json(); } catch { return fail(400, 'bad json'); }
  const problem = checkChatInput(input);
  if (problem) return fail(400, problem);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream(buildChatRequest(input));
  try {
    await stream.withResponse();   // surfaces an API error (bad key, overload) before any bytes go out
  } catch (e) {
    const api = e instanceof Anthropic.APIError;
    return fail(api && e.status ? e.status : 502, api ? e.error?.error?.message || e.message : 'upstream error');
  }
  // Newline-delimited events, read on the page with BetaMessageStream.fromReadableStream()
  return new Response(stream.toReadableStream(), { headers: { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
