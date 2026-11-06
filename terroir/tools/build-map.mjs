// Draws the maps for 风土 Terroir (terroir/index.html) from Natural Earth and writes them to
// terroir/map/, one file per view of the map.
//
//   npm ci                 once, in this folder
//   node build-map.mjs
//
// The first run downloads the Natural Earth layers it needs (version 5.1.2, public domain), about
// 40 MB, into .cache/, which git ignores. Run it again after adding a region, moving one to
// another view or changing a view below: each view is framed on the regions that belong to it
// (their `view` in ../data.js) and on the country or coast it is meant to show.
//
// Every view has its own projection: Equal Earth for the world, so the wine belts at 30° to 50°
// are straight bands, and elsewhere Lambert's azimuthal equal-area centred on the view, which
// keeps shapes true near the middle. The page projects the regions' points itself with the
// parameters written here (projectFor in index.html), so editing a region's coordinates needs no
// new run unless it moves outside its view.
//
// Each view's land, lakes, rivers and borders are clipped to a box around it, wide enough for
// every shape the map can take on screen, simplified to what still shows when the map is zoomed
// into a region, and written as SVG paths with coordinates rounded to a tenth of a unit, on a
// view 1000 units across its longer side.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { geoPath, geoEqualEarth, geoAzimuthalEqualArea } from 'd3-geo';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(ROOT, 'map');
const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';

// What each view frames, besides its own regions: [west, south, east, north] in degrees.
// The world view shows everything from 58°S to 84°N.
const VIEWS = {
  world:      { proj: 'equalEarth' },
  europe:     { frame: [-10, 36, 30, 55] },
  france:     { frame: [-4.8, 42.3, 8.3, 51.1] },
  italy:      { frame: [6.6, 36.6, 18.6, 47.1] },
  iberia:     { frame: [-9.6, 36.0, 3.4, 43.8] },
  central:    { frame: [6.0, 46.8, 22.0, 51.2] },
  california: { frame: [-123.6, 34.4, -119.8, 38.9] },
  pnw:        { frame: [-124.2, 44.6, -117.6, 47.8] },
  nyon:       { frame: [-80.1, 42.0, -75.9, 43.8] },
  southam:    { frame: [-72.2, -35.2, -64.8, -24.6] },
  cape:       { frame: [18.0, -34.4, 19.5, -33.1] },
  oceania:    { frame: [113.5, -46.5, 176.5, -30.5] },
  china:      { frame: [73.5, 18.0, 135.0, 53.5] },
};

// The map's frame on screen runs from square (1.0) on phones to wide (1.8) on desktops; the
// clip box has room for both around the view's focus, plus this much margin on each side.
const ASPECT = [1.0, 1.8];
const MARGIN = 0.14;
const SIZE = 1000;

// Simplification, as the smallest triangle (in square units) a point may make with its two
// neighbours before it is dropped (Visvalingam–Whyatt). Around each region, where the map zooms
// in, points are kept down to `fine`; elsewhere only down to `coarse`, which is all a view
// needs at its own scale; lines (rivers, borders) away from the regions go to LINE times that.
// A ring smaller than RING times its tolerance is dropped.
const TOL = { world: 0.35, coarse: 0.3, fine: 0.01 };
const LINE = 2;
const RING = 6;

// Rivers: the main layer down to this scale rank (big views stop earlier, or they fill with
// rivers no one is looking for), and these from the regional layers, which carry the smaller
// rivers wine regions are named for.
const RIVER_RANK = { europe: 5, china: 5, oceania: 6 };
// Lakes: down to scale rank 7, or 4 in the big views
const LAKE_RANK = { europe: 4, china: 4, oceania: 4 };
const RIVERS_EXTRA = new Set(['Saône', 'Sarre', 'Tanaro', 'Alazani', 'Arno', 'Cher', 'Allier', 'Neckar', 'Piave', 'Ill', 'Russian', 'Yakima']);

// Borders: only lines every major point of view agrees are international boundaries (Natural
// Earth records how each country's own maps class each line); disputed lines are left out.
const POVS = ['ISO', 'US', 'CN', 'IN', 'RU', 'FR', 'DE', 'GB', 'ES', 'IT', 'JP', 'BR'];

