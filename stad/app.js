/* Bucinca Staden – en lekvärld: dra runt figurer och saker, ät, laga mat, sov, bada, klä ut dig, rita på tavlan.
   Allt sparas automatiskt i enheten. */
'use strict';
const store = makeStore('bv');

/* figurernas mått: höjd i världen, huvudets mitt (andel av bildens bredd), ögonhöjd (andel av höjden), vikt */
const CFG = [
  { H: 330, hx: 0.49, ey: 0.13, kg: 32 }, { H: 340, hx: 0.48, ey: 0.15, kg: 35 }, { H: 430, hx: 0.39, ey: 0.14, kg: 82 },
  { H: 410, hx: 0.39, ey: 0.13, kg: 60 }, { H: 300, hx: 0.42, ey: 0.17, kg: 25 }, { H: 330, hx: 0.45, ey: 0.17, kg: 40 },
  { H: 425, hx: 0.43, ey: 0.17, kg: 85 }, { H: 400, hx: 0.5, ey: 0.17, kg: 62 }, { H: 395, hx: 0.48, ey: 0.17, kg: 70 },
  { H: 420, hx: 0.46, ey: 0.15, kg: 80 },
  { H: 385, hx: 0.475, ey: 0.12, kg: 72 }
];
const cfgOf = i => CFG[i] || { H: 400, hx: 0.5, ey: 0.15, kg: 60 };
const IMG = CHARS.map((_, i) => { const im = new Image(); im.src = fullOf(i).src; return im; });
const FACEIMG = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

const SFX = Object.assign({}, CORE_SFX, {
  pick: () => tone(620, .07, { to: 900, type: 'triangle', vol: .08 }),
  drop: () => noise(.07, { type: 'lowpass', f: 500, vol: .18 }),
  crunch: () => noise(.09, { f: 2500, q: 2, vol: .16 }),
  glug: () => [300, 260, 230].forEach((f, i) => tone(f, .08, { vol: .1, delay: i * .1 })),
  yum: () => [660, 880].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .09, delay: i * .1 })),
  giggle: () => [700, 900, 1100].forEach((f, i) => tone(f + Math.random() * 100, .07, { type: 'triangle', vol: .07, delay: i * .07 })),
  water: () => noise(.6, { f: 3000, q: .4, vol: .07 }),
  flush: () => { noise(1.3, { type: 'lowpass', f: 900, vol: .3 }); tone(300, 1.2, { to: 90, vol: .05 }); },
  door: () => tone(200, .15, { to: 140, type: 'sawtooth', vol: .04 }),
  click: () => tone(1200, .03, { type: 'square', vol: .05 }),
  tv: () => [523, 659, 784].forEach((f, i) => tone(f, .1, { type: 'square', vol: .04, delay: i * .08 })),
  kaching: () => { [1568, 2093].forEach((f, i) => tone(f, .25, { type: 'triangle', vol: .08, delay: i * .08 })); noise(.15, { f: 4000, vol: .05 }); },
  ding: () => tone(1320, .5, { type: 'sine', vol: .1 }),
  whee: () => tone(400, .7, { to: 1200, type: 'triangle', vol: .08 }),
  woof: () => [180, 160].forEach((f, i) => tone(f, .1, { type: 'square', vol: .08, delay: i * .14 })),
  meow: () => tone(700, .35, { to: 500, type: 'triangle', vol: .08 }),
  squeak: () => tone(1500, .08, { to: 2000, vol: .06 }),
  zap: () => tone(1800, .2, { to: 300, type: 'sawtooth', vol: .04 }),
  leaves: () => noise(.4, { f: 1800, q: .5, vol: .1 }),
  stove: () => noise(.25, { f: 800, vol: .08 }),
  shower: () => noise(.5, { f: 3500, q: .4, vol: .08 })
});
const TUNE = [523, 587, 659, 523, 659, 698, 784, 784, 659, 587, 523, 587, 659, 523, 392, 523];
const PLAY = {
  '🎸': () => [330, 415, 494, 659].forEach((f, i) => tone(f, .5, { type: 'triangle', vol: .07, delay: i * .03 })),
  '🥁': () => { noise(.15, { type: 'lowpass', f: 200, vol: .4 }); tone(90, .15, { vol: .2, to: 60 }); },
  '🎺': () => tone(pick([523, 587, 659, 784]), .4, { type: 'sawtooth', vol: .05 }),
  '🎮': () => [880, 660, 1100].forEach((f, i) => tone(f, .06, { type: 'square', vol: .05, delay: i * .07 })),
  '📱': () => [1320, 1568].forEach((f, i) => tone(f, .1, { vol: .06, delay: i * .12 })),
  '🐶': () => SFX.woof(), '🐱': () => SFX.meow(), '🐰': () => SFX.squeak(), '🐹': () => SFX.squeak(), '🦜': () => tone(1800, .15, { to: 2400, vol: .06 }), '🐢': () => tone(200, .2, { vol: .06 }),
  '🦆': () => tone(500, .12, { to: 400, type: 'square', vol: .06 }), '🎈': () => tone(900, .1, { to: 1400, vol: .05 })
};

