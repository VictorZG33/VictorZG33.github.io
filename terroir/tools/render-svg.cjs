// Draws an SVG to PNG with Chromium, for build-vinous.py:
//
//   node render-svg.cjs <file.svg> <out> <pixels per SVG unit> [strip height in pixels]
//
// The SVG is shown through an <img>, so nothing in it runs, on a page with JavaScript off; it is
// drawn at exactly its viewBox's width and height times the scale, top left at 0, 0, so pixel (i, j)
// covers SVG units [i, i + 1) / scale across and [j, j + 1) / scale down. It is cut into strips
// <out>.<n>.png, each so many pixels tall, so that no one screenshot is too large for Chromium, and
// <out>.json says how many. Playwright, with its Chromium: npm i -g playwright && npx playwright install chromium
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [, , svgPath, out, scaleArg = '1', stripArg = '2048'] = process.argv;
if (!svgPath || !out) { console.error('usage: node render-svg.cjs <file.svg> <out> <scale> [strip]'); process.exit(2); }

(async () => {
  const head = fs.readFileSync(svgPath, 'utf8').slice(0, 4000);
  const vb = head.match(/viewBox="\s*([-0-9.eE]+)[\s,]+([-0-9.eE]+)[\s,]+([0-9.eE]+)[\s,]+([0-9.eE]+)\s*"/);
  if (!vb) throw new Error('no viewBox in ' + svgPath);
  const w = +vb[3], h = +vb[4], k = +scaleArg, stripCss = +stripArg / k;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: Math.ceil(w), height: 1000 }, deviceScaleFactor: k, javaScriptEnabled: false });
  await page.goto('file://' + path.dirname(path.resolve(svgPath)) + '/');   // a file: page may show a file: image
  await page.setContent('<body style="margin:0;background:#fff"><img id="m" style="display:block;width:' + w + 'px;height:' + h +
    'px" src="file://' + encodeURI(path.resolve(svgPath)) + '"></body>');
  await page.waitForFunction(() => { const m = document.getElementById('m'); return m.complete && m.naturalWidth > 0; }, null, { timeout: 120000 });
  await page.waitForTimeout(1000);
  let n = 0;
  for (let y = 0; y < h; y += stripCss, n++)
    await page.screenshot({ path: out + '.' + n + '.png', fullPage: true, clip: { x: 0, y, width: w, height: Math.min(stripCss, h - y) } });
  fs.writeFileSync(out + '.json', JSON.stringify({ svg: path.basename(svgPath), viewBox: vb.slice(1).map(Number), scale: k, strips: n }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
