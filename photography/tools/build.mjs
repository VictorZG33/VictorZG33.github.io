// Makes the photographs for the gallery (photography/index.html) and for the contact sheet in the
// Photography tab of the homepage, from full-size masters.
//
//   npm ci                                once, in this folder
//   node build.mjs [masters] [--force]
//
// Masters are read from photography/masters unless another folder is given. Git ignores that
// folder, so the full-size files stay on this computer and only the sizes made from them are
// published. Each master is resized straight to every size a screen can ask for, sharpened at
// that size and compressed once, as AVIF and as JPEG for browsers without AVIF, in Display P3.
// A file is made again only when its master is newer, or with --force.
//
// photography/photos.json lists the photographs in the order they appear, with their captions.
// A master not in the list yet is added at the end, with the title and caption Lightroom wrote
// into it; the file name, lower-cased, is its id. Edit the list and run this again: without
// masters it only rewrites the two pages.
import { readFile, writeFile, readdir, stat, mkdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const GALLERY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(GALLERY, 'index.html');
const HOME = path.resolve(GALLERY, '..', 'index.html');
const LIST = path.join(GALLERY, 'photos.json');
const IMG = path.join(GALLERY, 'img');

const args = process.argv.slice(2);
const force = args.includes('--force');
const MASTERS = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(GALLERY, 'masters'));

// On the gallery page a photograph has a fixed width at each of three window sizes, as on Apple's
// product pages, so a screen at 1x, 1.5x or 2x is sent an image with exactly the pixels it shows
// and the browser never resamples it. At each size the photograph fits a box of 800 × 480 (m),
// 1200 × 720 (l) or 1600 × 960 (xl) CSS pixels, picked by the window's width and height so the
// whole frame and its caption fit on screen. The boxes stand 2 : 3 : 4, so one file serves several
// of them: m at 1.5x is l at 1x, m at 2x is xl at 1x, and l at 2x is xl at 1.5x.
// The media queries must match the CSS in photography/index.html.
const BOX = { w: 400, h: 240 };
const SIZES = [
  { key: 'xl', times: 4, media: '(min-width: 1700px) and (min-height: 1060px)' },
  { key: 'l', times: 3, media: '(min-width: 1280px) and (min-height: 800px)' },
  { key: 'm', times: 2, media: '(min-width: 880px) and (min-height: 560px)' },
];
// In smaller windows (phones, tablets upright) the photograph spans the window less 1rem on each
// side, and at most this share of its height; there the browser takes the next file up.
const FLUID_HEIGHT = 0.88;

// Widths made, as multiples of the photograph's width in the 400 × 240 box: every box at 1x, 1.5x
// and 2x, and 1.5 for the contact sheet. JPEG leaves out l at 1.5x and xl at 2x, which only
// screens recent enough for AVIF ask for. The contact sheet offers up to 4, enough for a
// panorama alone in a row, 640 px wide, on a 2x screen.
const AVIF_WIDTHS = [1.5, 2, 3, 4, 4.5, 6, 8];
const JPEG_WIDTHS = [1.5, 2, 3, 4, 6];
const SHEET_WIDTHS = [1.5, 2, 3, 4];

// Output sharpening, applied after each resize: a small radius, on edges only (m1: 0 leaves flat
// areas, and so the grain, alone). AVIF at 72 keeps film grain that 60, or effort 4, smooths away.
const SHARPEN = { sigma: 0.5, m1: 0, m2: 1 };
const AVIF = { quality: 72, effort: 3, chromaSubsampling: '4:4:4' };
const JPEG = { quality: 90, mozjpeg: true, chromaSubsampling: '4:4:4' };

const SHEET_COUNT = 6;     // the first six photographs in the list make the contact sheet
const SHEET_ROW = 4;       // a row of frames whose widths over heights add up to about this
const SHEET_MIN_ROW = 2.5; // a row that adds up to less keeps the height of one that adds up to this
const MASTER_TYPES = new Set(['.jpg', '.jpeg', '.tif', '.tiff', '.png', '.webp', '.avif']);
const FIELDS = ['id', 'title', 'alt', 'place', 'date', 'camera', 'film', 'width', 'height'];

