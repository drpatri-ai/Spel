/* Bucinca Fotboll – meny, lobby, nätverk, kontroller och ritning.
   Tre sätt att spela:
    - mot datorn: allt körs här (SIM.Match)
    - värd: Android-appen startar en liten server (LanServer.kt) och laddar sidan från http://127.0.0.1:8765.
      Matchen räknas här och skickas till de andra ~30 ggr/s.
    - gå med: sidan laddas från värdens telefon (http://<ip>:8765) och skickar bara spaken/knapparna. */
'use strict';
const store = makeStore('bf');
const Q = new URLSearchParams(location.search);
const PORT = 8765;
const REMOTE = location.protocol === 'http:' && location.port === String(PORT);   // sidan kommer från en värd
const HOSTPAGE = REMOTE && Q.get('host') === '1';
const CLIENT = REMOTE && !HOSTPAGE;
const APP_HOME = 'https://appassets.androidplatform.net/assets/';
const canHost = () => !!(window.Android && Android.netHost);
const F = SIM.F;
const TEAM = [{ name: 'Röda', c: '#FF4D6D', d: '#C9304D', e: '🔴' }, { name: 'Blå', c: '#3B9DFF', d: '#2373C9', e: '🔵' }];
const LVN = ['Lätt', 'Medel', 'Svår'];

const SFX = Object.assign({}, CORE_SFX, {
  kick: () => { noise(.07, { f: 700, vol: .3, q: .7 }); tone(150, .09, { to: 80, vol: .28 }); },
  pass: () => { noise(.05, { f: 1300, vol: .16 }); tone(210, .06, { to: 140, vol: .14 }); },
  wall: () => tone(110, .06, { vol: .07, type: 'square', to: 80 }),
  post: () => [988, 1480].forEach((f, i) => tone(f, .35, { vol: .09, delay: i * .015, type: 'triangle' })),
  whistle: (n = 1, long) => { for (let i = 0; i < n; i++) { const d = long && i === n - 1 ? .6 : .2; tone(2700, d, { vol: .06, delay: i * .28, type: 'square' }); tone(3050, d, { vol: .04, delay: i * .28 + .01 }); } },
  goal: () => { noise(1.8, { type: 'lowpass', f: 700, vol: .4 }); noise(1.2, { f: 2400, vol: .08, delay: .2 }); CORE_SFX.win(); },
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, .28, { vol: .12, delay: i * .18 }))
});

/* ---------- jag (namn och figur) ---------- */
const ME = { ch: store.get('ch', 0), name: store.get('name', '') };
if (Q.get('c') != null && !isNaN(+Q.get('c'))) ME.ch = +Q.get('c');
if (Q.get('n')) ME.name = Q.get('n');
if (!(ME.ch >= 0 && ME.ch < 4)) ME.ch = 0;
const myName = () => (ME.name.trim() || charName(ME.ch)).slice(0, 14);
const saveMe = () => { store.set('ch', ME.ch); store.set('name', ME.name); };
if (REMOTE) saveMe();

const FACES = CHARS.map((_, i) => { const im = new Image(); im.src = avatarSrc(i); return im; });

/* ---------- skärmar ---------- */
let current = 'menu';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'menu') buildMenu();
  if (id === 'meScr') buildMe();
  if (id === 'setup') buildSetup();
  if (id === 'join') buildJoin();
  if (id === 'lobby') buildLobby();
  if (id === 'game') { resize(); }
  if (window.Android && Android.keepAwake) try { Android.keepAwake(id === 'game' || id === 'lobby'); } catch (e) { }
}
function logo() {
  let k = 0;
  const ln = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  return ln('Bucinca', 'l1') + ln('Fotboll ⚽', 'l2');
}
function buildMenu() {
  $('logo').innerHTML = logo();
  $('meCard').setAttribute('style', styleOf(ME.ch));
  $('meCard').innerHTML = `${avHTML(ME.ch)}<div style="text-align:left"><small>Du spelar som</small><b>${esc(myName())}</b> ✏️</div>`;
  $('toHost').classList.toggle('hidden', !canHost());
  const w = store.get('wins', [0, 0, 0]);
  const tot = w.reduce((a, b) => a + b, 0);
  $('wins').textContent = tot ? `🏆 ${tot} vinster mot datorn` : 'Spela mot datorn eller mot familjen i samma wifi!';
}

let meDone = null;
function buildMe() {
  $('chars').innerHTML = CHARS.map((_, i) => `<button class="char ${i === ME.ch ? 'chosen' : ''}" data-i="${i}" style="${styleOf(i)}">${avHTML(i)}<b>${esc(charName(i))}</b></button>`).join('');
  $('chars').querySelectorAll('.char').forEach(el => el.onclick = () => {
    const was = charName(ME.ch);
    ME.ch = +el.dataset.i; SFX.pick(); buzz(12);
    if (!$('nameIn').value.trim() || $('nameIn').value.trim() === was) $('nameIn').value = charName(ME.ch);
    $('chars').querySelectorAll('.char').forEach(c => c.classList.toggle('chosen', c === el));
    el.classList.add('pick');
  });
  $('nameIn').value = myName();
  $('meOk').innerHTML = CLIENT ? '⚽ Gå med i matchen' : '✅ Klar';
  $('meBack').classList.toggle('hidden', CLIENT && !Q.get('back') && !window.Android);
}
$('meOk').onclick = () => {
  ME.name = $('nameIn').value.trim().slice(0, 14);
  saveMe(); SFX.tap();
  if (meDone) { const f = meDone; meDone = null; f(); } else show('menu');
};
$('meBack').onclick = () => { SFX.tap(); if (CLIENT) leave(); else show('menu'); };
$('meCard').onclick = () => { SFX.tap(); show('meScr'); };

