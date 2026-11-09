#!/usr/bin/env python3
"""Lays Vinous's maps of Napa Valley's vineyards on the map of 风土 Terroir (terroir/index.html), as
map tiles in terroir/map/vinous/.

The maps are The Vineyards of Napa Valley, by Antonio Galloni with Alessandro Masnaghetti,
© 2016–2023 Vinous Media LLC, used with Vinous's written permission, for personal study and exchange
only; no commercial use of any kind (map/vinous/NOTICE.md). Their SVG files are not in this
repository: VINOUS_DIR names the folder that holds them.

  VINOUS_DIR=~/Downloads/Napa_Valley_Maps .venv/bin/python build-vinous.py

It needs numpy, scipy, scikit-image and Pillow with WebP (.venv/bin/pip install numpy scipy
scikit-image pillow), Node with Playwright's Chromium to draw the SVGs (render-svg.cjs), and the
UC Davis AVA boundaries in .cache/ava/, which build-appellations.mjs downloads. About ten minutes.

Where each map lies is in vinous-georef.json (georef-vinous.py found it): a similarity, scale,
rotation and shift, from the map's SVG units to the California view's. Then:

  1. each SVG is drawn by Chromium at 1 pixel a point, for what it draws where, and at HI, for the
     tiles; the drawings are kept in .cache/vinous/;
  2. what each map draws, its region, is what is not white on its sheet once the frame is taken off,
     the largest shape left (titles, insets, legends and logos stand apart from it);
  3. where maps overlap, a map shows over its own AVA first (the UC Davis boundary), Pritchard Hill
     over all of its own, and elsewhere the map whose AVA is nearest; so the maps meet along their
     AVAs' boundaries. Each map's edge comes from its own drawing, white there being paper;
  4. Vinous puts some names in the margin, in boxes with a line to their vineyard: those, with their
     lines, are kept over what lies beyond the map, and a name box a seam would cut goes wholly to
     the map that holds its middle;
  5. tiles: Web Mercator, ZMIN to ZMAX, 256 pixels; each pixel of the deepest zoom the mean of SS x SS
     samples, each zoom above made from the one below; WebP with alpha. index.json lists them, with
     the outline of what they cover, in view units, for the page.
"""
import argparse, json, math, os, re, subprocess, sys, time
import multiprocessing as mp
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache', 'vinous')
OUT = os.path.join(ROOT, 'map', 'vinous')
GEOREF = os.path.join(HERE, 'vinous-georef.json')
AVAS = os.path.join(HERE, '.cache', 'ava', 'avas.geojson')
RENDER = os.path.join(HERE, 'render-svg.cjs')

HI = 4            # pixels a point for the drawing the tiles are cut from: about 1 to 1.7 m a pixel
ZMIN, ZMAX = 10, 16
SS = 2            # samples a pixel, each way, at ZMAX
BAND = 3          # pixels (at 1 a point) each side of a region's edge where the drawing's own edge is found
QUALITY = 82
WORLD = 256 * 2 ** ZMAX   # pixels round the world at ZMAX

G = json.load(open(GEOREF, encoding='utf-8'))
P = G['proj']
R = math.pi / 180
L0, S0, C0 = P['center'][0] * R, math.sin(P['center'][1] * R), math.cos(P['center'][1] * R)
SC, T0, T1 = P['scale'], P['translate'][0], P['translate'][1]
UPM = SC / 6371000   # view units a metre, near the centre (and within 0.3% across Napa)


def project(lon, lat):   # degrees to view units, as index.html's projectFor
    dl, sp, cp = np.asarray(lon) * R - L0, np.sin(np.asarray(lat) * R), np.cos(np.asarray(lat) * R)
    cd = np.cos(dl)
    k = np.sqrt(2 / (1 + S0 * sp + C0 * cp * cd))
    return T0 + SC * k * cp * np.sin(dl), T1 - SC * k * (C0 * sp - S0 * cp * cd)


def unproject(X, Y):   # and back (Snyder 1987, 24-16 to 24-18), as unprojectFor
    x, y = (np.asarray(X) - T0) / SC, (T1 - np.asarray(Y)) / SC
    rho = np.maximum(np.hypot(x, y), 1e-12)
    c = 2 * np.arcsin(np.minimum(1, rho / 2))
    sc, cc = np.sin(c), np.cos(c)
    return (L0 + np.arctan2(x * sc, rho * C0 * cc - y * S0 * sc)) / R, np.arcsin(cc * S0 + y * sc * C0 / rho) / R


