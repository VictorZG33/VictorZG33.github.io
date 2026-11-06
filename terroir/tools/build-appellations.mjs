// Draws the appellations onto the map of 风土 Terroir (terroir/index.html): the official boundaries
// of France's appellations, Burgundy down to every named climat, and the American Viticultural
// Areas, written to terroir/map/appellations/, one file per area.
//
//   npm ci                       once, in this folder
//   node --max-old-space-size=8192 build-appellations.mjs     about ten minutes
//
// The first run downloads, into .cache/ (which git ignores):
//   - INAO's "Délimitation parcellaire des AOC viticoles" (data.gouv.fr, Licence Ouverte), about
//     270 MB zipped, the parcel-by-parcel production area of each French appellation;
//   - UC Davis's AVA Project boundaries (CC0), about 43 MB.
// Run it again after map/<view>.json changes (build-map.mjs), since the shapes are drawn in the
// same coordinates as the views they sit on, or to take in a new release of either dataset
// (delete its folder in .cache first).
//
// Each record is sorted into an area of the map and a tier, from regional (1) to grand cru (5);
// the page names them (apTiers in index.html). Each tier of each area is simplified on its own
// (SHAPES), so the climats keep metre-scale detail and the large appellations, seen whole, are
// smoothed; the area written for each is the delimited one, measured before any smoothing. Each
// shape's name goes where the tiers above leave room for it (labelPoints). A shape is written as
//   [name, tier, parent, hectares, hectares not under a higher tier, label x, label y,
//    box x0, y0, x1, y1, path]
// in the units of its view, the path relative and in metres from the file's origin.
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shapefile from 'shapefile';
import mapshaper from 'mapshaper';
import { geoAzimuthalEqualArea } from 'd3-geo';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(ROOT, 'map', 'appellations');
const INAO_DATASET = 'https://www.data.gouv.fr/api/1/datasets/5aaf6b7ec751df67b0d7a87f/';
const AVA_URL = 'https://raw.githubusercontent.com/UCDavisLibrary/ava/master/avas_aggregated_files/avas.geojson';
const L93 = '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +units=m +no_defs';

// How a tier is drawn, in metres and hectares: the simplification interval; the gaps between
// parcels closed when dissolving (gap), or for appellations seen whole a closing (close: out and
// back in by this radius, after a first simplification at `pre`), which joins INAO's parcels into
// one zone across the roads, woods and villages between them; and the smallest part and hole kept
// (an appellation's largest part is always kept). The zoom limit in index.html (MAX_ZOOM) is set for
// the climats, at 2 m.
const CLIMAT = { interval: 2, gap: 3, part: 0.02, hole: 0.05 };
const ZONE = { pre: 15, close: 60, interval: 30, part: 5, hole: 25 };
const SHAPES = {
  // Burgundy and Chablis, whose villages are seen as closely as their climats
  fine: { 5: CLIMAT, 4: CLIMAT, 3: { interval: 6, gap: 10, part: 0.3, hole: 1 },
    2: { pre: 10, close: 30, interval: 15, part: 3, hole: 10 }, 1: { pre: 12, close: 40, interval: 20, part: 4, hole: 15 } },
  // small regions: the northern Rhône, Alsace, Beaujolais
  medium: { 5: CLIMAT, 4: CLIMAT, 3: { pre: 5, close: 20, interval: 10, part: 0.5, hole: 3 }, 2: ZONE, 1: ZONE },
  // the rest of France, seen a region at a time
  coarse: { 5: CLIMAT, 4: CLIMAT, 3: { pre: 20, close: 80, interval: 40, part: 5, hole: 30 },
    2: { pre: 30, close: 150, interval: 60, part: 20, hole: 100 }, 1: { pre: 50, close: 300, interval: 100, part: 50, hole: 300 } },
  // AVAs are drawn as single boundary lines, not parcel by parcel
  ava: { 3: { interval: 30, part: 1, hole: 10 }, 2: { interval: 80, part: 5, hole: 50 } },
};
const AREA_SHAPES = { burgundy: 'fine', chablis: 'fine', 'rhone-north': 'medium', alsace: 'medium', beaujolais: 'medium' };
const shapeFor = (area, tier) => SHAPES[AVA_AREAS[area] ? 'ava' : AREA_SHAPES[area] || 'coarse'][tier];

