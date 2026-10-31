/* Bucinca Paf! – fysik, värld och ritning på canvas.
   Världen mäts i meter: x åt höger, y uppåt, marken ligger på y = 0. */
(function (g) {
  'use strict';
  const STEP = 1 / 120;
  const R = 0.85;              // figurens "radie" (halva höjden ungefär)
  const FIG_H = 1.9;           // figurens ritade höjd i meter
  const PIVOT = { x: -1.6, y: 2.25 }, ARM = 1.6; // kängans fäste och arm

  let cv, ctx, W = 1, H = 1, DPR = 1, hooks = {};
  let st = null, raf = 0, lastT = 0, acc = 0;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = cv.clientWidth || 1; H = cv.clientHeight || 1;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  /* ---------------- figurens rigg (lösa leder) ---------------- */
  // rig = { neck, hip, legAmp } som andelar av bildens höjd
  function buildRig(img, cfg) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const neckY = Math.round(cfg.neck * ih), hipY = Math.round(cfg.hip * ih), ov = Math.round(ih * 0.035);
    // var går gränsen mellan benen? tyngdpunkten i nedre delen av bilden
    const probe = document.createElement('canvas'); probe.width = iw; probe.height = ih - hipY;
    const pc = probe.getContext('2d'); pc.drawImage(img, 0, hipY, iw, ih - hipY, 0, 0, iw, ih - hipY);
    let sum = 0, sx = 0;
    try {
      const d = pc.getImageData(0, 0, iw, ih - hipY).data;
      for (let y = 0; y < ih - hipY; y += 3) for (let x = 0; x < iw; x += 2) { const a = d[(y * iw + x) * 4 + 3]; if (a > 60) { sum += a; sx += a * x; } }
    } catch (e) { }
    const cx = sum ? sx / sum : iw / 2;
    const part = (x, y, w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return { c, x, y }; };
    const cxi = Math.round(cx);
    return {
      iw, ih, neckY, hipY, cx,
      head: part(0, 0, iw, neckY + ov),
      torso: part(0, neckY, iw, hipY + ov - neckY),
      legL: part(0, hipY - ov, cxi + 2, ih - hipY + ov),
      legR: part(cxi - 2, hipY - ov, iw - cxi + 2, ih - hipY + ov),
      legAmp: cfg.legAmp || 1
    };
  }
  function newJoints() { return { head: { a: 0, v: 0 }, spine: { a: 0, v: 0 }, legL: { a: 0, v: 0 }, legR: { a: 0, v: 0 }, sq: 0, sqv: 0 }; }
  function updateJoints(dt) {
    const J = st.j, sp = Math.hypot(st.vx, st.vy);
    const dvx = st.vx - (st.pvx || 0), dvy = st.vy - (st.pvy || 0);
    st.pvx = st.vx; st.pvy = st.vy;
    const flying = st.phase === 'fly' && st.y > R + 0.05;
    const amp = (st.rig ? st.rig.legAmp : 1);
    let tL = 0, tR = 0, tS = 0, tH = 0;
    if (st.phase === 'aim') { tL = Math.sin(st.t * 3) * 0.06; tR = -tL; tS = Math.sin(st.t * 2) * 0.04; tH = Math.sin(st.t * 2.4 + 1) * 0.08; }
    else if (flying) {
      const f = 9 + Math.min(6, sp * 0.1), a = Math.min(0.85, 0.35 + sp * 0.012) * amp;
      tL = Math.sin(st.t * f) * a; tR = Math.sin(st.t * f + Math.PI) * a;
      tS = Math.sin(st.t * 6.5) * 0.12 - st.spin * 0.02;
      tH = Math.sin(st.t * 8 + 1) * 0.18 - st.spin * 0.03;
      if (st.thrust && st.fuel > 0) { tL = 0.5 * amp; tR = 0.35 * amp; tS = -0.15; } // raketläge: benen bakåt
    } else if (st.phase === 'fly' || st.phase === 'done') { tL = 0.05; tR = -0.05; tS = 0; tH = 0.05; }
    // stötar från studsar och boostar ger leder en knuff
    const kick = Math.max(-25, Math.min(25, dvy)), push = Math.max(-25, Math.min(25, dvx));
    if (Math.abs(kick) > 2 || Math.abs(push) > 2) {
      J.legL.v += kick * 0.22 + push * 0.1; J.legR.v -= kick * 0.18 - push * 0.1;
      J.head.v -= kick * 0.16; J.spine.v += kick * 0.06 - push * 0.04;
      if (kick > 4) J.sqv -= kick * 0.09;   // tryck ihop vid nedslag
    }
    const spring = (o, t, k, d) => { o.v += ((t - o.a) * k - o.v * d) * dt; o.a += o.v * dt; o.a = Math.max(-1.4, Math.min(1.4, o.a)); };
    spring(J.legL, tL, 70, 7); spring(J.legR, tR, 70, 7);
    spring(J.spine, tS, 90, 9); spring(J.head, tH, 80, 6);
    J.sqv += (-J.sq * 160 - J.sqv * 10) * dt; J.sq += J.sqv * dt; J.sq = Math.max(-0.35, Math.min(0.35, J.sq));
  }

  /* ---------------- start & indata ---------------- */
  function init(canvas, h) {
    cv = canvas; ctx = cv.getContext('2d'); hooks = h || {};
    window.addEventListener('resize', () => { if (st) resize(); });
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
  }

  function start(opts) {
    resize();
    st = {
      o: opts, phase: 'aim', t: 0,
      x: 0, y: R, vx: 0, vy: 0, ang: 0, spin: 0,
      fuel: opts.fuel, fuelMax: opts.fuel, thrust: false,
      coins: 0, maxAlt: 0, maxSpd: 0, settle: 0,
      items: [], genX: 22, parts: [], texts: [],
      cam: { x: 0, s: Math.min(H / 8, W / 6.5), y: 0 },
      swipe: [], aim: null, kickT: 0, armA: -0.55, perfect: false,
      lastRocketSfx: 0, groundHit: 0, done: false,
      j: newJoints(), rig: null
    };
    const img = opts.img;
    const mk = () => { if (st && st.o === opts && !opts.photo && opts.rigCfg && img.naturalWidth) st.rig = buildRig(img, opts.rigCfg); };
    if (img.complete) mk(); else img.addEventListener('load', mk, { once: true });
    for (let i = 0; i < 6; i++) genChunk();
    cancelAnimationFrame(raf);
    lastT = performance.now(); acc = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(raf); st = null; }

  function onDown(e) {
    if (!st) return;
    try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    if (st.phase === 'aim') { st.swipe = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; st.aim = null; }
    else if (st.phase === 'fly') st.thrust = true;
  }
  function onMove(e) {
    if (!st || st.phase !== 'aim' || !st.swipe.length) return;
    st.swipe.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (st.swipe.length > 40) st.swipe.shift();
    st.aim = swipeVector();
  }
  function onUp() {
    if (!st) return;
    if (st.phase === 'fly') { st.thrust = false; return; }
    if (st.phase !== 'aim' || !st.swipe.length) return;
    const v = swipeVector();
    st.swipe = []; st.aim = null;
    if (!v || v.p < 0.1) { hooks.weak && hooks.weak(); return; }
    kick(v);
  }
  // hastighet för de senaste 120 ms av svepet → kraft (0–1) och vinkel
  function swipeVector() {
    const s = st.swipe;
    if (s.length < 2) return null;
    const last = s[s.length - 1];
    let first = s[0];
    for (let i = s.length - 1; i >= 0; i--) { if (last.t - s[i].t > 120) break; first = s[i]; }
    const dt = Math.max(16, last.t - first.t) / 1000;
    let dx = (last.x - first.x) / dt, dy = (last.y - first.y) / dt;
    const len = Math.hypot(dx, dy);
    const p = clamp(len / (Math.min(W, H) * 4.6), 0, 1);
    if (dx < 0) dx = -dx;                       // svep åt vänster räknas som åt höger
    let a = Math.atan2(-dy, dx);
    a = clamp(a, 10 * Math.PI / 180, 80 * Math.PI / 180);
    return { p, a };
  }

  function kick(v) {
    st.phase = 'kick'; st.kickT = 0;
    st.perfect = v.p >= 0.93;
    const speed = st.o.kickSpeed * (0.32 + 0.68 * v.p) * (st.perfect ? 1.1 : 1);
    st.launch = { vx: Math.cos(v.a) * speed, vy: Math.sin(v.a) * speed, p: v.p };
    hooks.phase && hooks.phase('kick');
  }

  /* ---------------- världen ---------------- */
  function genChunk() {
    const x0 = st.genX, len = 40, dens = st.o.density;
    const far = x0 / 100;
    const add = it => st.items.push(it);
    // ballonger
    const nb = Math.floor((0.8 + Math.random() * 1.6) * dens);
    for (let i = 0; i < nb; i++) add({ k: 'balloon', x: x0 + Math.random() * len, y: 4 + Math.random() * (16 + far * 6), r: 0.95, c: ['#FF4D6D', '#FFD23F', '#3B9DFF', '#34C759', '#FF6FAE', '#8B7BFF'][Math.floor(Math.random() * 6)], ph: Math.random() * 6 });
    // fåglar
    if (Math.random() < 0.45 * dens) add({ k: 'bird', x: x0 + Math.random() * len, y: 7 + Math.random() * (22 + far * 8), r: 1, ph: Math.random() * 6, vx: -2.5 - Math.random() * 2 });
    // mynt i en båge
    if (Math.random() < 0.85) {
      const cx = x0 + Math.random() * len, cy = 2 + Math.random() * (12 + far * 4), n = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) add({ k: 'coin', x: cx + i * 1.3, y: cy + Math.sin(i / (n - 1) * Math.PI) * 2.2, r: 0.55, ph: i });
    }
    // raketbränsle
    if (Math.random() < 0.22 * dens) add({ k: 'fuel', x: x0 + Math.random() * len, y: 3 + Math.random() * 18, r: 0.7 });
    // markföremål på var sin plats
    const slots = [0.15, 0.5, 0.85].map(f => x0 + f * len + (Math.random() - .5) * 6);
    slots.forEach(sx => {
      const r = Math.random();
      if (r < 0.26 * dens) add({ k: 'tramp', x: sx, y: 0, w: 3.2 });
      else if (r < 0.26 * dens + 0.14) add({ k: 'boost', x: sx, y: 0, w: 4 });
      else if (r < 0.26 * dens + 0.30) add({ k: 'mud', x: sx, y: 0, w: 5 });
    });
    st.genX += len;
  }
  function groundItemAt(x) {
    for (const it of st.items) if ((it.k === 'tramp' || it.k === 'boost' || it.k === 'mud') && Math.abs(x - it.x) < it.w / 2) return it;
    return null;
  }

  /* ---------------- effekter ---------------- */
  function burst(x, y, n, cols, spd, size, grav) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8);
      st.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.5 + Math.random() * 0.5, c: cols[i % cols.length], r: size * (0.6 + Math.random() * 0.8), g: grav });
    }
  }
  function say(x, y, txt, c) { st.texts.push({ x, y, txt, c: c || '#FFD23F', life: 0 }); }
  const sfx = (n, a) => hooks.sfx && hooks.sfx(n, a);
  const buzz = ms => hooks.buzz && hooks.buzz(ms);

  /* ---------------- fysik ---------------- */
  function step(dt) {
    st.t += dt;
    if (st.phase === 'aim') { st.armA = -0.55 + Math.sin(st.t * 3) * 0.04; return; }
    if (st.phase === 'kick') {
      st.kickT += dt;
      st.armA = -0.55 + (0.75 + 0.55) * clamp(st.kickT / 0.11, 0, 1);
      if (st.kickT >= 0.11) {
        st.vx = st.launch.vx; st.vy = st.launch.vy;
        st.spin = -(3 + st.launch.p * 7);
        st.phase = 'fly';
        say(st.x + 0.2, st.y + 1.6, st.perfect ? 'PERFEKT PAF!' : 'PAF!', st.perfect ? '#FF4D6D' : '#FFD23F');
        burst(st.x - 0.4, st.y, 18, ['#fff', '#FFD23F', '#FF8A3D'], 7, 0.18, 0);
        sfx('kick', st.launch.p); if (st.perfect) setTimeout(() => sfx('perfect'), 120);
        buzz(st.perfect ? 70 : 40);
        hooks.phase && hooks.phase('fly');
      }
      return;
    }
    // kängan fjädrar tillbaka
    st.armA += (-0.55 - st.armA) * Math.min(1, dt * 3);
    if (st.phase !== 'fly') return;

    const o = st.o;
    // raket
    if (st.thrust && st.fuel > 0) {
      const a = 0.5;
      st.vx += Math.cos(a) * 28 * dt; st.vy += Math.sin(a) * 28 * dt + o.grav * 0.35 * dt;
      st.fuel = Math.max(0, st.fuel - dt);
      if (Math.random() < 0.8) st.parts.push({ x: st.x - 0.6, y: st.y - 0.3, vx: -st.vx * 0.3 - 4 - Math.random() * 4, vy: -2 - Math.random() * 3, life: 0, max: 0.35, c: Math.random() < .5 ? '#FFB534' : '#FF4D6D', r: 0.28, g: 0 });
      if (st.t - st.lastRocketSfx > 0.12) { st.lastRocketSfx = st.t; sfx('rocket'); }
    }
    // tyngd och luftmotstånd
    st.vy -= o.grav * dt;
    const sp = Math.hypot(st.vx, st.vy);
    st.vx -= st.vx * sp * o.drag * dt;
    st.vy -= st.vy * sp * o.drag * dt;
    if (sp > 140) { st.vx *= 140 / sp; st.vy *= 140 / sp; }
    st.x += st.vx * dt; st.y += st.vy * dt;
    st.ang += st.spin * dt;

    // marken
    if (st.y <= R) {
      st.y = R;
      const it = groundItemAt(st.x);
      if (it && it.k === 'tramp' && st.vy < 0) {
        st.vy = Math.max(Math.abs(st.vy) * 1.12, 21); st.vx = Math.max(st.vx * 1.05, 6);
        st.spin = -8; it.boing = 0.35;
        say(st.x, st.y + 1.5, 'BOING!', '#3B9DFF'); sfx('boing'); buzz(30);
      } else if (it && it.k === 'boost' && st.vy <= 0.5) {
        st.vx += 15; st.vy = Math.max(Math.abs(st.vy) * o.rest, 9);
        say(st.x, st.y + 1.5, 'ZOOM!', '#FF8A3D'); sfx('zoom'); buzz(30);
        burst(st.x, 0.2, 14, ['#FFD23F', '#FF8A3D'], 6, 0.2, 0);
      } else if (it && it.k === 'mud' && st.vy <= 0.5) {
        if (!st.inMud) { say(st.x, st.y + 1.5, 'PLASK!', '#8B5A2B'); sfx('splash'); buzz(25); burst(st.x, 0.2, 16, ['#8B5A2B', '#A9713A'], 6, 0.22, 18); }
        st.vy = st.inMud ? 0 : Math.abs(st.vy) * 0.12;  // liten plask-studs första gången, sedan stilla
        st.inMud = true;
        st.vx *= 0.35;
        if (st.vx < 0.05) st.vx = 0;
        st.spin = -st.vx / R;
      } else {
        st.inMud = false;
        if (st.vy < 0) {
          const impact = -st.vy;
          st.vy = impact * o.rest;
          st.vx *= 0.83;
          st.spin = -st.vx * 1.1;
          if (impact > 4) {
            burst(st.x, 0.1, Math.min(14, Math.floor(impact)), ['#C98B4F', '#E5B07A', '#7BE07B'], 3 + impact * 0.2, 0.18, 14);
            sfx('bump', impact); buzz(Math.min(40, impact * 2));
          }
        }
        if (st.vy < 1.4) {          // rullar längs marken
          st.vy = 0;
          st.vx -= st.vx * 1.7 * dt + Math.sign(st.vx) * 0.6 * dt;
          if (st.vx < 0) st.vx = 0;
          st.spin = -st.vx / R;
        }
      }
    } else st.inMud = false;

    // föremål i luften
    for (const it of st.items) {
      if (it.k === 'bird') { if (it.flee) it.y += 6 * dt; it.x += it.vx * dt; it.ph += dt * 12; }
      if (it.used || it.k === 'tramp' || it.k === 'boost' || it.k === 'mud') continue;
      if (Math.abs(it.x - st.x) > 3) continue;
      const hitR = Math.max(R, figPx() * 0.38 / st.cam.s);
      if (Math.hypot(it.x - st.x, it.y - st.y) > hitR + Math.max(it.r, 14 / st.cam.s)) continue;
      it.used = true;
      if (it.k === 'balloon') {
        st.vy = Math.max(st.vy, 0) + 15; st.vx += 2;
        say(it.x, it.y + 1, 'POP!', it.c); sfx('pop'); buzz(20);
        burst(it.x, it.y, 14, [it.c, '#fff'], 7, 0.2, 6);
      } else if (it.k === 'bird') {
        st.vx += 9; st.vy = Math.max(st.vy, 0) + 12;
        it.flee = true; it.vx = 6; it.used = true;
        say(it.x, it.y + 1, 'KVACK!', '#fff'); sfx('quack'); buzz(25);
        burst(it.x, it.y, 10, ['#fff', '#FFE7A8'], 4, 0.25, 2);
      } else if (it.k === 'coin') {
        st.coins += o.coinMul; sfx('coin'); burst(it.x, it.y, 5, ['#FFD23F', '#fff'], 3, 0.12, 0);
      } else if (it.k === 'fuel') {
        st.fuel = Math.min(Math.max(st.fuelMax, 1.2), st.fuel + 1.2); st.fuelMax = Math.max(st.fuelMax, 1.2);
        say(it.x, it.y + 1, '+RAKET', '#FF4D6D'); sfx('fuel'); buzz(20);
      }
    }
    for (const it of st.items) if (it.k === 'tramp' && it.boing > 0) it.boing -= dt;

    // städa och skapa ny värld
    if (st.items.length > 300) st.items = st.items.filter(it => it.x > st.x - 80);
    while (st.genX < st.x + 160) genChunk();

    st.maxAlt = Math.max(st.maxAlt, st.y - R);
    st.maxSpd = Math.max(st.maxSpd, sp);

    // stopp?
    if (st.y <= R + 0.05 && Math.abs(st.vy) < 0.6 && Math.abs(st.vx) < 0.35) { st.settle += dt; st.spin *= 0.85; } else st.settle = 0;
    // nödbroms: ligger den på marken och har nästan inte flyttat sig på 4 sekunder är sparken över
    // (räknas bara på marken – aldrig medan figuren är i luften)
    st.flyT = (st.flyT || 0) + dt;
    const onGround = st.y <= R + 0.3 && Math.abs(st.vy) < 2;
    if (!onGround || Math.abs(st.x - (st.lastX || 0)) > 1) { st.lastX = st.x; st.stuckT = 0; } else st.stuckT = (st.stuckT || 0) + dt;
    if (st.stuckT > 4) st.settle = 1;
    // säkerhetsgräns: bara flygtiden räknas (inte tiden man siktade) och bara när figuren är nere vid marken
    if (st.flyT > 600 && st.y < R + 2) st.settle = 1;
    if (!st.done && st.settle > 0.45) {
      st.done = true; st.phase = 'done'; st.thrust = false;
      setTimeout(() => hooks.onEnd && hooks.onEnd({ dist: Math.max(0, Math.round(st.x)), coins: Math.round(st.coins), maxAlt: Math.round(st.maxAlt), maxSpd: Math.round(st.maxSpd * 3.6) }), 650);
    }
  }

  function stepFx(dt) {
    for (const p of st.parts) { p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    st.parts = st.parts.filter(p => p.life < p.max);
    for (const t of st.texts) { t.life += dt; t.y += dt * 1.2; }
    st.texts = st.texts.filter(t => t.life < 1.1);
  }

  /* ---------------- kamera ---------------- */
  function updateCam(dt) {
    const c = st.cam, base = H / 12;
    let ts, tx;
    if (st.phase === 'aim' || st.phase === 'kick') { ts = Math.min(H / 8, W / 6.5); tx = W < H ? -0.6 : 0.6; }
    else {
      const alt = st.y;
      ts = Math.min(base, W / 7, (H * 0.5) / (alt + 3), (W * 0.75) / (Math.abs(st.vx) * 0.55 + 12));
      ts = Math.max(ts, H / 900);
      tx = st.x + clamp(st.vx * 0.12, -2, 6);
    }
    const k = Math.min(1, dt * 3.2);
    c.s += (ts - c.s) * k;
    c.x += (tx - c.x) * Math.min(1, dt * 8);
    const gy = H * (H > W ? 0.8 : 0.84);
    c.gy = gy;
    c.y = Math.max(0, st.y - (gy - H * 0.42) / c.s);
  }
  const SX = x => W * 0.33 + (x - st.cam.x) * st.cam.s;
  const SY = y => st.cam.gy - (y - st.cam.y) * st.cam.s;

  /* ---------------- ritning ---------------- */
  function lerpC(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * t, g2 = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t, b2 = (pa & 255) + ((pb & 255) - (pa & 255)) * t;
    return `rgb(${r | 0},${g2 | 0},${b2 | 0})`;
  }
  function drawSky() {
    const alt = st.cam.y + (H * 0.42) / st.cam.s;
    const t = clamp(alt / 400, 0, 1);
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, lerpC('#5EC2FF', '#141850', t));
    gr.addColorStop(1, lerpC('#D8F3FF', '#5560C8', t));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    if (t > 0.35) {           // stjärnor högt upp
      ctx.fillStyle = `rgba(255,255,255,${(t - 0.35) * 1.4})`;
      for (let i = 0; i < 70; i++) {
        const x = (hash(i) * W * 1.5 - st.cam.x * 0.4 * (1 + hash(i + 3))) % W;
        ctx.beginPath(); ctx.arc(x < 0 ? x + W : x, hash(i + 9) * H, 1 + hash(i + 5) * 1.6, 0, 7); ctx.fill();
      }
    }
    if (t < 0.02) { // sol
      ctx.fillStyle = '#FFF3A0'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, Math.min(W, H) * 0.07, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFE15A'; ctx.beginPath(); ctx.arc(W * 0.82, H * 0.14, Math.min(W, H) * 0.055, 0, 7); ctx.fill();
    }
  }
  function cloud(x, y, s) {
    ctx.fillStyle = '#ffffffd9';
    ctx.beginPath();
    ctx.arc(x, y, s, 0, 7); ctx.arc(x + s * 1.1, y - s * 0.4, s * 1.2, 0, 7); ctx.arc(x + s * 2.3, y, s * 0.95, 0, 7);
    ctx.rect(x, y - s * 0.2, s * 2.3, s * 1.0);
    ctx.fill();
  }
  function drawClouds() {
    const f = 0.55, s = st.cam.s;
    const left = st.cam.x * f - (W * 0.4) / s - 40, right = st.cam.x * f + (W * 0.8) / s + 40;
    for (let k = Math.floor(left / 26); k <= Math.ceil(right / 26); k++) {
      const cx = k * 26 + hash(k) * 18, cy = 8 + hash(k + 7) * 46 + (hash(k + 11) < 0.3 ? 80 * hash(k + 2) : 0);
      const x = W * 0.33 + (cx - st.cam.x * f) * s, y = SY(cy);
      const r = Math.max(10, (1.6 + hash(k + 4) * 1.8) * s);
      if (y < -r * 3 || y > H + r) continue;
      cloud(x, y, r);
    }
  }
  function drawHills(f, amp, col, off) {
    const gy = SY(0);
    if (gy > H + 50) return;
    const s = Math.min(st.cam.s, H / 12) / (H / 12);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let px = 0; px <= W + 10; px += 10) {
      const wx = (px - W * 0.33) / st.cam.s + st.cam.x * f;
      const h = (Math.sin(wx * 0.045 + off) + 0.55 * Math.sin(wx * 0.11 + off * 2) + 1.6) * amp * H * s;
      ctx.lineTo(px, gy - h);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  function drawGround() {
    const gy = SY(0);
    if (gy > H + 5) return;
    ctx.fillStyle = '#C98B4F'; ctx.fillRect(0, gy, W, H - gy);
    ctx.fillStyle = '#5BC85B'; ctx.fillRect(0, gy, W, Math.max(6, 0.5 * st.cam.s));
    ctx.fillStyle = '#7BE07B'; ctx.fillRect(0, gy, W, Math.max(3, 0.18 * st.cam.s));
    // avståndsskyltar
    const s = st.cam.s;
    const stepM = [5, 10, 25, 50, 100, 250, 500, 1000].find(m => m * s >= 110) || 2000;
    const x0 = Math.floor((st.cam.x - (W * 0.4) / s) / stepM) * stepM, x1 = st.cam.x + (W * 0.8) / s;
    ctx.font = `600 ${Math.max(11, Math.min(18, s * 0.5))}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let x = Math.max(stepM, x0); x <= x1; x += stepM) {
      const px = SX(x), ph = Math.max(18, 1.4 * s);
      ctx.fillStyle = '#7A4A26'; ctx.fillRect(px - 2, gy - ph, 4, ph);
      const tw = ctx.measureText(x + ' m').width + 12;
      ctx.fillStyle = '#fff'; roundRect(px - tw / 2, gy - ph - 20, tw, 22, 7); ctx.fill();
      ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2B2350'; ctx.fillText(x + ' m', px, gy - ph - 9);
    }
    // rekordflagga
    const best = st.o.best || 0;
    if (best > 5) {
      const px = SX(best);
      if (px > -40 && px < W + 40) {
        const ph = Math.max(40, 3 * s);
        ctx.fillStyle = '#2B2350'; ctx.fillRect(px - 2, gy - ph, 4, ph);
        ctx.fillStyle = '#FF4D6D'; ctx.beginPath(); ctx.moveTo(px + 2, gy - ph); ctx.lineTo(px + 34, gy - ph + 10); ctx.lineTo(px + 2, gy - ph + 20); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.fillText('Rekord', px + 15, gy - ph + 10);
      }
    }
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function drawItems() {
    const s = st.cam.s, gy = SY(0);
    for (const it of st.items) {
      const px = SX(it.x);
      if (px < -80 || px > W + 80) continue;
      if (it.k === 'tramp') {
        const w = it.w * s, h = Math.max(8, 0.6 * s), sq = it.boing > 0 ? Math.sin(it.boing * 30) * h * 0.4 : 0;
        ctx.fillStyle = '#2B2350'; ctx.fillRect(px - w / 2, gy - h, 4, h); ctx.fillRect(px + w / 2 - 4, gy - h, 4, h);
        ctx.fillStyle = '#3B9DFF'; roundRect(px - w / 2, gy - h - 4 + sq, w, Math.max(6, 0.25 * s), 4); ctx.fill();
        ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2; ctx.stroke();
      } else if (it.k === 'boost') {
        const w = it.w * s, h = Math.max(6, 0.22 * s);
        ctx.fillStyle = '#FFD23F'; roundRect(px - w / 2, gy - h, w, h, 3); ctx.fill();
        ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#FF8A3D';
        for (let i = 0; i < 3; i++) { const ax = px - w / 3 + i * w / 3; ctx.beginPath(); ctx.moveTo(ax - h, gy - h * 0.15); ctx.lineTo(ax + h * 0.6, gy - h / 2); ctx.lineTo(ax - h, gy - h * 0.85); ctx.fill(); }
      } else if (it.k === 'mud') {
        ctx.fillStyle = '#8B5A2B'; ctx.beginPath(); ctx.ellipse(px, gy + 1, it.w * s / 2, Math.max(4, 0.25 * s), 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#A9713A'; ctx.beginPath(); ctx.ellipse(px - it.w * s * 0.12, gy, it.w * s / 5, Math.max(2, 0.1 * s), 0, 0, 7); ctx.fill();
      } else {
        if (it.used && it.k !== 'bird') continue;
        const py = SY(it.y), r = Math.max(it.k === 'coin' ? 7 : 11, it.r * s);
        if (py < -60 || py > H + 60) continue;
        if (it.k === 'balloon') {
          const bob = Math.sin(st.t * 2 + it.ph) * r * 0.12;
          ctx.strokeStyle = '#2B235088'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py + r + bob); ctx.quadraticCurveTo(px + r * 0.3, py + r * 1.8, px, py + r * 2.4 + bob); ctx.stroke();
          ctx.fillStyle = it.c; ctx.beginPath(); ctx.ellipse(px, py + bob, r * 0.85, r, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffffff88'; ctx.beginPath(); ctx.ellipse(px - r * 0.3, py - r * 0.35 + bob, r * 0.18, r * 0.3, -0.4, 0, 7); ctx.fill();
        } else if (it.k === 'bird') {
          const fl = Math.sin(it.ph) * r * 0.7, dir = it.flee ? 1 : -1;
          ctx.save(); ctx.translate(px, py); ctx.scale(dir, 1);
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.arc(-r * 0.75, -r * 0.45, r * 0.38, 0, 7); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#FF8A3D'; ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.5); ctx.lineTo(-r * 1.5, -r * 0.4); ctx.lineTo(-r * 1.05, -r * 0.3); ctx.fill();
          ctx.fillStyle = '#2B2350'; ctx.beginPath(); ctx.arc(-r * 0.85, -r * 0.55, r * 0.07 + 1, 0, 7); ctx.fill();
          ctx.fillStyle = '#E8E4FF'; ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.1); ctx.lineTo(r * 0.5, -r * 0.2 - fl); ctx.lineTo(r * 0.3, r * 0.2); ctx.fill(); ctx.stroke();
          ctx.restore();
        } else if (it.k === 'coin') {
          const w = Math.abs(Math.cos(st.t * 4 + it.ph)) * r + 1.5;
          ctx.fillStyle = '#FFD23F'; ctx.strokeStyle = '#C99600'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(px, py, w, r, 0, 0, 7); ctx.fill(); ctx.stroke();
        } else if (it.k === 'fuel') {
          ctx.fillStyle = '#FF4D6D'; ctx.strokeStyle = '#2B2350'; ctx.lineWidth = 2;
          roundRect(px - r * 0.7, py - r, r * 1.4, r * 2, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#FFD23F'; ctx.font = `700 ${r * 1.3}px Fredoka, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚡', px, py + 1);
        }
      }
    }
  }
  function drawBoot() {
    const s = st.cam.s;
    const pivX = SX(PIVOT.x), pivY = SY(PIVOT.y), gy = SY(0);
    if (pivX < -200) return;
    // stolpe
    ctx.fillStyle = '#7A4A26'; ctx.fillRect(pivX - 0.12 * s, pivY, 0.24 * s, gy - pivY);
    ctx.fillStyle = '#5A3418'; ctx.fillRect(pivX - 0.45 * s, gy - 0.25 * s, 0.9 * s, 0.25 * s);
    const a = st.armA;
    const ex = PIVOT.x + Math.sin(a) * ARM, ey = PIVOT.y - Math.cos(a) * ARM;
    // fjäder
    ctx.strokeStyle = '#B9B4D6'; ctx.lineWidth = Math.max(2, 0.09 * s); ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = PIVOT.x + (ex - PIVOT.x) * t, y = PIVOT.y + (ey - PIVOT.y) * t;
      const off = (i % 2 ? 1 : -1) * 0.16 * (i > 0 && i < n ? 1 : 0);
      ctx.lineTo(SX(x + Math.cos(a) * off), SY(y + Math.sin(a) * off));
    }
    ctx.stroke();
    ctx.fillStyle = '#2B2350'; ctx.beginPath(); ctx.arc(pivX, pivY, 0.16 * s, 0, 7); ctx.fill();
    // kängan
    ctx.save();
    ctx.translate(SX(ex), SY(ey));
    ctx.scale(s, -s);
    ctx.rotate(a * 0.6);
    ctx.lineWidth = 0.06; ctx.strokeStyle = '#2B2350'; ctx.lineJoin = 'round';
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath(); ctx.moveTo(-0.4, 0.02); ctx.lineTo(-0.38, 0.62); ctx.lineTo(0.05, 0.62); ctx.lineTo(0.08, 0.3);
    ctx.quadraticCurveTo(0.55, 0.28, 0.78, 0.05); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(-0.44, 0.04); ctx.lineTo(0.82, 0.04); ctx.quadraticCurveTo(0.86, -0.14, 0.7, -0.16); ctx.lineTo(-0.44, -0.16); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.05;
    ctx.beginPath(); ctx.moveTo(0.1, 0.24); ctx.lineTo(0.25, 0.32); ctx.moveTo(0.22, 0.18); ctx.lineTo(0.38, 0.26); ctx.stroke();
    ctx.fillStyle = '#FFD23F'; ctx.fillRect(-0.42, 0.56, 0.5, 0.12);
    ctx.restore();
  }
  function figPx() { return Math.max(FIG_H * st.cam.s, Math.min(W, H) * 0.15); }
  function drawFigure() {
    const img = st.o.img, s = st.cam.s;
    const px = SX(st.x), py = SY(st.y);
    // skugga
    const gy = SY(0), sh = clamp(1 - (st.y - R) / 25, 0.15, 1);
    if (gy < H + 10) { ctx.fillStyle = `rgba(0,0,0,${0.22 * sh})`; ctx.beginPath(); ctx.ellipse(px, gy, Math.max(6, 0.7 * s * sh), Math.max(2, 0.16 * s * sh), 0, 0, 7); ctx.fill(); }
    const h = figPx();
    const w = img && img.naturalWidth ? h * img.naturalWidth / img.naturalHeight : h * 0.5;
    ctx.save();
    ctx.translate(px, py);
    let rot = -st.ang, sqx = 1, sqy = 1;
    if (st.phase === 'aim') { rot = Math.sin(st.t * 5) * 0.05; sqy = 1 + Math.sin(st.t * 4) * 0.02; }
    ctx.rotate(rot);
    ctx.scale(sqx, sqy);
    const J = st.j;
    ctx.scale(1 - J.sq * 0.6, 1 + J.sq);
    if (st.rig && img && img.naturalWidth) {
      const rg = st.rig, k = h / rg.ih;
      ctx.scale(k, k);
      ctx.translate(-rg.iw / 2, -rg.ih / 2);
      const hipPX = rg.cx, hipY = rg.hipY;
      const leg = (p, a, px) => { ctx.save(); ctx.translate(px, hipY); ctx.rotate(a); ctx.drawImage(p.c, p.x - px, p.y - hipY); ctx.restore(); };
      leg(rg.legR, J.legR.a, hipPX + rg.iw * 0.06);
      leg(rg.legL, J.legL.a, hipPX - rg.iw * 0.06);
      ctx.save();
      ctx.translate(hipPX, hipY); ctx.rotate(J.spine.a); ctx.translate(-hipPX, -hipY);
      ctx.drawImage(rg.torso.c, rg.torso.x, rg.torso.y);
      const nx = hipPX, ny = rg.neckY;
      ctx.translate(nx, ny); ctx.rotate(J.head.a); ctx.translate(-nx, -ny);
      ctx.drawImage(rg.head.c, rg.head.x, rg.head.y);
      ctx.restore();
    } else if (img && img.complete && img.naturalWidth) {
      if (st.o.photo) { // eget foto: runt med vit kant
        const r = h * 0.42;
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip();
        const iw = img.naturalWidth, ih = img.naturalHeight, m = Math.min(iw, ih);
        ctx.drawImage(img, (iw - m) / 2, (ih - m) * 0.25, m, m, -r * 0.92, -r * 0.92, r * 1.84, r * 1.84);
        ctx.restore();
      } else ctx.drawImage(img, -w / 2, -h / 2, w, h);
    } else { ctx.fillStyle = st.o.color; ctx.beginPath(); ctx.arc(0, 0, h * 0.4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function drawFx() {
    const s = st.cam.s;
    for (const p of st.parts) {
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(SX(p.x), SY(p.y), Math.max(1.5, p.r * s), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of st.texts) {
      const k = t.life < 0.15 ? t.life / 0.15 : 1, a = 1 - Math.max(0, t.life - 0.7) / 0.4;
      const fs = Math.min(64, Math.max(26, Math.min(W, H) * 0.09)) * (0.6 + 0.6 * k);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `700 ${fs}px Fredoka, sans-serif`;
      ctx.lineWidth = fs * 0.16; ctx.strokeStyle = '#2B2350'; ctx.lineJoin = 'round';
      const x = clamp(SX(t.x), fs * 2, W - fs * 2), y = clamp(SY(t.y), fs, H - fs);
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08);
      ctx.strokeText(t.txt, 0, 0); ctx.fillStyle = t.c; ctx.fillText(t.txt, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function drawAim() {
    if (st.phase !== 'aim') return;
    const px = SX(st.x), py = SY(st.y), s = st.cam.s;
    const a = st.aim;
    if (a) {
      const len = (1.2 + a.p * 3.2) * s, ex = px + Math.cos(a.a) * len, ey = py - Math.sin(a.a) * len;
      ctx.strokeStyle = lerpC('#34C759', '#FF4D6D', a.p); ctx.lineWidth = Math.max(5, 0.22 * s); ctx.lineCap = 'round';
      ctx.setLineDash([0.3 * s, 0.3 * s]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(ex, ey, Math.max(7, 0.3 * s), 0, 7); ctx.fill();
    } else {
      // visar hur man sveper
      const t = (st.t % 1.6) / 1.6;
      const x = px + (0.6 + t * 2.4) * s, y = py + (1 - t * 2.2) * s;
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.font = `${Math.max(30, 1.2 * s)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('👆', x, y);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    drawSky();
    drawClouds();
    drawHills(0.25, 0.05, '#A9DF95', 1.3);
    drawHills(0.5, 0.035, '#86D07A', 4.1);
    drawGround();
    drawItems();
    drawBoot();
    drawFigure();
    drawFx();
    drawAim();
  }

  function frame(now) {
    if (!st) return;
    let dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
    stepFx(dt);
    updateJoints(dt);
    updateCam(dt);
    draw();
    hooks.hud && hooks.hud({
      dist: Math.max(0, st.x), alt: Math.max(0, st.y - R), spd: Math.hypot(st.vx, st.vy) * 3.6,
      coins: st.coins, fuel: st.fuel, fuelMax: st.fuelMax, phase: st.phase
    });
    raf = requestAnimationFrame(frame);
  }

  g.Game = { init, start, stop, get state() { return st; }, resize };
})(this);
