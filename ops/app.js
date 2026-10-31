/* Bucinca Operation Öken – menyer, mot datorn, nätverk (wifi + internet), styrning, sikt (dimma), köpmeny och ritning. */
'use strict';
const store = makeStore('bo');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = (location.protocol === 'http:' && location.port === String(PORT)) || !!NET_ONLINE;
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const { WEAPONS, ITEMS, SITES, SPAWN_ZONE, CS, GW, GH, W: WW, H: WH, grid } = OPS;
const TEAMC = ['#FF3B30', '#2F7BFF'], TEAMN = ['Röda laget', 'Blå laget'], TEAMS = ['anfaller', 'försvarar'];
const VIS = 1700;   // hur långt man ser

const SFX = Object.assign({}, CORE_SFX, {
  shot: (w, near) => {
    if (w === 'sniper') { noise(.35, { type: 'lowpass', f: 1400, vol: .5 * near }); tone(90, .3, { to: 40, vol: .25 * near }); }
    else if (w === 'shotgun') { noise(.3, { type: 'lowpass', f: 900, vol: .45 * near }); tone(80, .2, { to: 40, vol: .2 * near }); }
    else if (w === 'rifle') { noise(.09, { type: 'bandpass', f: 1800, q: .8, vol: .32 * near }); tone(160, .07, { to: 70, vol: .12 * near }); }
    else if (w === 'smg') { noise(.06, { type: 'bandpass', f: 2600, q: 1, vol: .25 * near }); }
    else { noise(.08, { type: 'bandpass', f: 2200, q: 1.2, vol: .28 * near }); tone(300, .05, { to: 120, vol: .08 * near }); }
  },
  hit: near => { tone(900, .05, { type: 'square', vol: .05 * near, to: 400 }); },
  hurt: () => { tone(220, .12, { type: 'sawtooth', vol: .1, to: 120 }); },
  boom: (near, big) => { noise(big ? 1.4 : .7, { type: 'lowpass', f: big ? 300 : 500, vol: (big ? .8 : .55) * near }); tone(60, big ? 1 : .5, { to: 25, vol: .4 * near }); },
  flashbang: near => { noise(.25, { type: 'highpass', f: 2500, vol: .4 * near }); },
  ring: () => tone(3400, 2.2, { type: 'sine', vol: .05 }),
  smoke: near => noise(1.2, { type: 'highpass', f: 1500, vol: .12 * near }),
  throw: () => tone(500, .15, { to: 250, type: 'triangle', vol: .06 }),
  clink: near => tone(2400, .04, { type: 'triangle', vol: .05 * near, to: 1800 }),
  reload: () => { tone(400, .05, { type: 'square', vol: .05 }); tone(250, .06, { type: 'square', vol: .05, delay: .25 }); },
  empty: () => tone(1200, .03, { type: 'square', vol: .05 }),
  cash: () => [1319, 1568].forEach((f, i) => tone(f, .09, { type: 'triangle', vol: .1, delay: i * .06 })),
  beep: () => tone(1800, .08, { type: 'square', vol: .06 }),
  plant: () => [880, 660, 880].forEach((f, i) => tone(f, .1, { type: 'square', vol: .06, delay: i * .12 })),
  defuse: () => [523, 784, 1047].forEach((f, i) => tone(f, .18, { type: 'triangle', vol: .12, delay: i * .1 })),
  go: () => [523, 784].forEach((f, i) => tone(f, .2, { type: 'square', vol: .07, delay: i * .12 })),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 })),
  roundWin: () => [659, 784, 1047].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .13, delay: i * .1 }))
});

/* ---------- jag ---------- */
const ME = { ch: store.get('ch', 0) };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
const myName = () => REMOTE && Q.get('n') && +Q.get('c') === ME.ch ? Q.get('n').slice(0, 14) : charName(ME.ch);
const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });
const stats = () => Object.assign({ matches: 0, wins: 0, kills: 0, rounds: 0 }, store.get('stats', {}) || {});

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'quick') buildQuick();
  if (id === 'join') buildJoin();
  if (id === 'lobby') buildLobby();
  if (id === 'game') resize();
  if (window.Android && Android.keepAwake) try { Android.keepAwake(id === 'game' || id === 'lobby'); } catch (e) { }
}
function panel(html, wide) { $('panel').innerHTML = html; $('panel').classList.toggle('wide', !!wide); $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); $('panel').classList.remove('wide'); BUY.open = false; }

function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Operation', 'l1') + ln('Öken 🏜️', 'l2');
  const st = stats();
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Spelare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px"><span class="chip">🏆 ${st.wins} vinster</span><span class="chip">🎯 ${st.kills} träffar</span></div></div>`;
  $('toHost').classList.toggle('hidden', !canHost());
}
function pickFigure(title, done, back) {
  $('meTitle').textContent = title;
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    ME.ch = +el.dataset.i; store.set('ch', ME.ch); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(done, 220);
  });
  $('meBack').onclick = () => { SFX.tap(); (back || (() => show('menu')))(); };
  show('meScr');
}

/* ---------- mot datorn ---------- */
const QS = Object.assign({ side: 0, size: 3, diff: 1, win: 1 }, store.get('qs', {}));
const DIFF = [{ n: 'Lätt', lv: 2 }, { n: 'Medel', lv: 5 }, { n: 'Svår', lv: 8 }, { n: 'Proffs', lv: 10 }];
const WINS = [3, 5, 7];
const winOf = i => WINS[Math.max(0, Math.min(2, i | 0))];
function seg(id, vals, cur, label) { return `<div class="opt"><b>${label}</b><div class="seg" data-s="${id}">${vals.map(v => `<button data-v="${v[0]}" class="${String(v[0]) === String(cur) ? 'on' : ''}">${v[1]}</button>`).join('')}</div></div>`; }
const segVal = b => isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
const sidesHTML = cur => `<div class="sides">${[0, 1].map(s => `<button data-side="${s}" class="${cur === s ? 'on' : ''}" style="background:${TEAMC[s]}">${s ? '🔵' : '🔴'} ${TEAMN[s]}<small>${s ? 'Försvarar A och B' : 'Lägger ut laddningen'}</small></button>`).join('')}</div>`;
function buildQuick() {
  $('qBox').innerHTML = `<div class="card"><h4>Välj lag</h4>${sidesHTML(QS.side)}<div class="opts" style="margin-top:6px">
    ${seg('size', [[1, '1 mot 1'], [2, '2 mot 2'], [3, '3 mot 3'], [5, '5 mot 5']], QS.size, '👥 Lagen')}
    ${seg('diff', DIFF.map((d, i) => [i, d.n]), QS.diff, '⭐ Svårighet')}
    ${seg('win', WINS.map((v, i) => [i, String(v)]), QS.win, '🏆 Ronder för vinst')}
    </div><p class="note">Röda laget ska lägga ut sprängladdningen på A eller B. Blå laget försvarar och desarmerar. Ett lag vinner ronden när alla motståndare är utslagna. Din egen lagkamrater styrs av datorn.</p>
    <button class="btn green" id="qGo">🎯 Spela!</button></div>`;
  $('qBox').querySelectorAll('.seg button').forEach(b => b.onclick = () => { QS[b.parentNode.dataset.s] = segVal(b); store.set('qs', QS); SFX.tap(); buildQuick(); });
  $('qBox').querySelectorAll('[data-side]').forEach(b => b.onclick = () => { QS.side = +b.dataset.side; store.set('qs', QS); SFX.tap(); buildQuick(); });
  $('qGo').onclick = () => { SFX.tap(); startQuick(); };
}
function fillBots(pl, size, lv) {
  const used = pl.map(p => p.ch);
  let k = 0;
  for (const side of [0, 1]) while (pl.filter(p => p.side === side).length < size) {
    const free = CHARS.map((_, i) => i).filter(i => !used.includes(i));
    const ch = free.length ? pick(free) : Math.floor(Math.random() * CHARS.length); used.push(ch);
    pl.push({ id: 'b' + (k++), name: charName(ch), ch, side, bot: Math.max(1, Math.min(10, lv + (Math.random() < .3 ? -1 : 0))) });
  }
  return pl;
}
function startQuick() {
  const pl = fillBots([{ id: 'me', name: charName(ME.ch), ch: ME.ch, side: QS.side & 1, bot: -1 }], QS.size, DIFF[QS.diff].lv);
  G.mode = 'local'; G.kind = 'quick';
  begin(new OPS.Game(pl, { win: winOf(QS.win) }), 'me');
}

/* ================= MATCHEN ================= */
/* G.mode: 'local' | 'host' | 'client' */
const G = { mode: 'local', kind: 'quick', game: null, snap: null, me: 'me', lastEv: 0, acc: 0, endShown: false, endT: 0, res: null, sendN: 0, disp: {}, evSent: 0, bodies: [], beepT: 0, lastBl: 0, specId: null };
function begin(game, me) {
  G.game = game; G.me = me; G.snap = game ? game.snap() : null; G.lastEv = 0; G.endShown = false; G.endT = 0; G.res = null; G.disp = {}; G.bodies = []; G.evSent = 0; G.specId = null;
  FX.reset(); closePanel(); show('game');
  $('feed').innerHTML = '';
  $('hint').classList.remove('hidden'); setTimeout(() => $('hint').classList.add('hidden'), 6000);
}
let paused = false;

