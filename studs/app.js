/* Bucinca Studs – menyer, banval, flera spelare, nätverk (värd/klient), sikte och uppspelning av skotten. */
'use strict';
const store = makeStore('bu');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = (location.protocol === 'http:' && location.port === String(PORT)) || !!NET_ONLINE;
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const { W, H, LEVELS, POWERS } = PG;

const SCALE = [0, 2, 4, 5, 7, 9, 11];
const SFX = Object.assign({}, CORE_SFX, {
  shoot: () => { tone(220, .12, { to: 520, type: 'triangle', vol: .14 }); noise(.08, { f: 1200, vol: .06 }); },
  peg: n => { const k = Math.min(n - 1, 20), f = 392 * Math.pow(2, (Math.floor(k / 7) * 12 + SCALE[k % 7]) / 12); tone(f, .16, { type: 'triangle', vol: .12 }); tone(f * 2, .08, { type: 'sine', vol: .04 }); },
  bump: () => tone(300 + Math.random() * 60, .04, { type: 'sine', vol: .03 }),
  pop: i => tone(700 + (i % 8) * 60, .05, { type: 'square', vol: .025, to: 1200 }),
  free: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, .14, { type: 'square', vol: .06, delay: i * .08 })),
  power: () => { tone(300, .5, { to: 1400, type: 'sawtooth', vol: .06 }); noise(.4, { f: 2500, q: .8, vol: .08 }); },
  boom: () => { noise(.6, { type: 'lowpass', f: 600, vol: .4 }); tone(90, .4, { to: 40, vol: .3 }); },
  zap: () => { for (let i = 0; i < 5; i++) noise(.06, { f: 3000 + i * 400, q: 4, vol: .1, delay: i * .05 }); },
  spook: () => tone(500, .6, { to: 250, type: 'sine', vol: .1 }),
  tramp: () => tone(150, .3, { to: 700, type: 'triangle', vol: .14 }),
  slot: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, .2, { type: 'triangle', vol: .12, delay: i * .07 })),
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 })),
  ode: () => {   // Glädjens hymn (Beethoven) – när sista orange pinnen träffas
    const N = { C: 523, D: 587, E: 659, F: 698, G: 784 };
    'E E F G G F E D C C D E E D D'.split(' ').forEach((n, i) => {
      const d = i === 12 ? .45 : i > 12 ? .15 : .3, t = i < 13 ? i * .3 : 12 * .3 + .45 + (i - 13) * .15;
      tone(N[n], d * .95, { type: 'triangle', vol: .13, delay: t }); tone(N[n] / 2, d * .9, { type: 'sine', vol: .07, delay: t });
    });
  }
});

/* ---------- jag ---------- */
const ME = { ch: store.get('ch', 0) };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (!(ME.ch >= 0 && ME.ch < CHARS.length)) ME.ch = 0;
const myName = () => (CLIENT || HOSTPAGE) && Q.get('n') && +Q.get('c') === ME.ch ? Q.get('n').slice(0, 14) : charName(ME.ch);
const powOf = ch => POWERS[PG.powOf(ch)];
const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

/* ---------- framsteg ---------- */
let best = store.get('best', {}), cleared = store.get('cleared', {});
const unlocked = lv => lv === 0 || !!cleared[lv - 1] || !!cleared[lv];

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
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
  $('logo').innerHTML = ln('Bucinca', 'l1') + ln('Studs 🎯', 'l2');
  const p = powOf(ME.ch);
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Spelare (tryck för att byta)</small><b>${esc(charName(ME.ch))}</b>
    <div><span class="pw">${p.ic} ${p.name}</span></div></div>`;
  $('toHost').classList.toggle('hidden', !canHost());
}
function pickFigure(title, done, back) {
  $('meTitle').textContent = title;
  $('chars').innerHTML = CHARS.map((_, i) => { const p = powOf(i); return `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b>
    <span class="pw">${p.ic} ${p.name}</span></button>`; }).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    ME.ch = +el.dataset.i; store.set('ch', ME.ch); SFX.pick(); buzz(12);
    el.classList.add('pick'); setTimeout(done, 250);
  });
  $('meBack').onclick = () => { SFX.tap(); (back || (() => show('menu')))(); };
  show('meScr');
}

/* ---------- banval ---------- */
let lvMode = 'solo', lvPlayers = null;
function showLevels(mode, players) {
  lvMode = mode; lvPlayers = players;
  $('lvTitle').textContent = mode === 'solo' ? 'Välj bana' : 'Välj bana 👫';
  const all = mode !== 'solo';
  $('lvBox').innerHTML = `<div class="lvls">${LEVELS.map((L, i) => {
    const lock = !all && !unlocked(i);
    return `<button class="lv ${cleared[i] && !all ? 'done' : ''} ${lock ? 'lock' : ''}" data-i="${i}"><span class="no">${i + 1}</span>${cleared[i] && !all ? '<span class="st">⭐</span>' : ''}
      <span class="ic">${lock ? '🔒' : L.ic}</span><b>${L.name}</b><small>${!all && best[i] ? 'Rekord ' + fmt(best[i]) : lock ? 'Klara förra banan' : '&nbsp;'}</small></button>`;
  }).join('')}</div>`;
  $('lvBox').querySelectorAll('.lv').forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (b.classList.contains('lock')) { SFX.bonk(); return; }
    SFX.pick();
    if (lvMode === 'solo') startLocal(i, [{ id: 'p0', name: charName(ME.ch), ch: ME.ch }]);
    else startLocal(i, lvPlayers);
  });
  $('lvBack').onclick = () => { SFX.tap(); show(lvMode === 'solo' ? 'menu' : 'local'); };
  show('levels');
}
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* ---------- flera spelare på samma skärm ---------- */
let locPick = [];
function buildLocal() {
  $('locSel').innerHTML = [0, 1, 2, 3].map(i => locPick[i] != null ? avHTML(locPick[i]) : `<div class="slot">${i + 1}</div>`).join('');
  $('locChars').innerHTML = CHARS.map((_, i) => { const n = locPick.indexOf(i), p = powOf(i); return `<button class="char ${n >= 0 ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${n >= 0 ? `<span class="num">${n + 1}</span>` : ''}${avHTML(i)}<b>${esc(charName(i))}</b><span class="pw">${p.ic} ${p.name}</span></button>`; }).join('');
  $('locChars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    const i = +el.dataset.i, n = locPick.indexOf(i);
    if (n >= 0) locPick.splice(n, 1); else if (locPick.length < 4) locPick.push(i); else { SFX.bonk(); return; }
    SFX.pick(); buzz(10); buildLocal();
  });
  $('locGo').disabled = locPick.length < 2;
}
$('locGo').onclick = () => { SFX.tap(); showLevels('local', locPick.map((ch, i) => ({ id: 'p' + i, name: charName(ch), ch }))); };