def merc(lon, lat, world=WORLD):   # degrees to Web Mercator pixels
    lat = np.clip(np.asarray(lat) * R, -1.4844, 1.4844)
    return (np.asarray(lon) + 180) / 360 * world, (1 - np.log(np.tan(lat) + 1 / np.cos(lat)) / math.pi) / 2 * world


def unmerc(x, y, world=WORLD):
    return np.asarray(x) / world * 360 - 180, np.degrees(np.arctan(np.sinh(math.pi * (1 - 2 * np.asarray(y) / world))))


# ---------- the SVGs: drawn, and their name boxes ----------

FALLBACK = [   # fonts for an SVG's live text, after its own, which may not be installed
    ('myriad', "Carlito, 'Liberation Sans', sans-serif"),   # Carlito is humanist, like Myriad, and a little narrower
    ('century gothic', "'TeX Gyre Adventor', 'URW Gothic', 'Liberation Sans', sans-serif"),
    ('palatino', "'TeX Gyre Pagella', 'URW Palladio L', 'Liberation Serif', serif"),
    ('arial', "'Liberation Sans', sans-serif"),
    ('', 'sans-serif'),
]


def text_ready(src):
    """An SVG with live text (Coombsville's), made to draw well without its fonts: each font-family
    given fallbacks, and the pieces Illustrator places one by one along a line, for its kerning in
    the original font, let run on, so a substitute font leaves no gaps or overlaps within a word."""
    def fam(m):
        f = m.group(2).strip().rstrip(';')
        return m.group(1) + f + ', ' + next(fb for key, fb in FALLBACK if key in f.lower())
    src = re.sub(r'(font-family:\s*)([^;}"]+)', fam, src)
    def line(m):
        last = [None]
        def piece(t):
            tag = t.group(0)
            y = re.search(r'\sy="([^"]*)"', tag)
            y = y.group(1) if y else None
            if last[0] is not None and y == last[0]: tag = re.sub(r'\s[xy]="[^"]*"', '', tag)
            last[0] = y if y is not None else last[0]
            return tag
        return re.sub(r'<tspan\b[^>]*>', piece, m.group(0))
    return re.sub(r'<text\b.*?</text>', line, src, flags=re.S)


def drawing(sheet, scale):
    """The SVG drawn at `scale` pixels a unit, as an RGB array, from the cache when it is newer."""
    base = os.path.join(CACHE, f'{sheet["id"]}@{scale}')
    svg = os.path.join(VINOUS_DIR, sheet['file'])
    if not (os.path.exists(base + '.json') and os.path.getmtime(base + '.json') >= os.path.getmtime(svg)):
        print(f'  drawing {sheet["file"]} at {scale} a point', flush=True)
        src = open(svg, encoding='utf-8').read()
        if '<text' in src:   # drawn from a copy beside the drawings
            svg = os.path.join(CACHE, sheet['id'] + '.svg')
            open(svg, 'w', encoding='utf-8').write(text_ready(src))
        subprocess.run(['node', RENDER, svg, base, str(scale), '2048'], check=True)
    n = json.load(open(base + '.json'))['strips']
    return np.ascontiguousarray(np.concatenate([np.asarray(Image.open(f'{base}.{i}.png').convert('RGB')) for i in range(n)]))


def _matrix(t):
    M = np.eye(3)
    for kind, args in re.findall(r'(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)', t or ''):
        a = [float(x) for x in re.split(r'[\s,]+', args.strip()) if x]
        if kind == 'matrix': m = np.array([[a[0], a[2], a[4]], [a[1], a[3], a[5]], [0, 0, 1]])
        elif kind == 'translate': m = np.array([[1, 0, a[0]], [0, 1, a[1] if len(a) > 1 else 0], [0, 0, 1]])
        elif kind == 'scale': m = np.diag([a[0], a[1] if len(a) > 1 else a[0], 1])
        elif kind == 'rotate':
            c, s = math.cos(math.radians(a[0])), math.sin(math.radians(a[0]))
            m = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
            if len(a) == 3: m = np.array([[1, 0, a[1]], [0, 1, a[2]], [0, 0, 1]]) @ m @ np.array([[1, 0, -a[1]], [0, 1, -a[2]], [0, 0, 1]])
        else:
            k = math.tan(math.radians(a[0]))
            m = np.array([[1, k, 0], [0, 1, 0], [0, 0, 1]]) if kind == 'skewX' else np.array([[1, 0, 0], [k, 1, 0], [0, 0, 1]])
        M = M @ m
    return M


