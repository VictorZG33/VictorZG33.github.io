// 闲聊 Small Talk: the private chat page at /chat/ and the Cloudflare Worker in workers/claude-chat
// both import this file. The page uses it to check a conversation before sending it; the Worker uses
// it to check it again, to shape the Claude request, and to check a conversation before storing it,
// so the models, the prompt and the limits live in one place and the Worker can only ever send
// requests shaped here.

// The models a conversation can use, most capable first. Effort is how long each thinks before
// answering: low keeps replies quick, and Fable's own guidance puts chat at medium. Opus and Fable
// retry a message their safety classifiers decline on the model Anthropic recommends for it
// (`fallbacks`). Haiku has no such fallback, and Sonnet's would land on Claude Sonnet 5, which
// doesn't take the time notes the page adds as system messages, so neither sends one.
// Prices are US$ per million tokens, for the cost the page shows under each reply; Haiku's go up
// fivefold for a prompt over 100,000 tokens.
export const MODELS = [
  { id: 'claude-fable-5-2', name: 'Fable 5.2', note: '最聪明，贵一倍', effort: 'medium', fallback: true,
    price: { input: 8, cacheWrite: 10, cacheRead: 0.2, output: 40 } },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', note: '默认', effort: 'low', fallback: true,
    price: { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 } },
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', note: '便宜一半', effort: 'low', fallback: false,
    price: { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 } },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', note: '最快，几乎不花钱', effort: 'low', fallback: false,
    price: { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
    long: { over: 100000, input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 } },
];
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const modelInfo = (id) => MODELS.find((m) => m.id === id) || MODELS.find((m) => m.id === DEFAULT_MODEL);

// What a reply cost, from its usage
export function costOf(id, u) {
  if (!u) return undefined;
  const m = modelInfo(id);
  const read = u.cache_read_input_tokens || 0, write = u.cache_creation_input_tokens || 0, fresh = u.input_tokens || 0;
  const p = m.long && fresh + read + write > m.long.over ? m.long : m.price;
  return (fresh * p.input + write * p.cacheWrite + read * p.cacheRead + (u.output_tokens || 0) * p.output) / 1e6;
}

export const MAX_TEXT = 40000;        // characters in one message the user types
const MAX_NOTE = 400;                 // characters in one of the page's time notes
const MAX_MESSAGES = 400;
const MAX_TOTAL = 3000000;            // characters of JSON in the whole conversation, reasoning included
const MAX_STORED = 1000000;           // characters of JSON in one stored message, well inside a row's 8 MB
const MAX_TITLE = 100;

const SYSTEM = `You are Claude, chatting with the user through a small private chat page on their personal website.

- Talk like a thoughtful friend: warm, natural and direct. Match the length of what they write: a short reply to a short message, more only when they ask for it or the question needs it.
- Reply in the language they write in. For Chinese, use Simplified Chinese unless they write Traditional.
- Plain conversational prose suits a chat best. Use Markdown (a list, a table, a code block) only when it helps. The page does not render LaTeX, so write any formula in plain text with Unicode symbols (x², √, ≈, →).
- You cannot browse the web, and this chat has no other tools. For recent events, say what you know and that it may be out of date. When you are unsure, say so rather than guessing.
- System messages in the conversation give the user's local date and time when they wrote.`;

const ROLES = ['user', 'assistant', 'system'];
const isText = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;

// One message on its own: the user's messages and the time notes are plain text; Claude's replies
// are lists of content blocks, kept exactly as they came, thinking included
function checkMessage(msg) {
  if (!msg || !ROLES.includes(msg.role)) return 'bad role';
  if (msg.role === 'user' && !isText(msg.content, MAX_TEXT)) return 'bad user message';
  if (msg.role === 'system' && !isText(msg.content, MAX_NOTE)) return 'bad note';
  if (msg.role === 'assistant' && !(Array.isArray(msg.content) && msg.content.length &&
    msg.content.every((b) => b && typeof b === 'object' && typeof b.type === 'string'))) return 'bad reply';
  return '';
}

// Returns a short reason when the conversation can't be sent, or '' when it is fine.
// The page sends { model, messages }: the conversation as the API sees it, ending with the user's new
// message or with a time note after it.
export function checkChatInput(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.messages)) return 'bad input';
  if (x.model != null && !MODELS.some((m) => m.id === x.model)) return 'bad model';
  const m = x.messages;
  if (!m.length) return 'no messages';
  if (m.length > MAX_MESSAGES) return 'too_long';
  if (m[0].role !== 'user') return 'first message not the user’s';
  if (m[m.length - 1].role === 'assistant') return 'nothing to answer';
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
// how much. The top-level cache_control caches the conversation so far, so each turn re-reads the
// earlier ones at a tenth to a fortieth of the price.
export function buildChatRequest(x) {
  const m = modelInfo(x.model);
  const req = {
    model: m.id,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: m.effort },
    cache_control: { type: 'ephemeral' },
    system: SYSTEM,
    messages: x.messages.map(({ role, content }) => ({ role, content })),
  };
  if (m.fallback) {
    req.betas = ['server-side-fallback-2026-07-01'];
    req.fallbacks = 'default';
  }
  return req;
}

// A save the page sends to store a conversation: { base, keep, append, title, model }, the version it
// builds on, how many of the stored messages stay, and the messages that follow them. The messages
// keep the page's own fields (when, which model, what it cost), so another device draws them the same.
export function checkSave(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.append)) return 'bad input';
  if (!Number.isInteger(x.base) || x.base < 0 || !Number.isInteger(x.keep) || x.keep < 0) return 'bad version';
  if (typeof x.title !== 'string' || x.title.length > MAX_TITLE) return 'bad title';
  if (!MODELS.some((m) => m.id === x.model)) return 'bad model';
  if (x.keep + x.append.length > MAX_MESSAGES) return 'too_long';
  for (const msg of x.append) {
    const problem = checkMessage(msg);
    if (problem) return problem;
    if (JSON.stringify(msg).length > MAX_STORED) return 'too_long';
  }
  return '';
}
