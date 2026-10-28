// Swing analysis for 挥杆镜 Swing Mirror: finds the phases of one golf swing in a series of pose
// landmarks and measures it. No DOM here, so the page and node (for testing) both load this file.
//
// Input: frames = [{ t: seconds, lm: [[x, y, visibility] × 33] in video pixels, or null }], sampled
// evenly through the clip. Landmark numbering is MediaPipe Pose's (0 nose, 11/12 shoulders,
// 13/14 elbows, 15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, 29/30 heels, 31/32 toes).
// Image y grows downwards, so "higher" means a smaller y.

export const P = { nose: 0, lSh: 11, rSh: 12, lEl: 13, rEl: 14, lWr: 15, rWr: 16, lHip: 23, rHip: 24,
  lKnee: 25, rKnee: 26, lAnk: 27, rAnk: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 };

// Lines drawn between landmarks for the skeleton overlay
export const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32]];

// Real sizes the pixel measurements are scaled by. Face-on the shoulders are seen at full width;
// down the line the trunk is seen side-on at full length. Both are typical adult values, so every
// centimetre figure is an estimate.
const SHOULDER_CM = 36;   // between the two shoulder joints
const TRUNK_CM = 48;      // mid-hip to mid-shoulder

const HIGH = 0.6;         // hands this many trunk lengths above the hips count as "up" (backswing, finish)
const LOW = 0.25;         // the dip between the two must come back down below this

const VIEWS = ['face', 'dtl'];

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const deg = (r) => r * 180 / Math.PI;
function angleAt(a, b, c) {   // angle ABC in degrees
  const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
  const d = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  return d ? deg(Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / d)))) : 180;
}
function median(xs) { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; }

// Fill frames where no pose was found by interpolating each landmark between its neighbours,
// then smooth every coordinate with a centred moving average of 2r+1 frames.
function prepare(frames, r) {
  const n = frames.length, have = [];
  frames.forEach((f, i) => { if (f.lm) have.push(i); });
  if (have.length < Math.max(8, n * 0.6)) return null;
  const raw = frames.map((f, i) => {
    if (f.lm) return f.lm;
    let k = have.findIndex((j) => j > i);
    if (k === -1) return frames[have[have.length - 1]].lm;
    if (k === 0) return frames[have[0]].lm;
    const a = have[k - 1], b = have[k], w = (i - a) / (b - a);
    return frames[a].lm.map((p, m) => { const q = frames[b].lm[m]; return [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, 0]; });
  });
  return raw.map((_, i) => raw[i].map((p, m) => {
    let x = 0, y = 0, c = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(n - 1, i + r); j++) { x += raw[j][m][0]; y += raw[j][m][1]; c++; }
    return [x / c, y / c, raw[i][m][2]];
  }));
}

// Mean of a point over frames i-r..i+r, for the still moments (address, finish)
function steady(get, i, r, n) {
  let x = 0, y = 0, c = 0;
  for (let j = Math.max(0, i - r); j <= Math.min(n - 1, i + r); j++) { const p = get(j); x += p[0]; y += p[1]; c++; }
  return [x / c, y / c];
}

