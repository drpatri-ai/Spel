/* Bucinca Block – lägg bitar på ett 8×8-bräde, fulla rader och kolumner rensas. */
'use strict';
const store = makeStore('bb');
const N = 8;

/* ---------- bitar ---------- */
const rot = cells => cells.map(([r, c]) => [c, -r]);
const norm = cells => { const mr = Math.min(...cells.map(x => x[0])), mc = Math.min(...cells.map(x => x[1])); return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const key = cells => norm(cells).map(x => x.join(',')).join(';');
function family(cells, mirror) {
  const out = new Map();
  let cur = cells;
  for (let m = 0; m < (mirror ? 2 : 1); m++) {
    for (let i = 0; i < 4; i++) { const n = norm(cur); out.set(key(n), n); cur = rot(cur); }
    cur = cells.map(([r, c]) => [r, -c]);
  }
  return [...out.values()];
}
const line = n => Array.from({ length: n }, (_, i) => [0, i]);
const rect = (h, w) => { const a = []; for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) a.push([r, c]); return a; };
const SHAPES = [];
const add = (list, w) => list.forEach(cells => SHAPES.push({ cells, w: w / list.length }));
add([[[0, 0]]], 2);
add(family(line(2)), 4);
add(family(line(3)), 4);
add(family(line(4)), 3);
add(family(line(5)), 2);
add([rect(2, 2)], 4);
add([rect(3, 3)], 1.5);
add(family(rect(2, 3)), 2);
add(family([[0, 0], [1, 0], [1, 1]]), 4);                 // liten vinkel
add(family([[0, 0], [1, 0], [2, 0], [2, 1]], true), 3);   // L
add(family([[0, 0], [0, 1], [0, 2], [1, 1]]), 2.5);       // T
add(family([[0, 1], [0, 2], [1, 0], [1, 1]], true), 2);   // S/Z
add(family([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]), 1.5); // stort hörn
const COLORS = [...CHARS.slice(0, 4).map(c => c.c), '#FFD23F', '#3B9DFF', '#14C8C8', '#FF4D6D'];

function randShape() {
  const tot = SHAPES.reduce((a, s) => a + s.w, 0);
  let x = Math.random() * tot;
  for (const s of SHAPES) { x -= s.w; if (x <= 0) return s.cells; }
  return SHAPES[0].cells;
}

/* ---------- ljud ---------- */
const SFX = Object.assign({}, CORE_SFX, {
  grab: () => tone(880, .06, { type: 'triangle', vol: .08 }),
  place: () => { tone(240, .1, { to: 140, vol: .3 }); noise(.05, { f: 1800, vol: .08 }); },
  clear: n => [523, 659, 784, 1047, 1319, 1568].slice(0, 2 + n).forEach((f, i) => tone(f, .14, { type: 'triangle', vol: .12, delay: i * .06 })),
  combo: c => tone(600 + c * 90, .18, { type: 'square', vol: .06, to: 1200 + c * 120 }),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, .3, { vol: .14, delay: i * .17 })),
  reroll: () => [700, 900, 1100].forEach((f, i) => tone(f, .07, { type: 'triangle', vol: .08, delay: i * .05 }))
});

/* ---------- tillstånd ---------- */
const G = { grid: [], tray: [null, null, null], score: 0, combo: 0, sinceClear: 9, over: false, rerolls: 1, busy: false, bestCombo: 0 };
let me = store.get('char', 0);
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'select') buildSelect();
}

function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Block 🧱', 'l2');
  const best = store.get('best', 0), games = store.get('games', 0);
  $('menuBest').textContent = best ? `⭐ Rekord: ${best} poäng · ${games} spel` : 'Lägg bitarna – fyll rader och kolumner!';
  $('me').setAttribute('style', styleOf(me));
  $('me').innerHTML = `${avHTML(me)}<div><small>Hejar på dig</small><b>${esc(charName(me))}</b></div>`;
}
function buildSelect() {
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === me ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    me = +el.dataset.i; store.set('char', me); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(() => show('menu'), 300);
  });
}

/* ---------- brädet ---------- */
const cells = [];
(function buildBoard() {
  const b = $('board');
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const d = document.createElement('div');
    d.className = 'cell';
    b.appendChild(d);
    cells.push(d);
  }
})();
const cellEl = (r, c) => cells[r * N + c];
function renderGrid() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const d = cellEl(r, c), v = G.grid[r][c];
    d.className = 'cell' + (v ? ' f' : '');
    d.style.setProperty('--k', v || 'transparent');
  }
}
const fits = (cellsArr, r0, c0) => cellsArr.every(([r, c]) => { const rr = r0 + r, cc = c0 + c; return rr >= 0 && rr < N && cc >= 0 && cc < N && !G.grid[rr][cc]; });
function fitsAnywhere(shape) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(shape, r, c)) return true;
  return false;
}
function linesIf(shape, r0, c0) {
  const g = G.grid.map(row => row.slice());
  shape.forEach(([r, c]) => { g[r0 + r][c0 + c] = 'x'; });
  const rows = [], cols = [];
  for (let i = 0; i < N; i++) {
    if (g[i].every(v => v)) rows.push(i);
    if (g.every(row => row[i])) cols.push(i);
  }
  return { rows, cols };
}

