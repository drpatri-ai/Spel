/* Bucinca Boxning – menyer, mästerskap, snabbmatch, två spelare, nätverksgala, kontroller, ritning och ljud. */
'use strict';
const store = makeStore('bx');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = location.protocol === 'http:' && location.port === String(PORT);
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const { K, MOVES } = BX;
const CORNER = ['#E53935', '#1E66F5'], CORNER_D = ['#9E1B1B', '#0F3C9E'];

const SFX = Object.assign({}, CORE_SFX, {
  punch: big => { noise(big ? .2 : .1, { type: 'lowpass', f: big ? 700 : 1100, vol: big ? .5 : .3 }); tone(big ? 110 : 160, big ? .18 : .1, { to: 50, vol: big ? .3 : .18 }); },
  block: () => { tone(900, .05, { type: 'square', vol: .05, to: 600 }); noise(.06, { f: 2500, q: 2, vol: .12 }); },
  whoosh: () => noise(.12, { f: 1800, q: .8, vol: .07 }),
  bell: () => { for (const d of [0, .45]) { tone(1320, 1.2, { type: 'sine', vol: .14, delay: d }); tone(1980, .9, { type: 'sine', vol: .06, delay: d }); tone(2640, .5, { type: 'sine', vol: .03, delay: d }); } },
  ooh: () => { noise(1.4, { type: 'lowpass', f: 500, vol: .28 }); tone(220, 1, { to: 160, type: 'triangle', vol: .05 }); },
  cheer: () => { noise(1.8, { f: 1400, q: .5, vol: .2 }); noise(1.2, { f: 2600, q: .6, vol: .1, delay: .2 }); },
  beep: () => tone(880, .12, { type: 'square', vol: .06 }),
  charge: () => tone(200, .45, { to: 1200, type: 'sawtooth', vol: .07 }),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 }))
});

/* ---------- jag ---------- */
const ME = { ch: store.get('ch', 0) };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
const myName = () => REMOTE && Q.get('n') && +Q.get('c') === ME.ch ? Q.get('n').slice(0, 14) : charName(ME.ch);
const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });
const SKIN = CHARS.map(() => '#E8B48A');
FACES.forEach((im, i) => {
  const f = () => { try { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 32, 32); const d = x.getImageData(10, 16, 12, 8).data; let r = 0, g = 0, b = 0, n = 0; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; } if (n) SKIN[i] = `rgb(${r / n | 0},${g / n | 0},${b / n | 0})`; } catch (e) { } };
  if (im.complete && im.naturalWidth) f(); else im.addEventListener('load', f);
});
const stHTML = ch => { const s = BX.statsOf(ch); return `<div class="sts"><span>⚡ ${'●'.repeat(s.spd)}</span><span>💪 ${'●'.repeat(s.pow)}</span><span>❤️ ${'●'.repeat(s.sta)}</span></div>`; };

/* ---------- framsteg ---------- */
let prog = store.get('prog', {});          // prog[ch] = antal besegrade i mästerskapet
let belts = store.get('belts', {});        // belts[ch] = antal vunna mästerskap
const saveProg = () => { store.set('prog', prog); store.set('belts', belts); };
const LADDER_ORDER = [9, 10, 8, 4, 0, 3, 7, 5, 1, 6, 2];
const LADDER_LV = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ladderOf = ch => LADDER_ORDER.filter(c => c !== ch % CHARS.length && c < CHARS.length).slice(0, LADDER_LV.length);

/* ---------- XP och uppgraderingar (per figur, följer med via appens profil) ---------- */
const UPG = [
  { k: 'spd', ic: '⚡', n: 'Snabbhet', d: 'Snabbare slag och fötter' },
  { k: 'pow', ic: '💪', n: 'Styrka', d: 'Hårdare slag' },
  { k: 'sta', ic: '❤️', n: 'Kondition', d: 'Mer liv och mer ork' },
  { k: 'chin', ic: '🪨', n: 'Hård haka', d: 'Tål mer stryk' },
  { k: 'rec', ic: '🔋', n: 'Återhämtning', d: 'Orken kommer tillbaka fortare – lättare att resa sig' },
  { k: 'sup', ic: '⭐', n: 'Superladdning', d: 'Stjärnmätaren fylls snabbare' }
];
const UPG_MAX = 5, LVL_MAX = 1 + UPG.length * UPG_MAX;
const xpNeed = l => 80 + l * 30;
const PROF = {
  get() {
    let raw = null;
    try { if (window.Android && Android.profGet) raw = Android.profGet('box') || null; } catch (e) { }
    let v = null; try { v = raw ? JSON.parse(raw) : store.get('prof', null); } catch (e) { }
    v = v && typeof v === 'object' ? v : {}; v.figs = v.figs || {}; return v;
  },
  set(v) { try { if (window.Android && Android.profSet) Android.profSet('box', JSON.stringify(v)); } catch (e) { } store.set('prof', v); }
};
let prof = PROF.get();
function figOf(ch) {
  const f = prof.figs[ch] || (prof.figs[ch] = { lvl: 1, xp: 0, up: {} });
  f.lvl = Math.max(1, Math.min(LVL_MAX, f.lvl | 0)); f.xp = Math.max(0, f.xp | 0); f.up = BX.cleanUp(f.up);
  return f;
}
const upOf = ch => figOf(ch).up;
const freePts = f => (f.lvl - 1) - UPG.reduce((a, u) => a + f.up[u.k], 0);
function addXp(ch, n) {
  const f = figOf(ch), before = f.lvl;
  f.xp += n;
  while (f.lvl < LVL_MAX && f.xp >= xpNeed(f.lvl)) { f.xp -= xpNeed(f.lvl); f.lvl++; }
  if (f.lvl >= LVL_MAX) f.xp = 0;
  PROF.set(prof);
  return f.lvl - before;
}
const lvlChip = ch => `<span class="belt">Nivå ${figOf(ch).lvl}</span>`;

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'ladder') buildLadder();
  if (id === 'train') buildTrain();
  if (id === 'join') buildJoin();
  if (id === 'lobby') buildLobby();
  if (id === 'fight') resize();
  if (window.Android && Android.keepAwake) try { Android.keepAwake(id === 'fight' || id === 'lobby'); } catch (e) { }
}
function panel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }

function buildMenu() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Boxning 🥊', 'l2');
  $('meCard').setAttribute('style', styleOf(ME.ch));
  const bl = belts[ME.ch] || 0;
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Boxare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    ${stHTML(ME.ch)}<div style="display:flex;gap:6px;margin-top:3px">${lvlChip(ME.ch)}${freePts(figOf(ME.ch)) > 0 ? '<span class="belt" style="background:#34C759;color:#fff">⬆️ Poäng att fördela!</span>' : ''}${bl ? `<span class="belt">🏆 ${bl}</span>` : ''}</div></div>`;
  $('toHost').classList.toggle('hidden', !canHost());
}
function charGrid(el, mark, onPick) {
  el.innerHTML = CHARS.map((_, i) => `<button class="char ${mark(i) ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b>${stHTML(i)}</button>`).join('');
  el.querySelectorAll('.char').forEach(b => b.onclick = () => { SFX.pick(); buzz(12); b.classList.add('pick'); setTimeout(() => onPick(+b.dataset.i), 220); });
}
function pickFigure(title, done, back) {
  $('meTitle').textContent = title;
  charGrid($('chars'), i => i === ME.ch, i => { ME.ch = i; store.set('ch', i); done(); });
  $('meBack').onclick = () => { SFX.tap(); (back || (() => show('menu')))(); };
  show('meScr');
}

