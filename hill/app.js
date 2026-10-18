/* Bucinca Backracet – menyer, garage, banor, kontroller, motorljud. */
'use strict';
const store = makeStore('bh');

/* ---------- bilarna ----------
   torque = drivande kraft (Nm totalt), vmax m/s, grip = däckens friktion, freq/damp = fjädringens styvhet/dämpning,
   comH = tyngdpunktens höjd över hjulaxeln (m), air = hur lätt bilen vrids i luften, fuel = sekunder full gas. */
const CARS = [
  { id: 's80', name: 'Volvo S80', price: 0, len: 4.85, mass: 1250, torque: 3400, vmax: 26, grip: 1.0, freq: 1.7, damp: 0.45, comH: 0.42, air: 1.0, fuel: 21, drive: 'front',
    desc: 'Pålitlig sedan – bra att börja med.' },
  { id: 'v40', name: 'Volvo V40', price: 800, len: 4.37, mass: 1050, torque: 3400, vmax: 28, grip: 1.05, freq: 1.8, damp: 0.45, comH: 0.42, air: 1.15, fuel: 25, drive: 'front',
    desc: 'Lätt och snål – räcker långt på en tank.' },
  { id: 'focus', name: 'Ford Focus ST', price: 1800, len: 4.36, mass: 1100, torque: 4600, vmax: 34, grip: 1.05, freq: 2.0, damp: 0.42, comH: 0.45, air: 1.25, fuel: 18, drive: 'front',
    desc: 'Het hatch – snabb men lätt att stegra.' },
  { id: 'e91', name: 'BMW E91 Touring', price: 4500, len: 4.53, mass: 1450, torque: 6000, vmax: 31, grip: 1.2, freq: 1.8, damp: 0.48, comH: 0.46, air: 1.0, fuel: 21, drive: 'awd',
    desc: 'xDrive och takräcke – klättrar som en get.' },
  { id: 'cab', name: 'BMW Cabriolet', price: 6000, len: 4.6, mass: 1350, torque: 6200, vmax: 40, grip: 1.1, freq: 2.1, damp: 0.42, comH: 0.36, air: 1.2, fuel: 18, drive: 'rear',
    desc: 'Snabbast på raksträckan. Akta huvudet!' },
  { id: 'touring', name: 'BMW Offroad Touring', price: 8000, len: 4.9, mass: 1550, torque: 7000, vmax: 31, grip: 1.45, freq: 1.4, damp: 0.55, comH: 0.48, air: 1.0, fuel: 23, drive: 'awd',
    desc: 'Grova däck och lång fjädring för terräng.' },
  { id: 'tesla', name: 'Tesla Model Y', price: 11000, len: 4.75, mass: 1900, torque: 8200, vmax: 38, grip: 1.25, freq: 1.8, damp: 0.5, comH: 0.3, air: 0.95, fuel: 26, drive: 'awd', electric: true, tinted: true,
    desc: 'Elbil: brutal acceleration, låg tyngdpunkt.' }
];
const STAGE_LIST = [
  { id: 'land', price: 0, emoji: '🌳', desc: 'Mjuka backar – lagom för en söndagstur.' },
  { id: 'skog', price: 1200, emoji: '🌲', desc: 'Branta kullar och gropar mellan granarna.' },
  { id: 'fjall', price: 3500, emoji: '🏔️', desc: 'Höga berg och halt snöföre.' },
  { id: 'mane', price: 7000, emoji: '🌙', desc: 'Låg tyngdkraft – långa, galna hopp!' }
];
const UPS = [
  { k: 'engine', name: 'Motor', icon: '⚙️', desc: 'Mer kraft och högre toppfart' },
  { k: 'susp', name: 'Fjädring', icon: '🌀', desc: 'Mjukare landningar, längre slaglängd' },
  { k: 'tires', name: 'Däck', icon: '🛞', desc: 'Bättre grepp i branta backar' },
  { k: 'fuel', name: 'Tank', icon: '⛽', desc: 'Kör längre på en tank' }
];
const UP_COST = [80, 140, 220, 330, 480, 680, 940, 1280, 1700, 2200];
const MAXLV = 10;
const upCost = (car, lv) => Math.round(UP_COST[lv] * (1 + car.price / 9000) / 10) * 10;

