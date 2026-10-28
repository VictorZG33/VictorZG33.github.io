# golf-coach

A Cloudflare Worker that lets every visitor of [wentaoz.com/golf/](https://wentaoz.com/golf/) use the AI coach on the site's own Anthropic API key, without anyone having to paste a key.

This is what the page uses by default (`COACH_ENDPOINT` in `golf/index.html`). A visitor can tick *Use my own Anthropic API key* instead; the page then calls Claude straight from their browser with their key, and nothing here is involved. With `COACH_ENDPOINT` empty, that is the only way.

## What it does

The page posts the coach input (four JPEG key frames, the measurements and the player's note). The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 5 requests a minute per IP address (the `COACH_LIMIT` binding in `wrangler.toml`),
3. checks the input with `checkCoachInput` from `golf/coach.js`,
4. builds the Claude request with `buildCoachRequest` from the same file, so it can only ever send the golf-coach prompt, and
5. streams the answer back to the page.

The API key lives in the Worker as a secret and never reaches the browser. Without it, the Worker answers `503 not_configured`, and the page tells the visitor the site's coach is unavailable and points them to their own key. It says the same when the key is refused or its credit has run out.

## Deploying

`.github/workflows/golf-coach.yml` deploys the Worker whenever this folder or `golf/coach.js` changes on `main`, using the same Cloudflare secrets as the All Square sync server.

1. In the [Anthropic Console](https://console.anthropic.com), create a workspace for the site, set a monthly spend limit on it (for example US$10), and create an API key in that workspace. The spend limit is what caps the bill if someone abuses the Worker.
2. Store the key as the repository secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions). `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` should already be there.
3. Actions → Golf coach server → Run workflow. The run's summary shows the Worker's address, `https://golf-coach.<subdomain>.workers.dev`, which should match `COACH_ENDPOINT` in `golf/index.html`.

The workflow uploads the key with every deploy, so to change it, update the repository secret and run the workflow again.

To deploy by hand instead, in this folder:

```sh
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler deploy
```

To test locally, put `ANTHROPIC_API_KEY=...` in a `.dev.vars` file here (it is git-ignored) and run `npx wrangler dev`.

## Cost

Each lesson is one Claude Opus 5.5 call: four small images and the measurements in (about 5,000 tokens at US$4 per million), a few thousand tokens of thinking and answer out (US$20 per million), so about US$0.05–0.10. `COACH_MODEL` in `golf/coach.js` picks the model; Claude Sonnet 5.5 costs about half as much, and Claude Haiku 5.5 a small fraction, at some loss of coaching quality. Change `PRICE` in `golf/index.html` to match, since the page shows the cost of each lesson.