/* ---- France: INAO appellations ---- */

const GRANDS_CRUS = new Set(['Chambertin', 'Chambertin-Clos de Bèze', 'Chapelle-Chambertin', 'Charmes-Chambertin', 'Griotte-Chambertin',
  'Latricières-Chambertin', 'Mazis-Chambertin', 'Mazoyères-Chambertin', 'Ruchottes-Chambertin', 'Clos de la Roche', 'Clos Saint-Denis',
  'Clos des Lambrays', 'Clos de Tart', 'Bonnes-Mares', 'Musigny', 'Clos de Vougeot ou Clos Vougeot', 'Echezeaux', 'Grands-Echezeaux',
  'Romanée-Conti', 'La Romanée', 'La Tâche', 'Richebourg', 'Romanée-Saint-Vivant', 'La Grande Rue', 'Corton', 'Corton-Charlemagne',
  'Montrachet', 'Chevalier-Montrachet', 'Bâtard-Montrachet', 'Bienvenues-Bâtard-Montrachet', 'Criots-Bâtard-Montrachet']);
const BEAUJOLAIS_CRUS = new Set(['Brouilly', 'Côte de Brouilly', 'Chénas', 'Chiroubles', 'Fleurie', 'Juliénas', 'Morgon', 'Moulin-à-Vent', 'Régnié', 'Saint-Amour']);
const BURGUNDY_SKIP = new Set(['Bourgogne aligoté', 'Bourgogne Passe-tout-grains', 'Bourgogne mousseux', 'Crémant de Bourgogne',
  'Coteaux Bourguignons ou Bourgogne grand ordinaire ou Bourgogne ordinaire', 'Charlemagne']);   // overlap others; Charlemagne lies inside Corton-Charlemagne
const BURGUNDY_DISTRICTS = new Set(['Côte de Nuits-Villages ou Vins fins de la Côte de Nuits', 'Côte de Beaune-Villages', 'Mâcon']);
const BORDEAUX = {
  3: ['Saint-Estèphe', 'Pauillac', 'Saint-Julien', 'Margaux', 'Listrac-Médoc', 'Moulis ou Moulis-en-Médoc', 'Pessac-Léognan', 'Sauternes',
    'Barsac', 'Cérons', 'Loupiac', 'Sainte-Croix-du-Mont', 'Cadillac', 'Saint-Emilion', 'Pomerol', 'Lalande-de-Pomerol', 'Fronsac',
    'Canon Fronsac', 'Montagne-Saint-Emilion', 'Lussac Saint-Emilion', 'Puisseguin Saint-Emilion', 'Saint-Georges-Saint-Emilion',
    'Côtes de Bourg, Bourg et Bourgeais'],
  2: ['Médoc', 'Haut-Médoc', 'Graves', 'Entre-deux-Mers', 'Graves de Vayres', 'Côtes de Bordeaux-Saint-Macaire'],
  1: ['Bordeaux'],
};
const LOIRE = {
  5: ['Quarts de Chaume'],
  3: ['Savennières', 'Savennières Roche aux Moines', 'Coulée de Serrant', 'Bonnezeaux', 'Saumur-Champigny', 'Chinon', 'Bourgueil',
    'Saint-Nicolas-de-Bourgueil', 'Vouvray', 'Montlouis-sur-Loire', 'Jasnières', 'Sancerre', 'Pouilly-Fumé ou Blanc Fumé de Pouilly',
    'Menetou-Salon', 'Quincy', 'Reuilly', 'Cour-Cheverny'],
  2: ['Anjou Villages', 'Anjou Brissac', 'Coteaux de l\'Aubance', 'Coteaux du Layon', 'Saumur', 'Coteaux de Saumur', 'Muscadet Sèvre et Maine',
    'Muscadet Coteaux de la Loire', 'Muscadet Côtes de Grandlieu', 'Cheverny', 'Touraine Noble Joué', 'Coteaux du Giennois'],
  1: ['Anjou', 'Touraine', 'Muscadet'],
};
const RHONE_NORTH = { 3: ['Côte Rôtie', 'Condrieu', 'Château-Grillet', 'Saint-Joseph', 'Hermitage ou Ermitage ou l\'Hermitage ou l\'Ermitage',
  'Crozes-Hermitage ou Crozes-Ermitage', 'Cornas', 'Saint-Péray'] };
