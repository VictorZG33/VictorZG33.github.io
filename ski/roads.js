// 上山 First Chair: the Caltrans and CHP feeds behind the page's Roads tab, cut down to the mountain
// highways. The page at /ski/ and the Worker in workers/ski-roads both import this file. The Worker
// fetches the feeds and sends the page only what this file keeps, a few kilobytes instead of the
// three megabytes Caltrans serves uncompressed; when the Worker can't be reached, the page fetches the
// Caltrans files itself (they allow it) and keeps the same. CHP's incidents and Caltrans' road text
// don't allow a page on another site to read them, so those come only through the Worker.
// There is no DOM in here, so node can run it.

// The highways the resorts' drives use, as Caltrans writes them, and the Caltrans districts that report
// them: District 3 (Marysville) for I-80, US-50, SR-89, SR-267 and SR-28, District 10 (Stockton) for SR-88.
export const ROUTES = ['I-80', 'US-50', 'SR-89', 'SR-267', 'SR-28', 'SR-88'];
export const DISTRICTS = [3, 10];
// The same highways as the road conditions page numbers them
export const ROAD_NUMBERS = ['80', '50', '89', '267', '28', '88'];
// Only the mountains: from the foothills at Auburn and Shingle Springs up to the Nevada line, north of
// Markleeville and south of Sierraville
const BOX = { south: 38.3, north: 39.45, west: -121.1, east: -119.75 };
const inBox = (lat, lon) => lat >= BOX.south && lat <= BOX.north && lon >= BOX.west && lon <= BOX.east;

// The CHP dispatch centres whose incidents can be on the way: Truckee covers the mountains,
// Sacramento the foothills
export const CHP_CENTERS = ['TKCC', 'SACC'];

export const caltransUrl = (kind, d) => `https://cwwp2.dot.ca.gov/data/d${d}/${kind}/${kind}StatusD${String(d).padStart(2, '0')}.json`;
// CHP's incidents come two ways: CHP's own feed, and the copy Caltrans' QuickMap draws its CHP
// Incidents layer from. CHP's sits behind a firewall that doesn't answer Cloudflare, so the Worker
// reads QuickMap's first.
export const CHP_URL = 'https://media.chp.ca.gov/sa_xml/sa.xml';
export const CHP_KML_URL = 'https://quickmap.dot.ca.gov/data/chp-only.kml';
export const roadsUrl = (n) => `https://roads.dot.ca.gov/?roadnumber=${n}`;

// Caltrans and CHP write Pacific time without saying whether it is standard or daylight time.
// Daylight time runs from 2:00 on the second Sunday of March to 2:00 on the first Sunday of November.
function sunday(y, month, n) {
  const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay();
  return 1 + ((7 - first) % 7) + (n - 1) * 7;
}
export function pacificMs(y, mo, d, h = 0, mi = 0, s = 0) {
  let pdt = mo > 3 && mo < 11;
  if (mo === 3) { const k = sunday(y, 3, 2); pdt = d > k || (d === k && h >= 2); }
  if (mo === 11) { const k = sunday(y, 11, 1); pdt = d < k || (d === k && h < 2); }
  return Date.UTC(y, mo - 1, d, h, mi, s) + (pdt ? 7 : 8) * 3600e3;
}
// '2026-11-17' and '08:39:34'
function caltransMs(date, time) {
  const a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || ''), b = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time || '');
  return a && b ? pacificMs(+a[1], +a[2], +a[3], +b[1], +b[2], +(b[3] || 0)) : null;
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// CHP's 'Nov 17 2026  6:11PM'
function chpMs(s) {
  const m = /^([A-Za-z]{3})\w*\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP])M$/i.exec((s || '').trim());
  if (!m || !MONTHS[m[1].toLowerCase()]) return null;
  const h = (+m[4] % 12) + (m[6].toUpperCase() === 'P' ? 12 : 0);
  return pacificMs(+m[3], MONTHS[m[1].toLowerCase()], +m[2], h, +m[5]);
}
// The road conditions page's 'Wednesday, November 18th, 2026 at 05:52 AM'
function roadsMs(s) {
  const m = /([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP])M/i.exec(s || '');
  const mo = m && MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!mo) return null;
  return pacificMs(+m[3], mo, +m[2], (+m[4] % 12) + (m[6].toUpperCase() === 'P' ? 12 : 0), +m[5]);
}

