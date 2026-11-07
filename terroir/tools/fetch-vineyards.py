#!/usr/bin/env python3
"""Fetches the open data behind the vineyard maps of 风土 Terroir (terroir/index.html):

  - from the Overture Maps Foundation's GeoParquet release on Amazon S3, read by bounding box
    with DuckDB: the vineyards (Overture's land use, which is OpenStreetMap's landuse=vineyard,
    ODbL), the roads and waterways (also OpenStreetMap's, ODbL), and wineries from its places,
    only records whose every source is CDLA Permissive 2.0 (Meta, BrightQuery, Microsoft),
    named, open and at least 0.9 sure of themselves;
  - from Wikidata (CC0), the wineries it places, which build-appellations.mjs trusts over
    Overture's: places data puts a winery at its owner's office as readily as at its estate.

Each area in AREAS is written to .cache/overture/<release>/<area>-<layer>.geojson, which git
ignores; build-appellations.mjs draws them. Once, in this folder:

  python3 -m venv .venv && .venv/bin/pip install duckdb==1.4.1
  .venv/bin/python fetch-vineyards.py

It reads only the row groups that overlap each area, a few hundred MB for Napa, in about a minute.
"""
import json, os, sys, urllib.parse, urllib.request
import duckdb

RELEASE = '2026-10-21.0'
# xmin, ymin, xmax, ymax in degrees: the Napa Valley AVA, with a margin (the build clips to the AVA)
AREAS = {'napa': (-122.65, 38.15, -122.06, 38.87)}
ROADS = ('motorway', 'trunk', 'primary', 'secondary', 'tertiary')
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '.cache', 'overture', RELEASE)
S3 = f's3://overturemaps-us-west-2/release/{RELEASE}'

con = duckdb.connect()
for ext in ('httpfs', 'spatial'):
    con.install_extension(ext)
    con.load_extension(ext)
# behind an HTTPS proxy, as in a sandbox; DuckDB wants host:port
def quote(s): return "'" + s.replace("'", "''") + "'"
if os.environ.get('HTTPS_PROXY'):
    con.execute('SET http_proxy = ' + quote(os.environ['HTTPS_PROXY'].split('://')[-1].rstrip('/')))
if os.environ.get('SSL_CERT_FILE'):
    con.execute('SET ca_cert_file = ' + quote(os.environ['SSL_CERT_FILE']))
# the bucket is public: ask without credentials, even if some are set for other things
con.execute("CREATE SECRET overture (TYPE s3, PROVIDER config, KEY_ID '', SECRET '', REGION 'us-west-2', SCOPE 's3://overturemaps-us-west-2')")


def table(theme, kind):
    return f"read_parquet('{S3}/theme={theme}/type={kind}/*', hive_partitioning = 1)"


def write(area, layer, sql, params):
    rows = con.execute(sql, params).fetchall()
    cols = [d[0] for d in con.description]
    feats = []
    for row in rows:
        r = dict(zip(cols, row))
        geom = json.loads(r.pop('geom'))
        feats.append({'type': 'Feature', 'geometry': geom, 'properties': r})
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{area}-{layer}.geojson')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'release': RELEASE, 'features': feats}, f, ensure_ascii=False)
    print(f'{area:6} {layer:10} {len(feats):6} features  {os.path.getsize(path) / 1e6:6.1f} MB')


for area, (x0, y0, x1, y1) in AREAS.items():
    box = 'bbox.xmin > ? AND bbox.xmax < ? AND bbox.ymin > ? AND bbox.ymax < ?'
    p = [x0, x1, y0, y1]
    write(area, 'vineyards', f"""
        SELECT names.primary AS name, sources[1].record_id AS osm, ST_AsGeoJSON(geometry) AS geom
        FROM {table('base', 'land_use')}
        WHERE {box} AND class = 'vineyard' AND ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON')""", p)
    write(area, 'wineries', f"""
        SELECT names.primary AS name, round(confidence, 3) AS confidence, sources[1].dataset AS dataset, ST_AsGeoJSON(geometry) AS geom
        FROM {table('places', 'place')}
        WHERE {box} AND taxonomy.primary = 'winery' AND confidence >= 0.9 AND names.primary IS NOT NULL
          AND coalesce(operating_status, 'open') <> 'permanently_closed'
          AND len(list_filter(sources, s -> s.license IS DISTINCT FROM 'CDLA-Permissive-2.0')) = 0""", p)
    write(area, 'roads', f"""
        SELECT class, names.primary AS name, ST_AsGeoJSON(geometry) AS geom
        FROM {table('transportation', 'segment')}
        WHERE {box} AND subtype = 'road' AND class IN {ROADS}""", p)
    write(area, 'water', f"""
        SELECT subtype, names.primary AS name, ST_AsGeoJSON(geometry) AS geom
        FROM {table('base', 'water')}
        WHERE {box} AND (subtype = 'river' OR (subtype = 'stream' AND names.primary IS NOT NULL)
          OR (subtype IN ('lake', 'reservoir') AND ST_GeometryType(geometry) IN ('POLYGON', 'MULTIPOLYGON')))""", p)
    # Wikidata's wineries in the same box (instances of winery, Q156362, or of a kind of winery)
    q = ('SELECT ?item ?name ?coord WHERE { SERVICE wikibase:box { ?item wdt:P625 ?coord . '
         f'bd:serviceParam wikibase:cornerSouthWest "Point({x0} {y0})"^^geo:wktLiteral . '
         f'bd:serviceParam wikibase:cornerNorthEast "Point({x1} {y1})"^^geo:wktLiteral . }} '
         '?item wdt:P31/wdt:P279* wd:Q156362 . ?item rdfs:label ?name FILTER(LANG(?name) = "en") }')
    req = urllib.request.Request('https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': q}),
                                 headers={'Accept': 'application/sparql-results+json', 'User-Agent': 'terroir-map-build/1.0 (https://wentaoz.com/terroir/)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        rows = json.load(r)['results']['bindings']
    seen, feats = set(), []
    for b in rows:
        qid = b['item']['value'].rsplit('/', 1)[-1]
        if qid in seen: continue   # an item with two positions keeps its first
        seen.add(qid)
        lon, lat = map(float, b['coord']['value'][len('Point('):-1].split())
        feats.append({'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}, 'properties': {'name': b['name']['value'], 'wikidata': qid}})
    path = os.path.join(OUT, f'{area}-wikidata.geojson')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f, ensure_ascii=False)
    print(f'{area:6} {"wikidata":10} {len(feats):6} features')
sys.exit(0)
