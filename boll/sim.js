/* Bucinca Fotboll – matchens fysik och datorspelare.
   Körs bara hos värden (eller lokalt mot datorn). Andra spelare skickar in sina spakar och får tillbaka lägen.
   Enheter: "pixlar" i planens koordinater, 60 steg per sekund. Rött lag (0) försvarar vänster mål och anfaller åt höger.
   Bollinnehav: den som får bollen under kontroll dribblar den framför sig tills den skjuter, passar eller blir av med den.
   Spelaregenskaper (st): spd fart, drb dribbling, sho skott, pas passning, tck brytning – 0..23 poäng var. */
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
  const STATS = ['spd', 'drb', 'sho', 'pas', 'tck'];
  const STMAX = 23;
  const LV = [
    { acc: 0.76, react: 14, aim: 1.0, shoot: 330, miss: 0.35, st: 2, passP: 0.25 },
    { acc: 0.88, react: 7, aim: 0.55, shoot: 420, miss: 0.15, st: 7, passP: 0.4 },
    { acc: 0.99, react: 3, aim: 0.22, shoot: 520, miss: 0.04, st: 13, passP: 0.55 }
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
  const newCount = () => ({ shots: 0, passes: 0, passOk: 0, tackles: 0, dribbles: 0, dist: 0, poss: 0 });

  class Match {
    /* players: [{id, name, ch, team, bot, st}]  bot = -1 människa, annars nivå 0–2
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
      this.ball = { x: 0, y: 0, vx: 0, vy: 0, inv: 1, r: F.BR, spin: 0, owner: -1 };
      this.players = [];
      this.events = [];
      this.lastTouch = -1; this.prevTouch = -1;
      this.lastPass = null;
      this.goals = [];             // {team, by, own, t}
      this.onGoal = null; this.onEnd = null;
      for (const p of players) this.add(p, true);
      this.kickoff(this.rnd() < 0.5 ? 0 : 1);
    }

    add(p, initial) {
      const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, inv: 0.5, r: F.PR, ix: 0, iy: 0, kickT: 0, passT: 0,
        kSeq: 0, pSeq: 0, goals: 0, own: 0, assists: 0, fx: 1, fy: 0, noGrab: 0, tkCD: 0,
        ai: { t: 0, tx: 0, ty: 0, yo: 0 } }, p);
      if (q.bot == null) q.bot = -1;
      q.c = newCount();
      this.setStats(q, p.st);
      q.fx = q.team === 0 ? 1 : -1;
      this.players.push(q);
      if (!initial) {   // ny spelare mitt i matchen: ställ upp vid egen kant
        const s = q.team === 0 ? -1 : 1;
        q.x = s * F.FX * 0.6; q.y = (this.rnd() - 0.5) * F.FY;
      }
      return q;
    }
    setStats(q, st) {
      const base = q.bot >= 0 ? (LV[q.bot] || LV[1]).st : 0;
      q.st = {};
      for (const k of STATS) q.st[k] = clamp(+((st || {})[k]) || base, 0, STMAX);
    }
    byId(id) { return this.players.find(p => p.id === id); }

    kickoff(team) {
      this.kickTeam = team;
      this.phase = 'kickoff'; this.phaseT = 0;
      const b = this.ball; b.x = 0; b.y = 0; b.vx = 0; b.vy = 0; b.owner = -1;
      for (const t of [0, 1]) {
        const mates = this.players.filter(p => p.team === t);
        const n = mates.length;
        const form = FORM[Math.min(n, 5)] || FORM[5];
        mates.forEach((p, i) => {
          const f = form[i] || [-0.3 - 0.12 * (i % 4), ((i * 37) % 9 - 4) / 6];
          let x = f[0] * F.FX, y = f[1] * F.FY;
          if (i === 0 && t === team) { x = -(F.PR + F.BR + 14); y = 0; }
          else if (i === 0) x = Math.min(x, -(F.CR + F.PR + 6));
          p.x = t === 0 ? x : -x; p.y = y; p.vx = p.vy = 0; p.kickT = p.passT = 0; p.noGrab = 0;
          p.fx = t === 0 ? 1 : -1; p.fy = 0;
        });
      }
      this.lastTouch = this.prevTouch = -1;
      this.lastPass = null;
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

      const P = this.players, b = this.ball;
      for (const p of P) if (p.bot >= 0) this.think(p);

      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        let a = (p.kickT > 0 || p.passT > 0 ? F.ACC_K : F.ACC) * (1 + 0.011 * p.st.spd);
        if (b.owner === i) a *= 0.86 + 0.005 * p.st.drb;   // med bollen springer man lite långsammare
        p.vx += p.ix * a; p.vy += p.iy * a;
        if (p.noGrab > 0) p.noGrab--;
        if (p.tkCD > 0) p.tkCD--;
      }
      for (const d of [b, ...P]) { d.x += d.vx; d.y += d.vy; }
      for (const p of P) { p.vx *= F.DAMP; p.vy *= F.DAMP; p.c.dist += hyp(p.vx, p.vy); }
      b.vx *= F.BDAMP; b.vy *= F.BDAMP;
      b.spin += hyp(b.vx, b.vy) / F.BR;

      // vart spelarna tittar (bollen ligger framför den som dribblar)
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        let dx = 0, dy = 0;
        const il = hyp(p.ix, p.iy), vl = hyp(p.vx, p.vy);
        if (il > 0.2) { dx = p.ix / il; dy = p.iy / il; } else if (vl > 0.5) { dx = p.vx / vl; dy = p.vy / vl; }
        if (!dx && !dy) continue;
        if (b.owner !== i) { p.fx = dx; p.fy = dy; continue; }
        const cur = Math.atan2(p.fy, p.fx), want = Math.atan2(dy, dx);
        let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const turn = 0.11 + 0.006 * p.st.drb;
        const na = cur + clamp(da, -turn, turn);
        p.fx = Math.cos(na); p.fy = Math.sin(na);
      }
      this.dribble();

      for (let it = 0; it < 2; it++) {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) this.collide(P[i], P[j], F.E_PP);
        for (let i = 0; i < P.length; i++) this.ballContact(i);
        for (const p of P) this.playerBounds(p);
        this.ballBounds();
      }
      if (b.owner >= 0) {
        const o = P[b.owner];
        if (hyp(b.x - o.x, b.y - o.y) > F.PR + F.BR + 16) this.release(4);   // bollen fastnade (t.ex. mot sargen)
        else o.c.poss++;
      }

      // sparkar och passningar
      P.forEach((p, i) => {
        if (p.kickT > 0 || p.passT > 0) {
          if (b.owner === i) {
            if (p.passT > 0) this.doPass(p, i, p.fx, p.fy); else this.doKick(p, i, p.fx, p.fy);
            p.kickT = p.passT = 0;
            return;
          }
          const dx = b.x - p.x, dy = b.y - p.y, d = hyp(dx, dy);
          if (b.owner < 0 && d - F.PR - F.BR < F.REACH) {   // lös boll inom räckhåll: direktskott
            if (p.passT > 0) this.doPass(p, i, dx / d, dy / d);
            else this.doKick(p, i, dx / d, dy / d);
            p.kickT = p.passT = 0;
          } else { if (p.kickT > 0) p.kickT--; if (p.passT > 0) p.passT--; }
        }
      });

      // mål?
      if (this.phase !== 'goal' && Math.abs(b.y) < F.GY && Math.abs(b.x) > F.FX + F.BR * 0.6) {
        const team = b.x > 0 ? 0 : 1;   // bollen i högra målet = rött mål
        b.owner = -1;
        this.score[team]++;
        this.lastGoalTeam = team;
        let by = this.lastTouch >= 0 ? P[this.lastTouch] : null;
        let own = !!by && by.team !== team;
        // styrd in av en försvarare strax efter ett skott: målet räknas till skytten
        if (own && this.prevTouch >= 0 && P[this.prevTouch].team === team && this.tick - this.prevTouchK < 100) {
          by = P[this.prevTouch]; own = false; this.prevTouch = -1;
        }
        let assist = null;
        const lp = this.lastPass;
        if (by && !own && lp && P[lp.from] && P[lp.from] !== by && P[lp.from].team === team && this.tick - lp.k < 60 * 8) assist = P[lp.from];
        if (by) { if (own) by.own++; else by.goals++; }
        if (assist) assist.assists++;
        const g = { team, by: by ? by.id : null, own, assist: assist ? assist.id : null, t: this.minutes * 60 - this.timeLeft };
        this.goals.push(g);
        this.phase = 'goal'; this.phaseT = 0;
        this.ev('goal');
        this.onGoal && this.onGoal(g);
      }
    }

    dribble() {
      const b = this.ball;
      if (b.owner < 0) return;
      const p = this.players[b.owner], R = F.PR + F.BR + 1;
      const tx = p.x + p.fx * R, ty = p.y + p.fy * R;
      // bollen studsar lite fram och tillbaka vid fötterna
      const k = 0.45;
      b.x += (tx - b.x) * k; b.y += (ty - b.y) * k;
      b.vx = p.vx; b.vy = p.vy;
    }

    ballContact(i) {
      const b = this.ball, p = this.players[i];
      if (b.owner === i) return;
      const d = hyp(b.x - p.x, b.y - p.y);
      if (d >= F.PR + F.BR + 1.5) return;
      if (b.owner >= 0) {
        const o = this.players[b.owner];
        if (o.team === p.team) return;              // lagkamrat: låt bollen vara
        if (p.tkCD > 0 || this.phase === 'goal') { this.collideKeep(p); return; }
        // brytning: chans beror på brytning mot dribbling
        const ch = clamp(0.4 + 0.028 * (p.st.tck - o.st.drb), 0.1, 0.88);
        if (this.rnd() < ch) {
          this.own(i, true);
          o.noGrab = 40;
          o.vx *= 0.5; o.vy *= 0.5;
        } else {
          p.tkCD = 24; o.c.dribbles++;
          this.ev('dr');
          this.collideKeep(p);
        }
        return;
      }
      const rel = hyp(b.vx - p.vx, b.vy - p.vy);
      if (p.noGrab <= 0 && this.phase !== 'goal' && rel < 4.6 + 0.13 * p.st.drb) { this.own(i, false); return; }
      if (this.collide(p, b, F.E_PB)) this.touch(i);
    }
    // en motspelare som inte lyckades bryta knuffas undan från bollen
    collideKeep(p) {
      const b = this.ball, dx = p.x - b.x, dy = p.y - b.y, d = hyp(dx, dy) || 1, R = F.PR + F.BR;
      if (d < R) { p.x = b.x + dx / d * R; p.y = b.y + dy / d * R; const vn = p.vx * dx / d + p.vy * dy / d; if (vn < 0) { p.vx -= vn * dx / d; p.vy -= vn * dy / d; } }
    }

    own(i, tackle) {
      const b = this.ball, p = this.players[i];
      const lp = this.lastPass;
      if (lp && lp.from !== i && this.tick - lp.k < 60 * 5) {
        const from = this.players[lp.from];
        if (from && from.team === p.team) from.c.passOk++;
        else if (from) { p.c.tackles++; this.ev('tk'); }   // passningen snappades upp
      } else if (tackle) { p.c.tackles++; this.ev('tk'); }
      if (!lp || this.tick - lp.k >= 60 * 5 || lp.from === i) { /* ingen pass */ }
      if (!tackle) this.ev('t');
      b.owner = i;
      const d = hyp(b.x - p.x, b.y - p.y) || 1;
      p.fx = (b.x - p.x) / d; p.fy = (b.y - p.y) / d;
      this.touch(i);
    }
    release(noGrab) {
      const b = this.ball;
      if (b.owner >= 0) this.players[b.owner].noGrab = noGrab || 0;
      b.owner = -1;
    }

    touch(i) {
      if (this.phase === 'kickoff') this.phase = 'play';
      if (this.lastTouch !== i) { this.prevTouch = this.lastTouch; this.prevTouchK = this.lastTouchK; this.lastTouch = i; }
      this.lastTouchK = this.tick;
      // en passning som någon annan rör räknas inte längre som "på väg"
      if (this.lastPass && this.lastPass.from !== i && this.ball.owner !== i) this.lastPass.k = -1e9;
    }

    doKick(p, i, nx, ny) {
      const b = this.ball, owned = b.owner === i;
      let dx = nx, dy = ny;
      const il = hyp(p.ix, p.iy);
      if (il > 0.2) {   // spaken styr skottet
        const w = owned ? 1.2 : 0.55;
        const mx = nx + p.ix / il * w, my = ny + p.iy / il * w, ml = hyp(mx, my);
        if ((mx * nx + my * ny) / ml > 0.3) { dx = mx / ml; dy = my / ml; }
      }
      // träffsäkerhet
      const n = (this.rnd() - 0.5) * 0.16 * (1 - p.st.sho / 26);
      const c = Math.cos(n), s = Math.sin(n);
      [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
      const pow = F.KICK * (1 + 0.013 * p.st.sho);
      if (owned) {
        this.release(18);
        b.x = p.x + dx * (F.PR + F.BR + 2); b.y = p.y + dy * (F.PR + F.BR + 2);
        b.vx = p.vx * 0.5 + dx * pow; b.vy = p.vy * 0.5 + dy * pow;
      } else { b.vx += dx * pow; b.vy += dy * pow; p.noGrab = 14; }
      const sx = p.team === 0 ? 1 : -1;
      if (dx * sx > 0.45 && hyp(sx * F.FX - b.x, b.y) < 620) p.c.shots++;
      this.lastPass = null;
      this.touch(i);
      this.ev('k');
    }

    doPass(p, i, nx, ny) {
      const b = this.ball, owned = b.owner === i;
      const il = hyp(p.ix, p.iy);
      const ax = il > 0.2 ? p.ix / il : nx, ay = il > 0.2 ? p.iy / il : ny;
      let best = null, bs = 1e9;
      for (const q of this.players) {
        if (q === p || q.team !== p.team) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = hyp(dx, dy);
        if (d < 40) continue;
        const ang = Math.acos(clamp((dx * ax + dy * ay) / d, -1, 1));
        if (ang > 1.35) continue;
        let s = ang * 1.2 + d / 900;
        // undvik passningar rakt genom en motståndare
        for (const o of this.players) {
          if (o.team === p.team) continue;
          const t = clamp(((o.x - p.x) * dx + (o.y - p.y) * dy) / (d * d), 0, 1);
          const od = hyp(p.x + dx * t - o.x, p.y + dy * t - o.y);
          if (od < 38) s += 1.2 * (1 - od / 38) + 0.3;
        }
        if (s < bs) { bs = s; best = q; }
      }
      if (owned) {
        this.release(16);
        b.x = p.x + ax * (F.PR + F.BR + 2); b.y = p.y + ay * (F.PR + F.BR + 2);
        b.vx = b.vy = 0;
      } else p.noGrab = 12;
      if (best) {
        const lead = 18 * (0.55 + 0.025 * p.st.pas);
        const tx = best.x + best.vx * lead, ty = best.y + best.vy * lead;
        let dx = tx - b.x, dy = ty - b.y; const D = hyp(dx, dy) || 1;
        const n = (this.rnd() - 0.5) * 0.3 * (1 - p.st.pas / 25);
        const c = Math.cos(n), s = Math.sin(n);
        [dx, dy] = [(dx * c - dy * s) / D, (dx * s + dy * c) / D];
        const sp = clamp(D / 100 + 0.8 + 0.03 * p.st.pas, 2.2, 6.4);
        b.vx = dx * sp; b.vy = dy * sp;
      } else { b.vx += ax * 4; b.vy += ay * 4; }
      p.c.passes++;
      this.touch(i);
      this.lastPass = { from: i, k: this.tick };
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
      if (hit && b.owner < 0 && hyp(b.vx, b.vy) > 1.5) this.ev('w');
    }

    ev(e) { if (this.events.length < 20) this.events.push(e); }

    finish() {
      this.phase = 'end';
      this.ball.owner = -1;
      this.ev('end');
      this.onEnd && this.onEnd(this.result());
    }

    result() {
      const w = this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1;
      const stats = this.players.map(p => Object.assign({ id: p.id, name: p.name, ch: p.ch, team: p.team, bot: p.bot, goals: p.goals, own: p.own, assists: p.assists },
        p.c, { dist: Math.round(p.c.dist), poss: Math.round(p.c.poss / 60) }));
      let mvp = null;
      for (const s of stats) {
        if (w >= 0 && s.team !== w) continue;
        const v = s.goals * 3 + s.assists * 2 - s.own * 2 + s.tackles * 0.3 + s.passOk * 0.2 + (s.bot < 0 ? 0.5 : 0);
        if (!mvp || v > mvp.v) mvp = Object.assign({ v }, s);
      }
      return { score: this.score.slice(), winner: w, stats, mvp, goals: this.goals.slice(), golden: this.golden, minutes: this.minutes };
    }

    /* läget som skickas till de andra (≈30 ggr/s) */
    snap() {
      const r = v => Math.round(v * 10) / 10;
      const b = this.ball;
      return {
        t: 's', k: this.tick, ph: this.phase[0], tl: Math.ceil(this.timeLeft * 10), g: this.golden ? 1 : 0,
        sc: this.score, b: [r(b.x), r(b.y), Math.round(b.spin * 10) / 10, b.owner],
        p: this.players.map(p => [r(p.x), r(p.y), p.kickT > 0 || p.passT > 0 ? 1 : 0]),
        ev: this.events.splice(0)
      };
    }

    /* ---------------- datorspelare ---------------- */
    think(p) {
      const L = LV[p.bot] || LV[1], ai = p.ai;
      const b = this.ball, s = p.team === 0 ? 1 : -1;   // s = anfallsriktning i x
      const ogx = s * F.FX, mgx = -s * F.FX;            // motståndarnas mål, eget mål
      const P = this.players, me = P.indexOf(p);
      if (this.phase === 'goal' || this.phase === 'end') { p.ix = p.iy = 0; return; }
      const ownerP = b.owner >= 0 ? P[b.owner] : null;
      if (--ai.t <= 0) {
        ai.t = L.react + Math.floor(this.rnd() * 3);
        const mates = P.filter(q => q.team === p.team);
        let chaser = mates[0];
        const cost = q => hyp(q.x - b.x, q.y - b.y) + (s * (q.x - b.x) > 0 ? 40 : 0);
        for (const q of mates) if (cost(q) < cost(chaser)) chaser = q;
        let keeper = null;
        if (mates.length >= 3) for (const q of mates) if (q !== chaser && q.bot >= 0 && (!keeper || s * q.x < s * keeper.x)) keeper = q;
        const lp = this.lastPass, toMe = lp && !ownerP && P[lp.from] && P[lp.from].team === p.team && P[lp.from] !== p &&
          this.tick - lp.k < 150 && (b.vx * (p.x - b.x) + b.vy * (p.y - b.y)) > 0 &&
          P.filter(q => q.team === p.team && q !== P[lp.from]).every(q => hyp(q.x - b.x, q.y - b.y) >= hyp(p.x - b.x, p.y - b.y));
        if (toMe) chaser = p;
        if (ownerP === p) ai.role = 'carry';
        else if (ownerP && ownerP.team === p.team) ai.role = p === keeper ? 'keep' : 'support';
        else ai.role = p === chaser ? 'chase' : p === keeper ? 'keep' : 'support';
        if (ai.role === 'keep' && hyp(b.x - mgx, b.y) < 190 && !(ownerP && ownerP.team === p.team)) ai.role = 'chase';
        if (this.phase === 'kickoff' && this.kickTeam !== p.team && ai.role === 'chase') ai.role = 'wait';
        if (this.rnd() < 0.3) ai.yo = (this.rnd() - 0.5) * 2 * F.GY * 0.55;
        ai.lane = mates.filter(q => q !== chaser).indexOf(p);
        ai.bx = b.x + b.vx * L.react * 0.6; ai.by = b.y + b.vy * L.react * 0.6;
        ai.act = null;
        if (ai.role === 'carry') {
          const gx = ogx - p.x, gy = ai.yo - p.y, gd = hyp(gx, gy);
          const facing = (p.fx * gx + p.fy * gy) / (gd || 1);
          let threat = null, td = 1e9;
          for (const q of P) if (q.team !== p.team) { const d = hyp(q.x - p.x, q.y - p.y); if (d < td && (q.x - p.x) * s > -20) { td = d; threat = q; } }
          ai.threat = td < 130 ? threat : null;
          if (gd < L.shoot && facing > 0.82 && this.rnd() > L.miss) ai.act = 'kick';
          else if (ai.threat && td < 75 && mates.length > 1 && this.rnd() < L.passP) ai.act = 'pass';
          else if (s * p.x < -F.FX + 170 && ai.threat && td < 60) ai.act = 'kick';   // rensa bakifrån
        }
      }
      let tx, ty;
      if (ai.role === 'carry') {
        // dribbla mot målet och väj för motståndare
        let dx = ogx - p.x, dy = ai.yo - p.y; const dl = hyp(dx, dy) || 1; dx /= dl; dy /= dl;
        const t = ai.threat;
        if (t) {
          const rx = t.x - p.x, ry = t.y - p.y, side = (-dy * rx + dx * ry) > 0 ? -1 : 1;
          const k = clamp(1 - hyp(rx, ry) / 130, 0, 1) * 0.9;
          dx += -dy * side * k; dy += dx * side * k;
        }
        tx = p.x + dx * 80; ty = clamp(p.y + dy * 80, -F.FY + 25, F.FY - 25);
        if (ai.act === 'kick' && p.kickT <= 0) { p.kickT = 3; ai.act = null; }
        if (ai.act === 'pass' && p.passT <= 0) { p.passT = 3; ai.act = null; }
      } else if (ai.role === 'chase') {
        if (ownerP) { tx = b.x + (b.x - ownerP.x) * 0.2; ty = b.y + (b.y - ownerP.y) * 0.2; }
        else {
          const lead = Math.min(20, hyp(p.x - b.x, p.y - b.y) / 6);
          tx = b.x + b.vx * lead; ty = b.y + b.vy * lead;
          // kom helst från eget mål-hållet så bollen inte går mot eget mål
          if (s * (p.x - b.x) > 10) { tx -= s * 18; }
        }
      } else if (ai.role === 'keep') {
        tx = mgx + s * (F.PR + 34);
        ty = clamp(b.y * 0.55, -F.GY * 0.75, F.GY * 0.75);
      } else if (ai.role === 'wait') {
        tx = -s * (F.CR + F.PR + 10); ty = clamp(b.y, -40, 40);
      } else {
        const lanes = [-0.5, 0.5, 0, -0.8, 0.8];
        const ly = (lanes[ai.lane] != null ? lanes[ai.lane] : 0) * F.FY;
        const attack = (ownerP && ownerP.team === p.team) || s * ai.bx > -F.FX * 0.2;
        if (attack) { tx = ai.bx + s * (ownerP && ownerP.team === p.team ? 60 : -150); ty = ly; }
        else { tx = mgx + (ai.bx - mgx) * 0.45; ty = ai.by * 0.4 + ly * 0.5; }
        tx = clamp(tx, -F.FX + 40, F.FX - 40); ty = clamp(ty, -F.FY + 30, F.FY - 30);
        const db = hyp(tx - b.x, ty - b.y);
        if (db < 90) { tx += (tx - b.x) / (db || 1) * (90 - db); ty += (ty - b.y) / (db || 1) * (90 - db); }
      }
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      const sp = L.acc * Math.min(1, d / 30);
      if (d > 3) {
        const n = (this.rnd() - 0.5) * L.aim * 0.25;
        const c = Math.cos(n), sn = Math.sin(n);
        const ux = dx / d, uy = dy / d;
        p.ix = (ux * c - uy * sn) * sp; p.iy = (ux * sn + uy * c) * sp;
      } else { p.ix = p.iy = 0; }
    }
  }
  return { Match, F, LV, STATS, STMAX };
})();
if (typeof module !== 'undefined') module.exports = SIM;
