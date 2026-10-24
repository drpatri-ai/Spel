/* Bucinca Paf! – menyer, butik, rekord, tävling, ljud och firande */
'use strict';

/* ---------- lagring ---------- */
const store = makeStore('bp');

/* ---------- figurer ---------- */
// Paf-specifika egenskaper för de gemensamma figurerna: grundbonus och leder
const PAF_CHAR = [
  { base: { kick: 10 }, rig: { neck: 0.31, hip: 0.6, legAmp: 1 } },
  { base: { luck: 25 }, rig: { neck: 0.21, hip: 0.66, legAmp: 0.9 } },
  { base: { strong: 40 }, rig: { neck: 0.165, hip: 0.58, legAmp: 0.9 } },
  { base: { feather: 14 }, rig: { neck: 0.18, hip: 0.62, legAmp: 0.45 } },
  { base: { luck: 15, feather: 6 }, rig: { neck: 0.27, hip: 0.62, legAmp: 0.95 } },   // Marissa
  { base: { feather: 12, kick: 4 }, rig: { neck: 0.24, hip: 0.58, legAmp: 0.9 } },   // Elita
  { base: { kick: 8, strong: 20 }, rig: { neck: 0.26, hip: 0.6, legAmp: 0.95 } },    // Besnik
  { base: { luck: 20, kick: 4 }, rig: { neck: 0.23, hip: 0.62, legAmp: 0.8 } },      // Saranda
  { base: { strong: 30, luck: 6 }, rig: { neck: 0.24, hip: 0.62, legAmp: 0.35 } },  // Gjyshja
  { base: { kick: 12, strong: 10 }, rig: { neck: 0.22, hip: 0.6, legAmp: 0.8 } }     // Gjyshi
];
CHARS.forEach((c, i) => Object.assign(c, PAF_CHAR[i]));

/* ---------- nivåer och färdigheter (1 poäng = 1 %) ---------- */
const SKILLS = [
  { k: 'kick', name: 'Hårdare spark', icon: '⚽', desc: 'snabbare iväg från kängan' },
  { k: 'luck', name: 'Tur', icon: '🍀', desc: 'fler mynt' },
  { k: 'feather', name: 'Lätt som en fjäder', icon: '🪶', desc: 'mindre tyngd, svävar längre (max 70 %)' },
  { k: 'strong', name: 'Stark', icon: '💪', desc: 'mer raketbränsle' }
];
const MAX_LV = 100;
const xpNeed = lv => 40 + 10 * lv;           // XP (= meter) från nivå lv till lv+1
function charLv(ci) {
  const all = store.get('lv', {});
  const e = Object.assign({ level: 1, xp: 0, pts: {} }, all[ci]);
  e.pts = Object.assign({ kick: 0, luck: 0, feather: 0, strong: 0 }, e.pts);
  e.spent = SKILLS.reduce((a, s) => a + e.pts[s.k], 0);
  e.free = Math.max(0, e.level - 1 - e.spent);
  return e;
}
function saveLv(ci, e) { const all = store.get('lv', {}); all[ci] = { level: e.level, xp: e.xp, pts: e.pts }; store.set('lv', all); }
const statOf = (ci, k) => (CHARS[ci].base[k] || 0) + charLv(ci).pts[k];
function addXp(ci, xp) {
  const e = charLv(ci);
  const before = e.level;
  if (e.level < MAX_LV) e.xp += xp;
  while (e.level < MAX_LV && e.xp >= xpNeed(e.level)) { e.xp -= xpNeed(e.level); e.level++; }
  if (e.level >= MAX_LV) e.xp = 0;
  saveLv(ci, e);
  return { before, after: e.level, e: charLv(ci) };
}
const traitLine = ci => SKILLS.filter(sk => statOf(ci, sk.k) > 0).map(sk => `${sk.icon} ${statOf(ci, sk.k)} %`).join(' · ') || 'Inga poäng än';


