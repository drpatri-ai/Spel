/* Bucinca Stridsvagnar – menyer, garage (vagnar + uppgraderingar), XP, uppdrag, snabbmatch, nätverk, styrning och ritning. */
'use strict';
const store = makeStore('bw');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = location.protocol === 'http:' && location.port === String(PORT);
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const { MODELS, SPECIAL, MAPS, W: WW, H: WH } = TK;
const MODEL_IDS = ['bjorn', 'vessla', 'mammut', 'drake'];

const SFX = Object.assign({}, CORE_SFX, {
  fire: near => { tone(110, .18, { to: 50, vol: .22 * near }); noise(.14, { type: 'lowpass', f: 900, vol: .3 * near }); },
  hit: near => { tone(700, .06, { type: 'square', vol: .06 * near, to: 300 }); noise(.08, { f: 2200, q: 2, vol: .15 * near }); },
  boom: near => { noise(.7, { type: 'lowpass', f: 450, vol: .55 * near }); tone(70, .5, { to: 30, vol: .35 * near }); },
  bounce: near => tone(1400, .04, { type: 'triangle', vol: .04 * near, to: 900 }),
  pick: () => [784, 1047, 1319].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .1, delay: i * .06 })),
  crate: near => { noise(.15, { f: 600, q: 1, vol: .2 * near }); tone(200, .1, { type: 'square', vol: .04 * near, to: 90 }); },
  special: () => tone(300, .35, { to: 1100, type: 'sawtooth', vol: .07 }),
  shield: () => tone(500, .4, { to: 900, type: 'sine', vol: .1 }),
  go: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, { type: 'square', vol: .07, delay: i * .1 })),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 }))
});

/* ---------- jag ---------- */
const ME = { ch: store.get('ch', 0) };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
const myName = () => REMOTE && Q.get('n') && +Q.get('c') === ME.ch ? Q.get('n').slice(0, 14) : charName(ME.ch);
const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

/* ---------- profil: nivå, XP, vagn och uppgraderingar per figur ---------- */
const UPG = [
  { k: 'arm', ic: '🛡️', n: 'Pansar', d: 'Mer liv' },
  { k: 'eng', ic: '⚙️', n: 'Motor', d: 'Kör fortare' },
  { k: 'gun', ic: '💥', n: 'Kanon', d: 'Mer skada per skott' },
  { k: 'rel', ic: '⏱️', n: 'Laddning', d: 'Skjuter oftare' },
  { k: 'vel', ic: '🎯', n: 'Kulfart', d: 'Snabbare kulor – lättare att träffa' },
  { k: 'spc', ic: '✨', n: 'Special', d: 'Specialförmågan laddas snabbare' }
];
const UPG_MAX = 5, LVL_MAX = 1 + UPG.length * UPG_MAX;
const xpNeed = l => 100 + l * 35;
const PROF = {
  get() {
    let raw = null;
    try { if (window.Android && Android.profGet) raw = Android.profGet('tank') || null; } catch (e) { }
    let v = null; try { v = raw ? JSON.parse(raw) : store.get('prof', null); } catch (e) { }
    v = v && typeof v === 'object' ? v : {}; v.figs = v.figs || {}; v.mis = v.mis || {}; return v;
  },
  set(v) { try { if (window.Android && Android.profSet) Android.profSet('tank', JSON.stringify(v)); } catch (e) { } store.set('prof', v); }
};
let prof = PROF.get();
function figOf(ch) {
  const f = prof.figs[ch] || (prof.figs[ch] = { lvl: 1, xp: 0, up: {}, model: 'bjorn' });
  f.lvl = Math.max(1, Math.min(LVL_MAX, f.lvl | 0)); f.xp = Math.max(0, f.xp | 0); f.up = TK.cleanUp(f.up);
  if (!MODELS[f.model] || MODELS[f.model].lvl > f.lvl) f.model = 'bjorn';
  return f;
}
const freePts = f => (f.lvl - 1) - UPG.reduce((a, u) => a + f.up[u.k], 0);
function addXp(ch, n) {
  const f = figOf(ch), before = f.lvl;
  f.xp += n;
  while (f.lvl < LVL_MAX && f.xp >= xpNeed(f.lvl)) { f.xp -= xpNeed(f.lvl); f.lvl++; }
  if (f.lvl >= LVL_MAX) f.xp = 0;
  PROF.set(prof);
  return f.lvl - before;
}
const myTankSpec = ch => { const f = figOf(ch); return { ch, name: charName(ch), model: f.model, up: f.up }; };

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'garage') buildGarage();
  if (id === 'missions') buildMissions();
  if (id === 'quick') buildQuick();
  if (id === 'join') buildJoin();
  if (id === 'lobby') buildLobby();
  if (id === 'game') resize();
  if (window.Android && Android.keepAwake) try { Android.keepAwake(id === 'game' || id === 'lobby'); } catch (e) { }
}
function panel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }

function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Stridsvagnar 🪖', 'l2');
  const f = figOf(ME.ch);
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Förare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:3px"><span class="chip">Nivå ${f.lvl}</span><span class="chip">${MODELS[f.model].name}</span>${freePts(f) > 0 ? '<span class="chip" style="background:#34C759;color:#fff">⬆️ Uppgradera!</span>' : ''}</div></div>`;
  $('toHost').classList.toggle('hidden', !canHost());
}
function pickFigure(title, done, back) {
  $('meTitle').textContent = title;
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b><span class="chip" style="font-size:12px">Nivå ${figOf(i).lvl}</span></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    ME.ch = +el.dataset.i; store.set('ch', ME.ch); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(done, 220);
  });
  $('meBack').onclick = () => { SFX.tap(); (back || (() => show('menu')))(); };
  show('meScr');
}

/* ---------- garage ---------- */
function buildGarage() {
  const f = figOf(ME.ch), pts = freePts(f);
  const pip = n => '●'.repeat(n) + '○'.repeat(UPG_MAX - n);
  const ms = id => { const m = MODELS[id]; return `<div class="mst"><span>❤️ ${m.hp}</span><span>💨 ${m.spd}</span><span>💥 ${m.dmg}</span><span>${SPECIAL[m.sp].ic} ${SPECIAL[m.sp].name}</span></div>`; };
  $('garBox').innerHTML = `<div class="card" style="flex-direction:row;align-items:center;gap:12px" id="garMe">${avHTML(ME.ch, 'mini')}<div style="flex:1;min-width:0">
      <b style="font-size:19px">${esc(charName(ME.ch))}</b> <small style="color:var(--muted)">(tryck för att byta)</small>
      <div class="xpbar"><i style="width:${f.lvl >= LVL_MAX ? 100 : f.xp / xpNeed(f.lvl) * 100}%"></i><span>Nivå ${f.lvl}${f.lvl >= LVL_MAX ? ' (max)' : ` · ${f.xp}/${xpNeed(f.lvl)} XP`}</span></div></div></div>
    <div class="gar">
    <div class="card"><h4>🪖 Välj vagn</h4><div class="models">${MODEL_IDS.map(id => { const m = MODELS[id], lock = m.lvl > f.lvl;
      return `<button class="mdl ${f.model === id ? 'on' : ''} ${lock ? 'lock' : ''}" data-m="${id}">${lock ? `<span class="lk">🔒 Nivå ${m.lvl}</span>` : ''}<canvas width="150" height="115" data-pv="${id}"></canvas><b>${m.name}</b><small>${m.desc}</small>${ms(id)}</button>`; }).join('')}</div></div>
    <div class="card"><h4>${pts > 0 ? `⬆️ ${pts} poäng att fördela` : 'Inga poäng kvar – spela för mer XP!'}</h4>
      <p class="note">Varje ny nivå ger 1 poäng. Uppgraderingarna gäller alla vagnar för ${esc(charName(ME.ch))}.</p>
      <div class="upl">${UPG.map(u => `<div class="upr"><span class="ic">${u.ic}</span><div class="grow"><b>${u.n}</b> <span class="pips">${pip(f.up[u.k])}</span><small>${u.d}</small></div>
        <button class="btn green small" data-k="${u.k}" ${pts > 0 && f.up[u.k] < UPG_MAX ? '' : 'disabled'}>+</button></div>`).join('')}</div>
      ${UPG.some(u => f.up[u.k]) ? '<button class="btn white small" id="garReset">🔄 Fördela om poängen</button>' : ''}</div></div>`;
  $('garBox').querySelectorAll('canvas[data-pv]').forEach(c => { const x = c.getContext('2d'); x.translate(75, 62); x.scale(1.25, 1.25); drawTankBody(x, { m: c.dataset.pv, ch: ME.ch, a: -Math.PI / 2, ta: -Math.PI / 2 - .5, al: 1 }, 0); });
  $('garBox').querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    const ff = figOf(ME.ch), id = b.dataset.m;
    if (MODELS[id].lvl > ff.lvl) { SFX.bonk(); return; }
    ff.model = id; PROF.set(prof); SFX.pick(); buildGarage();
  });
  $('garBox').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const ff = figOf(ME.ch); if (freePts(ff) <= 0 || ff.up[b.dataset.k] >= UPG_MAX) return;
    ff.up[b.dataset.k]++; PROF.set(prof); SFX.pick(); buzz(15); buildGarage();
  });
  if ($('garReset')) $('garReset').onclick = () => { const ff = figOf(ME.ch); for (const u of UPG) ff.up[u.k] = 0; PROF.set(prof); SFX.tap(); buildGarage(); };
  $('garMe').onclick = () => { SFX.tap(); pickFigure('Vem kör?', () => show('garage'), () => show('garage')); };
}

