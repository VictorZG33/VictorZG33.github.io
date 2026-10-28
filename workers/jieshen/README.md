# jieshen

A Cloudflare Worker that lets every visitor of [wentaoz.com/jieshen/](https://wentaoz.com/jieshen/) ask 杰神模拟器 Jieshen Simulator on the site's own Anthropic API key, without anyone having to paste a key.

This is what the page uses by default (`ENDPOINT` in `jieshen/index.html`). A visitor can tick *Use my own Anthropic API key* instead; the page then calls Claude straight from their browser with their key, and nothing here is involved. With `ENDPOINT` empty, that is the only way.

## What it does

The page posts the question: a label photo as a JPEG, what the visitor typed, or both. The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 3 requests a minute per IP address (the `ASK_LIMIT` binding in `wrangler.toml`),
3. checks the input with `checkInput` from `jieshen/sim.js`,
4. runs it with `runSimulator` from the same file, so it can only ever send the Jieshen Simulator prompt, with at most 4 web searches and 3 page reads, and
5. streams back one JSON object per line: each search and page read as it starts, then the verdict, then the token counts.

The API key lives in the Worker as a secret and never reaches the browser. Without it, the Worker answers `503 not_configured`, and the page tells the visitor the site's key is unavailable and points them to their own key. It says the same when the key is refused or its credit has run out; since the answer streams, those arrive as an `{"type": "error"}` line rather than as the HTTP status.

## Deploying

`.github/workflows/jieshen.yml` deploys the Worker whenever this folder, `jieshen/sim.js` or `jieshen/reviews.js` changes on `main`. It uses the same three repository secrets as the golf coach server (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY`), so once those are set there is nothing else to do: merge, and the run's summary shows the Worker's address, `https://jieshen.<subdomain>.workers.dev`, which should match `ENDPOINT` in `jieshen/index.html`.

Claude's web search is on for every Anthropic organization unless an administrator has turned it off in the Console (Settings → Capabilities). If it is off, every question fails with a 400 error from the API saying so.

To deploy by hand instead, in this folder:

```sh
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler deploy
```

To test locally, put `ANTHROPIC_API_KEY=...` in a `.dev.vars` file here (it is git-ignored) and run `npx wrangler dev`.

## Cost

Each question is one Claude Opus 5.5 request, sometimes continued once. The fixed part of the prompt (杰神's framework and his published scores) is cached, so after the first question in five minutes it costs a tenth of the normal input price. A wine he has scored, or one that needs no searching, costs about US$0.05–0.10. A wine that sends Claude to the web costs more, because each search costs US$0.01 and the pages it reads count as input tokens at US$4 per million: about US$0.15–0.40. `SIM_MODEL` in `jieshen/sim.js` picks the model; Claude Sonnet 5.5 costs about half as much. Change `PRICE` in `jieshen/index.html` to match, since the page shows the cost of each question. The spend limit on the key's workspace caps the bill.
