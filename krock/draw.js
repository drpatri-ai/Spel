/* Bucinca Krockarenan – ritning av bilar, arena och effekter.
   Allt ritas i meter med y uppåt; anroparen sätter en transform som vänder y. */
'use strict';
const KDRAW = (() => {
  const TAU = Math.PI * 2;

  /* läge i vila (för garaget) */
  function restFrame(g) {
    const yC = -Math.min(...g.wheels.map(w => w.ay - w.r)) + 0.02;
    const a = [0, yC, 0, g.hpMax];
    for (const w of g.wheels) a.push(w.ax, yC + w.ay, 0);
    for (const p of g.parts) {
      const k = KSIM.stKind(p.id);
      if (k === 'ang') a.push(p.id === 'hammare' ? p.rest : 0);
      else if (k === 'on') a.push(0);
      else if (k === 'beam') a.push(0, 0, 0);
    }
    return a;
  }
  /* läs ut ett billäge ur en repris-rad */
  function parse(g, f) {
    const o = { x: f[0], y: f[1], a: f[2], hp: f[3], wheels: [], ps: [] };
    let k = 4;
    for (let i = 0; i < g.wheels.length; i++) { o.wheels.push({ x: f[k], y: f[k + 1], th: f[k + 2] }); k += 3; }
    for (const p of g.parts) {
      const kd = KSIM.stKind(p.id);
      if (kd === 'ang') o.ps.push({ ang: f[k++] });
      else if (kd === 'on') o.ps.push({ on: f[k++] });
      else if (kd === 'beam') { o.ps.push({ on: f[k], bx: f[k + 1], by: f[k + 2] }); k += 3; }
      else o.ps.push({});
    }
    return o;
  }
  function lerpCar(g, A, B, t) {
    if (!B || t <= 0) return parse(g, A);
    const a = parse(g, A), b = parse(g, B), L = (u, v) => u + (v - u) * t;
    let da = b.a - a.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    return { x: L(a.x, b.x), y: L(a.y, b.y), a: a.a + da * t, hp: L(a.hp, b.hp),
      wheels: a.wheels.map((w, i) => ({ x: L(w.x, b.wheels[i].x), y: L(w.y, b.wheels[i].y), th: L(w.th, b.wheels[i].th) })),
      ps: a.ps.map((p, i) => Object.assign({}, b.ps[i], p.ang != null ? { ang: L(p.ang, b.ps[i].ang) } : {})) };
  }

  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  };

  /* ---------- en bil ---------- */
  function car(ctx, g, s, dir, face, col, t, opts = {}) {
    const L = g.L, H = g.H, c1 = col.c, c2 = col.d;
    // hjul (världskoordinater) – stötdämpare först
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.scale(dir, 1);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.07;
    g.wheels.forEach((w, i) => {
      const W = s.wheels[i];
      // hjulets läge i bilens koordinater
      const ca = Math.cos(s.a), sa = Math.sin(s.a), dx = W.x - s.x, dy = W.y - s.y;
      const lx = (dx * ca + dy * sa) * dir, ly = -dx * sa + dy * ca;
      ctx.beginPath(); ctx.moveTo(w.ax, -H / 2 + 0.05); ctx.lineTo(lx, ly); ctx.stroke();
    });
    ctx.restore();
    g.wheels.forEach((w, i) => wheel(ctx, s.wheels[i], w.r, g.fb.w));
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a); ctx.scale(dir, 1);
    // vapen bakom karossen
    const BEHIND = ['hammare', 'raket', 'laser', 'eld', 'kanon', 'magnet'];
    g.parts.forEach((p, i) => { if (BEHIND.includes(p.id)) weapon(ctx, g, p, s.ps[i], t, dir); });
    // kaross
    const grd = ctx.createLinearGradient(0, H / 2, 0, -H / 2);
    grd.addColorStop(0, shade(c1, 0.25)); grd.addColorStop(1, shade(c1, -0.15));
    ctx.fillStyle = grd; ctx.strokeStyle = c2; ctx.lineWidth = 0.06; ctx.lineJoin = 'round';
    const id = g.fb.c;
    ctx.beginPath();
    if (g.wedge) { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.lineTo(L / 2 - 0.05, -H / 2 + 0.12); ctx.lineTo(-L * 0.05, H / 2); ctx.lineTo(-L / 2, H / 2); ctx.closePath(); }
    else if (id === 'pickup') { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.lineTo(L / 2, H * 0.1); ctx.lineTo(L * 0.18, H * 0.12); ctx.lineTo(L * 0.1, H / 2); ctx.lineTo(-L * 0.18, H / 2); ctx.lineTo(-L * 0.22, H * 0.1); ctx.lineTo(-L / 2, H * 0.1); ctx.closePath(); }
    else if (id === 'snabb') { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.quadraticCurveTo(L / 2, H * 0.05, L * 0.2, H * 0.25); ctx.quadraticCurveTo(0, H / 2, -L * 0.2, H / 2); ctx.lineTo(-L / 2, H * 0.35); ctx.closePath(); }
    else if (id === 'buggy') { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.lineTo(L / 2 - 0.15, H * 0.2); ctx.lineTo(-L / 2 + 0.1, H * 0.2); ctx.closePath(); }
    else if (id === 'soffa') { rr(ctx, -L / 2, -H / 2, L, H * 0.55, 0.14); ctx.fill(); ctx.stroke(); ctx.beginPath(); rr(ctx, -L / 2, -H / 2, 0.32, H, 0.14); ctx.fill(); ctx.stroke(); ctx.beginPath(); rr(ctx, L / 2 - 0.32, -H / 2, 0.32, H * 0.85, 0.14); ctx.fill(); ctx.stroke(); ctx.beginPath(); rr(ctx, -L / 2 + 0.2, -H / 2 + 0.1, L * 0.6, H * 0.95, 0.12); }
    else if (id === 'glass') { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.lineTo(L / 2, H * 0.05); ctx.lineTo(L * 0.3, H * 0.15); ctx.lineTo(L * 0.25, H / 2); ctx.lineTo(-L / 2, H / 2); ctx.closePath(); }
    else if (id === 'monster') { ctx.moveTo(-L / 2, -H / 2); ctx.lineTo(L / 2, -H / 2); ctx.lineTo(L / 2, H * 0.1); ctx.lineTo(L * 0.2, H * 0.12); ctx.lineTo(L * 0.1, H / 2); ctx.lineTo(-L * 0.25, H / 2); ctx.lineTo(-L * 0.3, H * 0.1); ctx.lineTo(-L / 2, H * 0.1); ctx.closePath(); }
    else if (id === 'buss') { rr(ctx, -L / 2, -H / 2, L, H, 0.2); }
    else { rr(ctx, -L / 2, -H / 2, L, H, id === 'tank' ? 0.12 : 0.1); }
    ctx.fill(); ctx.stroke();
    // detaljer
    ctx.fillStyle = shade(c1, -0.3);
    ctx.fillRect(-L / 2 + 0.08, -H * 0.12, L - 0.16, 0.08);
    ctx.fillStyle = '#ffffff55';
    for (const fx of [-0.4, -0.15, 0.15, 0.4]) { ctx.beginPath(); ctx.arc(fx * L, -H * 0.32, 0.035, 0, TAU); ctx.fill(); }
    if (id === 'snabb') { ctx.fillStyle = c2; ctx.fillRect(-L / 2 - 0.05, H * 0.35, 0.35, 0.08); ctx.fillRect(-L / 2 + 0.05, H * 0.2, 0.06, 0.16); }
    if (id === 'tank') { ctx.fillStyle = '#333'; rr(ctx, -L / 2 - 0.05, -H / 2 - 0.12, L + 0.1, 0.18, 0.08); ctx.fill(); }
    if (id === 'buggy') { ctx.strokeStyle = '#333'; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.moveTo(-L * 0.3, H * 0.2); ctx.lineTo(-L * 0.2, H * 1.3); ctx.lineTo(L * 0.12, H * 1.3); ctx.lineTo(L * 0.22, H * 0.2); ctx.stroke(); }
    if (id === 'glass') { ctx.fillStyle = '#fff'; ctx.fillRect(-L / 2 + 0.1, -H * 0.05, L * 0.55, H * 0.35); ctx.fillStyle = '#FF6FAE'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-L / 2 + 0.25 + k * 0.38, -H * 0.05, 0.12, Math.PI, 0); ctx.fill(); }
      ctx.fillStyle = '#F5D7A1'; ctx.beginPath(); ctx.moveTo(-L * 0.18, H / 2); ctx.lineTo(-L * 0.08, H / 2 + 0.45); ctx.lineTo(L * 0.02, H / 2); ctx.fill(); ctx.fillStyle = '#FFB3D9'; ctx.beginPath(); ctx.arc(-L * 0.08, H / 2 + 0.47, 0.17, 0, TAU); ctx.fill(); }
    if (id === 'buss') { ctx.fillStyle = '#BFE6FF'; for (let k = 0; k < 4; k++) rr(ctx, -L / 2 + 0.25 + k * 0.62, H * 0.08, 0.45, H * 0.32, 0.06), ctx.fill(); ctx.fillStyle = '#2B2350'; ctx.fillRect(-L / 2, -H * 0.12, L, 0.07); }
    if (id === 'soffa') { ctx.fillStyle = shade(c1, 0.35); for (let k = 0; k < 2; k++) { rr(ctx, -L / 2 + 0.38 + k * (L * 0.3), -H / 2 + 0.28, L * 0.28, 0.2, 0.08); ctx.fill(); } }
    if (id === 'lada') { ctx.strokeStyle = shade(c1, -0.35); ctx.lineWidth = 0.03; ctx.strokeRect(-L / 2 + 0.12, -H / 2 + 0.12, L - 0.24, H - 0.24); }
    // förarhytt med ansiktet
    const fr = Math.min(H * 0.34, 0.34);
    const fx = id === 'pickup' || id === 'monster' ? -L * 0.04 : id === 'glass' ? L * 0.32 : id === 'buss' ? L * 0.36 : id === 'buggy' ? -L * 0.05 : -L * 0.08;
    const fy = g.wedge ? H * 0.05 : id === 'pickup' || id === 'monster' ? H * 0.28 : id === 'buggy' ? H * 0.7 : id === 'soffa' ? H * 0.3 : H * 0.12;
    ctx.fillStyle = '#BFE6FF'; ctx.strokeStyle = c2; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.arc(fx, fy, fr + 0.04, 0, TAU); ctx.fill(); ctx.stroke();
    if (face && face.complete && face.naturalWidth) {
      ctx.save(); ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.clip();
      ctx.translate(fx, fy); ctx.scale(dir, -1);   // bilden rättvänd och mot motståndaren
      ctx.drawImage(face, -fr, -fr, fr * 2, fr * 2); ctx.restore();
    }
    ctx.fillStyle = '#ffffff70'; ctx.beginPath(); ctx.ellipse(fx - fr * 0.35, fy + fr * 0.45, fr * 0.35, fr * 0.15, -0.5, 0, TAU); ctx.fill();
    // vapen framför karossen
    g.parts.forEach((p, i) => { if (!BEHIND.includes(p.id)) weapon(ctx, g, p, s.ps[i], t, dir); });
    // skador: rök och sprickor när livet är lågt
    const f = s.hp / g.hpMax;
    if (f < 0.5) { ctx.strokeStyle = '#2B235099'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-L * 0.3, H * 0.3); ctx.lineTo(-L * 0.15, 0); ctx.lineTo(-L * 0.22, -H * 0.2); ctx.moveTo(L * 0.25, H * 0.25); ctx.lineTo(L * 0.1, -H * 0.05); ctx.stroke(); }
    ctx.restore();
    // laserstrålar i världen
    g.parts.forEach((p, i) => {
      const st = s.ps[i];
      if (p.id === 'eld' && st.on && !opts.still) {
        const ca = Math.cos(s.a), sa = Math.sin(s.a), lx = (p.ox + 0.3) * dir, ly = p.oy;
        const ox = s.x + lx * ca - ly * sa, oy = s.y + lx * sa + ly * ca;
        for (let k = 0; k < 14; k++) {
          const f = ((t * 3 + k / 14) % 1), x = ox + (st.bx - ox) * f, y = oy + (st.by - oy) * f + Math.sin(k * 7 + t * 20) * 0.08 * f;
          ctx.fillStyle = f < 0.4 ? '#FFE45Ccc' : f < 0.75 ? '#FF8A3Dcc' : '#FF4D6D99';
          ctx.beginPath(); ctx.arc(x, y, 0.08 + f * 0.25, 0, TAU); ctx.fill();
        }
      }
      if (p.id === 'laser' && st.on && !opts.still) {
        const ca = Math.cos(s.a), sa = Math.sin(s.a), lx = (p.ox + 0.3) * dir, ly = p.oy;
        const ox = s.x + lx * ca - ly * sa, oy = s.y + lx * sa + ly * ca;
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = '#FF2D55aa'; ctx.lineWidth = 0.18 + Math.sin(t * 40) * 0.03; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(st.bx, st.by); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.05; ctx.stroke();
        ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(st.bx, st.by, 0.12 + Math.random() * 0.08, 0, TAU); ctx.fill();
        ctx.restore();
      }
    });
  }

  function wheel(ctx, W, r, type) {
    if (type === 'studs') {
      ctx.save(); ctx.translate(W.x, W.y); ctx.rotate(W.th);
      ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(W.x, W.y); ctx.rotate(W.th);
    ctx.fillStyle = '#26232F'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    if (type === 'monster') { ctx.fillStyle = '#3A3645'; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * TAU / 10); ctx.fillRect(r - 0.08, -0.05, 0.1, 0.1); ctx.restore(); } }
    if (type === 'tagg') { ctx.fillStyle = '#9AA0AA'; for (let i = 0; i < 10; i++) { ctx.save(); ctx.rotate(i * TAU / 10); ctx.beginPath(); ctx.moveTo(r - 0.02, -0.04); ctx.lineTo(r + 0.09, 0); ctx.lineTo(r - 0.02, 0.04); ctx.fill(); ctx.restore(); } }
    if (type === 'kugg') { ctx.fillStyle = '#26232F'; for (let i = 0; i < 12; i++) { ctx.save(); ctx.rotate(i * TAU / 12); ctx.fillRect(r - 0.04, -0.045, 0.1, 0.09); ctx.restore(); } }
    ctx.fillStyle = type === 'racing' || type === 'guld' ? '#FFD23F' : type === 'kugg' ? '#8E96A6' : '#B9BDC7'; ctx.beginPath(); ctx.arc(0, 0, r * (type === 'guld' ? 0.68 : 0.55), 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6E7380'; ctx.lineWidth = 0.035;
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 5) * r * 0.52, Math.sin(i * TAU / 5) * r * 0.52); ctx.stroke(); }
    ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function weapon(ctx, g, p, st, t, dir) {
    const steel = '#C9CED8', dark = '#5B606B';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (p.id === 'sag') {
      ctx.strokeStyle = dark; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(p.mx, p.my); ctx.lineTo(p.cx, p.cy); ctx.stroke();
      ctx.save(); ctx.translate(p.cx, p.cy); ctx.rotate(-t * 22);
      ctx.fillStyle = steel; ctx.beginPath();
      const n = 14;
      for (let i = 0; i < n; i++) { const a = i * TAU / n; ctx.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r); ctx.lineTo(Math.cos(a + TAU / n * 0.5) * p.r * 0.82, Math.sin(a + TAU / n * 0.5) * p.r * 0.82); }
      ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8A909C'; ctx.lineWidth = 0.025; ctx.stroke();
      ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(0, 0, p.r * 0.32, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-0.02, -p.r * 0.3, 0.04, p.r * 0.6);
      ctx.restore();
    } else if (p.id === 'lans') {
      const sx = p.sx, x0 = p.mx, x1 = p.tx;
      ctx.fillStyle = '#E8B530'; ctx.strokeStyle = '#A07A12'; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(x0, p.my + 0.06); ctx.lineTo(x1 - sx * 0.3, p.my + 0.06); ctx.lineTo(x1, p.my); ctx.lineTo(x1 - sx * 0.3, p.my - 0.06); ctx.lineTo(x0, p.my - 0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; ctx.fillRect(Math.min(x0, x0 + sx * 0.2), p.my - 0.12, 0.2, 0.24);
    } else if (p.id === 'hammare') {
      const a = st.ang != null ? st.ang : p.rest;
      const hx = p.px + Math.cos(a) * p.len, hy = p.py + Math.sin(a) * p.len;
      ctx.strokeStyle = '#8B5A2B'; ctx.lineWidth = 0.09; ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(p.px, p.py, 0.1, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a);
      ctx.fillStyle = '#7A808C'; rr(ctx, -0.14, -0.26, 0.28, 0.52, 0.06); ctx.fill();
      ctx.fillStyle = '#9EA4AF'; ctx.fillRect(-0.14, -0.26, 0.28, 0.1);
      ctx.restore();
    } else if (p.id === 'raket') {
      ctx.fillStyle = dark; ctx.fillRect(p.ox - 0.1, p.oy - 0.22, 0.12, 0.22);
      ctx.fillStyle = '#4B7A3A'; rr(ctx, p.ox - 0.25, p.oy - 0.09, 0.62, 0.2, 0.06); ctx.fill();
      ctx.fillStyle = '#2E4F23'; ctx.fillRect(p.ox + 0.3, p.oy - 0.08, 0.08, 0.18);
      if (st.on) { ctx.fillStyle = '#FFD23F'; ctx.beginPath(); ctx.arc(p.ox + 0.48, p.oy + 0.01, 0.13, 0, TAU); ctx.fill(); }
    } else if (p.id === 'laser') {
      ctx.fillStyle = dark; ctx.fillRect(p.ox - 0.08, p.oy - 0.2, 0.1, 0.2);
      ctx.fillStyle = '#E3E6EC'; rr(ctx, p.ox - 0.2, p.oy - 0.08, 0.5, 0.16, 0.06); ctx.fill();
      ctx.fillStyle = st.on ? '#FF2D55' : '#7A2235'; ctx.beginPath(); ctx.arc(p.ox + 0.3, p.oy, 0.07, 0, TAU); ctx.fill();
    } else if (p.id === 'boost') {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(p.mx, p.my + 0.12); ctx.lineTo(p.mx - 0.3, p.my + 0.17); ctx.lineTo(p.mx - 0.3, p.my - 0.17); ctx.lineTo(p.mx, p.my - 0.12); ctx.closePath(); ctx.fill();
      if (st.on) {
        const L = 0.6 + Math.random() * 0.4;
        ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.moveTo(p.mx - 0.3, p.my + 0.15); ctx.lineTo(p.mx - 0.3 - L, p.my); ctx.lineTo(p.mx - 0.3, p.my - 0.15); ctx.fill();
        ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.moveTo(p.mx - 0.3, p.my + 0.08); ctx.lineTo(p.mx - 0.3 - L * 0.6, p.my); ctx.lineTo(p.mx - 0.3, p.my - 0.08); ctx.fill();
      }
    } else if (p.id === 'lyft') {
      const a = st.ang || 0;
      ctx.save(); ctx.translate(p.px, p.py); ctx.rotate(a);
      ctx.fillStyle = '#E8B530'; ctx.strokeStyle = '#A07A12'; ctx.lineWidth = 0.025;
      ctx.beginPath(); ctx.moveTo(0, 0.06); ctx.lineTo(p.len, 0.02); ctx.lineTo(p.len, -0.04); ctx.lineTo(0, -0.06); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(p.px, p.py, 0.07, 0, TAU); ctx.fill();
    } else if (p.id === 'borr') {
      const sx = p.sx, x0 = p.mx;
      ctx.fillStyle = dark; ctx.fillRect(Math.min(x0, x0 + sx * 0.2), p.my - 0.18, 0.2, 0.36);
      ctx.fillStyle = '#9AA0AA'; ctx.beginPath(); ctx.moveTo(x0 + sx * 0.18, p.my + 0.22); ctx.lineTo(x0 + sx * p.len, p.my); ctx.lineTo(x0 + sx * 0.18, p.my - 0.22); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5B606B'; ctx.lineWidth = 0.03;
      for (let k = 0; k < 5; k++) { const f = ((k / 5 + t * 3) % 1); const x = x0 + sx * (0.2 + f * (p.len - 0.2)), h = 0.22 * (1 - f); ctx.beginPath(); ctx.moveTo(x - sx * 0.08, p.my + h); ctx.lineTo(x + sx * 0.08, p.my - h); ctx.stroke(); }
    } else if (p.id === 'kedja') {
      const z = p.zone;
      ctx.save(); ctx.translate(z.cx, z.cy); ctx.rotate(z.ang || 0);
      ctx.fillStyle = '#E5484D'; rr(ctx, -z.hx - 0.1, -0.14, 0.32, 0.28, 0.06); ctx.fill();
      ctx.fillStyle = '#C9CED8'; rr(ctx, -z.hx + 0.15, -z.hy, z.hx * 2 - 0.1, z.hy * 2, z.hy); ctx.fill();
      ctx.fillStyle = '#5B606B';
      for (let k = 0; k < 9; k++) { const f = ((k / 9 + t * 4) % 1); ctx.fillRect(-z.hx + 0.15 + f * (z.hx * 2 - 0.15), z.hy - 0.02, 0.06, 0.05); ctx.fillRect(-z.hx + 0.15 + (1 - f) * (z.hx * 2 - 0.15), -z.hy - 0.03, 0.06, 0.05); }
      ctx.restore();
    } else if (p.id === 'eld') {
      ctx.fillStyle = dark; ctx.fillRect(p.ox - 0.08, p.oy - 0.22, 0.1, 0.22);
      ctx.fillStyle = '#E5484D'; rr(ctx, p.ox - 0.22, p.oy - 0.1, 0.36, 0.2, 0.08); ctx.fill();
      ctx.fillStyle = '#5B606B'; ctx.fillRect(p.ox + 0.12, p.oy - 0.05, 0.2, 0.1);
      ctx.fillStyle = st.on ? '#FFD23F' : '#FF8A3D'; ctx.beginPath(); ctx.arc(p.ox + 0.32, p.oy, 0.05, 0, TAU); ctx.fill();
    } else if (p.id === 'kanon') {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(p.ox - 0.05, p.oy - 0.08, 0.2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3A3645'; rr(ctx, p.ox - 0.15, p.oy - 0.12, 0.75 - (st.on ? 0.12 : 0), 0.24, 0.1); ctx.fill();
      ctx.fillStyle = '#5B606B'; ctx.fillRect(p.ox + 0.48 - (st.on ? 0.12 : 0), p.oy - 0.15, 0.1, 0.3);
      if (st.on) { ctx.fillStyle = '#FFE45C'; ctx.beginPath(); ctx.arc(p.ox + 0.72, p.oy, 0.2, 0, TAU); ctx.fill(); }
    } else if (p.id === 'magnet') {
      ctx.fillStyle = dark; ctx.fillRect(p.ox - 0.05, p.oy - 0.3, 0.1, 0.3);
      ctx.lineWidth = 0.14; ctx.lineCap = 'butt';
      ctx.strokeStyle = '#E5484D'; ctx.beginPath(); ctx.arc(p.ox + 0.05, p.oy + 0.08, 0.22, Math.PI * 0.5, Math.PI * 1.5, true); ctx.stroke();
      ctx.strokeStyle = '#C9CED8'; ctx.beginPath(); ctx.moveTo(p.ox + 0.05, p.oy + 0.3); ctx.lineTo(p.ox + 0.22, p.oy + 0.3); ctx.moveTo(p.ox + 0.05, p.oy - 0.14); ctx.lineTo(p.ox + 0.22, p.oy - 0.14); ctx.stroke();
      if (st.on) { ctx.strokeStyle = '#3B9DFF88'; ctx.lineWidth = 0.04; for (let k = 0; k < 3; k++) { const f = (t * 1.5 + k / 3) % 1; ctx.beginPath(); ctx.arc(p.ox + 0.25, p.oy + 0.08, 0.2 + f * 1.4, -0.6, 0.6); ctx.stroke(); } }
    } else if (p.id === 'taggar') {
      for (const s of p.solid) {
        ctx.fillStyle = '#6E7380'; rr(ctx, s.cx - s.hx, s.cy - s.hy, s.hx * 2, s.hy * 2, 0.04); ctx.fill();
        ctx.fillStyle = '#C9CED8';
        const n = 5, ex = s.cx + p.sx * s.hx;
        for (let k = 0; k < n; k++) { const y = s.cy - s.hy + (k + 0.5) * s.hy * 2 / n; ctx.beginPath(); ctx.moveTo(ex, y - 0.07); ctx.lineTo(ex + p.sx * 0.2, y); ctx.lineTo(ex, y + 0.07); ctx.fill(); }
      }
    } else if (p.id === 'boxare') {
      const e = st.ang || 0, gx = p.px + p.sx * (0.3 + e * 1.3);
      ctx.strokeStyle = '#8E96A6'; ctx.lineWidth = 0.05; ctx.beginPath();
      const n = 6; for (let k = 0; k <= n; k++) { const x = p.px + p.sx * (0.05 + (gx - p.sx * 0.15 - p.px - p.sx * 0.05) * p.sx * k / n * p.sx); ctx.lineTo(x, p.py + (k % 2 ? 0.1 : -0.1)); } ctx.stroke();
      ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.arc(gx, p.py, p.gr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#C9304D'; ctx.beginPath(); ctx.arc(gx - p.sx * 0.05, p.py + 0.16, 0.11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(gx - p.sx * 0.28 - 0.04, p.py - 0.14, 0.08, 0.28);
    } else if (p.id === 'skold') {
      for (const s of p.solid) {
        ctx.fillStyle = '#8E96A6'; ctx.strokeStyle = '#596173'; ctx.lineWidth = 0.03;
        rr(ctx, s.cx - s.hx, s.cy - s.hy, s.hx * 2, s.hy * 2, 0.04); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#C9CED8';
        const n = s.hy > s.hx ? 3 : 4;
        for (let i = 0; i < n; i++) { const fx = s.hy > s.hx ? s.cx : s.cx - s.hx + (i + 0.5) * s.hx * 2 / n, fy = s.hy > s.hx ? s.cy - s.hy + (i + 0.5) * s.hy * 2 / n : s.cy; ctx.beginPath(); ctx.arc(fx, fy, 0.03, 0, TAU); ctx.fill(); }
      }
    }
  }

  function rocket(ctx, r) {
    if (r[3]) { ctx.fillStyle = '#2B2350'; ctx.beginPath(); ctx.arc(r[0], r[1], 0.17, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffffff55'; ctx.beginPath(); ctx.arc(r[0] - 0.05, r[1] + 0.05, 0.06, 0, TAU); ctx.fill(); return; }
    ctx.save(); ctx.translate(r[0], r[1]); ctx.rotate(r[2]);
    ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.moveTo(-0.2, 0.06); ctx.lineTo(-0.5 - Math.random() * 0.2, 0); ctx.lineTo(-0.2, -0.06); ctx.fill();
    ctx.fillStyle = '#E3E6EC'; rr(ctx, -0.22, -0.07, 0.36, 0.14, 0.06); ctx.fill();
    ctx.fillStyle = '#E5484D'; ctx.beginPath(); ctx.moveTo(0.14, 0.07); ctx.lineTo(0.26, 0); ctx.lineTo(0.14, -0.07); ctx.fill();
    ctx.restore();
  }

  /* ---------- arenan (bakgrund i skärmkoordinater + golv/väggar i världen) ---------- */
  let crowd = null;
  function backdrop(ctx, W, H, cam, t, hype) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1B1440'); sky.addColorStop(0.55, '#3A2A6E'); sky.addColorStop(1, '#5B3F8C');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // strålkastare
    for (let i = 0; i < 4; i++) {
      const x = W * (0.12 + i * 0.25) - cam.x * 4 % 40;
      const g = ctx.createRadialGradient(x, H * 0.05, 2, x, H * 0.05, H * 0.6);
      g.addColorStop(0, '#FFF6C055'); g.addColorStop(1, '#FFF6C000');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 8, H * 0.03); ctx.lineTo(x - H * 0.35, H * 0.75); ctx.lineTo(x + H * 0.35, H * 0.75); ctx.lineTo(x + 8, H * 0.03); ctx.fill();
      ctx.fillStyle = '#FFF6C0'; ctx.beginPath(); ctx.arc(x, H * 0.04, 7, 0, TAU); ctx.fill();
    }
    // publik (parallax)
    if (!crowd) { crowd = []; for (let i = 0; i < 260; i++) crowd.push({ x: Math.random(), row: i % 4, c: ['#FF4D6D', '#3B9DFF', '#FFD23F', '#34C759', '#FF8A3D', '#8B7BFF', '#fff'][i % 7], ph: Math.random() * 6 }); }
    const gy = cam.groundY;
    for (const p of crowd) {
      const span = W * 1.6;
      const x = ((p.x * span - cam.x * cam.s * 0.3) % span + span) % span - W * 0.3;
      const y = gy - cam.s * 2.6 - p.row * cam.s * 0.42 - Math.max(0, Math.sin(t * (4 + hype * 6) + p.ph)) * cam.s * (0.05 + hype * 0.18);
      const r = cam.s * 0.16;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(x, y + r * 1.4, r * 1.2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#F2C8A2'; ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU); ctx.fill();
    }
  }
  function arena(ctx, A) {
    // golv
    ctx.fillStyle = '#4A4F5C'; ctx.fillRect(-40, -6, 80, 6);
    ctx.fillStyle = '#5E6474'; ctx.fillRect(-40, -0.25, 80, 0.25);
    ctx.strokeStyle = '#3B404B'; ctx.lineWidth = 0.04;
    for (let x = -40; x <= 40; x += 1.5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, -6); ctx.stroke(); }
    ctx.fillStyle = '#FFD23F55'; ctx.fillRect(-0.06, -0.25, 0.12, 0.25);
    // väggar med varningsränder
    for (const s of [-1, 1]) {
      const x0 = s * A;
      ctx.fillStyle = '#2E3140'; ctx.fillRect(s > 0 ? x0 : x0 - 1.2, 0, 1.2, 2.6);
      ctx.save(); ctx.beginPath(); ctx.rect(s > 0 ? x0 : x0 - 1.2, 1.9, 1.2, 0.5); ctx.clip();
      for (let k = -2; k < 3; k++) { ctx.fillStyle = k % 2 ? '#FFD23F' : '#2B2350'; ctx.beginPath(); const bx = (s > 0 ? x0 : x0 - 1.2) + k * 0.5; ctx.moveTo(bx, 1.9); ctx.lineTo(bx + 0.5, 1.9); ctx.lineTo(bx + 1, 2.4); ctx.lineTo(bx + 0.5, 2.4); ctx.fill(); }
      ctx.restore();
    }
  }

  return { restFrame, parse, lerpCar, car, wheel, rocket, backdrop, arena, shade };
})();
