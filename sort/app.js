/* Bucinca Trolldrycker – menyer, nivåer per figur, ritning av flaskorna, hällanimation, ångra/tips/extra flaska. */
'use strict';
const store = makeStore('bm');
const { COLORS } = SORT;
const SFX = Object.assign({}, CORE_SFX, {
  sel: () => tone(880, .06, { type: 'triangle', vol: .09, to: 1100 }),
  unsel: () => tone(660, .05, { type: 'triangle', vol: .07, to: 520 }),
  pour: n => { for (let i = 0; i < 4 + n * 3; i++) tone(500 + Math.random() * 600, .05, { type: 'sine', vol: .05, delay: i * .045, to: 300 + Math.random() * 400 }); noise(.35, { type: 'bandpass', f: 1200, q: 2, vol: .06 }); },
  cork: () => { tone(320, .08, { type: 'square', vol: .08, to: 900 }); [1047, 1319, 1568].forEach((f, i) => tone(f, .14, { type: 'triangle', vol: .09, delay: .08 + i * .07 })); },
  reveal: () => tone(1500, .12, { type: 'sine', vol: .06, to: 2200 }),
  hint: () => [784, 988].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .08, delay: i * .1 })),
  win: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .22, { type: 'triangle', vol: .13, delay: i * .09 }))
});

/* ---------- vem spelar + framsteg per figur ---------- */
const ME = { ch: store.get('ch', 0) };
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
const PROG = store.get('prog', {}) || {};
const progOf = ch => PROG[ch] || (PROG[ch] = { lvl: 1, stars: {} });
const saveProg = () => store.set('prog', PROG);
const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'levels') buildLevels();
  if (id === 'game') resize();
}
function panel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }
function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${COLORS[k % 8].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Trolldrycker', 'l1') + ln('🧪✨', 'l2');
  const p = progOf(ME.ch), stars = Object.values(p.stars).reduce((a, v) => a + v, 0);
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Spelare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px"><span class="chip">🧪 Nivå ${p.lvl}</span><span class="chip">⭐ ${stars}</span></div></div>`;
  $('toPlay').textContent = `▶️ Spela nivå ${p.lvl}`;
}
function pickFigure(done) {
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b><span class="chip">Nivå ${progOf(i).lvl}</span></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    ME.ch = +el.dataset.i; store.set('ch', ME.ch); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(done, 220);
  });
  $('meBack').onclick = () => { SFX.tap(); show('menu'); };
  show('meScr');
}
function buildLevels() {
  const p = progOf(ME.ch), max = Math.max(p.lvl + 12, 30);
  $('lvls').innerHTML = Array.from({ length: max }, (_, i) => {
    const L = i + 1, st = p.stars[L] || 0, lock = L > p.lvl;
    return `<button class="lv ${L === p.lvl ? 'next' : ''} ${lock ? 'lock' : ''} ${L % 10 === 0 ? 'boss' : ''}" data-l="${L}">${lock ? '🔒' : L}<small>${lock ? L : st ? '⭐'.repeat(st) : L === p.lvl ? 'Spela!' : ''}</small></button>`;
  }).join('');
  $('lvls').querySelectorAll('.lv').forEach(b => b.onclick = () => { const L = +b.dataset.l; if (L > p.lvl) { SFX.bonk(); return; } SFX.tap(); startLevel(L); });
  const nx = $('lvls').querySelector('.next'); if (nx) nx.scrollIntoView({ block: 'center' });
}

