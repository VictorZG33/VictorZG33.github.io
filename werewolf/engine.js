// The reasoning behind 盘狼 Table Read: reads the night results and the day's speeches of one game of
// werewolf (狼人杀) and works out how likely each player is to be a wolf, which role each one holds,
// and how likely every two players are to be on the same side. No DOM here, so the page and node
// (for testing) both load this file.
//
// The method: every way the board's roles could be dealt to the seats is a possible world. Each world
// starts equally likely; every piece of evidence then multiplies it by how likely that evidence would
// be in that world (a wolf attacking a teammate is rare, a true seer's check is never wrong, and so
// on). Summing the worlds gives the answers. Worlds are enumerated by their wolf team; for each team
// the good roles are dealt by a small dynamic programme instead of one by one, so a 12-player game is
// a few hundred teams and an 18-player one a few tens of thousands.

export const GODS = ['seer', 'witch', 'hunter', 'idiot', 'guard'];
export const ROLES = ['villager', 'wolf'].concat(GODS);
export const ROLE_ZH = { villager: '村民', wolf: '狼人', seer: '预言家', witch: '女巫', hunter: '猎人', idiot: '白痴', guard: '守卫' };
export const MIN_PLAYERS = 5, MAX_PLAYERS = 18;

// ---------- how much each kind of evidence says ----------
// Speech between two players, by [speaker good & target good, good & wolf, wolf & good, wolf & wolf].
// Only the ratios within a row matter. An attack says the two are probably on opposite sides, without
// saying which one is the wolf; wolves rarely attack, and almost never vote out, a teammate.
const SPEECH = {
  atk: [1.0, 1.6, 1.6, 0.3],      // 踩: suspects the target
  sup: [1.4, 0.8, 0.8, 1.6],      // 保: vouches for the target
  side: [1.6, 0.6, 0.7, 2.0],     // 站边: takes the target's side in a dispute, usually between two seers
  vote: [1.0, 1.8, 1.8, 0.25],    // 投: votes the target out
  poison: [1.0, 1.8, 1.6, 0.3]    // 毒: says they poisoned the target
};

// Claims. The chance that a player with each real role makes a claim:
const CLAIM_TRUE = { seer: 0.9, witch: 0.8, hunter: 0.7, idiot: 0.6, guard: 0.6, villager: 0.6 };
const CLAIM_WOLVES = { seer: 0.6, witch: 0.15, hunter: 0.2, idiot: 0.1, guard: 0.1 };  // for the whole wolf team; one wolf is this over the number of wolves
const CLAIM_WOLF_VILLAGER = 0.5;   // a wolf calling themself a villager
const CLAIM_LIE = { seer: 0.02, witch: 0.01, hunter: 0.03, idiot: 0.02, guard: 0.02, villager: 0.3 };  // a good player claiming a role they don't hold (a god hiding as a villager is the common case)
// A real god who stays quiet after someone else claims their role. A true seer nearly always counters a
// fake one; a hunter or an idiot can afford to wait.
const SILENT = { seer: 0.15, witch: 0.35, hunter: 0.5, idiot: 0.6, guard: 0.6 };

// A seer's check. The true seer is never wrong (the small chance allows for a slip in the record).
// A wolf posing as the seer hands gold to teammates more often than chance and almost never accuses one.
const CHECK_MISS = 0.002;
const FAKE_GOLD_TO_MATE = 0.4, FAKE_KILL_ON_MATE = 0.08;
// The witch's saved player was the night's knife target, so good unless the wolves stabbed themselves.
const SELF_KNIFE = 0.04;
const FAKE_SAVE_ON_MATE = 0.5;
// The hunter shoots whoever they believe is a wolf.
const SHOT_AT_WOLF = 0.6;
// A night death with a witch on the board is the knife target most of the time and, otherwise, poison.
const POISON_AT_WOLF = 0.5;
const LONE_DEATH_IS_POISON = 0.1;