/* ---------- inställningar (segmentknappar) ---------- */
function segHTML(key, opts, val) {
  return `<div class="seg" data-k="${key}">` + opts.map(([v, l]) => `<button data-v="${v}" class="${v === val ? 'on' : ''}">${l}</button>`).join('') + '</div>';
}
function bindSegs(root, obj, after) {
  root.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button').forEach(b => b.onclick = () => {
    obj[seg.dataset.k] = +b.dataset.v; SFX.tap(); buzz(8);
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    after && after();
  }));
}
const SIZES = [[1, '1 mot 1'], [2, '2 mot 2'], [3, '3 mot 3'], [4, '4 mot 4']];
const MINS = [[2, '2 min'], [3, '3 min'], [5, '5 min']];
const LEVELS = [[0, '😊 Lätt'], [1, '😎 Medel'], [2, '🔥 Svår']];
const setup = Object.assign({ size: 3, lvl: 1, min: 3 }, store.get('setup', {}));
function buildSetup() {
  $('setupBox').innerHTML = `
    <div class="opt"><h4>👥 Lagstorlek</h4>${segHTML('size', SIZES, setup.size)}</div>
    <div class="opt"><h4>🤖 Datorns nivå</h4>${segHTML('lvl', LEVELS, setup.lvl)}</div>
    <div class="opt"><h4>⏱️ Matchtid</h4>${segHTML('min', MINS, setup.min)}</div>
    <p class="note" style="text-align:center">Du spelar i ${TEAM[0].e} röda laget. Dra spaken till vänster för att springa, tryck SKJUT nära bollen.</p>
    <button class="btn green" id="goLocal" style="align-self:center">⚽ Avspark!</button>`;
  bindSegs($('setupBox'), setup, () => store.set('setup', setup));
  $('goLocal').onclick = () => { SFX.tap(); startLocal(); };
}

/* ---------- gå med ---------- */
let scanning = false;
function buildJoin() {
  const app = !!window.Android;
  $('joinBox').innerHTML = `
    ${app ? `<div class="opt"><h4>📡 Matcher i wifi:t</h4><div class="found" id="found"></div>
      <button class="btn white small" id="rescan">🔄 Sök igen</button></div>` : ''}
    <div class="opt"><h4>🔢 Skriv in adressen</h4>
      <p class="note">${app ? 'Hittas inte matchen? Skriv adressen som står på värdens skärm.' :
      'Matchen startas i Android-appen (📡 Starta nätverksmatch). Skanna QR-koden på värdens skärm med kameran, eller skriv adressen som står där.'}</p>
      <div class="ipbox"><input id="ipIn" type="text" inputmode="decimal" placeholder="t.ex. 192.168.1.23" value="${esc(store.get('lastIp', ''))}"><button class="btn green small" id="ipGo">Anslut</button></div>
    </div>
    <p class="note" style="text-align:center">Alla måste vara uppkopplade på samma wifi.</p>`;
  $('ipGo').onclick = () => {
    let v = $('ipIn').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!v) return;
    let port = PORT;
    if (v.includes(':')) { port = +v.split(':')[1] || PORT; v = v.split(':')[0]; }
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(v)) { $('ipIn').style.borderColor = '#FF4D6D'; SFX.bonk(); return; }
    store.set('lastIp', v); goJoin(v, port);
  };
  if (app) { $('rescan').onclick = () => { SFX.tap(); scan(); }; scan(); }
}
function scan() {
  if (!window.Android || !Android.netScan || scanning) return;
  scanning = true;
  $('found').innerHTML = `<p class="note"><span class="spin">⚽</span> Letar efter matcher…</p>`;
  window.onNetScan = list => {
    scanning = false;
    if (current !== 'join' || !$('found')) return;
    $('found').innerHTML = list.length ? list.map(m => `<button class="btn blue" data-ip="${esc(m.ip)}" data-port="${m.port}">⚽ ${esc(m.name)}</button>`).join('')
      : `<p class="note">Hittade ingen match. Be värden trycka 📡 Starta nätverksmatch – och kolla att ni är på samma wifi.</p>`;
    $('found').querySelectorAll('[data-ip]').forEach(b => b.onclick = () => { SFX.tap(); goJoin(b.dataset.ip, +b.dataset.port); });
  };
  try { Android.netScan(); } catch (e) { scanning = false; }
}
function goJoin(ip, port) {
  const back = location.href.split('?')[0];
  location.href = `http://${ip}:${port || PORT}/boll.html?n=${encodeURIComponent(myName())}&c=${ME.ch}&back=${encodeURIComponent(back)}`;
}
function startHosting() {
  let r = null;
  try { r = JSON.parse(Android.netHost(myName() + 's match')); } catch (e) { }
  if (!r || !r.ok) { panel(`<h3>Gick inte 😕</h3><p>Kunde inte starta matchen. Prova att stänga appen och öppna igen.</p><button class="btn" id="pOk">OK</button>`); $('pOk').onclick = closePanel; return; }
  location.href = `http://127.0.0.1:${r.port}/boll.html?host=1&n=${encodeURIComponent(myName())}&c=${ME.ch}`;
}

/* ---------- paneler ---------- */
function panel(html) { $('panel').innerHTML = html; $('overlay').classList.add('on'); }
function closePanel() { $('overlay').classList.remove('on'); }

/* ================= MATCHEN ================= */
/* mode: 'local' | 'host' | 'client' */
const G = { mode: null, sim: null, myId: null, timer: null, paused: false, roster: [], snaps: [], rt: 0, kSeq: 0, pSeq: 0, ix: 0, iy: 0,
  cam: { x: 0, y: 0 }, view: null, banner: 0, lastPh: '', over: false };

function startLocal() {
  const n = setup.size, lvl = setup.lvl;
  const pl = [{ id: 'me', name: myName(), ch: ME.ch, team: 0, bot: -1 }];
  const used = [ME.ch];
  for (let t = 0; t < 2; t++) for (let i = (t === 0 ? 1 : 0); i < n; i++) pl.push(botPlayer('b' + t + i, t, lvl, used));
  G.mode = 'local'; G.myId = 'me';
  runSim(pl, setup.min);
}
let botNo = 0;
function botPlayer(id, team, lvl, used) {
  let ch = Math.floor(Math.random() * 4);
  if (used) { const free = [0, 1, 2, 3].filter(c => !used.includes(c)); if (free.length) ch = pick(free); used.push(ch); }
  return { id: id || 'b' + (++botNo), name: '🤖 ' + charName(ch), ch, team, bot: lvl };
}
function runSim(players, minutes) {
  const m = new SIM.Match(players, { minutes });
  G.sim = m; G.over = false; G.paused = false; G.kSeq = G.pSeq = 0;
  m.onGoal = g => onGoal(goalInfo(g));
  m.onEnd = res => {
    const r = Object.assign({ t: 'end' }, res);
    if (G.mode === 'host') hostAll(r);
    setTimeout(() => onEnd(r), 900);
  };
  G.roster = m.players;
  G.lastPh = '';
  show('game');
  SFX.whistle(1);
  clearInterval(G.timer);
  let last = performance.now(), acc = 0, n = 0;
  const STEP = 1000 / 60;
  G.timer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(200, now - last); last = now;
    if (G.paused) { acc = 0; return; }
    while (acc >= STEP) {
      acc -= STEP;
      if (G.myId && m.byId(G.myId)) m.input(G.myId, G.ix, G.iy, G.kSeq, G.pSeq);
      m.step(); n++;
      if (n % 2 === 0) {
        const s = m.snap();
        if (G.mode === 'host') hostAll(s);
        events(s.ev);
      }
    }
  }, 5);
}
function goalInfo(g) {
  const m = G.sim, by = g.by ? m.byId(g.by) : null, as = g.assist ? m.byId(g.assist) : null;
  return { t: 'goal', team: g.team, own: g.own, by: by ? by.name : null, ch: by ? by.ch : null, byId: g.by, assist: as ? as.name : null, sc: m.score.slice() };
}
function stopSim() { clearInterval(G.timer); G.timer = null; G.sim = null; }

