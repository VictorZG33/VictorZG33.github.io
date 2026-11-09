#!/usr/bin/env python3
"""Finds where each of Vinous's Napa maps lies on the ground, for build-vinous.py: the similarity
(scale, rotation, shift) from a map's SVG units to the California view's, written into
vinous-georef.json.

  VINOUS_DIR=~/Downloads/Napa_Valley_Maps .venv/bin/python georef-vinous.py [--check] [map id ...]

--check fits each again on the roads from where vinous-georef.json has it, and says how far it would
move, in metres at the corners of what it draws, without writing anything.

It reads each map drawn at 1 pixel a point (build-vinous.py's cache, drawn if missing), the UC Davis
AVA boundaries (.cache/ava, from build-appellations.mjs) and OpenStreetMap's roads and lakes
(.cache/overture, from fetch-vineyards.py). The maps are north up and at about the scale printed on
them; their SVG units are points.

  1. A first guess: the map's own AVA boundary (for Pritchard Hill, Lake Hennessey's shore) laid on
     the edge of what the map draws (or of its largest lake), at the printed scale: a grid of shifts
     3 km each way, refined, the scale then let go by 1.5%. The cost is the truncated chamfer
     distance from the real boundary to the drawn one.
  2. That guess moved by the main roads too: the boundary's cost and the roads' (OpenStreetMap's on
     Vinous's orange and yellow ones), each weighed by what it is at the guess, coarse to fine, the
     shift kept within 200 m, the scale within 2% of the printed one and the rotation within 1°, so
     that yellow vineyards beside a road cannot drag the map away; kept if more roads then match.
  3. Then the roads alone, which fix it to a few metres: the drawn area cut into 1.5 km cells, and in each
     the shift that lays OpenStreetMap's main roads best on Vinous's orange and yellow ones (searched
     600 m round the guess, then less each round) is a control point; a similarity is fitted to them,
     the cells that disagree by more than 15 m dropped (RANSAC), north kept within 1.5° of the
     meridian's direction there and the scale within 6% of the printed one; five rounds.
  4. Coombsville draws its roads too faintly for that: its boundary fit again, with the rotation
     fixed at the meridian convergence there (+0.34°, as the other seven maps' road fits came out)
     and the scale free within 4%.
"""
import importlib.util, json, math, os, random, sys
import numpy as np
from scipy import ndimage, optimize

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('build_vinous', os.path.join(HERE, 'build-vinous.py'))
bv = importlib.util.module_from_spec(spec); spec.loader.exec_module(bv)
OVERTURE = os.path.join(HERE, '.cache', 'overture', '2026-10-21.0')
UPM, POINT = bv.UPM, 0.0254 / 72   # view units a metre; metres of paper a point
ROAD_CLASSES = ('motorway', 'trunk', 'primary', 'secondary', 'tertiary')


def densify(lines, step):   # points every `step` view units along lines of [lon, lat]
    pts = []
    for line in lines:
        X, Y = bv.project(np.array(line)[:, 0], np.array(line)[:, 1])
        Q = np.column_stack([X, Y])
        for a, b in zip(Q[:-1], Q[1:]):
            n = max(1, int(np.hypot(*(b - a)) / step))
            pts.append(a + (b - a) * (np.arange(n) / n)[:, None])
    return np.vstack(pts)


def rings(geom):
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    return [ring for poly in polys for ring in poly]


def lines_of(geom):
    return [geom['coordinates']] if geom['type'] == 'LineString' else geom['coordinates'] if geom['type'] == 'MultiLineString' else []


def lake_mask(rgb):   # the largest patch of the pale blue of lakes
    a = rgb.astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    blue = ndimage.binary_opening((b > 200) & (b - r > 25) & (g > 170) & (b - g > 5), iterations=2)
    lab, n = ndimage.label(blue)
    return lab == 1 + int(np.argmax(ndimage.sum(blue, lab, range(1, n + 1))))


def road_mask(rgb):   # Vinous's main roads, orange and yellow, where they are thin
    a = rgb.astype(np.int16); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = ((r > 200) & (g > 100) & (g < 190) & (b < 80)) | ((r > 200) & (g > 180) & (b < 100))
    return m & ~ndimage.binary_opening(m, iterations=3)


def edge_distance(mask):
    return ndimage.distance_transform_edt(~(mask ^ ndimage.binary_erosion(mask)))


