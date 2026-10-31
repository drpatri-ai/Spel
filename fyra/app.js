/* Fyra i rad – gränssnitt */
'use strict';

/* ---------- lagring ---------- */
const store = makeStore('f4');

/* ---------- figurer ---------- */
const BOARDS = [
  { name: 'Blå', c: '#3B6CF6', d: '#2A4FC4' },
  { name: 'Turkos', c: '#14AFC0', d: '#0B7F8C' },
  { name: 'Natt', c: '#3A3F8F', d: '#262A66' },
  { name: 'Sol', c: '#F5B400', d: '#C98F00' }
];
const SET = Object.assign({ sound: true, vib: true, board: 0 }, store.get('settings', {}));
const saveSet = () => store.set('settings', SET);

const discHTML = i => `<div class="disc" style="${styleOf(i)}"><img src="${avatarSrc(i)}" alt=""></div>`;

const SAY = {
  start: ['Nu kör vi!', 'Lycka till!', 'Jag är redo! 💪', 'Kom igen då!', 'Jag börjar!'],
  win: ['Jaaa! 🎉', 'Fyra i rad!', 'Wiii! 🥳', 'Yes! 🙌', 'Vem är bäst?!'],
  lose: ['Nästan… 😅', 'Revansch!', 'Åh nej!', 'Nästa gång!', 'Grr! 😤'],
  think: ['Hmm… 🤔', 'Låt mig tänka…', 'Spännande…', 'Aha!', 'Vänta lite…'],
  block: ['Inte så fort! ✋', 'Stopp där!', 'Ha, blockad! 🛡️', 'Trodde du ja!'],
  draw: ['Oavgjort! 🤝', 'Jämnt skägg!', 'Lika bra!']
};

/* ---------- ljud & vibration ---------- */
const SFX = {
  tap: () => tone(720, .07, { type: 'triangle', vol: .1 }),
  pick: () => [660, 990].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .07 })),
  whoosh: () => tone(900, .16, { to: 420, vol: .05 }),
  plop: r => { tone(200 + r * 28, .16, { to: 100, vol: .32 }); tone(560 + r * 30, .05, { type: 'triangle', vol: .07 }); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .24, { type: 'triangle', vol: .15, delay: i * .1 })),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, .3, { vol: .14, delay: i * .17 })),
  draw: () => [392, 494, 392].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .12, delay: i * .14 })),
  bonk: () => tone(150, .12, { type: 'square', vol: .05, to: 110 }),
  hint: () => [880, 1175, 1568].forEach((f, i) => tone(f, .12, { vol: .1, delay: i * .07 })),
  undo: () => tone(520, .14, { to: 300, type: 'triangle', vol: .1 })
};

/* ---------- skärmar ---------- */
let current = 'menu';
const hist = [];
function show(id, push = true) {
  if (push && current !== id) hist.push(current);
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') { hist.length = 0; buildMenu(); }
  if (id === 'stats') buildStats();
  if (id === 'settings') buildSettings();
  if (id === 'net') buildNet();
  if (id === 'nlobby') buildNLobby();
  if (window.Android && Android.keepAwake) try { Android.keepAwake(S.mode === 'net' && (id === 'game' || id === 'nlobby')); } catch (e) { }
}
function back() {
  const prev = hist.pop() || 'menu';
  show(prev, false);
}

/* ---------- bakgrund ---------- */
bubbles();

/* ---------- meny ---------- */
function buildMenu() {
  let k = 0;
  const line = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = line('Bucinca', 'l1') + line('4a i rad', 'l2');
  $('dance').innerHTML = CHARS.map((_, i) => avHTML(i)).join('');
  [...$('dance').children].forEach((el, i) => el.style.animationDelay = (i * .18) + 's');
}

/* ---------- spelläge & figurval ---------- */
const S = {
  mode: '2p', level: 'medium', players: [], board: AI.newBoard(), moves: [], turn: 0, starter: 0,
  scores: [0, 0], round: 1, over: false, busy: false, hints: [3, 3], token: 0
};
const LEVEL_NAME = { easy: 'Lätt 🐣', medium: 'Medel 🦊', hard: 'Svår 🦁' };
let selStep = 0, selPicked = [];

document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  SFX.tap();
  const g = b.dataset.go;
  if (g === '2p') { S.mode = '2p'; startSelect(); }
  else if (g === 'bot') { S.mode = 'bot'; show('level'); }
  else show(g);
}));
document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => {
  SFX.tap(); S.level = b.dataset.level; startSelect();
}));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { SFX.tap(); back(); }));

