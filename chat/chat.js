// 闲聊 Small Talk: the private chat page at /chat/ and the Cloudflare Worker in workers/claude-chat
// both import this file. The page uses it to check a conversation before sending it; the Worker uses
// it to check it again, to shape the Claude request, and to check a conversation before storing it,
// so the models, the prompt and the limits live in one place and the Worker can only ever send
// requests shaped here. The rules for account names and passwords are here too.

// The models a conversation can use, most capable first. Effort is how long each thinks before
// answering: low keeps replies quick, and Fable's own guidance puts chat at medium. Opus and Fable
// retry a message their safety classifiers decline on the model Anthropic recommends for it
// (`fallbacks`). Haiku has no such fallback, and Sonnet's would land on Claude Sonnet 5, which
// doesn't take the time notes the page adds as system messages, so neither sends one.
// Prices are US$ per million tokens, for the cost the page shows under each reply; Haiku's go up
// fivefold for a prompt over 100,000 tokens.
export const MODELS = [
  { id: 'claude-fable-5-2', name: 'Fable 5.2', effort: 'medium', fallback: true,
    price: { input: 8, cacheWrite: 10, cacheRead: 0.2, output: 40 } },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', effort: 'low', fallback: true,
    price: { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 } },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', effort: 'low', fallback: false,
    price: { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 } },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', effort: 'low', fallback: false,
    price: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
    long: { over: 100000, input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 } },
];
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const modelInfo = (id) => MODELS.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT_MODEL);

// How long Claude thinks before answering, which a conversation can also set itself; '' leaves it to
// the model's own effort above. Thinking counts towards max_tokens, so the higher levels get more
// room: at xhigh and max a reply can think for minutes.
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const MAX_OUT = { low: 16000, medium: 32000, high: 32000, xhigh: 64000, max: 64000 };
export const effortOf = (x) => (EFFORTS.includes(x.effort) ? x.effort : modelInfo(x.model).effort);
const isEffort = (e) => e == null || e === '' || EFFORTS.includes(e);

// What a reply cost, from its usage: its tokens, and US$10 for every 1,000 web searches
export const SEARCH_PRICE = 0.01;
export function costOf(id, u) {
  if (!u) return undefined;
  const m = modelInfo(id);
  const read = u.cache_read_input_tokens || 0, write = u.cache_creation_input_tokens || 0, fresh = u.input_tokens || 0;
  const p = m.long && fresh + read + write > m.long.over ? m.long : m.price;
  const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  return (fresh * p.input + write * p.cacheWrite + read * p.cacheRead + (u.output_tokens || 0) * p.output) / 1e6 + searches * SEARCH_PRICE;
}

// Web search, which Anthropic runs while Claude answers: Claude decides when to search, at most
// MAX_SEARCHES times a reply, and cites what it uses. The results come back as part of the reply,
// encrypted, and go back with the conversation, unchanged, so Claude keeps them in later turns.
// This is the basic tool, which Claude calls directly; the later versions filter results by running
// code first, which suits long research better than a chat, and makes a reply carry its code too.
// A conversation's tools should never change once it has begun (see buildChatRequest): change them
// and every conversation so far loses the reasoning in its earlier turns, as it did when web search
// came, and again when web fetch did.
export const MAX_SEARCHES = 5;
const WEB_SEARCH = { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_SEARCHES };

// Web fetch, which Anthropic also runs: Claude opens a page whose address is in the conversation, one
// the user wrote or a search found, and reads it, at most MAX_FETCHES a reply. The page's text comes
// into the reply, cut to about FETCH_TOKENS tokens, and stays with the conversation like the search
// results, so these keep a conversation from growing too big to store or send. Fetching costs nothing
// but the tokens read. A PDF would come whole, as base64, however long, so the prompt sends links to
// PDFs to the link button, which attaches them as files. The basic tool, for the reason above.
export const MAX_FETCHES = 3;
const FETCH_TOKENS = 20000;
const WEB_FETCH = { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: MAX_FETCHES, max_content_tokens: FETCH_TOKENS };

