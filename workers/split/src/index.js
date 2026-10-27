/* Sync server for 两清 All Square (wentaoz.com/split/). Each shared ledger lives in its own Durable Object,
   named by a random id that only the share link carries.

   POST /ledgers        {data}        -> 200 {id, version}
   GET  /ledgers/:id                  -> 200 {version, data} | 404
   PUT  /ledgers/:id    {base, data}  -> 200 {version} | 409 {version, data} when someone saved first | 404

   The page sends the whole ledger with the version it started from. A Durable Object handles one request
   at a time, so two saves from the same version can't both land: the second gets 409 and the current copy,
   replays its own changes on top and tries again. */
import { DurableObject } from 'cloudflare:workers';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com', 'https://victorzg33.github.io'];
const MAX_BYTES = 200000;                     // the largest ledger the page allows, all in Chinese, is about 130 kB
const KEEP_MS = 365 * 24 * 60 * 60 * 1000;    // a ledger nobody has changed for a year is deleted

export class Ledger extends DurableObject {
  async read() {
    return (await this.ctx.storage.get('ledger')) || null;
  }
  async create(data) {
    if (await this.ctx.storage.get('ledger')) return null;
    const doc = { version: 1, data };
    await this.ctx.storage.put('ledger', doc);
    await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
    return doc;
  }
  async write(base, data) {
    const doc = await this.ctx.storage.get('ledger');
    if (!doc) return { status: 404 };
    if (doc.version !== base) return { status: 409, doc };
    const next = { version: doc.version + 1, data };
    await this.ctx.storage.put('ledger', next);
    await this.ctx.storage.setAlarm(Date.now() + KEEP_MS);
    return { status: 200, doc: next };
  }
  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}

/* The same rules the page applies before it saves: version 2 ledgers, people and expenses by id */
const ID = /^[a-z0-9]{1,12}$/;
function validLedger(d) {
  if (!d || d.v !== 2 || typeof d.c !== 'string' || d.c.length > 4 || !Array.isArray(d.p) || !Array.isArray(d.e) || d.p.length > 50 || d.e.length > 500) return false;
  const people = new Set(), expenses = new Set();
  for (const p of d.p) {
    if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'string' || !ID.test(p[0]) || people.has(p[0])) return false;
    if (typeof p[1] !== 'string' || !p[1] || p[1].length > 24) return false;
    people.add(p[0]);
  }
  for (const e of d.e) {
    if (!Array.isArray(e) || e.length !== 5 || typeof e[0] !== 'string' || !ID.test(e[0]) || expenses.has(e[0])) return false;
    if (typeof e[1] !== 'string' || e[1].length > 60 || !Number.isInteger(e[2]) || e[2] <= 0 || e[2] > 1e10 || !people.has(e[3])) return false;
    if (!Array.isArray(e[4]) || !e[4].length || new Set(e[4]).size !== e[4].length || !e[4].every((x) => people.has(x))) return false;
    expenses.add(e[0]);
  }
  return true;
}
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));   // 96 bits: not something anyone can guess
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    // DEV_ORIGINS (comma-separated) lets a local copy of the page talk to `wrangler dev`
    const allowed = ORIGINS.includes(origin) || (env.DEV_ORIGINS || '').split(',').includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, PUT', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    }

    const m = new URL(request.url).pathname.match(/^\/ledgers(?:\/([A-Za-z0-9_-]{16}))?$/);
    if (!m) return reply(404, { error: 'not found' });
    const stub = (id) => env.LEDGER.get(env.LEDGER.idFromName(id));

    let body = null;
    if (request.method === 'POST' || request.method === 'PUT') {
      const text = await request.text();
      if (new TextEncoder().encode(text).length > MAX_BYTES) return reply(413, { error: 'too large' });
      try { body = JSON.parse(text); } catch (e) { return reply(400, { error: 'not json' }); }
      if (!body || !validLedger(body.data)) return reply(400, { error: 'not a ledger' });
    }

    if (!m[1] && request.method === 'POST') {
      const id = newId(), doc = await stub(id).create(body.data);
      return doc ? reply(200, { id, version: doc.version }) : reply(500, { error: 'id taken' });
    }
    if (m[1] && request.method === 'GET') {
      const doc = await stub(m[1]).read();
      return doc ? reply(200, doc) : reply(404, { error: 'no such ledger' });
    }
    if (m[1] && request.method === 'PUT') {
      if (!Number.isInteger(body.base)) return reply(400, { error: 'no base version' });
      const r = await stub(m[1]).write(body.base, body.data);
      if (r.status === 200) return reply(200, { version: r.doc.version });
      return r.status === 409 ? reply(409, r.doc) : reply(404, { error: 'no such ledger' });
    }
    return reply(405, { error: 'method not allowed' });
  }
};