/* ---------- uppdrag ---------- */
const N_MIS = 20;
function mission(i) {
  const n = Math.min(4, 1 + Math.floor(i / 4)), lv = Math.min(10, 1 + Math.floor(i * .5)), boss = i % 5 === 4;
  const r = TK.RNG(1000 + i), others = CHARS.map((_, k) => k).filter(k => k !== ME.ch);
  const pickCh = () => others.splice(Math.floor(r() * others.length), 1)[0] ?? Math.floor(r() * CHARS.length);
  const models = i < 3 ? ['bjorn'] : i < 8 ? ['bjorn', 'vessla'] : i < 13 ? ['bjorn', 'vessla', 'mammut'] : MODEL_IDS;
  const foes = [];
  for (let k = 0; k < (boss ? n - 1 : n); k++) foes.push({ ch: pickCh(), model: models[Math.floor(r() * models.length)], bot: Math.max(1, lv - (k > 0 ? 1 : 0)) });
  if (boss) foes.push({ ch: pickCh(), boss: 1, bot: Math.min(10, lv + 1) });
  return { i, map: i % MAPS.length, foes, boss, lv };
}
function buildMissions() {
  const done = prof.mis[ME.ch] || 0;
  $('misBox').innerHTML = `<div class="card" style="flex-direction:row;align-items:center;gap:12px">${avHTML(ME.ch, 'mini')}<div style="flex:1"><b style="font-size:18px">${esc(charName(ME.ch))}</b> <span class="chip">Nivå ${figOf(ME.ch).lvl}</span>
      <p class="note">Förstör alla fiender. Du har 3 liv per uppdrag. Klarade: ${done}/${N_MIS}</p></div></div>
    <div class="ladder">${Array.from({ length: N_MIS }, (_, i) => {
      const M = mission(i), st = i < done ? 'done' : i === done ? 'next' : 'locked';
      return `<div class="rung ${st} ${M.boss ? 'boss' : ''}"><span class="no">${M.boss ? '💀' : i + 1}</span><div class="avs">${M.foes.map(f => avHTML(f.ch)).join('')}</div>
        <div class="grow"><b>${M.boss ? 'Bossen!' : `Uppdrag ${i + 1}`}</b><small>${MAPS[M.map].name} · ${M.foes.length} fiende${M.foes.length > 1 ? 'r' : ''} · ${'⭐'.repeat(Math.ceil(M.lv / 2))}</small></div>
        ${st === 'done' ? `<button class="btn white" data-i="${i}">🔄</button>` : st === 'next' ? `<button class="btn green" data-i="${i}">▶️ Kör</button>` : '🔒'}</div>`;
    }).join('')}</div>`;
  $('misBox').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { SFX.tap(); startMission(+b.dataset.i); });
}
function startMission(i) {
  const M = mission(i);
  const pl = [Object.assign(myTankSpec(ME.ch), { id: 'me', team: 0, lives: 3 })];
  M.foes.forEach((f, k) => pl.push({ id: 'e' + k, name: charName(f.ch), ch: f.ch, model: f.model, boss: f.boss, bot: f.bot, up: TK.botUp(f.bot), team: 1, lives: 1 }));
  G.mode = 'local'; G.kind = 'mission'; G.mis = i;
  begin(new TK.Game(pl, { map: M.map, mode: 'mission', time: 0 }), 'me');
}

/* ---------- snabbmatch ---------- */
const QS = Object.assign({ bots: 3, diff: 1, map: 0, kl: 10 }, store.get('qs', {}));
const DIFF = [{ n: 'Lätt', lv: 2 }, { n: 'Medel', lv: 5 }, { n: 'Svår', lv: 8 }, { n: 'Proffs', lv: 10 }];
function seg(id, vals, cur, label) { return `<div class="opt"><b>${label}</b><div class="seg" data-s="${id}">${vals.map(v => `<button data-v="${v[0]}" class="${String(v[0]) === String(cur) ? 'on' : ''}">${v[1]}</button>`).join('')}</div></div>`; }
function buildQuick() {
  $('qBox').innerHTML = `<div class="card"><h4>Alla mot alla – först till flest träffar vinner</h4><div class="opts">
    ${seg('bots', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], QS.bots, '🤖 Motståndare')}
    ${seg('diff', DIFF.map((d, i) => [i, d.n]), QS.diff, '⭐ Svårighet')}
    ${seg('map', MAPS.map((m, i) => [i, m.name]), QS.map, '🗺️ Bana')}
    ${seg('kl', [[5, '5'], [10, '10'], [15, '15']], QS.kl, '🎯 Vinst vid')}
    </div><button class="btn green" id="qGo">⚔️ Kör!</button></div>`;
  $('qBox').querySelectorAll('.seg button').forEach(b => b.onclick = () => { QS[b.parentNode.dataset.s] = +b.dataset.v; store.set('qs', QS); SFX.tap(); buildQuick(); });
  $('qGo').onclick = () => { SFX.tap(); startQuick(); };
}
function startQuick() {
  const pl = [Object.assign(myTankSpec(ME.ch), { id: 'me' })];
  const others = CHARS.map((_, k) => k).filter(k => k !== ME.ch).sort(() => Math.random() - .5);
  const lv = DIFF[QS.diff].lv;
  for (let k = 0; k < QS.bots; k++) { const ch = others[k % others.length]; pl.push({ id: 'b' + k, name: charName(ch), ch, model: pick(MODEL_IDS), bot: lv, up: TK.botUp(lv) }); }
  G.mode = 'local'; G.kind = 'quick';
  begin(new TK.Game(pl, { map: QS.map, mode: 'ffa', killLimit: QS.kl, time: 180 }), 'me');
}

/* ================= MATCHEN ================= */
/* G.mode: 'local' | 'host' | 'client' */
const G = { mode: 'local', kind: 'quick', game: null, snap: null, me: 'me', lastEv: 0, acc: 0, endShown: false, endT: 0, res: null, sendN: 0, mis: 0, disp: {} };
function begin(game, me) {
  G.game = game; G.me = me; G.snap = game ? game.snap() : null; G.lastEv = 0; G.endShown = false; G.endT = 0; G.res = null; G.disp = {};
  FX.reset(); closePanel(); show('game'); prepMap(G.snap ? G.snap.map : 0);
  $('feed').innerHTML = '';
  $('hint').classList.remove('hidden'); setTimeout(() => $('hint').classList.add('hidden'), 6000);
}
let paused = false;