/* ---------- världen ---------- */
let W = null;
let nextId = 1;
function freshWorld() {
  const w = { v: 1, cur: 'hem', cam: {}, chars: {}, sc: {}, bag: [] };
  for (const id in SCENES) w.sc[id] = { items: [], fs: {} };
  const start = [[0, 'hem', 1150], [1, 'hem', 1420], [2, 'hem', 520], [3, 'hem', 1980], [4, 'park', 700], [5, 'park', 1500], [6, 'park', 2300], [7, 'affar', 1700], [8, 'hem', 2700], [9, 'sjukhus', 1600]];
  for (const [ch, sc, x] of start) if (ch < CHARS.length) w.chars[ch] = { sc, x, y: FLOOR, pose: 'stand', acc: {} };
  const put = (sc, e, x, y) => w.sc[sc].items.push({ id: nextId++, e, x, y: y || FLOOR - 40 });
  put('hem', '🍎', 1100, FLOOR - 230); put('hem', '🍌', 1160, FLOOR - 230); put('hem', '🥛', 1240, FLOOR - 230); put('hem', '🥚', 480, FLOOR - 265);
  put('hem', '🧸', 2700, FLOOR - 190); put('hem', '🐶', 2000, FLOOR - 40); put('hem', '🦆', 3800, FLOOR - 40); put('park', '⚽', 1250); put('park', '🐱', 2100);
  return w;
}
function load() {
  try { W = store.get('world', null); } catch (e) { W = null; }
  if (!W || W.v !== 1) W = freshWorld();
  for (const id in SCENES) if (!W.sc[id]) W.sc[id] = { items: [], fs: {} };
  for (let i = 0; i < CHARS.length; i++) if (!W.chars[i]) W.chars[i] = { sc: 'hem', x: 600 + i * 120, y: FLOOR, pose: 'stand', acc: {} };
  for (const id in W.sc) for (const it of W.sc[id].items) nextId = Math.max(nextId, it.id + 1);
  for (const ch in W.chars) { const c = W.chars[ch]; c.ch = +ch; if (c.pose === 'slide' || c.pose === 'drag') c.pose = 'stand'; }
}
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { store.set('world', W); } catch (e) { } }, 600); }
addEventListener('pagehide', () => { try { store.set('world', W); } catch (e) { } });

/* möblerna på aktuell plats (med sparat läge) */
let FURN = [];
let boardCv = null, boardCtx = null, boardImg = null;
function buildFurn() {
  const S = W.sc[W.cur];
  FURN = SCENES[W.cur].furn.map(([t, x, o], i) => Object.assign({ t, x, i }, o || {}, S.fs[i] || {}));
  boardImg = null;
  if (W.cur === 'skola') {
    boardCv = document.createElement('canvas'); boardCv.width = 880; boardCv.height = 360; boardCtx = boardCv.getContext('2d');
    const src = store.get('board', null);
    if (src) { const im = new Image(); im.onload = () => { boardCtx.drawImage(im, 0, 0); }; im.src = src; }
    boardImg = boardCv;
  }
}
function saveF(f) { const S = W.sc[W.cur]; S.fs[f.i] = { on: f.on, open: f.open, sum: f.sum, rot: f.rot }; save(); }
const items = () => W.sc[W.cur].items;
const charsHere = () => Object.values(W.chars).filter(c => c.sc === W.cur);

/* ---------- kamera ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, SC = 1;
let TOPY = 150;   // översta synliga y (taket syns inte i liggande läge – då blir allt större)
function resize() {
  DPR = Math.min(2, devicePixelRatio || 1); VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  SC = Math.min(VH / 850, VW / 650);   // stående: minst 650 enheter brett
  TOPY = 1000 - VH / SC;
}
addEventListener('resize', resize);
const camX = () => W.cam[W.cur] || 0;
function clampCam() {
  const sw = SCENES[W.cur].w, vw = VW / SC;
  W.cam[W.cur] = vw >= sw ? (sw - vw) / 2 : Math.max(0, Math.min(sw - vw, camX()));
}
const toWorld = (sx, sy) => ({ x: sx / SC + camX(), y: sy / SC + TOPY });
const toScreen = (x, y) => ({ x: (x - camX()) * SC, y: (y - TOPY) * SC });

/* ---------- ytor och sittplatser ---------- */
function supportY(x, fromY) {
  let best = FLOOR;
  for (const f of FURN) {
    const ft = FT[f.t];
    if (f.t === 'toybox' && f.open) continue;
    for (const [a, b, h] of ft.surf || []) {
      const top = FLOOR - h;
      if (x >= f.x + a && x <= f.x + b && top >= fromY - 6 && top < best) best = top;
    }
  }
  return best;
}
function seatPos(f, s) {
  const ft = FT[f.t], st = ft.seats[s];
  if (st.kind === 'swing') { const a = f.ang || 0, px = f.x + 180, py = FLOOR - 430; return { x: px + Math.sin(a) * 300, y: py + Math.cos(a) * 300, a }; }
  return { x: f.x + st.x, y: FLOOR - st.h, a: 0 };
}
function seatTaken(fi, s) { return charsHere().some(c => c.seat && c.seat[0] === fi && c.seat[1] === s); }