const RHONE_SOUTH = {
  3: ['Châteauneuf-du-Pape', 'Gigondas', 'Vacqueyras', 'Vinsobres', 'Rasteau', 'Cairanne', 'Beaumes de Venise', 'Lirac', 'Tavel', 'Laudun'],
  2: ['Côtes du Rhône Villages'],
  1: ['Côtes du Rhône', 'Ventoux', 'Luberon', 'Costières de Nîmes', 'Grignan-les-Adhémar'],
};
const PROVENCE = {
  3: ['Bandol', 'Palette', 'Les Baux de Provence'],
  1: ['Côtes de Provence', 'Coteaux d\'Aix-en-Provence', 'Coteaux varois en Provence'],
};
const LANGUEDOC = {
  3: ['Pic Saint-Loup', 'Faugères', 'Saint-Chinian', 'Minervois', 'La Livinière', 'Corbières', 'Boutenac', 'Fitou', 'La Clape', 'Limoux',
    'Picpoul de Pinet', 'Terrasses du Larzac', 'Montpeyroux', 'Cabardès', 'Malepère', 'Banyuls', 'Collioure', 'Maury',
    'Muscat de Frontignan ou Frontignan ou Vin de Frontignan', 'Muscat de Lunel', 'Muscat de Mireval', 'Muscat de Saint-Jean-de-Minervois'],
  2: ['Côtes du Roussillon Villages', 'Grés de Montpellier'],
  1: ['Languedoc', 'Côtes du Roussillon'],
};
const tierOf = (table, app) => { for (const t of [5, 4, 3, 2, 1]) if ((table[t] || []).includes(app)) return t; return 0; };

// The name to show: the first of INAO's alternatives, with the accents its file leaves out
const FIX = [[/\bEmilion\b/g, 'Émilion'], [/\bEchezeaux\b/g, 'Échezeaux'], [/^Côte Rôtie$/, 'Côte-Rôtie'], [/^Beaumes de Venise$/, 'Beaumes-de-Venise'],
  [/^Lussac Saint/, 'Lussac-Saint'], [/^Puisseguin Saint/, 'Puisseguin-Saint'], [/^Canon Fronsac$/, 'Canon-Fronsac'], [/^Moulis$/, 'Moulis-en-Médoc'],
  [/^Côtes de Bordeaux (Blaye|Cadillac|Castillon|Francs)$/, '$1 Côtes de Bordeaux']];
function display(s) {
  let n = s.split(' ou ')[0].replace(/\s*\((rouge et blanc|rosé|blanc|rouge et rosé|mousseux)\)$/i, '').replace(/, Bourg et Bourgeais$/, '').trim();
  for (const [re, to] of FIX) n = n.replace(re, to);
  return n;
}