// ---------- reading what was said ----------
// One line of statements, as people write them at the table: 3踩5，6跳预言家验2金水，1、2、4投5，5出局.
// Different speakers are separated by commas or new lines. Several targets join with 、 or 和, several
// verbs chain after one speaker (3踩5保7), and a part that starts with a verb belongs to the last speaker.
const LEX = [
  // attack, with how hard
  ['狠踩', 'atk', 1.7], ['重踩', 'atk', 1.7], ['强踩', 'atk', 1.7], ['铁踩', 'atk', 1.7], ['猛踩', 'atk', 1.7],
  ['轻踩', 'atk', 0.5], ['小踩', 'atk', 0.5], ['怀疑', 'atk', 0.6], ['质疑', 'atk', 0.6], ['点狼', 'atk', 1], ['归狼', 'atk', 1],
  ['攻击', 'atk', 1], ['踩', 'atk', 1], ['打', 'atk', 1], ['抗推', 'atk', 1],
  // support
  ['强保', 'sup', 1.7], ['铁保', 'sup', 1.7], ['狠保', 'sup', 1.7], ['轻保', 'sup', 0.5],
  ['支持', 'sup', 1], ['认好', 'sup', 1], ['归好', 'sup', 1], ['相信', 'sup', 1], ['认可', 'sup', 1], ['保', 'sup', 1], ['信', 'sup', 1], ['捞', 'sup', 1],
  ['站边', 'side', 1], ['站队', 'side', 1],
  // votes
  ['投票', 'fill'], ['票型', 'fill'], ['归票', 'vote', 1], ['投给', 'vote', 1], ['投', 'vote', 1], ['票', 'vote', 1],
  // seer checks and witch claims
  ['查验', 'chk'], ['验', 'chk'], ['金水', 'gold'], ['查杀', 'kill'], ['查', 'chk'],
  ['银水', 'save'], ['救', 'save'], ['毒死', 'poison'], ['毒', 'poison'],
  ['开枪带走', 'shoot'], ['开枪', 'shoot'], ['带走', 'shoot'], ['枪', 'shoot'],
  // claims and roles
  ['起跳', 'claim'], ['悍跳', 'claim'], ['对跳', 'claim'], ['自称', 'claim'], ['声称', 'claim'], ['跳', 'claim'], ['报', 'claim'], ['认', 'claim'],
  ['预言家', 'role', 'seer'], ['预', 'role', 'seer'], ['女巫', 'role', 'witch'], ['巫', 'role', 'witch'],
  ['猎人', 'role', 'hunter'], ['猎', 'role', 'hunter'], ['白痴', 'role', 'idiot'], ['守卫', 'role', 'guard'], ['守', 'role', 'guard'],
  ['村民', 'role', 'villager'], ['平民', 'role', 'villager'], ['民', 'role', 'villager'],
  // what happened to the speaker
  ['自爆', 'boom'], ['爆', 'boom'], ['被投出局', 'out'], ['投出局', 'out'], ['被投出', 'out'], ['被放逐', 'out'], ['被票出', 'out'], ['票出', 'out'],
  ['放逐', 'out'], ['出局', 'out'], ['翻牌白痴', 'flip'], ['翻白痴', 'flip'], ['翻牌', 'flip'],
  // plain verdicts: after a check verb they are its result, otherwise an attack or a vouch
  ['好人', 'good'], ['好', 'good'], ['狼人', 'wolf'], ['狼', 'wolf'],
  // joiners and words that carry nothing
  ['、', 'join'], ['和', 'join'], ['与', 'join'], ['/', 'join'], ['&', 'join'], ['+', 'join'],
  ['号', 'fill'], ['玩家', 'fill'], ['发言', 'fill'], ['认为', 'fill'], ['觉得', 'fill'], ['感觉', 'fill'], ['说', 'fill'], ['是', 'fill'],
  ['了', 'fill'], ['给', 'fill'], ['发', 'fill'], ['对', 'fill'], ['把', 'fill'], ['的', 'fill'], ['在', 'fill'], ['像', 'fill'],
  ['很', 'fill'], ['比较', 'fill'], ['都', 'fill'], ['也', 'fill'], ['再', 'fill'], ['又', 'fill'], ['就', 'fill'], ['还', 'fill'],
  ['警长', 'fill'], ['警上', 'fill'], ['警下', 'fill'], ['遗言', 'fill'], ['昨晚', 'fill'], ['今晚', 'fill'], ['：', 'fill'], [':', 'fill'], ['#', 'fill'], ['-', 'fill']
].sort((a, b) => b[0].length - a[0].length);
const SEPARATORS = '，,；;。.！!？?\n|';
const VERBS = { atk: 1, sup: 1, side: 1, vote: 1, chk: 1, save: 1, poison: 1, shoot: 1, claim: 1, boom: 1, out: 1, flip: 1 };
const CN_DIGIT = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 三号 → 3号, 十二号 → 12号. Only before 号, so 一 elsewhere is left alone.
function chineseSeats(s) {
  return s.replace(/([一二两三四五六七八九十]{1,3})(?=号)/g, function (m) {
    let v;
    if (m === '十') v = 10;
    else if (m[0] === '十') v = 10 + (CN_DIGIT[m[1]] || 0);
    else if (m[1] === '十') v = CN_DIGIT[m[0]] * 10 + (m[2] ? CN_DIGIT[m[2]] || 0 : 0);
    else if (m.length === 1) v = CN_DIGIT[m];
    else return m;
    return String(v);
  });
}

