/* ---------------------------------------------------------------
 * Moon sidereal-constellation engine
 * Shared by the calendar (wine-moon/index.html) and the Wine Moon card
 * on the homepage (index.html).
 *  - Moon position: Meeus, Astronomical Algorithms (2nd ed.) ch. 47
 *    (ELP-2000/82 truncated series, ~10" in longitude)
 *  - "Sidereal" longitude = longitude referred to the J2000.0 ecliptic
 *    & equinox (mean-of-date longitude minus general precession p_A),
 *    so that IAU constellation boundaries, fixed on the sky, stay fixed
 *  - Constellation boundaries: IAU (Delporte 1930) boundaries where they
 *    cross the J2000 ecliptic; Ophiuchus stretch counted as Scorpio
 *    (Maria Thun convention: 12 unequal constellations)
 * --------------------------------------------------------------- */
var WineMoon = (function () {
  'use strict';
  var RAD = Math.PI / 180;
  function norm(d) { d = d % 360; return d < 0 ? d + 360 : d; }

  // Table 47.A: D, M, M', F, Σl (1e-6 deg), Σr (1e-3 km)
  var TL = [
    [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],
    [0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],
    [2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
    [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
    [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],
    [0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],
    [4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],
    [1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
    [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],
    [0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],
    [1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],
    [0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
    [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
    [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],
    [0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],
    [2,-1,0,-2,596,0],[4,0,1,0,549,-1423],[0,0,4,0,537,-1117],
    [4,-1,0,0,520,-1571],[1,0,-2,0,-487,-1739],[2,1,0,-2,-399,0],
    [0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],
    [4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],
    [1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]
  ];
  // Table 47.B: D, M, M', F, Σb (1e-6 deg)
  var TB = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
    [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
    [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
    [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
    [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
    [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
    [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
    [4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],
    [2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
    [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],
    [2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],
    [0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
    [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],
    [0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],
    [4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]
  ];

  // ΔT (TT − UT1), seconds. Flat ~69 s through the 2020s; fine for the Moon
  // (1 s of time ≈ 0.55" of lunar motion).
  function deltaT(jdUT) {
    var y = 2000 + (jdUT - 2451545.0) / 365.25;
    if (y < 2005) return 64.7 + (y - 2005) * 0.3;
    if (y < 2030) return 69.2 + (y - 2020) * 0.1;
    return 70.2 + (y - 2030) * 0.4;
  }

  function jdFromDate(d) { return d.getTime() / 86400000 + 2440587.5; }
  function dateFromJd(jd) { return new Date((jd - 2440587.5) * 86400000); }

  // Geocentric Moon: longitude (mean equinox of date), latitude, distance (km)
  function moonOfDate(jdUT) {
    var jde = jdUT + deltaT(jdUT) / 86400;
    var T = (jde - 2451545.0) / 36525, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var Lp = norm(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
    var D  = norm(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
    var M  = norm(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
    var Mp = norm(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
    var F  = norm(93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000);
    var A1 = norm(119.75 + 131.849 * T), A2 = norm(53.09 + 479264.290 * T), A3 = norm(313.45 + 481266.484 * T);
    var E = 1 - 0.002516 * T - 0.0000074 * T2, E2 = E * E;
    var sl = 0, sr = 0, sb = 0, i, t, arg, e;
    for (i = 0; i < TL.length; i++) {
      t = TL[i]; arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * RAD;
      e = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E2);
      sl += t[4] * e * Math.sin(arg); sr += t[5] * e * Math.cos(arg);
    }
    for (i = 0; i < TB.length; i++) {
      t = TB[i]; arg = (t[0] * D + t[1] * M + t[2] * Mp + t[3] * F) * RAD;
      e = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E2);
      sb += t[4] * e * Math.sin(arg);
    }
    sl += 3958 * Math.sin(A1 * RAD) + 1962 * Math.sin((Lp - F) * RAD) + 318 * Math.sin(A2 * RAD);
    sb += -2235 * Math.sin(Lp * RAD) + 382 * Math.sin(A3 * RAD) + 175 * Math.sin((A1 - F) * RAD)
        + 175 * Math.sin((A1 + F) * RAD) + 127 * Math.sin((Lp - Mp) * RAD) - 115 * Math.sin((Lp + Mp) * RAD);
    // general precession in longitude since J2000 (Meeus 21.6, arcsec)
    var pA = (5029.0966 * T + 1.11113 * T2 - 0.000006 * T3) / 3600;
    var lon = norm(Lp + sl / 1e6);
    return { lon: lon, lonJ2000: norm(lon - pA), lat: sb / 1e6, dist: 385000.56 + sr / 1000, T: T };
  }

  function sidLon(jdUT) { return moonOfDate(jdUT).lonJ2000; }

  // ---- constellations (Maria Thun's 12, unequal) ----
  // start = J2000 ecliptic longitude where the IAU boundary (Delporte 1930,
  // B1875 lines) crosses the J2000 ecliptic; derived with astropy's
  // get_constellation (Roman 1987) by bisection, 0.0001° resolution.
  var CONST = [
    { key: 'psc', start: 351.6500, day: 'leaf'   },
    { key: 'ari', start:  28.6873, day: 'fruit'  },
    { key: 'tau', start:  53.4166, day: 'root'   },
    { key: 'gem', start:  90.1395, day: 'flower' },
    { key: 'cnc', start: 117.9874, day: 'leaf'   },
    { key: 'leo', start: 138.0383, day: 'fruit'  },
    { key: 'vir', start: 173.8512, day: 'root'   },
    { key: 'lib', start: 217.8100, day: 'flower' },
    { key: 'sco', start: 241.0472, day: 'leaf'   }, // includes the Ophiuchus stretch
    { key: 'sgr', start: 266.2375, day: 'fruit'  },
    { key: 'cap', start: 299.6560, day: 'root'   },
    { key: 'aqr', start: 327.4880, day: 'flower' }
  ];
  var OPH_START = 247.6381; // Scorpius→Ophiuchus boundary on the ecliptic (info only)

  function setBoundaries(tbl) { // tbl: {psc:..., ari:..., ...}, optional oph
    for (var i = 0; i < CONST.length; i++) if (tbl[CONST[i].key] != null) CONST[i].start = tbl[CONST[i].key];
    if (tbl.oph != null) OPH_START = tbl.oph;
  }
  function widths() {
    var out = [];
    for (var i = 0; i < CONST.length; i++) {
      var a = CONST[i].start, b = CONST[(i + 1) % CONST.length].start;
      out.push({ key: CONST[i].key, day: CONST[i].day, start: a, width: norm(b - a) });
    }
    return out;
  }
  function constAt(lon) {
    var w = widths();
    for (var i = 0; i < w.length; i++) {
      var off = norm(lon - w[i].start);
      if (off < w[i].width) return { index: i, key: w[i].key, day: w[i].day, offset: off, width: w[i].width, start: w[i].start };
    }
    return null;
  }

  // ---- crossing search ----
  // find instant (JD) when the Moon enters constellation index `idx` searching forward
  // from jd0 (if dir>0) or the last entry at/before jd0 (dir<0). Moon moves 11.5–15°/day.
  function crossing(jd, dir) {
    var c0 = constAt(sidLon(jd)).index, step = dir * (1 / 24); // 1-hour steps
    var a = jd, b = jd + step, n = 0;
    while (constAt(sidLon(b)).index === c0 && n < 200) { a = b; b += step; n++; }
    // bisect between a (same constellation) and b (different)
    for (var k = 0; k < 40; k++) {
      var m = (a + b) / 2;
      if (constAt(sidLon(m)).index === c0) a = m; else b = m;
      if (Math.abs(b - a) * 86400 < 0.5) break;
    }
    return dir > 0 ? b : a; // dir>0: first instant in new const; dir<0: first instant of current
  }

  function periodAt(jd) {
    var c = constAt(sidLon(jd));
    var start = crossing(jd, -1), end = crossing(jd, +1);
    var next = constAt(sidLon(end + 1 / 1440));
    var prev = constAt(sidLon(start - 1 / 1440));
    return { start: start, end: end, constellation: c, next: next, prev: prev, hours: (end - start) * 24 };
  }

  function periodsBetween(jd0, jd1) {
    var list = [], p = periodAt(jd0);
    list.push(p);
    var guard = 0;
    while (p.end < jd1 && guard++ < 60) { p = periodAt(p.end + 1 / 1440); list.push(p); }
    return list;
  }

  // ---- Sun (Meeus ch. 25, low precision) for phase ----
  function sunLon(jdUT) {
    var jde = jdUT + deltaT(jdUT) / 86400, T = (jde - 2451545.0) / 36525;
    var L0 = norm(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    var M = norm(357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    return norm(L0 + C);
  }
  function phase(jdUT) {
    var m = moonOfDate(jdUT), s = sunLon(jdUT);
    var elong = norm(m.lon - s); // 0 new, 180 full
    var illum = (1 - Math.cos(elong * RAD)) / 2;
    return { elongation: elong, illumination: illum, dist: m.dist, lat: m.lat };
  }

  return { moonOfDate: moonOfDate, sidLon: sidLon, constAt: constAt, widths: widths, periodAt: periodAt,
           periodsBetween: periodsBetween, jdFromDate: jdFromDate, dateFromJd: dateFromJd, phase: phase,
           setBoundaries: setBoundaries, CONST: CONST, ophStart: function () { return OPH_START; }, deltaT: deltaT };
})();
if (typeof module !== 'undefined') module.exports = WineMoon;
