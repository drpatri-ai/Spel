/* Bucinca Trolldrycker – regler, nivågenerator och lösare för färgsortering i flaskor. Fungerar i Node. */
(function (root) {
  'use strict';
  const CAP = 4;
  const COLORS = [
    { n: 'Röd', c: '#FF3B4E', d: '#C0102A' }, { n: 'Blå', c: '#2F7BFF', d: '#1748B8' }, { n: 'Gul', c: '#FFD23F', d: '#D9A400' },
    { n: 'Grön', c: '#34C759', d: '#1E8E3A' }, { n: 'Lila', c: '#9B5BFF', d: '#6430C9' }, { n: 'Orange', c: '#FF8A1F', d: '#C95A00' },
    { n: 'Rosa', c: '#FF7EC8', d: '#D9409A' }, { n: 'Turkos', c: '#22D3C5', d: '#0E9A8F' }, { n: 'Brun', c: '#9A5B2E', d: '#663615' },
    { n: 'Limegrön', c: '#B7F23C', d: '#7DB30E' }, { n: 'Mörkblå', c: '#3A2FA8', d: '#1F1770' }, { n: 'Vit', c: '#F4F1FF', d: '#BDB6E0' }
  ];
  function RNG(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  /* ---------- regler: en flaska = lista av färger nerifrån och upp ---------- */
  const top = t => t.length ? t[t.length - 1] : -1;
  const runLen = t => { if (!t.length) return 0; const c = top(t); let n = 0; for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++; return n; };
  const full = (t, cap) => t.length >= cap;
  const done = (t, cap) => t.length === cap && runLen(t) === cap;
  function canPour(tubes, i, j, cap) {
    if (i === j) return false;
    const a = tubes[i], b = tubes[j];
    if (!a.length || b.length >= cap) return false;
    return !b.length || top(b) === top(a);
  }
  function pourAmount(tubes, i, j, cap) { return Math.min(runLen(tubes[i]), cap - tubes[j].length); }
  function pour(tubes, i, j, cap) { const n = pourAmount(tubes, i, j, cap); const c = top(tubes[i]); for (let k = 0; k < n; k++) { tubes[i].pop(); tubes[j].push(c); } return n; }
  function solved(tubes, cap) { return tubes.every(t => !t.length || done(t, cap)); }

  /* ---------- lösare (djupet först med minne) – används för att garantera lösbara nivåer och för tips ---------- */
  const key = tubes => tubes.map(t => t.join(',')).sort().join('|');
  function solve(start, cap, limit) {
    limit = limit || 250000;
    const seen = new Set(), path = [];
    let nodes = 0;
    const tubes = start.map(t => t.slice());
    function moves() {
      const out = [];
      for (let i = 0; i < tubes.length; i++) {
        const a = tubes[i]; if (!a.length || done(a, cap)) continue;
        const rl = runLen(a), uniform = rl === a.length;
        let emptyTried = false;
        for (let j = 0; j < tubes.length; j++) {
          if (!canPour(tubes, i, j, cap)) continue;
          const b = tubes[j];
          if (!b.length) { if (uniform || emptyTried) continue; emptyTried = true; }
          const n = pourAmount(tubes, i, j, cap);
          // bra drag först: fyller upp en flaska med samma färg
          const score = (b.length ? 10 : 0) + (b.length + n === cap && runLen(b) + n === cap ? 20 : 0) + (n === rl ? 5 : 0);
          out.push([score, i, j]);
        }
      }
      return out.sort((x, y) => y[0] - x[0]);
    }
    function dfs() {
      if (solved(tubes, cap)) return true;
      if (++nodes > limit) return false;
      const k = key(tubes); if (seen.has(k)) return false; seen.add(k);
      for (const [, i, j] of moves()) {
        const n = pour(tubes, i, j, cap);
        path.push([i, j]);
        if (dfs()) return true;
        path.pop();
        const c = top(tubes[j]); for (let q = 0; q < n; q++) { tubes[j].pop(); tubes[i].push(c); }
        if (nodes > limit) return false;
      }
      return false;
    }
    const ok = dfs();
    return ok ? path : null;
  }

  /* ---------- nivåer ---------- */
  function levelInfo(L) {
    const n = Math.min(12, 3 + Math.floor((L - 1) / 4));                 // antal färger
    const empty = n >= 10 && L % 3 === 0 ? 3 : 2;                        // tomma flaskor
    const hidden = L >= 12 ? Math.min(.75, .25 + (L - 12) * .02) : 0;    // andel dolda lager (inte översta)
    return { n, empty, hidden, cap: CAP };
  }
  function makeLevel(L) {
    const info = levelInfo(L), { n, cap } = info;
    for (let attempt = 0; attempt < 400; attempt++) {
      const r = RNG(L * 7919 + attempt * 104729 + 13);
      const pool = []; for (let c = 0; c < n; c++) for (let k = 0; k < cap; k++) pool.push(c);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const tubes = []; for (let t = 0; t < n; t++) tubes.push(pool.slice(t * cap, t * cap + cap));
      // inte för lätt: ingen flaska får redan vara klar och inte för många lika i rad
      let bad = false;
      for (const t of tubes) { if (done(t, cap)) bad = true; let same = 0; for (let k = 1; k < cap; k++) if (t[k] === t[k - 1]) same++; if (same >= 2 && L > 3) bad = true; }
      if (bad) continue;
      for (let e = 0; e < info.empty; e++) tubes.push([]);
      const sol = solve(tubes, cap, n > 9 ? 120000 : 60000);
      if (!sol) continue;
      if (L > 6 && sol.length < n * 2) continue;   // för lätt
      // dolda lager: alla utom det översta i varje flaska kan vara dolda
      const hid = tubes.map(t => t.map((_, k) => k < t.length - 1 && r() < info.hidden));
      // blanda färgerna så att de första nivåerna inte alltid är röd/blå/gul
      const perm = [...Array(COLORS.length).keys()]; for (let i = perm.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      return { L, cap, tubes: tubes.map(t => t.map(c => perm[c])), hid, par: sol.length, info };
    }
    throw new Error('ingen nivå');
  }

  const SORT = { CAP, COLORS, RNG, top, runLen, done, canPour, pourAmount, pour, solved, solve, levelInfo, makeLevel };
  if (typeof module !== 'undefined' && module.exports) module.exports = SORT; else root.SORT = SORT;
})(this);