// -> { area, tier, name, parent } or null
function classifyInao(p) {
  if (p.type_prod !== 'Vins') return null;
  const app = p.app, denom = p.denom, sub = p.type_denom !== 'appellation', dep = String(p.insee || p.insee2011 || '').slice(0, 2);
  const make = (area, tier, name, parent) => ({ area, tier, name: display(name), parent: parent ? display(parent) : '' });
  // a village's premier cru land as a whole: INAO names only some of Chablis's climats (not
  // Montée de Tonnerre, Vaillons or Montmains), so the rest is shown as "Chablis Premier Cru"; the
  // named climats take their own land from it (see shapeTier)
  const umbrella = (area) => ({ ...make(area, 4, app + ' Premier Cru', app), umbrella: true });
  if (app === 'Beaujolais' || BEAUJOLAIS_CRUS.has(app)) {
    if (BEAUJOLAIS_CRUS.has(app)) return make('beaujolais', 3, app);
    if (!sub) return make('beaujolais', 1, app);
    return /villages/i.test(denom) ? make('beaujolais', 2, denom) : null;
  }
  if (dep === '89') {   // Chablis and the Auxerrois
    if (app === 'Chablis Grand Cru') return sub ? make('chablis', 5, denom.replace(/^Chablis Grand Cru /, ''), 'Chablis Grand Cru') : make('chablis', 5, 'Chablis Grand Cru');
    if (app === 'Chablis') {
      if (!sub) return make('chablis', 3, app);
      if (denom === 'Chablis premier cru') return umbrella('chablis');
      const m = denom.match(/premier cru (.+)$/i); return m ? make('chablis', 4, m[1], 'Chablis') : null;
    }
    if (app === 'Petit Chablis') return make('chablis', 2, app);
    if (app === 'Irancy' || app === 'Saint-Bris') return make('chablis', 3, app);
    if (app === 'Bourgogne' && !sub) return make('chablis', 1, app);
    return null;
  }
  if (dep === '21' || dep === '71') {   // the Côte d'Or, the Côte Chalonnaise and the Mâconnais
    if (BURGUNDY_SKIP.has(app)) return null;
    if (app === 'Bourgogne') {
      if (!sub) return make('burgundy', 1, app);
      return /Hautes-Côtes de (Nuits|Beaune)|Côte Chalonnaise/.test(denom) ? make('burgundy', 2, denom) : null;
    }
    if (GRANDS_CRUS.has(app)) return sub ? make('burgundy', 5, denom.replace(/^Corton /, ''), app) : make('burgundy', 5, app);
    if (BURGUNDY_DISTRICTS.has(app)) return sub ? null : make('burgundy', 2, app);
    if (!sub) return make('burgundy', 3, app);
    if (denom === app + ' premier cru') return umbrella('burgundy');
    const m = denom.match(/premier cru (.+)$/i);
    return m ? make('burgundy', 4, m[1], app) : null;
  }
  if (dep === '33') {
    if (app === 'Côtes de Bordeaux') return sub && !/Haut-Benauge/.test(denom) ? make('bordeaux', 2, denom) : null;
    const t = tierOf(BORDEAUX, app);
    return t && !sub ? make('bordeaux', t, app) : null;
  }
  if (dep === '67' || dep === '68') {
    if (app.startsWith('Alsace grand cru ')) return make('alsace', 5, app.replace('Alsace grand cru ', ''), 'Alsace grand cru');
    if (app === 'Alsace ou Vin d\'Alsace') return sub ? make('alsace', 2, denom) : make('alsace', 1, 'Alsace');
    return null;
  }
  let t;
  if ((t = tierOf(LOIRE, app))) {
    if (!sub) return make('loire', t, app);
    if (app === 'Coteaux du Layon' && /premier cru Chaume/.test(denom)) return make('loire', 4, 'Chaume', 'Coteaux du Layon');
    return null;
  }
  if (app === 'Muscadet Sèvre et Maine' && sub) return make('loire', 3, denom);   // its crus communaux, Clisson, Gorges, Le Pallet
  if (app === 'Touraine' && sub) return make('loire', 2, denom);
  if ((t = tierOf(RHONE_NORTH, app))) return sub ? null : make('rhone-north', t, app);
  if ((t = tierOf(RHONE_SOUTH, app))) return sub ? null : make('rhone-south', t, app);
  if ((t = tierOf(PROVENCE, app))) return sub ? null : make('provence', t, app);
  if (app === 'Côtes de Provence' && sub) return make('provence', 2, denom);
  if ((t = tierOf(LANGUEDOC, app))) {
    if (!sub) return make('languedoc', t, app);
    if (app === 'Saint-Chinian') return make('languedoc', 3, denom);
    if (app === 'Languedoc' && !/\((Blanc|Rouge)/.test(denom)) return make('languedoc', 2, denom);
    return null;
  }
  return null;
}

/* ---- United States: AVAs, an area's own AVAs (tier 2) and the ones inside them (tier 3) ---- */
const AVA_AREAS = {
  'north-coast': { view: 'california', roots: ['Napa Valley', 'Northern Sonoma', 'Sonoma Valley', 'Sonoma Coast'] },
  'central-coast': { view: 'california', roots: ['Santa Cruz Mountains', 'Monterey', 'Paso Robles', 'Santa Ynez Valley', 'Santa Maria Valley',
    'Edna Valley', 'Arroyo Grande Valley', 'York Mountain', 'San Benito'] },
  'willamette': { view: 'pnw', roots: ['Willamette Valley'] },
  'columbia': { view: 'pnw', roots: ['Columbia Valley'] },
  'finger-lakes': { view: 'nyon', roots: ['Finger Lakes'] },
};
const FRANCE_VIEW = 'france';
// AREAS=burgundy,napa node build-appellations.mjs builds only those areas (the index keeps the others)
const ONLY = process.env.AREAS ? new Set(process.env.AREAS.split(',')) : null;

/* ---- downloads ---- */
const run = promisify(execFile);
async function exists(f) { try { await stat(f); return true; } catch { return false; } }
async function download(url, file) {
  process.stdout.write(`downloading ${url}… `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  console.log('done');
}
async function inaoShapefile() {
  const dir = path.join(CACHE, 'inao');
  await mkdir(dir, { recursive: true });
  const find = async () => (await readdir(dir)).filter((f) => /delim-parcellaire-aoc-shp\.shp$/.test(f)).sort().pop();
  let shp = await find();
  if (!shp) {
    const meta = await (await fetch(INAO_DATASET)).json();
    const res = meta.resources.filter((r) => /delim-parcellaire-aoc-shp\.zip$/.test(r.url)).sort((a, b) => (a.url < b.url ? 1 : -1))[0];
    if (!res) throw new Error('no shapefile in the INAO dataset');
    const zip = path.join(dir, 'delim.zip');
    await download(res.url, zip);
    await run('unzip', ['-o', '-q', zip, '-d', dir]);
    shp = await find();
  }
  return path.join(dir, shp);
}
async function avaFile() {
  const file = path.join(CACHE, 'ava', 'avas.geojson');
  if (!(await exists(file))) { await mkdir(path.dirname(file), { recursive: true }); await download(AVA_URL, file); }
  return file;
}

/* ---- shaping one tier of one area with mapshaper ---- */
// Appellations overlap: INAO's Chambertin includes Clos de Bèze, which may be sold as Chambertin,
// Sauternes includes Barsac, Corton its own climats. Within a tier the most specific one wins: the
// overlaps are cut into a mosaic and each piece goes to the smallest appellation covering it, so
// Chambertin comes out at its own 12.9 ha. Then the narrow gaps INAO leaves between parcels
// (roads, paths) are closed, and slivers and specks dropped.
async function shapeTier(features, crs, shape) {
  const info = new Map(features.map((f) => [f.properties.key, f.properties]));
  const input = { type: 'FeatureCollection', features: features.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: { key: f.properties.key } })) };
  const init = crs ? `-proj init="${crs}" target=in` : '';
  const resolved = await mapshaper.applyCommands([
    `-i in.json`, init,
    `-dissolve key allow-overlaps`,
    `-each "tot=this.area"`,
    `-mosaic calc="keys=collect(key), tots=collect(tot)"`,
    // the smallest wins; two with the very same area (Charmes- and Mazoyères-Chambertin, each of
    // which may be sold as the other) share the piece under both names
    `-each "key=keys && keys.length ? (function () { var m = Math.min.apply(null, tots); return keys.filter(function (k, i) { return tots[i] - m < m * 1e-6; }).sort().join(' / '); })() : null"`,
    `-filter "key != null"`,   // a gap enclosed by appellations, covered by none
    `-dissolve key gap-width=${shape.gap || 1}m`,
    `-each "ha=this.area/10000"`,   // the delimited area, before the closing pads it
    `-o out.json format=geojson precision=0.01`,
  ].filter(Boolean).join(' '), { 'in.json': input });
  // then each appellation on its own, which keeps the closing's memory in bounds. mapshaper's
  // buffer fails on a few rings; those are tried again unsimplified, then left unclosed.
  const finish = (close) => [
    ...(close === 2 ? [`-simplify interval=${shape.pre}m keep-shapes`, `-clean`] : []),
    ...(close ? [`-buffer ${shape.close} fill-gaps merge-islands`] : []),
    `-filter-slivers gap-width=${Math.max(1, (shape.gap || (shape.close || 4) / 4) / 2)}m keep-shapes`,
    `-simplify interval=${shape.interval}m keep-shapes`,
    `-proj wgs84`,
    `-each "lx=this.innerX, ly=this.innerY"`,
    `-o out.json format=geojson precision=0.0000001`,
  ].join(' ');
  const pieces = JSON.parse(resolved['out.json']).features;
  const groups = shape.close ? pieces.map((f) => [f]) : [pieces];
  const feats = [];
  for (const group of groups) {
    for (const close of shape.close ? [2, 1, 0] : [0]) {
      try {
        const out = await mapshaper.applyCommands(`-i in.json ${init} ${finish(close)}`, { 'in.json': { type: 'FeatureCollection', features: group } });
        feats.push(...JSON.parse(out['out.json']).features.filter((f) => f.geometry));
        break;
      } catch (e) {
        console.warn(`  ${group[0].properties.key}: ${e.message}${close ? ', trying again' + (close === 2 ? ' unsimplified' : ' unclosed') : ''}`);
        if (!close) throw e;
      }
    }
  }
  // masks (the grand crus, when shaping premier crus) only take land away
  const real = (f) => f.properties.key.split(' / ').filter((k) => !info.get(k).mask);
  const kept = new Set(feats.flatMap(real));
  for (const [k, p] of info) if (!kept.has(k) && !p.mask) console.warn(`  lost: ${k}, covered by the others`);
  return feats.filter((f) => real(f).length).map((f) => {
    const parts = real(f).map((k) => info.get(k));
    const join = (key) => [...new Set(parts.map((x) => x[key]))].join(' / ');   // Hameau de Blagny: Blagny's, and Puligny's
    return { ...f, properties: { ...parts[0], name: join('name'), parent: join('parent'), ha: f.properties.ha, lx: f.properties.lx, ly: f.properties.ly } };
  });
}