/* ---------- sparad data ---------- */
const coins = () => store.get('coins', 0);
const addCoins = n => store.set('coins', Math.max(0, coins() + n));
const owned = () => store.get('owned', ['s80']);
const ups = id => Object.assign({ engine: 0, susp: 0, tires: 0, fuel: 0 }, (store.get('ups', {})[id] || {}));
const stagesOwned = () => store.get('stages', ['land']);
let carId = store.get('car', 's80');
let stageId = store.get('stage', 'land');
let driver = store.get('driver', 2);
const carDef = id => CARS.find(c => c.id === id);
const bestOf = st => (store.get('best', {})[st] || 0);

/* ---------- ljud ---------- */
const SFX = Object.assign({}, CORE_SFX, {
  coin: v => { tone(v >= 100 ? 1568 : v >= 25 ? 1320 : 1175, .06, { type: 'square', vol: .05 }); tone(v >= 100 ? 2093 : 1760, .1, { type: 'square', vol: .05, delay: .05 }); },
  fuel: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .06 })),
  flip: () => [784, 988, 1319].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .13, delay: i * .07 })),
  air: () => tone(600, .3, { to: 1400, type: 'triangle', vol: .1 }),
  land: i => { tone(110, .15, { to: 60, vol: .1 + .25 * i }); noise(.08, { f: 300, vol: .1 + .2 * i }); },
  crash: () => { noise(.7, { f: 500, vol: .5, q: .4, type: 'lowpass' }); tone(200, .5, { to: 50, type: 'sawtooth', vol: .1 }); },
  buy: () => [880, 1175, 1568].forEach((f, i) => tone(f, .1, { type: 'square', vol: .06, delay: i * .06 })),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, .3, { vol: .14, delay: i * .17 }))
});
// motorljud som följer hjulens varv
let eng = null;
function engineStart(electric) {
  engineStop();
  if (!SND.sound) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain();
  o.type = electric ? 'sine' : 'sawtooth'; o2.type = electric ? 'triangle' : 'square';
  f.type = 'lowpass'; f.frequency.value = electric ? 2400 : 700;
  g.gain.value = 0.0001;
  o.connect(f); o2.connect(f); f.connect(g).connect(a.destination);
  o.start(); o2.start();
  eng = { o, o2, g, f, electric };
}
function engineSet(rpm, load) {
  if (!eng || !AC) return;
  const t = AC.currentTime;
  const base = eng.electric ? 180 + rpm * 900 : 38 + rpm * 120;
  eng.o.frequency.setTargetAtTime(base, t, 0.05);
  eng.o2.frequency.setTargetAtTime(base * (eng.electric ? 2 : 0.5), t, 0.05);
  eng.g.gain.setTargetAtTime(SND.sound ? (eng.electric ? 0.015 + load * 0.03 : 0.035 + load * 0.05) : 0.0001, t, 0.08);
}
function engineStop() {
  if (!eng) return;
  try { const t = AC.currentTime; eng.g.gain.setTargetAtTime(0.0001, t, 0.05); eng.o.stop(t + 0.3); eng.o2.stop(t + 0.3); } catch (e) { }
  eng = null;
}

/* ---------- bilder ---------- */
const imgCache = {};
function img(src) { if (!imgCache[src]) { const i = new Image(); i.src = src; imgCache[src] = i; } return imgCache[src]; }
const loaded = im => new Promise(res => { if (im.complete && im.naturalWidth) res(im); else { im.addEventListener('load', () => res(im), { once: true }); im.addEventListener('error', () => res(null), { once: true }); } });

/* ---------- lackfärger ----------
   Varje bil har ett lacklager (cars/<id>_lack.webp: gråskala-skuggning + mask för lacken).
   Ny färg = vald färg + (ljus − bilens medelljus) × kontrast → reflexer och skuggor följer med. */