/* ================= SPELET ================= */
/* G.mode: 'solo' | 'local' | 'host' | 'client' */
const G = { mode: 'solo', S: null, V: null, angle: Math.PI / 2, busy: false, myId: 'p0', path: null, pending: null, queued: null, ff: false, aimSent: 0 };

function startLocal(lv, players) {
  G.mode = players.length === 1 ? 'solo' : 'local';
  G.myId = null;
  beginGame(PG.newGame(lv, players, (Math.random() * 1e9) | 0));
}
function beginGame(S) {
  G.S = S; G.busy = false; G.pending = null; G.queued = null; G.angle = Math.PI / 2; G.ff = false;
  buildView(S);
  closePanel();
  show('game');
  turnStart(true);
}
function myTurn() {
  if (!G.S || G.S.over || G.busy) return false;
  if (G.mode === 'solo' || G.mode === 'local') return true;
  return G.S.players[G.S.turn].id === G.myId;
}
function turnStart(first) {
  const S = G.S; if (!S) return;
  const p = S.players[S.turn];
  updHud();
  G.path = null;
  const mine = myTurn();
  $('fire').disabled = !mine; $('aL').disabled = !mine; $('aR').disabled = !mine;
  $('waitmsg').classList.toggle('hidden', mine || S.over);
  if (!mine && !S.over) $('waitmsg').textContent = `${p.name} siktar… ⏳`;
  if (mine) calcPath();
  if (S.over) return;
  if (S.players.length > 1) big(`${esc(p.name)}s tur!`, 1100, `<small>${powOf(p.ch).ic} ${powOf(p.ch).name}</small>`);
  else if (first) big(LEVELS[S.lv].name, 1300, `<small>Träffa alla orange pinnar!</small>`);
}
function updHud() {
  const S = G.S; if (!S) return;
  $('plrs').innerHTML = S.players.map((p, i) => `<div class="pc ${i === S.turn && !S.over ? 'on' : ''} ${p.left ? 'out' : ''}" style="${styleOf(p.ch)}">${avHTML(p.ch)}<div class="t"><b>${esc(p.name)}</b><small>⭐ ${fmt(p.score)} · ⚪ ${p.balls}</small></div></div>`).join('');
  const b = S.board, left = b.nO - b.litO, m = PG.multOf(b.litO, b.nO);
  const pl = S.players[S.turn], fx = pl.fx, ex = [];
  if (fx.guide > 0) ex.push(`🎯×${fx.guide}`); if (fx.bucket > 0) ex.push(`🪣×${fx.bucket}`); if (fx.double > 0) ex.push(`💰×${fx.double}`);
  $('info').innerHTML = `<div class="chip">🟠 ${left} kvar</div><div class="chip mult ${m === 10 ? 'x10' : ''}">×${m} poäng</div>${ex.length ? `<div class="chip">${ex.join(' ')}</div>` : ''}`;
}
let bigT = 0;
function big(txt, ms, sub) {
  const el = $('big'); el.innerHTML = txt + (sub || ''); el.classList.remove('hidden', 'pop'); void el.offsetWidth; el.classList.add('pop');
  clearTimeout(bigT); bigT = setTimeout(() => el.classList.add('hidden'), ms || 1200);
}

/* ---------- vy (det som ritas) ---------- */
function buildView(S) {
  G.V = {
    pegs: S.board.pegs.filter(p => !p.gone).map(p => ({ ...p, lit: 0, pop: 0 })),
    clock: S.board.clock, balls: [], fever: S.fever, big: S.players[S.turn].fx.bucket > 0,
    trail: [], parts: [], texts: [], shake: 0, zoom: null, flash: 0, slotHit: -1, rainbow: 0
  };
  G.V.byId = {}; for (const p of G.V.pegs) G.V.byId[p.id] = p;
}

/* ---------- ritning ---------- */
const cv = $('cv'), cx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, SC = 1, OX = 0, OY = 0, LAND = false;
const BG = document.createElement('canvas');
function resize() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(2.5, devicePixelRatio || 1);
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  LAND = VW > VH * 1.15;
  const g = $('game'); g.classList.toggle('land', LAND);
  const cs = getComputedStyle(document.documentElement);
  const sT = parseFloat(cs.getPropertyValue('--safe-t')) || 14, sB = 14;
  let ax, ay, aw, ah;
  if (LAND) {
    const lw = Math.max(150, Math.min(240, VW * .2)), rw = Math.max(120, Math.min(190, VW * .16));
    g.style.setProperty('--lw', lw + 'px'); g.style.setProperty('--rw', rw + 'px');
    ax = lw + 24; aw = VW - lw - rw - 40; ay = 8; ah = VH - 16;
    $('info').style.cssText = `top:calc(var(--safe-t) + 4px);right:calc(var(--safe-r) + 4px);width:${rw - 10}px;align-items:center`;
    $('ctl').style.top = '0'; $('ctl').style.bottom = '0';
    $('waitmsg').style.cssText = `top:auto;bottom:24px;left:${lw + 24}px;right:${rw + 16}px`;
  } else {
    ax = 6; aw = VW - 12; ay = sT + 58; ah = VH - ay - 84 - sB;
    $('info').style.cssText = `top:${sT + 58}px;right:calc(var(--safe-r));`;
    $('ctl').style.top = ''; $('ctl').style.bottom = '';
    $('waitmsg').style.cssText = `bottom:calc(var(--safe-b) + 74px)`;
  }
  SC = Math.min(aw / W, ah / H);
  OX = ax + (aw - W * SC) / 2; OY = ay + (ah - H * SC) / 2;
  // bakgrund med stjärnor
  BG.width = W; BG.height = H;
  const b = BG.getContext('2d');
  const gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1E2F7A'); gr.addColorStop(.6, '#3A2A8C'); gr.addColorStop(1, '#5B2F8C');
  b.fillStyle = gr; b.fillRect(0, 0, W, H);
  const r = PG.RNG(7);
  for (let i = 0; i < 90; i++) { b.fillStyle = `rgba(255,255,255,${.15 + r() * .5})`; b.beginPath(); b.arc(r() * W, r() * H, .8 + r() * 1.8, 0, 7); b.fill(); }
  b.fillStyle = '#ffffff10'; for (let i = 0; i < 5; i++) { b.beginPath(); b.arc(r() * W, 150 + r() * 700, 80 + r() * 120, 0, 7); b.fill(); }
}
addEventListener('resize', () => { if (current === 'game') resize(); });