/* ---------- figurernas läge och form ---------- */
function charGeo(c) {
  const cf = cfgOf(c.ch), im = IMG[c.ch];
  const ar = im.naturalWidth ? im.naturalWidth / im.naturalHeight : 0.4;
  const H = cf.H, w = H * ar;
  let ax = c.x, ay = c.y, rot = 0;
  if (c.seat) {
    const f = FURN[c.seat[0]];
    if (f) {
      const sp = seatPos(f, c.seat[1]), kind = FT[f.t].seats[c.seat[1]].kind;
      if (kind === 'lie') return { H, w, cx: sp.x - 20, cy: sp.y - w * 0.22, rot: -Math.PI / 2, kind };
      rot = kind === 'swing' ? -sp.a * 0.6 : 0;
      ax = sp.x; ay = sp.y + H * 0.46;
      return { H, w, cx: ax, cy: ay - H / 2, rot, kind, ax, ay };
    }
  }
  if (c.pose === 'slide' && c.slide) { const f = FURN[c.slide.f]; const p = FT.slide.path(f, Math.min(1, c.slide.p)); ax = p.x; ay = p.y; rot = -0.35; }
  if (c.pose === 'drag') rot = Math.max(-0.4, Math.min(0.4, (c.dvx || 0) * 0.0006));
  return { H, w, cx: ax, cy: ay - H / 2, rot, kind: c.pose, ax, ay };
}
/* punkt i figurens bild (u, v = andel av bredd/höjd från övre vänstra hörnet) -> världen */
function charPt(c, g, u, v) {
  const lx = (u - 0.5) * g.w, ly = (v - 0.5) * g.H, cs = Math.cos(g.rot), sn = Math.sin(g.rot);
  return { x: g.cx + lx * cs - ly * sn, y: g.cy + lx * sn + ly * cs };
}
function charHit(c, x, y) {
  const g = charGeo(c), dx = x - g.cx, dy = y - g.cy, cs = Math.cos(-g.rot), sn = Math.sin(-g.rot);
  const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
  return Math.abs(lx) < g.w * 0.36 && Math.abs(ly) < g.H * 0.5;
}
const headR = c => cfgOf(c.ch).H * (cfgOf(c.ch).H < 350 ? 0.1 : 0.085);
function headPts(c) {
  const g = charGeo(c), cf = cfgOf(c.ch), r = headR(c);
  return { eye: charPt(c, g, cf.hx, cf.ey), hat: charPt(c, g, cf.hx, cf.ey - r * 1.25 / g.H), mouth: charPt(c, g, cf.hx, cf.ey + r * 0.65 / g.H), hand: charPt(c, g, 0.5 + 0.46, 0.5), g, r };
}

/* ---------- partiklar och pratbubblor ---------- */
const FX = [];
function puff(x, y, e, n = 6, opts = {}) { for (let i = 0; i < n; i++) FX.push({ x, y, e, vx: (Math.random() - 0.5) * (opts.sp || 300), vy: -100 - Math.random() * (opts.up || 250), life: 0, max: opts.max || 1, s: opts.s || 40, g: opts.g == null ? 300 : opts.g }); }
function say(c, txt) { c.bub = { txt, t: 1.8 }; }

