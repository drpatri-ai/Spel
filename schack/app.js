/* Bucinca Schack – gränssnitt */
'use strict';
const E = Engine;
const { WHITE, BLACK, P, N, B, R, Q, K, TYPE } = E;

/* ---------- lagring ---------- */
const store = makeStore('bs');

/* ---------- figurer & teman ---------- */
// pjäsernas konturfärger (lite mörkare än figurfärgen)
const PIECE_D = ['#1E7F38', '#B8501A', '#4E3FC4', '#C23A7A', '#A87A00', '#0B7C7C', '#A82A22', '#1C5FA8', '#6E4220', '#3C465C'];
const THEMES = [
  { name: 'Hav', light: '#FFF4DA', dark: '#8FB8FF', frame: '#2A4FC4' },
  { name: 'Skog', light: '#F6FAE6', dark: '#9CCB8E', frame: '#2E7D4F' },
  { name: 'Godis', light: '#FFF2F8', dark: '#F7A8CF', frame: '#C23A7A' },
  { name: 'Trä', light: '#F7E3C2', dark: '#C99466', frame: '#7A4A26' }
];
const SET = Object.assign({ sound: true, vib: true, theme: 0, showMoves: true, autoflip: false }, store.get('settings', {}));
const saveSet = () => store.set('settings', SET);


const SAY = {
  start: ['Nu kör vi!', 'Lycka till!', 'Jag är redo! 💪', 'Kom igen då!'],
  win: ['Jaaa! 🎉', 'Schack matt! 👑', 'Wiii! 🥳', 'Yes! 🙌', 'Vem är bäst?!'],
  lose: ['Nästan… 😅', 'Revansch!', 'Åh nej!', 'Nästa gång!', 'Grr! 😤'],
  think: ['Hmm… 🤔', 'Låt mig tänka…', 'Spännande…', 'Aha!', 'Vänta lite…'],
  capture: ['Mums! 😋', 'Tack för den!', 'Hehe! 😏', 'Den tar jag!', 'Pang! 💥'],
  ouch: ['Aj då! 😬', 'Nej, inte den!', 'Oj oj oj…'],
  queen: ['Nej, min dam! 😱', 'Inte drottningen!!'],
  draw: ['Oavgjort! 🤝', 'Jämnt skägg!', 'Lika bra!']
};

