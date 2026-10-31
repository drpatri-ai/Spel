/* Bucinca Spel – internetmatch med kod.
   Ger samma gränssnitt som WebSocket-reläet i LanServer.kt, men går direkt mellan enheterna (WebRTC via PeerJS).
   Värden får en kod (t.ex. KATT-42); andra skriver koden eller skannar QR-koden.
   Värd → relä:  '*msg' till alla, '@id|msg' till en, '!id' koppla bort.  Relä → värd: '+id|…' ny, '-id' borta, 'id|msg'.
   Klient: skickar och tar emot vanliga strängar. När värden avslutar får klienterna {"t":"hostgone"}. */
'use strict';
const NET_ONLINE = (() => { const c = new URLSearchParams(location.search).get('online'); return c ? netCleanCode(c) : null; })();
const NET_WEB = 'https://drpatri-ai.github.io/Spel/';
const NET_PAGE = (location.pathname.split('/').pop() || 'index.html');
const NET_WORDS = ['KATT', 'HUND', 'HAST', 'GRIS', 'KANIN', 'UGGLA', 'RAV', 'BJORN', 'LEJON', 'TIGER', 'ZEBRA', 'PANDA', 'FISK', 'HAJ', 'APA', 'MUS', 'ALG', 'VARG', 'ORM', 'GROD', 'ANKA', 'KO', 'GET', 'FAR', 'SNIGEL', 'DRAKE', 'ROBOT', 'RAKET', 'PIRAT', 'TROLL'];
const NET_PEER = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
// för tester: egen förmedlingsserver, t.ex. {"host":"localhost","port":9000,"path":"/","secure":false}
try { Object.assign(NET_PEER, JSON.parse(localStorage.getItem('bucinca_netserver') || 'null') || {}); } catch (e) { }

function netCleanCode(c) {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = c.match(/^([A-Z]+)(\d+)$/);
  return m ? m[1] + '-' + m[2] : c;
}
function netNewCode() { return NET_WORDS[Math.floor(Math.random() * NET_WORDS.length)] + '-' + (10 + Math.floor(Math.random() * 90)); }
const netPeerId = code => 'bucinca-spel-' + netCleanCode(code).toLowerCase().replace(/[^a-z0-9]/g, '');

let _netLib = null;
function netLoadLib() {
  if (window.Peer) return Promise.resolve();
  if (_netLib) return _netLib;
  _netLib = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'shared/peerjs.min.js';
    s.onload = () => res(); s.onerror = () => { _netLib = null; rej(new Error('lib')); };
    document.head.appendChild(s);
  });
  return _netLib;
}

class PeerSock {
  constructor(host, code) {
    this.host = host; this.code = netCleanCode(code); this.readyState = 0; this.reason = '';
    this.onopen = this.onmessage = this.onclose = null;
    this.conns = new Map(); this.n = 0; this.wasOpen = false;
    netLoadLib().then(() => this._start(), () => this._close('lib'));
  }
  _emit(d) { if (this.onmessage) try { this.onmessage({ data: d }); } catch (e) { console.error(e); } }
  _open() { if (this.readyState !== 0) return; this.readyState = 1; this.wasOpen = true; if (this.onopen) this.onopen(); }
  _close(reason) {
    if (this.readyState === 3) return;
    this.readyState = 3; this.reason = reason || '';
    clearTimeout(this._to);
    try { this.peer && this.peer.destroy(); } catch (e) { }
    if (this.onclose) this.onclose({ reason: this.reason });
  }
  _start() {
    if (this.readyState === 3) return;
    if (this.host) {
      const p = this.peer = new Peer(netPeerId(this.code), NET_PEER);
      p.on('open', () => this._open());
      p.on('connection', c => {
        const id = String(++this.n);
        c.on('open', () => {
          this.conns.set(id, c);
          try { c.send(JSON.stringify({ t: '_game', page: NET_PAGE })); } catch (e) { }
          this._emit('+' + id + '|internet');
        });
        c.on('data', d => { if (typeof d === 'string' && d !== '_probe') this._emit(id + '|' + d); });
        const gone = () => { if (this.conns.delete(id)) this._emit('-' + id); };
        c.on('close', gone); c.on('error', gone);
      });
      // tappad kontakt med förmedlingsservern: befintliga spelare är kvar, försök återansluta
      p.on('disconnected', () => { if (this.readyState !== 3) setTimeout(() => { try { if (!p.destroyed) p.reconnect(); } catch (e) { } }, 1500); });
      p.on('error', e => { if (e.type === 'unavailable-id' && !this.wasOpen) { netNewHostCode(); return; } if (['unavailable-id', 'browser-incompatible', 'invalid-id', 'ssl-unavailable'].includes(e.type) || !this.wasOpen) this._close(e.type); });
    } else {
      const p = this.peer = new Peer(NET_PEER);
      this._to = setTimeout(() => { if (this.readyState === 0) this._close('timeout'); }, 15000);
      p.on('open', () => {
        const c = this.conn = p.connect(netPeerId(this.code), { reliable: true, serialization: 'raw' });
        c.on('open', () => { clearTimeout(this._to); this._open(); });
        c.on('data', d => {
          if (typeof d !== 'string') return;
          if (d.charAt(0) === '{' && d.indexOf('"_game"') > 0) { try { const m = JSON.parse(d); if (m.t === '_game') { this.page = m.page; if (this.onpage) this.onpage(m.page); return; } } catch (e) { } }
          this._emit(d);
        });
        c.on('close', () => this._close('closed'));
        c.on('error', () => this._close('error'));
      });
      p.on('error', e => this._close(e.type));
    }
  }
  send(s) {
    if (this.readyState !== 1) return;
    if (!this.host) { try { this.conn.send(s); } catch (e) { } return; }
    const k = s.charAt(0);
    if (k === '*') { const m = s.slice(1); for (const c of this.conns.values()) try { c.send(m); } catch (e) { } }
    else if (k === '@') { const b = s.indexOf('|'), c = this.conns.get(s.slice(1, b)); if (c) try { c.send(s.slice(b + 1)); } catch (e) { } }
    else if (k === '!') { const c = this.conns.get(s.slice(1)); if (c) { this.conns.delete(s.slice(1)); try { c.close(); } catch (e) { } this._emit('-' + s.slice(1)); } }
  }
  close() {
    if (this.host) { for (const c of this.conns.values()) try { c.send('{"t":"hostgone"}'); } catch (e) { } }
    const p = this.peer;
    this.onclose = null;
    setTimeout(() => this._close('closed'), this.host ? 250 : 0);
    if (!p) this._close('closed');
  }
}