let selDone = null;   // nätverk: bara en figur väljs, sedan anropas selDone(figur)
function startSelect(done) { selStep = 0; selPicked = []; selDone = done || null; renderSelect(); show('select'); }
function renderSelect() {
  const bot = S.mode === 'bot';
  if (selDone) {
    $('selTitle').textContent = 'Välj din figur!'; $('selSub').textContent = 'Du spelar över nätverket 🌐';
    $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === NET.taken ? 'taken' : ''}" data-i="${i}" data-tag="Motståndaren" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
    $('chars').querySelectorAll('.char').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.i; if (i === NET.taken) { SFX.bonk(); return; } SFX.pick(); buzz(12); el.classList.add('pick'); store.set('netCh', i);
      const d = selDone; selDone = null; setTimeout(() => d(i), 380);
    }));
    return;
  }
  $('selTitle').textContent = selStep === 0 ? (bot ? 'Välj din figur!' : 'Spelare 1 – välj figur!') : (bot ? 'Välj motståndare 🤖' : 'Spelare 2 – välj figur!');
  $('selSub').textContent = selStep === 0 ? (bot ? 'Datorn spelar på nivå ' + LEVEL_NAME[S.level] : 'Ni turas om på samma skärm') : 'Vem vill du utmana?';
  $('chars').innerHTML = CHARS.map((_, i) => {
    const taken = selPicked.includes(i);
    return `<button class="char ${taken ? 'taken' : ''}" data-i="${i}" data-tag="${bot ? 'Du' : 'Spelare 1'}" style="${styleOf(i)}">
      ${avHTML(i)}<b>${esc(charName(i))}</b></button>`;
  }).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.addEventListener('click', () => {
    const i = +el.dataset.i;
    if (selPicked.includes(i)) { SFX.bonk(); return; }
    SFX.pick(); buzz(12);
    el.classList.add('pick');
    selPicked.push(i);
    setTimeout(() => {
      if (selStep === 0) { selStep = 1; renderSelect(); }
      else startGame();
    }, 380);
  }));
}

/* ---------- spelbrädet ---------- */
function buildFrame() {
  const b = BOARDS[SET.board] || BOARDS[0];
  let holes = '', rings = '';
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    holes += `<circle cx="${50 + c * 100}" cy="${50 + r * 100}" r="40" fill="black"/>`;
    rings += `<circle cx="${50 + c * 100}" cy="${50 + r * 100}" r="41" fill="none" stroke="${b.d}" stroke-width="5"/>`;
  }
  $('frame').innerHTML = `<defs>
    <linearGradient id="bgr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b.c}"/><stop offset="1" stop-color="${b.d}"/></linearGradient>
    <mask id="holes"><rect width="700" height="600" fill="white"/>${holes}</mask></defs>
    <rect width="700" height="600" rx="36" fill="url(#bgr)" mask="url(#holes)"/>${rings}
    <rect x="3" y="3" width="694" height="594" rx="34" fill="none" stroke="#ffffff55" stroke-width="6"/>`;
}
(function buildHit() {
  const hit = $('hit');
  hit.innerHTML = '<div></div>'.repeat(7);
  let active = false;
  const colAt = x => {
    const r = hit.getBoundingClientRect();
    return Math.max(0, Math.min(6, Math.floor((x - r.left) / r.width * 7)));
  };
  hit.addEventListener('pointerdown', e => {
    if (!canHumanPlay()) return;
    active = true; ac();
    try { hit.setPointerCapture(e.pointerId); } catch (_) { }
    showGhost(colAt(e.clientX));
  });
  hit.addEventListener('pointermove', e => {
    if (!canHumanPlay()) return;
    if (active || e.pointerType === 'mouse') showGhost(colAt(e.clientX));
  });
  hit.addEventListener('pointerup', e => {
    if (!active) return;
    active = false;
    if (canHumanPlay()) humanPlay(colAt(e.clientX));
  });
  hit.addEventListener('pointercancel', () => { active = false; hideGhost(); });
  hit.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hideGhost(); });
})();

function showGhost(c) {
  const g = $('ghost');
  const ci = S.players[S.turn].char;
  if (g.dataset.ch !== String(ci)) { g.innerHTML = discHTML(ci); g.dataset.ch = ci; }
  g.style.left = (c * 100 / 7) + '%';
  g.classList.add('on');
}
function hideGhost() { $('ghost').classList.remove('on'); }
function showArrow(c) {
  const a = $('arrow');
  a.style.left = (c * 100 / 7) + '%';
  a.classList.add('on');
  clearTimeout(showArrow.t);
  showArrow.t = setTimeout(() => a.classList.remove('on'), 2600);
}
function clearArrow() { $('arrow').classList.remove('on'); }

function addPiece(r, c, pi, animate) {
  const el = document.createElement('div');
  el.className = 'piece';
  el.dataset.rc = r + ',' + c;
  el.style.left = (c * 100 / 7) + '%';
  el.style.top = (r * 100 / 6) + '%';
  el.innerHTML = discHTML(S.players[pi].char);
  const t = 300 + r * 65;
  if (animate) {
    el.classList.add('fall');
    el.style.setProperty('--from', `-${(r + 1) * 100}%`);
    el.style.setProperty('--t', t + 'ms');
  }
  $('pieces').appendChild(el);
  return t;
}
function renderPieces() {
  $('pieces').innerHTML = '';
  $('wline').innerHTML = '';
  $('board').classList.remove('done');
  for (const m of S.moves) addPiece(m.r, m.c, m.pi, false);
}

