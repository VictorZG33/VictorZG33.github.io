# claude-chat

A Cloudflare Worker that lets [wentaoz.com/chat/](https://wentaoz.com/chat/), 闲聊 Small Talk, chat with Claude on the site's own Anthropic API key, for whoever has an account. Each user signs in with a name and password of their own and sees only their own conversations, kept so that every device they sign in on sees the same ones. The Worker also takes the files a message carries to the Anthropic Files API.

The page is linked from nowhere on the site and tells search engines to leave it out, but the repository is public, so anyone can find it. Keeping it private is this Worker's job: without an account it won't call Claude, take a file or show a single conversation, and an account is only opened with the invite code. The accounts therefore guard everything said and sent in the chat, not only the bill.

## What it does

The Worker:

1. accepts requests only from `https://wentaoz.com` (the `Origin` header),
2. allows 20 requests a minute per IP address (the `CHAT_LIMIT` binding in `wrangler.toml`), guesses at passwords and the invite code included; a message and its save take two,
3. opens an account (`POST /account`) for whoever sends the invite code, its `CHAT_PASSCODE` secret, and signs people in (`POST /login`), each time handing the page a session token,
4. for anything else, takes that token from the `Authorization` header (`Bearer <token>`) and looks up whose session it is, and then
5. answers one of these, with that user's own conversations and files:

| Request | Answer |
| --- | --- |
| `POST /account` `{ name, password, invite }` | a new account, signed in: `{ token, id, name, first }`. `403 bad_invite`, `400 bad_name` or `weak_password`, or `409 name_taken` |
| `POST /login` `{ name, password }` | `{ token, id, name, first }`, or `401 bad_login` for a wrong name or password alike |
| `POST /logout` | `204`, and the token stops working |
| `GET /` | `{ id, name, first }`, whose session it is, with no call to Claude |
| `POST /` `{ model, effort, messages }` | Claude's reply, streamed. `checkChatInput` in `chat/chat.js` checks the conversation and `buildChatRequest` shapes the request, so the models, the prompt and `max_tokens` are fixed there, whatever the page sends |
| `GET /chats` | every conversation, latest first, without its messages |
| `GET /chats/:id` | one conversation with its messages |
| `PUT /chats/:id` `{ base, keep, append, title, model, effort }` | saves a conversation (checked by `checkSave` in `chat/chat.js`) |
| `DELETE /chats/:id` | deletes one, and the files only it carried |
| `POST /files` | uploads one file to the Files API: its bytes as the body, its type as `Content-Type`, its name URI-encoded in `X-File-Name`. Answers `{ id, name, size, type }` |
| `DELETE /files/:id` | deletes one of the user's uploaded files, unless a saved conversation carries it: one taken off a message before sending |

A token that is missing or no longer works gets `401 bad_session`, and the page asks to sign in again. A message or a save that carries someone else's file gets `403 not_your_file`. Without `ANTHROPIC_API_KEY` or `CHAT_PASSCODE`, the Worker answers `503 not_configured`.

## Accounts

Anyone with the invite code can open an account on the page (*注册*): a name of 2 to 24 letters, digits, Chinese characters, `.`, `_` or `-`, told apart without regard to case, and a password of at least 8 characters. After that, they sign in with the name and password alone. The invite code is the `CHAT_PASSCODE` secret, which was the passcode before there were accounts; changing it only changes what new accounts need, and signs nobody out.

The accounts are kept in one SQLite-backed Durable Object, `Accounts` in `accounts.js`, named `accounts`: a row per user in `users` and a row per signed-in device in `sessions`. A password is kept only as a salted PBKDF2-SHA256 hash, and a session only as the SHA-256 of its token, so neither can be read back out of the storage. The hash takes 20,000 rounds, a few milliseconds, since the Workers free plan allows a request 10 ms of CPU time and Workers' maximum of 100,000 would overrun it; on a paid plan `ROUNDS` in `accounts.js` can go up, and the passwords set before keep working. A session lasts until its device signs out, or until it goes unused for 180 days.

Each user's conversations live in a `ChatStore` of their own, named in their row in `users` (`store`), which nobody else's account ever gets. The first account to be opened takes over `chats`, the store that held the conversations from before there were accounts, and the page on a browser that used the passcode hands that account its copies too, so the owner of the site should open theirs first. That browser's page offers to open an account, with the invite code already filled in from the passcode.

There is no page for managing accounts. The Cloudflare dashboard's [Data Studio](https://developers.cloudflare.com/durable-objects/observability/data-studio/) can open the `Accounts` object (Durable Objects, the `claude-chat` Worker's `Accounts`, then Data Studio with the object name `accounts`) and edit its tables:

- To close an account, delete its row in `users`; its sessions stop working at once. Its conversations stay in its store, out of everyone's reach, even of someone who later opens an account under the same name.
- To reset a forgotten password, note the row's `store`, delete the row, and have the person open the account again under the same name; then set `store` in the new row back to what it was, and their conversations are theirs again.

## The conversations

They are kept in one SQLite-backed Durable Object, `ChatStore` in `store.js`: a row per conversation, with its title, model and effort, and a row per message. A column added later (as `effort` was) goes in with `ALTER TABLE` when the object starts, so the conversations already stored keep working. The page only ever adds turns to the end of a conversation or takes them off the end (Claude checks that the conversation behind each of its thinking blocks is unchanged), so a save says how many stored messages stay (`keep`) and sends only the ones after them (`append`). Each save names the version it builds on (`base`). One made from an older copy, as when two devices answer in the same conversation without either seeing the other's turn, is refused with `409` and the current version; the page then keeps its own version as a new conversation,「…（副本）」, rather than overwrite anything.

The page keeps a copy of each conversation in the browser's `localStorage` too, under keys of the account's own, so it opens at once and survives a dropped connection: a save that fails is marked in the conversation list and goes up at the next chance. When the page comes back into view, it looks for what changed on other devices. Signing out on a device (*退出登录*, at the foot of the conversation list) ends the session there and clears the copies the cloud already has; anything not saved yet waits for the same account to sign in again.

The Workers free plan includes SQLite-backed Durable Objects: up to 5 GB stored across the account and 100,000 rows written a day, of which a turn takes three or four. Deploying creates the objects; there is nothing to set up for them.

## Files

A message can carry up to ten files: images (JPEG, PNG, GIF, WebP, up to 5 MB), PDFs (up to 30 MB) and plain text (up to 1 MB). The paperclip in the box you type in picks them, and they can be pasted or dragged in as well. The page makes an image at most 2,048 pixels on its long side, as a JPEG, unless it is already that small in one of those four kinds, and sends text files of any extension (`.md`, `.csv`, `.py` …) as plain text. Word, Excel and other documents aren't taken: the API doesn't read them.