const COL = { b: ['#2E86FF', '#9FD0FF'], o: ['#FF7A12', '#FFD08A'], g: ['#25B84A', '#A8FFB8'], p: ['#A54BFF', '#E3B8FF'] };
function drawPeg(p, c, t) {
  const q = PG.pos(G.S.board, p, c);
  let a = 1, s = 1;
  if (p.pop) { const k = Math.min(1, (t - p.pop) / .25); if (k >= 1) return; a = 1 - k; s = 1 + k * .6; }
  cx.globalAlpha = a;
  const col = COL[p.k] || COL.b, base = p.lit ? col[1] : col[0];
  if (p.s === 'c') {
    const R = PG.PR * s;
    if (p.lit) { cx.fillStyle = col[1] + '55'; cx.beginPath(); cx.arc(q.x, q.y, R + 9, 0, 7); cx.fill(); }
    cx.fillStyle = '#0005'; cx.beginPath(); cx.arc(q.x + 2, q.y + 3, R, 0, 7); cx.fill();
    cx.fillStyle = base; cx.beginPath(); cx.arc(q.x, q.y, R, 0, 7); cx.fill();
    cx.fillStyle = '#ffffff99'; cx.beginPath(); cx.arc(q.x - R * .32, q.y - R * .35, R * .38, 0, 7); cx.fill();
    if (p.lit) { cx.strokeStyle = '#fff'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(q.x, q.y, R, 0, 7); cx.stroke(); }
  } else {
    cx.lineCap = 'round';
    const lw = PG.CR * 2 * s;
    if (p.lit) { cx.strokeStyle = col[1] + '55'; cx.lineWidth = lw + 16; cx.beginPath(); cx.moveTo(q.x, q.y); cx.lineTo(q.x2, q.y2); cx.stroke(); }
    cx.strokeStyle = '#0005'; cx.lineWidth = lw; cx.beginPath(); cx.moveTo(q.x + 2, q.y + 3); cx.lineTo(q.x2 + 2, q.y2 + 3); cx.stroke();
    cx.strokeStyle = p.lit ? '#fff' : base; cx.lineWidth = lw; cx.beginPath(); cx.moveTo(q.x, q.y); cx.lineTo(q.x2, q.y2); cx.stroke();
    cx.strokeStyle = base; cx.lineWidth = lw - (p.lit ? 5 : 0); cx.beginPath(); cx.moveTo(q.x, q.y); cx.lineTo(q.x2, q.y2); cx.stroke();
    cx.strokeStyle = '#ffffff88'; cx.lineWidth = lw * .3; cx.beginPath(); cx.moveTo(q.x, q.y - lw * .22); cx.lineTo(q.x2, q.y2 - lw * .22); cx.stroke();
  }
  cx.globalAlpha = 1;
}
function drawBucket(c, bigB) {
  const bx = PG.bucketX(c), w = bigB ? PG.BIG_W : PG.BUCKET_W, y = PG.BUCKET_Y;
  cx.fillStyle = '#0006'; cx.beginPath(); cx.moveTo(bx - w / 2, y); cx.lineTo(bx + w / 2, y); cx.lineTo(bx + w / 2 - 14, H); cx.lineTo(bx - w / 2 + 14, H); cx.fill();
  const gr = cx.createLinearGradient(bx - w / 2, 0, bx + w / 2, 0); gr.addColorStop(0, '#FFB000'); gr.addColorStop(.5, '#FFE27A'); gr.addColorStop(1, '#E08A00');
  cx.fillStyle = gr; cx.beginPath(); cx.moveTo(bx - w / 2, y); cx.lineTo(bx + w / 2, y); cx.lineTo(bx + w / 2 - 14, H + 4); cx.lineTo(bx - w / 2 + 14, H + 4); cx.closePath(); cx.fill();
  cx.strokeStyle = '#8A4F00'; cx.lineWidth = 3; cx.stroke();
  cx.fillStyle = '#5A3200'; cx.beginPath(); cx.ellipse(bx, y + 2, w / 2 - 6, 6, 0, 0, 7); cx.fill();
  for (const rx of [bx - w / 2, bx + w / 2]) { cx.fillStyle = '#FFE27A'; cx.beginPath(); cx.arc(rx, y, PG.RIM, 0, 7); cx.fill(); cx.strokeStyle = '#8A4F00'; cx.lineWidth = 2; cx.stroke(); }
  cx.fillStyle = '#8A4F00'; cx.font = 'bold 15px Fredoka, sans-serif'; cx.textAlign = 'center'; cx.fillText('FRI KULA', bx, y + 24);
}
function drawFever(t) {
  const n = PG.FEVER.length, w = W / n, y = PG.FEVER_Y;
  const cols = ['#3B9DFF', '#34C759', '#FFD23F', '#34C759', '#3B9DFF'];
  for (let i = 0; i < n; i++) {
    cx.fillStyle = cols[i] + (G.V.slotHit === i ? 'ff' : 'bb'); cx.fillRect(i * w + 3, y, w - 6, H - y);
    cx.fillStyle = '#fff'; cx.font = 'bold 22px Fredoka, sans-serif'; cx.textAlign = 'center';
    cx.fillText(fmt(PG.FEVER[i]), i * w + w / 2, y + 30);
  }
  cx.fillStyle = '#fff'; for (let i = 1; i < n; i++) cx.fillRect(i * w - 4, y - 10, 8, H - y + 10);
}
function drawCannon(ang, ch, loaded) {
  const x = PG.CX, y = PG.CY;
  cx.save(); cx.translate(x, y); cx.rotate(ang - Math.PI / 2);
  cx.fillStyle = '#2B2350'; rrect(-16, 0, 32, 66, 9); cx.fill();
  cx.fillStyle = '#6C5FD0'; rrect(-12, 4, 24, 58, 7); cx.fill();
  cx.fillStyle = '#FFD23F'; rrect(-16, 58, 32, 8, 3); cx.fill();
  if (loaded) { cx.fillStyle = '#DDE3F0'; cx.beginPath(); cx.arc(0, PG.MUZZLE + 6, PG.BR, 0, 7); cx.fill(); }
  cx.restore();
  cx.fillStyle = CHARS[ch].c; cx.beginPath(); cx.arc(x, y, 34, 0, 7); cx.fill();
  const im = FACES[ch];
  cx.save(); cx.beginPath(); cx.arc(x, y, 29, 0, 7); cx.clip();
  if (im.complete && im.naturalWidth) cx.drawImage(im, x - 29, y - 29, 58, 58); else { cx.fillStyle = '#fff'; cx.fill(); }
  cx.restore();
  cx.strokeStyle = '#fff'; cx.lineWidth = 3; cx.beginPath(); cx.arc(x, y, 31, 0, 7); cx.stroke();
}
function rrect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function drawBall(x, y, fire) {
  if (fire) { cx.fillStyle = '#FF7A1266'; cx.beginPath(); cx.arc(x, y, PG.BR + 8, 0, 7); cx.fill(); }
  cx.fillStyle = fire ? '#FFB347' : '#E6EAF5'; cx.beginPath(); cx.arc(x, y, PG.BR, 0, 7); cx.fill();
  cx.strokeStyle = fire ? '#C94A00' : '#8C93AD'; cx.lineWidth = 2; cx.stroke();
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(x - 3, y - 3, 3, 0, 7); cx.fill();
}
function draw(t) {
  const S = G.S, V = G.V; if (!S || !V) return;
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#141A3D'; cx.fillRect(0, 0, cv.width, cv.height);
  let sc = SC, ox = OX, oy = OY;
  if (V.zoom) { const z = V.zoom.k; sc = SC * z; ox = OX + SC * (V.zoom.x - V.zoom.x * z) ; oy = OY + SC * (V.zoom.y - V.zoom.y * z); }
  const sh = V.shake > .5 ? (Math.random() - .5) * V.shake : 0;
  cx.setTransform(DPR * sc, 0, 0, DPR * sc, DPR * (ox + sh), DPR * (oy + sh));
  cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); cx.clip();
  cx.drawImage(BG, 0, 0);
  if (V.fever) { cx.globalAlpha = .25 + .1 * Math.sin(t * 6); const gr = cx.createLinearGradient(0, 0, W, H); ['#FF4D6D', '#FFD23F', '#34C759', '#3B9DFF', '#B45CFF'].forEach((c, i) => gr.addColorStop(i / 4, c)); cx.fillStyle = gr; cx.fillRect(0, 0, W, H); cx.globalAlpha = 1; }
  // siktlinje
  if (G.path && myTurn()) {
    cx.fillStyle = '#ffffffcc';
    const P = G.path;
    for (let i = 1; i < P.length; i++) { cx.globalAlpha = Math.max(.25, 1 - i / P.length * .7); cx.beginPath(); cx.arc(P[i][0], P[i][1], 3.2, 0, 7); cx.fill(); }
    cx.globalAlpha = 1;
    const L = P[P.length - 1]; cx.strokeStyle = '#fff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(L[0], L[1], PG.BR, 0, 7); cx.stroke();
  }
  for (const p of V.pegs) drawPeg(p, V.clock, t);
  if (V.fever) drawFever(t); else drawBucket(V.clock, V.big);
  // svans
  for (const tr of V.trail) { cx.globalAlpha = tr.a * .5; cx.fillStyle = tr.f ? '#FF8A1F' : '#BFD4FF'; cx.beginPath(); cx.arc(tr.x, tr.y, PG.BR * tr.a, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
  for (const b of V.balls) drawBall(b[0], b[1], b[2]);
  for (const p of V.parts) { cx.globalAlpha = Math.max(0, 1 - p.life / p.max); cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
  cx.globalAlpha = 1;
  drawCannon(G.busy ? G.shotAngle : G.angle, S.players[G.busy ? G.shotWho : S.turn].ch, !G.busy && !S.over);
  cx.textAlign = 'center';
  for (const tx of V.texts) { cx.globalAlpha = Math.max(0, 1 - tx.life / 1.1); cx.font = `bold ${tx.s || 22}px Fredoka, sans-serif`; cx.lineWidth = 5; cx.strokeStyle = '#2B2350'; cx.strokeText(tx.txt, tx.x, tx.y); cx.fillStyle = tx.c || '#fff'; cx.fillText(tx.txt, tx.x, tx.y); }
  cx.globalAlpha = 1;
  if (V.flash > 0) { cx.fillStyle = `rgba(255,255,255,${V.flash})`; cx.fillRect(0, 0, W, H); }
  cx.restore();
  cx.strokeStyle = '#ffffff55'; cx.lineWidth = 4; cx.strokeRect(0, 0, W, H);
}
function burst(x, y, c, n, sp) { for (let i = 0; i < n; i++) { const a = Math.random() * 7, v = (sp || 160) * (.4 + Math.random()); G.V.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 2 + Math.random() * 3, c, life: 0, max: .5 + Math.random() * .5 }); } }
function floatText(txt, x, y, c, s) { G.V.texts.push({ txt, x, y, c, s, life: 0 }); }