function lex(text) {
  let s = chineseSeats(String(text).replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0)));
  const out = [];
  let i = 0, space = false;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c) && c !== '\n') { space = true; i++; continue; }
    if (SEPARATORS.indexOf(c) >= 0) { out.push({ k: 'sep' }); space = false; i++; continue; }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
      out.push({ k: 'num', v: parseInt(s.slice(i, j), 10), space: space });
      space = false; i = j; continue;
    }
    let hit = null;
    for (const e of LEX) if (s.startsWith(e[0], i)) { hit = e; break; }
    if (hit) {
      if (hit[1] !== 'fill') out.push({ k: hit[1], x: hit[2], w: hit[0] });
      i += hit[0].length;
    } else {
      const last = out[out.length - 1];
      if (last && last.k === 'unk') last.w += c; else out.push({ k: 'unk', w: c });
      i++;
    }
    space = false;
  }
  return out;
}

// parse('3踩5，6跳预言家验2金水', 12) → { events: [...], notes: ['...'] }
// Events: {t:'atk'|'sup'|'side'|'vote', a, b, s} · {t:'claim', a, r} · {t:'check', a, b, wolf}
// {t:'save'|'poison'|'shoot', a, b} · {t:'boom'|'out'|'flip', a}. Seats are 1-based.
export function parse(text, n) {
  const toks = lex(text), events = [], notes = [];
  let actors = [], verb = null, targets = [], claim = false, lastActors = [], lead = null;
  const okSeat = (v) => v >= 1 && v <= n;

  function emit(ev) {
    if (!okSeat(ev.a) || (ev.b !== undefined && !okSeat(ev.b))) { notes.push('没有 ' + (okSeat(ev.a) ? ev.b : ev.a) + ' 号，这句跳过了'); return; }
    if (ev.b !== undefined && ev.a === ev.b) { notes.push(ev.a + ' 号不能对自己这样，跳过了'); return; }
    events.push(ev);
  }
  function pairs(fn) { actors.forEach((a) => targets.forEach((b) => emit(fn(a, b)))); }
  function flush() {
    if (verb && targets.length) {
      const k = verb.k;
      if (SPEECH[k] && k !== 'poison') pairs((a, b) => ({ t: k, a: a, b: b, s: verb.s }));
      else if (k === 'chk') {
        if (verb.wolf === undefined) notes.push('验了 ' + targets.join('、') + ' 号，但没写金水还是查杀');
        else pairs((a, b) => ({ t: 'check', a: a, b: b, wolf: verb.wolf }));
      } else if (k === 'save' || k === 'poison' || k === 'shoot') pairs((a, b) => ({ t: k, a: a, b: b }));
    } else if (!verb && targets.length) notes.push('没看懂 ' + actors.join('、') + ' 号对 ' + targets.join('、') + ' 号做了什么');
    targets = [];
  }
  function endStatement() {
    flush();
    if (claim === true) notes.push('跳了什么身份没写');
    if (actors.length) lastActors = actors;
    actors = []; verb = null; claim = false; lead = null;
  }
  function needActor() {
    if (!actors.length) actors = lastActors.slice();
    return actors.length > 0;
  }
  // the next token that means something, to tell "3踩5 7保8" (two speakers) from "3踩5 7" (two targets)
  function nextKind(i) { for (let j = i + 1; j < toks.length; j++) if (toks[j].k !== 'join') return toks[j].k; return null; }

  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    switch (t.k) {
      case 'sep': endStatement(); break;
      case 'unk': notes.push('没看懂「' + t.w + '」，跳过了'); break;
      case 'join': break;
      case 'num':
        if (lead) { emit({ t: lead, a: t.v }); lead = null; break; }
        if (actors.length && t.space && (verb || targets.length || claim === 'done') && VERBS[nextKind(i)]) { endStatement(); actors = [t.v]; break; }
        if (!actors.length) actors = [t.v];
        else if (!verb && !targets.length && !claim && (toks[i - 1].k === 'join' || t.space)) actors.push(t.v);
        else targets.push(t.v);
        if (claim === 'done') claim = false;
        break;
      case 'claim':
        flush(); verb = null;
        if (!needActor()) { notes.push('「' + t.w + '」前面要写是几号'); break; }
        claim = true; break;
      case 'role':
        if (claim === true) { actors.forEach((a) => emit({ t: 'claim', a: a, r: t.x })); claim = 'done'; break; }
        if (targets.length) { verb = { k: 'sup', s: 1 }; flush(); verb = null; break; }   // 3说5是预言家: vouches for 5
        if (needActor()) { actors.forEach((a) => emit({ t: 'claim', a: a, r: t.x })); claim = 'done'; }   // 6预言家
        else notes.push('「' + t.w + '」前面要写是几号');
        break;
      case 'gold': case 'kill': case 'good': case 'wolf': {
        const isWolf = t.k === 'kill' || t.k === 'wolf', strong = t.k === 'gold' || t.k === 'kill';
        if (targets.length && (!verb || verb.k === 'chk')) {
          if (verb || strong) { verb = { k: 'chk', wolf: isWolf }; flush(); verb = { k: 'chk' }; }
          else { verb = { k: isWolf ? 'atk' : 'sup', s: 1 }; flush(); verb = null; }
        } else if (!targets.length && (!verb || verb.k === 'chk') && (strong || verb)) {
          if (!needActor()) { notes.push('「' + t.w + '」前面要写是几号'); break; }
          verb = { k: 'chk', wolf: isWolf };
          claim = false;
        }
        break;
      }
      case 'boom': case 'out': case 'flip':
        if (targets.length) { const tg = targets; flush(); tg.forEach((b) => emit({ t: t.k, a: b })); verb = null; break; }   // 3投5出局: 5 is out
        flush(); verb = null;
        if (actors.length) actors.forEach((a) => emit({ t: t.k, a: a }));
        else lead = t.k;                                                              // 放逐5
        break;
      default:   // a verb with targets to follow
        if (t.k === 'save' && targets.length && !verb) { verb = { k: 'save' }; flush(); verb = null; break; }   // 7给2银水
        flush();
        if (!needActor()) { notes.push('「' + t.w + '」前面要写是几号'); verb = null; break; }
        verb = { k: t.k, s: t.x || 1 };
        claim = false;
    }
  }
  endStatement();
  if (lead) notes.push('「出局」后面要写是几号');
  return { events: events, notes: notes };
}

