/* Bucinca Fotboll – matchens fysik och datorspelare.
   Körs bara hos värden (eller lokalt mot datorn). Andra spelare skickar in sina spakar och får tillbaka lägen.
   Enheter: "pixlar" i planens koordinater, 60 steg per sekund. Rött lag (0) försvarar vänster mål och anfaller åt höger. */
'use strict';
const SIM = (() => {
  const F = {
    FX: 550, FY: 260,          // halva planens längd/bredd (mittpunkt i 0,0)
    GY: 88, GD: 52,            // halva målbredden, måldjup
    PR: 20, BR: 12, POST: 7,   // radier: spelare, boll, stolpe
    OX: 610, OY: 305,          // hur långt utanför linjerna spelarna får springa
    CR: 85,                    // mittcirkel
    ACC: 0.15, ACC_K: 0.10, DAMP: 0.96, BDAMP: 0.99,
    KICK: 6.6, REACH: 5,
    E_PB: 0.3, E_PP: 0.25, E_BW: 0.55, E_POST: 0.5
  };
  const LV = [
    { acc: 0.76, react: 14, aim: 1.0, shoot: 360, miss: 0.3 },
    { acc: 0.88, react: 7, aim: 0.55, shoot: 470, miss: 0.12 },
    { acc: 0.99, react: 3, aim: 0.22, shoot: 600, miss: 0.03 }
  ];
  const FORM = {
    1: [[-0.45, 0]],
    2: [[-0.3, 0], [-0.78, 0]],
    3: [[-0.28, -0.32], [-0.28, 0.32], [-0.82, 0]],
    4: [[-0.22, 0], [-0.52, -0.45], [-0.52, 0.45], [-0.86, 0]],
    5: [[-0.2, -0.25], [-0.2, 0.25], [-0.55, -0.5], [-0.55, 0.5], [-0.86, 0]]
  };
  const hyp = Math.hypot;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  class Match {
    /* players: [{id, name, ch, team, bot}]  bot = -1 människa, annars nivå 0–2
       opts: {minutes, rnd} */
    constructor(players, opts = {}) {
      this.F = F;
      this.rnd = opts.rnd || Math.random;
      this.minutes = opts.minutes || 3;
      this.timeLeft = this.minutes * 60;
      this.golden = false;
      this.score = [0, 0];
      this.tick = 0;
      this.phase = 'kickoff';      // kickoff | play | goal | end
      this.phaseT = 0;
      this.kickTeam = 0;
      this.ball = { x: 0, y: 0, vx: 0, vy: 0, inv: 1, r: F.BR, spin: 0 };
      this.players = [];
      this.events = [];
      this.lastTouch = -1; this.prevTouch = -1;
      this.goals = [];             // {team, by, own, t}
      this.onGoal = null; this.onEnd = null;
      for (const p of players) this.add(p, true);
      this.kickoff(this.rnd() < 0.5 ? 0 : 1);
    }

    add(p, initial) {
      const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, inv: 0.5, r: F.PR, ix: 0, iy: 0, kickT: 0, passT: 0,
        kSeq: 0, pSeq: 0, goals: 0, own: 0, ai: { t: 0, tx: 0, ty: 0, yo: 0 } }, p);
      if (q.bot == null) q.bot = -1;
      this.players.push(q);
      if (!initial) {   // ny spelare mitt i matchen: ställ upp vid egen kant
        const s = q.team === 0 ? -1 : 1;
        q.x = s * F.FX * 0.6; q.y = (this.rnd() - 0.5) * F.FY;
      }
      return q;
    }
    byId(id) { return this.players.find(p => p.id === id); }

    kickoff(team) {
      this.kickTeam = team;
      this.phase = 'kickoff'; this.phaseT = 0;
      const b = this.ball; b.x = 0; b.y = 0; b.vx = 0; b.vy = 0;
      for (const t of [0, 1]) {
        const mates = this.players.filter(p => p.team === t);
        const n = mates.length;
        const form = FORM[Math.min(n, 5)] || FORM[5];
        mates.forEach((p, i) => {
          const f = form[i] || [-0.3 - 0.12 * (i % 4), ((i * 37) % 9 - 4) / 6];
          let x = f[0] * F.FX, y = f[1] * F.FY;
          if (i === 0 && t === team) { x = -(F.PR + F.BR + 14); y = 0; }
          else if (i === 0) x = Math.min(x, -(F.CR + F.PR + 6));
          p.x = t === 0 ? x : -x; p.y = y; p.vx = p.vy = 0; p.kickT = p.passT = 0;
        });
      }
      this.lastTouch = this.prevTouch = -1;
    }

    /* spak: x,y i världens riktning (längd ≤ 1). kick/pass: räknare som ökar vid varje tryck */
    input(id, x, y, k, pa) {
      const p = this.byId(id); if (!p) return;
      const l = hyp(x, y); if (l > 1) { x /= l; y /= l; }
      p.ix = x || 0; p.iy = y || 0;
      if (k != null && k !== p.kSeq) { if (k > p.kSeq) p.kickT = 20; p.kSeq = k; }
      if (pa != null && pa !== p.pSeq) { if (pa > p.pSeq) p.passT = 20; p.pSeq = pa; }
    }

    step() {
      this.tick++;
      if (this.phase === 'end') return;
      const dt = 1 / 60;
      if (this.phase === 'goal') {
        if (++this.phaseT >= 150) {
          if (this.golden || (this.timeLeft <= 0 && this.score[0] !== this.score[1])) return this.finish();
          this.kickoff(this.lastGoalTeam === 0 ? 1 : 0);
        }
      } else if (!this.golden) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          if (this.score[0] !== this.score[1]) return this.finish();
          this.golden = true; this.ev('golden');
        }
      }
      if (this.phase === 'kickoff' && ++this.phaseT > 60 * 12) this.phase = 'play';   // ingen avspark på länge – släpp loss

      for (const p of this.players) if (p.bot >= 0) this.think(p);

      const b = this.ball;
      for (const p of this.players) {
        const a = (p.kickT > 0 || p.passT > 0 ? F.ACC_K : F.ACC);
        p.vx += p.ix * a; p.vy += p.iy * a;
      }
      for (const d of [b, ...this.players]) { d.x += d.vx; d.y += d.vy; }
      for (const p of this.players) { p.vx *= F.DAMP; p.vy *= F.DAMP; }
      b.vx *= F.BDAMP; b.vy *= F.BDAMP;
      b.spin += hyp(b.vx, b.vy) / F.BR;

      for (let it = 0; it < 2; it++) {
        const P = this.players;
        for (let i = 0; i < P.length; i++) {
          for (let j = i + 1; j < P.length; j++) this.collide(P[i], P[j], F.E_PP);
          if (this.collide(P[i], b, F.E_PB)) this.touch(i);
        }
        for (const p of P) this.playerBounds(p);
        this.ballBounds();
      }

      // sparkar och passningar
      this.players.forEach((p, i) => {
        if (p.kickT > 0 || p.passT > 0) {
          const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy);
          if (d - F.PR - F.BR < F.REACH) {
            if (p.passT > 0) this.doPass(p, i, dx / d, dy / d);
            else this.doKick(p, i, dx / d, dy / d);
            p.kickT = p.passT = 0;
          } else { if (p.kickT > 0) p.kickT--; if (p.passT > 0) p.passT--; }
        }
      });

      // mål?
      if (this.phase !== 'goal' && Math.abs(b.y) < F.GY && Math.abs(b.x) > F.FX + F.BR * 0.6) {
        const team = b.x > 0 ? 0 : 1;   // bollen i högra målet = rött mål
        this.score[team]++;
        this.lastGoalTeam = team;
        let by = this.lastTouch >= 0 ? this.players[this.lastTouch] : null;
        let own = !!by && by.team !== team;
        // styrd in av en försvarare strax efter ett skott: målet räknas till skytten
        if (own && this.prevTouch >= 0 && this.players[this.prevTouch].team === team && this.tick - this.prevTouchK < 100) {
          by = this.players[this.prevTouch]; own = false; this.prevTouch = -1;
        }
        let assist = null;
        if (by && !own && this.prevTouch >= 0) { const a = this.players[this.prevTouch]; if (a && a.team === team && a !== by) assist = a; }
        if (by) { if (own) by.own++; else by.goals++; }
        if (assist) assist.assists = (assist.assists || 0) + 1;
        const g = { team, by: by ? by.id : null, own, assist: assist ? assist.id : null, t: this.minutes * 60 - this.timeLeft };
        this.goals.push(g);
        this.phase = 'goal'; this.phaseT = 0;
        this.ev('goal');
        this.onGoal && this.onGoal(g);
      }
    }

    touch(i) {
      if (this.phase === 'kickoff') this.phase = 'play';
      if (this.lastTouch !== i) { this.prevTouch = this.lastTouch; this.prevTouchK = this.lastTouchK; this.lastTouch = i; }
      this.lastTouchK = this.tick;
    }

    doKick(p, i, nx, ny) {
      let dx = nx, dy = ny;
      const il = hyp(p.ix, p.iy);
      if (il > 0.2) {   // spaken styr skottet lite (lättare på mobilen)
        const mx = nx + p.ix / il * 0.55, my = ny + p.iy / il * 0.55, ml = hyp(mx, my);
        if ((mx * nx + my * ny) / ml > 0.35) { dx = mx / ml; dy = my / ml; }
      }
      const b = this.ball;
      b.vx += dx * F.KICK; b.vy += dy * F.KICK;
      this.touch(i);
      this.ev('k');
    }

    doPass(p, i, nx, ny) {
      const il = hyp(p.ix, p.iy);
      const ax = il > 0.2 ? p.ix / il : nx, ay = il > 0.2 ? p.iy / il : ny;
      let best = null, bs = 1e9;
      for (const q of this.players) {
        if (q === p || q.team !== p.team) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy);
        if (d < 40) continue;
        const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
        if (ang > 1.35) continue;
        const s = ang * 1.2 + d / 900;
        if (s < bs) { bs = s; best = q; }
      }
      const b = this.ball;
      if (best) {
        const tx = best.x + best.vx * 18, ty = best.y + best.vy * 18;
        const dx = tx - b.x, dy = ty - b.y, D = hyp(dx, dy);
        const sp = clamp(D / 100 + 1.4, 2.4, 6.4);
        b.vx = dx / D * sp; b.vy = dy / D * sp;
      } else { b.vx += nx * 3.6; b.vy += ny * 3.6; }
      this.touch(i);
      this.ev('p');
    }

    collide(a, b, e) {
      const dx = b.x - a.x, dy = b.y - a.y, d = hyp(dx, dy), R = a.r + b.r;
      if (d >= R || d === 0) return false;
      const nx = dx / d, ny = dy / d, ov = R - d, tot = a.inv + b.inv;
      a.x -= nx * ov * a.inv / tot; a.y -= ny * ov * a.inv / tot;
      b.x += nx * ov * b.inv / tot; b.y += ny * ov * b.inv / tot;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const j = -(1 + e) * rel / tot;
        a.vx -= nx * j * a.inv; a.vy -= ny * j * a.inv;
        b.vx += nx * j * b.inv; b.vy += ny * j * b.inv;
      }
      return true;
    }

    postHit(d, e) {
      let hit = false;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        const px = sx * F.FX, py = sy * F.GY;
        const dx = d.x - px, dy = d.y - py, l = hyp(dx, dy), R = d.r + F.POST;
        if (l < R && l > 0) {
          const nx = dx / l, ny = dy / l;
          d.x = px + nx * R; d.y = py + ny * R;
          const vn = d.vx * nx + d.vy * ny;
          if (vn < 0) { d.vx -= (1 + e) * vn * nx; d.vy -= (1 + e) * vn * ny; hit = true; }
        }
      }
      return hit;
    }

    playerBounds(p) {
      p.x = clamp(p.x, -F.OX, F.OX); p.y = clamp(p.y, -F.OY, F.OY);
      // inte in i målen
      for (const s of [-1, 1]) {
        const x0 = F.FX, x1 = F.FX + F.GD + 14;
        const ax = s * p.x;
        if (ax > x0 - p.r && ax < x1 + p.r && Math.abs(p.y) < F.GY + p.r) {
          const cx = clamp(ax, x0, x1), cy = clamp(p.y, -F.GY, F.GY);
          let dx = ax - cx, dy = p.y - cy, d = hyp(dx, dy);
          if (d === 0) {   // mitt i målet: ut mot planen
            p.x = s * (x0 - p.r); if (s * p.vx > 0) p.vx = 0;
          } else if (d < p.r) {
            dx /= d; dy /= d;
            const nx = cx + dx * p.r, ny = cy + dy * p.r;
            p.x = s * nx; p.y = ny;
            const vn = s * p.vx * dx + p.vy * dy;
            if (vn < 0) { p.vx -= s * vn * dx; p.vy -= vn * dy; }
          }
        }
      }
      this.postHit(p, 0.3);
      if (this.phase === 'kickoff') {   // avspark: alla på egen planhalva, motståndarna utanför mittcirkeln
        const s = p.team === 0 ? -1 : 1;
        if (s * p.x < p.r * 0.5) { p.x = s * p.r * 0.5; if (s * p.vx < 0) p.vx = 0; }
        if (p.team !== this.kickTeam) {
          const d = hyp(p.x, p.y), R = F.CR + p.r;
          if (d < R) { const k = R / (d || 1); p.x = d ? p.x * k : s * R; p.y *= d ? k : 0; }
        }
      }
    }

    ballBounds() {
      const b = this.ball, e = F.E_BW;
      let hit = false;
      if (b.y < -F.FY + b.r) { b.y = -F.FY + b.r; if (b.vy < 0) { b.vy = -b.vy * e; hit = true; } }
      if (b.y > F.FY - b.r) { b.y = F.FY - b.r; if (b.vy > 0) { b.vy = -b.vy * e; hit = true; } }
      if (Math.abs(b.y) > F.GY) {
        if (b.x < -F.FX + b.r) { b.x = -F.FX + b.r; if (b.vx < 0) { b.vx = -b.vx * e; hit = true; } }
        if (b.x > F.FX - b.r) { b.x = F.FX - b.r; if (b.vx > 0) { b.vx = -b.vx * e; hit = true; } }
      }
      if (Math.abs(b.x) > F.FX) {   // i målet: nät på sidorna och bak
        const s = Math.sign(b.x);
        if (Math.abs(b.y) > F.GY - b.r) { b.y = Math.sign(b.y) * (F.GY - b.r); b.vy *= -0.2; }
        if (s * b.x > F.FX + F.GD - b.r) { b.x = s * (F.FX + F.GD - b.r); b.vx *= -0.15; b.vy *= 0.6; }
      }
      if (this.postHit(b, F.E_POST)) { this.ev('post'); hit = false; }
      if (hit && hyp(b.vx, b.vy) > 1.5) this.ev('w');
    }

    ev(e) { if (this.events.length < 20) this.events.push(e); }

    finish() {
      this.phase = 'end';
      this.ev('end');
      this.onEnd && this.onEnd(this.result());
    }

    result() {
      const w = this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1;
      const stats = this.players.map(p => ({ id: p.id, name: p.name, ch: p.ch, team: p.team, bot: p.bot, goals: p.goals, own: p.own, assists: p.assists || 0 }));
      let mvp = null;
      for (const s of stats) {
        if (w >= 0 && s.team !== w) continue;
        const v = s.goals * 3 + s.assists * 2 - s.own * 2 + (s.bot < 0 ? 0.5 : 0);
        if (!mvp || v > mvp.v) mvp = Object.assign({ v }, s);
      }
      return { score: this.score.slice(), winner: w, stats, mvp, goals: this.goals.slice(), golden: this.golden };
    }

    /* läget som skickas till de andra (≈30 ggr/s) */
    snap() {
      const r = v => Math.round(v * 10) / 10;
      const b = this.ball;
      return {
        t: 's', k: this.tick, ph: this.phase[0], tl: Math.ceil(this.timeLeft * 10), g: this.golden ? 1 : 0,
        sc: this.score, b: [r(b.x), r(b.y), Math.round(b.spin * 10) / 10],
        p: this.players.map(p => [r(p.x), r(p.y), p.kickT > 0 || p.passT > 0 ? 1 : 0]),
        ev: this.events.splice(0)
      };
    }

    /* ---------------- datorspelare ---------------- */
    think(p) {
      const L = LV[p.bot] || LV[1], ai = p.ai;
      const b = this.ball, s = p.team === 0 ? 1 : -1;   // s = anfallsriktning i x
      const ogx = s * F.FX, mgx = -s * F.FX;            // motståndarnas mål, eget mål
      if (this.phase === 'goal' || this.phase === 'end') { p.ix = p.iy = 0; return; }
      if (--ai.t <= 0) {
        ai.t = L.react + Math.floor(this.rnd() * 3);
        // roller: närmast bollen jagar, längst bak håller målet
        const mates = this.players.filter(q => q.team === p.team);
        const cost = q => hyp(q.x - b.x, q.y - b.y) + (s * (q.x - b.x) > 0 ? 60 : 0);
        let chaser = mates[0];
        for (const q of mates) if (cost(q) < cost(chaser)) chaser = q;
        let keeper = null;
        if (mates.length >= 3) for (const q of mates) if (q !== chaser && q.bot >= 0 && (!keeper || s * q.x < s * keeper.x)) keeper = q;
        ai.role = p === chaser ? 'chase' : p === keeper ? 'keep' : 'support';
        if (ai.role === 'keep' && hyp(b.x - mgx, b.y) < 200) ai.role = 'chase';
        // en människa nära bollen i laget: gå inte i vägen
        if (ai.role === 'chase' && chaser !== p) ai.role = 'support';
        if (this.phase === 'kickoff' && this.kickTeam !== p.team) ai.role = ai.role === 'chase' ? 'wait' : ai.role;
        if (this.rnd() < 0.3) ai.yo = (this.rnd() - 0.5) * 2 * F.GY * 0.55;
        const lane = mates.filter(q => q !== chaser).indexOf(p);
        ai.lane = lane;
        ai.bx = b.x + b.vx * L.react * 0.6; ai.by = b.y + b.vy * L.react * 0.6;
      }
      let tx, ty, kick = false;
      const R = F.PR + F.BR;
      if (ai.role === 'chase') {
        const lead = Math.min(22, hyp(p.x - b.x, p.y - b.y) / 5);
        const bx = b.x + b.vx * lead, by = b.y + b.vy * lead;
        let ax = ogx - bx, ay = ai.yo - by;
        // nära eget mål: rensa ut åt sidan i stället
        if (s * bx < -F.FX + 140 && Math.abs(by) < F.GY * 1.6) { ax = s * 1; ay = by >= 0 ? 0.9 : -0.9; }
        const al = hyp(ax, ay); ax /= al; ay /= al;
        const rx = p.x - bx, ry = p.y - by;
        const along = rx * ax + ry * ay, lat = -rx * ay + ry * ax;
        if (along < -R * 0.5 && Math.abs(lat) < R * 0.55) {
          tx = bx + ax * 30; ty = by + ay * 30;
          const gap = hyp(b.x - p.x, b.y - p.y) - R;
          const toGoal = hyp(ogx - b.x, b.y);
          const press = this.players.some(q => q.team !== p.team && hyp(q.x - b.x, q.y - b.y) < 70);
          if (gap < F.REACH + 1 && (toGoal < L.shoot || press || s * b.x < 0) && this.rnd() > L.miss) kick = true;
        } else if (along < -R * 0.5) {
          tx = bx - ax * (R + 2); ty = by - ay * (R + 2);
        } else {
          // på fel sida om bollen: gå runt den (först åt sidan, sedan bakom) så den inte trycks mot eget mål
          const side = lat >= 0 ? 1 : -1;
          if (Math.abs(lat) < R + 16) {
            const fw = Math.max(along, 0) * 0.6;
            tx = bx + ax * fw - ay * side * (R + 34);
            ty = by + ay * fw + ax * side * (R + 34);
          } else {
            tx = bx - ax * (R + 22) - ay * side * (R + 14);
            ty = by - ay * (R + 22) + ax * side * (R + 14);
          }
        }
      } else if (ai.role === 'keep') {
        tx = mgx + s * (F.PR + 34);
        ty = clamp(b.y * 0.55, -F.GY * 0.75, F.GY * 0.75);
      } else if (ai.role === 'wait') {
        tx = -s * (F.CR + F.PR + 10); ty = clamp(b.y, -40, 40);
      } else {
        const lanes = [-0.5, 0.5, 0, -0.8, 0.8];
        const ly = (lanes[ai.lane] != null ? lanes[ai.lane] : 0) * F.FY;
        const attack = s * ai.bx > -F.FX * 0.2;
        if (attack) { tx = ai.bx - s * 150; ty = ly; }
        else { tx = mgx + (ai.bx - mgx) * 0.45; ty = ai.by * 0.4 + ly * 0.5; }
        tx = clamp(tx, -F.FX + 40, F.FX - 40); ty = clamp(ty, -F.FY + 30, F.FY - 30);
        // håll avstånd till bollen så man inte står i vägen
        const db = hyp(tx - b.x, ty - b.y);
        if (db < 90) { tx += (tx - b.x) / (db || 1) * (90 - db); ty += (ty - b.y) / (db || 1) * (90 - db); }
      }
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      const sp = L.acc * Math.min(1, d / 30);
      if (d > 3) {
        // lite slarv i riktningen beroende på nivå
        const n = (this.rnd() - 0.5) * L.aim * 0.25;
        const c = Math.cos(n), sn = Math.sin(n);
        const ux = dx / d, uy = dy / d;
        p.ix = (ux * c - uy * sn) * sp; p.iy = (ux * sn + uy * c) * sp;
      } else { p.ix = p.iy = 0; }
      if (kick && p.kickT <= 0) p.kickT = 3;
    }
  }
  return { Match, F, LV };
})();
if (typeof module !== 'undefined') module.exports = SIM;