/* ---------- ljud från händelser ---------- */
function events(ev) {
  if (!ev) return;
  for (const e of ev) {
    if (e === 'k') SFX.kick();
    else if (e === 'p') SFX.pass();
    else if (e === 'w') SFX.wall();
    else if (e === 'post') { SFX.post(); buzz(15); }
    else if (e === 'golden') { SFX.whistle(2); flash('Förlängning! ⚡', 'Nästa mål vinner', 2600); }
    else if (e === 'end') SFX.whistle(3, true);
  }
}
function flash(title, sub, ms, avCh) {
  const b = $('banner');
  b.innerHTML = (avCh != null ? avHTML(avCh) : '') + `<div>${esc(title)}</div>` + (sub ? `<small>${esc(sub)}</small>` : '');
  b.classList.remove('hidden', 'pop'); void b.offsetWidth; b.classList.add('pop');
  clearTimeout(G.banner);
  G.banner = setTimeout(() => b.classList.add('hidden'), ms || 2000);
}
function myTeam() {
  const p = (G.roster || []).find(p => p.id === G.myId);
  return p ? p.team : 0;
}
function onGoal(g) {
  if (G.mode === 'host') hostAll(g);
  const mine = g.team === myTeam();
  if (mine) { SFX.goal(); buzz(60); } else { SFX.sad(); buzz(25); }
  let sub = g.by ? (g.own ? `Självmål av ${g.by} 🙈` : g.by + (g.assist ? ` (pass: ${g.assist})` : '')) : '';
  flash(g.own ? 'Självmål!' : 'MÅÅÅL!', `${TEAM[g.team].e} ${sub}`, 2300, g.own ? null : g.ch);
}

/* ---------- slut på matchen ---------- */
async function onEnd(r) {
  if (G.over) return;
  G.over = true;
  const mt = myTeam(), w = r.winner;
  const won = w === mt;
  if (G.mode === 'local' && won) { const ws = store.get('wins', [0, 0, 0]); ws[setup.lvl]++; store.set('wins', ws); }
  if (w >= 0 && r.mvp) {
    const title = G.mode === 'local' ? (won ? 'Du vann!' : 'Datorn vann!') : `${TEAM[w].name} vann!`;
    const mvpTxt = r.mvp.goals ? `${r.mvp.name}: ${r.mvp.goals} mål ⚽` : `${r.score[0]} – ${r.score[1]}`;
    if (won || G.mode !== 'local') await celebrate(r.mvp.ch, title, mvpTxt, ['⚽', '🏆', '🎉', '⭐', '⚽', '🥅', '✨', '🎊']);
    else SFX.sad();
  }
  const rows = r.stats.filter(s => s.goals || s.own || s.assists || s.bot < 0)
    .sort((a, b) => (b.goals - a.goals) || (b.assists - a.assists) || (a.team - b.team))
    .map(s => `<div class="r" style="background:color-mix(in srgb,${TEAM[s.team].c} 14%,#fff)">${avHTML(s.ch)}<span>${esc(s.name)}${s.id === G.myId ? ' (du)' : ''}</span>
      <b>${s.goals ? '⚽'.repeat(Math.min(s.goals, 5)) + (s.goals > 5 ? '×' + s.goals : '') : ''}${s.assists ? ' 👟' + s.assists : ''}${s.own ? ' 🙈' + s.own : ''}</b></div>`).join('');
  const head = w < 0 ? 'Oavgjort!' : (G.mode === 'local' ? (won ? 'Du vann! 🏆' : 'Datorn vann 😅') : `${TEAM[w].e} ${TEAM[w].name} vann!`);
  const btns = G.mode === 'client' ? `<p class="wait">Väntar på värden… ⏳</p><button class="btn white small" id="eLeave">🚪 Lämna</button>`
    : G.mode === 'host' ? `<button class="btn green" id="eAgain">🔁 Till laguppställningen</button><button class="btn white small" id="eLeave">🚪 Avsluta</button>`
    : `<button class="btn green" id="eAgain">🔁 Spela igen</button><button class="btn white small" id="eLeave">🏠 Meny</button>`;
  panel(`<h3>${head}</h3><div class="score-big"><span style="color:${TEAM[0].c}">${r.score[0]}</span>–<span style="color:${TEAM[1].c}">${r.score[1]}</span></div>
    ${r.golden ? '<p>Avgjort i förlängningen ⚡</p>' : ''}<div class="res">${rows}</div>${btns}`);
  $('eLeave').onclick = () => { SFX.tap(); closePanel(); if (G.mode === 'local') { stopSim(); show('menu'); } else leave(); };
  if ($('eAgain')) $('eAgain').onclick = () => {
    SFX.tap(); closePanel();
    if (G.mode === 'local') { stopSim(); startLocal(); } else { stopSim(); HOST.inGame = false; hostLobbyBroadcast(); show('lobby'); }
  };
}