const PAINTS = [
  { id: 'orig', name: 'Original', c: null },
  { id: 'rod', name: 'Röd', c: '#D62828' }, { id: 'orange', name: 'Orange', c: '#FF7A1A' }, { id: 'gul', name: 'Gul', c: '#FFC928' },
  { id: 'lime', name: 'Limegrön', c: '#8BD12A' }, { id: 'gron', name: 'Grön', c: '#2E9E4F' }, { id: 'turkos', name: 'Turkos', c: '#18B6B0' },
  { id: 'ljusbla', name: 'Ljusblå', c: '#4FB3FF' }, { id: 'bla', name: 'Blå', c: '#1F5BD6' }, { id: 'lila', name: 'Lila', c: '#7D4CDB' },
  { id: 'rosa', name: 'Rosa', c: '#FF6FB0' }, { id: 'brun', name: 'Brun', c: '#7A4A26' }, { id: 'guld', name: 'Guld', c: '#D4AF37' },
  { id: 'vit', name: 'Vit', c: '#F2F2F2' }, { id: 'silver', name: 'Silver', c: '#B8BEC8' }, { id: 'grafit', name: 'Grafit', c: '#4A4F58' },
  { id: 'svart', name: 'Svart', c: '#1A1A1F' }
];
const colorOf = id => { const c = store.get('colors', {})[id]; return PAINTS.some(p => p.id === c) ? c : 'orig'; };
const paintCache = {};          // 'bil:färg' → { canvas, url }
function paintedCar(id, colorId) {
  const key = id + ':' + colorId;
  if (paintCache[key]) return paintCache[key].p;
  const P = PAINTS.find(x => x.id === colorId);
  const p = (async () => {
    const [body, lack] = await Promise.all([loaded(img(`hill/cars/${id}.webp`)), loaded(img(`hill/cars/${id}_lack.webp`))]);
    if (!body || !lack || !P || !P.c) return null;
    const W = body.naturalWidth, H = body.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    x.drawImage(lack, 0, 0, W, H);
    let d;
    try { d = x.getImageData(0, 0, W, H); } catch (e) { return null; }
    const a = d.data, { Lmean, gain } = CAR_META[id].paint;
    const r0 = parseInt(P.c.slice(1, 3), 16) / 255, g0 = parseInt(P.c.slice(3, 5), 16) / 255, b0 = parseInt(P.c.slice(5, 7), 16) / 255;
    for (let i = 0; i < a.length; i += 4) {
      if (!a[i + 3]) continue;
      const v = (a[i] / 255 - Lmean) * gain;
      a[i] = Math.max(0, Math.min(255, (r0 + v) * 255));
      a[i + 1] = Math.max(0, Math.min(255, (g0 + v) * 255));
      a[i + 2] = Math.max(0, Math.min(255, (b0 + v) * 255));
    }
    const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
    layer.getContext('2d').putImageData(d, 0, 0);
    x.clearRect(0, 0, W, H);
    x.drawImage(body, 0, 0);
    x.drawImage(layer, 0, 0);
    let url = null;
    try { url = cv.toDataURL('image/png'); } catch (e) { }
    paintCache[key].canvas = cv; paintCache[key].url = url;
    return cv;
  })();
  paintCache[key] = { p };
  return p;
}
// byt ut bilbilder i menyer/garage när den lackade versionen är klar
function bodySrc(id, colorId) {
  colorId = colorId || colorOf(id);
  if (colorId === 'orig') return `hill/cars/${id}.webp`;
  const k = paintCache[id + ':' + colorId];
  if (k && k.url) return k.url;
  paintedCar(id, colorId).then(() => {
    const u = paintCache[id + ':' + colorId].url;
    if (u) document.querySelectorAll(`img.body[data-car="${id}"][data-paint="${colorId}"]`).forEach(el => { el.src = u; });
  });
  return `hill/cars/${id}.webp`;
}
function carPicHTML(id, locked, colorId) {
  colorId = colorId || colorOf(id);
  const M = CAR_META[id], C = carDef(id);
  const pct = (v, of) => (v / of * 100).toFixed(2) + '%';
  const wh = k => { const [x, y] = M[k], s = M.wheelSize; return `<img class="wh" src="hill/cars/${id}_hjul.webp" style="left:${pct(x - s / 2, M.w)};top:${pct(y - s / 2, M.h)};width:${pct(s, M.w)};height:${pct(s, M.h)}" alt="">`; };
  const [hx, hy, hr] = M.head, r = hr * 1.25;
  return `<div class="carpic ${locked ? 'locked' : ''}" style="--ar:${M.w}/${M.h}">
    <img class="body" src="${bodySrc(id, colorId)}" data-car="${id}" data-paint="${colorId}" alt="">${wh('rear')}${wh('front')}
    <img class="face" src="${avatarSrc(driver)}" style="left:${pct(hx - r, M.w)};top:${pct(hy - r, M.h)};width:${pct(2 * r, M.w)};height:${pct(2 * r, M.h)};opacity:${C.tinted ? .85 : 1}" alt=""></div>`;
}

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id !== 'game') { stopLoop(); engineStop(); }
  ['menuCoins', 'garCoins', 'stgCoins'].forEach(k => { const e = $(k); if (e) e.textContent = '🪙 ' + coins(); });
  if (id === 'menu') buildMenu();
  if (id === 'garage') buildGarage();
  if (id === 'stages') buildStages();
  if (id === 'driver') buildDriver();
}
function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Backracet 🚗', 'l2');
  const C = carDef(carId), st = STAGE_LIST.find(s => s.id === stageId), S = Hill.STAGES[stageId];
  const best = bestOf(stageId);
  $('showcase').innerHTML = `${carPicHTML(carId)}<b>${esc(C.name)}</b>
    <small>${st.emoji} ${S.name} · Förare: ${esc(charName(driver))}${best ? ` · 🏁 Rekord ${best} m` : ''}</small>`;
}