/* ---------- styrning: två tumspakar + specialknapp, eller tangentbord och mus ---------- */
const INP = { mx: 0, my: 0, ax: 0, ay: 0, fire: 0, sp: 0 };
const STK = { m: null, a: null };     // { id, ox, oy, x, y }
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
const MOUSE = { x: 0, y: 0, down: false, used: false };
const KEYS = {};
addEventListener('keydown', e => { if (current !== 'game') return; KEYS[e.code] = true; if (e.code === 'Space' || e.code === 'KeyE') { INP.sp = 1; e.preventDefault(); } });
addEventListener('keyup', e => { KEYS[e.code] = false; });
function updStick() {
  const R = STR();
  const v = s => { if (!s) return [0, 0, 0]; let dx = s.x - s.ox, dy = s.y - s.oy; const l = Math.hypot(dx, dy); if (l > R) { s.ox = s.x - dx / l * R; s.oy = s.y - dy / l * R; dx = s.x - s.ox; dy = s.y - s.oy; } return [dx / R, dy / R, Math.min(1, l / R)]; };
  const m = v(STK.m), a = v(STK.a);
  INP.mx = m[0]; INP.my = m[1];
  if (STK.a) { if (a[2] > .25) { INP.ax = a[0]; INP.ay = a[1]; } INP.fire = a[2] > .45 ? 1 : 0; } else INP.fire = 0;
}
function readInput() {
  // tangentbord + mus (dator)
  let kx = 0, ky = 0;
  if (KEYS.KeyA || KEYS.ArrowLeft) kx -= 1; if (KEYS.KeyD || KEYS.ArrowRight) kx += 1;
  if (KEYS.KeyW || KEYS.ArrowUp) ky -= 1; if (KEYS.KeyS || KEYS.ArrowDown) ky += 1;
  const out = Object.assign({}, INP);
  if (kx || ky) { out.mx = kx; out.my = ky; }
  if (MOUSE.used) {
    const t = G.snap && G.snap.T.find(q => q.id === G.me);
    if (t) { const [sx, sy] = toScreen(t.x, t.y); out.ax = MOUSE.x - sx; out.ay = MOUSE.y - sy; const l = Math.hypot(out.ax, out.ay) || 1; out.ax /= l; out.ay /= l; }
    if (MOUSE.down) out.fire = 1;
  }
  // siktehjälp för tumspaken: dra siktet mot närmaste fiende inom en liten vinkel
  if (STK.a && G.snap && Math.hypot(out.ax, out.ay) > .2) {
    const me = G.snap.T.find(t => t.id === G.me);
    if (me && me.al) {
      const aim = Math.atan2(out.ay, out.ax); let best = null, bd = .3;
      for (const t of G.snap.T) {
        if (!t.al || t.id === G.me || (G.snap.mode === 'mission' && t.tm === me.tm)) continue;
        const d = Math.hypot(t.x - me.x, t.y - me.y); if (d > 800) continue;
        const da = Math.abs(angD(aim, Math.atan2(t.y - me.y, t.x - me.x))); if (da < bd) { bd = da; best = t; }
      }
      if (best) { const a2 = Math.atan2(best.y - me.y, best.x - me.x); out.ax = Math.cos(a2); out.ay = Math.sin(a2); }
    }
  }
  INP.sp = 0;
  return out;
}
const spBtn = $('spb');
spBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); INP.sp = 1; buzz(20); });

let lastSent = '', lastSendT = 0;
function pushInput(now) {
  const inp = readInput();
  if (G.mode === 'client') {
    const key = [inp.mx.toFixed(2), inp.my.toFixed(2), inp.ax.toFixed(2), inp.ay.toFixed(2), inp.fire, inp.sp].join();
    if (inp.sp || (key !== lastSent && now - lastSendT > 45) || now - lastSendT > 400) { lastSent = key; lastSendT = now; clSend({ t: 'in', i: inp }); }
  } else if (G.game) G.game.setInput(G.me, inp);
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
    while (G.acc >= TK.DT && n < 8) { G.game.step(); G.acc -= TK.DT; n++; if (G.mode === 'host' && (++G.sendN % 2 === 0)) hostAll({ t: 's', s: G.game.snap() }); }
    G.snap = G.game.snap();
    if (G.mode === 'host' && G.game.over && !G.resSent) { G.resSent = true; hostAll({ t: 's', s: G.snap }); hostAll({ t: 'res', r: G.game.result(), w: G.game.winner }); }
  }
  smooth(dt);
  handleEvents(G.snap);
  updHud(G.snap);
  FX.tick(dt);
  draw(G.snap, now / 1000, dt);
  if (G.snap.ov && !G.endShown) { G.endT += dt; if (G.endT > 2.2 && (G.mode !== 'client' || G.res)) { G.endShown = true; showResult(); } }
}
requestAnimationFrame(loop);
function smooth(dt) {
  // mjuka rörelser (särskilt för klienter som får 30 lägen/s)
  for (const t of G.snap.T) {
    const d = G.disp[t.id] || (G.disp[t.id] = { x: t.x, y: t.y, a: t.a, ta: t.ta, odo: 0 });
    const k = G.mode === 'client' ? Math.min(1, dt * 16) : 1;
    const jump = Math.hypot(t.x - d.x, t.y - d.y) > 150;
    const nx = jump ? t.x : d.x + (t.x - d.x) * k, ny = jump ? t.y : d.y + (t.y - d.y) * k;
    d.odo += Math.hypot(nx - d.x, ny - d.y); d.moved = Math.hypot(nx - d.x, ny - d.y);
    d.x = nx; d.y = ny;
    d.a += angD(d.a, t.a) * (jump ? 1 : k); d.ta += angD(d.ta, t.ta) * (jump ? 1 : k);
  }
}
const angD = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/* ---------- HUD ---------- */
function updHud(s) {
  const me = s.T.find(t => t.id === G.me);
  if (me) {
    $('mebox').innerHTML = `${avHTML(me.ch)}<div><b>${esc(me.n)} ${s.mode === 'mission' ? '❤️'.repeat(Math.max(0, me.al ? me.lv : me.lv)) : `🎯 ${me.k}`}</b><div class="bar"><i style="width:${me.hp / me.mh * 100}%"></i></div></div>`;
    const sp = SPECIAL[me.sp] || SPECIAL.shield, p = me.cdm ? Math.max(0, 1 - me.cd / me.cdm) : 1;
    $('spIc').textContent = sp.ic; $('spTx').textContent = sp.name;
    spBtn.style.setProperty('--p', Math.round(p * 100) + '%'); spBtn.classList.toggle('ready', me.cd <= 0);
    spBtn.classList.remove('hidden');
  } else { $('mebox').innerHTML = '<b>👀 Tittar på</b>'; spBtn.classList.add('hidden'); }
  $('clock').innerHTML = s.mode === 'mission' ? `${s.T.filter(t => t.tm === 1 && (t.al || t.lv > 0)).length} 🎯<small>kvar</small>` : `${Math.floor(s.tm / 60)}:${String(s.tm % 60).padStart(2, '0')}<small>till ${s.kl}</small>`;
  if (s.mode === 'ffa') {
    const top = s.T.filter(t => !t.out).sort((a, b) => b.k - a.k || a.d - b.d).slice(0, 4);
    $('score').innerHTML = top.map(t => `<div class="r ${t.id === G.me ? 'mine' : ''}">${esc(t.n)} ${avHTML(t.ch)} ${t.k}</div>`).join('');
  } else $('score').innerHTML = `<div class="r">${MAPS[s.map].name}</div>`;
  // specialknappens plats: ovanför höger tumme
  const land = VW > VH;
  spBtn.style.right = `calc(var(--safe-r) + ${land ? 18 : 14}px)`; spBtn.style.bottom = `calc(var(--safe-b) + ${land ? Math.min(VH * .42, 200) : Math.min(VH * .3, 240)}px)`;
}
let bigT = 0;
function big(txt, ms, sub) {
  const el = $('big'); el.innerHTML = txt + (sub ? `<small>${sub}</small>` : ''); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.add('hidden'), ms || 1200);
}
function feed(html) { const d = document.createElement('div'); d.innerHTML = html; $('feed').prepend(d); while ($('feed').children.length > 4) $('feed').lastChild.remove(); setTimeout(() => d.remove(), 4500); }