/* idle-loop (sikte, partiklar) */
let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (current !== 'game' || G.busy) { lastT = now; return; }
  const dt = Math.min(.05, (now - lastT) / 1000 || 0); lastT = now;
  tickFx(dt);
  draw(now / 1000);
}
requestAnimationFrame(loop);
function tickFx(dt) {
  const V = G.V; if (!V) return;
  for (const p of V.parts) { p.life += dt; p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  V.parts = V.parts.filter(p => p.life < p.max);
  for (const t of V.texts) { t.life += dt; t.y -= 40 * dt; }
  V.texts = V.texts.filter(t => t.life < 1.1);
  for (const t of V.trail) t.a -= dt * 3;
  V.trail = V.trail.filter(t => t.a > 0);
  V.shake *= .85; V.flash = Math.max(0, V.flash - dt * 2);
}

/* ---------- sikta ---------- */
function toBoard(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left - OX) / SC, (e.clientY - r.top - OY) / SC]; }
function setAngle(a, send) {
  G.angle = Math.max(PG.ANG_MIN, Math.min(PG.ANG_MAX, a));
  calcPath();
  if (send !== false) sendAim();
}
function calcPath() {
  if (!myTurn()) { G.path = null; return; }
  const pl = G.S.players[G.S.turn];
  G.path = PG.aimPath(G.S, G.angle, pl.fx.guide > 0);
}
let aiming = false, downAt = null;
cv.addEventListener('pointerdown', e => {
  if (!myTurn()) return;
  const [x, y] = toBoard(e);
  aiming = true; downAt = [x, y, performance.now()];
  try { cv.setPointerCapture(e.pointerId); } catch (er) { }
  if (y > PG.CY + 10) setAngle(Math.atan2(y - PG.CY, x - PG.CX));
});
cv.addEventListener('pointermove', e => {
  if (!aiming || !myTurn()) return;
  const [x, y] = toBoard(e);
  if (y > PG.CY + 10) setAngle(Math.atan2(y - PG.CY, x - PG.CX));
});
cv.addEventListener('pointerup', e => {
  if (!aiming) return; aiming = false;
  if (!myTurn()) return;
  const [x, y] = toBoard(e);
  if (y > PG.CY + 30 && x > -20 && x < W + 20 && y < H + 20) fire();
});
cv.addEventListener('pointercancel', () => { aiming = false; });
let nudgeT = 0;
function nudge(d) {
  if (!myTurn()) return;
  setAngle(G.angle + d * Math.PI / 180);
  clearInterval(nudgeT); let n = 0;
  nudgeT = setInterval(() => { n++; if (n > 3) setAngle(G.angle + d * (n > 12 ? 1.5 : .5) * Math.PI / 180); }, 70);
}
for (const [id, d] of [['aL', 1], ['aR', -1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); SFX.tap(); nudge(d * .25); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearInterval(nudgeT));
}
$('fire').onclick = () => fire();
$('ff').onclick = () => { G.ff = !G.ff; $('ff').textContent = G.ff ? '⏩ 3×' : '⏩'; SFX.tap(); };
function sendAim() {
  if (G.mode === 'host') { const t = performance.now(); if (t - G.aimSent > 70) { G.aimSent = t; hostAll({ t: 'aim', a: +G.angle.toFixed(4) }); } }
  else if (G.mode === 'client') { const t = performance.now(); if (t - G.aimSent > 70) { G.aimSent = t; clSend({ t: 'aim', a: +G.angle.toFixed(4) }); } }
}