/* ---------- spelarkort ---------- */
const pName = pi => (S.players[pi] && S.players[pi].name) || charName(S.players[pi].char);
function renderCards() {
  for (let pi = 0; pi < 2; pi++) {
    const p = S.players[pi];
    const tag = S.mode === 'bot' ? (p.bot ? '🤖 ' + LEVEL_NAME[S.level] : 'Du') : S.mode === 'net' ? (pi === NET.me ? 'Du' : '🌐 Motståndare') : 'Spelare ' + (pi + 1);
    const el = $('pc' + pi);
    el.setAttribute('style', styleOf(p.char));
    el.className = 'pc';
    el.innerHTML = `${avHTML(p.char)}<div class="info"><span class="nm">${esc(pName(pi))}</span><span class="tag">${tag}</span></div>
      <span class="sc" id="sc${pi}">${S.scores[pi]}</span><div class="bubble" id="bub${pi}"></div>`;
  }
}
function updateTurn() {
  for (let pi = 0; pi < 2; pi++) {
    const el = $('pc' + pi);
    el.classList.toggle('turn', !S.over && S.turn === pi);
    $('sc' + pi).textContent = S.scores[pi];
  }
  const human = !S.players[S.turn].bot && (S.mode !== 'net' || S.turn === NET.me);
  $('bUndo').classList.toggle('hidden', S.mode === 'net'); $('bRestart').classList.toggle('hidden', S.mode === 'net');
  $('bUndo').disabled = S.over || !S.moves.length || (S.mode === 'bot' && !S.moves.some(m => !S.players[m.pi].bot));
  $('bHint').disabled = S.over || !human || S.hints[S.turn] <= 0;
  $('hintN').textContent = human ? S.hints[S.turn] : S.hints[0];
}
function say(pi, text, ms = 1900) {
  const b = $('bub' + pi);
  if (!b) return;
  b.textContent = text;
  b.classList.add('show');
  clearTimeout(b._t);
  b._t = setTimeout(() => b.classList.remove('show'), ms);
}

/* ---------- spelets gång ---------- */
function canHumanPlay() { return current === 'game' && !S.over && !S.busy && S.players[S.turn] && !S.players[S.turn].bot && (S.mode !== 'net' || (S.turn === NET.me && !NET.waiting)); }
function humanPlay(c) {
  if (S.mode !== 'net') return play(c);
  if (AI.dropRow(S.board, c) < 0) return play(c);   // full kolumn: skaka brädet
  if (NET.host) hostMove(c, 0);
  else { S.busy = true; hideGhost(); clSend({ t: 'mv', c }); setTimeout(() => { if (S.busy && !S.over && S.turn === NET.me && !NET.chainBusy) S.busy = false; }, 4000); }
}

function startGame() {
  const bot = S.mode === 'bot';
  S.players = [{ char: selPicked[0], bot: false }, { char: selPicked[1], bot }];
  S.scores = [0, 0];
  S.round = 1;
  S.starter = 0;
  buildFrame();
  show('game');
  newRound();
}
function newRound() {
  S.token++;
  S.board = AI.newBoard();
  S.moves = [];
  S.turn = S.starter;
  S.over = false;
  S.busy = false;
  S.hints = [3, 3];
  $('roundLbl').textContent = 'Runda ' + S.round;
  $('gSound').textContent = SND.sound ? '🔊' : '🔇';
  hideGhost(); clearArrow();
  renderCards();
  renderPieces();
  updateTurn();
  setTimeout(() => say(S.turn, pick(SAY.start)), 300);
  maybeBot();
}

async function play(c) {
  const r = AI.dropRow(S.board, c);
  if (r < 0) {
    SFX.bonk(); buzz(30);
    $('board').animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 220 });
    return;
  }
  S.busy = true;
  hideGhost(); clearArrow();
  const pi = S.turn, v = pi + 1, tok = S.token;
  S.board[r][c] = v;
  S.moves.push({ r, c, pi });
  $('pc' + pi).classList.remove('turn');
  const t = addPiece(r, c, pi, true);
  SFX.whoosh();
  await wait(t * 0.72);
  if (tok !== S.token) return;
  SFX.plop(r); buzz(18);
  await wait(t * 0.28 + 30);
  if (tok !== S.token) return;
  const line = AI.winLine(S.board, r, c, v);
  if (line) return endRound(pi, line);
  if (AI.isFull(S.board)) return endRound(-1, null);
  S.turn = 1 - pi;
  S.busy = false;
  updateTurn();
  maybeBot();
}