/* ---------- uppdatering ---------- */
let T = 0, radioT = 0, radioN = 0;
function update(dt) {
  T += dt;
  const its = items();
  // föremål som faller
  for (const it of its) {
    if (it.held != null || it.worn != null || it === drag.obj || it.eating) continue;
    const r = (it.s || 70) / 2;
    if (!it.rest) {
      it.vy = (it.vy || 0) + 2600 * dt; it.y += it.vy * dt; it.x += (it.vx || 0) * dt;
      it.x = Math.max(r, Math.min(SCENES[W.cur].w - r, it.x));
      const sy = supportY(it.x, it.y + r - it.vy * dt - 2);
      if (it.y + r >= sy) {
        it.y = sy - r;
        if (it.vy > 700) { it.vy = -it.vy * 0.25; SFX.drop(); } else { it.vy = 0; it.vx = 0; it.rest = true; }
        // rutschkanan: saker åker ner
      }
    } else {
      // står stilla – pets hoppar ibland
      if (PETS.has(it.e) && Math.random() < dt * 0.35) { it.rest = false; it.vy = -650; it.vx = (Math.random() - 0.5) * 380; it.flip = it.vx < 0; }
      const sy = supportY(it.x, it.y + r - 2);
      if (it.y + r < sy - 2) it.rest = false;
    }
    // laga mat på spisen
    const st = FURN.find(f => f.t === 'stove' && f.on && it.x > f.x + 5 && it.x < f.x + 215 && Math.abs(it.y + r - (FLOOR - 230)) < 8);
    if (st && COOK[it.e]) { it.cook = (it.cook || 0) + dt; if (Math.random() < dt * 4) puff(it.x, it.y - 20, '💨', 1, { up: 80, g: -60, s: 34, max: 0.8 }); if (it.cook > 2.5) { it.e = COOK[it.e]; it.cook = 0; SFX.ding(); puff(it.x, it.y, '✨', 6); save(); } }
  }
  // figurer
  for (const c of charsHere()) {
    if (c.bub && (c.bub.t -= dt) <= 0) c.bub = null;
    if (c.jump > 0) c.jump = Math.max(0, c.jump - dt * 3);
    if (c === drag.obj) continue;
    if (c.pose === 'slide') {
      c.slide.p += dt * 0.9;
      if (c.slide.p >= 1) { const f = FURN[c.slide.f]; const p = FT.slide.path(f, 1); c.x = p.x + 40; c.y = p.y; c.pose = 'stand'; c.vy = 0; c.slide = null; c.fall = true; save(); }
      continue;
    }
    if (c.seat) {
      const f = FURN[c.seat[0]], kind = f && FT[f.t].seats[c.seat[1]].kind;
      if (kind === 'lie' && Math.random() < dt * 1.2) { const h = headPts(c); FX.push({ x: h.eye.x, y: h.eye.y - 40, e: 'z', txt: true, vx: 20, vy: -60, life: 0, max: 1.6, s: 36, g: 0 }); }
      if (kind === 'bath' && f.on && Math.random() < dt * 3) { const h = headPts(c); puff(h.eye.x + (Math.random() - 0.5) * 80, h.eye.y - 30, '✨', 1, { up: 60, g: -20, s: 26, max: 0.8 }); }
      continue;
    }
    if (c.fall || c.y < supportY(c.x, c.y - 2) - 1) {
      c.vy = (c.vy || 0) + 2600 * dt; c.y += c.vy * dt;
      const sy = supportY(c.x, c.y - c.vy * dt - 2);
      if (c.y >= sy) { c.y = sy; if (c.vy > 900) SFX.drop(); c.vy = 0; c.fall = false; }
    }
    // ät
    if (c.eat) {
      const it = its.find(i => i.id === c.eat.id);
      if (!it) { c.eat = null; continue; }
      c.eat.t += dt;
      const h = headPts(c); it.x = h.mouth.x + headR(c) * 0.4; it.y = h.mouth.y;
      if (c.eat.t > 0.4 * (c.eat.b + 1)) {
        c.eat.b++; it.s = (it.s || 70) * 0.72;
        DRINK.has(it.e) ? SFX.glug() : SFX.crunch(); buzz(10);
        if (c.eat.b >= 3) { W.sc[W.cur].items = its.filter(i => i !== it); c.eat = null; SFX.yum(); say(c, DRINK.has(it.e) ? 'Glugg! 🥤' : pick(['Mums! 😋', 'Gott! 🤤', 'Nam nam!'])); puff(h.mouth.x, h.mouth.y - 40, '❤️', 4, { s: 30, g: -50, up: 120, max: 1.2 }); save(); }
      }
    }
  }
  // gungor och rutschkanor
  for (const f of FURN) {
    if (f.t === 'swing') { const used = charsHere().some(c => c.seat && c.seat[0] === f.i); f.swT = (f.swT || 0) + dt; f.ang = used ? Math.sin(f.swT * 2.4) * 0.55 : (f.ang || 0) * (1 - dt * 2); }
    if (f.wig > 0) f.wig = Math.max(0, f.wig - dt * 1.5);
    if (f.flushT > 0) f.flushT = Math.max(0, f.flushT - dt * 0.6);
    if (f.t === 'globe' && f.spin > 0) { f.rot = (f.rot || 0) + f.spin * dt; f.spin = Math.max(0, f.spin - dt * 0.8); }
    f.used = (FT[f.t].seats || []).some((_, s) => seatTaken(f.i, s));
  }
  // radion spelar en melodi
  const radio = FURN.find(f => f.t === 'radio' && f.on);
  if (radio && (radioT -= dt) <= 0) { radioT = 0.3; tone(TUNE[radioN++ % TUNE.length], .26, { type: 'triangle', vol: .06 }); }
  for (const p of FX) { p.life += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  for (let i = FX.length - 1; i >= 0; i--) if (FX[i].life > FX[i].max) FX.splice(i, 1);
}

/* ---------- ritning ---------- */
function drawChar(c) {
  const g = charGeo(c), im = IMG[c.ch];
  ctx.save();
  if (c.seat && FURN[c.seat[0]]) { const st = FT[FURN[c.seat[0]].t].seats[c.seat[1]]; if (st.clip != null) { ctx.beginPath(); ctx.rect(-1e4, -1e4, 3e4, 1e4 + FLOOR - st.clip); ctx.clip(); } } ctx.translate(g.cx, g.cy - (c.jump ? Math.sin(c.jump * Math.PI) * 40 : 0)); ctx.rotate(g.rot);
  if (g.kind === 'stand' || g.kind === 'drag' || !g.kind) { ctx.fillStyle = '#00000022'; ctx.beginPath(); ctx.ellipse(0, g.H / 2, g.w * 0.4, 12, 0, 0, TAU); ctx.fill(); }
  if (im.complete && im.naturalWidth) ctx.drawImage(im, -g.w / 2, -g.H / 2, g.w, g.H);
  ctx.restore();
}
function drawWorn(c) {
  const h = headPts(c), its = items();
  for (const it of its) {
    if (it.worn !== c.ch) continue;
    ctx.save();
    if (it.slot === 'hat') { ctx.translate(h.hat.x, h.hat.y); ctx.rotate(h.g.rot); emo(ctx, it.e, 0, 0, h.r * 2.5); }
    else if (it.slot === 'face') { ctx.translate(h.eye.x, h.eye.y); ctx.rotate(h.g.rot); emo(ctx, it.e, 0, 0, h.r * 1.9); }
    else if (it.slot === 'body') { const p = charPt(c, h.g, 0.5 + (it.u || 0), 0.4 + (it.v || 0)); ctx.translate(p.x, p.y); ctx.rotate(h.g.rot + 0.5); emo(ctx, it.e, 0, 0, h.r * 1.3); }
    ctx.restore();
  }
  const held = its.find(it => it.held === c.ch);
  if (held) emo(ctx, held.e, h.hand.x, h.hand.y, held.s || 70);
}
function drawItem(it) {
  if (it.flip) { ctx.save(); ctx.translate(it.x, it.y); ctx.scale(-1, 1); emo(ctx, it.e, 0, 0, it.s || 70); ctx.restore(); }
  else emo(ctx, it.e, it.x, it.y, it.s || 70);
}
function drawPictures(sc) {
  for (const [px, py, ch] of sc.pictures || []) {
    if (ch >= CHARS.length) continue;
    box(ctx, px - 55, py - 65, 110, 130, '#FFD23F', 8);
    ctx.save(); rr(ctx, px - 42, py - 52, 84, 104, 6); ctx.clip();
    const im = FACEIMG[ch]; if (im.complete && im.naturalWidth) ctx.drawImage(im, px - 52, py - 52, 104, 104); ctx.restore();
  }
}
function draw() {
  const sc = SCENES[W.cur];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#2B2350'; ctx.fillRect(0, 0, VW, VH);
  ctx.setTransform(DPR * SC, 0, 0, DPR * SC, -camX() * SC * DPR, -TOPY * SC * DPR);
  const view = { x0: camX(), x1: camX() + VW / SC };
  drawBackdrop(ctx, sc, T, view);
  drawPictures(sc);
  const cs = charsHere();
  const S = { boardImg };
  for (const f of FURN) if (f.x + FT[f.t].w > view.x0 - 50 && f.x < view.x1 + 50) FT[f.t].back(ctx, f, S, T, cs);
  for (const it of items()) if (it.held == null && it.worn == null && it !== drag.obj) drawItem(it);
  const order = cs.filter(c => c !== drag.obj).sort((a, b) => (a.seat ? 1 : 0) - (b.seat ? 1 : 0) || a.y - b.y);
  // figurer som sitter ritas före möblernas framsida, stående efter
  for (const c of order) if (c.seat) { drawChar(c); drawWorn(c); }
  for (const f of FURN) if (FT[f.t].front && f.x + FT[f.t].w > view.x0 - 50 && f.x < view.x1 + 50) FT[f.t].front(ctx, f, S, T, cs);
  for (const c of order) if (!c.seat) { drawChar(c); drawWorn(c); }
  // pratbubblor
  for (const c of cs) if (c.bub) {
    const h = headPts(c), x = h.hat.x, y = h.hat.y - h.r * 1.8;
    ctx.font = 'bold 34px Fredoka, sans-serif'; const tw = ctx.measureText(c.bub.txt).width + 40;
    box(ctx, x - tw / 2, y - 34, tw, 64, '#FFFFFF', 30, 3);
    ctx.beginPath(); ctx.moveTo(x - 12, y + 29); ctx.lineTo(x, y + 48); ctx.lineTo(x + 12, y + 29); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.fillStyle = OL; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(c.bub.txt, x, y);
  }
  // det man drar ritas överst
  if (drag.obj) { if (drag.kind === 'char') { drawChar(drag.obj); drawWorn(drag.obj); } else drawItem(drag.obj); }
  for (const p of FX) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); if (p.txt) { ctx.fillStyle = '#5B4FB0'; ctx.font = `bold ${p.s}px Fredoka, sans-serif`; ctx.fillText('Z', p.x, p.y); } else emo(ctx, p.e, p.x, p.y, p.s); }
  ctx.globalAlpha = 1;
}