/* ---------- uppgraderingar ---------- */
const UPS = [
  { k: 'kick', name: 'Sparkkraft', icon: '🦵', desc: 'Kängan sparkar hårdare', cost: [20, 45, 90, 160, 260, 400] },
  { k: 'bounce', name: 'Studs', icon: '🏀', desc: 'Studsar högre mot marken', cost: [25, 60, 120, 210, 340] },
  { k: 'rocket', name: 'Raket', icon: '🚀', desc: 'Mer bränsle – håll fingret i luften', cost: [30, 70, 130, 220, 360] },
  { k: 'glide', name: 'Glidflyg', icon: '🪂', desc: 'Mindre luftmotstånd', cost: [35, 80, 150, 260] },
  { k: 'luck', name: 'Tur', icon: '🍀', desc: 'Fler ballonger, fåglar och studsmattor', cost: [50, 110, 200, 340] }
];
const lvl = k => (store.get('up', {})[k] || 0);
const coins = () => store.get('coins', 0);
const addCoins = n => store.set('coins', Math.max(0, coins() + n));

function gameOptions(ci) {
  const f = fullOf(ci);
  const img = new Image();
  img.src = f.src;
  return {
    img, photo: f.photo, color: CHARS[ci].c,
    rigCfg: CHARS[ci].rig,
    kickSpeed: (24 + 4.5 * lvl('kick')) * (1 + statOf(ci, 'kick') / 100),
    rest: 0.42 + 0.05 * lvl('bounce'),
    fuel: (0.7 + 0.9 * lvl('rocket')) * (1 + statOf(ci, 'strong') / 100),
    density: 1 + 0.25 * lvl('luck'),
    drag: 0.0022 * (1 - 0.14 * lvl('glide')),
    grav: 14 * (1 - Math.min(70, statOf(ci, 'feather')) / 100),
    coinMul: 1 + statOf(ci, 'luck') / 100,
    best: (store.get('rec', {})[ci] || {}).best || 0
  };
}

/* ---------- ljud ---------- */
const SFX = {
  tap: () => tone(720, .07, { type: 'triangle', vol: .1 }),
  pick: () => [660, 990].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .07 })),
  kick: p => { noise(.12, { f: 900, vol: .5, q: .7 }); tone(140 + p * 60, .18, { to: 60, vol: .45 }); },
  perfect: () => [784, 1047, 1319].forEach((f, i) => tone(f, .12, { type: 'triangle', vol: .12, delay: i * .06 })),
  boing: () => tone(180, .35, { to: 720, vol: .18 }),
  pop: () => { noise(.07, { f: 2500, vol: .35, q: 2 }); tone(900, .06, { to: 300, vol: .1 }); },
  coin: () => { tone(1320, .06, { type: 'square', vol: .05 }); tone(1760, .12, { type: 'square', vol: .05, delay: .05 }); },
  quack: () => { tone(520, .12, { to: 380, type: 'sawtooth', vol: .07 }); tone(500, .12, { to: 360, type: 'sawtooth', vol: .07, delay: .14 }); },
  zoom: () => tone(300, .3, { to: 1400, type: 'sawtooth', vol: .07 }),
  splash: () => noise(.35, { f: 500, vol: .4, q: .5, type: 'lowpass' }),
  bump: i => { tone(110, .12, { to: 60, vol: Math.min(.35, .08 + i * .02) }); noise(.06, { f: 300, vol: .15 }); },
  rocket: () => noise(.14, { f: 600, vol: .12, q: .4, type: 'lowpass' }),
  fuel: () => [523, 784].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .06 })),
  record: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .24, { type: 'triangle', vol: .15, delay: i * .1 })),
  land: () => [392, 330].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .1, delay: i * .12 })),
  buy: () => [880, 1175, 1568].forEach((f, i) => tone(f, .1, { type: 'square', vol: .06, delay: i * .06 })),
  bonk: () => tone(150, .12, { type: 'square', vol: .05, to: 110 }),
  undo: () => tone(520, .14, { to: 300, type: 'triangle', vol: .1 }),
  levelup: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .14, { type: 'square', vol: .06, delay: i * .08 }))
};

/* ---------- skärmar ---------- */
let current = 'menu';
const hist = [];
function show(id, push = true) {
  if (push && current !== id) hist.push(current);
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id !== 'game') Game.stop();
  if (id === 'menu') { hist.length = 0; buildMenu(); }
  if (id === 'shop') buildShop();
  if (id === 'skills') buildSkills();
  if (id === 'records') buildRecords();
  if (id === 'settings') buildSettings();
}
function back() { show(hist.pop() || 'menu', false); }