async function maybeBot() {
  const p = S.players[S.turn];
  if (!p || !p.bot || S.over) return;
  S.busy = true;
  updateTurn();
  const tok = S.token, pi = S.turn;
  const card = $('pc' + pi);
  card.classList.add('thinking');
  if (Math.random() < 0.35) say(pi, pick(SAY.think), 1400);
  await wait(380 + Math.random() * 380);
  await nextFrame();
  if (tok !== S.token) return;
  const res = AI.botMove(S.board, pi + 1, S.level);
  await wait(120);
  if (tok !== S.token) return;
  card.classList.remove('thinking');
  if (res.reason === 'block' && Math.random() < 0.7) say(pi, pick(SAY.block));
  play(res.c);
}

function endRound(winner, line) {
  S.over = true;
  S.busy = false;
  const tok = S.token;
  $('board').classList.add('done');
  if (line) {
    for (const [r, c] of line) {
      const el = $('pieces').querySelector(`[data-rc="${r},${c}"]`);
      if (el) el.classList.add('winp');
    }
    const a = line[0], z = line[line.length - 1];
    $('wline').innerHTML = `<line x1="${50 + a[1] * 100}" y1="${50 + a[0] * 100}" x2="${50 + z[1] * 100}" y2="${50 + z[0] * 100}"/>`;
  }
  const humanLost = (S.mode === 'bot' && winner === 1) || (S.mode === 'net' && winner >= 0 && NET.me >= 0 && winner !== NET.me);
  if (winner >= 0) {
    S.scores[winner]++;
    $('pc' + winner).classList.add('happy');
    $('pc' + (1 - winner)).classList.add('sad');
    say(winner, pick(SAY.win), 2400);
    setTimeout(() => say(1 - winner, pick(SAY.lose), 2000), 500);
    humanLost ? SFX.lose() : SFX.win();
    buzz(humanLost ? 60 : 120);
  } else {
    say(0, pick(SAY.draw)); say(1, pick(SAY.draw));
    SFX.draw();
  }
  recordStats(winner);
  updateTurn();
  S.starter = winner >= 0 ? 1 - winner : 1 - S.starter;
  setTimeout(async () => {
    if (tok !== S.token || current !== 'game') return;
    if (winner >= 0) {
      const wc = S.players[winner].char;
      await celebrate(wc, ((S.mode === 'bot' && winner === 0) || (S.mode === 'net' && winner === NET.me)) ? 'Du vann!' : pName(winner) + ' vann!');
      if (tok !== S.token || current !== 'game') return;
    }
    showResult(winner);
  }, winner >= 0 ? 1100 : 1700);
}

function showResult(winner) {
  const P = S.players;
  const bot = S.mode === 'bot';
  let html;
  const scoreLine = `<div class="score-big">${avHTML(P[0].char, '').replace('class="av ', 'class="av sm ')}
     <span>${S.scores[0]} – ${S.scores[1]}</span>${avHTML(P[1].char).replace('class="av ', 'class="av sm ')}</div>`;
  if (winner >= 0) {
    const ch = P[winner].char;
    let title, sub;
    if (S.mode === 'net' && winner === NET.me) { title = 'Du vann! 🎉'; sub = pick(['Snyggt spelat!', 'Fyra i rad – snyggt!', 'Mästare! 👑']); }
    else if (S.mode === 'net') { title = esc(pName(winner)) + ' vann!'; sub = pick(['Revansch?', 'Det var nära!', 'Nästa runda är din!']); }
    else if (bot && winner === 0) { title = 'Du vann! 🎉'; sub = pick(['Snyggt spelat!', 'Datorn hade ingen chans!', 'Grymt jobbat!']); }
    else if (bot) { title = esc(charName(ch)) + ' vann!'; sub = pick(['Försök igen – du klarar det!', 'Det var nära!', 'Revansch?']); }
    else { title = esc(charName(ch)) + ' vinner!'; sub = pick(['Fyra i rad – snyggt!', 'Vilket drag!', 'Mästare! 👑']); }
    html = `<div class="win-av">${!(bot && winner === 1) ? '<div class="crown">👑</div>' : ''}${avHTML(ch)}</div><h3>${title}</h3><p>${sub}</p>`;
  } else {
    html = `<div class="score-big" style="margin-top:6px">${avHTML(P[0].char).replace('class="av ', 'class="av sm ')}🤝${avHTML(P[1].char).replace('class="av ', 'class="av sm ')}</div>
      <h3>Oavgjort!</h3><p>Brädet blev fullt – ingen fick fyra i rad.</p>`;
  }
  html += scoreLine + `<button class="btn green" id="rNext">▶️ Nästa runda</button><button class="btn white" id="rMenu">${S.mode === 'net' ? '🚪 Lämna matchen' : '🏠 Till menyn'}</button>`;
  openPanel(html);
  $('rNext').onclick = () => {
    SFX.tap();
    if (S.mode === 'net') {
      if (NET.host) { closePanel(); hostNextRound(); }
      else { clSend({ t: 'next' }); $('rNext').disabled = true; $('rNext').textContent = `⏳ Väntar på ${pName(0)}…`; }
      return;
    }
    closePanel(); S.round++; newRound();
  };
  $('rMenu').onclick = () => { SFX.tap(); closePanel(); leaveGame(); };
}