/* ---------- dra och släpp ---------- */
const drag = { obj: null, kind: null, ox: 0, oy: 0, sx: 0, sy: 0, t0: 0, moved: false, pan: false, tap: null, draw: null, ext: false };
function itemAt(x, y) {
  const its = items();
  // först saker man har på sig eller håller i (de ligger ovanpå figuren)
  for (const c of charsHere()) {
    const h = headPts(c);
    for (const it of its) {
      if (it.worn === c.ch) { const p = it.slot === 'hat' ? h.hat : it.slot === 'face' ? h.eye : charPt(c, h.g, 0.5 + (it.u || 0), 0.4 + (it.v || 0)); if (Math.hypot(p.x - x, p.y - y) < h.r * 1.1) return it; }
      if (it.held === c.ch && Math.hypot(h.hand.x - x, h.hand.y - y) < 45) return it;
    }
  }
  for (let i = its.length - 1; i >= 0; i--) { const it = its[i]; if (it.held != null || it.worn != null) continue; if (Math.hypot(it.x - x, it.y - y) < (it.s || 70) * 0.6) return it; }
  return null;
}
function charAt(x, y) { const cs = charsHere().sort((a, b) => b.y - a.y); for (const c of cs) if (charHit(c, x, y)) return c; return null; }
function spawnAt(x, y) {
  for (let i = FURN.length - 1; i >= 0; i--) {
    const f = FURN[i], ft = FT[f.t], sp = ft.spawnFor ? ft.spawnFor(f) : ft.spawn;
    if (!sp || (sp.needOpen && !f.open)) continue;
    const top = FLOOR - ft.h;
    for (let k = 0; k < sp.list.length; k++) { const g = grid(sp, k); if (Math.hypot(f.x + g.x - x, top + g.y - y) < g.s * 0.6) return { e: sp.list[k], x: f.x + g.x, y: top + g.y }; }
  }
  return null;
}
function furnAt(x, y) {
  for (let i = FURN.length - 1; i >= 0; i--) {
    const f = FURN[i], ft = FT[f.t];
    if (!ft.tap && !ft.draw) continue;
    const z = ft.zone || [0, ft.w, 0, ft.h];
    if (x >= f.x + z[0] && x <= f.x + z[1] && y <= FLOOR - z[2] && y >= FLOOR - z[3]) return f;
  }
  return null;
}
function startDrag(obj, kind, x, y, ext) {
  drag.obj = obj; drag.kind = kind; drag.moved = !!ext; drag.ext = !!ext;
  if (kind === 'char') {
    if (obj.seat || obj.pose !== 'stand') { const g = charGeo(obj); obj.x = g.cx; obj.y = g.cy + g.H / 2; }
    obj.seat = null; obj.pose = 'drag'; obj.eat = null; obj.slide = null;
    drag.ox = obj.x - x; drag.oy = obj.y - y;
    if (ext) { drag.ox = 0; drag.oy = cfgOf(obj.ch).H * 0.45; }
  } else {
    if (obj.held != null || obj.worn != null) { obj.held = null; obj.worn = null; obj.slot = null; }
    obj.rest = false; obj.vy = 0; obj.vx = 0;
    drag.ox = obj.x - x; drag.oy = obj.y - y;
    if (ext) { drag.ox = 0; drag.oy = 0; }
    $('trash').classList.add('on');
  }
  SFX.pick(); buzz(8);
}
cv.addEventListener('pointerdown', e => {
  ac();
  if (drag.obj || drag.pan) return;
  try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  const p = toWorld(e.clientX, e.clientY);
  drag.sx = e.clientX; drag.sy = e.clientY; drag.t0 = performance.now(); drag.moved = false; drag.tap = null; drag.pid = e.pointerId; drag.lastX = e.clientX;
  // tavlan
  const board = FURN.find(f => f.t === 'board');
  if (board) {
    const bx = p.x - board.x - 20, by = p.y - (FLOOR - 640) - 20;
    if (bx > 740 && bx < 850 && by > 352 && by < 382) { boardCtx.clearRect(0, 0, 880, 360); store.del('board'); SFX.leaves(); return; }
    for (let k = 0; k < 4; k++) if (Math.abs(bx - (58 + k * 50)) < 22 && by > 355 && by < 375) { drag.chalk = ['#fff', '#FFD23F', '#FF6FAE', '#7FD1FF'][k]; SFX.click(); return; }
    if (bx > 0 && bx < 880 && by > 0 && by < 360 && !itemAt(p.x, p.y) && !charAt(p.x, p.y)) { drag.draw = { x: bx, y: by }; return; }
  }
  const it = itemAt(p.x, p.y);
  if (it) { startDrag(it, 'item', p.x, p.y); drag.tapItem = it; drag.moved = false; return; }
  const c = charAt(p.x, p.y);
  if (c) { startDrag(c, 'char', p.x, p.y); drag.tapChar = c; drag.moved = false; return; }
  const sp = spawnAt(p.x, p.y);
  if (sp) { const ni = { id: nextId++, e: sp.e, x: sp.x, y: sp.y }; items().push(ni); startDrag(ni, 'item', p.x, p.y); drag.moved = true; return; }
  const f = furnAt(p.x, p.y);
  if (f) drag.tap = f;
  drag.pan = true; drag.cam0 = camX();
});
addEventListener('pointermove', e => {
  if (drag.draw) {
    const board = FURN.find(f => f.t === 'board'); const p = toWorld(e.clientX, e.clientY);
    const bx = p.x - board.x - 20, by = p.y - (FLOOR - 640) - 20;
    boardCtx.strokeStyle = drag.chalk || '#fff'; boardCtx.lineWidth = 7; boardCtx.lineCap = 'round';
    boardCtx.beginPath(); boardCtx.moveTo(drag.draw.x, drag.draw.y); boardCtx.lineTo(bx, by); boardCtx.stroke();
    drag.draw = { x: bx, y: by }; return;
  }
  if (!drag.obj && !drag.pan) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 10) drag.moved = true;
  if (drag.pan) { if (drag.moved) { W.cam[W.cur] = drag.cam0 - (e.clientX - drag.sx) / SC; clampCam(); } return; }
  const p = toWorld(e.clientX, e.clientY);
  // dra mot kanten: kameran följer med
  if (e.clientX < 60) W.cam[W.cur] = camX() - 12 / SC; else if (e.clientX > VW - 60) W.cam[W.cur] = camX() + 12 / SC;
  clampCam();
  const o = drag.obj;
  if (drag.kind === 'char') { o.dvx = (e.clientX - (drag.lastX || e.clientX)) * 60; drag.lastX = e.clientX; o.x = p.x + drag.ox; o.y = Math.min(FLOOR, p.y + drag.oy); }
  else { o.x = p.x + drag.ox; o.y = p.y + drag.oy; }
  const tr = $('trash').getBoundingClientRect();
  $('trash').classList.toggle('hot', drag.kind === 'item' && e.clientX > tr.left && e.clientX < tr.right && e.clientY > tr.top && e.clientY < tr.bottom);
  const bg = $('bBag').getBoundingClientRect();
  $('bBag').classList.toggle('hot', drag.kind === 'item' && e.clientX > bg.left && e.clientX < bg.right && e.clientY > bg.top && e.clientY < bg.bottom);
});
addEventListener('pointerup', e => endDrag(e));
addEventListener('pointercancel', e => endDrag(e));
function endDrag(e) {
  if (drag.draw) { drag.draw = null; try { store.set('board', boardCv.toDataURL('image/png')); } catch (er) { } return; }
  const quick = !drag.moved && performance.now() - drag.t0 < 400;
  if (drag.pan) {
    drag.pan = false;
    if (quick && drag.tap) tapFurn(drag.tap);
    drag.tap = null; save(); return;
  }
  const o = drag.obj; if (!o) return;
  drag.obj = null;
  $('trash').classList.remove('on', 'hot'); $('bBag').classList.remove('hot');
  if (drag.kind === 'char') {
    o.pose = 'stand'; o.dvx = 0;
    if (quick && !drag.ext) { tapChar(o); o.fall = true; save(); return; }
    dropChar(o);
  } else {
    const tr = $('trash').getBoundingClientRect(), bg = $('bBag').getBoundingClientRect();
    const inR = r => e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
    if (inR(tr)) { W.sc[W.cur].items = items().filter(i => i !== o); SFX.zap(); save(); return; }
    if (inR(bg)) { W.sc[W.cur].items = items().filter(i => i !== o); W.bag.push(o.e); SFX.pick(); updBag(); save(); return; }
    if (quick && !drag.ext) { tapItem(o); o.rest = false; save(); return; }
    dropItem(o);
  }
  save();
}

