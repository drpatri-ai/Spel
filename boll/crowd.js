/* Bucinca Fotboll – publiken: läktare runt planen, reklamskyltar, jubel och publikljud.
   Röda lagets fans sitter mest till vänster (bakom deras mål), blå till höger. */
'use strict';
const CROWD = (() => {
  const F = SIM.F;
  const AD = 22, S0 = 38, ROW = 16, ROWS = 3, SP = 17;   // avstånd utanför spelområdet
  const SKIN = ['#F6D2B4', '#EBB792', '#C98E63', '#8E5B3C', '#F2C8A2'];
  const HAIR = ['#2B1B10', '#5A3A1F', '#D2A24E', '#1A1A1A', '#8A4B2A', '#EFD58E'];
  const TC = ['#FF4D6D', '#3B9DFF'], TD = ['#C9304D', '#2373C9'];
  const rnd = Math.random;
  const ppl = [];
  const person = (x, y, red) => ppl.push({ x: x + (rnd() - 0.5) * 4, y: y + (rnd() - 0.5) * 3, team: red ? 0 : 1,
    skin: (rnd() * SKIN.length) | 0, hair: (rnd() * HAIR.length) | 0, ph: rnd() * 6.28, sp: 3.5 + rnd() * 3,
    arm: rnd() < 0.35, flag: rnd() < 0.06, scarf: rnd() < 0.3, cap: rnd() < 0.15 });
  for (const sy of [-1, 1]) for (let r = 0; r < ROWS; r++) for (let x = -F.OX - 70 + (r % 2) * SP / 2; x <= F.OX + 70; x += SP)
    person(x, sy * (F.OY + S0 + 10 + r * ROW), rnd() < 0.5 - x / F.FX * 0.38);
  for (const sx of [-1, 1]) for (let r = 0; r < ROWS; r++) for (let y = -F.OY - 20 + (r % 2) * SP / 2; y <= F.OY + 20; y += SP)
    person(sx * (F.OX + S0 + 10 + r * ROW), y, sx < 0 ? rnd() < 0.85 : rnd() < 0.15);
  const W0 = F.OX + S0 + ROWS * ROW + 6, H0 = F.OY + S0 + ROWS * ROW + 6;

  const hype = [0, 0];
  let tension = 0, clapT = 8;

  /* ---------- ljud ---------- */
  let src = null, gain = null;
  function soundOn() {
    if (src || !SND.sound) return;
    const a = ac(); if (!a) return;
    const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.3; d[i] = last; }   // mörkt brus = sorl
    src = a.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    gain = a.createGain(); gain.gain.value = 0;
    src.connect(bp).connect(gain).connect(a.destination);
    src.start();
  }
  function soundOff() {
    if (!src) return;
    try { gain.gain.setTargetAtTime(0, AC.currentTime, 0.15); const s = src; setTimeout(() => { try { s.stop(); } catch (e) { } }, 600); } catch (e) { }
    src = null; gain = null;
  }
  function claps() {
    for (let i = 0; i < 3; i++) noise(0.05, { f: 2200, q: 1.5, vol: 0.05, delay: i * 0.32 });
    for (let i = 0; i < 2; i++) noise(0.05, { f: 2200, q: 1.5, vol: 0.05, delay: 1.1 + i * 0.16 });
  }

  /* ---------- uppdatering ---------- */
  function update(dt, st) {
    hype[0] = Math.max(0, hype[0] - dt * 0.22); hype[1] = Math.max(0, hype[1] - dt * 0.22);
    const near = st ? Math.max(0, Math.min(1, (Math.abs(st.ball.x) - (F.FX - 280)) / 240)) : 0;
    tension += (near - tension) * Math.min(1, dt * 1.5);
    if (!SND.sound) { soundOff(); return; }
    soundOn();
    if (gain && AC) gain.gain.setTargetAtTime(0.05 + tension * 0.1 + Math.max(hype[0], hype[1]) * 0.35, AC.currentTime, 0.25);
    if ((clapT -= dt) <= 0) { clapT = 9 + Math.random() * 10; if (tension < 0.3 && Math.max(...hype) < 0.2) claps(); }
  }
  function goal(team) { hype[team] = 1; tension = 1; }
  function ooh() { noise(0.9, { type: 'bandpass', f: 380, q: 1.2, vol: 0.18 }); tension = Math.min(1, tension + 0.5); }

  /* ---------- ritning (i planens koordinater) ---------- */
  function draw(ctx, t, view, names) {
    // läktare
    ctx.fillStyle = '#4A4466';
    ctx.fillRect(-W0, -H0, 2 * W0, H0 - F.OY - S0 + 4);
    ctx.fillRect(-W0, F.OY + S0 - 4, 2 * W0, H0 - F.OY - S0 + 4);
    ctx.fillRect(-W0, -H0, W0 - F.OX - S0 + 4, 2 * H0);
    ctx.fillRect(F.OX + S0 - 4, -H0, W0 - F.OX - S0 + 4, 2 * H0);
    ctx.strokeStyle = '#ffffff14'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let r = 0; r <= ROWS; r++) {
      const o = S0 + 2 + r * ROW;
      ctx.moveTo(-W0, -(F.OY + o)); ctx.lineTo(W0, -(F.OY + o));
      ctx.moveTo(-W0, F.OY + o); ctx.lineTo(W0, F.OY + o);
      ctx.moveTo(-(F.OX + o), -H0); ctx.lineTo(-(F.OX + o), H0);
      ctx.moveTo(F.OX + o, -H0); ctx.lineTo(F.OX + o, H0);
    }
    ctx.stroke();
    // reklamskyltar
    const ads = ['BUCINCA', ...names, '⚽ FOTBOLL', 'HEJA!'];
    const cols = ['#FFD23F', '#FF6FAE', '#34C759', '#8B7BFF', '#FF8A3D', '#3B9DFF'];
    ctx.font = '700 11px Fredoka, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const board = (x, y, w, h, i, rot) => {
      ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); if (rot) ctx.rotate(rot);
      ctx.fillStyle = '#fff'; ctx.fillText(ads[i % ads.length], 0, 0.5); ctx.restore();
    };
    const BW = 120, BH = 13;
    let k = 0;
    for (let x = -F.OX - 20; x < F.OX + 20; x += BW, k++) { board(x, -(F.OY + AD), BW - 2, BH, k); board(x, F.OY + AD - BH, BW - 2, BH, k + 3, Math.PI); }
    for (let y = -F.OY - 10; y < F.OY + 10; y += BW, k++) { board(-(F.OX + AD), y, BH, BW - 2, k, -Math.PI / 2); board(F.OX + AD - BH, y, BH, BW - 2, k + 2, Math.PI / 2); }

    // folket – ritas i klumpar per färg (snabbt även på äldre telefoner)
    const x0 = view.cx - view.hx - 30, x1 = view.cx + view.hx + 30, y0 = view.cy - view.hy - 30, y1 = view.cy + view.hy + 30;
    const vis = [];
    for (const p of ppl) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      const h = hype[p.team];
      const amp = 0.25 + tension * 0.35 + h * 1.1;
      const j = Math.max(0, Math.sin(t * p.sp * (1 + h) + p.ph)) * amp;
      vis.push({ p, k: 1 + j * 0.18, up: h > 0.25 || (tension > 0.65 && p.arm), h });
    }
    const batch = (color, fn) => { ctx.fillStyle = color; ctx.beginPath(); fn(); ctx.fill(); };
    const circ = (x, y, r) => { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 6.2832); };
    // skuggor
    batch('#00000030', () => { for (const v of vis) circ(v.p.x + 2, v.p.y + 3, 7 * v.k); });
    // flaggor
    for (const v of vis) if (v.p.flag && (v.h > 0.1 || tension > 0.3)) {
      const p = v.p, w = Math.sin(t * 8 + p.ph) * 4;
      ctx.fillStyle = TC[p.team];
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 16, p.y - 10 + w); ctx.lineTo(p.x + 18, p.y + 2 + w); ctx.closePath(); ctx.fill();
    }
    for (const tm of [0, 1]) {
      batch(TC[tm], () => { for (const v of vis) if (v.p.team === tm) circ(v.p.x, v.p.y, 7 * v.k); });
      // händer i luften
      batch(SKIN[1], () => { for (const v of vis) if (v.p.team === tm && v.up) { const s = 7.5 * v.k; circ(v.p.x - s, v.p.y - 2, 2.4); circ(v.p.x + s, v.p.y - 2, 2.4); } });
      batch(TD[tm], () => { for (const v of vis) if (v.p.team === tm && v.p.scarf) { ctx.rect(v.p.x - 6 * v.k, v.p.y - 1.5, 12 * v.k, 3); } });
    }
    for (let s = 0; s < SKIN.length; s++) batch(SKIN[s], () => { for (const v of vis) if (v.p.skin === s) circ(v.p.x, v.p.y, 4.2 * v.k); });
    for (let hc = 0; hc < HAIR.length; hc++) batch(HAIR[hc], () => { for (const v of vis) if (v.p.hair === hc && !v.p.cap) { ctx.moveTo(v.p.x, v.p.y); ctx.arc(v.p.x, v.p.y, 4.3 * v.k, Math.PI * 1.05, Math.PI * 1.95); } });
    for (const tm of [0, 1]) batch(TD[tm], () => { for (const v of vis) if (v.p.team === tm && v.p.cap) circ(v.p.x, v.p.y - 0.5, 4.4 * v.k); });
    // blixtar från kameror när det är spännande
    if (tension > 0.5 || Math.max(...hype) > 0.3) {
      ctx.fillStyle = '#ffffffcc';
      for (let i = 0; i < 4; i++) {
        const p = ppl[(Math.random() * ppl.length) | 0];
        if (Math.random() < 0.3 && p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) { ctx.beginPath(); ctx.arc(p.x, p.y, 3 + Math.random() * 3, 0, 6.3); ctx.fill(); }
      }
    }
  }
  return { update, draw, goal, ooh, soundOff, W0, H0 };
})();
