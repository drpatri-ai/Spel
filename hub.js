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
  { id: 'krock', title: 'Krockarenan', sub: 'Bygg en stridsbil – krocka mot familjen', icon: '💥', c: '#8B5BFF', d: '#6235D9', isNew: true,
    stat: () => { let p = null; try { p = window.Android && Android.profGet ? JSON.parse(Android.profGet('krock') || 'null') : makeStore('bk').get('prof', null); } catch (e) { } return p && p.lad ? `⚔️ ${p.lad} segrar i arenan` : ''; } }
];

let current = 'hub';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  current = id;
  if (id === 'hub') buildHub();
  if (id === 'chars') buildChars();
  if (id === 'settings') buildSet();
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
  $('setList').innerHTML = soundRowsHTML();
  bindSoundRows($('setList'));
}

$('toChars').onclick = () => { CORE_SFX.tap(); show('chars'); };
$('toSettings').onclick = () => { CORE_SFX.tap(); show('settings'); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { CORE_SFX.tap(); show('hub'); });

// Android-bakåtknappen: på startsidan stängs appen
window.onBack = function () {
  if ($('party').classList.contains('on')) { $('party').click(); return true; }
  if (current !== 'hub') { show('hub'); return true; }
  return false;
};

bubbles();
buildHub();