/* ---------- garage ---------- */
let viewCar = carId;
function stat(icon, label, v) { return `<div class="stat"><span>${icon}</span><span>${label}</span><div class="bar"><i style="width:${Math.round(Math.min(1, v) * 100)}%"></i></div></div>`; }
function buildGarage() {
  const C = carDef(viewCar), own = owned().includes(viewCar), u = ups(viewCar);
  const tq = C.torque * (1 + 0.1 * u.engine) / C.mass / 2.2, vm = C.vmax * (1 + 0.045 * u.engine), gr = C.grip * (1 + 0.06 * u.tires), fu = C.fuel * (1 + 0.12 * u.fuel);
  let html = `<div class="row" style="flex-direction:column;align-items:stretch;gap:8px">
    <div style="padding:0 10px">${carPicHTML(viewCar, !own)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
      <div><h4 style="margin:0">${esc(C.name)}</h4><p class="small-note" style="margin:0">${C.desc} ${C.drive === 'awd' ? '· 4WD' : C.drive === 'rear' ? '· Bakhjulsdrift' : '· Framhjulsdrift'}</p></div>
      ${own ? (carId === viewCar ? '<b style="color:#219A40">✅ Vald</b>' : '<button class="btn green small" id="pickCar">Välj bilen</button>')
        : `<button class="btn small ${coins() >= C.price ? 'green' : 'white'}" id="buyCar" ${coins() >= C.price ? '' : 'disabled'}>🪙 ${C.price} – Köp</button>`}
    </div>
    ${stat('💪', 'Kraft', tq / 2.6)}${stat('💨', 'Fart', vm / 44)}${stat('🛞', 'Grepp', gr / 1.9)}${stat(C.electric ? '🔋' : '⛽', C.electric ? 'Batteri' : 'Tank', fu / 55)}
  </div>`;
  if (own) {
    const cur = colorOf(viewCar);
    html += `<div class="row" style="flex-direction:column;align-items:stretch;gap:8px"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:30px">🎨</span>
      <div class="grow"><h4 style="margin:0">Lackfärg</h4><p class="small-note">Gratis – välj hur ${esc(C.name)} ska se ut</p></div><b style="color:var(--muted)">${PAINTS.find(p => p.id === cur).name}</b></div>
      <div class="paints">${PAINTS.map(p => `<button class="pnt ${p.id === cur ? 'on' : ''}" data-paint="${p.id}" title="${p.name}" aria-label="${p.name}"
        style="${p.c ? `background:${p.c}` : `background:url(hill/cars/${viewCar}.webp) 18% 45%/260% auto no-repeat,#eee`}">${p.c ? '' : '<span>Orig.</span>'}</button>`).join('')}</div></div>`;
  }
  if (own) html += UPS.map(up => {
    const lv = u[up.k], cost = lv < MAXLV ? upCost(C, lv) : 0;
    const nm = up.k === 'fuel' && C.electric ? 'Batteri' : up.name, ic = up.k === 'fuel' && C.electric ? '🔋' : up.icon;
    return `<div class="row uprow"><span style="font-size:30px">${ic}</span><div class="grow"><h4 style="margin:0">${nm}</h4><p class="small-note">${up.desc}</p>
      <div class="lv">${Array.from({ length: MAXLV }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
      ${lv >= MAXLV ? '<b style="color:#34C759">MAX ⭐</b>' : `<button class="btn small ${coins() >= cost ? 'green' : 'white'}" data-up="${up.k}" ${coins() >= cost ? '' : 'disabled'}>🪙 ${cost}</button>`}</div>`;
  }).join('');
  $('detail').innerHTML = html;
  $('cars').innerHTML = CARS.map(c => {
    const o = owned().includes(c.id);
    return `<button class="gcar ${c.id === viewCar ? 'sel' : ''}" data-car="${c.id}">${c.id === carId ? '<span class="tag">Vald</span>' : ''}
      ${carPicHTML(c.id, !o)}<b>${esc(c.name)}</b>${o ? `<small>Nivå ${Object.values(ups(c.id)).reduce((a, b) => a + b, 0)}/40</small>` : `<span class="price">🪙 ${c.price}</span>`}</button>`;
  }).join('');
  $('detail').querySelectorAll('.pnt').forEach(b => b.onclick = () => {
    const all = store.get('colors', {}); all[viewCar] = b.dataset.paint; store.set('colors', all);
    SFX.pick(); buzz(12); buildGarage();
  });
  $('cars').querySelectorAll('[data-car]').forEach(b => b.onclick = () => { SFX.tap(); viewCar = b.dataset.car; buildGarage(); $('garage').scrollTo({ top: 0, behavior: 'smooth' }); });
  if ($('pickCar')) $('pickCar').onclick = () => { carId = viewCar; store.set('car', carId); SFX.pick(); buzz(15); buildGarage(); };
  if ($('buyCar')) $('buyCar').onclick = () => {
    if (coins() < C.price) { SFX.bonk(); return; }
    addCoins(-C.price); store.set('owned', [...owned(), viewCar]); carId = viewCar; store.set('car', carId);
    SFX.buy(); buzz(40); confetti(); show('garage');
  };
  $('detail').querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
    const all = store.get('ups', {}); const cur = ups(viewCar); const k = b.dataset.up; const cost = upCost(C, cur[k]);
    if (coins() < cost || cur[k] >= MAXLV) { SFX.bonk(); return; }
    addCoins(-cost); cur[k]++; all[viewCar] = cur; store.set('ups', all);
    SFX.buy(); buzz(25); show('garage');
  });
}

