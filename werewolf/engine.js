// The reasoning behind 盘狼 Table Read: reads the night results and the day's speeches of one game of
// werewolf (狼人杀) and works out how likely each player is to be a wolf, which role each one holds,
// and how likely every two players are to be on the same side. No DOM here, so the page and node
// (for testing) both load this file.
//
// The method: every way the board's roles could be dealt to the seats is a possible world. Each world
// starts equally likely; every piece of evidence then multiplies it by how likely that evidence would
// be in that world (a wolf attacking a teammate is rare, a true seer's check is never wrong, and so
// on). Summing the worlds gives the answers. Worlds are enumerated by their wolf team, then by which of
// the team is the mechanical wolf if the board has one; for each team the good roles are dealt by a small
// dynamic programme instead of one by one, so a 12-player game is a few hundred teams and an 18-player
// one a few tens of thousands.

export const GODS = ['seer', 'witch', 'hunter', 'idiot', 'guard'];
// mech is the mechanical wolf (机械狼): on the wolves' side, but it and the wolves don't know each other,
// it can't blow itself up, and on the first night it learns one player's skill (the witch's poison, the
// hunter's gun, the guard's shield, a check). It only knifes once every other wolf is out.
export const ROLES = ['villager', 'wolf', 'mech'].concat(GODS);
export const ROLE_ZH = { villager: '村民', wolf: '狼人', mech: '机械狼', seer: '预言家', witch: '女巫', hunter: '猎人', idiot: '白痴', guard: '守卫' };
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
  poison: [1.0, 1.8, 1.6, 0.3],   // 毒: says they poisoned the target
  bvote: [1.4, 0.7, 0.75, 1.8],   // 警下投票: votes for the target to be sheriff
  badge: [1.6, 0.6, 0.6, 2.2]     // 移交警徽: a dying sheriff hands the target the badge
};

// The sheriff election (警长竞选). The chance that each role runs (上警): the true seer nearly always runs,
// to win the badge and leave a check order; a wolf team usually sends two, the fake seer among them; the
// witch and the guard often stay down to keep hidden.
const RUN = { seer: 0.92, wolf: 0.5, mech: 0.55, witch: 0.35, hunter: 0.55, idiot: 0.6, guard: 0.35, villager: 0.45 };
// The chance that a candidate withdraws (退水). A true seer almost never does.
const QUIT = { seer: 0.05, wolf: 0.35, mech: 0.35, witch: 0.45, hunter: 0.4, idiot: 0.4, guard: 0.45, villager: 0.45 };
// A wolf posing as the seer runs as surely as the real one, so for a seer claimant running says nothing;
// withdrawing still does, as the fake one gives up more easily.
const CLAIMANT_QUIT = 0.2;

