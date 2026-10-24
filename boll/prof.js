/* Bucinca Fotboll – spelarprofil: nivå, XP och egenskaper (per figur).
   I Android-appen sparas profilen i appen (Android.profGet/profSet) så att den följer med även när man spelar
   på någon annans telefon via nätverket (sidan kommer då från en annan adress). Annars i webbläsarens lagring. */
'use strict';
const ST_INFO = {
  spd: { n: 'Fart', i: '⚡', d: 'Springer snabbare' },
  drb: { n: 'Dribbling', i: '🌀', d: 'Tappar inte bollen lika lätt, svänger snabbare med den' },
  sho: { n: 'Skott', i: '💥', d: 'Hårdare och säkrare skott' },
  pas: { n: 'Passning', i: '🎯', d: 'Mer exakta passningar som hamnar rätt' },
  tck: { n: 'Brytning', i: '🛡️', d: 'Lättare att ta bollen från motståndaren' }
};
// figurernas egna styrkor från start
const ST_BASE = [
  { drb: 3 },            // Leah – fotbollstjejen
  { spd: 3 },            // Leon
  { sho: 2, tck: 2 },    // Patriot
  { pas: 3 },            // Hanna
  { spd: 2, drb: 1 },    // Marissa
  { pas: 2, drb: 1 },    // Elita
  { sho: 3 },            // Besnik
  { tck: 3 },            // Saranda
  { pas: 2, tck: 1 },    // Gjyshja
  { tck: 2, sho: 1 }     // Gjyshi
];
const PT_MAX = 20;          // max poäng man själv lägger på en egenskap
const LVL_MAX = 60;
const xpNeed = lvl => 60 + lvl * 25;

const PROF = {
  key: ch => 'boll' + ch,
  get(ch) {
    let raw = null;
    try { if (window.Android && Android.profGet) raw = Android.profGet(this.key(ch)) || null; } catch (e) { }
    let v = null;
    try { v = raw ? JSON.parse(raw) : store.get('prof' + ch, null); } catch (e) { }
    v = Object.assign({ lvl: 1, xp: 0, pts: 0, st: {}, tot: {} }, v || {});
    for (const k of SIM.STATS) v.st[k] = v.st[k] | 0;
    v.tot = Object.assign({ m: 0, w: 0, g: 0, a: 0 }, v.tot);
    return v;
  },
  set(ch, v) {
    const s = JSON.stringify(v);
    try { if (window.Android && Android.profSet) Android.profSet(this.key(ch), s); } catch (e) { }
    store.set('prof' + ch, v);
  }
};
const effSt = ch => {
  const p = PROF.get(ch), out = {};
  for (const k of SIM.STATS) out[k] = Math.min(SIM.STMAX, (ST_BASE[ch][k] || 0) + p.st[k]);
  return out;
};

/* XP för en match. s = min rad i resultatet */
function xpFor(s, won, mult) {
  const it = [['🙌 Spelade matchen', 20]];
  if (won) it.push(['🏆 Vinst', 40]);
  if (s.goals) it.push([`⚽ Mål ×${s.goals}`, s.goals * 25]);
  if (s.assists) it.push([`👟 Målgivande ×${s.assists}`, s.assists * 15]);
  if (s.passOk) it.push([`🎯 Lyckade pass ×${s.passOk}`, s.passOk * 4]);
  if (s.tackles) it.push([`🛡️ Brytningar ×${s.tackles}`, s.tackles * 5]);
  if (s.dribbles) it.push([`🌀 Dribblingar ×${s.dribbles}`, s.dribbles * 4]);
  if (s.shots) it.push([`💥 Skott ×${s.shots}`, s.shots * 2]);
  const run = Math.round((s.dist || 0) / 350);
  if (run) it.push([`⚡ Löpning ${Math.round((s.dist || 0) / 100)} m`, run]);
  let tot = it.reduce((a, x) => a + x[1], 0);
  tot = Math.round(tot * mult);
  return { items: it, total: tot };
}
/* lägg till XP i profilen; returnerar antal nya nivåer */
function addXp(ch, xp, s, won) {
  const p = PROF.get(ch);
  let ups = 0;
  p.xp += xp;
  while (p.lvl < LVL_MAX && p.xp >= xpNeed(p.lvl)) { p.xp -= xpNeed(p.lvl); p.lvl++; p.pts++; ups++; }
  if (p.lvl >= LVL_MAX) p.xp = Math.min(p.xp, xpNeed(p.lvl));
  p.tot.m++; if (won) p.tot.w++; p.tot.g += s.goals || 0; p.tot.a += s.assists || 0;
  PROF.set(ch, p);
  return { ups, p };
}