/* ---------- styrning: två tumspakar + knappar, eller tangentbord och mus ---------- */
const INP = { mx: 0, my: 0, ax: 0, ay: 0, fire: 0, act: 0 };
const PRESS = {};
const FIRE = { btn: 0, auto: store.get('autofire', true) };
const STK = { m: null, a: null };
const STR = () => Math.max(46, Math.min(80, Math.min(VW, VH) * .12));
const cvEl = $('cv');
cvEl.addEventListener('pointerdown', e => {
  if (current !== 'game') return;
  e.preventDefault();
  if (e.pointerType === 'mouse') { MOUSE.down = true; return; }
  const left = e.clientX < VW / 2;
  const s = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  if (left && !STK.m) STK.m = s; else if (!left && !STK.a) STK.a = s;
  try { cvEl.setPointerCapture(e.pointerId); } catch (er) { }
  updStick();
});
cvEl.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.used = true; return; }
  for (const k of ['m', 'a']) if (STK[k] && STK[k].id === e.pointerId) { STK[k].x = e.clientX; STK[k].y = e.clientY; }
  updStick();
});
const endPtr = e => {
  if (e.pointerType === 'mouse') { MOUSE.down = false; return; }
  for (const k of ['m', 'a']) if (STK[k] && STK[k].id === e.pointerId) STK[k] = null;
  updStick();
};
cvEl.addEventListener('pointerup', endPtr); cvEl.addEventListener('pointercancel', endPtr);
cvEl.addEventListener('contextmenu', e => e.preventDefault());
const MOUSE = { x: 0, y: 0, down: false, used: false };
const KEYS = {};
addEventListener('keydown', e => {
  if (current !== 'game') return;
  KEYS[e.code] = true;
  const k = e.code;
  if (k === 'KeyR') PRESS.reload = 1;
  else if (k === 'KeyQ') PRESS.swap = 1;
  else if (k === 'KeyG') PRESS.he = 1;
  else if (k === 'KeyC') PRESS.smoke = 1;
  else if (k === 'KeyF') PRESS.flash = 1;
  else if (k === 'KeyB') { if (BUY.open) closePanel(); else openBuy(); }
  else if (k === 'Space') e.preventDefault();
});
addEventListener('keyup', e => { KEYS[e.code] = false; });
function updStick() {
  const R = STR();
  const v = s => { if (!s) return [0, 0, 0]; let dx = s.x - s.ox, dy = s.y - s.oy; const l = Math.hypot(dx, dy); if (l > R) { s.ox = s.x - dx / l * R; s.oy = s.y - dy / l * R; dx = s.x - s.ox; dy = s.y - s.oy; } return [dx / R, dy / R, Math.min(1, l / R)]; };
  const m = v(STK.m), a = v(STK.a);
  INP.mx = m[0]; INP.my = m[1];
  if (STK.a) { if (a[2] > .25) { INP.ax = a[0]; INP.ay = a[1]; } INP.fire = FIRE.auto && a[2] > .55 ? 1 : 0; } else INP.fire = 0;
}
const meOf = s => s && s.P.find(p => p.id === G.me);
function readInput() {
  let kx = 0, ky = 0;
  if (KEYS.KeyA || KEYS.ArrowLeft) kx -= 1; if (KEYS.KeyD || KEYS.ArrowRight) kx += 1;
  if (KEYS.KeyW || KEYS.ArrowUp) ky -= 1; if (KEYS.KeyS || KEYS.ArrowDown) ky += 1;
  const out = Object.assign({}, INP);
  if (kx || ky) { const l = Math.hypot(kx, ky); out.mx = kx / l; out.my = ky / l; }
  if (KEYS.KeyE) out.act = 1;
  if (FIRE.btn || KEYS.Space) out.fire = 1;
  const me = meOf(G.snap);
  if (MOUSE.used && me) {
    const D = G.disp[me.id] || me, [sx, sy] = toScreen(D.x, D.y);
    out.ax = MOUSE.x - sx; out.ay = MOUSE.y - sy; const l = Math.hypot(out.ax, out.ay) || 1; out.ax /= l; out.ay /= l;
    if (MOUSE.down) out.fire = 1;
  }
  // siktehjälp för tumspaken: dra siktet mot en synlig fiende inom en liten vinkel
  if ((STK.a || FIRE.btn) && me && me.al && Math.hypot(out.ax, out.ay) > .2) {
    const aim = Math.atan2(out.ay, out.ax); let best = null, bd = .22;
    for (const p of G.snap.P) {
      if (!p.al || p.s === me.s || !VISIBLE.has(p.id)) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y); if (d > 1000) continue;
      const da = Math.abs(angD(aim, Math.atan2(p.y - me.y, p.x - me.x))); if (da < bd) { bd = da; best = p; }
    }
    if (best) { const a2 = Math.atan2(best.y - me.y, best.x - me.x); out.ax = Math.cos(a2); out.ay = Math.sin(a2); }
  }
  for (const k in PRESS) { out[k] = PRESS[k]; delete PRESS[k]; }
  return out;
}
// knappar
const holdBtn = (id, on) => { const el = $(id); el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on(); buzz(12); }); };
holdBtn('bReload', () => PRESS.reload = 1);
holdBtn('bSwap', () => PRESS.swap = 1);
holdBtn('bHe', () => PRESS.he = 1);
holdBtn('bSmoke', () => PRESS.smoke = 1);
holdBtn('bFlash', () => PRESS.flash = 1);
holdBtn('buyB', () => openBuy());
// skjutknappen: skjuter åt det håll man siktar så länge den hålls in
const fireB = $('fireB');
fireB.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); FIRE.btn = 1; fireB.classList.add('on'); try { fireB.setPointerCapture(e.pointerId); } catch (er) { } buzz(10); });
const fireUp = () => { FIRE.btn = 0; fireB.classList.remove('on'); };
fireB.addEventListener('pointerup', fireUp); fireB.addEventListener('pointercancel', fireUp); fireB.addEventListener('lostpointercapture', fireUp);
const actB = $('actB');
actB.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); INP.act = 1; try { actB.setPointerCapture(e.pointerId); } catch (er) { } buzz(15); });
const actUp = () => { INP.act = 0; };
actB.addEventListener('pointerup', actUp); actB.addEventListener('pointercancel', actUp);

let lastSent = '', lastSendT = 0;
function pushInput(now) {
  const inp = readInput();
  if (G.mode === 'client') {
    const oneShot = inp.reload || inp.swap || inp.he || inp.smoke || inp.flash || inp.buy;
    const key = [inp.mx.toFixed(2), inp.my.toFixed(2), inp.ax.toFixed(2), inp.ay.toFixed(2), inp.fire, inp.act].join();
    if (oneShot || (key !== lastSent && now - lastSendT > 45) || now - lastSendT > 400) { lastSent = key; lastSendT = now; clSend({ t: 'in', i: inp }); }
  } else if (G.game) G.game.setInput(G.me, inp);
}

/* ---------- köpmenyn ---------- */
const BUY = { open: false, key: '' };
const canBuyHere = (s, me) => s && me && me.al && s.buy && OPS.inZone(SPAWN_ZONE[me.s], me.x, me.y);
function openBuy() {
  const s = G.snap, me = meOf(s);
  if (!canBuyHere(s, me)) { SFX.bonk(); return; }
  BUY.open = true; BUY.key = ''; renderBuy(true);
}
function renderBuy(force) {
  const s = G.snap, me = meOf(s);
  if (!BUY.open) return;
  if (!canBuyHere(s, me)) { closePanel(); return; }
  const key = [me.m, me.pr, me.ar, me.he, me.sm, me.fl, me.kit].join();
  if (!force && key === BUY.key) return;
  BUY.key = key;
  const wb = id => { const w = WEAPONS[id], own = me.pr === id; return `<button data-buy="${id}" class="${own ? 'own' : ''}" ${own || me.m < w.price ? 'disabled' : ''}><span class="ic">${w.ic}</span><span>${w.name}<small>💰 ${w.price} · skada ${w.dmg}${w.n > 1 ? '×' + w.n : ''} · ${w.mag} skott</small></span></button>`; };
  const ib = id => { const it = ITEMS[id], have = id === 'armor' ? me.ar >= 100 : id === 'kit' ? me.kit : id === 'he' ? me.he : id === 'smoke' ? me.sm : me.fl;
    if (it.side != null && it.side !== me.s) return '';
    return `<button data-buy="${id}" class="${have ? 'own' : ''}" ${have || me.m < it.price ? 'disabled' : ''}><span class="ic">${it.ic}</span><span>${it.name}<small>💰 ${it.price}</small></span></button>`; };
  panel(`<h3>🛒 Köp <span class="chip" style="font-size:16px">💰 ${me.m}</span></h3>
    <div class="shop"><h5>Vapen</h5>${['smg', 'shotgun', 'rifle', 'sniper'].map(wb).join('')}
    <h5>Utrustning och granater</h5>${['armor', 'kit', 'he', 'smoke', 'flash'].map(ib).join('')}</div>
    <p class="note" style="margin:0">Du kan bara köpa i början av ronden, i ert startområde. Pistolen är gratis. Vapnen behåller du till nästa rond om du överlever.</p>
    <button class="btn green" id="buyOk">👍 Klar</button>`, true);
  $('panel').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { PRESS.buy = b.dataset.buy; SFX.cash(); buzz(15); });
  $('buyOk').onclick = () => { SFX.tap(); closePanel(); };
}