// Claims. The chance that a player with each real role makes a claim:
const CLAIM_TRUE = { seer: 0.9, witch: 0.8, hunter: 0.7, idiot: 0.6, guard: 0.6, villager: 0.6 };
const CLAIM_WOLVES = { seer: 0.6, witch: 0.15, hunter: 0.2, idiot: 0.1, guard: 0.1 };  // for the whole wolf team; one wolf is this over the number of wolves
const CLAIM_WOLF_VILLAGER = 0.5;   // a wolf calling themself a villager
// The mechanical wolf usually poses as the god whose skill it learnt, and has a real skill to back it up
const CLAIM_MECH = { seer: 0.3, witch: 0.3, hunter: 0.3, idiot: 0.1, guard: 0.25, villager: 0.5 };
// The chance it learnt a given god's skill, for a shot that could be its own
const MECH_LEARNT = 0.25;
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
  // the sheriff election, and the badge after it
  ['竞选警长', 'run'], ['上警', 'run'], ['退水', 'quit'], ['退出竞选', 'quit'],
  ['投警徽', 'bvote'], ['投警长', 'bvote'], ['警徽票', 'bvote'], ['警票', 'bvote'],
  ['当选警长', 'chief'], ['当警长', 'chief'], ['拿到警徽', 'chief'], ['拿警徽', 'chief'], ['当选', 'chief'],
  ['移交警徽', 'badge'], ['警徽交给', 'badge'], ['警徽给', 'badge'], ['传警徽', 'badge'], ['交警徽', 'badge'],
  ['撕掉警徽', 'tear'], ['撕警徽', 'tear'], ['警徽流', 'flow'],
  // votes after these words are for the badge, until 放逐投票
  ['警下投票', 'bctx'], ['警长投票', 'bctx'], ['警徽投票', 'bctx'], ['警下', 'bctx'], ['放逐投票', 'pctx'],
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
  ['警长', 'fill'], ['警徽', 'fill'], ['警上', 'fill'], ['遗言', 'fill'], ['昨晚', 'fill'], ['今晚', 'fill'], ['：', 'fill'], [':', 'fill'], ['#', 'fill'], ['-', 'fill']
].sort((a, b) => b[0].length - a[0].length);
const SEPARATORS = '，,；;。.！!？?\n|';
const VERBS = { atk: 1, sup: 1, side: 1, vote: 1, chk: 1, save: 1, poison: 1, shoot: 1, claim: 1, boom: 1, out: 1, flip: 1,
  run: 1, quit: 1, chief: 1, tear: 1, bvote: 1, badge: 1, flow: 1 };
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
// {t:'save'|'poison'|'shoot'|'badge', a, b} · {t:'boom'|'out'|'flip'|'tear', a}. Seats are 1-based.
// The sheriff election comes back as {t:'run'|'quit'|'chief', a} and {t:'bvote', a, b}; the page files
// those under the round's election rather than its statements.
export function parse(text, n) {
  const toks = lex(text), events = [], notes = [];
  let actors = [], verb = null, targets = [], claim = false, lastActors = [], lead = null, badgeVotes = false;
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
      // 警徽流 is the order the seer would check in: nothing to weigh
    } else if (!verb && targets.length) notes.push('没看懂 ' + actors.join('、') + ' 号对 ' + targets.join('、') + ' 号做了什么');
    targets = [];
  }
  function endStatement() {
    flush();
    if (claim === true) notes.push('跳了什么身份没写');
    if (lead) notes.push('「' + lead.w + '」后面要写是几号');
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
      case 'bctx': badgeVotes = true; break;
      case 'pctx': badgeVotes = false; break;
      case 'num':
        // 放逐5, 上警：1、3、6
        if (lead) { emit({ t: lead.k, a: t.v }); if (!toks[i + 1] || toks[i + 1].k !== 'join') lead = null; break; }
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
      case 'boom': case 'out': case 'flip': case 'run': case 'quit': case 'chief': case 'tear':
        if (targets.length) { const tg = targets; flush(); tg.forEach((b) => emit({ t: t.k, a: b })); verb = null; break; }   // 3投5出局: 5 is out
        flush(); verb = null;
        if (actors.length) actors.forEach((a) => emit({ t: t.k, a: a }));
        else lead = t;
        break;
      default:   // a verb with targets to follow
        if (t.k === 'save' && targets.length && !verb) { verb = { k: 'save' }; flush(); verb = null; break; }   // 7给2银水
        flush();
        if (!needActor()) { notes.push('「' + t.w + '」前面要写是几号'); verb = null; break; }
        verb = { k: t.k === 'vote' && badgeVotes ? 'bvote' : t.k, s: t.x || 1 };
        claim = false;
    }
  }
  endStatement();
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
    case 'badge': return ev.a + ' 移交警徽给 ' + ev.b;
    case 'tear': return ev.a + ' 撕警徽';
    case 'run': return ev.a + ' 上警';
    case 'quit': return ev.a + ' 退水';
    case 'chief': return ev.a + ' 当选警长';
    case 'bvote': return ev.a + ' 警下投 ' + ev.b;
  }
  return '';
}

