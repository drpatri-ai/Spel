/* Bucinca Studs – fysik, banor, krafter och poäng (Peggle-likt).
   Allt räknas ut i förväg för ett helt skott och spelas sedan upp (repris), så i nätverksmatcher
   räknar värden och skickar reprisen till alla. Fungerar även i Node (tester). */
(function (root) {
  'use strict';
  const W = 800, H = 1000, BR = 9, PR = 13, CR = 7, G = 900, V0 = 640, DT = 1 / 120, REC = 2;
  const CX = 400, CY = 64, MUZZLE = 46;
  const BUCKET_Y = H - 30, BUCKET_W = 118, BIG_W = 200, RIM = 8;
  const E = 0.7;
  const FEVER = [10000, 25000, 50000, 25000, 10000], FEVER_Y = H - 46;
  const FREE_AT = [4000, 12000, 25000];
  const BASE = { b: 10, o: 100, g: 10, p: 500 };
  const N_ORANGE = 20, N_GREEN = 2;

  const POWERS = {
    guide: { name: 'Siktet', ic: '🎯', desc: 'Lång siktlinje i 3 skott' },
    multi: { name: 'Dubbelkulan', ic: '⚪', desc: 'En extra kula dyker upp' },
    fire: { name: 'Eldkulan', ic: '🔥', desc: 'Kulan bränner sig rakt igenom' },
    zap: { name: 'Blixten', ic: '⚡', desc: 'Tänder alla pinnar runt omkring' },
    bucket: { name: 'Jättehinken', ic: '🪣', desc: 'Stor hink i 3 skott' },
    spook: { name: 'Spökkulan', ic: '👻', desc: 'Kulan kommer tillbaka uppifrån' },
    bomb: { name: 'Bomben', ic: '💣', desc: 'Smäller och tänder pinnar' },
    lucky: { name: 'Turhjulet', ic: '🎰', desc: 'En slumpad kraft varje gång' },
    double: { name: 'Dubbelpoäng', ic: '💰', desc: 'Dubbla poäng i 3 skott' },
    tramp: { name: 'Studsmattan', ic: '🤸', desc: 'Golvet studsar upp kulan en gång' },
    hug: { name: 'Mormors kram', ic: '💖', desc: 'Två extra kulor' }
  };
  const CHAR_POW = ['guide', 'multi', 'fire', 'zap', 'bucket', 'spook', 'bomb', 'lucky', 'double', 'tramp', 'hug'];
  const LUCKY = ['multi', 'fire', 'zap', 'bomb', 'spook', 'tramp', 'double', 'bucket'];
  const powOf = ch => CHAR_POW[((ch | 0) % CHAR_POW.length + CHAR_POW.length) % CHAR_POW.length];

  function RNG(seed) {
    let a = seed >>> 0;
    const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.next = () => Math.floor(f() * 4294967296) >>> 0;
    return f;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const multOf = (lit, tot) => { const f = tot ? lit / tot : 0; return f >= .9 ? 10 : f >= .75 ? 5 : f >= .58 ? 3 : f >= .38 ? 2 : 1; };

  /* ================= BANOR ================= */
  // varje bana: fn(add) där add.peg(x,y,mover) / add.cap(x1,y1,x2,y2,mover) / add.mover(obj) → index
  const inField = (x, y) => x >= 26 && x <= W - 26 && y >= 150 && y <= 905;
  const LEVELS = [
    { name: 'Första studsen', ic: '🟠', build(A) {
      for (let r = 0; r < 11; r++) { const off = r % 2 ? 40 : 0; for (let x = 80 + off; x <= 720; x += 80) A.peg(x, 230 + r * 60); }
    } },
    { name: 'Regnbågen', ic: '🌈', build(A) {
      for (let k = 0; k < 5; k++) { const r = 230 + k * 78; const n = Math.round(Math.PI * r / 52); for (let i = 0; i <= n; i++) { const a = Math.PI + Math.PI * i / n; A.peg(400 + r * Math.cos(a), 900 + r * Math.sin(a) * 1.05); } }
    } },
    { name: 'Hjärtat', ic: '❤️', build(A) {
      const heart = (s, n, cy) => { for (let i = 0; i < n; i++) { const t = i / n * Math.PI * 2; A.peg(400 + s * 16 * Math.pow(Math.sin(t), 3), cy - s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))); } };
      heart(19, 44, 480); heart(11, 28, 470); heart(4.2, 10, 460);
      for (let x = 70; x <= 730; x += 55) A.peg(x, 850);
      for (let x = 97; x <= 703; x += 55) if (Math.abs(x - 400) > 120) A.peg(x, 790);
    } },
    { name: 'Snurrorna', ic: '🌀', build(A) {
      const m1 = A.mover({ t: 'rot', cx: 220, cy: 420, w: .7 }), m2 = A.mover({ t: 'rot', cx: 580, cy: 420, w: -.7 });
      for (const [cx, m] of [[220, m1], [580, m2]]) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; A.peg(cx + 130 * Math.cos(a), 420 + 130 * Math.sin(a), m); } for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; A.peg(cx + 58 * Math.cos(a), 420 + 58 * Math.sin(a), m); } A.peg(cx, 420); }
      A.peg(400, 300); A.peg(400, 420); A.peg(400, 540);
      for (let i = 0; i < 9; i++) { const x = 60 + i * 85; A.cap(x, 700 + (i % 2) * 18, x + 52, 700 + (1 - i % 2) * 18); }
      for (let r = 0; r < 2; r++) for (let x = 90 + r * 45; x <= 720; x += 90) A.peg(x, 790 + r * 55);
    } },
    { name: 'Trappan', ic: '🪜', build(A) {
      for (let s = 0; s < 6; s++) {
        const y = 240 + s * 110, left = s % 2 === 0;
        for (let i = 0; i < 5; i++) { const x = left ? 50 + i * 82 : 750 - i * 82, x2 = left ? x + 60 : x - 60, dy = 9; A.cap(x, y + i * 14, x2, y + i * 14 + dy); }
        for (let i = 0; i < 4; i++) A.peg(left ? 520 + i * 62 : 280 - i * 62, y + 30 + i * 10);
      }
      for (let x = 100; x <= 700; x += 100) A.peg(x, 905 - 30);
    } },
    { name: 'Spiralen', ic: '🐌', build(A) {
      const m = A.mover({ t: 'rot', cx: 400, cy: 520, w: .32 });
      let th = 1.2; while (true) { const r = 18 + 21 * th; if (r > 350) break; A.peg(400 + r * Math.cos(th), 520 + r * Math.sin(th), m); th += 46 / Math.max(r, 30); }
      A.peg(400, 520);
    } },
    { name: 'Smilet', ic: '😊', build(A) {
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; A.peg(400 + 320 * Math.cos(a), 530 + 320 * Math.sin(a)); }
      for (const ex of [285, 515]) { const m = A.mover({ t: 'rot', cx: ex, cy: 420, w: ex < 400 ? 1.1 : -1.1 }); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; A.peg(ex + 52 * Math.cos(a), 420 + 52 * Math.sin(a), m); } A.peg(ex, 420); }
      for (let i = 0; i < 9; i++) { const a1 = .3 + i * .28, a2 = a1 + .2; A.cap(400 + 180 * Math.cos(a1), 540 + 180 * Math.sin(a1), 400 + 180 * Math.cos(a2), 540 + 180 * Math.sin(a2)); }
      A.peg(400, 530); A.peg(380, 580); A.peg(420, 580);
    } },
    { name: 'Vågorna', ic: '🌊', build(A) {
      for (let i = 0; i < 7; i++) { const m = A.mover({ t: 'osc', ax: i % 2 ? 55 : -55, ay: 0, w: .8, ph: i * .7 }); const y0 = 240 + i * 100; for (let x = 60; x <= 740; x += 58) A.peg(x, y0 + 28 * Math.sin(x / 85 + i), i % 3 === 1 ? m : null); }
    } },
    { name: 'Pyramiden', ic: '🔺', build(A) {
      for (let k = 0; k < 11; k++) { const n = k + 3, y = 230 + k * 58; for (let i = 0; i < n; i++) A.peg(400 + (i - (n - 1) / 2) * 56, y); }
      A.cap(60, 850, 160, 870); A.cap(740, 850, 640, 870);
    } },
    { name: 'Blomman', ic: '🌸', build(A) {
      const cx = 400, cy = 430, m = A.mover({ t: 'rot', cx, cy, w: .35 });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; A.peg(cx + 48 * Math.cos(a), cy + 48 * Math.sin(a), m); }
      for (let p = 0; p < 6; p++) { const pa = p / 6 * Math.PI * 2; for (let i = 0; i < 11; i++) { const t = i / 11 * Math.PI * 2, lx = 150 + 70 * Math.cos(t), ly = 52 * Math.sin(t); if (lx < 95) continue; A.peg(cx + lx * Math.cos(pa) - ly * Math.sin(pa), cy + lx * Math.sin(pa) + ly * Math.cos(pa), m); } }
      for (let y = 680; y <= 880; y += 40) A.cap(400, y, 400, y + 24);
      for (const s of [-1, 1]) { for (let i = 0; i < 6; i++) { const t = i / 5; A.peg(400 + s * (40 + 150 * Math.sin(t * Math.PI) * .9 + t * 60), 760 - t * 60 + 40 * Math.sin(t * Math.PI)); } }
    } },
    { name: 'Stjärnan', ic: '⭐', build(A) {
      const cx = 400, cy = 500, m = A.mover({ t: 'rot', cx, cy, w: .4 });
      const pt = i => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 125 : 300; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
      for (let i = 0; i < 10; i++) { const [x1, y1] = pt(i), [x2, y2] = pt(i + 1); for (let s = 0; s < 3; s++) { const t1 = s / 3 + .03, t2 = (s + 1) / 3 - .03; A.cap(x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1, x1 + (x2 - x1) * t2, y1 + (y2 - y1) * t2, m); } }
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; A.peg(cx + 60 * Math.cos(a), cy + 60 * Math.sin(a), m); }
      for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; const x = cx + 360 * Math.cos(a), y = cy + 360 * Math.sin(a); if (inField(x, y)) A.peg(x, y); }
      for (const [x, y] of [[80, 200], [720, 200], [80, 880], [720, 880], [140, 250], [660, 250]]) A.peg(x, y);
    } },
    { name: 'Klockan', ic: '🕰️', build(A) {
      const cx = 400, cy = 520;
      for (let i = 0; i < 44; i++) { const a = i / 44 * Math.PI * 2; A.peg(cx + 330 * Math.cos(a), cy + 330 * Math.sin(a)); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; A.cap(cx + 255 * Math.cos(a), cy + 255 * Math.sin(a), cx + 290 * Math.cos(a), cy + 290 * Math.sin(a)); }
      const mh = A.mover({ t: 'rot', cx, cy, w: .35 }), mm = A.mover({ t: 'rot', cx, cy, w: -1.0 });
      for (let i = 0; i < 4; i++) A.cap(cx + 30 + i * 42, cy, cx + 62 + i * 42, cy, mh);
      for (let i = 0; i < 5; i++) A.cap(cx, cy - 30 - i * 42, cx, cy - 62 - i * 42, mm);
      for (let i = 0; i < 4; i++) A.cap(cx, cy + 30 + i * 42, cx, cy + 62 + i * 42, mm);
      A.peg(cx, cy);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + .2; A.peg(cx + 205 * Math.cos(a), cy + 205 * Math.sin(a)); }
    } }
  ];

  function makeBoard(lv, seed) {
    const L = LEVELS[lv % LEVELS.length];
    const pegs = [], movers = [];
    const A = {
      mover: o => (movers.push(o), movers.length - 1),
      peg: (x, y, m) => { if (!inField(x, y)) return; pegs.push({ id: pegs.length, s: 'c', x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, m: m == null ? -1 : m, k: 'b' }); },
      cap: (x1, y1, x2, y2, m) => { if (!inField(x1, y1) || !inField(x2, y2)) return; pegs.push({ id: pegs.length, s: 'k', x: x1, y: y1, x2, y2, m: m == null ? -1 : m, k: 'b' }); }
    };
    L.build(A);
    const rng = RNG(seed);
    const idx = pegs.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    const nO = Math.min(N_ORANGE, Math.floor(pegs.length * .3));
    for (let i = 0; i < nO; i++) pegs[idx[i]].k = 'o';
    for (let i = nO; i < nO + N_GREEN; i++) pegs[idx[i]].k = 'g';
    const b = { lv: lv % LEVELS.length, pegs, movers, clock: 0, nO, litO: 0, purple: -1 };
    pickPurple(b, rng);
    return b;
  }
  function pickPurple(b, rng) {
    if (b.purple >= 0) { const p = b.pegs[b.purple]; if (p && !p.gone && p.k === 'p') p.k = 'b'; }
    const blues = b.pegs.filter(p => p.k === 'b' && !p.gone);
    b.purple = blues.length ? blues[Math.floor(rng() * blues.length)].id : -1;
    if (b.purple >= 0) b.pegs[b.purple].k = 'p';
  }

  /* pinnens läge vid tiden c */
  function pos(b, p, c, out) {
    out = out || {};
    const m = p.m >= 0 ? b.movers[p.m] : null;
    let x = p.x, y = p.y, x2 = p.x2, y2 = p.y2;
    if (m) {
      if (m.t === 'rot') {
        const a = m.w * c, cs = Math.cos(a), sn = Math.sin(a);
        const rx = (px, py) => [m.cx + (px - m.cx) * cs - (py - m.cy) * sn, m.cy + (px - m.cx) * sn + (py - m.cy) * cs];
        [x, y] = rx(x, y); if (p.s === 'k') [x2, y2] = rx(x2, y2);
      } else {
        const o = Math.sin(m.w * c + (m.ph || 0));
        x += m.ax * o; y += m.ay * o; if (p.s === 'k') { x2 += m.ax * o; y2 += m.ay * o; }
      }
    }
    out.x = x; out.y = y; out.x2 = x2; out.y2 = y2;
    return out;
  }
  const bucketX = c => W / 2 + 300 * Math.sin(c * .8);

  /* en kulas steg: rörelse, väggar och pinnar. onHit(p, ball) → true om kulan ska studsa */
  const _a = {}, _b = {};
  function stepBall(ball, b, c, onHit) {
    ball.vy += G * DT;
    ball.x += ball.vx * DT; ball.y += ball.vy * DT;
    if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * .9; }
    if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx) * .9; }
    if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy) * .9; }
    const pegs = b.pegs;
    for (let i = 0; i < pegs.length; i++) {
      const p = pegs[i]; if (p.gone) continue;
      const q = pos(b, p, c, _a);
      let px, py, rr;
      if (p.s === 'c') { px = q.x; py = q.y; rr = PR; }
      else {
        const dx = q.x2 - q.x, dy = q.y2 - q.y, L2 = dx * dx + dy * dy;
        const t = L2 ? clamp(((ball.x - q.x) * dx + (ball.y - q.y) * dy) / L2, 0, 1) : 0;
        px = q.x + dx * t; py = q.y + dy * t; rr = CR;
      }
      const ddx = ball.x - px, ddy = ball.y - py, R = rr + BR, d2 = ddx * ddx + ddy * ddy;
      if (d2 >= R * R) continue;
      const bounce = onHit ? onHit(p, ball) : true;
      if (!bounce) continue;
      const d = Math.sqrt(d2) || .001, nx = ddx / d, ny = ddy / d;
      ball.x = px + nx * R; ball.y = py + ny * R;
      // pinnens egen fart (snurrande/vandrande pinnar ger en knuff)
      let pvx = 0, pvy = 0;
      if (p.m >= 0) { const q2 = pos(b, p, c + DT, _b); pvx = (q2.x - q.x) / DT; pvy = (q2.y - q.y) / DT; if (p.s === 'k') { pvx = ((q2.x + q2.x2) - (q.x + q.x2)) / 2 / DT; pvy = ((q2.y + q2.y2) - (q.y + q.y2)) / 2 / DT; } }
      const rvx = ball.vx - pvx, rvy = ball.vy - pvy, vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const tx = rvx - vn * nx, ty = rvy - vn * ny;
        ball.vx = pvx + tx * .985 - vn * E * nx; ball.vy = pvy + ty * .985 - vn * E * ny;
      }
    }
  }

  /* ================= SPEL ================= */
  function newGame(lv, players, seed) {
    seed = (seed >>> 0) || 1;
    const N = players.length;
    const balls = N === 1 ? 10 : Math.max(4, Math.round(20 / N));
    return {
      v: 1, seed, lv, board: makeBoard(lv, seed), turn: 0, shots: 0, fever: false, over: false, won: false,
      players: players.map(p => ({ id: p.id, name: p.name, ch: p.ch, pow: powOf(p.ch), score: 0, balls, fx: { guide: 0, bucket: 0, double: 0 }, orange: 0 }))
    };
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const r1 = v => Math.round(v * 10) / 10;
  const ANG_MIN = 4 * Math.PI / 180, ANG_MAX = 176 * Math.PI / 180;

  function shoot(S0, angle) {
    const S = clone(S0), b = S.board, rng = RNG(S.seed);
    S.seed = rng.next() || 7;
    const pl = S.players[S.turn];
    angle = clamp(+angle || Math.PI / 2, ANG_MIN, ANG_MAX);
    pl.balls--; S.shots++;
    if (pl.fx.guide > 0) pl.fx.guide--;
    let big = pl.fx.bucket > 0; if (big) pl.fx.bucket--;
    let dbl = pl.fx.double > 0; if (dbl) pl.fx.double--;
    const ev = [], fr = [];
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const balls = [{ x: CX + dx * MUZZLE, y: CY + dy * MUZZLE, vx: dx * V0, vy: dy * V0, fire: 0, hist: [], ht: 0 }];
    let spook = 0, tramp = 0, shotPts = 0, hitN = 0, freeN = 0, t = 0, f = 0, steps = 0;
    const startScore = pl.score;
    const addPts = (pts, x, y) => {
      shotPts += pts; pl.score += pts;
      while (freeN < FREE_AT.length && shotPts >= FREE_AT[freeN]) { freeN++; pl.balls++; ev.push({ f, e: 'free', why: 'pts', x: r1(x), y: r1(y) }); }
    };
    const light = (p, ball) => {
      if (p.hit || p.gone) return;
      p.hit = 1; hitN++;
      const mult = multOf(b.litO, b.nO);
      const pts = BASE[p.k] * mult * (dbl ? 2 : 1);
      const q = pos(b, p, b.clock);
      const cx = p.s === 'k' ? (q.x + q.x2) / 2 : q.x, cy = p.s === 'k' ? (q.y + q.y2) / 2 : q.y;
      ev.push({ f, e: 'hit', id: p.id, pts, n: hitN, m: mult });
      if (p.k === 'o') { b.litO++; pl.orange++; }
      addPts(pts, cx, cy);
      if (p.k === 'g') power(pl.pow, p, ball, cx, cy);
      if (p.k === 'o' && b.litO >= b.nO && !S.fever) { S.fever = true; ev.push({ f, e: 'fever', x: r1(cx), y: r1(cy) }); }
    };
    const power = (pw, p, ball, x, y) => {
      if (pw === 'lucky') { pw = LUCKY[Math.floor(rng() * LUCKY.length)]; ev.push({ f, e: 'lucky', p: pw }); }
      ev.push({ f, e: 'pow', p: pw, x: r1(x), y: r1(y) });
      if (pw === 'guide') pl.fx.guide += 3;
      else if (pw === 'multi') { if (ball) balls.push({ x: x, y: y - 2, vx: -ball.vx || 120, vy: Math.min(ball.vy, -150), fire: ball.fire, hist: [], ht: t }); }
      else if (pw === 'fire') { for (const bl of balls) bl.fire = 1; }
      else if (pw === 'bucket') { big = true; pl.fx.bucket += 2; }
      else if (pw === 'double') { dbl = true; pl.fx.double += 2; }
      else if (pw === 'spook') spook++;
      else if (pw === 'tramp') tramp++;
      else if (pw === 'hug') { pl.balls += 2; ev.push({ f, e: 'free', why: 'hug', x: r1(x), y: r1(y) }); }
      else if (pw === 'zap' || pw === 'bomb') {
        const R = pw === 'zap' ? 165 : 200;
        const near = [];
        for (const o of b.pegs) { if (o.hit || o.gone) continue; const q = pos(b, o, b.clock); const ox = o.s === 'k' ? (q.x + q.x2) / 2 : q.x, oy = o.s === 'k' ? (q.y + q.y2) / 2 : q.y; const d = Math.hypot(ox - x, oy - y); if (d < R) near.push([d, o]); }
        near.sort((a, c) => a[0] - c[0]);
        for (const [, o] of near) light(o, null);
        if (pw === 'bomb' && ball) { const a = Math.atan2(ball.y - y, ball.x - x); ball.vx += Math.cos(a) * 380; ball.vy += Math.sin(a) * 380 - 150; }
      }
    };
    const removeLit = () => { const ids = []; for (const p of b.pegs) if (p.hit && !p.gone) { p.gone = 1; ids.push(p.id); } if (ids.length) ev.push({ f, e: 'rm', ids }); return ids.length; };
    const onHit = (p, ball) => { light(p, ball); return !ball.fire; };
    let fever = S.fever;
    while (balls.length && t < 30) {
      if (t > 15 && steps % 360 === 0) removeLit();
      for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        stepBall(ball, b, b.clock, onHit);
        if (S.fever && !fever) fever = true;
        // hink eller feberhinkar
        const bx = bucketX(b.clock), w = big ? BIG_W : BUCKET_W;
        if (!fever) {
          for (const rx of [bx - w / 2, bx + w / 2]) {
            const ddx = ball.x - rx, ddy = ball.y - BUCKET_Y, R = RIM + BR, d2 = ddx * ddx + ddy * ddy;
            if (d2 < R * R) { const d = Math.sqrt(d2) || .001, nx = ddx / d, ny = ddy / d; ball.x = rx + nx * R; ball.y = BUCKET_Y + ny * R; const vn = ball.vx * nx + ball.vy * ny; if (vn < 0) { ball.vx -= 1.6 * vn * nx; ball.vy -= 1.6 * vn * ny; } }
          }
          if (ball.y > BUCKET_Y + 4 && ball.vy > 0 && Math.abs(ball.x - bx) < w / 2 - RIM && ball.y < BUCKET_Y + 40) {
            balls.splice(i, 1); pl.balls++; ev.push({ f, e: 'free', why: 'bucket', x: r1(ball.x), y: BUCKET_Y }); continue;
          }
        } else {
          for (let k = 1; k < FEVER.length; k++) { const rx = k * W / FEVER.length; if (Math.abs(ball.x - rx) < BR + 6 && ball.y > FEVER_Y - 10) { ball.vx = (ball.x < rx ? -1 : 1) * Math.abs(ball.vx) * .7; ball.x = rx + (ball.x < rx ? -1 : 1) * (BR + 6); } }
          if (ball.y > FEVER_Y + 14) {
            const k = clamp(Math.floor(ball.x / (W / FEVER.length)), 0, FEVER.length - 1);
            balls.splice(i, 1); pl.score += FEVER[k]; ev.push({ f, e: 'slot', k, pts: FEVER[k] }); continue;
          }
        }
        if (ball.y > H + BR) {
          if (spook > 0) { spook--; ball.y = BR + 1; ev.push({ f, e: 'spook', x: r1(ball.x) }); }
          else if (tramp > 0) { tramp--; ball.y = H - BR - 1; ball.vy = -Math.max(760, Math.abs(ball.vy) * .9); ev.push({ f, e: 'tramp', x: r1(ball.x) }); }
          else { balls.splice(i, 1); continue; }
        }
        // fast? ta bort tända pinnar tidigt (som i Peggle), annars en liten knuff
        if (t - ball.ht >= .5) {
          ball.ht = t; ball.hist.push([ball.x, ball.y]); if (ball.hist.length > 5) ball.hist.shift();
          if (ball.hist.length === 5) {
            let mx = 0; for (const h of ball.hist) mx = Math.max(mx, Math.hypot(h[0] - ball.x, h[1] - ball.y));
            if (mx < 22) { if (!removeLit()) { ball.vx += (rng() - .5) * 260; ball.vy -= 160; } ball.hist.length = 0; }
          }
        }
      }
      b.clock += DT; t += DT; steps++;
      if (steps % REC === 0 || !balls.length) {
        const fb = []; for (const bl of balls) fb.push(r1(bl.x), r1(bl.y), bl.fire);
        fr.push({ c: Math.round(b.clock * 1000) / 1000, b: fb, bk: big ? 1 : 0 });
        f = fr.length;
      }
    }
    f = fr.length - 1;
    removeLit();
    b.clock = Math.round(b.clock * 1000) / 1000;
    const res = { pts: pl.score - startScore, hits: hitN };
    if (S.fever) {
      S.over = true; S.won = true; S.winner = S.turn;
      if (S.players.length === 1) { const bonus = pl.balls * 5000; if (bonus) { pl.score += bonus; res.ballBonus = bonus; } }
    } else {
      pickPurple(b, rng);
      if (S.players.every(p => p.balls <= 0)) { S.over = true; S.won = false; }
      else { let n = S.turn; do { n = (n + 1) % S.players.length; } while (S.players[n].balls <= 0); S.turn = n; }
    }
    if (S.over && S.players.length > 1) { let best = 0; S.players.forEach((p, i) => { if (p.score > S.players[best].score) best = i; }); S.winner = best; }
    return { rec: { fr, ev, who: S0.turn, angle, c0: S0.board.clock, big0: S0.players[S0.turn].fx.bucket > 0 }, S, res };
  }

  /* siktlinje: följ en spökkula utan att tända något */
  function aimPath(S, angle, long) {
    const b = S.board, pts = [];
    angle = clamp(angle, ANG_MIN, ANG_MAX);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const ball = { x: CX + dx * MUZZLE, y: CY + dy * MUZZLE, vx: dx * V0, vy: dy * V0 };
    let c = b.clock, hits = 0, touching = false, n = 0;
    const max = long ? 3 : 1;
    pts.push([ball.x, ball.y]);
    for (let s = 0; s < (long ? 420 : 300); s++) {
      let hit = false;
      stepBall(ball, b, c, () => { hit = true; return true; });
      c += DT;
      if (hit && !touching) { hits++; pts.push([ball.x, ball.y]); if (hits >= max) break; }
      touching = hit;
      if (++n % 3 === 0) pts.push([ball.x, ball.y]);
      if (ball.y > H) break;
    }
    return pts;
  }

  const PG = { W, H, BR, PR, CR, CX, CY, MUZZLE, BUCKET_Y, BUCKET_W, BIG_W, RIM, FEVER, FEVER_Y, BASE, LEVELS, POWERS, CHAR_POW, powOf,
    ANG_MIN, ANG_MAX, makeBoard, newGame, shoot, aimPath, pos, bucketX, multOf, RNG, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = PG; else root.PG = PG;
})(this);