bubbles();

function buildMenu() {
  let k = 0;
  const line = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = line('Bucinca', 'l1') + line('Paf! 🦵', 'l2');
  $('dance').innerHTML = CHARS.map((_, i) => avHTML(i)).join('');
  [...$('dance').children].forEach((el, i) => el.style.animationDelay = (i * .18) + 's');
  const free = CHARS.reduce((n, _, i) => n + charLv(i).free, 0);
  $('menuDot').textContent = free ? ' ' + free : '';
}

/* ---------- val av figur ---------- */
let mode = 'solo', cupPick = [];
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
  SFX.tap(); ac();
  const g = b.dataset.go;
  if (g === 'solo' || g === 'cup') { mode = g; cupPick = []; renderSelect(); show('select'); }
  else { if (g === 'skills') { const f = CHARS.findIndex((_, i) => charLv(i).free > 0); if (f >= 0) skillFocus = f; } show(g); }
}));
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { SFX.tap(); back(); }));

function renderSelect() {
  const cup = mode === 'cup';
  $('selTitle').textContent = cup ? 'Vilka är med?' : 'Vem ska flyga?';
  $('selSub').textContent = cup ? 'Välj minst 2 figurer i den ordning ni ska sparka. 3 sparkar var – längst sammanlagt vinner!' : 'Varje figur går upp i nivå och blir starkare';
  const rec = store.get('rec', {});
  $('chars').innerHTML = CHARS.map((C, i) => {
    const o = cupPick.indexOf(i);
    const best = (rec[i] || {}).best;
    return `<button class="char ${o >= 0 ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">
      ${o >= 0 ? `<span class="order">${o + 1}</span>` : ''}${avHTML(i)}<b>${esc(charName(i))}</b><span class="lvtag">Nivå ${charLv(i).level}${charLv(i).free ? ` · <i>${charLv(i).free} poäng!</i>` : ''}</span><small>${traitLine(i)}</small>
      ${best ? `<small>🏁 Rekord ${best} m</small>` : ''}</button>`;
  }).join('');
  $('cupStart').classList.toggle('hidden', !cup || cupPick.length < 2);
  $('chars').querySelectorAll('.char').forEach(el => el.addEventListener('click', () => {
    const i = +el.dataset.i;
    SFX.pick(); buzz(12);
    if (!cup) { el.classList.add('pick'); setTimeout(() => startSolo(i), 300); return; }
    const o = cupPick.indexOf(i);
    if (o >= 0) cupPick.splice(o, 1); else cupPick.push(i);
    renderSelect();
  }));
}
$('cupStart').onclick = () => { SFX.tap(); startCup(cupPick.slice()); };

/* ---------- spelet ---------- */
let run = null;        // pågående spark: { ci, kind }
let cup = null;        // tävling: { order, scores, round, idx }
let lastHud = {};

Game.init($('cv'), {
  sfx: (n, a) => SFX[n] && SFX[n](a),
  buzz,
  hud: updateHud,
  phase: p => {
    $('aimHint').classList.toggle('hidden', p !== 'aim');
    $('turnBar').classList.toggle('hidden', !(cup && p === 'aim'));
    if (p === 'fly') {
      const st = Game.state;
      if (st && st.fuel > 0 && !store.get('seenBoost', false)) {
        $('boostHint').classList.remove('hidden');
        setTimeout(() => { $('boostHint').classList.add('hidden'); store.set('seenBoost', true); }, 3500);
      }
    }
  },
  weak: () => {
    const h = $('aimHint'); h.textContent = 'Svep snabbare! 💨';
    SFX.bonk();
    setTimeout(() => { h.textContent = 'Svep uppåt för att sparka! 👆'; }, 1400);
  },
  onEnd: endRun
});

function updateHud(s) {
  const set = (id, v) => { if (lastHud[id] !== v) { lastHud[id] = v; $(id).textContent = v; } };
  set('hDist', Math.floor(s.dist) + ' m');
  set('hAlt', '⬆️ ' + Math.floor(s.alt) + ' m');
  set('hSpd', '💨 ' + Math.round(s.spd) + ' km/h');
  set('hCoins', '🪙 ' + (coins() + Math.floor(s.coins)));
  const showFuel = s.fuelMax > 0 && s.phase === 'fly';
  $('hFuel').style.display = showFuel ? 'block' : 'none';
  if (showFuel) $('hFuelBar').style.transform = `scaleX(${s.fuel / s.fuelMax})`;
}