function leaveGame() { S.token++; S.over = true; if (S.mode === 'net') { netLeave(); return; } show('menu'); }

function openPanel(html) {
  $('panel').innerHTML = html;
  $('panel').querySelectorAll('.av.sm').forEach(a => a.style.width = '64px');
  $('overlay').classList.add('on');
}
function closePanel() { $('overlay').classList.remove('on'); }
function confirmBox(title, text, yes, onYes) {
  openPanel(`<h3>${title}</h3><p>${text}</p><button class="btn pink" id="cYes">${yes}</button><button class="btn white" id="cNo">Nej, spela vidare</button>`);
  $('cYes').onclick = () => { SFX.tap(); closePanel(); onYes(); };
  $('cNo').onclick = () => { SFX.tap(); closePanel(); };
}

/* knappar i spelet */
$('gHome').onclick = () => {
  SFX.tap();
  if (S.mode === 'net') confirmBox('Lämna matchen?', NET.host ? 'Matchen tar slut för båda.' : 'Du lämnar matchen.', 'Ja, lämna', leaveGame);
  else if (S.moves.length && !S.over) confirmBox('Avsluta spelet?', 'Ställningen sparas inte.', 'Ja, till menyn', leaveGame);
  else leaveGame();
};
$('gSound').onclick = () => {
  SND.sound = !SND.sound; saveSnd();
  $('gSound').textContent = SND.sound ? '🔊' : '🔇';
  SFX.tap();
};
$('bRestart').onclick = () => {
  SFX.tap();
  if (S.moves.length && !S.over) confirmBox('Börja om rundan?', 'Brädet töms men poängen finns kvar.', 'Ja, börja om', newRound);
  else newRound();
};
$('bUndo').onclick = () => {
  if (S.busy || S.over || !S.moves.length) return;
  if (S.mode === 'bot') {
    if (!S.moves.some(m => !S.players[m.pi].bot)) return;
    while (S.moves.length) {
      const m = S.moves.pop();
      S.board[m.r][m.c] = 0;
      if (!S.players[m.pi].bot) { S.turn = m.pi; break; }
    }
  } else {
    const m = S.moves.pop();
    S.board[m.r][m.c] = 0;
    S.turn = m.pi;
  }
  S.token++;
  SFX.undo(); buzz(10);
  renderPieces();
  updateTurn();
};
$('bHint').onclick = async () => {
  if (!canHumanPlay() || S.hints[S.turn] <= 0) return;
  S.busy = true;
  const pi = S.turn, tok = S.token;
  say(pi, 'Hmm, låt mig se… 💡', 900);
  await nextFrame();
  const res = AI.botMove(S.board, pi + 1, 'hint');
  if (tok !== S.token) return;
  S.busy = false;
  S.hints[pi]--;
  showArrow(res.c);
  SFX.hint();
  updateTurn();
};


/* ================= NÄTVERK (wifi + internet) =================
   Värden bestämmer: tar emot drag, kollar att det är rätt tur och skickar dem till alla.
   Spelare 0 = värden, spelare 1 = den som går med först. Fler som går med får titta på. */
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = (location.protocol === 'http:' && location.port === String(PORT)) || !!NET_ONLINE;
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const NET = { taken: -1, host: false, me: -1, ws: null, ok: false, opp: null, id: null, waiting: false, closing: false, tries: 0, chain: Promise.resolve(), chainBusy: false, ch: 0, name: '' };
const canHostLan = () => !!(window.Android && Android.netHost);
const urlName = () => (Q.get('n') || '').slice(0, 14);
// drag spelas i tur och ordning (ett drag i taget, även om två kommer tätt)
function queue(fn) { NET.chain = NET.chain.then(async () => { NET.chainBusy = true; try { await fn(); } catch (e) { } NET.chainBusy = false; }); }