/* ---------- mästerskapet ---------- */
function buildLadder() {
  const opp = ladderOf(ME.ch), done = prog[ME.ch] || 0;
  $('ladBox').innerHTML = `<div class="card" style="flex-direction:row;align-items:center;gap:12px">${avHTML(ME.ch, "mini")}<div style="flex:1"><b style="font-size:18px">${esc(charName(ME.ch))}</b>
      <p class="note">Besegra alla ${opp.length} och vinn guldbältet! ${belts[ME.ch] ? `🏆 × ${belts[ME.ch]}` : ''}</p></div></div>
    <div class="ladder">${opp.map((c, i) => {
      const boss = i === opp.length - 1, st = i < done ? 'done' : i === done ? 'next' : 'locked';
      return `<div class="rung ${st} ${boss ? 'boss' : ''}"><span class="no">${boss ? '👑' : i + 1}</span>${avHTML(c)}<div class="grow"><b>${esc(charName(c))}${boss ? ' – Mästaren' : ''}</b><small>${'⭐'.repeat(Math.ceil(LADDER_LV[i] / 2))} · ${BX.statsOf(c).tag}</small></div>
        ${st === 'done' ? '✅' : st === 'next' ? `<button class="btn green" data-i="${i}">🥊 Boxas</button>` : '🔒'}</div>`;
    }).join('')}</div>
    ${done >= opp.length ? `<button class="btn blue" id="ladReset">🔄 Börja om mästerskapet</button>` : ''}`;
  $('ladBox').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { SFX.tap(); const i = +b.dataset.i; startAI(ladderOf(ME.ch)[i], LADDER_LV[i], { ladder: i }); });
  if ($('ladReset')) $('ladReset').onclick = () => { SFX.tap(); prog[ME.ch] = 0; saveProg(); buildLadder(); };
}

/* ---------- träning: lägg poäng på uppgraderingar ---------- */
function buildTrain() {
  const f = figOf(ME.ch), pts = freePts(f), s = BX.statsOf(ME.ch);
  const pip = n => '●'.repeat(n) + '○'.repeat(UPG_MAX - n);
  $('trBox').innerHTML = `<div class="card" style="flex-direction:row;align-items:center;gap:12px" id="trMe">${avHTML(ME.ch, 'mini')}<div style="flex:1;min-width:0">
      <b style="font-size:19px">${esc(charName(ME.ch))}</b> <small style="color:var(--muted)">(tryck för att byta)</small>
      <div class="xpbar"><i style="width:${f.lvl >= LVL_MAX ? 100 : f.xp / xpNeed(f.lvl) * 100}%"></i><span>Nivå ${f.lvl}${f.lvl >= LVL_MAX ? ' (max)' : ` · ${f.xp}/${xpNeed(f.lvl)} XP`}</span></div></div></div>
    <div class="card"><h4>${pts > 0 ? `⬆️ ${pts} poäng att fördela` : 'Inga poäng kvar – boxas för mer XP!'}</h4>
      <p class="note">Varje ny nivå ger 1 poäng. Grund: ⚡ ${s.spd} · 💪 ${s.pow} · ❤️ ${s.sta}</p>
      <div class="upl">${UPG.map(u => `<div class="upr"><span class="ic">${u.ic}</span><div class="grow"><b>${u.n}</b> <span class="pips">${pip(f.up[u.k])}</span><small>${u.d}</small></div>
        <button class="btn green small" data-k="${u.k}" ${pts > 0 && f.up[u.k] < UPG_MAX ? '' : 'disabled'}>+</button></div>`).join('')}</div>
      ${UPG.some(u => f.up[u.k]) ? '<button class="btn white small" id="trReset">🔄 Fördela om poängen</button>' : ''}</div>`;
  $('trBox').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    const ff = figOf(ME.ch); if (freePts(ff) <= 0 || ff.up[b.dataset.k] >= UPG_MAX) return;
    ff.up[b.dataset.k]++; PROF.set(prof); SFX.pick(); buzz(15); buildTrain();
  });
  if ($('trReset')) $('trReset').onclick = () => { const ff = figOf(ME.ch); for (const u of UPG) ff.up[u.k] = 0; PROF.set(prof); SFX.tap(); buildTrain(); };
  $('trMe').onclick = () => { SFX.tap(); pickFigure('Vem ska träna?', () => show('train'), () => show('train')); };
}

/* ---------- snabbmatch ---------- */
const DIFFS = [{ n: 'Lätt', lv: 2 }, { n: 'Medel', lv: 5 }, { n: 'Svår', lv: 8 }, { n: 'Proffs', lv: 10 }];
let qDiff = store.get('qdiff', 1);
function buildQuick() {
  $('diff').innerHTML = DIFFS.map((d, i) => `<button class="${i === qDiff ? 'on' : ''}" data-d="${i}">${d.n}</button>`).join('');
  $('diff').querySelectorAll('button').forEach(b => b.onclick = () => { qDiff = +b.dataset.d; store.set('qdiff', qDiff); SFX.tap(); buildQuick(); });
  charGrid($('qChars'), () => false, i => startAI(i, DIFFS[qDiff].lv, {}));
}

/* ---------- två spelare ---------- */
let duoPick = [];
function buildDuo() {
  $('duoTitle').textContent = duoPick.length ? 'Blå hörna – vem boxas?' : 'Röd hörna – vem boxas?';
  charGrid($('duoChars'), i => duoPick.includes(i), i => { duoPick.push(i); if (duoPick.length === 2) { const p = duoPick; duoPick = []; startDuo(p[0], p[1]); } else buildDuo(); });
}

/* ================= MATCHEN ================= */
/* G.mode: 'ai' | 'duo' | 'host' | 'client' */
const G = { mode: 'ai', fight: null, snap: null, prev: null, names: ['', ''], chs: [0, 0], ids: ['', ''], me: 0, opts: {}, lastEv: 0, acc: 0, endShown: false, spect: false, res: null, sendN: 0 };

function startAI(opCh, lv, opts) {
  G.mode = 'ai'; G.opts = opts || {}; G.opts.opCh = opCh; G.opts.lv = lv;
  begin([{ ch: ME.ch, name: charName(ME.ch), up: upOf(ME.ch) }, { ch: opCh, name: charName(opCh), bot: lv, up: BX.botUp(lv) }], 0);
}
function startDuo(a, b) {
  G.mode = 'duo'; G.opts = { duo: [a, b] };
  begin([{ ch: a, name: charName(a), up: upOf(a) }, { ch: b, name: charName(b), up: upOf(b) }], -2);
}
function begin(pl, me) {
  G.fight = new BX.Fight(pl[0], pl[1], { rounds: 3, roundTime: 60 });
  G.names = pl.map(p => p.name); G.chs = pl.map(p => p.ch);
  G.me = me; G.spect = false; G.lastEv = 0; G.endShown = false; G.endT = 0; G.acc = 0; G.res = null; G.resSent = false;
  G.snap = G.fight.snap(); G.prev = null;
  FX.reset();
  closePanel();
  buildHud(); buildPads();
  show('fight');
}
/* ---------- HUD ---------- */
function buildHud() {
  for (let i = 0; i < 2; i++) {
    $('f' + i).innerHTML = `${avHTML(G.chs[i])}<div class="info"><b>${i === G.me ? '⭐ ' : ''}${esc(G.names[i])}</b><div class="bar"><i id="hp${i}"></i></div><div class="bar sta"><i id="sa${i}"></i></div>
      <div class="sup" id="su${i}">⭐<div class="bar"><i id="sb${i}"></i></div><span class="kds" id="kd${i}"></span></div></div>`;
    $('f' + i).querySelector('.av').style.borderColor = CORNER[i];
  }
}
function updHud(s) {
  for (let i = 0; i < 2; i++) {
    const b = s.b[i];
    $('hp' + i).style.width = Math.max(0, b.hp / b.mh * 100) + '%';
    $('sa' + i).style.width = Math.max(0, b.sa / b.ms * 100) + '%';
    $('sb' + i).style.width = b.su + '%';
    $('su' + i).classList.toggle('full', b.su >= 100);
    $('kd' + i).textContent = '💫'.repeat(b.kd);
  }
  $('clock').innerHTML = `${s.ph === 'break' ? '⏸' : s.tm}<small>Rond ${s.r}</small>`;
  // superknapp
  document.querySelectorAll('.pad [data-k="128"]').forEach(btn => { const i = +btn.dataset.p; btn.classList.toggle('ready', s.b[i] && s.b[i].su >= 100); });
  // resa sig
  const di = s.di, me = G.me;
  const iAmDown = s.ph === 'count' && (di === me || (me === -2)) && s.b[di].kd < 3 && !(G.fight && G.fight.B[di].bot >= 0);
  $('getup').classList.toggle('hidden', !iAmDown);
  if (iAmDown) { $('guBar').style.width = s.b[di].gu + '%'; $('getup').firstChild.textContent = (me === -2 ? G.names[di] + ': t' : 'T') + 'ryck snabbt på slagknapparna för att resa dig! 👊'; }
}
let bigT = 0;
function big(txt, ms, sub) {
  const el = $('big'); el.innerHTML = txt + (sub ? `<small>${sub}</small>` : ''); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.add('hidden'), ms || 1200);
}

