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
    tank: { name: 'Stridsvagnen', icon: '🚜', L: 3.0, H: 1.0, hp: 560, mass: 650, wheels: [-1.1, 0, 1.1], slots: ['front', 'top', 'top2', 'back'], speed: 0.8, price: 2600, desc: 'Tung, tålig och svår att välta' },
    buggy: { name: 'Strandbuggyn', icon: '🏖️', L: 2.1, H: 0.5, hp: 240, mass: 220, wheels: [-0.8, 0.8], slots: ['front', 'top', 'back'], speed: 1.28, price: 1100, wheelScale: 1.15, desc: 'Snabb och studsig med stora hjul' },
    soffa: { name: 'Soffbilen', icon: '🛋️', L: 2.3, H: 0.75, hp: 340, mass: 330, wheels: [-0.7, 0.7], slots: ['front', 'top', 'top2', 'back'], speed: 0.98, price: 1300, desc: 'Mysig soffa på hjul – med fyra vapenplatser' },
    glass: { name: 'Glassbilen', icon: '🍦', L: 2.9, H: 1.0, hp: 470, mass: 520, wheels: [-0.95, 0.95], slots: ['front', 'top', 'top2', 'back'], speed: 0.9, price: 1900, desc: 'Ding-dong! Stor, stark och glad' },
    monster: { name: 'Monstertrucken', icon: '🦖', L: 2.6, H: 0.85, hp: 430, mass: 470, wheels: [-0.85, 0.85], slots: ['front', 'top', 'back'], speed: 1.0, price: 2200, wheelScale: 1.45, desc: 'Jättehjul – rullar över motståndaren' },
    buss: { name: 'Skolbussen', icon: '🚌', L: 3.4, H: 1.1, hp: 640, mass: 720, wheels: [-1.15, 1.15], slots: ['front', 'top', 'top2', 'back'], speed: 0.75, price: 3200, desc: 'Störst av alla – nästan omöjlig att välta' }
  };
  const WHEELS = {
    vanlig: { name: 'Vanliga', icon: '⚫', r: 0.34, grip: 1.0, spd: 1.0, mass: 30, price: 0, desc: 'Helt vanliga hjul' },
    racing: { name: 'Racing', icon: '🏁', r: 0.3, grip: 0.85, spd: 1.25, mass: 24, price: 500, desc: 'Snabba men halare' },
    monster: { name: 'Monster', icon: '🛞', r: 0.5, grip: 1.15, spd: 0.92, mass: 45, price: 900, desc: 'Stora hjul – kör över hinder' },
    tagg: { name: 'Taggdäck', icon: '🌵', r: 0.36, grip: 1.6, spd: 1.0, mass: 35, price: 1200, desc: 'Fastnar i golvet – svåra att knuffa' },
    studs: { name: 'Studsbollar', icon: '🏀', r: 0.4, grip: 0.95, spd: 1.08, mass: 26, price: 700, bounce: true, desc: 'Boing! Mjuka och studsiga' },
    kugg: { name: 'Kugghjul', icon: '⚙️', r: 0.37, grip: 1.9, spd: 0.85, mass: 42, price: 1500, desc: 'Biter sig fast – går inte att knuffa' },
    guld: { name: 'Guldfälgar', icon: '🥇', r: 0.35, grip: 1.25, spd: 1.18, mass: 30, price: 2500, desc: 'Snabba, greppiga och snygga' }
  };
  const WEAPONS = {
    sag: { name: 'Cirkelsåg', icon: '🪚', slots: ['front', 'top', 'back'], dmg: 62, mass: 25, price: 0, desc: 'Sågar hela tiden när den nuddar', unit: 'skada/s' },
    lans: { name: 'Lans', icon: '🗡️', slots: ['front', 'back'], dmg: 25, mass: 20, price: 0, desc: 'Gör mer skada ju fortare man krockar', unit: 'skada/stöt' },
    hammare: { name: 'Hammare', icon: '🔨', slots: ['top', 'top2'], dmg: 78, mass: 35, price: 700, desc: 'Slår ner på motståndaren', unit: 'skada/slag' },
    raket: { name: 'Raketgevär', icon: '🚀', slots: ['top', 'top2'], dmg: 52, mass: 30, price: 1100, desc: 'Skjuter raketer på långt håll', unit: 'skada/raket' },
    laser: { name: 'Laser', icon: '🔦', slots: ['top', 'top2', 'front'], dmg: 38, mass: 25, price: 1600, desc: 'Bränner på avstånd i korta skurar', unit: 'skada/s' },
    boost: { name: 'Turbo', icon: '🔥', slots: ['back'], dmg: 0, mass: 20, price: 500, desc: 'Raketknuff framåt med jämna mellanrum', unit: '' },
    lyft: { name: 'Lyftarm', icon: '🦾', slots: ['front'], dmg: 30, mass: 30, price: 800, desc: 'Slänger upp motståndaren i luften', unit: 'skada' },
    skold: { name: 'Sköld', icon: '🛡️', slots: ['front', 'back', 'top', 'top2'], dmg: 0, mass: 40, price: 400, desc: 'Skyddar och ger mer liv', unit: '' },
    borr: { name: 'Borr', icon: '🌀', slots: ['front', 'back'], dmg: 76, mass: 30, price: 900, desc: 'Borrar sig igenom även sköldar', unit: 'skada/s' },
    kedja: { name: 'Motorsåg', icon: '⛓️', slots: ['front', 'top'], dmg: 60, mass: 28, price: 1000, desc: 'Lång sågkedja som når långt', unit: 'skada/s' },
    eld: { name: 'Eldkastare', icon: '🔥', slots: ['top', 'top2', 'front'], dmg: 26, mass: 26, price: 1400, desc: 'Sätter eld på motståndaren – det fortsätter brinna', unit: 'skada/s + brand' },
    kanon: { name: 'Kanon', icon: '💣', slots: ['top', 'top2'], dmg: 70, mass: 45, price: 1800, desc: 'Tunga kulor som knuffar bort motståndaren', unit: 'skada/kula' },
    magnet: { name: 'Magnet', icon: '🧲', slots: ['top', 'top2'], dmg: 0, mass: 30, price: 1200, desc: 'Drar motståndaren rakt in i dina vapen', unit: '' },
    taggar: { name: 'Taggpansar', icon: '🦔', slots: ['front', 'back'], dmg: 26, mass: 35, price: 650, desc: 'Gör skada varje gång någon krockar in i den', unit: 'skada/krock' },
    boxare: { name: 'Boxhandske', icon: '🥊', slots: ['front'], dmg: 48, mass: 30, price: 1100, desc: 'Pang! Boxar bort motståndaren', unit: 'skada/slag' }
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
    for (const sl in fb.s) {
      if (fb.s[sl][0] === 'skold') hp += 55 * mult(fb.s[sl][1]);
      if (fb.s[sl][0] === 'taggar') hp += 25 * mult(fb.s[sl][1]);
    }
    return Math.round(hp);
  }
  /* kraft = ungefärlig styrka att visa för spelaren */
  function power(fb) {
    let p = hpOf(fb) / 6;
    const W = { sag: 1.3, lans: 1.4, hammare: 0.9, raket: 1.0, laser: 1.2, boost: 0, lyft: 1.5, skold: 0, borr: 1.25, kedja: 1.3, eld: 1.7, kanon: 0.9, magnet: 0, taggar: 1.0, boxare: 1.1 };
    const EXTRA = { boost: 30, skold: 8, magnet: 35, taggar: 6 };
    for (const sl in fb.s) {
      const [id, lv] = fb.s[sl];
      p += WEAPONS[id].dmg * mult(lv) * (W[id] == null ? 1 : W[id]) + (EXTRA[id] || 0) * mult(lv);
      if (sl === 'back' && !['boost', 'skold', 'taggar'].includes(id)) p -= WEAPONS[id].dmg * mult(lv) * 0.5;   // bakåt är inte lika bra
    }
    p *= (CHASSIS[fb.c].speed + WHEELS[fb.w].spd) / 2 * 0.3 + 0.7;
    return Math.max(1, Math.round(p));
  }

  /* ---------- datormotståndare (stegen) ---------- */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  /* motståndartyper: namn, karosser, hjul och vapen per plats (i prioritetsordning) */
  const ARCH = {
    sagis: { t: 'Sågis', cs: ['lada', 'kil'], w: ['vanlig', 'tagg'], s: [['front', 'sag'], ['top', 'kedja'], ['back', 'taggar']] },
    lansen: { t: 'Lansriddaren', cs: ['lada', 'pickup'], w: ['vanlig', 'racing'], s: [['front', 'lans'], ['top', 'skold'], ['back', 'boost'], ['top2', 'hammare']] },
    hammarhaj: { t: 'Hammarhajen', cs: ['lada', 'pickup'], w: ['vanlig', 'monster'], s: [['top', 'hammare'], ['front', 'sag'], ['top2', 'skold'], ['back', 'boost']] },
    turbo: { t: 'Turbo-Tuta', cs: ['snabb', 'buggy'], w: ['racing', 'guld'], s: [['front', 'lans'], ['back', 'boost'], ['top', 'sag']] },
    flippern: { t: 'Flippern', cs: ['kil'], w: ['tagg', 'vanlig'], s: [['front', 'lyft'], ['top', 'hammare'], ['back', 'boost']] },
    boxaren: { t: 'Boxaren', cs: ['lada', 'soffa'], w: ['vanlig', 'kugg'], s: [['front', 'boxare'], ['top', 'skold'], ['top2', 'kanon'], ['back', 'taggar']] },
    borrbaggen: { t: 'Borrbaggen', cs: ['kil', 'lada'], w: ['kugg', 'tagg'], s: [['front', 'borr'], ['top', 'sag'], ['back', 'taggar']] },
    raket: { t: 'Raket-Rut', cs: ['pickup', 'lada'], w: ['vanlig', 'racing'], s: [['top', 'raket'], ['front', 'skold'], ['top2', 'kanon'], ['back', 'boost']] },
    laser: { t: 'Laserlisa', cs: ['snabb', 'pickup'], w: ['racing', 'guld'], s: [['top', 'laser'], ['front', 'skold'], ['top2', 'eld']] },
    eld: { t: 'Eldsprutan', cs: ['glass', 'lada'], w: ['vanlig', 'studs'], s: [['top', 'eld'], ['front', 'sag'], ['top2', 'skold'], ['back', 'boost']] },
    kanon: { t: 'Kanonkulan', cs: ['tank', 'pickup'], w: ['monster', 'kugg'], s: [['top', 'kanon'], ['front', 'skold'], ['top2', 'raket'], ['back', 'taggar']] },
    magnet: { t: 'Magnetmonstret', cs: ['pickup', 'soffa'], w: ['kugg', 'tagg'], s: [['top', 'magnet'], ['front', 'sag'], ['top2', 'hammare'], ['back', 'taggar']] },
    glass: { t: 'Glass-Gunnar', cs: ['glass'], w: ['studs', 'vanlig'], s: [['front', 'kedja'], ['top', 'eld'], ['top2', 'skold'], ['back', 'boost']] },
    soffa: { t: 'Soffpotatisen', cs: ['soffa'], w: ['studs', 'kugg'], s: [['front', 'boxare'], ['top', 'laser'], ['top2', 'skold'], ['back', 'taggar']] },
    monster: { t: 'Monster-Maja', cs: ['monster'], w: ['monster'], s: [['front', 'borr'], ['top', 'hammare'], ['back', 'boost']] },
    buss: { t: 'Skolbuss-Bengt', cs: ['buss'], w: ['vanlig', 'kugg'], s: [['front', 'lans'], ['top', 'raket'], ['top2', 'hammare'], ['back', 'taggar']] },
    // bossar
    boss1: { t: '👑 Järnjätten', boss: true, cs: ['tank'], w: ['kugg'], s: [['front', 'sag'], ['top', 'hammare'], ['top2', 'skold'], ['back', 'taggar']] },
    boss2: { t: '👑 Eld-Kungen', boss: true, cs: ['glass'], w: ['guld'], s: [['front', 'borr'], ['top', 'eld'], ['top2', 'kanon'], ['back', 'boost']] },
    boss3: { t: '👑 Mega-Monstret', boss: true, cs: ['monster'], w: ['monster'], s: [['front', 'lyft'], ['top', 'magnet'], ['back', 'taggar']] },
    boss4: { t: '👑 Arenans Kung', boss: true, cs: ['buss'], w: ['guld'], s: [['front', 'kedja'], ['top', 'laser'], ['top2', 'kanon'], ['back', 'boost']] }
  };
  const ORDER = ['sagis', 'lansen', 'hammarhaj', 'turbo', 'flippern', 'boxaren', 'sagis', 'borrbaggen', 'raket', 'boss1',
    'laser', 'eld', 'lansen', 'kanon', 'soffa', 'magnet', 'glass', 'hammarhaj', 'flippern', 'boss2',
    'monster', 'turbo', 'borrbaggen', 'boxaren', 'raket', 'eld', 'buss', 'laser', 'magnet', 'boss3',
    'kanon', 'glass', 'sagis', 'soffa', 'monster', 'buss', 'flippern', 'eld', 'raket', 'boss4'];
  const LADDER = ORDER.length;
  function bot(rank, nChars) {
    const r = rng(1000 + rank * 7919);
    const pickW = (arr) => arr[Math.floor(r() * arr.length)];
    const A = ARCH[ORDER[Math.min(rank, LADDER - 1)]];
    const c = pickW(A.cs), w = pickW(A.w);
    const lvBase = 1 + Math.floor(rank * 0.24) + (A.boss ? 1 : 0);
    const lv = () => Math.max(1, Math.min(MAXLV, lvBase + Math.floor(r() * 2)));
    const nW = A.boss ? 9 : Math.min(4, 1 + Math.floor(rank / 6));
    const s = {}; const used = new Set();
    for (const [sl, id] of A.s) {
      if (Object.keys(s).length >= nW) break;
      if (!CHASSIS[c].slots.includes(sl) || !WEAPONS[id].slots.includes(sl) || used.has(id)) continue;
      s[sl] = [id, lv()]; used.add(id);
    }
    const fb = { c, cl: rank < 2 ? 1 : Math.min(MAXLV, lv() + (A.boss ? 1 : 0)), w, s };
    const ch = Math.floor(r() * nChars);
    return { fb, ch, title: A.t, boss: !!A.boss, reward: Math.round((60 + rank * 22) * (A.boss ? 2 : 1)) };
  }

  return { CHASSIS, WHEELS, WEAPONS, SLOT_NAME, MAXLV, mult, upCost, full, sanitize, hpOf, power, bot, LADDER };
})();
if (typeof module !== 'undefined') module.exports = KR;
