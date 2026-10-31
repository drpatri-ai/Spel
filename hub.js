/* Bucinca Spel – startsidan där man väljer spel.
   Nytt spel? Lägg till en rad i GAMES och en sida <id>.html som laddar shared/core.js. */
'use strict';

const GAMES = [
  { id: 'fyra', title: '4 i rad', sub: 'Fyra i rad – mot varandra eller datorn', icon: '🔴', c: '#3B6CF6', d: '#2A4FC4',
    stat: () => { const s = makeStore('f4').get('stats', null); if (!s) return ''; const b = s.bot || {}; const w = ['easy', 'medium', 'hard'].reduce((n, l) => n + ((b[l] || {}).w || 0), 0); return w ? `🏆 ${w} vinster mot datorn` : ''; } },
  { id: 'schack', title: 'Schack', sub: 'Kungen bär figurens ansikte', icon: '♛', c: '#8B7BFF', d: '#6252D9',
    stat: () => { const s = makeStore('bs').get('stats', null); if (!s) return ''; const b = s.bot || {}; const w = ['easy', 'medium', 'hard'].reduce((n, l) => n + ((b[l] || {}).w || 0), 0); return w ? `🏆 ${w} vinster mot datorn` : ''; } },
  { id: 'paf', title: 'Paf!', sub: 'Sparka iväg figuren så långt det går', icon: '🦵', c: '#FF8A3D', d: '#D9621A',
    stat: () => { const r = makeStore('bp').get('rec', {}); const best = Math.max(0, ...Object.values(r).map(e => e.best || 0)); return best ? `🏁 Rekord ${best} m` : ''; } },
  { id: 'block', title: 'Block', sub: 'Lägg bitarna och rensa rader', icon: '🧱', c: '#34C759', d: '#219A40',
    stat: () => { const b = makeStore('bb').get('best', 0); return b ? `⭐ Rekord ${b} poäng` : ''; } },
  { id: 'torn', title: 'Tornet', sub: 'Bygg våning för våning – innan det rasar!', icon: '🏢', c: '#FF6FAE', d: '#D94788',
    stat: () => { const b = makeStore('bt').get('best', 0); return b ? `🏢 Rekord ${b} våningar` : ''; } },
  { id: 'hill', title: 'Backracet', sub: 'Kör uppför backarna – akta huvudet!', icon: '🚗', c: '#3B9DFF', d: '#2373C9',
    stat: () => { const b = makeStore('bh').get('best', {}); const m = Math.max(0, ...Object.values(b)); return m ? `🏁 Rekord ${m} m` : ''; } },
  { id: 'boll', title: 'Fotboll', sub: 'Mot datorn eller familjen i samma wifi', icon: '⚽', c: '#2FB45A', d: '#1F8A42',
    stat: () => { const w = makeStore('bf').get('wins', [0, 0, 0]).reduce((a, b) => a + b, 0); return w ? `🏆 ${w} vinster mot datorn` : ''; } },
  { id: 'krock', title: 'Krockarenan', sub: 'Bygg en stridsbil – krocka mot familjen', icon: '💥', c: '#8B5BFF', d: '#6235D9',
    stat: () => { let p = null; try { p = window.Android && Android.profGet ? JSON.parse(Android.profGet('krock') || 'null') : makeStore('bk').get('prof', null); } catch (e) { } return p && p.lad ? `⚔️ ${p.lad} segrar i arenan` : ''; } },
  { id: 'stad', title: 'Staden', sub: 'Lek med familjen hemma, i parken och i affären', icon: '🏙️', c: '#14C8C8', d: '#0E9A9A', stat: () => '' },
  { id: 'studs', title: 'Studs', sub: 'Sikta, studsa och träffa alla orange pinnar', icon: '🎯', c: '#FF7A12', d: '#D95A00',
    stat: () => { const c = Object.keys(makeStore('bu').get('cleared', {})).length; return c ? `⭐ ${c} banor klara` : ''; } },
  { id: 'box', title: 'Boxning', sub: 'Familjen i ringen – mästerskap, två spelare och wifi', icon: '🥊', c: '#E53935', d: '#9E1B1B',
    stat: () => { const b = makeStore('bx').get('belts', {}); const n = Object.values(b).reduce((a, v) => a + v, 0); return n ? `🏆 ${n} mästarbälten` : ''; } },
  { id: 'tank', title: 'Stridsvagnar', sub: 'Kör pansarvagn och skjut – mot datorn eller familjen', icon: '🪖', c: '#5E8C31', d: '#3E6420',
    stat: () => { let p = null; try { p = window.Android && Android.profGet ? JSON.parse(Android.profGet('tank') || 'null') : makeStore('bw').get('prof', null); } catch (e) { } const m = p && p.mis ? Math.max(0, ...Object.values(p.mis)) : 0; return m ? `🎖️ ${m} uppdrag klara` : ''; } },
  { id: 'ops', title: 'Operation Öken', sub: 'Röda mot blå i ökenstaden – lägg ut eller desarmera laddningen', icon: '🎯', c: '#D9A441', d: '#A8741E', isNew: true,
    stat: () => { const s = makeStore('bo').get('stats', null); return s && s.wins ? `🏆 ${s.wins} matcher vunna` : ''; } }
];