/* ---------- menyn för nätverk ---------- */
let scanning = false;
function buildNet() {
  const app = !!window.Android;
  $('netBox').innerHTML = `<div class="card"><h4>🎮 Starta en match</h4>
      <p class="note">Du blir värd och väljer figur. Sedan går en motståndare med från sin telefon.</p>
      ${canHostLan() ? '<button class="btn" id="nHostLan">📡 Starta wifi-match</button>' : ''}
      <button class="btn blue" id="nHostOn">🌍 Starta internetmatch</button></div>
    ${netJoinCardHTML('card')}
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Wifi-match: skriv adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Wifi-matchen startas i Android-appen. Skanna QR-koden hos värden med kameran, eller skriv adressen här.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>`;
  const ch = store.get('netCh', 0) % CHARS.length;
  if ($('nHostLan')) $('nHostLan').onclick = () => { SFX.tap(); S.mode = 'net'; startSelect(i => startHostingLan(i)); };
  $('nHostOn').onclick = () => { SFX.tap(); S.mode = 'net'; startSelect(i => { location.href = netOnlineHostURL('fyra.html', `n=${encodeURIComponent(charName(i))}&c=${i}`); }); };
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'fyra.html');
  };
  netBindJoinCard((page, code) => `${page}?online=${encodeURIComponent(code)}&n=${encodeURIComponent(charName(ch))}&c=${ch}&back=${encodeURIComponent(location.href.split('?')[0])}`);
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">🔴</span> Letar efter matcher…</p>`;
  window.onNetScan = list => {
    scanning = false;
    if (current !== 'net' || !$('found')) return;
    $('found').innerHTML = list.length ? list.map(m => { const g = netGameOf(m.name); return `<button class="btn blue" data-ip="${esc(m.ip)}" data-port="${m.port}" data-page="${g.page}">${esc(g.label)}</button>`; }).join('')
      : `<p class="note">Hittade ingen match. Be värden trycka 📡 Starta wifi-match – och kolla att ni är på samma wifi.</p>`;
    $('found').querySelectorAll('[data-ip]').forEach(b => b.onclick = () => { SFX.tap(); goJoin(b.dataset.ip, +b.dataset.port, b.dataset.page); });
  };
  try { Android.netScan(); } catch (e) { scanning = false; }
}
function goJoin(ip, port, page) {
  const ch = store.get('netCh', 0) % CHARS.length, back = location.href.split('?')[0];
  location.href = `http://${ip}:${port || PORT}/${page}?n=${encodeURIComponent(charName(ch))}&c=${ch}&back=${encodeURIComponent(back)}`;
}
function startHostingLan(ch) {
  let r = null;
  try { r = JSON.parse(Android.netHost('fyra:' + charName(ch) + 's 4 i rad')); } catch (e) { }
  if (!r || !r.ok) { openPanel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/fyra.html?host=1&n=${encodeURIComponent(charName(ch))}&c=${ch}`;
}
function netLeave() {
  NET.closing = true;
  try { NET.ws && NET.ws.close(); } catch (e) { } NET.ws = null;
  if (NET.host || HOSTPAGE) { try { Android.netStop(); } catch (e) { } location.href = NET_ONLINE ? 'fyra.html' : APP_HOME + 'fyra.html'; return; }
  const back = Q.get('back');
  if (back && /^https?:\/\//.test(back)) location.href = back;
  else if (NET_ONLINE) location.href = 'fyra.html';
  else if (window.Android) location.href = APP_HOME + 'fyra.html';
  else { S.mode = '2p'; show('menu'); }
}

/* ---------- värd ---------- */
const hostAll = o => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send('*' + JSON.stringify(o)); };
const hostTo = (id, o) => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send('@' + id + '|' + JSON.stringify(o)); };
function hostStart() {
  NET.host = true; NET.me = 0; S.mode = 'net';
  NET.ch = (+Q.get('c') || 0) % CHARS.length; NET.name = urlName() || charName(NET.ch);
  hostConnect(); show('nlobby');
}
function hostConnect() {
  const ws = netSocket(true);
  NET.ws = ws;
  ws.onopen = () => { NET.ok = true; if (current === 'nlobby') buildNLobby(); };
  ws.onmessage = e => hostRecv(e.data);
  ws.onclose = () => { NET.ok = false; if (NET.ws === ws && !NET.closing) setTimeout(() => { if (NET.ws === ws) hostConnect(); }, 1000); };
}
function syncMsg() {
  return { t: 'sync', p: S.players.map(p => ({ ch: p.char, n: p.name })), ids: ['h', NET.opp], mv: S.moves.map(m => [m.c, m.pi]), turn: S.turn, st: S.starter, sc: S.scores, rd: S.round, ov: S.over ? 1 : 0 };
}
function hostRecv(d) {
  if (d[0] === '+') return;
  if (d[0] === '-') {
    const id = d.slice(1);
    if (id === NET.opp) {
      const nm = pName(1);
      NET.opp = null; S.token++; S.over = true; NET.chain = Promise.resolve();
      closePanel(); show('nlobby');
      openPanel(`<h3>${esc(nm)} lämnade 👋</h3><p>Väntar på en ny motståndare…</p><button class="btn green" id="pOk">OK</button>`); $('pOk').onclick = () => { SFX.tap(); closePanel(); };
    }
    return;
  }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    let ch = Math.abs(m.ch | 0) % CHARS.length;
    const name = String(m.n || 'Spelare').slice(0, 14);
    hostTo(id, { t: 'welcome', id });
    if (!NET.opp || NET.opp === id) {
      const re = NET.opp === id && S.players[1];
      NET.opp = id;
      if (ch === NET.ch) { hostTo(id, { t: 'taken', ch }); if (!S.players[1] || NET.opp !== id) NET.opp = null; return; }   // två likadana brickor går inte att skilja åt
      if (re) { S.players[1].char = ch; S.players[1].name = name; hostTo(id, syncMsg()); renderCards(); return; }
      SFX.pick(); buzz(30);
      S.players = [{ char: NET.ch, name: NET.name, bot: false }, { char: ch, name, bot: false }];
      S.scores = [0, 0]; S.round = 1; S.starter = 0;
      closePanel(); buildFrame(); show('game'); newRound(); hostAll(syncMsg());
    } else hostTo(id, syncMsg());   // tittare
  } else if (m.t === 'mv') {
    if (id === NET.opp) hostMove(m.c | 0, 1);
  } else if (m.t === 'next') {
    if (id === NET.opp && S.over && current === 'game') { closePanel(); hostNextRound(); }
  }
}
function hostMove(c, pi) {
  queue(async () => {
    if (S.over || S.turn !== pi || c < 0 || c > 6 || AI.dropRow(S.board, c) < 0) { hostAll(syncMsg()); return; }
    hostAll({ t: 'mv', c, pi });
    await play(c);
  });
}
function hostNextRound() { if (!S.over) return; S.round++; newRound(); hostAll(syncMsg()); }
function buildNLobby() {
  let invite = '';
  if (NET_ONLINE) invite = netHostCardHTML('fyra.html', 'card', NET.ok);
  else {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/fyra.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    invite = `<div class="card"><h4>📲 Bjud in en motståndare</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: 4 i rad → 🌐 Över nätverket → hitta matchen.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
  }
  $('nlBox').innerHTML = `<div class="card"><div class="waitp">${avHTML(NET.ch)}<div>${esc(NET.name)} 👑<br><span class="note">${NET.ok ? '<span class="spin">⏳</span> Väntar på att någon går med – matchen börjar direkt.' : 'Startar…'}</span></div></div></div>${invite}`;
  if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildNLobby(); };
}
$('nlBack').onclick = () => { SFX.tap(); confirmBox('Avsluta?', 'Matchen stängs.', 'Ja, avsluta', netLeave); };