/* ---------- huvudloop ---------- */
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(.1, (now - lastT) / 1000)); lastT = now;
  if (current !== 'game' || !G.snap) return;
  if (!paused) pushInput(now);
  if (G.game && G.mode !== 'client' && !paused) {
    G.acc += dt; let n = 0;
    const every = NET_ONLINE ? 3 : 2;
    while (G.acc >= OPS.DT && n < 8) {
      G.game.step(); G.acc -= OPS.DT; n++;
      if (G.mode === 'host' && (++G.sendN % every === 0)) { hostAll({ t: 's', s: G.game.snap(G.evSent) }); G.evSent = G.game.evSeq; }
    }
    G.snap = G.game.snap();
    if (G.mode === 'host' && G.game.over && !G.resSent) { G.resSent = true; hostAll({ t: 's', s: G.game.snap(G.evSent) }); G.evSent = G.game.evSeq; hostAll({ t: 'res', r: G.game.result(), w: G.game.winner }); }
  }
  smooth(dt);
  handleEvents(G.snap);
  updHud(G.snap);
  FX.tick(dt);
  draw(G.snap, now / 1000, dt);
  if (BUY.open) renderBuy();
  // laddningens pip
  if (G.snap.B && G.snap.B.pl && G.snap.ph === 'live') { G.beepT -= dt; if (G.beepT <= 0) { SFX.beep(); G.beepT = Math.max(.12, G.snap.bt / OPS.T_BOMB * 1.1); } }
  if (G.snap.ov && !G.endShown) { G.endT += dt; if (G.endT > 2.6 && (G.mode !== 'client' || G.res)) { G.endShown = true; showResult(); } }
}
requestAnimationFrame(loop);
function smooth(dt) {
  for (const p of G.snap.P) {
    const d = G.disp[p.id] || (G.disp[p.id] = { x: p.x, y: p.y, a: p.a, step: 0 });
    const k = G.mode === 'client' ? Math.min(1, dt * 18) : 1;
    const jump = Math.hypot(p.x - d.x, p.y - d.y) > 200;
    const nx = jump ? p.x : d.x + (p.x - d.x) * k, ny = jump ? p.y : d.y + (p.y - d.y) * k;
    d.step += Math.hypot(nx - d.x, ny - d.y); d.x = nx; d.y = ny;
    d.a += angD(d.a, p.a) * (jump ? 1 : Math.min(1, k * 1.5));
  }
}
const angD = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/* ---------- HUD ---------- */
const mm = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
function updHud(s) {
  const me = meOf(s), eye = eyeOf(s);
  if (me) {
    const who = me.al ? me : eye;
    $('mebox').innerHTML = me.al ? `${avHTML(me.ch)}<div class="bars"><b>❤️ ${me.hp}${me.ar ? ' 🦺 ' + me.ar : ''}${me.bomb ? ' 💣' : ''}${me.kit ? ' 🔧' : ''}</b><div class="bar"><i style="width:${me.hp}%"></i></div>${me.ar ? `<div class="bar ar"><i style="width:${me.ar}%"></i></div>` : ''}</div>`
      : `${who && who !== me ? avHTML(who.ch) : ''}<div class="bars"><b>💫 ${who && who !== me ? 'Tittar på ' + esc(who.n) : 'Utslagen'}</b><b class="money">💰${me.m}</b></div>`;
    $('mebox').querySelector('.av') && ($('mebox').querySelector('.av').style.borderColor = TEAMC[me.s]);
    const w = WEAPONS[me.w] || WEAPONS.pistol;
    $('ammo').innerHTML = (me.al ? `${w.ic} <big>${me.rl ? '⏳' : me.mg}</big> / ${me.rs}` : `🎯 ${me.k} · 💫 ${me.d}`) + `<br><span class="money">💰 ${me.m}</span>`;
    const gb = (id, n) => { $(id).querySelector('small').textContent = n; $(id).classList.toggle('dim', !n); };
    gb('bHe', me.he); gb('bSmoke', me.sm); gb('bFlash', me.fl);
    $('bSwap').classList.toggle('dim', !me.pr);
    $('gR').classList.toggle('hidden', !me.al); fireB.classList.toggle('hidden', !me.al || (MOUSE.used && !STK.m && !STK.a && !FIRE.btn));
    if (!me.al) fireUp();
    $('buyB').classList.toggle('hidden', !canBuyHere(s, me));
    // knappen för att lägga ut / desarmera
    let act = '';
    if (me.al && s.ph === 'live') {
      if (me.s === 0 && me.bomb && (OPS.inZone(SITES.A, me.x, me.y) || OPS.inZone(SITES.B, me.x, me.y))) act = 'plant';
      else if (me.s === 1 && s.B && s.B.pl && Math.hypot(s.B.x - me.x, s.B.y - me.y) < 60) act = 'def';
    }
    actB.classList.toggle('hidden', !act);
    if (act) { $('actT').textContent = act === 'plant' ? '💣 Håll för att lägga ut' : `🔧 Håll för att desarmera${me.kit ? '' : ' (5 s)'}`; $('actP').style.width = (act === 'plant' ? me.pl : me.df) + '%'; }
    if (!act && INP.act && !KEYS.KeyE) INP.act = 0;
    if (me.bl > G.lastBl + .5) SFX.ring();
    G.lastBl = me.bl;
  } else { $('mebox').innerHTML = '<b>👀 Tittar på</b>'; $('gR').classList.add('hidden'); $('buyB').classList.add('hidden'); actB.classList.add('hidden'); $('ammo').innerHTML = ''; }
  const sc = `<span style="color:${TEAMC[0]}">${s.sc[0]}</span> – <span style="color:${TEAMC[1]}">${s.sc[1]}</span>`;
  const planted = s.B && s.B.pl && s.ph === 'live';
  $('clock').classList.toggle('bomb', !!planted);
  $('clock').innerHTML = planted ? `💣 ${s.B.s} · ${Math.ceil(s.bt)}<small>${s.sc[0]} – ${s.sc[1]} · rond ${s.rd}</small>`
    : s.ph === 'freeze' ? `${sc}<small>Rond ${s.rd} · köp! 🛒</small>`
    : `${sc}<small>${mm(s.tm)} · rond ${s.rd} · till ${s.win}</small>`;
  // knapparnas plats
  const land = VW > VH, R = STR();
  const gR = $('gR'), gL = $('gL');
  const fs = fireB.offsetHeight || 84;
  if (land) { fireB.style.right = `calc(var(--safe-r) + ${R * 2 + 52}px)`; fireB.style.bottom = `calc(var(--safe-b) + ${Math.max(10, 30 + R - fs / 2)}px)`; }
  else { fireB.style.right = `calc(var(--safe-r) + ${34 + R - fs / 2}px)`; fireB.style.bottom = `calc(var(--safe-b) + ${R * 2 + 52}px)`; }
  gR.style.right = `calc(var(--safe-r) + ${land ? 14 : 10}px)`; gR.style.bottom = `calc(var(--safe-b) + ${R * 2 + 56 + (land ? 0 : fs + 12)}px)`;
  gL.style.left = `calc(var(--safe-l) + ${land ? 14 : 10}px)`; gL.style.bottom = `calc(var(--safe-b) + ${R * 2 + 56}px)`;
  actB.style.bottom = `calc(var(--safe-b) + ${land ? 24 : R * 2 + 64}px)`;
}
let bigT = 0;
function big(txt, ms, sub) {
  const el = $('big'); el.innerHTML = txt + (sub ? `<small>${sub}</small>` : ''); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.add('hidden'), ms || 1200);
}
function feed(html, mine) { const d = document.createElement('div'); d.innerHTML = html; if (mine) d.className = 'mine'; $('feed').prepend(d); while ($('feed').children.length > 5) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 5000); }