const warn = (msg) => console.warn(`! ${msg}`);
const slug = (name) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const round = (x, places) => +x.toFixed(places);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// b: the photograph's width in the 400 × 240 box, rounded down to an even number so that every
// size, 1.5x included, is a whole number of pixels
function base(p) {
  return 2 * Math.floor(Math.min(BOX.w, BOX.h * p.width / p.height) / 2);
}
const fileName = (p, w, ext) => `${p.id}-${w}.${ext}`;
const FILE = /^(.+)-(\d+)\.(avif|jpg)$/;

async function mtime(file) {
  try { return (await stat(file)).mtimeMs; } catch { return 0; }
}

// ---- The list ----

async function readList() {
  let list;
  try { list = JSON.parse(await readFile(LIST, 'utf8')); } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new Error(`${path.relative(process.cwd(), LIST)} is not valid JSON: ${err.message}`);
  }
  if (!Array.isArray(list)) throw new Error('photos.json should be a list, [ ... ]');
  const seen = new Set();
  for (const p of list) {
    if (!p || typeof p.id !== 'string' || p.id !== slug(p.id)) {
      throw new Error(`Every photograph in photos.json needs an id of lower-case letters, digits and hyphens; found ${JSON.stringify(p && p.id)}`);
    }
    if (seen.has(p.id)) throw new Error(`photos.json lists ${p.id} twice`);
    seen.add(p.id);
  }
  return list;
}

// The fields people edit come first, then the size the script keeps up to date, then anything else
function tidy(p) {
  const out = {};
  for (const k of FIELDS) out[k] = p[k] ?? (k === 'width' || k === 'height' ? undefined : '');
  for (const [k, v] of Object.entries(p)) if (!(k in out)) out[k] = v;
  return out;
}

async function findMasters() {
  const found = new Map();
  let names;
  try { names = await readdir(MASTERS); } catch (err) {
    if (err.code === 'ENOENT') return found;
    throw err;
  }
  for (const name of names.sort()) {
    const ext = path.extname(name).toLowerCase();
    if (!MASTER_TYPES.has(ext) || name.startsWith('.')) continue;
    const id = slug(path.basename(name, path.extname(name)));
    if (!id) {
      warn(`${name}: its name has no Latin letters or digits to make an id from, so it is left out; rename it, for example to xpan-01${ext}.`);
      continue;
    }
    if (found.has(id)) throw new Error(`${path.basename(found.get(id))} and ${name} would both be ${id}; rename one`);
    found.set(id, path.join(MASTERS, name));
  }
  return found;
}

// Title, caption and place from the XMP that Lightroom writes into an export
function fromXmp(xmp) {
  const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const alt = (tag) => {
    const m = xmp.match(new RegExp(`<${tag}>\\s*<rdf:Alt>\\s*<rdf:li[^>]*>([^<]*)</rdf:li>`));
    return m ? decode(m[1]).trim() : '';
  };
  const plain = (tag) => {
    const m = xmp.match(new RegExp(`${tag}="([^"]*)"`)) || xmp.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return m ? decode(m[1]).trim() : '';
  };
  const place = [plain('Iptc4xmpCore:Location'), plain('photoshop:City'), plain('photoshop:State'), plain('photoshop:Country')]
    .filter((s, i, all) => s && all.indexOf(s) === i);
  return { title: alt('dc:title'), alt: alt('dc:description'), place: place.join(', ') };
}

async function describe(id, file) {
  const meta = await sharp(file).metadata();
  const xmp = meta.xmpAsString ? fromXmp(meta.xmpAsString) : {};
  console.log(`+ ${id}: new in the list${xmp.title ? `, "${xmp.title}"` : ''}`);
  return { id, title: xmp.title || '', alt: xmp.alt || '', place: xmp.place || '', date: '', camera: '', film: '' };
}