function beginRun(ci) {
  run = { ci };
  lastHud = {};
  show('game', current !== 'game');
  $('aimHint').textContent = 'Svep uppåt för att sparka! 👆';
  $('aimHint').classList.remove('hidden');
  $('boostHint').classList.add('hidden');
  if (cup) {
    $('turnBar').innerHTML = `${avHTML(ci)}<span>${esc(charName(ci))} sparkar · omgång ${cup.round}/3</span>`;
    $('turnBar').classList.remove('hidden');
  } else $('turnBar').classList.add('hidden');
  requestAnimationFrame(() => Game.start(gameOptions(ci)));
}
function startSolo(ci) { cup = null; beginRun(ci); }
function startCup(order) {
  cup = { order, scores: order.map(() => []), round: 1, idx: 0 };
  beginRun(order[0]);
}

function saveRecord(ci, r) {
  const rec = store.get('rec', {});
  const e = Object.assign({ best: 0, alt: 0, spd: 0, kicks: 0, total: 0 }, rec[ci]);
  const isNew = r.dist > e.best && e.kicks > 0;
  const first = e.kicks === 0;
  e.best = Math.max(e.best, r.dist); e.alt = Math.max(e.alt, r.maxAlt); e.spd = Math.max(e.spd, r.maxSpd);
  e.kicks++; e.total += r.dist;
  rec[ci] = e;
  store.set('rec', rec);
  return { isNew, first, best: e.best };
}