/* ---------- kontroller ---------- */
const INPUT = [0, 0];
const BTN = [
  { k: K.L, ic: '◀', t: '' }, { k: K.R, ic: '▶', t: '' }, { k: K.BLOCK, ic: '🛡️', t: 'Gard' }, { k: K.DUCK, ic: '⬇️', t: 'Ducka' },
  { k: K.JAB, ic: '👊', t: 'Jabb' }, { k: K.HOOK, ic: '🥊', t: 'Krok' }, { k: K.UPPER, ic: '⤴️', t: 'Uppercut' }, { k: K.SUPER, ic: '⭐', t: 'Super' }
];
function buildPads() {
  const duo = G.mode === 'duo';
  const players = duo ? [0, 1] : (G.me >= 0 && !G.spect ? [G.me] : []);
  const html = players.map(p => {
    const cls = duo ? 'p' + (p + 1) : '';
    const btn = b => `<button data-k="${b.k}" data-p="${p}" class="${b.k === K.SUPER ? 'supb' : ''}">${b.ic}${b.t ? `<small>${b.t}</small>` : ''}</button>`;
    const lbl = duo ? `<div class="lbl" style="color:${CORNER[p]}">${p ? 'Blå' : 'Röd'}</div>` : '';
    const mv = `<div class="pad mv ${cls}" style="${duo && p === 1 ? '' : ''}">${lbl}${BTN.slice(0, 4).map(btn).join('')}</div>`;
    const at = `<div class="pad at ${cls}">${lbl}${BTN.slice(4).map(btn).join('')}</div>`;
    return mv + at;
  }).join('');
  $('pads').innerHTML = html;
  $('pads').style.setProperty('--bs', duo ? 'clamp(44px,10.5vmin,64px)' : 'clamp(54px,13.5vmin,80px)');
  $('pads').querySelectorAll('button').forEach(b => {
    const k = +b.dataset.k, p = +b.dataset.p;
    const on = e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) { } b.classList.add('on'); setBit(p, k, true); if (k & BX.ATK) buzz(6); };
    const off = e => { if (e) e.preventDefault(); b.classList.remove('on'); setBit(p, k, false); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', () => off());
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  INPUT[0] = INPUT[1] = 0;
}
function setBit(p, k, v) {
  const old = INPUT[p];
  INPUT[p] = v ? (INPUT[p] | k) : (INPUT[p] & ~k);
  if (INPUT[p] === old) return;
  if (G.fight && (G.mode !== 'client')) G.fight.setInput(p, INPUT[p]);
  if (G.mode === 'client') clSend({ t: 'in', b: INPUT[p] });
}
// tangentbord (dator): spelare 1 = A D S W + F G H T, spelare 2 = pilar + J K L I
const KEYS = [
  { KeyA: K.L, KeyD: K.R, KeyS: K.DUCK, KeyW: K.BLOCK, KeyF: K.JAB, KeyG: K.HOOK, KeyH: K.UPPER, KeyT: K.SUPER, Space: K.JAB },
  { ArrowLeft: K.L, ArrowRight: K.R, ArrowDown: K.DUCK, ArrowUp: K.BLOCK, KeyJ: K.JAB, KeyK: K.HOOK, KeyL: K.UPPER, KeyI: K.SUPER }
];
function keyEv(e, down) {
  if (current !== 'fight') return;
  for (let p = 0; p < 2; p++) {
    const k = KEYS[p][e.code]; if (!k) continue;
    e.preventDefault();
    const who = G.mode === 'duo' ? p : G.me;
    if (who < 0) return;
    if (down && e.repeat) return;
    setBit(who, k, down); return;
  }
}
addEventListener('keydown', e => keyEv(e, true));
addEventListener('keyup', e => keyEv(e, false));

/* ---------- huvudloop ---------- */
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.max(0, Math.min(.1, (now - lastT) / 1000)); lastT = now;
  if (current !== 'fight') return;
  if (G.fight && G.mode !== 'client' && !paused) {
    G.acc += dt;
    let n = 0;
    while (G.acc >= BX.DT && n < 8) { G.fight.step(); G.acc -= BX.DT; n++; if (G.mode === 'host' && (++G.sendN % 2 === 0)) hostAll({ t: 's', s: G.fight.snap() }); }
    G.snap = G.fight.snap();
    if (G.mode === 'host' && G.fight.over && !G.resSent) { G.resSent = true; lastResult = G.fight.result(); hostAll({ t: 's', s: G.snap }); hostAll({ t: 'res', r: lastResult }); }
  }
  if (!G.snap) return;
  if (G.mode === 'client') { for (let i = 0; i < 2; i++) { const t = G.snap.b[i].x; DX[i] = DX[i] == null || Math.abs(DX[i] - t) > 200 ? t : DX[i] + (t - DX[i]) * Math.min(1, dt * 18); G.snap.b[i].x = DX[i]; } }
  handleEvents(G.snap);
  updHud(G.snap);
  FX.tick(dt);
  draw(G.snap, now / 1000, dt);
  if (G.snap.ov && !G.endShown) {
    G.endT = (G.endT || 0) + dt;
    if (G.endT > 2.6 && (G.mode !== 'client' || G.res)) { G.endShown = true; G.endT = 0; showResult(); }
  }
}
requestAnimationFrame(loop);
let paused = false;
const DX = [null, null];