def to_svg(q, pts):   # q = [log scale, rotation, tx, ty]; view units -> SVG units
    s, c, si = math.exp(q[0]), math.cos(q[1]), math.sin(q[1])
    X, Y = pts[:, 0] - q[2], pts[:, 1] - q[3]
    return (c * X + si * Y) / s, (-si * X + c * Y) / s


def cost(q, pts, dist, cap):
    u, v = to_svg(q, pts)
    h, w = dist.shape
    ok = (u >= 0) & (v >= 0) & (u < w - 1) & (v < h - 1)
    d = np.full(u.shape, float(cap))
    d[ok] = np.minimum(dist[v[ok].astype(int), u[ok].astype(int)], cap)
    return float(d.mean())


def boundary_fit(pts, dist, mask, s, th=0.0, spread_m=3000, step_m=100, free=0.015):
    vy, vx = np.nonzero(mask)
    cu, cv = vx.mean(), vy.mean()
    c, si = math.cos(th), math.sin(th)
    tx0, ty0 = pts[:, 0].mean() - s * (c * cu - si * cv), pts[:, 1].mean() - s * (si * cu + c * cv)
    sp, st = spread_m * UPM, step_m * UPM
    best = min(([math.log(s), th, tx0 + dx, ty0 + dy] for dx in np.arange(-sp, sp + st / 2, st) for dy in np.arange(-sp, sp + st / 2, st)),
               key=lambda q: cost(q, pts, dist, 40))
    for cap in (25, 12):
        r = optimize.minimize(lambda t: cost([best[0], th, t[0], t[1]], pts, dist, cap), best[2:], method='Nelder-Mead',
                              options={'xatol': 1e-7, 'fatol': 1e-6, 'maxiter': 3000})
        best = [best[0], th, r.x[0], r.x[1]]
    ls0 = best[0]
    r = optimize.minimize(lambda t: cost([t[0], th, t[1], t[2]], pts, dist, 12) + (0 if abs(t[0] - ls0) < free else 1e3),
                          [best[0], best[2], best[3]], method='Nelder-Mead', options={'xatol': 1e-8, 'fatol': 1e-6, 'maxiter': 4000})
    return [r.x[0], th, r.x[1], r.x[2]]


def refine_joint(q0, pts, dist, rp, rdist, s_printed, reach_m=200):
    reach = reach_m * UPM
    best = list(q0)
    for rcap, bcap in ((30, 20), (15, 12), (8, 12), (5, 12)):
        b0 = cost(best, pts, dist, bcap) or 1e-9
        r0 = cost(best, rp, rdist, rcap) or 1e-9
        def f(q):
            if abs(q[0] - math.log(s_printed)) > 0.02 or abs(q[1]) > math.radians(1) or math.hypot(q[2] - q0[2], q[3] - q0[3]) > reach: return 1e3
            return cost(q, pts, dist, bcap) / b0 + cost(q, rp, rdist, rcap) / r0
        for _ in range(2):
            best = list(optimize.minimize(f, best, method='Nelder-Mead', options={'xatol': 1e-9, 'fatol': 1e-8, 'maxiter': 8000}).x)
    return best


def on_road(q, rp, rdist, within=2):   # the share of road points within 2 pixels of Vinous's roads
    u, v = to_svg(q, rp)
    h, w = rdist.shape
    ok = (u >= 0) & (v >= 0) & (u < w - 1) & (v < h - 1)
    return float((rdist[v[ok].astype(int), u[ok].astype(int)] <= within).mean()) if ok.any() else 0.0


def similarity(C, idx):   # X = a u - b v + tx, Y = b u + a v + ty, by least squares
    u, v, X, Y = C[idx, 0], C[idx, 1], C[idx, 2], C[idx, 3]
    n = len(idx)
    A = np.zeros((2 * n, 4)); y = np.zeros(2 * n)
    A[0::2] = np.column_stack([u, -v, np.ones(n), np.zeros(n)]); y[0::2] = X
    A[1::2] = np.column_stack([v, u, np.zeros(n), np.ones(n)]); y[1::2] = Y
    return np.linalg.lstsq(A, y, rcond=None)[0]


def residual(C, g):   # metres
    a, b, tx, ty = g
    return np.hypot(a * C[:, 0] - b * C[:, 1] + tx - C[:, 2], b * C[:, 0] + a * C[:, 1] + ty - C[:, 3]) / UPM