/* ---------- vad händer när man släpper ---------- */
function dropChar(c) {
  // sittplatser
  for (const f of FURN) {
    const ft = FT[f.t];
    (ft.seats || []).forEach((st, s) => {
      if (c.seat) return;
      const sp = seatPos(f, s), feetY = c.y;
      const near = st.kind === 'lie' ? (Math.abs(c.x - sp.x) < 200 && feetY > sp.y - 60 && feetY < FLOOR + 10 && c.y - cfgOf(c.ch).H < sp.y)
        : (Math.abs(c.x - sp.x) < 75 && feetY > sp.y - 40 && feetY < sp.y + cfgOf(c.ch).H * 0.7);
      if (near && !seatTaken(f.i, s)) {
        c.seat = [f.i, s]; c.pose = 'sit';
        if (st.kind === 'lie') { say(c, pick(['God natt 😴', 'Zzz…', 'Så mysigt!'])); }
        if (st.kind === 'swing') say(c, 'Wiii! 🤩');
        if (st.kind === 'bath') { say(c, 'Plask! 🛁'); SFX.water(); }
        SFX.drop();
      }
    });
    if (c.seat) return;
    // rutschkanan: släpp högt uppe vid stegen
    if (f.t === 'slide' && c.x > f.x - 30 && c.x < f.x + 230 && c.y < FLOOR - 120) { c.pose = 'slide'; c.slide = { f: f.i, p: 0 }; SFX.whee(); say(c, 'Wiiiii!'); return; }
  }
  c.fall = true; c.vy = 0;
  c.x = Math.max(60, Math.min(SCENES[W.cur].w - 60, c.x));
  SFX.drop();
}
function dropItem(it) {
  const r = (it.s || 70) / 2;
  for (const c of charsHere()) {
    const h = headPts(c);
    if (EAT.has(it.e) && Math.hypot(it.x - h.mouth.x, it.y - h.mouth.y) < h.r * 1.7 && !c.eat && !(c.seat && FT[FURN[c.seat[0]].t].seats[c.seat[1]].kind === 'lie')) {
      c.eat = { id: it.id, t: 0, b: 0 }; it.eating = true; return;
    }
    if (HAT.has(it.e) && Math.hypot(it.x - h.hat.x, it.y - h.hat.y) < h.r * 1.8) { wear(c, it, 'hat'); return; }
    if (FACE.has(it.e) && Math.hypot(it.x - h.eye.x, it.y - h.eye.y) < h.r * 1.6) { wear(c, it, 'face'); return; }
    if (charHit(c, it.x, it.y)) {
      if (STICK.has(it.e)) { it.u = (Math.random() - 0.5) * 0.3; it.v = Math.random() * 0.3; wear(c, it, 'body', true); say(c, 'Tack! 🥰'); return; }
      if (HAT.has(it.e) || FACE.has(it.e)) { wear(c, it, HAT.has(it.e) ? 'hat' : 'face'); return; }
      for (const o of items()) if (o.held === c.ch) { o.held = null; o.rest = false; o.x = h.hand.x + 40; }
      it.held = c.ch; SFX.pick(); return;
    }
  }
  it.rest = false; it.vy = 0;
  if (PETS.has(it.e) && Math.random() < 0.5) PLAY[it.e] && PLAY[it.e]();
}
function wear(c, it, slot, keep) {
  if (!keep) for (const o of items()) if (o.worn === c.ch && o.slot === slot) { o.worn = null; o.rest = false; o.x = c.x + 80; o.y = c.y - cfgOf(c.ch).H; }
  it.worn = c.ch; it.slot = slot; SFX.giggle(); puff(it.x, it.y, '✨', 5, { s: 28, max: 0.7 });
  if (!keep) say(c, pick(['Snyggt! 😎', 'Ooo! 🤩', 'Fin! 💖', 'Ha ha! 😄']));
}
const REACT = ['😀', '😂', '🥰', '😜', '🤩', '😎', '👋', '❤️', '🎵', 'Hej!', 'Hihi!', '🤗'];
function tapChar(c) {
  c.jump = 1; SFX.giggle(); buzz(10);
  if (c.seat) { const f = FURN[c.seat[0]], k = FT[f.t].seats[c.seat[1]].kind; if (k === 'lie') { say(c, 'God morgon! ☀️'); return; } }
  say(c, pick(REACT.concat([charName(c.ch) + '!'])));
}
function tapItem(it) {
  if (PLAY[it.e]) { PLAY[it.e](); puff(it.x, it.y - 40, '🎵', 2, { s: 30, g: -40, up: 80 }); }
  else if (it.e === '🎁') { const e = pick([...LISTS.toys, ...LISTS.acc]); it.e = e; SFX.win(); puff(it.x, it.y, '🎉', 8); }
  else if (it.e === '🎈') { it.vy = -900; it.rest = false; }
  else { SFX.click(); it.vy = -500; it.rest = false; }
}
function tapFurn(f) {
  const ft = FT[f.t];
  const snd = ft.snd && SFX[ft.snd];
  if (ft.tap === 'toggle') { f.on = !f.on; snd && snd(); if (f.t === 'tv' && f.on) SFX.tv(); saveF(f); }
  else if (ft.tap === 'open') { f.open = !f.open; snd && snd(); saveF(f); }
  else if (ft.tap === 'flush') { f.flushT = 1; SFX.flush(); }
  else if (ft.tap === 'wiggle') { f.wig = 1; SFX.leaves(); }
  else if (ft.tap === 'shake') { f.wig = 1; SFX.leaves(); items().push({ id: nextId++, e: '🍎', x: f.x + 60 + Math.random() * 200, y: FLOOR - 450, vx: (Math.random() - 0.5) * 200 }); save(); }
  else if (ft.tap === 'kaching') { f.sum = (f.sum || 0) + 5 * (1 + Math.floor(Math.random() * 10)); SFX.kaching(); puff(f.x + 300, FLOOR - 320, '🪙', 5, { s: 34 }); saveF(f); }
  else if (ft.tap === 'spin') { f.spin = 3; SFX.click(); saveF(f); }
}

