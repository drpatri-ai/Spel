/* Bucinca Tornet – en kran svänger våningar fram och tillbaka. Tryck för att släppa.
   Ju sämre du träffar, desto mer vinglar tornet – och till slut rasar det.
   Världen mäts i "rutor": våningen är BW bred och BH hög, marken ligger på y = 0. */
'use strict';
const store = makeStore('bt');
const BW = 3.2, BH = 1.45;
const FLOOR_COLS = ['#FFB3C7', '#B3E5FF', '#C9F2B3', '#FFE3A3', '#D9C7FF', '#FFC9A8'];
const ROOF_COLS = ['#FF6FAE', '#3B9DFF', '#34C759', '#F5B400', '#8B7BFF', '#FF8A3D'];

const SFX = Object.assign({}, CORE_SFX, {
  drop: () => tone(500, .18, { to: 220, vol: .08 }),
  land: () => { tone(160, .14, { to: 80, vol: .35 }); noise(.08, { f: 400, vol: .2 }); },
  perfect: c => [784, 988, 1175, 1568].slice(0, 2 + Math.min(2, c)).forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .13, delay: i * .06 })),
  creak: () => tone(90 + Math.random() * 40, .5, { to: 70, type: 'sawtooth', vol: .04 }),
  miss: () => { tone(400, .4, { to: 90, vol: .15 }); },
  crash: () => { noise(.9, { f: 300, vol: .55, q: .4, type: 'lowpass' }); tone(90, .8, { to: 40, type: 'sawtooth', vol: .1 }); },
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, .3, { vol: .14, delay: i * .17 }))
});

let me = store.get('char', 3);
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id !== 'game') stop();
  if (id === 'menu') buildMenu();
  if (id === 'select') buildSelect();
}
function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Tornet 🏢', 'l2');
  const best = store.get('best', 0), pop = store.get('bestPop', 0);
  $('menuBest').textContent = best ? `🏢 Rekord: ${best} våningar · 👥 ${pop} invånare` : 'Släpp våningarna rakt – annars vinglar tornet och rasar!';
  $('me').setAttribute('style', styleOf(me));
  $('me').innerHTML = `${avHTML(me)}<div><small>Kranförare</small><b>${esc(charName(me))}</b></div>`;
}
function buildSelect() {
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === me ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    me = +el.dataset.i; store.set('char', me); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(() => show('menu'), 300);
  });
}

/* ---------- canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 1, H = 1, DPR = 1, raf = 0, last = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = cv.clientWidth || 1; H = cv.clientHeight || 1;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const r = $('hCombo').getBoundingClientRect();
  hudBottom = r.bottom || 0;
}
window.addEventListener('resize', () => { if (current === 'game') resize(); });

const faces = [];   // bilder till fönstren
function loadFaces() { faces.length = 0; CHARS.forEach((_, i) => { const im = new Image(); im.src = avatarSrc(i); faces.push(im); }); }
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------- spelets tillstånd ---------- */
let T = null;
function newGame() {
  T = {
    floors: [],          // { x, col, face, people }
    phase: 'swing', t: 0, swingT: 0,
    block: null,         // fallande våning { x, y, vx, vy, rot, vr }
    falling: [],         // våningar som ramlar (miss eller ras)
    lives: 3, combo: 0, people: 0, perfects: 0,
    phi: 0, phiV: 0,     // tornets svaj (vinkel)
    camY: 0, camX: 0, shake: 0,
    texts: [], parts: [],
    over: false, settle: 0, creakT: 0
  };
}
const n = () => T.floors.length;
const s = () => Math.min(W / 8.2, H / 13.5);
// kranens bom ligger alltid under siffrorna högst upp
let hudBottom = 0;
const pivotSY = () => Math.max(H * 0.21, 128, hudBottom + 14 + 0.5 * s());
const SX = x => W / 2 + (x - T.camX) * s();
const SY = y => H * 0.9 - (y - T.camY) * s() + T.shakeY;

