/* The road data server behind 上山 First Chair (wentaoz.com/ski/). It fetches Caltrans' and CHP's feeds
   and answers with only what ski/roads.js keeps of them, the mountain highways the resorts' drives use.

   GET /chains?d=3|10    chain control checkpoints           -> 200 {at, data: [...]}
   GET /cams?d=3|10      road cameras that work
   GET /closures?d=3|10  highway lane closures, on now or within a day and a half
   GET /chp              CHP incidents from the Truckee and Sacramento dispatch centres, from QuickMap's
                         copy of them, or CHP's own feed if QuickMap can't be reached
   GET /roads            Caltrans' road conditions text for I-80, US-50, SR-89, SR-267, SR-28 and SR-88

   `at` is when the feed was fetched. The Caltrans files allow any page to read them, so the page fetches
   those itself when this server can't be reached; CHP's feed and the road conditions page don't, so the
   incidents and the text come only from here. CHP's own feed sits behind a firewall that never answers
   Cloudflare, so QuickMap's KML, which carries the same incidents, comes first. Caltrans' servers answer
   500 now and then, so each request to them is tried twice, and the road conditions page sends a page
   with no highway on it about as often as one with, so each highway is asked up to three times. Nothing is stored: each answer is kept in memory for as
   long as its feed changes slowly enough (TTL below), so a burst of visitors fetches each feed once.
   On the free plan a request may use 10 ms of CPU; reading the largest feed, District 3's lane closures
   (1.2 MB), takes about 5, which is why each district is its own request. */
import {
  caltransUrl, CHP_URL, CHP_KML_URL, roadsUrl, ROAD_NUMBERS, DISTRICTS,
  keepChains, keepCams, keepClosures, parseChp, parseChpKml, parseRoads,
} from '../../ski/roads.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com', 'https://victorzg33.github.io'];
const AGENT = 'wentaoz.com First Chair (https://wentaoz.com/ski/)';

// Seconds an answer is kept: chain controls and incidents change by the minute, the road text and the
// closures more slowly, and the list of cameras hardly ever
const TTL = { chains: 60, cams: 6 * 3600, closures: 300, chp: 60, roads: 120 };
// An answer older than its TTL is still sent, marked stale, when the feed can't be reached, up to this age
const STALE_MS = 45 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A feed, asked again after a pause when it answers a server error or not at all
async function upstream(url, kind, { timeout = 12000, tries = 2 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    if (i) await sleep(700);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': AGENT, Accept: kind === 'json' ? 'application/json' : '*/*' },
        signal: AbortSignal.timeout(timeout),
      });
      if (res.ok) return kind === 'json' ? await res.json() : await res.text();
      last = new Error(`${new URL(url).host} answered ${res.status}`);
      if (res.status < 500) break;
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

// The last good text of each highway, for when the road conditions page won't give one up
const lastRoad = new Map();

const FEEDS = {
  chains: (d) => upstream(caltransUrl('cc', d), 'json').then(keepChains),
  cams: (d) => upstream(caltransUrl('cctv', d), 'json').then(keepCams),
  closures: (d) => upstream(caltransUrl('lcs', d), 'json').then((j) => keepClosures(j)),
  chp: async () => {
    try {
      return parseChpKml(await upstream(CHP_KML_URL, 'text', { timeout: 10000 }));
    } catch (err) {
      return parseChp(await upstream(CHP_URL, 'text', { timeout: 6000, tries: 1 }));
    }
  },
  // One page per highway: the road conditions page answers only the first of several numbers, and
  // often a page with no highway on it, so each is asked up to three times, a moment apart. A highway
  // that still won't come keeps its last good text, up to STALE_MS old.
  roads: async () => {
    const one = async (n) => {
      for (let k = 0; k < 3; k++) {
        if (k) await sleep(900 * k);
        const p = await upstream(roadsUrl(n), 'text', { timeout: 8000, tries: 1 }).then(parseRoads).catch(() => null);
        if (p && n in p.routes) { lastRoad.set(n, { at: Date.now(), items: p.routes[n], asof: p.asof }); return p; }
      }
      return null;
    };
    const pages = await Promise.all(ROAD_NUMBERS.map(one));
    const routes = {};
    let asof = null;
    for (const [i, n] of ROAD_NUMBERS.entries()) {
      const p = pages[i];
      const kept = lastRoad.get(n);
      if (p) routes[n] = p.routes[n];
      else if (kept && Date.now() - kept.at < STALE_MS) routes[n] = kept.items;
      else continue;
      const t = p ? p.asof : kept.asof;
      if (t && (!asof || t < asof)) asof = t;
    }
    if (!Object.keys(routes).length) throw new Error('roads.dot.ca.gov sent no highway');
    return { asof, routes };
  },
};

// In this isolate's memory: key -> { at, body } and, while a fetch is under way, the fetch itself,
// so requests that arrive together share one
const memo = new Map();
const pending = new Map();

async function answer(feed, d) {
  const key = feed + (d ? ':' + d : '');
  const ttl = TTL[feed] * 1000, now = Date.now();
  const had = memo.get(key);
  if (had && now - had.at < ttl) return { ...had, age: now - had.at };
  if (!pending.has(key)) {
    pending.set(key, FEEDS[feed](d)
      .then((data) => {
        const entry = { at: Date.now(), body: JSON.stringify({ at: Date.now(), data }) };
        memo.set(key, entry);
        return entry;
      })
      .finally(() => pending.delete(key)));
  }
  try {
    return { ...(await pending.get(key)), age: 0 };
  } catch (err) {
    if (had && now - had.at < STALE_MS) return { ...had, age: now - had.at, stale: String(err.message || err) };
    throw err;
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    // DEV_ORIGINS (comma-separated) lets a local copy of the page talk to `wrangler dev`
    const allowed = ORIGINS.includes(origin) || (env.DEV_ORIGINS || '').split(',').includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : { Vary: 'Origin' };
    const reply = (status, body, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', ...extra },
    });
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' } });
    }
    if (request.method !== 'GET') return reply(405, { error: 'Only GET' }, { 'Cache-Control': 'no-store' });

    const url = new URL(request.url);
    const feed = url.pathname.replace(/^\/+|\/+$/g, '');
    if (!(feed in FEEDS)) return reply(404, { error: 'Try /chains, /cams, /closures, /chp or /roads' }, { 'Cache-Control': 'no-store' });
    let d = null;
    if (feed === 'chains' || feed === 'cams' || feed === 'closures') {
      d = +url.searchParams.get('d');
      if (!DISTRICTS.includes(d)) return reply(400, { error: `d must be one of ${DISTRICTS.join(', ')}` }, { 'Cache-Control': 'no-store' });
    }
    try {
      const got = await answer(feed, d);
      const left = Math.max(0, Math.round((TTL[feed] * 1000 - got.age) / 1000));
      const extra = { 'Cache-Control': `public, max-age=${got.stale ? 30 : Math.min(left, 300)}` };
      if (got.stale) extra['X-Stale'] = got.stale.slice(0, 200);
      return reply(200, got.body, extra);
    } catch (err) {
      return reply(502, { error: String(err.message || err).slice(0, 200) }, { 'Cache-Control': 'no-store' });
    }
  },
};
