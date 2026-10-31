/* Bucinca Stridsvagnar – banor, vagnar, kulor, minor, raketer, föremål, datorförare och poäng.
   Körs lokalt eller hos värden i nätverksmatch (60 steg/s). Fungerar även i Node (tester). */
(function (root) {
  'use strict';
  const DT = 1 / 60;
  const CELL = 50;

  /* ---------- vagnmodeller ---------- */
  const MODELS = {
    bjorn:  { name: 'Björnen',  lvl: 1,  hp: 100, spd: 210, dmg: 20, rel: .55, vel: 640, r: 30, sp: 'shield',  spCd: 11, desc: 'Allround – har en sköld' },
    vessla: { name: 'Vesslan',  lvl: 3,  hp: 75,  spd: 275, dmg: 15, rel: .38, vel: 700, r: 26, sp: 'turbo',   spCd: 7,  desc: 'Snabb och kvick – turbo' },
    mammut: { name: 'Mammuten', lvl: 6,  hp: 150, spd: 165, dmg: 30, rel: .8,  vel: 580, r: 36, sp: 'mine',    spCd: 6,  desc: 'Tung och stark – lägger minor' },
    drake:  { name: 'Draken',   lvl: 10, hp: 110, spd: 215, dmg: 22, rel: .58, vel: 660, r: 31, sp: 'rockets', spCd: 10, desc: 'Avfyrar en raketsalva' },
    boss:   { name: 'Bossen',   lvl: 99, hp: 320, spd: 150, dmg: 26, rel: .5,  vel: 600, r: 46, sp: 'rockets', spCd: 8,  desc: '' }
  };
  const SPECIAL = { shield: { name: 'Sköld', ic: '🛡️' }, turbo: { name: 'Turbo', ic: '💨' }, mine: { name: 'Mina', ic: '💣' }, rockets: { name: 'Raketer', ic: '🚀' } };
  // uppgraderingar 0–5
  const UPG_KEYS = ['arm', 'eng', 'gun', 'rel', 'vel', 'spc'];
  const cleanUp = u => { const o = {}; for (const k of UPG_KEYS) o[k] = Math.max(0, Math.min(5, (u && u[k]) | 0)); return o; };
  const botUp = lv => { const n = Math.max(0, Math.min(5, Math.floor((lv | 0) / 2))); const o = {}; for (const k of UPG_KEYS) o[k] = n; return o; };

  /* ---------- banor ---------- */
  const W = 1800, H = 1100;
  function mirror4(r) {           // [x,y,w,h] speglad i båda axlarna
    const [x, y, w, h] = r, out = [r, [W - x - w, y, w, h], [x, H - y - h, w, h], [W - x - w, H - y - h, w, h]];
    const seen = new Set(); return out.filter(q => { const k = q.join(','); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  const m4p = (x, y) => { const o = [[x, y], [W - x, y], [x, H - y], [W - x, H - y]]; const s = new Set(); return o.filter(p => { const k = p.join(','); if (s.has(k)) return false; s.add(k); return true; }); };
  const SPAWNS = [[130, 130], [W - 130, H - 130], [W - 130, 130], [130, H - 130], [W / 2, 90], [W / 2, H - 90], [90, H / 2], [W - 90, H / 2]];
  const MAPS = [
    { name: 'Övningsfältet', ground: 'grass',
      walls: [...mirror4([300, 230, 260, 44]), ...mirror4([300, 230, 44, 200]), [840, 490, 120, 120], ...mirror4([620, 520, 140, 60])],
      crates: [...m4p(470, 400), ...m4p(530, 400), ...m4p(820, 300), [900, 380], [900, 720]],
      bushes: [[900, 190, 80], [900, 910, 80], [470, 550, 70], [1330, 550, 70], ...m4p(160, 400).map(p => [p[0], p[1], 60])] },
    { name: 'Ökenstaden', ground: 'sand',
      walls: [...mirror4([300, 200, 200, 150]), ...mirror4([700, 200, 160, 110]), ...mirror4([300, 470, 120, 60]), [800, 470, 200, 160], ...mirror4([560, 430, 40, 120])],
      crates: [...m4p(560, 260), ...m4p(620, 260), ...m4p(230, 560), ...m4p(700, 400), [900, 370], [900, 730]],
      bushes: [...m4p(470, 410).map(p => [p[0], p[1], 50]), [900, 120, 60], [900, 980, 60]] },
    { name: 'Labyrinten', ground: 'stone',
      walls: [...mirror4([200, 180, 500, 40]), ...mirror4([200, 180, 40, 220]), ...mirror4([420, 360, 40, 220]), ...mirror4([620, 360, 230, 40]), [880, 260, 40, 200], [880, 640, 40, 200], ...mirror4([200, 530, 120, 40])],
      crates: [...m4p(330, 300), ...m4p(760, 280), ...m4p(540, 470), [900, 550]],
      bushes: [...m4p(330, 460).map(p => [p[0], p[1], 55]), [900, 120, 60], [900, 980, 60]] },
    { name: 'Snöskogen', ground: 'snow',
      walls: [...mirror4([380, 300, 70, 70]), ...mirror4([700, 180, 70, 70]), [865, 515, 70, 70], ...mirror4([180, 520, 70, 60])],
      crates: [...m4p(560, 400), ...m4p(560, 460), ...m4p(300, 160), ...m4p(780, 470), [900, 300], [900, 800]],
      bushes: [...m4p(520, 220).map(p => [p[0], p[1], 75]), ...m4p(260, 420).map(p => [p[0], p[1], 65]), ...m4p(760, 360).map(p => [p[0], p[1], 70]), [900, 420, 60], [900, 680, 60]] }
  ];

  function RNG(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // segment mot rektangel (för siktlinje)
  function segRect(x1, y1, x2, y2, r, pad) {
    const rx = r[0] - pad, ry = r[1] - pad, rw = r[2] + 2 * pad, rh = r[3] + 2 * pad;
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return true;
  }

  /* ================= MATCHEN ================= */
  /* opt: { map, mode:'ffa'|'mission', killLimit, time, lives, seed }
     spelare: { id, name, ch, model, up, bot (nivå 1–10 eller -1), boss } */
  class Game {
    constructor(players, opt = {}) {
      this.opt = Object.assign({ map: 0, mode: 'ffa', killLimit: 10, time: 180, lives: 3 }, opt);
      this.map = MAPS[this.opt.map % MAPS.length];
      this.rng = RNG(this.opt.seed || ((Math.random() * 1e9) | 0));
      this.walls = this.map.walls.map(r => r.slice());
      this.crates = this.map.crates.map(([x, y]) => ({ x: x - 26, y: y - 26, w: 52, h: 52, hp: 40 }));
      this.T = []; this.bullets = []; this.mines = []; this.picks = []; this.ev = []; this.evSeq = 0;
      this.time = this.opt.time; this.t = 0; this.phase = 'start'; this.pt = 0; this.over = false; this.winner = null;
      this.pickT = 4; this.gridDirty = true; this.flowCache = {};
      for (const p of players) this.addTank(p);
      this.emit('start');
    }
    emit(e, o) { this.ev.push(Object.assign({ id: ++this.evSeq, e }, o || {})); if (this.ev.length > 80) this.ev.shift(); }
    addTank(p) {
      const M = MODELS[p.boss ? 'boss' : (MODELS[p.model] ? p.model : 'bjorn')], u = cleanUp(p.up);
      const t = {
        id: p.id, name: p.name || '', ch: p.ch | 0, model: p.boss ? 'boss' : (MODELS[p.model] ? p.model : 'bjorn'), bot: p.bot == null ? -1 : p.bot, team: p.team || 0,
        maxhp: Math.round(M.hp * (1 + u.arm * .09)), spd: M.spd * (1 + u.eng * .06), dmg: M.dmg * (1 + u.gun * .09), rel: M.rel * (1 - u.rel * .07),
        vel: M.vel * (1 + u.vel * .08), r: M.r, sp: M.sp, spCd: M.spCd * (1 - u.spc * .1),
        x: 0, y: 0, vx: 0, vy: 0, a: 0, ta: 0, hp: 0, alive: false, resp: 0, lives: p.lives != null ? p.lives : this.opt.lives,
        reload: 0, cd: 2, shield: 0, turbo: 0, boost: 0, triple: 0, hitT: 0,
        kills: 0, deaths: 0, dmgDone: 0, shots: 0, hits: 0, crates: 0, out: false,
        in: { mx: 0, my: 0, ax: 0, ay: 0, fire: 0, sp: 0 }, spPress: 0, ai: { t: 0, strafe: 1, st: 0, goal: null, path: 0 }
      };
      this.T.push(t);
      this.spawn(t, true);
      return t;
    }
    removeTank(id) { const t = this.T.find(q => q.id === id); if (t) { t.alive = false; t.out = true; t.resp = 1e9; } }
    spawn(t, first) {
      // spawnpunkt långt från fienderna
      let best = null, bd = -1;
      const pts = SPAWNS.slice();
      if (first) { const i = this.T.indexOf(t); const p = pts[i % pts.length]; best = p; }
      else for (const p of pts) {
        let md = 1e9; for (const o of this.T) if (o !== t && o.alive) md = Math.min(md, Math.hypot(o.x - p[0], o.y - p[1]));
        md += this.rng() * 80; if (md > bd) { bd = md; best = p; }
      }
      t.x = best[0]; t.y = best[1]; t.vx = t.vy = 0;
      t.a = t.ta = Math.atan2(H / 2 - t.y, W / 2 - t.x);
      t.hp = t.maxhp; t.alive = true; t.shield = first ? 0 : 2; t.reload = .5; t.boost = t.triple = t.turbo = 0;
      if (!first) this.emit('spawn', { t: t.id, x: Math.round(t.x), y: Math.round(t.y) });
    }
    setInput(id, inp) {
      const t = this.T.find(q => q.id === id); if (!t || !inp) return;
      const n = v => (typeof v === 'number' && isFinite(v)) ? clamp(v, -1, 1) : 0;
      t.in = { mx: n(inp.mx), my: n(inp.my), ax: n(inp.ax), ay: n(inp.ay), fire: inp.fire ? 1 : 0, sp: 0 };
      if (inp.sp) t.spPress = 1;
    }
    solids() { return this.walls.concat(this.crates.filter(c => c.hp > 0).map(c => [c.x, c.y, c.w, c.h])); }
    los(x1, y1, x2, y2, pad) { for (const r of this.walls) if (segRect(x1, y1, x2, y2, r, pad || 0)) return false; for (const c of this.crates) if (c.hp > 0 && segRect(x1, y1, x2, y2, [c.x, c.y, c.w, c.h], pad || 0)) return false; return true; }

    step() {
      const dt = DT; this.t += dt; this.pt += dt;
      if (this.phase === 'start') { if (this.pt > 2.2) { this.phase = 'play'; this.pt = 0; this.emit('go'); } this.anim(dt); return; }
      if (this.phase === 'end') { this.anim(dt); return; }
      if (this.opt.time > 0) this.time -= dt;
      for (const t of this.T) if (t.bot >= 0 && t.alive) this.botThink(t, dt);
      for (const t of this.T) this.tankStep(t, dt);
      this.collideTanks();
      this.bulletsStep(dt);
      this.minesStep(dt);
      this.picksStep(dt);
      this.checkEnd();
    }
    anim(dt) { for (const t of this.T) { t.hitT = Math.max(0, t.hitT - dt); } this.bulletsStep(dt); }

    tankStep(t, dt) {
      t.hitT = Math.max(0, t.hitT - dt);
      if (!t.alive) {
        if (t.out) return;
        t.resp -= dt;
        if (t.resp <= 0 && (this.opt.mode === 'ffa' || t.lives > 0)) this.spawn(t, false);
        return;
      }
      t.reload -= dt; t.cd -= dt; t.shield = Math.max(0, t.shield - dt); t.turbo = Math.max(0, t.turbo - dt); t.boost = Math.max(0, t.boost - dt); t.triple = Math.max(0, t.triple - dt);
      const I = t.in;
      // köra
      let mx = I.mx, my = I.my; const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      const sp = t.spd * (t.turbo > 0 ? 2.1 : 1) * (t.boost > 0 ? 1.35 : 1);
      if (ml > .15) {
        const want = Math.atan2(my, mx);
        // vagnen vrider sig mot styrriktningen (kan även backa)
        let d = angDiff(t.a, want), rev = false;
        if (Math.abs(d) > Math.PI * .62) { d = angDiff(t.a, want + Math.PI); rev = true; }
        t.a += clamp(d, -7 * dt, 7 * dt);
        const k = Math.max(0, Math.cos(d)) * Math.min(1, ml);
        const dir = rev ? t.a + Math.PI : t.a;
        t.vx = Math.cos(dir) * sp * k; t.vy = Math.sin(dir) * sp * k;
      } else { t.vx *= .7; t.vy *= .7; }
      t.x += t.vx * dt; t.y += t.vy * dt;
      this.collideWorld(t);
      // tornet
      const al = Math.hypot(I.ax, I.ay);
      if (al > .2) { const want = Math.atan2(I.ay, I.ax); t.ta += clamp(angDiff(t.ta, want), -9 * dt, 9 * dt); }
      if (I.fire && t.reload <= 0) this.fire(t);
      if (t.spPress) { t.spPress = 0; if (t.cd <= 0) this.special(t); }
    }
    collideWorld(t) {
      const r = t.r * .92;
      t.x = clamp(t.x, r, W - r); t.y = clamp(t.y, r, H - r);
      for (const R of this.solids()) {
        const cx = clamp(t.x, R[0], R[0] + R[2]), cy = clamp(t.y, R[1], R[1] + R[3]);
        const dx = t.x - cx, dy = t.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          if (d2 > 1e-6) { const d = Math.sqrt(d2); t.x = cx + dx / d * r; t.y = cy + dy / d * r; }
          else { // mitten inne i väggen – knuffa ut åt närmaste sida
            const l = t.x - R[0], ri = R[0] + R[2] - t.x, u = t.y - R[1], b = R[1] + R[3] - t.y, m = Math.min(l, ri, u, b);
            if (m === l) t.x = R[0] - r; else if (m === ri) t.x = R[0] + R[2] + r; else if (m === u) t.y = R[1] - r; else t.y = R[1] + R[3] + r;
          }
        }
      }
    }
    collideTanks() {
      const A = this.T.filter(t => t.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, R = (a.r + b.r) * .85;
        if (d < R) { const p = (R - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p; this.collideWorld(a); this.collideWorld(b); }
      }
    }
    fire(t) {
      t.reload = t.rel; t.shots++;
      const angs = t.triple > 0 ? [-.16, 0, .16] : [0];
      const mz = t.r + 22;
      for (const da of angs) {
        const a = t.ta + da;
        this.bullets.push({ x: t.x + Math.cos(a) * mz, y: t.y + Math.sin(a) * mz, vx: Math.cos(a) * t.vel, vy: Math.sin(a) * t.vel, dmg: t.dmg, o: t.id, b: 1, life: 1.6, k: 0 });
      }
      this.emit('fire', { t: t.id, x: Math.round(t.x + Math.cos(t.ta) * mz), y: Math.round(t.y + Math.sin(t.ta) * mz), a: Math.round(t.ta * 100) / 100 });
    }
    special(t) {
      t.cd = t.spCd;
      this.emit('special', { t: t.id, s: t.sp, x: Math.round(t.x), y: Math.round(t.y) });
      if (t.sp === 'shield') t.shield = 3;
      else if (t.sp === 'turbo') t.turbo = 1.3;
      else if (t.sp === 'mine') {
        const mine = this.mines.filter(m => m.o === t.id); if (mine.length >= 3) this.mines.splice(this.mines.indexOf(mine[0]), 1);
        this.mines.push({ x: t.x - Math.cos(t.a) * (t.r + 8), y: t.y - Math.sin(t.a) * (t.r + 8), o: t.id, arm: 1, dmg: 40 + t.dmg * .6 });
      } else if (t.sp === 'rockets') {
        for (let k = -2; k <= 2; k++) { const a = t.ta + k * .14, mz = t.r + 16; this.bullets.push({ x: t.x + Math.cos(a) * mz, y: t.y + Math.sin(a) * mz, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: t.dmg * .7, o: t.id, b: 0, life: 1.4, k: 1 }); }
      }
    }
    bulletsStep(dt) {
      const sol = this.solids();
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        const px = b.x, py = b.y;
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let dead = b.life <= 0, boom = b.k === 1 && b.life <= 0;
        if (b.x < 0 || b.x > W) { if (b.b > 0) { b.b--; b.vx = -b.vx; b.x = clamp(b.x, 0, W); this.emit('bounce', { x: Math.round(b.x), y: Math.round(b.y) }); } else dead = true; }
        if (b.y < 0 || b.y > H) { if (b.b > 0) { b.b--; b.vy = -b.vy; b.y = clamp(b.y, 0, H); this.emit('bounce', { x: Math.round(b.x), y: Math.round(b.y) }); } else dead = true; }
        if (!dead) {
          // väggar och lådor
          for (const c of this.crates) if (c.hp > 0 && b.x > c.x && b.x < c.x + c.w && b.y > c.y && b.y < c.y + c.h) {
            c.hp -= b.dmg; dead = true; boom = b.k === 1;
            this.emit('crate', { x: Math.round(b.x), y: Math.round(b.y), d: c.hp <= 0 ? 1 : 0 });
            if (c.hp <= 0) { this.gridDirty = true; const o = this.T.find(q => q.id === b.o); if (o) o.crates++; this.maybeDrop(c.x + c.w / 2, c.y + c.h / 2); }
            break;
          }
          if (!dead) for (const R of this.walls) if (b.x > R[0] && b.x < R[0] + R[2] && b.y > R[1] && b.y < R[1] + R[3]) {
            if (b.b > 0) {
              b.b--;
              const inX = px > R[0] && px < R[0] + R[2];
              if (inX) b.vy = -b.vy; else b.vx = -b.vx;
              b.x = px; b.y = py;
              this.emit('bounce', { x: Math.round(b.x), y: Math.round(b.y) });
            } else { dead = true; boom = b.k === 1; this.emit('spark', { x: Math.round(px), y: Math.round(py) }); }
            break;
          }
        }
        if (!dead) for (const t of this.T) {
          if (!t.alive || t.id === b.o) continue;
          if ((b.x - t.x) ** 2 + (b.y - t.y) ** 2 < (t.r + 5) ** 2) {
            dead = true;
            if (b.k === 1) boom = true;
            else this.damage(t, b.dmg, b.o, b.vx, b.vy);
            break;
          }
        }
        if (dead) {
          if (boom) this.explode(b.x, b.y, 70, b.dmg, b.o);
          this.bullets.splice(i, 1);
        }
      }
    }
    explode(x, y, R, dmg, o) {
      this.emit('boom', { x: Math.round(x), y: Math.round(y), r: R });
      for (const t of this.T) if (t.alive) { const d = Math.hypot(t.x - x, t.y - y); if (d < R + t.r) this.damage(t, dmg * (1 - .5 * Math.min(1, d / (R + t.r))), o, t.x - x, t.y - y, t.id === o ? .4 : 1); }
      for (const c of this.crates) if (c.hp > 0 && Math.hypot(c.x + c.w / 2 - x, c.y + c.h / 2 - y) < R + 30) { c.hp -= dmg; if (c.hp <= 0) { this.gridDirty = true; this.emit('crate', { x: Math.round(c.x + 26), y: Math.round(c.y + 26), d: 1 }); this.maybeDrop(c.x + c.w / 2, c.y + c.h / 2); } }
    }
    damage(t, dmg, from, vx, vy, mult) {
      if (!t.alive) return;
      if (t.shield > 0) { this.emit('block', { t: t.id, x: Math.round(t.x), y: Math.round(t.y) }); return; }
      dmg *= (mult == null ? 1 : mult);
      dmg = Math.min(dmg, t.hp);
      t.hp -= dmg; t.hitT = .2;
      const l = Math.hypot(vx, vy) || 1; t.x += vx / l * 6; t.y += vy / l * 6; this.collideWorld(t);
      const o = this.T.find(q => q.id === from);
      if (o && o !== t) { o.dmgDone += dmg; o.hits++; }
      this.emit('hit', { t: t.id, o: from, d: Math.round(dmg), x: Math.round(t.x), y: Math.round(t.y) });
      if (t.hp <= 0) {
        t.hp = 0; t.alive = false; t.deaths++; t.lives--; t.resp = 3;
        if (o && o !== t) o.kills++;
        this.emit('kill', { t: t.id, o: from, x: Math.round(t.x), y: Math.round(t.y) });
      }
    }
    minesStep(dt) {
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const m = this.mines[i]; if (m.arm > 0) { m.arm -= dt; continue; }
        for (const t of this.T) if (t.alive && t.id !== m.o && Math.hypot(t.x - m.x, t.y - m.y) < t.r + 18) { this.mines.splice(i, 1); this.explode(m.x, m.y, 95, m.dmg, m.o); break; }
      }
    }
    maybeDrop(x, y) { if (this.rng() < .35) this.addPick(x, y); }
    addPick(x, y) {
      const kinds = ['hp', 'hp', 'speed', 'triple', 'shield'];
      this.picks.push({ x, y, k: kinds[Math.floor(this.rng() * kinds.length)], life: 20 });
    }
    picksStep(dt) {
      this.pickT -= dt;
      if (this.pickT <= 0 && this.picks.length < 4) {
        this.pickT = 7 + this.rng() * 5;
        for (let tries = 0; tries < 30; tries++) {
          const x = 80 + this.rng() * (W - 160), y = 80 + this.rng() * (H - 160);
          if (this.solids().some(R => x > R[0] - 30 && x < R[0] + R[2] + 30 && y > R[1] - 30 && y < R[1] + R[3] + 30)) continue;
          this.addPick(x, y); break;
        }
      }
      for (let i = this.picks.length - 1; i >= 0; i--) {
        const p = this.picks[i]; p.life -= dt;
        if (p.life <= 0) { this.picks.splice(i, 1); continue; }
        for (const t of this.T) if (t.alive && Math.hypot(t.x - p.x, t.y - p.y) < t.r + 22) {
          if (p.k === 'hp') t.hp = Math.min(t.maxhp, t.hp + t.maxhp * .45);
          else if (p.k === 'speed') t.boost = 7;
          else if (p.k === 'triple') t.triple = 8;
          else if (p.k === 'shield') t.shield = Math.max(t.shield, 5);
          this.emit('pick', { t: t.id, k: p.k, x: Math.round(p.x), y: Math.round(p.y) });
          this.picks.splice(i, 1); break;
        }
      }
    }
    checkEnd() {
      const o = this.opt;
      if (o.mode === 'ffa') {
        const top = this.T.filter(t => !t.out).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0];
        if ((top && top.kills >= o.killLimit) || (o.time > 0 && this.time <= 0)) this.finish(top ? top.id : null);
      } else {
        // uppdrag: spelarna (team 0) mot datorn (team 1)
        const alive = tm => this.T.some(t => t.team === tm && !t.out && (t.alive || t.lives > 0));
        if (!alive(1)) this.finish('team0');
        else if (!alive(0)) this.finish('team1');
      }
    }
    finish(w) { if (this.over) return; this.over = true; this.winner = w; this.phase = 'end'; this.pt = 0; this.emit('end', { w }); }

    /* ================= DATORFÖRARE ================= */
    buildGrid() {
      const gw = Math.ceil(W / CELL), gh = Math.ceil(H / CELL), g = new Uint8Array(gw * gh);
      const sol = this.solids(), pad = 26;
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
        const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2;
        for (const R of sol) if (x > R[0] - pad && x < R[0] + R[2] + pad && y > R[1] - pad && y < R[1] + R[3] + pad) { g[j * gw + i] = 1; break; }
      }
      this.grid = { gw, gh, g }; this.gridDirty = false; this.flowCache = {};
    }
    flow(gx, gy) {
      if (this.gridDirty || !this.grid) this.buildGrid();
      const { gw, gh, g } = this.grid, key = gy * gw + gx;
      const c = this.flowCache[key]; if (c && this.t - c.t < .6) return c.d;
      const d = new Int16Array(gw * gh).fill(-1), q = [key]; d[key] = 0;
      for (let h = 0; h < q.length; h++) {
        const k = q[h], x = k % gw, y = (k / gw) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
          const nk = ny * gw + nx; if (d[nk] >= 0 || g[nk]) continue; d[nk] = d[k] + 1; q.push(nk);
        }
      }
      this.flowCache[key] = { t: this.t, d };
      return d;
    }
    // riktning mot målet längs banan
    pathDir(t, gx0, gy0) {
      const { gw, gh } = this.grid || (this.buildGrid(), this.grid);
      const tx = clamp(Math.floor(gx0 / CELL), 0, gw - 1), ty = clamp(Math.floor(gy0 / CELL), 0, gh - 1);
      const d = this.flow(tx, ty);
      const cx = clamp(Math.floor(t.x / CELL), 0, gw - 1), cy = clamp(Math.floor(t.y / CELL), 0, gh - 1);
      let best = null, bv = d[cy * gw + cx] >= 0 ? d[cy * gw + cx] : 1e9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const v = d[ny * gw + nx]; if (v < 0) continue;
        if (dx && dy && (d[cy * gw + nx] < 0 || d[ny * gw + cx] < 0)) continue;   // inga diagonaler runt hörn
        if (v < bv) { bv = v; best = [nx, ny]; }
      }
      if (!best) return [gx0 - t.x, gy0 - t.y];
      return [best[0] * CELL + CELL / 2 - t.x, best[1] * CELL + CELL / 2 - t.y];
    }
    botThink(t, dt) {
      const A = t.ai, L = clamp(t.bot, 1, 10), r = this.rng;
      A.t -= dt;
      const enemies = this.T.filter(o => o.alive && o !== t && (this.opt.mode === 'ffa' || o.team !== t.team));
      // välj mål
      if (A.t <= 0) {
        A.t = Math.max(.12, .5 - L * .035) * (.7 + r() * .6);
        let tgt = null, bd = 1e9;
        for (const o of enemies) { let d = Math.hypot(o.x - t.x, o.y - t.y); if (!this.los(t.x, t.y, o.x, o.y)) d *= 1.6; if (d < bd) { bd = d; tgt = o; } }
        A.tgt = tgt ? tgt.id : null;
        if (r() < .25) A.strafe = -A.strafe;
        A.goal = null;
        if (t.hp < t.maxhp * .4) { let bp = null, bpd = 700; for (const p of this.picks) if (p.k === 'hp') { const d = Math.hypot(p.x - t.x, p.y - t.y); if (d < bpd) { bpd = d; bp = p; } } if (bp) A.goal = [bp.x, bp.y]; }
        if (!A.goal && !tgt && this.picks.length) A.goal = [this.picks[0].x, this.picks[0].y];
        A.aimErr = (r() - .5) * 2 * Math.max(.02, .3 - L * .028);
      }
      const tgt = this.T.find(o => o.id === A.tgt && o.alive);
      let mx = 0, my = 0, ax = 0, ay = 0, fire = 0;
      const see = tgt && this.los(t.x, t.y, tgt.x, tgt.y, 4);
      if (A.goal) { [mx, my] = this.pathDir(t, A.goal[0], A.goal[1]); }
      else if (tgt) {
        const dx = tgt.x - t.x, dy = tgt.y - t.y, d = Math.hypot(dx, dy);
        const want = 260 + (10 - L) * 12;
        if (!see || d > want + 200) [mx, my] = this.pathDir(t, tgt.x, tgt.y);
        else {
          const nx = dx / d, ny = dy / d;
          const fwd = d > want + 60 ? 1 : d < want - 80 ? -1 : 0;
          mx = nx * fwd + -ny * A.strafe * (L >= 3 ? .9 : .4); my = ny * fwd + nx * A.strafe * (L >= 3 ? .9 : .4);
          // fastnat mot vägg? byt riktning
          if (Math.hypot(t.vx, t.vy) < 20 && r() < .05) A.strafe = -A.strafe;
        }
      }
      // undvik kulor (bättre förare)
      if (L >= 4) for (const b of this.bullets) {
        if (b.o === t.id) continue;
        const rx = t.x - b.x, ry = t.y - b.y, bl = Math.hypot(b.vx, b.vy), along = (rx * b.vx + ry * b.vy) / bl;
        if (along > 0 && along < 260) { const perp = (rx * b.vy - ry * b.vx) / bl; if (Math.abs(perp) < t.r + 20 && r() < L * .012) { const s = perp >= 0 ? 1 : -1; mx += -b.vy / bl * s * 2; my += b.vx / bl * s * 2; } }
      }
      if (tgt) {
        const d = Math.hypot(tgt.x - t.x, tgt.y - t.y), lead = d / t.vel * Math.min(1, L * .11);
        const px = tgt.x + tgt.vx * lead, py = tgt.y + tgt.vy * lead;
        const aa = Math.atan2(py - t.y, px - t.x) + A.aimErr;
        ax = Math.cos(aa); ay = Math.sin(aa);
        if (see && Math.abs(angDiff(t.ta, aa)) < .14 && d < 900) fire = 1;
        // specialförmåga
        if (t.cd <= 0) {
          if (t.sp === 'shield' && t.hp < t.maxhp * .5 && t.hitT > 0) t.spPress = 1;
          else if (t.sp === 'rockets' && see && d < 520 && r() < .03 * L) t.spPress = 1;
          else if (t.sp === 'mine' && d < 260 && r() < .02 * L) t.spPress = 1;
          else if (t.sp === 'turbo' && (!see || d > 600) && r() < .02 * L) t.spPress = 1;
        }
      } else { const sp = Math.hypot(mx, my); if (sp > 0) { ax = mx; ay = my; } }
      const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
      t.in = { mx, my, ax, ay, fire, sp: 0 };
    }

    /* läge för ritning och nätverk */
    snap() {
      const R = v => Math.round(v);
      return {
        ph: this.phase, tm: Math.max(0, Math.ceil(this.time)), ov: this.over ? 1 : 0, w: this.winner, map: this.opt.map, mode: this.opt.mode, kl: this.opt.killLimit,
        T: this.T.map(t => ({ id: t.id, n: t.name, ch: t.ch, m: t.model, tm: t.team, x: R(t.x), y: R(t.y), a: Math.round(t.a * 100) / 100, ta: Math.round(t.ta * 100) / 100,
          hp: R(t.hp), mh: t.maxhp, al: t.alive ? 1 : 0, sh: t.shield > 0 ? 1 : 0, tu: t.turbo > 0 ? 1 : 0, bo: t.boost > 0 ? 1 : 0, tr: t.triple > 0 ? 1 : 0,
          cd: Math.max(0, Math.round(t.cd * 10) / 10), cdm: Math.round(t.spCd * 10) / 10, sp: t.sp, k: t.kills, d: t.deaths, lv: t.lives, rs: t.alive ? 0 : Math.max(0, Math.ceil(t.resp)), ht: t.hitT > 0 ? 1 : 0, out: t.out ? 1 : 0, bot: t.bot })),
        B: this.bullets.map(b => [R(b.x), R(b.y), b.k]),
        M: this.mines.map(m => [R(m.x), R(m.y), m.o, m.arm > 0 ? 0 : 1]),
        P: this.picks.map(p => [R(p.x), R(p.y), p.k]),
        C: this.crates.map(c => c.hp > 0 ? 1 : 0),
        ev: this.ev.slice(-30)
      };
    }
    result() { return this.T.map(t => ({ id: t.id, name: t.name, ch: t.ch, kills: t.kills, deaths: t.deaths, dmg: Math.round(t.dmgDone), shots: t.shots, hits: t.hits, crates: t.crates, team: t.team, bot: t.bot })); }
  }

  const TK = { DT, W, H, CELL, MODELS, SPECIAL, MAPS, UPG_KEYS, cleanUp, botUp, Game, RNG, segRect };
  if (typeof module !== 'undefined' && module.exports) module.exports = TK; else root.TK = TK;
})(this);