/* ---------- händelser → ljud och effekter ---------- */
function nearOf(x, y) { const me = G.snap && G.snap.T.find(t => t.id === G.me) || { x: CAM.x, y: CAM.y }; const d = Math.hypot(x - me.x, y - me.y); return Math.max(.08, 1 - d / 1300); }
const PICK_TXT = { hp: '❤️ Laga!', speed: '⚡ Fart!', triple: '🔱 Trippelskott!', shield: '🛡️ Sköld!' };
function handleEvents(s) {
  const nameOf = id => { const t = s.T.find(q => q.id === id); return t ? t.n : '?'; };
  const chOf = id => { const t = s.T.find(q => q.id === id); return t ? t.ch : 0; };
  for (const e of s.ev) {
    if (e.id <= G.lastEv) continue;
    G.lastEv = e.id;
    switch (e.e) {
      case 'start': big(s.mode === 'mission' ? `Uppdrag ${G.mis + 1}` : MAPS[s.map].name, 1600, s.mode === 'mission' ? 'Förstör alla fiender!' : `Först till ${s.kl} träffar`); break;
      case 'go': SFX.go(); big('KÖR! 🪖', 800); break;
      case 'fire': { const n = nearOf(e.x, e.y); SFX.fire(n); FX.flash(e.x, e.y, e.a); if (e.t === G.me) FX.shake = Math.max(FX.shake, 3); break; }
      case 'hit': { const n = nearOf(e.x, e.y); SFX.hit(n); FX.spark(e.x, e.y, 8, '#FFD23F'); FX.text('-' + e.d, e.x, e.y - 40, e.t === G.me ? '#FF4D6D' : '#fff', 20); if (e.t === G.me) { FX.shake = 8; buzz(30); FX.red = .35; } break; }
      case 'bounce': SFX.bounce(nearOf(e.x, e.y)); FX.spark(e.x, e.y, 3, '#fff'); break;
      case 'spark': FX.spark(e.x, e.y, 5, '#ccc'); break;
      case 'crate': SFX.crate(nearOf(e.x, e.y)); FX.spark(e.x, e.y, e.d ? 18 : 5, '#B9824A'); if (e.d) FX.debris(e.x, e.y); break;
      case 'boom': SFX.boom(nearOf(e.x, e.y)); FX.boom(e.x, e.y, e.r); FX.shake = Math.max(FX.shake, 12 * nearOf(e.x, e.y)); break;
      case 'block': FX.ring(e.x, e.y, '#7FD8FF'); break;
      case 'pick': SFX.pick(); FX.text(PICK_TXT[e.k] || '', e.x, e.y - 30, '#A8FFB8', 22); break;
      case 'special': { const sp = SPECIAL[e.s]; if (e.s === 'shield') SFX.shield(); else SFX.special(); if (e.t === G.me) FX.text(sp.ic + ' ' + sp.name + '!', e.x, e.y - 50, '#FFD23F', 24); break; }
      case 'spawn': FX.ring(e.x, e.y, '#fff'); break;
      case 'left': feed(`🚪 ${esc(e.n)} lämnade`); break;
      case 'kill': {
        SFX.boom(nearOf(e.x, e.y)); FX.boom(e.x, e.y, 90); FX.scorch(e.x, e.y);
        const self = e.t === e.o;
        feed(self ? `${avHTML(chOf(e.t))} ${esc(nameOf(e.t))} sprängde sig själv 🤦` : `${esc(nameOf(e.o))} 💥 ${esc(nameOf(e.t))}`);
        if (e.o === G.me && !self) { big('TRÄFF! 🎯', 900); buzz(60); }
        if (e.t === G.me) { big('Utslagen! 💥', 1500, s.mode === 'mission' ? 'Ny vagn om 3 sek' : `${esc(nameOf(e.o))} tog dig – tillbaka om 3 sek`); buzz(150); }
        break;
      }
      case 'end': {
        const meWon = s.mode === 'mission' ? e.w === 'team0' : e.w === G.me;
        if (meWon) { SFX.win(); confetti(); big(s.mode === 'mission' ? 'UPPDRAG KLART! 🎖️' : 'DU VANN! 🏆', 2200); }
        else if (s.mode === 'mission') { SFX.sad(); big('Uppdraget misslyckades', 2200); }
        else { const w = s.T.find(t => t.id === e.w); big(`${w ? esc(w.n) : 'Någon'} vann! 🏆`, 2200); }
        break;
      }
    }
  }
}

/* ---------- resultat + XP ---------- */
function xpFor(r, won, s) {
  let xp = 20 + r.kills * 25 + Math.round(r.dmg / 5) + r.crates * 3;
  if (won) xp += s.mode === 'mission' ? 60 + G.mis * 10 : 80;
  if (G.mode !== 'local') xp += 20;
  return xp;
}
async function showResult() {
  const s = G.snap, R = G.game ? G.game.result() : G.res.r, W = G.game ? G.game.winner : G.res.w;
  const mine = R.find(r => r.id === G.me);
  const won = s.mode === 'mission' ? W === 'team0' : W === G.me;
  let xpHTML = '';
  if (mine) {
    const xp = xpFor(mine, won, s), lv = addXp(mine.ch, xp), f = figOf(mine.ch);
    xpHTML = `<div class="xpl">${avHTML(mine.ch)}<div style="flex:1"><b>${esc(mine.name)} +${xp} XP</b>${lv ? ' <span class="lvup">NIVÅ UPP! 🎉</span>' : ''}
      <div class="xpbar"><i style="width:${f.lvl >= LVL_MAX ? 100 : f.xp / xpNeed(f.lvl) * 100}%"></i><span>Nivå ${f.lvl}</span></div></div></div>
      ${lv ? `<p style="font-size:15px">Nya poäng att lägga i 🔧 Garaget!${MODEL_IDS.some(id => MODELS[id].lvl > f.lvl - lv && MODELS[id].lvl <= f.lvl) ? ' Ny vagn upplåst! 🪖' : ''}</p>` : ''}`;
    if (lv) setTimeout(() => { SFX.win(); buzz(60); }, 300);
  }
  const sorted = R.filter(r => s.mode === 'ffa' || r.team === 0 || true).slice().sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  const rank = `<div class="rank">${sorted.map((r, k) => `<div class="r ${r.id === W || (s.mode === 'mission' && W === 'team0' && r.team === 0) ? 'w' : ''} ${r.id === G.me ? 'mine' : ''}">${k === 0 && s.mode === 'ffa' ? '👑' : (k + 1) + '.'} ${avHTML(r.ch)}<span>${esc(r.name)}${r.bot >= 0 ? ' 🤖' : ''}</span><b>🎯 ${r.kills} · 💥 ${r.deaths}</b></div>`).join('')}</div>`;
  if (won && mine) await celebrate(mine.ch, s.mode === 'mission' ? 'Uppdrag klart!' : `${mine.name} vann!`, s.mode === 'mission' ? `Uppdrag ${G.mis + 1} av ${N_MIS}` : `${mine.kills} träffar`, ['🪖', '💥', '🎖️', '⭐', '🎉', '✨']);
  if (G.mode === 'local' && G.kind === 'mission') {
    if (won && G.mis === (prof.mis[ME.ch] || 0)) { prof.mis[ME.ch] = G.mis + 1; PROF.set(prof); }
    const next = G.mis + 1 < N_MIS && won;
    panel(`<h3>${won ? 'Uppdraget klart! 🎖️' : 'Misslyckades 😕'}</h3>${rank}${xpHTML}
      ${next ? `<button class="btn green" id="pNext">➡️ Nästa uppdrag</button>` : ''}
      <button class="btn ${won ? 'blue small' : 'green'}" id="pAgain">🔄 ${won ? 'Kör igen' : 'Försök igen'}</button>
      <div class="row2"><button class="btn purple small" id="pGar">🔧 Garage</button><button class="btn white small" id="pMenu">📋 Uppdrag</button></div>`);
    if (next) $('pNext').onclick = () => { SFX.tap(); startMission(G.mis + 1); };
    $('pAgain').onclick = () => { SFX.tap(); startMission(G.mis); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); G.game = null; show('missions'); };
  } else if (G.mode === 'local') {
    panel(`<h3>${won ? 'Du vann! 🏆' : 'Matchen är slut'}</h3>${rank}${xpHTML}
      <button class="btn green" id="pAgain">🔄 Spela igen</button>
      <div class="row2"><button class="btn purple small" id="pGar">🔧 Garage</button><button class="btn white small" id="pMenu">🏠 Meny</button></div>`);
    $('pAgain').onclick = () => { SFX.tap(); startQuick(); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); G.game = null; show('menu'); };
  } else {
    panel(`<h3>Matchen är slut 🏆</h3>${rank}${xpHTML}<button class="btn green" id="pLobby">👍 Till lobbyn</button>`);
    $('pLobby').onclick = () => { SFX.tap(); closePanel(); if (G.mode === 'host') { HOST.inGame = false; G.game = null; hostLobby(); } show('lobby'); };
  }
  if ($('pGar')) $('pGar').onclick = () => { SFX.tap(); closePanel(); G.game = null; show('garage'); };
}