/* ---------- banor ---------- */
function buildStages() {
  $('stageList').innerHTML = STAGE_LIST.map(s => {
    const S = Hill.STAGES[s.id], o = stagesOwned().includes(s.id), best = bestOf(s.id);
    return `<button class="stg ${s.id === stageId ? 'sel' : ''} ${o ? '' : 'locked'}" data-st="${s.id}">
      <div class="pic" style="background:linear-gradient(${S.sky[0]},${S.sky[1]} 60%,${S.grass} 60%,${S.grass} 66%,${S.dirt} 66%)"><span style="position:absolute;inset:0;display:grid;place-items:center;font-size:44px">${s.emoji}</span></div>
      <div class="info"><b>${S.name}</b><small>${s.desc}</small>${o ? (best ? `<small>🏁 Rekord ${best} m</small>` : '<small>Inte körd än</small>') : `<span class="price" style="background:#FFD23F;border-radius:10px;padding:2px 10px;font-weight:700">🪙 ${s.price}</span>`}</div></button>`;
  }).join('');
  $('stageList').querySelectorAll('[data-st]').forEach(b => b.onclick = () => {
    const s = STAGE_LIST.find(x => x.id === b.dataset.st);
    if (!stagesOwned().includes(s.id)) {
      if (coins() < s.price) { SFX.bonk(); return; }
      addCoins(-s.price); store.set('stages', [...stagesOwned(), s.id]); SFX.buy(); confetti();
    } else SFX.pick();
    stageId = s.id; store.set('stage', stageId); show('stages');
  });
}

/* ---------- förare ---------- */
function buildDriver() {
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === driver ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    driver = +el.dataset.i; store.set('driver', driver); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(() => show('menu'), 300);
  });
}