/* ---------- händelser → ljud och effekter ---------- */
function nearOf(x, y) { const e = eyeOf(G.snap) || { x: CAM.x, y: CAM.y }; const d = Math.hypot(x - e.x, y - e.y); return Math.max(.06, 1 - d / 1800); }
const WHY = { elim: 'Alla motståndare är utslagna', time: 'Tiden tog slut', bomb: 'Laddningen small! 💥', defuse: 'Laddningen desarmerades 🔧' };
function handleEvents(s) {
  const P = id => s.P.find(q => q.id === id);
  const nm = id => { const p = P(id); return p ? `<span style="color:${p.s ? '#9CC3FF' : '#FF9C94'}">${esc(p.n)}</span>` : '?'; };
  const me = meOf(s);
  for (const e of s.ev) {
    if (e.id <= G.lastEv) continue;
    G.lastEv = e.id;
    switch (e.e) {
      case 'round': G.bodies = []; FX.reset(); if (me) big(`Rond ${e.r}`, 1800, `${TEAMN[me.s]} ${TEAMS[me.s]} – ${me.s ? 'skydda A och B' : 'lägg ut laddningen på A eller B'}`); else big(`Rond ${e.r}`, 1500); break;
      case 'go': SFX.go(); big('KÖR! 🎯', 700); break;
      case 'shot': {
        const n = nearOf(e.x, e.y); SFX.shot(e.w, n);
        FX.flash(e.x, e.y); for (const t of e.tr) FX.tracer(e.x, e.y, t[0], t[1], e.w);
        if (e.p === G.me) FX.shake = Math.max(FX.shake, e.w === 'sniper' || e.w === 'shotgun' ? 6 : 2);
        break;
      }
      case 'hit': { FX.spark(e.x, e.y, 6, '#FFD23F'); if (e.p === G.me) { SFX.hurt(); FX.red = .4; buzz(25); } else SFX.hit(nearOf(e.x, e.y)); break; }
      case 'kill': {
        const v = P(e.p); G.bodies.push({ x: e.x, y: e.y, ch: v ? v.ch : 0, s: v ? v.s : 0 });
        FX.puff(e.x, e.y);
        const wi = e.w === 'bomb' ? '💣' : e.w === 'he' ? '💥' : (WEAPONS[e.w] || {}).ic || '💥';
        feed(e.k ? `${nm(e.k)} ${wi} ${nm(e.p)}` : `${wi} ${nm(e.p)}`, e.k === G.me || e.p === G.me);
        if (e.k === G.me) { SFX.pick(); buzz(40); FX.text('🎯', e.x, e.y - 30, '#FFD23F', 30); }
        if (e.p === G.me) { buzz(150); big('Utslagen 💫', 1500, 'Du tittar på en lagkamrat tills ronden är slut'); }
        break;
      }
      case 'boom': { const n = nearOf(e.x, e.y); SFX.boom(n, e.big); FX.boom(e.x, e.y, e.r); FX.shake = Math.max(FX.shake, (e.big ? 30 : 14) * n); break; }
      case 'flash': SFX.flashbang(nearOf(e.x, e.y)); FX.ring(e.x, e.y, '#fff', 200); break;
      case 'smoke': SFX.smoke(nearOf(e.x, e.y)); break;
      case 'throw': if (e.p === G.me) SFX.throw(); break;
      case 'bounce': SFX.clink(nearOf(e.x, e.y)); break;
      case 'reload': if (e.p === G.me) SFX.reload(); break;
      case 'empty': if (e.p === G.me) SFX.empty(); break;
      case 'swap': if (e.p === G.me) SFX.tap(); break;
      case 'buy': if (e.p === G.me) { const it = WEAPONS[e.w] || ITEMS[e.w]; if (it) FX.text(it.ic, me ? me.x : 0, me ? me.y - 40 : 0, '#fff', 26); } break;
      case 'planting': case 'defusing': if (nearOf(e.x || 0, e.y || 0) > .3) SFX.beep(); break;
      case 'planted': SFX.plant(); G.beepT = .8; feed(`💣 ${nm(e.p)} la ut laddningen på ${e.site}`); big(`💣 Laddningen ligger på ${e.site}!`, 1600, me ? (me.s ? 'Skynda – desarmera den!' : 'Försvara den!') : ''); break;
      case 'defused': SFX.defuse(); feed(`🔧 ${nm(e.p)} desarmerade`); break;
      case 'bombdrop': feed(`💣 ${nm(e.p)} tappade laddningen`); break;
      case 'bombpick': if (e.p === G.me) big('Du har laddningen! 💣', 1300, 'Gå till A eller B och håll knappen'); break;
      case 'rend': {
        const mine = me && me.s === e.w;
        if (me) { if (mine) SFX.roundWin(); else SFX.sad(); }
        big(`${TEAMN[e.w]} vann ronden!`, 2600, `${WHY[e.why] || ''}<br>🔴 ${e.sc[0]} – ${e.sc[1]} 🔵`);
        break;
      }
      case 'end': if (me && me.s === e.w) { SFX.win(); confetti(); } break;
      case 'join': feed(`👋 ${nm(e.p)} är med från nästa rond`); break;
      case 'left': feed(`🚪 ${esc(e.n)} lämnade`); break;
    }
  }
}

/* ---------- resultat ---------- */
async function showResult() {
  const s = G.snap, R = G.game ? G.game.result() : G.res.r, W = G.game ? G.game.winner : G.res.w;
  const mine = R.find(r => r.id === G.me);
  const won = !!mine && mine.side === W;
  if (mine) {
    const st = stats(); st.matches++; if (won) st.wins++; st.kills += mine.kills; st.rounds += s.sc[mine.side]; store.set('stats', st);
    hsAdd('opsKills', mine.kills);
  }
  const line = r => `<div class="r ${r.id === G.me ? 'mine' : ''}">${avHTML(r.ch)}<span>${esc(r.name)}${r.bot >= 0 ? ' 🤖' : ''}</span><b>🎯 ${r.kills} · 💫 ${r.deaths}${r.plants ? ' · 💣' + r.plants : ''}${r.defuses ? ' · 🔧' + r.defuses : ''}</b></div>`;
  const rank = `<div class="rank"><div style="font-weight:700;font-size:22px"><span style="color:${TEAMC[0]}">🔴 ${s.sc[0]}</span> – <span style="color:${TEAMC[1]}">${s.sc[1]} 🔵</span></div>
    ${[0, 1].map(sd => `<h5 style="color:${TEAMC[sd]}">${W === sd ? '🏆 ' : ''}${TEAMN[sd]}</h5>` + R.filter(r => r.side === sd).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths).map(line).join('')).join('')}</div>`;
  if (won) await celebrate(mine.ch, `${TEAMN[W]} vann!`, `${s.sc[0]} – ${s.sc[1]} i ronder`, ['🎯', '🏜️', '💣', '⭐', '🎉', '🏆']);
  if (G.mode === 'local') {
    panel(`<h3>${won ? 'Ni vann! 🏆' : 'Matchen är slut'}</h3>${rank}
      <button class="btn green" id="pAgain">🔄 Spela igen</button>
      <button class="btn white small" id="pMenu">🏠 Meny</button>`);
    $('pAgain').onclick = () => { SFX.tap(); startQuick(); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); G.game = null; show('menu'); };
  } else {
    panel(`<h3>Matchen är slut 🏆</h3>${rank}<button class="btn green" id="pLobby">👍 Till lobbyn</button>`);
    $('pLobby').onclick = () => { SFX.tap(); closePanel(); if (G.mode === 'host') { HOST.inGame = false; G.game = null; hostLobby(); } show('lobby'); };
  }
}

$('gBack').onclick = () => {
  SFX.tap();
  const net = G.mode !== 'local';
  if (!net) paused = true;
  panel(`<h3>${net ? (G.mode === 'host' ? 'Avsluta matchen för alla?' : 'Lämna matchen?') : 'Paus ⏸️'}</h3>
    <button class="btn white small" id="pAuto">🎯 Skjut med högra spaken: <b>${FIRE.auto ? 'PÅ' : 'AV'}</b></button>
    <p class="note" style="margin:0">PÅ: drar du högra spaken långt skjuter du. AV: spaken siktar bara – skjut med 🔫-knappen.</p>
    ${net ? '' : '<button class="btn green" id="pNo">▶️ Fortsätt</button>'}
    <button class="btn pink ${net ? '' : 'small'}" id="pYes">🚪 ${net ? 'Ja' : 'Avsluta'}</button>${net ? '<button class="btn white small" id="pNo">Nej</button>' : ''}`);
  $('pYes').onclick = () => {
    SFX.tap(); closePanel(); paused = false;
    if (G.mode === 'host') { G.game = null; G.snap = null; HOST.inGame = false; hostAll({ t: 'abort' }); hostLobby(); show('lobby'); }
    else if (G.mode === 'client') leave();
    else { G.game = null; show('menu'); }
  };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); paused = false; };
  $('pAuto').onclick = () => { SFX.tap(); FIRE.auto = !FIRE.auto; store.set('autofire', FIRE.auto); $('pAuto').querySelector('b').textContent = FIRE.auto ? 'PÅ' : 'AV'; };
};

/* ================= RITNING ================= */
const cv = $('cv'), cx = cv.getContext('2d');
const FOG = document.createElement('canvas'), fx = FOG.getContext('2d');
let VW = 0, VH = 0, DPR = 1, SC = 1;
const CAM = { x: WW / 2, y: WH / 2 };
const SAFE = { t: 14, b: 14, l: 8 };
function resize() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); cv.width = FOG.width = Math.round(VW * DPR); cv.height = FOG.height = Math.round(VH * DPR);
  const cs = getComputedStyle(document.documentElement), v = (k, d) => parseFloat(cs.getPropertyValue(k)) || d;
  SAFE.t = v('--safe-t', 14); SAFE.b = v('--safe-b', 14); SAFE.l = v('--safe-l', 8);
}
addEventListener('resize', () => { if (current === 'game') resize(); });
const toScreen = (x, y) => [VW / 2 + (x - CAM.x) * SC, VH / 2 + (y - CAM.y) * SC];

