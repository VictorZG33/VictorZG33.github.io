# claude-chat

A Cloudflare Worker that lets [wentaoz.com/chat/](https://wentaoz.com/chat/), 闲聊 Small Talk, chat with Claude on the site's own Anthropic API key, for whoever knows the passcode.

The page is linked from nowhere on the site and tells search engines to leave it out, but the repository is public, so anyone can find it. Keeping it private is this Worker's job: without the passcode it won't call Claude.

## What it does

The page sends the conversation so far (`{ messages }`) with the passcode in the `Authorization` header. The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 20 requests a minute per IP address (the `CHAT_LIMIT` binding in `wrangler.toml`), passcode guesses included,
3. checks the passcode against its `CHAT_PASSCODE` secret, comparing hashes so the time taken gives nothing away,
4. checks the conversation with `checkChatInput` from `chat/chat.js`,
5. builds the Claude request with `buildChatRequest` from the same file, so the model, the prompt and `max_tokens` are fixed here whatever the page sends, and
6. streams the reply back to the page.

A `GET` with the right passcode gets `204` and no call to Claude, which is how the page checks a passcode when it is typed in. A wrong one gets `401 bad_passcode`, and the page asks again. Without `ANTHROPIC_API_KEY` or `CHAT_PASSCODE`, the Worker answers `503 not_configured`. Nothing is stored here; the conversations live in the browser that had them.

## Setting it up

`.github/workflows/claude-chat.yml` deploys the Worker whenever this folder or `chat/chat.js` changes on `main`, with the same Cloudflare secrets as the golf coach and the All Square sync server.

1. Pick a passcode. It is the only lock, so make it long: four or five random words, or 16 random characters. Any characters work, Chinese included.
2. Store it as the repository secret `CHAT_PASSCODE` (Settings → Secrets and variables → Actions). `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY` should already be there, from the golf coach and All Square.
3. Actions → Claude chat server → Run workflow. The run's summary shows the Worker's address, `https://claude-chat.<subdomain>.workers.dev`, which should match `CHAT_ENDPOINT` in `chat/index.html`.
4. Open `https://wentaoz.com/chat/` and type the passcode once on each device. The page keeps it in that browser's `localStorage`; *在这台设备上退出* in the conversation list forgets it.

The chat uses the same key as the golf coach and All Square's receipt reading, and with it that key's workspace spend limit. To give the chat a key and a limit of its own, create another workspace and key in the [Anthropic Console](https://console.anthropic.com) and store the key as `CHAT_ANTHROPIC_API_KEY`; the workflow uses it in place of `ANTHROPIC_API_KEY`. The workflow uploads the key and the passcode with every deploy, so to change either, update the repository secret and run the workflow again. A changed passcode logs every device out.

To deploy by hand instead, in this folder:

```sh
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler secret put CHAT_PASSCODE       # and the passcode
npx wrangler deploy
```

To try it locally, put `ANTHROPIC_API_KEY=...` and `CHAT_PASSCODE=...` in a `.dev.vars` file here (it is git-ignored), run `npx wrangler dev --var DEV_ORIGINS:http://localhost:8000`, serve the repository with `python3 -m http.server 8000`, and point `CHAT_ENDPOINT` at `http://localhost:8787` without committing that.

## Cost

Each reply is one Claude Opus 5.5 call at low effort, which costs US$4 per million tokens in and US$20 out. Every message sends the conversation so far, but the request caches it, so once a conversation passes the 512 tokens the cache needs, its earlier turns are re-read at US$0.20 per million. A short exchange costs under a cent, and a message deep into a long conversation a cent or two; the page shows the cost under each reply. `CHAT_MODEL` and `CHAT_EFFORT` in `chat/chat.js` pick the model and how long it thinks: Claude Sonnet 5.5 costs half as much, and effort `medium` or `high` thinks longer before answering. Change `PRICE` there to match a new model.
