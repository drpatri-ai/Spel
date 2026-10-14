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

function startSelect() { selStep = 0; selPicked = []; renderSelect(); show('select'); }
function renderSelect() {
  const bot = S.mode === 'bot';
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
    if (canHumanPlay()) play(colAt(e.clientX));
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
function renderCards() {
  for (let pi = 0; pi < 2; pi++) {
    const p = S.players[pi];
    const tag = S.mode === 'bot' ? (p.bot ? '🤖 ' + LEVEL_NAME[S.level] : 'Du') : 'Spelare ' + (pi + 1);
    const el = $('pc' + pi);
    el.setAttribute('style', styleOf(p.char));
    el.className = 'pc';
    el.innerHTML = `${avHTML(p.char)}<div class="info"><span class="nm">${esc(charName(p.char))}</span><span class="tag">${tag}</span></div>
      <span class="sc" id="sc${pi}">${S.scores[pi]}</span><div class="bubble" id="bub${pi}"></div>`;
  }
}
function updateTurn() {
  for (let pi = 0; pi < 2; pi++) {
    const el = $('pc' + pi);
    el.classList.toggle('turn', !S.over && S.turn === pi);
    $('sc' + pi).textContent = S.scores[pi];
  }
  const human = !S.players[S.turn].bot;
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
function canHumanPlay() { return current === 'game' && !S.over && !S.busy && S.players[S.turn] && !S.players[S.turn].bot; }

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
  const humanLost = S.mode === 'bot' && winner === 1;
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
      await celebrate(wc, (S.mode === 'bot' && winner === 0) ? 'Du vann!' : charName(wc) + ' vann!');
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
    if (bot && winner === 0) { title = 'Du vann! 🎉'; sub = pick(['Snyggt spelat!', 'Datorn hade ingen chans!', 'Grymt jobbat!']); }
    else if (bot) { title = esc(charName(ch)) + ' vann!'; sub = pick(['Försök igen – du klarar det!', 'Det var nära!', 'Revansch?']); }
    else { title = esc(charName(ch)) + ' vinner!'; sub = pick(['Fyra i rad – snyggt!', 'Vilket drag!', 'Mästare! 👑']); }
    html = `<div class="win-av">${!(bot && winner === 1) ? '<div class="crown">👑</div>' : ''}${avHTML(ch)}</div><h3>${title}</h3><p>${sub}</p>`;
  } else {
    html = `<div class="score-big" style="margin-top:6px">${avHTML(P[0].char).replace('class="av ', 'class="av sm ')}🤝${avHTML(P[1].char).replace('class="av ', 'class="av sm ')}</div>
      <h3>Oavgjort!</h3><p>Brädet blev fullt – ingen fick fyra i rad.</p>`;
  }
  html += scoreLine + `<button class="btn green" id="rNext">▶️ Nästa runda</button><button class="btn white" id="rMenu">🏠 Till menyn</button>`;
  openPanel(html);
  $('rNext').onclick = () => { SFX.tap(); closePanel(); S.round++; newRound(); };
  $('rMenu').onclick = () => { SFX.tap(); closePanel(); leaveGame(); };
}

function leaveGame() { S.token++; S.over = true; show('menu'); }

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
  if (S.moves.length && !S.over) confirmBox('Avsluta spelet?', 'Ställningen sparas inte.', 'Ja, till menyn', leaveGame);
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

/* ---------- statistik ---------- */
function getStats() {
  const s = store.get('stats', null) || {};
  s.bot = s.bot || {};
  for (const l of ['easy', 'medium', 'hard']) s.bot[l] = Object.assign({ w: 0, l: 0, d: 0, streak: 0, best: 0 }, s.bot[l]);
  s.chars = s.chars || [0, 0, 0, 0];
  s.two = s.two || 0;
  s.draws2 = s.draws2 || 0;
  return s;
}
function recordStats(winner) {
  const s = getStats();
  if (S.mode === 'bot') {
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
  if (current === 'menu') { goHub(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  SFX.tap(); back();
  return true;
};

$('toHub').onclick = () => { SFX.tap(); goHub(); };
buildFrame();
show('menu', false);
