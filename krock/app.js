/* Bucinca Krockarenan – meny, garage, verkstad, stegen, två spelare, nätverksturnering och uppspelning av striderna. */
'use strict';
const store = makeStore('bk');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = location.protocol === 'http:' && location.port === String(PORT);
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const { CHASSIS, WHEELS, WEAPONS, SLOT_NAME } = KR;

const SFX = Object.assign({}, CORE_SFX, {
  coin: () => [988, 1319].forEach((f, i) => tone(f, .09, { type: 'square', vol: .05, delay: i * .07 })),
  saw: () => noise(.08, { f: 3200, q: 3, vol: .07 }),
  clank: () => tone(900 + Math.random() * 400, .06, { type: 'square', vol: .04, to: 500 }),
  hit: () => { noise(.12, { f: 600, vol: .25 }); tone(140, .12, { to: 70, vol: .2 }); },
  boom: () => { noise(.7, { type: 'lowpass', f: 500, vol: .5 }); tone(90, .5, { to: 40, vol: .3 }); },
  launch: () => noise(.3, { f: 1500, q: .7, vol: .12 }),
  flip: () => tone(300, .25, { to: 900, type: 'triangle', vol: .12 }),
  bonk: () => tone(180, .14, { type: 'square', vol: .1, to: 90 }),
  burn: () => tone(1800, .05, { type: 'sawtooth', vol: .025, to: 1400 }),
  hop: () => tone(240, .2, { to: 520, vol: .1 }),
  go: () => [523, 784].forEach((f, i) => tone(f, .25, { type: 'square', vol: .07, delay: i * .12 })),
  beep: () => tone(660, .12, { type: 'square', vol: .06 }),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 }))
});

/* ---------- profil: mynt, ägda delar, bilar per figur ---------- */
const PROF = {
  def: () => ({ coins: 300, own: { chassis: { lada: 1 }, wheels: { vanlig: 1 }, weapons: { sag: 1, lans: 1 } }, cars: {}, lad: 0, wins: 0, battles: 0 }),
  get() {
    let raw = null;
    try { if (window.Android && Android.profGet) raw = Android.profGet('krock') || null; } catch (e) { }
    let v = null;
    try { v = raw ? JSON.parse(raw) : store.get('prof', null); } catch (e) { }
    const d = this.def();
    v = Object.assign(d, v || {});
    v.own = Object.assign(this.def().own, v.own || {});
    for (const k of ['chassis', 'wheels', 'weapons']) v.own[k] = Object.assign({}, this.def().own[k], v.own[k] || {});
    return v;
  },
  set(v) {
    try { if (window.Android && Android.profSet) Android.profSet('krock', JSON.stringify(v)); } catch (e) { }
    store.set('prof', v);
  }
};
let prof = PROF.get();
const save = () => PROF.set(prof);
const carOf = ch => prof.cars[ch] || { c: 'lada', w: 'vanlig', s: { front: 'lans', top: 'sag' } };
const fullOfCh = ch => KR.full(carOf(ch), prof.own);
function addCoins(n) { prof.coins += n; save(); updCoins(); }
function updCoins() { for (const id of ['coins1', 'coins2', 'coins3', 'coins4']) if ($(id)) $(id).textContent = '🪙 ' + prof.coins; }

/* ---------- jag ---------- */
const ME = { ch: store.get('ch', 0), name: '' };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
ME.name = Q.get('n') || charName(ME.ch);
let QFB = null;   // bygge som följde med från appen/webben när man gick med
try { if (Q.get('fb')) QFB = KR.sanitize(JSON.parse(Q.get('fb'))); } catch (e) { }
const myFB = () => (QFB && Q.get('c') != null && +Q.get('c') === ME.ch) ? QFB : fullOfCh(ME.ch);

const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  updCoins();
  if (id === 'menu') buildMenu();
  if (id === 'garage') buildGarage();
  if (id === 'shop') buildShop();
  if (id === 'ladder') buildLadder();
  if (id === 'join') buildJoin();
  if (id === 'lobby') buildLobby();
  if (id === 'battle') resize();
  if (window.Android && Android.keepAwake) try { Android.keepAwake(id === 'battle' || id === 'lobby'); } catch (e) { }
}
function panel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }

