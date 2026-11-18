/* The road data server behind 上山 First Chair (wentaoz.com/ski/). It fetches Caltrans' and CHP's feeds
   and answers with only what ski/roads.js keeps of them, the mountain highways the resorts' drives use.

   GET /chains?d=3|10    chain control checkpoints           -> 200 {at, data: [...]}
   GET /cams?d=3|10      road cameras that work
   GET /closures?d=3|10  highway lane closures, on now or within a day and a half
   GET /chp              CHP incidents from the Truckee and Sacramento dispatch centres
   GET /roads            Caltrans' road conditions text for I-80, US-50, SR-89, SR-267, SR-28 and SR-88

   `at` is when the feed was fetched. The Caltrans files allow any page to read them, so the page fetches
   those itself when this server can't be reached; CHP's feed and the road conditions page don't, so the
   incidents and the text come only from here. Nothing is stored: each answer is kept in memory for as
   long as its feed changes slowly enough (TTL below), so a burst of visitors fetches each feed once.
   On the free plan a request may use 10 ms of CPU; reading the largest feed, District 3's lane closures
   (1.2 MB), takes about 5, which is why each district is its own request. */
import {
  caltransUrl, CHP_URL, roadsUrl, ROAD_NUMBERS, DISTRICTS,
  keepChains, keepCams, keepClosures, parseChp, parseRoads,
} from '../../ski/roads.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com', 'https://victorzg33.github.io'];
const AGENT = 'wentaoz.com First Chair (https://wentaoz.com/ski/)';

// Seconds an answer is kept: chain controls and incidents change by the minute, the road text and the
// closures more slowly, and the list of cameras hardly ever
const TTL = { chains: 60, cams: 6 * 3600, closures: 300, chp: 60, roads: 120 };
// An answer older than its TTL is still sent, marked stale, when the feed can't be reached, up to this age
const STALE_MS = 45 * 60 * 1000;

async function upstream(url, kind) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AGENT, Accept: kind === 'json' ? 'application/json' : '*/*' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`);
  return kind === 'json' ? res.json() : res.text();
}

const FEEDS = {
  chains: (d) => upstream(caltransUrl('cc', d), 'json').then(keepChains),
  cams: (d) => upstream(caltransUrl('cctv', d), 'json').then(keepCams),
  closures: (d) => upstream(caltransUrl('lcs', d), 'json').then((j) => keepClosures(j)),
  chp: () => upstream(CHP_URL, 'text').then((x) => parseChp(x)),
  // One page per highway: the road conditions page answers only the first of several numbers. Asked
  // for all six at once it has answered six copies of one, so a page that isn't the highway asked for
  // is asked for again, alone, and left out if it still isn't.
  roads: async () => {
    const one = (n) => upstream(roadsUrl(n), 'text').then(parseRoads);
    const pages = await Promise.all(ROAD_NUMBERS.map(one));
    const routes = {};
    let asof = null;
    for (const [i, n] of ROAD_NUMBERS.entries()) {
      let p = pages[i];
      if (!(n in p.routes)) p = await one(n).catch(() => ({ routes: {} }));
      if (!(n in p.routes)) continue;
      routes[n] = p.routes[n];
      if (p.asof && (!asof || p.asof < asof)) asof = p.asof;
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
