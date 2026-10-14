/* Bucinca Schack – schackregler och datorspelare.
   0x88-bräde: ruta = rad*16 + linje, rad 0 = åttonde raden (svarts sida).
   Körs både i sidan (regler), i en Web Worker (datorns tänkande) och i Node (tester). */
(function (g) {
  'use strict';
  const WHITE = 8, BLACK = 16;
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, TYPE = 7;
  const NAME = '.pnbrqk';
  const N_OFF = [-33, -31, -18, -14, 14, 18, 31, 33];
  const B_OFF = [-17, -15, 15, 17];
  const R_OFF = [-16, -1, 1, 16];
  const K_OFF = [-17, -16, -15, -1, 1, 15, 16, 17];
  const F_EP = 1, F_CASTLE = 2, F_DOUBLE = 4;
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const sqName = s => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const sqOf = n => (8 - (+n[1])) * 16 + 'abcdefgh'.indexOf(n[0]);

  // rockadrättigheter som försvinner när något rör sig från/till en ruta
  const CMASK = new Int8Array(128).fill(15);
  CMASK[116] = 12; CMASK[119] = 14; CMASK[112] = 13; // vit kung, h1, a1
  CMASK[4] = 3; CMASK[7] = 11; CMASK[0] = 7;          // svart kung, h8, a8

  function Chess(fen) { this.board = new Int8Array(128); this.load(fen || START); }

  Chess.prototype.load = function (fen) {
    const b = this.board; b.fill(0);
    let [pos, turn, cas, ep, half, full] = fen.trim().split(/\s+/);
    let r = 0, f = 0;
    for (const ch of pos) {
      if (ch === '/') { r++; f = 0; continue; }
      if (ch >= '1' && ch <= '8') { f += +ch; continue; }
      const col = ch === ch.toUpperCase() ? WHITE : BLACK;
      const t = NAME.indexOf(ch.toLowerCase());
      const sq = r * 16 + f;
      b[sq] = t | col;
      if (t === K) { if (col === WHITE) this.kw = sq; else this.kb = sq; }
      f++;
    }
    this.turn = turn === 'b' ? BLACK : WHITE;
    cas = cas || '-';
    this.castle = (cas.includes('K') ? 1 : 0) | (cas.includes('Q') ? 2 : 0) | (cas.includes('k') ? 4 : 0) | (cas.includes('q') ? 8 : 0);
    this.ep = ep && ep !== '-' ? sqOf(ep) : -1;
    this.half = +half || 0;
    this.full = +full || 1;
    this.hist = [];
  };

  Chess.prototype.key = function () {
    const b = this.board;
    let s = '';
    for (let r = 0; r < 8; r++) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = b[r * 16 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        const c = NAME[p & TYPE];
        s += p & WHITE ? c.toUpperCase() : c;
      }
      if (e) s += e;
      if (r < 7) s += '/';
    }
    const c = this.castle;
    const cs = (c & 1 ? 'K' : '') + (c & 2 ? 'Q' : '') + (c & 4 ? 'k' : '') + (c & 8 ? 'q' : '') || '-';
    return s + ' ' + (this.turn === WHITE ? 'w' : 'b') + ' ' + cs + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-');
  };
  Chess.prototype.fen = function () { return this.key() + ' ' + this.half + ' ' + this.full; };

  Chess.prototype.attacked = function (sq, by) {
    const b = this.board;
    let s;
    if (by === WHITE) {
      s = sq + 15; if (!(s & 0x88) && b[s] === (P | WHITE)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (P | WHITE)) return true;
    } else {
      s = sq - 15; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
    }
    for (let i = 0; i < 8; i++) {
      s = sq + N_OFF[i]; if (!(s & 0x88) && b[s] === (N | by)) return true;
      s = sq + K_OFF[i]; if (!(s & 0x88) && b[s] === (K | by)) return true;
    }
    for (let i = 0; i < 4; i++) {
      let o = B_OFF[i]; s = sq + o;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === (B | by) || p === (Q | by)) return true; break; } s += o; }
      o = R_OFF[i]; s = sq + o;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === (R | by) || p === (Q | by)) return true; break; } s += o; }
    }
    return false;
  };
  Chess.prototype.kingSq = function (c) { return c === WHITE ? this.kw : this.kb; };
  Chess.prototype.inCheck = function (c) { if (c === undefined) c = this.turn; return this.attacked(this.kingSq(c), c ^ 24); };

  Chess.prototype.pseudo = function (capsOnly) {
    const moves = [], b = this.board, us = this.turn, them = us ^ 24;
    const add = (from, to, piece, cap, flags, promo) => moves.push({ from, to, piece, cap, flags, promo });
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || !(p & us)) continue;
      const t = p & TYPE;
      if (t === P) {
        const dir = us === WHITE ? -16 : 16, startR = us === WHITE ? 6 : 1, promoR = us === WHITE ? 0 : 7;
        const to = sq + dir;
        if (!(to & 0x88) && !b[to]) {
          if ((to >> 4) === promoR) { for (const pr of [Q, R, B, N]) add(sq, to, p, 0, 0, pr); }
          else if (!capsOnly) {
            add(sq, to, p, 0, 0, 0);
            const to2 = to + dir;
            if ((sq >> 4) === startR && !b[to2]) add(sq, to2, p, 0, F_DOUBLE, 0);
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const c = sq + d;
          if (c & 0x88) continue;
          if (b[c] && (b[c] & them)) {
            if ((c >> 4) === promoR) { for (const pr of [Q, R, B, N]) add(sq, c, p, b[c], 0, pr); }
            else add(sq, c, p, b[c], 0, 0);
          } else if (c === this.ep) add(sq, c, p, P | them, F_EP, 0);
        }
      } else if (t === N || t === K) {
        const offs = t === N ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const to = sq + offs[i];
          if (to & 0x88) continue;
          const q = b[to];
          if (!q) { if (!capsOnly) add(sq, to, p, 0, 0, 0); }
          else if (q & them) add(sq, to, p, q, 0, 0);
        }
        if (t === K && !capsOnly) {
          const cr = this.castle;
          if (us === WHITE && sq === 116) {
            if ((cr & 1) && !b[117] && !b[118] && b[119] === (R | WHITE) && !this.attacked(116, BLACK) && !this.attacked(117, BLACK) && !this.attacked(118, BLACK)) add(116, 118, p, 0, F_CASTLE, 0);
            if ((cr & 2) && !b[115] && !b[114] && !b[113] && b[112] === (R | WHITE) && !this.attacked(116, BLACK) && !this.attacked(115, BLACK) && !this.attacked(114, BLACK)) add(116, 114, p, 0, F_CASTLE, 0);
          } else if (us === BLACK && sq === 4) {
            if ((cr & 4) && !b[5] && !b[6] && b[7] === (R | BLACK) && !this.attacked(4, WHITE) && !this.attacked(5, WHITE) && !this.attacked(6, WHITE)) add(4, 6, p, 0, F_CASTLE, 0);
            if ((cr & 8) && !b[3] && !b[2] && !b[1] && b[0] === (R | BLACK) && !this.attacked(4, WHITE) && !this.attacked(3, WHITE) && !this.attacked(2, WHITE)) add(4, 2, p, 0, F_CASTLE, 0);
          }
        }
      } else {
        const offs = t === B ? B_OFF : t === R ? R_OFF : K_OFF;
        for (let i = 0; i < offs.length; i++) {
          const o = offs[i];
          let to = sq + o;
          while (!(to & 0x88)) {
            const q = b[to];
            if (!q) { if (!capsOnly) add(sq, to, p, 0, 0, 0); }
            else { if (q & them) add(sq, to, p, q, 0, 0); break; }
            to += o;
          }
        }
      }
    }
    return moves;
  };

  Chess.prototype.make = function (m) {
    const b = this.board, us = this.turn;
    this.hist.push({ m, castle: this.castle, ep: this.ep, half: this.half, kw: this.kw, kb: this.kb });
    b[m.to] = m.promo ? (m.promo | us) : m.piece;
    b[m.from] = 0;
    if (m.flags & F_EP) b[us === WHITE ? m.to + 16 : m.to - 16] = 0;
    if (m.flags & F_CASTLE) {
      if (m.to === 118) { b[117] = b[119]; b[119] = 0; }
      else if (m.to === 114) { b[115] = b[112]; b[112] = 0; }
      else if (m.to === 6) { b[5] = b[7]; b[7] = 0; }
      else if (m.to === 2) { b[3] = b[0]; b[0] = 0; }
    }
    if ((m.piece & TYPE) === K) { if (us === WHITE) this.kw = m.to; else this.kb = m.to; }
    this.castle &= CMASK[m.from] & CMASK[m.to];
    this.ep = (m.flags & F_DOUBLE) ? (m.from + m.to) >> 1 : -1;
    this.half = ((m.piece & TYPE) === P || m.cap) ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.turn = us ^ 24;
  };

  Chess.prototype.unmake = function () {
    const h = this.hist.pop(), m = h.m, b = this.board;
    this.turn ^= 24;
    const us = this.turn;
    b[m.from] = m.piece;
    if (m.flags & F_EP) { b[m.to] = 0; b[us === WHITE ? m.to + 16 : m.to - 16] = m.cap; }
    else b[m.to] = m.cap;
    if (m.flags & F_CASTLE) {
      if (m.to === 118) { b[119] = b[117]; b[117] = 0; }
      else if (m.to === 114) { b[112] = b[115]; b[115] = 0; }
      else if (m.to === 6) { b[7] = b[5]; b[5] = 0; }
      else if (m.to === 2) { b[0] = b[3]; b[3] = 0; }
    }
    this.castle = h.castle; this.ep = h.ep; this.half = h.half; this.kw = h.kw; this.kb = h.kb;
    if (us === BLACK) this.full--;
    return m;
  };

  Chess.prototype.moves = function () {
    const out = [], us = this.turn;
    for (const m of this.pseudo(false)) {
      this.make(m);
      if (!this.inCheck(us)) out.push(m);
      this.unmake();
    }
    return out;
  };

  Chess.prototype.insufficient = function () {
    const b = this.board;
    let minors = 0, bishopsColors = new Set(), bishops = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const t = b[sq] & TYPE;
      if (!t || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors++;
      if (t === B) { bishops++; bishopsColors.add(((sq >> 4) + (sq & 7)) & 1); }
    }
    if (minors <= 1) return true;
    return bishops === minors && bishopsColors.size === 1; // bara löpare på samma färg
  };

  Chess.prototype.perft = function (d) {
    if (d === 0) return 1;
    let n = 0;
    const us = this.turn;
    for (const m of this.pseudo(false)) {
      this.make(m);
      if (!this.inCheck(us)) n += this.perft(d - 1);
      this.unmake();
    }
    return n;
  };

  /* ---------------- värdering ---------------- */
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const T = s => s.trim().split(/[\s,]+/).map(Number);
  const PST = [null,
    T(`0 0 0 0 0 0 0 0, 50 50 50 50 50 50 50 50, 10 10 20 30 30 20 10 10, 5 5 10 25 25 10 5 5, 0 0 0 20 20 0 0 0, 5 -5 -10 0 0 -10 -5 5, 5 10 10 -20 -20 10 10 5, 0 0 0 0 0 0 0 0`),
    T(`-50 -40 -30 -30 -30 -30 -40 -50, -40 -20 0 0 0 0 -20 -40, -30 0 10 15 15 10 0 -30, -30 5 15 20 20 15 5 -30, -30 0 15 20 20 15 0 -30, -30 5 10 15 15 10 5 -30, -40 -20 0 5 5 0 -20 -40, -50 -40 -30 -30 -30 -30 -40 -50`),
    T(`-20 -10 -10 -10 -10 -10 -10 -20, -10 0 0 0 0 0 0 -10, -10 0 5 10 10 5 0 -10, -10 5 5 10 10 5 5 -10, -10 0 10 10 10 10 0 -10, -10 10 10 10 10 10 10 -10, -10 5 0 0 0 0 5 -10, -20 -10 -10 -10 -10 -10 -10 -20`),
    T(`0 0 0 0 0 0 0 0, 5 10 10 10 10 10 10 5, -5 0 0 0 0 0 0 -5, -5 0 0 0 0 0 0 -5, -5 0 0 0 0 0 0 -5, -5 0 0 0 0 0 0 -5, -5 0 0 0 0 0 0 -5, 0 0 0 5 5 0 0 0`),
    T(`-20 -10 -10 -5 -5 -10 -10 -20, -10 0 0 0 0 0 0 -10, -10 0 5 5 5 5 0 -10, -5 0 5 5 5 5 0 -5, 0 0 5 5 5 5 0 -5, -10 5 5 5 5 5 0 -10, -10 0 5 0 0 0 0 -10, -20 -10 -10 -5 -5 -10 -10 -20`),
    T(`-30 -40 -40 -50 -50 -40 -40 -30, -30 -40 -40 -50 -50 -40 -40 -30, -30 -40 -40 -50 -50 -40 -40 -30, -30 -40 -40 -50 -50 -40 -40 -30, -20 -30 -30 -40 -40 -30 -30 -20, -10 -20 -20 -20 -20 -20 -20 -10, 20 20 0 0 0 0 20 20, 20 30 10 0 0 10 30 20`)
  ];
  const KING_END = T(`-50 -40 -30 -20 -20 -30 -40 -50, -30 -20 -10 0 0 -10 -20 -30, -30 -10 20 30 30 20 -10 -30, -30 -10 30 40 40 30 -10 -30, -30 -10 30 40 40 30 -10 -30, -30 -10 20 30 30 20 -10 -30, -30 -30 0 0 0 0 -30 -30, -50 -30 -30 -30 -30 -30 -30 -50`);

  function evaluate(ch) {
    const b = ch.board;
    let mg = 0, npm = 0, wMat = 0, bMat = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const t = p & TYPE;
      if (t !== P && t !== K) npm += VAL[t];
      if (t === K) continue;
      const r = sq >> 4, f = sq & 7;
      const idx = (p & WHITE) ? r * 8 + f : (7 - r) * 8 + f;
      const v = VAL[t] + PST[t][idx];
      if (p & WHITE) { mg += v; wMat += VAL[t]; } else { mg -= v; bMat += VAL[t]; }
    }
    const endgame = npm <= 2600;
    const kt = endgame ? KING_END : PST[K];
    const kw = ch.kw, kb = ch.kb;
    mg += kt[(kw >> 4) * 8 + (kw & 7)] - kt[(7 - (kb >> 4)) * 8 + (kb & 7)];
    // i slutspel: den som leder vill gå fram med kungen och mota motståndarens kung mot kanten
    if (endgame && Math.abs(wMat - bMat) >= 300) {
      const dist = Math.abs((kw >> 4) - (kb >> 4)) + Math.abs((kw & 7) - (kb & 7));
      const bonus = (14 - dist) * 6;
      mg += wMat > bMat ? bonus : -bonus;
    }
    return ch.turn === WHITE ? mg : -mg;
  }

  /* ---------------- sökning ---------------- */
  const MATE = 100000;
  const STOP = { stop: true };
  let nodes = 0, stopAt = Infinity;
  let killers = [];

  function scoreMove(m, pv, ply) {
    if (pv && m.from === pv.from && m.to === pv.to && m.promo === pv.promo) return 1e7;
    if (m.cap) return 1e6 + VAL[m.cap & TYPE] * 10 - VAL[m.piece & TYPE] / 10;
    if (m.promo) return 9e5 + VAL[m.promo];
    const k = killers[ply];
    if (k && ((k[0] && k[0].from === m.from && k[0].to === m.to) || (k[1] && k[1].from === m.from && k[1].to === m.to))) return 8e5;
    return 0;
  }
  function order(moves, pv, ply) {
    for (const m of moves) m.s = scoreMove(m, pv, ply);
    moves.sort((a, z) => z.s - a.s);
    return moves;
  }
  function tick() { if ((++nodes & 1023) === 0 && Date.now() > stopAt) throw STOP; }

  function qsearch(ch, alpha, beta, ply) {
    tick();
    const stand = evaluate(ch);
    if (stand >= beta || ply > 40) return stand;
    if (stand > alpha) alpha = stand;
    const us = ch.turn;
    const moves = order(ch.pseudo(true), null, ply);
    for (const m of moves) {
      // hopplösa slag hoppas över (delta)
      if (stand + VAL[m.cap & TYPE] + (m.promo ? 800 : 0) + 200 < alpha) continue;
      ch.make(m);
      if (ch.inCheck(us)) { ch.unmake(); continue; }
      const s = -qsearch(ch, -beta, -alpha, ply + 1);
      ch.unmake();
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  function negamax(ch, depth, alpha, beta, ply, pv) {
    tick();
    const us = ch.turn;
    const check = ch.inCheck(us);
    if (check && ply < 16) depth++;
    if (depth <= 0) return qsearch(ch, alpha, beta, ply);
    if (ply > 0 && ch.half >= 100) return 0;
    const moves = order(ch.pseudo(false), pv, ply);
    let legal = 0, best = -Infinity;
    for (const m of moves) {
      ch.make(m);
      if (ch.inCheck(us)) { ch.unmake(); continue; }
      legal++;
      const s = -negamax(ch, depth - 1, -beta, -alpha, ply + 1, null);
      ch.unmake();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        if (!m.cap) { const k = killers[ply] || (killers[ply] = [null, null]); if (!k[0] || k[0].from !== m.from || k[0].to !== m.to) { k[1] = k[0]; k[0] = m; } }
        break;
      }
    }
    if (!legal) return check ? -MATE + ply : 0;
    return best;
  }

  // Poäng för varje drag på ett visst djup (fullt fönster)
  function rootScores(ch, depth) {
    const us = ch.turn, out = [];
    for (const m of ch.moves()) {
      ch.make(m);
      const s = -negamax(ch, depth - 1, -Infinity, Infinity, 1, null);
      ch.unmake();
      out.push({ m, s });
    }
    return out.sort((a, z) => z.s - a.s);
  }

  // Iterativ fördjupning med tidsgräns
  function think(ch, timeMs, maxDepth) {
    stopAt = Date.now() + timeMs; nodes = 0; killers = [];
    let moves = ch.moves();
    if (!moves.length) return null;
    if (moves.length === 1) return { m: moves[0], s: 0, depth: 0 };
    let best = moves[0], bestS = -Infinity, reached = 0;
    const h0 = ch.hist.length;
    try {
      for (let d = 1; d <= maxDepth; d++) {
        moves = order(moves, best, 0);
        let alpha = -Infinity, dBest = null, dS = -Infinity;
        for (const m of moves) {
          ch.make(m);
          const s = -negamax(ch, d - 1, -Infinity, -alpha, 1, null);
          ch.unmake();
          if (s > dS) { dS = s; dBest = m; }
          if (s > alpha) alpha = s;
        }
        best = dBest; bestS = dS; reached = d;
        if (Math.abs(dS) > MATE - 100) break; // matt hittad
      }
    } catch (e) {
      if (e !== STOP) throw e;
      while (ch.hist.length > h0) ch.unmake(); // återställ brädet efter avbruten sökning
    }
    stopAt = Infinity;
    return { m: best, s: bestS, depth: reached };
  }

  const pickRand = a => a[Math.floor(Math.random() * a.length)];

  /* Välj drag för en nivå. Returnerar ett drag-objekt (från ch.moves()). */
  function botMove(ch, level) {
    const moves = ch.moves();
    if (!moves.length) return null;
    stopAt = Infinity; killers = [];
    if (level === 'easy') {
      if (Math.random() < 0.3) return pickRand(moves);
      const sc = rootScores(ch, 1);
      const ok = sc.filter(x => x.s >= sc[0].s - 160);
      return pickRand(ok).m;
    }
    if (level === 'medium') {
      const sc = rootScores(ch, 2);
      if (sc[0].s > MATE - 100) return sc[0].m;
      const win = Math.random() < 0.12 ? 110 : 35;
      const ok = sc.filter(x => x.s >= sc[0].s - win);
      return pickRand(ok).m;
    }
    const time = level === 'hint' ? 700 : 1800;
    const res = think(ch, time, 30);
    return res && res.m;
  }

  const api = { Chess, WHITE, BLACK, P, N, B, R, Q, K, TYPE, START, sqName, sqOf, evaluate, botMove, think, VAL };

  // Web Worker: tar emot {id, fen, keys, level} och svarar {id, move}
  if (typeof importScripts === 'function' && typeof window === 'undefined') {
    self.onmessage = e => {
      const { id, fen, level } = e.data;
      const ch = new Chess(fen);
      const m = botMove(ch, level);
      self.postMessage({ id, move: m ? { from: m.from, to: m.to, promo: m.promo } : null });
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.Engine = api;
})(this);