export const MAX_TEXT = 40000;        // characters in one message the user types
const MAX_NOTE = 400;                 // characters in one of the page's time notes
const MAX_MESSAGES = 400;
const MAX_TOTAL = 3000000;            // characters of JSON in the whole conversation, reasoning included
export const MAX_STORED = 1000000;    // characters of JSON in one stored message, inside a row's 2 MB
const MAX_TITLE = 100;

// Files a message can carry: images, PDFs and plain text. The Worker uploads each to the Anthropic
// Files API once, and messages refer to it by id, so a conversation never carries the bytes and the
// thinking checks always see the same file. Images come already made smaller by the page, text as
// plain text whatever its extension.
export const FILE_KINDS = { 'image/jpeg': 'image', 'image/png': 'image', 'image/gif': 'image', 'image/webp': 'image', 'application/pdf': 'pdf', 'text/plain': 'text' };
export const MAX_FILE = { image: 5 * 1024 * 1024, pdf: 30 * 1024 * 1024, text: 1024 * 1024 };   // bytes
export const MAX_FILES = 10;          // on one message
export const FILE_ID = /^file_[A-Za-z0-9_-]{1,80}$/;

// Accounts: a name of 2 to 24 letters, digits, '.', '_' or '-' (Chinese included), told apart without
// regard to case, and a password of at least 8 characters. '' when they will do, else why not.
export const NAME = /^[\p{L}\p{N}._-]{2,24}$/u;
export const MIN_PASSWORD = 8;
export function checkAccount(name, password) {
  if (typeof name !== 'string' || !NAME.test(name)) return 'bad_name';
  if (typeof password !== 'string' || password.length < MIN_PASSWORD || password.length > 200) return 'weak_password';
  return '';
}

// For an upload: '' when it can go, else why not
export function checkUpload(type, size) {
  const kind = FILE_KINDS[type];
  if (!kind) return 'unsupported type';
  if (!(size > 0) || size > MAX_FILE[kind]) return 'too_big';
  return '';
}

const SYSTEM = `You are Claude, chatting with the user through a small private chat page on their personal website.

- Talk like a thoughtful friend: warm, natural and direct. Match the length of what they write: a short reply to a short message, more only when they ask for it or the question needs it.
- Reply in the language they write in. For Chinese, use Simplified Chinese unless they write Traditional.
- Plain conversational prose suits a chat best. Use Markdown (a list, a table, a code block naming its language) only when it helps. For math, write LaTeX: $…$ within a line, $$…$$ for a formula on its own. The page renders both.
- You can search the web, and read a web page whose address is in the conversation: one the user gave you, or one a search found. Search when the answer depends on something current or specific you may not know well (news, prices, weather, schedules, recent releases, a particular person, place or product), or when the user asks you to look something up; read a page when the user shares a link or asks about one; otherwise answer from what you know. Don't fetch a link to a PDF: ask the user to add it with the link button beside the paperclip, which attaches the PDF for you both to read. The page shows the pages you read, and lists the sources you cite below your reply. When you are unsure, say so rather than guessing.
- System messages in the conversation give the user's local date and time when they wrote.`;

const ROLES = ['user', 'assistant', 'system'];
const isText = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;

// A user's message: plain text, or the files it carries followed by its text, if any
const isFile = (b) => (b.type === 'image' || b.type === 'document') && b.source && b.source.type === 'file' &&
  FILE_ID.test(b.source.file_id) && (b.title == null || isText(b.title, 255));
const isUserContent = (c) => typeof c === 'string' ? isText(c, MAX_TEXT)
  : Array.isArray(c) && c.length > 0 && c.length <= MAX_FILES + 1 &&
    c.every((b, i) => b && (b.type === 'text' ? i === c.length - 1 && isText(b.text, MAX_TEXT) : i < MAX_FILES && isFile(b)));

// One message on its own: the time notes are plain text; Claude's replies are lists of content
// blocks, kept exactly as they came, thinking included
function checkMessage(msg) {
  if (!msg || !ROLES.includes(msg.role)) return 'bad role';
  if (msg.role === 'user' && !isUserContent(msg.content)) return 'bad user message';
  if (msg.role === 'system' && !isText(msg.content, MAX_NOTE)) return 'bad note';
  if (msg.role === 'assistant' && !(Array.isArray(msg.content) && msg.content.length &&
    msg.content.every((b) => b && typeof b === 'object' && typeof b.type === 'string'))) return 'bad reply';
  return '';
}