function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Krockarenan 💥', 'l2');
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Förare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    <div><span class="pw">⚡ ${KR.power(fullOfCh(ME.ch))}</span> <small style="display:inline">${CHASSIS[fullOfCh(ME.ch).c].name}</small></div></div>`;
  $('toHost').classList.toggle('hidden', !canHost());
}
function pickFigure(title, done) {
  $('meTitle').textContent = title;
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b>
    <span class="pw">⚡ ${KR.power(fullOfCh(i))}</span></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    ME.ch = +el.dataset.i; ME.name = charName(ME.ch); store.set('ch', ME.ch); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(done, 250);
  });
  $('meOk').onclick = () => { SFX.tap(); done(); };
  $('meBack').classList.toggle('hidden', CLIENT && !Q.get('back') && !window.Android);
  show('meScr');
}
$('meCard').onclick = () => { SFX.tap(); pickFigure('Vem kör?', () => show('menu')); };
$('meBack').onclick = () => { SFX.tap(); if (CLIENT) leave(); else show('menu'); };

/* ================= GARAGE ================= */
let garCh = ME.ch;
const prevCv = document.createElement('canvas');
function drawPreview(cv, fb, ch) {
  const ctx = cv.getContext('2d');
  const W = cv.clientWidth || 300, H = cv.clientHeight || 150, dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = KSIM.geom(fb);
  const s = Math.min(W / 5.2, H / 2.6);
  ctx.save();
  ctx.translate(W / 2, H * 0.72); ctx.scale(s, -s);
  ctx.fillStyle = '#00000030'; ctx.beginPath(); ctx.ellipse(0, 0.02, g.L * 0.6, 0.08, 0, 0, 7); ctx.fill();
  const f = KDRAW.parse(g, KDRAW.restFrame(g));
  KDRAW.car(ctx, g, f, 1, FACES[ch], CHARS[ch], performance.now() / 1000 * 0.3, { still: true });
  ctx.restore();
}
function buildGarage() {
  const ch = garCh, b = carOf(ch), fb = KR.full(b, prof.own);
  const C = CHASSIS[fb.c];
  const slotRow = (key, ic, label, name, lv, sub) => `<button class="slot" data-k="${key}"><span class="ic">${ic}</span><div class="grow"><small>${label}</small><b>${name}</b>${lv ? ` <span class="lv">Nv ${lv}</span>` : ''}${sub ? `<small>${sub}</small>` : ''}</div><span>✏️</span></button>`;
  const rows = [slotRow('c', C.icon, 'Kaross', C.name, fb.cl, `❤️ ${KR.hpOf(fb)} liv`), slotRow('w', WHEELS[fb.w].icon, 'Hjul', WHEELS[fb.w].name, 0, WHEELS[fb.w].desc)];
  for (const sl of C.slots) {
    const e = fb.s[sl];
    rows.push(e ? slotRow(sl, WEAPONS[e[0]].icon, SLOT_NAME[sl], WEAPONS[e[0]].name, e[1], '') : slotRow(sl, '➕', SLOT_NAME[sl], 'Tom plats', 0, 'Tryck för att sätta på ett vapen'));
  }
  $('garBox').innerHTML = `
    <div class="card"><h4>Vems bil?</h4><div class="figs">${CHARS.map((_, i) => `<button class="${i === ch ? 'on' : ''}" data-f="${i}" style="${styleOf(i)}">${avHTML(i)}</button>`).join('')}</div></div>
    <div class="gar">
      <div class="card" style="${styleOf(ch)}"><canvas class="prev" id="prev"></canvas>
        <div class="stats"><span>⚡ Kraft ${KR.power(fb)}</span><span>❤️ ${KR.hpOf(fb)}</span><span>🏎️ ${Math.round((C.speed * WHEELS[fb.w].spd) * 100)} %</span></div>
        <p class="note" style="text-align:center">${esc(charName(ch))} kör den här bilen i alla strider.</p></div>
      <div class="card"><h4>Bygg bilen</h4>${rows.join('')}
        <button class="btn purple small" id="gShop">🛒 Köp och uppgradera delar</button></div>
    </div>`;
  $('garBox').querySelectorAll('[data-f]').forEach(el => el.onclick = () => { garCh = +el.dataset.f; SFX.tap(); buildGarage(); });
  $('garBox').querySelectorAll('.slot').forEach(el => el.onclick = () => { SFX.tap(); pickPart(el.dataset.k); });
  $('gShop').onclick = () => { SFX.tap(); shopBack = 'garage'; show('shop'); };
  requestAnimationFrame(() => drawPreview($('prev'), fb, ch));
}
function setCar(b) { prof.cars[garCh] = b; save(); buildGarage(); }
function pickPart(key) {
  const b = JSON.parse(JSON.stringify(carOf(garCh)));
  b.s = b.s || {};
  let opts = [];
  if (key === 'c') opts = Object.keys(CHASSIS).map(id => ({ id, ic: CHASSIS[id].icon, n: CHASSIS[id].name, sub: `❤️ ${CHASSIS[id].hp} · ${CHASSIS[id].slots.length} vapenplatser · ${CHASSIS[id].desc}`, own: !!prof.own.chassis[id], lv: prof.own.chassis[id], cur: b.c === id, price: CHASSIS[id].price }));
  else if (key === 'w') opts = Object.keys(WHEELS).map(id => ({ id, ic: WHEELS[id].icon, n: WHEELS[id].name, sub: WHEELS[id].desc, own: !!prof.own.wheels[id], cur: b.w === id, price: WHEELS[id].price }));
  else {
    opts = [{ id: '', ic: '🚫', n: 'Inget vapen', sub: 'Tom plats', own: true, cur: !b.s[key] }];
    const usedElsewhere = Object.entries(b.s).filter(([sl]) => sl !== key).map(([, id]) => id);
    for (const id of Object.keys(WEAPONS)) if (WEAPONS[id].slots.includes(key))
      opts.push({ id, ic: WEAPONS[id].icon, n: WEAPONS[id].name, sub: usedElsewhere.includes(id) ? 'Sitter redan på en annan plats (flyttas hit)' : WEAPONS[id].desc, own: !!prof.own.weapons[id], lv: prof.own.weapons[id], cur: b.s[key] === id, price: WEAPONS[id].price });
  }
  const title = key === 'c' ? 'Välj kaross' : key === 'w' ? 'Välj hjul' : `Vapen: ${SLOT_NAME[key]}`;
  panel(`<h3>${title}</h3><div class="picks">${opts.map((o, i) => `<button class="slot ${o.cur ? 'cur' : ''} ${o.own ? '' : 'lock'}" data-i="${i}"><span class="ic">${o.ic}</span>
    <div class="grow"><b>${o.n}</b>${o.lv ? ` <span class="lv">Nv ${o.lv}</span>` : ''}<small>${o.own ? o.sub : `🔒 Köp i verkstaden för 🪙 ${o.price}`}</small></div></button>`).join('')}</div>
    <button class="btn white small" id="pClose">Stäng</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
  $('panel').querySelectorAll('.slot').forEach(el => el.onclick = () => {
    const o = opts[+el.dataset.i];
    if (!o.own) { SFX.bonk(); closePanel(); shopBack = 'garage'; shopTab = key === 'c' ? 'chassis' : key === 'w' ? 'wheels' : 'weapons'; show('shop'); return; }
    SFX.pick(); buzz(10);
    if (key === 'c') { b.c = o.id; for (const sl of Object.keys(b.s)) if (!CHASSIS[o.id].slots.includes(sl)) delete b.s[sl]; }
    else if (key === 'w') b.w = o.id;
    else { for (const sl of Object.keys(b.s)) if (b.s[sl] === o.id) delete b.s[sl]; if (o.id) b.s[key] = o.id; else delete b.s[key]; }
    closePanel(); setCar(b);
  });
}