def name_boxes(path):
    """Vinous's name boxes: unfilled rects stroked in its label blue, outside <defs> and the like,
    every transform on the way applied; each as its 4 corners in SVG units, 0.75 units larger all
    round for the stroke."""
    src = open(path, encoding='utf-8').read()
    rules = {}
    for block in re.findall(r'<style[^>]*>(.*?)</style>', src, re.S):
        for sel, body in re.findall(r'([^{}]+)\{([^}]*)\}', block):
            for c in [s.strip().lstrip('.') for s in sel.split(',')]:
                rules[c] = rules.get(c, '') + ';' + body
    def props(el):
        p = {}
        for c in (el.get('class') or '').split():
            p.update({k: v.strip() for k, v in re.findall(r'([a-z-]+)\s*:\s*([^;]+)', rules.get(c, ''))})
        p.update({k: v.strip() for k, v in re.findall(r'([a-z-]+)\s*:\s*([^;]+)', el.get('style') or '')})
        p.update({k: el.get(k) for k in ('fill', 'stroke') if el.get(k)})
        return p
    def blue(h):
        if not re.fullmatch(r'#[0-9a-fA-F]{6}', h or ''): return False
        r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
        return r < 64 and 80 <= g <= 128 and b >= 160
    out = []
    def walk(el, M):
        tag = el.tag.rsplit('}', 1)[-1]
        if tag in ('defs', 'clipPath', 'mask', 'pattern', 'symbol', 'marker'): return
        M = M @ _matrix(el.get('transform'))
        if tag == 'rect':
            p = props(el)
            if p.get('fill') == 'none' and blue(p.get('stroke')):
                x, y, w, h = (float(el.get(k, 0)) for k in ('x', 'y', 'width', 'height'))
                if 3 < w < 300 and 3 < h < 60:
                    e = 0.75
                    out.append((np.array([[x - e, y - e, 1], [x + w + e, y - e, 1], [x + w + e, y + h + e, 1], [x - e, y + h + e, 1]]) @ M.T)[:, :2])
        for ch in el: walk(ch, M)
    walk(ET.fromstring(src), np.eye(3))
    return out


# ---------- what a map draws ----------

def thin_runs(hi, longest=4):   # runs of at most `longest` True, widened by 2: the lines of a frame
    out = np.zeros_like(hi)
    i = 0
    while i < len(hi):
        if not hi[i]: i += 1; continue
        j = i
        while j < len(hi) and hi[j]: j += 1
        if j - i <= longest: out[max(0, i - 2):j + 2] = True
        i = j
    return out


def region_mask(rgb):
    ink = rgb.min(axis=2) < 238
    m = 25   # the sheet's edge, and any thin line straight across it: the frame
    ink[:m, :] = ink[-m:, :] = False; ink[:, :m] = ink[:, -m:] = False
    ink[thin_runs(ink.mean(axis=1) > 0.85), :] = False
    ink[:, thin_runs(ink.mean(axis=0) > 0.85)] = False
    ink = ndimage.binary_closing(ink, iterations=3)
    ink = ndimage.binary_fill_holes(ink)
    ink = ndimage.binary_opening(ink, iterations=6)
    lab, n = ndimage.label(ink)
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def paper_mask(rgb, cand):
    """The sheet's paper where it reaches in among a map's edge, as between the names Vinous sets in
    its margin: white joined to the white beyond the map, across the thin grey lines that lead to the
    names but not along white roads (too narrow) or through coloured hatching."""
    mn, mx = rgb.min(axis=2), rgb.max(axis=2)
    white = mn >= 246
    grey = (mx.astype(np.int16) - mn < 40) & ~white
    thin = grey & ~ndimage.binary_opening(grey, iterations=1)
    w = ndimage.binary_opening(white | thin, iterations=2)
    lab, n = ndimage.label(w)
    ids = np.unique(lab[w & ~cand])
    return np.isin(lab, ids[ids > 0])


def poly_mask(shape, polys, scale=1.0, grow=0):
    img = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(img)
    for Q in polys: d.polygon([(float(x) * scale, float(y) * scale) for x, y in Q], fill=1)
    m = np.asarray(img) > 0
    return ndimage.binary_dilation(m, iterations=grow) if grow else m