async function layer(name) {
  const file = path.join(CACHE, name + '.geojson');
  try { await stat(file); } catch {
    await mkdir(CACHE, { recursive: true });
    process.stdout.write(`downloading ${name}… `);
    const res = await fetch(NE + name + '.geojson');
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    console.log('done');
  }
  return JSON.parse(await readFile(file, 'utf8'));
}

async function regions() {
  const ctx = { window: {} };
  vm.runInNewContext(await readFile(path.join(ROOT, 'data.js'), 'utf8'), ctx);
  return ctx.window.TerroirData.regions;
}

/* ---- geometry helpers ---- */

// Collects what d3's geoPath draws, already projected and clipped, as lists of points.
function recorder() {
  const parts = [];
  let cur = null;
  return {
    parts,
    moveTo(x, y) { cur = { pts: [[x, y]], closed: false }; parts.push(cur); },
    lineTo(x, y) { cur.pts.push([x, y]); },
    closePath() { cur.closed = true; },
    arc() {},
  };
}

function triArea(a, b, c) { return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2; }
function ringArea(pts) { let s = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }

// Visvalingam–Whyatt: repeatedly drop the point that makes the smallest triangle with its
// neighbours, measured against the tolerance where it lies, until every remaining point makes at
// least its tolerance. Ends of open lines always stay.
function simplify(pts, closed, tolAt) {
  const n = pts.length;
  if (n < (closed ? 4 : 3)) return pts.slice();
  const prev = new Int32Array(n), next = new Int32Array(n), area = new Float64Array(n), gone = new Uint8Array(n);
  const tol = new Float64Array(n);
  for (let i = 0; i < n; i++) { prev[i] = i - 1; next[i] = i + 1; tol[i] = tolAt(pts[i][0], pts[i][1]); }
  if (closed) { prev[0] = n - 1; next[n - 1] = 0; }
  const heap = [];
  const push = (i) => { heap.push([area[i], i]); let j = heap.length - 1; while (j > 0) { const p = (j - 1) >> 1; if (heap[p][0] <= heap[j][0]) break; [heap[p], heap[j]] = [heap[j], heap[p]]; j = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let j = 0; for (;;) { const l = 2 * j + 1, r = l + 1; let m = j; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === j) break; [heap[m], heap[j]] = [heap[j], heap[m]]; j = m; } } return top; };
  const fixed = (i) => !closed && (i === 0 || i === n - 1);
  // a point's weight is its triangle over its tolerance: it goes while the weight is under 1
  const calc = (i) => { area[i] = fixed(i) ? Infinity : triArea(pts[prev[i]], pts[i], pts[next[i]]) / tol[i]; };
  for (let i = 0; i < n; i++) { calc(i); if (!fixed(i)) push(i); }
  let left = n;
  const floor = closed ? 3 : 2;
  while (heap.length && left > floor) {
    const [a, i] = pop();
    if (gone[i] || a !== area[i]) continue;   // stale entry
    if (a >= 1) break;
    gone[i] = 1; left--;
    const p = prev[i], q = next[i];
    next[p] = q; prev[q] = p;
    // a neighbour's new triangle can't be smaller than the one just removed, or it would leave too soon
    if (!fixed(p)) { calc(p); area[p] = Math.max(area[p], a); push(p); }
    if (!fixed(q)) { calc(q); area[q] = Math.max(area[q], a); push(q); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (!gone[i]) out.push(pts[i]);
  return out;
}

// Compact SVG path: absolute first point, then relative steps in tenths of a unit, written with
// as few separators as the path grammar allows ("l1.2-.3.5").
function num(t) {   // t: an integer number of tenths
  const neg = t < 0, a = Math.abs(t), s = a % 10 === 0 ? String(a / 10) : (a < 10 ? '.' + a : String(Math.floor(a / 10)) + '.' + (a % 10));
  return (neg ? '-' : '') + s;
}
function join(nums) {
  // a minus sign always starts a new number, and so does a point after a number that has one
  let s = '', dot = false;
  for (const v of nums) {
    if (s && !(v[0] === '-' || (v[0] === '.' && dot))) s += ' ';
    s += v;
    dot = v.includes('.');
  }
  return s;
}
function encode(parts) {
  let d = '';
  for (const { pts, closed } of parts) {
    const t = pts.map(([x, y]) => [Math.round(x * 10), Math.round(y * 10)]);
    const q = [t[0]];
    for (let i = 1; i < t.length; i++) if (t[i][0] !== q[q.length - 1][0] || t[i][1] !== q[q.length - 1][1]) q.push(t[i]);
    if (q.length < 2) continue;
    d += 'M' + join([num(q[0][0]), num(q[0][1])]);
    const steps = [];
    for (let i = 1; i < q.length; i++) steps.push(num(q[i][0] - q[i - 1][0]), num(q[i][1] - q[i - 1][1]));
    d += 'l' + join(steps);
    if (closed) d += 'z';
  }
  return d;
}

function draw(projection, geo, { tolAt, lines }) {
  const rec = recorder();
  const p = geoPath(projection, rec);
  for (const f of geo) p(f);
  const parts = [];
  for (const part of rec.parts) {
    let pts = part.pts;
    const closed = part.closed && !lines;
    if (closed && pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts = pts.slice(0, -1);
    if (closed) {
      let t = Infinity;
      for (const [x, y] of pts) t = Math.min(t, tolAt(x, y));
      if (ringArea(pts) < RING * t) continue;
    }
    pts = simplify(pts, closed, tolAt);
    if (closed && pts.length < 3) continue;
    parts.push({ pts, closed });
  }
  return encode(parts);
}

/* ---- framing ---- */

function sampleBox([w, s, e, n]) {   // the outline of a lon/lat box, densely enough for a curved projection
  const pts = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push([w + (e - w) * t, s], [w + (e - w) * t, n], [w, s + (n - s) * t], [e, s + (n - s) * t]); }
  return pts;
}
function bboxOf(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

function laeaFor(key, view, list) {
  const lonlat = sampleBox(view.frame);
  for (const r of list) { lonlat.push([r.lon, r.lat]); for (const s of r.spots || []) lonlat.push([s.lon, s.lat]); }
  const [w, s, e, n] = bboxOf(lonlat);
  const center = [+((w + e) / 2).toFixed(2), +((s + n) / 2).toFixed(2)];
  const proj = geoAzimuthalEqualArea().rotate([-center[0], -center[1]]).scale(1).translate([0, 0]).precision(0.1);
  // focus: the projected frame and regions; clip box: room for every aspect around it
  const [fx0, fy0, fx1, fy1] = bboxOf(lonlat.map((p) => proj(p)));
  const fw = fx1 - fx0, fh = fy1 - fy0, cx = (fx0 + fx1) / 2, cy = (fy0 + fy1) / 2;
  const bw = Math.max(fw, fh * ASPECT[1]) * (1 + 2 * MARGIN), bh = Math.max(fh, fw / ASPECT[0]) * (1 + 2 * MARGIN);
  const k = SIZE / Math.max(bw, bh);
  const W = Math.round(bw * k), H = Math.round(bh * k);
  const tx = W / 2 - cx * k, ty = H / 2 - cy * k;
  proj.scale(k).translate([tx, ty]).clipExtent([[0, 0], [W, H]]);
  const focus = [fx0 * k + tx, fy0 * k + ty, fx1 * k + tx, fy1 * k + ty].map((v) => +v.toFixed(1));
  return { proj, W, H, focus, params: { type: 'laea', center, scale: +k.toFixed(4), translate: [+tx.toFixed(3), +ty.toFixed(3)] } };
}

function equalEarthWorld() {
  const proj = geoEqualEarth().scale(1).translate([0, 0]).precision(0.1);
  const yTop = proj([0, 84])[1], yBot = proj([0, -58])[1];
  const xL = proj([-180, 0])[0], xR = proj([180, 0])[0];
  const k = SIZE / (xR - xL);
  const W = SIZE, H = Math.round((yBot - yTop) * k);
  const tx = -xL * k, ty = -yTop * k;
  proj.scale(k).translate([tx, ty]).clipExtent([[0, 0], [W, H]]);
  return { proj, W, H, focus: [0, 0, W, H], params: { type: 'equalEarth', scale: +k.toFixed(4), translate: [+tx.toFixed(3), +ty.toFixed(3)] } };
}

function band(s, n) {   // a band of latitude all the way round, clockwise as d3 wants a polygon smaller than a hemisphere
  const ring = [];
  for (let lon = -180; lon <= 180; lon += 2) ring.push([lon, n]);
  for (let lon = 180; lon >= -180; lon -= 2) ring.push([lon, s]);
  ring.push(ring[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] } };
}

/* ---- main ---- */

const [land10, land50, lakes10, lakesEu, rivers10, riversEu, riversNa, borders10] = await Promise.all([
  layer('ne_10m_land'), layer('ne_50m_land'), layer('ne_10m_lakes'), layer('ne_10m_lakes_europe'),
  layer('ne_10m_rivers_lake_centerlines'), layer('ne_10m_rivers_europe'), layer('ne_10m_rivers_north_america'),
  layer('ne_10m_admin_0_boundary_lines_land'),
]);
const all = await regions();

const lakesFor = (key) => [...lakes10.features.filter((f) => f.properties.scalerank <= (LAKE_RANK[key] || 7)), ...lakesEu.features.filter((f) => f.properties.name === 'Neusiedlersee')];
const riversFor = (key) => [
  ...rivers10.features.filter((f) => f.properties.featurecla === 'River' && f.properties.scalerank <= (RIVER_RANK[key] || 9)),
  ...[...riversEu.features, ...riversNa.features].filter((f) => RIVERS_EXTRA.has(f.properties.name)),
];
const borders = borders10.features.filter((f) => {
  const p = f.properties;
  return /^International boundary/.test(p.FEATURECLA) && POVS.every((k) => !p['FCLASS_' + k] || /^International boundary/.test(p['FCLASS_' + k]));
});

// Where a view keeps fine detail: a square around each of its regions, its dot and spots,
// three times as wide as they spread and at least 120 km across.
function detailBoxes(proj, k, list) {
  return list.map((r) => {
    const pts = [[r.lon, r.lat], ...(r.spots || []).map((s) => [s[3], s[2]])].map((p) => proj(p));
    const [x0, y0, x1, y1] = bboxOf(pts);
    const half = Math.max(x1 - x0, y1 - y0, (40 / 6371) * k) * 1.6;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - half, cy - half, cx + half, cy + half];
  });
}

