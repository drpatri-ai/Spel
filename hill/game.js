/* Bucinca Backracet – fysik, bana och ritning.
   Världen mäts i meter: x åt höger, y uppåt. Bilen är en stel kaross med två fjädrande hjul. */
(function (g) {
  'use strict';
  const SUB = 6;                 // delsteg per bildruta (stabil fjädring)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;

  /* ---------------- banor ---------------- */
  const STAGES = {
    land: { name: 'Landsvägen', g: 9.8, mu: 1.45, amps: [6, 2.8, 0.45], lens: [60, 19, 5], grow: 1 / 420, steep: 1.0,
      sky: ['#5EC2FF', '#D8F3FF'], hill1: '#A9DF95', hill2: '#86D07A', far: '#9BB7D8', dirt: '#8B5A2B', dirt2: '#6E4420', road: '#D9B27C', grass: '#6CC24A', trees: '#2F8F46' },
    skog: { name: 'Skogen', g: 9.8, mu: 1.35, amps: [9, 4, 0.9], lens: [50, 15, 4], grow: 1 / 380, steep: 1.15,
      sky: ['#7FC8E8', '#E6F6E0'], hill1: '#6FAE5B', hill2: '#4E9447', far: '#7FA6A0', dirt: '#6B4423', dirt2: '#4F3018', road: '#B88A5A', grass: '#3F9A3A', trees: '#1F6B36' },
    fjall: { name: 'Fjället', g: 9.8, mu: 1.0, amps: [16, 5.5, 1.2], lens: [80, 20, 5], grow: 1 / 360, steep: 1.25,
      sky: ['#9FD3FF', '#FFFFFF'], hill1: '#E8F1FA', hill2: '#D3E3F2', far: '#B7C7DA', dirt: '#7D8696', dirt2: '#5F6878', road: '#F4F8FF', grass: '#FFFFFF', trees: '#3E6B5A' },
    mane: { name: 'Månen', g: 3.4, mu: 1.25, amps: [12, 6, 1.5], lens: [65, 22, 6], grow: 1 / 420, steep: 1.3,
      sky: ['#05061A', '#24275A'], hill1: '#4A4D66', hill2: '#3A3C52', far: '#2D2F45', dirt: '#6D6F80', dirt2: '#55576A', road: '#A8AABB', grass: '#C9CBD8', trees: null }
  };

  // deterministisk slump (samma bana varje gång → rekord går att jämföra)
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function Terrain(stageId) {
    const S = STAGES[stageId];
    const r = rng({ land: 11, skog: 23, fjall: 37, mane: 51 }[stageId]);
    const oct = S.lens.map(() => { const v = []; for (let i = 0; i < 4096; i++) v.push(r() * 2 - 1); return v; });
    const noise = (o, x) => { const i = Math.floor(x), f = x - i, a = oct[o][i & 4095], b = oct[o][(i + 1) & 4095]; const t = (1 - Math.cos(f * Math.PI)) / 2; return a + (b - a) * t; };
    this.S = S;
    this.h = [];                   // höjd var 1 m
    let prev = 0;
    this.ensure = upto => {
      for (let x = this.h.length; x <= upto; x++) {
        let y;
        if (x < 18) y = 0;
        else {
          // kullarna börjar små och växer – ingen tvär vägg direkt
          const diff = Math.min(1, 0.32 + (x - 18) / 330) * (1 + (x - 18) * S.grow);
          y = 0;
          for (let o = 0; o < S.lens.length; o++) y += noise(o, x / S.lens[o]) * S.amps[o] * (o === 0 ? diff : Math.min(2.2, diff));
          y += (x - 18) * 0.02;    // långsamt uppför
          const ramp = Math.min(1, (x - 18) / 25);
          y *= ramp;
          y = clamp(y, prev - S.steep, prev + S.steep);   // aldrig brantare än ca 45–50°
        }
        this.h.push(y);
        prev = y;
      }
    };
    this.ensure(400);
    this.at = x => { if (x < 0) return x < -3 ? 30 : 0; this.ensure(Math.ceil(x) + 2); const i = Math.floor(x), f = x - i; return this.h[i] + (this.h[i + 1] - this.h[i]) * f; };
    this.slope = x => { this.ensure(Math.ceil(x) + 2); const i = Math.max(0, Math.floor(x)); return this.h[i + 1] - this.h[i]; };
    // närmaste punkt på markens linjestycken till punkten (px,py), inom ±rad meter
    this.closest = (px, py, rad) => {
      let best = { x: px, y: 0, sx: 1, sy: 0 }, bd = Infinity;
      if (!isFinite(px) || !isFinite(py)) { best.d = 99; return best; }
      if (px < 0.5) { bd = (py) ** 2; best = { x: px, y: 0, sx: 1, sy: 0 }; }
      const a = Math.max(0, Math.floor(px - rad - 1)), b = Math.max(a + 1, Math.ceil(px + rad + 1));
      this.ensure(b + 2);
      for (let i = a; i < b; i++) {
        const x1 = i, y1 = this.h[i], x2 = i + 1, y2 = this.h[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
        t = clamp(t, 0, 1);
        const qx = x1 + dx * t, qy = y1 + dy * t;
        const d = (px - qx) ** 2 + (py - qy) ** 2;
        if (d < bd) { bd = d; best = { x: qx, y: qy, sx: dx, sy: dy }; }
      }
      best.d = Math.sqrt(bd);
      return best;
    };
  }

  /* ---------------- bilen ---------------- */
  function Car(def, ups, stage) {
    const M = CAR_META[def.id];
    const mpp = def.len / M.w;                 // meter per bildpixel
    this.def = def; this.meta = M; this.mpp = mpp;
    const axleY = (M.rear[1] + M.front[1]) / 2;
    this.comPx = { x: (M.rear[0] + M.front[0]) / 2, y: axleY - def.comH / mpp };
    const loc = (px, py) => ({ x: (px - this.comPx.x) * mpp, y: -(py - this.comPx.y) * mpp });
    // uppgraderingar: motor, fjädring, däck, tank (0–10)
    const u = Object.assign({ engine: 0, susp: 0, tires: 0, fuel: 0 }, ups);
    this.torque = def.torque * (1 + 0.1 * u.engine);
    this.vmax = def.vmax * (1 + 0.045 * u.engine);
    this.mu = def.grip * (1 + 0.06 * u.tires) * stage.mu;
    this.fuelMax = def.fuel * (1 + 0.12 * u.fuel);
    this.fuel = this.fuelMax;
    const sk = 1 + 0.1 * u.susp;
    // kaross
    this.M = def.mass; this.I = def.mass * (def.len * def.len + 1.5 * 1.5) / 12 * 0.9;
    this.x = 4; this.y = 0; this.a = 0; this.vx = 0; this.vy = 0; this.w = 0;
    // hjul
    this.wheels = ['rear', 'front'].map(k => {
      const [px, py, pr] = M[k];
      const r = pr * mpp;
      const anchor = loc(px, py);
      anchor.y -= 0.05;   // lite ihoptryckt i vila
      const m = 35;
      return { k, r, m, I: 0.5 * m * r * r, anchor, x: 0, y: 0, vx: 0, vy: 0, th: 0, om: 0, contact: false,
        kS: def.mass * 0.5 * Math.pow(2 * Math.PI * def.freq * sk, 2), cS: 0, drive: def.drive === 'awd' || def.drive === k, travUp: 0.2 * sk, travDn: 0.16 * sk, n: { x: 0, y: 1 } };
    });
    this.wheels.forEach(w => { w.cS = 2 * def.damp * Math.sqrt(w.kS * def.mass * 0.5); });
    this.hull = M.hull.map(([px, py]) => loc(px, py));
    this.headLoc = loc(M.head[0], M.head[1] - M.head[2] * 0.9);
    this.headPx = M.head;
    // ställ bilen på marken
    this.place = (x, y) => {
      this.x = x; this.y = y; this.a = 0; this.vx = this.vy = this.w = 0;
      for (const w of this.wheels) { w.x = x + w.anchor.x; w.y = y + w.anchor.y; w.vx = w.vy = 0; w.om = 0; }
    };
  }
  Car.prototype.toWorld = function (lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  };

  /* ---------------- spelvärlden ---------------- */
  function World(opts, hooks) {
    this.opts = opts; this.hooks = hooks;
    this.T = new Terrain(opts.stage);
    this.S = this.T.S;
    this.car = new Car(opts.carDef, opts.ups, this.S);
    const c = this.car;
    const startY = this.T.at(4) + 0.75;
    c.place(4, startY);
    this.t = 0; this.gas = 0; this.brake = 0;
    this.coins = 0; this.flips = 0; this.air = 0; this.airRot = 0; this.maxX = 0;
    this.items = []; this.genX = 30; this.nextFuel = 115; this.fuelCount = 0;
    this.parts = []; this.texts = [];
    this.over = null; this.stillT = 0; this.flipT = 0; this.upsideT = 0;
    this.gen();
  }
  World.prototype.gen = function () {
    const T = this.T;
    while (this.genX < this.maxX + 260) {
      const x0 = this.genX;
      // myntgrupp
      const n = 4 + Math.floor(Math.random() * 3);
      const val = x0 > 1500 ? 100 : x0 > 500 ? 25 : 5;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 1.1;
        this.items.push({ k: 'coin', x, y: T.at(x) + 1.15, v: val, ph: i * 0.6 });
      }
      this.genX += 55 + Math.random() * 50;
      if (this.genX > this.nextFuel) {
        const x = this.nextFuel;
        this.items.push({ k: 'fuel', x, y: T.at(x) + 1.3 });
        this.fuelCount++;
        this.nextFuel += 165 + this.fuelCount * 50 + Math.random() * 45;
      }
    }
    if (this.items.length > 400) this.items = this.items.filter(it => it.x > this.car.x - 40);
  };
  World.prototype.say = function (x, y, txt, col) { this.texts.push({ x, y, txt, col: col || '#FFD23F', life: 0 }); };
  World.prototype.burst = function (x, y, cols, n, spd, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.3 + Math.random() * 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.abs(Math.sin(a)) * v, life: 0, max: 0.5 + Math.random() * 0.5, c: cols[i % cols.length], r: 0.06 + Math.random() * 0.08, g: grav == null ? 9 : grav });
    }
  };

  World.prototype.step = function (dt) {
    const c = this.car, T = this.T, G = this.S.g, def = c.def;
    if (this.over) return;
    this.t += dt;
    const fuelOk = c.fuel > 0;
    const gas = fuelOk ? this.gas : 0, brake = fuelOk ? this.brake : 0;
    c.fuel = Math.max(0, c.fuel - dt * (gas ? 1 : 0.3));
    const h = dt / SUB;
    let anyContact = false, hullContact = false;
    for (let s = 0; s < SUB; s++) {
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      const ux = -sa, uy = ca;          // karossens "upp"
      const fx = ca, fy = sa;           // karossens "fram"
      // gravitation
      c.vy -= G * h;
      // fjädring
      for (const w of c.wheels) {
        w.vy -= G * h;
        const A = c.toWorld(w.anchor.x, w.anchor.y);
        const rAx = A.x - c.x, rAy = A.y - c.y;
        const vAx = c.vx - c.w * rAy, vAy = c.vy + c.w * rAx;
        const dx = w.x - A.x, dy = w.y - A.y;
        const sAx = dx * ux + dy * uy;                    // >0: hjulet ihoptryckt uppåt
        const relU = (w.vx - vAx) * ux + (w.vy - vAy) * uy;
        const F = -w.kS * sAx - w.cS * relU;               // kraft på hjulet längs "upp"
        w.vx += F * ux / w.m * h; w.vy += F * uy / w.m * h;
        c.vx -= F * ux / c.M * h; c.vy -= F * uy / c.M * h;
        c.w -= cross(rAx, rAy, F * ux, F * uy) / c.I * h;
        w._A = A; w._rA = { x: rAx, y: rAy };
      }
      // motor & broms
      const fwdSpeed = c.vx * fx + c.vy * fy;
      for (const w of c.wheels) {
        let tq = 0;
        const drivers = def.drive === 'awd' ? 2 : 1;
        if (w.drive) {
          const wsp = -w.om * w.r;                          // hjulets fart framåt
          if (gas) tq = -c.torque / drivers * gas * clamp(1 - wsp / c.vmax, 0, 1);
          if (brake) {
            if (fwdSpeed > 1.0 && wsp > 0.5) tq = c.torque / drivers * 1.4 * brake;        // bromsa
            else tq = c.torque / drivers * 0.6 * brake * clamp(1 + wsp / (c.vmax * 0.4), 0, 1); // backa
          }
        } else if (brake && fwdSpeed > 1.0 && -w.om * w.r > 0.5) tq = c.torque * 0.5 * brake;
        w.om += tq / w.I * h;
        c.w -= tq / c.I * h * 0.18;                         // reaktion i karossen (stegring)
        w.om *= 1 - 0.25 * h;                               // rullmotstånd
      }
      // styrning i luften
      if (!this._contactPrev) c.w += (gas - brake) * 2.6 * def.air * h;
      // markkontakt för hjulen (hastighetsnivå)
      let contacts = 0;
      for (const w of c.wheels) {
        const q = T.closest(w.x, w.y, w.r + 0.3);
        w.contact = false;
        if (q.d < w.r + 0.02) {
          let nx = w.x - q.x, ny = w.y - q.y;
          const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
          if (ny < 0.05) { nx = -q.sy; ny = q.sx; const L2 = Math.hypot(nx, ny); nx /= L2; ny /= L2; }
          w.contact = true; contacts++; w.n = { x: nx, y: ny };
          const vn = w.vx * nx + w.vy * ny;
          let Jn = 0;
          if (vn < 0) { Jn = -vn * w.m * 1.05; w.vx += Jn / w.m * nx; w.vy += Jn / w.m * ny; }
          const tx = ny, ty = -nx;                          // tangent (framåt längs marken)
          const vpt = w.vx * tx + w.vy * ty + w.om * w.r;
          let j = -vpt / (1 / w.m + w.r * w.r / w.I);
          const lim = c.mu * (Jn + w.m * G * h * Math.max(0, ny)) * 1.0;
          j = clamp(j, -lim, lim);
          w.vx += j / w.m * tx; w.vy += j / w.m * ty; w.om += j * w.r / w.I;
          // positionskorrigering
          const pen = w.r - q.d;
          if (pen > 0) { w.x += nx * pen; w.y += ny * pen; }
        }
      }
      this._contactPrev = contacts > 0;
      anyContact = anyContact || contacts > 0;
      // sidled: hjulet sitter fast längs karossens framriktning; ändstopp för fjädringen
      for (let it = 0; it < 2; it++) for (const w of c.wheels) {
        const A = c.toWorld(w.anchor.x, w.anchor.y);
        const rAx = A.x - c.x, rAy = A.y - c.y;
        for (const ax of [[fx, fy, 'lat'], [ux, uy, 'ax']]) {
          const [ex, ey, kind] = ax;
          const off = (w.x - A.x) * ex + (w.y - A.y) * ey;
          if (kind === 'ax' && off <= w.travUp && off >= -w.travDn) continue;
          const vAx = c.vx - c.w * rAy, vAy = c.vy + c.w * rAx;
          const rel = (w.vx - vAx) * ex + (w.vy - vAy) * ey;
          if (kind === 'ax' && ((off > w.travUp && rel < 0) || (off < -w.travDn && rel > 0))) { /* på väg tillbaka */ }
          else {
            const rc = cross(rAx, rAy, ex, ey);
            const K = 1 / w.m + 1 / c.M + rc * rc / c.I;
            const J = rel / K;
            w.vx -= J / w.m * ex; w.vy -= J / w.m * ey;
            c.vx += J / c.M * ex; c.vy += J / c.M * ey; c.w += rc * J / c.I;
          }
          // flytta hjulet till tillåtet läge (lite av korrektionen går till karossen)
          let target = kind === 'lat' ? 0 : clamp(off, -w.travDn, w.travUp);
          const err = off - target;
          if (Math.abs(err) > 1e-6) { w.x -= ex * err * 0.8; w.y -= ey * err * 0.8; c.x += ex * err * 0.2 * w.m / c.M * 8; c.y += ey * err * 0.2 * w.m / c.M * 8; }
        }
      }
      // karossen mot marken (stötfångare, tak)
      for (const p of c.hull) {
        const P = c.toWorld(p.x, p.y);
        const gy = T.at(P.x);
        if (P.y < gy) {
          hullContact = true;
          const sl = T.slope(P.x); let nx = -sl, ny = 1; const L = Math.hypot(nx, ny); nx /= L; ny /= L;
          const rx = P.x - c.x, ry = P.y - c.y;
          const vpx = c.vx - c.w * ry, vpy = c.vy + c.w * rx;
          const vn = vpx * nx + vpy * ny;
          if (vn < 0) {
            const rn = cross(rx, ry, nx, ny);
            const J = -(1.2) * vn / (1 / c.M + rn * rn / c.I);
            c.vx += J / c.M * nx; c.vy += J / c.M * ny; c.w += rn * J / c.I;
            const tx = ny, ty = -nx, vt = vpx * tx + vpy * ty, rt = cross(rx, ry, tx, ty);
            let Jt = -vt / (1 / c.M + rt * rt / c.I); Jt = clamp(Jt, -0.6 * J, 0.6 * J);
            c.vx += Jt / c.M * tx; c.vy += Jt / c.M * ty; c.w += rt * Jt / c.I;
          }
          const pen = gy - P.y;
          c.x += nx * pen * 0.6; c.y += ny * pen * 0.6;
        }
      }
      // luftmotstånd
      c.vx *= 1 - 0.02 * h; c.vy *= 1 - 0.02 * h; c.w *= 1 - 0.6 * h;
      c.w = clamp(c.w, -9, 9);
      // integrera
      c.x += c.vx * h; c.y += c.vy * h; c.a += c.w * h;
      for (const w of c.wheels) { w.x += w.vx * h; w.y += w.vy * h; w.th += w.om * h; }
    }
    if (c.x < 1.5) { c.x = 1.5; if (c.vx < 0) c.vx = 0; for (const w of c.wheels) { if (w.x < 0.5) { w.x = 0.5; if (w.vx < 0) w.vx = 0; } } }
    // --- spelregler ---
    if (!isFinite(c.x + c.y + c.a)) { this.end('crash'); return; }
    this.maxX = Math.max(this.maxX, c.x);
    this.gen();
    // föraren slår i huvudet
    const H = c.toWorld(c.headLoc.x, c.headLoc.y);
    if (H.y < T.at(H.x) + 0.02) { this.end('crash'); return; }
    // volter och lufttid
    const grounded = anyContact || hullContact;
    if (!grounded) {
      this.air += dt;
      this.airRot += c.w * dt;
      if (Math.abs(this.airRot) >= Math.PI * 2 * 0.92) {
        this.airRot -= Math.sign(this.airRot) * Math.PI * 2;
        this.flips++;
        const back = c.w > 0;
        const bonus = 50;
        this.coins += bonus;
        this.say(c.x, c.y + 2.2, (back ? 'Bakåtvolt!' : 'Framåtvolt!') + ' +' + bonus, '#FF6FAE');
        this.hooks.sfx('flip');
      }
    } else {
      if (this.air > 1.6) {
        const b = Math.round(this.air * 10);
        this.coins += b;
        this.say(c.x, c.y + 2, `Lufttid ${this.air.toFixed(1)} s! +${b}`, '#3B9DFF');
        this.hooks.sfx('air');
      }
      if (this.air > 0.25) { this.hooks.sfx('land', Math.min(1, -c.vy / 10)); this.burst(c.x, T.at(c.x) + 0.1, [this.S.road, this.S.dirt], 10, 3, 9); }
      this.air = 0; this.airRot = 0;
    }
    // föremål
    for (const it of this.items) {
      if (it.taken || Math.abs(it.x - c.x) > 4) continue;
      const dx = it.x - c.x, dy = it.y - c.y;
      if (dx * dx + dy * dy < (it.k === 'fuel' ? 2.6 : 2.2) ** 2) {
        it.taken = true;
        if (it.k === 'coin') { this.coins += it.v; this.hooks.sfx('coin', it.v); this.burst(it.x, it.y, ['#FFD23F', '#fff'], 4, 2, 0); }
        else { c.fuel = c.fuelMax; this.say(it.x, it.y + 1, c.def.electric ? 'Laddat! ⚡' : 'Fulltankat! ⛽', '#34C759'); this.hooks.sfx('fuel'); }
      }
    }
    // slut på bränsle: rundan tar slut när bilen står still eller börjar rulla bakåt
    const back = c.vx < -0.3 && this.car.wheels.every(w => w.om > -0.3);   // rör sig bakåt (inte bara en studs)
    if (c.fuel <= 0 && back) this.backT = (this.backT || 0) + dt; else this.backT = 0;
    if (this.backT > 0.35) { this.end('fuel'); return; }
    const sp = Math.hypot(c.vx, c.vy);
    if (c.fuel <= 0 && sp < 0.6) this.stillT += dt; else this.stillT = 0;
    if (this.stillT > 1.6) { this.end('fuel'); return; }
    // fast på taket/sidan
    if (Math.cos(c.a) < 0.1 && sp < 0.8 && grounded) this.upsideT += dt; else this.upsideT = 0;
    if (this.upsideT > 2) { this.end('stuck'); return; }
    // effekter
    for (const p of this.parts) { p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.parts = this.parts.filter(p => p.life < p.max);
    for (const t of this.texts) { t.life += dt; t.y += dt * 0.9; }
    this.texts = this.texts.filter(t => t.life < 1.5);
    // damm bakom drivhjulen
    for (const w of c.wheels) if (w.contact && w.drive && gas && Math.random() < 0.35) {
      const slip = Math.abs(-w.om * w.r - (c.vx * Math.cos(c.a) + c.vy * Math.sin(c.a)));
      if (slip > 1.5 || Math.random() < 0.15) this.parts.push({ x: w.x - w.r * 0.6, y: w.y - w.r * 0.8, vx: -1 - Math.random() * 2, vy: 0.5 + Math.random() * 1.5, life: 0, max: 0.6, c: this.S.road, r: 0.08 + Math.random() * 0.1, g: 2 });
    }
  };
  World.prototype.end = function (why) {
    if (this.over) return;
    this.over = why;
    const c = this.car;
    if (why === 'crash') { this.burst(c.x, c.y + 0.8, ['#fff', '#FFD23F', '#FF4D6D'], 24, 5, 6); this.say(c.x, c.y + 2.5, 'KRASCH! 💥', '#FF4D6D'); }
    this.hooks.end({ why, dist: Math.max(0, Math.floor(this.maxX - 4)), coins: this.coins, flips: this.flips });
  };

  /* ---------------- ritning ---------------- */
  function Renderer(cv, imgs) {
    this.cv = cv; this.ctx = cv.getContext('2d'); this.imgs = imgs;
    this.cam = { x: 0, y: 0, z: 1 };
    this.resize();
  }
  Renderer.prototype.resize = function () {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    this.W = this.cv.clientWidth || 1; this.H = this.cv.clientHeight || 1;
    this.cv.width = Math.round(this.W * this.DPR); this.cv.height = Math.round(this.H * this.DPR);
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  Renderer.prototype.draw = function (wd, dt) {
    const ctx = this.ctx, W = this.W, H = this.H, c = wd.car, S = wd.S, T = wd.T;
    // kamera: bilen en bit till vänster, zooma ut lite med farten
    const sp = Math.hypot(c.vx, c.vy);
    const base = Math.min(H / 8.5, W / 9.5);
    const z = base * clamp(1.08 - sp / 90, 0.72, 1.08);
    const cam = this.cam;
    const lead = Math.min(6, W * 0.14 / (cam.z || base));
    const tx = c.x + clamp(c.vx * 0.25, -lead * 0.5, lead), ty = c.y + 0.6;
    if (!this._init) { cam.x = tx; cam.y = ty; cam.z = z; this._init = true; }
    const k = Math.min(1, dt * 4);
    cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * k; cam.z += (z - cam.z) * Math.min(1, dt * 1.5);
    const ppm = cam.z, ox = W * (W < H ? 0.4 : 0.36), oy = H * (W < H ? 0.6 : 0.58);
    const SX = x => ox + (x - cam.x) * ppm, SY = y => oy - (y - cam.y) * ppm;
    this.SX = SX; this.SY = SY; this.ppm = ppm;
    // himmel
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, S.sky[0]); gr.addColorStop(1, S.sky[1]);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (S === STAGES.mane) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 90; i++) { const x = ((hash(i) * W * 2 - cam.x * 2) % W + W) % W; ctx.globalAlpha = 0.4 + hash(i + 4) * 0.6; ctx.fillRect(x, hash(i + 9) * H * 0.7, 2, 2); }
      ctx.globalAlpha = 1;
      // jorden
      ctx.fillStyle = '#3B9DFF'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.18, Math.min(W, H) * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#34C759'; ctx.beginPath(); ctx.arc(W * 0.79, H * 0.17, Math.min(W, H) * 0.035, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = '#FFF3A0'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, Math.min(W, H) * 0.06, 0, 7); ctx.fill();
      // moln
      ctx.fillStyle = '#ffffffd0';
      for (let i = -2; i < 8; i++) {
        const cx = ((i * W * 0.32 - cam.x * ppm * 0.08) % (W * 2.6) + W * 2.6) % (W * 2.6) - W * 0.4, cy = H * (0.1 + hash(i) * 0.2), r = Math.min(W, H) * (0.04 + hash(i + 3) * 0.03);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.arc(cx + r * 1.2, cy - r * 0.5, r * 1.25, 0, 7); ctx.arc(cx + r * 2.4, cy, r * 0.95, 0, 7); ctx.rect(cx, cy - r * 0.3, r * 2.4, r * 1.2); ctx.fill();
      }
    }
    // berg och kullar (parallax)
    const layer = (f, amp, base, col, seed, peaks) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
      for (let px = 0; px <= W + 8; px += 8) {
        const wx = (px - ox) / ppm * 1 + cam.x * f;
        let y = Math.sin(wx * 0.05 + seed) * 0.6 + Math.sin(wx * 0.13 + seed * 2) * 0.3 + Math.sin(wx * 0.021 + seed * 3) * 0.8;
        if (peaks) y = Math.abs(Math.sin(wx * 0.035 + seed)) * 1.6 + Math.sin(wx * 0.11) * 0.2;
        ctx.lineTo(px, H * base - y * amp * H - (cam.y * ppm * f * 0.15));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    };
    layer(0.05, 0.12, 0.5, S.far, 1.7, true);
    layer(0.15, 0.05, 0.62, S.hill1, 4.1);
    if (S.trees) {   // granar på mellersta kullen
      ctx.fillStyle = S.trees;
      const f = 0.25;
      for (let i = Math.floor((cam.x * f - W / ppm) / 3); i < (cam.x * f + 2 * W / ppm) / 3; i++) {
        if (hash(i) < 0.45) continue;
        const wx = i * 3 + hash(i + 7) * 2;
        const px = ox + (wx - cam.x * f) * ppm;
        const by = H * 0.68 - (cam.y * ppm * f * 0.15) - hash(i + 2) * H * 0.03;
        const th = ppm * (1.6 + hash(i + 5) * 1.6);
        ctx.beginPath(); ctx.moveTo(px, by - th); ctx.lineTo(px + th * 0.32, by); ctx.lineTo(px - th * 0.32, by); ctx.fill();
      }
    }
    layer(0.3, 0.035, 0.72, S.hill2, 2.3);
    // marken
    const x0 = Math.floor(cam.x - ox / ppm) - 1, x1 = Math.ceil(cam.x + (W - ox) / ppm) + 1;
    T.ensure(x1 + 2);
    ctx.beginPath(); ctx.moveTo(SX(x0), H + 10);
    for (let x = x0; x <= x1; x++) ctx.lineTo(SX(x), SY(T.at(x)));
    ctx.lineTo(SX(x1), H + 10); ctx.closePath();
    ctx.fillStyle = S.dirt; ctx.fill();
    // stenar i jorden
    ctx.fillStyle = S.dirt2;
    for (let x = x0; x <= x1; x++) {
      if (hash(x * 3.1) < 0.55) continue;
      const yy = T.at(x) - 0.7 - hash(x) * 2.5;
      ctx.beginPath(); ctx.ellipse(SX(x + hash(x + 1)), SY(yy), ppm * (0.15 + hash(x + 2) * 0.25), ppm * (0.1 + hash(x + 3) * 0.15), 0, 0, 7); ctx.fill();
    }
    // vägbanan och gräskanten
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { const px = SX(x), py = SY(T.at(x) - 0.22); x === x0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.strokeStyle = S.road; ctx.lineWidth = Math.max(6, ppm * 0.45); ctx.stroke();
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { const px = SX(x), py = SY(T.at(x) - 0.02); x === x0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.strokeStyle = S.grass; ctx.lineWidth = Math.max(3, ppm * 0.12); ctx.stroke();
    // grästuvor
    if (S !== STAGES.mane) {
      ctx.strokeStyle = S.grass; ctx.lineWidth = Math.max(1.5, ppm * 0.05);
      for (let x = x0; x <= x1; x++) {
        if (hash(x * 1.7) < 0.6) continue;
        const gx = x + hash(x) * 0.8, px = SX(gx), py = SY(T.at(gx));
        ctx.beginPath(); for (let j = -1; j <= 1; j++) { ctx.moveTo(px + j * ppm * 0.08, py); ctx.lineTo(px + j * ppm * 0.16, py - ppm * (0.22 + 0.06 * (1 - Math.abs(j)))); } ctx.stroke();
      }
    } else {   // kratrar
      ctx.fillStyle = '#56586B';
      for (let x = x0; x <= x1; x++) { if (hash(x * 2.3) < 0.8) continue; ctx.beginPath(); ctx.ellipse(SX(x), SY(T.at(x) - 0.25), ppm * 0.5, ppm * 0.12, 0, 0, 7); ctx.fill(); }
    }
    // avståndsskyltar
    ctx.font = `700 ${Math.max(12, ppm * 0.32)}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let m = Math.ceil((x0 - 4) / 50) * 50; m <= x1; m += 50) {
      if (m <= 0) continue;
      const wx = m + 4, px = SX(wx), py = SY(T.at(wx));
      ctx.fillStyle = '#5A3A1A'; ctx.fillRect(px - ppm * 0.04, py - ppm * 1.3, ppm * 0.08, ppm * 1.3);
      const tw = ctx.measureText(m + ' m').width + ppm * 0.3;
      ctx.fillStyle = '#fff'; ctx.fillRect(px - tw / 2, py - ppm * 1.75, tw, ppm * 0.5);
      ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2; ctx.strokeRect(px - tw / 2, py - ppm * 1.75, tw, ppm * 0.5);
      ctx.fillStyle = '#2B2350'; ctx.fillText(m + ' m', px, py - ppm * 1.5);
    }
    // rekordflagga
    if (wd.opts.best > 0) {
      const wx = wd.opts.best + 4;
      if (wx > x0 && wx < x1) {
        const px = SX(wx), py = SY(T.at(wx));
        ctx.fillStyle = '#2B2350'; ctx.fillRect(px - 2, py - ppm * 2.4, 4, ppm * 2.4);
        ctx.fillStyle = '#FF4D6D'; ctx.beginPath(); ctx.moveTo(px + 2, py - ppm * 2.4); ctx.lineTo(px + ppm * 1.1, py - ppm * 2.1); ctx.lineTo(px + 2, py - ppm * 1.8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(10, ppm * 0.2)}px Fredoka, sans-serif`; ctx.fillText('Rekord', px + ppm * 0.45, py - ppm * 2.1);
      }
    }
    // mynt och bränsle
    for (const it of wd.items) {
      if (it.taken || it.x < x0 - 1 || it.x > x1 + 1) continue;
      const px = SX(it.x), py = SY(it.y);
      if (it.k === 'coin') {
        const r = ppm * (it.v >= 100 ? 0.42 : it.v >= 25 ? 0.36 : 0.3);
        const wq = Math.abs(Math.cos(wd.t * 3 + it.ph)) * r + 1;
        ctx.fillStyle = it.v >= 100 ? '#FFB300' : it.v >= 25 ? '#D9DEE8' : '#FFD23F';
        ctx.strokeStyle = it.v >= 25 && it.v < 100 ? '#8A93A6' : '#B07A00'; ctx.lineWidth = Math.max(1.5, ppm * 0.05);
        ctx.beginPath(); ctx.ellipse(px, py, wq, r, 0, 0, 7); ctx.fill(); ctx.stroke();
        if (wq > r * 0.5) { ctx.fillStyle = ctx.strokeStyle; ctx.font = `700 ${r * 0.9}px Fredoka, sans-serif`; ctx.fillText(it.v >= 100 ? '100' : it.v >= 25 ? '25' : '5', px, py + 1); }
      } else {
        const s = ppm * 0.55, bob = Math.sin(wd.t * 3) * ppm * 0.08;
        if (c.def.electric) {
          ctx.fillStyle = '#34C759'; ctx.strokeStyle = '#1B6B2F'; ctx.lineWidth = 2;
          ctx.fillRect(px - s * 0.45, py - s * 0.8 + bob, s * 0.9, s * 1.6); ctx.strokeRect(px - s * 0.45, py - s * 0.8 + bob, s * 0.9, s * 1.6);
          ctx.fillRect(px - s * 0.18, py - s * 0.95 + bob, s * 0.36, s * 0.15);
          ctx.fillStyle = '#fff'; ctx.font = `700 ${s}px sans-serif`; ctx.fillText('⚡', px, py + bob);
        } else {
          ctx.fillStyle = '#E53935'; ctx.strokeStyle = '#7F1D1D'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px - s * 0.6, py + s * 0.8 + bob); ctx.lineTo(px - s * 0.6, py - s * 0.5 + bob); ctx.lineTo(px - s * 0.25, py - s * 0.8 + bob); ctx.lineTo(px + s * 0.6, py - s * 0.8 + bob); ctx.lineTo(px + s * 0.6, py + s * 0.8 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#FFD23F'; ctx.fillRect(px - s * 0.6, py - s * 0.95 + bob, s * 0.3, s * 0.2);
          ctx.fillStyle = '#fff'; ctx.font = `700 ${s * 0.75}px Fredoka, sans-serif`; ctx.fillText('⛽', px, py + bob + s * 0.1);
        }
      }
    }
    // partiklar bakom bilen
    for (const p of wd.parts) { ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), Math.max(1.5, p.r * ppm), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    this.drawCar(wd);
    // texter
    for (const t of wd.texts) {
      const a = 1 - Math.max(0, t.life - 1) / 0.5, k2 = Math.min(1, t.life / 0.15);
      const fs = Math.min(48, Math.max(20, Math.min(W, H) * 0.065)) * (0.6 + 0.4 * k2);
      ctx.globalAlpha = Math.max(0, a); ctx.font = `700 ${fs}px Fredoka, sans-serif`;
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#2B2350'; ctx.lineJoin = 'round';
      const x = clamp(SX(t.x), fs * 4, W - fs * 4), y = clamp(SY(t.y), fs * 2.5, H - fs);
      ctx.strokeText(t.txt, x, y); ctx.fillStyle = t.col; ctx.fillText(t.txt, x, y);
    }
    ctx.globalAlpha = 1;
  };
  Renderer.prototype.drawCar = function (wd) {
    const ctx = this.ctx, c = wd.car, M = c.meta, ppm = this.ppm, SX = this.SX, SY = this.SY;
    const body = this.imgs.body, wheel = this.imgs.wheel, face = this.imgs.face;
    const k = c.mpp * ppm;                         // skärmpixlar per bildpixel
    // skugga
    const gy = wd.T.at(c.x);
    const sh = clamp(1 - (c.y - gy) / 8, 0.2, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.18 * sh})`; ctx.beginPath(); ctx.ellipse(SX(c.x), SY(gy) + 2, M.w * k * 0.42 * sh, ppm * 0.12, 0, 0, 7); ctx.fill();
    // kaross
    ctx.save();
    ctx.translate(SX(c.x), SY(c.y)); ctx.rotate(-c.a);
    if (body && (body.tagName === 'CANVAS' ? body.width > 0 : body.complete && body.naturalWidth > 0)) ctx.drawImage(body, -c.comPx.x * k, -c.comPx.y * k, M.w * k, M.h * k);
    // föraren: vald figurs ansikte i rutan
    if (face && face.complete && face.naturalWidth) {
      const [hx, hy, hr] = M.head;
      const r = hr * k * 1.25, cx = (hx - c.comPx.x) * k, cy = (hy - c.comPx.y) * k + Math.sin(wd.t * 9) * r * 0.04;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.closePath();
      ctx.globalAlpha = c.def.tinted ? 0.85 : 1;
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
      const m = Math.min(face.naturalWidth, face.naturalHeight);
      ctx.drawImage(face, (face.naturalWidth - m) / 2, (face.naturalHeight - m) / 2, m, m, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();
      ctx.lineWidth = Math.max(1.5, r * 0.1); ctx.strokeStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    }
    ctx.restore();
    // hjulen
    for (const w of c.wheels) {
      const sz = M.wheelSize * k;
      ctx.save(); ctx.translate(SX(w.x), SY(w.y)); ctx.rotate(-w.th);
      if (wheel && wheel.complete && wheel.naturalWidth) ctx.drawImage(wheel, -sz / 2, -sz / 2, sz, sz);
      else { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, w.r * ppm, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  };

  g.Hill = { STAGES, Terrain, Car, World, Renderer, SUB };
})(this);
