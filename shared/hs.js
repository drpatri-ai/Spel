/* Bucinca Spel – gemensam topplista för alla som har appen (eller webbversionen).
   Varje spelare (namnet man skriver när appen startas första gången) har ett eget dokument som sparas kvar hos
   öppna MQTT-förmedlare (se shared/net.js). Siffrorna räknas fram ur spelens egna sparade rekord. */
'use strict';
const HS_NS = 'bucinca-spel-hs-7c41e9d2';

/* ---------- spelaren på den här enheten ---------- */
function hsPlayer() { return shared.get('player', null); }
function hsSetPlayer(name) {
  name = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  if (!name) return null;
  const p = hsPlayer() || { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4) };
  p.name = name; shared.set('player', p); shared.set('hsSent', '');
  return p;
}

/* ---------- vad som räknas ---------- */
const HS_CATS = [
  { k: 'fyraWins', ic: '🔴', n: 'Flest vinster i 4 i rad', u: 'vinster' },
  { k: 'chessWins', ic: '♛', n: 'Flest vinster i schack', u: 'vinster' },
  { k: 'pafBest', ic: '🦵', n: 'Längsta sparken i Paf!', u: 'm' },
  { k: 'blockBest', ic: '🧱', n: 'Rekord i Block', u: 'poäng' },
  { k: 'tornBest', ic: '🏢', n: 'Högsta tornet', u: 'våningar' },
  { k: 'hillBest', ic: '🚗', n: 'Längst i Backracet', u: 'm' },
  { k: 'goals', ic: '⚽', n: 'Flest gjorda mål', u: 'mål' },
  { k: 'bollWins', ic: '🏆', n: 'Flest fotbollsvinster', u: 'vinster' },
  { k: 'krockWins', ic: '💥', n: 'Flest segrar i Krockarenan', u: 'segrar' },
  { k: 'studsCleared', ic: '🎯', n: 'Flest banor klara i Studs', u: 'banor' },
  { k: 'studsBest', ic: '🟠', n: 'Högsta poäng i Studs', u: 'poäng' },
  { k: 'boxWins', ic: '🥊', n: 'Flest boxningsvinster', u: 'vinster' },
  { k: 'boxBelts', ic: '🏅', n: 'Flest mästarbälten', u: 'bälten' },
  { k: 'tankKills', ic: '🪖', n: 'Flest träffar med stridsvagn', u: 'träffar' },
  { k: 'tankMis', ic: '🎖️', n: 'Flest uppdrag klara', u: 'uppdrag' },
  { k: 'lvl', ic: '⭐', n: 'Högst nivå sammanlagt', u: 'nivåer' }
];
function hsProf(key, storePrefix, storeKey) {
  try { if (window.Android && Android.profGet) { const r = Android.profGet(key); if (r) return JSON.parse(r); } } catch (e) { }
  try { return makeStore(storePrefix).get(storeKey, null); } catch (e) { return null; }
}
function hsCollect() {
  const S = {}, num = v => Math.max(0, Math.round(+v || 0)), max = a => a.length ? Math.max(0, ...a.map(num)) : 0;
  const wins = st => { if (!st) return 0; let w = 0; for (const l of Object.values(st.bot || {})) w += num(l.w); for (const c of st.chars || []) w += num(c); return w; };
  try { S.fyraWins = wins(makeStore('f4').get('stats', null)); } catch (e) { }
  try { S.chessWins = wins(makeStore('bs').get('stats', null)); } catch (e) { }
  try { S.pafBest = max(Object.values(makeStore('bp').get('rec', {}) || {}).map(r => r && r.best)); } catch (e) { }
  try { S.blockBest = num(makeStore('bb').get('best', 0)); } catch (e) { }
  try { S.tornBest = num(makeStore('bt').get('best', 0)); } catch (e) { }
  try { S.hillBest = max(Object.values(makeStore('bh').get('best', {}) || {})); } catch (e) { }
  let lvl = 0;
  try { let g = 0, w = 0; for (let ch = 0; ch < CHARS.length; ch++) { const p = hsProf('boll' + ch, 'bf', 'prof' + ch); if (p) { g += num(p.tot && p.tot.g); w += num(p.tot && p.tot.w); lvl += num(p.lvl); } } S.goals = g; S.bollWins = w; } catch (e) { }
  try { const p = hsProf('krock', 'bk', 'prof'); S.krockWins = num(p && p.wins); } catch (e) { }
  try { const st = makeStore('bu'); S.studsCleared = Object.keys(st.get('cleared', {}) || {}).length; S.studsBest = max(Object.values(st.get('best', {}) || {})); } catch (e) { }
  try { S.boxBelts = Object.values(makeStore('bx').get('belts', {}) || {}).reduce((a, v) => a + num(v), 0); const p = hsProf('box', 'bx', 'prof'); if (p && p.figs) for (const f of Object.values(p.figs)) lvl += num(f.lvl); } catch (e) { }
  try { const p = hsProf('tank', 'bw', 'prof'); if (p) { S.tankMis = max(Object.values(p.mis || {})); if (p.figs) for (const f of Object.values(p.figs)) lvl += num(f.lvl); } } catch (e) { }
  const c = hsCounters();
  S.boxWins = num(c.boxWins); S.tankKills = num(c.tankKills);
  S.lvl = lvl;
  return S;
}