/* ================= VERKSTAD ================= */
let shopTab = 'weapons', shopBack = 'menu';
function buildShop() {
  const tabs = [['weapons', '⚔️ Vapen'], ['chassis', '🚗 Karosser'], ['wheels', '⚫ Hjul']];
  const cat = shopTab === 'weapons' ? WEAPONS : shopTab === 'chassis' ? CHASSIS : WHEELS;
  const own = prof.own[shopTab];
  const items = Object.keys(cat).map(id => {
    const it = cat[id], lv = own[id];
    let stat = '';
    if (shopTab === 'weapons' && it.dmg) stat = `💥 ${Math.round(it.dmg * KR.mult(lv || 1))} ${it.unit}`;
    if (shopTab === 'weapons' && id === 'skold') stat = `❤️ +${Math.round(55 * KR.mult(lv || 1))} liv`;
    if (shopTab === 'weapons' && id === 'boost') stat = `🔥 kraft ${Math.round(100 * Math.sqrt(KR.mult(lv || 1)))} %`;
    if (shopTab === 'chassis') stat = `❤️ ${Math.round(it.hp * KR.mult(lv || 1))} liv · ${it.slots.length} platser`;
    if (shopTab === 'wheels') stat = `fart ${Math.round(it.spd * 100)} % · grepp ${Math.round(it.grip * 100)} %`;
    let btn;
    if (!lv) btn = `<button class="btn green" data-buy="${id}" ${prof.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>`;
    else if (shopTab === 'wheels') btn = `<span class="pw">✓ Din</span>`;
    else if (lv >= KR.MAXLV) btn = `<span class="pw">MAX</span>`;
    else { const c = KR.upCost(it.price, lv); btn = `<button class="btn purple" data-up="${id}" ${prof.coins < c ? 'disabled' : ''}>⬆️ 🪙 ${c}</button>`; }
    return `<div class="item"><span class="ic">${it.icon}</span><div class="grow"><b>${it.name}</b>${lv && shopTab !== 'wheels' ? ` <span class="lv" style="background:#8B7BFF;color:#fff;border-radius:8px;padding:1px 7px;font-size:12px;font-weight:700">Nv ${lv}</span>` : ''}
      <small>${it.desc}</small><small><b style="font-size:12px">${stat}</b></small></div>${btn}</div>`;
  }).join('');
  $('shopBox').innerHTML = `<div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === shopTab ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="shop">${items}</div>
    <p class="note" style="text-align:center;color:#fff">Vinn strider i arenan för att tjäna mynt. Uppgraderingar gör vapnen starkare (+18 % per nivå).</p>`;
  $('shopBox').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { shopTab = b.dataset.t; SFX.tap(); buildShop(); });
  $('shopBox').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const id = b.dataset.buy, p = cat[id].price;
    if (prof.coins < p) return;
    prof.coins -= p; own[id] = 1; save(); SFX.coin(); buzz(20); buildShop(); updCoins();
  });
  $('shopBox').querySelectorAll('[data-up]').forEach(b => b.onclick = () => {
    const id = b.dataset.up, c = KR.upCost(cat[id].price, own[id]);
    if (prof.coins < c) return;
    prof.coins -= c; own[id]++; save(); SFX.levelup ? SFX.levelup() : SFX.win(); buzz(20); buildShop(); updCoins();
  });
}
$('shopBack').onclick = () => { SFX.tap(); show(shopBack); };