// svajets förskjutning på höjden y
const swayAt = y => Math.sin(T.phi) * y;
const topY = () => n() * BH;
const topX = () => (n() ? T.floors[n() - 1].x : 0) + swayAt(topY());

/* kranen */
function swingParams() {
  const k = n();
  return { A: Math.min(0.8, 0.32 + k * 0.014), w: Math.min(3.9, 2.0 + k * 0.045) };
}
function pivot() { return { x: T.camX * 0.3, y: T.camY + (H * 0.9 - pivotSY()) / s() }; }
function hookPos() {
  const p = pivot(), { A, w } = swingParams();
  const th = A * Math.sin(T.swingT * w);
  const L = Math.min(5.5, Math.max(3.2, p.y - (topY() + 2.6 + BH)));
  const dth = A * w * Math.cos(T.swingT * w);
  return { x: p.x + L * Math.sin(th), y: p.y - L * Math.cos(th), th, vx: L * dth * Math.cos(th), vy: L * dth * Math.sin(th) };
}

/* ---------- indata ---------- */
cv.addEventListener('pointerdown', () => {
  if (!T || T.over || current !== 'game') return;
  ac();
  if (T.phase !== 'swing') return;
  const h = hookPos();
  T.block = { x: h.x, y: h.y - BH, vx: h.vx * 0.6, vy: 0, rot: h.th * 0.3, vr: 0 };
  T.phase = 'drop';
  SFX.drop();
  $('tapHint').classList.add('hidden');
});

/* ---------- logik ---------- */
const PRAISE = ['Perfekt!', 'PERFEKT! x2', 'SUPERPERFEKT!', 'MÄSTARE! 🏆'];
function land() {
  const b = T.block, k = n();
  const tx = topX();
  const dx = b.x - tx;
  const limit = k === 0 ? BW * 0.9 : BW * 0.72;
  if (Math.abs(dx) > limit) {          // missar – våningen ramlar av
    T.falling.push({ x: b.x, y: b.y, vx: Math.sign(dx || 1) * 3 + b.vx * 0.3, vy: 2, rot: 0, vr: Math.sign(dx || 1) * 3, col: FLOOR_COLS[k % FLOOR_COLS.length], face: k % 4, k });
    T.block = null;
    T.lives--;
    T.combo = 0;
    say(b.x, b.y + BH * 2, 'Miss!', '#FF4D6D');
    SFX.miss(); buzz(60);
    T.phase = T.lives <= 0 ? 'lost' : 'settle'; T.settle = 0.7;
    if (T.lives <= 0) gameOver('lives');
    updateHud();
    return;
  }
  const baseX = k ? T.floors[k - 1].x : 0;
  let rel = dx;
  const perfect = Math.abs(dx) < BW * 0.09;
  if (perfect) {
    rel = 0;
    T.combo++; T.perfects++;
    T.phiV *= 0.4; T.phi *= 0.6;           // perfekt landning lugnar tornet
    say(tx, topY() + BH * 1.8, PRAISE[Math.min(3, T.combo - 1)], '#FFD23F');
    SFX.perfect(T.combo); buzz(30);
    burst(SXw(tx), topY() + BH, ['#FFD23F', '#fff'], 16);
    if (T.combo >= 3) cheer(pick(['Perfekt! 🤩', 'Vilken precision!', 'Rakt som ett streck!']));
  } else {
    T.combo = 0;
    SFX.land(); buzz(18);
    if (Math.abs(dx) > BW * 0.35) { say(tx, topY() + BH * 1.8, pick(['Oj, det vinglar!', 'Hoppsan!', 'Nära ögat!']), '#fff'); cheer(pick(['Försiktigt! 😬', 'Det gungar!', 'Oj oj oj…'])); }
  }
  const people = perfect ? 12 + T.combo * 4 : Math.max(2, Math.round(10 - Math.abs(dx) * 3));
  T.floors.push({ x: baseX + rel - swayAt(topY()) + swayAt(topY()), col: FLOOR_COLS[k % FLOOR_COLS.length], face: (k + me) % 4, people, win: hash(k) });
  // floor.x lagras i tornets egna koordinater (utan svaj)
  T.floors[k].x = baseX + rel;
  T.people += people;
  // stöten får tornet att svaja – mer ju högre det är och ju längre från mitten
  T.phiV += (dx / BW) * 0.22 / (1 + k * 0.03) + b.vx * 0.004;
  T.block = null;
  T.phase = 'settle'; T.settle = 0.35;
  burst(SXw(tx), topY(), ['#fff', '#E5D3B3'], 8);
  if (unstableFrom() >= 0) { collapse(unstableFrom()); return; }
  updateHud();
  if (n() % 10 === 0) cheer(pick([`${n()} våningar! 🎉`, 'Vilket torn!', 'Högre, högre!']));
}
const SXw = x => x;   // markör: världskoordinat (för läsbarhet)