export function describe(ev) {
  const st = (s, hard, soft, plain) => s > 1 ? hard : s < 1 ? soft : plain;
  switch (ev.t) {
    case 'atk': return ev.a + ' ' + st(ev.s, '狠踩', '轻踩', '踩') + ' ' + ev.b;
    case 'sup': return ev.a + ' ' + st(ev.s, '强保', '轻保', '保') + ' ' + ev.b;
    case 'side': return ev.a + ' 站边 ' + ev.b;
    case 'vote': return ev.a + ' 投 ' + ev.b;
    case 'claim': return ev.a + ' 跳' + ROLE_ZH[ev.r];
    case 'check': return ev.a + ' 验 ' + ev.b + (ev.wolf ? ' 查杀' : ' 金水');
    case 'save': return ev.a + ' 救 ' + ev.b + '（银水）';
    case 'poison': return ev.a + ' 毒 ' + ev.b;
    case 'shoot': return ev.a + ' 开枪带走 ' + ev.b;
    case 'boom': return ev.a + ' 自爆';
    case 'out': return ev.a + ' 出局';
    case 'flip': return ev.a + ' 翻牌白痴';
  }
  return '';
}

// ---------- the game ----------
// game = { n, board: { villager, wolf, seer, witch, hunter, idiot, guard }, me: { seat, role, mates: [] },
//          rounds: [{ deaths: [seats], check: { seat, wolf } | null, knife, poison, events: [...] }] }
// Round k is night k then day k. check is the user's own check when they are the seer; knife and
// poison are what the user saw and did when they are the witch. Seats are 1-based, 0 means none.

export function boardSize(board) { return ROLES.reduce((a, r) => a + (board[r] || 0), 0); }

// When each player could last speak, and how each one left the game
export function statuses(game) {
  const n = game.n, out = [];
  for (let i = 1; i <= n; i++) out[i] = { state: 'alive', round: 0 };
  (game.rounds || []).forEach((rd, k) => {
    (rd.deaths || []).forEach((d) => { if (d >= 1 && d <= n && out[d].state === 'alive') out[d] = { state: 'night', round: k + 1 }; });
    const flipped = {};
    (rd.events || []).forEach((e) => { if (e.t === 'flip') flipped[e.a] = 1; });
    (rd.events || []).forEach((e) => {
      const who = e.t === 'shoot' ? e.b : e.a;
      if (!(who >= 1 && who <= n) || out[who].state !== 'alive') return;
      if (e.t === 'out' && !flipped[who]) out[who] = { state: 'out', round: k + 1 };
      else if (e.t === 'shoot') out[who] = { state: 'shot', round: k + 1 };
      else if (e.t === 'boom') out[who] = { state: 'boom', round: k + 1 };
    });
    Object.keys(flipped).forEach((a) => { if (out[a] && out[a].state === 'alive') out[a] = { state: 'flipped', round: k + 1 }; });
  });
  return out;
}