/* ================= VÄRD ================= */
const HOST = { ws: null, lobby: [], set: Object.assign({ min: 3, fill: 0, lvl: 1 }, store.get('hostset', {})), inGame: false, ok: false };
function hostStart() {
  G.mode = 'host'; G.myId = 'h';
  HOST.lobby = [{ id: 'h', name: myName(), ch: ME.ch, team: 0 }];
  hostConnect();
  show('lobby');
}
function hostConnect() {
  const ws = new WebSocket(`ws://${location.host}/ws?host=1`);
  HOST.ws = ws;
  ws.onopen = () => { HOST.ok = true; buildLobby(); };
  ws.onmessage = e => hostRecv(e.data);
  ws.onclose = () => {
    HOST.ok = false;
    if (HOST.ws === ws) setTimeout(() => { if (HOST.ws === ws) hostConnect(); }, 1000);
  };
}
const hostAll = o => { if (HOST.ws && HOST.ws.readyState === 1) HOST.ws.send('*' + JSON.stringify(o)); };
const hostTo = (id, o) => { if (HOST.ws && HOST.ws.readyState === 1) HOST.ws.send('@' + id.slice(1) + '|' + JSON.stringify(o)); };
function hostRecv(d) {
  if (d[0] === '+') return;
  if (d[0] === '-') return hostLeft('c' + d.slice(1));
  const bar = d.indexOf('|'); if (bar < 0) return;
  const id = 'c' + d.slice(0, bar);
  let m; try { m = JSON.parse(d.slice(bar + 1)); } catch (e) { return; }
  if (m.t === 'in') { if (G.sim && HOST.inGame) G.sim.input(id, +m.x || 0, +m.y || 0, m.k | 0, m.p | 0); return; }
  if (m.t === 'hi') {
    const name = String(m.name || 'Spelare').slice(0, 14), ch = (m.ch | 0) % 4;
    let p = HOST.lobby.find(p => p.id === id);
    if (!p) {
      const cnt = t => HOST.lobby.filter(p => p.team === t).length;
      p = { id, name, ch, team: cnt(0) <= cnt(1) ? 0 : 1 };
      HOST.lobby.push(p);
      SFX.pick(); buzz(15);
    } else { p.name = name; p.ch = ch; }
    hostTo(id, { t: 'welcome', id });
    if (HOST.inGame && G.sim) hostJoinMid(p);
    hostLobbyBroadcast();
    return;
  }
  if (m.t === 'team' && !HOST.inGame) {
    const p = HOST.lobby.find(p => p.id === id);
    if (p) { p.team = 1 - p.team; hostLobbyBroadcast(); }
  }
}
function hostLeft(id) {
  const i = HOST.lobby.findIndex(p => p.id === id);
  if (i >= 0) HOST.lobby.splice(i, 1);
  if (HOST.inGame && G.sim) {
    const p = G.sim.byId(id);
    if (p) { p.bot = HOST.set.lvl; p.id = 'b' + (++botNo); p.name = '🤖 ' + p.name.replace(/^🤖 /, ''); p.ix = p.iy = 0; hostRoster(); }
  }
  hostLobbyBroadcast();
}
function hostJoinMid(p) {
  const m = G.sim;
  if (m.byId(p.id)) return;
  const humans = t => m.players.filter(q => q.team === t && q.bot < 0).length;
  const team = humans(0) <= humans(1) ? 0 : 1;
  p.team = team;
  let q = m.players.find(q => q.team === team && q.bot >= 0) || m.players.find(q => q.bot >= 0);
  if (q) { p.team = q.team; Object.assign(q, { id: p.id, name: p.name, ch: p.ch, bot: -1, kSeq: 0, pSeq: 0, ix: 0, iy: 0 }); }
  else m.add({ id: p.id, name: p.name, ch: p.ch, team, bot: -1 });
  hostRoster();
}
let rv = 0;
function hostRoster() {
  G.roster = G.sim.players;
  hostAll({ t: 'roster', rv: ++rv, min: G.sim.minutes, players: G.sim.players.map(p => ({ id: p.id, name: p.name, ch: p.ch, team: p.team, bot: p.bot })) });
}
function hostLobbyBroadcast() {
  hostAll({ t: 'lobby', players: HOST.lobby, set: HOST.set, inGame: HOST.inGame, host: myName() });
  if (current === 'lobby') buildLobby();
}
function hostStartMatch() {
  const set = HOST.set;
  const pl = HOST.lobby.map(p => ({ id: p.id, name: p.name, ch: p.ch, team: p.team, bot: -1 }));
  for (const t of [0, 1]) if (!pl.some(p => p.team === t) && pl.length > 1 && !set.fill) {   // ett tomt lag: flytta någon
    const other = pl.filter(p => p.team !== t); other[other.length - 1].team = t;
  }
  if (set.fill) {
    const need = Math.max(set.fill, ...[0, 1].map(t => pl.filter(p => p.team === t).length));
    for (const t of [0, 1]) { const used = pl.filter(p => p.team === t).map(p => p.ch); while (pl.filter(p => p.team === t).length < need) pl.push(botPlayer(null, t, set.lvl, used)); }
  } else if (!pl.some(p => p.team === 1)) pl.push(botPlayer(null, 1, set.lvl));   // ensam värd: en datorspelare att möta
  HOST.inGame = true;
  runSim(pl, set.min);
  hostRoster();
  hostLobbyBroadcast();
}