/* kartan ritas en gång till en egen bild */
const MAPC = document.createElement('canvas'), MS = .75;
const isSolid = (x, y) => OPS.solidAt(x, y);
(function prepMap() {
  MAPC.width = WW * MS; MAPC.height = WH * MS;
  const g = MAPC.getContext('2d'), r = OPS.RNG(4242);
  g.scale(MS, MS);
  // sand
  g.fillStyle = '#D8B577'; g.fillRect(0, 0, WW, WH);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? '#CFA866' : '#E2C38A'; g.globalAlpha = .25 + r() * .35; g.beginPath(); g.ellipse(r() * WW, r() * WH, 10 + r() * 40, 6 + r() * 22, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  // stenplattor på platserna och i startområdena
  const tiles = (z, c1, c2) => { for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) { if (isSolid(x, y)) continue; g.fillStyle = (x + y) % 2 ? c1 : c2; g.fillRect(x * CS + 2, y * CS + 2, CS - 4, CS - 4); } };
  tiles(SITES.A, '#CDB38A', '#C5A97E'); tiles(SITES.B, '#CDB38A', '#C5A97E');
  for (const sd of [0, 1]) { const z = SPAWN_ZONE[sd]; g.fillStyle = TEAMC[sd] + '1c'; g.fillRect(z.x0 * CS, z.y0 * CS, (z.x1 - z.x0 + 1) * CS, (z.y1 - z.y0 + 1) * CS); }
  // målade bokstäver
  g.font = 'bold 150px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const k of ['A', 'B']) { const S = SITES[k]; g.fillStyle = '#C0392B88'; g.fillText(k, S.label[0] * CS, S.label[1] * CS); }
  // väggar: skugga på golvet, sidor och tak
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (grid[y * GW + x] !== 1) continue;
    if (!isSolid(x, y + 1)) { const gr = g.createLinearGradient(0, (y + 1) * CS, 0, (y + 1) * CS + 26); gr.addColorStop(0, '#00000055'); gr.addColorStop(1, '#00000000'); g.fillStyle = gr; g.fillRect(x * CS, (y + 1) * CS, CS, 26); }
    if (!isSolid(x + 1, y)) { const gr = g.createLinearGradient((x + 1) * CS, 0, (x + 1) * CS + 18, 0); gr.addColorStop(0, '#00000040'); gr.addColorStop(1, '#00000000'); g.fillStyle = gr; g.fillRect((x + 1) * CS, y * CS, 18, CS); }
  }
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const v = grid[y * GW + x]; if (v !== 1) continue;
    const edge = !isSolid(x, y + 1) || !isSolid(x, y - 1) || !isSolid(x + 1, y) || !isSolid(x - 1, y) || !isSolid(x + 1, y + 1) || !isSolid(x - 1, y - 1) || !isSolid(x + 1, y - 1) || !isSolid(x - 1, y + 1);
    g.fillStyle = edge ? '#B88C55' : '#7A5A34'; g.fillRect(x * CS, y * CS, CS + .5, CS + .5);
    if (edge) {
      g.strokeStyle = '#9E7443'; g.lineWidth = 2;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x * CS, y * CS + k * 16); g.lineTo(x * CS + CS, y * CS + k * 16); g.stroke(); }
      for (let k = 0; k < 4; k++) { const ox = (k % 2) * 16 + 8; g.beginPath(); g.moveTo(x * CS + ox, y * CS + k * 16); g.lineTo(x * CS + ox, y * CS + k * 16 + 16); g.moveTo(x * CS + ox + 32, y * CS + k * 16); g.lineTo(x * CS + ox + 32, y * CS + k * 16 + 16); g.stroke(); }
      if (!isSolid(x, y + 1)) { g.fillStyle = '#8E6A3E'; g.fillRect(x * CS, (y + 1) * CS - 10, CS, 10); }
    }
  }
  // lådor
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (grid[y * GW + x] !== 2) continue;
    const X = x * CS + 3, Y = y * CS + 3, S = CS - 6;
    g.fillStyle = '#00000044'; g.fillRect(X + 8, Y + 10, S, S);
    g.fillStyle = '#7A4E22'; g.fillRect(X, Y, S, S);
    g.fillStyle = '#B07A3E'; g.fillRect(X + 5, Y + 5, S - 10, S - 10);
    g.strokeStyle = '#7A4E22'; g.lineWidth = 6; g.beginPath(); g.moveTo(X + 6, Y + 6); g.lineTo(X + S - 6, Y + S - 6); g.moveTo(X + S - 6, Y + 6); g.lineTo(X + 6, Y + S - 6); g.stroke();
  }
})();

const FX = {
  parts: [], texts: [], rings: [], flashes: [], tracers: [], shake: 0, red: 0,
  reset() { this.parts = []; this.texts = []; this.rings = []; this.flashes = []; this.tracers = []; this.shake = 0; this.red = 0; },
  spark(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 60 + Math.random() * 220; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .15 + Math.random() * .25, c, r: 2 + Math.random() * 3, fr: 3 }); } },
  puff(x, y) { for (let i = 0; i < 12; i++) { const a = Math.random() * 7, v = 40 + Math.random() * 120; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .5 + Math.random() * .4, c: pick(['#fff', '#FFD23F', '#FFE9A8']), r: 4 + Math.random() * 6, fr: 3, star: 1 }); } },
  boom(x, y, R) {
    for (let i = 0; i < 30; i++) { const a = Math.random() * 7, v = 60 + Math.random() * R * 2.5; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .35 + Math.random() * .5, c: pick(['#FFD23F', '#FF8A3D', '#FF4D6D', '#fff']), r: 6 + Math.random() * 12, fr: 3 }); }
    for (let i = 0; i < 12; i++) { const a = Math.random() * 7, v = 20 + Math.random() * 60; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1 + Math.random() * .7, c: '#55555588', r: 16 + Math.random() * 18, fr: 1.5, grow: 1 }); }
    this.rings.push({ x, y, r: 10, max: R, life: 0, c: '#FFE9A8', w: 8 });
  },
  ring(x, y, c, max) { this.rings.push({ x, y, r: 20, max: max || 70, life: 0, c, w: 6 }); },
  flash(x, y) { this.flashes.push({ x, y, life: 0 }); },
  tracer(x1, y1, x2, y2, w) { this.tracers.push({ x1, y1, x2, y2, life: 0, w }); },
  text(t, x, y, c, s) { this.texts.push({ t, x, y, c, s, life: 0 }); },
  tick(dt) {
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-p.fr * dt); p.vx *= f; p.vy *= f; if (p.grow) p.r += dt * 24; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life < 1);
    for (const r of this.rings) { r.life += dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); }
    this.rings = this.rings.filter(r => r.life < .45);
    for (const f of this.flashes) f.life += dt;
    this.flashes = this.flashes.filter(f => f.life < .06);
    for (const t of this.tracers) t.life += dt;
    this.tracers = this.tracers.filter(t => t.life < .09);
    this.shake *= Math.pow(.005, dt); this.red = Math.max(0, this.red - dt);
  }
};

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

/* vems ögon vi ser med: jag, eller en lagkamrat när jag är utslagen */
function eyeOf(s) {
  if (!s) return null;
  const me = meOf(s);
  if (me && me.al) { G.specId = null; return me; }
  const side = me ? me.s : 0;
  let sp = G.specId && s.P.find(p => p.id === G.specId && p.al);
  if (!sp) { sp = s.P.find(p => p.al && p.s === side && !p.out) || (me ? null : s.P.find(p => p.al)); G.specId = sp ? sp.id : null; }
  return sp || null;
}
/* siktpolygon: strålar från ögat mot väggar och rök */
const NR = 360;
const POLY = new Float32Array(NR * 2);
const VISIBLE = new Set();
function computeVision(s, ex, ey) {
  const sm = s.S.map(a => ({ x: a[0], y: a[1], r: 150 * Math.min(1, a[2] / .6) * (a[2] > 12 ? Math.max(0, 13 - a[2]) : 1), t: a[2] }));
  for (let i = 0; i < NR; i++) {
    const a = i / NR * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
    let d = OPS.rayWall(ex, ey, dx, dy, VIS);
    d = Math.min(d, OPS.raySmoke(ex, ey, dx, dy, d, sm)) + 6;
    POLY[i * 2] = ex + dx * d; POLY[i * 2 + 1] = ey + dy * d;
  }
  VISIBLE.clear();
  for (const p of s.P) if (p.al && Math.hypot(p.x - ex, p.y - ey) < VIS && OPS.canSee(ex, ey, p.x, p.y, sm)) VISIBLE.add(p.id);
  return sm;
}