$('gBack').onclick = () => {
  SFX.tap();
  const net = G.mode !== 'local';
  if (!net) paused = true;
  panel(`<h3>${net ? (G.mode === 'host' ? 'Avsluta matchen för alla?' : 'Lämna matchen?') : 'Paus ⏸️'}</h3>
    ${net ? '' : '<button class="btn green" id="pNo">▶️ Fortsätt</button>'}
    <button class="btn pink ${net ? '' : 'small'}" id="pYes">🚪 ${net ? 'Ja' : 'Avsluta'}</button>${net ? '<button class="btn white small" id="pNo">Nej</button>' : ''}`);
  $('pYes').onclick = () => {
    SFX.tap(); closePanel(); paused = false;
    if (G.mode === 'host') { G.game = null; G.snap = null; HOST.inGame = false; hostAll({ t: 'abort' }); hostLobby(); show('lobby'); }
    else if (G.mode === 'client') leave();
    else { G.game = null; show(G.kind === 'mission' ? 'missions' : 'menu'); }
  };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); paused = false; };
};

/* ================= RITNING ================= */
const cv = $('cv'), cx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, SC = 1;
const CAM = { x: WW / 2, y: WH / 2 };
function resize() { VW = innerWidth; VH = innerHeight; DPR = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR); }
addEventListener('resize', () => { if (current === 'game') resize(); });
const toScreen = (x, y) => [VW / 2 + (x - CAM.x) * SC, VH / 2 + (y - CAM.y) * SC];