/* ================= STEGEN (mot datorn) ================= */
const botName = (b) => b.title;
function buildLadder() {
  const myPw = KR.power(fullOfCh(ME.ch));
  const rows = [];
  for (let r = 0; r < KR.LADDER; r++) {
    const b = KR.bot(r, CHARS.length);
    const st = r < prof.lad ? 'done' : r === prof.lad ? 'next' : 'locked';
    const pw = KR.power(b.fb);
    rows.push(`<div class="rung ${st}" style="${styleOf(b.ch)}"><span class="no">${r + 1}</span>${avHTML(b.ch)}<div class="grow"><b>${esc(botName(b))}</b> <small style="display:inline">· ${esc(charName(b.ch))} kör</small>
      <small>${CHASSIS[b.fb.c].icon} ${CHASSIS[b.fb.c].name} · ${Object.values(b.fb.s).map(e => WEAPONS[e[0]].icon).join(' ')} · <span class="pw" style="font-size:12px">⚡ ${pw}</span></small>
      <small>Vinst: 🪙 ${b.reward}</small></div>
      ${st === 'done' ? `<button class="btn white" data-r="${r}">✓ Igen</button>` : st === 'next' ? `<button class="btn green" data-r="${r}">⚔️ Slåss!</button>` : '🔒'}</div>`);
  }
  $('ladBox').innerHTML = `<div class="card" style="${styleOf(ME.ch)}"><div style="display:flex;align-items:center;gap:10px">${avHTML(ME.ch, 'mini')}<div style="flex:1"><b>${esc(charName(ME.ch))}</b> kör
      <div><span class="pw">⚡ ${myPw}</span> ${CHASSIS[fullOfCh(ME.ch).c].name}</div></div><button class="btn blue small" id="lGar">🔧 Garage</button></div>
      <p class="note">Besegra motståndarna en i taget. Kraften visar ungefär hur stark bilen är – men rätt vapen mot rätt bil gör stor skillnad!</p></div>
    <div class="ladder">${rows.join('')}</div>`;
  $('lGar').onclick = () => { SFX.tap(); garCh = ME.ch; show('garage'); };
  $('ladBox').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { SFX.tap(); fightBot(+b.dataset.r); });
  const nx = $('ladBox').querySelector('.rung.next');
  if (nx) setTimeout(() => nx.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
}
async function fightBot(rank) {
  const b = KR.bot(rank, CHARS.length);
  const me = { name: charName(ME.ch), ch: ME.ch, fb: fullOfCh(ME.ch) };
  const op = { name: botName(b), ch: b.ch, fb: b.fb };
  const rep = KSIM.fight(me.fb, op.fb);
  const res = await play(rep, [me, op], { skip: true });
  let msg, coins;
  if (res.winner === 0) {
    const first = rank === prof.lad;
    coins = first ? b.reward : Math.round(b.reward * 0.3);
    if (first) prof.lad = Math.min(KR.LADDER, prof.lad + 1);
    prof.wins++; msg = first ? `Du slog ${esc(op.name)}! Nästa motståndare är upplåst.` : `Du vann igen!`;
    await celebrate(ME.ch, 'Du vann!', `+${coins} mynt 🪙`, ['💥', '🏆', '⚙️', '⭐', '🔧', '🎉', '✨', '🪙']);
  } else { coins = 20; msg = res.winner < 0 ? 'Oavgjort!' : `${esc(op.name)} vann den här gången. Bygg om bilen och försök igen!`; SFX.sad(); }
  prof.battles++; addCoins(coins);
  panel(`<h3>${res.winner === 0 ? 'Seger! 🏆' : res.winner < 0 ? 'Oavgjort 🤝' : 'Förlust 💥'}</h3><p>${msg}</p><div class="score-big">🪙 +${coins}</div>
    <button class="btn green" id="pNext">${res.winner === 0 && rank + 1 === prof.lad && prof.lad < KR.LADDER ? '⚔️ Nästa motståndare' : '🔁 Försök igen'}</button>
    <button class="btn blue small" id="pGar">🔧 Garage</button><button class="btn white small" id="pMenu">⬅️ Arenan</button>`);
  $('pNext').onclick = () => { SFX.tap(); closePanel(); fightBot(res.winner === 0 && rank + 1 === prof.lad ? prof.lad : rank); };
  $('pGar').onclick = () => { SFX.tap(); closePanel(); garCh = ME.ch; show('garage'); };
  $('pMenu').onclick = () => { SFX.tap(); closePanel(); show('ladder'); };
}