// Tornet rasar om tyngdpunkten ovanför någon våning hamnar utanför den våningen
function unstableFrom() {
  const f = T.floors;
  for (let k = 0; k < f.length - 1; k++) {
    let sum = 0, cnt = 0;
    for (let j = k + 1; j < f.length; j++) { sum += f[j].x; cnt++; }
    const com = sum / cnt;
    if (Math.abs(com - f[k].x) > BW * 0.52) return k + 1;
  }
  // svajar toppen för långt ut rasar det också
  if (Math.abs(swayAt(topY())) > BW * 1.35 && f.length > 4) return Math.max(1, Math.floor(f.length * 0.5));
  return -1;
}
function collapse(from) {
  T.phase = 'collapse';
  const dir = Math.sign(T.phi || (T.floors[n() - 1].x - T.floors[0].x) || 1);
  const fall = T.floors.splice(from);
  fall.forEach((f, i) => {
    const y = (from + i) * BH;
    T.falling.push({ x: f.x + swayAt(y), y, vx: dir * (2 + i * 0.6) + (Math.random() - .5) * 2, vy: 3 + Math.random() * 3, rot: T.phi, vr: dir * (1 + Math.random() * 2.5), col: f.col, face: f.face, k: from + i });
  });
  T.shake = 1.2;
  SFX.crash(); buzz(200);
  say(T.camX, topY() + BH * 3, 'RAS! 💥', '#FF4D6D');
  cheer(pick(['Neeej! 😱', 'Det rasade!', 'Ajajaj!']));
  updateHud();
  setTimeout(() => gameOver('collapse'), 1900);
}