// ---- The files ----

function wanted(p) {
  const b = base(p);
  return [
    ...AVIF_WIDTHS.map((k) => ({ w: k * b, ext: 'avif' })),
    ...JPEG_WIDTHS.map((k) => ({ w: k * b, ext: 'jpg' })),
  ].filter((f) => f.w <= p.width);   // never enlarged
}

async function makeFiles(p, master) {
  const meta = await sharp(master).metadata();
  ({ width: p.width, height: p.height } = meta.autoOrient);
  const b = base(p);
  const short = AVIF_WIDTHS.map((k) => k * b).filter((w) => w > p.width);
  if (short.length) {
    warn(`${p.id}: the master is ${p.width} px wide, short of the ${short.join(' and ')} px some screens show it at, so they get it enlarged. Export it at least ${8 * b} px wide.`);
  }
  const masterTime = await mtime(master);
  const todo = [];
  for (const f of wanted(p)) {
    const out = path.join(IMG, fileName(p, f.w, f.ext));
    if (force || (await mtime(out)) < masterTime) todo.push({ ...f, out });
  }
  if (!todo.length) return;

  // fastShrinkOnLoad off: a JPEG master is decoded at full size rather than shrunk in the decoder
  const source = sharp(master, { fastShrinkOnLoad: false }).autoOrient();
  if (meta.hasAlpha) source.flatten({ background: '#ffffff' });
  const t0 = Date.now();
  await Promise.all(todo.map(async (f) => {
    const img = source.clone().resize({ width: f.w, kernel: 'lanczos3' }).sharpen(SHARPEN).withIccProfile('p3');
    const tmp = `${f.out}.part`;
    await (f.ext === 'avif' ? img.avif(AVIF) : img.jpeg(JPEG)).toFile(tmp);
    await rename(tmp, f.out);
  }));
  console.log(`  ${p.id}: ${todo.length} files in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

// Files on disk for one photograph, by format, smallest first
async function filesOf(p, onDisk) {
  const files = { avif: [], jpg: [] };
  for (const f of wanted(p)) {
    const name = fileName(p, f.w, f.ext);
    if (onDisk.has(name)) files[f.ext].push({ w: f.w, name });
  }
  for (const list of Object.values(files)) list.sort((x, y) => x.w - y.w);
  return files;
}

// The average colour of the smallest file, shown in the frame until the photograph arrives
async function placeholder(files) {
  const small = files.jpg[0] || files.avif[0];
  const { channels } = await sharp(path.join(IMG, small.name)).stats();
  return `color(display-p3 ${channels.slice(0, 3).map((c) => round(c.mean / 255, 3)).join(' ')})`;
}

// ---- The pages ----

const srcset = (list, dir) => list.map((f) => `${dir}${f.name} ${f.w}w`).join(', ');
const details = (p) => [p.place, p.date, p.camera, p.film].filter(Boolean).join(' · ');
const altOf = (p) => p.alt || p.title || '';

function figure(p, files, first) {
  const b = base(p), a = p.width / p.height;
  const style = `--a:${round(a, 4)};--m:${2 * b}px;--l:${3 * b}px;--xl:${4 * b}px;--c:${p.color}`;
  const sizes = SIZES.map((s) => `${s.media} ${s.times * b}px`)
    .concat(`min(100vw - 2rem, ${round(FLUID_HEIGHT * 100 * a, 2)}vh)`).join(', ');
  const fallback = files.jpg.find((f) => f.w >= 3 * b) || files.jpg[files.jpg.length - 1];
  const load = first ? ' fetchpriority="high"' : ' loading="lazy"';
  const caption = p.title || details(p)
    ? `\n    <figcaption>${p.title ? `<span class="photo-title">${esc(p.title)}</span>` : ''}${details(p) ? `<span class="photo-meta">${esc(details(p))}</span>` : ''}</figcaption>`
    : '';
  return `
  <figure class="photo" id="${p.id}" style="${style}">
    <picture>
      <source type="image/avif" srcset="${srcset(files.avif, 'img/')}" sizes="${sizes}">
      <img src="img/${fallback.name}" srcset="${srcset(files.jpg, 'img/')}" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(altOf(p))}"${load} decoding="async">
    </picture>${caption}
  </figure>`;
}

// Splits the contact sheet into rows whose frames' widths over heights add up close to SHEET_ROW
function sheetRows(photos) {
  let best = null;
  for (let cuts = 0; cuts < 1 << (photos.length - 1); cuts++) {
    const rows = [[photos[0]]];
    for (let i = 1; i < photos.length; i++) {
      if (cuts & (1 << (i - 1))) rows.push([]);
      rows[rows.length - 1].push(photos[i]);
    }
    const cost = rows.reduce((s, r) => s + (r.reduce((t, p) => t + p.width / p.height, 0) - SHEET_ROW) ** 2, 0);
    if (!best || cost < best.cost) best = { rows, cost };
  }
  return best.rows;
}

function sheet(photos, filesById, total) {
  if (!photos.length) return '\n        ';
  const rows = sheetRows(photos).map((row) => {
    const sum = row.reduce((t, p) => t + p.width / p.height, 0), s = Math.max(sum, SHEET_MIN_ROW);
    const frames = row.map((p) => {
      const files = filesById.get(p.id), b = base(p), a = p.width / p.height, share = a / s;
      const pick = (list) => { const l = list.filter((f) => SHEET_WIDTHS.some((k) => k * b === f.w)); return l.length ? l : list.slice(0, 1); };
      const avif = pick(files.avif), jpg = pick(files.jpg);
      // the homepage's content column is 40rem wide at most, and the window less 1rem a side on phones
      const sizes = `(min-width: 46rem) ${Math.round(640 * share)}px, calc(${round(100 * share, 2)}vw - ${round(2 * share, 3)}rem)`;
      return `
            <a href="photography/#${p.id}" style="--a:${round(a, 4)};--c:${p.color}"><picture><source type="image/avif" srcset="${srcset(avif, 'photography/img/')}" sizes="${sizes}"><img src="photography/img/${jpg[0].name}" srcset="${srcset(jpg, 'photography/img/')}" sizes="${sizes}" width="${p.width}" height="${p.height}" alt="${esc(altOf(p))}" loading="lazy" decoding="async"></picture></a>`;
    }).join('');
    return `
          <div class="sheet-row" style="--n:${row.length};--s:${round(s, 4)}">${frames}
          </div>`;
  }).join('');
  const more = total === 1 ? 'See it full size' : `All ${total} photographs, full size`;
  return `
        <div class="sheet">${rows}
        </div>
        <p class="sheet-more"><a href="photography/">${more}</a></p>
        `;
}

// Link previews show the first photograph; before there is one, the homepage's picture
function ogImage(p, file, size) {
  if (!p) {
    return `
<meta property="og:image" content="https://wentaoz.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Wentao Zhang, above the colors a TiO2 film takes on a silicon wafer from 0 to 300 nm.">
`;
  }
  return `
<meta property="og:image" content="https://wentaoz.com/photography/img/${file.name}">
<meta property="og:image:width" content="${size.width}">
<meta property="og:image:height" content="${size.height}">
${altOf(p) ? `<meta property="og:image:alt" content="${esc(altOf(p))}">\n` : ''}`;
}

function between(html, name, content, file) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`${path.relative(process.cwd(), file)} has no <!-- ${name}:start --> … <!-- ${name}:end --> markers`);
  return html.replace(re, (_, start, end) => start + content + end);
}

// ---- Run ----

const photos = await readList();
const masters = await findMasters();
console.log(masters.size ? `Masters: ${masters.size} in ${MASTERS}` : `No masters in ${MASTERS}; rewriting the pages from photos.json`);
for (const [id, file] of masters) {
  if (photos.some((p) => p.id === id)) continue;
  try { photos.push(await describe(id, file)); } catch (err) {
    warn(`${path.basename(file)}: could not be read, so it is left out: ${err.message}`);
    masters.delete(id);
  }
}

await mkdir(IMG, { recursive: true });
for (const n of await readdir(IMG)) if (n.endsWith('.part')) await unlink(path.join(IMG, n));   // left by a run that was stopped
for (const p of photos) {
  const master = masters.get(p.id);
  if (!master) continue;
  try { await makeFiles(p, master); } catch (err) {
    warn(`${p.id}: making its files from ${path.basename(master)} failed: ${err.message}`);
  }
}

// Every photograph needs its size, from its master now or from an earlier run
const onDisk = new Set((await readdir(IMG)).filter((n) => FILE.test(n)));
const shown = [], filesById = new Map(), keep = new Set();
for (const p of photos) {
  if (!(p.width > 0 && p.height > 0)) {
    warn(`${p.id}: no master and no size in photos.json, so it is left out. Put its master in ${path.relative(process.cwd(), MASTERS)} and run this again.`);
    continue;
  }
  const files = await filesOf(p, onDisk);
  const missing = wanted(p).length - files.avif.length - files.jpg.length;
  if (missing) {
    // made with other sizes, or never made: keep what there is until its master comes back
    for (const n of onDisk) if (n.match(FILE)[1] === p.id) keep.add(n);
    warn(`${p.id}: ${missing} of its files are missing; run this again with its master.`);
  }
  if (!files.jpg.length || !files.avif.length) {
    warn(`${p.id}: it has no ${files.jpg.length ? 'AVIF' : 'JPEG'} files yet, so it is left out.`);
    continue;
  }
  for (const list of Object.values(files)) for (const f of list) keep.add(f.name);
  p.color = await placeholder(files);
  filesById.set(p.id, files);
  shown.push(p);
}

for (const n of onDisk) {
  if (!keep.has(n)) {
    await unlink(path.join(IMG, n));
    console.log(`- ${n}: no longer used, removed`);
  }
}

let page = await readFile(PAGE, 'utf8');
page = between(page, 'photos', shown.length
  ? shown.map((p, i) => figure(p, filesById.get(p.id), i === 0)).join('') + '\n  '
  : '\n  <p class="empty">The first photographs are on their way.</p>\n  ', PAGE);
let og = null, ogSize = null;
if (shown.length) {
  const files = filesById.get(shown[0].id), b = base(shown[0]);
  og = files.jpg.find((f) => f.w >= 3 * b) || files.jpg[files.jpg.length - 1];
  ogSize = await sharp(path.join(IMG, og.name)).metadata();
}
page = between(page, 'og-image', ogImage(shown[0], og, ogSize), PAGE);
await writeFile(PAGE, page);

let home = await readFile(HOME, 'utf8');
home = between(home, 'photos', sheet(shown.slice(0, SHEET_COUNT), filesById, shown.length), HOME);
await writeFile(HOME, home);

await writeFile(LIST, JSON.stringify(photos.map(({ color, ...p }) => tidy(p)), null, 2) + '\n');

let bytes = 0;
for (const n of keep) bytes += (await stat(path.join(IMG, n))).size;
console.log(`${shown.length} photograph${shown.length === 1 ? '' : 's'} on the pages, ${keep.size} files, ${(bytes / 1e6).toFixed(1)} MB in photography/img`);
const untitled = shown.filter((p) => !p.alt);
if (untitled.length) {
  warn(`No alt text (a description for people who can't see the photograph) for ${untitled.map((p) => p.id).join(', ')}; add "alt" in photos.json${untitled.some((p) => p.title) ? ' (the title stands in for now)' : ''}.`);
}