Each file goes up as soon as it is picked, through `POST /files`, to the [Files API](https://platform.claude.com/docs/en/build-with-claude/files), which keeps it in the API key's workspace until it is deleted. The message then refers to it by id (`{ type: 'image' | 'document', source: { type: 'file', file_id } }`), so a conversation never carries the bytes, nothing is uploaded twice, and the file stays the same file for as long as the conversation lasts, which Claude's check on its thinking needs. The page keeps each file's name and size with the message, and a thumbnail of each image (a JPEG 240 pixels across) to draw it on any device; the full file never comes back. A file taken off before sending is deleted at once; deleting a conversation deletes the files it carried, unless a copy of it (「…（副本）」) carries them too. The Files API itself would read any file of the workspace for anyone who knew its id, so the user's store keeps a row for each file they upload, and the Worker turns away a message or a save that carries a file not theirs. Storing files costs nothing; Claude reads them as input tokens, every message that has them in its conversation: a few thousand for an image (a cent or two on Opus), roughly 1,500 to 3,000 a page for a PDF. The prompt cache makes the messages that follow within a few minutes much cheaper, and the cost under each reply says what each one came to.

## Setting it up

`.github/workflows/claude-chat.yml` deploys the Worker whenever this folder or `chat/chat.js` changes on `main`, with the same Cloudflare secrets as the golf coach and the All Square sync server.

1. Pick an invite code. Whoever has it can open an account, so make it long: four or five random words, or 16 random characters. Any characters work, Chinese included.
2. Store it as the repository secret `CHAT_PASSCODE` (Settings → Secrets and variables → Actions). `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `ANTHROPIC_API_KEY` should already be there, from the golf coach and All Square.
3. Actions → Claude chat server → Run workflow. The run's summary shows the Worker's address, `https://claude-chat.<subdomain>.workers.dev`, which should match `CHAT_ENDPOINT` in `chat/index.html`.
4. Open `https://wentaoz.com/chat/` and open your account first (*注册*), then give the invite code to whoever else should have one. On each device, sign in once; the page keeps the session in that browser's `localStorage`.

The chat uses the same key as the golf coach and All Square's receipt reading, and with it that key's workspace spend limit. To give the chat a key and a limit of its own, create another workspace and key in the [Anthropic Console](https://console.anthropic.com) and store the key as `CHAT_ANTHROPIC_API_KEY`; the workflow uses it in place of `ANTHROPIC_API_KEY`. The workflow uploads the key and the invite code with every deploy, so to change either, update the repository secret and run the workflow again. There is no limit on what one account can spend beyond the 20 requests a minute; the workspace's spend limit is the cap for everyone together.

To deploy by hand instead, in this folder:

```sh
npm install
npx wrangler login
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key when asked
npx wrangler secret put CHAT_PASSCODE       # and the invite code
npx wrangler deploy
```

To try it locally, put `ANTHROPIC_API_KEY=...` and `CHAT_PASSCODE=...` in a `.dev.vars` file here (it is git-ignored), run `npx wrangler dev --var DEV_ORIGINS:http://localhost:8000`, serve the repository with `python3 -m http.server 8000`, and point `CHAT_ENDPOINT` at `http://localhost:8787` without committing that. The local Durable Objects keep their accounts and conversations under `.wrangler/`, also git-ignored.

## Models, effort and cost

Each conversation uses the model and the effort picked above the box you type in; a change applies from the next message, new conversations start with what was picked last, and the conversation keeps both, on every device. `MODELS` in `chat/chat.js` lists the models with their own effort for chat, which the effort menu offers as *default*, and their prices, which the page uses for the cost under each reply:

| Model | Its own effort | US$ per million tokens in / out | Refusal fallback |
| --- | --- | --- | --- |
| Claude Fable 5.2 | medium | 8 / 40 | yes |
| Claude Opus 5.5 (the default) | low | 4 / 20 | yes |
| Claude Sonnet 5.5 | low | 2 / 10 | no |
| Claude Haiku 5.5 | low | 0.10 / 0.50, five times that past 100,000 tokens of prompt | no |

The effort menu also offers every level the models take: low, medium, high, xhigh and max. A higher level thinks longer before answering, so it answers more carefully, more slowly and at more cost: the thinking is billed as output. Since thinking counts towards `max_tokens`, the request allows 16,000 tokens at low, 32,000 at medium and high, and 64,000 at xhigh and max (`MAX_OUT` in `chat/chat.js`). At xhigh and max a reply can think for minutes before writing a word; the page counts the seconds meanwhile, and the Worker sends a blank line every 15 seconds so that the quiet connection isn't cut on the way. Stopping a reply stops the request to Claude too.

Every message sends the conversation so far, but the request caches it, so once a conversation passes the 512 tokens the cache needs, its earlier turns are re-read at a tenth to a fortieth of the price. Changing the effort starts that cache over once, for the next message. On Opus 5.5 at low effort a short exchange costs under a cent, and a message deep into a long conversation a cent or two. Fable 5.2 costs about twice that and thinks longer; Haiku 5.5, a few hundredths of a cent.

When Opus's or Fable's safety classifiers decline a message, the request runs it again on the model Anthropic recommends for that case. Haiku 5.5 has no such fallback, and Sonnet 5.5's would run on Claude Sonnet 5, which can't take the time notes the page sends as system messages, so a declined message there comes back to the box to be put another way. Fable 5.2 needs the API key's organization to keep data for 30 days; under zero data retention it answers with an error, and the other models still work. A conversation can change models at any time: the API drops the reasoning a model can't read and carries on.