// ---------- the game ----------
// game = { n, board: { villager, wolf, mech, seer, witch, hunter, idiot, guard }, me: { seat, role, mates: [] },
//          rounds: [{ deaths: [seats], check: { seat, wolf } | null, knife, poison,
//                     sheriff: { run: [seats], quit: [seats], votes: { voter: candidate }, chief } | null,
//                     events: [...] }] }
// Round k is night k then day k. check is the user's own check when they are the seer; knife and
// poison are what the user saw and did when they are the witch. sheriff is that day's election: who ran,
// who withdrew, how the players who stayed down voted, and who won. Seats are 1-based, 0 means none.

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
// Each player is in one of three states: good (0), wolf (1) or the mechanical wolf (2).
function compile(game, skip) {
  const n = game.n, b = game.board, w = b.wolf, mech = b.mech > 0 ? 1 : 0, wt = w + mech, g = n - wt;
  const gods = GODS.filter((r) => b[r] > 0);
  const roles = ['villager'].concat(gods), R = roles.length, ri = {};
  roles.forEach((r, k) => { ri[r] = k; });
  const mask = new Uint8Array(n).fill(mech ? 7 : 3);   // which states each player can still be in: 1 good, 2 wolf, 4 mechanical wolf
  const fixedRole = new Int8Array(n).fill(-1);   // the good role a player must hold, if good
  const conflicts = [];
  const single = [];                             // log factors by state
  for (let i = 0; i < n; i++) single.push([0, 0, 0]);
  const pairs = new Map();                       // i*n+j with i<j → log factors by 3*state(i)+state(j)
  const base = [];                               // factor for each good role
  for (let i = 0; i < n; i++) base.push(new Float64Array(R).fill(1));
  const roleChecks = [];                         // per claimant: checks whose weight depends on their role and the target's state
  for (let i = 0; i < n; i++) roleChecks.push([]);
  const saveChecks = [];                         // claimed saves, the only checks that tell a wolf from the mechanical wolf
  const claims = [];
  for (let i = 0; i < n; i++) claims.push({});
  const firstClaim = {};
  const okSeat = (v) => Number.isInteger(v) && v >= 1 && v <= n;
  const no = (kind, k, j) => skip && skip(kind, k, j);
  const other = 1 / (n - 1);
  const perMate = (x) => (w > 1 ? x / (w - 1) : 1);   // a wolf's share for one teammate (unused when there is none)

  function limit(i, bits, why) {
    if (!(mask[i] & bits)) conflicts.push(why);
    else mask[i] &= bits;
  }
  // orMech: the mechanical wolf could also have done it, having learnt the role's skill
  function setRole(i, r, why, orMech) {
    if (!(r in ri)) {
      if (orMech && mech) limit(i, 4, why);
      else conflicts.push(why + '，但板子里没有' + ROLE_ZH[r]);
      return;
    }
    if (fixedRole[i] >= 0 && fixedRole[i] !== ri[r]) { conflicts.push(why); return; }
    fixedRole[i] = ri[r];
    limit(i, orMech ? 5 : 1, why);
  }
  function addSingle(i, t) { for (let x = 0; x < 3; x++) single[i][x] += Math.log(t[x]); }
  // A speaker-first table of the four good/wolf cells, spread over the three states. The mechanical wolf
  // and the wolves don't know each other, so between them speech carries no inside knowledge; towards
  // good players the mechanical wolf pushes as a wolf does, and good players read it as one.
  function nine(t) { return [t[0], t[1], t[1], t[2], t[3], t[2], t[2], t[0], t[0]]; }
  function addPair(a, c, t9, s) {
    const i = Math.min(a, c), j = Math.max(a, c), key = i * n + j;
    let L = pairs.get(key);
    if (!L) { L = new Float64Array(9); pairs.set(key, L); }
    for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) L[3 * x + y] += s * Math.log(a < c ? t9[3 * x + y] : t9[3 * y + x]);
  }
  function claim(a, r, k) {
    if (!claims[a][r]) claims[a][r] = true;
    if (firstClaim[r] === undefined || k < firstClaim[r]) firstClaim[r] = k;
  }
  // A check-like claim: the claimant says they learnt the target's side at night as role `as`. truth is
  // its weight when the claimant really holds that role, by the target's state; wolfGood and wolfMate
  // when the claimant is a wolf posing as it. The wolves don't know the mechanical wolf, so to them it
  // is one more good player; the mechanical wolf posing as a god picks targets blind.
  function roleCheck(a, t, as, truth, wolfGood, wolfMate) {
    roleChecks[a].push({ b: t, k: as in ri ? ri[as] : -1, good: truth[0], wolf: truth[1], mech: truth[2], other: other });
    addPair(a, t, [1, 1, 1, wolfGood, wolfMate, wolfGood, other, other, other], 1);
  }

  // who the user is
  const me = game.me || {};
  if (okSeat(me.seat) && me.role && !no('me', 0, 0)) {
    const m = me.seat - 1;
    if (me.role === 'wolf') {
      limit(m, 2, '你是狼');
      const mates = (me.mates || []).filter((x) => okSeat(x) && x !== me.seat);
      mates.forEach((x) => limit(x - 1, 2, '你的狼队友'));
      // the wolves know each other but not the mechanical wolf
      if (mates.length === w - 1) for (let i = 0; i < n; i++) if (i !== m && mates.indexOf(i + 1) < 0) limit(i, 5, '你的狼队友');
    } else if (me.role === 'mech') {
      limit(m, 4, '你是机械狼');
      for (let i = 0; i < n; i++) if (i !== m) limit(i, 3, '你是机械狼');
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

  const ran = [];                                // the election, weighed once every claim is known

  // by state: the wolves can knife the mechanical wolf as readily as a good player, not knowing it;
  // a poison, or the hunter's bullet, aimed at a suspected wolf finds either kind
  const K = [0.96 / g, SELF_KNIFE / w, 0.96 / g];
  const P = [(1 - POISON_AT_WOLF) / Math.max(1, g - 1), POISON_AT_WOLF / wt, POISON_AT_WOLF / wt];
  const mix = (f, x, y) => [0, 1, 2].map((s) => (1 - f) * x[s] + f * y[s]);
  const hasPoison = b.witch > 0 || mech > 0;    // the mechanical wolf may have learnt the witch's poison

  (game.rounds || []).forEach((rd, k) => {
    const day = k + 1, events = (rd.events || []);
    events.forEach((e) => { if (okSeat(e.a)) lastSpoke[e.a - 1] = Math.max(lastSpoke[e.a - 1], day); });
    // the hunter's shot at dawn is the shot, not a second night death
    const shotAtDawn = {};
    events.forEach((e) => { if (e.t === 'shoot') shotAtDawn[e.b] = 1; });
    let deaths = [];
    (rd.deaths || []).forEach((d, j) => { if (okSeat(d) && deaths.indexOf(d) < 0 && !shotAtDawn[d] && !no('death', k, j)) deaths.push(d); });

    if (meWitch) {
      if (okSeat(rd.knife) && !no('knife', k, 0)) addSingle(rd.knife - 1, K);
      deaths = deaths.filter((d) => d !== rd.knife && d !== rd.poison);
      deaths.forEach((d) => addSingle(d - 1, mech ? mix(0.5, K, P) : K));
    } else if (deaths.length === 1) {
      addSingle(deaths[0] - 1, hasPoison ? mix(LONE_DEATH_IS_POISON, K, P) : K);
    } else if (deaths.length === 2 && hasPoison) {
      // one knifed, one poisoned, either way round
      const t = [];
      for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) t.push(0.5 * (K[x] * P[y] + K[y] * P[x]));
      addPair(deaths[0] - 1, deaths[1] - 1, t, 1);
    } else deaths.forEach((d) => addSingle(d - 1, hasPoison ? mix(0.5, K, P) : K));

    // the election: who ran says something about every role, most of all the seer's. On the first day it
    // comes before the night's deaths are read out, so last night's dead can run too.
    const sh = rd.sheriff;
    if (sh && Array.isArray(sh.run) && sh.run.length) {
      const before = statuses({ n, rounds: game.rounds.slice(0, k) });
      for (let s = 1; s <= n; s++) {
        const bs = before[s].state;
        if ((bs !== 'alive' && bs !== 'flipped') || (k > 0 && (rd.deaths || []).indexOf(s) >= 0) || no('run', k, s)) continue;
        const up = sh.run.indexOf(s) >= 0;
        ran.push({ i: s - 1, up: up, quit: up && (sh.quit || []).indexOf(s) >= 0 });
        if (up) lastSpoke[s - 1] = Math.max(lastSpoke[s - 1], day);
      }
      Object.keys(sh.votes || {}).forEach((v) => {
        const voter = +v, c = sh.votes[v];
        if (okSeat(voter) && okSeat(c) && voter !== c && !no('bvote', k, voter)) addPair(voter - 1, c - 1, nine(SPEECH.bvote), 1);
      });
    }

    // the seer sees the mechanical wolf as a wolf
    if (meSeer && rd.check && okSeat(rd.check.seat) && rd.check.seat !== me.seat && !no('check', k, 0))
      limit(rd.check.seat - 1, rd.check.wolf ? 6 : 1, '你验' + rd.check.seat + '号是' + (rd.check.wolf ? '狼' : '好人'));

    events.forEach((e, j) => {
      if (no('event', k, j) || !okSeat(e.a) || (e.b !== undefined && (!okSeat(e.b) || e.b === e.a))) return;
      const a = e.a - 1, t = e.b - 1;
      switch (e.t) {
        case 'atk': case 'sup': case 'side': case 'vote': case 'bvote': case 'badge':
          addPair(a, t, nine(SPEECH[e.t]), e.s > 0 ? e.s : 1); break;
        case 'claim':
          if (ROLES.indexOf(e.r) >= 0 && e.r !== 'wolf' && e.r !== 'mech') claim(a, e.r, day); break;
        case 'check':
          claim(a, 'seer', day);
          if (e.wolf) roleCheck(a, t, 'seer', [CHECK_MISS * other, other, other], (1 - FAKE_KILL_ON_MATE) / g, perMate(FAKE_KILL_ON_MATE));
          else roleCheck(a, t, 'seer', [other, CHECK_MISS * other, CHECK_MISS * other], (1 - FAKE_GOLD_TO_MATE) / g, perMate(FAKE_GOLD_TO_MATE));
          break;
        case 'save':
          claim(a, 'witch', day);
          roleCheck(a, t, 'witch', K, (1 - FAKE_SAVE_ON_MATE) / g, perMate(FAKE_SAVE_ON_MATE));
          saveChecks.push({ a: a, b: t });
          break;
        case 'poison':
          claim(a, 'witch', day);
          addPair(a, t, nine(SPEECH.poison), 1); break;
        case 'shoot':
          if (b.hunter > 0 || mech) {
            setRole(a, 'hunter', e.a + '号开了枪，是猎人' + (mech ? '或学了猎人的机械狼' : ''), true);
            if (mech) single[a][2] += Math.log(MECH_LEARNT);
          }
          addSingle(t, [(1 - SHOT_AT_WOLF) / Math.max(1, g - 1), SHOT_AT_WOLF / wt, SHOT_AT_WOLF / wt]); break;
        case 'boom':   // the mechanical wolf can't blow itself up
          limit(a, 2, e.a + '号自爆了，是狼'); break;
        case 'flip':
          if (b.idiot > 0) setRole(a, 'idiot', e.a + '号翻牌是白痴'); break;
      }
    });
  });

  // claims: what each claim costs each possible role
  for (let i = 0; i < n; i++) {
    Object.keys(claims[i]).forEach((r) => {
      single[i][1] += Math.log(r === 'villager' ? CLAIM_WOLF_VILLAGER : (CLAIM_WOLVES[r] || 0.05) / w);
      single[i][2] += Math.log(CLAIM_MECH[r] || 0.05);
      for (let x = 0; x < R; x++) base[i][x] *= roles[x] === r ? CLAIM_TRUE[r] : CLAIM_LIE[r];
    });
  }
  ran.forEach((o) => {
    const claimant = claims[o.i].seer;
    const f = (r) => claimant ? (o.quit ? (r === 'seer' ? QUIT.seer : CLAIMANT_QUIT) : 1)
      : o.up ? RUN[r] * (o.quit ? QUIT[r] : 1 - QUIT[r]) : 1 - RUN[r];
    single[o.i][1] += Math.log(f('wolf'));
    single[o.i][2] += Math.log(f('mech'));
    for (let x = 0; x < R; x++) base[o.i][x] *= f(roles[x]);
  });
  // a real god who let someone else claim their role and said nothing
  gods.forEach((r) => {
    const day = firstClaim[r];
    if (day === undefined) return;
    for (let i = 0; i < n; i++) if (!claims[i][r] && (lastDay[i] >= day || lastSpoke[i] >= day)) base[i][ri[r]] *= SILENT[r];
  });
  for (let i = 0; i < n; i++) if (fixedRole[i] >= 0) for (let x = 0; x < R; x++) if (x !== fixedRole[i]) base[i][x] = 0;

  const pairList = [];
  pairs.forEach((L, key) => { pairList.push({ i: Math.floor(key / n), j: key % n, L: L }); });
  return { n, w, mech, roles, R, mask, fixedRole, conflicts, single, pairList, base, roleChecks, saveChecks, gods, counts: gods.map((r) => b[r]), claims };
}