/* ---------- den som går med ---------- */
const clSend = o => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); };
function clientStart() {
  S.mode = 'net'; NET.host = false;
  startSelect(i => { NET.ch = i; NET.name = (+Q.get('c') === i && urlName()) || charName(i); clientConnect(); });
  $('select').querySelector('[data-back]').onclick = () => { SFX.tap(); netLeave(); };
}
function clientConnect() {
  NET.closing = false;
  const ws = netSocket(false);
  NET.ws = ws;
  openPanel(`<h3>Ansluter… <span class="spin">🔴</span></h3>`);
  ws.onopen = () => { NET.tries = 0; ws.send(JSON.stringify({ t: 'hi', ch: NET.ch, n: NET.name })); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } clientRecv(m); };
  ws.onclose = () => {
    if (NET.ws !== ws || NET.closing) return;
    if (NET.tries++ < 3) { setTimeout(clientConnect, 800); return; }
    openPanel(`<h3>Tappade kontakten 📡</h3><p>Är värden kvar?</p><button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); NET.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); netLeave(); };
  };
}
function clientRecv(m) {
  if (m.t === 'welcome') { NET.id = m.id; return; }
  if (m.t === 'taken') {
    // motståndaren har redan den figuren: välj en annan
    NET.taken = m.ch; closePanel();
    startSelect(i => { NET.ch = i; NET.name = charName(i); clSend({ t: 'hi', ch: NET.ch, n: NET.name }); });
    $('selSub').textContent = 'Den figuren är redan tagen – välj en annan!';
    return;
  }
  if (m.t === 'sync') {
    NET.chain = Promise.resolve(); NET.chainBusy = false;
    const wasRound = S.round, wasOver = S.over, first = current !== 'game';
    S.players = m.p.map(p => ({ char: p.ch, name: p.n, bot: false }));
    // vem är jag? spelare 1 om värden säger att det är jag, annars tittare
    NET.me = m.ids[1] && m.ids[1] === NET.id ? 1 : -1;
    S.token++;
    S.board = AI.newBoard(); S.moves = [];
    for (const [c, pi] of m.mv) { const r = AI.dropRow(S.board, c); if (r < 0) continue; S.board[r][c] = pi + 1; S.moves.push({ r, c, pi }); }
    S.turn = m.turn; S.starter = m.st; S.scores = m.sc; S.round = m.rd; S.over = !!m.ov; S.busy = false; S.hints = S.hints || [3, 3];
    if (first) { buildFrame(); show('game'); }
    if (first || m.rd !== wasRound || (wasOver && !S.over)) { closePanel(); S.hints = [3, 3]; hideGhost(); clearArrow(); setTimeout(() => say(S.turn, pick(SAY.start)), 300); if (!first) SFX.pick(); }
    $('roundLbl').textContent = 'Runda ' + S.round;
    renderCards(); renderPieces(); updateTurn();
    if (first && NET.me < 0) openPanel(`<h3>Du tittar på 👀</h3><p>Två spelar redan. Du ser matchen live.</p><button class="btn green" id="pOk">OK</button>`), $('pOk').onclick = () => { SFX.tap(); closePanel(); };
  } else if (m.t === 'mv') {
    queue(() => play(m.c | 0));
  } else if (m.t === 'hostgone') {
    NET.closing = true; S.over = true;
    openPanel(`<h3>Matchen är slut 👋</h3><p>${esc(pName(0))} avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); netLeave(); };
  }
}

