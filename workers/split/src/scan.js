/* POST /scan for 两清 All Square (wentaoz.com/split/): Claude reads a note ("昨晚晚饭 Alice 付了 $240，四个人分，
   Bob 没喝酒少算 20") or a receipt photo and returns who paid, how much and who shares it. Claude only reads;
   the page does the arithmetic, turns the answer into ordinary equal-split expenses and puts each in its form
   for the person to check before saving, so nothing here touches a ledger.

   It runs on the site's own Anthropic key, the ANTHROPIC_API_KEY secret, which the golf coach uses too. */
import Anthropic from '@anthropic-ai/sdk';

// Claude Opus 5.5 at low effort: reading a sentence or a receipt is quick work, and people are waiting at the table
export const SCAN_MODEL = 'claude-opus-5-5';
const EFFORT = 'low';
export const MAX_SCAN_BYTES = 2000000;
const MAX_TEXT = 500;
const MAX_IMAGE = 1800000;   // characters of base64, about 1.3 MB of JPEG; the page sends a few hundred kB
const MAX_PEOPLE = 50, MAX_NAME = 24;
const CURRENCIES = ['¥', '$', '€', '£'];
const LANG_TEXT = { zh: 'Simplified Chinese', en: 'English' };

const SYSTEM = `You read notes and receipt photos for a bill-splitting app that a group of friends uses on trips. Turn what you're given into the shared expenses it describes, so the app can fill in its form for the person to check.

The request lists the people in the group. Refer to them only by those exact names. Match a nickname, a different capitalisation, pinyin or another script to a listed name when the match is clear. Put anyone mentioned who isn't on the list in unknown_names and leave them out of the expense.

For each expense:
- what: a short label of a few words in the language of the note, such as 晚饭 or Taxi. For a receipt without a note, the shop's name or what was bought.
- total: the full amount paid, in the currency's units. On a receipt, use the final total with tax and tip, not the subtotal. If the note adds a tip or names another amount, follow the note.
- payer: the name of who paid, or null when neither the note nor the receipt says. Words like "I" or "我" don't say who is writing, so use null and mention it in note.
- sharers: who shares the expense, or null for everyone in the group. If the note gives only a head count ("四个人分") that differs from the size of the group, use null and say in note that they should tick who shared it.
- items: parts of the total that only some people share, such as wine that only some of them drank. Each has a label, an amount and its sharers. The rest of the total is split among the sharers. Leave it empty unless some part is shared differently, and don't copy every line of a receipt.
- adjustments: people who pay a fixed amount more (positive) or less (negative) than an equal share of what remains after items. "Bob 少算 20" is {"person": "Bob", "amount": -20}. Leave it empty otherwise.
Don't work out anyone's share yourself; the app does the arithmetic.

currency: the currency the amounts are in if the note or receipt shows it (¥ for yuan or yen, $, €, £), else null.
note: one or two short sentences for the person, in the reply language, about anything they should check: an amount that was hard to read, a guessed payer, a name you couldn't match. Use an empty string when everything is clear.

If there is no expense in what you're given, return an empty expenses list and say why in note.`;

const nameList = { type: 'array', items: { type: 'string' } };
const SCHEMA = {
  type: 'object',
  properties: {
    expenses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          what: { type: 'string', description: 'A short label, a few words' },
          total: { type: 'number', description: 'Full amount paid, in currency units' },
          payer: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'A listed name, or null when unknown' },
          sharers: { anyOf: [nameList, { type: 'null' }], description: 'Listed names, or null for everyone' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' }, amount: { type: 'number' }, sharers: nameList },
              required: ['label', 'amount', 'sharers'],
              additionalProperties: false,
            },
          },
          adjustments: {
            type: 'array',
            items: {
              type: 'object',
              properties: { person: { type: 'string' }, amount: { type: 'number', description: 'More (+) or less (-) than an equal share' } },
              required: ['person', 'amount'],
              additionalProperties: false,
            },
          },
        },
        required: ['what', 'total', 'payer', 'sharers', 'items', 'adjustments'],
        additionalProperties: false,
      },
    },
    currency: { anyOf: [{ type: 'string', enum: CURRENCIES }, { type: 'null' }] },
    unknown_names: nameList,
    note: { type: 'string' },
  },
  required: ['expenses', 'currency', 'unknown_names', 'note'],
  additionalProperties: false,
};