// mark och spår ritas en gång per bana till egna bilder
const GROUND = document.createElement('canvas'), DECAL = document.createElement('canvas');
const GS = .5;   // upplösning för markbilden
const GCOL = { grass: ['#6DA544', '#5E9439', '#7DB552'], sand: ['#E2C27D', '#D4B26A', '#ECD08E'], stone: ['#8C8A86', '#7D7B77', '#9A9893'], snow: ['#EEF4F8', '#DCE7EE', '#FFFFFF'] };
let curMap = -1;
function prepMap(mi) {
  curMap = mi;
  const M = MAPS[mi], col = GCOL[M.ground];
  GROUND.width = DECAL.width = WW * GS; GROUND.height = DECAL.height = WH * GS;
  const g = GROUND.getContext('2d'), r = TK.RNG(mi * 77 + 5);
  g.fillStyle = col[0]; g.fillRect(0, 0, GROUND.width, GROUND.height);
  for (let i = 0; i < 260; i++) { g.fillStyle = col[1 + (i % 2)]; g.globalAlpha = .35 + r() * .4; g.beginPath(); g.ellipse(r() * GROUND.width, r() * GROUND.height, 8 + r() * 30, 6 + r() * 20, r() * 3, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (M.ground === 'grass') for (let i = 0; i < 500; i++) { g.strokeStyle = '#4E8A2E'; g.lineWidth = 1; const x = r() * GROUND.width, y = r() * GROUND.height; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 4, y - 4 - r() * 3); g.stroke(); }
  if (M.ground === 'stone') { g.strokeStyle = '#6E6C68'; g.lineWidth = 1; for (let x = 0; x < GROUND.width; x += 40) for (let y = 0; y < GROUND.height; y += 40) g.strokeRect(x + ((y / 40) % 2) * 20, y, 40, 40); }
  const d = DECAL.getContext('2d'); d.clearRect(0, 0, DECAL.width, DECAL.height);
}
const FX = {
  parts: [], texts: [], rings: [], flashes: [], shake: 0, red: 0,
  reset() { this.parts = []; this.texts = []; this.rings = []; this.flashes = []; this.shake = 0; this.red = 0; },
  spark(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 80 + Math.random() * 260; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .2 + Math.random() * .3, c, r: 2 + Math.random() * 3, fr: 3 }); } },
  debris(x, y) { for (let i = 0; i < 10; i++) { const a = Math.random() * 7, v = 60 + Math.random() * 200; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .5 + Math.random() * .4, c: '#8A5A2B', r: 4 + Math.random() * 5, fr: 4, sq: 1 }); } },
  boom(x, y, R) {
    for (let i = 0; i < 26; i++) { const a = Math.random() * 7, v = 60 + Math.random() * R * 3; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .35 + Math.random() * .45, c: pick(['#FFD23F', '#FF8A3D', '#FF4D6D', '#fff']), r: 5 + Math.random() * 9, fr: 3 }); }
    for (let i = 0; i < 10; i++) { const a = Math.random() * 7, v = 20 + Math.random() * 60; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: .9 + Math.random() * .6, c: '#55555588', r: 12 + Math.random() * 14, fr: 1.5, grow: 1 }); }
    this.rings.push({ x, y, r: 10, max: R * 1.3, life: 0, c: '#FFE9A8' });
    this.scorch(x, y, R * .6);
  },
  ring(x, y, c) { this.rings.push({ x, y, r: 20, max: 70, life: 0, c }); },
  flash(x, y, a) { this.flashes.push({ x, y, a, life: 0 }); },
  scorch(x, y, R) { const d = DECAL.getContext('2d'); d.fillStyle = '#00000033'; d.beginPath(); d.arc(x * GS, y * GS, (R || 50) * GS, 0, 7); d.fill(); },
  text(t, x, y, c, s) { this.texts.push({ t, x, y, c, s, life: 0 }); },
  tick(dt) {
    for (const p of this.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-p.fr * dt); p.vx *= f; p.vy *= f; if (p.grow) p.r += dt * 20; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life < 1);
    for (const r of this.rings) { r.life += dt; r.r += (r.max - r.r) * Math.min(1, dt * 10); }
    this.rings = this.rings.filter(r => r.life < .4);
    for (const f of this.flashes) f.life += dt;
    this.flashes = this.flashes.filter(f => f.life < .08);
    this.shake *= Math.pow(.01, dt); this.red = Math.max(0, this.red - dt);
  }
};

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/* en vagn (i vagnens eget koordinatsystem, framåt = +x) */
function drawTankBody(c, t, odo) {
  const M = MODELS[t.m] || MODELS.bjorn, R = M.r, col = CHARS[t.ch % CHARS.length].c, colD = CHARS[t.ch % CHARS.length].d;
  const L = R * 2.1, Wd = R * 1.75;
  c.save(); c.rotate(t.a);
  // band
  for (const s of [-1, 1]) {
    c.fillStyle = '#2B2B2B'; rr(c, -L / 2, s > 0 ? Wd / 2 - R * .42 : -Wd / 2, L, R * .42, 5); c.fill();
    c.strokeStyle = '#555'; c.lineWidth = 2;
    const off = (odo || 0) % 10;
    for (let x = -L / 2 + 3 + off; x < L / 2 - 2; x += 10) { c.beginPath(); c.moveTo(x, s > 0 ? Wd / 2 - R * .4 : -Wd / 2 + 1); c.lineTo(x, s > 0 ? Wd / 2 - 1 : -Wd / 2 + R * .4); c.stroke(); }
  }
  // skrov
  c.fillStyle = '#2B2350'; rr(c, -L / 2 + 3, -Wd / 2 + R * .3 - 2, L - 6, Wd - R * .6 + 4, 8); c.fill();
  const g = c.createLinearGradient(0, -Wd / 2, 0, Wd / 2); g.addColorStop(0, col); g.addColorStop(1, colD);
  c.fillStyle = g; rr(c, -L / 2 + 5, -Wd / 2 + R * .3, L - 10, Wd - R * .6, 7); c.fill();
  c.fillStyle = '#ffffff30'; rr(c, -L / 2 + 9, -Wd / 2 + R * .3 + 3, L - 18, (Wd - R * .6) * .3, 4); c.fill();
  if (t.m === 'boss') { c.fillStyle = '#2B2350'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(L / 2 - 4, s * Wd * .2); c.lineTo(L / 2 + 10, s * Wd * .3); c.lineTo(L / 2 - 4, s * Wd * .38); c.fill(); } }
  if (t.m === 'drake') { c.fillStyle = '#444'; for (const s of [-1, 1]) { rr(c, -L / 2 + 6, s * Wd * .22 - 6, L * .35, 12, 4); c.fill(); } }
  c.restore();
  // torn + kanon
  c.save(); c.rotate(t.ta);
  const bl = R + 20, bw = t.m === 'mammut' || t.m === 'boss' ? 14 : t.m === 'vessla' ? 8 : 11;
  c.fillStyle = '#2B2350'; rr(c, 0, -bw / 2 - 2, bl + 2, bw + 4, 4); c.fill();
  c.fillStyle = '#4A4A4A'; rr(c, 0, -bw / 2, bl, bw, 3); c.fill();
  c.fillStyle = '#333'; c.fillRect(bl - 8, -bw / 2 - 2, 8, bw + 4);
  if (t.tr) { for (const s of [-1, 1]) { c.save(); c.rotate(s * .16); c.fillStyle = '#4A4A4A'; c.fillRect(R * .3, -3, bl * .75, 6); c.restore(); } }
  c.restore();
  const tr = R * .62;
  c.fillStyle = '#2B2350'; c.beginPath(); c.arc(0, 0, tr + 3, 0, 7); c.fill();
  c.fillStyle = colD; c.beginPath(); c.arc(0, 0, tr, 0, 7); c.fill();
  const im = FACES[t.ch % CHARS.length];
  c.save(); c.beginPath(); c.arc(0, 0, tr - 4, 0, 7); c.clip();
  if (im.complete && im.naturalWidth) c.drawImage(im, -tr + 4, -tr + 4, (tr - 4) * 2, (tr - 4) * 2);
  if (t.ht) { c.fillStyle = '#FF000055'; c.fillRect(-tr, -tr, tr * 2, tr * 2); }
  c.restore();
}
function drawWall(r, ground) {
  const [x, y, w, h] = r;
  cx.fillStyle = '#00000033'; cx.fillRect(x + 8, y + 10, w, h);
  const top = ground === 'snow' ? '#9AA7B2' : ground === 'sand' ? '#B08A5A' : ground === 'stone' ? '#55524D' : '#7E7A72';
  const side = ground === 'snow' ? '#7B8893' : ground === 'sand' ? '#8E6C42' : ground === 'stone' ? '#3F3C38' : '#5E5A54';
  cx.fillStyle = side; cx.fillRect(x, y, w, h);
  cx.fillStyle = top; cx.fillRect(x + 3, y + 3, w - 6, h - 9);
  cx.strokeStyle = '#00000022'; cx.lineWidth = 2;
  for (let yy = y + 20; yy < y + h - 8; yy += 22) { cx.beginPath(); cx.moveTo(x + 3, yy); cx.lineTo(x + w - 3, yy); cx.stroke(); }
  if (ground === 'snow') { cx.fillStyle = '#fff'; cx.fillRect(x + 3, y + 3, w - 6, Math.min(14, h * .3)); }
}
function drawCrate(c) {
  cx.fillStyle = '#00000033'; cx.fillRect(c.x + 6, c.y + 8, c.w, c.h);
  cx.fillStyle = '#8A5A2B'; cx.fillRect(c.x, c.y, c.w, c.h);
  cx.fillStyle = '#B9824A'; cx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
  cx.strokeStyle = '#8A5A2B'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(c.x + 6, c.y + 6); cx.lineTo(c.x + c.w - 6, c.y + c.h - 6); cx.moveTo(c.x + c.w - 6, c.y + 6); cx.lineTo(c.x + 6, c.y + c.h - 6); cx.stroke();
}
function drawBush(b, ground, near) {
  const [x, y, r] = b;
  cx.globalAlpha = near ? .45 : .95;
  const c1 = ground === 'snow' ? '#2E6B4A' : ground === 'sand' ? '#7C9A3A' : '#2F7A2E', c2 = ground === 'snow' ? '#FFFFFF' : ground === 'sand' ? '#98B84A' : '#43A040';
  cx.fillStyle = c1; for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; cx.beginPath(); cx.arc(x + Math.cos(a) * r * .5, y + Math.sin(a) * r * .5, r * .55, 0, 7); cx.fill(); }
  cx.fillStyle = c2; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + .5; cx.beginPath(); cx.arc(x + Math.cos(a) * r * .32, y + Math.sin(a) * r * .32 - 4, r * .3, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
}
const PICK_IC = { hp: '❤️', speed: '⚡', triple: '🔱', shield: '🛡️' };
function draw(s, time, dt) {
  if (s.map !== curMap) prepMap(s.map);
  const M = MAPS[s.map];
  const me = s.T.find(t => t.id === G.me), meD = me && G.disp[me.id];
  const land = VW > VH;
  const target = land ? 1150 : 760;
  SC = Math.max(VW / Math.min(target, WW + 200), VH / (WH + 160));
  let fx = WW / 2, fy = WH / 2;
  if (meD && (me.al || me.rs > 0)) { fx = meD.x; fy = meD.y; }
  // håll kameran innanför banan
  const hw = VW / 2 / SC, hh = VH / 2 / SC;
  fx = hw * 2 >= WW + 120 ? WW / 2 : Math.max(hw - 60, Math.min(WW + 60 - hw, fx));
  fy = hh * 2 >= WH + 120 ? WH / 2 : Math.max(hh - 60, Math.min(WH + 60 - hh, fy));
  CAM.x += (fx - CAM.x) * Math.min(1, dt * 8); CAM.y += (fy - CAM.y) * Math.min(1, dt * 8);
  const sh = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0, sh2 = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = '#2E3B1F'; cx.fillRect(0, 0, VW, VH);
  cx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (VW / 2 - CAM.x * SC + sh), DPR * (VH / 2 - CAM.y * SC + sh2));
  // mark
  cx.drawImage(GROUND, 0, 0, WW, WH);
  // bandspår
  const d = DECAL.getContext('2d');
  for (const t of s.T) { const D = G.disp[t.id]; if (!D || !t.al || !D.moved) continue; d.fillStyle = M.ground === 'snow' ? '#9DB0BE55' : '#00000018'; const R = (MODELS[t.m] || MODELS.bjorn).r; for (const sd of [-1, 1]) { const ox = Math.cos(D.a + Math.PI / 2) * sd * R * .66, oy = Math.sin(D.a + Math.PI / 2) * sd * R * .66; d.fillRect((D.x + ox) * GS - 2, (D.y + oy) * GS - 2, 4, 4); } }
  cx.drawImage(DECAL, 0, 0, WW, WH);
  cx.strokeStyle = '#00000055'; cx.lineWidth = 8; cx.strokeRect(-4, -4, WW + 8, WH + 8);
  // föremål
  for (const p of s.P) { const b = Math.sin(time * 4 + p[0]) * 4; cx.fillStyle = '#ffffffcc'; cx.beginPath(); cx.arc(p[0], p[1] + b, 20, 0, 7); cx.fill(); cx.strokeStyle = '#FFD23F'; cx.lineWidth = 3; cx.stroke(); cx.font = '24px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(PICK_IC[p[2]] || '?', p[0], p[1] + b + 1); }
  // minor
  for (const m of s.M) { const own = m[2] === G.me; cx.globalAlpha = own ? 1 : .55; cx.fillStyle = '#333'; cx.beginPath(); cx.arc(m[0], m[1], 14, 0, 7); cx.fill(); cx.fillStyle = m[3] && Math.sin(time * 10) > 0 ? '#FF3B30' : '#661111'; cx.beginPath(); cx.arc(m[0], m[1], 5, 0, 7); cx.fill(); cx.globalAlpha = 1; }
  // väggar och lådor
  for (const r of M.walls) drawWall(r, M.ground);
  M.crates.forEach((c, i) => { if (s.C[i]) drawCrate({ x: c[0] - 26, y: c[1] - 26, w: 52, h: 52 }); });
  // vagnar
  for (const t of s.T) {
    if (!t.al || t.out) continue;
    const D = G.disp[t.id] || t;
    cx.save(); cx.translate(D.x, D.y);
    cx.fillStyle = '#00000040'; cx.beginPath(); cx.ellipse(6, 8, (MODELS[t.m] || MODELS.bjorn).r * 1.15, (MODELS[t.m] || MODELS.bjorn).r * .95, 0, 0, 7); cx.fill();
    if (t.tu || t.bo) { cx.fillStyle = t.tu ? '#FF8A3D88' : '#FFD23F55'; for (let k = 0; k < 3; k++) { cx.beginPath(); cx.arc(-Math.cos(D.a) * (40 + k * 14), -Math.sin(D.a) * (40 + k * 14), 10 - k * 2, 0, 7); cx.fill(); } }
    drawTankBody(cx, { m: t.m, ch: t.ch, a: D.a, ta: D.ta, ht: t.ht, tr: t.tr }, D.odo || 0);
    if (t.sh) { cx.strokeStyle = '#7FD8FF'; cx.globalAlpha = .6 + .3 * Math.sin(time * 12); cx.lineWidth = 5; cx.beginPath(); cx.arc(0, 0, (MODELS[t.m] || MODELS.bjorn).r + 16, 0, 7); cx.stroke(); cx.fillStyle = '#7FD8FF22'; cx.fill(); cx.globalAlpha = 1; }
    cx.restore();
  }
  // kulor
  for (const b of s.B) {
    if (b[2] === 1) { cx.fillStyle = '#88888866'; cx.beginPath(); cx.arc(b[0], b[1], 9, 0, 7); cx.fill(); cx.fillStyle = '#FF4D6D'; cx.beginPath(); cx.arc(b[0], b[1], 6, 0, 7); cx.fill(); }
    else { cx.fillStyle = '#FFB30055'; cx.beginPath(); cx.arc(b[0], b[1], 10, 0, 7); cx.fill(); cx.fillStyle = '#FFF2B0'; cx.beginPath(); cx.arc(b[0], b[1], 5.5, 0, 7); cx.fill(); }
  }
  // mynningsflammor
  for (const f of FX.flashes) { cx.save(); cx.translate(f.x, f.y); cx.rotate(f.a); cx.fillStyle = '#FFE27A'; cx.beginPath(); cx.moveTo(0, -9); cx.lineTo(26, 0); cx.lineTo(0, 9); cx.fill(); cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(2, 0, 6, 0, 7); cx.fill(); cx.restore(); }
  // buskar (över vagnarna)
  for (const b of M.bushes) { const near = meD && Math.hypot(meD.x - b[0], meD.y - b[1]) < b[2] + 40; drawBush(b, M.ground, near); }
  // effekter
  for (const p of FX.parts) { cx.globalAlpha = Math.max(0, 1 - p.life / p.max); cx.fillStyle = p.c; if (p.sq) cx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r); else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); } }
  for (const r of FX.rings) { cx.globalAlpha = Math.max(0, 1 - r.life / .4); cx.strokeStyle = r.c; cx.lineWidth = 6; cx.beginPath(); cx.arc(r.x, r.y, r.r, 0, 7); cx.stroke(); }
  cx.globalAlpha = 1;
  // namn och livsmätare
  cx.textAlign = 'center'; cx.textBaseline = 'alphabetic';
  for (const t of s.T) {
    if (!t.al || t.out) continue;
    const D = G.disp[t.id] || t, R = (MODELS[t.m] || MODELS.bjorn).r, y = D.y - R - 26;
    const enemy = s.mode === 'mission' ? t.tm !== 0 : t.id !== G.me;
    cx.font = 'bold 16px Fredoka, sans-serif'; cx.lineWidth = 4; cx.strokeStyle = '#000a'; cx.strokeText(t.n + (t.bot >= 0 ? ' 🤖' : ''), D.x, y - 6); cx.fillStyle = t.id === G.me ? '#FFD23F' : '#fff'; cx.fillText(t.n + (t.bot >= 0 ? ' 🤖' : ''), D.x, y - 6);
    cx.fillStyle = '#000a'; rr(cx, D.x - 32, y, 64, 9, 4); cx.fill();
    cx.fillStyle = enemy ? (t.hp / t.mh > .35 ? '#FF6B5A' : '#FF2D2D') : (t.hp / t.mh > .35 ? '#34C759' : '#FFD23F'); rr(cx, D.x - 31, y + 1, 62 * Math.max(0, t.hp / t.mh), 7, 3); cx.fill();
  }
  for (const t of FX.texts) { cx.globalAlpha = Math.max(0, 1 - t.life); cx.font = `bold ${t.s}px Fredoka, sans-serif`; cx.lineWidth = 5; cx.strokeStyle = '#2B2350'; cx.strokeText(t.t, t.x, t.y); cx.fillStyle = t.c; cx.fillText(t.t, t.x, t.y); }
  cx.globalAlpha = 1;
  // skärmläge: tumspakar, minikarta, rött sken vid träff
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (FX.red > 0) { const g = cx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * .3, VW / 2, VH / 2, Math.max(VW, VH) * .7); g.addColorStop(0, '#ff000000'); g.addColorStop(1, `rgba(255,0,0,${FX.red})`); cx.fillStyle = g; cx.fillRect(0, 0, VW, VH); }
  drawSticks();
  drawMini(s);
  if (me && !me.al && !me.out && s.ph === 'play') { cx.fillStyle = '#0008'; cx.fillRect(0, VH / 2 - 40, VW, 80); cx.fillStyle = '#fff'; cx.font = 'bold 26px Fredoka, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(s.mode === 'mission' && me.lv <= 0 ? 'Inga liv kvar 😕' : `Ny vagn om ${me.rs} …`, VW / 2, VH / 2); }
}
function drawSticks() {
  const R = STR();
  const one = (s, defX, defY) => {
    const ox = s ? s.ox : defX, oy = s ? s.oy : defY;
    cx.globalAlpha = s ? .5 : .18; cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(ox, oy, R, 0, 7); cx.fill();
    cx.globalAlpha = s ? .9 : .3; cx.beginPath(); cx.arc(s ? s.x : ox, s ? s.y : oy, R * .45, 0, 7); cx.fill(); cx.globalAlpha = 1;
  };
  if (MOUSE.used && !STK.m && !STK.a) return;
  const by = VH - R - 30 - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-b')) || 14);
  one(STK.m, R + 34, by); one(STK.a, VW - R - 34, by);
}
function drawMini(s) {
  const mw = Math.min(150, VW * .26), mh = mw * WH / WW, x0 = VW - mw - 12, y0 = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-t')) || 14) + 60 + Math.min(4, s.T.length) * 24;
  const k = mw / WW;
  cx.globalAlpha = .75; cx.fillStyle = '#0008'; cx.fillRect(x0, y0, mw, mh); cx.globalAlpha = 1;
  cx.fillStyle = '#ffffff66'; for (const r of MAPS[s.map].walls) cx.fillRect(x0 + r[0] * k, y0 + r[1] * k, Math.max(1, r[2] * k), Math.max(1, r[3] * k));
  for (const t of s.T) { if (!t.al || t.out) continue; const enemy = s.mode === 'mission' ? t.tm !== 0 : t.id !== G.me; cx.fillStyle = t.id === G.me ? '#FFD23F' : enemy ? '#FF4D6D' : '#34C759'; cx.beginPath(); cx.arc(x0 + t.x * k, y0 + t.y * k, t.id === G.me ? 4 : 3, 0, 7); cx.fill(); }
  cx.strokeStyle = '#fff8'; cx.lineWidth = 1; cx.strokeRect(x0, y0, mw, mh);
}