/* ---------- själva körningen ---------- */
let world = null, rend = null, raf = 0, last = 0, paused = false, acc = 0;
const STEP = 1 / 60;
async function startRun() {
  const C = carDef(carId);
  const hooks = { sfx: (n, a) => SFX[n] && SFX[n](a), end: onEnd };
  world = new Hill.World({ stage: stageId, carDef: C, ups: ups(carId), best: bestOf(stageId) }, hooks);
  show('game');
  if (!rend) rend = new Hill.Renderer($('cv'), {});
  rend.resize(); rend._init = false;
  const col = colorOf(carId);
  const body = col === 'orig' ? img(`hill/cars/${carId}.webp`) : (await paintedCar(carId, col)) || img(`hill/cars/${carId}.webp`);
  rend.imgs = { body, wheel: img(`hill/cars/${carId}_hjul.webp`), face: img(avatarSrc(driver)) };
  $('hFuelIcon').textContent = C.electric ? '🔋' : '⛽';
  $('hBest').textContent = bestOf(stageId) ? `🏁 ${bestOf(stageId)} m` : '🏁 –';
  $('startHint').classList.remove('hidden');
  setPedals(0, 0);
  paused = false;
  ac(); engineStart(C.electric);
  last = performance.now(); acc = 0;
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
let hudLast = {};
function hud() {
  const c = world.car;
  const set = (id, v) => { if (hudLast[id] !== v) { hudLast[id] = v; $(id).textContent = v; } };
  set('hDist', Math.max(0, Math.floor(world.maxX - 4)) + ' m');
  set('hCoins', String(world.coins));
  const f = c.fuel / c.fuelMax;
  $('hFuelBar').style.transform = `scaleX(${f})`;
  $('hFuel').classList.toggle('low', f < 0.22);
}
function loop(now) {
  if (!world || current !== 'game') return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    acc += dt;
    while (acc >= STEP) { world.step(STEP); acc -= STEP; }
    const c = world.car, rpm = Math.min(1.2, Math.abs(c.wheels[0].om * c.wheels[0].r) / c.vmax);
    engineSet(rpm, world.gas);
  }
  rend.draw(world, paused ? 0 : dt);
  hud();
  raf = requestAnimationFrame(loop);
}

/* pedaler (flera fingrar samtidigt) och tangentbord */
const held = { gas: new Set(), brake: new Set() };
function setPedals(g, b) { if (world) { world.gas = g; world.brake = b; } $('pGas').classList.toggle('down', !!g); $('pBrake').classList.toggle('down', !!b); }
function updPedals() { setPedals(held.gas.size ? 1 : 0, held.brake.size ? 1 : 0); if (held.gas.size) $('startHint').classList.add('hidden'); }
[['pGas', 'gas'], ['pBrake', 'brake']].forEach(([id, k]) => {
  const el = $(id);
  el.addEventListener('pointerdown', e => { ac(); try { el.setPointerCapture(e.pointerId); } catch (_) { } held[k].add(e.pointerId); updPedals(); buzz(8); });
  const up = e => { held[k].delete(e.pointerId); updPedals(); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
});
const KEYS = { ArrowRight: 'gas', KeyD: 'gas', ArrowUp: 'gas', ArrowLeft: 'brake', KeyA: 'brake', ArrowDown: 'brake' };
window.addEventListener('keydown', e => { const k = KEYS[e.code]; if (k && current === 'game') { held[k].add('kb'); updPedals(); e.preventDefault(); } });
window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) { held[k].delete('kb'); updPedals(); } });
window.addEventListener('resize', () => { if (rend && current === 'game') rend.resize(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && current === 'game' && world && !world.over) pause(); });

function pause() {
  if (!world || world.over || paused) return;
  paused = true; held.gas.clear(); held.brake.clear(); updPedals(); engineSet(0, 0);
  openPanel(`<h3>Paus ⏸️</h3><p>${Math.floor(world.maxX - 4)} m · 🪙 ${world.coins}</p>
    <button class="btn green" id="pResume">▶️ Fortsätt</button><button class="btn" id="pRestart">🔁 Börja om</button><button class="btn white" id="pMenu">🏠 Meny</button>`);
  $('pResume').onclick = () => { SFX.tap(); closePanel(); paused = false; last = performance.now(); };
  $('pRestart').onclick = () => { SFX.tap(); closePanel(); startRun(); };
  $('pMenu').onclick = () => { SFX.tap(); closePanel(); world = null; show('menu'); };
}
$('gPause').onclick = () => { SFX.tap(); pause(); };