// Turn the game into factors. skip(kind, k, j) leaves one piece out, for explain().
function compile(game, skip) {
  const n = game.n, b = game.board, w = b.wolf, g = n - w;
  const gods = GODS.filter((r) => b[r] > 0);
  const roles = ['villager'].concat(gods), R = roles.length, ri = {};
  roles.forEach((r, k) => { ri[r] = k; });
  const team = new Int8Array(n);                 // 0 unknown, 1 good, 2 wolf
  const fixedRole = new Int8Array(n).fill(-1);
  const conflicts = [];
  const single = [];                             // log factors [if good, if wolf]
  for (let i = 0; i < n; i++) single.push([0, 0]);
  const pairs = new Map();                       // i*n+j with i<j → log factors by 2*wolf(i)+wolf(j)
  const wolfLog = new Float64Array(n);           // log factor when the player is a wolf
  const base = [];                               // factor for each good role
  for (let i = 0; i < n; i++) base.push(new Float64Array(R).fill(1));
  const roleChecks = [];                         // per claimant: checks whose weight depends on their role and the target's side
  for (let i = 0; i < n; i++) roleChecks.push([]);
  const wolfChecks = [];                         // the same checks, when the claimant is a wolf
  const claims = [];
  for (let i = 0; i < n; i++) claims.push({});
  const firstClaim = {};
  const okSeat = (v) => Number.isInteger(v) && v >= 1 && v <= n;
  const no = (kind, k, j) => skip && skip(kind, k, j);

  function setTeam(i, t, why) {
    if (team[i] && team[i] !== t) conflicts.push(why);
    else team[i] = t;
  }
  function setRole(i, r, why) {
    if (!(r in ri)) { conflicts.push(why + '，但板子里没有' + ROLE_ZH[r]); return; }
    if (fixedRole[i] >= 0 && fixedRole[i] !== ri[r]) { conflicts.push(why); return; }
    fixedRole[i] = ri[r];
    setTeam(i, 1, why);
  }
  function addSingle(i, good, wolf) { single[i][0] += Math.log(good); single[i][1] += Math.log(wolf); }
  function addPair(a, c, table, s) {
    const i = Math.min(a, c), j = Math.max(a, c), key = i * n + j;
    let L = pairs.get(key);
    if (!L) { L = new Float64Array(4); pairs.set(key, L); }
    // the table is speaker-first; swap the two mixed cells when the speaker has the higher seat
    const t = a < c ? table : [table[0], table[2], table[1], table[3]];
    for (let x = 0; x < 4; x++) L[x] += s * Math.log(t[x]);
  }
  function claim(a, r, k) {
    if (!claims[a][r]) claims[a][r] = true;
    if (firstClaim[r] === undefined || k < firstClaim[r]) firstClaim[r] = k;
  }
  // a check-like claim: the claimant says they learnt the target's side at night as role `as`
  function roleCheck(a, t, as, ifGood, ifWolf, wolfGood, wolfWolf) {
    roleChecks[a].push({ b: t, k: as in ri ? ri[as] : -1, good: ifGood, wolf: ifWolf, other: 1 / (n - 1) });
    wolfChecks.push({ a: a, b: t, good: Math.log(wolfGood), wolf: w > 1 ? Math.log(wolfWolf) : -Infinity });
  }

  // who the user is
  const me = game.me || {};
  if (okSeat(me.seat) && me.role && !no('me', 0, 0)) {
    const m = me.seat - 1;
    if (me.role === 'wolf') {
      setTeam(m, 2, '你是狼');
      const mates = (me.mates || []).filter((x) => okSeat(x) && x !== me.seat);
      mates.forEach((x) => setTeam(x - 1, 2, '你的狼队友'));
      if (mates.length === w - 1) for (let i = 0; i < n; i++) if (!team[i]) team[i] = 1;
    } else setRole(m, me.role, '你是' + ROLE_ZH[me.role]);
  }
  const meSeer = okSeat(me.seat) && me.role === 'seer', meWitch = okSeat(me.seat) && me.role === 'witch';

  // when each player could still answer a claim: alive that day, or still speaking (last words)
  const st = statuses(game);
  const lastDay = new Array(n).fill(Infinity), lastSpoke = new Array(n).fill(0);
  for (let i = 1; i <= n; i++) {
    const s = st[i];
    if (s.state === 'night') lastDay[i - 1] = s.round - 1;
    else if (s.state !== 'alive' && s.state !== 'flipped') lastDay[i - 1] = s.round;
  }

  const K = [0.96 / g, SELF_KNIFE / w];                       // knife target: good, wolf
  const P = [(1 - POISON_AT_WOLF) / Math.max(1, g - 1), POISON_AT_WOLF / w];   // poison target
  const hasWitch = b.witch > 0;

  (game.rounds || []).forEach((rd, k) => {
    const day = k + 1, events = (rd.events || []);
    events.forEach((e) => { if (okSeat(e.a)) lastSpoke[e.a - 1] = Math.max(lastSpoke[e.a - 1], day); });
    // the hunter's shot at dawn is the shot, not a second night death
    const shotAtDawn = {};
    events.forEach((e) => { if (e.t === 'shoot') shotAtDawn[e.b] = 1; });
    let deaths = [];
    (rd.deaths || []).forEach((d, j) => { if (okSeat(d) && deaths.indexOf(d) < 0 && !shotAtDawn[d] && !no('death', k, j)) deaths.push(d); });

    if (meWitch) {
      if (okSeat(rd.knife) && !no('knife', k, 0)) addSingle(rd.knife - 1, K[0], K[1]);
      deaths = deaths.filter((d) => d !== rd.knife && d !== rd.poison);
      deaths.forEach((d) => addSingle(d - 1, K[0], K[1]));
    } else if (deaths.length === 1) {
      const d = deaths[0] - 1;
      if (hasWitch) addSingle(d, (1 - LONE_DEATH_IS_POISON) * K[0] + LONE_DEATH_IS_POISON * P[0], (1 - LONE_DEATH_IS_POISON) * K[1] + LONE_DEATH_IS_POISON * P[1]);
      else addSingle(d, K[0], K[1]);
    } else if (deaths.length === 2 && hasWitch) {
      // one knifed, one poisoned, either way round
      const t = [];
      for (let x = 0; x < 4; x++) { const u = x >> 1, v = x & 1; t.push(0.5 * (K[u] * P[v] + K[v] * P[u])); }
      addPair(deaths[0] - 1, deaths[1] - 1, t, 1);
    } else deaths.forEach((d) => addSingle(d - 1, hasWitch ? 0.5 * (K[0] + P[0]) : K[0], hasWitch ? 0.5 * (K[1] + P[1]) : K[1]));

    if (meSeer && rd.check && okSeat(rd.check.seat) && rd.check.seat !== me.seat && !no('check', k, 0))
      setTeam(rd.check.seat - 1, rd.check.wolf ? 2 : 1, '你验' + rd.check.seat + '号是' + (rd.check.wolf ? '狼' : '好人'));

    events.forEach((e, j) => {
      if (no('event', k, j) || !okSeat(e.a) || (e.b !== undefined && (!okSeat(e.b) || e.b === e.a))) return;
      const a = e.a - 1, t = e.b - 1;
      switch (e.t) {
        case 'atk': case 'sup': case 'side': case 'vote':
          addPair(a, t, SPEECH[e.t], e.s > 0 ? e.s : 1); break;
        case 'claim':
          if (ROLES.indexOf(e.r) >= 0 && e.r !== 'wolf') claim(a, e.r, day); break;
        case 'check':
          claim(a, 'seer', day);
          if (e.wolf) roleCheck(a, t, 'seer', CHECK_MISS / (n - 1), 1 / (n - 1), (1 - FAKE_KILL_ON_MATE) / g, FAKE_KILL_ON_MATE / (w - 1));
          else roleCheck(a, t, 'seer', 1 / (n - 1), CHECK_MISS / (n - 1), (1 - FAKE_GOLD_TO_MATE) / g, FAKE_GOLD_TO_MATE / (w - 1));
          break;
        case 'save':
          claim(a, 'witch', day);
          roleCheck(a, t, 'witch', K[0], K[1], (1 - FAKE_SAVE_ON_MATE) / g, FAKE_SAVE_ON_MATE / (w - 1));
          break;
        case 'poison':
          claim(a, 'witch', day);
          addPair(a, t, SPEECH.poison, 1); break;
        case 'shoot':
          if (b.hunter > 0) setRole(a, 'hunter', e.a + '号开了枪，是猎人');
          addSingle(t, (1 - SHOT_AT_WOLF) / Math.max(1, g - 1), SHOT_AT_WOLF / w); break;
        case 'boom':
          setTeam(a, 2, e.a + '号自爆了，是狼'); break;
        case 'flip':
          if (b.idiot > 0) setRole(a, 'idiot', e.a + '号翻牌是白痴'); break;
      }
    });
  });

  // claims: what each claim costs each possible role
  for (let i = 0; i < n; i++) {
    const mine = Object.keys(claims[i]);
    mine.forEach((r) => {
      wolfLog[i] += Math.log(r === 'villager' ? CLAIM_WOLF_VILLAGER : (CLAIM_WOLVES[r] || 0.05) / w);
      for (let x = 0; x < R; x++) base[i][x] *= roles[x] === r ? CLAIM_TRUE[r] : CLAIM_LIE[r];
    });
  }
  // a real god who let someone else claim their role and said nothing
  gods.forEach((r) => {
    const day = firstClaim[r];
    if (day === undefined) return;
    for (let i = 0; i < n; i++) if (!claims[i][r] && (lastDay[i] >= day || lastSpoke[i] >= day)) base[i][ri[r]] *= SILENT[r];
  });
  for (let i = 0; i < n; i++) if (fixedRole[i] >= 0) for (let x = 0; x < R; x++) if (x !== fixedRole[i]) base[i][x] = 0;

  const pairList = [];
  pairs.forEach((L, key) => { pairList.push({ i: Math.floor(key / n), j: key % n, L: L }); });
  return { n, w, roles, R, team, fixedRole, conflicts, single, pairList, wolfLog, base, roleChecks, wolfChecks, gods, counts: gods.map((r) => b[r]), claims };
}