// A reply the API paused in the middle of searching, which a request sends back to have it carry on
const isPaused = (m) => m.role === 'assistant' && Array.isArray(m.content) && m.content.some((b) => b && b.type === 'server_tool_use');

// Returns a short reason when the conversation can't be sent, or '' when it is fine.
// The page sends { model, effort, messages }: the conversation as the API sees it, ending with the
// user's new message, a time note after it, or a reply paused partway (stop reason pause_turn).
export function checkChatInput(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.messages)) return 'bad input';
  if (x.model != null && !MODELS.some((m) => m.id === x.model)) return 'bad model';
  if (!isEffort(x.effort)) return 'bad effort';
  const m = x.messages;
  if (!m.length) return 'no messages';
  if (m.length > MAX_MESSAGES) return 'too_long';
  if (m[0].role !== 'user') return 'first message not the user’s';
  if (m[m.length - 1].role === 'assistant' && !isPaused(m[m.length - 1])) return 'nothing to answer';
  for (let i = 0; i < m.length; i++) {
    const problem = checkMessage(m[i]);
    if (problem) return problem;
    // The API takes a system message right after a user message, and only last or before a reply
    if (m[i].role === 'system' && (m[i - 1].role !== 'user' || (i < m.length - 1 && m[i + 1].role !== 'assistant'))) return 'bad note';
  }
  if (JSON.stringify(m).length > MAX_TOTAL) return 'too_long';
  return '';
}

// The parameters for client.beta.messages.stream(). Every model here thinks adaptively; effort sets
// how much. Its thinking comes back as a summary, which the page shows folded above the reply; the
// summary costs nothing extra, as the thinking is billed the same either way. The top-level
// cache_control caches the conversation so far, so each turn re-reads the earlier ones at a tenth to
// a fortieth of the price; a change of effort starts that cache over once.
//
// Each thinking block the models write is bound to everything before it: the system prompt, the
// tools and the earlier messages. Change any of them and the block no longer fits, which on these
// models is an error unless the request says to drop such blocks instead. The page only ever adds to
// a conversation or takes turns off its end, so that happens only when this file's prompt or tools
// change, as when web search and web fetch came: conversations from before carry on, without the
// reasoning of their earlier turns.
export function buildChatRequest(x) {
  const m = modelInfo(x.model), effort = effortOf(x);
  const req = {
    model: m.id,
    max_tokens: MAX_OUT[effort],
    thinking: { type: 'adaptive', display: 'summarized', block_binding: { prefix_mismatch_behavior: 'drop_block' } },
    output_config: { effort },
    cache_control: { type: 'ephemeral' },
    tools: [WEB_SEARCH, WEB_FETCH],
    system: SYSTEM,
    messages: x.messages.map(({ role, content }) => ({ role, content })),
    betas: ['thinking-binding-controls-2026-08-01'],
  };
  if (m.fallback) {
    req.betas.push('server-side-fallback-2026-07-01');
    req.fallbacks = 'default';
  }
  return req;
}

// A save the page sends to store a conversation: { base, keep, append, title, model, effort }, the
// version it builds on, how many of the stored messages stay, and the messages that follow them. The messages
// keep the page's own fields (when, which model, what it cost), so another device draws them the same.
export function checkSave(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.append)) return 'bad input';
  if (!Number.isInteger(x.base) || x.base < 0 || !Number.isInteger(x.keep) || x.keep < 0) return 'bad version';
  if (typeof x.title !== 'string' || x.title.length > MAX_TITLE) return 'bad title';
  if (!MODELS.some((m) => m.id === x.model)) return 'bad model';
  if (!isEffort(x.effort)) return 'bad effort';
  if (x.keep + x.append.length > MAX_MESSAGES) return 'too_long';
  for (const msg of x.append) {
    const problem = checkMessage(msg);
    if (problem) return problem;
    if (JSON.stringify(msg).length > MAX_STORED) return 'too_long';
  }
  return '';
}
