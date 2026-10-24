/* Bucinca Krockarenan – striden. Två bilar kör mot varandra av sig själva och vapnen slår till automatiskt.
   Hela striden räknas ut i förväg och spelas in som en repris (30 bilder/s) som alla enheter sedan visar –
   så blir det exakt samma strid hos alla i en nätverksmatch.
   Enheter: meter, sekunder, kg. y uppåt, marken vid y = 0. Bil 0 startar till vänster och tittar åt höger. */
'use strict';
const KSIM = (() => {
  const P = typeof KR !== 'undefined' ? KR : require('./parts.js');
  const G = 14, DT = 1 / 60, SUB = 6, ARENA = 12, TMAX = 45, FPS_EVERY = 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const hyp = Math.hypot;

  /* ---------- bilens form (används även av ritningen) ---------- */
  function geom(fb) {
    const C = P.CHASSIS[fb.c], Wh = P.WHEELS[fb.w];
    const L = C.L, H = C.H;
    const mount = {
      front: [L / 2, C.wedge ? -H * 0.2 : 0], top: [L * 0.15, H / 2], top2: [-L * 0.28, H / 2], back: [-L / 2, 0]
    };
    const parts = [];
    let mass = C.mass;
    for (const sl of C.slots) {
      const e = fb.s[sl]; if (!e) continue;
      const [id, lv] = e, W = P.WEAPONS[id];
      const [mx, my] = mount[sl];
      const sx = sl === 'back' ? -1 : 1;
      const p = { sl, id, lv, mx, my, sx, solid: [], m: P.mult(lv) };
      mass += W.mass;
      if (id === 'sag') {
        p.r = 0.42;
        p.cx = sl === 'top' ? mx + 0.3 : sl === 'top2' ? mx : mx + sx * 0.4;
        p.cy = sl === 'top' || sl === 'top2' ? my + 0.42 : my;
      } else if (id === 'lans') {
        p.solid.push({ cx: mx + sx * 0.7, cy: my, hx: 0.7, hy: 0.06, k: 'lans' });
        p.tx = mx + sx * 1.4; p.ty = my;
      } else if (id === 'hammare') {
        p.px = mx; p.py = my + 0.15; p.len = 1.25; p.hr = 0.24; p.rest = 1.95; p.hit = -0.35;
      } else if (id === 'raket') {
        p.ox = mx + 0.05; p.oy = my + 0.22;
      } else if (id === 'laser') {
        p.ox = mx + (sl === 'front' ? 0.12 : 0.18); p.oy = my + (sl === 'front' ? 0.05 : 0.2);
      } else if (id === 'boost') {
        p.ox = mx - 0.15; p.oy = my;
      } else if (id === 'lyft') {
        p.px = mx - 0.05; p.py = my - H * 0.32; p.len = 0.95;
        p.solid.push({ k: 'lyft', plate: true, hx: 0.48, hy: 0.05 });
      } else if (id === 'skold') {
        if (sl === 'front' || sl === 'back') p.solid.push({ cx: mx + sx * 0.14, cy: my, hx: 0.12, hy: H * 0.66, k: 'skold' });
        else p.solid.push({ cx: mx, cy: my + 0.1, hx: L * 0.22, hy: 0.07, k: 'skold' });
      }
      parts.push(p);
    }
    const wheels = C.wheels.map(wx => ({ ax: wx * L / 2.2 * (2.2 / 2.2), ay: -H / 2 - Wh.r * 0.3, r: Wh.r }));
    return { fb, L, H, wedge: !!C.wedge, wheels, parts, mass, hpMax: P.hpOf(fb), C, Wh };
  }

  /* ---------- bil ---------- */
  function Car(fb, side) {
    const g = geom(fb);
    this.g = g; this.side = side; this.dir = side === 0 ? 1 : -1;
    this.M = g.mass; this.I = this.M * (g.L * g.L + g.H * g.H) / 12 * 1.1;
    this.hp = this.hpMax = g.hpMax;
    this.x = side === 0 ? -5.5 : 5.5; this.a = 0; this.vx = this.vy = this.w = 0;
    const Wh = g.Wh, n = g.wheels.length;
    const kS = this.M / n * Math.pow(2 * Math.PI * 2.3, 2);
    this.wheels = g.wheels.map(w => ({ ax: w.ax, ay: w.ay, r: w.r, m: Wh.mass, I: 0.5 * Wh.mass * w.r * w.r, x: 0, y: 0, vx: 0, vy: 0, th: 0, om: 0,
      kS, cS: 2 * 0.55 * Math.sqrt(kS * this.M / n), grip: Wh.grip, travUp: 0.18, travDn: 0.14, contact: false }));
    this.y = -Math.min(...g.wheels.map(w => w.ay - w.r)) + 0.02;
    for (const w of this.wheels) { const A = this.toW(w.ax, w.ay); w.x = A.x; w.y = A.y; }
    this.vmax = 6.2 * g.C.speed * Wh.spd * clamp(Math.sqrt(g.C.mass / this.M), 0.75, 1);
    this.acc = 7.5 * g.C.speed;
    this.st = g.parts.map((p, i) => ({ cd: 0.4 + i * 0.25, t: i * 0.3, ang: p.id === 'hammare' ? p.rest : 0, phase: 'rest', on: 0, bx: 0, by: 0, dmgT: 0 }));
    this.dmgAcc = 0; this.dmgAccT = 0; this.dead = false;
  }
  Car.prototype.toW = function (lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), X = lx * this.dir;
    return { x: this.x + X * c - ly * s, y: this.y + X * s + ly * c };
  };
  Car.prototype.vecW = function (lx, ly) {
    const c = Math.cos(this.a), s = Math.sin(this.a), X = lx * this.dir;
    return { x: X * c - ly * s, y: X * s + ly * c };
  };
  Car.prototype.velAt = function (px, py) { return { x: this.vx - this.w * (py - this.y), y: this.vy + this.w * (px - this.x) }; };
  /* fasta former i världen: kaross + sköldar/lans/lyftarm */
  Car.prototype.shapes = function () {
    const out = [this.obb({ cx: 0, cy: 0, hx: this.g.L / 2, hy: this.g.H / 2, k: 'body' })];
    this.g.parts.forEach((p, i) => {
      for (const s of p.solid) {
        if (s.plate) {   // lyftarmen vrids
          const a = this.st[i].ang;
          out.push(this.obb({ cx: p.px + Math.cos(a) * s.hx, cy: p.py + Math.sin(a) * s.hx, hx: s.hx, hy: s.hy, ang: a, k: s.k }, i));
        } else out.push(this.obb(s, i));
      }
    });
    return out;
  };
  Car.prototype.obb = function (o, pi) {
    const C = this.toW(o.cx, o.cy), ang = this.a + this.dir * (o.ang || 0);
    return { x: C.x, y: C.y, hx: o.hx, hy: o.hy, ux: Math.cos(ang), uy: Math.sin(ang), k: o.k, pi, car: this };
  };

  /* ---------- geometri ---------- */
  function corners(b) {
    const ax = b.ux * b.hx, ay = b.uy * b.hx, bx = -b.uy * b.hy, by = b.ux * b.hy;
    return [[b.x + ax + bx, b.y + ay + by], [b.x - ax + bx, b.y - ay + by], [b.x - ax - bx, b.y - ay - by], [b.x + ax - bx, b.y + ay - by]];
  }
  function toLocal(b, px, py) { const dx = px - b.x, dy = py - b.y; return [dx * b.ux + dy * b.uy, -dx * b.uy + dy * b.ux]; }
  function inside(b, px, py, pad) { const [lx, ly] = toLocal(b, px, py); return Math.abs(lx) <= b.hx + (pad || 0) && Math.abs(ly) <= b.hy + (pad || 0); }
  function closestOn(b, px, py) {
    const [lx, ly] = toLocal(b, px, py);
    const cx = clamp(lx, -b.hx, b.hx), cy = clamp(ly, -b.hy, b.hy);
    return [b.x + cx * b.ux - cy * b.uy, b.y + cx * b.uy + cy * b.ux, Math.abs(lx) <= b.hx && Math.abs(ly) <= b.hy];
  }
  function distTo(b, px, py) { const [x, y, ins] = closestOn(b, px, py); return ins ? 0 : hyp(px - x, py - y); }
  function sat(A, B) {
    const axes = [[A.ux, A.uy], [-A.uy, A.ux], [B.ux, B.uy], [-B.uy, B.ux]];
    let best = 1e9, bn = null;
    const dx = B.x - A.x, dy = B.y - A.y;
    for (const [nx, ny] of axes) {
      const rA = A.hx * Math.abs(A.ux * nx + A.uy * ny) + A.hy * Math.abs(-A.uy * nx + A.ux * ny);
      const rB = B.hx * Math.abs(B.ux * nx + B.uy * ny) + B.hy * Math.abs(-B.uy * nx + B.ux * ny);
      const d = dx * nx + dy * ny;
      const ov = rA + rB - Math.abs(d);
      if (ov <= 0) return null;
      if (ov < best) { best = ov; bn = d >= 0 ? [nx, ny] : [-nx, -ny]; }
    }
    // kontaktpunkt: hörn som ligger inne i den andra lådan
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of corners(B)) if (inside(A, x, y, 0.01)) { sx += x; sy += y; n++; }
    for (const [x, y] of corners(A)) if (inside(B, x, y, 0.01)) { sx += x; sy += y; n++; }
    if (!n) { sx = (A.x + B.x) / 2; sy = (A.y + B.y) / 2; n = 1; }
    return { nx: bn[0], ny: bn[1], d: best, px: sx / n, py: sy / n };
  }
  function rayOBB(ox, oy, dx, dy, b) {   // returnerar avstånd eller null
    const [lx, ly] = toLocal(b, ox, oy);
    const ldx = dx * b.ux + dy * b.uy, ldy = -dx * b.uy + dy * b.ux;
    let t0 = -1e9, t1 = 1e9;
    for (const [o, d, h] of [[lx, ldx, b.hx], [ly, ldy, b.hy]]) {
      if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) return null; continue; }
      let a = (-h - o) / d, c = (h - o) / d; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) return null;
    }
    return t1 < 0 ? null : Math.max(0, t0);
  }

  /* impuls mellan två bilar i en punkt (n pekar från A mot B) */
  function impulse(A, B, px, py, nx, ny, e, mu) {
    const rAx = px - A.x, rAy = py - A.y, rBx = px - B.x, rBy = py - B.y;
    const vA = A.velAt(px, py), vB = B.velAt(px, py);
    const vr = (vB.x - vA.x) * nx + (vB.y - vA.y) * ny;
    if (vr >= 0) return 0;
    const rnA = cross(rAx, rAy, nx, ny), rnB = cross(rBx, rBy, nx, ny);
    const K = 1 / A.M + 1 / B.M + rnA * rnA / A.I + rnB * rnB / B.I;
    const j = -(1 + e) * vr / K;
    A.vx -= j * nx / A.M; A.vy -= j * ny / A.M; A.w -= rnA * j / A.I;
    B.vx += j * nx / B.M; B.vy += j * ny / B.M; B.w += rnB * j / B.I;
    // friktion
    const tx = -ny, ty = nx;
    const vA2 = A.velAt(px, py), vB2 = B.velAt(px, py);
    const vt = (vB2.x - vA2.x) * tx + (vB2.y - vA2.y) * ty;
    const rtA = cross(rAx, rAy, tx, ty), rtB = cross(rBx, rBy, tx, ty);
    const Kt = 1 / A.M + 1 / B.M + rtA * rtA / A.I + rtB * rtB / B.I;
    const jt = clamp(-vt / Kt, -mu * j, mu * j);
    A.vx -= jt * tx / A.M; A.vy -= jt * ty / A.M; A.w -= rtA * jt / A.I;
    B.vx += jt * tx / B.M; B.vy += jt * ty / B.M; B.w += rtB * jt / B.I;
    return j;
  }
  function moveCar(c, dx, dy) { c.x += dx; c.y += dy; for (const w of c.wheels) { w.x += dx; w.y += dy; } }
  function applyAt(c, px, py, jx, jy) {   // impuls på en bil i en punkt
    c.vx += jx / c.M; c.vy += jy / c.M; c.w += cross(px - c.x, py - c.y, jx, jy) / c.I;
  }

  /* ---------- en strid ---------- */
  function Battle(fbA, fbB) {
    this.cars = [new Car(P.sanitize(fbA), 0), new Car(P.sanitize(fbB), 1)];
    this.t = 0; this.step = 0;
    this.rockets = [];
    this.frames = []; this.events = [];
    this.endT = null; this.winner = null;
    this.lastDmgT = 0;
  }
  Battle.prototype.ev = function (k, x, y, v, s) {
    this.events.push({ f: Math.floor(this.step / FPS_EVERY), k, x: +x.toFixed(2), y: +y.toFixed(2), v: v == null ? 0 : Math.round(v), s: s == null ? -1 : s });
  };
  Battle.prototype.damage = function (car, d, x, y, kind) {
    if (car.dead || d <= 0) return;
    car.hp = Math.max(0, car.hp - d);
    car.dmgAcc += d;
    this.lastDmgT = this.t;
    if (kind) this.ev(kind, x, y, d, car.side);
    if (car.hp <= 0 && !car.dead) {
      car.dead = true; car.deathT = this.t;
      this.ev('boom', car.x, car.y, 0, car.side);
      // bilen sprängs: knuff uppåt
      car.vy += 6; car.w += (Math.random() - 0.5) * 6;
      if (this.endT == null) this.endT = this.t + 1.8;
    }
  };

  Battle.prototype.physics = function () {
    const [A, B] = this.cars, h = DT / SUB;
    for (let s = 0; s < SUB; s++) {
      for (const c of this.cars) {
        const other = c === A ? B : A;
        const ca = Math.cos(c.a), sa = Math.sin(c.a);
        const ux = -sa, uy = ca, fx = ca, fy = sa;
        c.vy -= G * h;
        // fjädring
        for (const w of c.wheels) {
          w.vy -= G * h;
          const Aw = c.toW(w.ax, w.ay);
          const rAx = Aw.x - c.x, rAy = Aw.y - c.y;
          const vAx = c.vx - c.w * rAy, vAy = c.vy + c.w * rAx;
          const sAx = (w.x - Aw.x) * ux + (w.y - Aw.y) * uy;
          const relU = (w.vx - vAx) * ux + (w.vy - vAy) * uy;
          const F = -w.kS * sAx - w.cS * relU;
          w.vx += F * ux / w.m * h; w.vy += F * uy / w.m * h;
          c.vx -= F * ux / c.M * h; c.vy -= F * uy / c.M * h;
          c.w -= cross(rAx, rAy, F * ux, F * uy) / c.I * h;
        }
        // motor: kör mot motståndaren (bakåt om den är bakom)
        let thr = 0;
        if (!c.dead && this.endT == null) {
          const face = c.dir * fx;   // + om bilen pekar åt höger
          const toward = Math.sign(other.x - c.x) || 1;
          thr = Math.abs(face) > 0.3 ? Math.sign(face * toward) : 0;
          if (c.mode === 'back') thr = -thr * 0.8;   // backa och ta sats
        }
        const n = c.wheels.length;
        for (const w of c.wheels) {
          const wsp = -c.dir * w.om * w.r;   // hjulets fart framåt
          let tq = 0;
          if (thr) tq = -c.dir * thr * c.M * c.acc * w.r / n * clamp(1 - thr * wsp / c.vmax, 0, 1.2);
          w.om += tq / w.I * h;
          c.w -= tq / c.I * h * 0.08;
          w.om *= 1 - 0.4 * h;
        }
        // hjul mot golv
        for (const w of c.wheels) {
          w.contact = false;
          if (w.y < w.r + 0.002) {
            w.contact = true;
            let Jn = 0;
            if (w.vy < 0) { Jn = -w.vy * w.m; w.vy = 0; }
            const vpt = w.vx + w.om * w.r;         // kontaktpunktens fart (tangent åt höger)
            let j = -vpt / (1 / w.m + w.r * w.r / w.I);
            const lim = w.grip * 1.1 * (Jn + w.m * G * h + c.M * G * h / n);
            j = clamp(j, -lim, lim);
            w.vx += j / w.m; w.om += j * w.r / w.I;
            if (w.y < w.r) w.y = w.r;
          }
          // väggar
          if (w.x < -ARENA + w.r) { w.x = -ARENA + w.r; if (w.vx < 0) w.vx = -w.vx * 0.3; }
          if (w.x > ARENA - w.r) { w.x = ARENA - w.r; if (w.vx > 0) w.vx = -w.vx * 0.3; }
        }
        // hjulen sitter fast i sidled, ändstopp för fjädringen
        for (let it = 0; it < 2; it++) for (const w of c.wheels) {
          const Aw = c.toW(w.ax, w.ay);
          const rAx = Aw.x - c.x, rAy = Aw.y - c.y;
          for (const [ex, ey, kind] of [[fx, fy, 0], [ux, uy, 1]]) {
            const off = (w.x - Aw.x) * ex + (w.y - Aw.y) * ey;
            if (kind === 1 && off <= w.travUp && off >= -w.travDn) continue;
            const vAx = c.vx - c.w * rAy, vAy = c.vy + c.w * rAx;
            const rel = (w.vx - vAx) * ex + (w.vy - vAy) * ey;
            if (!(kind === 1 && ((off > w.travUp && rel < 0) || (off < -w.travDn && rel > 0)))) {
              const rc = cross(rAx, rAy, ex, ey);
              const K = 1 / w.m + 1 / c.M + rc * rc / c.I;
              const J = rel / K;
              w.vx -= J / w.m * ex; w.vy -= J / w.m * ey;
              c.vx += J / c.M * ex; c.vy += J / c.M * ey; c.w += rc * J / c.I;
            }
            const target = kind === 0 ? 0 : clamp(off, -w.travDn, w.travUp);
            const err = off - target;
            if (Math.abs(err) > 1e-6) { w.x -= ex * err * 0.8; w.y -= ey * err * 0.8; c.x += ex * err * 0.2 * w.m / c.M * 6; c.y += ey * err * 0.2 * w.m / c.M * 6; }
          }
        }
        // kaross och delar mot golv och väggar
        for (const b of c.shapes()) for (const [px, py] of corners(b)) {
          for (const [nx, ny, pen] of [[0, 1, -py], [1, 0, -ARENA - px], [-1, 0, px - ARENA]]) {
            if (pen <= 0) continue;
            const rx = px - c.x, ry = py - c.y;
            const v = c.velAt(px, py);
            const vn = v.x * nx + v.y * ny;
            if (vn < 0) {
              const rn = cross(rx, ry, nx, ny);
              const J = -(1.15) * vn / (1 / c.M + rn * rn / c.I);
              c.vx += J / c.M * nx; c.vy += J / c.M * ny; c.w += rn * J / c.I;
              const tx = ny, ty = -nx, vt = v.x * tx + v.y * ty, rt = cross(rx, ry, tx, ty);
              const Jt = clamp(-vt / (1 / c.M + rt * rt / c.I), -0.5 * J, 0.5 * J);
              c.vx += Jt / c.M * tx; c.vy += Jt / c.M * ty; c.w += rt * Jt / c.I;
            }
            moveCar(c, nx * pen * 0.5, ny * pen * 0.5);
          }
        }
      }
      // bil mot bil
      const sA = A.shapes(), sB = B.shapes();
      for (const a of sA) for (const b of sB) {
        const hit = sat(a, b);
        if (!hit) continue;
        const j = impulse(A, B, hit.px, hit.py, hit.nx, hit.ny, 0.15, 0.45);
        a.car._hits.push({ me: a.k, pi: a.pi, other: b.k, j, x: hit.px, y: hit.py });
        b.car._hits.push({ me: b.k, pi: b.pi, other: a.k, j, x: hit.px, y: hit.py });
        const corr = Math.max(0, hit.d - 0.005) * 0.5, tot = A.M + B.M;
        moveCar(A, -hit.nx * corr * B.M / tot, -hit.ny * corr * B.M / tot);
        moveCar(B, hit.nx * corr * A.M / tot, hit.ny * corr * A.M / tot);
      }
      // hjul mot den andra bilen
      for (const [c, o, so] of [[A, B, sB], [B, A, sA]]) {
        for (const w of c.wheels) for (const b of so) {
          const [qx, qy, ins] = closestOn(b, w.x, w.y);
          let dx = w.x - qx, dy = w.y - qy, d = hyp(dx, dy);
          if (!ins && d >= w.r) continue;
          if (ins || d < 1e-6) { dx = w.x - b.x; dy = w.y - b.y; d = hyp(dx, dy) || 1; }
          const nx = dx / d, ny = dy / d;   // från b mot hjulet
          const v = o.velAt(qx, qy);
          const vr = (w.vx - v.x) * nx + (w.vy - v.y) * ny;
          if (vr < 0) {
            const rn = cross(qx - o.x, qy - o.y, nx, ny);
            const j = -1.1 * vr / (1 / w.m + 1 / o.M + rn * rn / o.I);
            w.vx += j * nx / w.m; w.vy += j * ny / w.m;
            applyAt(o, qx, qy, -j * nx, -j * ny);
          }
          const pen = ins ? w.r : w.r - d;
          w.x += nx * pen * 0.7; w.y += ny * pen * 0.7;
        }
      }
      // integrera
      for (const c of this.cars) {
        c.vx *= 1 - 0.05 * h; c.vy *= 1 - 0.02 * h; c.w *= 1 - 0.8 * h;
        c.w = clamp(c.w, -12, 12);
        c.x += c.vx * h; c.y += c.vy * h; c.a += c.w * h;
        for (const w of c.wheels) { w.x += w.vx * h; w.y += w.vy * h; w.th += w.om * h; }
      }
    }
  };

  /* riktning mot motståndarens mitt, högst ±0,45 rad från bilens framriktning */
  function aim(c, O, E) {
    const fw = c.vecW(1, 0);
    let dx = E.x - O.x, dy = E.y - O.y; const L = hyp(dx, dy) || 1; dx /= L; dy /= L;
    const da = Math.atan2(cross(fw.x, fw.y, dx, dy), fw.x * dx + fw.y * dy);
    const a = Math.atan2(fw.y, fw.x) + clamp(da, -0.45, 0.45);
    return { x: Math.cos(a), y: Math.sin(a), ok: Math.abs(da) < 1.2 };
  }

  /* ---------- vapnen ---------- */
  Battle.prototype.weapons = function () {
    const dt = DT;
    const order = this.step % 2 ? [this.cars[1], this.cars[0]] : this.cars;   // turas om så ingen sida får försprång
    for (const c of order) {
      const E = c === this.cars[0] ? this.cars[1] : this.cars[0];
      if (c.dead || this.endT != null) continue;
      const eBody = E.obb({ cx: 0, cy: 0, hx: E.g.L / 2, hy: E.g.H / 2, k: 'body' });
      const eShapes = E.shapes();
      const fw = c.vecW(1, 0);   // framåt i världen
      c.g.parts.forEach((p, i) => {
        const st = c.st[i];
        st.cd = Math.max(0, st.cd - dt); st.t += dt;
        const W = P.WEAPONS[p.id], dmg = W.dmg * p.m;
        if (p.id === 'sag') {
          const S = c.toW(p.cx, p.cy);
          const onBody = distTo(eBody, S.x, S.y) < p.r;
          const blocked = eShapes.some(b => b.k !== 'body' && distTo(b, S.x, S.y) < p.r);
          if (onBody) {
            const [qx, qy] = closestOn(eBody, S.x, S.y);
            this.damage(E, dmg * dt * (blocked ? 0.3 : 1), qx, qy, null);
            if ((st.dmgT -= dt) <= 0) { st.dmgT = 0.12; this.ev(blocked ? 'clank' : 'spark', qx, qy, 0, E.side); }
          } else if (blocked) {
            this.damage(E, dmg * dt * 0.25, E.x, E.y, null);   // skakar ändå lite
            if ((st.dmgT -= dt) <= 0) { st.dmgT = 0.2; this.ev('clank', S.x + fw.x * p.r * p.sx, S.y, 0, -1); }
          }
        } else if (p.id === 'lans') {
          const T = c.toW(p.tx, p.ty);
          const imp = c._hitsStep.filter(hh => hh.pi === i && hh.other === 'body').reduce((a, hh) => a + hh.j, 0);
          const impO = c._hitsStep.filter(hh => hh.pi === i && hh.other !== 'body').reduce((a, hh) => a + hh.j, 0);
          if (st.cd <= 0 && (imp > 40 || distTo(eBody, T.x, T.y) < 0.07)) {
            const k = clamp(0.55 + imp / 900, 0.55, 2.3);
            this.damage(E, dmg * k, T.x, T.y, 'hit');
            st.cd = 0.7;
          } else if (st.cd <= 0 && impO > 150) {   // stöt mot sköld/lans: lite skada ändå
            this.damage(E, dmg * clamp(impO / 2500, 0.15, 0.6), T.x, T.y, 'hit');
            this.ev('clank', T.x, T.y, 0, -1);
            st.cd = 0.7;
          }
        } else if (p.id === 'hammare') {
          const piv = c.toW(p.px, p.py);
          const head = () => c.toW(p.px + Math.cos(st.ang) * p.len, p.py + Math.sin(st.ang) * p.len);
          if (st.phase === 'rest') {
            const rel = (E.x - piv.x) * fw.x + (E.y - piv.y) * fw.y;
            if (st.cd <= 0 && rel > 0.2 && hyp(E.x - piv.x, E.y - piv.y) < p.len + E.g.L * 0.45) { st.phase = 'down'; st.cd = 1.7; this.ev('swoosh', piv.x, piv.y, 0, -1); }
          } else if (st.phase === 'down') {
            st.ang -= 11 * dt;
            const Hd = head();
            if (distTo(eBody, Hd.x, Hd.y) < p.hr) {
              this.damage(E, dmg, Hd.x, Hd.y, 'hit');
              applyAt(E, Hd.x, Hd.y, 0, -260 * p.m);
              this.ev('bonk', Hd.x, Hd.y, 0, -1);
              st.phase = 'up';
            } else if (eShapes.some(b => b.k !== 'body' && distTo(b, Hd.x, Hd.y) < p.hr) || Hd.y < p.hr) {
              this.ev('clank', Hd.x, Hd.y, 0, -1); st.phase = 'up';
            } else if (st.ang <= p.hit) st.phase = 'up';
          } else if (st.phase === 'up') {
            st.ang += 3.2 * dt;
            if (st.ang >= p.rest) { st.ang = p.rest; st.phase = 'rest'; }
          }
        } else if (p.id === 'raket') {
          const O = c.toW(p.ox + 0.35, p.oy + 0.03);
          const rel = (E.x - O.x) * fw.x + (E.y - O.y) * fw.y;
          if (st.cd <= 0 && rel > 0.8 && rel < 16) {
            const d = aim(c, O, E); d.y += 0.04;
            this.rockets.push({ x: O.x, y: O.y, vx: d.x * 13 + c.vx * 0.3, vy: d.y * 13 + c.vy * 0.3, side: c.side, dmg, t: 0 });
            st.cd = 2.3; st.on = 0.2;
            this.ev('launch', O.x, O.y, 0, -1);
          }
          st.on = Math.max(0, st.on - dt);
        } else if (p.id === 'laser') {
          const cyc = (st.t + 0.6) % 2.3;
          st.on = cyc < 1.3 ? 1 : 0;
          if (st.on) {
            const O = c.toW(p.ox + 0.3, p.oy);
            const d = aim(c, O, E);
            let best = 8, hitBody = false;
            for (const b of eShapes) { const tt = rayOBB(O.x, O.y, d.x, d.y, b); if (tt != null && tt < best) { best = tt; hitBody = b.k === 'body'; } }
            if (d.y < -0.01) { const tg = -O.y / d.y; if (tg > 0 && tg < best) { best = tg; hitBody = false; } }
            st.bx = O.x + d.x * best; st.by = O.y + d.y * best;
            if (hitBody) { this.damage(E, dmg * dt, st.bx, st.by, null); if ((st.dmgT -= dt) <= 0) { st.dmgT = 0.15; this.ev('burn', st.bx, st.by, 0, E.side); } }
          }
        } else if (p.id === 'boost') {
          const cyc = (st.t + 1.2) % 2.8;
          st.on = cyc < 0.65 ? 1 : 0;
          if (st.on) { const a = 11 * Math.sqrt(p.m); c.vx += fw.x * a * dt; c.vy += fw.y * a * dt; }
        } else if (p.id === 'lyft') {
          const tipL = { x: p.px + Math.cos(st.ang) * p.len, y: p.py + Math.sin(st.ang) * p.len };
          const T = c.toW(tipL.x, tipL.y);
          if (st.phase === 'rest') {
            const near = distTo(eBody, T.x, T.y) < 0.45 || E.wheels.some(w => hyp(w.x - T.x, w.y - T.y) < w.r + 0.35);
            if (st.cd <= 0 && near) {
              st.phase = 'up'; st.cd = 2.3;
              const J = 1750 * p.m;
              applyAt(E, T.x, T.y, fw.x * J * 0.25, J);
              this.damage(E, dmg, T.x, T.y, 'hit');
              this.ev('flip', T.x, T.y, 0, -1);
            }
          } else if (st.phase === 'up') { st.ang = Math.min(0.95, st.ang + 9 * dt); if (st.ang >= 0.95) st.phase = 'down'; }
          else { st.ang = Math.max(0, st.ang - 2.5 * dt); if (st.ang <= 0) st.phase = 'rest'; }
        }
      });
    }
    // raketer
    for (const r of this.rockets) {
      if (r.done) continue;
      r.t += dt; r.vy -= 3 * dt; r.x += r.vx * dt; r.y += r.vy * dt;
      const E = this.cars[1 - r.side];
      const hitShape = E.shapes().some(b => inside(b, r.x, r.y, 0.05)) || E.wheels.some(w => hyp(w.x - r.x, w.y - r.y) < w.r);
      if (hitShape || r.y < 0.05 || Math.abs(r.x) > ARENA || r.t > 3) {
        r.done = true;
        this.ev('boom', r.x, r.y, 0, -2);
        const eBody = E.obb({ cx: 0, cy: 0, hx: E.g.L / 2, hy: E.g.H / 2, k: 'body' });
        const d = distTo(eBody, r.x, r.y);
        if (d < 2.2 && this.endT == null) {
          const k = clamp(1 - d / 2.6, 0.15, 1);
          this.damage(E, r.dmg * k, r.x, r.y + 0.2, 'hit');
          let dx = E.x - r.x, dy = E.y - r.y + 0.4; const L = hyp(dx, dy) || 1;
          applyAt(E, r.x * 0.3 + E.x * 0.7, r.y * 0.3 + E.y * 0.7, dx / L * 900 * k, dy / L * 900 * k);
        }
      }
    }
    this.rockets = this.rockets.filter(r => !r.done);
  };

  /* fastnat i en knuffmatch: backa en bit och ta sats igen */
  Battle.prototype.tactics = function () {
    const [A, B] = this.cars;
    for (const c of this.cars) {
      if (c._hitsStep && c._hitsStep.length) c.touchT = this.t;
      const close = this.t - (c.touchT || -9) < 0.3 || hyp(A.x - B.x, A.y - B.y) < (A.g.L + B.g.L) / 2 + 2.2;
      if (c.mode === 'back') { if ((c.modeT -= DT) <= 0) { c.mode = 'charge'; c.stuckT = 0; } continue; }
      if (close && hyp(c.vx, c.vy) < 0.8 && this.t - this.lastDmgT > 1.5) c.stuckT = (c.stuckT || 0) + DT; else c.stuckT = 0;
      if (c.stuckT > 1.1) { c.mode = 'back'; c.modeT = 0.55 + Math.random() * 0.4; c.stuckT = 0; }
    }
  };

  Battle.prototype.selfRight = function () {
    for (const c of this.cars) {
      if (c.dead) continue;
      const up = Math.cos(c.a), slow = hyp(c.vx, c.vy) < 1.2 && Math.abs(c.w) < 2;
      const low = c.y < c.g.H + 0.9;
      if (up < 0.35 && slow && low) c.upT = (c.upT || 0) + DT; else c.upT = 0;
      if (c.upT > 1.3) {
        c.upT = 0;
        c.vy += 6.5;
        let da = -c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        c.w = clamp(da * 3.2, -9, 9);
        for (const w of c.wheels) w.vy += 6.5;
        this.ev('hop', c.x, c.y, 0, c.side);
      }
    }
  };

  Battle.prototype.record = function () {
    const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
    const cf = c => {
      const a = [r2(c.x), r2(c.y), r3(c.a), Math.round(c.hp)];
      for (const w of c.wheels) a.push(r2(w.x), r2(w.y), r2(w.th));
      c.g.parts.forEach((p, i) => {
        const st = c.st[i];
        if (p.id === 'hammare' || p.id === 'lyft') a.push(r3(st.ang));
        else if (p.id === 'boost' || p.id === 'raket') a.push(st.on ? 1 : 0);
        else if (p.id === 'laser') a.push(st.on ? 1 : 0, r2(st.bx), r2(st.by));
      });
      return a;
    };
    this.frames.push([cf(this.cars[0]), cf(this.cars[1]), this.rockets.map(r => [r2(r.x), r2(r.y), r3(Math.atan2(r.vy, r.vx))])]);
  };

  Battle.prototype.run = function () {
    this.record();
    while (true) {
      for (const c of this.cars) c._hits = [];
      this.physics();
      for (const c of this.cars) c._hitsStep = c._hits;
      this.t += DT; this.step++;
      // krockljud
      for (const hh of this.cars[0]._hitsStep) if (hh.j > 600 && Math.random() < 0.3) this.ev('crash', hh.x, hh.y, hh.j, -1);
      this.weapons();
      this.selfRight();
      this.tactics();
      if (this.step % FPS_EVERY === 0) this.record();
      for (const c of this.cars) {
        if (!isFinite(c.x + c.y + c.a)) { c.x = 0; c.y = 2; c.a = 0; c.vx = c.vy = c.w = 0; }
      }
      if (this.endT != null && this.t >= this.endT) break;
      if (this.t >= TMAX) break;
    }
    const [A, B] = this.cars;
    const fa = A.hp / A.hpMax, fb = B.hp / B.hpMax;
    if (A.dead && B.dead) this.winner = Math.abs(A.deathT - B.deathT) < 1e-6 ? -1 : A.deathT > B.deathT ? 0 : 1;
    else this.winner = A.dead ? 1 : B.dead ? 0 : Math.abs(fa - fb) < 1e-6 ? -1 : fa > fb ? 0 : 1;
    this.timeout = !A.dead && !B.dead;
    return {
      winner: this.winner, timeout: this.timeout, frames: this.frames, events: this.events, fps: 60 / FPS_EVERY,
      hp: [Math.round(A.hp), Math.round(B.hp)], hpMax: [A.hpMax, B.hpMax], builds: [A.g.fb, B.g.fb]
    };
  };

  function fight(fbA, fbB) { return new Battle(fbA, fbB).run(); }
  return { fight, geom, ARENA, TMAX };
})();
if (typeof module !== 'undefined') module.exports = KSIM;