// Where an appellation's name goes: inside what the tiers above leave of it, so Aloxe-Corton is
// named on its village land, not on Corton. Also that part's area, for fitting the name.
async function labelPoints(feats) {
  for (const t of [1, 2, 3]) {
    const mine = feats.filter((f) => f.properties.tier === t), above = feats.filter((f) => f.properties.tier > t);
    for (const f of mine) f.properties.vha = f.properties.ha;
    if (!mine.length || !above.length) continue;
    const a = { type: 'FeatureCollection', features: mine.map((f, i) => ({ type: 'Feature', geometry: f.geometry, properties: { i } })) };
    const b = { type: 'FeatureCollection', features: above.map((f) => ({ type: 'Feature', geometry: f.geometry, properties: {} })) };
    const out = await mapshaper.applyCommands('-i a.json b.json combine-files -erase target=a source=b ' +
      '-each "lx=this.innerX, ly=this.innerY, vha=this.area/10000" target=a -o out.json format=geojson target=a', { 'a.json': a, 'b.json': b });
    const seen = new Set();
    for (const f of JSON.parse(out['out.json']).features) {
      const p = mine[f.properties.i].properties;
      seen.add(f.properties.i);
      if (f.geometry) Object.assign(p, { lx: f.properties.lx, ly: f.properties.ly, vha: f.properties.vha });
      else p.vha = 0;
    }
    mine.forEach((f, i) => { if (!seen.has(i)) f.properties.vha = 0; });   // all of it under higher tiers
  }
}