/* ================= TVÅ SPELARE ================= */
let duoPick = [];
function startDuo() { duoPick = []; buildDuo(); show('duo'); }
function buildDuo() {
  const step = duoPick.length;
  $('duoTitle').textContent = step === 0 ? 'Spelare 1 – välj förare' : 'Spelare 2 – välj förare';
  $('duoChars').innerHTML = CHARS.map((_, i) => `<button class="char ${duoPick.includes(i) ? 'taken' : ''}" data-i="${i}" data-tag="Spelare 1" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b><span class="pw">⚡ ${KR.power(fullOfCh(i))}</span></button>`).join('');
  $('duoChars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    const i = +el.dataset.i;
    if (duoPick.includes(i)) { SFX.bonk(); return; }
    SFX.pick(); buzz(12); duoPick.push(i);
    if (duoPick.length < 2) buildDuo(); else duoFight();
  });
}
async function duoFight() {
  const [a, b] = duoPick;
  const A = { name: charName(a), ch: a, fb: fullOfCh(a) }, B = { name: charName(b), ch: b, fb: fullOfCh(b) };
  const res = await play(KSIM.fight(A.fb, B.fb), [A, B], { skip: true });
  if (res.winner >= 0) await celebrate(duoPick[res.winner], `${charName(duoPick[res.winner])} vann!`, '', ['💥', '🏆', '⚙️', '⭐', '🔧', '🎉', '✨', '🪙']);
  addCoins(25);
  panel(`<h3>${res.winner < 0 ? 'Oavgjort! 🤝' : esc(charName(duoPick[res.winner])) + ' vann! 🏆'}</h3><p>Båda får 🪙 25 till verkstaden.</p>
    <button class="btn green" id="pAgain">🔁 Revansch</button><button class="btn blue small" id="pGar">🔧 Garage</button><button class="btn white small" id="pMenu">🏠 Meny</button>`);
  $('pAgain').onclick = () => { SFX.tap(); closePanel(); duoFight(); };
  $('pGar').onclick = () => { SFX.tap(); closePanel(); show('garage'); };
  $('pMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
}

/* ================= UPPSPELNING AV EN STRID ================= */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
addEventListener('resize', () => { if (current === 'battle') resize(); });
const PB = { speed: 1, skip: false, on: false };
$('bSpeed').onclick = () => { PB.speed = PB.speed === 1 ? 2 : PB.speed === 2 ? 4 : 1; $('bSpeed').textContent = `⏩ ${PB.speed}×`; SFX.tap(); };
$('bSkip').onclick = () => { PB.skip = true; SFX.tap(); if (G.mode === 'host' && HOST.inT) hostAll({ t: 'skip' }); };
function fighterHTML(p, side) { return `${avHTML(p.ch)}<div class="info"><b>${esc(p.name)}</b><div class="hpbar"><i id="hp${side}" style="width:100%"></i><span id="hpt${side}"></span></div></div>`; }
function big(txt, ms) { const b = $('big'); b.textContent = txt; b.classList.remove('hidden', 'pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(big.t); big.t = setTimeout(() => b.classList.add('hidden'), ms || 900); }

/* spelar upp en repris; who = [{name, ch, fb}, …]; returnerar {winner} när den är klar */
function play(rep, who, opts = {}) {
  return new Promise(async resolve => {
    show('battle');
    $('f0').innerHTML = fighterHTML(who[0], 0); $('f0').setAttribute('style', styleOf(who[0].ch));
    $('f1').innerHTML = fighterHTML(who[1], 1); $('f1').setAttribute('style', styleOf(who[1].ch));
    $('bSkip').classList.toggle('hidden', !opts.skip); $('bSpeed').classList.toggle('hidden', !!opts.noSpeed);
    PB.speed = 1; $('bSpeed').textContent = '⏩ 1×'; PB.skip = false; PB.on = true;
    const geo = rep.builds.map(fb => KSIM.geom(fb));
    const N = rep.frames.length, fps = rep.fps;
    const evs = rep.events.slice().sort((a, b) => a.f - b.f);
    let ei = 0, f = 0, last = performance.now(), shake = 0, hype = 0;
    const parts = [], texts = [];
    const cam = { x: 0, z: 14, s: 40, groundY: 0 };
    // nedräkning
    const drawAt = (fi, now) => {
      fi = Math.max(0, Math.min(N - 1, fi));
      const i = Math.min(N - 1, Math.floor(fi)), k = fi - i;
      const fr = rep.frames[i], nx = rep.frames[Math.min(N - 1, i + 1)];
      const cars = [0, 1].map(s => KDRAW.lerpCar(geo[s], fr[s], nx[s], k));
      // kamera
      const mid = (cars[0].x + cars[1].x) / 2, span = Math.abs(cars[0].x - cars[1].x) + 7;
      const tz = Math.max(span, 9);
      cam.x += (mid - cam.x) * 0.12; cam.z += (tz - cam.z) * 0.08;
      const portrait = H > W;
      cam.s = Math.min(W / cam.z, H / (portrait ? 9 : 6.5));
      cam.groundY = H * (portrait ? 0.68 : 0.8);
      const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      KDRAW.backdrop(ctx, W, H, cam, now / 1000, hype);
      ctx.save();
      ctx.translate(W / 2 + sx, cam.groundY + sy); ctx.scale(cam.s, -cam.s); ctx.translate(-cam.x, 0);
      KDRAW.arena(ctx, KSIM.ARENA);
      // skuggor
      ctx.fillStyle = '#00000040';
      for (const c of cars) { ctx.beginPath(); ctx.ellipse(c.x, 0.02, 1.3, 0.1, 0, 0, 7); ctx.fill(); }
      cars.forEach((c, s2) => KDRAW.car(ctx, geo[s2], c, s2 === 0 ? 1 : -1, FACES[who[s2].ch], CHARS[who[s2].ch], fi / fps));
      for (const r of (fr[2] || [])) KDRAW.rocket(ctx, r);
      // partiklar
      for (const p of parts) { ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      ctx.restore();
      // skadesiffror
      ctx.font = `700 ${Math.max(16, cam.s * 0.45)}px Fredoka, system-ui, sans-serif`; ctx.textAlign = 'center';
      for (const t of texts) {
        const X = W / 2 + (t.x - cam.x) * cam.s, Y = cam.groundY - t.y * cam.s;
        ctx.globalAlpha = Math.max(0, 1 - t.life / 1.1); ctx.lineWidth = 4; ctx.strokeStyle = '#2B2350'; ctx.fillStyle = t.c;
        ctx.strokeText(t.txt, X, Y); ctx.fillText(t.txt, X, Y);
      }
      ctx.globalAlpha = 1;
      // HUD
      cars.forEach((c, s2) => {
        const fr2 = Math.max(0, c.hp / rep.hpMax[s2]);
        $('hp' + s2).style.width = (fr2 * 100) + '%';
        $('hpt' + s2).textContent = Math.ceil(Math.max(0, c.hp));
      });
      $('btime').textContent = Math.max(0, Math.ceil(KSIM.TMAX - fi / fps));
    };
    resize();
    const t0 = performance.now();
    await new Promise(res2 => {
      let n = 3;
      const tick = () => {
        if (n > 0) { big(String(n), 700); SFX.beep(); n--; setTimeout(tick, 650); }
        else { big('KÖR! 💥', 700); SFX.go(); res2(); }
      };
      const idle = now => { if (PB.on && n >= 0 && current === 'battle') { drawAt(0, now); if (n > 0 || performance.now() - t0 < 2000) requestAnimationFrame(idle); } };
      requestAnimationFrame(idle);
      tick();
    });
    last = performance.now();
    const step = now => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
      if (PB.skip) f = N - 1;
      const prevF = f;
      f = Math.min(N - 1, f + dt * fps * PB.speed); PB.f = f; PB.N = N;
      // händelser
      while (ei < evs.length && evs[ei].f <= f) {
        const e = evs[ei++];
        if (PB.skip) continue;
        if (e.k === 'spark') { if (Math.random() < 0.5) SFX.saw(); for (let i = 0; i < 6; i++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, life: 0, max: 0.35, c: pick(['#FFD23F', '#FFF', '#FF8A3D']), r: 0.05 }); hype = Math.min(1, hype + 0.05); }
        else if (e.k === 'clank') { SFX.clank(); for (let i = 0; i < 4; i++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: Math.random() * 4, life: 0, max: 0.25, c: '#fff', r: 0.04 }); }
        else if (e.k === 'hit') { SFX.hit(); buzz(15); shake = Math.max(shake, 6); texts.push({ x: e.x, y: e.y + 0.6, txt: '-' + e.v, c: '#FF4D6D', life: 0 }); hype = Math.min(1, hype + 0.25); for (let i = 0; i < 10; i++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 7, vy: Math.random() * 6, life: 0, max: 0.4, c: pick(['#FFD23F', '#FF8A3D', '#fff']), r: 0.06 }); }
        else if (e.k === 'boom') {
          const bigB = e.s >= 0; SFX.boom(); buzz(bigB ? 80 : 30); shake = Math.max(shake, bigB ? 18 : 9); hype = 1;
          for (let i = 0; i < (bigB ? 50 : 20); i++) { const a = Math.random() * 6.28, v = Math.random() * (bigB ? 9 : 5); parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v, life: 0, max: 0.5 + Math.random() * 0.6, c: pick(['#FFD23F', '#FF8A3D', '#FF4D6D', '#555', '#888']), r: 0.08 + Math.random() * (bigB ? 0.2 : 0.1) }); }
          if (bigB) big('💥 KRASCH!', 1200);
        }
        else if (e.k === 'launch') SFX.launch();
        else if (e.k === 'flip') { SFX.flip(); texts.push({ x: e.x, y: e.y + 1, txt: 'Hoppla!', c: '#FFD23F', life: 0 }); }
        else if (e.k === 'bonk') { SFX.bonk(); shake = Math.max(shake, 5); }
        else if (e.k === 'burn') { SFX.burn(); parts.push({ x: e.x, y: e.y, vx: 0, vy: 1.5, life: 0, max: 0.5, c: '#77777799', r: 0.1 }); }
        else if (e.k === 'hop') SFX.hop();
        else if (e.k === 'crash') { SFX.bonk(); shake = Math.max(shake, 4); }
        else if (e.k === 'punch') { SFX.hit(); shake = Math.max(shake, 8); texts.push({ x: e.x, y: e.y + 1, txt: 'PANG!', c: '#FFD23F', life: 0 }); }
        else if (e.k === 'cannon') { SFX.boom(); shake = Math.max(shake, 5); }
        else if (e.k === 'thud') { SFX.bonk(); shake = Math.max(shake, 7); for (let i = 0; i < 12; i++) parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5, life: 0, max: 0.5, c: pick(['#888', '#555', '#FFD23F']), r: 0.07 }); }
        else if (e.k === 'fire') { parts.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5), vy: 2, life: 0, max: 0.6, c: pick(['#FF8A3D', '#FFD23F', '#FF4D6D']), r: 0.12 }); }
        else if (e.k === 'swoosh') tone(500, .12, { to: 200, vol: .04 });
      }
      // sammanlagd skada från sågar/laser som siffror då och då
      for (const p of parts) { p.life += dt; p.vy -= 12 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life > parts[i].max) parts.splice(i, 1);
      for (const t of texts) { t.life += dt; t.y += dt * 1.2; }
      for (let i = texts.length - 1; i >= 0; i--) if (texts[i].life > 1.1) texts.splice(i, 1);
      shake *= 0.88; hype *= 0.995;
      drawAt(f, now);
      if (f >= N - 1) {
        PB.on = false;
        setTimeout(() => resolve({ winner: rep.winner, timeout: rep.timeout, hp: rep.hp }), PB.skip ? 100 : 700);
        if (rep.timeout && !PB.skip) big('⏱️ Tiden ute!', 1200);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ================= NÄTVERK ================= */
const G = { mode: 'local' };
const gameOfMatch = netGameOf;
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = `
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Turneringen startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen här. Din bil följer med.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>
    <p class="note" style="text-align:center;color:#fff">Alla måste vara på samma wifi. Du kör med ${esc(charName(ME.ch))}s bil (⚡ ${KR.power(fullOfCh(ME.ch))}).</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'krock.html');
  };
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">💥</span> Letar efter matcher…</p>`;
  window.onNetScan = list => {
    scanning = false;
    if (current !== 'join' || !$('found')) return;
    $('found').innerHTML = list.length ? list.map(m => { const g = gameOfMatch(m.name); return `<button class="btn blue" data-ip="${esc(m.ip)}" data-port="${m.port}" data-page="${g.page}">${esc(g.label)}</button>`; }).join('')
      : `<p class="note">Hittade ingen match. Be värden trycka 📡 Starta nätverksmatch – och kolla att ni är på samma wifi.</p>`;
    $('found').querySelectorAll('[data-ip]').forEach(b => b.onclick = () => { SFX.tap(); goJoin(b.dataset.ip, +b.dataset.port, b.dataset.page); });
  };
  try { Android.netScan(); } catch (e) { scanning = false; }
}
function goJoin(ip, port, page) {
  const back = location.href.split('?')[0];
  const fb = encodeURIComponent(JSON.stringify(fullOfCh(ME.ch)));
  location.href = `http://${ip}:${port || PORT}/${page}?n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}&fb=${fb}&back=${encodeURIComponent(back)}`;
}
function startHosting() {
  let r = null;
  try { r = JSON.parse(Android.netHost('krock:' + charName(ME.ch) + 's turnering')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  const fb = encodeURIComponent(JSON.stringify(fullOfCh(ME.ch)));
  location.href = `http://127.0.0.1:${r.port}/krock.html?host=1&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}&fb=${fb}`;
}
function leave() {
  if (G.mode === 'host') {
    try { HOST.ws && HOST.ws.close(); } catch (e) { } HOST.ws = null;
    try { Android.netStop(); } catch (e) { }
    location.href = APP_HOME + 'krock.html'; return;
  }
  if (CLIENT) {
    CL.closing = true; try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (window.Android) location.href = APP_HOME + 'krock.html';
    else clientStart();
    return;
  }
  show('menu');
}

/* ----- värd ----- */
const HOST = { ws: null, lobby: [], ok: false, inT: false, bracket: null };
function hostStart() {
  G.mode = 'host';
  HOST.lobby = [{ id: 'h', name: ME.name, ch: ME.ch, fb: myFB() }];
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
  if (d[0] === '-') { const id = 'c' + d.slice(1); HOST.lobby = HOST.lobby.filter(p => p.id !== id); return hostLobby(); }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    const p = { id, name: String(m.name || 'Spelare').slice(0, 14), ch: Math.abs(m.ch | 0) % CHARS.length, fb: KR.sanitize(m.fb) };
    const old = HOST.lobby.find(q => q.id === id);
    if (old) Object.assign(old, p); else { HOST.lobby.push(p); SFX.pick(); buzz(15); }
    hostTo(id, { t: 'welcome', id });
    hostLobby();
  }
}
function lobbyMsg() { return { t: 'lobby', players: HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch, pw: KR.power(p.fb) })), inT: HOST.inT, bracket: HOST.bracket, host: ME.name }; }
function hostLobby() { hostAll(lobbyMsg()); if (current === 'lobby') buildLobby(); }