/* ================= SPELET ================= */
const G = { L: 1, cap: 4, tubes: [], hid: [], hist: [], moves: 0, sel: -1, anim: null, hints: 3, adds: 1, usedHint: false, won: false, par: 0, lift: [], shake: [], glow: [], hintT: 0, hintMove: null };
function startLevel(L) {
  const lv = SORT.makeLevel(L);
  Object.assign(G, { L, cap: lv.cap, tubes: lv.tubes.map(t => t.slice()), hid: lv.hid.map(h => h.slice()), start: lv, hist: [], moves: 0, sel: -1, anim: null, hints: 3, adds: 1, usedHint: false, won: false, par: lv.par, hintT: 0, hintMove: null });
  resetFx();
  closePanel(); show('game'); layout(); updUI();
  if (L === 1 && !store.get('helped', false)) { store.set('helped', true); setTimeout(help, 400); }
}
function restart() { const L = G.L; const lv = G.start; Object.assign(G, { tubes: lv.tubes.map(t => t.slice()), hid: lv.hid.map(h => h.slice()), hist: [], moves: 0, sel: -1, anim: null, hints: 3, adds: 1, usedHint: false, won: false, hintMove: null }); resetFx(); layout(); updUI(); toast(`Nivå ${L} från början`); }
function resetFx() { G.lift = []; G.shake = []; G.glow = []; PARTS.length = 0; }
function updUI() {
  $('title').innerHTML = `Nivå ${G.L}${G.L % 10 === 0 ? ' 👑' : ''}<small>${G.moves} drag</small>`;
  $('nUndo').textContent = G.hist.length ? '' : ''; $('tUndo').classList.toggle('dim', !G.hist.length);
  $('nHint').textContent = G.hints; $('tHint').classList.toggle('dim', !G.hints);
  $('nAdd').textContent = G.adds; $('tAdd').classList.toggle('dim', !G.adds);
}
let toastT = 0;
function toast(t) { document.querySelectorAll('.toast').forEach(e => e.remove()); const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; $('game').appendChild(d); clearTimeout(toastT); toastT = setTimeout(() => d.remove(), 1800); }

/* ---------- drag ---------- */
function tap(i) {
  if (G.won) return;
  if (G.anim) return;
  const t = G.tubes[i], cap = G.cap;
  if (G.sel < 0) {
    if (!t.length || SORT.done(t, cap)) { G.shake[i] = .35; SFX.bonk(); buzz(20); return; }
    G.sel = i; SFX.sel(); buzz(8); return;
  }
  if (G.sel === i) { G.sel = -1; SFX.unsel(); return; }
  if (SORT.canPour(G.tubes, G.sel, i, cap)) {
    const from = G.sel, n = SORT.pourAmount(G.tubes, from, i, cap), c = SORT.top(G.tubes[from]);
    G.hist.push({ tubes: G.tubes.map(q => q.slice()), hid: G.hid.map(q => q.slice()) });
    G.anim = { from, to: i, n, c, t: 0, dur: .62 + n * .1, startFrom: G.tubes[from].length, startTo: G.tubes[i].length };
    G.sel = -1; G.hintMove = null;
    SFX.pour(n); buzz(10);
    return;
  }
  // går inte: välj den nya flaskan i stället om den har något att hälla
  if (t.length && !SORT.done(t, cap)) { G.sel = i; SFX.sel(); }
  else { G.shake[i] = .35; SFX.bonk(); buzz(20); G.sel = -1; }
}
function finishPour() {
  const A = G.anim; G.anim = null;
  SORT.pour(G.tubes, A.from, A.to, G.cap);
  // hälla ut: flytta dolda-markeringar
  for (let k = 0; k < A.n; k++) { G.hid[A.from].pop(); G.hid[A.to].push(false); }
  G.moves++;
  // ny översta i källan syns nu
  const f = G.tubes[A.from], h = G.hid[A.from];
  if (f.length && h[f.length - 1]) { h[f.length - 1] = false; SFX.reveal(); const P = tubePos(A.from); sparkle(P.x, P.y - P.liq(f.length - .5), COLORS[f[f.length - 1]].c, 10); }
  if (SORT.done(G.tubes[A.to], G.cap)) { SFX.cork(); buzz(30); G.glow[A.to] = 1; const P = tubePos(A.to); sparkle(P.x, P.y - P.th, COLORS[A.c].c, 26); }
  updUI();
  if (SORT.solved(G.tubes, G.cap)) win();
}
function undo() {
  if (G.anim || G.won) return;
  const h = G.hist.pop(); if (!h) { SFX.bonk(); return; }
  G.tubes = h.tubes; G.hid = h.hid; G.moves = Math.max(0, G.moves - 1); G.sel = -1; G.hintMove = null;
  // en extra flaska som lagts till efter draget behålls
  SFX.unsel(); updUI(); layout();
}
function hint() {
  if (G.anim || G.won) return;
  if (!G.hints) { toast('Inga tips kvar på den här nivån'); SFX.bonk(); return; }
  const sol = SORT.solve(G.tubes, G.cap, 150000);
  if (!sol) { toast('Det går inte att lösa härifrån – ångra! ↩️'); SFX.bonk(); return; }
  if (!sol.length) return;
  G.hints--; G.usedHint = true; G.hintMove = sol[0]; G.hintT = 0; G.sel = -1; SFX.hint(); updUI();
}
function addTube() {
  if (G.anim || G.won) return;
  if (!G.adds) { toast('Bara en extra flaska per nivå'); SFX.bonk(); return; }
  G.adds--; G.tubes.push([]); G.hid.push([]); for (const h of G.hist) { h.tubes.push([]); h.hid.push([]); }
  SFX.pick(); layout(); updUI(); toast('En tom flaska till! 🧪');
}
async function win() {
  G.won = true;
  const p = progOf(ME.ch);
  const stars = G.usedHint || G.adds < 1 ? (G.moves <= G.par + 6 ? 2 : 1) : G.moves <= G.par ? 3 : G.moves <= G.par + 8 ? 2 : 1;
  p.stars[G.L] = Math.max(p.stars[G.L] || 0, stars);
  const first = G.L >= p.lvl;
  if (first) p.lvl = G.L + 1;
  saveProg();
  setTimeout(() => { SFX.win(); confetti(); }, 350);
  await new Promise(r => setTimeout(r, 1300));
  if (first && G.L % 10 === 0) await celebrate(ME.ch, `${charName(ME.ch)} klarade nivå ${G.L}!`, 'Mästerbryggare! 🧙', ['🧪', '✨', '⭐', '🔮', '🎉', '💜']);
  panel(`<h3>Nivå ${G.L} klar! ✨</h3><div style="font-size:44px;letter-spacing:4px">${'⭐'.repeat(stars)}${'<span style="opacity:.25">⭐</span>'.repeat(3 - stars)}</div>
    <p style="margin:0">${G.moves} drag${G.usedHint ? ' · med tips' : ''}</p>
    <button class="btn green" id="pNext">➡️ Nivå ${G.L + 1}</button>
    <div class="row2"><button class="btn white small" id="pAgain">🔄 Igen</button><button class="btn white small" id="pMenu">🏠 Meny</button></div>`);
  $('pNext').onclick = () => { SFX.tap(); startLevel(G.L + 1); };
  $('pAgain').onclick = () => { SFX.tap(); startLevel(G.L); };
  $('pMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
}

/* ================= RITNING ================= */
const cv = $('cv'), cx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const SAFE = { t: 14, b: 14 };
function resize() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const cs = getComputedStyle(document.documentElement); SAFE.t = parseFloat(cs.getPropertyValue('--safe-t')) || 14; SAFE.b = parseFloat(cs.getPropertyValue('--safe-b')) || 14;
  layout();
}
addEventListener('resize', () => { if (current === 'game') resize(); });