async function endRun(r) {
  if (!run) return;
  const ci = run.ci;
  const bonus = Math.floor(r.dist / 10);
  const earned = r.coins + bonus;
  addCoins(earned);
  const rec = saveRecord(ci, r);
  const lvUp = addXp(ci, r.dist);
  if (cup) return cupNext(ci, r, earned, lvUp);
  if (rec.isNew) {
    SFX.record(); buzz(120);
    await celebrate(ci, 'Nytt rekord!', charName(ci) + ' · ' + r.dist + ' meter 🏁');
  } else SFX.land();
  if (lvUp.after > lvUp.before) { await wait(150); SFX.levelup(); buzz(80); }
  const stat = `${lvBox(ci, r.dist, lvUp)}<div class="board-list">
      <div class="r"><span>📏 Sträcka</span><b>${r.dist} m</b></div>
      <div class="r"><span>⬆️ Högst upp</span><b>${r.maxAlt} m</b></div>
      <div class="r"><span>💨 Toppfart</span><b>${r.maxSpd} km/h</b></div>
      <div class="r"><span>🪙 Mynt</span><b>+${earned}</b></div></div>`;
  openPanel(`<div class="win-av" style="width:min(36vw,140px);margin-top:4px">${avHTML(ci)}</div>
    <h3>${rec.isNew ? 'Nytt rekord! 🎉' : r.dist + ' meter!'}</h3>
    <p>${rec.isNew || rec.first ? 'Bästa hittills: ' + rec.best + ' m' : pick(['Snyggt!', 'Bra flygt!', 'Kan du slå ' + rec.best + ' m?', 'Köp uppgraderingar för att flyga längre!'])}</p>
    ${stat}
    ${charLv(ci).free ? `<button class="btn purple" id="rSkills">⭐ Fördela ${charLv(ci).free} poäng</button>` : ''}
    <button class="btn green" id="rAgain">🔁 Sparka igen</button>
    <button class="btn blue" id="rShop">🛒 Butik (${coins()} 🪙)</button>
    <button class="btn white" id="rMenu">🏠 Meny</button>`);
  $('rAgain').onclick = () => { SFX.tap(); closePanel(); beginRun(ci); };
  if ($('rSkills')) $('rSkills').onclick = () => { SFX.tap(); closePanel(); skillFocus = ci; show('skills'); };
  $('rShop').onclick = () => { SFX.tap(); closePanel(); show('shop'); };
  $('rMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
}

function cupTotals() { return cup.order.map((ci, j) => ({ ci, j, total: cup.scores[j].reduce((a, b) => a + b, 0) })); }
function cupTable(highlightJ) {
  const t = cupTotals().slice().sort((a, b) => b.total - a.total);
  return `<div class="board-list">${t.map((x, n) => `<div class="r ${n === 0 ? 'lead' : ''}" style="${styleOf(x.ci)}">${n === 0 ? '👑' : (n + 1) + '.'} ${avHTML(x.ci)}
    <span>${esc(charName(x.ci))}<br><small style="color:var(--muted)">${cup.scores[x.j].map(d => d + ' m').join(' + ') || '–'}</small></span><b>${x.total} m</b></div>`).join('')}</div>`;
}
async function cupNext(ci, r, earned, lvUp) {
  const j = cup.idx;
  cup.scores[j].push(r.dist);
  SFX.land();
  // nästa spelare
  let nextIdx = cup.idx + 1, nextRound = cup.round;
  if (nextIdx >= cup.order.length) { nextIdx = 0; nextRound++; }
  const finished = nextRound > 3;
  if (finished) {
    const t = cupTotals().sort((a, b) => b.total - a.total);
    const w = t[0];
    const tie = t.length > 1 && t[1].total === w.total;
    if (!tie) { SFX.record(); buzz(120); await celebrate(w.ci, charName(w.ci) + ' vann!', 'Tävlingen · ' + w.total + ' m totalt 🏆'); }
    openPanel(`<div class="win-av" style="width:min(36vw,140px)"><div class="crown">👑</div>${avHTML(w.ci)}</div>
      <h3>${tie ? 'Delad seger!' : esc(charName(w.ci)) + ' vann!'}</h3>${cupTable()}
      <button class="btn green" id="rCupAgain">🔁 Ny tävling</button><button class="btn white" id="rMenu">🏠 Meny</button>`);
    const order = cup.order.slice();
    $('rCupAgain').onclick = () => { SFX.tap(); closePanel(); startCup(order); };
    $('rMenu').onclick = () => { SFX.tap(); closePanel(); cup = null; show('menu'); };
    return;
  }
  const nci = cup.order[nextIdx];
  if (lvUp && lvUp.after > lvUp.before) { SFX.levelup(); buzz(80); }
  openPanel(`<h3>${esc(charName(ci))}: ${r.dist} m!</h3><p>Omgång ${cup.round} av 3 · +${earned} 🪙</p>${lvBox(ci, r.dist, lvUp)}${cupTable(j)}
    <button class="btn green" id="rNext" style="${styleOf(nci)};--c:${CHARS[nci].c};--d:${CHARS[nci].d}">▶️ ${esc(charName(nci))}s tur</button>
    <button class="btn white" id="rMenu">🏠 Avsluta tävlingen</button>`);
  $('rNext').onclick = () => { SFX.tap(); closePanel(); cup.idx = nextIdx; cup.round = nextRound; beginRun(nci); };
  $('rMenu').onclick = () => { SFX.tap(); closePanel(); cup = null; show('menu'); };
}

$('gHome').onclick = () => {
  SFX.tap();
  const st = Game.state;
  const flying = st && st.phase !== 'aim';
  if (cup || flying) confirmBox(cup ? 'Avsluta tävlingen?' : 'Avbryta sparken?', cup ? 'Resultaten sparas inte.' : 'Den här flygturen räknas inte.', 'Ja, till menyn', () => { run = null; cup = null; show('menu'); });
  else { run = null; show('menu'); }
};

/* ---------- nivåruta i resultat ---------- */
function lvBox(ci, xp, lvUp) {
  const e = charLv(ci);
  const up = lvUp && lvUp.after > lvUp.before;
  const pct = e.level >= MAX_LV ? 100 : e.xp / xpNeed(e.level) * 100;
  return `<div class="lvbox ${up ? 'up' : ''}" style="${styleOf(ci)}">
    <div class="lvrow"><b>${up ? '⭐ NIVÅ ' + e.level + '!' : 'Nivå ' + e.level}</b><span>+${xp} XP</span></div>
    <div class="xpbar"><i style="width:${pct}%"></i></div>
    ${up ? `<small>+${lvUp.after - lvUp.before} poäng att fördela</small>` : `<small>${e.level >= MAX_LV ? 'MAX-nivå! 👑' : (xpNeed(e.level) - e.xp) + ' XP kvar till nivå ' + (e.level + 1)}</small>`}</div>`;
}

/* ---------- färdigheter ---------- */
let skillFocus = 0;
function buildSkills() {
  const tabs = CHARS.map((_, i) => `<button class="stab ${i === skillFocus ? 'on' : ''}" data-ci="${i}" style="${styleOf(i)}">${avHTML(i)}${charLv(i).free ? '<i class="dot"></i>' : ''}</button>`).join('');
  const ci = skillFocus, e = charLv(ci), C = CHARS[ci];
  const pct = e.level >= MAX_LV ? 100 : e.xp / xpNeed(e.level) * 100;
  const rows = SKILLS.map(sk => {
    const base = C.base[sk.k] || 0, own = e.pts[sk.k], tot = base + own;
    const capped = sk.k === 'feather' && tot >= 70;
    return `<div class="row skill" style="${styleOf(ci)}"><span style="font-size:32px">${sk.icon}</span>
      <div class="grow"><h4>${sk.name} <span class="pct">${tot} %</span></h4>
      <p class="small-note">${base ? `Grund ${base} % ` : ''}${own ? `+ ${own} poäng ` : ''}– ${sk.desc}</p>
      <div class="sbar"><i class="b" style="width:${Math.min(100, base)}%"></i><i class="o" style="width:${Math.min(100 - Math.min(100, base), own)}%"></i></div></div>
      <div class="sbtns"><button class="btn small green" data-add="${sk.k}" data-n="1" ${e.free && !capped ? '' : 'disabled'}>+1</button>
      <button class="btn small green" data-add="${sk.k}" data-n="5" ${e.free >= 2 && !capped ? '' : 'disabled'}>+5</button></div></div>`;
  }).join('');
  $('skillList').innerHTML = `<div class="stabs">${tabs}</div>
    <div class="row" style="${styleOf(ci)};flex-direction:column;align-items:stretch">
      <div style="display:flex;align-items:center;gap:12px">${avHTML(ci)}<div class="grow"><h4>${esc(charName(ci))} · Nivå ${e.level}${e.level >= MAX_LV ? ' 👑' : ''}</h4>
      <p class="small-note">${e.level >= MAX_LV ? 'Maxnivå nådd!' : e.xp + ' / ' + xpNeed(e.level) + ' XP till nivå ' + (e.level + 1)} · 1 meter = 1 XP</p></div></div>
      <div class="xpbar" style="${styleOf(ci)}"><i style="width:${pct}%"></i></div>
      <p class="freepts">${e.free ? `⭐ ${e.free} poäng att fördela` : 'Inga poäng att fördela just nu – sparka för att gå upp i nivå!'}</p></div>
    ${rows}
    <p class="hint-txt">Varje nivå ger 1 poäng = 1 %. Nivå 100 är max.</p>
    ${e.spent ? '<button class="btn white small" id="resetPts" style="align-self:center">↺ Ta tillbaka poängen och fördela om</button>' : ''}`;
  $('skillList').querySelectorAll('.stab').forEach(b => b.onclick = () => { SFX.tap(); skillFocus = +b.dataset.ci; buildSkills(); });
  $('skillList').querySelectorAll('.stab .av').forEach(a => a.style.width = '56px');
  $('skillList').querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
    const e2 = charLv(ci); const k = b.dataset.add;
    let n = Math.min(+b.dataset.n, e2.free);
    if (k === 'feather') n = Math.min(n, Math.max(0, 70 - statOf(ci, 'feather')));
    if (n <= 0) { SFX.bonk(); return; }
    e2.pts[k] += n; saveLv(ci, e2);
    SFX.buy(); buzz(20);
    buildSkills();
  });
  if ($('resetPts')) $('resetPts').onclick = () => { const e2 = charLv(ci); e2.pts = {}; saveLv(ci, e2); SFX.undo ? SFX.undo() : SFX.tap(); buildSkills(); };
}