async function hostTournament() {
  if (HOST.lobby.length < 2) { panel(`<h3>Minst två förare</h3><p>Vänta tills någon har gått med – eller spela mot datorn så länge.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  HOST.inT = true;
  let alive = HOST.lobby.slice().sort(() => Math.random() - 0.5).map(p => ({ id: p.id, name: p.name, ch: p.ch, fb: p.fb }));
  HOST.bracket = [];
  let round = 1;
  while (alive.length > 1) {
    const next = [];
    if (alive.length % 2) { const bye = alive.pop(); next.push(bye); HOST.bracket.push({ r: round, a: bye.name, ach: bye.ch, b: '–', bch: -1, w: 0 }); }
    for (let i = 0; i < alive.length; i += 2) {
      const A = alive[i], B = alive[i + 1];
      if (!HOST.lobby.find(p => p.id === A.id) && !HOST.lobby.find(p => p.id === B.id)) continue;
      const rep = KSIM.fight(A.fb, B.fb);
      const msg = { t: 'battle', round, a: { id: A.id, name: A.name, ch: A.ch }, b: { id: B.id, name: B.name, ch: B.ch }, rep };
      hostAll(msg);
      const res = await play(rep, [{ name: A.name, ch: A.ch }, { name: B.name, ch: B.ch }], { skip: true, noSpeed: true });
      const w = res.winner < 0 ? (Math.random() < 0.5 ? 0 : 1) : res.winner;
      const W2 = w === 0 ? A : B;
      next.push(W2);
      HOST.bracket.push({ r: round, a: A.name, ach: A.ch, b: B.name, bch: B.ch, w });
      rewardIf(msg, w);
      hostAll({ t: 'result', w, bracket: HOST.bracket });
      await showResult(msg, w);
    }
    alive = next; round++;
  }
  const champ = alive[0];
  hostAll({ t: 'champ', name: champ.name, ch: champ.ch, id: champ.id, bracket: HOST.bracket });
  await champion(champ);
  HOST.inT = false; hostLobby(); show('lobby');
}
function rewardIf(msg, w) {
  const myId = G.mode === 'host' ? 'h' : CL.id;
  if (msg.a.id !== myId && msg.b.id !== myId) return;
  const won = (w === 0 ? msg.a.id : msg.b.id) === myId;
  addCoins(won ? 60 : 20);
}
function showResult(msg, w) {
  return new Promise(res => {
    const win = w === 0 ? msg.a : msg.b;
    panel(`<div class="win-av"><div class="crown">👑</div>${avHTML(win.ch)}</div><h3>${esc(win.name)} vann!</h3><p>Omgång ${msg.round}</p>`);
    SFX.win();
    setTimeout(() => { closePanel(); res(); }, 3200);
  });
}
async function champion(c) {
  await celebrate(c.ch, `${c.name} vann turneringen!`, '🏆 Mästare i Krockarenan', ['🏆', '💥', '⭐', '🎉', '⚙️', '✨', '🪙', '🎊']);
}

/* ----- klient ----- */
const CL = { ws: null, id: null, lobby: null, closing: false, tries: 0 };
function clientStart() {
  G.mode = 'client';
  pickFigure('Vem kör?', clientConnect);
}
function clientConnect() {
  CL.closing = false;
  const ws = new WebSocket(`ws://${location.host}/ws`);
  CL.ws = ws;
  panel(`<h3>Ansluter… <span class="spin">💥</span></h3>`);
  ws.onopen = () => { CL.tries = 0; closePanel(); ws.send(JSON.stringify({ t: 'hi', name: charName(ME.ch), ch: ME.ch, fb: myFB() })); show('lobby'); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } clientRecv(m); };
  ws.onclose = () => {
    if (CL.ws !== ws || CL.closing) return;
    if (CL.tries++ < 3 && CL.id) { setTimeout(clientConnect, 800); return; }
    panel(`<h3>Tappade kontakten 📡</h3><p>Är värden kvar och på samma wifi?</p><button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white small" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); CL.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); leave(); };
  };
}
async function clientRecv(m) {
  if (m.t === 'welcome') CL.id = m.id;
  else if (m.t === 'lobby') { CL.lobby = m; if (current === 'lobby') buildLobby(); }
  else if (m.t === 'battle') {
    closePanel();
    CL.cur = m;
    play(m.rep, [m.a, m.b], { skip: false, noSpeed: true }).then(() => { });
  }
  else if (m.t === 'skip') PB.skip = true;
  else if (m.t === 'result') { if (CL.cur) { rewardIf(CL.cur, m.w); await showResult(CL.cur, m.w); } if (CL.lobby) CL.lobby.bracket = m.bracket; }
  else if (m.t === 'champ') { if (CL.lobby) CL.lobby.bracket = m.bracket; await champion(m); show('lobby'); }
  else if (m.t === 'hostgone') { CL.closing = true; panel(`<h3>Turneringen är slut 👋</h3><p>Värden avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); leave(); }; }
}