let ended = false;
async function gameOver(why) {
  if (!T || T.over) return;
  T.over = true;
  const floorsNow = why === 'collapse' ? T.maxFloors : n();
  await wait(why === 'lives' ? 1200 : 200);
  SFX.lose();
  const best = store.get('best', 0), isNew = floorsNow > best;
  store.set('games', store.get('games', 0) + 1);
  if (T.people > store.get('bestPop', 0)) store.set('bestPop', T.people);
  if (isNew) { store.set('best', floorsNow); await celebrate(me, 'Nytt rekord!', floorsNow + ' våningar 🏢', ['⭐', '🏢', '✨', '🏆', '🌟', '🎊', '🏗️', '⭐']); }
  const reason = why === 'collapse' ? 'Tornet rasade! 💥' : 'Tre missar – kranen är trött!';
  openPanel(`<div class="win-av" style="width:min(36vw,140px)">${isNew ? '<div class="crown">👑</div>' : ''}${avHTML(me)}</div>
    <h3>${isNew ? 'Nytt rekord! 🎉' : reason}</h3>
    <p>🏢 ${floorsNow} våningar · 👥 ${T.people} invånare · ⭐ ${T.perfects} perfekta</p>
    <p>${isNew ? reason : 'Rekord: ' + Math.max(best, floorsNow) + ' våningar'}</p>
    <button class="btn" id="again">🔁 Bygg igen</button><button class="btn white" id="toMenu">🏠 Meny</button>`);
  $('again').onclick = () => { SFX.tap(); closePanel(); startGame(); };
  $('toMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
}

/* ---------- effekter ---------- */
function say(x, y, txt, c) { T.texts.push({ x, y, txt, c, life: 0 }); }
function burst(x, y, cols, cnt) {
  for (let i = 0; i < cnt; i++) {
    const a = Math.random() * Math.PI, v = 2 + Math.random() * 4;
    T.parts.push({ x: x + (Math.random() - .5) * BW, y, vx: Math.cos(a) * v * (Math.random() < .5 ? -1 : 1), vy: Math.sin(a) * v, life: 0, max: .6 + Math.random() * .4, c: pick(cols), r: .08 + Math.random() * .1 });
  }
}
function cheer(text) { T.cheer = { text, life: 0 }; }

/* ---------- uppdatering ---------- */
function step(dt) {
  T.t += dt;
  const k = n();
  T.maxFloors = Math.max(T.maxFloors || 0, k);
  if (T.phase === 'swing') T.swingT += dt;
  // svajet: fjäder + vind som växer med höjden
  const K = 7 / (1 + k * 0.05), D = 0.9;
  const wind = 0.0005 * k * Math.sin(T.t * (0.9 + k * 0.01)) + 0.00025 * k * Math.sin(T.t * 2.3 + 1);
  T.phiV += (-K * T.phi - D * T.phiV + wind * 8) * dt;
  T.phi += T.phiV * dt;
  T.phi = Math.max(-0.3, Math.min(0.3, T.phi));
  if (k > 6 && Math.abs(T.phiV) > 0.05) { T.creakT -= dt; if (T.creakT <= 0) { SFX.creak(); T.creakT = 1.2 + Math.random(); } }
  if (T.phase !== 'collapse' && !T.over && k > 1 && unstableFrom() >= 0) collapse(unstableFrom());

  if (T.phase === 'drop' && T.block) {
    const b = T.block;
    b.vy -= 32 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
    b.rot *= 0.92;
    if (b.y <= topY()) { b.y = topY(); land(); }
  }
  if (T.phase === 'settle') { T.settle -= dt; if (T.settle <= 0) T.phase = 'swing'; }
  for (const f of T.falling) { f.vy -= 30 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt; }
  T.falling = T.falling.filter(f => f.y > T.camY - 30);
  for (const p of T.parts) { p.life += dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  T.parts = T.parts.filter(p => p.life < p.max);
  for (const t of T.texts) { t.life += dt; t.y += dt * 1.4; }
  T.texts = T.texts.filter(t => t.life < 1.2);
  if (T.cheer) { T.cheer.life += dt; if (T.cheer.life > 1.8) T.cheer = null; }
  // kameran följer toppen
  // tornets topp hamnar en bit under kroken så att våningen faller en kort sträcka
  const target = Math.max(0, topY() - (H * 0.9 - (pivotSY() + 6.55 * s())) / s());
  T.camY += (target - T.camY) * Math.min(1, dt * 2.5);
  T.camX += ((n() ? T.floors[n() - 1].x * 0.5 : 0) - T.camX) * Math.min(1, dt * 1.5);
  T.shake = Math.max(0, T.shake - dt);
  T.shakeY = T.shake > 0 ? Math.sin(T.t * 60) * T.shake * 8 : 0;
}

/* ---------- ritning ---------- */
function lerpC(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * t, g2 = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t, b2 = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
  return `rgb(${r | 0},${g2 | 0},${b2 | 0})`;
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function drawSky() {
  const h = T.camY, t1 = Math.min(1, h / 45), t2 = Math.min(1, Math.max(0, (h - 45) / 50));
  const top = t2 > 0 ? lerpC('#FF8FB1', '#1B1F5E', t2) : lerpC('#7FD1FF', '#FF8FB1', t1);
  const bot = t2 > 0 ? lerpC('#FFC9A8', '#4A3C8C', t2) : lerpC('#DDF4FF', '#FFC9A8', t1);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (t2 > 0.2) {
    ctx.fillStyle = `rgba(255,255,255,${(t2 - 0.2) * 1.2})`;
    for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.arc(hash(i) * W, (hash(i + 7) * H * 1.5 + h * 3) % H, 1 + hash(i + 3) * 1.5, 0, 7); ctx.fill(); }
  }
  // moln
  ctx.fillStyle = '#ffffffb8';
  for (let i = 0; i < 9; i++) {
    const cy = 6 + i * 11 + hash(i) * 6, cx = ((hash(i + 2) * 30 + T.t * (0.3 + hash(i) * 0.5)) % 30) - 15;
    const x = SX(cx), y = SY(cy), r = s() * (0.8 + hash(i + 5));
    if (y < -60 || y > H + 60) continue;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r * 1.1, y - r * .4, r * 1.2, 0, 7); ctx.arc(x + r * 2.2, y, r * .9, 0, 7); ctx.rect(x, y - r * .2, r * 2.2, r); ctx.fill();
  }
}
function drawCity() {
  const gy = SY(0);
  if (gy > H + 200) return;
  // stadssiluett i bakgrunden
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? '#C9B3E8' : '#E2D3F5';
    const f = layer ? 0.5 : 0.25;
    for (let i = -12; i < 12; i++) {
      const bw = (1.6 + hash(i + layer * 50) * 1.6) * s(), bh = (2 + hash(i + 9 + layer * 50) * (layer ? 6 : 9)) * s();
      const x = W / 2 + i * 2.6 * s() - T.camX * s() * f;
      ctx.fillRect(x, gy - bh, bw, bh);
    }
  }
  ctx.fillStyle = '#5BC85B'; ctx.fillRect(0, gy, W, H - gy + 10);
  ctx.fillStyle = '#7BE07B'; ctx.fillRect(0, gy, W, Math.max(4, s() * 0.15));
  // grund
  const fx = SX(-BW * 0.65), fw = BW * 1.3 * s();
  ctx.fillStyle = '#9C9AB0'; rr(fx, gy - s() * 0.3, fw, s() * 0.4, 6); ctx.fill();
}
function drawFloor(x, yBottom, rot, col, face, k, alpha) {
  const sc = s(), w = BW * sc, h = BH * sc;
  ctx.save();
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.translate(SX(x), SY(yBottom + BH / 2));
  ctx.rotate(-rot);
  // vägg
  ctx.fillStyle = col; rr(-w / 2, -h / 2, w, h, sc * 0.12); ctx.fill();
  ctx.lineWidth = Math.max(2, sc * 0.06); ctx.strokeStyle = '#2B235055'; ctx.stroke();
  // takkant
  ctx.fillStyle = ROOF_COLS[k % ROOF_COLS.length]; ctx.fillRect(-w / 2 - sc * 0.08, -h / 2, w + sc * 0.16, sc * 0.16);
  // fönster: tre per våning, ett med en figur som vinkar
  const ww = w * 0.2, wh = h * 0.46, wy = -h * 0.18;
  for (let i = 0; i < 3; i++) {
    const wx = -w * 0.36 + i * w * 0.36 - ww / 2;
    ctx.fillStyle = k === 0 && i === 1 ? '#7A4A26' : '#2B3A67';
    if (k === 0 && i === 1) { rr(wx, -h * 0.25, ww, h * 0.68, sc * 0.05); ctx.fill(); continue; } // dörr på bottenvåningen
    rr(wx, wy - wh / 2, ww, wh, sc * 0.05); ctx.fill();
    const im = faces[face];
    if (i === (k % 3) && im && im.complete && im.naturalWidth) {
      ctx.save(); rr(wx, wy - wh / 2, ww, wh, sc * 0.05); ctx.clip();
      const m = Math.min(im.naturalWidth, im.naturalHeight);
      ctx.drawImage(im, (im.naturalWidth - m) / 2, 0, m, m, wx - ww * 0.1, wy - wh / 2 + wh * 0.05, ww * 1.2, ww * 1.2);
      ctx.restore();
    } else {
      ctx.fillStyle = (T.camY > 40 || hash(k * 3 + i) < 0.35) ? '#FFE48A' : '#9FD8FF';
      rr(wx + ww * 0.12, wy - wh / 2 + wh * 0.1, ww * 0.76, wh * 0.8, sc * 0.03); ctx.fill();
    }
    ctx.fillStyle = '#fff'; ctx.fillRect(wx - sc * 0.04, wy + wh / 2 - sc * 0.02, ww + sc * 0.08, sc * 0.08); // fönsterbräda
  }
  // blomlåda
  if (k % 2 === 1) { ctx.fillStyle = '#34C759'; ctx.fillRect(-w * 0.36 - ww * 0.6, wy + wh / 2, ww * 1.2, sc * 0.1); }
  ctx.restore();
}
function drawTower() {
  T.floors.forEach((f, k) => {
    const y = k * BH;
    drawFloor(f.x + swayAt(y + BH / 2), y, T.phi, f.col, f.face, k);
  });
}
function drawCrane() {
  const p = pivot(), sc = s();
  const py = SY(p.y), px = SX(p.x);
  // bom över skärmen
  ctx.fillStyle = '#F5B400'; ctx.fillRect(0, py - sc * 0.5, W, sc * 0.32);
  ctx.strokeStyle = '#C98F00'; ctx.lineWidth = 2;
  for (let x = -40; x < W + 40; x += sc * 0.6) { ctx.beginPath(); ctx.moveTo(x, py - sc * 0.5); ctx.lineTo(x + sc * 0.3, py - sc * 0.18); ctx.stroke(); }
  // vagn
  ctx.fillStyle = '#2B2350'; rr(px - sc * 0.45, py - sc * 0.6, sc * 0.9, sc * 0.5, 5); ctx.fill();
  // förarhytt med kranföraren
  const cx = W - sc * 1.9, cy = py - sc * 0.2;
  ctx.fillStyle = '#F5B400'; rr(cx, cy, sc * 1.6, sc * 1.3, 8); ctx.fill();
  ctx.fillStyle = '#BEE7FF'; rr(cx + sc * 0.15, cy + sc * 0.15, sc * 1.3, sc * 0.85, 6); ctx.fill();
  const im = faces[me];
  if (im && im.complete && im.naturalWidth) {
    ctx.save(); ctx.beginPath(); ctx.arc(cx + sc * 0.8, cy + sc * 0.62, sc * 0.4, 0, 7); ctx.clip();
    const m = Math.min(im.naturalWidth, im.naturalHeight);
    ctx.drawImage(im, (im.naturalWidth - m) / 2, 0, m, m, cx + sc * 0.4, cy + sc * 0.22, sc * 0.8, sc * 0.8);
    ctx.restore();
  }
  if (T.cheer) {
    const a = Math.min(1, (1.8 - T.cheer.life) * 3);
    ctx.globalAlpha = a;
    ctx.font = `700 ${Math.max(14, sc * 0.42)}px Fredoka, sans-serif`;
    const tw = ctx.measureText(T.cheer.text).width + 20;
    const bx = Math.max(8, cx - tw + sc * 0.6), by = cy + sc * 1.5;
    ctx.fillStyle = '#fff'; rr(bx, by, tw, sc * 0.75, 12); ctx.fill();
    ctx.fillStyle = '#2B2350'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(T.cheer.text, bx + 10, by + sc * 0.38);
    ctx.globalAlpha = 1;
  }
  // linan och kroken med våningen
  if (T.phase === 'swing' || T.phase === 'settle') {
    const h = hookPos();
    const hx = SX(h.x), hy = SY(h.y);
    ctx.strokeStyle = '#2B2350'; ctx.lineWidth = Math.max(2, sc * 0.06);
    ctx.beginPath(); ctx.moveTo(px, py - sc * 0.1); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#2B2350'; ctx.beginPath(); ctx.arc(hx, hy, sc * 0.12, 0, 7); ctx.fill();
    if (T.phase === 'swing') {
      ctx.strokeStyle = '#2B235088'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(SX(h.x - BW * 0.4), SY(h.y - 0.6)); ctx.moveTo(hx, hy); ctx.lineTo(SX(h.x + BW * 0.4), SY(h.y - 0.6)); ctx.stroke();
      drawFloor(h.x, h.y - 0.6 - BH, h.th * 0.3, FLOOR_COLS[n() % FLOOR_COLS.length], (n() + me) % 4, n());
    }
  }
}
function drawFx() {
  const sc = s();
  if (T.block) drawFloor(T.block.x, T.block.y, T.block.rot, FLOOR_COLS[n() % FLOOR_COLS.length], (n() + me) % 4, n());
  for (const f of T.falling) drawFloor(f.x, f.y, f.rot, f.col, f.face, f.k);
  for (const p of T.parts) { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), Math.max(2, p.r * sc), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of T.texts) {
    const k = t.life < 0.15 ? t.life / 0.15 : 1, a = 1 - Math.max(0, t.life - 0.8) / 0.4;
    const fs = Math.min(56, Math.max(24, Math.min(W, H) * 0.08)) * (0.6 + 0.5 * k);
    ctx.globalAlpha = Math.max(0, a);
    ctx.font = `700 ${fs}px Fredoka, sans-serif`;
    ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#2B2350'; ctx.lineJoin = 'round';
    const x = Math.max(fs * 3, Math.min(W - fs * 3, SX(t.x))), y = SY(t.y);
    ctx.strokeText(t.txt, x, y); ctx.fillStyle = t.c; ctx.fillText(t.txt, x, y);
  }
  ctx.globalAlpha = 1;
}
function draw() {
  drawSky();
  drawCity();
  drawTower();
  drawFx();
  drawCrane();
  drawTexts();
}

