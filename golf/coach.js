// The AI coach behind 挥杆镜 Swing Mirror: turns the four key frames and the measurements into one
// Claude request. Both the page (when a visitor brings their own API key) and the Cloudflare Worker
// in workers/golf-coach (when the site pays) import this file, so the prompt lives in one place and
// the Worker only ever sends requests shaped by it.

// Claude Opus 5.5. Sonnet 5.5 costs about half as much; Haiku 5.5 a small fraction, and it has no
// fallback model, so `fallbacks` below simply does nothing there.
export const COACH_MODEL = 'claude-opus-5-5';
export const PHASES = ['address', 'top', 'impact', 'finish'];
const MAX_IMAGE = 900000;   // characters of base64 per frame, about 650 KB of JPEG
const MAX_NOTES = 600;
const MAX_FINDINGS = 16;

const SYSTEM = `You are an experienced golf coach giving a remote lesson. A player filmed one swing on a phone. Their browser picked four still frames from it (address, top of the backswing, impact, finish) and measured the swing with a 2D pose model. You get the frames and the measurements.

How to read the evidence:
- The measurements come from body landmarks only. The pose model does not see the club or the ball, and centimetre values assume typical adult proportions, so treat every number as a rough hint. When a frame clearly contradicts a number, trust the frame and say so.
- Look at the club, the clubface and the ball in the frames only where they are clearly visible. Do not guess at what you cannot see.
- A frame picked a fraction of a second off the exact moment is normal; allow for it.

What to write:
1. One sentence on the overall swing.
2. The two or three changes that would help this player most, most important first. For each: what you see, naming the frame; why it costs them (ball flight, contact, consistency or strain); one drill with a number of reps; and one short feel or cue for the course.
3. One or two things that are already good and worth keeping.
4. If the camera angle, framing or blur limited what you could judge, say in one line how to film the next swing.

Keep it under about 400 words (about 700 characters in Chinese). Use ### headings and short bullet lists; no tables. Write in the language the player asks for. If the player mentions pain or an injury, suggest they see a professional before practising through it.`;

const VIEW_TEXT = {
  face: 'face-on (camera in front of the player, facing their chest)',
  dtl: 'down the line (camera behind the player, looking along the target line)',
};
const PHASE_TEXT = { address: 'address', top: 'top of the backswing', impact: 'impact', finish: 'finish' };
const LANG_TEXT = { zh: 'Simplified Chinese', en: 'English' };

const isText = (s, max) => typeof s === 'string' && s.length <= max;

// One measurement from swing.js, in plain English for the model
export function findingText(m) {
  const v = m.value;
  switch (m.id) {
    case 'tempo': return `Backswing to downswing time ratio ${v} : 1 (tour players are near 3 : 1).`;
    case 'headHeight': return `Head ${m.dir === 'up' ? 'rose' : 'dropped'} about ${Math.abs(v)} cm from address to impact.`;
    case 'headSway': return m.dir === 'toward'
      ? `Head moved about ${v} cm towards the target on the backswing (reverse-pivot sign).`
      : `Head moved about ${v} cm away from the target on the backswing.`;
    case 'headImpact': return `Head was about ${v} cm closer to the target at impact than at address.`;
    case 'hipSway': return `Hips slid about ${v} cm away from the target on the backswing.`;
    case 'hipShift': return `Hips were about ${v} cm closer to the target at impact than at address.`;
    case 'spineTilt': return `Spine tilted about ${v}° away from the target at address (negative means towards it).`;
    case 'finishBalance': return `At the finish the hips were ${v}% of the way from the trail foot to the lead foot.`;
    case 'spineAddress': return `Forward bend of the trunk at address about ${v}° from vertical.`;
    case 'spineKeep': return `Forward bend changed by ${v}° from address to impact (negative means more upright).`;
    case 'earlyExt': return `Hips moved about ${v} cm towards the ball by impact.`;
    case 'headToBall': return `Head moved about ${v} cm towards the ball by impact.`;
    case 'leadArm': return `Lead arm angle at the top about ${v}° (180° is straight; 2D estimate).`;
    case 'backswing': return `Backswing length: ${m.dir === 'full' ? 'hands above the shoulders at the top' : m.dir === 'three' ? 'hands about level with the shoulders at the top' : 'hands below the shoulders at the top'}.`;
    default: return `${m.id}: ${v} ${m.unit}`;
  }
}

// Returns a short reason when the input can't be sent, or '' when it is fine.
export function checkCoachInput(x) {
  if (!x || typeof x !== 'object') return 'bad input';
  if (!(x.lang in LANG_TEXT)) return 'bad lang';
  if (!(x.view in VIEW_TEXT)) return 'bad view';
  if (x.hand !== 'right' && x.hand !== 'left') return 'bad hand';
  if (x.notes != null && !isText(x.notes, MAX_NOTES)) return 'notes too long';
  if (x.tempo != null && !isText(x.tempo, 200)) return 'bad tempo';
  if (!Array.isArray(x.findings) || x.findings.length > MAX_FINDINGS) return 'bad findings';
  for (const f of x.findings) {
    if (!f || !['good', 'watch', 'fix', 'info'].includes(f.status) || !isText(f.text, 240)) return 'bad finding';
  }
  if (!Array.isArray(x.frames) || x.frames.length < 1 || x.frames.length > PHASES.length) return 'bad frames';
  const seen = new Set();
  for (const f of x.frames) {
    if (!f || !PHASES.includes(f.phase) || seen.has(f.phase)) return 'bad frame';
    seen.add(f.phase);
    if (!isText(f.jpeg, MAX_IMAGE) || !/^[A-Za-z0-9+/]+=*$/.test(f.jpeg)) return 'bad image';
  }
  return '';
}

// The parameters for client.beta.messages.stream(). Opus 5.5 always thinks adaptively; effort
// "medium" is its default, set here so it doesn't change under us. The fallback re-runs a request
// on another model if Opus's safety classifiers decline it.
export function buildCoachRequest(x) {
  const content = [];
  for (const f of x.frames) {
    content.push({ type: 'text', text: `Frame: ${PHASE_TEXT[f.phase]}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.jpeg } });
  }
  const lines = [
    `Camera: ${VIEW_TEXT[x.view]}.`,
    `Player: ${x.hand}-handed.`,
  ];
  if (x.tempo) lines.push(`Tempo: ${x.tempo}`);
  if (x.findings.length) {
    lines.push('', 'Measurements, each marked good / watch / fix by simple thresholds:');
    for (const f of x.findings) lines.push(`- [${f.status}] ${f.text}`);
  }
  if (x.notes && x.notes.trim()) lines.push('', `The player adds: "${x.notes.trim()}"`);
  lines.push('', `Reply in ${LANG_TEXT[x.lang]}.`);
  content.push({ type: 'text', text: lines.join('\n') });

  return {
    model: COACH_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  };
}
