#!/usr/bin/env python3
"""Learns Napa Valley's vineyards from Vinous's maps for the map of 风土 Terroir (terroir/index.html):
each parcel's outline and the name it carries, written to terroir/map/vinous/vineyards.json, which the
page draws in its own colours. Nothing of the maps' look is kept.

The maps are The Vineyards of Napa Valley, by Antonio Galloni with Alessandro Masnaghetti,
© 2016–2023 Vinous Media LLC, used with Vinous's written permission, for personal study and exchange
only; no commercial use of any kind (map/vinous/NOTICE.md). Their SVG files are not in this
repository: VINOUS_DIR names the folder that holds them.

  VINOUS_DIR=~/Downloads/Napa_Valley_Maps .venv/bin/python build-vinous.py [map id ...]

It needs numpy, scipy, scikit-image, Pillow, Shapely and svgelements (.venv/bin/pip install numpy scipy
scikit-image pillow shapely svgelements), Tesseract to read the names (apt install tesseract-ocr), Node
with Playwright's Chromium to find what each map draws (render-svg.cjs), and the UC Davis AVA
boundaries in .cache/ava/, which build-appellations.mjs downloads. About ten minutes. Naming maps
reads only those and writes .cache/vinous/<id>.json, a picture of what was found beside it.

Where each map lies is in vinous-georef.json (georef-vinous.py found it): a similarity, scale,
rotation and shift, from the map's SVG units to the California view's. Then, for each map:

  1. Its SVG is read shape by shape. The parcels are the filled shapes that are not paper, text,
     buildings, water, terrain or lines. A fill is terrain if one of its shapes covers 60 ha or more,
     or its shapes cover 20 ha and wind like the bands between contours (by area, less compact than
     0.3, where a circle is 1 and a vineyard's block about 0.6).
  2. Vinous names a vineyard in a box laid over it, or beside it with a thin line to a dot on it.
     Each box's name is read by Tesseract from the box's own glyphs, drawn alone line by line;
     Coombsville's text is live. vinous-names.json corrects what Tesseract misreads.
  3. The parcel under a box, or at the end of its line, is the name's. Vinous gives an owner's
     parcels one fill, so parcels of that fill within 80 m of it, and of those, are the name's too,
     each going to the nearest name where two reach it. Parcels in a vineyard pattern that no name
     reaches are kept, unnamed.

Then, where maps overlap, a parcel is kept from the map that shows there: the map of its own AVA
(the UC Davis boundary) first, Pritchard Hill over all of its own ground, else the map whose AVA is
nearest. Each owner (the name before ' - ') gets a colour from the page's palette so that
neighbouring owners differ, and the parcels
are written in the California view's units as relative paths in metres, with the outline of what
the maps cover, where the page's open-data vineyards give way.
"""
import json, math, os, re, subprocess, sys, tempfile, time, collections
import multiprocessing as mp
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, '.cache', 'vinous')
OUT = os.path.join(ROOT, 'map', 'vinous', 'vineyards.json')
GEOREF = os.path.join(HERE, 'vinous-georef.json')
NAMES = os.path.join(HERE, 'vinous-names.json')
AVAS = os.path.join(HERE, '.cache', 'ava', 'avas.geojson')
RENDER = os.path.join(HERE, 'render-svg.cjs')

BAND = 3          # pixels (at 1 a point) round what a map draws, still its own
REACH = 80        # metres: a name's parcels of one fill reach this far from each other
TERRAIN = 60e4    # square metres: a fill with a shape this large is terrain, not a vineyard
COLOURS = 8       # the page's palette for names

G = json.load(open(GEOREF, encoding='utf-8'))
P = G['proj']
R = math.pi / 180
L0, S0, C0 = P['center'][0] * R, math.sin(P['center'][1] * R), math.cos(P['center'][1] * R)
SC, T0, T1 = P['scale'], P['translate'][0], P['translate'][1]
UPM = SC / 6371000   # view units a metre: the projection is equal-area, so areas scale by UPM²
VINOUS_DIR = os.environ.get('VINOUS_DIR')


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


# ---------- each map drawn, for what it draws where ----------

FALLBACK = [   # fonts for an SVG's live text, after its own, which may not be installed
    ('myriad', "Carlito, 'Liberation Sans', sans-serif"),
    ('century gothic', "'TeX Gyre Adventor', 'URW Gothic', 'Liberation Sans', sans-serif"),
    ('palatino', "'TeX Gyre Pagella', 'URW Palladio L', 'Liberation Serif', serif"),
    ('arial', "'Liberation Sans', sans-serif"),
    ('', 'sans-serif'),
]


def text_ready(src):
    """An SVG with live text (Coombsville's), made to draw without its fonts: each font-family given
    fallbacks, and the pieces Illustrator places one by one along a line let run on."""
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


