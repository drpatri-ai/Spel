/* Bucinca Boxning – själva matchen: rörelser, slag, gard, ducka, nedslag, ronder och datorboxare.
   Körs i webbläsaren (lokalt och hos värden i nätverksmatch) och i Node (tester). */
(function (root) {
  'use strict';
  const DT = 1 / 60;
  const RING = 470;             // halva ringens bredd (enheter)
  const MIN_D = 125;            // närmare än så kan kropparna inte komma
  // knappar (bitar)
  const K = { L: 1, R: 2, DUCK: 4, BLOCK: 8, JAB: 16, HOOK: 32, UPPER: 64, SUPER: 128 };
  const ATK = K.JAB | K.HOOK | K.UPPER | K.SUPER;

  // snabbhet / styrka / kondition (1–5) per figur, samma ordning som CHARS
  const STATS = [
    { spd: 4, pow: 2, sta: 3, tag: 'Snabba händer' },     // Leah
    { spd: 3, pow: 3, sta: 3, tag: 'Allroundboxare' },    // Leon
    { spd: 2, pow: 5, sta: 2, tag: 'Knockoutkung' },      // Patriot
    { spd: 4, pow: 3, sta: 2, tag: 'Kvick och vass' },    // Hanna
    { spd: 3, pow: 2, sta: 4, tag: 'Orkar hur länge som helst' }, // Marissa
    { spd: 5, pow: 2, sta: 2, tag: 'Blixten' },           // Elita
    { spd: 2, pow: 4, sta: 3, tag: 'Tung högerhand' },    // Besnik
    { spd: 3, pow: 4, sta: 2, tag: 'Hård och snabb' },    // Saranda
    { spd: 2, pow: 3, sta: 4, tag: 'Seg som läder' },     // Gjyshja
    { spd: 2, pow: 2, sta: 5, tag: 'Rutinerad veteran' }  // Gjyshi
  ];
  const statsOf = ch => STATS[((ch | 0) % STATS.length + STATS.length) % STATS.length];

  const MOVES = {
    jab:   { wind: .09, act: .07, rec: .16, reach: 195, dmg: 4,  sta: 5,  kb: 16,  stun: .2,  hi: 1, name: 'Jabb' },
    hook:  { wind: .21, act: .09, rec: .30, reach: 168, dmg: 9,  sta: 12, kb: 38,  stun: .36, hi: 1, name: 'Krok' },
    upper: { wind: .25, act: .09, rec: .36, reach: 148, dmg: 12, sta: 15, kb: 50,  stun: .45, hi: 0, name: 'Uppercut' },
    super: { wind: .42, act: .12, rec: .50, reach: 185, dmg: 24, sta: 0,  kb: 130, stun: .8,  hi: 1, name: 'Superslag' }
  };
  const MOVE_OF = { [K.JAB]: 'jab', [K.HOOK]: 'hook', [K.UPPER]: 'upper', [K.SUPER]: 'super' };

  function RNG(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function boxer(o, side) {
    const s = statsOf(o.ch);
    const maxhp = 100 + (s.sta - 3) * 8, maxsta = 100 + (s.sta - 3) * 10;
    return {
      ch: o.ch | 0, name: o.name || '', bot: o.bot == null ? -1 : o.bot, side,
      spd: s.spd, pow: s.pow, stam: s.sta,
      x: side ? 210 : -210, face: side ? -1 : 1,
      hp: maxhp, maxhp, sta: maxsta, maxsta, sup: 0,
      st: 'idle', mv: null, ph: '', t: 0, stun: 0, kd: 0, getup: 0, upAt: 99,
      in: 0, press: 0, buf: null, bufT: 0, hitT: 0, lastHit: '',
      dmg: 0, landed: 0, thrown: 0, blocked: 0,
      ai: { t: 0, hold: 0, bits: 0, plan: null }
    };
  }

  class Fight {
    constructor(a, b, opt = {}) {
      this.rounds = opt.rounds || 3;
      this.roundTime = opt.roundTime || 60;
      this.B = [boxer(a, 0), boxer(b, 1)];
      this.rng = RNG(opt.seed || ((Math.random() * 1e9) | 0));
      this.round = 1; this.time = this.roundTime;
      this.phase = 'intro'; this.pt = 0;
      this.count = 0; this.downIdx = -1;
      this.ev = []; this.evSeq = 0;
      this.over = false; this.winner = -1; this.how = '';
      this.emit('round', { r: 1 });
    }
    emit(type, o) { this.ev.push(Object.assign({ id: ++this.evSeq, e: type }, o || {})); if (this.ev.length > 60) this.ev.shift(); }
    // knappar från spelare (bitar) – nya tryck sparas så att snabba tryck inte försvinner
    setInput(i, bits) { const b = this.B[i]; if (!b) return; b.press |= bits & ~b.in; b.in = bits; }

    step() {
      const dt = DT;
      this.pt += dt;
      for (let i = 0; i < 2; i++) if (this.B[i].bot >= 0) this.botThink(i, dt);
      if (this.phase === 'intro') {
        if (this.pt > 1.8) { this.phase = 'fight'; this.pt = 0; this.emit('fight'); }
        for (const b of this.B) { b.press = 0; this.settle(b, dt); }
        return;
      }
      if (this.phase === 'break') {
        for (const b of this.B) { b.press = 0; b.st = 'idle'; b.mv = null; }
        for (const b of this.B) { const tx = b.side ? 210 : -210; b.x += (tx - b.x) * Math.min(1, dt * 3); b.sta = Math.min(b.maxsta, b.sta + 40 * dt); }
        if (this.pt > 3.5) { this.round++; this.time = this.roundTime; this.phase = 'intro'; this.pt = 0; this.emit('round', { r: this.round }); }
        return;
      }
      if (this.phase === 'end') { for (const b of this.B) { b.press = 0; this.settle(b, dt); } return; }
      if (this.phase === 'count') { this.countStep(dt); return; }
      // ---- fight ----
      this.time -= dt;
      for (let i = 0; i < 2; i++) { if (this.phase !== 'fight') return; this.boxerStep(i, dt); }
      // kropparna får inte gå in i varandra
      const [a, b] = this.B;
      let d = b.x - a.x;
      if (Math.abs(d) < MIN_D) { const s = d >= 0 ? 1 : -1, push = (MIN_D - Math.abs(d)) / 2; a.x -= s * push; b.x += s * push; }
      for (const q of this.B) q.x = clamp(q.x, -RING, RING);
      d = b.x - a.x;
      a.face = d >= 0 ? 1 : -1; b.face = -a.face;
      if (this.time <= 0 && this.phase === 'fight') this.endRound();
    }
    settle(b, dt) {
      if (b.st !== 'down' && b.st !== 'win' && b.st !== 'lose') { b.st = 'idle'; b.mv = null; }
      b.t += dt;
    }
    boxerStep(i, dt) {
      const b = this.B[i], o = this.B[1 - i];
      const spdK = 0.75 + b.spd * 0.09;            // 0.84 – 1.2
      const tired = b.sta < 15;
      b.t += dt;
      b.hitT = Math.max(0, b.hitT - dt);
      // ork
      if (b.st !== 'atk') b.sta = Math.min(b.maxsta, b.sta + (10 + b.stam * 2.5) * dt * (b.st === 'block' ? .5 : 1));
      // buffra slag som trycks medan man är upptagen
      const pr = b.press & ATK; b.press = 0;
      if (pr) { for (const k of [K.SUPER, K.UPPER, K.HOOK, K.JAB]) if (pr & k) { b.buf = MOVE_OF[k]; b.bufT = .22; break; } }
      b.bufT -= dt; if (b.bufT <= 0) b.buf = null;
      if (b.st === 'stun') { b.stun -= dt; if (b.stun <= 0) { b.st = 'idle'; b.t = 0; } else return; }
      if (b.st === 'atk') {
        const m = MOVES[b.mv], k = 1 / (spdK * (tired ? .8 : 1));
        if (b.ph === 'wind' && b.t >= m.wind * k) { b.ph = 'act'; b.t = 0; this.resolve(i); }
        else if (b.ph === 'act' && b.t >= m.act * k) { b.ph = 'rec'; b.t = 0; }
        else if (b.ph === 'rec' && b.t >= m.rec * k) { b.st = 'idle'; b.mv = null; b.t = 0; }
        if (b.st === 'atk') { if (b.ph === 'wind' || b.ph === 'act') b.x += b.face * (b.mv === 'jab' ? 60 : 30) * dt; return; }
      }
      // nytt slag?
      if (b.buf) {
        const mv = b.buf;
        if (mv === 'super' && b.sup < 100) { b.buf = null; }
        else {
          b.buf = null;
          b.st = 'atk'; b.mv = mv; b.ph = 'wind'; b.t = 0; b.thrown++;
          if (mv === 'super') { b.sup = 0; this.emit('superwind', { i }); }
          b.sta = Math.max(0, b.sta - MOVES[mv].sta);
          this.emit('swing', { i, m: mv });
          return;
        }
      }
      // gard / ducka / gå
      const inp = b.in;
      const ns = (inp & K.BLOCK) ? 'block' : (inp & K.DUCK) ? 'duck' : 'idle';
      if (ns !== b.st && !(ns === 'idle' && b.st === 'walk')) { b.st = ns; b.t = 0; }
      if (ns === 'idle') {
        let dir = 0; if (inp & K.L) dir -= 1; if (inp & K.R) dir += 1;
        if (dir) { b.x += dir * 230 * spdK * (tired ? .7 : 1) * dt; if (b.st !== 'walk') { b.st = 'walk'; } b.walk = dir * b.face; }
        else if (b.st === 'walk') b.st = 'idle';
      } else if (ns === 'block') { let dir = 0; if (inp & K.L) dir -= 1; if (inp & K.R) dir += 1; b.x += dir * 90 * dt; }
    }
    resolve(i) {
      const a = this.B[i], d = this.B[1 - i], m = MOVES[a.mv];
      const dist = Math.abs(d.x - a.x);
      if (dist > m.reach || d.st === 'down') { this.emit('miss', { i, m: a.mv }); return; }
      if (d.st === 'duck' && m.hi) { this.emit('dodge', { i: 1 - i, m: a.mv }); d.sup = Math.min(100, d.sup + 6); return; }
      let dmg = m.dmg * (0.78 + a.pow * 0.11) * (a.sta < 15 ? .6 : 1);
      let kind = 'hit';
      const counter = d.st === 'atk' && d.ph === 'wind';
      if (counter) { dmg *= 1.4; kind = 'counter'; d.st = 'stun'; d.mv = null; }
      if (d.st === 'duck' && !m.hi) { dmg *= 1.5; kind = 'counter'; }
      if (d.st === 'block' && d.sta > 0) {
        const thru = a.mv === 'jab' ? 0 : a.mv === 'hook' ? .2 : .4;
        d.sta = Math.max(0, d.sta - (a.mv === 'jab' ? 4 : a.mv === 'hook' ? 9 : 14));
        dmg *= thru; d.x += a.face * m.kb * .4; d.blocked++;
        if (a.mv === 'upper' || a.mv === 'super' || d.sta <= 0) { d.st = 'stun'; d.stun = .25; d.t = 0; this.emit('guardbreak', { i: 1 - i }); }
        a.sup = Math.min(100, a.sup + 2);
        if (dmg > 0) { d.hp -= dmg; a.dmg += dmg; }
        this.emit('block', { i: 1 - i, m: a.mv, x: Math.round(d.x - a.face * 40) });
        if (d.hp <= 0) this.knockdown(1 - i, a.mv);
        return;
      }
      dmg = Math.round(dmg * 10) / 10;
      d.hp -= dmg; a.dmg += dmg; a.landed++;
      a.sup = Math.min(100, a.sup + (a.mv === 'super' ? 0 : 7 + dmg * .8));
      d.sup = Math.min(100, d.sup + 2);
      d.x += a.face * m.kb * (counter ? 1.3 : 1);
      if (d.st !== 'down') { d.st = 'stun'; d.stun = m.stun * (counter ? 1.3 : 1); d.t = 0; d.mv = null; }
      d.hitT = .25; d.lastHit = a.mv;
      this.emit(kind, { i: 1 - i, m: a.mv, dmg: Math.round(dmg), x: Math.round(d.x - a.face * 30) });
      if (d.hp <= 0) this.knockdown(1 - i, a.mv);
    }
    knockdown(i, mv) {
      const d = this.B[i], a = this.B[1 - i];
      d.hp = 0; d.kd++; d.st = 'down'; d.t = 0; d.getup = 0; d.mv = null;
      a.st = 'idle'; a.mv = null;
      this.phase = 'count'; this.pt = 0; this.count = 0; this.downIdx = i;
      // datorn reser sig vid en slumpad räkning (svårare för varje nedslag)
      const lv = d.bot >= 0 ? d.bot : 5;
      d.upAt = d.kd >= 3 ? 99 : Math.round(clamp(3 + d.kd * 2.2 + (this.rng() * 4) - lv * .35, 2, 11));
      this.emit('down', { i, kd: d.kd, m: mv });
    }
    countStep(dt) {
      const d = this.B[this.downIdx], a = this.B[1 - this.downIdx];
      // den som står går till sitt hörn
      const tx = a.side ? RING - 170 : -RING + 170; a.x += (tx - a.x) * Math.min(1, dt * 2);
      d.t += dt; a.t += dt;
      if (this.pt > 1.0 + this.count * .85) {
        this.count++;
        this.emit('count', { n: this.count });
        if (this.count >= 10 || (d.kd >= 3 && this.count >= 3)) { this.finish(1 - this.downIdx, d.kd >= 3 ? 'tko' : 'ko'); return; }
      }
      // resa sig: spelaren trycker snabbt, datorn vid sin räkning
      const pr = d.press & ATK; d.press = 0; a.press = 0;
      if (d.bot < 0 && pr && d.kd < 3 && this.count >= 1) d.getup += 100 / (5 + d.kd * 3.5);
      d.getup = Math.max(0, d.getup - dt * (8 + d.kd * 4));
      if ((d.bot >= 0 && this.count >= d.upAt) || (d.bot < 0 && d.getup >= 100)) {
        d.st = 'idle'; d.t = 0; d.hp = Math.round(d.maxhp * Math.max(.2, .55 - d.kd * .12));
        d.sta = d.maxsta * .7;
        this.phase = 'fight'; this.pt = 0;
        this.emit('up', { i: this.downIdx, n: this.count });
      }
    }
    endRound() {
      this.emit('bell', { r: this.round });
      if (this.round >= this.rounds) {
        const [a, b] = this.B;
        const sc = q => q.dmg + q.landed * .5 - q.kd * 15;
        const sa = sc(a), sb = sc(b);
        this.finish(sa === sb ? (a.hp >= b.hp ? 0 : 1) : sa > sb ? 0 : 1, 'pts');
        return;
      }
      this.phase = 'break'; this.pt = 0;
      for (const q of this.B) { q.hp = Math.min(q.maxhp, q.hp + q.maxhp * .15); q.st = 'idle'; q.mv = null; }
    }
    finish(w, how) {
      this.over = true; this.winner = w; this.how = how; this.phase = 'end'; this.pt = 0;
      this.B[w].st = 'win'; if (this.B[1 - w].st !== 'down') this.B[1 - w].st = 'lose';
      this.B[w].t = 0;
      this.emit('end', { w, how });
    }

    /* ---------------- datorboxare ---------------- */
    botThink(i, dt) {
      const b = this.B[i], o = this.B[1 - i], A = b.ai, L = clamp(b.bot, 1, 10);
      const r = this.rng;
      if (this.phase === 'count') { this.setInput(i, 0); return; }
      if (this.phase !== 'fight') { this.setInput(i, 0); return; }
      A.t -= dt; A.hold -= dt;
      const dist = Math.abs(o.x - b.x), fwd = b.face > 0 ? K.R : K.L, back = b.face > 0 ? K.L : K.R;
      // se slag komma och försvara sig
      if (o.st === 'atk' && o.ph === 'wind' && !A.saw) {
        A.saw = true;
        const m = MOVES[o.mv];
        if (dist < m.reach + 30 && r() < .08 + L * .075) {
          let bits;
          if (o.mv === 'upper') bits = r() < .6 ? K.BLOCK : back;
          else if (o.mv === 'super') bits = r() < .55 ? K.DUCK : back;
          else bits = r() < .5 ? K.DUCK : K.BLOCK;
          // kontra ibland en långsam krok med en snabb jabb
          if (o.mv !== 'jab' && L >= 6 && r() < .25 && dist < MOVES.jab.reach) bits = K.JAB;
          A.bits = bits; A.hold = .3 + r() * .25; A.t = A.hold;
          this.setInput(i, A.bits); return;
        }
      }
      if (o.st !== 'atk') A.saw = false;
      if (A.hold > 0) { this.setInput(i, A.bits); return; }
      if (A.t > 0) { this.setInput(i, A.bits & (K.L | K.R | K.BLOCK | K.DUCK)); return; }
      // ny plan
      A.t = Math.max(.1, .62 - L * .05) * (.6 + r() * .8);
      let bits = 0;
      const tired = b.sta < 25;
      if (b.st === 'atk' || b.st === 'stun') { A.bits = 0; this.setInput(i, 0); return; }
      if (b.sup >= 100 && dist < MOVES.super.reach - 10 && r() < .5) bits = K.SUPER;
      else if (tired && r() < .6) { bits = r() < .5 ? back : K.BLOCK; A.hold = .5; }
      else if (dist > MOVES.jab.reach - 15) { bits = r() < .85 ? fwd : 0; if (dist < MOVES.jab.reach + 40 && r() < .25) bits |= K.JAB; }
      else {
        const opDuck = o.st === 'duck', opStun = o.st === 'stun', opBlock = o.st === 'block';
        const p = r();
        if (opDuck) bits = dist < MOVES.upper.reach ? K.UPPER : fwd;
        else if (opStun) bits = dist < MOVES.hook.reach ? (p < .5 ? K.HOOK : K.UPPER) : K.JAB;
        else if (opBlock && L >= 4 && p < .4) bits = dist < MOVES.upper.reach ? K.UPPER : fwd;
        else if (p < .48) bits = K.JAB;
        else if (p < .72) bits = dist < MOVES.hook.reach ? K.HOOK : (fwd | K.JAB);
        else if (p < .84) bits = dist < MOVES.upper.reach ? K.UPPER : fwd;
        else if (p < .93) { bits = K.BLOCK; A.hold = .3 + r() * .4; }
        else { bits = back; }
        if (dist < 140 && r() < .2) bits = back;
      }
      A.bits = bits;
      this.setInput(i, bits);
      // släpp slagknappen nästa gång så att ett nytt tryck kan registreras
      if (bits & ATK) { A.bits = bits & ~ATK; }
    }

    /* läge för ritning och nätverk */
    snap() {
      return {
        ph: this.phase, r: this.round, tm: Math.max(0, Math.ceil(this.time)), c: this.count, di: this.downIdx, ov: this.over ? 1 : 0, w: this.winner, how: this.how,
        b: this.B.map(b => ({ x: Math.round(b.x * 10) / 10, f: b.face, st: b.st, mv: b.mv, ph: b.ph, t: Math.round(b.t * 1000) / 1000, hp: Math.round(b.hp * 10) / 10, mh: b.maxhp,
          sa: Math.round(b.sta), ms: b.maxsta, su: Math.round(b.sup), kd: b.kd, gu: Math.round(b.getup), ht: b.hitT > 0 ? 1 : 0, lh: b.lastHit, wk: b.walk || 0 })),
        ev: this.ev.slice(-20)
      };
    }
    result() { return { winner: this.winner, how: this.how, rounds: this.round, b: this.B.map(b => ({ ch: b.ch, name: b.name, dmg: Math.round(b.dmg), landed: b.landed, thrown: b.thrown, kd: b.kd, blocked: b.blocked })) }; }
  }

  const BX = { DT, RING, K, ATK, MOVES, STATS, statsOf, Fight, RNG };
  if (typeof module !== 'undefined' && module.exports) module.exports = BX; else root.BX = BX;
})(this);