/* ---------- butik ---------- */
function buildShop() {
  const up = store.get('up', {});
  $('shopList').innerHTML = `<div class="bigcoins">🪙 ${coins()}</div>
    <p class="hint-txt">Du får mynt för varje spark – plocka mynt i luften och få 1 mynt per 10 meter.</p>` +
    UPS.map(u => {
      const l = up[u.k] || 0, max = u.cost.length, cost = u.cost[l];
      return `<div class="row shop-row"><span style="font-size:34px">${u.icon}</span>
        <div class="grow"><h4>${u.name}</h4><p class="small-note">${u.desc}</p>
        <div class="lv">${u.cost.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div></div>
        ${l >= max ? '<b style="color:#34C759">MAX ⭐</b>' : `<button class="btn small ${coins() >= cost ? 'green' : 'white'}" data-buy="${u.k}" ${coins() >= cost ? '' : 'disabled'}>🪙 ${cost}</button>`}</div>`;
    }).join('');
  $('shopList').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
    const u = UPS.find(x => x.k === b.dataset.buy), upd = store.get('up', {});
    const l = upd[u.k] || 0, cost = u.cost[l];
    if (coins() < cost) { SFX.bonk(); return; }
    addCoins(-cost); upd[u.k] = l + 1; store.set('up', upd);
    SFX.buy(); buzz(30);
    buildShop();
  });
}

