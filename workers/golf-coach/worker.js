// Cloudflare Worker that lets visitors of wentaoz.com/golf/ use the AI coach on the site's own
// Anthropic API key, which is what the page does unless a visitor chooses to use their own key. The
// key stays here as a secret; the page only ever sees the coaching text.
//
// It accepts the coach input the page builds (four JPEG frames and the measurements), checks it,
// shapes the Claude request with the same code the page uses (golf/coach.js), and streams the
// answer back. See README.md in this folder for deployment.

import Anthropic from '@anthropic-ai/sdk';
import { buildCoachRequest, checkCoachInput } from '../../golf/coach.js';

const ORIGINS = ['https://wentaoz.com', 'https://www.wentaoz.com'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const fail = (status, error) => Response.json({ error }, { status, headers: cors });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return fail(405, 'POST only');
    // Browsers always send Origin on a cross-site POST; this keeps other websites from using the key.
    // It does not stop scripts that fake the header, which is what the rate limit and the spend limit
    // on the Anthropic key are for.
    if (!ORIGINS.includes(origin)) return fail(403, 'origin not allowed');
    // The page reads this as "the site's coach is off" and points the visitor to their own key
    if (!env.ANTHROPIC_API_KEY) return fail(503, 'not_configured');

    if (env.COACH_LIMIT) {
      const { success } = await env.COACH_LIMIT.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
      if (!success) return fail(429, 'rate_limited');
    }

    let input;
    try { input = await request.json(); } catch { return fail(400, 'bad json'); }
    const problem = checkCoachInput(input);
    if (problem) return fail(400, problem);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const stream = client.beta.messages.stream(buildCoachRequest(input));
    try {
      await stream.withResponse();   // surfaces an API error (bad key, overload) before any bytes go out
    } catch (e) {
      return fail(e instanceof Anthropic.APIError && e.status ? e.status : 502, e instanceof Anthropic.APIError ? e.message : 'upstream error');
    }
    // Newline-delimited events, read on the page with BetaMessageStream.fromReadableStream()
    return new Response(stream.toReadableStream(), { headers: { ...cors, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
  },
};
