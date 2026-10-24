/* Bucinca Krockarenan – delar (kaross, hjul, vapen), nivåer, priser, kraft och datormotståndare.
   En "bygge" sparas som {c: kaross, w: hjul, s: {plats: vapen}}. Inför en strid görs den om till ett
   "fullt bygge" med nivåer {c, cl, w, s: {plats: [vapen, nivå]}} som både värd och klienter förstår. */
'use strict';
const KR = (() => {
  const CHASSIS = {
    lada: { name: 'Lådbilen', icon: '📦', L: 2.2, H: 0.8, hp: 300, mass: 300, wheels: [-0.72, 0.72], slots: ['front', 'top', 'back'], speed: 1, price: 0, desc: 'Stadig allroundbil – bra att börja med' },
    kil: { name: 'Kilen', icon: '📐', L: 2.4, H: 0.55, hp: 260, mass: 260, wheels: [-0.82, 0.82], slots: ['front', 'top', 'back'], speed: 1.1, price: 600, wedge: true, desc: 'Låg och spetsig – kör in under motståndaren' },
    snabb: { name: 'Snabbisen', icon: '🏎️', L: 2.0, H: 0.6, hp: 210, mass: 200, wheels: [-0.68, 0.68], slots: ['front', 'top'], speed: 1.35, price: 900, desc: 'Lätt och supersnabb men tål mindre' },
    pickup: { name: 'Pickupen', icon: '🛻', L: 2.8, H: 0.9, hp: 400, mass: 420, wheels: [-0.98, 0.98], slots: ['front', 'top', 'top2', 'back'], speed: 0.95, price: 1500, desc: 'Fyra platser för vapen' },
    tank: { name: 'Stridsvagnen', icon: '🚜', L: 3.0, H: 1.0, hp: 560, mass: 650, wheels: [-1.1, 0, 1.1], slots: ['front', 'top', 'top2', 'back'], speed: 0.8, price: 2600, desc: 'Tung, tålig och svår att välta' }
  };
  const WHEELS = {
    vanlig: { name: 'Vanliga', icon: '⚫', r: 0.34, grip: 1.0, spd: 1.0, mass: 30, price: 0, desc: 'Helt vanliga hjul' },
    racing: { name: 'Racing', icon: '🏁', r: 0.3, grip: 0.85, spd: 1.25, mass: 24, price: 500, desc: 'Snabba men halare' },
    monster: { name: 'Monster', icon: '🛞', r: 0.5, grip: 1.15, spd: 0.92, mass: 45, price: 900, desc: 'Stora hjul – kör över hinder' },
    tagg: { name: 'Taggdäck', icon: '🌵', r: 0.36, grip: 1.6, spd: 1.0, mass: 35, price: 1200, desc: 'Fastnar i golvet – svåra att knuffa' }
  };
  const WEAPONS = {
    sag: { name: 'Cirkelsåg', icon: '🪚', slots: ['front', 'top', 'back'], dmg: 62, mass: 25, price: 0, desc: 'Sågar hela tiden när den nuddar', unit: 'skada/s' },
    lans: { name: 'Lans', icon: '🗡️', slots: ['front', 'back'], dmg: 30, mass: 20, price: 0, desc: 'Gör mer skada ju fortare man krockar', unit: 'skada/stöt' },
    hammare: { name: 'Hammare', icon: '🔨', slots: ['top', 'top2'], dmg: 78, mass: 35, price: 700, desc: 'Slår ner på motståndaren', unit: 'skada/slag' },
    raket: { name: 'Raketgevär', icon: '🚀', slots: ['top', 'top2'], dmg: 52, mass: 30, price: 1100, desc: 'Skjuter raketer på långt håll', unit: 'skada/raket' },
    laser: { name: 'Laser', icon: '🔦', slots: ['top', 'top2', 'front'], dmg: 38, mass: 25, price: 1600, desc: 'Bränner på avstånd i korta skurar', unit: 'skada/s' },
    boost: { name: 'Turbo', icon: '🔥', slots: ['back'], dmg: 0, mass: 20, price: 500, desc: 'Raketknuff framåt med jämna mellanrum', unit: '' },
    lyft: { name: 'Lyftarm', icon: '🦾', slots: ['front'], dmg: 14, mass: 30, price: 800, desc: 'Slänger upp motståndaren i luften', unit: 'skada' },
    skold: { name: 'Sköld', icon: '🛡️', slots: ['front', 'back', 'top', 'top2'], dmg: 0, mass: 40, price: 400, desc: 'Skyddar och ger mer liv', unit: '' }
  };
  const SLOT_NAME = { front: 'Fram', top: 'Tak', top2: 'Tak bak', back: 'Bak' };
  const MAXLV = 10;
  const mult = lv => 1 + 0.18 * (Math.max(1, lv) - 1);
  const upCost = (price, lv) => Math.round(((price || 250) * 0.32 + 60) * Math.pow(lv, 1.35) / 10) * 10;

  /* fullt bygge (med nivåer) av ett sparat bygge och ägda nivåer */
  function full(build, own) {
    const c = CHASSIS[build.c] ? build.c : 'lada';
    const w = WHEELS[build.w] ? build.w : 'vanlig';
    const s = {};
    const used = new Set();
    for (const sl of CHASSIS[c].slots) {
      const id = build.s && build.s[sl];
      if (id && WEAPONS[id] && WEAPONS[id].slots.includes(sl) && !used.has(id) && (!own || own.weapons[id])) {
        s[sl] = [id, own ? own.weapons[id] : 1]; used.add(id);
      }
    }
    return { c, cl: own ? (own.chassis[c] || 1) : 1, w, s };
  }
  /* säkra upp ett bygge som kommer över nätverket */
  function sanitize(fb) {
    const c = fb && CHASSIS[fb.c] ? fb.c : 'lada';
    const out = { c, cl: Math.max(1, Math.min(MAXLV, (fb && fb.cl) | 0)), w: fb && WHEELS[fb.w] ? fb.w : 'vanlig', s: {} };
    const used = new Set();
    for (const sl of CHASSIS[c].slots) {
      const e = fb && fb.s && fb.s[sl];
      if (Array.isArray(e) && WEAPONS[e[0]] && WEAPONS[e[0]].slots.includes(sl) && !used.has(e[0])) {
        out.s[sl] = [e[0], Math.max(1, Math.min(MAXLV, e[1] | 0))]; used.add(e[0]);
      }
    }
    return out;
  }
  function hpOf(fb) {
    let hp = CHASSIS[fb.c].hp * mult(fb.cl);
    for (const sl in fb.s) if (fb.s[sl][0] === 'skold') hp += 55 * mult(fb.s[sl][1]);
    return Math.round(hp);
  }
  /* kraft = ungefärlig styrka att visa för spelaren */
  function power(fb) {
    let p = hpOf(fb) / 6;
    const W = { sag: 1.3, lans: 1.4, hammare: 0.9, raket: 1.0, laser: 1.2, boost: 0, lyft: 1.5, skold: 0 };
    for (const sl in fb.s) {
      const [id, lv] = fb.s[sl];
      p += WEAPONS[id].dmg * mult(lv) * (W[id] || 1) + (id === 'boost' ? 30 * mult(lv) : 0) + (id === 'skold' ? 8 * mult(lv) : 0);
      if (sl === 'back' && id !== 'boost' && id !== 'skold') p -= WEAPONS[id].dmg * mult(lv) * 0.5;   // bakåt är inte lika bra
    }
    p *= (CHASSIS[fb.c].speed + WHEELS[fb.w].spd) / 2 * 0.3 + 0.7;
    return Math.max(1, Math.round(p));
  }

  /* ---------- datormotståndare (stegen) ---------- */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ADJ = ['Lilla', 'Busiga', 'Snabba', 'Galna', 'Vilda', 'Starka', 'Rostiga', 'Turbo-', 'Super-', 'Mega-', 'Ultra-', 'Kung'];
  const LADDER = 24;
  function bot(rank, nChars) {
    const r = rng(1000 + rank * 7919);
    const pickW = (arr) => arr[Math.floor(r() * arr.length)];
    const cs = rank < 2 ? ['lada'] : rank < 5 ? ['lada', 'kil'] : rank < 9 ? ['kil', 'snabb', 'lada'] : rank < 14 ? ['pickup', 'kil', 'snabb'] : ['pickup', 'tank', 'kil', 'snabb'];
    const c = pickW(cs);
    const w = rank < 3 ? 'vanlig' : pickW(rank < 8 ? ['vanlig', 'racing', 'monster'] : ['racing', 'monster', 'tagg', 'vanlig']);
    const lvBase = 1 + Math.floor(rank * 0.42);
    const lv = () => Math.max(1, Math.min(MAXLV, lvBase + Math.floor(r() * 3) - 1));
    const nW = Math.min(CHASSIS[c].slots.length, 1 + Math.floor(rank / 4) + (r() < 0.4 ? 1 : 0));
    const avail = rank < 2 ? ['sag'] : rank < 3 ? ['sag', 'lans'] : rank < 6 ? ['sag', 'lans', 'skold', 'boost', 'hammare'] : Object.keys(WEAPONS);
    const s = {}; const used = new Set();
    const slots = CHASSIS[c].slots.slice().sort((a, b) => (a === 'front' ? -1 : 0) - (b === 'front' ? -1 : 0));
    for (const sl of slots) {
      if (Object.keys(s).length >= nW) break;
      const opts = avail.filter(id => WEAPONS[id].slots.includes(sl) && !used.has(id) && !(sl === 'back' && rank < 8 && id !== 'boost' && id !== 'skold'));
      if (!opts.length) continue;
      const id = pickW(opts); s[sl] = [id, lv()]; used.add(id);
    }
    if (!s.front) { s.front = [used.has('sag') ? 'lans' : 'sag', lv()]; }
    const fb = { c, cl: rank < 2 ? 1 : lv(), w, s };
    const ch = Math.floor(r() * nChars);
    return { fb, ch, adj: ADJ[rank % ADJ.length], reward: 60 + rank * 22 };
  }

  return { CHASSIS, WHEELS, WEAPONS, SLOT_NAME, MAXLV, mult, upCost, full, sanitize, hpOf, power, bot, LADDER };
})();
if (typeof module !== 'undefined') module.exports = KR;