/* ================= NÄTVERK ================= */
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = `
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Matchen startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen här.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>
    <p class="note" style="text-align:center;color:#fff">Alla måste vara på samma wifi. Du kör med ${esc(charName(ME.ch))}s vagn.</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'tank.html');
  };
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">🪖</span> Letar efter matcher…</p>`;
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
function startHosting() {
  let r = null;
  try { r = JSON.parse(Android.netHost('tank:' + charName(ME.ch) + 's slagfält')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/tank.html?host=1&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`;
}
function leave() {
  if (G.mode === 'host' || HOSTPAGE) {
    try { HOST.ws && HOST.ws.close(); } catch (e) { } HOST.ws = null;
    try { Android.netStop(); } catch (e) { }
    location.href = APP_HOME + 'tank.html'; return;
  }
  if (CLIENT) {
    CL.closing = true; try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (window.Android) location.href = APP_HOME + 'tank.html';
    else { G.mode = 'local'; show('menu'); }
    return;
  }
  show('menu');
}

/* ----- värd ----- */
const HOST = { ws: null, lobby: [], ok: false, inGame: false, set: Object.assign({ map: 0, kl: 10, bots: 0, diff: 1 }, store.get('hostSet', {})) };
function hostStart() {
  G.mode = 'host'; G.me = 'h';
  HOST.lobby = [Object.assign(myTankSpec(ME.ch), { id: 'h', name: myName() })];
  hostConnect(); show('lobby');
}
function hostConnect() {
  const ws = new WebSocket(`ws://${location.host}/ws?host=1`);
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
    if (HOST.inGame && G.game) { G.game.removeTank(id); if (p) G.game.emit('left', { n: p.name }); }
    return hostLobby();
  }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    const p = { id, name: String(m.name || 'Förare').slice(0, 14), ch: Math.abs(m.ch | 0) % CHARS.length, model: MODELS[m.model] && m.model !== 'boss' ? m.model : 'bjorn', up: TK.cleanUp(m.up) };
    const old = HOST.lobby.find(q => q.id === id);
    if (old) Object.assign(old, p); else { HOST.lobby.push(p); SFX.pick(); buzz(15); }
    hostTo(id, { t: 'welcome', id });
    hostLobby();
    // matchen pågår: hoppa in direkt
    if (HOST.inGame && G.game && !G.game.over) { if (!G.game.T.find(t => t.id === id)) G.game.addTank(p); else { const t = G.game.T.find(q => q.id === id); t.out = false; t.resp = 1; } hostTo(id, { t: 'start' }); }
  } else if (m.t === 'in') {
    if (HOST.inGame && G.game) G.game.setInput(id, m.i);
  }
}
function lobbyMsg() { return { t: 'lobby', players: HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch, model: p.model })), inGame: HOST.inGame, host: myName(), set: HOST.set }; }
function hostLobby() { hostAll(lobbyMsg()); if (current === 'lobby') buildLobby(); }
function hostBegin() {
  const S = HOST.set;
  const pl = HOST.lobby.map(p => Object.assign({}, p, p.id === 'h' ? { up: figOf(ME.ch).up, model: figOf(ME.ch).model } : {}));
  const used = pl.map(p => p.ch), lv = DIFF[S.diff].lv;
  for (let k = 0; k < S.bots; k++) { const free = CHARS.map((_, i) => i).filter(i => !used.includes(i)); const ch = free.length ? pick(free) : Math.floor(Math.random() * CHARS.length); used.push(ch); pl.push({ id: 'b' + k, name: charName(ch), ch, model: pick(MODEL_IDS), bot: lv, up: TK.botUp(lv) }); }
  if (pl.length < 2) { panel(`<h3>Minst två vagnar</h3><p>Vänta tills någon har gått med – eller lägg till datorvagnar.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  HOST.inGame = true; G.resSent = false; G.mode = 'host'; G.kind = 'net';
  begin(new TK.Game(pl, { map: S.map, mode: 'ffa', killLimit: S.kl, time: 240 }), 'h');
  hostAll({ t: 'start' });
  hostLobby();
}

/* ----- klient ----- */
const CL = { ws: null, id: null, lobby: null, closing: false, tries: 0 };
function clientStart() { G.mode = 'client'; pickFigure('Vem kör?', clientConnect, leave); }
function clientConnect() {
  CL.closing = false;
  const ws = new WebSocket(`ws://${location.host}/ws`);
  CL.ws = ws;
  panel(`<h3>Ansluter… <span class="spin">🪖</span></h3>`);
  ws.onopen = () => { CL.tries = 0; closePanel(); const f = figOf(ME.ch); ws.send(JSON.stringify({ t: 'hi', name: myName(), ch: ME.ch, model: f.model, up: f.up })); if (current !== 'game') show('lobby'); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } clientRecv(m); };
  ws.onclose = () => {
    if (CL.ws !== ws || CL.closing) return;
    if (CL.tries++ < 3 && CL.id) { setTimeout(clientConnect, 800); return; }
    panel(`<h3>Tappade kontakten 📡</h3><p>Är värden kvar och på samma wifi?</p><button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white small" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); CL.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); leave(); };
  };
}
const clSend = o => { if (CL.ws && CL.ws.readyState === 1) CL.ws.send(JSON.stringify(o)); };
function clientRecv(m) {
  if (m.t === 'welcome') { CL.id = m.id; }
  else if (m.t === 'lobby') { CL.lobby = m; if (current === 'lobby') buildLobby(); }
  else if (m.t === 'start') { G.mode = 'client'; G.kind = 'net'; G.game = null; G.snap = null; G.me = CL.id; G.lastEv = 0; G.endShown = false; G.endT = 0; G.res = null; G.disp = {}; FX.reset(); closePanel(); $('feed').innerHTML = ''; show('game'); }
  else if (m.t === 's') { if (current === 'game') { if (!G.snap || G.snap.map !== m.s.map) prepMap(m.s.map); G.snap = m.s; } }
  else if (m.t === 'res') { G.res = m; }
  else if (m.t === 'abort') { closePanel(); G.snap = null; show('lobby'); }
  else if (m.t === 'hostgone') { CL.closing = true; panel(`<h3>Matchen är slut 👋</h3><p>Värden avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); leave(); }; }
}