/* ---------- lagring: kvarhållna meddelanden hos de öppna MQTT-förmedlarna (samma som internetmatchen) ----------
   Varje spelare skriver sitt dokument till alla förmedlare; listan läser från alla och tar det nyaste per spelare.
   Försvinner något hos en förmedlare skrivs det tillbaka nästa gång spelaren öppnar startsidan. */
const HS_TOPIC = id => `bsphs/${HS_NS.slice(-8)}/p/${id}`;
function hsBrokers(fn, wait) {
  // kör fn(mqtt) mot varje förmedlare som går att nå; svarar med antal som lyckades
  return new Promise(res => {
    let left = NET_BROKERS.length, ok = 0;
    const done = () => { if (--left === 0) res(ok); };
    for (const url of NET_BROKERS) {
      let fin = false;
      const m = new Mqtt(url);
      const end = () => { if (fin) return; fin = true; try { m.end(); } catch (e) { } done(); };
      const to = setTimeout(end, 7000);
      m.onclose = () => { clearTimeout(to); end(); };
      m.onopen = () => { ok++; fn(m); setTimeout(() => { clearTimeout(to); end(); }, wait); };
    }
  });
}
/* skicka mina siffror (när något ändrats eller en gång per dygn) */
async function hsSync(force) {
  const me = hsPlayer(); if (!me) return false;
  const s = hsCollect();
  const doc = { id: me.id, name: me.name, ch: shared.get('hsCh', 0) | 0, s, t: Date.now() };
  const sig = JSON.stringify([me.name, doc.ch, s]);
  if (!force && shared.get('hsSent', '') === sig && Date.now() - shared.get('hsT', 0) < 864e5) return true;
  const n = await hsBrokers(m => m.pub(HS_TOPIC(me.id), JSON.stringify(doc), true), 600);
  if (!n) return false;
  shared.set('hsSent', sig); shared.set('hsT', Date.now());
  return true;
}
/* hämta alla spelare (nyaste dokumentet per spelare från alla förmedlare) */
async function hsFetchAll() {
  const all = {};
  const n = await hsBrokers(m => {
    m.onmsg = (topic, msg) => {
      if (!msg) return;
      try { const d = JSON.parse(msg); if (d && d.id && d.name && d.s && (!all[d.id] || (d.t | 0) > (all[d.id].t | 0))) all[d.id] = d; } catch (e) { }
    };
    m.sub(HS_TOPIC('+'));
  }, 2500);
  if (!n) return null;
  return Object.values(all);
}