function fire() {
  if (!myTurn()) return;
  const a = G.angle;
  SFX.shoot(); buzz(15);
  if (G.mode === 'client') {
    clSend({ t: 'shoot', a });
    G.busy = true; G.shotAngle = a; G.shotWho = G.S.turn;
    $('fire').disabled = true; $('waitmsg').classList.add('hidden');
    return;
  }
  if (G.mode === 'host') return hostShot(a);
  const r = PG.shoot(G.S, a);
  playShot(r.rec, r.S, r.res);
}

/* ---------- uppspelning ---------- */
function playShot(rec, S2, res) {
  const S0 = G.S, V = G.V;
  G.busy = true; G.playing = true; G.shotAngle = rec.angle; G.shotWho = rec.who;
  $('fire').disabled = true; $('aL').disabled = true; $('aR').disabled = true;
  $('waitmsg').classList.add('hidden');
  $('ff').classList.remove('hidden');
  G.path = null;
  S0.players[rec.who].balls--; updHud();
  const fr = rec.fr, N = fr.length, ev = rec.ev;
  let ei = 0, pos = 0, last = performance.now(), feverF = -1, feverAt = null, slowEnd = -1;
  const fe = ev.find(e => e.e === 'fever'); if (fe) { feverF = fe.f; feverAt = fe; }
  let shotScore = 0, popQ = [], popT = 0, bumpN = 0;
  const pl = S0.players[rec.who];
  return new Promise(resolve => {
    const step = now => {
      let dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now;
      let speed = G.ff ? 3 : 1;
      if (feverF >= 0 && pos > feverF - 25 && pos < feverF + 70 && !G.ff) speed = .3;
      pos = Math.max(0, Math.min(N - 1, pos + dt * 60 * speed));
      const fi = Math.floor(pos);
      // händelser fram till nu
      while (ei < ev.length && ev[ei].f <= fi) { onEvent(ev[ei], pl); if (ev[ei].e === 'hit') shotScore += ev[ei].pts; ei++; }
      const F = fr[fi], F2 = fr[Math.min(N - 1, fi + 1)], k = pos - fi;
      V.clock = F.c + (F2.c - F.c) * k;
      V.big = !!F.bk;
      V.balls = [];
      for (let i = 0; i < F.b.length; i += 3) {
        let x = F.b[i], y = F.b[i + 1];
        if (F2.b.length === F.b.length && Math.abs(F2.b[i] - x) < 60 && Math.abs(F2.b[i + 1] - y) < 60) { x += (F2.b[i] - x) * k; y += (F2.b[i + 1] - y) * k; }
        V.balls.push([x, y, F.b[i + 2]]);
        if (Math.random() < .7) V.trail.push({ x, y, a: 1, f: F.b[i + 2] });
      }
      // zoom vid sista orange
      if (feverAt && pos > feverF - 25 && pos < feverF + 70 && !G.ff) {
        const target = 1.7, kk = Math.min(1, (pos - (feverF - 25)) / 12) * Math.min(1, (feverF + 70 - pos) / 15);
        V.zoom = { x: feverAt.x, y: feverAt.y, k: 1 + (target - 1) * kk };
      } else V.zoom = null;
      tickFx(dt);
      draw(now / 1000);
      if (fi >= N - 1) {
        V.balls = []; V.zoom = null; draw(now / 1000);
        finishShot(rec, S2, res, shotScore).then(resolve);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
function onEvent(e, pl) {
  const V = G.V;
  if (e.e === 'hit') {
    const p = V.byId[e.id]; if (!p) return;
    p.lit = 1;
    const q = PG.pos(G.S.board, p, V.clock), x = p.s === 'k' ? (q.x + q.x2) / 2 : q.x, y = p.s === 'k' ? (q.y + q.y2) / 2 : q.y;
    SFX.peg(e.n); buzz(4);
    burst(x, y, COL[p.k][1], p.k === 'b' ? 5 : 10, 120);
    floatText(fmt(e.pts), x, y - 18, p.k === 'o' ? '#FFD08A' : p.k === 'p' ? '#E3B8FF' : '#fff', p.k === 'p' ? 30 : p.k === 'o' ? 24 : 18);
    if (p.k === 'o') { const S = G.S; S.board.litO++; }
    G.S.players[G.shotWho].score += e.pts; updHud();
  } else if (e.e === 'rm') {
    // poppa pinnarna i tur och ordning
    const ids = e.ids.slice();
    ids.forEach((id, i) => setTimeout(() => { const p = V.byId[id]; if (!p) return; p.pop = performance.now() / 1000; SFX.pop(i); const q = PG.pos(G.S.board, p, V.clock); burst(p.s === 'k' ? (q.x + q.x2) / 2 : q.x, p.s === 'k' ? (q.y + q.y2) / 2 : q.y, '#fff', 4, 90); }, (G.ff ? 12 : 35) * i));
  } else if (e.e === 'free') {
    SFX.free(); buzz(30);
    floatText(e.why === 'bucket' ? 'Fri kula! ⚪' : e.why === 'hug' ? '+2 kulor! 💖' : 'Fri kula för poängen! ⚪', Math.max(150, Math.min(W - 150, e.x)), e.why === 'bucket' ? PG.BUCKET_Y - 30 : e.y - 40, '#FFD23F', 30);
  } else if (e.e === 'lucky') {
    floatText('🎰 ' + POWERS[e.p].name + '!', W / 2, 300, '#FFD23F', 34);
  } else if (e.e === 'pow') {
    const P = POWERS[e.p];
    SFX.power(); buzz(40);
    floatText(P.ic + ' ' + P.name + '!', Math.max(140, Math.min(W - 140, e.x)), e.y - 34, '#A8FFB8', 32);
    burst(e.x, e.y, '#A8FFB8', 24, 260);
    if (e.p === 'zap') { SFX.zap(); V.flash = .5; }
    if (e.p === 'bomb') { SFX.boom(); V.shake = 18; burst(e.x, e.y, '#FFB347', 40, 400); }
    if (e.p === 'spook' || e.p === 'tramp' || e.p === 'guide' || e.p === 'bucket' || e.p === 'double') {
      const p = G.S.players[G.shotWho];
      if (e.p === 'guide') p.fx.guide += 3; if (e.p === 'bucket') p.fx.bucket += 2; if (e.p === 'double') p.fx.double += 2;
    }
  } else if (e.e === 'spook') { SFX.spook(); floatText('👻 Buu!', e.x, 60, '#fff', 30); }
  else if (e.e === 'tramp') { SFX.tramp(); floatText('🤸 Boing!', Math.max(80, Math.min(W - 80, e.x)), H - 50, '#fff', 30); }
  else if (e.e === 'fever') {
    V.fever = true; V.flash = .9; SFX.ode(); buzz(80);
    big('SUPERFEST! 🎉', 2600, '<small>Sista orange pinnen!</small>');
    confetti();
  } else if (e.e === 'slot') {
    V.slotHit = e.k; SFX.slot(); V.shake = 10;
    floatText('+' + fmt(e.pts), (e.k + .5) * W / PG.FEVER.length, PG.FEVER_Y - 30, '#FFD23F', 40);
  }
}
function updOrangeChip() {
  const b = G.S.board, left = b.nO - b.litO, m = PG.multOf(b.litO, b.nO);
  const ch = $('info').children;
  if (ch[0]) ch[0].textContent = `🟠 ${left} kvar`;
  if (ch[1]) { ch[1].textContent = `×${m} poäng`; ch[1].classList.toggle('x10', m === 10); }
}
async function finishShot(rec, S2, res, shotScore) {
  const pl = S2.players[rec.who];
  const gained = res ? res.pts : null;
  await wait(G.ff ? 250 : 650);
  if (gained != null) { if (gained > 0) floatText('+' + fmt(gained), W / 2, 200, '#FFD23F', 40); }
  if (res && res.ballBonus) { floatText('Kulor kvar: +' + fmt(res.ballBonus), W / 2, 260, '#A8FFB8', 30); }
  G.S = S2;
  const stillFever = G.V.fever;
  buildView(S2);
  G.V.fever = stillFever && S2.over;
  G.busy = false; G.playing = false;
  $('ff').classList.add('hidden');
  updHud();
  if (G.queued) { const q = G.queued; G.queued = null; G.S = q; buildView(q); updHud(); }
  if (G.S.over) { await wait(900); return endGame(); }
  if (G.pending && G.mode === 'host') { const p = G.pending; G.pending = null; if (G.S.players[G.S.turn].id === p.id) { hostShot(p.a); return; } }
  if (G.mode === 'host') hostAll({ t: 'turn', turn: G.S.turn });
  turnStart();
}

/* ---------- slut ---------- */
async function endGame() {
  const S = G.S;
  const ranked = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.score - a.score);
  const rankHTML = `<div class="rank">${ranked.map((p, k) => `<div class="r ${k === 0 && S.players.length > 1 ? 'w' : ''}">${k === 0 && S.players.length > 1 ? '👑' : (k + 1) + '.'} ${avHTML(p.ch)}<span>${esc(p.name)}</span><b>${fmt(p.score)}</b></div>`).join('')}</div>`;
  if (G.mode === 'solo') {
    const lv = S.lv, sc = S.players[0].score;
    if (S.won) {
      const rec = !best[lv] || sc > best[lv];
      if (rec) best[lv] = sc; cleared[lv] = 1; store.set('best', best); store.set('cleared', cleared);
      await celebrate(S.players[0].ch, 'Banan klar!', `${LEVELS[lv].ic} ${LEVELS[lv].name} – ${fmt(sc)} poäng${rec ? ' – nytt rekord!' : ''}`, ['🟠', '⭐', '🎉', '⚪', '✨', '🎯']);
      const next = lv + 1 < LEVELS.length;
      panel(`<h3>Banan klar! ⭐</h3><div class="score-big">${fmt(sc)}</div><p>${rec ? '🏆 Nytt rekord!' : 'Rekord: ' + fmt(best[lv])}</p>
        ${next ? `<button class="btn green" id="pNext">➡️ Nästa bana: ${LEVELS[lv + 1].name}</button>` : '<p>Du har klarat alla banor! 🏆</p>'}
        <button class="btn blue small" id="pAgain">🔄 Spela igen</button><button class="btn white small" id="pMenu">📋 Banor</button>`);
      if (next) $('pNext').onclick = () => { SFX.tap(); startLocal(lv + 1, S.players.map(p => ({ id: p.id, name: p.name, ch: p.ch }))); };
    } else {
      SFX.sad();
      if (!best[lv] || sc > best[lv]) { best[lv] = sc; store.set('best', best); }
      panel(`<h3>Slut på kulor 😕</h3><p>${S.board.nO - S.board.litO} orange pinnar kvar. Du fick ${fmt(sc)} poäng.</p>
        <button class="btn green" id="pAgain">🔄 Försök igen</button><button class="btn white small" id="pMenu">📋 Banor</button>`);
    }
    $('pAgain').onclick = () => { SFX.tap(); startLocal(lv, S.players.map(p => ({ id: p.id, name: p.name, ch: p.ch }))); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); showLevels('solo'); };
    return;
  }
  const w = S.players[S.winner || 0];
  await celebrate(w.ch, `${w.name} vann!`, `${fmt(w.score)} poäng${S.won ? ' – alla orange pinnar borta!' : ''}`, ['🟠', '⭐', '🎉', '⚪', '✨', '🏆']);
  if (G.mode === 'local') {
    panel(`<h3>Resultat 🏆</h3>${rankHTML}<button class="btn green" id="pAgain">🔄 Spela igen</button><button class="btn blue small" id="pLv">📋 Annan bana</button><button class="btn white small" id="pMenu">🏠 Meny</button>`);
    const pls = S.players.map(p => ({ id: p.id, name: p.name, ch: p.ch }));
    $('pAgain').onclick = () => { SFX.tap(); startLocal(S.lv, pls); };
    $('pLv').onclick = () => { SFX.tap(); closePanel(); showLevels('local', pls); };
    $('pMenu').onclick = () => { SFX.tap(); closePanel(); show('menu'); };
  } else {
    panel(`<h3>Resultat 🏆</h3>${rankHTML}<button class="btn green" id="pLobby">👍 Till lobbyn</button>`);
    $('pLobby').onclick = () => { SFX.tap(); closePanel(); if (G.mode === 'host') { HOST.inGame = false; hostLobby(); } show('lobby'); };
  }
}

$('gBack').onclick = () => {
  SFX.tap();
  const net = G.mode === 'host' || G.mode === 'client';
  panel(`<h3>${net ? (G.mode === 'host' ? 'Avsluta matchen för alla?' : 'Lämna matchen?') : 'Avsluta banan?'}</h3><button class="btn pink" id="pYes">🚪 ${net ? 'Ja' : 'Avsluta'}</button><button class="btn white small" id="pNo">Fortsätt spela</button>`);
  $('pYes').onclick = () => {
    SFX.tap(); closePanel();
    if (G.mode === 'host') { G.S = null; HOST.inGame = false; hostAll({ t: 'abort' }); hostLobby(); show('lobby'); }
    else if (G.mode === 'client') leave();
    else if (G.mode === 'solo') showLevels('solo');
    else show('menu');
  };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); };
};

/* ================= NÄTVERK ================= */
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = netJoinCardHTML('card') + `
    ${app ? `<div class="card"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div><button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="card"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' : 'Matchen startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen här.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div></div>
    <p class="note" style="text-align:center;color:#fff">Alla måste vara på samma wifi. Du spelar som ${esc(charName(ME.ch))}.</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, ''), port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port, 'studs.html');
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
function startOnline() { location.href = netOnlineHostURL('studs.html', `n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`); }
function startHosting() {
  let r = null;
  try { r = JSON.parse(Android.netHost('studs:' + charName(ME.ch) + 's match')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/studs.html?host=1&n=${encodeURIComponent(charName(ME.ch))}&c=${ME.ch}`;
}
function leave() {
  if (G.mode === 'host') {
    try { HOST.ws && HOST.ws.close(); } catch (e) { } HOST.ws = null;
    try { Android.netStop(); } catch (e) { }
    location.href = NET_ONLINE ? 'studs.html' : APP_HOME + 'studs.html'; return;
  }
  if (CLIENT) {
    CL.closing = true; try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (NET_ONLINE) location.href = 'studs.html';
    else if (window.Android) location.href = APP_HOME + 'studs.html';
    else { G.mode = 'solo'; show('menu'); }
    return;
  }
  show('menu');
}

/* ----- värd ----- */
const HOST = { ws: null, lobby: [], ok: false, inGame: false, lv: store.get('netLv', 0) };
function hostStart() {
  G.mode = 'host'; G.myId = 'h';
  HOST.lobby = [{ id: 'h', name: myName(), ch: ME.ch }];
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
  if (d[0] === '-') { const id = 'c' + d.slice(1); HOST.lobby = HOST.lobby.filter(p => p.id !== id); playerLeft(id); return hostLobby(); }
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'hi') {
    const p = { id, name: String(m.name || 'Spelare').slice(0, 14), ch: Math.abs(m.ch | 0) % CHARS.length };
    const old = HOST.lobby.find(q => q.id === id);
    if (old) Object.assign(old, p); else { HOST.lobby.push(p); SFX.pick(); buzz(15); }
    hostTo(id, { t: 'welcome', id });
    hostLobby();
    if (HOST.inGame && G.S) hostTo(id, { t: 'start', S: G.S, watch: true });
  } else if (m.t === 'aim') {
    if (G.S && !G.busy && G.S.players[G.S.turn].id === id && typeof m.a === 'number') { G.angle = m.a; hostAll({ t: 'aim', a: m.a }); }
  } else if (m.t === 'shoot') {
    if (!G.S || G.S.over || typeof m.a !== 'number') return;
    if (G.S.players[G.S.turn].id !== id) return;
    if (G.busy) { G.pending = { id, a: m.a }; return; }
    hostShot(m.a);
  }
}
function hostShot(a) {
  const r = PG.shoot(G.S, a);
  hostAll({ t: 'shot', rec: r.rec, S: r.S, res: r.res });
  playShot(r.rec, r.S, r.res);
}
function playerLeft(id) {
  if (!HOST.inGame || !G.S || G.S.over) return;
  const S = G.S, i = S.players.findIndex(p => p.id === id); if (i < 0) return;
  S.players[i].balls = 0; S.players[i].left = 1;
  if (S.players.every(p => p.balls <= 0 || p.left) && S.players.filter(p => !p.left).length <= 1 && !G.busy) {
    // bara värden kvar: avsluta
    S.over = true; let bi = 0; S.players.forEach((p, k) => { if (p.score > S.players[bi].score) bi = k; }); S.winner = bi;
    hostAll({ t: 'state', S }); endGame(); return;
  }
  if (S.turn === i && !G.busy) {
    let n = i, guard = 0; do { n = (n + 1) % S.players.length; } while (S.players[n].balls <= 0 && ++guard < 20);
    if (S.players[n].balls <= 0) { S.over = true; let bi = 0; S.players.forEach((p, k) => { if (p.score > S.players[bi].score) bi = k; }); S.winner = bi; hostAll({ t: 'state', S }); endGame(); return; }
    S.turn = n;
  }
  hostAll({ t: 'state', S });
  if (!G.busy) { updHud(); turnStart(); }
}
function lobbyMsg() { return { t: 'lobby', players: HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch })), inGame: HOST.inGame, host: myName(), lv: HOST.lv }; }
function hostLobby() { hostAll(lobbyMsg()); if (current === 'lobby') buildLobby(); }
function hostBegin() {
  if (HOST.lobby.length < 2) { panel(`<h3>Minst två spelare</h3><p>Vänta tills någon har gått med.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  HOST.inGame = true;
  const S = PG.newGame(HOST.lv, HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch })), (Math.random() * 1e9) | 0);
  hostAll({ t: 'start', S });
  hostLobby();
  beginGame(S);
}

