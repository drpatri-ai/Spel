/* Bucinca Staden – platserna och möblerna.
   Världen är 1000 enheter hög med golvet vid y = FLOOR. Möbler står på golvet (x = vänsterkant).
   Varje möbeltyp har: w, h, back() (ritas bakom figurerna), front() (ritas framför – t.ex. soffans sits),
   surf: ytor man kan ställa saker på [x0, x1, höjd], seats: sittplatser {x, h, kind}, spawn: förråd att ta saker ur,
   tap: vad som händer när man trycker. */
'use strict';
const FLOOR = 880;
const OL = '#3B3155';
const TAU = Math.PI * 2;

const LISTS = {
  food: ['🍎', '🍌', '🍇', '🍓', '🥕', '🥦', '🍞', '🧀', '🥚', '🥩', '🌽', '🥔', '🍕', '🍔', '🍩', '🍪', '🍰', '🥛', '🧃', '🍉'],
  acc: ['👑', '🎩', '🧢', '👒', '🎓', '🎀', '⛑️', '👓', '🕶️', '🥽', '💍', '🌂'],
  toys: ['🧸', '⚽', '🏀', '🪀', '🎈', '🚂', '🪁', '🎮', '🛹', '🐶', '🐱', '🐰'],
  bath: ['🧼', '🪥', '🧴', '🦆'],
  ice: ['🍦', '🍧', '🍭', '🧁', '🍩', '🍫'],
  fruit: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🥝', '🍍', '🥥', '🥑'],
  snack: ['🍪', '🍩', '🍫', '🍬', '🍭', '🧁', '🥨', '🍿', '🍟', '🍕', '🌭', '🥐'],
  shopToys: ['🧸', '🪀', '🎈', '🎁', '🚗', '🪁', '🛹', '🎮', '📱', '🎸', '🥁', '🎺'],
  drinks: ['🥛', '🧃', '🥤', '🧋', '🍵', '🧊'],
  med: ['🩹', '💊', '🌡️', '🧸', '🍭', '💉'],
  school: ['📚', '📕', '✏️', '🖍️', '🎨', '📐', '🎒', '🔬', '🧮', '🌍'],
  sand: ['🪣', '🐚', '⭐', '🦀'],
  pets: ['🐶', '🐱', '🐰', '🐹', '🐢', '🦜']
};
const EAT = new Set([...LISTS.food, ...LISTS.ice, ...LISTS.fruit, ...LISTS.snack, ...LISTS.drinks, '💊', '🍳', '🍖', '🍿', '🍟', '🥪', '🍐', '🍊', '🍋']);
EAT.delete('🧊');
const DRINK = new Set(['🥛', '🧃', '🥤', '🧋', '🍵']);
const HAT = new Set(['👑', '🎩', '🧢', '👒', '🎓', '🎀', '⛑️']);
const FACE = new Set(['👓', '🕶️', '🥽']);
const STICK = new Set(['🩹']);
const PETS = new Set(LISTS.pets);
const MUSIC = { '🎸': 'gitarr', '🥁': 'trumma', '🎺': 'trumpet', '🎮': 'spel', '📱': 'mobil' };
const COOK = { '🥚': '🍳', '🥩': '🍖', '🌽': '🍿', '🥔': '🍟', '🍞': '🥪' };

/* ---------- ritverktyg ---------- */
function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function box(ctx, x, y, w, h, fill, r = 10, lw = 4) { rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); } }
function circ(ctx, x, y, r, fill, lw = 4) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OL; ctx.stroke(); } }
function line(ctx, pts, col = OL, lw = 4) { ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
function emo(ctx, e, x, y, size) { ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e, x, y); }
function glow(ctx, x, y, r, col) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, col.slice(0, 7) + '00'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
/* rutnät för förråd: var hamnar ruta i */
function grid(sp, i) { const cw = (sp.x1 - sp.x0) / sp.cols, rows = Math.ceil(sp.list.length / sp.cols), ch = (sp.y1 - sp.y0) / rows; return { x: sp.x0 + (i % sp.cols + 0.5) * cw, y: sp.y0 + (Math.floor(i / sp.cols) + 0.5) * ch, s: Math.min(cw, ch) * 0.78 }; }
function drawSpawn(ctx, f, sp) { const top = FLOOR - FT[f.t].h; sp.list.forEach((e, i) => { const g = grid(sp, i); emo(ctx, e, f.x + g.x, top + g.y, g.s); }); }