/* ---------- brickorna i facket ---------- */
function newTray() {
  G.tray = [0, 1, 2].map(() => ({ cells: randShape(), color: pick(COLORS) }));
  // hjälp lite: om ingen bit får plats men någon form skulle göra det, byt ut en
  if (!G.tray.some(p => fitsAnywhere(p.cells))) {
    const ok = SHAPES.map(s => s.cells).filter(fitsAnywhere);
    if (ok.length) G.tray[0] = { cells: pick(ok), color: pick(COLORS) };
  }
  renderTray(true);
}
function pieceHTML(p, cls) {
  const h = Math.max(...p.cells.map(x => x[0])) + 1, w = Math.max(...p.cells.map(x => x[1])) + 1;
  const set = new Set(p.cells.map(x => x.join(',')));
  let s = '';
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) s += `<div class="${set.has(r + ',' + c) ? 'blk' : 'e'}" style="--k:${p.color}"></div>`;
  return { html: s, h, w };
}
function trayCell() { return Math.min(40, cellPx() * 0.7); }
function renderTray(anim) {
  document.querySelectorAll('.slot').forEach((slot, i) => {
    const p = G.tray[i];
    slot.classList.toggle('used', !p);
    if (!p) { slot.innerHTML = ''; return; }
    const { html, h, w } = pieceHTML(p);
    const cs = trayCell();
    slot.innerHTML = `<div class="piece ${fitsAnywhere(p.cells) ? '' : 'nofit'}" style="grid-template-columns:repeat(${w},${cs}px);grid-template-rows:repeat(${h},${cs}px)">${html}</div>`;
    if (anim) slot.firstChild.animate([{ transform: 'scale(0) rotate(-20deg)' }, { transform: 'scale(1)' }], { duration: 350, delay: i * 80, easing: 'cubic-bezier(.2,1.6,.4,1)', fill: 'backwards' });
  });
}
function cellPx() { const r = $('board').getBoundingClientRect(); return (r.width * (1 - 0.024 - 0.011 * 7)) / N; }
function pitch() { const r = $('board').getBoundingClientRect(); return { x0: r.left + r.width * 0.012, y0: r.top + r.width * 0.012, p: (r.width * (1 - 0.024)) / N, gap: r.width * 0.011 }; }

/* ---------- dra och släpp ---------- */
let drag = null;
document.querySelectorAll('.slot').forEach(slot => slot.addEventListener('pointerdown', e => {
  const i = +slot.dataset.s, p = G.tray[i];
  if (!p || G.over || G.busy || current !== 'game') return;
  ac(); SFX.grab(); buzz(8);
  const { html, h, w } = pieceHTML(p);
  const el = document.createElement('div');
  el.className = 'drag';
  const pt = pitch();
  el.style.gridTemplateColumns = `repeat(${w},${pt.p - pt.gap}px)`;
  el.style.gridTemplateRows = `repeat(${h},${pt.p - pt.gap}px)`;
  el.style.gap = pt.gap + 'px';
  el.innerHTML = html;
  document.body.appendChild(el);
  slot.classList.add('used');
  const lift = e.pointerType === 'mouse' ? 0 : pt.p * 1.6;   // bitarna hamnar ovanför fingret
  drag = { i, p, el, w, h, lift, pt, target: null };
  moveDrag(e.clientX, e.clientY);
  try { slot.setPointerCapture(e.pointerId); } catch (_) { }
}));
window.addEventListener('pointermove', e => { if (drag) moveDrag(e.clientX, e.clientY); });
window.addEventListener('pointerup', e => { if (drag) dropDrag(); });
window.addEventListener('pointercancel', () => { if (drag) cancelDrag(); });