/* ================= KLIENT ================= */
const CL = { ws: null, id: null, lobby: null, closing: false, sendT: null, tries: 0 };
function clientStart() {
  G.mode = 'client';
  meDone = clientConnect;
  show('meScr');
}
function clientConnect() {
  CL.closing = false;
  const ws = new WebSocket(`ws://${location.host}/ws`);
  CL.ws = ws;
  panel(`<h3>Ansluter… <span class="spin">⚽</span></h3><p>Till matchen på ${esc(location.hostname)}</p>`);
  ws.onopen = () => { CL.tries = 0; closePanel(); ws.send(JSON.stringify({ t: 'hi', name: myName(), ch: ME.ch })); show('lobby'); };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } clientRecv(m); };
  ws.onclose = () => {
    if (CL.ws !== ws || CL.closing) return;
    clearInterval(CL.sendT);
    if (CL.tries++ < 3 && CL.id) { setTimeout(clientConnect, 800); return; }
    panel(`<h3>Tappade kontakten 📡</h3><p>Matchen hittas inte längre. Är värden kvar och på samma wifi?</p>
      <button class="btn green" id="pRetry">🔄 Försök igen</button><button class="btn white small" id="pLeave">🚪 Lämna</button>`);
    $('pRetry').onclick = () => { SFX.tap(); CL.tries = 0; clientConnect(); };
    $('pLeave').onclick = () => { SFX.tap(); leave(); };
  };
}
function clientRecv(m) {
  switch (m.t) {
    case 'welcome': CL.id = m.id; G.myId = m.id; break;
    case 'lobby':
      CL.lobby = m;
      if (!m.inGame && (current === 'game' || G.over)) { clearInterval(CL.sendT); closePanel(); G.over = false; show('lobby'); }
      else if (current === 'lobby') buildLobby();
      break;
    case 'roster':
      G.roster = m.players; G.rv = m.rv;
      if (current !== 'game') { G.snaps = []; G.over = false; closePanel(); show('game'); SFX.whistle(1); }
      clearInterval(CL.sendT);
      CL.sendT = setInterval(clientSendInput, 33);
      break;
    case 's':
      m.at = performance.now();
      G.snaps.push(m);
      if (G.snaps.length > 12) G.snaps.shift();
      events(m.ev);
      break;
    case 'goal': onGoal(m); break;
    case 'end': clearInterval(CL.sendT); setTimeout(() => onEnd(m), 900); break;
    case 'hostgone':
      CL.closing = true; clearInterval(CL.sendT);
      panel(`<h3>Matchen är slut 👋</h3><p>Värden avslutade matchen.</p><button class="btn green" id="pLeave">OK</button>`);
      $('pLeave').onclick = () => { SFX.tap(); leave(); };
      break;
  }
}
let lastSent = '';
function clientSendInput() {
  if (!CL.ws || CL.ws.readyState !== 1) return;
  const msg = JSON.stringify({ t: 'in', x: Math.round(G.ix * 100) / 100, y: Math.round(G.iy * 100) / 100, k: G.kSeq, p: G.pSeq });
  // skicka alltid ändringar, annars bara ibland (så värden vet att vi lever)
  if (msg !== lastSent || Math.random() < 0.15) { CL.ws.send(msg); lastSent = msg; }
}