function drawPlayer(p, D, time, alpha) {
  const ch = p.ch % CHARS.length, col = TEAMC[p.s], R = 21;
  cx.save(); cx.translate(D.x, D.y); cx.globalAlpha = alpha == null ? 1 : alpha;
  cx.fillStyle = '#00000040'; cx.beginPath(); cx.ellipse(5, 7, R, R * .85, 0, 0, 7); cx.fill();
  // vapen
  cx.save(); cx.rotate(D.a);
  const w = p.w, L = w === 'sniper' ? 46 : w === 'rifle' ? 38 : w === 'shotgun' ? 34 : w === 'smg' ? 28 : 20, bw = w === 'shotgun' ? 9 : w === 'pistol' ? 7 : 8;
  // händer
  const step = Math.sin((D.step || 0) * .06) * 3;
  cx.fillStyle = '#2B2350'; rr(cx, R - 8, -bw / 2 - 2, L + 4, bw + 4, 3); cx.fill();
  cx.fillStyle = w === 'sniper' ? '#3D5A3A' : '#3B3B3B'; rr(cx, R - 6, -bw / 2, L, bw, 2); cx.fill();
  if (w === 'sniper') { cx.fillStyle = '#222'; cx.fillRect(R + 6, -bw / 2 - 4, 12, 4); }
  cx.fillStyle = CHARS[ch].d; cx.beginPath(); cx.arc(R - 4 + step * .3, 8, 6, 0, 7); cx.arc(R + 8, -2, 5.5, 0, 7); cx.fill();
  cx.restore();
  // kropp
  cx.fillStyle = '#2B2350'; cx.beginPath(); cx.arc(0, 0, R + 3, 0, 7); cx.fill();
  cx.fillStyle = col; cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.fill();
  if (p.ar) { cx.strokeStyle = '#7FD8FF'; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, R - 2, 0, 7); cx.stroke(); }
  const im = FACES[ch], fr = R - 5;
  cx.save(); cx.beginPath(); cx.arc(0, 0, fr, 0, 7); cx.clip();
  if (im.complete && im.naturalWidth) cx.drawImage(im, -fr, -fr, fr * 2, fr * 2); else { cx.fillStyle = CHARS[ch].c; cx.fill(); }
  cx.restore();
  if (p.bomb) { cx.font = '18px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('💣', -R + 2, R - 4); }
  // förlopp: lägga ut / desarmera
  const prog = p.pl || p.df;
  if (prog) { cx.strokeStyle = p.pl ? '#FF3B30' : '#34C759'; cx.lineWidth = 6; cx.beginPath(); cx.arc(0, 0, R + 10, -Math.PI / 2, -Math.PI / 2 + prog / 100 * Math.PI * 2); cx.stroke(); }
  if (p.bl > .3) { cx.font = '16px sans-serif'; cx.textAlign = 'center'; cx.fillText('😵', R, -R); }
  cx.restore();
}
function draw(s, time, dt) {
  const eye = eyeOf(s), eyeD = eye && (G.disp[eye.id] || eye);
  const me = meOf(s);
  const land = VW > VH;
  SC = Math.min(VW, VH) / (land ? 700 : 640);
  // kameran följer ögat och tittar lite åt siktet
  let fxp = WW / 2, fyp = WH / 2;
  if (eyeD) { fxp = eyeD.x + Math.cos(eyeD.a) * (land ? 120 : 90); fyp = eyeD.y + Math.sin(eyeD.a) * (land ? 90 : 120); }
  { const hw = VW / 2 / SC, hh = VH / 2 / SC, m = 2 * CS - 40;   // håll kameran nära banan (yttersta raderna är vägg)
    fxp = hw * 2 >= WW - 2 * m ? WW / 2 : Math.max(hw + m, Math.min(WW - m - hw, fxp));
    fyp = hh * 2 >= WH - 2 * m ? WH / 2 : Math.max(hh + m, Math.min(WH - m - hh, fyp)); }
  CAM.x += (fxp - CAM.x) * Math.min(1, dt * 6); CAM.y += (fyp - CAM.y) * Math.min(1, dt * 6);
  if (!eyeD) { CAM.x = WW / 2; CAM.y = WH / 2; SC = Math.min(VW / (WW + 100), VH / (WH + 100)); }
  const sh = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0, sh2 = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0;
  const world = (c) => c.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (VW / 2 - CAM.x * SC + sh), DPR * (VH / 2 - CAM.y * SC + sh2));
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = '#4A3519'; cx.fillRect(0, 0, VW, VH);
  world(cx);
  cx.drawImage(MAPC, 0, 0, WW, WH);
  // sikt
  let sm = [];
  if (eyeD) sm = computeVision(s, eyeD.x, eyeD.y); else { VISIBLE.clear(); for (const p of s.P) if (p.al) VISIBLE.add(p.id); }
  // utslagna
  for (const b of G.bodies) { cx.globalAlpha = .55; cx.fillStyle = '#00000044'; cx.beginPath(); cx.arc(b.x, b.y, 18, 0, 7); cx.fill(); cx.fillStyle = TEAMC[b.s] + '99'; cx.beginPath(); cx.arc(b.x, b.y, 14, 0, 7); cx.fill(); cx.globalAlpha = 1; cx.font = '16px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('💫', b.x, b.y); }
  // laddningen på marken
  if (s.B && !s.B.c && !s.B.pl && s.ph !== 'end' || (s.B && s.B.pl)) {
    const b = s.B; cx.fillStyle = '#2B2B2B'; rr(cx, b.x - 14, b.y - 9, 28, 18, 4); cx.fill(); cx.fillStyle = '#C0392B'; cx.fillRect(b.x - 10, b.y - 5, 8, 10);
    if (b.pl) { const on = Math.sin(time * (8 + (35 - s.bt) * .6)) > 0; cx.fillStyle = on ? '#FF3B30' : '#661111'; cx.beginPath(); cx.arc(b.x + 6, b.y, 4, 0, 7); cx.fill(); if (on) { cx.fillStyle = '#FF3B3033'; cx.beginPath(); cx.arc(b.x, b.y, 40, 0, 7); cx.fill(); } }
  }
  // granater i luften
  for (const n of s.N) { cx.fillStyle = '#00000044'; cx.beginPath(); cx.arc(n[0] + 3, n[1] + 4, 7, 0, 7); cx.fill(); cx.fillStyle = n[2] === 'he' ? '#3E5A2A' : n[2] === 'smoke' ? '#9AA0A6' : '#E8E8E8'; cx.beginPath(); cx.arc(n[0], n[1], 7, 0, 7); cx.fill(); cx.strokeStyle = '#2B2350'; cx.lineWidth = 2; cx.stroke(); }
  // spelare (fiender bara om de syns)
  const mySide = me ? me.s : eye ? eye.s : -1;
  for (const p of s.P) {
    if (!p.al || p.out) continue;
    if (p.s !== mySide && !VISIBLE.has(p.id)) continue;
    drawPlayer(p, G.disp[p.id] || p, time);
  }
  // skottlinjer och mynningsflammor
  for (const t of FX.tracers) { cx.globalAlpha = 1 - t.life / .09; cx.strokeStyle = t.w === 'sniper' ? '#FFFFFF' : '#FFE27A'; cx.lineWidth = t.w === 'sniper' ? 4 : 2.5; cx.beginPath(); cx.moveTo(t.x1, t.y1); cx.lineTo(t.x2, t.y2); cx.stroke(); }
  cx.globalAlpha = 1;
  for (const f of FX.flashes) { cx.fillStyle = '#FFF2B0'; cx.beginPath(); cx.arc(f.x, f.y, 10, 0, 7); cx.fill(); }
  // dimma utanför sikten
  if (eyeD) {
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalCompositeOperation = 'source-over'; fx.clearRect(0, 0, FOG.width, FOG.height);
    fx.fillStyle = 'rgba(20,12,4,.72)'; fx.fillRect(0, 0, FOG.width, FOG.height);
    world(fx); fx.globalCompositeOperation = 'destination-out';
    fx.beginPath(); fx.moveTo(POLY[0], POLY[1]); for (let i = 1; i < NR; i++) fx.lineTo(POLY[i * 2], POLY[i * 2 + 1]); fx.closePath(); fx.fill();
    fx.globalCompositeOperation = 'source-over';
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(FOG, 0, 0); world(cx);
  }
  // lagkamrater syns alltid (även bakom väggar – lite genomskinliga)
  for (const p of s.P) {
    if (!p.al || p.out || p.s !== mySide || VISIBLE.has(p.id)) continue;
    drawPlayer(p, G.disp[p.id] || p, time, .5);
  }
  // utlagd laddning syns för alla
  if (s.B && s.B.pl) { cx.font = '26px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('💣', s.B.x, s.B.y - 34 + Math.sin(time * 6) * 3); }
  // rök
  for (const a of sm) {
    if (a.r <= 1) continue;
    const al = Math.min(1, a.t / .6) * (a.t > 12 ? Math.max(0, 13 - a.t) : 1);
    for (let k = 0; k < 7; k++) { const ang = k / 7 * Math.PI * 2 + a.t * .1, rr2 = a.r * .45; cx.fillStyle = `rgba(${200 + k * 5},${200 + k * 5},${205 + k * 5},${.55 * al})`; cx.beginPath(); cx.arc(a.x + Math.cos(ang) * rr2, a.y + Math.sin(ang) * rr2, a.r * .62, 0, 7); cx.fill(); }
    cx.fillStyle = `rgba(225,225,230,${.85 * al})`; cx.beginPath(); cx.arc(a.x, a.y, a.r * .8, 0, 7); cx.fill();
  }
  // effekter
  for (const p of FX.parts) { cx.globalAlpha = Math.max(0, 1 - p.life / p.max); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
  for (const r of FX.rings) { cx.globalAlpha = Math.max(0, 1 - r.life / .45); cx.strokeStyle = r.c; cx.lineWidth = r.w; cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, 7); cx.stroke(); }
  cx.globalAlpha = 1;
  // namn och liv
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  for (const p of s.P) {
    if (!p.al || p.out) continue;
    const friend = p.s === mySide;
    if (!friend && !VISIBLE.has(p.id)) continue;
    const D = G.disp[p.id] || p, y = D.y - 36;
    const nc = p.id === G.me ? '#FFD23F' : p.s ? '#9CC3FF' : '#FF9C94';
    cx.font = 'bold 15px Fredoka, sans-serif'; cx.lineWidth = 4; cx.strokeStyle = '#000a'; const nmT = p.n + (p.bot >= 0 ? ' 🤖' : '');
    cx.strokeText(nmT, D.x, y - 5); cx.fillStyle = nc; cx.fillText(nmT, D.x, y - 5);
    cx.fillStyle = '#000a'; rr(cx, D.x - 26, y, 52, 7, 3); cx.fill();
    cx.fillStyle = friend ? (p.hp > 35 ? '#34C759' : '#FFD23F') : '#FF4D4D'; rr(cx, D.x - 25, y + 1, 50 * Math.max(0, p.hp / 100), 5, 2); cx.fill();
  }
  for (const t of FX.texts) { cx.globalAlpha = Math.max(0, 1 - t.life); cx.font = `bold ${t.s}px Fredoka, sans-serif`; cx.lineWidth = 5; cx.strokeStyle = '#2B2350'; cx.strokeText(t.t, t.x, t.y); cx.fillStyle = t.c; cx.fillText(t.t, t.x, t.y); }
  cx.globalAlpha = 1;
  // skärmläge
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (FX.red > 0) { const g = cx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .3, VW / 2, VH / 2, Math.max(VW, VH) * .7); g.addColorStop(0, '#ff000000'); g.addColorStop(1, `rgba(255,0,0,${FX.red})`); cx.fillStyle = g; cx.fillRect(0, 0, VW, VH); }
  if (eye && eye.bl > 0) { cx.fillStyle = `rgba(255,255,255,${Math.min(1, eye.bl / 1.6)})`; cx.fillRect(0, 0, VW, VH); }
  drawSticks();
  drawMini(s, eye, mySide);
}
function drawSticks() {
  const R = STR();
  const one = (st, defX, defY) => {
    const ox = st ? st.ox : defX, oy = st ? st.oy : defY;
    cx.globalAlpha = st ? .45 : .16; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ox, oy, R, 0, 7); cx.fill();
    cx.globalAlpha = st ? .9 : .28; cx.beginPath(); cx.arc(st ? st.x : ox, st ? st.y : oy, R * .45, 0, 7); cx.fill(); cx.globalAlpha = 1;
  };
  if (MOUSE.used && !STK.m && !STK.a) return;
  const by = VH - R - 30 - SAFE.b;
  one(STK.m, R + 34, by); one(STK.a, VW - R - 34, by);
}
const MINI = document.createElement('canvas'); MINI.width = 0;
function drawMini(s, eye, mySide) {
  const mw = Math.min(140, VW * .3), k = mw / WW, mh = WH * k;
  const x0 = SAFE.l + 6, y0 = SAFE.t + 56;
  if (!MINI.width) {
    MINI.width = GW * 8; MINI.height = GH * 8; const g = MINI.getContext('2d');
    g.fillStyle = '#000000aa'; g.fillRect(0, 0, MINI.width, MINI.height);
    g.fillStyle = '#D8B577aa'; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y * GW + x] !== 1) g.fillRect(x * 8, y * 8, 8, 8);
    g.fillStyle = '#fff'; g.font = 'bold 34px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const kk of ['A', 'B']) g.fillText(kk, SITES[kk].label[0] * 8, SITES[kk].label[1] * 8);
  }
  cx.drawImage(MINI, x0, y0, mw, mh);
  for (const p of s.P) {
    if (!p.al || p.out) continue;
    if (p.s !== mySide && !VISIBLE.has(p.id)) continue;
    cx.fillStyle = p.id === G.me ? '#FFD23F' : TEAMC[p.s]; cx.beginPath(); cx.arc(x0 + p.x * k, y0 + p.y * k, p.id === G.me ? 3.5 : 2.6, 0, 7); cx.fill();
  }
  if (s.B && (s.B.pl || mySide === 0) && (s.B.c || s.B.pl || s.ph !== 'end')) {
    let bx = s.B.x, by = s.B.y; if (s.B.c) { const c = s.P.find(p => p.id === s.B.c); if (c) { bx = c.x; by = c.y; } }
    { cx.fillStyle = s.B.pl ? '#FF3B30' : '#FFB300'; cx.fillRect(x0 + bx * k - 2.5, y0 + by * k - 2.5, 5, 5); }
  }
  cx.strokeStyle = '#fff8'; cx.lineWidth = 1; cx.strokeRect(x0, y0, mw, mh);
}