/* ---------- figurlåda, väska och karta ---------- */
function buildFigs() {
  $('figs').innerHTML = CHARS.map((_, i) => { const c = W.chars[i]; const here = c && c.sc === W.cur;
    return `<button class="fig ${here ? 'here' : ''}" data-ch="${i}" style="${styleOf(i)}">${avHTML(i)}<small>${here ? '' : SCENES[c.sc].icon}</small></button>`; }).join('');
  $('figs').querySelectorAll('.fig').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault();
    const ch = +b.dataset.ch, c = W.chars[ch];
    if (c.sc !== W.cur) { // flytta hit med det man har på sig och håller i
      const from = W.sc[c.sc], carry = from.items.filter(it => it.worn === ch || it.held === ch);
      from.items = from.items.filter(it => !carry.includes(it)); items().push(...carry);
      c.sc = W.cur;
    }
    const p = toWorld(e.clientX, e.clientY);
    c.x = p.x; c.y = p.y + cfgOf(ch).H * 0.45; c.seat = null;
    startDrag(c, 'char', p.x, p.y, true);
    closeTray();
  }));
}
function updBag() { $('bagN').textContent = W.bag.length || ''; }
function buildBag() {
  $('bagItems').innerHTML = W.bag.length ? W.bag.map((e, i) => `<button class="bi" data-i="${i}">${e}</button>`).join('') : '<p class="note">Släpp saker på 🎒 för att ta med dem till andra platser.</p>';
  $('bagItems').querySelectorAll('.bi').forEach(b => b.addEventListener('pointerdown', e => {
    e.preventDefault();
    const e2 = W.bag.splice(+b.dataset.i, 1)[0]; updBag();
    const p = toWorld(e.clientX, e.clientY);
    const it = { id: nextId++, e: e2, x: p.x, y: p.y }; items().push(it);
    startDrag(it, 'item', p.x, p.y, true); closeTray();
  }));
}
function openTray(id) { closeTray(); $(id).classList.add('on'); if (id === 'trayFigs') buildFigs(); if (id === 'trayBag') buildBag(); }
function closeTray() { document.querySelectorAll('.tray').forEach(t => t.classList.remove('on')); }
$('bFigs').onclick = () => { SFX.tap(); $('trayFigs').classList.contains('on') ? closeTray() : openTray('trayFigs'); };
$('bBag').onclick = () => { SFX.tap(); $('trayBag').classList.contains('on') ? closeTray() : openTray('trayBag'); };
function buildMap() {
  $('mapBox').innerHTML = Object.entries(SCENES).map(([id, s]) => {
    const who = Object.values(W.chars).filter(c => c.sc === id);
    return `<button class="place ${id === W.cur ? 'cur' : ''}" data-id="${id}"><span class="pi">${s.icon}</span><b>${s.name}</b>
      <span class="who">${who.map(c => avHTML(c.ch)).join('')}</span></button>`;
  }).join('');
  $('mapBox').querySelectorAll('.place').forEach(b => b.onclick = () => { SFX.pick(); goScene(b.dataset.id); $('map').classList.remove('on'); });
}
$('bMap').onclick = () => { SFX.tap(); closeTray(); buildMap(); $('map').classList.add('on'); };
$('mapClose').onclick = () => { SFX.tap(); $('map').classList.remove('on'); };
function goScene(id) {
  W.cur = id; buildFurn(); clampCam(); $('place').textContent = SCENES[id].icon + ' ' + SCENES[id].name; save();
  const sc = $('cv'); sc.classList.remove('fadein'); void sc.offsetWidth; sc.classList.add('fadein');
}
$('bHome').onclick = () => { SFX.tap(); try { store.set('world', W); } catch (e) { } goHub(); };
$('bReset').onclick = () => {
  SFX.tap();
  $('panel').innerHTML = `<h3>Städa ${esc(SCENES[W.cur].name)}?</h3><p>Alla saker som ligger framme här försvinner. Figurerna stannar kvar.</p>
    <button class="btn pink" id="pYes">🧹 Städa</button><button class="btn white small" id="pAll">↺ Börja om hela staden</button><button class="btn white small" id="pNo">Avbryt</button>`;
  $('overlay').classList.add('on');
  $('pYes').onclick = () => { W.sc[W.cur].items = items().filter(it => it.worn != null || it.held != null); SFX.leaves(); save(); $('overlay').classList.remove('on'); };
  $('pAll').onclick = () => { W = freshWorld(); store.del('board'); goScene('hem'); $('overlay').classList.remove('on'); };
  $('pNo').onclick = () => $('overlay').classList.remove('on');
};

/* ---------- start ---------- */
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
}
window.onBack = () => {
  if ($('overlay').classList.contains('on')) { $('overlay').classList.remove('on'); return true; }
  if ($('map').classList.contains('on')) { $('map').classList.remove('on'); return true; }
  if (document.querySelector('.tray.on')) { closeTray(); return true; }
  try { store.set('world', W); } catch (e) { } goHub(); return true;
};
load(); resize(); buildFurn(); clampCam(); updBag();
$('place').textContent = SCENES[W.cur].icon + ' ' + SCENES[W.cur].name;
if (!store.get('seenHelp', false)) { $('help').classList.add('on'); }
$('helpOk').onclick = () => { SFX.tap(); store.set('seenHelp', true); $('help').classList.remove('on'); };
requestAnimationFrame(frame);