/* ---- projection onto a view, and compact paths ---- */
async function viewProjection(view) {
  const v = JSON.parse(await readFile(path.join(ROOT, 'map', view + '.json'), 'utf8'));
  const p = v.proj;
  const proj = geoAzimuthalEqualArea().rotate([-p.center[0], -p.center[1]]).scale(p.scale).translate(p.translate).precision(0);
  return { proj, unitsPerMetre: p.scale / 6371000 };
}
function ringArea(r) { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
// Relative path in integer local units (about a metre each), as few separators as SVG allows
function encode(rings, ox, oy, s) {
  let d = '';
  for (const ring of rings) {
    const pts = ring.map(([x, y]) => [Math.round((x - ox) / s), Math.round((y - oy) / s)]);
    const q = [pts[0]];
    for (let i = 1; i < pts.length; i++) if (pts[i][0] !== q[q.length - 1][0] || pts[i][1] !== q[q.length - 1][1]) q.push(pts[i]);
    if (q.length > 1 && q[0][0] === q[q.length - 1][0] && q[0][1] === q[q.length - 1][1]) q.pop();
    if (q.length < 3) continue;
    let s2 = 'M' + q[0][0] + (q[0][1] < 0 ? '' : ' ') + q[0][1] + 'l';
    let first = true;
    for (let i = 1; i < q.length; i++) {
      for (const v of [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]) { s2 += (first || v < 0 ? '' : ' ') + v; first = false; }
    }
    d += s2 + 'z';
  }
  return d;
}

async function writeArea(area, view, feats) {
  const { proj, unitsPerMetre } = await viewProjection(view);
  const s = unitsPerMetre;   // view units per local unit: one metre
  const shapes = [];
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const f of feats) {
    const g = f.geometry; if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const shape = shapeFor(area, f.properties.tier);
    const toHa = (pr) => Math.abs(ringArea(pr)) / (unitsPerMetre * unitsPerMetre) / 10000;
    const projected = polys.map((poly) => poly.map((ring) => ring.map((c) => proj(c))));
    const largest = Math.max(...projected.map((poly) => toHa(poly[0])));
    const rings = [];
    let ha = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of projected) {
      poly.forEach((pr, i) => {
        const a = toHa(pr);
        if (i === 0 ? a < shape.part && a < largest : a < shape.hole) return;
        if (i === 0) ha += a; else ha -= a;
        rings.push(pr);
        for (const [x, y] of pr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      });
    }
    if (!rings.length) continue;
    if (f.properties.umbrella && ha < 1) continue;   // what the named climats leave of it: slivers
    if (f.properties.ha != null) ha = f.properties.ha;
    const l = proj([f.properties.lx, f.properties.ly]);
    shapes.push({ p: f.properties, rings, ha, box: [x0, y0, x1, y1], l });
    bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1);
  }
  // regional first and grand cru last, so finer tiers draw on top; large before small within a tier
  shapes.sort((a, b) => a.p.tier - b.p.tier || b.ha - a.ha);
  const r4 = (v) => +v.toFixed(4);
  const out = {
    view, origin: [r4(bx0), r4(by0)], unit: +s.toPrecision(6), box: [r4(bx0), r4(by0), r4(bx1), r4(by1)],
    // [name, tier, parent, hectares, hectares not under a higher tier, label x, label y, box x0, y0, x1, y1, path]
    shapes: shapes.map(({ p, rings, ha, box, l }) => {
      const vha = Math.min(ha, p.vha != null ? p.vha : ha);
      return [p.name, p.tier, p.parent, +ha.toFixed(ha < 10 ? 2 : 0), +vha.toFixed(vha < 10 ? 2 : 0), r4(l[0]), r4(l[1]), ...box.map(r4), encode(rings, bx0, by0, s)];
    }),
  };
  const json = JSON.stringify(out);
  await writeFile(path.join(OUT, area + '.json'), json + '\n');
  const byTier = [1, 2, 3, 4, 5].map((t) => shapes.filter((x) => x.p.tier === t).length).join('/');
  console.log(`${area.padEnd(14)} ${(json.length / 1024).toFixed(0).padStart(5)} KB  ${shapes.length} shapes (tiers 1–5: ${byTier})`);
  return { id: area, view, box: out.box, n: shapes.length };
}