/* ================= NÄTVERK ================= */
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = netJoinCardHTML('card') + `
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Wifi-matchen startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen här.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>
    <p class="note" style="text-align:center;color:#fff">Du spelar som ${esc(charName(ME.ch))}.</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'ops.html');
  };
  netBindJoinCard((page, code) => `${page}?online=${encodeURIComponent(code)}&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}&back=${encodeURIComponent(location.href.split('?')[0])}`);
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">🎯</span> Letar efter matcher…</p>`;
  window.onNetScan = list => {
    scanning = false;
    if (current !== 'join' || !$('found')) return;
    $('found').innerHTML = list.length ? list.map(m => { const g = netGameOf(m.name); return `<button class="btn blue" data-ip="${esc(m.ip)}" data-port="${m.port}" data-page="${g.page}">${esc(g.label)}</button>`; }).join('')
      : `<p class="note">Hittade ingen match. Be värden trycka 📡 Starta nätverksmatch – och kolla att ni är på samma wifi.</p>`;
    $('found').querySelectorAll('[data-ip]').forEach(b => b.onclick = () => { SFX.tap(); goJoin(b.dataset.ip, +b.dataset.port, b.dataset.page); });
  };
  try { Android.netScan(); } catch (e) { scanning = false; }
}
function goJoin(ip, port, page) {
  const back = location.href.split('?')[0];
  location.href = `http://${ip}:${port || PORT}/${page}?n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}&back=${encodeURIComponent(back)}`;
}
function startOnline() { location.href = netOnlineHostURL('ops.html', `n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`); }
function startHosting() {
  let r = null;
  try { r = JSON.parse(Android.netHost('ops:' + charName(ME.ch) + 's ökenstad')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/ops.html?host=1&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`;
}
function leave() {
  if (G.mode === 'host' || HOSTPAGE) {
    try { HOST.ws && HOST.ws.close(); } catch (e) { } HOST.ws = null;
    try { Android.netStop(); } catch (e) { }
    location.href = NET_ONLINE ? 'ops.html' : APP_HOME + 'ops.html'; return;
  }
  if (CLIENT) {
    CL.closing = true; try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (NET_ONLINE) location.href = 'ops.html';
    else if (window.Android) location.href = APP_HOME + 'ops.html';
    else { G.mode = 'local'; show('menu'); }
    return;
  }
  show('menu');
}

/* ----- värd ----- */
const HOST = { ws: null, lobby: [], ok: false, inGame: false, set: Object.assign({ fill: 0, diff: 1, win: 1 }, store.get('hostSet', {})) };
const smallSide = list => list.filter(p => p.side === 1).length < list.filter(p => p.side === 0).length ? 1 : 0;
function hostStart() {
  G.mode = 'host'; G.me = 'h';
  HOST.lobby = [{ id: 'h', name: myName(), ch: ME.ch, side: 0 }];
  hostConnect(); show('lobby');
}
function hostConnect() {
  const ws = netSocket(true);
  HOST.ws = ws;
  ws.onopen = () => { HOST.ok = true; buildLobby(); };
  ws.onmessage = e => hostRecv(e.data);
  ws.onclose = () => { HOST.ok = false; if (HOST.ws === ws) setTimeout(() => { if (HOST.ws === ws) hostConnect(); }, 1000); };
}
const hostAll = o => { if (HOST.ws && HOST.ws.readyState === 1) HOST.ws.send('*' + JSON.stringify(o)); };
const hostTo = (id, o) => { if (HOST.ws && HOST.ws.readyState === 1) HOST.ws.send('@' + id.slice(1) + '|' + JSON.stringify(o)); };
function hostRecv(d) {
  if (d[0] === '+') return;
  if (d[0] === '-') {
    const id = 'c' + d.slice(1);
    const p = HOST.lobby.find(q => q.id === id);
    HOST.lobby = HOST.lobby.filter(q => q.id !== id);
    if (HOST.inGame && G.game) { G.game.removePlayer(id); if (p) G.game.emit('left', { n: p.name }); }
    return hostLobby();
  }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    const p = { id, name: String(m.name || 'Spelare').slice(0, 14), ch: Math.abs(m.ch | 0) % CHARS.length };
    const old = HOST.lobby.find(q => q.id === id);
    if (old) Object.assign(old, p); else { p.side = smallSide(HOST.lobby); HOST.lobby.push(p); SFX.pick(); buzz(15); }
    hostTo(id, { t: 'welcome', id });
    hostLobby();
    // matchen pågår: med från nästa rond
    if (HOST.inGame && G.game && !G.game.over) {
      const gp = G.game.P.find(q => q.id === id);
      if (!gp) { const lp = HOST.lobby.find(q => q.id === id); G.game.addPlayer({ id, name: lp.name, ch: lp.ch, side: smallSide(G.game.P.filter(q => !q.out)), bot: -1 }, false); }
      else gp.out = false;
      hostTo(id, { t: 'start' });
    }
  } else if (m.t === 'side') {
    const p = HOST.lobby.find(q => q.id === id); if (p && !HOST.inGame) { p.side = p.side ? 0 : 1; hostLobby(); }
  } else if (m.t === 'in') {
    if (HOST.inGame && G.game) G.game.setInput(id, m.i);
  }
}
function lobbyMsg() { return { t: 'lobby', players: HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch, side: p.side | 0 })), inGame: HOST.inGame, host: myName(), set: HOST.set }; }
function hostLobby() { hostAll(lobbyMsg()); if (current === 'lobby') buildLobby(); }
const FILLS = [[0, 'Inga'], [2, '2 mot 2'], [3, '3 mot 3'], [5, '5 mot 5']];
function hostBegin() {
  const S = HOST.set;
  const pl = HOST.lobby.map(p => ({ id: p.id, name: p.id === 'h' ? myName() : p.name, ch: p.id === 'h' ? ME.ch : p.ch, side: p.side | 0, bot: -1 }));
  if (S.fill) fillBots(pl, S.fill, DIFF[S.diff].lv);
  if (!pl.some(p => p.side === 0) || !pl.some(p => p.side === 1)) {
    panel(`<h3>Båda lagen behöver spelare</h3><p>Byt lag på någon – eller fyll på med datorspelare.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return;
  }
  HOST.inGame = true; G.resSent = false; G.mode = 'host'; G.kind = 'net';
  begin(new OPS.Game(pl, { win: winOf(S.win) }), 'h');
  hostAll({ t: 'start' });
  hostLobby();
}

/* ----- klient ----- */
const CL = { ws: null, id: null, lobby: null, closing: false, tries: 0 };
function clientStart() { G.mode = 'client'; pickFigure('Vem spelar?', clientConnect, leave); }
function clientConnect() {
  CL.closing = false;
  const ws = netSocket(false);
  CL.ws = ws;
  panel(`<h3>Ansluter… <span class="spin">🎯</span></h3>`);
  ws.onopen = () => { CL.tries = 0; closePanel(); ws.send(JSON.stringify({ t: 'hi', name: myName(), ch: ME.ch })); if (current !== 'game') show('lobby'); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } clientRecv(m); };
  ws.onclose = () => {
    if (CL.ws !== ws || CL.closing) return;
    if (CL.tries++ < 3 && CL.id) { setTimeout(clientConnect, 800); return; }
    panel(`<h3>Tappade kontakten 📡</h3><p>Är värden kvar?</p><button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white small" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); CL.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); leave(); };
  };
}
const clSend = o => { if (CL.ws && CL.ws.readyState === 1) CL.ws.send(JSON.stringify(o)); };
function clientRecv(m) {
  if (m.t === 'welcome') { CL.id = m.id; }
  else if (m.t === 'lobby') { CL.lobby = m; if (current === 'lobby') buildLobby(); }
  else if (m.t === 'start') { G.mode = 'client'; G.kind = 'net'; G.game = null; G.snap = null; G.me = CL.id; G.lastEv = 0; G.endShown = false; G.endT = 0; G.res = null; G.disp = {}; G.bodies = []; FX.reset(); closePanel(); $('feed').innerHTML = ''; show('game'); }
  else if (m.t === 's') {
    if (current !== 'game') return;
    // händelser som inte hunnit visas följer med till nästa läge
    const keep = G.snap && G.snap.ev ? G.snap.ev.filter(e => e.id > G.lastEv) : [];
    if (keep.length) m.s.ev = keep.concat(m.s.ev);
    G.snap = m.s;
  }
  else if (m.t === 'res') { G.res = m; }
  else if (m.t === 'abort') { closePanel(); G.snap = null; show('lobby'); }
  else if (m.t === 'hostgone') { CL.closing = true; panel(`<h3>Matchen är slut 👋</h3><p>Värden avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); leave(); }; }
}