def drawing(sheet, scale=1):
    """The SVG drawn at `scale` pixels a unit, as an RGB array, from the cache when it is newer."""
    base = os.path.join(CACHE, f'{sheet["id"]}@{scale}')
    svg = os.path.join(VINOUS_DIR, sheet['file'])
    if not (os.path.exists(base + '.json') and os.path.getmtime(base + '.json') >= os.path.getmtime(svg)):
        print(f'  drawing {sheet["file"]} at {scale} a point', flush=True)
        src = open(svg, encoding='utf-8').read()
        if '<text' in src:
            svg = os.path.join(CACHE, sheet['id'] + '.svg')
            open(svg, 'w', encoding='utf-8').write(text_ready(src))
        subprocess.run(['node', RENDER, svg, base, str(scale), '2048'], check=True)
    n = json.load(open(base + '.json'))['strips']
    return np.ascontiguousarray(np.concatenate([np.asarray(Image.open(f'{base}.{i}.png').convert('RGB')) for i in range(n)]))


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
    """What a map draws: what is not white on its sheet once the frame is taken off, the largest
    shape left (titles, insets, legends and logos stand apart from it)."""
    ink = rgb.min(axis=2) < 238
    m = 25
    ink[:m, :] = ink[-m:, :] = False; ink[:, :m] = ink[:, -m:] = False
    ink[thin_runs(ink.mean(axis=1) > 0.85), :] = False
    ink[:, thin_runs(ink.mean(axis=0) > 0.85)] = False
    ink = ndimage.binary_closing(ink, iterations=3)
    ink = ndimage.binary_fill_holes(ink)
    ink = ndimage.binary_opening(ink, iterations=6)
    lab, n = ndimage.label(ink)
    sizes = ndimage.sum(ink, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


class Sheet:
    def __init__(self, cfg, rank):
        self.cfg, self.id, self.rank, self.ava = cfg, cfg['id'], rank, cfg['ava']
        s, th = cfg['scale'], cfg['rotation']
        self.a, self.b, self.tx, self.ty = s * math.cos(th), s * math.sin(th), cfg['tx'], cfg['ty']
        self.m = cfg['metres_per_unit']

    def to_view(self, u, v):
        return self.a * u - self.b * v + self.tx, self.b * u + self.a * v + self.ty

    def to_svg(self, X, Y):
        X, Y, d = X - self.tx, Y - self.ty, self.a * self.a + self.b * self.b
        return (self.a * X + self.b * Y) / d, (-self.b * X + self.a * Y) / d


def nearest(mask, u, v):   # a 1-a-point mask at SVG units u, v; False off the sheet
    h, w = mask.shape
    j, i = np.floor(u).astype(np.int64), np.floor(v).astype(np.int64)
    ok = (i >= 0) & (j >= 0) & (i < h) & (j < w)
    out = np.zeros(np.shape(u), bool)
    out[ok] = mask[i[ok], j[ok]]
    return out


# ---------- which map shows where ----------

def prepare_regions(sheets, avas):
    """Each map's drawn region, and a 10 m raster of the view for each AVA's extent and the distance
    to it."""
    global GRID
    for sh in sheets:
        sh.cand = ndimage.binary_dilation(region_mask(drawing(sh.cfg, 1)), iterations=BAND)
        ys, xs = np.nonzero(sh.cand[::2, ::2])
        X, Y = sh.to_view(xs * 2.0, ys * 2.0)
        sh.view_box = (X.min(), Y.min(), X.max(), Y.max())
    res = 10 * UPM
    x0 = min(s.view_box[0] for s in sheets) - 0.3; y0 = min(s.view_box[1] for s in sheets) - 0.3
    x1 = max(s.view_box[2] for s in sheets) + 0.3; y1 = max(s.view_box[3] for s in sheets) + 0.3
    W, H = int((x1 - x0) / res) + 1, int((y1 - y0) / res) + 1
    GRID = {'x0': x0, 'y0': y0, 'res': res, 'W': W, 'H': H, 'in': {}, 'dist': {}}
    for sh in sheets:
        if not sh.ava: continue
        img = Image.new('L', (W, H), 0); d = ImageDraw.Draw(img)
        geom = avas[sh.ava]
        for poly in ([geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']):
            for k, ring in enumerate(poly):
                ring = np.array(ring)[:, :2]
                X, Y = project(ring[:, 0], ring[:, 1])
                d.polygon(list(zip((X - x0) / res, (Y - y0) / res)), fill=0 if k else 1)
        inside = np.asarray(img) > 0
        GRID['in'][sh.id] = inside
        GRID['dist'][sh.id] = ndimage.distance_transform_edt(~inside).astype(np.float32) * 10


def owner_at(sheets, X, Y):
    """The map that shows at a point of the view: lowest key wins, a map over its own AVA first (by
    its order), then Pritchard Hill's over its own ground, then the map whose AVA is nearest."""
    g = GRID
    i = min(max(int((Y - g['y0']) / g['res']), 0), g['H'] - 1); j = min(max(int((X - g['x0']) / g['res']), 0), g['W'] - 1)
    best, bk = None, math.inf
    for sh in sheets:
        u, v = sh.to_svg(np.array([X]), np.array([Y]))
        if not nearest(sh.cand, u, v)[0]: continue
        if not sh.ava: k = 1.0
        elif g['in'][sh.id][i, j]: k = sh.rank * 1e-3
        else: k = 2 + g['dist'][sh.id][i, j] / 1000
        if k < bk: best, bk = sh, k
    return best


# ---------- an SVG, shape by shape ----------

DARK = re.compile(r'^(black|#000|#000000|#1d1d1b|#1a1a18|#3c3c3b|#192223|#231f20)$', re.I)
WHITE = re.compile(r'^(white|#fff|#ffffff|#fefefe)$', re.I)


def hexrgb(f):
    f = f.strip().lower()
    if f == 'black': return (0, 0, 0)
    if f == 'white': return (255, 255, 255)
    m = re.fullmatch(r'#([0-9a-f]{3}|[0-9a-f]{6})', f)
    if not m: return None
    h = m.group(1)
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def label_blue(f):   # the blue Vinous strokes its name boxes in
    c = hexrgb(f or '')
    return c is not None and c[0] < 64 and 80 <= c[1] <= 128 and c[2] >= 160


def rings_of(path, per_curve=6):
    from svgelements import Move, Line, Close
    rings, cur = [], []
    for seg in path.segments():
        if isinstance(seg, Move):
            if len(cur) > 2: rings.append(cur)
            cur = [(seg.end.x, seg.end.y)]
        elif isinstance(seg, Close):
            if len(cur) > 2: rings.append(cur)
            cur = []
        else:
            if not cur and seg.start is not None: cur = [(seg.start.x, seg.start.y)]
            if isinstance(seg, Line): cur.append((seg.end.x, seg.end.y))
            else:
                for t in np.linspace(0, 1, per_curve + 1)[1:]:
                    q = seg.point(t); cur.append((q.x, q.y))
    if len(cur) > 2: rings.append(cur)
    return rings


def lines_of_path(path):   # a stroke's polylines
    from svgelements import Move
    out, cur = [], []
    for seg in path.segments():
        if isinstance(seg, Move):
            if len(cur) > 1: out.append(cur)
            cur = [(seg.end.x, seg.end.y)]
        elif seg.end is not None:
            if not cur and seg.start is not None: cur = [(seg.start.x, seg.start.y)]
            cur.append((seg.end.x, seg.end.y))
    if len(cur) > 1: out.append(cur)
    return out


def even_odd(rings):
    from shapely.geometry import Polygon
    g = None
    for r in rings:
        try: pr = Polygon(r).buffer(0)
        except Exception: continue
        if pr.is_empty: continue
        g = pr if g is None else g.symmetric_difference(pr)
    return g


def read_svg(path):
    """Every shape of an SVG in drawing order: filled shapes as polygons, stroked ones as lines,
    Vinous's name boxes (unfilled rects stroked in its blue) and any live text."""
    from svgelements import SVG, Shape, Path, SimpleLine, Polyline, Rect
    src = open(path, encoding='utf-8').read()
    root = ET.fromstring(src)
    k = 0
    def walk(el):
        nonlocal k
        tag = el.tag.rsplit('}', 1)[-1]
        if tag in ('defs', 'clipPath', 'pattern', 'mask', 'symbol', 'style', 'marker'): return
        if tag in ('path', 'polygon', 'rect', 'circle', 'ellipse', 'polyline', 'line'):
            el.set('data-k', str(k)); k += 1
        for c in el: walk(c)
    walk(root)
    ET.register_namespace('', 'http://www.w3.org/2000/svg'); ET.register_namespace('xlink', 'http://www.w3.org/1999/xlink')
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False, encoding='utf-8') as f:
        f.write(ET.tostring(root, encoding='unicode')); tmp = f.name
    try: svg = SVG.parse(tmp, reify=True)
    finally: os.unlink(tmp)
    shapes, strokes, boxes = [], [], []
    for e in svg.elements():
        if not isinstance(e, Shape) or 'data-k' not in e.values: continue
        k = int(e.values['data-k'])
        fill, stroke = e.values.get('fill'), e.values.get('stroke')
        try: sw = float(re.sub(r'[a-z%]+$', '', str(e.values.get('stroke-width') or '1')))
        except ValueError: sw = 1.0
        p = Path(e)
        if fill in (None, 'none'):
            if not stroke or stroke == 'none': continue
            if isinstance(e, Rect) and label_blue(stroke):
                bb = p.bbox()
                if bb and 3 < bb[2] - bb[0] < 300 and 3 < bb[3] - bb[1] < 60:
                    q = rings_of(p, 1)
                    if q: boxes.append({'k': k, 'ring': q[0]})
                continue
            for line in lines_of_path(p): strokes.append({'k': k, 'stroke': stroke.strip(), 'sw': sw, 'pts': line})
            continue
        if isinstance(e, (SimpleLine, Polyline)): continue
        rings = rings_of(p)
        g = even_odd(rings)
        if g is None or g.is_empty or g.area <= 0: continue
        shapes.append({'k': k, 'fill': fill.strip(), 'geom': g, 'rings': rings_of(p, 10)})
    return shapes, strokes, boxes, live_text(root)


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
            kk = math.tan(math.radians(a[0]))
            m = np.array([[1, kk, 0], [0, 1, 0], [0, 0, 1]]) if kind == 'skewX' else np.array([[1, 0, 0], [kk, 1, 0], [0, 0, 1]])
        M = M @ m
    return M


def live_text(root):
    """Each <text>: points a little way into it, in SVG units, and what it says."""
    out = []
    def walk(el, M):
        tag = el.tag.rsplit('}', 1)[-1]
        if tag in ('defs', 'clipPath', 'pattern', 'mask', 'symbol', 'style'): return
        M = M @ _matrix(el.get('transform'))
        if tag == 'text':
            s = ''.join(el.itertext())
            x, y = float(el.get('x', 0) or 0), float(el.get('y', 0) or 0)
            probes = [tuple((M @ np.array([x + dx, y - 2, 1]))[:2]) for dx in (1, 4, 8)]   # inside its first letters
            if s.strip(): out.append((probes, s))
            return
        for c in el: walk(c, M)
    walk(root, np.eye(3))
    return out


# ---------- the names ----------

def text_lines(rings):
    """Glyph contours into lines of text, top to bottom, by the middle of each contour's height."""
    items = []
    for r in rings:
        a = np.asarray(r); items.append(((a[:, 1].min() + a[:, 1].max()) / 2, np.ptp(a[:, 1]), a))
    if not items: return []
    h = np.median([it[1] for it in items])
    items.sort(key=lambda it: it[0])
    out = [[items[0]]]
    for it in items[1:]:
        if it[0] - np.mean([x[0] for x in out[-1]]) > 0.8 * h: out.append([it])
        else: out[-1].append(it)
    return [[it[2] for it in line] for line in out]


def draw_line(rings, height=48, pad=16):
    a = np.vstack(rings)
    x0, y0, x1, y1 = a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()
    s = height / max(y1 - y0, 1e-6) * 2   # drawn twice as large, then halved: smooth edges
    W, H = int((x1 - x0) * s) + 4 * pad, int((y1 - y0) * s) + 4 * pad
    img = np.zeros((H, W), bool)
    for r in rings:   # even-odd, as the glyphs are drawn
        m = Image.new('1', (W, H), 0)
        ImageDraw.Draw(m).polygon([((x - x0) * s + 2 * pad, (y - y0) * s + 2 * pad) for x, y in r], fill=1)
        img ^= np.asarray(m, bool)
    return Image.fromarray(np.where(img, 0, 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS)


def tesseract(job):
    """One box's lines, each read by Tesseract as a single line of text."""
    key, lines = job
    texts = []
    for line in lines:
        pic = draw_line([np.asarray(r) for r in line])
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as f: pic.save(f.name)
        try:
            out = subprocess.run(['tesseract', f.name, 'stdout', '--psm', '7', '-l', 'eng'], capture_output=True, text=True,
                                 env={**os.environ, 'OMP_THREAD_LIMIT': '1'}).stdout   # threads only fight each other here
        finally: os.unlink(f.name)
        t = ' '.join(out.split())
        if t: texts.append(t)
    return key, texts


PARTICLES = ('de', 'des', 'du', 'di', 'del', 'della', 'la', 'le', 'van', 'von', 'y', 'of', 'the')


def join_lines(lines):
    """A box's lines as one name: Vinous sets an owner over its vineyard, so lines join with ' - ',
    but a line that carries on a phrase joins with a space: one that opens with '(' or a lower-case
    word, or follows '&', a comma or a particle such as 'des'. A hyphen inside a word stays."""
    out = ''
    for t in lines:
        t = t.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').strip(' |_')
        if not t: continue
        if not out: out = t
        elif t.startswith('(') or t[0].islower() or out.endswith(('&', '-', ',')) or out.split()[-1].lower() in PARTICLES: out += ' ' + t
        else: out += ' - ' + t
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r' (Il|Ill)$', lambda m: ' ' + m.group(1).replace('l', 'I'), out)   # Herrick II, Georges III
    return re.sub(r'\s+-\s*|\s*-\s+', ' - ', out).replace(' - - ', ' - ')


# ---------- one map ----------

def learn(sh, path, pool, fixes={}):
    from shapely.geometry import Polygon, Point
    from shapely.strtree import STRtree
    shapes, strokes, boxes, live = read_svg(path)
    m = sh.m
    bpolys = [Polygon(b['ring']).buffer(0.75, join_style=2) for b in boxes]
    btree = STRtree(bpolys)
    # each box's text: dark shapes inside it drawn after it (buildings under it were drawn before)
    glyphs = collections.defaultdict(list); text_k = set()
    for s in shapes:
        if not DARK.match(s['fill']): continue
        c = s['geom'].representative_point()
        for bi in btree.query(c):
            bi = int(bi)
            if s['k'] > boxes[bi]['k'] and bpolys[bi].buffer(0.3).contains(s['geom'].envelope):
                glyphs[bi].append(s); text_k.add(s['k']); break
    names = {}
    if live:   # live text: whatever starts inside a box, line by line
        rows = collections.defaultdict(list)
        for probes, s in live:
            hit = next((int(bi) for x, y in probes for bi in btree.query(Point(x, y)) if bpolys[int(bi)].contains(Point(x, y))), None)
            if hit is not None: rows[hit].append((probes[0][1], probes[0][0], s))
        for bi, items in rows.items():
            items.sort()
            lines = []
            for y, x, s in items:
                if lines and abs(lines[-1][0] - y) < 2: lines[-1][1].append((x, s))
                else: lines.append([y, [(x, s)]])
            names[bi] = join_lines([''.join(s for _, s in sorted(l[1])) for l in lines])
    jobs = [((sh.id, bi), text_lines([r for s in gl for r in s['rings']])) for bi, gl in glyphs.items() if bi not in names]
    for (sid, bi), texts in (pool.imap_unordered(tesseract, jobs, chunksize=4) if pool else map(tesseract, jobs)):
        names[bi] = join_lines(texts)
    for bi in range(len(boxes)):   # what Tesseract misreads, as vinous-names.json has it
        if f'{sh.id}:{bi}' in fixes: names[bi] = fixes[f'{sh.id}:{bi}']
    # leader lines: thin dark strokes from a box out to a dot on a parcel
    dots = [s['geom'] for s in shapes if DARK.match(s['fill']) and s['k'] not in text_k and 0.4 < s['geom'].area < 12
            and s['geom'].area / max(s['geom'].envelope.area, 1e-9) > 0.55]
    dtree = STRtree(dots) if dots else None
    leaders = [st for st in strokes if DARK.match(st['stroke']) and st['sw'] <= 0.6]
    ends = STRtree([Point(st['pts'][0]) for st in leaders] + [Point(st['pts'][-1]) for st in leaders]) if leaders else None
    anchors = collections.defaultdict(list)
    for li, st in enumerate(leaders):
        a, b = Point(st['pts'][0]), Point(st['pts'][-1])
        for end, far in ((a, b), (b, a)):
            hit = [int(i) for i in btree.query(end.buffer(1.5)) if bpolys[int(i)].buffer(1.5).contains(end) and not bpolys[int(i)].buffer(1.5).contains(far)]
            if not hit: continue
            seen = {li}
            for _ in range(3):   # a line drawn in pieces: on to the end of the next piece
                nxt = [int(j) % len(leaders) for j in ends.query(far.buffer(0.5)) if int(j) % len(leaders) not in seen]
                if not nxt: break
                j = nxt[0]; seen.add(j)
                pa, pb = Point(leaders[j]['pts'][0]), Point(leaders[j]['pts'][-1])
                far = pb if pa.distance(far) < pb.distance(far) else pa
            if dtree is not None:
                near = [dots[int(j)] for j in dtree.query(far.buffer(2.0))]
                if near: far = min(near, key=lambda d: d.distance(far)).centroid
            anchors[hit[0]].append(far)
            break
    # the parcels
    rgb = {s['fill']: hexrgb(s['fill']) for s in shapes}
    biggest, total, curvy = collections.defaultdict(float), collections.defaultdict(float), collections.defaultdict(float)
    for s in shapes:   # terrain is drawn large, or in long winding bands between contours
        g = s['geom']
        biggest[s['fill']] = max(biggest[s['fill']], g.area); total[s['fill']] += g.area
        curvy[s['fill']] += g.area * 4 * math.pi * g.area / max(g.length ** 2, 1e-9)
    def candidate(s):
        f = s['fill']
        if s['k'] in text_k or WHITE.match(f) or DARK.match(f): return False
        if not f.startswith('url('):
            c = rgb.get(f)
            if c is None: return False
            r, g, b = c
            if b > 200 and b - r > 25 and g > 170 and b - g > 5: return False      # water
            if max(c) - min(c) < 18 and max(c) < 215: return False                 # buildings, paving
            if biggest[f] * m * m > TERRAIN: return False                          # terrain
            if total[f] * m * m > 20e4 and curvy[f] / total[f] < 0.3: return False   # bands of it
        g = s['geom']
        thick = g.area / max(g.length / 2, 1e-9)   # about the width of a long shape
        return g.area * m * m > 150 and thick * m > 8 and g.length / 2 / thick < 60   # not a line
    cands = [s for s in shapes if candidate(s)]
    # the same parcel drawn twice, a fill and a pattern over it: the one on top
    tree = STRtree([s['geom'] for s in cands])
    drop = set()
    for i, s in enumerate(cands):
        for j in tree.query(s['geom']):
            j = int(j)
            if j <= i or j in drop: continue
            inter = s['geom'].intersection(cands[j]['geom']).area
            if inter > 0.8 * min(s['geom'].area, cands[j]['geom'].area) and abs(s['geom'].area - cands[j]['geom'].area) < 0.25 * max(s['geom'].area, cands[j]['geom'].area):
                drop.add(i if s['k'] < cands[j]['k'] else j)
    cands = [s for i, s in enumerate(cands) if i not in drop]
    tree = STRtree([s['geom'] for s in cands])
    def topmost_at(p, box=None):
        hits = [cands[int(i)] for i in tree.query(p) if cands[int(i)]['geom'].contains(p)]
        if hits: return max(hits, key=lambda s: s['k'])
        if box is not None:   # a box beside its parcel, or over its edge
            near = [(cands[int(i)]['geom'].intersection(box.buffer(1.0)).area, cands[int(i)]) for i in tree.query(box.buffer(1.0))]
            near = [x for x in near if x[0] > 0]
            if near: return max(near, key=lambda x: (x[0], x[1]['k']))[1]
        near = [cands[int(i)] for i in tree.query(p.buffer(3.0))]
        return min(near, key=lambda s: s['geom'].distance(p)) if near else None
    seeds = []
    for bi, bp in enumerate(bpolys):
        if not names.get(bi): continue
        for p in anchors.get(bi) or [bp.centroid]:
            s = topmost_at(p, None if anchors.get(bi) else bp)
            if s is not None: seeds.append((bi, s))
    # each name's parcels: its own, and the same fill near it, chained, each to the nearest name
    D = REACH / m
    index = {s['k']: i for i, s in enumerate(cands)}
    by_fill = collections.defaultdict(list)
    for i, s in enumerate(cands): by_fill[s['fill']].append(i)
    ftrees = {f: STRtree([cands[i]['geom'] for i in idx]) for f, idx in by_fill.items()}
    owner, dist, seed_of = {}, {}, {}
    for bi, s0 in seeds:
        group = by_fill[s0['fill']]
        start = index[s0['k']]
        seen = {start: 0.0}; frontier = [start]
        while frontier:
            nxt = []
            for i in frontier:
                for j in ftrees[s0['fill']].query(cands[i]['geom'].buffer(D)):
                    j = group[int(j)]
                    if j not in seen and cands[j]['geom'].distance(cands[i]['geom']) <= D:
                        seen[j] = cands[j]['geom'].distance(s0['geom']); nxt.append(j)
            frontier = nxt
        for j, d in seen.items():
            if j not in owner or d < dist[j]: owner[j] = bi; dist[j] = d
        seed_of.setdefault(bi, start)
    parcels = []
    for i, s in enumerate(cands):
        if i in owner: parcels.append({'geom': s['geom'], 'box': owner[i], 'seed': seed_of.get(owner[i]) == i})
        elif s['fill'].startswith('url('): parcels.append({'geom': s['geom'], 'box': None, 'seed': False})
    print(f'  {sh.id:16} {len(boxes)} boxes, {sum(1 for bi in range(len(boxes)) if names.get(bi))} read, {len(anchors)} with a line; '
          f'{len(cands)} parcels, {len(owner)} named, {sum(1 for p in parcels if p["box"] is None)} in a pattern unnamed', flush=True)
    return {'boxes': boxes, 'names': names, 'anchors': {b: [(p.x, p.y) for p in a] for b, a in anchors.items()}, 'parcels': parcels}


def picture(sh, found, out):
    """What was found, over the map faded: each name's parcels in a colour, unnamed ones grey."""
    lo = drawing(sh.cfg, 1)
    S = 2
    pic = Image.fromarray((lo * 0.35 + 165).astype(np.uint8)).resize((lo.shape[1] * S, lo.shape[0] * S))
    d = ImageDraw.Draw(pic, 'RGBA')
    rng = np.random.default_rng(1)
    col = {bi: tuple(int(c) for c in rng.integers(30, 220, 3)) for bi in range(len(found['boxes']))}
    for p in found['parcels']:
        for poly in getattr(p['geom'], 'geoms', [p['geom']]):
            xy = [(x * S, y * S) for x, y in poly.exterior.coords]
            if p['box'] is not None: d.polygon(xy, fill=col[p['box']] + (200,), outline=(0, 0, 0, 255))
            else: d.polygon(xy, fill=(120, 120, 120, 90), outline=(90, 90, 90, 255))
    for bi, b in enumerate(found['boxes']):
        d.polygon([(x * S, y * S) for x, y in b['ring']], outline=col[bi] + (255,), fill=(255, 255, 255, 220))
        d.text((min(x for x, _ in b['ring']) * S + 2, min(y for _, y in b['ring']) * S + 2), found['names'].get(bi, '?')[:34], fill=(0, 0, 0, 255))
        for x, y in found['anchors'].get(bi, []):
            d.ellipse((x * S - 4, y * S - 4, x * S + 4, y * S + 4), fill=(255, 0, 255, 255))
    pic.save(out)


# ---------- all of them ----------

def owner_of(name):   # Vinous writes 'Owner - Vineyard'
    return name.split(' - ')[0].strip()


def palette(groups, adjacent):
    """A colour for each owner, from COLOURS, so that owners next to each other differ (greedy, the
    owners with most neighbours first)."""
    colour = {}
    for g in sorted(groups, key=lambda g: -len(adjacent[g])):
        used = collections.Counter(colour[n] for n in adjacent[g] if n in colour)
        free = [c for c in range(COLOURS) if c not in used]
        colour[g] = free[0] if free else min(range(COLOURS), key=lambda c: used[c])
    return colour


def main():
    from shapely.geometry import Polygon, MultiPolygon, Point, shape as gshape
    from shapely.ops import unary_union, polylabel
    from shapely.strtree import STRtree
    from shapely import affinity
    if not VINOUS_DIR or not os.path.isdir(VINOUS_DIR): sys.exit('VINOUS_DIR: the folder of Vinous\'s Napa SVGs')
    os.makedirs(CACHE, exist_ok=True)
    only = set(sys.argv[1:])
    fixes = json.load(open(NAMES, encoding='utf-8')) if os.path.exists(NAMES) else {}
    t0 = time.time()
    av = {f['properties']['name']: f['geometry'] for f in json.load(open(AVAS))['features'] if not f['properties'].get('valid_end')}
    sheets = [Sheet(c, i) for i, c in enumerate(G['maps'])]
    found = {}
    with mp.get_context('fork').Pool(os.cpu_count()) as pool:
        for sh in sheets:
            if only and sh.id not in only: continue
            f = learn(sh, os.path.join(VINOUS_DIR, sh.cfg['file']), pool, fixes)
            found[sh.id] = f
            picture(sh, f, os.path.join(CACHE, sh.id + '.png'))
            json.dump({str(b): n for b, n in sorted(f['names'].items())}, open(os.path.join(CACHE, sh.id + '.json'), 'w', encoding='utf-8'), indent=0, ensure_ascii=False)
    if only:
        print(f'{time.time() - t0:.0f} s; pictures and names in {CACHE}')
        return
    print('which map shows where', flush=True)
    prepare_regions(sheets, av)
    # every parcel in view units, kept from the map that shows there
    parcels, groups = [], {}
    for sh in sheets:
        f = found[sh.id]
        for p in f['parcels']:
            q = p['geom'].representative_point()   # on the map itself, not an inset in its margin
            if not nearest(sh.cand, np.array([q.x]), np.array([q.y]))[0]: continue
            g = affinity.affine_transform(p['geom'], [sh.a, -sh.b, sh.b, sh.a, sh.tx, sh.ty])
            c = g.representative_point()
            if owner_at(sheets, c.x, c.y) is not sh: continue
            name = f['names'].get(p['box']) if p['box'] is not None else None
            if not name: name = None
            gid = (sh.id, p['box']) if name else None
            if gid: groups.setdefault(gid, name)
            parcels.append({'geom': g, 'group': gid, 'seed': p['seed']})
    print(f'{len(parcels)} parcels kept, {len(groups)} names', flush=True)
    # one colour an owner, neighbours different
    tree = STRtree([p['geom'] for p in parcels])
    adjacent = collections.defaultdict(set)
    for i, p in enumerate(parcels):
        if p['group'] is None: continue
        a = owner_of(groups[p['group']])
        for j in tree.query(p['geom'].buffer(40 * UPM)):
            q = parcels[int(j)]['group']
            if q is not None and owner_of(groups[q]) != a: adjacent[a].add(owner_of(groups[q]))
    colour = palette(sorted(set(owner_of(n) for n in groups.values())), adjacent)
    # the AVA each parcel lies in, the smallest that holds it
    whole = gshape(av['Napa Valley']).buffer(0.01)
    napa = [n for n, g in av.items() if n == 'Napa Valley' or gshape(g).buffer(0).within(whole)]
    ava_geoms = {}
    for n in napa:
        polys = []
        for poly in ([av[n]['coordinates']] if av[n]['type'] == 'Polygon' else av[n]['coordinates']):
            rings = [np.column_stack(project(np.array(r)[:, 0], np.array(r)[:, 1])) for r in poly]
            polys.append(Polygon(rings[0], rings[1:]).buffer(0))
        ava_geoms[n] = unary_union(polys)
    ava_names = sorted(ava_geoms, key=lambda n: ava_geoms[n].area)   # smallest first
    # written relative to an origin, in metres
    allg = unary_union([p['geom'] for p in parcels])
    x0, y0, x1, y1 = allg.bounds
    def path(g):
        out = []
        for poly in getattr(g, 'geoms', [g]):
            for ring in [poly.exterior] + list(poly.interiors):
                pts = np.round((np.asarray(ring.coords)[:-1] - (x0, y0)) / UPM).astype(np.int64)
                keep = np.ones(len(pts), bool); keep[1:] = np.any(np.diff(pts, axis=0) != 0, axis=1)
                pts = pts[keep]
                if len(pts) < 3: continue
                d = np.diff(pts, axis=0)
                out.append(f'M{pts[0][0]} {pts[0][1]}l' + ' '.join(f'{a} {b}' for a, b in d).replace(' -', '-') + 'z')
        return ''.join(out)
    names = sorted(set(groups.values()))
    nidx = {n: i for i, n in enumerate(names)}
    rows = []
    for p in parcels:
        g = p['geom'].simplify(0.7 * UPM, preserve_topology=True)
        if g.is_empty: continue
        c = g.representative_point()
        a = next((ai for ai, n in enumerate(ava_names) if ava_geoms[n].contains(c)), -1)
        row = [nidx[groups[p['group']]] if p['group'] else -1, a, round(g.area / UPM ** 2 / 1e4, 2), path(g)]
        if p['seed'] and p['group']:
            lp = polylabel(max(getattr(g, 'geoms', [g]), key=lambda q: q.area), tolerance=2 * UPM)
            row += [round(lp.x, 4), round(lp.y, 4)]
        rows.append(row)
    # what the maps cover: their drawn regions, each where it shows
    cover = []
    for sh in sheets:
        from skimage import measure
        mask = np.pad(sh.cand, 1)
        for c in measure.find_contours(mask.astype(np.float32), 0.5):
            c = measure.approximate_polygon(c, tolerance=1.0)
            if len(c) < 4: continue
            X, Y = sh.to_view(c[:, 1] - 1, c[:, 0] - 1)
            q = Polygon(np.column_stack([X, Y])).buffer(0)
            if q.area > (200 * UPM) ** 2: cover.append(q)
    cov = unary_union(cover).simplify(10 * UPM)
    def rel(g):
        out = []
        for poly in getattr(g, 'geoms', [g]):
            for ring in [poly.exterior] + list(poly.interiors):
                P = np.round(np.asarray(ring.coords)[:-1] * 1000).astype(np.int64)
                d = np.diff(P, axis=0)
                out.append(f'M{P[0, 0] / 1000:g} {P[0, 1] / 1000:g}l' + ' '.join(f'{a / 1000:g} {b / 1000:g}' for a, b in d) + 'z')
        return ''.join(out)
    data = {
        'view': 'california', 'origin': [round(x0, 4), round(y0, 4)], 'unit': round(UPM, 9),
        'box': [round(x0, 4), round(y0, 4), round(x1, 4), round(y1, 4)],
        'series': G['series'], 'authors': G['authors'], 'publisher': G['publisher'],
        'years': [min(m['year'] for m in G['maps']), max(m['year'] for m in G['maps'])],
        'maps': [{k: m[k] for k in ('id', 'title', 'edition', 'year')} for m in G['maps']],
        'avas': ava_names,
        'names': [[n, colour[owner_of(n)]] for n in names],   # [name, its owner's colour 0..COLOURS-1]
        'parcels': rows,                             # [name or -1, AVA or -1, hectares, path, label x, label y]
        'cover': rel(cov),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(data, open(OUT, 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
    print(f'{len(rows)} parcels, {len(names)} names, {sum(1 for r in rows if r[0] < 0)} unnamed; '
          f'{os.path.getsize(OUT) / 1e3:.0f} kB; {time.time() - t0:.0f} s in all')


if __name__ == '__main__':
    main()
