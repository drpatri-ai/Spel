/* Bucinca Spel – gemensam kärna för alla spel.
   Figurer, namn och bilder, ljud & vibration, bakgrundsbubblor, vinstfirande, konfetti
   och redigering av figurer. Ändra här så gäller det i alla spel.
   Varje spelsida ligger i assets-roten (t.ex. fyra.html) så sökvägar som 'avatars/1.jpg' fungerar överallt. */
'use strict';
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/* ---------- lagring ----------
   makeStore('f4') ger en egen låda per spel; shared är gemensam för alla spel. */
function makeStore(prefix) {
  return {
    get(k, d) { try { const v = localStorage.getItem(prefix + '.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(prefix + '.' + k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(prefix + '.' + k); } catch (e) { } }
  };
}
const shared = makeStore('b');

/* ---------- figurerna (gemensamma för alla spel) ---------- */
const CHARS = [
  { name: 'Leah', c: '#34C759', d: '#219A40', img: 'avatars/1.jpg', full: 'avatars/full1.webp' },
  { name: 'Leon', c: '#FF8A3D', d: '#D9621A', img: 'avatars/2.jpg', full: 'avatars/full2.webp' },
  { name: 'Patriot', c: '#8B7BFF', d: '#6252D9', img: 'avatars/3.jpg', full: 'avatars/full3.webp' },
  { name: 'Hanna', c: '#FF6FAE', d: '#D94788', img: 'avatars/4.jpg', full: 'avatars/full4.webp' },
  { name: 'Marissa', c: '#F5B700', d: '#C98F00', img: 'avatars/5.jpg', full: 'avatars/full5.webp' },
  { name: 'Elita', c: '#14C8C8', d: '#0E9A9A', img: 'avatars/6.jpg', full: 'avatars/full6.webp' },
  { name: 'Besnik', c: '#FF5A4D', d: '#C9382E', img: 'avatars/7.jpg', full: 'avatars/full7.webp' },
  { name: 'Saranda', c: '#3B9DFF', d: '#2373C9', img: 'avatars/8.jpg', full: 'avatars/full8.webp' },
  { name: 'Gjyshja', c: '#B5713A', d: '#8A5226', img: 'avatars/9.jpg', full: 'avatars/full9.webp' },
  { name: 'Gjyshi', c: '#6B7A99', d: '#4E5A73', img: 'avatars/10.jpg', full: 'avatars/full10.webp' }
];
const charName = i => shared.get('name' + i, CHARS[i].name) || CHARS[i].name;
const avatarSrc = i => shared.get('img' + i, null) || CHARS[i].img;
const fullOf = i => { const own = shared.get('full' + i, null) || shared.get('img' + i, null); return own ? { src: own, photo: true } : { src: CHARS[i].full, photo: false }; };
const styleOf = i => `--c:${CHARS[i].c};--d:${CHARS[i].d}`;
const avHTML = (i, cls = '') => `<div class="av ${cls}" style="${styleOf(i)}"><img src="${avatarSrc(i)}" alt=""></div>`;

/* ---------- ljud & vibration (gemensamma inställningar) ---------- */
const SND = Object.assign({ sound: true, vib: true }, shared.get('snd', {}));
const saveSnd = () => shared.set('snd', SND);
let AC = null, NOISE = null;
function ac() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function tone(f, dur, o = {}) {
  if (!SND.sound) return;
  const a = ac(); if (!a) return;
  const t = a.currentTime + (o.delay || 0);
  const osc = a.createOscillator(), g = a.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t); osc.stop(t + dur + 0.03);
}
function noise(dur, o = {}) {
  if (!SND.sound) return;
  const a = ac(); if (!a) return;
  if (!NOISE) { NOISE = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = NOISE.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = a.currentTime + (o.delay || 0);
  const src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  src.buffer = NOISE; flt.type = o.type || 'bandpass'; flt.frequency.value = o.f || 1200; flt.Q.value = o.q || 1;
  g.gain.setValueAtTime(o.vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(a.destination);
  src.start(t); src.stop(t + dur + 0.02);
}
function buzz(ms) {
  if (!SND.vib) return;
  try { if (window.Android && Android.vibrate) Android.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { }
}
const CORE_SFX = {
  tap: () => tone(720, .07, { type: 'triangle', vol: .1 }),
  pick: () => [660, 990].forEach((f, i) => tone(f, .1, { type: 'triangle', vol: .12, delay: i * .07 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .24, { type: 'triangle', vol: .15, delay: i * .1 })),
  bonk: () => tone(150, .12, { type: 'square', vol: .05, to: 110 })
};

/* ---------- navigering mellan spelen ---------- */
function goHub() { location.href = 'index.html'; }
/* nätverksmatcher annonseras med prefix (krock:, studs:, box:) – fotboll utan – så att "Gå med" öppnar rätt spel */
function netGameOf(name) {
  name = String(name || '');
  if (/^krock:/.test(name)) return { page: 'krock.html', label: '💥 ' + name.slice(6) };
  if (/^studs:/.test(name)) return { page: 'studs.html', label: '🎯 ' + name.slice(6) };
  if (/^box:/.test(name)) return { page: 'box.html', label: '🥊 ' + name.slice(4) };
  return { page: 'boll.html', label: '⚽ ' + name.replace(/^boll:/, '') };
}

/* ---------- bakgrundsbubblor ---------- */
function bubbles(el) {
  el = el || $('bg');
  if (!el || el.childElementCount) return;
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('i');
    const s = 20 + Math.random() * 90;
    b.style.cssText = `width:${s}px;height:${s}px;left:${Math.random() * 100}%;animation-duration:${14 + Math.random() * 18}s;animation-delay:${-Math.random() * 30}s;--dx:${(Math.random() - .5) * 120}px`;
    el.appendChild(b);
  }
}

/* ---------- vinstfirande: hela figuren dansar över skärmen ----------
   Kräver <div id="party"></div> och <canvas id="confetti"></canvas> på sidan. */
function celebrate(ci, title, sub, emojis) {
  return new Promise(resolve => {
    const f = fullOf(ci), C = CHARS[ci];
    const letters = [...title].map((c, i) => c === ' ' ? '<span class="sp"></span>' : `<span style="animation-delay:${.35 + i * .045}s">${esc(c)}</span>`).join('');
    const stars = (emojis || ['⭐', '🎉', '✨', '🏆', '🌟', '🎊', '✨', '⭐']).map((e, i) =>
      `<span class="star" style="--a:${i * 45}deg;animation-delay:${.6 + i * .12}s">${e}</span>`).join('');
    const party = $('party');
    party.style.cssText = `--c:${C.c};--d:${C.d}`;
    party.innerHTML = `<div class="rays"></div><div class="ptitle">${letters}</div>${sub ? `<div class="psub">${esc(sub)}</div>` : ''}
      <div class="pfig"><div class="pshadow"></div><div class="pjump">${stars}<img class="${f.photo ? 'photo' : ''}" src="${f.src}" alt=""></div></div>
      <p class="pskip">Tryck för att fortsätta</p>`;
    party.className = 'on';
    confetti(); setTimeout(confetti, 1300);
    let jumps = 0;
    const boing = setInterval(() => { if (jumps++ < 4) { tone(260, .18, { to: 620, vol: .12 }); buzz(12); } }, 800);
    setTimeout(() => tone(330, .2, { to: 700, vol: .14 }), 150);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true; clearInterval(boing);
      party.classList.add('out');
      setTimeout(() => { party.className = ''; party.innerHTML = ''; resolve(); }, 450);
    };
    const t = setTimeout(finish, 4200);
    party.onclick = () => { clearTimeout(t); finish(); };
  });
}
function confetti() {
  const cv = $('confetti'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
  const cols = [...CHARS.map(c => c.c), '#FFD93D', '#3B9DFF', '#ffffff'];
  const parts = Array.from({ length: 170 }, () => ({
    x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45,
    vx: (Math.random() - .5) * W * .028, vy: -(Math.random() * H * .028 + H * .008),
    s: (6 + Math.random() * 9) * devicePixelRatio, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
    c: pick(cols), round: Math.random() < .3
  }));
  const end = performance.now() + 3200;
  (function frame(now) {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += H * .0009; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); }
      else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (now < end) requestAnimationFrame(frame); else ctx.clearRect(0, 0, W, H);
  })(performance.now());
}

/* ---------- inställningsrader som alla spel kan visa ---------- */
const canVibrate = () => !!(window.Android || navigator.vibrate);   // iPhone saknar vibration i webbläsaren
function soundRowsHTML() {
  const tg = (k, label, icon) => `<div class="row"><span style="font-size:28px">${icon}</span><div class="grow"><h4 style="margin:0">${label}</h4></div>
     <button class="toggle ${SND[k] ? 'on' : ''}" data-snd="${k}" aria-label="${label}"></button></div>`;
  return tg('sound', 'Ljud', '🔊') + (canVibrate() ? tg('vib', 'Vibration', '📳') : '');
}
function bindSoundRows(root) {
  root.querySelectorAll('[data-snd]').forEach(t => t.onclick = () => {
    SND[t.dataset.snd] = !SND[t.dataset.snd]; saveSnd(); t.classList.toggle('on'); CORE_SFX.tap(); buzz(15);
  });
}

/* ---------- redigera figurer (namn och bild) – används på startsidan ---------- */
let _editChar = -1, _afterEdit = null;
function charEditorHTML() {
  return CHARS.map((_, i) => `<div class="row" style="${styleOf(i)}">${avHTML(i)}
      <div class="grow"><input type="text" maxlength="14" value="${esc(charName(i))}" data-n="${i}">
      <div class="acts"><button class="btn small" data-img="${i}">📷 Byt bild</button>
      ${shared.get('img' + i, null) ? `<button class="btn white small" data-reset="${i}">↺ Originalbild</button>` : ''}</div></div></div>`).join('');
}
function bindCharEditor(root, rebuild) {
  _afterEdit = rebuild;
  let file = $('coreFile');
  if (!file) {
    file = document.createElement('input');
    file.type = 'file'; file.accept = 'image/*'; file.id = 'coreFile'; file.hidden = true;
    document.body.appendChild(file);
    file.addEventListener('change', onPickImage);
  }
  root.querySelectorAll('input[data-n]').forEach(inp => inp.oninput = () => {
    const v = inp.value.trim();
    if (v) shared.set('name' + inp.dataset.n, v); else shared.del('name' + inp.dataset.n);
  });
  const pickImg = i => { _editChar = i; file.value = ''; file.click(); };
  root.querySelectorAll('[data-img]').forEach(b => b.onclick = () => pickImg(+b.dataset.img));
  root.querySelectorAll('.row .av').forEach(a => { const n = a.parentElement.querySelector('[data-n]'); if (n) a.onclick = () => pickImg(+n.dataset.n); });
  root.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
    shared.del('img' + b.dataset.reset); shared.del('full' + b.dataset.reset); CORE_SFX.bonk(); _afterEdit && _afterEdit();
  });
}
function onPickImage() {
  const f = this.files && this.files[0];
  if (!f || _editChar < 0) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const N0 = 320, cv = document.createElement('canvas');
      cv.width = cv.height = N0;
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2, sy = img.height > img.width ? (img.height - s) * 0.25 : 0;
      cv.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, N0, N0);
      shared.set('img' + _editChar, cv.toDataURL('image/jpeg', 0.86));
      const M = 720, k = Math.min(1, M / Math.max(img.width, img.height));
      const fc = document.createElement('canvas');
      fc.width = Math.round(img.width * k); fc.height = Math.round(img.height * k);
      fc.getContext('2d').drawImage(img, 0, 0, fc.width, fc.height);
      shared.set('full' + _editChar, fc.toDataURL('image/jpeg', 0.82));
      CORE_SFX.pick();
      _afterEdit && _afterEdit();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}

/* ---------- webbversionen (iPhone m.fl.): offlinestöd ----------
   Android-appen laddar filerna själv, där behövs ingen service worker. */
if ('serviceWorker' in navigator && !window.Android && location.hostname !== 'appassets.androidplatform.net' &&
    (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { }); });
}