/* ---------- rekord ---------- */
function buildRecords() {
  const rec = store.get('rec', {});
  const all = CHARS.map((_, i) => Object.assign({ best: 0, alt: 0, spd: 0, kicks: 0, total: 0 }, rec[i]));
  const max = Math.max(1, ...all.map(e => e.best));
  $('recList').innerHTML = CHARS.map((_, i) => {
    const e = all[i];
    return `<div class="row" style="${styleOf(i)}">${avHTML(i)}<div class="grow"><h4>${esc(charName(i))}</h4>
      <div class="bar" style="width:${e.best / max * 100}%"></div>
      <p class="small-note">🏁 ${e.best} m · ⬆️ ${e.alt} m · 💨 ${e.spd} km/h · ${e.kicks} sparkar · totalt ${e.total} m</p></div>
      <b style="font-size:24px;color:var(--c)">${e.best} m</b></div>`;
  }).join('') + `<button class="btn white small" id="resetRec" style="align-self:center">🗑️ Nollställ allt</button>`;
  $('recList').querySelectorAll('.row .av').forEach(a => a.style.width = '56px');
  $('resetRec').onclick = () => { SFX.tap(); confirmBox('Börja om från noll?', 'Rekord, mynt, uppgraderingar och nivåer raderas.', 'Ja, nollställ', () => { ['rec', 'coins', 'up', 'seenBoost', 'lv'].forEach(k => store.del(k)); buildRecords(); }); };
}

/* ---------- inställningar ---------- */
function buildSettings() {
  $('setList').innerHTML = soundRowsHTML() + `<div class="sec">Figurer – gäller i alla spel</div>${charEditorHTML()}`;
  const L = $('setList');
  bindSoundRows(L);
  bindCharEditor(L, buildSettings);
}

/* ---------- paneler ---------- */
function openPanel(html) {
  $('panel').innerHTML = html;
  $('panel').querySelectorAll('.board-list .av').forEach(a => a.style.width = '42px');
  $('overlay').classList.add('on');
}
function closePanel() { $('overlay').classList.remove('on'); }
function confirmBox(title, text, yes, onYes) {
  openPanel(`<h3>${title}</h3><p>${text}</p><button class="btn pink" id="cYes">${yes}</button><button class="btn white" id="cNo">Nej, fortsätt</button>`);
  $('cYes').onclick = () => { SFX.tap(); closePanel(); onYes(); };
  $('cNo').onclick = () => { SFX.tap(); closePanel(); };
}

/* ---------- firande ---------- */

/* ---------- bakåtknappen på Android ---------- */
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('cNo')) $('cNo').click();
    else if ($('rMenu')) $('rMenu').click();
    return true;
  }
  if (current === 'menu') { goHub(); return true; }
  if (current === 'game') { $('gHome').click(); return true; }
  SFX.tap(); back();
  return true;
};

$('toHub').onclick = () => { SFX.tap(); goHub(); };
show('menu', false);