let current = 'hub';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'hub') buildHub();
  if (id === 'chars') buildChars();
  if (id === 'settings') buildSet();
  if (id === 'top') buildTop();
}

function buildHub() {
  let k = 0;
  const line = (w, cls) => `<div class="${cls}">` + [...w].map(ch => ch === ' ' ? '<span class="sp"></span>' :
    `<span style="color:${CHARS[k % 4].c};animation-delay:${(k++) * .1}s">${ch}</span>`).join('') + '</div>';
  $('logo').innerHTML = line('Bucinca', 'l1') + line('Spel 🎮', 'l2');
  $('dance').innerHTML = CHARS.map((_, i) => avHTML(i)).join('');
  [...$('dance').children].forEach((el, i) => el.style.animationDelay = (i * .18) + 's');
  $('games').innerHTML = GAMES.map(g => {
    let st = '';
    try { st = g.stat(); } catch (e) { }
    return `<button class="game" data-g="${g.id}" style="--c:${g.c};--d:${g.d}">
      ${g.isNew && !st ? '<span class="new">NYTT</span>' : ''}
      <div class="ic">${g.icon}</div><b>${g.title}</b><small>${g.sub}</small>${st ? `<span class="best">${st}</span>` : ''}</button>`;
  }).join('');
  $('games').querySelectorAll('.game').forEach(b => b.onclick = () => {
    CORE_SFX.pick(); buzz(15);
    b.style.transform = 'scale(1.08)';
    setTimeout(() => { location.href = b.dataset.g + '.html'; }, 160);
  });
}
function buildChars() {
  $('charList').innerHTML = `<p class="hint-txt">Namn och bilder gäller i alla spel. Tryck på bilden för att byta.</p>${charEditorHTML()}`;
  bindCharEditor($('charList'), buildChars);
}
function buildSet() {
  const me = hsPlayer();
  const app = !!(window.Android && Android.checkUpdate);
  let ver = ''; try { if (app) ver = JSON.parse(Android.appVersion()).name; } catch (e) { }
  $('setList').innerHTML = `<div class="row"><span style="font-size:28px">👤</span><div style="flex:1"><b>Ditt namn i topplistan</b><p class="small-note">${me ? esc(me.name) : 'Inte valt'}</p></div><button class="btn white small" id="setName">✏️ Ändra</button></div>
    ${app ? `<div class="row"><span style="font-size:28px">📲</span><div style="flex:1"><b>Appen</b><p class="small-note" id="verNote">Version ${esc(ver)}</p></div><button class="btn green small" id="setUpd">🔄 Uppdatera</button></div>` : ''}` + soundRowsHTML();
  bindSoundRows($('setList'));
  $('setName').onclick = () => { CORE_SFX.tap(); askName(true); };
  if ($('setUpd')) $('setUpd').onclick = () => { CORE_SFX.tap(); $('verNote').textContent = 'Söker efter ny version…'; checkUpdate(true); };
}