function frame(now) {
  if (!T || current !== 'game') return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(dt);
  draw();
  raf = requestAnimationFrame(frame);
}
function stop() { cancelAnimationFrame(raf); }

function updateHud() {
  $('hFloors').innerHTML = n() + `<small>${n() === 1 ? 'våning' : 'våningar'}</small>`;
  $('hPeople').textContent = '👥 ' + T.people;
  $('hCombo').textContent = T.combo > 1 ? `⭐ Perfekt x${T.combo}` : `⭐ ${T.perfects} perfekta`;
  $('hLives').textContent = '❤️'.repeat(Math.max(0, T.lives)) + '🖤'.repeat(Math.max(0, 3 - T.lives));
}

function startGame() {
  loadFaces();
  newGame();
  show('game');
  resize();
  $('tapHint').classList.remove('hidden');
  updateHud();
  setTimeout(() => { if (T) cheer(pick(['Nu bygger vi! 🏗️', 'Rakt och fint!', 'Lycka till!'])); }, 300);
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function openPanel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }
function confirmBox(title, text, yes, onYes) {
  openPanel(`<h3>${title}</h3><p>${text}</p><button class="btn pink" id="cYes">${yes}</button><button class="btn white" id="cNo">Nej, bygg vidare</button>`);
  $('cYes').onclick = () => { SFX.tap(); closePanel(); onYes(); };
  $('cNo').onclick = () => { SFX.tap(); closePanel(); };
}

$('play').onclick = () => { SFX.tap(); ac(); startGame(); };
$('pickChar').onclick = () => { SFX.tap(); show('select'); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('gHome').onclick = () => {
  SFX.tap();
  if (T && !T.over && n() > 0) confirmBox('Sluta bygga?', 'Tornet sparas inte.', 'Ja, till menyn', () => { T.over = true; show('menu'); });
  else show('menu');
};

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) { if ($('cNo')) $('cNo').click(); else if ($('toMenu')) $('toMenu').click(); return true; }
  if (current === 'menu') { goHub(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  show('menu'); return true;
};

bubbles();
show('menu');