function buildLobby() {
  if (current !== 'lobby') return;
  const isHost = G.mode === 'host';
  const L = isHost ? lobbyMsg() : (CL.lobby || { players: [], inGame: false, set: HOST.set });
  const myId = isHost ? 'h' : CL.id, S = L.set || HOST.set;
  const me = L.players.find(p => p.id === myId);
  const col = sd => L.players.filter(p => (p.side | 0) === sd).map(p => `<div class="pl ${p.id === myId ? 'mine' : ''}" style="${styleOf(p.ch)};border-left:8px solid ${TEAMC[sd]}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' 👑' : ''}</span></div>`).join('') || '<p class="note">Ingen än…</p>';
  let side = '';
  if (isHost) {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/ops.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="card"><h4>📲 Bjud in familjen</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: Operation Öken → 🔗 Gå med.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
    if (NET_ONLINE) side = netHostCardHTML('ops.html', 'card', HOST.ok);
  }
  const sets = isHost ? `<div class="opts">${seg('fill', FILLS, S.fill, '🤖 Fyll med datorn')}${S.fill ? seg('diff', DIFF.map((d, i) => [i, d.n]), S.diff, '⭐ Datorns nivå') : ''}${seg('win', WINS.map((v, i) => [i, String(v)]), S.win, '🏆 Ronder för vinst')}</div>`
    : `<p class="note">🏆 Först till ${winOf(S.win)} ronder${S.fill ? ` · 🤖 fylls på till ${S.fill} mot ${S.fill}` : ''}</p>`;
  $('lobbyBox').innerHTML = `<div class="gar"><div class="card"><h4>👥 Lagen (${L.players.length})</h4>
      <div class="sides" style="align-items:start"><div class="plist"><b style="color:${TEAMC[0]}">🔴 ${TEAMN[0]}</b>${col(0)}</div><div class="plist"><b style="color:${TEAMC[1]}">🔵 ${TEAMN[1]}</b>${col(1)}</div></div>
      ${me && !L.inGame ? `<button class="btn white small" id="swSide">🔁 Byt till ${TEAMN[me.side ? 0 : 1].toLowerCase()}</button>` : ''}
      ${sets}
      ${isHost ? `<button class="btn green" id="gStart" ${HOST.ok && !L.inGame ? '' : 'disabled'}>🎯 Starta matchen!</button>` : `<p class="wait" style="text-align:center;font-weight:600">${L.inGame ? 'Matchen pågår… du är med från nästa rond 🎯' : `Väntar på att ${esc(L.host || 'värden')} startar ⏳`}</p>`}
      <p class="note">Röda lägger ut laddningen på A eller B, blå försvarar. Först till ${winOf(S.win)} vunna ronder vinner.</p></div>
    <div style="display:flex;flex-direction:column;gap:12px">${side}</div></div>`;
  if (isHost) $('lobbyBox').querySelectorAll('.seg button').forEach(b => b.onclick = () => { HOST.set[b.parentNode.dataset.s] = segVal(b); store.set('hostSet', HOST.set); SFX.tap(); hostLobby(); });
  if ($('swSide')) $('swSide').onclick = () => { SFX.tap(); if (isHost) { const p = HOST.lobby.find(q => q.id === 'h'); p.side = p.side ? 0 : 1; hostLobby(); } else clSend({ t: 'side' }); };
  if ($('gStart')) $('gStart').onclick = () => { SFX.tap(); hostBegin(); };
  if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildLobby(); };
}
$('lobbyBack').onclick = () => {
  SFX.tap();
  panel(`<h3>${G.mode === 'host' ? 'Avsluta matchen?' : 'Lämna?'}</h3><button class="btn pink" id="pYes">🚪 ${G.mode === 'host' ? 'Avsluta' : 'Lämna'}</button><button class="btn white small" id="pNo">Stanna kvar</button>`);
  $('pYes').onclick = () => { SFX.tap(); closePanel(); leave(); };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); };
};

/* ---------- hjälp ---------- */
function help() {
  panel(`<h3>Så spelar man 🎯</h3>
    <p style="text-align:left;font-size:16px">🔴 <b>Röda laget</b> ska lägga ut sprängladdningen 💣 på <b>A</b> eller <b>B</b> och skydda den tills den smäller.<br>
    🔵 <b>Blå laget</b> försvarar – och desarmerar 🔧 laddningen om den ligger ute.<br>
    Ett lag vinner också ronden om alla motståndare är utslagna. Tar tiden slut vinner blå.<br>
    🛒 <b>Köp</b> vapen, väst och granater i början av ronden. Pengar 💰 får du för träffar och ronder.<br>
    👈 Vänster tumme: gå · 👉 Höger tumme: sikta – dra långt för att skjuta, eller håll in den röda 🔫 SKJUT-knappen (i pausmenyn kan du stänga av att spaken skjuter).<br>
    🔄 ladda om · 🔁 byt vapen · 💣 handgranat · 💨 rök (går inte att se igenom) · ⚡ bländgranat.<br>
    👀 Du ser bara det som syns från där du står – väggar och rök skymmer!<br>
    🖥️ Dator: WASD går, musen siktar, klick eller mellanslag skjuter, R laddar, Q byter, G/C/F granater, E (håll) lägger ut/desarmerar, B köper.</p>
    <button class="btn green" id="pClose">👍 Kör!</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('meCard').onclick = () => { SFX.tap(); pickFigure('Vem spelar?', () => show('menu')); };
$('toQuick').onclick = () => { SFX.tap(); show('quick'); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toOnline').onclick = () => { SFX.tap(); startOnline(); };
$('toHelp').onclick = () => { SFX.tap(); help(); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
$('overlay').addEventListener('pointerdown', e => { if (e.target === $('overlay') && BUY.open) closePanel(); });

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if (BUY.open) { closePanel(); return true; }
    for (const id of ['pClose', 'pNo', 'pMenu', 'pLobby', 'pLeave', 'pOk']) if ($(id)) { $(id).click(); return true; }
    return true;
  }
  if (current === 'game') { $('gBack').click(); return true; }
  if (current === 'lobby') { $('lobbyBack').click(); return true; }
  if (current === 'meScr') { $('meBack').click(); return true; }
  if (current === 'menu') { if (REMOTE) { if (window.Android) location.href = APP_HOME + 'index.html'; else leave(); } else goHub(); return true; }
  show('menu'); return true;
};

bubbles();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu');