class Sheet:
    def __init__(self, cfg, rank):
        self.cfg, self.id, self.rank, self.ava = cfg, cfg['id'], rank, cfg['ava']
        s, th = cfg['scale'], cfg['rotation']
        self.a, self.b, self.tx, self.ty = s * math.cos(th), s * math.sin(th), cfg['tx'], cfg['ty']

    def to_view(self, u, v):
        return self.a * u - self.b * v + self.tx, self.b * u + self.a * v + self.ty

    def to_svg(self, X, Y):
        X, Y, d = X - self.tx, Y - self.ty, self.a * self.a + self.b * self.b
        return (self.a * X + self.b * Y) / d, (-self.b * X + self.a * Y) / d

    def to_merc(self, Q):   # corners in SVG units to pixels at ZMAX
        X, Y = self.to_view(Q[:, 0], Q[:, 1])
        return np.column_stack(merc(*unproject(X, Y)))


def nearest(mask, u, v):   # a 1-a-point mask at SVG units u, v; False off the sheet
    h, w = mask.shape
    j, i = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
    ok = (i >= 0) & (j >= 0) & (i < h) & (j < w)
    out = np.zeros(u.shape, bool)
    out[ok] = mask[i[ok], j[ok]]
    return out


def bilinear(img, fy, fx):   # img (H, W, 3) uint8 at pixel centres fy, fx -> float 0..1; white off it
    H, W = img.shape[:2]
    x0, y0 = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
    wx, wy = (fx - x0).astype(np.float32)[..., None], (fy - y0).astype(np.float32)[..., None]
    def at(yy, xx):
        ok = (yy >= 0) & (xx >= 0) & (yy < H) & (xx < W)
        v = np.full(yy.shape + (3,), 255, np.uint8)
        v[ok] = img[yy[ok], xx[ok]]
        return v.astype(np.float32)
    top = at(y0, x0) * (1 - wx) + at(y0, x0 + 1) * wx
    bot = at(y0 + 1, x0) * (1 - wx) + at(y0 + 1, x0 + 1) * wx
    return (top * (1 - wy) + bot * wy) / 255


def ink_alpha(rgb):   # paper white is clear, anything from a pale tint on is solid
    return np.clip((0.985 - rgb.min(axis=-1)) / 0.06, 0, 1)


# ---------- the build ----------

def prepare():
    global SHEETS, GRID, AVA_RINGS
    avas = {f['properties']['name']: f['geometry'] for f in json.load(open(AVAS))['features'] if not f['properties'].get('valid_end')}
    SHEETS = [Sheet(c, i) for i, c in enumerate(G['maps'])]
    for sh in SHEETS:
        print(f'{sh.id}:', flush=True)
        lo = drawing(sh.cfg, 1)
        sh.hi = drawing(sh.cfg, HI)
        sh.region = region = region_mask(lo)
        sh.cand = ndimage.binary_dilation(region, iterations=BAND)   # where it may show
        sh.solid = ndimage.binary_erosion(region, iterations=BAND)   # where it shows whole, white and all,
        sh.paper = paper_mask(lo, sh.cand)                           # but for paper reaching in from the margin
        sh.boxes = name_boxes(os.path.join(VINOUS_DIR, sh.cfg['file']))
        sh.lo_ink = lo.min(axis=2) < 225
        ys, xs = np.nonzero(sh.cand[::2, ::2])
        X, Y = sh.to_view(xs * 2.0, ys * 2.0)
        sh.view_box = (X.min(), Y.min(), X.max(), Y.max())
        print(f'  {region.mean() * 100:.1f}% of the sheet drawn, {len(sh.boxes)} name boxes', flush=True)
    # a raster of the view at 10 m, for each AVA's extent and the distance to it
    res = 10 * UPM
    x0 = min(s.view_box[0] for s in SHEETS) - 0.3; y0 = min(s.view_box[1] for s in SHEETS) - 0.3
    x1 = max(s.view_box[2] for s in SHEETS) + 0.3; y1 = max(s.view_box[3] for s in SHEETS) + 0.3
    W, H = int((x1 - x0) / res) + 1, int((y1 - y0) / res) + 1
    GRID = {'x0': x0, 'y0': y0, 'res': res, 'W': W, 'H': H, 'in': {}, 'dist': {}}
    AVA_RINGS = {}
    for sh in SHEETS:
        if not sh.ava: continue
        geom = avas[sh.ava]
        polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
        img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
        rings = []
        for poly in polys:
            for k, ring in enumerate(poly):
                ring = np.array(ring)[:, :2]
                X, Y = project(ring[:, 0], ring[:, 1])
                d.polygon(list(zip((X - x0) / res, (Y - y0) / res)), fill=0 if k else 1)
                mx, my = merc(ring[:, 0], ring[:, 1])
                rings.append((k > 0, np.column_stack([mx, my])))
        inside = np.asarray(img) > 0
        GRID['in'][sh.id] = inside
        GRID['dist'][sh.id] = ndimage.distance_transform_edt(~inside).astype(np.float32) * 10   # metres
        AVA_RINGS[sh.id] = rings