export function analyzeSwing(frames, opts = {}) {
  const n = frames.length;
  if (n < 12) return { ok: false, error: 'too_short' };
  const dt = (frames[n - 1].t - frames[0].t) / (n - 1);
  const lm = prepare(frames, 1);
  if (!lm) return { ok: false, error: 'no_person' };

  const pt = (i, k) => lm[i][k];
  const hands = (i) => mid(lm[i][P.lWr], lm[i][P.rWr]);
  const shoulders = (i) => mid(lm[i][P.lSh], lm[i][P.rSh]);
  const hips = (i) => mid(lm[i][P.lHip], lm[i][P.rHip]);
  const ankles = (i) => mid(lm[i][P.lAnk], lm[i][P.rAnk]);
  const head = (i) => lm[i][P.nose];

  const trunk = median(lm.map((_, i) => dist(shoulders(i), hips(i))));
  if (!(trunk > 8)) return { ok: false, error: 'no_person' };

  // Hand height above the hips, in trunk lengths
  const h = lm.map((_, i) => (hips(i)[1] - hands(i)[1]) / trunk);

  // ---- the swing: a hump of raised hands (backswing), a dip (impact), another hump (finish) ----
  const humps = [];
  for (let i = 0; i < n; i++) {
    if (h[i] > HIGH && (i === 0 || h[i - 1] <= HIGH)) humps.push({ a: i, b: i });
    if (h[i] > HIGH) humps[humps.length - 1].b = i;
  }
  let best = null, late = false;
  for (let k = 0; k < humps.length; k++) {
    const up = humps[k], next = humps[k + 1];
    if (up.a === 0) { late = true; continue; }   // the clip starts with the hands already up: no address to measure from
    const end = next ? next.a : n - 1;
    // Impact: the middle of the moment the hands are lowest
    let imp = -1;
    for (let i = up.b + 1; i <= end; i++) if (imp === -1 || h[i] < h[imp]) imp = i;
    if (imp === -1 || h[imp] > LOW) continue;
    { let a = imp, b = imp; const lim = h[imp] + 0.015;
      while (a > up.b + 1 && h[a - 1] <= lim) a--;
      while (b < end && h[b + 1] <= lim) b++;
      imp = Math.round((a + b) / 2); }
    let top = up.a;
    for (let i = up.a; i <= up.b; i++) if (h[i] > h[top]) top = i;
    const speed = (h[top] - h[imp]) / ((imp - top) * dt);
    if (!best || speed > best.speed) best = { k, top, imp, speed };
  }
  if (!best) return { ok: false, error: late ? 'starts_late' : 'no_swing' };

  // The top is the middle of the moment the hands hang highest
  let top = best.top;
  { let a = top, b = top; const lim = h[top] - 0.03;
    while (a > humps[best.k].a && h[a - 1] >= lim) a--;
    while (b < humps[best.k].b && h[b + 1] >= lim) b++;
    top = Math.round((a + b) / 2); }
  const impact = best.imp;

  // Address: the stillest stretch of low hands before the backswing. Prefer the latest such stretch,
  // so a waggle or a step-in earlier in the clip doesn't count.
  const upStart = humps[best.k].a;
  const prevEnd = best.k > 0 ? humps[best.k - 1].b + 1 : 0;
  const w = Math.max(1, Math.round(0.1 / dt));
  const motion = (i) => { let s = 0; for (let j = Math.max(prevEnd, i - w); j < Math.min(upStart, i + w); j++) s += dist(hands(j), hands(j + 1)); return s / trunk; };
  let still = -1, minM = Infinity;
  const ms = [];
  for (let i = prevEnd; i < upStart; i++) { const m = motion(i); ms[i] = m; if (m < minM) minM = m; }
  for (let i = prevEnd; i < upStart; i++) if (ms[i] <= Math.max(minM * 1.5, minM + 0.02)) still = i;
  if (still === -1) return { ok: false, error: 'starts_late' };
  const P0 = steady(hands, still, w, n);

  // Takeaway: the hands first leave the address position. Find when they are clearly away (0.12 trunk),
  // then step back to where they were still within 0.05 trunk of it.
  let takeaway = still;
  for (let i = still; i < top; i++) if (dist(hands(i), P0) > 0.12 * trunk) { takeaway = i; break; }
  while (takeaway > still && dist(hands(takeaway - 1), P0) > 0.05 * trunk) takeaway--;
  const address = Math.max(still, takeaway - w);
  if (top - takeaway < 2 || impact - top < 1) return { ok: false, error: 'no_swing' };

  // Finish: once the hands reach the top of the follow-through
  let finish = null;
  const after = humps[best.k + 1];
  if (after) {
    let hi = after.a;
    for (let i = after.a; i <= after.b; i++) if (h[i] > h[hi]) hi = i;
    for (let i = after.a; i <= hi; i++) if (h[i] >= h[hi] - 0.05) { finish = i; break; }
  }

  // ---- camera view and direction ----
  const lShA = steady((i) => pt(i, P.lSh), address, w, n), rShA = steady((i) => pt(i, P.rSh), address, w, n);
  const shoulderSpan = Math.abs(lShA[0] - rShA[0]) / trunk;
  const autoView = shoulderSpan > 0.5 ? 'face' : 'dtl';
  const view = VIEWS.indexOf(opts.view) >= 0 ? opts.view : autoView;
  const lefty = opts.hand === 'left';

  // dir is +1 when it points to the right of the picture. Face-on it is the target: the hands go away
  // from it on the way back. Down the line it is the ball: where the toes point.
  let dir;
  if (view === 'face') {
    const dx = P0[0] - hands(top)[0];
    dir = Math.abs(dx) > 0.15 * trunk ? Math.sign(dx) : (lefty ? -1 : 1);
  } else {
    const toes = (pt(address, P.lToe)[0] - pt(address, P.lHeel)[0]) + (pt(address, P.rToe)[0] - pt(address, P.rHeel)[0]);
    const face = head(address)[0] - shoulders(address)[0];
    dir = Math.abs(toes) > 0.08 * trunk ? Math.sign(toes) : Math.abs(face) > 0.08 * trunk ? Math.sign(face) : (lefty ? -1 : 1);
  }

  // Scale: centimetres per pixel
  const refPx = view === 'face' ? dist(lShA, rShA) : dist(steady(shoulders, address, w, n), steady(hips, address, w, n));
  const cm = (view === 'face' ? SHOULDER_CM : TRUNK_CM) / Math.max(refPx, 1);

  // The feet don't move during the swing, so if they shift sideways in the picture the camera moved.
  // Face-on the lead ankle is the reference (the trail heel lifts and turns through impact);
  // down the line both ankles sit on top of each other, so their midpoint is.
  const leadAnkle = (i) => { const a = pt(i, P.lAnk), b = pt(i, P.rAnk); return (a[0] - b[0]) * dir > 0 ? a : b; };
  const foot = view === 'face' ? leadAnkle : ankles;
  const foot0 = steady(foot, address, w, n);
  const camAt = (i) => foot(i)[0] - foot0[0];
  const camShift = Math.max(Math.abs(camAt(top)), Math.abs(camAt(impact))) * cm;
  const camMoved = camShift > 3;
  // More than this and either the camera swung a long way or the feet were lost: positions can't be trusted
  const camLost = camShift > 20;
  const camVert = Math.abs(foot(top)[1] - foot0[1]) * cm > 4;
  const fix = (p, i) => camMoved ? [p[0] - camAt(i), p[1]] : p;   // a point with the camera pan taken out

  // ---- measurements ----
  const metrics = [];
  const add = (id, phase, value, unit, status, extra) => metrics.push(Object.assign({ id, phase, value: Math.round(value * 10) / 10, unit, status }, extra));
  const band = (v, good, watch) => (v <= good ? 'good' : v <= watch ? 'watch' : 'fix');

  const headA = steady(head, address, w, n), hipA = steady(hips, address, w, n), shA = steady(shoulders, address, w, n);
  const headT = fix(steady(head, top, 1, n), top), headI = fix(head(impact), impact);
  const hipT = fix(steady(hips, top, 1, n), top), hipI = fix(hips(impact), impact);

  // Tempo. Tour players take about three times as long going back as coming down.
  const back = (top - takeaway) * dt, down = (impact - top) * dt, ratio = back / down;
  const slowmo = down > 0.5;
  const tempo = { back, down, ratio, slowmo };
  add('tempo', 'top', ratio, 'ratio', ratio >= 2.5 && ratio <= 3.6 ? 'good' : ratio >= 2 && ratio <= 4.2 ? 'watch' : 'fix');

  // Head height through impact
  if (!camVert && !camLost) {
    const up = (headA[1] - headI[1]) * cm;   // + means the head rose
    add('headHeight', 'impact', up, 'cm', up > 7 ? 'fix' : up > 3.5 ? 'watch' : up < -10 ? 'fix' : up < -6 ? 'watch' : 'good', { dir: up >= 0 ? 'up' : 'down' });
  }

  if (view === 'face' && !camLost) {
    // Head sway away from the target on the backswing
    const away = (headA[0] - headT[0]) * dir * cm;
    if (away < -4) add('headSway', 'top', -away, 'cm', away < -8 ? 'fix' : 'watch', { dir: 'toward' });
    else add('headSway', 'top', Math.max(away, 0), 'cm', band(away, 10, 18), { dir: 'away' });

    // Head ahead of where it started, at impact
    const ahead = (headI[0] - headA[0]) * dir * cm;
    add('headImpact', 'impact', Math.max(ahead, 0), 'cm', band(ahead, 3, 8));

    // Hip sway away from the target on the backswing
    const sway = (hipA[0] - hipT[0]) * dir * cm;
    add('hipSway', 'top', Math.max(sway, 0), 'cm', band(sway, 6, 12));

    // Hips shifted towards the target by impact
    const shift = (hipI[0] - hipA[0]) * dir * cm;
    add('hipShift', 'impact', shift, 'cm', shift < 2 ? 'fix' : shift < 5 ? 'watch' : shift > 28 ? 'fix' : shift > 20 ? 'watch' : 'good', { dir: shift < 5 ? 'back' : shift > 20 ? 'slide' : 'ok' });
  }
  if (view === 'face') {
    // Spine tilt away from the target at address
    const tilt = deg(Math.atan2(-(shA[0] - hipA[0]) * dir, hipA[1] - shA[1]));
    add('spineTilt', 'address', tilt, '°', tilt < 0 ? 'watch' : tilt > 18 ? 'watch' : 'good', { dir: tilt < 0 ? 'toward' : tilt > 18 ? 'much' : 'ok' });

    // Weight over the lead foot at the finish
    if (finish !== null) {
      const hp = steady(hips, finish, w, n), a = pt(finish, P.lAnk), b = pt(finish, P.rAnk);
      const lead = (a[0] - b[0]) * dir > 0 ? a : b, trail = lead === a ? b : a;
      const span = (lead[0] - trail[0]) * dir;
      if (span > 0.2 * trunk) {
        const f = (hp[0] - trail[0]) * dir / span * 100;
        add('finishBalance', 'finish', f, '%', f >= 75 ? 'good' : f >= 55 ? 'watch' : 'fix');
      }
    }
  } else {
    // Forward bend at address, and how well it holds to impact
    const bend = (s, p) => deg(Math.atan2((s[0] - p[0]) * dir, p[1] - s[1]));
    const bendA = bend(shA, hipA), bendI = bend(fix(shoulders(impact), impact), hipI);
    add('spineAddress', 'address', bendA, '°', bendA < 25 ? 'watch' : bendA > 50 ? 'watch' : 'good', { dir: bendA < 25 ? 'upright' : bendA > 50 ? 'bent' : 'ok' });
    const change = bendI - bendA;
    add('spineKeep', 'impact', change, '°', change < -8 ? 'fix' : change < -4 ? 'watch' : change > 8 ? 'watch' : 'good', { dir: change < 0 ? 'up' : 'down' });

    if (!camLost) {
      // Hips moving towards the ball by impact (early extension)
      const toBall = (hipI[0] - hipA[0]) * dir * cm;
      add('earlyExt', 'impact', Math.max(toBall, 0), 'cm', band(toBall, 4, 8));

      // Head moving towards the ball by impact
      const headIn = (headI[0] - headA[0]) * dir * cm;
      add('headToBall', 'impact', Math.max(headIn, 0), 'cm', band(headIn, 5, 10));
    }
  }

  // Lead arm at the top: the straighter of the two arms, since the pose model can swap left and right
  // when the body turns away from the camera, and the lead arm is the straighter one there.
  const arm = (s, e, wr) => angleAt(pt(top, s), pt(top, e), pt(top, wr));
  const leadArm = Math.max(arm(P.lSh, P.lEl, P.lWr), arm(P.rSh, P.rEl, P.rWr));
  add('leadArm', 'top', leadArm, '°', leadArm >= 145 ? 'good' : 'watch');

  // Length of the backswing: hands against the shoulders at the top
  const handsOver = (shoulders(top)[1] - hands(top)[1]) / trunk;
  add('backswing', 'top', handsOver, 'trunk', 'info', { dir: handsOver > 0.25 ? 'full' : handsOver > -0.1 ? 'three' : 'short' });

  const order = { fix: 0, watch: 1, good: 2, info: 3 };
  metrics.sort((a, b) => order[a.status] - order[b.status]);

  return {
    // A right-hander's target is to the right of the picture face-on, and they face right down the
    // line, unless the video is mirrored (some front cameras do that)
    handGuess: dir === 1 ? 'right' : 'left',
    ok: true, view, autoView, shoulderSpan, dir, lefty, trunk, cm, dt,
    phases: { address, takeaway, top, impact, finish },
    times: { address: frames[address].t, takeaway: frames[takeaway].t, top: frames[top].t, impact: frames[impact].t, finish: finish === null ? null : frames[finish].t },
    tempo, camera: { moved: camMoved, lost: camLost, vertical: camVert, shift: camShift },
    refs: { head: headA, hip: hipA, shoulders: shA, foot: foot0, camAt: lm.map((_, i) => camMoved ? camAt(i) : 0) },
    metrics, lm,
  };
}