function moveDrag(x, y) {
  const d = drag, pt = d.pt;
  const wpx = d.w * pt.p, hpx = d.h * pt.p;
  const left = x - wpx / 2, top = y - hpx / 2 - d.lift - hpx * 0.3;
  d.el.style.transform = `translate(${left}px,${top}px)`;
  const c0 = Math.round((left - pt.x0) / pt.p), r0 = Math.round((top - pt.y0) / pt.p);
  const t = fits(d.p.cells, r0, c0) ? { r0, c0 } : null;
  if (JSON.stringify(t) !== JSON.stringify(d.target)) { d.target = t; preview(); }
}
function preview() {
  for (const c of cells) c.classList.remove('g', 'wc');
  renderGridColorsOnly();
  const d = drag;
  if (!d || !d.target) return;
  const { r0, c0 } = d.target;
  d.p.cells.forEach(([r, c]) => { const el = cellEl(r0 + r, c0 + c); el.classList.add('g'); el.style.setProperty('--k', d.p.color); });
  const { rows, cols } = linesIf(d.p.cells, r0, c0);
  rows.forEach(r => { for (let c = 0; c < N; c++) cellEl(r, c).classList.add('wc'); });
  cols.forEach(c => { for (let r = 0; r < N; r++) cellEl(r, c).classList.add('wc'); });
}
function renderGridColorsOnly() {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = G.grid[r][c]; cellEl(r, c).style.setProperty('--k', v || 'transparent'); }
}
function cancelDrag() {
  const d = drag; drag = null;
  d.el.remove();
  for (const c of cells) c.classList.remove('g', 'wc');
  renderGridColorsOnly();
  renderTray(false);
}
function dropDrag() {
  const d = drag;
  if (!d.target) { SFX.bonk(); cancelDrag(); return; }
  drag = null;
  d.el.remove();
  for (const c of cells) c.classList.remove('g', 'wc');
  place(d.i, d.p, d.target.r0, d.target.c0);
}