def road_cells(g, P, region, rdist, reach_m=240):
    """Control points under the similarity g: per 1.5 km cell of the drawn area, the shift that lays
    the road points P (view units) best on Vinous's roads, as (u, v, X, Y) with u, v the SVG point."""
    h, w = region.shape
    a, b, tx, ty = g
    det = a * a + b * b
    X, Y = P[:, 0] - tx, P[:, 1] - ty
    U, V = (a * X + b * Y) / det, (-b * X + a * Y) / det
    ok = (U > 0) & (V > 0) & (U < w - 1) & (V < h - 1)
    ok[ok] = region[V[ok].astype(int), U[ok].astype(int)]
    Uk, Vk, Xk, Yk = U[ok], V[ok], P[ok, 0], P[ok, 1]
    s = math.sqrt(det)
    cell = 1500 * UPM / s
    out = []
    for cu in np.arange(Uk.min(), Uk.max() + cell, cell):
        for cv in np.arange(Vk.min(), Vk.max() + cell, cell):
            sel = (Uk >= cu) & (Uk < cu + cell) & (Vk >= cv) & (Vk < cv + cell)
            if sel.sum() < 150: continue
            u, v = Uk[sel], Vk[sel]
            best = None
            for reach, step in ((reach_m, max(8, reach_m // 30)), (12, 1)):   # coarse, then fine round the coarse best
                R0, st = reach * UPM / s, step * UPM / s
                c0 = (0.0, 0.0) if best is None else (best[1], best[2])
                for du in np.arange(c0[0] - R0, c0[0] + R0 + 1e-9, st):
                    for dv in np.arange(c0[1] - R0, c0[1] + R0 + 1e-9, st):
                        ui, vi = (u + du).astype(int), (v + dv).astype(int)
                        inb = (ui >= 0) & (vi >= 0) & (ui < w) & (vi < h)
                        d = np.full(u.shape, 8.0); d[inb] = np.minimum(rdist[vi[inb], ui[inb]], 8.0)
                        f = d.mean()
                        if best is None or f < best[0]: best = (f, du, dv, (d <= 2).mean())
            f, du, dv, hit = best
            if hit >= 0.35: out.append((u.mean() + du, v.mean() + dv, Xk[sel].mean(), Yk[sel].mean()))
    return np.array(out)


def north(X, Y):   # the rotation that puts a map's up on the meridian at view point X, Y
    lon, lat = bv.unproject(X, Y)
    x1, y1 = bv.project(lon, lat); x2, y2 = bv.project(lon, lat + 0.01)
    return math.atan2(float(x2 - x1), float(y1 - y2))


def road_fit(q, P, region, rdist, s_printed, reach_m=(600, 240, 120, 120, 120)):
    g = [math.exp(q[0]) * math.cos(q[1]), math.exp(q[0]) * math.sin(q[1]), q[2], q[3]]
    h, w = region.shape
    th0 = north(g[0] * w / 2 - g[1] * h / 2 + g[2], g[1] * w / 2 + g[0] * h / 2 + g[3])
    def plausible(m):
        return abs(math.atan2(m[1], m[0]) - th0) < math.radians(1.5) and abs(math.hypot(m[0], m[1]) / s_printed - 1) < 0.06
    note = None
    for it, reach in enumerate(reach_m):
        C = road_cells(g, P, region, rdist, reach)
        if len(C) < 3: break
        random.seed(it)
        best = None
        for _ in range(500):
            idx = random.sample(range(len(C)), 2)
            if math.hypot(C[idx[0], 2] - C[idx[1], 2], C[idx[0], 3] - C[idx[1], 3]) < 1500 * UPM: continue   # too close for a scale
            m = similarity(C, idx)
            if not plausible(m): continue
            inl = residual(C, m) < 15
            if best is None or inl.sum() > best.sum(): best = inl
        if best is None or best.sum() < 3: break
        m = list(similarity(C, np.nonzero(best)[0]))
        if not plausible(m): break
        g = m
        r = residual(C, g)
        note = f'{best.sum()} of {len(C)} cells agree, residual median {np.median(r[best]):.1f} m, max {r[best].max():.1f} m'
    return g, note


def main():
    bv.VINOUS_DIR = os.environ.get('VINOUS_DIR')
    if not bv.VINOUS_DIR or not os.path.isdir(bv.VINOUS_DIR): sys.exit('VINOUS_DIR: the folder of Vinous\'s Napa SVGs')
    os.makedirs(bv.CACHE, exist_ok=True)
    check = '--check' in sys.argv
    only = set(a for a in sys.argv[1:] if a != '--check')
    G = json.load(open(bv.GEOREF, encoding='utf-8'))
    avas = {f['properties']['name']: f['geometry'] for f in json.load(open(bv.AVAS))['features'] if not f['properties'].get('valid_end')}
    water = json.load(open(os.path.join(OVERTURE, 'napa-water.geojson')))['features']
    roads = [f['geometry'] for f in json.load(open(os.path.join(OVERTURE, 'napa-roads.geojson')))['features'] if f['properties']['class'] in ROAD_CLASSES]
    P = densify([ln for g in roads for ln in lines_of(g)], 5 * UPM)   # main roads, a point every 5 m
    for m in G['maps']:
        if only and m['id'] not in only: continue
        rgb = bv.drawing(m, 1)
        region = bv.region_mask(rgb)
        s = m['printed'] * POINT * UPM
        if m['ava']:
            pts = densify(rings(avas[m['ava']]), 15 * UPM); dist = edge_distance(region)
        else:
            lake = next(f for f in water if (f['properties'].get('name') or '') == 'Lake Hennessey')
            pts = densify(rings(lake['geometry'])[:1], 15 * UPM); dist = edge_distance(lake_mask(rgb))
        if m['id'] == 'coombsville':
            th = math.radians(0.34)
            fits = [boundary_fit(pts, dist, region, s * k, th, spread_m=600, step_m=40) for k in np.linspace(0.97, 1.04, 15)]
            q = min(fits, key=lambda q: cost(q, pts, dist, 12))
            r = optimize.minimize(lambda t: cost([t[0], th, t[1], t[2]], pts, dist, 12), [q[0], q[2], q[3]], method='Nelder-Mead',
                                  options={'xatol': 1e-9, 'fatol': 1e-8, 'maxiter': 6000})
            q = [r.x[0], th, r.x[1], r.x[2]]
            g = [math.exp(q[0]) * math.cos(th), math.exp(q[0]) * math.sin(th), q[2], q[3]]
            note = 'its AVA boundary onto the edge of what the map draws, rotation fixed at the meridian convergence (its roads are too faint to place it)'
        elif check:   # from the saved fit
            q = [math.log(m['scale']), m['rotation'], m['tx'], m['ty']]
            g, note = road_fit(q, P, region, ndimage.distance_transform_edt(~road_mask(rgb)), s, reach_m=(120, 60, 60))
            if note is None: sys.exit(f'{m["id"]}: too few roads to place it')
        else:
            q = boundary_fit(pts, dist, region, s)
            rdist = ndimage.distance_transform_edt(~road_mask(rgb))
            u, v = to_svg(q, P)   # the road points over what the map draws
            near = ndimage.binary_dilation(region, iterations=10)
            ok = (u >= 0) & (v >= 0) & (u < region.shape[1]) & (v < region.shape[0])
            ok[ok] = near[v[ok].astype(int), u[ok].astype(int)]
            q2 = refine_joint(q, pts, dist, P[ok], rdist, s)
            if on_road(q2, P[ok], rdist) > on_road(q, P[ok], rdist): q = q2
            g, note = road_fit(q, P, region, rdist, s)
            if note is None: sys.exit(f'{m["id"]}: too few roads to place it')
            note = 'OpenStreetMap main roads onto the map’s, per 1.5 km cell, similarity by RANSAC: ' + note
        sc, rot = math.hypot(g[0], g[1]), math.atan2(g[1], g[0])
        if check:   # how far the saved fit's corners would move
            h, w = region.shape
            ys, xs = np.nonzero(region)
            corners = np.array([[xs.min(), ys.min()], [xs.max(), ys.min()], [xs.min(), ys.max()], [xs.max(), ys.max()]], float)
            a0, b0 = m['scale'] * math.cos(m['rotation']), m['scale'] * math.sin(m['rotation'])
            d = [math.hypot((g[0] - a0) * u - (g[1] - b0) * v + g[2] - m['tx'], (g[1] - b0) * u + (g[0] - a0) * v + g[3] - m['ty']) / UPM for u, v in corners]
            print(f'{m["id"]:16} would move {min(d):.1f} to {max(d):.1f} m; {note}', flush=True)
            continue
        m.update({'scale': round(sc, 12), 'rotation': round(rot, 10), 'tx': round(g[2], 8), 'ty': round(g[3], 8),
                  'metres_per_unit': round(sc / UPM, 4), 'fit': note})
        print(f'{m["id"]:16} {sc / UPM:.4f} m a point ({sc / s:.4f} of the printed scale), rotation {math.degrees(rot):+.2f}°; {note}', flush=True)
    if not check: open(bv.GEOREF, 'w', encoding='utf-8').write(json.dumps(G, indent=1, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main()