function buildLobby() {
  if (current !== 'lobby') return;
  const isHost = G.mode === 'host';
  const L = isHost ? lobbyMsg() : (CL.lobby || { players: [], bracket: null, inT: false });
  const myId = isHost ? 'h' : CL.id;
  const pls = L.players.map(p => `<div class="pl ${p.id === myId ? 'mine' : ''}" style="${styleOf(p.ch)}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' 👑' : ''}</span><span class="pw" style="flex:none">⚡ ${p.pw}</span></div>`).join('');
  const br = (L.bracket || []).map(m => `<div class="m">R${m.r} ${avHTML(m.ach)}<span class="${m.w === 0 ? 'w' : 'l'}">${esc(m.a)}</span> – ${m.bch >= 0 ? avHTML(m.bch) : ''}<span class="${m.w === 1 ? 'w' : m.bch >= 0 ? 'l' : ''}">${esc(m.b)}</span></div>`).join('');
  let side = '';
  if (isHost) {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/krock.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="card"><h4>📲 Bjud in familjen</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: Krockarenan → 🔗 Gå med.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
  }
  $('lobbyBox').innerHTML = `<div class="gar"><div class="card"><h4>🏎️ Förare (${L.players.length})</h4><div class="plist">${pls || '<p class="note">Ingen här än…</p>'}</div>
      ${isHost ? `<button class="btn green" id="tStart" ${HOST.ok && !L.inT ? '' : 'disabled'}>🏆 Starta turneringen!</button>` : `<p class="wait" style="text-align:center;font-weight:600">${L.inT ? 'Turneringen pågår… 💥' : `Väntar på att ${esc(L.host || 'värden')} startar ⏳`}</p>`}
      <p class="note">Alla möter varandra i utslagsmatcher – vinnaren går vidare. Varje strid ger mynt till verkstaden.</p></div>
    <div style="display:flex;flex-direction:column;gap:12px">${side}${br ? `<div class="card"><h4>📋 Resultat</h4><div class="bracket">${br}</div></div>` : ''}</div></div>`;
  if ($('tStart')) $('tStart').onclick = () => { SFX.tap(); hostTournament(); };
  if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildLobby(); };
}
$('lobbyBack').onclick = () => {
  SFX.tap();
  panel(`<h3>${G.mode === 'host' ? 'Avsluta turneringen?' : 'Lämna?'}</h3><button class="btn pink" id="pYes">🚪 ${G.mode === 'host' ? 'Avsluta' : 'Lämna'}</button><button class="btn white small" id="pNo">Stanna kvar</button>`);
  $('pYes').onclick = () => { SFX.tap(); closePanel(); leave(); };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); };
};

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('toLadder').onclick = () => { SFX.tap(); show('ladder'); };
$('toGarage').onclick = () => { SFX.tap(); garCh = ME.ch; show('garage'); };
$('toShop').onclick = () => { SFX.tap(); shopBack = 'menu'; show('shop'); };
$('toDuo').onclick = () => { SFX.tap(); startDuo(); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('pClose')) $('pClose').click(); else if ($('pNo')) $('pNo').click(); else if ($('pMenu')) $('pMenu').click(); else if ($('pLeave')) $('pLeave').click(); else if (!PB.on) closePanel();
    return true;
  }
  if (current === 'battle') { if (!$('bSkip').classList.contains('hidden')) PB.skip = true; return true; }
  if (current === 'lobby') { $('lobbyBack').click(); return true; }
  if (current === 'shop') { show(shopBack); return true; }
  if (current === 'meScr' && CLIENT) { leave(); return true; }
  if (current === 'menu') { if (REMOTE) { if (window.Android) location.href = APP_HOME + 'index.html'; else leave(); } else goHub(); return true; }
  show('menu'); return true;
};

bubbles();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu');