/* ---------- händelser → ljud, text, effekter ---------- */
const MV_TXT = { jab: 'Jabb!', hook: 'Krok!', upper: 'Uppercut!', super: '⭐ SUPERSLAG!' };
function handleEvents(s) {
  for (const e of s.ev) {
    if (e.id <= G.lastEv) continue;
    G.lastEv = e.id;
    const mine = i => G.mode === 'duo' || i === G.me;
    switch (e.e) {
      case 'round': big(`Rond ${e.r}`, 1500); break;
      case 'fight': SFX.bell(); big('BOXAS! 🥊', 900); break;
      case 'swing': SFX.whoosh(); break;
      case 'superwind': SFX.charge(); FX.text(MV_TXT.super, s.b[e.i].x, -400, '#FFD23F', 34); break;
      case 'hit': case 'counter': {
        const bigHit = e.m !== 'jab';
        SFX.punch(bigHit); FX.spark(e.x, -255, bigHit ? 26 : 14, '#FFE27A');
        FX.shake = e.m === 'super' ? 22 : bigHit ? 10 : 4;
        if (e.e === 'counter') FX.text('KONTRING!', e.x, -380, '#FF8A3D', 30);
        else if (bigHit) FX.text(MV_TXT[e.m], e.x, -370, '#fff', e.m === 'super' ? 34 : 24);
        FX.hype = Math.min(1, FX.hype + (bigHit ? .3 : .1));
        if (mine(e.i)) buzz(bigHit ? 40 : 15);
        break;
      }
      case 'block': SFX.block(); FX.spark(e.x, -260, 10, '#9FD0FF'); FX.text('Gard', e.x, -360, '#9FD0FF', 20); break;
      case 'guardbreak': FX.text('Garden bruten!', s.b[e.i].x, -400, '#FF4D6D', 24); break;
      case 'dodge': FX.text('Duckade! 😎', s.b[e.i].x, -330, '#A8FFB8', 24); FX.hype = Math.min(1, FX.hype + .15); break;
      case 'down': SFX.ooh(); FX.shake = 26; FX.hype = 1; big('NERE! 💫', 1300); if (mine(e.i)) buzz(120); break;
      case 'count': SFX.beep(); big(String(e.n), 700); break;
      case 'up': SFX.cheer(); big('Uppe igen! 💪', 1100); break;
      case 'bell': SFX.bell(); if (!s.ov) big('Ronden slut 🔔', 1500, 'Vila en stund'); break;
      case 'end': {
        SFX.cheer(); FX.hype = 1;
        const w = G.names[e.w];
        big(e.how === 'ko' ? 'KNOCKOUT!' : e.how === 'tko' ? 'TEKNISK KO!' : e.how === 'wo' ? 'Seger!' : 'Poängseger!', 2400, `${esc(w)} vinner 🏆`);
        confetti();
        break;
      }
    }
  }
}

/* ---------- resultat ---------- */
function xpAward(R, w) {
  const mine = G.mode === 'duo' ? [0, 1] : G.me >= 0 && !G.spect ? [G.me] : [];
  let html = '', up = false;
  for (const i of mine) {
    const ch = G.chs[i], won = i === w, o = R.b[1 - i], me = R.b[i];
    let xp = (won ? 60 : 20) + me.landed * 2 + o.kd * 15;
    if (G.mode === 'ai') { xp += G.opts.lv * 4; if (won && G.opts.ladder != null) xp += (G.opts.ladder + 1) * 10; }
    if (G.mode === 'host' || G.mode === 'client') xp += 20;
    const lv = addXp(ch, xp), f = figOf(ch);
    if (lv) up = true;
    html += `<div class="xpl">${avHTML(ch)}<div style="flex:1"><b>${esc(G.names[i])} +${xp} XP</b>${lv ? ' <span class="lvup">NIVÅ UPP! 🎉</span>' : ''}
      <div class="xpbar"><i style="width:${f.lvl >= LVL_MAX ? 100 : f.xp / xpNeed(f.lvl) * 100}%"></i><span>Nivå ${f.lvl}</span></div></div></div>`;
  }
  if (up) setTimeout(() => { SFX.win(); buzz(60); }, 300);
  return html ? `<div class="xpbox">${html}${up ? '<p style="font-size:15px">Nya poäng att lägga i 🏋️ Träningen!</p>' : ''}</div>` : '';
}
async function showResult() {
  const s = G.snap, w = s.w;
  const R = G.fight ? G.fight.result() : G.res;
  const tab = `<table class="stt"><tr><td><b>${esc(G.names[0])}</b></td><td></td><td><b>${esc(G.names[1])}</b></td></tr>
    ${[['landed', 'Träffar'], ['thrown', 'Slag'], ['dmg', 'Skada'], ['blocked', 'Parerade'], ['kd', 'Nedslag']].map(([k, n]) => `<tr><td>${R.b[0][k]}</td><td>${n}</td><td>${R.b[1][k]}</td></tr>`).join('')}</table>`
    + xpAward(R, w);
  if (G.mode === 'ai') {
    const won = w === 0;
    if (won) {
      let sub = `${esc(G.names[0])} besegrade ${esc(G.names[1])}`;
      let champ = false;
      if (G.opts.ladder != null && G.opts.ladder === (prog[ME.ch] || 0)) {
        prog[ME.ch] = G.opts.ladder + 1;
        if (prog[ME.ch] >= ladderOf(ME.ch).length) { belts[ME.ch] = (belts[ME.ch] || 0) + 1; champ = true; }
        saveProg();
      }
      await celebrate(ME.ch, champ ? 'MÄSTARE! 🏆' : `${G.names[0]} vann!`, champ ? 'Guldbältet är ditt!' : sub, ['🥊', '🏆', '⭐', '💥', '🎉', '✨']);
      const nextI = prog[ME.ch] || 0, opp = ladderOf(ME.ch);
      const hasNext = G.opts.ladder != null && nextI < opp.length;
      panel(`<h3>${champ ? 'Du är mästare! 🏆' : 'Vinst! 🥊'}</h3>${tab}
        ${hasNext ? `<button class="btn green" id="pNext">➡️ Nästa: ${esc(charName(opp[nextI]))}</button>` : ''}
        <button class="btn blue small" id="pAgain">🔄 Boxas igen</button><button class="btn white small" id="pMenu">🏠 Meny</button>`);
      if (hasNext) $('pNext').onclick = () => { SFX.tap(); startAI(opp[nextI], LADDER_LV[nextI], { ladder: nextI }); };
    } else {
      SFX.sad();
      panel(`<h3>${esc(G.names[1])} vann den här gången 😕</h3>${tab}<p>Tips: ducka för jabbar och krokar, ha garden uppe mot uppercuts!</p>
        <button class="btn green" id="pAgain">🔄 Försök igen</button><button class="btn white small" id="pMenu">🏠 Meny</button>`);
    }
    $('pAgain').onclick = () => { SFX.tap(); startAI(G.opts.opCh, G.opts.lv, { ladder: G.opts.ladder }); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); show(G.opts.ladder != null ? 'ladder' : 'menu'); };
    return;
  }
  await celebrate(G.chs[w], `${G.names[w]} vann!`, s.how === 'pts' ? 'På poäng' : 'Knockout!', ['🥊', '🏆', '⭐', '💥', '🎉', '✨']);
  if (G.mode === 'duo') {
    panel(`<h3>${esc(G.names[w])} vann! 🏆</h3>${tab}<button class="btn green" id="pAgain">🔄 Returmatch</button><button class="btn white small" id="pMenu">🏠 Meny</button>`);
    $('pAgain').onclick = () => { SFX.tap(); startDuo(G.opts.duo[0], G.opts.duo[1]); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
  } else {
    panel(`<h3>${esc(G.names[w])} vann! 🏆</h3>${tab}<button class="btn green" id="pLobby">👍 Till galan</button>`);
    $('pLobby').onclick = () => { SFX.tap(); closePanel(); show('lobby'); };
    if (G.mode === 'host') hostAfter(w);
  }
}

$('fBack').onclick = () => {
  SFX.tap();
  const net = G.mode === 'host' || G.mode === 'client';
  if (!net) paused = true;
  panel(`<h3>${net ? (G.mode === 'host' ? 'Avbryt matchen för alla?' : 'Lämna?') : 'Paus ⏸️'}</h3>
    ${net ? '' : '<button class="btn green" id="pNo">▶️ Fortsätt</button>'}
    <button class="btn pink ${net ? '' : 'small'}" id="pYes">🚪 ${net ? 'Ja' : 'Avsluta matchen'}</button>${net ? '<button class="btn white small" id="pNo">Nej</button>' : ''}`);
  $('pYes').onclick = () => {
    SFX.tap(); closePanel(); paused = false;
    if (G.mode === 'host') { G.fight = null; G.snap = null; HOST.inGame = false; hostAll({ t: 'abort' }); hostLobby(); show('lobby'); }
    else if (G.mode === 'client') leave();
    else { G.fight = null; show(G.opts.ladder != null ? 'ladder' : 'menu'); }
  };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); paused = false; };
};