def grid_at(name, X, Y, what):
    g = GRID
    fx, fy = (X - g['x0']) / g['res'] - 0.5, (Y - g['y0']) / g['res'] - 0.5
    if what == 'in':
        i, j = np.clip(np.round(fy).astype(int), 0, g['H'] - 1), np.clip(np.round(fx).astype(int), 0, g['W'] - 1)
        return g['in'][name][i, j]
    return ndimage.map_coordinates(g['dist'][name], [np.atleast_1d(fy), np.atleast_1d(fx)], order=1, mode='nearest').reshape(np.shape(X))


def key_of(sh, X, Y, inside):
    """Lower wins: a map over its own AVA first (by its order in the list), then Pritchard Hill's
    over all of its own, then the map whose AVA is nearest (2 + km from it)."""
    if not sh.ava: return np.ones(np.shape(X))
    k = 2 + grid_at(sh.id, X, Y, 'dist') / 1000
    return np.where(inside, sh.rank * 1e-3, k)


def owner_at(X, Y):   # the map that shows at a point of the view, and its key; (None, inf) for none
    best, bk = None, math.inf
    for sh in SHEETS:
        u, v = sh.to_svg(np.array([X]), np.array([Y]))
        if not nearest(sh.cand, u, v)[0]: continue
        k = float(key_of(sh, np.array([X]), np.array([Y]), grid_at(sh.id, np.array([X]), np.array([Y]), 'in') if sh.ava else None)[0])
        if k < bk: best, bk = sh, k
    return best, bk


def place_names():
    """Each name box: kept whole by its map, cut from it, or, in the margin, kept with its line."""
    stats = {}
    for sh in SHEETS:
        region = sh.region
        sh.over, sh.cut, sh.dropped, margin = [], [], [], []
        st = {'whole': 0, 'cut': 0, 'margin kept': 0, 'margin dropped': 0}
        for Q in sh.boxes:
            cu, cv = Q[:, 0].mean(), Q[:, 1].mean()
            X, Y = sh.to_view(cu, cv)
            who, k = owner_at(X, Y)
            if nearest(region, np.array([cu]), np.array([cv]))[0]:
                if who is sh: sh.over.append(Q); st['whole'] += 1
                else: sh.cut.append(Q); st['cut'] += 1
            elif who is None or k >= 1 or MARGIN_OVER_AVAS:
                # beyond its map, over open ground or another map's ground beyond any AVA of it
                margin.append(Q); sh.over.append(Q); st['margin kept'] += 1
            else: sh.dropped.append(Q); st['margin dropped'] += 1
        # the margin's names with their lines: what is drawn outside the map that touches a kept box
        outside = sh.lo_ink & ~sh.cand
        lab, n = ndimage.label(ndimage.binary_dilation(outside, iterations=1) & ~sh.cand, structure=np.ones((3, 3)))
        keep = np.zeros(n + 1, bool)
        if margin:
            hit = poly_mask(sh.cand.shape, margin, grow=2)
            keep[np.unique(lab[hit])] = True
        keep[0] = False
        objs = ndimage.find_objects(lab)
        for i, sl in enumerate(objs, 1):   # nothing as large as a legend or an inset
            if keep[i] and (sl[0].stop - sl[0].start > 400 or sl[1].stop - sl[1].start > 400): keep[i] = False
        sh.lines = ndimage.binary_dilation(keep[lab], iterations=1)
        sh.over_m = [sh.to_merc(Q) for Q in sh.over]
        sh.cut_m = [sh.to_merc(Q) for Q in sh.cut]
        stats[sh.id] = st
        print(f'  {sh.id:16} ' + ', '.join(f'{k} {v}' for k, v in st.items()), flush=True)
        ys, xs = np.nonzero(sh.lines[::2, ::2])
        if len(xs):
            X, Y = sh.to_view(xs * 2.0, ys * 2.0)
            b = sh.view_box
            sh.view_box = (min(b[0], X.min()), min(b[1], Y.min()), max(b[2], X.max()), max(b[3], Y.max()))
    # where two maps' kept boxes overlap, at a seam, the map that shows between them keeps its box
    kept = [(sh, i, sh.to_merc(Q)) for sh in SHEETS for i, Q in enumerate(sh.over)]
    lose = set()
    for a in range(len(kept)):
        sa, ia, A = kept[a]
        for b in range(a + 1, len(kept)):
            sb, ib, B = kept[b]
            if sa is sb or A[:, 0].max() < B[:, 0].min() or B[:, 0].max() < A[:, 0].min() or A[:, 1].max() < B[:, 1].min() or B[:, 1].max() < A[:, 1].min(): continue
            mx, my = (A.mean(axis=0) + B.mean(axis=0)) / 2
            who, _ = owner_at(*project(*unmerc(mx, my)))
            loser = (sb, ib) if who is sa else (sa, ia)
            lose.add((loser[0].id, loser[1]))
    for sh in SHEETS:
        gone = [Q for i, Q in enumerate(sh.over) if (sh.id, i) in lose]
        sh.over = [Q for i, Q in enumerate(sh.over) if (sh.id, i) not in lose]
        sh.cut += gone
        sh.over_m = [sh.to_merc(Q) for Q in sh.over]
        sh.cut_m = [sh.to_merc(Q) for Q in sh.cut]
        if gone: print(f'  {sh.id:16} {len(gone)} boxes give way to another map\'s', flush=True)
    return stats