/* ---------- placera, rensa, poäng ---------- */
const PRAISE = ['', 'Snyggt!', 'Superbra!', 'Fantastiskt!', 'OTROLIGT!', 'GALET BRA!'];
async function place(i, p, r0, c0) {
  G.busy = true;
  p.cells.forEach(([r, c]) => { G.grid[r0 + r][c0 + c] = p.color; });
  G.tray[i] = null;
  G.score += p.cells.length;
  renderGrid();
  p.cells.forEach(([r, c]) => { cellEl(r0 + r, c0 + c).classList.add('f'); });
  SFX.place(); buzz(12);
  const { rows, cols } = linesIf([], 0, 0);
  const n = rows.length + cols.length;
  if (n) {
    G.combo = G.sinceClear <= 3 ? G.combo + 1 : 1;
    G.sinceClear = 0;
    G.bestCombo = Math.max(G.bestCombo, G.combo);
    const pts = [0, 10, 30, 60, 100, 150, 210][Math.min(6, n)] * 2 * G.combo;
    G.score += pts;
    await wait(90);
    const toClear = new Set();
    rows.forEach(r => { for (let c = 0; c < N; c++) toClear.add(r * N + c); });
    cols.forEach(c => { for (let r = 0; r < N; r++) toClear.add(r * N + c); });
    toClear.forEach(k => { const el = cells[k]; el.classList.add('clr'); sparks(el, G.grid[Math.floor(k / N)][k % N]); });
    SFX.clear(n); if (G.combo > 1) setTimeout(() => SFX.combo(G.combo), 150);
    buzz(n > 1 ? 60 : 30);
    const empty = () => G.grid.every(row => row.every(v => !v));
    toClear.forEach(k => { G.grid[Math.floor(k / N)][k % N] = null; });
    const allClear = empty();
    if (allClear) G.score += 300;
    popText(allClear ? 'TOMT BRÄDE!' : PRAISE[Math.min(5, n)], '+' + (pts + (allClear ? 300 : 0)) + (G.combo > 1 ? `  Combo x${G.combo}` : ''));
    cheer(allClear ? 'Wow, tomt bräde! 🤩' : pick([PRAISE[Math.min(5, n)], 'Jaaa! 🎉', 'Snyggt drag!', 'Fortsätt så! 💪', 'Yes! 🙌']));
    await wait(400);
    renderGrid();
  } else {
    G.sinceClear++;
    if (G.sinceClear > 3) G.combo = 0;
  }
  updateHud();
  if (!G.tray.some(Boolean)) newTray(); else renderTray(false);
  G.busy = false;
  checkOver();
}
function sparks(el, color) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;background:${color};--dx:${(Math.random() - .5) * 160}px;--dy:${(Math.random() - .7) * 160}px;position:fixed`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}
function popText(t, p) {
  const el = document.createElement('div');
  el.className = 'pop';
  el.innerHTML = `<div class="t">${esc(t)}</div><div class="p">${esc(p)}</div>`;
  $('board').appendChild(el);
  setTimeout(() => el.remove(), 1150);
}
function cheer(text) {
  const b = $('bubble'), av = $('cheer').querySelector('.av');
  if (b) { b.textContent = text; b.classList.add('show'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('show'), 1600); }
  if (av) { av.classList.remove('hop'); void av.offsetWidth; av.classList.add('hop'); }
}
function updateHud() {
  $('score').textContent = G.score;
  const best = store.get('best', 0);
  $('bestLine').textContent = G.score > best && best > 0 ? '⭐ Nytt rekord!' : '⭐ Rekord ' + Math.max(best, 0);
  const co = $('combo');
  if (co) { co.textContent = G.combo > 1 ? `Combo x${G.combo} 🔥` : ''; co.classList.toggle('on', G.combo > 1); }
  $('rerollN').textContent = G.rerolls;
  $('reroll').disabled = G.rerolls <= 0 || G.over;
  $('gSound').textContent = SND.sound ? '🔊' : '🔇';
}

/* ---------- slut på drag ---------- */
async function checkOver() {
  const left = G.tray.filter(Boolean);
  if (!left.length || left.some(p => fitsAnywhere(p.cells))) return;
  if (G.rerolls > 0) {
    cheer('Oj! Prova nya bitar? 🔄');
    $('reroll').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 500, iterations: 3 });
    return;
  }
  G.over = true;
  updateHud();
  SFX.lose(); buzz(80);
  for (let r = N - 1; r >= 0; r--) { for (let c = 0; c < N; c++) cellEl(r, c).classList.add('dead'); await wait(60); }
  await wait(400);
  const best = store.get('best', 0), isNew = G.score > best;
  store.set('games', store.get('games', 0) + 1);
  if (isNew) { store.set('best', G.score); await celebrate(me, 'Nytt rekord!', G.score + ' poäng ⭐', ['⭐', '🧱', '✨', '🏆', '🌟', '🎊', '🟩', '⭐']); }
  openPanel(`<div class="win-av" style="width:min(36vw,140px)">${isNew ? '<div class="crown">👑</div>' : ''}${avHTML(me)}</div>
    <h3>${isNew ? 'Nytt rekord! 🎉' : 'Inga drag kvar!'}</h3>
    <p>${G.score} poäng${G.bestCombo > 1 ? ` · bästa combo x${G.bestCombo}` : ''}</p>
    <p>${isNew ? '' : 'Rekord: ' + Math.max(best, G.score)}</p>
    <button class="btn green" id="again">🔁 Spela igen</button><button class="btn white" id="toMenu">🏠 Meny</button>`);
  $('again').onclick = () => { SFX.tap(); closePanel(); startGame(); };
  $('toMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
}

/* ---------- start ---------- */
function startGame() {
  G.grid = Array.from({ length: N }, () => Array(N).fill(null));
  G.score = 0; G.combo = 0; G.sinceClear = 9; G.over = false; G.rerolls = 1; G.busy = false; G.bestCombo = 0;
  $('cheer').setAttribute('style', styleOf(me));
  $('cheer').innerHTML = `${avHTML(me)}<span class="combo" id="combo"></span><div class="bubble" id="bubble"></div>`;
  show('game');
  renderGrid();
  requestAnimationFrame(() => { newTray(); updateHud(); });
  setTimeout(() => cheer(pick(['Lycka till! 🍀', 'Nu kör vi!', 'Du klarar det! 💪'])), 400);
}

function openPanel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }
function confirmBox(title, text, yes, onYes) {
  openPanel(`<h3>${title}</h3><p>${text}</p><button class="btn pink" id="cYes">${yes}</button><button class="btn white" id="cNo">Nej, spela vidare</button>`);
  $('cYes').onclick = () => { SFX.tap(); closePanel(); onYes(); };
  $('cNo').onclick = () => { SFX.tap(); closePanel(); };
}

$('play').onclick = () => { SFX.tap(); ac(); startGame(); };
$('pickChar').onclick = () => { SFX.tap(); show('select'); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('gHome').onclick = () => {
  SFX.tap();
  if (!G.over && G.score > 0) confirmBox('Avsluta spelet?', 'Poängen sparas inte.', 'Ja, till menyn', () => show('menu'));
  else show('menu');
};
$('gSound').onclick = () => { SND.sound = !SND.sound; saveSnd(); SFX.tap(); updateHud(); };
$('reroll').onclick = () => {
  if (G.rerolls <= 0 || G.over || G.busy) return;
  G.rerolls--; SFX.reroll(); buzz(20);
  newTray(); updateHud();
  cheer('Nya bitar! ✨');
  checkOver();
};
window.addEventListener('resize', () => { if (current === 'game') renderTray(false); });

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) { if ($('cNo')) $('cNo').click(); else if ($('toMenu')) $('toMenu').click(); return true; }
  if (current === 'menu') { goHub(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  show('menu'); return true;
};

bubbles();
show('menu');
