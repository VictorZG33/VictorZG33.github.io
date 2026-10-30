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
- `werewolf/index.html` is 盘狼 Table Read, a reasoning aid for werewolf (狼人杀) at `/werewolf/`, in Chinese. You set the player count and the board (villagers, wolves, seer, witch, hunter, idiot, guard), then add each round: who died that night, and the day's statements typed as people say them at the table (`3踩5，6跳预言家验2金水，1、2投5，5出局`) or tapped on a keypad that writes the same text. It shows each player's chance of being a wolf and of holding each role, the likeliest wolf teams, and how likely every two players are to be on the same side, and for any player, which statements moved them most. Your own seat and role count as certain, and so do your checks if you are the seer and the knife target if you are the witch. The game is kept in `localStorage` under `tableread.game`.
- `werewolf/engine.js` reads those statements and does the reasoning. Every deal of the board's cards is a possible world, each piece of evidence weighs each world by how likely it would be there, and the weights, with a short reason for each, are at the top of the file. It enumerates the wolf teams and deals the good roles with a small dynamic programme, so a 12-player game takes a few milliseconds and the 18-player maximum about a third of a second. Like `golf/swing.js` it has no DOM, so node can run it.
- 杰神模拟器 Jieshen Simulator (`/jaysonsays/`) and 滚落线 Fall Line (`/fallline/`) live in their own repositories, [VictorZG33/jaysonsays](https://github.com/VictorZG33/jaysonsays) and [VictorZG33/fallline](https://github.com/VictorZG33/fallline). GitHub Pages serves each at that path because project sites inherit this site's custom domain; the homepage links to them from its Wine and Skiing tabs.
- `photography/index.html` is 显影 Developed, the photography gallery. The Photography tab on the homepage links to it with a card, in a darkroom safelight's amber, that shows a strip of its first photographs. `photography/tools/build.mjs` makes both, with the images in `photography/img`, from full-size masters and `photography/photos.json`; see [Adding photographs](#adding-photographs).
- `404.html` is what GitHub Pages serves for any missing path; its links are absolute for that reason.
- `og.png`, `wine-moon/og.png`, `split/og.png`, `golf/og.png` and `werewolf/og.png` are the 1200×630 preview images link previews show. They are screenshots of the pages, so retake them if the name, strip, Wine Moon, All Square, Swing Mirror or Table Read colours change. The gallery's preview is its first photograph, which the build script fills in.
- The light/dark choice is stored in `localStorage` under `wentaoz.theme` and shared by every page; with nothing stored, pages follow the system setting.

## Adding photographs

The gallery shows each photograph at a fixed size for each of three window sizes, as Apple's product pages do: it fits in 800 × 480, 1200 × 720 or 1600 × 960 CSS pixels, picked by the window's width and height so the whole frame and its caption fit on screen. The script makes exactly those widths for screens at 1x, 1.5x and 2x, so on a laptop or a desktop monitor every pixel of the image lands on one pixel of the screen and the browser never resamples it. Phones and narrow windows get a fluid layout and the next size up. Each size is made straight from the master with a Lanczos filter, sharpened lightly at that size and compressed once: AVIF at quality 72, which keeps film grain, and JPEG at 90 for browsers without AVIF, both with full colour resolution (4:4:4) and in Display P3, with no other metadata, so no EXIF or GPS position.

1. Export a master of each photograph from Lightroom: Display P3, long edge 4,000 px or more (the largest size sent to any screen is 3,200 px wide), TIFF or JPEG at quality 95, output sharpening for Screen, Standard. Fill in Title, Caption and the location in Lightroom and they are copied in. Photographs pasted into a Claude chat arrive at 2,000 px on the long edge, already recompressed: enough for square and upright frames, which are never shown wider than 1,920 px, but short for landscape ones, which the largest windows on 2x screens then enlarge. The script names the missing sizes.
2. Put the masters in `photography/masters/`. Git ignores that folder, so they stay on your computer. The file name, lower-cased, becomes the photograph's id and its address in the gallery: `XPan 01.tif` is `/photography/#xpan-01`.
3. Once, in `photography/tools`, run `npm ci` (Node 20.9 or newer). Then run `node build.mjs`, or `node build.mjs ~/path/to/masters` for masters kept elsewhere.
4. Edit `photography/photos.json`: `title`, `alt` (what the photograph shows, for people who can't see it), `place`, `date`, `camera` and `film`. The list's order is the gallery's order, and the card on the homepage shows the first few, as many as fit in one strip. `width` and `height` are the master's size; the script keeps them. Run `node build.mjs` again: without new masters it only rewrites the two pages.
5. Commit `photography/` and `index.html`.

To take a photograph down, delete it from `photos.json` and run the script; its files go with it. A master newer than its files is made again, and `--force` remakes everything. Do that rarely: every remake adds a full set of files to the repository's history, and GitHub Pages wants a site under 1 GB. The script prints the size of `photography/img` after each run.

The window sizes are written twice, in `SIZES` in `build.mjs` and in the media queries in `photography/index.html`, so a change to one needs the same change in the other and `--force`.

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

The homepage, Wine Moon, All Square, Swing Mirror, Table Read and the photography gallery load [GoatCounter](https://www.goatcounter.com) (site code `wentaoz`), which counts visits without cookies. To leave your own visits out, open `https://wentaoz.com/#toggle-goatcounter` once in each browser you use.

The Visitors section on the homepage stays hidden until there is something to show. It reads two sources:

- **The total**, from GoatCounter's public counter (`https://wentaoz.goatcounter.com/counter/TOTAL.json`). This needs *Allow adding visitor counts on your website* switched on in the GoatCounter site settings.
- **The map and the country list**, from `visitors.json` in this repo. `.github/workflows/visitors.yml` rebuilds the file every day at 06:17 UTC by running `.github/scripts/visitors.mjs`, and commits it when the counts change. The script reads the GoatCounter API with a key stored as the repository secret `GOATCOUNTER_TOKEN`; that key needs only the permission to read statistics. Countries are placed at the centres in `.github/scripts/country-centres.json`.

To run it by hand: Actions → Visitor map → Run workflow.
- `CNAME` tells GitHub Pages which custom domain to serve (don't delete it).
- `.nojekyll` turns off Jekyll processing so the files are served as-is.