export function validate(game) {
  const n = game.n, b = game.board || {};
  if (!(n >= MIN_PLAYERS && n <= MAX_PLAYERS)) return '人数要在 ' + MIN_PLAYERS + ' 到 ' + MAX_PLAYERS + ' 之间';
  const sum = boardSize(b);
  if (sum !== n) return sum < n ? '板子只有 ' + sum + ' 张牌，比总人数少 ' + (n - sum) + ' 张' : '板子有 ' + sum + ' 张牌，比总人数多 ' + (sum - n) + ' 张';
  if (!(b.wolf >= 1)) return '至少要有一只狼';
  if (b.wolf >= n) return '至少要有一个好人';
  return '';
}

// opts.light skips the role and pair answers (for explain(), which only needs each player's wolf chance)
export function infer(game, opts) {
  const bad = validate(game);
  if (bad) return { ok: false, reason: bad };
  const light = opts && opts.light;
  const M = compile(game, opts && opts.skip);
  const { n, w, R, team, single, pairList, wolfLog, base, roleChecks, wolfChecks, counts } = M;
  if (M.conflicts.length) return { ok: false, reason: '确定的信息互相矛盾：' + M.conflicts.join('；') };

  // the deal of good roles is a walk through the good players, counting how many of each god are dealt
  const strides = [], G = counts.length;
  let S = 1;
  counts.forEach((c) => { strides.push(S); S *= c + 1; });
  const full = counts.reduce((a, c, x) => a + c * strides[x], 0);
  const next = new Int32Array(S * R);
  for (let s = 0; s < S; s++) {
    next[s * R] = s;
    for (let x = 0; x < G; x++) next[s * R + x + 1] = Math.floor(s / strides[x]) % (counts[x] + 1) < counts[x] ? s + strides[x] : -1;
  }
  const m = n - w;
  const F = new Float64Array((m + 1) * S), B = new Float64Array((m + 1) * S), FI = new Float64Array(m * R);
  const goods = new Int32Array(m), isWolf = new Uint8Array(n);

  const free = [], must = [];
  for (let i = 0; i < n; i++) { if (team[i] === 2) must.push(i); else if (team[i] === 0) free.push(i); }
  const need = w - must.length;
  if (need < 0 || need > free.length) return { ok: false, reason: '确定的信息互相矛盾：确定是狼的有 ' + must.length + ' 人，板子只有 ' + w + ' 只狼' + (need > free.length ? '，或者确定是好人的太多了' : '') };

  let top = -Infinity, Z = 0, worlds = 0;
  const pW = new Float64Array(n), bothW = light ? null : new Float64Array(n * n), roleAcc = light ? null : new Float64Array(n * R);
  const best = [];   // the likeliest wolf teams, log weight first
  const idx = [];
  for (let x = 0; x < need; x++) idx.push(x);

  function rescale(f) {
    Z *= f;
    for (let i = 0; i < n; i++) pW[i] *= f;
    if (!light) { for (let x = 0; x < bothW.length; x++) bothW[x] *= f; for (let x = 0; x < roleAcc.length; x++) roleAcc[x] *= f; }
  }

  for (;;) {
    isWolf.fill(0);
    for (const i of must) isWolf[i] = 1;
    for (const x of idx) isWolf[free[x]] = 1;

    let lt = 0;
    for (let i = 0; i < n; i++) { lt += single[i][isWolf[i]]; if (isWolf[i]) lt += wolfLog[i]; }
    for (const p of pairList) lt += p.L[2 * isWolf[p.i] + isWolf[p.j]];
    for (const c of wolfChecks) if (isWolf[c.a]) lt += isWolf[c.b] ? c.wolf : c.good;

    if (lt > -Infinity) {
      // deal the good roles
      let t = 0;
      for (let i = 0; i < n; i++) if (!isWolf[i]) goods[t++] = i;
      F.fill(0); F[0] = 1;
      for (t = 0; t < m; t++) {
        const i = goods[t], f = base[i];
        for (let x = 0; x < R; x++) {
          let v = f[x];
          if (v) for (const c of roleChecks[i]) v *= x === c.k ? (isWolf[c.b] ? c.wolf : c.good) : c.other;
          FI[t * R + x] = v;
        }
        const o = t * S, o2 = o + S;
        for (let s = 0; s < S; s++) {
          const v = F[o + s];
          if (!v) continue;
          for (let x = 0; x < R; x++) {
            const fx = FI[t * R + x], s2 = next[s * R + x];
            if (fx && s2 >= 0) F[o2 + s2] += v * fx;
          }
        }
      }
      const Rw = F[m * S + full];
      if (Rw > 0) {
        const lw = lt + Math.log(Rw);
        if (lw > top) { if (top > -Infinity) rescale(Math.exp(top - lw)); top = lw; }
        const wt = Math.exp(lw - top);
        worlds++;
        Z += wt;
        for (let i = 0; i < n; i++) if (isWolf[i]) pW[i] += wt;
        if (!light) {
          for (let i = 0; i < n; i++) if (isWolf[i]) for (let j = i + 1; j < n; j++) if (isWolf[j]) bothW[i * n + j] += wt;
          // the backward half of the walk gives each good player's chance of each role in this world
          B.fill(0); B[m * S + full] = 1;
          for (t = m - 1; t >= 0; t--) {
            const o = t * S, o2 = o + S;
            for (let s = 0; s < S; s++) {
              let acc = 0;
              for (let x = 0; x < R; x++) { const fx = FI[t * R + x], s2 = next[s * R + x]; if (fx && s2 >= 0) acc += fx * B[o2 + s2]; }
              B[o + s] = acc;
            }
          }
          for (t = 0; t < m; t++) {
            const o = t * S, o2 = o + S, i = goods[t];
            for (let x = 0; x < R; x++) {
              const fx = FI[t * R + x];
              if (!fx) continue;
              let acc = 0;
              for (let s = 0; s < S; s++) { const v = F[o + s], s2 = next[s * R + x]; if (v && s2 >= 0) acc += v * B[o2 + s2]; }
              roleAcc[i * R + x] += wt * fx * acc / Rw;
            }
          }
        }
        if (best.length < 6 || lw > best[best.length - 1].lw) {
          const set = [];
          for (let i = 0; i < n; i++) if (isWolf[i]) set.push(i + 1);
          best.push({ lw: lw, wolves: set });
          best.sort((x, y) => y.lw - x.lw);
          if (best.length > 6) best.pop();
        }
      }
    }

    // next combination of `need` from free
    let x = need - 1;
    while (x >= 0 && idx[x] === free.length - need + x) x--;
    if (x < 0) break;
    idx[x]++;
    for (let y = x + 1; y < need; y++) idx[y] = idx[y - 1] + 1;
  }

  if (!(Z > 0)) return { ok: false, reason: '找不到任何一种发牌能同时满足所有确定的信息，检查一下你的身份、验人结果、开枪、自爆和翻牌' };
  const out = { ok: true, n, roles: M.roles, worlds, pWolf: Array.from(pW, (v) => v / Z), fixedTeam: Array.from(team), fixedRole: Array.from(M.fixedRole, (x) => x >= 0 ? M.roles[x] : null) };
  out.top = best.map((e) => ({ wolves: e.wolves, p: Math.exp(e.lw - top) / Z }));
  if (!light) {
    out.role = [];
    for (let i = 0; i < n; i++) {
      const r = { wolf: out.pWolf[i] };
      M.roles.forEach((name, x) => { r[name] = roleAcc[i * R + x] / Z; });
      out.role.push(r);
    }
    out.bothWolf = new Float64Array(n * n); out.same = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) { out.bothWolf[i * n + j] = out.pWolf[i]; out.same[i * n + j] = 1; continue; }
      const bw = (i < j ? bothW[i * n + j] : bothW[j * n + i]) / Z;
      out.bothWolf[i * n + j] = bw;
      out.same[i * n + j] = Math.min(1, Math.max(0, 1 - out.pWolf[i] - out.pWolf[j] + 2 * bw));
    }
  }
  return out;
}

