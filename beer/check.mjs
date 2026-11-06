// Checks beer/data.js: each style's numbers against the BJCP 2021 Style Guidelines, read from the
// BeerJSON project's copy of them on GitHub, and that every hop or stand-in a page links to exists.
// Run from the repository: node beer/check.mjs (Node 18 or newer, for fetch).
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const D = require('./data.js');
const SOURCE = 'https://raw.githubusercontent.com/beerjson/bjcp-json/main/styles/bjcp_styleguide-2021.json';
const FIELDS = { og: 'original_gravity', fg: 'final_gravity', abv: 'alcohol_by_volume', ibu: 'international_bitterness_units', srm: 'color' };

let problems = 0;
const fail = (msg) => { problems++; console.log('  ' + msg); };

const res = await fetch(SOURCE);
if (!res.ok) throw new Error('could not read ' + SOURCE + ': ' + res.status);
const bjcp = new Map((await res.json()).beerjson.styles.map((s) => [s.style_id, s]));

console.log('Styles against BJCP 2021');
for (const s of D.STYLES) {
  // "23D-23E" covers two categories: the style's range is the two put together
  const ids = s.bjcp.split('-');
  const cats = ids.map((id) => bjcp.get(id));
  if (cats.some((c) => !c)) { fail(s.id + ': no BJCP category ' + s.bjcp); continue; }
  for (const [key, field] of Object.entries(FIELDS)) {
    const lo = Math.min(...cats.map((c) => c[field].minimum.value));
    const hi = Math.max(...cats.map((c) => c[field].maximum.value));
    const [a, b] = s[key];
    if (Math.abs(a - lo) > 1e-9 || Math.abs(b - hi) > 1e-9) fail(s.id + ' ' + key + ': ' + a + '–' + b + ', BJCP says ' + lo + '–' + hi);
  }
}

console.log('Links between styles and hops');
const hops = new Set(D.HOPS.map((h) => h.id));
for (const s of D.STYLES) for (const h of s.hops) if (!hops.has(h)) fail(s.id + ' names a hop that is not listed: ' + h);
for (const h of D.HOPS) {
  for (const x of h.sub || []) if (!hops.has(x)) fail(h.id + ' names a stand-in that is not listed: ' + x);
  if (!D.STYLES.some((s) => s.hops.includes(h.id))) fail(h.id + ' is not used by any style');
  if (!D.HOP_ORIGINS.some((o) => o.key === h.o)) fail(h.id + ' has an unknown origin: ' + h.o);
  const oils = ['myrcene', 'humulene', 'caryophyllene', 'farnesene'].reduce((t, k) => t + (h[k] ? (h[k][0] + h[k][1]) / 2 : 0), 0);
  if (oils > 100) fail(h.id + ': the oils add up to ' + oils.toFixed(0) + '% at the middle of their ranges');
}
for (const s of D.STYLES) {
  if (!D.GLASSES[s.glass]) fail(s.id + ' has an unknown glass: ' + s.glass);
  if (!D.REGIONS.some((r) => r.key === s.r)) fail(s.id + ' has an unknown region: ' + s.r);
}

console.log(problems ? problems + ' problem' + (problems > 1 ? 's' : '') : 'All good: ' + D.STYLES.length + ' styles, ' + D.HOPS.length + ' hops');
process.exitCode = problems ? 1 : 0;