/* ---------- namn till topplistan (frågas första gången) ---------- */
function askName(canCancel) {
  const me = hsPlayer();
  let ch = shared.get('hsCh', 0) | 0;
  $('panel').innerHTML = `<h3>👋 Vad heter du?</h3><p>Namnet syns i topplistan för alla som har spelet.</p>
    <input id="nameIn" class="nameIn" type="text" maxlength="16" autocomplete="off" placeholder="Ditt namn" value="${me ? esc(me.name) : ''}">
    <p style="font-size:15px">Välj din bild:</p><div class="figpick" id="figPick">${CHARS.map((_, i) => `<button data-i="${i}" class="${i === ch ? 'on' : ''}">${avHTML(i)}</button>`).join('')}</div>
    <button class="btn green" id="nameOk">✅ Klar</button>${canCancel ? '<button class="btn white small" id="nameNo">Avbryt</button>' : ''}`;
  $('overlay').classList.add('on');
  $('figPick').querySelectorAll('button').forEach(b => b.onclick = () => { ch = +b.dataset.i; $('figPick').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); CORE_SFX.pick(); });
  const ok = () => {
    const v = $('nameIn').value.trim();
    if (!v) { $('nameIn').style.borderColor = '#FF4D6D'; CORE_SFX.bonk(); return; }
    hsSetPlayer(v); shared.set('hsCh', ch); shared.set('hsSent', '');
    $('overlay').classList.remove('on'); CORE_SFX.pick();
    if (current === 'settings') buildSet();
    hsSync(true);
  };
  $('nameOk').onclick = ok; $('nameIn').onkeydown = e => { if (e.key === 'Enter') ok(); };
  if ($('nameNo')) $('nameNo').onclick = () => $('overlay').classList.remove('on');
  setTimeout(() => $('nameIn').focus(), 150);
}

/* ---------- topplistan ---------- */
const fmtN = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
async function buildTop() {
  $('topList').innerHTML = `<p class="tnote">🏆 Hämtar topplistan…</p>`;
  await hsSync();
  const all = await hsFetchAll();
  if (current !== 'top') return;
  if (!all) { $('topList').innerHTML = `<p class="tnote">😕 Kunde inte hämta topplistan. Är du uppkopplad till internet? Tryck 🔄 för att försöka igen.</p>`; return; }
  const me = hsPlayer();
  // mina siffror direkt från enheten (även om de inte hunnit skickas)
  if (me) { const mine = all.find(d => d.id === me.id); const s = hsCollect(); if (mine) mine.s = s; else all.push({ id: me.id, name: me.name, ch: shared.get('hsCh', 0), s }); }
  const medal = ['🥇', '🥈', '🥉'];
  const cards = HS_CATS.map(c => {
    const list = all.filter(d => (d.s[c.k] | 0) > 0).sort((a, b) => b.s[c.k] - a.s[c.k]);
    if (!list.length) return '';
    const top = list.slice(0, 5), mi = me ? list.findIndex(d => d.id === me.id) : -1;
    const row = (d, i) => `<div class="trow ${me && d.id === me.id ? 'me' : ''}"><span class="m">${medal[i] || (i + 1) + '.'}</span>${avHTML(Math.abs(d.ch | 0) % CHARS.length)}<span>${esc(String(d.name).slice(0, 16))}</span><b>${fmtN(d.s[c.k] | 0)} ${c.u}</b></div>`;
    return `<div class="tcard"><h4>${c.ic} ${c.n}</h4>${top.map(row).join('')}${mi >= 5 ? row(list[mi], mi) : ''}</div>`;
  }).join('');
  $('topList').innerHTML = (cards || `<p class="tnote">Ingen har några rekord än – spela så hamnar du här! 🎮</p>`) +
    `<p class="tnote" style="font-size:14px;opacity:.85">${all.length} spelare · Listan uppdateras när man öppnar startsidan</p>`;
}

