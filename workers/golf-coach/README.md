# golf-coach

A Cloudflare Worker that lets every visitor of [wentaoz.com/golf/](https://wentaoz.com/golf/) use the AI coach on the site's own Anthropic API key, without anyone having to paste a key.

Until it is deployed, the page asks each visitor for their own key and calls Claude straight from their browser. Nothing here is needed for that.

## What it does

The page posts the coach input (four JPEG key frames, the measurements and the player's note). The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 5 requests a minute per IP address (the `COACH_LIMIT` binding in `wrangler.toml`),
3. checks the input with `checkCoachInput` from `golf/coach.js`,
4. builds the Claude request with `buildCoachRequest` from the same file, so it can only ever send the golf-coach prompt, and
5. streams the answer back to the page.

The API key lives in the Worker as a secret and never reaches the browser.

## Deploying

You need a Cloudflare account (the free plan is enough) and an Anthropic API key.

1. In the [Anthropic Console](https://console.anthropic.com), create a workspace for the site, set a monthly spend limit on it (for example US$10), and create an API key in that workspace. The spend limit is what caps the bill if someone abuses the Worker.
2. In this folder:

   ```sh
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
   npx wrangler deploy
   ```

   The last command prints the Worker's address, such as `https://golf-coach.<your-subdomain>.workers.dev`.
3. In `golf/index.html`, set `COACH_ENDPOINT` to that address and push. The key field disappears from the page and the button uses the Worker.

To test locally, put `ANTHROPIC_API_KEY=...` in a `.dev.vars` file here (it is git-ignored) and run `npx wrangler dev`.

## Cost

Each lesson is one Claude Opus 5.5 call: four small images and the measurements in (about 5,000 tokens at US$4 per million), a few thousand tokens of thinking and answer out (US$20 per million), so about US$0.05–0.10. `COACH_MODEL` in `golf/coach.js` picks the model; Claude Sonnet 5.5 costs about half as much, and Claude Haiku 5.5 a small fraction, at some loss of coaching quality. Change `PRICE` in `golf/index.html` to match, since the page shows the cost of each lesson.