function xpBarHTML(p) {
  const need = xpNeed(p.lvl), f = p.lvl >= LVL_MAX ? 1 : Math.min(1, p.xp / need);
  return `<div class="xpbar"><i style="width:${(f * 100).toFixed(1)}%"></i><span>${p.lvl >= LVL_MAX ? 'Max!' : `${p.xp} / ${need} XP`}</span></div>`;
}

/* ---------- skärmen "Min spelare" ---------- */
let statsBack = 'menu';
function openStats(back) { statsBack = back || current; show('stats'); }
function buildStats() {
  const ch = ME.ch, p = PROF.get(ch), base = ST_BASE[ch];
  const rows = SIM.STATS.map(k => {
    const b = base[k] || 0, own = p.st[k], tot = Math.min(SIM.STMAX, b + own);
    return `<div class="strow"><span class="si">${ST_INFO[k].i}</span><div class="grow"><div class="sn"><b>${ST_INFO[k].n}</b><small>${tot}</small></div>
      <div class="sbar"><i class="b" style="width:${b / SIM.STMAX * 100}%"></i><i class="o" style="width:${Math.min(own, SIM.STMAX - b) / SIM.STMAX * 100}%"></i></div>
      <small class="sd">${ST_INFO[k].d}</small></div>
      <button class="plus" data-k="${k}" ${p.pts > 0 && own < PT_MAX && tot < SIM.STMAX ? '' : 'disabled'}>＋</button></div>`;
  }).join('');
  const spent = SIM.STATS.reduce((a, k) => a + p.st[k], 0);
  $('statsBox').innerHTML = `
    <div class="opt" style="${styleOf(ch)}"><div class="phead">${avHTML(ch)}<div class="grow"><b>${esc(myName())}</b>
      <div class="lvl">Nivå ${p.lvl}</div>${xpBarHTML(p)}</div></div>
      <p class="note">🎮 ${p.tot.m} matcher · 🏆 ${p.tot.w} vinster · ⚽ ${p.tot.g} mål · 👟 ${p.tot.a} målgivande</p></div>
    <div class="opt"><h4>${p.pts > 0 ? `✨ Du har ${p.pts} poäng att fördela!` : 'Egenskaper'}</h4>${rows}
      <p class="note">Spela matcher för att få XP. Varje ny nivå ger 1 poäng. ${CHARS[ch] ? esc(charName(ch)) : ''} har lite extra från start (ljusare färg).</p>
      ${spent ? `<button class="btn white small" id="stReset" style="align-self:center">↺ Fördela om poängen</button>` : ''}</div>
    <button class="btn green" id="stOk" style="align-self:center">✅ Klar</button>`;
  $('statsBox').querySelectorAll('.plus').forEach(b => b.onclick = () => {
    const q = PROF.get(ch);
    if (q.pts <= 0) return;
    q.st[b.dataset.k]++; q.pts--; PROF.set(ch, q);
    SFX.pick(); buzz(15);
    buildStats();
    statsChanged();
  });
  if ($('stReset')) $('stReset').onclick = () => {
    const q = PROF.get(ch);
    for (const k of SIM.STATS) { q.pts += q.st[k]; q.st[k] = 0; }
    PROF.set(ch, q); SFX.bonk(); buildStats(); statsChanged();
  };
  $('stOk').onclick = () => { SFX.tap(); show(statsBack === 'stats' ? 'menu' : statsBack); };
}