async function onEnd(r) {
  held.gas.clear(); held.brake.clear(); updPedals();
  $('startHint').classList.add('hidden');
  if (r.why === 'crash') { SFX.crash(); buzz(200); } else SFX.lose();
  engineSet(0, 0);
  setTimeout(engineStop, 300);
  await wait(r.why === 'crash' ? 1300 : 700);
  if (current !== 'game') return;
  addCoins(r.coins);
  const prev = bestOf(stageId), isNew = r.dist > prev;
  if (isNew) { const b = store.get('best', {}); b[stageId] = r.dist; store.set('best', b); }
  const runs = store.get('runs', 0) + 1; store.set('runs', runs);
  const S = Hill.STAGES[stageId];
  if (isNew && prev > 0) await celebrate(driver, 'Nytt rekord!', `${r.dist} m på ${S.name} 🏁`, ['⭐', '🚗', '✨', '🏆', '🌟', '🎊', '🏁', '⭐']);
  const why = { crash: 'Krasch! Föraren slog i huvudet 💥', fuel: CARS.find(c => c.id === carId).electric ? 'Batteriet tog slut 🔋' : 'Bensinen tog slut ⛽', stuck: 'Bilen fastnade upp och ner 🙃' }[r.why];
  openPanel(`<div class="win-av" style="width:min(30vw,110px);margin-top:6px">${isNew ? '<div class="crown">👑</div>' : ''}${avHTML(driver)}</div>
    <h3>${isNew ? (prev > 0 ? 'Nytt rekord! 🎉' : r.dist + ' meter!') : r.dist + ' meter'}</h3><p>${why}</p>
    <div class="res">
      <div class="r"><span>📏 Sträcka</span><b>${r.dist} m</b></div>
      <div class="r"><span>🪙 Mynt</span><b>+${r.coins}</b></div>
      ${r.flips ? `<div class="r"><span>🤸 Volter</span><b>${r.flips}</b></div>` : ''}
      <div class="r"><span>🏁 Rekord på ${S.name}</span><b>${Math.max(prev, r.dist)} m</b></div>
    </div>
    <button class="btn green" id="rAgain">🔁 Kör igen</button>
    <button class="btn blue" id="rGarage">🔧 Garage (🪙 ${coins()})</button>
    <button class="btn white" id="rMenu">🏠 Meny</button>`);
  $('rAgain').onclick = () => { SFX.tap(); closePanel(); startRun(); };
  $('rGarage').onclick = () => { SFX.tap(); closePanel(); world = null; viewCar = carId; show('garage'); };
  $('rMenu').onclick = () => { SFX.tap(); closePanel(); world = null; show('menu'); };
}

function openPanel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }

$('play').onclick = () => { SFX.tap(); startRun(); };
$('toGarage').onclick = () => { SFX.tap(); viewCar = carId; show('garage'); };
$('toStages').onclick = () => { SFX.tap(); show('stages'); };
$('toDriver').onclick = () => { SFX.tap(); show('driver'); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('pResume')) $('pResume').click(); else if ($('rMenu')) $('rMenu').click(); else closePanel();
    return true;
  }
  if (current === 'game') { pause(); return true; }
  if (current === 'menu') { goHub(); return true; }
  show('menu'); return true;
};

// XC60 är borttagen – ge tillbaka det man lagt på den
(function migrateXC60() {
  const own = owned();
  if (own.includes('xc60') && !store.get('xc60refund', false)) {
    const u = Object.assign({ engine: 0, susp: 0, tires: 0, fuel: 0 }, (store.get('ups', {}).xc60 || {}));
    let back = 3000;
    for (const k in u) for (let lv = 0; lv < u[k]; lv++) back += Math.round(UP_COST[lv] * (1 + 3000 / 9000) / 10) * 10;
    addCoins(back);
    store.set('owned', own.filter(x => x !== 'xc60'));
    store.set('xc60refund', true);
  }
  if (!CARS.some(c => c.id === carId)) { carId = 's80'; store.set('car', carId); }
})();
// förladda bilderna
CARS.forEach(c => { img(`hill/cars/${c.id}.webp`); img(`hill/cars/${c.id}_hjul.webp`); if (colorOf(c.id) !== 'orig') paintedCar(c.id, colorOf(c.id)); });
bubbles();
show('menu');