/* WebSocket i samma wifi – eller PeerSock på internet */
function netSocket(host) {
  if (NET_ONLINE) return new PeerSock(host, NET_ONLINE);
  return new WebSocket(`ws://${location.host}/ws${host ? '?host=1' : ''}`);
}
/* värd: ny internetmatch på den här sidan */
function netOnlineHostURL(page, params) { return `${page}?online=${encodeURIComponent(netNewCode())}&host=1${params ? '&' + params : ''}`; }
/* koden var upptagen eller fel: byt kod och ladda om */
function netNewHostCode() { const q = new URLSearchParams(location.search); q.set('online', netNewCode()); location.replace(NET_PAGE + '?' + q.toString()); }
/* klient: kolla vilket spel koden hör till och gå dit */
function netOnlineJoin(code, buildURL, status) {
  code = netCleanCode(code);
  if (!/^[A-Z]+-\d+$/.test(code)) { status && status('bad'); return; }
  status && status('wait');
  const s = new PeerSock(false, code);
  let done = false;
  const go = page => { if (done) return; done = true; s.onclose = null; try { s.close(); } catch (e) { } location.href = buildURL(page || NET_PAGE, code); };
  s.onpage = page => go(page);
  s.onopen = () => setTimeout(() => go(s.page), 1500);
  s.onclose = e => { if (!done) { done = true; status && status(e && e.reason === 'lib' ? 'lib' : 'none'); } };
}
const netWebLink = page => `${NET_WEB}${page}?online=${encodeURIComponent(NET_ONLINE || '')}`;
/* värdens kort i lobbyn: kod + QR */
function netHostCardHTML(page, cls, ok) {
  let qr = '';
  if (window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(netWebLink(page)); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
  return `<div class="${cls || 'card'}"><h4>🌍 Internetmatch</h4>
    <div class="joininfo"><div class="qr">${qr}</div><div><p class="note">Koden:</p><div class="url" style="font-size:clamp(26px,7vmin,40px);letter-spacing:1px">${esc(NET_ONLINE || '')}</div></div></div>
    <p class="note">${ok ? '✅ Redo!' : '⏳ Ansluter till internet…'} Andra trycker <b>🔗 Gå med</b> och skriver koden – var som helst i världen. iPhone/iPad kan skanna QR-koden.</p>
    <p class="note" style="font-size:13px">Fungerar inte anslutningen? Vissa mobil- och skolnätverk spärrar direktkopplingar – prova ett annat wifi.</p></div>`;
}
/* gå med-kortet */
function netJoinCardHTML(cls) {
  return `<div class="${cls || 'card'}"><h4>🌍 Internetmatch – skriv koden</h4>
    <p class="note">Värden trycker 🌍 Starta internetmatch och får en kod, t.ex. KATT-42.</p>
    <div class="ipbox"><input id="codeIn" type="text" autocapitalize="characters" autocomplete="off" placeholder="KATT-42" value=""><button class="btn green small" id="codeGo">Gå med</button></div>
    <p class="note" id="codeMsg"></p></div>`;
}
function netBindJoinCard(buildURL) {
  const inp = document.getElementById('codeIn'), btn = document.getElementById('codeGo'), msg = document.getElementById('codeMsg');
  if (!inp) return;
  const go = () => netOnlineJoin(inp.value, buildURL, st => {
    msg.textContent = st === 'wait' ? '🌍 Letar efter matchen…' : st === 'bad' ? 'Skriv koden som står hos värden, t.ex. KATT-42.' : st === 'lib' ? 'Kunde inte ladda internetdelen – är du uppkopplad?' : '😕 Hittade ingen match med den koden. Kolla koden och att värden har lobbyn öppen.';
    inp.style.borderColor = st === 'wait' ? '' : '#FF4D6D';
  });
  btn.onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
}