/* ---------- pjäser (egna SVG) ---------- */
function pieceSVG(t, ci) {
  const c = CHARS[ci].c, d = PIECE_D[ci];
  const st = `stroke="${d}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;
  const base = `<path d="M22 91h56a6 6 0 0 0 6-6v-1a6 6 0 0 0-6-6H22a6 6 0 0 0-6 6v1a6 6 0 0 0 6 6z" fill="${c}" ${st}/>`;
  const shine = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="#fff" opacity=".55"/>`;
  let body = '';
  if (t === P) body = `<path d="M36 79Q38 58 45 50h10Q62 58 64 79z" fill="${c}" ${st}/><ellipse cx="50" cy="50" rx="14" ry="4.5" fill="${c}" ${st}/>
    <circle cx="50" cy="33" r="14" fill="${c}" ${st}/><circle cx="45" cy="28" r="4" fill="#fff" opacity=".7"/>`;
  else if (t === R) body = `<path d="M31 79L34 42h32L69 79z" fill="${c}" ${st}/><path d="M27 43V22h10v8h7v-8h12v8h7v-8h10v21z" fill="${c}" ${st}/>${shine(38, 48, 5, 24)}`;
  else if (t === N) body = `<path d="M30 79C30 64 34 56 42 50C34 51 26 50 22 44C19 38 26 30 33 27L37 14L44 21C60 19 74 32 74 52C74 63 71 71 71 79Z" fill="${c}" ${st}/>
    <circle cx="43" cy="32" r="4" fill="${d}"/><circle cx="42" cy="31" r="1.4" fill="#fff"/><path d="M53 25C63 31 67 41 67 54" stroke="#fff" stroke-width="4" fill="none" opacity=".55" stroke-linecap="round"/>`;
  else if (t === B) body = `<path d="M35 79Q37 64 44 58h12Q63 64 65 79z" fill="${c}" ${st}/><path d="M50 15C67 27 67 46 57 58H43C33 46 33 27 50 15z" fill="${c}" ${st}/>
    <circle cx="50" cy="11" r="5" fill="${c}" ${st}/><path d="M57 28L47 41" ${st} fill="none"/>${shine(41, 30, 4, 16)}`;
  else if (t === Q) body = `<path d="M30 79L22 33L32 53L36 23L44 49L50 17L56 49L64 23L68 53L78 33L70 79Z" fill="${c}" ${st}/>
    ${[[22, 30], [36, 20], [50, 13], [64, 20], [78, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="#FFD23F" ${st}/>`).join('')}
    <path d="M33 67h34" ${st} fill="none"/>${shine(38, 56, 4, 8)}`;
  else if (t === K) body = `<path d="M32 79L35 54h30L68 79z" fill="${c}" ${st}/><circle cx="50" cy="33" r="23" fill="${c}" ${st}/>
    <path d="M36 13L34 0L43 6L50-2L57 6L66 0L64 13Z" fill="#FFD23F" ${st}/>${shine(40, 60, 4, 12)}`;
  return `<svg viewBox="0 0 100 100">${base}${body}</svg>`;
}

/* ---------- ljud & vibration ---------- */
const SFX = {
  tap: () => tone(720, .07, { type: 'triangle', vol: .1 }),
  pick: () => [660, 990].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .07 })),
  select: () => tone(880, .06, { type: 'triangle', vol: .08 }),
  move: () => { tone(320, .09, { to: 180, vol: .3 }); tone(900, .03, { type: 'triangle', vol: .06 }); },
  capture: () => { tone(520, .12, { to: 140, type: 'square', vol: .07 }); tone(240, .16, { to: 90, vol: .3, delay: .03 }); },
  castle: () => { SFX.move(); setTimeout(SFX.move, 130); },
  check: () => [880, 660, 880].forEach((f, i) => tone(f, .1, { type: 'square', vol: .05, delay: i * .09 })),
  promo: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .12, delay: i * .06 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .24, { type: 'triangle', vol: .15, delay: i * .1 })),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, .3, { vol: .14, delay: i * .17 })),
  draw: () => [392, 494, 392].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .12, delay: i * .14 })),
  bonk: () => tone(150, .12, { type: 'square', vol: .05, to: 110 }),
  hint: () => [880, 1175, 1568].forEach((f, i) => tone(f, .12, { vol: .1, delay: i * .07 })),
  undo: () => tone(520, .14, { to: 300, type: 'triangle', vol: .1 })
};

/* ---------- datorns tänkande i bakgrunden (Web Worker) ---------- */
let worker = null, reqId = 0;
const pending = {};
function syncMove(fen, level) {
  const c = new E.Chess(fen);
  const m = E.botMove(c, level);
  return m ? { from: m.from, to: m.to, promo: m.promo } : null;
}
function failWorker() {
  worker = null;
  for (const id in pending) { const p = pending[id]; delete pending[id]; p.res(syncMove(p.fen, p.level)); }
}
try {
  worker = new Worker('schack/engine.js');
  worker.onmessage = e => { const p = pending[e.data.id]; if (p) { delete pending[e.data.id]; p.res(e.data.move); } };
  worker.onerror = failWorker;
} catch (e) { worker = null; }
function askEngine(level) {
  const fen = S.ch.fen();
  return new Promise(res => {
    if (worker) {
      const id = ++reqId;
      pending[id] = { res, fen, level };
      worker.postMessage({ id, fen, level });
      setTimeout(() => { if (pending[id]) { delete pending[id]; res(syncMove(fen, level)); } }, 9000);
    } else setTimeout(() => res(syncMove(fen, level)), 30);
  });
}

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
function back() { show(hist.pop() || 'menu', false); }

bubbles();

function buildMenu() {
  let k = 0;
  const line = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = line('Bucinca', 'l1') + line('Schack ♛', 'l2');
  $('dance').innerHTML = CHARS.map((_, i) => avHTML(i)).join('');
  [...$('dance').children].forEach((el, i) => el.style.animationDelay = (i * .18) + 's');
}

/* ---------- spelläge & figurval ---------- */
const S = {
  mode: '2p', level: 'medium', players: [], white: 0, ch: new E.Chess(), keys: [], movers: [],
  scores: [0, 0], round: 1, over: false, busy: false, hints: [3, 3], token: 0,
  sel: -1, legal: [], last: null, hintMove: null, flipped: false
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
document.querySelectorAll('[data-level]').forEach(b => b.addEventListener('click', () => { SFX.tap(); S.level = b.dataset.level; startSelect(); }));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { SFX.tap(); back(); }));

function startSelect() { selStep = 0; selPicked = []; renderSelect(); show('select'); }
function renderSelect() {
  const bot = S.mode === 'bot';
  $('selTitle').textContent = selStep === 0 ? (bot ? 'Välj din figur!' : 'Spelare 1 – välj figur!') : (bot ? 'Välj motståndare 🤖' : 'Spelare 2 – välj figur!');
  $('selSub').textContent = selStep === 0 ? (bot ? 'Datorn spelar på nivå ' + LEVEL_NAME[S.level] : 'Spelare 1 drar först. Ni byter färg varje parti.') : 'Vem vill du utmana?';
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${selPicked.includes(i) ? 'taken' : ''}" data-i="${i}" data-tag="${bot ? 'Du' : 'Spelare 1'}" style="${styleOf(i)}">
      ${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.addEventListener('click', () => {
    const i = +el.dataset.i;
    if (selPicked.includes(i)) { SFX.bonk(); return; }
    SFX.pick(); buzz(12);
    el.classList.add('pick');
    selPicked.push(i);
    setTimeout(() => { if (selStep === 0) { selStep = 1; renderSelect(); } else startGame(); }, 380);
  }));
}

/* ---------- hjälpfunktioner för brädet ---------- */
const sideOf = pi => pi === S.white ? WHITE : BLACK;
const playerOf = color => color === WHITE ? S.white : 1 - S.white;
const ownerOfPiece = p => playerOf(p & WHITE ? WHITE : BLACK);
function bottomPlayer() {
  if (S.mode === 'bot') return 0;
  return SET.autoflip ? playerOf(S.ch.turn) : S.white;
}
const dispRC = sq => { const r = sq >> 4, f = sq & 7; return S.flipped ? [7 - r, 7 - f] : [r, f]; };
const sqAt = (dr, df) => S.flipped ? (7 - dr) * 16 + (7 - df) : dr * 16 + df;

function applyTheme() {
  const t = THEMES[SET.theme] || THEMES[0];
  const root = document.documentElement.style;
  root.setProperty('--light', t.light); root.setProperty('--dark', t.dark); root.setProperty('--frame', t.frame);
}

function buildSquares() {
  S.flipped = sideOf(bottomPlayer()) === BLACK;
  let html = '';
  for (let dr = 0; dr < 8; dr++) for (let df = 0; df < 8; df++) {
    const sq = sqAt(dr, df), r = sq >> 4, f = sq & 7;
    let lbl = '';
    if (df === 0) lbl += `<span class="lbl lr">${8 - r}</span>`;
    if (dr === 7) lbl += `<span class="lbl lf">${'abcdefgh'[f]}</span>`;
    html += `<div class="sq ${(r + f) & 1 ? 'dk' : ''}" data-sq="${sq}">${lbl}</div>`;
  }
  $('squares').innerHTML = html;
}
const sqEl = sq => $('squares').querySelector(`[data-sq="${sq}"]`);

function refreshMarks() {
  $('squares').querySelectorAll('.sq').forEach(el => {
    el.classList.remove('last', 'sel', 'hint', 'chk');
    el.querySelectorAll('.dot,.ring').forEach(x => x.remove());
  });
  if (S.last) { sqEl(S.last.from).classList.add('last'); sqEl(S.last.to).classList.add('last'); }
  if (S.hintMove) { sqEl(S.hintMove.from).classList.add('hint'); sqEl(S.hintMove.to).classList.add('hint'); }
  if (S.sel >= 0) {
    sqEl(S.sel).classList.add('sel');
    if (SET.showMoves) {
      const seen = new Set();
      for (const m of S.legal) {
        if (seen.has(m.to)) continue;
        seen.add(m.to);
        const d = document.createElement('div');
        d.className = m.cap ? 'ring' : 'dot';
        sqEl(m.to).appendChild(d);
      }
    }
  }
  if (!S.over && S.ch.inCheck()) sqEl(S.ch.kingSq(S.ch.turn)).classList.add('chk');
  $('pieces').querySelectorAll('.pc-el').forEach(el => el.classList.toggle('lift', +el.dataset.sq === S.sel));
}

function makePieceEl(p) {
  const el = document.createElement('div');
  el.className = 'pc-el';
  const ci = S.players[ownerOfPiece(p)].char;
  el.innerHTML = pieceSVG(p & TYPE, ci) + ((p & TYPE) === K ? `<img class="face" src="${avatarSrc(ci)}" alt="">` : '');
  return el;
}
function place(el, sq) {
  const [r, f] = dispRC(sq);
  el.style.left = (f * 12.5) + '%';
  el.style.top = (r * 12.5) + '%';
}
function renderPieces(anim) {
  const L = $('pieces');
  L.innerHTML = '';
  const b = S.ch.board;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if (!p) continue;
    const el = makePieceEl(p);
    el.dataset.sq = sq;
    place(el, sq);
    L.appendChild(el);
    const mv = anim && anim.moved.find(x => x.to === sq);
    if (mv) {
      const [fr, ff] = dispRC(mv.from), [tr, tf] = dispRC(sq);
      el.style.zIndex = 4;
      el.animate([{ transform: `translate(${(ff - tf) * 100}%,${(fr - tr) * 100}%)` }, { transform: 'translate(0,0)' }],
        { duration: mv.dur || 280, easing: 'cubic-bezier(.3,1.25,.5,1)' });
    }
  }
  if (anim && anim.captured) {
    const g = makePieceEl(anim.captured.piece);
    place(g, anim.captured.sq);
    g.classList.add('gone');
    L.appendChild(g);
    setTimeout(() => g.remove(), 500);
  }
}

/* ---------- spelarkort ---------- */
function capturedBy(pi) {
  // pjäser som motståndaren har förlorat = startuppställning minus det som finns kvar
  const them = sideOf(1 - pi), start = { [P]: 8, [N]: 2, [B]: 2, [R]: 2, [Q]: 1 };
  const left = { [P]: 0, [N]: 0, [B]: 0, [R]: 0, [Q]: 0 };
  const b = S.ch.board;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) { sq += 7; continue; }
    const p = b[sq];
    if (p && (p & them) && (p & TYPE) !== K) left[p & TYPE]++;
  }
  const out = [];
  for (const t of [Q, R, B, N, P]) for (let i = 0; i < Math.max(0, start[t] - left[t]); i++) out.push(t);
  return out;
}
function material(color) {
  let s = 0;
  const b = S.ch.board;
  for (let sq = 0; sq < 128; sq++) { if (sq & 0x88) { sq += 7; continue; } const p = b[sq]; if (p && (p & color)) s += E.VAL[p & TYPE]; }
  return s;
}
function renderCards() {
  const bot = bottomPlayer();
  for (const pi of [0, 1]) {
    const p = S.players[pi];
    const el = pi === bot ? $('pcBot') : $('pcTop');
    const tag = (S.mode === 'bot' ? (p.bot ? '🤖 ' + LEVEL_NAME[S.level] : 'Du') : 'Spelare ' + (pi + 1)) + (pi === S.white ? ' · drar först' : '');
    el.setAttribute('style', styleOf(p.char));
    el.className = 'pc';
    el.dataset.pi = pi;
    el.innerHTML = `${avHTML(p.char)}<div class="info"><span class="nm">${esc(charName(p.char))}</span><span class="tag">${tag}</span>
      <div class="caps" id="caps${pi}"></div></div><span class="sc" id="sc${pi}">${S.scores[pi]}</span><div class="bubble" id="bub${pi}"></div>`;
  }
  updateCaps();
}
function updateCaps() {
  const adv = material(sideOf(0)) - material(sideOf(1));
  for (const pi of [0, 1]) {
    const opp = S.players[1 - pi].char;
    const lost = capturedBy(pi);
    const a = pi === 0 ? adv : -adv;
    const el = $('caps' + pi);
    if (el) el.innerHTML = lost.map(t => pieceSVG(t, opp)).join('') + (a > 0 ? `<b>+${Math.round(a / 100)}</b>` : '');
  }
}
function updateTurn() {
  const cur = playerOf(S.ch.turn);
  for (const pi of [0, 1]) {
    const el = document.querySelector(`.pc[data-pi="${pi}"]`);
    if (el) el.classList.toggle('turn', !S.over && cur === pi);
    const sc = $('sc' + pi); if (sc) sc.textContent = S.scores[pi];
  }
  const human = !S.players[cur].bot;
  $('bUndo').disabled = S.over || S.busy || !S.movers.some(pi => !S.players[pi].bot);
  $('bHint').disabled = S.over || S.busy || !human || S.hints[cur] <= 0;
  $('bResign').disabled = S.over;
  $('hintN').textContent = S.hints[human ? cur : 0];
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
const canHumanPlay = () => current === 'game' && !S.over && !S.busy && !S.players[playerOf(S.ch.turn)].bot;

function startGame() {
  S.players = [{ char: selPicked[0], bot: false }, { char: selPicked[1], bot: S.mode === 'bot' }];
  S.scores = [0, 0];
  S.round = 1;
  S.white = 0;
  applyTheme();
  show('game');
  newRound();
}
function newRound() {
  S.token++;
  S.ch = new E.Chess();
  S.keys = [S.ch.key()];
  S.movers = [];
  S.over = false; S.busy = false;
  S.hints = [3, 3];
  S.sel = -1; S.legal = []; S.last = null; S.hintMove = null;
  $('board').classList.remove('over');
  $('roundLbl').textContent = 'Parti ' + S.round;
  $('gSound').textContent = SND.sound ? '🔊' : '🔇';
  renderAll();
  setTimeout(() => say(S.white, pick(SAY.start)), 300);
  maybeBot();
}
function renderAll(anim) {
  buildSquares();
  renderCards();
  renderPieces(anim);
  refreshMarks();
  updateTurn();
}

$('squares').addEventListener('pointerdown', e => { ac(); const el = e.target.closest('.sq'); if (el) onSquare(+el.dataset.sq); });

function onSquare(sq) {
  if (!canHumanPlay()) return;
  const p = S.ch.board[sq], us = S.ch.turn;
  if (S.sel >= 0 && S.legal.some(m => m.to === sq)) { humanMove(S.sel, sq); return; }
  if (p && (p & us)) {
    if (S.sel === sq) { S.sel = -1; S.legal = []; }
    else { S.sel = sq; S.legal = S.ch.moves().filter(m => m.from === sq); SFX.select(); buzz(8); }
    if (S.sel >= 0 && !S.legal.length) { SFX.bonk(); }
  } else {
    if (S.sel >= 0) SFX.bonk();
    S.sel = -1; S.legal = [];
  }
  refreshMarks();
}

async function humanMove(from, to) {
  const cands = S.legal.filter(m => m.to === to);
  let m = cands[0];
  if (cands.length > 1) {
    const promo = await askPromotion(playerOf(S.ch.turn));
    m = cands.find(x => x.promo === promo) || cands[0];
  }
  commit(m);
}

function askPromotion(pi) {
  return new Promise(res => {
    const ci = S.players[pi].char;
    openPanel(`<h3>Bonden blir…</h3><p>Välj vad din bonde ska förvandlas till!</p>
      <div class="promo">${[Q, R, B, N].map(t => `<button data-t="${t}">${pieceSVG(t, ci)}</button>`).join('')}</div>`);
    $('panel').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { SFX.tap(); closePanel(); res(+b.dataset.t); });
  });
}

async function commit(m) {
  S.busy = true;
  const tok = S.token;
  const mover = S.ch.turn, pi = playerOf(mover), victim = 1 - pi;
  S.sel = -1; S.legal = []; S.hintMove = null;
  S.ch.make(m);
  S.keys.push(S.ch.key());
  S.movers.push(pi);
  S.last = { from: m.from, to: m.to };
  const anim = { moved: [{ from: m.from, to: m.to }] };
  if (m.flags & 2) {
    const rk = { 118: [119, 117], 114: [112, 115], 6: [7, 5], 2: [0, 3] }[m.to];
    anim.moved.push({ from: rk[0], to: rk[1], dur: 360 });
  }
  if (m.cap) anim.captured = { sq: (m.flags & 1) ? (mover === WHITE ? m.to + 16 : m.to - 16) : m.to, piece: m.cap };
  renderPieces(anim);
  refreshMarks();
  updateTurn();
  if (m.flags & 2) SFX.castle(); else if (m.cap) SFX.capture(); else SFX.move();
  if (m.promo) setTimeout(SFX.promo, 200);
  buzz(m.cap ? 25 : 12);
  await wait(320);
  if (tok !== S.token) return;
  updateCaps();

  const legal = S.ch.moves(), check = S.ch.inCheck();
  if (!legal.length) return endGame(check ? pi : -1, check ? 'mate' : 'stalemate');
  if (S.ch.half >= 100) return endGame(-1, 'fifty');
  if (S.ch.insufficient()) return endGame(-1, 'material');
  const key = S.ch.key();
  if (S.keys.filter(k => k === key).length >= 3) return endGame(-1, 'rep');

  // vänd brädet i tvåspelarläge om det är påslaget
  if (S.mode === '2p' && SET.autoflip) { await wait(250); if (tok !== S.token) return; renderAll(); }

  if (check) { SFX.check(); buzz(40); say(pi, 'Schack! ⚔️'); }
  else if (m.cap && (m.cap & TYPE) === Q) { say(victim, pick(SAY.queen)); setTimeout(() => say(pi, pick(SAY.capture)), 700); }
  else if (m.cap && Math.random() < 0.45) { say(pi, pick(SAY.capture)); if (Math.random() < 0.4) setTimeout(() => say(victim, pick(SAY.ouch)), 700); }
  else if (m.promo) say(pi, 'Förvandling! ✨');

  S.busy = false;
  refreshMarks();
  updateTurn();
  maybeBot();
}

async function maybeBot() {
  const pi = playerOf(S.ch.turn);
  if (!S.players[pi].bot || S.over) return;
  S.busy = true;
  updateTurn();
  const tok = S.token;
  const card = document.querySelector(`.pc[data-pi="${pi}"]`);
  card.classList.add('thinking');
  if (Math.random() < 0.3) say(pi, pick(SAY.think), 1400);
  const t0 = Date.now();
  await nextFrame();
  const mv = await askEngine(S.level);
  const left = 550 - (Date.now() - t0);
  if (left > 0) await wait(left);
  if (tok !== S.token) return;
  card.classList.remove('thinking');
  if (!mv) return;
  const m = S.ch.moves().find(x => x.from === mv.from && x.to === mv.to && (x.promo || 0) === (mv.promo || 0));
  if (m) commit(m);
}

const REASON = {
  mate: 'Schack matt! 👑', resign: 'Motståndaren gav upp 🏳️', stalemate: 'Patt – ingen kan flytta 🤝',
  fifty: '50 drag utan slag eller bondedrag', material: 'Ingen kan göra schack matt längre', rep: 'Samma ställning tre gånger'
};
function endGame(winner, reason) {
  S.over = true; S.busy = false; S.sel = -1; S.legal = [];
  const tok = S.token;
  $('board').classList.add('over');
  refreshMarks();
  if (winner >= 0) {
    const k = S.ch.kingSq(sideOf(winner));
    const el = $('pieces').querySelector(`[data-sq="${k}"]`);
    if (el) el.classList.add('winner-k');
    S.scores[winner]++;
    document.querySelector(`.pc[data-pi="${winner}"]`).classList.add('happy');
    document.querySelector(`.pc[data-pi="${1 - winner}"]`).classList.add('sad');
    say(winner, pick(SAY.win), 2400);
    setTimeout(() => say(1 - winner, pick(SAY.lose), 2000), 500);
    const humanLost = S.mode === 'bot' && winner === 1;
    humanLost ? SFX.lose() : SFX.win();
    buzz(humanLost ? 60 : 120);
  } else {
    say(0, pick(SAY.draw)); say(1, pick(SAY.draw));
    SFX.draw();
  }
  recordStats(winner);
  updateTurn();
  setTimeout(async () => {
    if (tok !== S.token || current !== 'game') return;
    if (winner >= 0) {
      const wc = S.players[winner].char;
      await celebrate(wc, (S.mode === 'bot' && winner === 0) ? 'Du vann!' : charName(wc) + ' vann!', reason === 'mate' ? 'Schack matt! ♛' : 'Vinst! 🏳️', ['⭐', '🎉', '✨', '🏆', '🌟', '🎊', '♛', '⭐']);
      if (tok !== S.token || current !== 'game') return;
    }
    showResult(winner, reason);
  }, winner >= 0 ? 1300 : 1500);
}

function showResult(winner, reason) {
  const P0 = S.players;
  const bot = S.mode === 'bot';
  const sm = i => avHTML(i).replace('class="av ', 'class="av sm ');
  let html;
  if (winner >= 0) {
    const ch = P0[winner].char;
    let title, sub;
    if (bot && winner === 0) { title = 'Du vann! 🎉'; sub = REASON[reason]; }
    else if (bot) { title = esc(charName(ch)) + ' vann!'; sub = reason === 'resign' ? 'Du gav upp – försök igen!' : 'Schack matt – försök igen, du klarar det!'; }
    else { title = esc(charName(ch)) + ' vinner!'; sub = reason === 'resign' ? 'Motståndaren gav upp 🏳️' : REASON.mate; }
    html = `<div class="win-av">${!(bot && winner === 1) ? '<div class="crown">👑</div>' : ''}${avHTML(ch)}</div><h3>${title}</h3><p>${sub}</p>`;
  } else {
    html = `<div class="score-big" style="margin-top:6px">${sm(P0[0].char)}🤝${sm(P0[1].char)}</div><h3>Oavgjort!</h3><p>${REASON[reason]}</p>`;
  }
  html += `<div class="score-big">${sm(P0[0].char)}<span>${S.scores[0]} – ${S.scores[1]}</span>${sm(P0[1].char)}</div>
    <p style="font-size:15px">Nästa parti byter ni färg – ${esc(charName(P0[1 - S.white].char))} drar först.</p>
    <button class="btn green" id="rNext">▶️ Nästa parti</button><button class="btn white" id="rMenu">🏠 Till menyn</button>`;
  openPanel(html);
  $('rNext').onclick = () => { SFX.tap(); closePanel(); S.round++; S.white = 1 - S.white; newRound(); };
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

$('gHome').onclick = () => {
  SFX.tap();
  if (S.movers.length && !S.over) confirmBox('Avsluta partiet?', 'Ställningen sparas inte.', 'Ja, till menyn', leaveGame);
  else leaveGame();
};
$('gSound').onclick = () => { SND.sound = !SND.sound; saveSnd(); $('gSound').textContent = SND.sound ? '🔊' : '🔇'; SFX.tap(); };
$('bResign').onclick = () => {
  if (S.over) return;
  SFX.tap();
  const loser = S.mode === 'bot' ? 0 : playerOf(S.ch.turn);
  confirmBox('Ge upp?', esc(charName(S.players[loser].char)) + ' ger upp och ' + esc(charName(S.players[1 - loser].char)) + ' vinner partiet.', 'Ja, jag ger upp', () => {
    S.token++;
    S.busy = false;
    endGame(1 - loser, 'resign');
  });
};
$('bUndo').onclick = () => {
  if (S.busy || S.over || !S.movers.some(pi => !S.players[pi].bot)) return;
  do {
    S.ch.unmake(); S.keys.pop(); S.movers.pop();
  } while (S.ch.hist.length && S.players[playerOf(S.ch.turn)].bot);
  const h = S.ch.hist[S.ch.hist.length - 1];
  S.last = h ? { from: h.m.from, to: h.m.to } : null;
  S.sel = -1; S.legal = []; S.hintMove = null;
  S.token++;
  SFX.undo(); buzz(10);
  renderAll();
};
$('bHint').onclick = async () => {
  const pi = playerOf(S.ch.turn);
  if (!canHumanPlay() || S.hints[pi] <= 0) return;
  S.busy = true;
  updateTurn();
  const tok = S.token;
  say(pi, 'Hmm, låt mig se… 💡', 1200);
  const mv = await askEngine('hint');
  if (tok !== S.token) return;
  S.busy = false;
  S.hints[pi]--;
  if (mv) {
    S.hintMove = mv;
    SFX.hint();
    refreshMarks();
    setTimeout(() => { if (S.hintMove === mv) { S.hintMove = null; refreshMarks(); } }, 3200);
  }
  updateTurn();
};

/* ---------- vinstfirande ---------- */


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
    if (winner >= 0) s.chars[S.players[winner].char]++; else s.draws2++;
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
    <div class="row"><table><tr><th>Nivå</th><th>Vinster</th><th>Förluster</th><th>Remi</th><th>Bästa svit</th></tr>${rows}</table></div>
    <div class="sec">👫 Två spelare – vinster per figur</div>${bars}
    <p class="hint-txt">${s.two} spelade partier · ${s.draws2} oavgjorda</p>
    <button class="btn white small" id="resetStats" style="align-self:center">🗑️ Nollställ statistik</button>`;
  $('statsList').querySelectorAll('.row .av').forEach(a => a.style.width = '56px');
  $('resetStats').onclick = () => { SFX.tap(); confirmBox('Nollställa?', 'All statistik raderas.', 'Ja, nollställ', () => { store.del('stats'); buildStats(); }); };
}