function buildLobby() {
  if (current !== 'lobby') return;
  const isHost = G.mode === 'host';
  const L = isHost ? lobbyMsg() : (CL.lobby || { players: [], inGame: false, set: HOST.set });
  const myId = isHost ? 'h' : CL.id, S = L.set || HOST.set;
  const pls = L.players.map(p => `<div class="pl ${p.id === myId ? 'mine' : ''}" style="${styleOf(p.ch)}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' 👑' : ''}</span><span class="chip" style="flex:none">${MODELS[p.model] ? MODELS[p.model].name : ''}</span></div>`).join('');
  let side = '';
  if (isHost) {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/tank.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="card"><h4>📲 Bjud in familjen</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: Stridsvagnar → 🔗 Gå med.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
  }
  const sets = isHost ? `<div class="opts">${seg('map', MAPS.map((m, i) => [i, m.name]), S.map, '🗺️ Bana')}${seg('kl', [[5, '5'], [10, '10'], [15, '15']], S.kl, '🎯 Vinst vid')}
      ${seg('bots', [[0, 'Inga'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], S.bots, '🤖 Datorvagnar')}${S.bots ? seg('diff', DIFF.map((d, i) => [i, d.n]), S.diff, '⭐ Datorns nivå') : ''}</div>`
    : `<p class="note">🗺️ ${MAPS[S.map].name} · 🎯 först till ${S.kl}${S.bots ? ` · 🤖 ${S.bots} datorvagnar` : ''}</p>`;
  $('lobbyBox').innerHTML = `<div class="gar"><div class="card"><h4>🪖 Förare (${L.players.length})</h4><div class="plist">${pls || '<p class="note">Ingen här än…</p>'}</div>
      ${sets}
      ${isHost ? `<button class="btn green" id="gStart" ${HOST.ok && !L.inGame ? '' : 'disabled'}>🪖 Starta matchen!</button>` : `<p class="wait" style="text-align:center;font-weight:600">${L.inGame ? 'Matchen pågår… du hoppar in strax 🪖' : `Väntar på att ${esc(L.host || 'värden')} startar ⏳`}</p>`}
      <p class="note">Alla mot alla. Den som först får ${S.kl} träffar vinner. Alla får XP till sin egen vagn.</p></div>
    <div style="display:flex;flex-direction:column;gap:12px">${side}</div></div>`;
  if (isHost) $('lobbyBox').querySelectorAll('.seg button').forEach(b => b.onclick = () => { HOST.set[b.parentNode.dataset.s] = +b.dataset.v; store.set('hostSet', HOST.set); SFX.tap(); hostLobby(); });
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
  panel(`<h3>Så spelar man 🪖</h3>
    <p style="text-align:left;font-size:16px">👈 <b>Vänster tumme</b>: dra åt det håll du vill köra.<br>👉 <b>Höger tumme</b>: dra åt det håll du vill sikta – vagnen skjuter så länge du drar.<br>
    ⭐ <b>Specialknappen</b>: vagnens förmåga (sköld, turbo, mina eller raketer).<br>Kulorna studsar en gång mot väggar. Lådor går sönder och kan ge föremål.<br>
    ❤️ laga · ⚡ fart · 🔱 trippelskott · 🛡️ sköld<br>🌳 Göm dig i buskarna!<br>
    🖥️ Dator: WASD kör, musen siktar, klick skjuter, mellanslag = special.<br>
    🔧 <b>Garage</b>: XP ger nivåer, nivåer ger poäng till uppgraderingar och låser upp nya vagnar.</p>
    <button class="btn green" id="pClose">👍 Kör!</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('meCard').onclick = () => { SFX.tap(); pickFigure('Vem kör?', () => show('menu')); };
$('toMis').onclick = () => { SFX.tap(); show('missions'); };
$('toQuick').onclick = () => { SFX.tap(); show('quick'); };
$('toGar').onclick = () => { SFX.tap(); show('garage'); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toHelp').onclick = () => { SFX.tap(); help(); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
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
