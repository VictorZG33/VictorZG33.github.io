# claude-chat

A Cloudflare Worker that lets [wentaoz.com/chat/](https://wentaoz.com/chat/), 闲聊 Small Talk, chat with Claude on the site's own Anthropic API key, for whoever knows the passcode, and keeps the conversations so that every device sees the same ones.

The page is linked from nowhere on the site and tells search engines to leave it out, but the repository is public, so anyone can find it. Keeping it private is this Worker's job: without the passcode it won't call Claude or show a single conversation. The passcode therefore guards everything said in the chat, not only the bill.

## What it does

Every request carries the passcode in the `Authorization` header. The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 20 requests a minute per IP address (the `CHAT_LIMIT` binding in `wrangler.toml`), passcode guesses included; a message and its save take two,
3. checks the passcode against its `CHAT_PASSCODE` secret, comparing hashes so the time taken gives nothing away, and then
4. answers one of these:

| Request | Answer |
| --- | --- |
| `GET /` | `204`, and no call to Claude: how the page checks a passcode as it is typed in |
| `POST /` `{ model, effort, messages }` | Claude's reply, streamed. `checkChatInput` in `chat/chat.js` checks the conversation and `buildChatRequest` shapes the request, so the models, the prompt and `max_tokens` are fixed there, whatever the page sends |
| `GET /chats` | every conversation, latest first, without its messages |
| `GET /chats/:id` | one conversation with its messages |
| `PUT /chats/:id` `{ base, keep, append, title, model, effort }` | saves a conversation (checked by `checkSave` in `chat/chat.js`) |
| `DELETE /chats/:id` | deletes one |

A wrong passcode gets `401 bad_passcode`, and the page asks again. Without `ANTHROPIC_API_KEY` or `CHAT_PASSCODE`, the Worker answers `503 not_configured`.

## The conversations

They are kept in one SQLite-backed Durable Object, `ChatStore` in `store.js`: a row per conversation, with its title, model and effort, and a row per message. A column added later (as `effort` was) goes in with `ALTER TABLE` when the object starts, so the conversations already stored keep working. The page only ever adds turns to the end of a conversation or takes them off the end (Claude checks that the conversation behind each of its thinking blocks is unchanged), so a save says how many stored messages stay (`keep`) and sends only the ones after them (`append`). Each save names the version it builds on (`base`). One made from an older copy, as when two devices answer in the same conversation without either seeing the other's turn, is refused with `409` and the current version; the page then keeps its own version as a new conversation,「…（副本）」, rather than overwrite anything.

The page keeps a copy of each conversation in the browser's `localStorage` too, so it opens at once and survives a dropped connection: a save that fails is marked in the conversation list and goes up at the next chance. When the page comes back into view, it looks for what changed on other devices. Signing out on a device (*在这台设备上退出*, in the conversation list) forgets the passcode there and clears the copies the cloud already has.

The Workers free plan includes SQLite-backed Durable Objects: up to 5 GB stored across the account and 100,000 rows written a day, of which a turn takes three or four. Deploying creates the object; there is nothing to set up for it.

## Setting it up

`.github/workflows/claude-chat.yml` deploys the Worker whenever this folder or `chat/chat.js` changes on `main`, with the same Cloudflare secrets as the golf coach and the All Square sync server.

1. Pick a passcode. It is the only lock, so make it long: four or five random words, or 16 random characters. Any characters work, Chinese included.
2. Store it as the repository secret `CHAT_PASSCODE` (Settings → Secrets and variables → Actions). `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY` should already be there, from the golf coach and All Square.
3. Actions → Claude chat server → Run workflow. The run's summary shows the Worker's address, `https://claude-chat.<subdomain>.workers.dev`, which should match `CHAT_ENDPOINT` in `chat/index.html`.
4. Open `https://wentaoz.com/chat/` and type the passcode once on each device. The page keeps it in that browser's `localStorage`.

The chat uses the same key as the golf coach and All Square's receipt reading, and with it that key's workspace spend limit. To give the chat a key and a limit of its own, create another workspace and key in the [Anthropic Console](https://console.anthropic.com) and store the key as `CHAT_ANTHROPIC_API_KEY`; the workflow uses it in place of `ANTHROPIC_API_KEY`. The workflow uploads the key and the passcode with every deploy, so to change either, update the repository secret and run the workflow again. A changed passcode logs every device out.

To deploy by hand instead, in this folder:

```sh
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler secret put CHAT_PASSCODE       # and the passcode
npx wrangler deploy
```

To try it locally, put `ANTHROPIC_API_KEY=...` and `CHAT_PASSCODE=...` in a `.dev.vars` file here (it is git-ignored), run `npx wrangler dev --var DEV_ORIGINS:http://localhost:8000`, serve the repository with `python3 -m http.server 8000`, and point `CHAT_ENDPOINT` at `http://localhost:8787` without committing that. The local Durable Object keeps its conversations under `.wrangler/`, also git-ignored.

## Models, effort and cost

Each conversation uses the model and the effort picked above the box you type in; a change applies from the next message, new conversations start with what was picked last, and the conversation keeps both, on every device. `MODELS` in `chat/chat.js` lists the models with their own effort for chat, which the effort menu offers as *默认*, and their prices, which the page uses for the cost under each reply:

| Model | Its own effort | US$ per million tokens in / out | Refusal fallback |
| --- | --- | --- | --- |
| Claude Fable 5.2 | medium | 8 / 40 | yes |
| Claude Opus 5.5 (the default) | low | 4 / 20 | yes |
| Claude Sonnet 5.5 | low | 2 / 10 | no |
| Claude Haiku 5.5 | low | 0.10 / 0.50, five times that past 100,000 tokens of prompt | no |

The effort menu also offers every level the models take: 低 (low), 中 (medium), 高 (high), 很高 (xhigh) and 最高 (max). A higher level thinks longer before answering, so it answers more carefully, more slowly and at more cost: the thinking is billed as output. Since thinking counts towards `max_tokens`, the request allows 16,000 tokens at low, 32,000 at medium and high, and 64,000 at xhigh and max (`MAX_OUT` in `chat/chat.js`). At xhigh and max a reply can think for minutes before writing a word; the page counts the seconds meanwhile, and the Worker sends a blank line every 15 seconds so that the quiet connection isn't cut on the way. Stopping a reply stops the request to Claude too.

Every message sends the conversation so far, but the request caches it, so once a conversation passes the 512 tokens the cache needs, its earlier turns are re-read at a tenth to a fortieth of the price. Changing the effort starts that cache over once, for the next message. On Opus 5.5 at low effort a short exchange costs under a cent, and a message deep into a long conversation a cent or two. Fable 5.2 costs about twice that and thinks longer; Haiku 5.5, a few hundredths of a cent.

When Opus's or Fable's safety classifiers decline a message, the request runs it again on the model Anthropic recommends for that case. Haiku 5.5 has no such fallback, and Sonnet 5.5's would run on Claude Sonnet 5, which can't take the time notes the page sends as system messages, so a declined message there comes back to the box to be put another way. Fable 5.2 needs the API key's organization to keep data for 30 days; under zero data retention it answers with an error, and the other models still work. A conversation can change models at any time: the API drops the reasoning a model can't read and carries on.