const isText = (s, max) => typeof s === 'string' && s.length <= max;

// What the page sends: {lang, people: [names], currency, text?, image?: base64 JPEG}. '' when fine, else why not.
export function checkScanInput(x) {
  if (!x || typeof x !== 'object') return 'bad input';
  if (!(x.lang in LANG_TEXT)) return 'bad lang';
  if (!CURRENCIES.includes(x.currency)) return 'bad currency';
  if (!Array.isArray(x.people) || !x.people.length || x.people.length > MAX_PEOPLE) return 'bad people';
  if (!x.people.every((p) => isText(p, MAX_NAME) && p.trim())) return 'bad name';
  if (x.text != null && !isText(x.text, MAX_TEXT)) return 'text too long';
  if (x.image != null && (!isText(x.image, MAX_IMAGE) || !/^[A-Za-z0-9+/]+=*$/.test(x.image))) return 'bad image';
  if (!(x.text && x.text.trim()) && !x.image) return 'nothing to read';
  return '';
}

// The parameters for client.beta.messages.create(). Opus 5.5 always thinks adaptively; the fallback re-runs
// the request on another model if Opus's safety classifiers decline it.
export function buildScanRequest(x) {
  const content = [];
  if (x.image) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: x.image } });
  const lines = [
    `Group: ${x.people.join(', ')}`,
    `The ledger's currency: ${x.currency}`,
    x.text && x.text.trim() ? `Note: "${x.text.trim()}"` : 'No note; read the receipt.',
    `Reply language: ${LANG_TEXT[x.lang]}`,
  ];
  content.push({ type: 'text', text: lines.join('\n') });
  return {
    model: SCAN_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  };
}

/* 200 {result} with the schema's object; 403 from another site; 503 not_configured without the key;
   429 rate_limited; 400/413 for bad input; 422 refused; 502 when Claude can't be reached or answers badly */
export async function scan(request, env, allowed, reply) {
  // Browsers always send Origin on a cross-site POST; this keeps other websites from using the key. It
  // doesn't stop scripts that fake the header, which is what the rate limit and the key's spend limit are for.
  if (!allowed) return reply(403, { error: 'origin not allowed' });
  if (!env.ANTHROPIC_API_KEY) return reply(503, { error: 'not_configured' });
  if (env.SCAN_LIMIT) {
    const { success } = await env.SCAN_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    if (!success) return reply(429, { error: 'rate_limited' });
  }
  const text = await request.text();
  if (text.length > MAX_SCAN_BYTES) return reply(413, { error: 'too large' });
  let input;
  try { input = JSON.parse(text); } catch (e) { return reply(400, { error: 'bad json' }); }
  const problem = checkScanInput(input);
  if (problem) return reply(400, { error: problem });

  // ANTHROPIC_BASE_URL is only for trying the Worker locally against a stand-in for the API
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined });
  let message;
  try {
    message = await client.beta.messages.create(buildScanRequest(input));
  } catch (e) {
    return reply(502, { error: 'upstream', status: e instanceof Anthropic.APIError ? e.status || null : null });
  }
  if (message.stop_reason === 'refusal') return reply(422, { error: 'refused' });
  const block = message.content.find((b) => b.type === 'text');
  if (message.stop_reason !== 'end_turn' || !block) return reply(502, { error: 'incomplete' });
  try { return reply(200, { result: JSON.parse(block.text) }); } catch (e) { return reply(502, { error: 'bad output' }); }
}
