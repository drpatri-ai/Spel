/* Bucinca Spel – gemensam topplista för alla som har appen (eller webbversionen).
   Varje spelare (namnet man skriver när appen startas första gången) har ett eget dokument hos textdb.dev
   och ett gemensamt register listar alla spelare. Siffrorna räknas fram ur spelens egna sparade rekord.
   Byt tjänst? Ändra HS_URL och hsGet/hsPut nedan. */
'use strict';
const HS_NS = 'bucinca-spel-hs-7c41e9d2';
const HS_URL = id => `https://textdb.dev/api/data/${HS_NS}-${id}`;

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

/* ---------- HTTP (i appen via Android för att slippa CORS) ---------- */
let _hsSeq = 0; const _hsWait = {};
window.onHttp = (id, status, text) => { const f = _hsWait[id]; delete _hsWait[id]; if (f) f({ status, text }); };
function hsHttp(method, url, body) {
  if (window.Android && Android.http) return new Promise(res => { const id = ++_hsSeq; _hsWait[id] = res; setTimeout(() => { if (_hsWait[id]) { delete _hsWait[id]; res({ status: 0, text: '' }); } }, 20000); Android.http(id, method, url, body == null ? null : body, 'application/json'); });
  return fetch(url, { method, headers: body != null ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' }, body: body == null ? undefined : body, cache: 'no-store' })
    .then(r => r.text().then(text => ({ status: r.status, text }))).catch(() => ({ status: 0, text: '' }));
}
async function hsGet(id) { const r = await hsHttp('GET', HS_URL(id)); if (r.status !== 200 || !r.text) return { ok: r.status === 200 || r.status === 404, v: null }; try { return { ok: true, v: JSON.parse(r.text) }; } catch (e) { return { ok: true, v: null }; } }
async function hsPut(id, v) { const r = await hsHttp('POST', HS_URL(id), JSON.stringify(v)); return r.status >= 200 && r.status < 300; }

/* skicka mina siffror (när något ändrats) och se till att jag finns i registret */
async function hsSync(force) {
  const me = hsPlayer(); if (!me) return false;
  const s = hsCollect();
  const doc = { id: me.id, name: me.name, ch: shared.get('hsCh', 0) | 0, s, t: Date.now() };
  const sig = JSON.stringify([me.name, doc.ch, s]);
  if (!force && shared.get('hsSent', '') === sig && Date.now() - shared.get('hsT', 0) < 864e5) return true;
  if (!await hsPut('p-' + me.id, doc)) return false;
  const idx = await hsGet('index');
  if (!idx.ok) return false;
  const ids = (idx.v && Array.isArray(idx.v.ids)) ? idx.v.ids : [];
  if (!ids.includes(me.id)) { ids.push(me.id); if (!await hsPut('index', { ids: ids.slice(-200) })) return false; }
  shared.set('hsSent', sig); shared.set('hsT', Date.now());
  return true;
}
/* hämta alla spelare */
async function hsFetchAll() {
  const idx = await hsGet('index');
  if (!idx.ok) return null;
  const ids = (idx.v && Array.isArray(idx.v.ids)) ? idx.v.ids.slice(-200) : [];
  const docs = await Promise.all(ids.map(id => hsGet('p-' + id).then(r => r.v).catch(() => null)));
  return docs.filter(d => d && d.id && d.name && d.s);
}