// How much a chain control status asks of an ordinary car, from Caltrans' Chain Control Status Chart:
// 0 nothing, 1 watch for snow, 2 metering (delays), 3 R-1, 4 R-2 or escorts, 5 R-3 or all traffic held,
// 6 closed. The truck-only statuses (truck screening, turnarounds, R-1 Modified for trailers) rank 0.5:
// they leave cars alone but say there is snow on the road.
const RANK = { 'R-0': 0, 'NOT REPORTED': 0, W: 1, VM: 2, 'R-1': 3, 'R-2': 4, ESC: 4, 'R-3': 5, HT: 5, RC: 6, 'ROAD CLOSED': 6 };
const TRUCKS = ['R-1 MODIFIED', 'TS', 'TH', 'TTA', 'TTS', 'TTSD', 'MIN', 'MAX'];
export function chainRank(status) {
  const s = String(status || '').trim().toUpperCase();
  if (s in RANK) return RANK[s];
  if (TRUCKS.includes(s)) return 0.5;
  return 0;
}

// Chain control checkpoints: one entry per checkpoint and direction. Caltrans lists a checkpoint once
// for each control it can set there (Applegate has four), so the most demanding status stands for it.
export function keepChains(json) {
  const by = new Map();
  for (const item of (json && json.data) || []) {
    const c = item && item.cc;
    if (!c || c.inService !== 'true') continue;
    const L = c.location || {}, S = c.statusData || {}, T = S.statusTimestamp || {};
    const lat = +L.latitude, lon = +L.longitude;
    if (!ROUTES.includes(L.route) || !inBox(lat, lon)) continue;
    const status = String(S.status || '').trim();
    const row = {
      route: L.route, county: L.county, pm: +L.postmile || 0, dir: L.direction || '',
      name: L.locationName || '', place: L.nearbyPlace || '', lat, lon, elev: Math.round(+L.elevation) || null,
      status, text: String(S.statusDescription || '').trim(), at: caltransMs(T.statusDate, T.statusTime),
    };
    const key = [row.route, row.county, row.pm, row.dir, row.name].join('|');
    const had = by.get(key);
    if (!had) { row.id = c.index; row.also = []; by.set(key, row); continue; }
    if (chainRank(status) > chainRank(had.status)) {
      if (had.status && !had.also.includes(had.status)) had.also.push(had.status);
      Object.assign(had, { status, text: row.text, at: row.at });
    } else if (status && status !== had.status && !had.also.includes(status)) had.also.push(status);
  }
  return [...by.values()];
}

// The road cameras that work, each with its picture (renewed about once a minute) and its video, if any
export function keepCams(json) {
  const out = [];
  for (const item of (json && json.data) || []) {
    const c = item && item.cctv;
    if (!c || c.inService !== 'true') continue;
    const L = c.location || {}, I = c.imageData || {};
    const lat = +L.latitude, lon = +L.longitude;
    const img = I.static && I.static.currentImageURL;
    if (!ROUTES.includes(L.route) || !inBox(lat, lon) || !img) continue;
    out.push({
      id: c.index, route: L.route, county: L.county, pm: +L.postmile || 0, dir: L.direction || '',
      name: L.locationName || '', place: L.nearbyPlace || '', lat, lon, elev: Math.round(+L.elevation) || null,
      img, video: I.streamingVideoURL || '',
    });
  }
  return out;
}