/* ---------- möbeltyper ---------- */
const FT = {
  counter: {
    w: 380, h: 230, surf: [[0, 380, 230]], tap: 'toggle', snd: 'water', zone: [150, 260, 0, 120],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR - 230;
      box(ctx, x, y + 20, 380, 210, '#FFFFFF', 8);
      for (const dx of [10, 130, 255]) { box(ctx, x + dx, y + 40, 115, 175, '#F4F1FF', 6, 3); circ(ctx, x + dx + (dx === 255 ? 20 : 95), y + 120, 6, '#C9C3E8', 2); }
      box(ctx, x - 8, y, 396, 26, '#B57A4C', 6);
      // diskho och kran
      box(ctx, x + 150, y + 2, 110, 18, '#AEB7C8', 6, 3);
      line(ctx, [[x + 205, y], [x + 205, y - 70], [x + 235, y - 70], [x + 235, y - 55]], '#8E96A6', 8);
      if (f.on) { ctx.fillStyle = '#7FD1FFcc'; for (let k = 0; k < 6; k++) { const yy = y - 50 + ((t * 300 + k * 12) % 55); ctx.fillRect(x + 231, yy, 8, 10); } }
    }
  },
  stove: {
    w: 220, h: 230, surf: [[10, 210, 230]], tap: 'toggle', snd: 'stove', cooks: true,
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR - 230;
      box(ctx, x, y, 220, 230, '#E8EBF2', 10);
      box(ctx, x + 25, y + 70, 170, 120, f.on ? '#5B3B2A' : '#3A3645', 10);
      if (f.on) glow(ctx, x + 110, y + 130, 70, '#FF8A3D88');
      box(ctx, x + 40, y + 82, 140, 70, f.on ? '#FFB86B66' : '#5B606B88', 8, 3);
      line(ctx, [[x + 60, y + 60], [x + 160, y + 60]], '#8E96A6', 8);
      for (const bx of [55, 165]) { ctx.beginPath(); ctx.ellipse(x + bx, y + 4, 36, 8, 0, 0, TAU); ctx.fillStyle = f.on ? '#FF4D6D' : '#5B606B'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(); }
      for (let k = 0; k < 3; k++) circ(ctx, x + 70 + k * 40, y + 30, 9, f.on && k === 1 ? '#FF4D6D' : '#C9C3E8', 3);
    }
  },
  fridge: {
    w: 200, h: 520, tap: 'open', snd: 'door',
    spawn: { x0: 20, x1: 180, y0: 40, y1: 480, cols: 3, list: LISTS.food, needOpen: true },
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR - 520;
      box(ctx, x, y, 200, 520, '#DDF3FF', 18);
      if (f.open) {
        box(ctx, x + 12, y + 12, 176, 496, '#F7FCFF', 12, 3);
        for (let k = 1; k < 7; k++) line(ctx, [[x + 16, y + 40 + k * 70], [x + 184, y + 40 + k * 70]], '#C9E6F5', 4);
        drawSpawn(ctx, f, this.spawn);
        box(ctx, x + 196, y + 4, 40, 512, '#CFEAFA', 14);
      } else {
        line(ctx, [[x + 6, y + 190], [x + 194, y + 190]], OL, 4);
        line(ctx, [[x + 170, y + 60], [x + 170, y + 150]], '#8E96A6', 10);
        line(ctx, [[x + 170, y + 230], [x + 170, y + 330]], '#8E96A6', 10);
        emo(ctx, '🧲', x + 60, y + 80, 34); emo(ctx, '🍓', x + 100, y + 260, 30);
      }
    }
  },
  table: {
    w: 320, h: 200, surf: [[0, 320, 200]],
    back(ctx, f) {
      const x = f.x, y = FLOOR - 200;
      for (const lx of [20, 280]) box(ctx, x + lx, y + 20, 22, 180, '#B57A4C', 6, 3);
      box(ctx, x - 6, y, 332, 28, '#D49A63', 8);
    }
  },
  chair: {
    w: 120, h: 270, seats: [{ x: 60, h: 120, kind: 'sit', clip: 0 }],
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x + (f.flip ? 90 : 0), y - 270, 30, 270, f.col || '#FF8A3D', 10); },
    front(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x, y - 125, 120, 125, f.col || '#FF8A3D', 12); box(ctx, x + 8, y - 132, 104, 22, '#FFD9B0', 10, 3); }
  },
  sofa: {
    w: 440, h: 240, surf: [[0, 50, 170], [390, 440, 170]], seats: [{ x: 140, h: 110, kind: 'sit', clip: 22 }, { x: 300, h: 110, kind: 'sit', clip: 22 }],
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x + 20, y - 240, 400, 160, f.col || '#8B7BFF', 26); },
    front(ctx, f) {
      const x = f.x, y = FLOOR, c = f.col || '#8B7BFF';
      box(ctx, x + 30, y - 115, 380, 95, c, 18);
      for (const cx of [60, 230]) box(ctx, x + cx, y - 128, 150, 40, '#B3A8FF', 16, 3);
      box(ctx, x, y - 170, 55, 150, c, 20); box(ctx, x + 385, y - 170, 55, 150, c, 20);
      for (const lx of [30, 395]) box(ctx, x + lx, y - 22, 16, 22, '#5B3B2A', 4, 3);
    }
  },
  tv: {
    w: 260, h: 320, surf: [[0, 60, 110], [200, 260, 110]], tap: 'toggle', snd: 'tv', zone: [10, 250, 120, 320],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 110, 260, 110, '#B57A4C', 10);
      box(ctx, x + 20, y - 85, 100, 60, '#9A6440', 6, 3); box(ctx, x + 140, y - 85, 100, 60, '#9A6440', 6, 3);
      box(ctx, x + 115, y - 140, 30, 32, '#3A3645', 4, 3);
      box(ctx, x + 10, y - 320, 240, 180, '#2B2350', 14);
      const sx = x + 24, sy = y - 306, sw = 212, sh = 152;
      if (f.on) {
        const g = ctx.createLinearGradient(0, sy, 0, sy + sh); g.addColorStop(0, '#7FD1FF'); g.addColorStop(1, '#9BE38A');
        ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
        const shows = ['🐶', '🦄', '🚀', '🐠', '🦖'], k = Math.floor(t / 4) % shows.length;
        emo(ctx, shows[k], sx + sw / 2 + Math.sin(t * 2) * 60, sy + sh / 2 + Math.abs(Math.sin(t * 4)) * -25 + 15, 70);
        emo(ctx, '☀️', sx + 30, sy + 26, 30);
      } else { ctx.fillStyle = '#3A3F55'; ctx.fillRect(sx, sy, sw, sh); ctx.fillStyle = '#ffffff22'; ctx.fillRect(sx + 10, sy + 10, 60, 20); }
    }
  },
  lamp: {
    w: 100, h: 380, tap: 'toggle', snd: 'click', zone: [0, 100, 200, 380],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      if (f.on) glow(ctx, x + 50, y - 330, 260, '#FFE45C66');
      box(ctx, x + 20, y - 18, 60, 18, '#5B606B', 8, 3);
      line(ctx, [[x + 50, y - 18], [x + 50, y - 300]], '#5B606B', 8);
      ctx.beginPath(); ctx.moveTo(x + 15, y - 290); ctx.lineTo(x + 85, y - 290); ctx.lineTo(x + 70, y - 370); ctx.lineTo(x + 30, y - 370); ctx.closePath();
      ctx.fillStyle = f.on ? '#FFE45C' : '#FFF4C2'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
    }
  },
  radio: {
    w: 160, h: 260, surf: [[0, 30, 160], [130, 160, 160]], tap: 'toggle', snd: 'radio',
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      for (const lx of [15, 125]) box(ctx, x + lx, y - 150, 18, 150, '#B57A4C', 5, 3);
      box(ctx, x, y - 165, 160, 22, '#D49A63', 8);
      const b = f.on ? Math.abs(Math.sin(t * 8)) * 6 : 0;
      box(ctx, x + 25, y - 255 - b, 110, 90 + b, '#FF6FAE', 16);
      circ(ctx, x + 60, y - 210, 24 + b * 0.5, '#2B2350', 3); circ(ctx, x + 60, y - 210, 9, '#8E96A6', 2);
      box(ctx, x + 92, y - 240, 30, 14, '#FFF4C2', 4, 2);
      line(ctx, [[x + 115, y - 255], [x + 140, y - 300]], '#8E96A6', 4);
      if (f.on) for (let k = 0; k < 3; k++) { const p = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = 1 - p; emo(ctx, k % 2 ? '🎵' : '🎶', x + 80 + Math.sin(p * 6 + k) * 40, y - 280 - p * 160, 34); ctx.globalAlpha = 1; }
    }
  },
  plant: {
    w: 110, h: 240, tap: 'wiggle',
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR, wob = f.wig > 0 ? Math.sin(t * 30) * 0.12 * f.wig : 0;
      ctx.save(); ctx.translate(x + 55, y - 90); ctx.rotate(wob);
      for (let k = 0; k < 7; k++) { ctx.save(); ctx.rotate(-1.2 + k * 0.4); ctx.beginPath(); ctx.ellipse(0, -70, 20, 70, 0, 0, TAU); ctx.fillStyle = k % 2 ? '#34C759' : '#2FB45A'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(x + 15, y - 95); ctx.lineTo(x + 95, y - 95); ctx.lineTo(x + 82, y); ctx.lineTo(x + 28, y); ctx.closePath(); ctx.fillStyle = '#E07A4F'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
    }
  },
  bed: {
    w: 470, h: 230, surf: [[90, 470, 150]], seats: [{ x: 250, h: 150, kind: 'lie' }],
    back(ctx, f) {
      const x = f.x, y = FLOOR, c = f.col || '#3B9DFF';
      box(ctx, x, y - 230, 40, 230, '#B57A4C', 12);
      box(ctx, x + 430, y - 170, 40, 170, '#B57A4C', 12);
      box(ctx, x + 30, y - 110, 410, 70, '#D49A63', 8);
      box(ctx, x + 36, y - 150, 400, 50, '#FFFFFF', 18);
      box(ctx, x + 45, y - 185, 110, 50, '#FFF4C2', 22);
      if (!f.used) box(ctx, x + 150, y - 160, 290, 60, c, 20);
    },
    front(ctx, f) {
      if (!f.used) return;
      const x = f.x, y = FLOOR, c = f.col || '#3B9DFF';
      box(ctx, x + 150, y - 215, 290, 120, c, 30);
      for (let k = 0; k < 5; k++) circ(ctx, x + 180 + k * 55, y - 155, 9, '#ffffff88', 0);
    }
  },
  wardrobe: {
    w: 270, h: 490, tap: 'open', snd: 'door',
    spawn: { x0: 25, x1: 245, y0: 60, y1: 440, cols: 3, list: LISTS.acc, needOpen: true },
    back(ctx, f) {
      const x = f.x, y = FLOOR - 490;
      box(ctx, x, y, 270, 490, '#C98A5A', 14);
      if (f.open) {
        box(ctx, x + 14, y + 14, 242, 462, '#7A4E30', 10, 3);
        line(ctx, [[x + 20, y + 50], [x + 250, y + 50]], '#D9D9E0', 6);
        drawSpawn(ctx, f, this.spawn);
      } else {
        box(ctx, x + 14, y + 14, 117, 462, '#D49A63', 10, 3); box(ctx, x + 139, y + 14, 117, 462, '#D49A63', 10, 3);
        circ(ctx, x + 118, y + 250, 9, '#FFD23F', 3); circ(ctx, x + 152, y + 250, 9, '#FFD23F', 3);
        emo(ctx, '👗', x + 135, y - 2, 0);
      }
    }
  },
  toybox: {
    w: 220, h: 150, tap: 'open', snd: 'door', surf: [[0, 220, 150]],
    spawn: { x0: 10, x1: 210, y0: -150, y1: 10, cols: 4, list: LISTS.toys, needOpen: true },
    back(ctx, f) {
      const x = f.x, y = FLOOR - 150;
      if (f.open) { box(ctx, x - 10, y - 160, 240, 150, '#FFF4C2', 16, 3); drawSpawn(ctx, f, this.spawn); }
      box(ctx, x, y, 220, 150, '#FF6FAE', 14);
      box(ctx, x - 6, y - 4, 232, 34, f.open ? '#FF9AC6' : '#D94788', 12);
      emo(ctx, '⭐', x + 110, y + 90, 46);
    }
  },
  bath: {
    w: 400, h: 520, seats: [{ x: 200, h: 55, kind: 'bath', clip: 24 }], tap: 'toggle', snd: 'shower', zone: [0, 400, 300, 520],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      line(ctx, [[x + 330, y - 160], [x + 330, y - 500], [x + 250, y - 500]], '#AEB7C8', 10);
      box(ctx, x + 205, y - 515, 60, 30, '#AEB7C8', 10, 3);
      if (f.on) { ctx.fillStyle = '#7FD1FFaa'; for (let k = 0; k < 26; k++) { const px = x + 215 + (k * 37 % 50) - (k % 3) * 25, py = y - 480 + ((t * 420 + k * 31) % 330); ctx.fillRect(px - 10, py, 5, 16); } }
      box(ctx, x, y - 190, 400, 40, '#F4F1FF', 18);
    },
    front(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      if (f.used || f.on) for (let k = 0; k < 14; k++) circ(ctx, x + 30 + k * 26, y - 160 - Math.abs(Math.sin(t * 2 + k)) * 18, 18 + (k % 3) * 6, '#FFFFFFdd', 2);
      box(ctx, x + 10, y - 160, 380, 140, '#FFFFFF', 30);
      for (const lx of [40, 340]) box(ctx, x + lx, y - 26, 26, 26, '#FFD23F', 8, 3);
    }
  },
  toilet: {
    w: 150, h: 260, seats: [{ x: 80, h: 105, kind: 'sit', clip: 0 }], tap: 'flush', snd: 'flush',
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x + 70, y - 260, 80, 140, '#FFFFFF', 14); box(ctx, x + 95, y - 252, 34, 12, '#C9C3E8', 5, 3); },
    front(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 118, 145, 26, '#FFFFFF', 12);
      ctx.beginPath(); ctx.moveTo(x + 10, y - 95); ctx.lineTo(x + 135, y - 95); ctx.lineTo(x + 110, y); ctx.lineTo(x + 40, y); ctx.closePath(); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
      if (f.flushT > 0) for (let k = 0; k < 8; k++) { const a = t * 12 + k * 0.8; circ(ctx, x + 72 + Math.cos(a) * 40 * f.flushT, y - 120 + Math.sin(a) * 8, 7, '#7FD1FF', 0); }
    }
  },
  basin: {
    w: 190, h: 450, tap: 'toggle', snd: 'water', surf: [[0, 190, 210]],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x + 25, y - 450, 140, 180, '#CFEAFA', 60);
      ctx.save(); rr(ctx, x + 35, y - 440, 120, 160, 52); ctx.clip(); ctx.fillStyle = '#ffffff77'; ctx.fillRect(x + 50 + Math.sin(t) * 10, y - 440, 20, 160); ctx.restore();
      box(ctx, x + 75, y - 200, 40, 200, '#FFFFFF', 10);
      box(ctx, x, y - 215, 190, 40, '#FFFFFF', 18);
      line(ctx, [[x + 95, y - 215], [x + 95, y - 255], [x + 125, y - 255]], '#AEB7C8', 7);
      if (f.on) { ctx.fillStyle = '#7FD1FFcc'; for (let k = 0; k < 4; k++) ctx.fillRect(x + 121, y - 250 + ((t * 260 + k * 10) % 34), 7, 9); }
    }
  },
  bathshelf: {
    w: 170, h: 330, surf: [[0, 170, 330]],
    spawn: { x0: 15, x1: 155, y0: 40, y1: 130, cols: 2, list: LISTS.bath },
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      for (const lx of [10, 145]) box(ctx, x + lx, y - 330, 15, 330, '#D9D9E0', 5, 3);
      for (const hy of [330, 240, 150]) box(ctx, x, y - hy, 170, 16, '#FFFFFF', 6, 3);
      drawSpawn(ctx, f, this.spawn);
    }
  },
  /* ---- parken ---- */
  swing: {
    w: 360, h: 440, seats: [{ x: 180, h: 120, kind: 'swing' }],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      line(ctx, [[x + 10, y], [x + 60, y - 440], [x + 110, y]], '#E5484D', 14);
      line(ctx, [[x + 250, y], [x + 300, y - 440], [x + 350, y]], '#E5484D', 14);
      line(ctx, [[x + 40, y - 430], [x + 320, y - 430]], '#C9304D', 16);
      const a = f.ang || 0, px = x + 180, py = y - 430, L = 300;
      const sx = px + Math.sin(a) * L, sy = py + Math.cos(a) * L;
      line(ctx, [[px - 35, py], [sx - 35, sy]], '#8E96A6', 4); line(ctx, [[px + 35, py], [sx + 35, sy]], '#8E96A6', 4);
    },
    front(ctx, f) {
      const x = f.x, y = FLOOR, a = f.ang || 0, px = x + 180, py = y - 430, L = 300;
      const sx = px + Math.sin(a) * L, sy = py + Math.cos(a) * L;
      box(ctx, sx - 50, sy - 6, 100, 18, '#FFD23F', 8, 3);
    }
  },
  slide: {
    w: 480, h: 360, surf: [[30, 150, 300]],
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      line(ctx, [[x + 30, y], [x + 30, y - 300]], '#3B9DFF', 12); line(ctx, [[x + 90, y], [x + 90, y - 300]], '#3B9DFF', 12);
      for (let k = 1; k < 6; k++) line(ctx, [[x + 30, y - k * 50], [x + 90, y - k * 50]], '#2373C9', 8);
      box(ctx, x + 20, y - 310, 140, 24, '#2373C9', 8);
      line(ctx, [[x + 30, y - 310], [x + 30, y - 360], [x + 150, y - 360], [x + 150, y - 310]], '#3B9DFF', 8);
      ctx.beginPath(); ctx.moveTo(x + 150, y - 300); ctx.quadraticCurveTo(x + 330, y - 260, x + 420, y - 60); ctx.lineTo(x + 480, y - 40);
      ctx.lineTo(x + 480, y - 10); ctx.lineTo(x + 410, y - 30); ctx.quadraticCurveTo(x + 320, y - 230, x + 150, y - 270); ctx.closePath();
      ctx.fillStyle = '#FFD23F'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 4; ctx.stroke();
      line(ctx, [[x + 400, y - 60], [x + 400, y]], '#3B9DFF', 10);
    },
    path(f, p) {   // 0..1 längs rutschkanan (fötternas läge)
      const x = f.x, y = FLOOR, u = 1 - p;
      const qx = u * u * (x + 150) + 2 * u * p * (x + 330) + p * p * (x + 450), qy = u * u * (y - 300) + 2 * u * p * (y - 250) + p * p * (y - 40);
      return { x: qx, y: qy };
    }
  },
  sandbox: {
    w: 380, h: 90,
    spawn: { x0: 40, x1: 340, y0: 0, y1: 70, cols: 4, list: LISTS.sand },
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 90, 380, 90, '#C98A5A', 10);
      box(ctx, x + 14, y - 78, 352, 50, '#F5D7A1', 20, 3);
      drawSpawn(ctx, f, this.spawn);
    }
  },
  icecream: {
    w: 320, h: 420, surf: [[0, 320, 200]],
    spawn: { x0: 30, x1: 290, y0: 140, y1: 205, cols: 6, list: LISTS.ice },
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      line(ctx, [[x + 30, y - 200], [x + 30, y - 380]], '#8E96A6', 8); line(ctx, [[x + 290, y - 200], [x + 290, y - 380]], '#8E96A6', 8);
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x + k * 53 + 3, y - 380); ctx.lineTo(x + k * 53 + 56, y - 380); ctx.lineTo(x + k * 53 + 30, y - 330); ctx.closePath(); ctx.fillStyle = k % 2 ? '#fff' : '#FF6FAE'; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 3; ctx.stroke(); }
      box(ctx, x - 5, y - 420, 330, 46, '#FF6FAE', 16);
      emo(ctx, '🍦', x + 160, y - 397, 34);
      box(ctx, x, y - 200, 320, 200, '#FFF4C2', 14);
      for (let k = 0; k < 4; k++) circ(ctx, x + 50 + k * 75, y - 100, 22, ['#FF6FAE', '#7FD1FF', '#9BE38A', '#FFD23F'][k], 3);
      box(ctx, x - 6, y - 212, 332, 22, '#FFFFFF', 8);
      drawSpawn(ctx, f, this.spawn);
    }
  },
  bench: {
    w: 380, h: 200, seats: [{ x: 110, h: 100, kind: 'sit' }, { x: 270, h: 100, kind: 'sit' }],
    back(ctx, f) { const x = f.x, y = FLOOR; for (const k of [0, 1]) box(ctx, x + 10, y - 200 + k * 40, 360, 26, '#C98A5A', 8, 3); },
    front(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x, y - 110, 380, 30, '#D49A63', 8); for (const lx of [25, 330]) box(ctx, x + lx, y - 82, 26, 82, '#5B606B', 6, 3); }
  },
  tree: {
    w: 320, h: 640, tap: 'shake', snd: 'leaves', zone: [0, 320, 300, 640],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR, sh = f.wig > 0 ? Math.sin(t * 30) * 8 * f.wig : 0;
      box(ctx, x + 130, y - 330, 60, 330, '#8B5A2B', 18);
      for (const [cx, cy, r] of [[160, 420, 150], [80, 470, 100], [240, 470, 100], [160, 560, 110]]) circ(ctx, x + cx + sh, y - cy, r, '#34C759', 4);
      for (const [ax, ay] of [[90, 420], [220, 400], [160, 520], [250, 500], [70, 500]]) emo(ctx, '🍎', x + ax + sh, y - ay, 38);
    }
  },
  fountain: {
    w: 340, h: 300,
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x + 150, y - 210, 40, 120, '#C9CED8', 10);
      ctx.fillStyle = '#7FD1FFcc';
      for (let k = 0; k < 18; k++) { const p = (t * 0.9 + k / 18) % 1, side = k % 2 ? 1 : -1; const px = x + 170 + side * p * 120, py = y - 230 - Math.sin(p * Math.PI) * 90 + p * 140; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill(); }
    },
    front(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x, y - 100, 340, 100, '#AEB7C8', 30); box(ctx, x + 18, y - 92, 304, 30, '#7FD1FF', 14, 3); }
  },
  lamppost: {
    w: 70, h: 540,
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x + 25, y - 480, 20, 480, '#3A3645', 8, 3); box(ctx, x, y - 540, 70, 70, '#FFE45C', 20); box(ctx, x + 5, y - 550, 60, 18, '#3A3645', 8, 3); }
  },
  /* ---- affären ---- */
  shelf: {
    w: 400, h: 440,
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 440, 400, 440, '#FFFFFF', 10);
      for (let k = 0; k < 3; k++) box(ctx, x + 6, y - 300 + k * 140 - 140 + 140 - 4, 388, 14, '#C9C3E8', 4, 3);
      emo(ctx, f.sign || '🛒', x + 200, y - 465, 40);
      drawSpawn(ctx, f, this.spawnFor(f));
    },
    spawnFor: f => ({ x0: 20, x1: 380, y0: 20, y1: 420, cols: 4, list: LISTS[f.list] })
  },
  coolers: {
    w: 300, h: 470,
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 470, 300, 470, '#DDF3FF', 14);
      drawSpawn(ctx, f, this.spawnFor(f));
      ctx.fillStyle = '#ffffff44'; ctx.fillRect(x + 40, y - 450, 30, 430);
      line(ctx, [[x + 150, y - 470], [x + 150, y]], OL, 4);
    },
    spawnFor: () => ({ x0: 20, x1: 280, y0: 30, y1: 440, cols: 2, list: LISTS.drinks })
  },
  register: {
    w: 380, h: 300, surf: [[0, 230, 200]], tap: 'kaching', snd: 'kaching', zone: [230, 380, 160, 300],
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 200, 380, 200, '#3B9DFF', 12);
      box(ctx, x - 6, y - 212, 392, 26, '#FFFFFF', 8);
      ctx.fillStyle = '#2B2350'; ctx.fillRect(x + 20, y - 205, 200, 8);
      box(ctx, x + 240, y - 300, 130, 90, '#E5484D', 12);
      box(ctx, x + 255, y - 290, 100, 30, '#9BE38A', 6, 3);
      ctx.fillStyle = '#2B2350'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(f.sum || 0) + ' kr', x + 305, y - 275);
      for (let k = 0; k < 6; k++) box(ctx, x + 258 + (k % 3) * 34, y - 252 + Math.floor(k / 3) * 20, 26, 14, '#FFF4C2', 4, 2);
    }
  },
  /* ---- sjukhuset ---- */
  hospbed: {
    w: 460, h: 260, seats: [{ x: 250, h: 150, kind: 'lie' }], surf: [[100, 460, 150]],
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      line(ctx, [[x + 20, y], [x + 20, y - 260]], '#AEB7C8', 10); line(ctx, [[x + 440, y], [x + 440, y - 200]], '#AEB7C8', 10);
      box(ctx, x + 10, y - 110, 440, 30, '#C9CED8', 8);
      for (const wx of [60, 400]) circ(ctx, x + wx, y - 18, 18, '#5B606B', 3);
      box(ctx, x + 20, y - 150, 420, 45, '#FFFFFF', 16);
      box(ctx, x + 30, y - 185, 110, 45, '#FFFFFF', 22);
      if (!f.used) box(ctx, x + 150, y - 160, 285, 55, '#9BE38A', 20);
      emo(ctx, '➕', x + 230, y - 60, 0);
    },
    front(ctx, f) { if (!f.used) return; box(ctx, f.x + 150, FLOOR - 215, 290, 115, '#9BE38A', 28); }
  },
  xray: {
    w: 270, h: 480,
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x, y - 480, 270, 480, '#5B606B', 16); box(ctx, x + 15, y - 30, 240, 30, '#3A3645', 8, 3); },
    front(ctx, f, S, t, chars) {
      const x = f.x, y = FLOOR;
      ctx.globalAlpha = 0.9; box(ctx, x + 20, y - 460, 230, 400, '#1B2A4A', 14, 3); ctx.globalAlpha = 1;
      const who = chars.find(c => c.pose === 'stand' && c.x > x + 30 && c.x < x + 240 && c.y >= FLOOR - 5);
      if (who) skeleton(ctx, who.x, FLOOR - 70, who.H * 0.9, t);
      else { ctx.fillStyle = '#7FD1FF55'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('RÖNTGEN', x + 135, y - 260); }
      ctx.fillStyle = '#7FD1FF22'; ctx.fillRect(x + 20, y - 460 + ((t * 120) % 400), 230, 10);
    }
  },
  cabinet: {
    w: 230, h: 420,
    spawn: { x0: 20, x1: 210, y0: 40, y1: 400, cols: 2, list: LISTS.med },
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 420, 230, 420, '#FFFFFF', 14);
      box(ctx, x + 90, y - 455, 50, 50, '#E5484D', 8); ctx.fillStyle = '#fff'; ctx.fillRect(x + 108, y - 448, 14, 36); ctx.fillRect(x + 97, y - 437, 36, 14);
      drawSpawn(ctx, f, this.spawn);
      ctx.fillStyle = '#CFEAFA44'; ctx.fillRect(x + 12, y - 410, 206, 400);
    }
  },
  desk: {
    w: 380, h: 300, surf: [[0, 380, 200]],
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 200, 380, 200, '#D49A63', 10);
      box(ctx, x + 20, y - 170, 140, 150, '#B57A4C', 8, 3); circ(ctx, x + 140, y - 95, 7, '#FFD23F', 2);
      box(ctx, x - 6, y - 212, 392, 22, '#B57A4C', 8);
      if (f.pc) { box(ctx, x + 220, y - 340, 140, 100, '#2B2350', 10); box(ctx, x + 230, y - 330, 120, 80, '#7FD1FF', 6, 2); box(ctx, x + 280, y - 245, 20, 35, '#5B606B', 4, 3); }
    }
  },
  scale: {
    w: 160, h: 40,
    back(ctx, f, S, t, chars) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 40, 160, 40, '#E3E6EC', 14);
      box(ctx, x + 50, y - 34, 60, 22, '#2B2350', 6, 3);
      const who = chars.find(c => c.pose === 'stand' && Math.abs(c.x - (x + 80)) < 70 && c.y >= FLOOR - 50);
      ctx.fillStyle = '#9BE38A'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(who ? (who.kg + ' kg') : '0', x + 80, y - 23);
    },
    surf: [[0, 160, 40]]
  },
  /* ---- skolan ---- */
  board: {
    w: 920, h: 640, draw: true,
    back(ctx, f, S) {
      const x = f.x, y = FLOOR - 640;
      box(ctx, x, y, 920, 400, '#B57A4C', 14);
      box(ctx, x + 20, y + 20, 880, 360, '#2F5D46', 8, 3);
      if (S.boardImg) ctx.drawImage(S.boardImg, x + 20, y + 20, 880, 360);
      box(ctx, x + 10, y + 390, 900, 24, '#9A6440', 6, 3);
      box(ctx, x + 760, y + 372, 110, 30, '#FF8A3D', 8, 3);   // tavelsudd
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SUDDA', x + 815, y + 387);
      for (let k = 0; k < 4; k++) box(ctx, x + 60 + k * 50, y + 380, 36, 12, ['#fff', '#FFD23F', '#FF6FAE', '#7FD1FF'][k], 4, 2);
    }
  },
  schooldesk: {
    w: 260, h: 240, surf: [[110, 260, 190]], seats: [{ x: 70, h: 105, kind: 'sit', clip: 0 }],
    back(ctx, f) { const x = f.x, y = FLOOR; box(ctx, x, y - 230, 26, 230, '#3B9DFF', 8, 3); },
    front(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x + 10, y - 112, 120, 112, '#3B9DFF', 10);
      box(ctx, x + 100, y - 195, 160, 22, '#D49A63', 6);
      box(ctx, x + 230, y - 175, 18, 175, '#8E96A6', 5, 3);
    }
  },
  bookshelf: {
    w: 320, h: 440,
    spawn: { x0: 25, x1: 295, y0: 30, y1: 420, cols: 3, list: LISTS.school },
    back(ctx, f) {
      const x = f.x, y = FLOOR;
      box(ctx, x, y - 440, 320, 440, '#B57A4C', 12);
      box(ctx, x + 14, y - 426, 292, 412, '#9A6440', 8, 3);
      drawSpawn(ctx, f, this.spawn);
    }
  },
  globe: {
    w: 140, h: 300, tap: 'spin', snd: 'click',
    back(ctx, f, S, t) {
      const x = f.x, y = FLOOR;
      box(ctx, x + 30, y - 30, 80, 30, '#B57A4C', 10, 3); line(ctx, [[x + 70, y - 30], [x + 70, y - 130]], '#B57A4C', 10);
      circ(ctx, x + 70, y - 210, 75, '#3B9DFF');
      ctx.save(); ctx.beginPath(); ctx.arc(x + 70, y - 210, 73, 0, TAU); ctx.clip();
      const o = ((f.rot || 0) % 1) * 150;
      for (let k = -1; k < 3; k++) { ctx.fillStyle = '#34C759'; ctx.beginPath(); ctx.ellipse(x + o + k * 150 - 20, y - 230, 35, 45, 0.4, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + o + k * 150 + 40, y - 180, 25, 30, -0.3, 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.beginPath(); ctx.arc(x + 70, y - 210, 85, -2.2, 2.2); ctx.strokeStyle = '#FFD23F'; ctx.lineWidth = 6; ctx.stroke();
    }
  }
};

function skeleton(ctx, x, y, H, t) {
  ctx.save(); ctx.strokeStyle = '#E8FBFF'; ctx.fillStyle = '#E8FBFF'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  const s = H / 400;
  const P = (a, b) => [x + a * s, y - b * s];
  ctx.beginPath(); ctx.arc(x, y - 360 * s, 36 * s, 0, TAU); ctx.stroke();
  ctx.fillRect(x - 14 * s, y - 368 * s, 9 * s, 9 * s); ctx.fillRect(x + 5 * s, y - 368 * s, 9 * s, 9 * s);
  line(ctx, [P(0, 320), P(0, 180)], '#E8FBFF', 8);
  for (let k = 0; k < 4; k++) line(ctx, [P(-40, 300 - k * 25), P(40, 300 - k * 25)], '#E8FBFF', 5);
  line(ctx, [P(-50, 305), P(-70, 220), P(-80, 150)], '#E8FBFF', 6); line(ctx, [P(50, 305), P(70, 220), P(80, 150)], '#E8FBFF', 6);
  line(ctx, [P(-35, 180), P(35, 180)], '#E8FBFF', 8);
  line(ctx, [P(-25, 180), P(-30, 90), P(-32, 0)], '#E8FBFF', 7); line(ctx, [P(25, 180), P(30, 90), P(32, 0)], '#E8FBFF', 7);
  ctx.restore();
}

/* ---------- platserna ---------- */
const SCENES = {
  hem: {
    name: 'Hemmet', icon: '🏠', w: 4600,
    rooms: [
      { x0: 0, x1: 950, wall: '#CFF5E1', pat: 'tiles', floor: '#E8D3B0', name: 'Kök' },
      { x0: 950, x1: 2350, wall: '#FFE0C7', pat: 'stripes', floor: '#C98A5A', name: 'Vardagsrum' },
      { x0: 2350, x1: 3600, wall: '#E3D9FF', pat: 'dots', floor: '#B57A4C', name: 'Sovrum' },
      { x0: 3600, x1: 4600, wall: '#CFEAFA', pat: 'tiles', floor: '#FFFFFF', name: 'Badrum' }
    ],
    windows: [[260, 220], [1100, 220], [2500, 210]], pictures: [[1520, 300, 0], [1640, 340, 1], [1760, 300, 2], [3000, 320, 3], [4450, 300, 6]], rugs: [[1400, 600, '#FF6FAE'], [2500, 450, '#7FD1FF']],
    furn: [['counter', 40], ['stove', 430], ['fridge', 690],
      ['chair', 975, { col: '#FF8A3D' }], ['table', 1035], ['chair', 1300, { col: '#34C759', flip: 1 }], ['sofa', 1460, { col: '#8B7BFF' }], ['lamp', 1915], ['tv', 2040],
      ['bed', 2400], ['radio', 2890], ['wardrobe', 3065], ['toybox', 3350],
      ['bath', 3630], ['bathshelf', 4045], ['toilet', 4230], ['basin', 4395]]
  },
  park: {
    name: 'Parken', icon: '🌳', w: 3300, outdoor: true,
    furn: [['tree', 30], ['swing', 400], ['slide', 820], ['sandbox', 1360], ['icecream', 1800], ['bench', 2200], ['lamppost', 2620], ['fountain', 2720], ['tree', 3000]]
  },
  affar: {
    name: 'Affären', icon: '🛒', w: 2700,
    rooms: [{ x0: 0, x1: 2700, wall: '#FFF4C2', pat: 'stripes', floor: '#E3E6EC', name: 'Affären' }],
    windows: [[2350, 220]], sign: 'BUCINCA-AFFÄREN',
    furn: [['shelf', 60, { list: 'fruit', sign: '🍎' }], ['shelf', 500, { list: 'snack', sign: '🍪' }], ['coolers', 940], ['shelf', 1280, { list: 'shopToys', sign: '🧸' }], ['register', 1750], ['plant', 2200]]
  },
  sjukhus: {
    name: 'Sjukhuset', icon: '🏥', w: 2500,
    rooms: [{ x0: 0, x1: 1300, wall: '#E8FBFF', pat: 'tiles', floor: '#DDF3E8', name: 'Vårdsal' }, { x0: 1300, x1: 2500, wall: '#FFF0F5', pat: 'dots', floor: '#E3E6EC', name: 'Mottagning' }],
    windows: [[700, 200]], pictures: [[1950, 300, 4]],
    furn: [['hospbed', 60], ['cabinet', 560], ['xray', 860], ['desk', 1380, { pc: 1 }], ['chair', 1780, { col: '#3B9DFF', flip: 1 }], ['scale', 1950], ['bench', 2120], ['plant', 2400]]
  },
  skola: {
    name: 'Skolan', icon: '🏫', w: 2700,
    rooms: [{ x0: 0, x1: 2700, wall: '#FFF7E0', pat: 'stripes', floor: '#C98A5A', name: 'Klassrum' }],
    windows: [[2300, 210]], pictures: [[1950, 300, 5]],
    furn: [['board', 120], ['desk', 1100], ['bookshelf', 1550], ['globe', 1900], ['schooldesk', 300], ['schooldesk', 620], ['schooldesk', 2050], ['plant', 2500]]
  }
};
/* bakgrund för en plats */
function drawBackdrop(ctx, sc, t, view) {
  if (sc.outdoor) {
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, '#7FD1FF'); g.addColorStop(1, '#C9F0FF');
    ctx.fillStyle = '#7FD1FF'; ctx.fillRect(view.x0 - 10, -3000, view.x1 - view.x0 + 20, 3000);
    ctx.fillStyle = g; ctx.fillRect(view.x0 - 10, 0, view.x1 - view.x0 + 20, FLOOR);
    circ(ctx, sc.w * 0.15, 130, 60, '#FFE45C', 0);
    for (let k = 0; k < 6; k++) { const cx = ((k * 700 + t * 12) % (sc.w + 400)) - 200, cy = 120 + (k % 3) * 60; for (const [dx, r] of [[0, 45], [40, 55], [85, 40]]) circ(ctx, cx + dx, cy, r, '#FFFFFF', 0); }
    ctx.fillStyle = '#9BE38A'; for (let k = 0; k < sc.w; k += 600) { ctx.beginPath(); ctx.ellipse(k + 300, FLOOR - 40, 420, 200, 0, Math.PI, 0); ctx.fill(); }
    ctx.fillStyle = '#5FD067'; ctx.fillRect(view.x0 - 10, FLOOR - 40, view.x1 - view.x0 + 20, 160);
    ctx.fillStyle = '#F5D7A1'; ctx.fillRect(view.x0 - 10, FLOOR, view.x1 - view.x0 + 20, 120);
    for (let x = Math.floor(view.x0 / 40) * 40; x < view.x1; x += 40) { ctx.fillStyle = '#4CBF5A'; ctx.beginPath(); ctx.moveTo(x, FLOOR - 40); ctx.lineTo(x + 8, FLOOR - 58); ctx.lineTo(x + 16, FLOOR - 40); ctx.fill(); }
    return;
  }
  for (const r of sc.rooms) {
    if (r.x1 < view.x0 || r.x0 > view.x1) continue;
    ctx.fillStyle = r.wall; ctx.fillRect(r.x0, -3000, r.x1 - r.x0, FLOOR + 3000);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x0, -3000, r.x1 - r.x0, FLOOR + 3000); ctx.clip();
    ctx.fillStyle = '#ffffff55';
    if (r.pat === 'stripes') for (let x = r.x0; x < r.x1; x += 60) ctx.fillRect(x, -3000, 26, FLOOR + 3000);
    if (r.pat === 'dots') for (let x = r.x0 + 30; x < r.x1; x += 70) for (let y = -1360; y < FLOOR; y += 70) { ctx.beginPath(); ctx.arc(x + (Math.abs(y / 70) % 2) * 35, y, 8, 0, TAU); ctx.fill(); }
    if (r.pat === 'tiles') { ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 3; for (let x = r.x0; x < r.x1; x += 70) { ctx.beginPath(); ctx.moveTo(x, -3000); ctx.lineTo(x, FLOOR); ctx.stroke(); } for (let y = -1400; y < FLOOR; y += 70) { ctx.beginPath(); ctx.moveTo(r.x0, y); ctx.lineTo(r.x1, y); ctx.stroke(); } }
    ctx.restore();
    ctx.fillStyle = r.floor; ctx.fillRect(r.x0, FLOOR, r.x1 - r.x0, 140);
    ctx.strokeStyle = '#00000018'; ctx.lineWidth = 3; for (let x = r.x0; x < r.x1; x += 120) { ctx.beginPath(); ctx.moveTo(x, FLOOR); ctx.lineTo(x - 30, FLOOR + 140); ctx.stroke(); }
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(r.x0, FLOOR - 18, r.x1 - r.x0, 18);
    ctx.fillStyle = '#00000022'; ctx.font = 'bold 34px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.name, (r.x0 + r.x1) / 2, 60);
  }
  for (let i = 1; i < (sc.rooms || []).length; i++) { const x = sc.rooms[i].x0; box(ctx, x - 14, -3000, 28, FLOOR + 3000, '#FFFFFF', 0, 3); }
  for (const [wx, ww] of sc.windows || []) {
    box(ctx, wx, 180, ww, 230, '#FFFFFF', 12);
    const g = ctx.createLinearGradient(0, 195, 0, 395); g.addColorStop(0, '#7FD1FF'); g.addColorStop(1, '#C9F0FF');
    rr(ctx, wx + 14, 194, ww - 28, 202, 6); ctx.fillStyle = g; ctx.fill();
    circ(ctx, wx + ww * 0.7, 250, 22, '#FFE45C', 0); circ(ctx, wx + ww * 0.3, 300, 26, '#fff', 0); circ(ctx, wx + ww * 0.3 + 30, 295, 30, '#fff', 0);
    line(ctx, [[wx + ww / 2, 194], [wx + ww / 2, 396]], '#FFFFFF', 8); line(ctx, [[wx + 14, 295], [wx + ww - 14, 295]], '#FFFFFF', 8);
    box(ctx, wx - 20, 400, ww + 40, 22, '#FFFFFF', 8, 3);
  }
  for (const [rx, rw, col] of sc.rugs || []) { ctx.beginPath(); ctx.ellipse(rx + rw / 2, FLOOR + 40, rw / 2, 32, 0, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 6; ctx.stroke(); }
  if (sc.sign) { box(ctx, sc.w / 2 - 300, 70, 600, 80, '#E5484D', 20); ctx.fillStyle = '#fff'; ctx.font = 'bold 44px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sc.sign, sc.w / 2, 112); }
}