/* ---------- statistik ---------- */
function getStats() {
  const s = store.get('stats', null) || {};
  s.bot = s.bot || {};
  for (const l of ['easy', 'medium', 'hard']) s.bot[l] = Object.assign({ w: 0, l: 0, d: 0, streak: 0, best: 0 }, s.bot[l]);
  s.chars = s.chars || [];
  for (let i = 0; i < CHARS.length; i++) s.chars[i] = s.chars[i] || 0;
  s.two = s.two || 0;
  s.draws2 = s.draws2 || 0;
  return s;
}
function recordStats(winner) {
  const s = getStats();
  if (S.mode === 'net') {
    s.net = Object.assign({ w: 0, l: 0, d: 0 }, s.net);
    if (NET.me < 0) { } else if (winner === NET.me) { s.net.w++; s.chars[S.players[winner].char] = (s.chars[S.players[winner].char] || 0) + 1; }
    else if (winner >= 0) s.net.l++; else s.net.d++;
  } else if (S.mode === 'bot') {
    const b = s.bot[S.level];
    if (winner === 0) { b.w++; b.streak++; b.best = Math.max(b.best, b.streak); }
    else if (winner === 1) { b.l++; b.streak = 0; }
    else b.d++;
  } else {
    s.two++;
    if (winner >= 0) s.chars[S.players[winner].char]++;
    else s.draws2++;
  }
  store.set('stats', s);
}
function buildStats() {
  const s = getStats();
  const rows = ['easy', 'medium', 'hard'].map(l => {
    const b = s.bot[l];
    return `<tr><td>${LEVEL_NAME[l]}</td><td>${b.w}</td><td>${b.l}</td><td>${b.d}</td><td>${b.best}🔥</td></tr>`;
  }).join('');
  const max = Math.max(1, ...s.chars);
  const bars = CHARS.map((_, i) => `<div class="row" style="${styleOf(i)};padding:10px 14px">${avHTML(i)}
      <div class="grow"><h4>${esc(charName(i))}</h4><div class="bar" style="width:${s.chars[i] / max * 100}%"></div></div>
      <b style="font-size:26px;color:var(--c)">${s.chars[i]}</b></div>`).join('');
  $('statsList').innerHTML = `
    <div class="sec">🤖 Mot datorn</div>
    <div class="row"><table><tr><th>Nivå</th><th>Vinster</th><th>Förluster</th><th>Oavgjort</th><th>Bästa svit</th></tr>${rows}</table></div>
    ${s.net ? `<div class="sec">🌐 Över nätverket</div><div class="row"><table><tr><th></th><th>Vinster</th><th>Förluster</th><th>Oavgjort</th></tr><tr><td>🌐</td><td>${s.net.w}</td><td>${s.net.l}</td><td>${s.net.d}</td></tr></table></div>` : ''}
    <div class="sec">👫 Två spelare – vinster per figur</div>${bars}
    <p class="hint-txt">${s.two} spelade rundor · ${s.draws2} oavgjorda</p>
    <button class="btn white small" id="resetStats" style="align-self:center">🗑️ Nollställ statistik</button>`;
  $('statsList').querySelectorAll('.row .av').forEach(a => a.style.width = '56px');
  $('resetStats').onclick = () => {
    SFX.tap();
    confirmBox('Nollställa?', 'All statistik raderas.', 'Ja, nollställ', () => { store.del('stats'); buildStats(); });
  };
}

/* ---------- inställningar ---------- */
function buildSettings() {
  const sw = BOARDS.map((b, i) => `<button class="sw ${SET.board === i ? 'on' : ''}" data-b="${i}" style="background:${b.c}" aria-label="${b.name}"></button>`).join('');
  $('setList').innerHTML = soundRowsHTML() +
    `<div class="row"><span style="font-size:28px">🎨</span><div class="grow"><h4>Brädets färg</h4><div class="swatches">${sw}</div></div></div>
     <div class="sec">Figurer – gäller i alla spel</div>${charEditorHTML()}`;
  const L = $('setList');
  bindSoundRows(L);
  bindCharEditor(L, buildSettings);
  L.querySelectorAll('.sw').forEach(t => t.onclick = () => { SET.board = +t.dataset.b; saveSet(); SFX.tap(); buildFrame(); buildSettings(); });
}

/* ---------- vinstfirande: hela figuren dansar över skärmen ---------- */

/* ---------- konfetti ---------- */

/* ---------- bakåtknappen på Android ---------- */
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('rNext')) { closePanel(); leaveGame(); } else closePanel();
    return true;
  }
  if (current === 'menu') { if (REMOTE) netLeave(); else goHub(); return true; }
  if (current === 'nlobby') { $('nlBack').click(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  SFX.tap(); back();
  return true;
};

$('toHub').onclick = () => { SFX.tap(); goHub(); };
buildFrame();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu', false);