export function validate(game) {
  const n = game.n, b = game.board || {};
  if (!(n >= MIN_PLAYERS && n <= MAX_PLAYERS)) return '人数要在 ' + MIN_PLAYERS + ' 到 ' + MAX_PLAYERS + ' 之间';
  const sum = boardSize(b);
  if (sum !== n) return sum < n ? '板子只有 ' + sum + ' 张牌，比总人数少 ' + (n - sum) + ' 张' : '板子有 ' + sum + ' 张牌，比总人数多 ' + (sum - n) + ' 张';
  if (!(b.wolf >= 1)) return '至少要有一只狼人';
  if (b.mech > 1) return '机械狼最多一只';
  if (b.wolf + (b.mech || 0) >= n) return '至少要有一个好人';
  return '';
}

// opts.light skips the role and pair answers (for explain(), which only needs each player's wolf chance)
export function infer(game, opts) {
  const bad = validate(game);
  if (bad) return { ok: false, reason: bad };
  const light = opts && opts.light;
  const M = compile(game, opts && opts.skip);
  const { n, w, mech, R, mask, single, pairList, base, roleChecks, saveChecks, counts } = M;
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
  const wt = w + mech, m = n - wt;
  const F = new Float64Array((m + 1) * S), B = new Float64Array((m + 1) * S), FI = new Float64Array(m * R);
  const goods = new Int32Array(m), state = new Uint8Array(n), inTeam = new Uint8Array(n);

  // deal the good roles to the players in state 0; returns the total weight of the deals
  function deal() {
    let t = 0;
    for (let i = 0; i < n; i++) if (!state[i]) goods[t++] = i;
    F.fill(0); F[0] = 1;
    for (t = 0; t < m; t++) {
      const i = goods[t], f = base[i];
      for (let x = 0; x < R; x++) {
        let v = f[x];
        if (v) for (const c of roleChecks[i]) v *= x === c.k ? (state[c.b] === 0 ? c.good : state[c.b] === 1 ? c.wolf : c.mech) : c.other;
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
    return F[m * S + full];
  }
  // the backward half of the walk gives each good player's chance of each role in the last deal()
  function roleShares(wt, Rw) {
    B.fill(0); B[m * S + full] = 1;
    for (let t = m - 1; t >= 0; t--) {
      const o = t * S, o2 = o + S;
      for (let s = 0; s < S; s++) {
        let acc = 0;
        for (let x = 0; x < R; x++) { const fx = FI[t * R + x], s2 = next[s * R + x]; if (fx && s2 >= 0) acc += fx * B[o2 + s2]; }
        B[o + s] = acc;
      }
    }
    for (let t = 0; t < m; t++) {
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
  function logT() {
    let lt = 0;
    for (let i = 0; i < n; i++) lt += single[i][state[i]];
    for (const p of pairList) lt += p.L[3 * state[p.i] + state[p.j]];
    return lt;
  }

  // the wolf team (wolves and the mechanical wolf together) is chosen from those who can be on it
  const free = [], must = [];
  for (let i = 0; i < n; i++) { if (!(mask[i] & 1)) must.push(i); else if (mask[i] !== 1) free.push(i); }
  const need = wt - must.length;
  if (need < 0 || need > free.length) return { ok: false, reason: '确定的信息互相矛盾：确定是狼的有 ' + must.length + ' 人，板子只有 ' + wt + ' 只狼' + (need > free.length ? '，或者确定是好人的太多了' : '') };

  let top = -Infinity, Z = 0, worlds = 0;
  const pW = new Float64Array(n), bothW = light ? null : new Float64Array(n * n), roleAcc = light ? null : new Float64Array(n * R);
  const wolfAcc = new Float64Array(n), mechAcc = new Float64Array(n);
  const best = [];   // the likeliest wolf teams, log weight first
  const idx = [];
  for (let x = 0; x < need; x++) idx.push(x);

  function rescale(f) {
    Z *= f;
    for (let i = 0; i < n; i++) { pW[i] *= f; wolfAcc[i] *= f; mechAcc[i] *= f; }
    if (!light) { for (let x = 0; x < bothW.length; x++) bothW[x] *= f; for (let x = 0; x < roleAcc.length; x++) roleAcc[x] *= f; }
  }

  for (;;) {
    inTeam.fill(0);
    for (const i of must) inTeam[i] = 1;
    for (const x of idx) inTeam[free[x]] = 1;

    // which of the team is the mechanical wolf: anyone who can be, as long as the rest can be wolves
    const options = [];
    let notWolf = -1, many = false;
    for (let i = 0; i < n; i++) if (inTeam[i] && !(mask[i] & 2)) { if (notWolf >= 0) many = true; notWolf = i; }
    if (!mech) { if (notWolf < 0) options.push(-1); }
    else if (!many) for (let i = 0; i < n; i++) if (inTeam[i] && (mask[i] & 4) && (notWolf < 0 || notWolf === i)) options.push(i);

    const ways = [];
    for (const mi of options) {
      for (let i = 0; i < n; i++) state[i] = inTeam[i];
      if (mi >= 0) state[mi] = 2;
      const lt = logT();
      if (lt > -Infinity) ways.push({ mi: mi, lt: lt });
    }
    if (ways.length) {
      // the deal of good roles is the same whichever is the mechanical wolf, unless a claimed save points into the team
      const each = mech && saveChecks.some((c) => inTeam[c.b] && !inTeam[c.a]);
      const setState = (mi) => { for (let i = 0; i < n; i++) state[i] = inTeam[i]; if (mi >= 0) state[mi] = 2; };
      let shared = 0;
      if (!each) { setState(ways[0].mi); shared = deal(); }
      for (const v of ways) {
        if (each) { setState(v.mi); v.R = deal(); } else v.R = shared;
        v.lw = v.R > 0 ? v.lt + Math.log(v.R) : -Infinity;
      }
      const live = ways.filter((v) => v.lw > -Infinity);
      if (live.length) {
        const hi = Math.max.apply(null, live.map((v) => v.lw));
        if (hi > top) { if (top > -Infinity) rescale(Math.exp(top - hi)); top = hi; }
        let sum = 0;
        for (const v of live) {
          v.wt = Math.exp(v.lw - top);
          sum += v.wt;
          if (v.mi >= 0) mechAcc[v.mi] += v.wt;
          for (let i = 0; i < n; i++) if (inTeam[i] && i !== v.mi) wolfAcc[i] += v.wt;
          if (!light && each) { setState(v.mi); deal(); roleShares(v.wt, v.R); }
        }
        worlds += live.length;
        Z += sum;
        for (let i = 0; i < n; i++) if (inTeam[i]) pW[i] += sum;
        if (!light) {
          for (let i = 0; i < n; i++) if (inTeam[i]) for (let j = i + 1; j < n; j++) if (inTeam[j]) bothW[i * n + j] += sum;
          if (!each) roleShares(sum, shared);   // F and FI still hold the shared deal
        }
        const lw = top + Math.log(sum);
        if (best.length < 6 || lw > best[best.length - 1].lw) {
          const set = [];
          for (let i = 0; i < n; i++) if (inTeam[i]) set.push(i + 1);
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
  const out = {
    ok: true, n, roles: M.roles, worlds, pWolf: Array.from(pW, (v) => v / Z),
    fixedTeam: Array.from(mask, (k) => (k === 1 ? 1 : k & 1 ? 0 : 2)),
    fixedRole: Array.from(mask, (k, i) => (k === 2 ? 'wolf' : k === 4 ? 'mech' : k === 1 && M.fixedRole[i] >= 0 ? M.roles[M.fixedRole[i]] : null))
  };
  // best holds absolute log weights, Z is scaled by the final top
  out.top = best.map((e) => ({ wolves: e.wolves, p: Math.exp(e.lw - top) / Z }));
  if (!light) {
    out.role = [];
    for (let i = 0; i < n; i++) {
      const r = { wolf: wolfAcc[i] / Z };
      if (mech) r.mech = mechAcc[i] / Z;
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
    const sh = rd.sheriff;
    if (sh && Array.isArray(sh.run) && sh.run.length) {
      const ran = sh.run.indexOf(seat) >= 0, quit = ran && (sh.quit || []).indexOf(seat) >= 0;
      items.push({ label: '第' + (k + 1) + '天 ' + seat + ' 号' + (quit ? '上警后退水' : ran ? '上警' : '没上警'), kind: 'run', k, j: seat });
      Object.keys(sh.votes || {}).forEach((v) => {
        if (+v === seat || sh.votes[v] === seat) items.push({ label: '第' + (k + 1) + '天 ' + v + ' 号警下投 ' + sh.votes[v] + ' 号', kind: 'bvote', k, j: +v });
      });
    }
    if (game.me && game.me.role === 'witch' && rd.knife === seat) items.push({ label: '第' + (k + 1) + '夜 刀口是 ' + seat + ' 号', kind: 'knife', k, j: 0 });
  });
  items.forEach((it) => { it.skip = (kind, k, j) => kind === it.kind && k === it.k && j === it.j; });
  return items;
}