/* ================= RITNING ================= */
const cv = $('cv'), cx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, SC = 1, FLOOR = 0, CAMX = 0;
const AREA = { top: 0, bot: 0 };
function resize() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(2.5, devicePixelRatio || 1);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const land = VW > VH * 1.1;
  const bs = Math.max(G.mode === 'duo' ? 44 : 54, Math.min(G.mode === 'duo' ? 64 : 80, Math.min(VW, VH) * (G.mode === 'duo' ? .105 : .135)));
  const hasPads = $('pads').children.length > 0;
  AREA.top = 70 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-t')) || 14);
  AREA.bot = land ? VH - (hasPads ? bs * .6 : 10) : VH - (hasPads ? bs * 2 + 40 : 20);
  $('turn').classList.toggle('hidden', !(G.mode === 'duo' && !land));
}
addEventListener('resize', () => { if (current === 'fight') resize(); });

const FX = {
  parts: [], texts: [], shake: 0, hype: 0,
  reset() { this.parts = []; this.texts = []; this.shake = 0; this.hype = .3; },
  spark(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = 120 + Math.random() * 380; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0, max: .25 + Math.random() * .3, c, r: 3 + Math.random() * 5 }); } },
  text(t, x, y, c, s) { this.texts.push({ t, x, y, c, s, life: 0 }); },
  tick(dt) {
    for (const p of this.parts) { p.life += dt; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y -= 50 * dt; }
    this.texts = this.texts.filter(t => t.life < 1.2);
    this.shake *= Math.pow(.02, dt); this.hype = Math.max(.25, this.hype - dt * .15);
  }
};

// publiken: slumpade huvuden + några ur familjen
const CROWD = (() => { const r = BX.RNG(11), a = []; for (let row = 0; row < 5; row++) for (let i = 0; i < 46; i++) a.push({ x: -1150 + i * 50 + (row % 2) * 25 + (r() - .5) * 14, row, c: `hsl(${r() * 360 | 0},${40 + r() * 40 | 0}%,${35 + r() * 30 | 0}%)`, sk: ['#F2C9A5', '#E0AC83', '#C68B62', '#8D5A3B', '#F5D5BC'][r() * 5 | 0], hc: ['#3B2A1E', '#7A4A24', '#E8C26A', '#1A1A1A', '#A0522D', '#999'][r() * 6 | 0], ph: r() * 7, fam: -1 }); const front = a.filter(p => p.row === 4); for (let k = 0; k < CHARS.length; k++) front[(k * 4 + 3) % front.length].fam = k; return a; })();

