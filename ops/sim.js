/* Bucinca Operation Öken – lagspel uppifrån: röda anfaller (sprängladdning), blå försvarar.
   Karta, vapen, köp, ronder, granater, laddningen och datorspelare. Körs lokalt eller hos värden (60 steg/s). Fungerar i Node. */
(function (root) {
  'use strict';
  const DT = 1 / 60, CS = 64, PR = 16;

  /* ================= KARTAN "Sandstaden" (egen design) ================= */
  const GW = 40, GH = 34, W = GW * CS, H = GH * CS;
  const grid = new Uint8Array(GW * GH).fill(1);       // 1 vägg, 0 golv, 2 låda
  const carve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * GW + x] = 0; };
  const wall = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * GW + x] = v == null ? 1 : v; };
  carve(16, 2, 23, 7);     // blå start
  carve(2, 2, 11, 10);     // B
  carve(28, 2, 37, 10);    // A
  carve(11, 4, 16, 6);     // blå → B
  carve(23, 4, 28, 6);     // blå → A
  carve(18, 8, 21, 26);    // mitten
  carve(22, 15, 28, 16); carve(27, 10, 28, 16);   // korta vägen till A
  carve(25, 27, 36, 28); carve(34, 11, 36, 28);   // långa gången
  carve(13, 27, 26, 31);   // röd start
  carve(3, 28, 13, 29); carve(3, 11, 5, 29);      // tunnlarna till B
  carve(6, 19, 17, 20);    // nedre tunneln mitten → tunnlarna
  carve(12, 8, 17, 9);     // B-fönstret mot mitten
  wall(18, 12, 19, 12);    // mittdörrarna
  wall(34, 22, 35, 22);    // dörrarna på långa
  wall(4, 16, 5, 16);      // smal passage i tunneln
  // lådor
  for (const [x, y] of [[6, 5], [7, 5], [6, 6], [9, 8], [31, 5], [32, 5], [31, 6], [30, 8], [19, 17], [29, 28], [16, 29], [23, 29], [24, 16], [8, 2], [35, 3], [10, 28], [20, 4]]) grid[y * GW + x] = 2;
  const SITES = { A: { x0: 29, y0: 3, x1: 36, y1: 9, label: [32.5, 6.5] }, B: { x0: 3, y0: 3, x1: 10, y1: 9, label: [5.5, 4.5] } };
  const SPAWN = [[], []];   // 0 = röda (start i söder), 1 = blå (start i norr)
  for (let y = 28; y <= 30; y++) for (let x = 15; x <= 24; x += 2) SPAWN[0].push([(x + .5) * CS, (y + .5) * CS]);
  for (let y = 3; y <= 6; y++) for (let x = 17; x <= 22; x += 2) SPAWN[1].push([(x + .5) * CS, (y + .5) * CS]);
  const SPAWN_ZONE = [{ x0: 13, y0: 27, x1: 26, y1: 31 }, { x0: 16, y0: 2, x1: 23, y1: 7 }];
  const solidAt = (cx, cy) => cx < 0 || cy < 0 || cx >= GW || cy >= GH || grid[cy * GW + cx] !== 0;
  const solidXY = (x, y) => solidAt(Math.floor(x / CS), Math.floor(y / CS));
  const inZone = (z, x, y) => { const cx = Math.floor(x / CS), cy = Math.floor(y / CS); return cx >= z.x0 && cx <= z.x1 && cy >= z.y0 && cy <= z.y1; };

  /* stråle genom rutnätet (DDA): avstånd till första vägg, max len */
  function rayWall(x, y, dx, dy, len) {
    let cx = Math.floor(x / CS), cy = Math.floor(y / CS);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CS / dx) : 1e9, tdy = dy !== 0 ? Math.abs(CS / dy) : 1e9;
    let tx = dx !== 0 ? ((dx > 0 ? (cx + 1) * CS - x : x - cx * CS) / Math.abs(dx)) : 1e9;
    let ty = dy !== 0 ? ((dy > 0 ? (cy + 1) * CS - y : y - cy * CS) / Math.abs(dy)) : 1e9;
    let t = 0;
    while (t < len) {
      if (tx < ty) { t = tx; tx += tdx; cx += sx; } else { t = ty; ty += tdy; cy += sy; }
      if (solidAt(cx, cy)) return Math.min(t, len);
    }
    return len;
  }
  // rök blockerar sikt (inte kulor)
  function raySmoke(x, y, dx, dy, len, smokes) {
    let best = len;
    for (const s of smokes) {
      if (s.t < .6) continue;
      const R = s.r, fx = x - s.x, fy = y - s.y, b = fx * dx + fy * dy, c = fx * fx + fy * fy - R * R;
      if (c < 0) return 0;
      const disc = b * b - c; if (disc < 0) continue;
      const t = -b - Math.sqrt(disc); if (t >= 0 && t < best) best = t;
    }
    return best;
  }
  function canSee(x1, y1, x2, y2, smokes) {
    const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy); if (d < 1) return true;
    const ux = dx / d, uy = dy / d;
    return rayWall(x1, y1, ux, uy, d) >= d - 1 && (!smokes || raySmoke(x1, y1, ux, uy, d, smokes) >= d - 1);
  }

  /* ================= VAPEN OCH KÖP ================= */
  const WEAPONS = {
    pistol: { name: 'Pistol', ic: '🔫', slot: 1, price: 0, dmg: 22, rate: .2, spread: .035, mag: 12, res: 36, rel: 1.5, spd: 1, n: 1, range: 1400, rew: 300 },
    smg: { name: 'Kulsprutepistol', ic: '🔫', slot: 0, price: 1200, dmg: 17, rate: .085, spread: .07, mag: 30, res: 90, rel: 2.1, spd: .98, n: 1, range: 1300, rew: 500 },
    shotgun: { name: 'Hagelgevär', ic: '💥', slot: 0, price: 1100, dmg: 13, rate: .85, spread: .22, mag: 7, res: 28, rel: 2.6, spd: .95, n: 8, range: 650, rew: 600 },
    rifle: { name: 'Automatkarbin', ic: '🎯', slot: 0, price: 2700, dmg: 30, rate: .1, spread: .03, mag: 30, res: 90, rel: 2.4, spd: .92, n: 1, range: 2200, rew: 300 },
    sniper: { name: 'Prickskyttegevär', ic: '🔭', slot: 0, price: 4750, dmg: 115, rate: 1.3, spread: .004, mag: 5, res: 20, rel: 3.3, spd: .85, n: 1, range: 3200, rew: 100, moveSpread: .18 }
  };
  const ITEMS = {
    armor: { name: 'Skyddsväst', ic: '🦺', price: 650 },
    he: { name: 'Handgranat', ic: '💣', price: 300 },
    smoke: { name: 'Rökgranat', ic: '💨', price: 300 },
    flash: { name: 'Bländgranat', ic: '⚡', price: 200 },
    kit: { name: 'Desarmeringskit', ic: '🔧', price: 400, side: 1 }
  };
  const MONEY = { start: 800, max: 16000, win: 3250, lose: 1400, loseStep: 500, plant: 300 };
  const T_FREEZE = 3, T_BUY = 18, T_ROUND = 115, T_BOMB = 35, T_PLANT = 3, T_DEF = 5, T_DEF_KIT = 3, T_END = 4.5;

  function RNG(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  /* ================= MATCHEN ================= */
  // spelare: { id, name, ch, side: 0 röd/1 blå, bot: nivå 1–10 eller -1 }
  class Game {
    constructor(players, opt = {}) {
      this.opt = Object.assign({ win: 7 }, opt);
      this.rng = RNG(opt.seed || ((Math.random() * 1e9) | 0));
      this.P = []; this.nades = []; this.smokes = []; this.ev = []; this.evSeq = 0;
      this.score = [0, 0]; this.round = 0; this.lossStreak = [0, 0]; this.over = false; this.winner = -1;
      this.bomb = null;
      for (const p of players) this.addPlayer(p, true);
      this.newRound();
    }
    emit(e, o) { this.ev.push(Object.assign({ id: ++this.evSeq, e }, o || {})); if (this.ev.length > 100) this.ev.shift(); }
    addPlayer(p, initial) {
      const q = {
        id: p.id, name: p.name || '', ch: p.ch | 0, side: p.side & 1, bot: p.bot == null ? -1 : p.bot,
        x: 0, y: 0, vx: 0, vy: 0, a: 0, hp: 100, armor: 0, alive: false, money: MONEY.start,
        prim: null, pist: { w: 'pistol', mag: 12, res: 36 }, cur: 'pist', he: 0, smoke: 0, flash: 0, kit: 0,
        fireT: 0, relT: 0, recoil: 0, blind: 0, plantT: 0, defT: 0,
        kills: 0, deaths: 0, dmg: 0, plants: 0, defuses: 0, out: false,
        in: { mx: 0, my: 0, ax: 0, ay: 0, fire: 0, act: 0 }, press: {}, ai: { t: 0, goal: null, seen: null, seenT: 0, react: 0, strafe: 1 }
      };
      this.P.push(q);
      if (!initial) { q.alive = false; this.emit('join', { p: q.id }); }   // kommer in nästa rond
      return q;
    }
    removePlayer(id) { const p = this.P.find(q => q.id === id); if (!p) return; if (p.alive && this.bomb && this.bomb.carrier === p.id) this.dropBomb(p); p.alive = false; p.out = true; }
    setInput(id, inp) {
      const p = this.P.find(q => q.id === id); if (!p || !inp) return;
      const n = v => (typeof v === 'number' && isFinite(v)) ? clamp(v, -1, 1) : 0;
      p.in = { mx: n(inp.mx), my: n(inp.my), ax: n(inp.ax), ay: n(inp.ay), fire: inp.fire ? 1 : 0, act: inp.act ? 1 : 0 };
      for (const k of ['reload', 'swap', 'he', 'smoke', 'flash']) if (inp[k]) p.press[k] = 1;
      if (inp.buy && typeof inp.buy === 'string') p.press.buy = inp.buy;
    }

    /* ---------- ronder ---------- */
    newRound() {
      this.round++;
      this.phase = 'freeze'; this.t = 0; this.time = T_ROUND; this.bomb = null; this.nades = []; this.smokes = [];
      const sp = [SPAWN[0].slice(), SPAWN[1].slice()];
      for (const s of sp) for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
      for (const p of this.P) {
        if (p.out) continue;
        const [x, y] = sp[p.side].pop() || SPAWN[p.side][0];
        p.x = x; p.y = y; p.vx = p.vy = 0; p.a = p.side ? Math.PI / 2 : -Math.PI / 2;
        if (!p.alive) { p.prim = null; p.armor = 0; p.he = p.smoke = p.flash = 0; p.kit = 0; p.pist = { w: 'pistol', mag: 12, res: 36 }; }
        p.alive = true; p.hp = 100; p.cur = p.prim ? 'prim' : 'pist'; p.blind = 0; p.plantT = p.defT = 0; p.relT = 0; p.recoil = 0;
        p.ai = { t: 0, goal: null, seen: null, seenT: 0, react: 0, strafe: this.rng() < .5 ? 1 : -1, bought: false };
      }
      // laddningen till en slumpad röd
      const reds = this.P.filter(p => !p.out && p.side === 0);
      if (reds.length) this.bomb = { carrier: reds[Math.floor(this.rng() * reds.length)].id, x: 0, y: 0, planted: false, t: 0, site: null };
      this.siteGoal = this.rng() < .5 ? 'A' : 'B'; this.intel = [null, null];
      this.emit('round', { r: this.round });
    }
    endRound(win, why) {
      if (this.phase === 'end') return;
      this.phase = 'end'; this.t = 0; this.score[win]++; this.lastWin = win; this.lastWhy = why;
      const lose = 1 - win;
      this.lossStreak[win] = 0; this.lossStreak[lose] = Math.min(4, this.lossStreak[lose] + 1);
      for (const p of this.P) {
        if (p.out) continue;
        const add = p.side === win ? MONEY.win : MONEY.lose + MONEY.loseStep * (this.lossStreak[lose] - 1);
        p.money = Math.min(MONEY.max, p.money + add);
      }
      this.emit('rend', { w: win, why, sc: this.score.slice() });
      if (this.score[win] >= this.opt.win) { this.over = true; this.winner = win; this.emit('end', { w: win }); }
    }

    step() {
      const dt = DT; this.t += dt;
      if (this.phase === 'freeze') { if (this.t >= T_FREEZE) { this.phase = 'live'; this.t = 0; this.emit('go'); } }
      else if (this.phase === 'live') {
        if (this.bomb && this.bomb.planted) { this.bomb.t -= dt; if (this.bomb.t <= 0) { this.explodeBomb(); } }
        else { this.time -= dt; if (this.time <= 0) this.endRound(1, 'time'); }
      } else if (this.phase === 'end') {
        if (this.t >= T_END && !this.over) this.newRound();
      }
      const live = this.phase === 'live' || this.phase === 'end';
      for (const p of this.P) if (p.alive && p.bot >= 0) this.botThink(p, dt);
      for (const p of this.P) this.playerStep(p, dt, live);
      this.collidePlayers();
      this.nadesStep(dt);
      for (const s of this.smokes) s.t += dt;
      this.smokes = this.smokes.filter(s => s.t < 13);
      if (this.phase === 'live') this.checkElim();
    }
    buyOK(p) { return p.alive && (this.phase === 'freeze' || (this.phase === 'live' && T_ROUND - this.time < T_BUY)) && inZone(SPAWN_ZONE[p.side], p.x, p.y); }
    buy(p, what) {
      if (!this.buyOK(p)) return;
      const Wp = WEAPONS[what], It = ITEMS[what];
      const price = Wp ? Wp.price : It ? It.price : 1e9;
      if (p.money < price) return;
      if (Wp && Wp.slot === 0) { if (p.prim && p.prim.w === what) return; p.prim = { w: what, mag: Wp.mag, res: Wp.res }; p.cur = 'prim'; }
      else if (what === 'armor') { if (p.armor >= 100) return; p.armor = 100; }
      else if (what === 'he' || what === 'smoke' || what === 'flash') { if (p[what] >= 1) return; p[what] = 1; }
      else if (what === 'kit') { if (p.side !== 1 || p.kit) return; p.kit = 1; }
      else return;
      p.money -= price;
      this.emit('buy', { p: p.id, w: what });
    }
    gun(p) { return p.cur === 'prim' && p.prim ? p.prim : p.pist; }
    playerStep(p, dt, live) {
      if (!p.alive) return;
      p.blind = Math.max(0, p.blind - dt); p.fireT -= dt; p.recoil = Math.max(0, p.recoil - dt * 2.2);
      const I = p.in, pr = p.press; p.press = {};
      if (pr.buy) this.buy(p, pr.buy);
      const g = this.gun(p), Wp = WEAPONS[g.w];
      // rörelse (ingen under frysning)
      let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      const busy = p.plantT > 0 || p.defT > 0;
      const sp = this.phase === 'freeze' || busy ? 0 : 215 * Wp.spd * (p.relT > 0 ? .9 : 1);
      p.vx = mx * sp; p.vy = my * sp;
      this.move(p, p.vx * dt, p.vy * dt);
      if (Math.hypot(I.ax, I.ay) > .2) p.a = Math.atan2(I.ay, I.ax);
      else if (ml > .2) p.a = Math.atan2(my, mx);
      // laddning av vapen
      if (p.relT > 0) { p.relT -= dt; if (p.relT <= 0) { const need = Wp.mag - g.mag, take = Math.min(need, g.res); g.mag += take; g.res -= take; } }
      if (pr.swap && p.prim && p.relT <= 0) { p.cur = p.cur === 'prim' ? 'pist' : 'prim'; p.fireT = Math.max(p.fireT, .3); this.emit('swap', { p: p.id }); }
      if (pr.reload && p.relT <= 0 && g.mag < Wp.mag && g.res > 0) { p.relT = Wp.rel; this.emit('reload', { p: p.id }); }
      if (this.phase !== 'live') return;
      // granater
      for (const k of ['he', 'smoke', 'flash']) if (pr[k] && p[k] > 0) { p[k]--; this.throwNade(p, k); }
      // plantera / desarmera
      const b = this.bomb;
      if (I.act && p.side === 0 && b && b.carrier === p.id && !b.planted) {
        const site = inZone(SITES.A, p.x, p.y) ? 'A' : inZone(SITES.B, p.x, p.y) ? 'B' : null;
        if (site) { if (p.plantT === 0) this.emit('planting', { p: p.id, x: Math.round(p.x), y: Math.round(p.y) }); p.plantT += dt; if (p.plantT >= T_PLANT) this.plant(p, site); return; }
      } else p.plantT = 0;
      if (I.act && p.side === 1 && b && b.planted && Math.hypot(b.x - p.x, b.y - p.y) < 60) {
        if (p.defT === 0) this.emit('defusing', { p: p.id, x: Math.round(p.x), y: Math.round(p.y) });
        p.defT += dt; if (p.defT >= (p.kit ? T_DEF_KIT : T_DEF)) { p.defuses++; this.bomb.planted = false; this.bomb.defused = true; this.emit('defused', { p: p.id }); this.endRound(1, 'defuse'); }
        return;
      } else p.defT = 0;
      // plocka upp tappad laddning
      if (b && !b.planted && !b.carrier && p.side === 0 && Math.hypot(b.x - p.x, b.y - p.y) < 34) { b.carrier = p.id; this.emit('bombpick', { p: p.id }); }
      // skjuta
      if (I.fire && p.fireT <= 0 && p.relT <= 0 && p.blind < 1.5) {
        if (g.mag <= 0) { if (g.res > 0) { p.relT = Wp.rel; this.emit('reload', { p: p.id }); } else this.emit('empty', { p: p.id }); p.fireT = .25; }
        else this.fire(p, g, Wp);
      }
    }
    move(p, dx, dy) {
      const tryAxis = (nx, ny) => {
        for (const [ox, oy] of [[-PR, -PR], [PR, -PR], [-PR, PR], [PR, PR], [0, -PR], [0, PR], [-PR, 0], [PR, 0]]) if (solidXY(nx + ox * .98, ny + oy * .98)) return false;
        return true;
      };
      if (tryAxis(p.x + dx, p.y)) p.x += dx;
      if (tryAxis(p.x, p.y + dy)) p.y += dy;
    }
    collidePlayers() {
      const A = this.P.filter(p => p.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, R = PR * 2;
        if (d < R) { const k = (R - d) / 2, nx = dx / d, ny = dy / d; this.move(a, -nx * k, -ny * k); this.move(b, nx * k, ny * k); }
      }
    }
    fire(p, g, Wp) {
      g.mag--; p.fireT = Wp.rate;
      const moving = Math.hypot(p.vx, p.vy) > 40;
      let spread = Wp.spread + p.recoil * .09 + (moving ? (Wp.moveSpread || .025) : 0);
      p.recoil = Math.min(1.4, p.recoil + (Wp.n > 1 ? .5 : Wp.rate < .15 ? .14 : .35));
      const tr = [];
      for (let k = 0; k < Wp.n; k++) {
        const a = p.a + (this.rng() - .5) * 2 * spread;
        const ux = Math.cos(a), uy = Math.sin(a), sx = p.x + ux * (PR + 4), sy = p.y + uy * (PR + 4);
        let len = rayWall(sx, sy, ux, uy, Wp.range), hit = null;
        for (const q of this.P) {
          if (!q.alive || q === p) continue;
          const fx = q.x - sx, fy = q.y - sy, t = fx * ux + fy * uy; if (t < 0 || t > len) continue;
          const px = fx - ux * t, py = fy - uy * t; if (px * px + py * py > (PR + 2) * (PR + 2)) continue;
          len = t; hit = q;
        }
        tr.push([Math.round(sx + ux * len), Math.round(sy + uy * len), hit ? 1 : 0]);
        if (hit) {
          const fall = 1 - Math.min(.35, len / 3200);
          this.damage(hit, Wp.dmg * fall, p, g.w);
        }
      }
      this.emit('shot', { p: p.id, w: g.w, x: Math.round(p.x + Math.cos(p.a) * (PR + 8)), y: Math.round(p.y + Math.sin(p.a) * (PR + 8)), tr });
    }
    damage(q, dmg, from, w) {
      if (!q.alive) return;
      if (from && from !== q && from.side === q.side) dmg *= 0;     // ingen vådabeskjutning
      if (dmg <= 0) return;
      if (q.armor > 0) { const absorb = Math.min(q.armor, dmg * .45); q.armor -= absorb * 1.2; if (q.armor < 0) q.armor = 0; dmg -= absorb; }
      q.hp -= dmg; if (from && from !== q) from.dmg += dmg;
      this.emit('hit', { p: q.id, d: Math.round(dmg), x: Math.round(q.x), y: Math.round(q.y) });
      if (q.ai) { q.ai.hurtBy = from ? from.id : null; q.ai.hurtT = 1; }
      if (q.hp <= 0) {
        q.hp = 0; q.alive = false; q.deaths++;
        if (this.bomb && this.bomb.carrier === q.id) this.dropBomb(q);
        if (from && from !== q) { from.kills++; from.money = Math.min(MONEY.max, from.money + ((WEAPONS[w] || {}).rew || 300)); }
        this.emit('kill', { p: q.id, k: from ? from.id : null, w, x: Math.round(q.x), y: Math.round(q.y) });
      }
    }
    dropBomb(p) { const b = this.bomb; b.carrier = null; b.x = p.x; b.y = p.y; this.emit('bombdrop', { p: p.id, x: Math.round(p.x), y: Math.round(p.y) }); }
    plant(p, site) {
      const b = this.bomb; b.planted = true; b.carrier = null; b.x = p.x; b.y = p.y; b.t = T_BOMB; b.site = site; p.plantT = 0; p.plants++;
      for (const q of this.P) if (q.side === 0 && !q.out) q.money = Math.min(MONEY.max, q.money + MONEY.plant);
      this.emit('planted', { p: p.id, site, x: Math.round(b.x), y: Math.round(b.y) });
    }
    explodeBomb() {
      const b = this.bomb; b.planted = false; b.exploded = true;
      this.emit('boom', { x: Math.round(b.x), y: Math.round(b.y), r: 520, big: 1 });
      for (const q of this.P) if (q.alive) { const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < 520) this.damage(q, 220 * (1 - d / 520), null, 'bomb'); }
      this.endRound(0, 'bomb');
    }
    checkElim() {
      const alive = s => this.P.some(p => !p.out && p.side === s && p.alive);
      const any = s => this.P.some(p => !p.out && p.side === s);
      if (!any(0) || !any(1)) return;
      if (!alive(1)) this.endRound(0, 'elim');
      else if (!alive(0) && !(this.bomb && this.bomb.planted)) this.endRound(1, 'elim');
    }
    /* ---------- granater ---------- */
    throwNade(p, k) {
      const v = 520;
      this.nades.push({ k, x: p.x + Math.cos(p.a) * 22, y: p.y + Math.sin(p.a) * 22, vx: Math.cos(p.a) * v, vy: Math.sin(p.a) * v, t: 0, o: p.id });
      this.emit('throw', { p: p.id, k });
    }
    nadesStep(dt) {
      for (let i = this.nades.length - 1; i >= 0; i--) {
        const n = this.nades[i]; n.t += dt;
        const f = Math.exp(-1.6 * dt); n.vx *= f; n.vy *= f;
        const nx = n.x + n.vx * dt, ny = n.y + n.vy * dt;
        if (solidXY(nx, n.y)) { n.vx = -n.vx * .55; this.emit('bounce', { x: Math.round(n.x), y: Math.round(n.y) }); } else n.x = nx;
        if (solidXY(n.x, ny)) { n.vy = -n.vy * .55; } else n.y = ny;
        const fuse = n.k === 'smoke' ? 1.8 : n.k === 'flash' ? 1.3 : 1.6;
        if (n.t >= fuse) {
          this.nades.splice(i, 1);
          const o = this.P.find(q => q.id === n.o);
          if (n.k === 'he') {
            this.emit('boom', { x: Math.round(n.x), y: Math.round(n.y), r: 230 });
            for (const q of this.P) if (q.alive) { if (o && o !== q && o.side === q.side) continue; const d = Math.hypot(q.x - n.x, q.y - n.y); if (d < 230 && canSee(n.x, n.y, q.x, q.y)) this.damage(q, 85 * (1 - d / 230), o === q ? null : o, 'he'); }
          } else if (n.k === 'smoke') { this.smokes.push({ x: n.x, y: n.y, r: 150, t: 0 }); this.emit('smoke', { x: Math.round(n.x), y: Math.round(n.y) }); }
          else if (n.k === 'flash') {
            this.emit('flash', { x: Math.round(n.x), y: Math.round(n.y) });
            for (const q of this.P) if (q.alive) { const d = Math.hypot(q.x - n.x, q.y - n.y); if (d < 900 && canSee(q.x, q.y, n.x, n.y, this.smokes)) { const facing = Math.cos(angDiff(q.a, Math.atan2(n.y - q.y, n.x - q.x))); q.blind = Math.max(q.blind, (1 - d / 900) * (facing > 0 ? 4 : 1.8)); } }
          }
        }
      }
    }

    /* ================= DATORSPELARE ================= */
    flow(gx, gy) {
      this.fc = this.fc || {};
      const key = gy * GW + gx, c = this.fc[key]; if (c) return c;
      const d = new Int16Array(GW * GH).fill(-1), q = [key]; d[key] = 0;
      for (let h = 0; h < q.length; h++) {
        const k = q[h], x = k % GW, y = (k / GW) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (solidAt(nx, ny)) continue; const nk = ny * GW + nx; if (d[nk] >= 0) continue; d[nk] = d[k] + 1; q.push(nk); }
      }
      this.fc[key] = d; return d;
    }
    pathDir(p, tx, ty) {
      const gx = clamp(Math.floor(tx / CS), 0, GW - 1), gy = clamp(Math.floor(ty / CS), 0, GH - 1);
      if (solidAt(gx, gy)) return [tx - p.x, ty - p.y];
      const d = this.flow(gx, gy), cx = Math.floor(p.x / CS), cy = Math.floor(p.y / CS);
      if (cx === gx && cy === gy) return [tx - p.x, ty - p.y];
      let best = null, bv = d[cy * GW + cx] >= 0 ? d[cy * GW + cx] : 1e9;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (solidAt(nx, ny)) continue; const v = d[ny * GW + nx]; if (v >= 0 && v < bv) { bv = v; best = [nx, ny]; } }
      if (!best) return [tx - p.x, ty - p.y];
      // sikta mot mitten av nästa ruta men håll undan från väggkanter
      let wx = (best[0] + .5) * CS, wy = (best[1] + .5) * CS;
      return [wx - p.x, wy - p.y];
    }
    siteSpot(site, k) { const s = SITES[site]; const r = RNG(k * 97 + (site === 'A' ? 1 : 2)); for (let i = 0; i < 30; i++) { const cx = s.x0 + Math.floor(r() * (s.x1 - s.x0 + 1)), cy = s.y0 + Math.floor(r() * (s.y1 - s.y0 + 1)); if (!solidAt(cx, cy)) return [(cx + .5) * CS, (cy + .5) * CS]; } return [(s.label[0]) * CS, (s.label[1]) * CS]; }
    botThink(p, dt) {
      const A = p.ai, L = clamp(p.bot, 1, 10), r = this.rng;
      // köp i början av ronden
      if (!A.bought && this.buyOK(p)) {
        A.bought = true;
        const m = () => p.money;
        if (!p.prim) { if (m() >= 2700 + 650) p.press.buy = 'rifle'; else if (m() >= 4750 && r() < .15) p.press.buy = 'sniper'; else if (m() >= 1200) p.press.buy = r() < .5 ? 'smg' : 'shotgun'; }
        A.later = ['armor', p.side === 1 ? 'kit' : null, 'he', 'smoke', 'flash'].filter(Boolean);
      }
      if (A.later && A.later.length && this.buyOK(p) && !p.press.buy) { const w = A.later.shift(); const price = (ITEMS[w] || {}).price || 0; if (p.money - price > (L > 5 ? 0 : 200)) p.press.buy = w; }
      A.t -= dt; A.react -= dt; A.seenT -= dt;
      const foes = this.P.filter(q => q.alive && q.side !== p.side);
      const blind = p.blind > .5;
      // se fiender
      let tgt = null, td = 1e9;
      if (!blind) for (const q of foes) { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < 1600 && d < td && canSee(p.x, p.y, q.x, q.y, this.smokes)) { tgt = q; td = d; } }
      if (tgt) { this.intel = this.intel || [null, null]; this.intel[p.side] = { x: tgt.x, y: tgt.y, t: this.time }; }
      if (tgt) { if (!A.seen || A.seen.id !== tgt.id) A.react = Math.max(.12, .75 - L * .065) * (.7 + r() * .6); A.seen = { id: tgt.id, x: tgt.x, y: tgt.y }; A.seenT = 4; }
      else if (A.hurtT > 0 && A.hurtBy) { const h = this.P.find(q => q.id === A.hurtBy); if (h && h.alive) { A.seen = { id: h.id, x: h.x, y: h.y }; A.seenT = 2; } }
      A.hurtT = (A.hurtT || 0) - dt;
      // mål för rörelsen
      let goal = null; const b = this.bomb;
      if (p.side === 0) {
        if (b && b.planted) goal = [b.x + (r() - .5) * 0, b.y + 120];
        else if (b && b.carrier === p.id) goal = this.siteSpot(this.siteGoal, 1);
        else if (b && !b.carrier && !b.planted) goal = [b.x, b.y];
        else { const c = b && this.P.find(q => q.id === b.carrier); goal = c && Math.hypot(c.x - p.x, c.y - p.y) > 220 ? [c.x, c.y] : this.siteSpot(this.siteGoal, p.ch + 3); }
      } else {
        if (b && b.planted) goal = [b.x, b.y];
        else { const k = this.P.filter(q => q.side === 1 && !q.out).indexOf(p); goal = this.siteSpot(k % 2 ? 'B' : 'A', k + 5); }
        // försvararna hjälper varandra: gå mot där en lagkamrat senast såg fienden
        const it = this.intel && this.intel[1];
        if (!(b && b.planted) && it && it.t - this.time < 10 && L >= 2) goal = [it.x, it.y];
      }
      if (this.phase === 'freeze') goal = null;
      let mx = 0, my = 0, ax = Math.cos(p.a), ay = Math.sin(p.a), fire = 0, act = 0;
      if (tgt && A.react <= 0) {
        // strid: sikta (med lite fel) och skjut, gå i sidled
        const lead = Math.min(.25, td / 3000) * (L / 10);
        const aim = Math.atan2(tgt.y + tgt.vy * lead - p.y, tgt.x + tgt.vx * lead - p.x) + (r() - .5) * Math.max(.02, .32 - L * .03);
        ax = Math.cos(aim); ay = Math.sin(aim);
        const g = this.gun(p), Wp = WEAPONS[g.w];
        fire = td < Wp.range * .9 ? 1 : 0;
        if (Wp.rate > .5 && r() < .5) fire = Math.abs(angDiff(p.a, aim)) < .08 ? 1 : 0;
        if (L >= 3 && r() < .02) A.strafe = -A.strafe;
        const nx = (tgt.x - p.x) / td, ny = (tgt.y - p.y) / td;
        const keep = Wp.n > 1 ? 250 : 500;
        const fwd = td > keep + 150 ? .6 : td < keep - 150 ? -.4 : 0;
        if (L >= 3) { mx = nx * fwd - ny * A.strafe * .6; my = ny * fwd + nx * A.strafe * .6; }
        if (b && b.planted && p.side === 1 && Math.hypot(b.x - p.x, b.y - p.y) < 60 && td > 900) { mx = my = 0; act = 1; fire = 0; }
      } else if (tgt) { const aim = Math.atan2(tgt.y - p.y, tgt.x - p.x); ax = Math.cos(aim); ay = Math.sin(aim); }
      else {
        if (A.seen && A.seenT > 0 && !(p.side === 0 && b && b.carrier === p.id)) { [mx, my] = this.pathDir(p, A.seen.x, A.seen.y); }
        else if (goal) {
          const d = Math.hypot(goal[0] - p.x, goal[1] - p.y);
          if (d > 30) [mx, my] = this.pathDir(p, goal[0], goal[1]);
          // planterar / desarmerar
          if (p.side === 0 && b && b.carrier === p.id && (inZone(SITES.A, p.x, p.y) || inZone(SITES.B, p.x, p.y))) { mx = my = 0; act = 1; }
          if (p.side === 1 && b && b.planted && Math.hypot(b.x - p.x, b.y - p.y) < 55) { mx = my = 0; act = 1; }
        }
        const ml = Math.hypot(mx, my); if (ml > 0) { ax = mx / ml; ay = my / ml; }
        // ladda om när det är lugnt
        const g = this.gun(p); if (g.mag < WEAPONS[g.w].mag * .5 && g.res > 0 && r() < .02) p.press.reload = 1;
      }
      // granat ibland mot fienden
      if (tgt && A.react <= 0 && td > 300 && td < 700 && r() < .004 * L) { if (p.he) p.press.he = 1; else if (p.flash && r() < .5) p.press.flash = 1; }
      if (tgt && p.side === 1 && b && b.planted === false && p.smoke && td > 500 && r() < .002 * L) p.press.smoke = 1;
      const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      const wasAct = p.in.act;
      p.in = { mx, my, ax, ay, fire, act: act || (wasAct && (p.plantT > 0 || p.defT > 0) && !tgt ? 1 : 0) };
    }

    /* läge för ritning och nätverk */
    snap(evAfter) {
      const R = Math.round, b = this.bomb;
      return {
        ph: this.phase, tm: Math.max(0, Math.ceil(this.time)), bt: b && b.planted ? Math.max(0, Math.ceil(b.t * 10) / 10) : 0, rd: this.round, sc: this.score, ov: this.over ? 1 : 0, w: this.winner,
        lw: this.lastWin, why: this.lastWhy, buy: this.phase === 'freeze' || (this.phase === 'live' && T_ROUND - this.time < T_BUY) ? 1 : 0, win: this.opt.win,
        P: this.P.map(p => { const g = this.gun(p); return { id: p.id, n: p.name, ch: p.ch, s: p.side, x: R(p.x), y: R(p.y), a: Math.round(p.a * 100) / 100, hp: R(p.hp), ar: R(p.armor), al: p.alive ? 1 : 0, out: p.out ? 1 : 0, bot: p.bot,
          m: p.money, w: g.w, mg: g.mag, rs: g.res, pr: p.prim ? p.prim.w : '', he: p.he, sm: p.smoke, fl: p.flash, kit: p.kit, rl: p.relT > 0 ? 1 : 0, bl: Math.round(p.blind * 10) / 10,
          pl: p.plantT > 0 ? Math.round(p.plantT / T_PLANT * 100) : 0, df: p.defT > 0 ? Math.round(p.defT / (p.kit ? T_DEF_KIT : T_DEF) * 100) : 0, k: p.kills, d: p.deaths, bomb: b && b.carrier === p.id ? 1 : 0 }; }),
        B: b ? { c: b.carrier, x: R(b.x), y: R(b.y), pl: b.planted ? 1 : 0, s: b.site } : null,
        N: this.nades.map(n => [R(n.x), R(n.y), n.k]),
        S: this.smokes.map(s => [R(s.x), R(s.y), Math.round(s.t * 10) / 10]),
        ev: evAfter == null ? this.ev.slice(-40) : this.ev.filter(e => e.id > evAfter)
      };
    }
    result() { return this.P.map(p => ({ id: p.id, name: p.name, ch: p.ch, side: p.side, bot: p.bot, kills: p.kills, deaths: p.deaths, dmg: Math.round(p.dmg), plants: p.plants, defuses: p.defuses })); }
  }

  const OPS = { DT, CS, PR, GW, GH, W, H, grid, SITES, SPAWN, SPAWN_ZONE, WEAPONS, ITEMS, MONEY, T_ROUND, T_BUY, T_BOMB, solidAt, solidXY, inZone, rayWall, raySmoke, canSee, Game, RNG };
  if (typeof module !== 'undefined' && module.exports) module.exports = OPS; else root.OPS = OPS;
})(this);
