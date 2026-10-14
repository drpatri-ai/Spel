/* Fyra i rad – spellogik och datorspelare.
   Brädet: b[rad][kolumn], rad 0 = överst. 0 = tom, 1/2 = spelare. */
(function (g) {
  'use strict';
  const R = 6, C = 7;
  const ORDER = [3, 2, 4, 1, 5, 0, 6];
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  // Alla 69 möjliga "fönster" om fyra rutor
  const WINDOWS = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
        WINDOWS.push([0, 1, 2, 3].map(i => [r + dr * i, c + dc * i]));
      }

  const newBoard = () => Array.from({ length: R }, () => Array(C).fill(0));
  const clone = b => b.map(row => row.slice());

  function dropRow(b, c) {
    for (let r = R - 1; r >= 0; r--) if (b[r][c] === 0) return r;
    return -1;
  }
  const validMoves = b => ORDER.filter(c => b[0][c] === 0);
  const isFull = b => b[0].every(v => v !== 0);

  function isWin(b, r, c, p) {
    for (const [dr, dc] of DIRS) {
      let n = 1;
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < R && cc >= 0 && cc < C && b[rr][cc] === p) { n++; rr += dr; cc += dc; }
      rr = r - dr; cc = c - dc;
      while (rr >= 0 && rr < R && cc >= 0 && cc < C && b[rr][cc] === p) { n++; rr -= dr; cc -= dc; }
      if (n >= 4) return true;
    }
    return false;
  }

  // Returnerar de vinnande rutorna (för markering), eller null
  function winLine(b, r, c, p) {
    for (const [dr, dc] of DIRS) {
      const cells = [[r, c]];
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < R && cc >= 0 && cc < C && b[rr][cc] === p) {
          cells.push([rr, cc]); rr += dr * s; cc += dc * s;
        }
      }
      if (cells.length >= 4) {
        cells.sort((a, z) => (a[1] - z[1]) || (a[0] - z[0]));
        return cells;
      }
    }
    return null;
  }

  function winningMove(b, p) {
    for (const c of validMoves(b)) {
      const r = dropRow(b, c);
      b[r][c] = p;
      const w = isWin(b, r, c, p);
      b[r][c] = 0;
      if (w) return c;
    }
    return -1;
  }

  // Ger draget c motståndaren en direkt vinst (genom att lägga ovanpå)?
  function givesAway(b, c, p) {
    const r = dropRow(b, c);
    if (r <= 0) return false;
    const o = 3 - p;
    b[r][c] = p; b[r - 1][c] = o;
    const bad = isWin(b, r - 1, c, o);
    b[r - 1][c] = 0; b[r][c] = 0;
    return bad;
  }

  function evaluate(b, p) {
    const o = 3 - p;
    let s = 0;
    for (let r = 0; r < R; r++) {
      if (b[r][3] === p) s += 3; else if (b[r][3] === o) s -= 3;
      if (b[r][2] === p || b[r][4] === p) s += 1;
      if (b[r][2] === o || b[r][4] === o) s -= 1;
    }
    for (let i = 0; i < WINDOWS.length; i++) {
      const w = WINDOWS[i];
      let mp = 0, mo = 0;
      for (let k = 0; k < 4; k++) {
        const v = b[w[k][0]][w[k][1]];
        if (v === p) mp++; else if (v === o) mo++;
      }
      if (mp && mo) continue;
      if (mp === 3) s += 8; else if (mp === 2) s += 2;
      else if (mo === 3) s -= 9; else if (mo === 2) s -= 2;
    }
    return s;
  }

  const TIMEOUT = { timeout: true };
  let nodes = 0, deadline = Infinity;
  const WIN = 100000;

  function negamax(b, depth, alpha, beta, p) {
    if ((++nodes & 2047) === 0 && Date.now() > deadline) throw TIMEOUT;
    const moves = validMoves(b);
    if (!moves.length) return 0;
    for (const c of moves) {
      const r = dropRow(b, c);
      b[r][c] = p;
      const w = isWin(b, r, c, p);
      b[r][c] = 0;
      if (w) return WIN + depth;
    }
    if (depth === 0) return evaluate(b, p);
    // Måste blockera? Då finns bara ett vettigt drag.
    const o = 3 - p;
    const block = winningMove(b, o);
    const list = block >= 0 ? [block] : moves;
    let best = -Infinity;
    for (const c of list) {
      const r = dropRow(b, c);
      b[r][c] = p;
      const v = -negamax(b, depth - 1, -beta, -alpha, o);
      b[r][c] = 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Poäng för alla drag på ett visst djup (fullt fönster = exakta värden)
  function scoreMoves(b, p, depth) {
    return validMoves(b).map(c => {
      const r = dropRow(b, c);
      b[r][c] = p;
      const v = isWin(b, r, c, p) ? WIN + depth + 1 : -negamax(b, depth - 1, -Infinity, Infinity, 3 - p);
      b[r][c] = 0;
      return { c, v };
    });
  }

  // Iterativ fördjupning med tidsgräns – för Svår och Tips
  function searchBest(b, p, timeMs, maxDepth) {
    deadline = Date.now() + timeMs;
    nodes = 0;
    let order = validMoves(b);
    let best = order[0], reached = 0;
    try {
      for (let d = 1; d <= maxDepth; d++) {
        let alpha = -Infinity, bestHere = order[0];
        const scored = [];
        for (const c of order) {
          const r = dropRow(b, c);
          b[r][c] = p;
          let v;
          try {
            v = isWin(b, r, c, p) ? WIN + d + 1 : -negamax(b, d - 1, -Infinity, -alpha, 3 - p);
          } finally { b[r][c] = 0; }
          scored.push({ c, v });
          if (v > alpha) { alpha = v; bestHere = c; }
        }
        best = bestHere; reached = d;
        scored.sort((x, y) => y.v - x.v);
        order = scored.map(s => s.c);
        if (alpha >= WIN) break;            // hittat säker vinst
        if (alpha <= -WIN && d > 2) break;  // förlorat ändå – behåll längsta försvaret
        if (d >= 42) break;
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
    }
    deadline = Infinity;
    return { c: best, depth: reached };
  }

  function weightedRandom(moves) {
    const W = [1, 2, 3, 5, 3, 2, 1];
    let sum = 0;
    for (const c of moves) sum += W[c];
    let x = Math.random() * sum;
    for (const c of moves) { x -= W[c]; if (x <= 0) return c; }
    return moves[0];
  }

  /* Välj drag. Returnerar { c, reason } där reason är 'win', 'block' eller 'move'. */
  function botMove(board, p, level) {
    const b = clone(board);
    const o = 3 - p;
    const moves = validMoves(b);
    if (!moves.length) return { c: -1, reason: 'move' };
    const win = winningMove(b, p);
    const block = winningMove(b, o);

    if (level === 'easy') {
      if (win >= 0 && Math.random() < 0.55) return { c: win, reason: 'win' };
      if (block >= 0 && Math.random() < 0.4) return { c: block, reason: 'block' };
      return { c: weightedRandom(moves), reason: 'move' };
    }

    if (win >= 0) return { c: win, reason: 'win' };

    if (level === 'medium') {
      if (block >= 0 && Math.random() < 0.92) return { c: block, reason: 'block' };
      const safe = moves.filter(c => !givesAway(b, c, p));
      const pool = safe.length ? safe : moves;
      if (Math.random() < 0.15) return { c: weightedRandom(pool), reason: 'move' };
      const scored = scoreMoves(b, p, 4).filter(s => pool.includes(s.c));
      const top = Math.max(...scored.map(s => s.v));
      const good = scored.filter(s => s.v >= top - 4);
      return { c: good[Math.floor(Math.random() * good.length)].c, reason: 'move' };
    }

    // Svår (och tips)
    if (block >= 0) return { c: block, reason: 'block' };
    const empty = b.flat().filter(v => v === 0).length;
    if (empty === R * C) return { c: 3, reason: 'move' };
    const time = level === 'hint' ? 500 : 1100;
    const res = searchBest(b, p, time, 42);
    return { c: res.c, reason: 'move', depth: res.depth };
  }

  const api = { R, C, newBoard, clone, dropRow, validMoves, isFull, isWin, winLine, winningMove, botMove, evaluate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else g.AI = api;
})(this);