/* flaskornas placering: välj antal rader som ger störst flaskor */
const LAY = { tw: 40, th: 150, pos: [] };
function layout() {
  const N = G.tubes.length; if (!N || !VW) return;
  const top = SAFE.t + 70, bot = VH - SAFE.b - 100, H = bot - top, Wd = VW - 24;
  let best = null;
  for (let rows = 1; rows <= 4; rows++) {
    const cols = Math.ceil(N / rows);
    const tw = Math.min(Wd / cols * .6, (H / rows) / 4.6, 90);
    if (!best || tw > best.tw) best = { rows, cols, tw };
  }
  const { rows, cols, tw } = best, th = tw * 3.5;
  LAY.tw = tw; LAY.th = th; LAY.pos = [];
  const rowH = H / rows;
  for (let r = 0, k = 0; r < rows; r++) {
    const inRow = Math.min(cols, N - k), gap = Wd / cols;
    const x0 = VW / 2 - (inRow - 1) * gap / 2;
    const y = top + rowH * r + rowH / 2 + th / 2 + tw * .3;
    for (let c = 0; c < inRow; c++, k++) LAY.pos.push({ x: x0 + c * gap, y });
  }
}
/* geometri för en flaska: ursprung i botten, mynningen uppåt */
function tubePos(i) {
  const p = LAY.pos[i] || { x: 0, y: 0 }, tw = LAY.tw, th = LAY.th, pad = tw * .12, seg = (th * .84) / G.cap;
  return { x: p.x, y: p.y, tw, th, pad, seg, liq: v => pad + v * seg };
}
function tubePath(c, tw, th, inner) {
  const w = inner ? tw - tw * .16 : tw, r = w / 2, top = -th + (inner ? tw * .1 : 0), bot = inner ? -tw * .08 : 0;
  c.beginPath();
  c.moveTo(-w / 2, top); c.lineTo(-w / 2, bot - r); c.arc(0, bot - r, r, Math.PI, 0, true); c.lineTo(w / 2, top);
  if (!inner) { c.lineTo(w / 2 + tw * .1, top - tw * .05); c.quadraticCurveTo(w / 2 + tw * .14, top - tw * .18, w / 2, top - tw * .2); c.lineTo(-w / 2, top - tw * .2); c.quadraticCurveTo(-w / 2 - tw * .14, top - tw * .18, -w / 2 - tw * .1, top - tw * .05); }
  c.closePath();
}
// area av en polygon under (större y än) en vågrät linje
function clipBelow(poly, Y) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], ai = a[1] >= Y, bi = b[1] >= Y;
    if (ai) out.push(a);
    if (ai !== bi) { const t = (Y - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, Y]); }
  }
  let A = 0; for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; A += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(A) / 2;
}
/* rita en flaska (även lutande – vätskan står alltid vågrätt) */
function drawTube(i, ox, oy, ang, segs, opt) {
  const P = tubePos(i), tw = P.tw, th = P.th, iw = tw - tw * .16;
  const ca = Math.cos(ang), sa = Math.sin(ang), W = (x, y) => [ox + x * ca - y * sa, oy + x * sa + y * ca];
  const base = () => cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const local = () => cx.setTransform(DPR * ca, DPR * sa, -DPR * sa, DPR * ca, DPR * ox, DPR * oy);
  // skugga + glas bakom
  local();
  if (opt.glow) { cx.shadowColor = '#FFE27A'; cx.shadowBlur = 24 * opt.glow; }
  tubePath(cx, tw, th, false); cx.fillStyle = '#ffffff22'; cx.fill(); cx.shadowBlur = 0;
  // vätskan
  const total = segs.reduce((a, s) => a + s.v, 0);
  if (total > 0.001) {
    cx.save(); local(); tubePath(cx, tw, th, true); cx.clip();
    const bottom = -P.pad;
    const poly = [W(-iw / 2, bottom + tw * .3), W(iw / 2, bottom + tw * .3), W(iw / 2, -th), W(-iw / 2, -th)];
    const ys = poly.map(p => p[1]), minY = Math.min(...ys), maxY = Math.max(...ys);
    const levelFor = vol => { const A = vol * P.seg * iw + tw * .3 * iw * .8; let lo = minY, hi = maxY; for (let k = 0; k < 28; k++) { const m = (lo + hi) / 2; if (clipBelow(poly, m) > A) lo = m; else hi = m; } return (lo + hi) / 2; };
    base();
    let acc = 0, yPrev = maxY + 50;
    segs.forEach((s, k) => {
      acc += s.v; const y = levelFor(acc);
      const col = s.h ? { c: '#3B2A63', d: '#24183F' } : COLORS[s.c];
      const g = cx.createLinearGradient(ox - tw, 0, ox + tw, 0); g.addColorStop(0, col.d); g.addColorStop(.45, col.c); g.addColorStop(1, col.d);
      cx.fillStyle = g; cx.fillRect(ox - th * 2, y, th * 4, yPrev - y + .5);
      if (s.h && Math.abs(ang) < .05) { cx.fillStyle = '#B9A6FF'; cx.font = `bold ${Math.round(P.seg * .55)}px Fredoka, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('?', ox, (y + yPrev) / 2); }
      if (k === segs.length - 1) { cx.fillStyle = '#ffffff55'; cx.fillRect(ox - th * 2, y, th * 4, Math.max(1.5, P.seg * .07)); }
      yPrev = y;
    });
    // bubblor
    if (opt.bubbles) for (let b = 0; b < 4; b++) { const tt = (opt.time * .6 + b * .27) % 1; cx.fillStyle = '#ffffff66'; cx.beginPath(); cx.arc(ox + Math.sin(b * 2.1 + opt.time) * iw * .25, yPrev + (maxY - yPrev) * (1 - tt) * .9, tw * .05, 0, 7); cx.fill(); }
    cx.restore();
  }
  // glaset framför: kant och glans
  local();
  tubePath(cx, tw, th, false); cx.strokeStyle = opt.sel ? '#FFE27A' : '#ffffffcc'; cx.lineWidth = Math.max(2, tw * .06); cx.stroke();
  cx.fillStyle = '#ffffff40'; cx.beginPath(); cx.ellipse(-iw * .28, -th * .5, tw * .07, th * .32, 0, 0, 7); cx.fill();
  // kork på klara flaskor
  if (opt.cork) {
    const cw = iw * .95, ch = tw * .5, y0 = -th - tw * .32;
    cx.fillStyle = '#8A5A2B'; rrect(cx, -cw / 2, y0, cw, ch, tw * .12); cx.fill();
    cx.fillStyle = '#B07A3E'; rrect(cx, -cw / 2 + 3, y0 + 2, cw - 6, ch * .45, tw * .1); cx.fill();
  }
  base();
}
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const segsOf = i => G.tubes[i].map((c, k) => ({ c, v: 1, h: G.hid[i][k] }));

/* partiklar */
const PARTS = [];
function sparkle(x, y, c, n) { for (let k = 0; k < n; k++) { const a = Math.random() * 7, v = 60 + Math.random() * 200; PARTS.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: .6 + Math.random() * .5, c: Math.random() < .4 ? '#fff' : c, r: 2 + Math.random() * 4 }); } }
const STARS = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.8, p: Math.random() * 7 }));

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
  if (current !== 'game') return;
  const time = now / 1000;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0); cx.clearRect(0, 0, VW, VH);
  for (const s of STARS) { cx.globalAlpha = .3 + .5 * Math.abs(Math.sin(time * .8 + s.p)); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(s.x * VW, s.y * VH, s.r, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
  const A = G.anim;
  if (A) { A.t += dt; if (A.t >= A.dur) finishPour(); }
  const N = G.tubes.length;
  // vanliga flaskor
  for (let i = 0; i < N; i++) {
    G.lift[i] = (G.lift[i] || 0) + ((G.sel === i ? 1 : 0) - (G.lift[i] || 0)) * Math.min(1, dt * 14);
    G.shake[i] = Math.max(0, (G.shake[i] || 0) - dt); G.glow[i] = Math.max(0, (G.glow[i] || 0) - dt * .8);
    if (G.anim && G.anim.from === i) continue;
    const P = tubePos(i);
    let ox = P.x + (G.shake[i] ? Math.sin(G.shake[i] * 60) * 6 : 0), oy = P.y - G.lift[i] * P.tw * .7;
    let segs = segsOf(i);
    if (G.anim && G.anim.to === i) { const f = pourFrac(G.anim); if (f > 0) segs = segs.concat([{ c: G.anim.c, v: G.anim.n * f }]); }
    const hm = G.hintMove && (G.hintMove[0] === i || G.hintMove[1] === i);
    if (hm) { G.hintT += dt / N; const b = Math.sin(time * 8) * 4; cx.font = `${Math.round(P.tw * .7)}px sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'bottom'; cx.fillText(G.hintMove[0] === i ? '⬆️' : '⬇️', ox, oy - P.th - P.tw * .4 + b); }
    drawTube(i, ox, oy, 0, segs, { sel: G.sel === i || hm, cork: SORT.done(G.tubes[i], G.cap) && !(G.anim && G.anim.to === i), glow: G.glow[i] + (hm ? .6 : 0), time });
  }
  // flaskan som häller
  if (G.anim) drawPouring(G.anim, time);
  // partiklar
  for (const p of PARTS) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
  for (let k = PARTS.length - 1; k >= 0; k--) if (PARTS[k].life > PARTS[k].max) PARTS.splice(k, 1);
  for (const p of PARTS) { cx.globalAlpha = 1 - p.life / p.max; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
}
requestAnimationFrame(frame);
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const T_IN = .26, T_OUT = .24;
function pourFrac(A) { const pd = A.dur - T_IN - T_OUT; return ease((A.t - T_IN) / pd); }
function drawPouring(A, time) {
  const S = tubePos(A.from), T = tubePos(A.to);
  // häll från den sida där det finns plats på skärmen (flaskans botten pekar mot mitten)
  const dir = T.x < VW / 2 ? -1 : 1;
  const f = pourFrac(A);
  const remain = A.startFrom - A.n * f;
  // vinkel: lutar mer ju mindre som finns kvar
  const angPour = dir * (Math.PI / 180) * (62 + (1 - remain / G.cap) * 32);
  const tin = ease(A.t / T_IN), tout = ease((A.t - (A.dur - T_OUT)) / T_OUT);
  const k = A.t < T_IN ? tin : A.t > A.dur - T_OUT ? 1 - tout : 1;
  const ang = angPour * k;
  // läpp (mynningens kant närmast målet) ska hamna strax ovanför målets mynning
  const iw = S.tw - S.tw * .16, lipL = [dir * (iw / 2 + S.tw * .1), -S.th - S.tw * .05];
  const ca = Math.cos(angPour), sa = Math.sin(angPour);
  const lipW = [lipL[0] * ca - lipL[1] * sa, lipL[0] * sa + lipL[1] * ca];
  const tgt = [T.x - dir * T.tw * .1, T.y - T.th - T.tw * .9];
  const pourO = [tgt[0] - lipW[0], tgt[1] - lipW[1]];
  const home = [S.x, S.y - S.tw * .7];
  const ox = home[0] + (pourO[0] - home[0]) * k, oy = home[1] + (pourO[1] - home[1]) * k;
  // stråle
  if (f > 0 && f < 1) {
    const col = COLORS[A.c], lx = ox + lipL[0] * Math.cos(ang) - lipL[1] * Math.sin(ang), ly = oy + lipL[0] * Math.sin(ang) + lipL[1] * Math.cos(ang);
    const surf = T.y - T.liq(G.tubes[A.to].length + A.n * f);
    cx.strokeStyle = col.c; cx.lineCap = 'round'; cx.lineWidth = T.tw * .2 * (1 - Math.abs(f - .5) * .6);
    cx.beginPath(); cx.moveTo(lx, ly); cx.quadraticCurveTo(lx + dir * 4, ly + 10, T.x - dir * T.tw * .05, surf); cx.stroke();
    cx.strokeStyle = '#ffffff55'; cx.lineWidth *= .35; cx.stroke();
  }
  const segs = segsOf(A.from);
  const left = A.n * (1 - f);
  for (let q = 0; q < A.n; q++) segs.pop();
  if (left > .001) segs.push({ c: A.c, v: left });
  drawTube(A.from, ox, oy, ang, segs, { sel: false, time, bubbles: f > 0 && f < 1 });
}

/* ---------- tryck ---------- */
cv.addEventListener('pointerdown', e => {
  if (current !== 'game') return;
  e.preventDefault();
  const x = e.clientX, y = e.clientY;
  let hit = -1, bd = 1e9;
  for (let i = 0; i < G.tubes.length; i++) {
    const P = tubePos(i), lift = (G.lift[i] || 0) * P.tw * .7;
    const top = P.y - P.th - P.tw * .6 - lift, bot = P.y + P.tw * .3;
    if (y < top || y > bot) continue;
    const dx = Math.abs(x - P.x); if (dx > P.tw * 1.1) continue;
    if (dx < bd) { bd = dx; hit = i; }
  }
  if (hit >= 0) tap(hit);
  else if (G.sel >= 0) { G.sel = -1; SFX.unsel(); }
});

/* ---------- hjälp ---------- */
function help() {
  panel(`<h3>Så spelar man 🧪</h3>
    <p style="text-align:left;font-size:16px">Sortera trolldryckerna så att varje flaska bara har <b>en färg</b>.<br>
    👆 Tryck på en flaska för att lyfta den, tryck sedan på flaskan du vill hälla i.<br>
    Du får bara hälla på <b>samma färg</b> eller i en <b>tom</b> flaska – och bara om det finns plats.<br>
    ❓ Från nivå 12 finns <b>dolda lager</b>. De syns när det som ligger ovanpå hälls bort.<br>
    ↩️ ångra · 💡 tips (3 per nivå) · 🧪 en extra tom flaska (1 per nivå) · 🔄 börja om<br>
    ⭐ Få drag och inga tips ger tre stjärnor. Var tionde nivå är en mästarnivå 👑.</p>
    <button class="btn green" id="pClose">👍 Då kör vi!</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('meCard').onclick = () => { SFX.tap(); pickFigure(() => show('menu')); };
$('toPlay').onclick = () => { SFX.tap(); startLevel(progOf(ME.ch).lvl); };
$('toLevels').onclick = () => { SFX.tap(); show('levels'); };
$('toHelp').onclick = () => { SFX.tap(); help(); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
$('gBack').onclick = () => { SFX.tap(); G.anim = null; show('menu'); };
$('gRestart').onclick = () => { SFX.tap(); if (!G.anim) restart(); };
$('tUndo').onclick = () => undo();
$('tHint').onclick = () => hint();
$('tAdd').onclick = () => addTube();
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) { for (const id of ['pClose', 'pMenu']) if ($(id)) { $(id).click(); return true; } return true; }
  if (current === 'game') { $('gBack').click(); return true; }
  if (current === 'menu') { goHub(); return true; }
  show('menu'); return true;
};
bubbles();
show('menu');