function draw(s, time, dt) {
  const W = VW, H = VH;
  // kamera
  const a = s.b[0], b = s.b[1];
  const mid = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
  const anyDown = s.b.some(q => q.st === 'down');
  const viewW = Math.max(W < H ? 470 : 640, dist + 440 + (anyDown ? 260 : 0)), viewH = W < H ? 470 : 540;
  const aw = W, ah = AREA.bot - AREA.top;
  const sc = Math.min(aw / viewW, ah / viewH);
  SC += (sc - SC) * Math.min(1, dt * 4);
  if (!isFinite(SC) || SC <= 0) SC = sc;
  const lim = BX.RING + 120 - W / 2 / SC;
  const camT = lim <= 0 ? 0 : Math.max(-lim, Math.min(lim, mid));
  CAMX += ((isFinite(camT) ? camT : mid) - CAMX) * Math.min(1, dt * 5);
  FLOOR = AREA.top + (ah - viewH * SC) / 2 + (viewH - 55) * SC;
  const sh = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0, sh2 = FX.shake > .5 ? (Math.random() - .5) * FX.shake : 0;
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // bakgrund
  const gr = cx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120A24'); gr.addColorStop(.6, '#2A1240'); gr.addColorStop(1, '#3A1A4E');
  cx.fillStyle = gr; cx.fillRect(0, 0, W, H);
  // strålkastare
  cx.globalAlpha = .12; cx.fillStyle = '#FFF6D0';
  for (const lx of [-.25, .25]) { cx.beginPath(); cx.moveTo(W / 2 + lx * W - 20, 0); cx.lineTo(W / 2 + lx * W + 20, 0); cx.lineTo(W / 2 + lx * W * .2 + 260, FLOOR); cx.lineTo(W / 2 + lx * W * .2 - 260, FLOOR); cx.fill(); }
  cx.globalAlpha = 1;
  // publik (parallax)
  const psc = SC * .8, pcx = CAMX * .6;
  cx.setTransform(DPR * psc, 0, 0, DPR * psc, DPR * (W / 2 - pcx * psc + sh * .3), DPR * (FLOOR - 250 * SC));
  for (const p of CROWD) {
    const y = -140 + p.row * 52, bounce = Math.max(0, Math.sin(time * (6 + FX.hype * 6) + p.ph)) * (4 + FX.hype * 16);
    cx.fillStyle = '#00000055'; cx.fillRect(p.x - 20, y + 6 - bounce, 40, 60);
    cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(p.x, y + 34 - bounce, 22, 26, 0, 0, 7); cx.fill();
    if (p.fam >= 0 && FACES[p.fam].complete && FACES[p.fam].naturalWidth) {
      cx.save(); cx.beginPath(); cx.arc(p.x, y - bounce, 19, 0, 7); cx.clip(); cx.drawImage(FACES[p.fam], p.x - 19, y - 19 - bounce, 38, 38); cx.restore();
      if (FX.hype > .6) { cx.fillStyle = SKIN[p.fam]; cx.beginPath(); cx.arc(p.x - 26, y - 22 - bounce * 1.5, 7, 0, 7); cx.arc(p.x + 26, y - 22 - bounce * 1.5, 7, 0, 7); cx.fill(); }
    } else { cx.fillStyle = p.sk; cx.beginPath(); cx.arc(p.x, y - bounce, 17, 0, 7); cx.fill(); cx.fillStyle = p.hc; cx.beginPath(); cx.arc(p.x, y - bounce - 6, 17, Math.PI * 1.05, Math.PI * 1.95); cx.fill(); }
  }
  // ringen
  cx.setTransform(DPR * SC, 0, 0, DPR * SC, DPR * (W / 2 - CAMX * SC + sh), DPR * (FLOOR + sh2));
  const R = BX.RING + 80;
  cx.fillStyle = '#2A1238'; cx.fillRect(-3000, -30, 6000, 600);
  cx.fillStyle = '#7A1020'; cx.fillRect(-R - 40, 20, 2 * R + 80, 400);
  cx.fillStyle = '#5A0A18'; cx.fillRect(-R - 40, 20, 2 * R + 80, 8);
  cx.fillStyle = '#FFD23F'; cx.font = 'bold 40px Fredoka, sans-serif'; cx.textAlign = 'center';
  cx.fillText('🥊 BUCINCA BOXNING 🥊', 0, 80);
  const mg = cx.createLinearGradient(0, -30, 0, 22); mg.addColorStop(0, '#2C5FC9'); mg.addColorStop(1, '#3E7BEA');
  cx.fillStyle = mg; cx.beginPath(); cx.moveTo(-R + 40, -30); cx.lineTo(R - 40, -30); cx.lineTo(R, 22); cx.lineTo(-R, 22); cx.fill();
  cx.fillStyle = '#ffffff22'; cx.font = 'bold 30px Fredoka, sans-serif'; cx.fillText('B', 0, 8);
  // hörnstolpar och rep (bakre)
  for (const [px, c] of [[-R + 40, CORNER[0]], [R - 40, CORNER[1]]]) {
    cx.fillStyle = '#ccc'; cx.fillRect(px - 7, -270, 14, 240);
    cx.fillStyle = c; cx.fillRect(px - 13, -265, 26, 200);
  }
  const ropes = ['#E53935', '#fff', '#1E66F5'];
  ropes.forEach((c, k) => { cx.strokeStyle = c; cx.lineWidth = 6; cx.beginPath(); cx.moveTo(-R + 40, -240 + k * 62); cx.lineTo(R - 40, -240 + k * 62); cx.stroke(); });
  // skuggor
  for (const q of s.b) { cx.fillStyle = '#0005'; cx.beginPath(); cx.ellipse(q.x - (q.st === 'down' ? q.f * 150 : 0), 2, q.st === 'down' ? 190 : 80, 12, 0, 0, 7); cx.fill(); }
  // boxarna (den som slår ritas överst)
  const order = s.b[0].st === 'atk' && s.b[1].st !== 'atk' ? [1, 0] : [0, 1];
  for (const i of order) drawBoxer(s.b[i], i, time);
  // effekter
  for (const p of FX.parts) { cx.globalAlpha = Math.max(0, 1 - p.life / p.max); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
  cx.globalAlpha = 1; cx.textAlign = 'center';
  for (const t of FX.texts) { cx.globalAlpha = Math.max(0, 1 - t.life / 1.2); cx.font = `bold ${t.s}px Fredoka, sans-serif`; cx.lineWidth = 6; cx.strokeStyle = '#2B2350'; cx.strokeText(t.t, t.x, t.y); cx.fillStyle = t.c; cx.fillText(t.t, t.x, t.y); }
  cx.globalAlpha = 1;
}

/* ----- en boxare ----- */
const lerp = (a, b, k) => a + (b - a) * k;
const lp = (p, q, k) => [lerp(p[0], q[0], k), lerp(p[1], q[1], k)];
function ik(s, t, l1, l2, dir) {
  let dx = t[0] - s[0], dy = t[1] - s[1], d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(l1 - l2) + 1, Math.min(l1 + l2 - .5, d));
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const base = Math.atan2(dy, dx) + dir * a;
  const e = [s[0] + Math.cos(base) * l1, s[1] + Math.sin(base) * l1];
  const ang2 = Math.atan2(t[1] - e[1], t[0] - e[0]);
  return [e, [e[0] + Math.cos(ang2) * l2, e[1] + Math.sin(ang2) * l2]];
}
function limb(p, q, w, col) {
  cx.lineCap = 'round';
  cx.strokeStyle = '#2B2350'; cx.lineWidth = w + 6; cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke();
  cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(p[0], p[1]); cx.lineTo(q[0], q[1]); cx.stroke();
}
function glove(p, col, colD, big) {
  const r = big ? 30 : 24;
  cx.fillStyle = '#2B2350'; cx.beginPath(); cx.arc(p[0], p[1], r + 3, 0, 7); cx.fill();
  const g = cx.createRadialGradient(p[0] - 8, p[1] - 8, 3, p[0], p[1], r); g.addColorStop(0, '#ffffffaa'); g.addColorStop(.25, col); g.addColorStop(1, colD);
  cx.fillStyle = g; cx.beginPath(); cx.arc(p[0], p[1], r, 0, 7); cx.fill();
}
function pose(b, i, time) {
  const ch = G.chs[i], spdK = .75 + BX.statsOf(ch).spd * .09;
  let crouch = 0, lean = 0, tilt = 0, bob = Math.sin(time * 5 + i * 2) * 3, step = 0, armUp = 0;
  let gF = null, gB = null, bigB = false, bigF = false;
  const N0 = () => null;
  const st = b.st;
  // tid för slagets faser
  let ext = 0, phase = b.ph;
  if (st === 'atk' && b.mv) {
    const m = MOVES[b.mv], k = 1 / spdK;
    if (phase === 'wind') ext = -Math.min(1, b.t / (m.wind * k));
    else if (phase === 'act') ext = 1;
    else ext = Math.max(0, 1 - b.t / (m.rec * k));
  }
  if (st === 'walk') step = Math.sin(time * 12) * 14;
  if (st === 'duck') { crouch = 1; lean = 22; }
  if (st === 'block') { crouch = .15; }
  if (st === 'stun') { lean = -18; tilt = -.35; bob = 0; }
  if (st === 'win') { bob = Math.abs(Math.sin(time * 7)) * -22; armUp = 1; }
  if (st === 'lose') { crouch = .3; lean = 12; tilt = .45; }
  if (st === 'atk') {
    if (b.mv === 'jab') lean = ext > 0 ? 10 * ext : 0;
    if (b.mv === 'hook') lean = ext > 0 ? 14 * ext : -6 * -ext;
    if (b.mv === 'upper') { crouch = ext < 0 ? .45 * -ext : .2 * ext; lean = ext > 0 ? 12 * ext : 8; }
    if (b.mv === 'super') { crouch = ext < 0 ? .35 * -ext : 0; lean = ext > 0 ? 30 * ext : -14 * -ext; }
  }
  const H = [lean * .25, -150 + crouch * 46 + bob];
  const Nk = [H[0] + lean, H[1] - 106 + crouch * 6];
  const guardF = [Nk[0] + 58, Nk[1] - 22], guardB = [Nk[0] + 36, Nk[1] - 4];
  gF = guardF; gB = guardB;
  if (st === 'block') { gF = [Nk[0] + 50, Nk[1] - 50]; gB = [Nk[0] + 46, Nk[1] - 18]; }
  if (st === 'duck') { gF = [Nk[0] + 56, Nk[1] - 12]; gB = [Nk[0] + 34, Nk[1] + 4]; }
  if (st === 'stun' || st === 'lose') { gF = [Nk[0] + 40, Nk[1] + 40]; gB = [Nk[0] + 10, Nk[1] + 50]; }
  if (st === 'win') { gF = [Nk[0] + 34, Nk[1] - 120]; gB = [Nk[0] - 30, Nk[1] - 115]; }
  if (st === 'atk') {
    const e = ext;
    if (b.mv === 'jab') gF = e < 0 ? lp(guardF, [Nk[0] + 40, Nk[1] - 18], -e) : lp(guardF, [Nk[0] + 140, Nk[1] - 30], e);
    if (b.mv === 'hook') { if (e < 0) gF = lp(guardF, [Nk[0] - 6, Nk[1] - 12], -e); else { const a = (1 - e) * 1.2; gF = [Nk[0] + 50 + 72 * Math.cos(a), Nk[1] - 38 + 10 * Math.sin(a) - 0]; } bigF = true; }
    if (b.mv === 'upper') { gB = e < 0 ? lp(guardB, [Nk[0] + 16, Nk[1] + 72], -e) : lp(lp(guardB, [Nk[0] + 16, Nk[1] + 72], 0), [Nk[0] + 92, Nk[1] - 80], e); }
    if (b.mv === 'super') { gB = e < 0 ? lp(guardB, [Nk[0] - 58, Nk[1] + 6], -e) : lp(guardB, [Nk[0] + 160, Nk[1] - 30], e); bigB = true; }
  }
  return { H, Nk, gF, gB, bigF, bigB, crouch, lean, tilt, step };
}
function drawBoxer(b, i, time) {
  const ch = G.chs[i], P = pose(b, i, time);
  const col = CHARS[ch].c, colD = CHARS[ch].d, skin = SKIN[ch], gC = CORNER[i], gD = CORNER_D[i];
  cx.save();
  cx.translate(b.x, 0);
  cx.scale(b.f, 1);
  if (b.st === 'down') {
    const k = Math.min(1, b.t / .35);
    cx.translate(-k * 30, -k * 24);
    cx.rotate(-Math.PI / 2 * k);
  }
  const { H, Nk, gF, gB } = P;
  // bakre arm
  const SB = [Nk[0] - 12, Nk[1] + 18], SF = [Nk[0] + 14, Nk[1] + 14];
  const [eB, hB] = ik(SB, gB, 64, 62, 1);
  limb(SB, eB, 22, skin); limb(eB, hB, 20, skin); glove(hB, gD, '#00000088', P.bigB);
  // ben
  const st = P.step;
  const fF = [42 + st, 0], fB = [-44 - st, 0];
  const HF = [H[0] + 12, H[1] + 8], HB = [H[0] - 12, H[1] + 8];
  const [kB] = ik(HB, fB, 84, 82, -1), [kF] = ik(HF, fF, 84, 82, -1);
  limb(HB, kB, 28, skin); limb(kB, fB, 24, skin);
  limb(HF, kF, 28, skin); limb(kF, fF, 24, skin);
  for (const f of [fB, fF]) { cx.fillStyle = '#2B2350'; rr(f[0] - 22, f[1] - 22, 52, 26, 10); cx.fill(); cx.fillStyle = '#fff'; rr(f[0] - 19, f[1] - 19, 46, 18, 8); cx.fill(); cx.fillStyle = gC; cx.fillRect(f[0] - 8, f[1] - 19, 6, 18); }
  // shorts
  cx.fillStyle = '#2B2350'; rr(H[0] - 40, H[1] - 26, 80, 66, 16); cx.fill();
  cx.fillStyle = gC; rr(H[0] - 36, H[1] - 22, 72, 58, 13); cx.fill();
  cx.fillStyle = '#fff'; cx.fillRect(H[0] - 36, H[1] - 22, 72, 9);
  cx.fillStyle = '#ffffff55'; cx.fillRect(H[0] + 24, H[1] - 13, 6, 48);
  // överkropp (linne i figurens färg)
  cx.fillStyle = '#2B2350';
  cx.beginPath(); cx.moveTo(H[0] - 37, H[1] - 14); cx.lineTo(Nk[0] - 42, Nk[1] + 6); cx.quadraticCurveTo(Nk[0], Nk[1] - 10, Nk[0] + 42, Nk[1] + 6); cx.lineTo(H[0] + 37, H[1] - 14); cx.closePath(); cx.fill();
  const tg = cx.createLinearGradient(H[0] - 40, 0, H[0] + 40, 0); tg.addColorStop(0, colD); tg.addColorStop(.6, col); tg.addColorStop(1, colD);
  cx.fillStyle = tg;
  cx.beginPath(); cx.moveTo(H[0] - 33, H[1] - 16); cx.lineTo(Nk[0] - 37, Nk[1] + 9); cx.quadraticCurveTo(Nk[0], Nk[1] - 5, Nk[0] + 37, Nk[1] + 9); cx.lineTo(H[0] + 33, H[1] - 16); cx.closePath(); cx.fill();
  cx.fillStyle = skin; cx.beginPath(); cx.ellipse(Nk[0] + 4, Nk[1] + 2, 16, 12, 0, 0, 7); cx.fill();
  // huvud
  const hc = [Nk[0] + 8 + P.lean * .25, Nk[1] - 44];
  cx.save(); cx.translate(hc[0], hc[1]); cx.rotate(P.tilt + (b.ht ? -.18 : 0));
  cx.fillStyle = '#2B2350'; cx.beginPath(); cx.arc(0, 0, 50, 0, 7); cx.fill();
  cx.fillStyle = gC; cx.beginPath(); cx.arc(0, 0, 47, 0, 7); cx.fill();
  cx.save(); cx.beginPath(); cx.arc(0, 0, 42, 0, 7); cx.clip();
  // spegla ansiktet tillbaka så att det aldrig blir spegelvänt
  cx.scale(b.f, 1);
  const im = FACES[ch];
  if (im.complete && im.naturalWidth) cx.drawImage(im, -42, -42, 84, 84); else { cx.fillStyle = skin; cx.fillRect(-42, -42, 84, 84); }
  if (b.ht) { cx.fillStyle = '#FF000040'; cx.fillRect(-42, -42, 84, 84); }
  cx.restore();
  cx.restore();
  // stjärnor runt huvudet
  if (b.st === 'down' || b.st === 'lose' || (b.st === 'stun' && b.lh !== 'jab')) {
    cx.save(); cx.translate(hc[0], hc[1] - 50); cx.scale(b.f, 1);
    cx.font = '22px sans-serif'; cx.textAlign = 'center';
    for (let k = 0; k < 3; k++) { const a = time * 5 + k * 2.1; cx.fillText('⭐', Math.cos(a) * 46, Math.sin(a) * 12 + 6); }
    cx.restore();
  }
  // främre arm
  const [eF, hF] = ik(SF, gF, 64, 62, 1);
  limb(SF, eF, 22, skin); limb(eF, hF, 20, skin); glove(hF, gC, gD, P.bigF);
  // superslagets glöd
  if (b.st === 'atk' && b.mv === 'super') { cx.globalAlpha = .4 + .3 * Math.sin(time * 30); cx.fillStyle = '#FFD23F'; cx.beginPath(); cx.arc(hB[0], hB[1], 44, 0, 7); cx.fill(); cx.globalAlpha = 1; }
  cx.restore();
}
function rr(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }

/* ================= NÄTVERK ================= */
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = `
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Galan startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen här.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>
    <p class="note" style="text-align:center;color:#fff">Alla måste vara på samma wifi. Du boxas som ${esc(charName(ME.ch))}.</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'box.html');
  };
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">🥊</span> Letar efter matcher…</p>`;
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
  try { r = JSON.parse(Android.netHost('box:' + charName(ME.ch) + 's gala')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/box.html?host=1&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`;
}
function leave() {
  if (G.mode === 'host' || HOSTPAGE) {
    try { HOST.ws && HOST.ws.close(); } catch (e) { } HOST.ws = null;
    try { Android.netStop(); } catch (e) { }
    location.href = APP_HOME + 'box.html'; return;
  }
  if (CLIENT) {
    CL.closing = true; try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (window.Android) location.href = APP_HOME + 'box.html';
    else { G.mode = 'ai'; show('menu'); }
    return;
  }
  show('menu');
}

/* ----- värd: kön – de två första boxas, vinnaren stannar kvar ----- */
const HOST = { ws: null, lobby: [], ok: false, inGame: false, fighters: null };
function hostStart() {
  G.mode = 'host';
  HOST.lobby = [{ id: 'h', name: myName(), ch: ME.ch }];
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
    HOST.lobby = HOST.lobby.filter(p => p.id !== id);
    if (HOST.inGame && G.fight && !G.fight.over && HOST.fighters) { const k = HOST.fighters.indexOf(id); if (k >= 0) G.fight.finish(1 - k, 'wo'); }
    return hostLobby();
  }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    const p = { id, name: String(m.name || 'Boxare').slice(0, 14), ch: Math.abs(m.ch | 0) % CHARS.length, up: BX.cleanUp(m.up) };
    const old = HOST.lobby.find(q => q.id === id);
    if (old) Object.assign(old, p); else { HOST.lobby.push(p); SFX.pick(); buzz(15); }
    hostTo(id, { t: 'welcome', id });
    hostLobby();
    if (HOST.inGame && G.fight) hostTo(id, startMsg());
  } else if (m.t === 'in') {
    if (!HOST.inGame || !G.fight || !HOST.fighters) return;
    const k = HOST.fighters.indexOf(id);
    if (k >= 0) G.fight.setInput(k, m.b | 0);
  }
}
const startMsg = () => ({ t: 'start', f: HOST.fighters.map((id, i) => ({ id, name: G.names[i], ch: G.chs[i] })) });
function lobbyMsg() { return { t: 'lobby', players: HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch })), inGame: HOST.inGame, host: myName() }; }
function hostLobby() { hostAll(lobbyMsg()); if (current === 'lobby') buildLobby(); }
function hostBegin() {
  if (HOST.lobby.length < 2) { panel(`<h3>Minst två boxare</h3><p>Vänta tills någon har gått med.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  const A = HOST.lobby[0], B = HOST.lobby[1];
  HOST.inGame = true; HOST.fighters = [A.id, B.id];
  G.mode = 'host';
  const me = HOST.fighters.indexOf('h');
  begin([{ ch: A.ch, name: A.name, up: A.id === 'h' ? upOf(ME.ch) : A.up }, { ch: B.ch, name: B.name, up: B.id === 'h' ? upOf(ME.ch) : B.up }], me);
  G.spect = me < 0; if (G.spect) { buildPads(); resize(); }
  hostAll(startMsg());
  hostLobby();
}
function hostAfter(w) {
  // vinnaren stannar först i kön, förloraren ställer sig sist
  const winId = HOST.fighters[w], loseId = HOST.fighters[1 - w];
  const W1 = HOST.lobby.find(p => p.id === winId), L1 = HOST.lobby.find(p => p.id === loseId);
  HOST.lobby = HOST.lobby.filter(p => p.id !== winId && p.id !== loseId);
  if (W1) HOST.lobby.unshift(W1); if (L1) HOST.lobby.push(L1);
  HOST.inGame = false; HOST.fighters = null; G.fight = null;
  hostLobby();
}
let lastResult = null;

/* ----- klient ----- */
const CL = { ws: null, id: null, lobby: null, closing: false, tries: 0 };
function clientStart() { G.mode = 'client'; pickFigure('Vem boxas?', clientConnect, leave); }
function clientConnect() {
  CL.closing = false;
  const ws = new WebSocket(`ws://${location.host}/ws`);
  CL.ws = ws;
  panel(`<h3>Ansluter… <span class="spin">🥊</span></h3>`);
  ws.onopen = () => { CL.tries = 0; closePanel(); ws.send(JSON.stringify({ t: 'hi', name: myName(), ch: ME.ch, up: upOf(ME.ch) })); if (current !== 'fight') show('lobby'); };
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
  if (m.t === 'welcome') CL.id = m.id;
  else if (m.t === 'lobby') { CL.lobby = m; if (current === 'lobby') buildLobby(); }
  else if (m.t === 'start') {
    G.mode = 'client'; G.fight = null; G.res = null;
    G.names = m.f.map(f => f.name); G.chs = m.f.map(f => f.ch);
    G.me = m.f.findIndex(f => f.id === CL.id); G.spect = G.me < 0;
    G.lastEv = 0; G.endShown = false; G.endT = 0; G.snap = null; DX[0] = DX[1] = null;
    FX.reset(); closePanel(); buildHud(); buildPads(); show('fight');
    if (G.spect) big('Du tittar på 👀', 1800, 'Vinnaren möter nästa i kön');
  }
  else if (m.t === 's') { if (current === 'fight') { G.snap = m.s; } }
  else if (m.t === 'res') { G.res = m.r; }
  else if (m.t === 'abort') { closePanel(); G.snap = null; show('lobby'); }
  else if (m.t === 'hostgone') { CL.closing = true; panel(`<h3>Galan är slut 👋</h3><p>Värden avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); leave(); }; }
}

function buildLobby() {
  if (current !== 'lobby') return;
  const isHost = G.mode === 'host';
  const L = isHost ? lobbyMsg() : (CL.lobby || { players: [], inGame: false });
  const myId = isHost ? 'h' : CL.id;
  const pls = L.players.map((p, i) => `<div class="pl ${p.id === myId ? 'mine' : ''}" style="${styleOf(p.ch)}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' 👑' : ''}</span>${i < 2 ? `<span class="q" style="background:${CORNER[i]}">${i ? 'Blå hörna' : 'Röd hörna'}</span>` : `<span class="q">Kö ${i - 1}</span>`}</div>`).join('');
  const nx = L.players.length >= 2 ? `<div class="vsline">${avHTML(L.players[0].ch)} ${esc(L.players[0].name)} <span>mot</span> ${esc(L.players[1].name)} ${avHTML(L.players[1].ch)}</div>` : '';
  let side = '';
  if (isHost) {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/box.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="card"><h4>📲 Bjud in familjen</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: Boxning → 🔗 Gå med.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
  }
  $('lobbyBox').innerHTML = `<div class="gar"><div class="card"><h4>🥊 Boxare (${L.players.length})</h4><div class="plist">${pls || '<p class="note">Ingen här än…</p>'}</div>
      ${nx}
      ${isHost ? `<button class="btn green" id="gStart" ${HOST.ok && !L.inGame && L.players.length >= 2 ? '' : 'disabled'}>🔔 Starta matchen!</button>` : `<p class="wait" style="text-align:center;font-weight:600">${L.inGame ? 'Match pågår… 🥊' : `Väntar på att ${esc(L.host || 'värden')} startar ⏳`}</p>`}
      <p class="note">De två första i listan möts. Vinnaren stannar kvar och möter nästa – förloraren ställer sig sist i kön. Alla andra ser matchen på sin skärm.</p></div>
    <div style="display:flex;flex-direction:column;gap:12px">${side}</div></div>`;
  if ($('gStart')) $('gStart').onclick = () => { SFX.tap(); hostBegin(); };
  if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildLobby(); };
}
$('lobbyBack').onclick = () => {
  SFX.tap();
  panel(`<h3>${G.mode === 'host' ? 'Avsluta galan?' : 'Lämna?'}</h3><button class="btn pink" id="pYes">🚪 ${G.mode === 'host' ? 'Avsluta' : 'Lämna'}</button><button class="btn white small" id="pNo">Stanna kvar</button>`);
  $('pYes').onclick = () => { SFX.tap(); closePanel(); leave(); };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); };
};

