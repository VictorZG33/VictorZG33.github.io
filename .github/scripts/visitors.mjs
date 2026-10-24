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

async function get(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

// /me needs no particular permission, so a failure here is about the key itself.
try {
  await get('/me');
} catch (err) {
  throw new Error(`GoatCounter did not accept the API key; check the GOATCOUNTER_TOKEN secret. ${err.message}`);
}

// The API takes whole hours; without a start it would default to the last seven days.
const end = new Date();
end.setUTCHours(end.getUTCHours() + 1, 0, 0, 0);
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
const countries = rows
  .map((r) => ({ code: String(r.id || '').toUpperCase(), name: r.name, count: r.count }))
  .filter((r) => r.count > 0 && centres[r.code])   // drops visits with no known country
  .map((r) => ({ ...r, lat: centres[r.code][0], lon: centres[r.code][1] }));

const data = { since, total, countries };
const same = previous && JSON.stringify({ since: previous.since, total: previous.total, countries: previous.countries }) === JSON.stringify(data);
if (same) {
  console.log(`No change: ${total} visitors from ${countries.length} countries`);
} else {
  const out = { updated: new Date().toISOString().slice(0, 10), ...data };
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`Wrote ${OUT}: ${total} visitors from ${countries.length} countries since ${since}`);
}