await mkdir(OUT, { recursive: true });
let total = 0;
for (const [key, view] of Object.entries(VIEWS)) {
  const world = view.proj === 'equalEarth';
  const list = all.filter((r) => r.view === key);
  const { proj, W, H, focus, params } = world ? equalEarthWorld() : laeaFor(key, view, list);
  const boxes = world ? [] : detailBoxes(proj, params.scale, list);
  const near = (x, y) => boxes.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
  const tolAt = world ? () => TOL.world : (x, y) => (near(x, y) ? TOL.fine : TOL.coarse);
  const lineTolAt = world ? () => TOL.world : (x, y) => (near(x, y) ? TOL.fine : TOL.coarse * LINE);
  const out = {
    w: W, h: H, proj: params, focus,
    land: draw(proj, world ? land50.features : land10.features, { tolAt }),
    lakes: draw(proj, world ? lakes10.features.filter((f) => f.properties.scalerank <= 1) : lakesFor(key), { tolAt }),
    rivers: world ? '' : draw(proj, riversFor(key), { tolAt: lineTolAt, lines: true }),
    borders: world ? '' : draw(proj, borders, { tolAt: lineTolAt, lines: true }),
  };
  if (world) {
    out.belts = draw(proj, [band(30, 50), band(-50, -30)], { tolAt });
    out.sphere = draw(proj, [{ type: 'Sphere' }], { tolAt });
  }
  const json = JSON.stringify(out);
  total += json.length;
  await writeFile(path.join(OUT, key + '.json'), json + '\n');
  const kb = (s) => (s.length / 1024).toFixed(0);
  console.log(`${key.padEnd(11)} ${W}×${H}  ${kb(json).padStart(4)} KB  (land ${kb(out.land)}, lakes ${kb(out.lakes)}, rivers ${kb(out.rivers)}, borders ${kb(out.borders)}) · ${list.length} regions`);
}
console.log(`all views ${(total / 1024).toFixed(0)} KB`);