/* ---------- hjälp ---------- */
function help() {
  panel(`<h3>Så boxas man 🥊</h3>
    <p style="text-align:left;font-size:16px">◀ ▶ Gå fram och tillbaka<br>👊 <b>Jabb</b> – snabb och lång, men svag<br>🥊 <b>Krok</b> – hårdare men långsammare<br>⤴️ <b>Uppercut</b> – kort och hård, träffar även den som duckar<br>
    🛡️ <b>Gard</b> – stoppar jabbar, tar det mesta av krokar<br>⬇️ <b>Ducka</b> – jabbar och krokar går över huvudet<br>⭐ <b>Superslag</b> – när stjärnmätaren är full<br>
    💥 Slå när motståndaren drar upp ett slag = <b>kontring</b>!<br>🔋 Den blå mätaren är orken – slår du för mycket blir du trött och svag.<br>💫 Hamnar du i golvet: tryck snabbt på slagknapparna för att resa dig innan domaren räknat till 10. Tre nedslag = teknisk knockout.</p>
    <button class="btn green" id="pClose">👍 Kör!</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('meCard').onclick = () => { SFX.tap(); pickFigure('Vem boxas?', () => show('menu')); };
$('toLadder').onclick = () => { SFX.tap(); show('ladder'); };
$('toQuick').onclick = () => { SFX.tap(); buildQuick(); show('quick'); };
$('toDuo').onclick = () => { SFX.tap(); duoPick = []; buildDuo(); show('duo'); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toHelp').onclick = () => { SFX.tap(); help(); };
$('toTrain').onclick = () => { SFX.tap(); show('train'); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    for (const id of ['pClose', 'pNo', 'pMenu', 'pLobby', 'pLeave', 'pOk']) if ($(id)) { $(id).click(); return true; }
    return true;
  }
  if (current === 'fight') { $('fBack').click(); return true; }
  if (current === 'lobby') { $('lobbyBack').click(); return true; }
  if (current === 'meScr') { $('meBack').click(); return true; }
  if (current === 'menu') { if (REMOTE) { if (window.Android) location.href = APP_HOME + 'index.html'; else leave(); } else goHub(); return true; }
  show('menu'); return true;
};

bubbles();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu');
