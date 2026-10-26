// Writes visitors.json, the data behind the visitor map on the homepage: total visitors, and
// visitors per country placed at the country's centre. Read from the GoatCounter API by
// .github/workflows/visitors.yml once a day, with an API key that can only read statistics.
//
//   GOATCOUNTER_TOKEN=... node .github/scripts/visitors.mjs
//
// The file is rewritten only when the counts change, so quiet days make no commit.
import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://wentaoz.goatcounter.com/api/v0';
const START = '2026-10-01T00:00:00Z';   // before counting began, so the range takes in every visit
const OUT = 'visitors.json';

const token = process.env.GOATCOUNTER_TOKEN;
if (!token) throw new Error('GOATCOUNTER_TOKEN is not set');

// GoatCounter answers 404 to the first request from a key that has gone more than a day since
// its "last used" time was updated, which is the request that updates it, and serves the next
// request normally. Daily runs keep landing on that request, so a 404 is tried again.
async function get(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (res.ok) return res.json();
    const body = (await res.text()).slice(0, 300);
    if (res.status === 404 && attempt < 3) {
      console.log(`GET ${path}: HTTP 404, trying again in ${5 * attempt} s`);
      await new Promise((resolve) => setTimeout(resolve, 5000 * attempt));
      continue;
    }
    const err = new Error(`GET ${path}: HTTP ${res.status} ${body}`);
    err.status = res.status;
    throw err;
  }
}

// /me needs no particular permission, so a 401 or 403 here is about the key itself.
try {
  await get('/me');
} catch (err) {
  if (err.status === 401 || err.status === 403) {
    throw new Error(`GoatCounter did not accept the API key; check the GOATCOUNTER_TOKEN secret. ${err.message}`);
  }
  throw err;
}

// The API takes whole hours; without a start it would default to the last seven days.
// The end is two days ahead because GoatCounter turns it into a date in the account's time
// zone, while location stats are filed by UTC day: an end of "now" in New York at night is
// still yesterday there, and the query then left out every visit made since midnight UTC.
const end = new Date(Date.now() + 2 * 24 * 3600 * 1000);
end.setUTCMinutes(0, 0, 0);
const range = { start: START, end: end.toISOString().replace('.000Z', 'Z') };

const rows = [];
for (let offset = 0; ; offset += 100) {
  const page = await get('/stats/locations', { ...range, limit: 100, offset });
  rows.push(...(page.stats || []));
  if (!page.more || !(page.stats || []).length) break;
}

let previous = null;
try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

// The total and the first day with visits come from /stats/total. That endpoint has answered
// 404 for this site, so it is optional: without it the total is the sum over every location,
// "(unknown)" included, and the page prefers GoatCounter's public counter when that is on.
let total = rows.reduce((n, r) => n + (r.count || 0), 0);
let since = null;
try {
  const totals = await get('/stats/total', range);
  if (typeof totals.total === 'number') total = totals.total;
  const first = (totals.stats || []).find((d) => d.daily > 0);
  if (first) since = first.day;
} catch (err) {
  console.warn(`Total taken as the sum over locations; /stats/total failed: ${err.message}`);
}
since = since || (previous && previous.since) || (total > 0 ? new Date().toISOString().slice(0, 10) : null);

// Location ids are ISO 3166-1 alpha-2 codes; centres from the world-countries dataset (mledoze/countries).
const centres = JSON.parse(await readFile(new URL('country-centres.json', import.meta.url), 'utf8'));
// The log lists what GoatCounter returned, country by country, and what stays off the map.
console.log(`GoatCounter locations: ${rows.map((r) => `${JSON.stringify(r.id)} ${r.name} ×${r.count}`).join(', ') || 'none'}`);
const countries = [];
for (const r of rows) {
  const code = String(r.id || '').slice(0, 2).toUpperCase();   // a region id such as US-CT still names its country
  if (!(r.count > 0)) continue;
  if (!centres[code]) { console.log(`  not on the map: ${JSON.stringify(r.id)} ${r.name} ×${r.count}`); continue; }
  const seen = countries.find((c) => c.code === code);
  if (seen) seen.count += r.count;
  else countries.push({ code, name: r.name, count: r.count, lat: centres[code][0], lon: centres[code][1] });
}

const data = { since, total, countries };
const same = previous && JSON.stringify({ since: previous.since, total: previous.total, countries: previous.countries }) === JSON.stringify(data);
if (same) {
  console.log(`No change: ${total} visitors from ${countries.length} countries`);
} else {
  const out = { updated: new Date().toISOString().slice(0, 10), ...data };
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${total} visitors from ${countries.length} countries since ${since}`);
}
