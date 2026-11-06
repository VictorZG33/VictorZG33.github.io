/* ---------------------------------------------------------------
 * Beer colour from SRM, for 原麦汁 Original Gravity (beer/index.html)
 *  - SRM is 12.7 times the absorbance of the beer at 430 nm in 1 cm
 *    (ASBC Beer-10A). The absorbance at other wavelengths follows
 *    A. J. deLange's average spectrum of 99 beers (J. Am. Soc. Brew.
 *    Chem. 66(3), 143-150, 2008):
 *      A(l) = SRM/12.7 * (0.018747 e^-(l-430)/13.374 + 0.98226 e^-(l-430)/80.514)
 *  - Light through a path of d cm keeps 10^(-A d) of itself
 *    (Beer-Lambert). That spectrum, under daylight (D65), is turned
 *    into CIE XYZ with the 1931 observer and then into sRGB, the same
 *    way the homepage turns a film's reflectance into a colour.
 *  - CIE 1931 observer from the analytic fit of Wyman, Sloan & Shirley
 *    (2013); D65 at 10 nm from 380 to 780 nm.
 * No DOM here, so node can load it for testing.
 * --------------------------------------------------------------- */
var BeerColour = (function () {
  'use strict';
  var D65 = [49.98,54.65,82.75,91.49,93.43,86.68,104.87,117.01,117.81,114.86,115.92,108.81,109.35,107.80,104.79,107.69,104.41,104.05,100.00,96.33,95.79,88.69,90.01,89.60,87.70,83.29,83.70,80.03,80.21,82.28,78.28,69.72,71.61,74.35,61.60,69.89,75.09,63.59,46.42,66.81,63.38];
  function lobe(l, mu, s1, s2) { var t = (l - mu) * (l < mu ? s1 : s2); return Math.exp(-0.5 * t * t); }
  function cmf(l) {
    return [
      0.362 * lobe(l, 442.0, 0.0624, 0.0374) + 1.056 * lobe(l, 599.8, 0.0264, 0.0323) - 0.065 * lobe(l, 501.1, 0.0490, 0.0382),
      0.821 * lobe(l, 568.8, 0.0213, 0.0247) + 0.286 * lobe(l, 530.9, 0.0613, 0.0322),
      1.217 * lobe(l, 437.0, 0.0845, 0.0278) + 0.681 * lobe(l, 459.0, 0.0385, 0.0725)
    ];
  }
  var L = [], W = [], WHITE = [0, 0, 0], SHAPE = [];
  for (var i = 0; i < 41; i++) {
    var l = 380 + 10 * i, c = cmf(l);
    L.push(l);
    W.push([D65[i] * c[0], D65[i] * c[1], D65[i] * c[2]]);
    WHITE[0] += W[i][0]; WHITE[1] += W[i][1]; WHITE[2] += W[i][2];
    // the average beer's absorbance at l, relative to its absorbance at 430 nm
    SHAPE.push(0.018747 * Math.exp(-(l - 430) / 13.374) + 0.98226 * Math.exp(-(l - 430) / 80.514));
  }

  /* Absorbance of 1 cm of an average beer of this SRM at wavelength l (nm) */
  function absorbance(srm, l) {
    return srm / 12.7 * (0.018747 * Math.exp(-(l - 430) / 13.374) + 0.98226 * Math.exp(-(l - 430) / 80.514));
  }

  /* CIE XYZ of daylight after d cm of beer; water (srm 0) gives the D65 white, Y = 1 */
  function xyz(srm, d) {
    var X = 0, Y = 0, Z = 0, k = srm / 12.7 * d;
    for (var i = 0; i < 41; i++) {
      var t = Math.pow(10, -k * SHAPE[i]);
      X += W[i][0] * t; Y += W[i][1] * t; Z += W[i][2] * t;
    }
    return [X / WHITE[0] * 0.95047, Y / WHITE[1], Z / WHITE[2] * 1.08883];
  }

  function encode(v) { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); }
  function linearRGB(p) {
    return [
      3.2406 * p[0] - 1.5372 * p[1] - 0.4986 * p[2],
      -0.9689 * p[0] + 1.8758 * p[1] + 0.0415 * p[2],
      0.0557 * p[0] - 0.2040 * p[1] + 1.0570 * p[2]
    ];
  }
  /* sRGB (0-255) of daylight seen through d cm of beer of this SRM. A colour outside sRGB keeps
     its hue: it is pulled toward the grey of the same luminance until it fits. */
  function rgb(srm, d) {
    var p = xyz(srm, d), lin = linearRGB(p), Y = p[1];
    var lo = Math.min(lin[0], lin[1], lin[2]), t = 1;
    if (lo < 0) t = Math.min(t, Y / (Y - lo));
    var hi = Math.max(lin[0], lin[1], lin[2]);
    if (hi > 1) t = Math.min(t, (1 - Y) / (hi - Y));
    return lin.map(function (v) { return encode(Y + t * (v - Y)); });
  }
  function hex(c) { return '#' + c.map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }

  /* A straight glass of inner diameter dia cm, looked through across its width: at a fraction u of the
     radius from the middle the light crosses dia * sqrt(1 - u^2) of beer. Returns gradient stops,
     edge to edge, as [offset 0-1, '#rrggbb']. */
  function glass(srm, dia, n) {
    n = n || 13;
    var stops = [];
    for (var j = 0; j < n; j++) {
      var f = j / (n - 1), u = 2 * f - 1;
      var d = dia * Math.sqrt(Math.max(0, 1 - 0.94 * u * u));   // the walls keep a little beer in view at the very edge
      stops.push([f, hex(rgb(srm, d))]);
    }
    return stops;
  }

  /* Gravity and colour scales */
  function plato(sg) { return -616.868 + 1111.14 * sg - 630.272 * sg * sg + 135.997 * sg * sg * sg; }
  function ebc(srm) { return srm * 1.97; }

  return { absorbance: absorbance, xyz: xyz, rgb: rgb, hex: hex, glass: glass, plato: plato, ebc: ebc, SWATCH_CM: 5 };
})();
if (typeof module !== 'undefined') module.exports = BeerColour;