/* ----- klient ----- */
const CL = { ws: null, id: null, lobby: null, closing: false, tries: 0 };
function clientStart() {
  G.mode = 'client';
  pickFigure('Vem spelar?', clientConnect, leave);
}
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
    panel(`<h3>Tappade kontakten 📡</h3><p>Är värden kvar och på samma wifi?</p><button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white small" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); CL.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); leave(); };
  };
}
const clSend = o => { if (CL.ws && CL.ws.readyState === 1) CL.ws.send(JSON.stringify(o)); };
function clientRecv(m) {
  if (m.t === 'welcome') { CL.id = m.id; G.myId = m.id; }
  else if (m.t === 'lobby') { CL.lobby = m; if (current === 'lobby') buildLobby(); }
  else if (m.t === 'start') { G.myId = CL.id; beginGame(m.S); if (m.watch) $('waitmsg').textContent = 'Du tittar på – nästa match är du med! 👀'; }
  else if (m.t === 'aim') { if (G.S && !myTurn() && !G.busy) G.angle = m.a; }
  else if (m.t === 'shot') {
    if (!G.S) return;
    if (G.playing) { G.queuedShot = m; return; }
    G.busy = false; playShot(m.rec, m.S, m.res).then(() => { if (G.queuedShot) { const q = G.queuedShot; G.queuedShot = null; playShot(q.rec, q.S, q.res); } });
  }
  else if (m.t === 'state') { if (G.playing) G.queued = m.S; else { G.S = m.S; buildView(m.S); updHud(); if (m.S.over) endGame(); else turnStart(); } }
  else if (m.t === 'turn') { }
  else if (m.t === 'abort') { closePanel(); G.S = null; show('lobby'); big('Matchen avbröts', 1500); }
  else if (m.t === 'hostgone') { CL.closing = true; panel(`<h3>Matchen är slut 👋</h3><p>Värden avslutade.</p><button class="btn green" id="pLeave">OK</button>`); $('pLeave').onclick = () => { SFX.tap(); leave(); }; }
}

function buildLobby() {
  if (current !== 'lobby') return;
  const isHost = G.mode === 'host';
  const L = isHost ? lobbyMsg() : (CL.lobby || { players: [], inGame: false, lv: 0 });
  const myId = isHost ? 'h' : CL.id;
  const pls = L.players.map(p => { const pw = powOf(p.ch); return `<div class="pl ${p.id === myId ? 'mine' : ''}" style="${styleOf(p.ch)}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' 👑' : ''}</span><span class="pw" style="flex:none">${pw.ic} ${pw.name}</span></div>`; }).join('');
  let side = '';
  if (isHost) {
    let ips = []; try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/studs.html` : '';
    let qr = ''; if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="card"><h4>📲 Bjud in familjen</h4>${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, ''))}</div></div></div>
      <p class="note">Android med appen: Studs → 🔗 Gå med.</p>` : `<p class="note">⚠️ Hittar inget wifi. Anslut till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}</div>`;
  }
  const lv = LEVELS[L.lv || 0];
  if (isHost && NET_ONLINE) side = netHostCardHTML('studs.html', 'card', HOST.ok);
  $('lobbyBox').innerHTML = `<div class="gar"><div class="card"><h4>🎯 Spelare (${L.players.length})</h4><div class="plist">${pls || '<p class="note">Ingen här än…</p>'}</div>
      <h4>Bana</h4>
      ${isHost ? `<div class="lvpick"><button class="ibtn" id="lvP">◀</button><b>${lv.ic} ${lv.name}</b><button class="ibtn" id="lvN">▶</button></div>` : `<div class="lvpick"><b>${lv.ic} ${lv.name}</b></div>`}
      ${isHost ? `<button class="btn green" id="gStart" ${HOST.ok && !L.inGame ? '' : 'disabled'}>🎯 Starta matchen!</button>` : `<p class="wait" style="text-align:center;font-weight:600">${L.inGame ? 'Matchen pågår… 🎯' : `Väntar på att ${esc(L.host || 'värden')} startar ⏳`}</p>`}
      <p class="note">Ni skjuter i tur och ordning på samma bana. Flest poäng när alla orange pinnar är borta – eller kulorna är slut – vinner!</p></div>
    <div style="display:flex;flex-direction:column;gap:12px">${side}</div></div>`;
  if ($('gStart')) $('gStart').onclick = () => { SFX.tap(); hostBegin(); };
  if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildLobby(); };
  if ($('lvP')) { const ch = d => { HOST.lv = (HOST.lv + d + LEVELS.length) % LEVELS.length; store.set('netLv', HOST.lv); SFX.tap(); hostLobby(); }; $('lvP').onclick = () => ch(-1); $('lvN').onclick = () => ch(1); }
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
    <p style="text-align:left;font-size:16px">👆 Dra på skärmen för att sikta – släpp för att skjuta (eller använd ◀ ▶ och 🎯 Skjut).<br>
    🟠 Träffa <b>alla orange pinnar</b> innan kulorna tar slut.<br>
    🟢 Gröna pinnar ger din figurs superkraft.<br>🟣 Lila pinnen ger 500 poäng – den flyttar sig varje skott.<br>
    🪣 Landar kulan i hinken får du en kula till.<br>✨ Ju färre orange kvar, desto fler poäng per pinne!</p>
    <div class="pows">${CHARS.map((_, i) => { const p = powOf(i); return `<div><b>${esc(charName(i))}</b>: ${p.ic} ${p.desc}</div>`; }).join('')}</div>
    <button class="btn green" id="pClose">👍 Okej!</button>`);
  $('pClose').onclick = () => { SFX.tap(); closePanel(); };
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('meCard').onclick = () => { SFX.tap(); pickFigure('Vem spelar?', () => show('menu')); };
$('toSolo').onclick = () => { SFX.tap(); showLevels('solo'); };
$('toLocal').onclick = () => { SFX.tap(); locPick = locPick.length ? locPick : [ME.ch]; buildLocal(); show('local'); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toOnline').onclick = () => { SFX.tap(); startOnline(); };
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
  if (current === 'levels') { $('lvBack').click(); return true; }
  if (current === 'meScr') { $('meBack').click(); return true; }
  if (current === 'menu') { if (REMOTE) { if (window.Android) location.href = APP_HOME + 'index.html'; else leave(); } else goHub(); return true; }
  show('menu'); return true;
};

bubbles();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu');