// Lane closures on the highways themselves (not ramps, rest areas or side streets) that are on now or
// start within the next day and a half. Caltrans marks a closure 10-97 once the crew has set it up,
// 10-98 once they have picked it up and 10-22 if it was called off.
export function keepClosures(json, now = Date.now()) {
  const out = [];
  for (const item of (json && json.data) || []) {
    const x = item && item.lcs;
    if (!x || !x.closure || !x.location) continue;
    const c = x.closure, b = x.location.begin || {}, e = x.location.end || {}, t = c.closureTimestamp || {};
    const lat = +b.beginLatitude, lon = +b.beginLongitude;
    if (!ROUTES.includes(b.beginRoute) || !inBox(lat, lon)) continue;
    if (c.facility !== 'Mainline' && c.facility !== 'Conventional Hwy') continue;
    if ((c.code1022 && c.code1022.isCode1022 === 'true') || (c.code1098 && c.code1098.isCode1098 === 'true')) continue;
    const start = +t.closureStartEpoch * 1000 || null;
    const end = t.isClosureEndIndefinite === 'true' ? null : +t.closureEndEpoch * 1000 || null;
    if ((end && end < now) || !start || start > now + 36 * 3600e3) continue;
    out.push({
      id: x.index, route: b.beginRoute, county: b.beginCounty, pm: +b.beginPostmile || 0, pm2: +e.endPostmile || 0,
      dir: x.location.travelFlowDirection || '', from: b.beginLocationName || '', to: e.endLocationName || '',
      lat, lon, lat2: +e.endLatitude || lat, lon2: +e.endLongitude || lon,
      type: c.typeOfClosure || '', work: c.typeOfWork || '', lanes: c.lanesClosed || '', of: c.totalExistingLanes || '',
      start, end, on: !!(c.code1097 && c.code1097.isCode1097 === 'true'), delay: c.estimatedDelay || '',
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

const unxml = (s) => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const field = (block, tag) => {
  const m = new RegExp('<' + tag + '>\\s*"?([\\s\\S]*?)"?\\s*</' + tag + '>').exec(block);
  return m ? unxml(m[1]).replace(/\s+/g, ' ').trim() : '';
};

// CHP's statewide incident feed, for the given dispatch centres. Only what an incident is, where and
// when: the dispatchers' running notes, which can carry licence plates and callers' details, are left
// out; only their count and the time of the latest are kept.
export function parseChp(xml, centers = CHP_CENTERS) {
  const out = [];
  const re = /<Dispatch\s+ID\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/Dispatch>/g;
  let d;
  while ((d = re.exec(xml || ''))) {
    if (!centers.includes(d[1])) continue;
    const logs = /<Log\s+ID\s*=\s*"([^"]+)"\s*>([\s\S]*?)<\/Log>/g;
    let l;
    while ((l = logs.exec(d[2]))) {
      const block = l[2];
      const ll = /^(\d{6,9}):(\d{6,9})$/.exec(field(block, 'LATLON'));
      const times = [...block.matchAll(/<DetailTime>\s*"?([^<"]*)"?\s*<\/DetailTime>/g)].map((m) => chpMs(m[1])).filter(Boolean);
      out.push({
        id: l[1], center: d[1], at: chpMs(field(block, 'LogTime')), type: field(block, 'LogType'),
        where: field(block, 'Location'), desc: field(block, 'LocationDesc'), area: field(block, 'Area'),
        lat: ll ? +ll[1] / 1e6 : null, lon: ll ? -ll[2] / 1e6 : null,
        notes: times.length, last: times.length ? Math.max(...times) : null,
      });
    }
  }
  return out;
}

// The same incidents from QuickMap's KML, for the same dispatch centres, in the same shape. Each
// placemark is one incident: its log number (YYMMDD, then the centre's two letters, as 261118TK0012),
// what it is, when it started and where, and the dispatchers' notes, of which again only the count and
// the latest time are kept. QuickMap doesn't give CHP's area or location notes.
export function parseChpKml(kml, centers = CHP_CENTERS) {
  const out = [];
  const codes = centers.map((c) => c.slice(0, 2));
  // split, and a look at the log number before any other parsing, keep this well inside the 10 ms of CPU
  // a Worker request may use on the free plan: there are some 300 incidents statewide
  for (const chunk of String(kml || '').split('<Placemark>').slice(1)) {
    const at = chunk.indexOf('CHP Incident ');
    if (at < 0 || !codes.includes(chunk.slice(at + 19, at + 21))) continue;
    const p = chunk.slice(0, chunk.indexOf('</Placemark>') >>> 0);
    const id = (/CHP Incident\s+(\d{6}([A-Z]{2})\d+)/.exec(p) || [])[1];
    if (!id || !codes.includes(id.slice(6, 8))) continue;
    const texts = [...p.matchAll(/<p class="iw-text">([\s\S]*?)<\/p>/g)].map((t) => t[1]);
    const head = (texts[0] || '').split(/<br\s*\/?>/i).map((s) => unxml(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim());
    const notes = (texts[1] || '').split(/<br\s*\/?>/i).map((s) => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    const times = notes.map((s) => chpMs((/^([A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]M)/i.exec(s) || [])[1])).filter(Boolean);
    const ll = /<coordinates>\s*(-?\d+\.\d+),(-?\d+\.\d+)/.exec(p);
    out.push({
      id, center: id.slice(6, 8) + 'CC', at: chpMs(head[0]),
      type: unxml((/<h2 class="iw-title">([\s\S]*?)<\/h2>/.exec(p) || [])[1] || '').replace(/\s+/g, ' ').trim(),
      where: head.slice(1).join(' ').trim(), desc: '', area: '',
      lat: ll ? +ll[2] : null, lon: ll ? +ll[1] : null,
      notes: notes.length, last: times.length ? Math.max(...times) : null,
    });
  }
  return out;
}

// What kind of CHP incident a log is, for the page: 'closure' for a road closed or a SigAlert, 'info'
// for the notices that are only about conditions or crews (snow, chain control, wind, fog, escorts,
// construction and maintenance), 'skip' for logs that aren't about the road at all, else 'incident'.
export function chpKind(type) {
  const t = String(type || '').toUpperCase();
  if (/^CLOSURE|SIG ?ALERT/.test(t)) return 'closure';
  if (/^(SNOW|CHAINS|WIND|FOG|1013|TADV|ESCORT|CZP|MZP|ASSIST|DUST|SMOKE|INFO)/.test(t)) return 'info';
  if (/^(SILVER|AMBER|BLUE|FEATHER|EWARN|MEDIA|ADMIN|TEST|SPECIAL|SHOOTING|LAW|PURSUIT)/.test(t)) return 'skip';
  return 'incident';
}

// Caltrans' road conditions page for one highway: when it was last brought up to date, and each of its
// statements under the area heading it falls in. 'No traffic restrictions are reported' becomes no
// statements at all.
export function parseRoads(html) {
  const s = String(html || '');
  const asofText = (/latest reported as of\s+([^<]+?)\.?\s*<\/em>/i.exec(s) || [])[1] || '';
  const routes = {};
  const parts = s.split(/<h3>\s*/i).slice(1);
  for (const part of parts) {
    const head = /^(I|US|SR)\s+(\d+)\s*<\/h3>/i.exec(part);
    if (!head) continue;
    const body = part.slice(head[0].length).split(/<hr\b|<\/main>/i)[0];
    const items = [];
    let area = '';
    for (const p of body.split(/<p\b[^>]*>/i).slice(1)) {
      let text = p.split(/<\/p>/i)[0];
      const a = /<strong>\s*\[([^\]]+)\]\s*<\/strong>\s*(<br\s*\/?>)?/i.exec(text);
      if (a) { area = a[1].trim(); text = text.slice(a.index + a[0].length); }
      text = unxml(text.replace(/<[^>]+>/g, ' ')).replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text || /^no traffic restrictions are reported/i.test(text)) continue;
      items.push({ area, text });
    }
    routes[head[2]] = items;
  }
  return { asof: roadsMs(asofText), asofText, routes };
}

// The counties a statement names, from Caltrans' '(Placer Co)' and '(San Francisco,Alameda Co)'
export function countiesOf(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/\(([^()]*?)\s+Cos?\)/g)) {
    for (const c of m[1].split(/,|\band\b/)) if (c.trim()) out.push(c.trim());
  }
  return out;
}
