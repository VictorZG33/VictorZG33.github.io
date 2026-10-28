# wentaoz.com

Personal homepage of Wentao Zhang, served by GitHub Pages at https://wentaoz.com.

There is no build step: every file is served as-is. Edit and push to `main`; GitHub Pages redeploys in about a minute.

- `index.html` is the homepage. The film strip's thickness and material live in the address (`?d=70&m=al2o3`), so a link opens on the same colour. The growth per ALD cycle behind the cycle count is the `gpc` of each entry in `MATERIALS`.
- `wine-moon/index.html` is 醉月历 Wine Moon, the biodynamic wine calendar.
- `wine-moon/engine.js` computes the Moon's position and the fruit, flower, leaf and root periods. Both the calendar and the Wine Moon card on the homepage load it, so a fix there reaches both.
- `split/index.html` is 两清 All Square, the bill splitter: names first, then each expense with who paid and who shares it, then the settlement with the fewest transfers. The ledger is kept in the browser's `localStorage` under `allsquare.ledger`, and shared ledgers sync through the server below.
- `workers/split` is that sync server, a Cloudflare Worker; see [Shared ledgers in All Square](#shared-ledgers-in-all-square).
- `golf/index.html` is 挥杆镜 Swing Mirror, the golf swing analyser at `/golf/`. A visitor picks a video of one swing; MediaPipe's pose model (loaded from jsDelivr, the model file from Google's storage) tracks 33 body points in every frame, in the browser, and the video never leaves the device. `golf/swing.js` finds address, top, impact and finish in those points and measures tempo, head and hip movement and body angles, with the thresholds for good, watch and fix written next to each measurement. It has no DOM, so it can be run in node against saved landmarks.
- `golf/coach.js` is the optional AI coach: it turns the four key frames and the measurements into one Claude request. By default the page sends it to `workers/golf-coach/`, a Cloudflare Worker at `COACH_ENDPOINT` in `golf/index.html` that calls Claude on the site's own key, kept there as a secret. `.github/workflows/golf-coach.yml` deploys it from the repository secret `ANTHROPIC_API_KEY`; the Worker's README explains the setup. A visitor can tick *Use my own Anthropic API key* instead: the page then calls Claude directly with the key they paste (kept in `localStorage` under `golf.apiKey` only if they tick *Remember*), and a visitor with a saved key starts on it. With `COACH_ENDPOINT` empty, the visitor's own key is the only way.
- `jieshen/index.html` is 杰神模拟器 Jieshen Simulator at `/jieshen/`. A visitor photographs a wine label or types the wine; Claude identifies it (producer, cuvée, vintage, region, drinking window), looks it up among the scores 杰神 has published, and either reports his score with its source or predicts the one he would give, with a note in his voice. Predictions are marked as simulations on the page. `jieshen/reviews.js` holds his framework and the 539 wines collected from his WeChat account in October 2026 (the 2018 and 2019 lists in full, read from their score-table images on the Sohu mirror); search engines don't index his scores, so this table is the lookup, and it goes into the prompt. `jieshen/sim.js` builds the one Claude request and runs it; web search (at most 3) only looks up other critics' scores to anchor a prediction. To add a later list, append its rows to `REVIEWS` and its article to `SOURCES`. Like the golf coach, the page sends questions to a Cloudflare Worker, `workers/jieshen/` at `ENDPOINT` in `jieshen/index.html`, which calls Claude on the site's key, and a visitor can tick *Use my own Anthropic API key* instead (kept in `localStorage` under `jieshen.apiKey` only if they tick *Remember*). `.github/workflows/jieshen.yml` deploys the Worker with the same three secrets as the golf coach; the Worker's README explains the rest.
- `404.html` is what GitHub Pages serves for any missing path; its links are absolute for that reason.
- `og.png`, `wine-moon/og.png`, `split/og.png`, `golf/og.png` and `jieshen/og.png` are the 1200×630 preview images link previews show. They are screenshots of the pages, so retake them if the name, strip, Wine Moon, All Square, Swing Mirror or Jieshen Simulator colours change.
- The light/dark choice is stored in `localStorage` under `wentaoz.theme` and shared by every page; with nothing stored, pages follow the system setting.

## Shared ledgers in All Square

A ledger stays in the browser until someone shares it. Sharing saves it to the sync server, and the link carries only its id (`#l=<id>`). Every page that has the ledger open asks the server for changes every 5 seconds, and two people editing at once don't overwrite each other: a save made from an outdated copy is refused, and the page replays its changes on the newer one. The server is the Cloudflare Worker in `workers/split`. It keeps each ledger in its own Durable Object and deletes a ledger nobody has changed for a year.

Until `API` near the top of the script in `split/index.html` holds the server's address, share links are snapshots that carry the whole ledger after `#d=`, so later changes don't reach them. The page also falls back to snapshots when the server can't be reached, as from mainland China, where `workers.dev` addresses are blocked.

To set the server up once:

1. Make a free Cloudflare account and open **Workers & Pages** once; it asks you to pick a `workers.dev` subdomain.
2. Under **My Profile → API Tokens**, create a token from the **Edit Cloudflare Workers** template, and copy your account ID from the **Workers & Pages** overview.
3. Store them as the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Settings → Secrets and variables → Actions).
4. Actions → Split sync server → Run workflow. The run's summary shows the server's address, `https://split-sync.<subdomain>.workers.dev`.
5. Put that address in `API` in `split/index.html` and push.

From then on `.github/workflows/split-sync.yml` redeploys the server whenever `workers/split` changes on `main`. The free plan allows 100,000 requests a day, and a page with a shared ledger open makes about 720 an hour.

To try it locally, run `npx wrangler dev --var DEV_ORIGINS:http://localhost:8000` in `workers/split`, serve the repo with `python3 -m http.server 8000`, and point `API` at `http://localhost:8787` without committing that.

## Visitor counting and the visitor map

The homepage, Wine Moon, All Square, Swing Mirror and Jieshen Simulator load [GoatCounter](https://www.goatcounter.com) (site code `wentaoz`), which counts visits without cookies. To leave your own visits out, open `https://wentaoz.com/#toggle-goatcounter` once in each browser you use.

The Visitors section on the homepage stays hidden until there is something to show. It reads two sources:

- **The total**, from GoatCounter's public counter (`https://wentaoz.goatcounter.com/counter/TOTAL.json`). This needs *Allow adding visitor counts on your website* switched on in the GoatCounter site settings.
- **The map and the country list**, from `visitors.json` in this repo. `.github/workflows/visitors.yml` rebuilds the file every day at 06:17 UTC by running `.github/scripts/visitors.mjs`, and commits it when the counts change. The script reads the GoatCounter API with a key stored as the repository secret `GOATCOUNTER_TOKEN`; that key needs only the permission to read statistics. Countries are placed at the centres in `.github/scripts/country-centres.json`.

To run it by hand: Actions → Visitor map → Run workflow.
- `CNAME` tells GitHub Pages which custom domain to serve (don't delete it).
- `.nojekyll` turns off Jekyll processing so the files are served as-is.