/* ================= LOBBY ================= */
function lobbyData() {
  if (G.mode === 'host') return { players: HOST.lobby, set: HOST.set, inGame: HOST.inGame, host: myName() };
  return CL.lobby || { players: [], set: { min: 3, fill: 0, lvl: 1 }, inGame: false };
}
function buildLobby() {
  if (current !== 'lobby') return;
  const L = lobbyData(), isHost = G.mode === 'host';
  const myId = isHost ? 'h' : CL.id;
  const plHTML = p => `<button class="pl ${p.id === myId ? 'mine' : ''}" data-id="${esc(p.id)}">${avHTML(p.ch)}<span>${esc(p.name)}${p.id === myId ? ' <small>(du)</small>' : ''}${p.id === 'h' ? ' <small>👑</small>' : ''}</span></button>`;
  const fill = L.set.fill || 0;
  const team = t => {
    const ps = L.players.filter(p => p.team === t);
    const bots = fill ? Math.max(0, Math.max(fill, ...[0, 1].map(k => L.players.filter(p => p.team === k).length)) - ps.length) : 0;
    return `<div class="team" style="--tc:${TEAM[t].c};--td:${TEAM[t].d}"><h3>${TEAM[t].e} ${TEAM[t].name}</h3>${ps.map(plHTML).join('')}
      ${Array.from({ length: bots }, () => `<div class="pl bot"><span>🤖 Datorspelare</span></div>`).join('')}</div>`;
  };
  let side = '';
  if (isHost) {
    let ips = [];
    try { ips = JSON.parse(Android.netIps()); } catch (e) { }
    const url = ips.length ? `http://${ips[0]}:${PORT}/` : '';
    let qr = '';
    if (url && window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(url); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
    side = `<div class="opt"><h4>📲 Bjud in familjen</h4>
      ${url ? `<div class="joininfo"><div class="qr">${qr}</div><div><p class="note">iPhone/iPad: skanna med kameran eller öppna i Safari:</p><div class="url">${esc(url.replace(/^http:\/\//, '').replace(/\/$/, ''))}</div></div></div>
      <p class="note">Android med appen: Fotboll → 🔗 Gå med (matchen hittas automatiskt).</p>`
        : `<p class="note">⚠️ Hittar inget wifi. Anslut telefonen till wifi (eller slå på surfzon) och tryck 🔄.</p><button class="btn white small" id="reIp">🔄 Uppdatera</button>`}
      ${HOST.ok ? '' : '<p class="note">Startar servern…</p>'}
    </div>
    <div class="opt"><h4>⏱️ Matchtid</h4>${segHTML('min', MINS, HOST.set.min)}</div>
    <div class="opt"><h4>🤖 Fyll ut lagen med datorn</h4>${segHTML('fill', [[0, 'Nej'], [2, '2 mot 2'], [3, '3 mot 3'], [4, '4 mot 4']], fill)}
      ${fill ? segHTML('lvl', LEVELS, HOST.set.lvl) : ''}</div>`;
  } else {
    side = `<div class="opt"><p class="wait">${L.inGame ? 'Matchen pågår – du kommer in strax! ⚽' : `Väntar på att ${esc(L.host || 'värden')} startar matchen… ⏳`}</p>
      <p class="note">⏱️ ${L.set.min} min${fill ? ` · 🤖 fyller ut till ${fill} mot ${fill} (${LVN[L.set.lvl]})` : ''}</p></div>`;
  }
  $('lobbyBox').innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="teams">${team(0)}${team(1)}</div>
      <p class="note" style="text-align:center">${isHost ? 'Tryck på en spelare för att byta lag.' : 'Tryck på dig själv för att byta lag.'}</p>
      ${isHost ? `<button class="btn green" id="lStart" style="align-self:center" ${HOST.ok ? '' : 'disabled'}>⚽ Starta matchen!</button>` : ''}
    </div><div style="display:flex;flex-direction:column;gap:12px">${side}</div>`;
  $('lobbyBox').querySelectorAll('.pl[data-id]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (isHost) { const p = HOST.lobby.find(p => p.id === id); if (p) { p.team = 1 - p.team; SFX.tap(); hostLobbyBroadcast(); } }
    else if (id === myId && CL.ws && CL.ws.readyState === 1) { CL.ws.send(JSON.stringify({ t: 'team' })); SFX.tap(); }
  });
  if (isHost) {
    bindSegs($('lobbyBox'), HOST.set, () => { store.set('hostset', HOST.set); hostLobbyBroadcast(); });
    if ($('reIp')) $('reIp').onclick = () => { SFX.tap(); buildLobby(); };
    $('lStart').onclick = () => { SFX.tap(); hostStartMatch(); };
  }
}
$('lobbyBack').onclick = () => { SFX.tap(); confirmLeave(); };
function confirmLeave() {
  panel(`<h3>${G.mode === 'host' ? 'Avsluta matchen?' : 'Lämna matchen?'}</h3>
    <p>${G.mode === 'host' ? 'Alla andra kopplas bort.' : 'Du kan gå med igen sen.'}</p>
    <button class="btn pink" id="pYes">🚪 ${G.mode === 'host' ? 'Avsluta' : 'Lämna'}</button><button class="btn white small" id="pNo">Stanna kvar</button>`);
  $('pYes').onclick = () => { SFX.tap(); closePanel(); leave(); };
  $('pNo').onclick = () => { SFX.tap(); closePanel(); };
}
function leave() {
  stopSim();
  clearInterval(CL.sendT);
  if (G.mode === 'host') {
    const ws = HOST.ws; HOST.ws = null;
    try { ws && ws.close(); } catch (e) { }
    try { Android.netStop(); } catch (e) { }
    location.href = APP_HOME + 'boll.html';
    return;
  }
  if (G.mode === 'client' || CLIENT) {
    CL.closing = true;
    try { CL.ws && CL.ws.close(); } catch (e) { }
    const back = Q.get('back');
    if (back && /^https?:\/\//.test(back)) location.href = back;
    else if (window.Android) location.href = APP_HOME + 'boll.html';
    else { G.over = false; clientStart(); }
    return;
  }
  show('menu');
}
function goHome() {
  if (REMOTE) { if (window.Android) location.href = APP_HOME + 'index.html'; else leave(); }
  else goHub();
}

/* ================= KONTROLLER ================= */
const joy = { id: null, x0: 0, y0: 0, sx: 0, sy: 0 };
const JR = 56;
function setJoy(sx, sy) {   // skärmriktning -> världsriktning
  joy.sx = sx; joy.sy = sy;
  const th = G.view ? G.view.th : 0, c = Math.cos(-th), s = Math.sin(-th);
  G.ix = sx * c - sy * s; G.iy = sx * s + sy * c;
}
$('joyZone').addEventListener('pointerdown', e => {
  if (joy.id != null) return;
  e.preventDefault();
  joy.id = e.pointerId; joy.x0 = e.clientX; joy.y0 = e.clientY;
  try { $('joyZone').setPointerCapture(e.pointerId); } catch (er) { }
  const j = $('joy'); j.style.left = e.clientX + 'px'; j.style.top = e.clientY + 'px'; j.classList.remove('idle');
  $('knob').style.transform = '';
  ac();
});
$('joyZone').addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.x0, dy = e.clientY - joy.y0;
  const d = Math.hypot(dx, dy);
  if (d > JR) {   // spaken följer med fingret
    joy.x0 += dx * (1 - JR / d); joy.y0 += dy * (1 - JR / d);
    dx = e.clientX - joy.x0; dy = e.clientY - joy.y0;
    const j = $('joy'); j.style.left = joy.x0 + 'px'; j.style.top = joy.y0 + 'px';
  }
  $('knob').style.transform = `translate(${dx}px,${dy}px)`;
  const m = Math.min(1, Math.hypot(dx, dy) / JR);
  const dd = Math.hypot(dx, dy) || 1;
  setJoy(m < 0.12 ? 0 : dx / dd * Math.min(1, m * 1.25), m < 0.12 ? 0 : dy / dd * Math.min(1, m * 1.25));
});
const joyEnd = e => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; setJoy(0, 0);
  $('knob').style.transform = '';
  $('joy').classList.add('idle');
  placeIdleJoy();
};
$('joyZone').addEventListener('pointerup', joyEnd);
$('joyZone').addEventListener('pointercancel', joyEnd);
function placeIdleJoy() {
  const j = $('joy'), z = $('joyZone').getBoundingClientRect();
  j.style.left = (z.left + Math.min(150, z.width * 0.3)) + 'px'; j.style.top = (z.bottom - Math.min(140, z.height * 0.35)) + 'px';
}
function press(btn, fn) {
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('down'); fn(); ac(); });
  const up = () => btn.classList.remove('down');
  btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
}
const doKick = () => { G.kSeq++; buzz(12); };
const doPass = () => { G.pSeq++; buzz(8); };
press($('bShoot'), doKick);
press($('bPass'), doPass);
// tangentbord (dator)
const keys = new Set();
function keyDir() {
  if (joy.id != null) return;
  let x = 0, y = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) x--;
  if (keys.has('ArrowRight') || keys.has('d')) x++;
  if (keys.has('ArrowUp') || keys.has('w')) y--;
  if (keys.has('ArrowDown') || keys.has('s')) y++;
  const l = Math.hypot(x, y) || 1;
  setJoy(x / l, y / l);
}
addEventListener('keydown', e => {
  if (current !== 'game' || e.target.tagName === 'INPUT') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.repeat) { if (k.startsWith('Arrow') || 'wasd'.includes(k)) e.preventDefault(); return; }
  if (k === ' ' || k === 'x' || k === 'k') { doKick(); e.preventDefault(); return; }
  if (k === 'c' || k === 'l' || k === 'Shift') { doPass(); e.preventDefault(); return; }
  if (k === 'Escape' || k === 'p') { pauseMenu(); return; }
  keys.add(k); keyDir(); if (k.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.delete(k); if (current === 'game') keyDir(); });
addEventListener('blur', () => { keys.clear(); if (joy.id == null) setJoy(0, 0); });

$('gPause').onclick = () => { SFX.tap(); pauseMenu(); };
function pauseMenu() {
  if (G.over) return;
  if (G.mode === 'local') {
    G.paused = true;
    panel(`<h3>Paus ⏸️</h3><button class="btn green" id="pResume">▶️ Fortsätt</button><button class="btn white small" id="pQuit">🏠 Avsluta matchen</button>`);
    $('pResume').onclick = () => { SFX.tap(); G.paused = false; closePanel(); };
    $('pQuit').onclick = () => { SFX.tap(); G.paused = false; closePanel(); stopSim(); show('menu'); };
  } else if (G.mode === 'host') {
    panel(`<h3>Matchen ⏸️</h3><p>Matchen fortsätter för de andra.</p><button class="btn green" id="pResume">▶️ Tillbaka</button>
      <button class="btn blue small" id="pLobby">👥 Avbryt – till laguppställningen</button><button class="btn white small" id="pQuit">🚪 Avsluta för alla</button>`);
    $('pResume').onclick = () => { SFX.tap(); closePanel(); };
    $('pLobby').onclick = () => { SFX.tap(); closePanel(); stopSim(); HOST.inGame = false; hostLobbyBroadcast(); show('lobby'); };
    $('pQuit').onclick = () => { SFX.tap(); closePanel(); leave(); };
  } else {
    panel(`<h3>Matchen ⏸️</h3><p>Matchen fortsätter för de andra.</p><button class="btn green" id="pResume">▶️ Tillbaka</button><button class="btn white small" id="pQuit">🚪 Lämna matchen</button>`);
    $('pResume').onclick = () => { SFX.tap(); closePanel(); };
    $('pQuit').onclick = () => { SFX.tap(); closePanel(); leave(); };
  }
}
$('gSound').onclick = () => { SND.sound = !SND.sound; saveSnd(); $('gSound').textContent = SND.sound ? '🔊' : '🔇'; if (SND.sound) SFX.tap(); };

/* ================= RITNING ================= */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2.5, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  placeIdleJoy();
}
addEventListener('resize', () => { if (current === 'game') resize(); });

/* hur världen syns: i stående läge vänds planen på högkant, och man anfaller alltid uppåt/åt höger */
function computeView(focus) {
  const portrait = H > W * 1.05;
  const team = myTeam();
  const th = (portrait ? -Math.PI / 2 : 0) + (team === 1 ? Math.PI : 0);
  const wx = F.OX + 22, wy = F.OY + 22;   // halva världen som ska synas
  const top = 54;                          // plats för resultattavlan
  const alongX = portrait ? H - top : W, alongY = portrait ? W : H - top;   // skärmens mått längs planens x och y
  const fit = Math.min(alongX / (2 * wx), alongY / (2 * wy));
  const s = Math.max(fit, Math.min(W, H) < 500 ? 0.72 : 0.6);
  const hx = alongX / s / 2, hy = alongY / s / 2;
  const lim = (v, h, w) => h >= w ? 0 : Math.max(-(w - h), Math.min(w - h, v));
  return { th, s, cx: lim(focus ? focus.x : 0, hx, wx), cy: lim(focus ? focus.y : 0, hy, wy), portrait, top };
}

/* läget att rita: värden/lokalt direkt från matchen, hos klienten mellan två mottagna lägen */
function currentState(dt) {
  if (G.sim) {
    const m = G.sim;
    return { ball: m.ball, P: m.players.map(p => ({ x: p.x, y: p.y, team: p.team, ch: p.ch, name: p.name, id: p.id, bot: p.bot, kick: p.kickT > 0 || p.passT > 0 })),
      score: m.score, tl: m.timeLeft, golden: m.golden, phase: m.phase, kickTeam: m.kickTeam };
  }
  const S = G.snaps;
  if (!S.length) return null;
  const latest = S[S.length - 1].k, target = latest - 4;
  if (!G.rt || Math.abs(G.rt - target) > 30) G.rt = target;
  else { G.rt += dt * 60; G.rt += (target - G.rt) * 0.06; }
  let a = S[0], b = S[S.length - 1];
  for (let i = 0; i < S.length - 1; i++) if (S[i].k <= G.rt && S[i + 1].k >= G.rt) { a = S[i]; b = S[i + 1]; break; }
  if (G.rt >= latest) a = b = S[S.length - 1];
  const f = b.k > a.k ? Math.max(0, Math.min(1, (G.rt - a.k) / (b.k - a.k))) : 1;
  const L = (u, v) => u + (v - u) * f;
  const P = [];
  const R = G.roster || [];
  for (let i = 0; i < Math.min(R.length, b.p.length); i++) {
    const pa = a.p[i] || b.p[i], pb = b.p[i];
    P.push({ x: L(pa[0], pb[0]), y: L(pa[1], pb[1]), kick: !!pb[2], team: R[i].team, ch: R[i].ch, name: R[i].name, id: R[i].id, bot: R[i].bot });
  }
  const ph = { k: 'kickoff', p: 'play', g: 'goal', e: 'end' }[b.ph] || 'play';
  return { ball: { x: L(a.b[0], b.b[0]), y: L(a.b[1], b.b[1]), spin: b.b[2] || 0 }, P, score: b.sc, tl: b.tl / 10, golden: !!b.g, phase: ph };
}

let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (current !== 'game') return;
  const st = currentState(dt);
  if (!st) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#1F7A3A'; ctx.fillRect(0, 0, W, H); return; }
  const me = st.P.find(p => p.id === G.myId);
  const fx = me ? me.x * 0.55 + st.ball.x * 0.45 : st.ball.x, fy = me ? me.y * 0.55 + st.ball.y * 0.45 : st.ball.y;
  G.cam.x += (fx - G.cam.x) * Math.min(1, dt * 4); G.cam.y += (fy - G.cam.y) * Math.min(1, dt * 4);
  G.view = computeView(G.cam);
  draw(st, now / 1000);
  hud(st);
}
requestAnimationFrame(frame);

function hud(st) {
  $('sR').textContent = st.score[0]; $('sB').textContent = st.score[1];
  const t = Math.max(0, Math.ceil(st.tl));
  $('sT').textContent = st.golden ? '⚡ Förl.' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  $('sT').classList.toggle('gold', st.golden);
  let hint = '';
  if (st.phase === 'kickoff') hint = `Avspark – ${TEAM[st.kickTeam != null ? st.kickTeam : 0].name} börjar`;
  if (G.mode === 'client' && st.phase === 'kickoff') hint = 'Avspark!';
  if (st.phase !== G.lastPh) { if (st.phase === 'kickoff' && G.lastPh === 'goal') SFX.whistle(1); G.lastPh = st.phase; }
  $('hint').textContent = hint;
}

function draw(st, t) {
  const v = G.view;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1C6E35'; ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2 + v.top / 2);
  ctx.rotate(v.th);
  ctx.scale(v.s, v.s);
  ctx.translate(-v.cx, -v.cy);
  drawField();
  // skuggor först
  ctx.fillStyle = '#00000038';
  for (const p of st.P) { ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 5, F.PR, F.PR * 0.9, 0, 0, 7); ctx.fill(); }
  ctx.beginPath(); ctx.arc(st.ball.x + 3, st.ball.y + 4, F.BR, 0, 7); ctx.fill();
  for (const p of st.P) drawPlayer(p, p.id === G.myId, t);
  drawBall(st.ball);
  drawGoalsFront();
  // namn ovanpå allt
  for (const p of st.P) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-v.th);
    const fs = Math.max(11, 13 / v.s * 0.85);
    ctx.font = `600 ${fs}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3.5 / v.s * 0.9; ctx.strokeStyle = '#0008'; ctx.fillStyle = p.id === G.myId ? '#FFE45C' : '#fff';
    const label = p.id === G.myId ? '⭐ ' + p.name : p.name;
    ctx.strokeText(label, 0, F.PR + 4); ctx.fillText(label, 0, F.PR + 4);
    ctx.restore();
  }
}

const GRASS = ['#3CB55F', '#35A956'];
function drawField() {
  const { FX, FY, GY, OX, OY, CR } = F;
  ctx.fillStyle = '#2F9E50'; ctx.fillRect(-OX - 40, -OY - 40, 2 * OX + 80, 2 * OY + 80);
  const n = 12, w = 2 * FX / n;
  for (let i = 0; i < n; i++) { ctx.fillStyle = GRASS[i % 2]; ctx.fillRect(-FX + i * w, -FY, w + 0.5, 2 * FY); }
  ctx.strokeStyle = '#ffffffd8'; ctx.lineWidth = 3.2;
  ctx.strokeRect(-FX, -FY, 2 * FX, 2 * FY);
  ctx.beginPath(); ctx.moveTo(0, -FY); ctx.lineTo(0, FY); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, CR, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, 7); ctx.fill();
  for (const s of [-1, 1]) {
    ctx.strokeRect(s > 0 ? FX - 150 : -FX, -170, 150, 340);
    ctx.strokeRect(s > 0 ? FX - 55 : -FX, -GY - 22, 55, 2 * GY + 44);
    ctx.beginPath(); ctx.arc(s * (FX - 110), 0, 3.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(s * (FX - 110), 0, 70, s > 0 ? Math.PI - 0.93 : -0.93, s > 0 ? Math.PI + 0.93 : 0.93, false); ctx.stroke();
    for (const sy of [-1, 1]) { ctx.beginPath(); ctx.arc(s * FX, sy * FY, 14, 0, 7); ctx.stroke(); }
  }
  // målnät
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? FX : -FX - F.GD;
    ctx.fillStyle = '#ffffff40'; ctx.fillRect(x0, -GY, F.GD, 2 * GY);
    ctx.strokeStyle = '#ffffff70'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let x = 0; x <= F.GD; x += 9) { ctx.moveTo(x0 + x, -GY); ctx.lineTo(x0 + x, GY); }
    for (let y = -GY; y <= GY; y += 9) { ctx.moveTo(x0, y); ctx.lineTo(x0 + F.GD, y); }
    ctx.stroke();
  }
}
function drawGoalsFront() {
  const { FX, GY, GD } = F;
  for (const s of [-1, 1]) {
    const col = TEAM[s < 0 ? 0 : 1];
    ctx.strokeStyle = col.d; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(s * FX, -GY); ctx.lineTo(s * (FX + GD), -GY); ctx.lineTo(s * (FX + GD), GY); ctx.lineTo(s * FX, GY); ctx.stroke();
    for (const sy of [-1, 1]) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = col.d; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(s * FX, sy * GY, F.POST, 0, 7); ctx.fill(); ctx.stroke();
    }
  }
}
function drawPlayer(p, mine, t) {
  const v = G.view, R = F.PR, col = TEAM[p.team];
  ctx.save(); ctx.translate(p.x, p.y);
  if (mine) {   // pulserande ring runt mig
    const k = 1 + Math.sin(t * 6) * 0.08;
    ctx.strokeStyle = '#FFE45C'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.arc(0, 0, (R + 9) * k, 0, 7); ctx.stroke();
  }
  if (p.kick) { ctx.fillStyle = '#ffffffb0'; ctx.beginPath(); ctx.arc(0, 0, R + 5, 0, 7); ctx.fill(); }
  ctx.fillStyle = col.c; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  ctx.rotate(-v.th);
  const im = FACES[p.ch];
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 3.5, 0, 7); ctx.clip();
  if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -R + 3.5, -R + 3.5, 2 * R - 7, 2 * R - 7);
  else { ctx.fillStyle = CHARS[p.ch].c; ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = col.d; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
  if (p.bot >= 0 && G.mode !== 'local') { ctx.font = `${R * 0.8}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🤖', R * 0.75, -R * 0.75); }
  ctx.restore();
}
function drawBall(b) {
  const r = F.BR;
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.clip();
  ctx.rotate((b.spin || 0) * 0.35);
  ctx.fillStyle = '#2B2350';
  const pent = (x, y, s) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.fill(); };
  const sh = ((b.spin || 0) * 2.2) % (r * 2);
  pent(0, sh - r * 0.6, r * 0.38);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5 + 0.3; pent(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95 + sh * 0.2, r * 0.3); }
  ctx.restore();
  ctx.strokeStyle = '#2B235099'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.restore();
}

/* ================= START ================= */
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { SFX.tap(); show('menu'); });
$('toSetup').onclick = () => { SFX.tap(); show('setup'); };
$('toJoin').onclick = () => { SFX.tap(); show('join'); };
$('toHost').onclick = () => { SFX.tap(); startHosting(); };
$('toHub').onclick = () => { SFX.tap(); goHub(); };
$('gSound').textContent = SND.sound ? '🔊' : '🔇';

window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) {
    if ($('pResume')) $('pResume').click(); else if ($('pNo')) $('pNo').click(); else if ($('eLeave')) $('eLeave').click(); else if ($('pLeave')) $('pLeave').click(); else closePanel();
    return true;
  }
  if (current === 'game') { pauseMenu(); return true; }
  if (current === 'lobby') { confirmLeave(); return true; }
  if (current === 'meScr' && CLIENT) { leave(); return true; }
  if (current === 'menu') { goHome(); return true; }
  show('menu'); return true;
};

bubbles();
if (HOSTPAGE) hostStart();
else if (CLIENT) clientStart();
else show('menu');