/* ---------- inställningar ---------- */
function buildSettings() {
  const tg = (k, label, icon, note) => `<div class="row"><span style="font-size:28px">${icon}</span><div class="grow"><h4 style="margin:0">${label}</h4>${note ? `<p class="small-note">${note}</p>` : ''}</div>
     <button class="toggle ${SET[k] ? 'on' : ''}" data-k="${k}" aria-label="${label}"></button></div>`;
  const sw = THEMES.map((t, i) => `<button class="sw ${SET.theme === i ? 'on' : ''}" data-t="${i}" aria-label="${t.name}"><i style="background:${t.light}"></i><i style="background:${t.dark}"></i><i style="background:${t.dark}"></i><i style="background:${t.light}"></i></button>`).join('');
  $('setList').innerHTML = soundRowsHTML() +
    tg('showMoves', 'Visa möjliga drag', '👆', 'Prickar visar vart pjäsen kan gå') +
    tg('autoflip', 'Vänd brädet', '🔄', 'Två spelare: brädet vänds mot den som ska dra') +
    `<div class="row"><span style="font-size:28px">🎨</span><div class="grow"><h4>Brädets färg</h4><div class="swatches">${sw}</div></div></div>
     <div class="sec">Figurer – gäller i alla spel</div>${charEditorHTML()}`;
  const L = $('setList');
  bindSoundRows(L);
  bindCharEditor(L, buildSettings);
  L.querySelectorAll('[data-k]').forEach(t => t.onclick = () => { SET[t.dataset.k] = !SET[t.dataset.k]; saveSet(); t.classList.toggle('on'); SFX.tap(); buzz(15); });
  L.querySelectorAll('.sw').forEach(t => t.onclick = () => { SET.theme = +t.dataset.t; saveSet(); applyTheme(); SFX.tap(); buildSettings(); });
}

/* ---------- bakåtknappen på Android ---------- */
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('rNext')) { closePanel(); leaveGame(); }
    else if (!$('panel').querySelector('.promo')) closePanel();
    return true;
  }
  if (current === 'menu') { goHub(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  SFX.tap(); back();
  return true;
};

$('toHub').onclick = () => { SFX.tap(); goHub(); };
applyTheme();
show('menu', false);