/* ---- main ---- */
await mkdir(OUT, { recursive: true });
const indexFile = path.join(OUT, 'index.json');
const index = ONLY && (await exists(indexFile)) ? JSON.parse(await readFile(indexFile, 'utf8')).filter((a) => !ONLY.has(a.id)) : [];

// France
const groups = {};   // area -> tier -> features in Lambert-93
const src = await shapefile.open(await inaoShapefile(), undefined, { encoding: 'utf-8' });
let count = 0;
for (;;) {
  const { done, value } = await src.read();
  if (done) break;
  count++;
  const c = classifyInao(value.properties);
  if (!c || (ONLY && !ONLY.has(c.area))) continue;
  const key = c.parent + '|' + c.name;
  ((groups[c.area] = groups[c.area] || {})[c.tier] = groups[c.area][c.tier] || []).push({ type: 'Feature', geometry: value.geometry, properties: { key, name: c.name, tier: c.tier, parent: c.parent, umbrella: !!c.umbrella } });
}
console.log(`INAO: ${count} records read`);
for (const [area, tiers] of Object.entries(groups)) {
  const feats = [];
  for (const [tier, list] of Object.entries(tiers)) {
    // a village's premier cru land includes its grand crus (which may be sold as premier cru)
    const masks = +tier === 4 ? (tiers[5] || []).map((f) => ({ ...f, properties: { ...f.properties, key: 'mask|' + f.properties.key, mask: true } })) : [];
    feats.push(...(await shapeTier(list.concat(masks), L93, shapeFor(area, +tier))));
  }
  await labelPoints(feats);
  index.push(await writeArea(area, FRANCE_VIEW, feats));
}

// United States
const avas = JSON.parse(await readFile(await avaFile(), 'utf8')).features.filter((f) => !f.properties.valid_end);
for (const [area, cfg] of Object.entries(AVA_AREAS)) {
  if (ONLY && !ONLY.has(area)) continue;
  const within = (f) => String(f.properties.within || '').split('|').map((s) => s.trim());
  const chosen = avas.filter((f) => cfg.roots.includes(f.properties.name) || within(f).some((w) => cfg.roots.includes(w)));
  const byTier = { 2: [], 3: [] };
  for (const f of chosen) {
    const tier = cfg.roots.includes(f.properties.name) ? 2 : 3;
    byTier[tier].push({ type: 'Feature', geometry: f.geometry, properties: { key: f.properties.name, name: f.properties.name, tier, parent: '' } });
  }
  const feats = [];
  for (const [tier, list] of Object.entries(byTier)) if (list.length) feats.push(...(await shapeTier(list, null, shapeFor(area, +tier))));
  await labelPoints(feats);
  index.push(await writeArea(area, cfg.view, feats));
}

index.sort((a, b) => (a.id < b.id ? -1 : 1));
await writeFile(indexFile, JSON.stringify(index) + '\n');
console.log(`index: ${index.length} areas`);
