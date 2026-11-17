// 闲聊 Small Talk: the private chat page at /chat/ and the Cloudflare Worker in workers/claude-chat
// both import this file. The page uses it to check a conversation before sending it; the Worker uses
// it to check it again and to shape the Claude request, so the model, the prompt and the limits live
// in one place and the Worker can only ever send requests shaped here.

// Claude Opus 5.5 at low effort: quick replies for conversation. Effort "medium" (the model's
// default) or "high" thinks longer before answering, for harder questions, at more cost and latency.
export const CHAT_MODEL = 'claude-opus-5-5';
const CHAT_EFFORT = 'low';
// US$ per million tokens for CHAT_MODEL, for the cost the page shows under each reply
export const PRICE = { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 };

export const MAX_TEXT = 40000;        // characters in one message the user types
const MAX_NOTE = 400;                 // characters in one of the page's time notes
const MAX_MESSAGES = 400;
const MAX_TOTAL = 3000000;            // characters of JSON in the whole conversation, reasoning included

const SYSTEM = `You are Claude, chatting with the user through a small private chat page on their personal website.

- Talk like a thoughtful friend: warm, natural and direct. Match the length of what they write: a short reply to a short message, more only when they ask for it or the question needs it.
- Reply in the language they write in. For Chinese, use Simplified Chinese unless they write Traditional.
- Plain conversational prose suits a chat best. Use Markdown (a list, a table, a code block) only when it helps. The page does not render LaTeX, so write any formula in plain text with Unicode symbols (x², √, ≈, →).
- You cannot browse the web, and this chat has no other tools. For recent events, say what you know and that it may be out of date. When you are unsure, say so rather than guessing.
- System messages in the conversation give the user's local date and time when they wrote.`;

const ROLES = ['user', 'assistant', 'system'];
const isText = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;

// Returns a short reason when the conversation can't be sent, or '' when it is fine.
// The page sends { messages }: the conversation as the API sees it, ending with the user's new
// message or with a time note after it. The user's messages and the notes are plain text; Claude's
// replies go back exactly as they came, as lists of content blocks with their thinking.
export function checkChatInput(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.messages)) return 'bad input';
  const m = x.messages;
  if (!m.length) return 'no messages';
  if (m.length > MAX_MESSAGES) return 'too_long';
  if (m[0].role !== 'user') return 'first message not the user’s';
  if (m[m.length - 1].role === 'assistant') return 'nothing to answer';
  for (let i = 0; i < m.length; i++) {
    const msg = m[i];
    if (!msg || !ROLES.includes(msg.role)) return 'bad role';
    if (msg.role === 'user' && !isText(msg.content, MAX_TEXT)) return 'bad user message';
    // The API takes a system message right after a user message, and only last or before a reply
    if (msg.role === 'system' && (!isText(msg.content, MAX_NOTE) || m[i - 1].role !== 'user' ||
      (i < m.length - 1 && m[i + 1].role !== 'assistant'))) return 'bad note';
    if (msg.role === 'assistant' && !(Array.isArray(msg.content) && msg.content.length &&
      msg.content.every((b) => b && typeof b === 'object' && typeof b.type === 'string'))) return 'bad reply';
  }
  if (JSON.stringify(m).length > MAX_TOTAL) return 'too_long';
  return '';
}

// The parameters for client.beta.messages.stream(). Opus 5.5 always thinks adaptively; effort sets
// how much. The top-level cache_control caches the conversation so far, so each turn re-reads the
// earlier ones at a twentieth of the price. If Opus's safety classifiers decline a message, the
// fallback runs it again on the model Anthropic recommends for that case.
export function buildChatRequest(x) {
  return {
    model: CHAT_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: CHAT_EFFORT },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    system: SYSTEM,
    messages: x.messages.map(({ role, content }) => ({ role, content })),
  };
}