/* ---------- uppdatera appen ---------- */
const UPDATE_URL = 'https://drpatri-ai.github.io/Spel/app/version.json';
let upInfo = null, upManual = false;
function checkUpdate(manual) {
  if (!(window.Android && Android.checkUpdate)) return;
  upManual = !!manual;
  Android.checkUpdate(UPDATE_URL + '?t=' + Date.now());
}
window.onUpdateInfo = info => {
  let cur = 0; try { cur = JSON.parse(Android.appVersion()).code; } catch (e) { }
  const newer = info && !info.err && info.code > cur && info.url;
  if ($('verNote')) $('verNote').textContent = !info ? 'Kunde inte söka – är du uppkopplad till internet?' : info.err ? 'Hittade ingen uppdatering just nu' : newer ? `Ny version ${info.name} finns!` : 'Du har den senaste versionen ✅';
  if (newer) { upInfo = info; showUpBar(); if (upManual) startUpdate(); }
};
function showUpBar() {
  if ($('upbar') || !upInfo) return;
  const d = document.createElement('div'); d.className = 'upbar'; d.id = 'upbar';
  d.innerHTML = `<span>🎉 Ny version ${esc(upInfo.name)}!</span><button class="btn green" id="upGo">🔄 Uppdatera</button><button class="btn white small" id="upNo" style="padding:6px 10px">✖</button>`;
  document.body.appendChild(d);
  $('upGo').onclick = () => { CORE_SFX.tap(); startUpdate(); };
  $('upNo').onclick = () => d.remove();
}
function startUpdate() {
  if (!upInfo) return;
  $('panel').innerHTML = `<h3>📲 Uppdaterar…</h3><p id="upMsg">Laddar ner version ${esc(upInfo.name)}</p><div class="upprog" style="height:18px;border-radius:9px;background:#E4E0F7;overflow:hidden;width:100%"><i id="upBar" style="display:block;height:100%;width:0;background:linear-gradient(90deg,#34C759,#FFD23F)"></i></div>
    <button class="btn white small" id="upClose">Stäng</button>`;
  $('overlay').classList.add('on');
  $('upClose').onclick = () => $('overlay').classList.remove('on');
  Android.installUpdate(upInfo.url);
}
window.onUpdateProgress = p => {
  if (!$('upMsg')) return;
  if (p === -2) { $('upMsg').innerHTML = 'Första gången måste du tillåta att <b>Bucinca Spel</b> får installera appar.<br>Slå på det i rutan som öppnades, gå tillbaka hit och tryck <b>🔄 Uppdatera</b> igen.'; return; }
  if (p === -1) { $('upMsg').textContent = '😕 Nedladdningen misslyckades. Kolla internet och försök igen.'; return; }
  $('upBar').style.width = p + '%';
  if (p >= 100) $('upMsg').textContent = '✅ Klart! Tryck "Uppdatera" i rutan som Android visar. Dina rekord och inställningar finns kvar.';
};

$('toChars').onclick = () => { CORE_SFX.tap(); show('chars'); };
$('toTop').onclick = () => { CORE_SFX.tap(); show('top'); };
$('topRe').onclick = () => { CORE_SFX.tap(); shared.set('hsSent', ''); buildTop(); };
$('toSettings').onclick = () => { CORE_SFX.tap(); show('settings'); };
// internetmatch: skriv värdens kod så öppnas rätt spel
$('toCode').onclick = () => {
  CORE_SFX.tap();
  $('panel').innerHTML = `<h3>🌍 Internetmatch</h3><p>Skriv koden som står hos värden, t.ex. KATT-42.</p>
    <input id="hubCode" type="text" autocapitalize="characters" autocomplete="off" placeholder="KATT-42" style="font:inherit;font-size:26px;font-weight:700;text-align:center;width:100%;border:3px solid #E4E0F7;border-radius:14px;padding:8px;-webkit-user-select:text;user-select:text">
    <p id="hubMsg" style="font-size:15px"></p><button class="btn green" id="hubGo">Gå med</button><button class="btn white small" id="hubNo">Avbryt</button>`;
  $('overlay').classList.add('on');
  const go = () => netOnlineJoin($('hubCode').value, (page, code) => `${page}?online=${encodeURIComponent(code)}&back=${encodeURIComponent(location.href.split('?')[0])}`, st => {
    $('hubMsg').textContent = st === 'wait' ? '🌍 Letar efter matchen…' : st === 'bad' ? 'Skriv koden som står hos värden.' : st === 'lib' ? 'Kunde inte ladda internetdelen – är du uppkopplad?' : '😕 Hittade ingen match med den koden.';
  });
  $('hubGo').onclick = go; $('hubCode').onkeydown = e => { if (e.key === 'Enter') go(); };
  $('hubNo').onclick = () => $('overlay').classList.remove('on');
  setTimeout(() => $('hubCode').focus(), 100);
};
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { CORE_SFX.tap(); show('hub'); });

// Android-bakåtknappen: på startsidan stängs appen
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if ($('overlay').classList.contains('on')) { $('overlay').classList.remove('on'); return true; }
  if (current !== 'hub') { show('hub'); return true; }
  return false;
};

bubbles();
buildHub();
if (!hsPlayer()) setTimeout(() => askName(false), 600); else hsSync();
setTimeout(() => checkUpdate(false), 1500);