// The pieces of evidence that touch one seat, each with the game as it would be without it. The page
// runs infer() on each in turn and shows how far that piece moved the seat's chance of being a wolf.
export function explainItems(game, seat) {
  const items = [];
  const touch = (e) => e.a === seat || e.b === seat;
  (game.rounds || []).forEach((rd, k) => {
    (rd.deaths || []).forEach((d, j) => { if (d === seat) items.push({ label: '第' + (k + 1) + '夜 ' + d + ' 号死了', kind: 'death', k, j }); });
    (rd.events || []).forEach((e, j) => { if (touch(e)) items.push({ label: '第' + (k + 1) + '天 ' + describe(e), kind: 'event', k, j }); });
    if (game.me && game.me.role === 'seer' && rd.check && rd.check.seat === seat) items.push({ label: '第' + (k + 1) + '夜 你验 ' + seat + ' 号' + (rd.check.wolf ? '是狼' : '是好人'), kind: 'check', k, j: 0 });
    if (game.me && game.me.role === 'witch' && rd.knife === seat) items.push({ label: '第' + (k + 1) + '夜 刀口是 ' + seat + ' 号', kind: 'knife', k, j: 0 });
  });
  items.forEach((it) => { it.skip = (kind, k, j) => kind === it.kind && k === it.k && j === it.j; });
  return items;
}