def tiles_wanted():
    want = set()
    for sh in SHEETS:
        ys, xs = np.nonzero((sh.cand | sh.lines)[::2, ::2])
        X, Y = sh.to_view(xs * 2.0 + 1, ys * 2.0 + 1)
        mx, my = merc(*unproject(X, Y))
        want |= set(zip((mx // 256).astype(int).tolist(), (my // 256).astype(int).tolist()))
        sh.merc_box = (mx.min() - 64, my.min() - 64, mx.max() + 64, my.max() + 64)
    return sorted(want)


def raster(polys, ox, oy, n):   # polygons in pixels at ZMAX onto a tile's sample grid
    img = Image.new('L', (n, n), 0); d = ImageDraw.Draw(img)
    hit = False
    for Q in polys:
        q = (Q - (ox, oy)) * SS
        if q[:, 0].max() < 0 or q[:, 1].max() < 0 or q[:, 0].min() > n or q[:, 1].min() > n: continue
        d.polygon([(float(x), float(y)) for x, y in q], fill=1); hit = True
    return (np.asarray(img) > 0) if hit else None


def ava_raster(sh, ox, oy, n):
    img = Image.new('L', (n, n), 0); d = ImageDraw.Draw(img)
    for hole, ring in AVA_RINGS[sh.id]:
        q = (ring - (ox, oy)) * SS
        if q[:, 0].max() < 0 or q[:, 1].max() < 0 or q[:, 0].min() > n or q[:, 1].min() > n: continue
        d.polygon([(float(x), float(y)) for x, y in q], fill=0 if hole else 1)
    return np.asarray(img) > 0


def make_tile(t):
    tx, ty = t
    n, ox, oy = 256 * SS, tx * 256, ty * 256
    g = (np.arange(n) + 0.5) / SS
    lon, lat = unmerc(ox + g, oy + g)
    LON, LAT = np.meshgrid(lon, lat)
    X, Y = project(LON, LAT)
    layers, overs = [], []
    for sh in SHEETS:
        b = sh.merc_box
        if b[2] < ox or b[3] < oy or b[0] > ox + 256 or b[1] > oy + 256: continue
        u, v = sh.to_svg(X, Y)
        cand, lines = nearest(sh.cand, u, v), nearest(sh.lines, u, v)
        boxes = raster(sh.over_m, ox, oy, n)
        if not cand.any() and not lines.any() and boxes is None: continue
        rgb = bilinear(sh.hi, v * HI - 0.5, u * HI - 0.5)
        ink = ink_alpha(rgb)
        if cand.any():
            a = np.where(nearest(sh.solid, u, v) & ~nearest(sh.paper, u, v), 1.0, ink) * cand
            cut = raster(sh.cut_m, ox, oy, n)
            if cut is not None: a[cut] = 0
            inside = ava_raster(sh, ox, oy, n) if sh.ava else None
            k = np.where(cand, key_of(sh, X, Y, inside), np.inf)
            layers.append((k, a.astype(np.float32), rgb))
        ao = np.where(lines, ink, 0.0)
        if boxes is not None: ao = np.maximum(ao, boxes)
        if ao.any(): overs.append((sh.rank, ao.astype(np.float32), rgb))
    if not layers and not overs: return t, None
    out = np.zeros((n, n, 3), np.float32); clear = np.ones((n, n), np.float32)
    if layers:   # front to back by key, each showing through what is clear above it
        K = np.stack([l[0] for l in layers])
        order = np.argsort(K, axis=0, kind='stable')
        for r in range(len(layers)):
            idx = order[r]
            for i, (k, a, rgb) in enumerate(layers):
                sel = idx == i
                if not sel.any(): continue
                w = np.where(sel & np.isfinite(k), clear * a, 0)
                out += w[..., None] * rgb
                clear -= w
    alpha = 1 - clear
    for rank, ao, rgb in sorted(overs, key=lambda o: -o[0]):   # the first map's names last, on top
        out = ao[..., None] * rgb + (1 - ao)[..., None] * out
        alpha = ao + (1 - ao) * alpha
    # SS x SS samples to a pixel, colour weighted by alpha
    out = out.reshape(256, SS, 256, SS, 3).mean(axis=(1, 3))
    alpha = alpha.reshape(256, SS, 256, SS).mean(axis=(1, 3))
    if alpha.max() < 1 / 255: return t, None
    rgb = np.where(alpha[..., None] > 0, out / np.maximum(alpha, 1e-6)[..., None], 0)
    return t, np.dstack([np.clip(rgb * 255 + 0.5, 0, 255), np.clip(alpha * 255 + 0.5, 0, 255)]).astype(np.uint8)


def halve(kids):   # four 256 tiles (or None) -> the one above them
    big = np.zeros((512, 512, 4), np.float32)
    for (i, j), k in kids.items():
        if k is not None: big[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = k
    a = big[..., 3:] / 255
    pre = big[..., :3] * a
    pre = pre.reshape(256, 2, 256, 2, 3).mean(axis=(1, 3)); a = a.reshape(256, 2, 256, 2, 1).mean(axis=(1, 3))
    if a.max() < 1 / 255: return None
    rgb = np.where(a > 0, pre / np.maximum(a, 1e-6), 0)
    return np.dstack([np.clip(rgb + 0.5, 0, 255), np.clip(a[..., 0] * 255 + 0.5, 0, 255)]).astype(np.uint8)


def outline(levels):
    """What the tiles cover, as an SVG path in view units: from ZMAX - 2, smoothed a little."""
    from skimage import measure
    z = ZMAX - 2
    T = levels[z]
    xs = [t[0] for t in T]; ys = [t[1] for t in T]
    x0, y0 = min(xs), min(ys)
    W, H = (max(xs) - x0 + 1) * 256, (max(ys) - y0 + 1) * 256
    a = np.zeros((H + 2, W + 2), np.float32)
    for (x, y), img in T.items(): a[1 + (y - y0) * 256:1 + (y - y0 + 1) * 256, 1 + (x - x0) * 256:1 + (x - x0 + 1) * 256] = img[..., 3] / 255
    m = ndimage.binary_opening(ndimage.binary_closing(a > 0.5, iterations=2), iterations=1)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, 1 + np.nonzero(sizes > 40)[0])      # no specks
    holes = ndimage.binary_fill_holes(m) & ~m
    lab, n = ndimage.label(holes)
    sizes = ndimage.sum(holes, lab, range(1, n + 1))
    m |= np.isin(lab, 1 + np.nonzero(sizes <= 40)[0])    # nor pinholes
    world = 256 * 2 ** z
    d = []
    for c in measure.find_contours(m.astype(np.float32), 0.5):
        c = measure.approximate_polygon(c, tolerance=1.5)   # to about 10 m
        if len(c) < 4: continue
        px, py = c[:, 1] - 0.5 + x0 * 256, c[:, 0] - 0.5 + y0 * 256   # padded by one; pixel centres
        X, Y = project(*unmerc(px, py, world))
        P = np.round(np.column_stack([X, Y])[:-1] * 1000).astype(np.int64)   # in thousandths, each from the last
        dP = np.diff(P, axis=0)
        d.append(f'M{P[0, 0] / 1000:g} {P[0, 1] / 1000:g}l' + ' '.join(f'{dx / 1000:g} {dy / 1000:g}' for dx, dy in dP) + 'z')
    return ''.join(d)


def runs(tiles):   # {(x, y)} -> [[y, x0, x1], ...]
    rows = {}
    for x, y in tiles: rows.setdefault(y, []).append(x)
    out = []
    for y in sorted(rows):
        xs = sorted(rows[y]); a = b = xs[0]
        for x in xs[1:]:
            if x == b + 1: b = x
            else: out.append([y, a, b]); a = b = x
        out.append([y, a, b])
    return out


def main():
    global VINOUS_DIR, MARGIN_OVER_AVAS
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--workers', type=int, default=os.cpu_count())
    ap.add_argument('--preview', help='write a picture of the whole layer at ZMAX - 2 here, and stop')
    ap.add_argument('--margin-over-avas', action='store_true', help='keep margin names over other maps\' AVAs too')
    args = ap.parse_args()
    VINOUS_DIR = os.environ.get('VINOUS_DIR')
    if not VINOUS_DIR or not os.path.isdir(VINOUS_DIR): sys.exit('VINOUS_DIR: the folder of Vinous\'s Napa SVGs')
    MARGIN_OVER_AVAS = args.margin_over_avas
    os.makedirs(CACHE, exist_ok=True)
    t0 = time.time()
    prepare()
    print('name boxes:', flush=True)
    place_names()
    want = tiles_wanted()
    print(f'{len(want)} tiles at zoom {ZMAX} to make, {args.workers} at a time', flush=True)
    levels = {ZMAX: {}}
    with mp.get_context('fork').Pool(args.workers) as pool:
        for i, (t, img) in enumerate(pool.imap_unordered(make_tile, want, chunksize=4)):
            if img is not None: levels[ZMAX][t] = img
            if i % 200 == 0: print(f'  {i} of {len(want)}, {time.time() - t0:.0f} s', flush=True)
    for z in range(ZMAX - 1, ZMIN - 1, -1):
        up = {}
        for (x, y) in levels[z + 1]: up.setdefault((x // 2, y // 2), {})
        levels[z] = {}
        for (x, y) in up:
            img = halve({(i, j): levels[z + 1].get((2 * x + i, 2 * y + j)) for i in (0, 1) for j in (0, 1)})
            if img is not None: levels[z][(x, y)] = img
    if args.preview:
        z = ZMAX - 2
        T = levels[z]; xs = [t[0] for t in T]; ys = [t[1] for t in T]
        pic = Image.new('RGBA', ((max(xs) - min(xs) + 1) * 256, (max(ys) - min(ys) + 1) * 256), (255, 255, 255, 255))
        for (x, y), img in T.items():
            pic.alpha_composite(Image.fromarray(img, 'RGBA'), ((x - min(xs)) * 256, (y - min(ys)) * 256))
        pic.convert('RGB').save(args.preview)
        print('preview', args.preview, pic.size)
        return
    # the tiles, written afresh
    if os.path.isdir(OUT):
        for z in os.listdir(OUT):
            if z.isdigit():
                for dp, dn, fn in os.walk(os.path.join(OUT, z), topdown=False):
                    for f in fn:
                        if f.endswith('.webp'): os.remove(os.path.join(dp, f))
                    if not os.listdir(dp): os.rmdir(dp)
    total = 0
    for z, T in levels.items():
        for (x, y), img in T.items():
            d = os.path.join(OUT, str(z), str(x))
            os.makedirs(d, exist_ok=True)
            f = os.path.join(d, f'{y}.webp')
            Image.fromarray(img, 'RGBA').save(f, 'WEBP', quality=QUALITY, alpha_quality=90, method=6)
            total += os.path.getsize(f)
    print(f'{sum(len(T) for T in levels.values())} tiles, {total / 1e6:.1f} MB', flush=True)
    cover = outline(levels)
    X = [v for sh in SHEETS for v in (sh.view_box[0], sh.view_box[2])]; Y = [v for sh in SHEETS for v in (sh.view_box[1], sh.view_box[3])]
    index = {
        'series': G['series'], 'authors': G['authors'], 'publisher': G['publisher'],
        'years': [min(m['year'] for m in G['maps']), max(m['year'] for m in G['maps'])],
        'maps': [{k: m[k] for k in ('id', 'title', 'edition', 'year')} for m in G['maps']],
        'zoom': [ZMIN, ZMAX],
        'box': [round(min(X), 4), round(min(Y), 4), round(max(X), 4), round(max(Y), 4)],
        'tiles': {str(z): runs(T) for z, T in sorted(levels.items())},
        'cover': cover,
    }
    json.dump(index, open(os.path.join(OUT, 'index.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    print(f'index.json {os.path.getsize(os.path.join(OUT, "index.json")) / 1e3:.0f} kB; {time.time() - t0:.0f} s in all')


if __name__ == '__main__':
    main()
