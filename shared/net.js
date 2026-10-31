/* Bucinca Spel – internetmatch med kod.
   Ger samma gränssnitt som WebSocket-reläet i LanServer.kt men går via en öppen MQTT-förmedlare på internet
   (vanlig krypterad WebSocket – fungerar genom alla hem- och mobilnät, inget konto behövs).
   Värden får en kod (t.ex. KATT-42); andra skriver koden eller skannar QR-koden.
   Värd → relä:  '*msg' till alla, '@id|msg' till en, '!id' koppla bort.  Relä → värd: '+id|…' ny, '-id' borta, 'id|msg'.
   Klient: skickar och tar emot vanliga strängar. När värden avslutar får klienterna {"t":"hostgone"}.
   Ämnen: bsp/<kod>/info (kvar hos förmedlaren: vilket spel, rensas om värden försvinner), /h (till värden),
   /a (till alla), /c/<id> (till en klient). */
'use strict';
const NET_Q = new URLSearchParams(location.search);
const NET_ONLINE = (() => { const c = NET_Q.get('online'); return c ? netCleanCode(c) : null; })();
const NET_WEB = 'https://drpatri-ai.github.io/Spel/';
const NET_PAGE = (location.pathname.split('/').pop() || 'index.html');
const NET_WORDS = ['KATT', 'HUND', 'HAST', 'GRIS', 'KANIN', 'UGGLA', 'RAV', 'BJORN', 'LEJON', 'TIGER', 'ZEBRA', 'PANDA', 'FISK', 'HAJ', 'APA', 'MUS', 'ALG', 'VARG', 'ORM', 'GROD', 'ANKA', 'KO', 'GET', 'FAR', 'SNIGEL', 'DRAKE', 'ROBOT', 'RAKET', 'PIRAT', 'TROLL'];
// öppna förmedlare – provas i tur och ordning
let NET_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://mqtt.eclipseprojects.io:443/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
// för tester: egen förmedlare, t.ex. ["ws://127.0.0.1:8883"]
try { const o = JSON.parse(localStorage.getItem('bucinca_netbrokers') || 'null'); if (Array.isArray(o) && o.length) NET_BROKERS = o; } catch (e) { }
let NET_BROKER = Math.max(0, Math.min(NET_BROKERS.length - 1, +NET_Q.get('b') || 0));

function netCleanCode(c) {
  c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = c.match(/^([A-Z]+)(\d+)$/);
  return m ? m[1] + '-' + m[2] : c;
}
function netNewCode() { return NET_WORDS[Math.floor(Math.random() * NET_WORDS.length)] + '-' + (10 + Math.floor(Math.random() * 90)); }
const netTopic = (code, t) => 'bsp/' + netCleanCode(code).toLowerCase().replace(/[^a-z0-9]/g, '') + '/' + t;
const netRid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

/* ---------- liten MQTT 3.1.1-klient (QoS 0) över WebSocket ---------- */
const _te = new TextEncoder(), _td = new TextDecoder();
function _mqStr(s) { const b = typeof s === 'string' ? _te.encode(s) : s; const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
function _mqPkt(type, parts) {
  let n = 0; for (const p of parts) n += p.length;
  const len = []; let x = n; do { let d = x % 128; x = Math.floor(x / 128); if (x > 0) d |= 128; len.push(d); } while (x > 0);
  const o = new Uint8Array(1 + len.length + n); o[0] = type; o.set(len, 1);
  let i = 1 + len.length; for (const p of parts) { o.set(p, i); i += p.length; }
  return o;
}
class Mqtt {
  constructor(url, will) {
    this.url = url; this.onmsg = null; this.onopen = null; this.onclose = null; this.open = false; this.buf = new Uint8Array(0); this.pid = 1;
    this.id = 'bsp' + netRid();
    try { this.ws = new WebSocket(url, ['mqtt']); } catch (e) { setTimeout(() => this._closed(), 0); return; }
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => {
      let flags = 0x02; const pay = [_mqStr(this.id)];
      if (will) { flags |= 0x04 | (will.retain ? 0x20 : 0); pay.push(_mqStr(will.topic), _mqStr(_te.encode(will.payload))); }
      this.ws.send(_mqPkt(0x10, [_mqStr('MQTT'), new Uint8Array([4, flags, 0, 30]), ...pay]));
    };
    this.ws.onmessage = e => this._data(new Uint8Array(e.data));
    this.ws.onclose = this.ws.onerror = () => this._closed();
  }
  _closed() { if (this.dead) return; this.dead = true; this.open = false; clearInterval(this.ping); try { this.ws && this.ws.close(); } catch (e) { } if (this.onclose) this.onclose(); }
  _data(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length); this.buf = b;
    while (this.buf.length >= 2) {
      let mul = 1, len = 0, i = 1, d;
      do { if (i >= this.buf.length) return; d = this.buf[i++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (this.buf.length < i + len) return;
      const h = this.buf[0], body = this.buf.subarray(i, i + len);
      this.buf = this.buf.slice(i + len);
      const t = h >> 4;
      if (t === 2) { // CONNACK
        if (body[1] === 0) { this.open = true; this.ping = setInterval(() => { try { this.ws.send(new Uint8Array([0xC0, 0])); } catch (e) { } }, 20000); if (this.onopen) this.onopen(); }
        else this._closed();
      } else if (t === 3) { // PUBLISH
        const tl = (body[0] << 8) | body[1], topic = _td.decode(body.subarray(2, 2 + tl));
        let p = 2 + tl; if ((h >> 1) & 3) p += 2;
        if (this.onmsg) try { this.onmsg(topic, _td.decode(body.subarray(p)), !!(h & 1)); } catch (e) { console.error(e); }
      }
    }
  }
  sub(...topics) { if (!this.open) return; const id = this.pid++; const parts = [new Uint8Array([id >> 8, id & 255])]; for (const t of topics) parts.push(_mqStr(t), new Uint8Array([0])); this.ws.send(_mqPkt(0x82, parts)); }
  pub(topic, payload, retain) { if (!this.open) return; try { this.ws.send(_mqPkt(0x30 | (retain ? 1 : 0), [_mqStr(topic), _te.encode(payload)])); } catch (e) { } }
  end() { if (this.dead) return; try { this.ws.send(new Uint8Array([0xE0, 0])); } catch (e) { } this.dead = true; this.open = false; clearInterval(this.ping); setTimeout(() => { try { this.ws.close(); } catch (e) { } }, 100); }
}

/* ---------- samma gränssnitt som en WebSocket mot reläet ---------- */
class RelaySock {
  constructor(host, code) {
    this.host = host; this.code = netCleanCode(code); this.readyState = 0; this.reason = '';
    this.onopen = this.onmessage = this.onclose = null; this.peers = new Set();
    // värden behåller samma id om sidan återansluter (annars ser den sin egen gamla kod som upptagen)
    const key = 'bsp_cid_' + this.code;
    try { this.cid = host && sessionStorage.getItem(key) || ('k' + netRid()); if (host) sessionStorage.setItem(key, this.cid); } catch (e) { this.cid = 'k' + netRid(); }
    this._try(NET_BROKER, 0);
  }
  T(t) { return netTopic(this.code, t); }
  _emit(d) { if (this.onmessage) try { this.onmessage({ data: d }); } catch (e) { console.error(e); } }
  _try(bi, n) {
    if (this.readyState === 3) return;
    if (n >= NET_BROKERS.length) return this._close('nobroker');
    const will = this.host ? { topic: this.T('info'), payload: '', retain: true } : { topic: this.T('h'), payload: this.cid + '|\u0001leave' };
    const m = this.m = new Mqtt(NET_BROKERS[bi], will);
    const to = setTimeout(() => { if (!m.open) { m.onclose = null; m.end(); this._try((bi + 1) % NET_BROKERS.length, n + 1); } }, 6000);
    m.onclose = () => { clearTimeout(to); if (this.readyState === 0) this._try((bi + 1) % NET_BROKERS.length, n + 1); else this._close('lost'); };
    m.onopen = () => {
      clearTimeout(to); NET_BROKER = bi;
      if (this.host) this._hostOpen(); else this._clientOpen();
    };
  }
  _hostOpen() {
    const m = this.m;
    let checked = false;
    m.onmsg = (topic, msg, retained) => {
      if (topic === this.T('info')) {
        // koden används redan av någon annan värd → ny kod
        if (!checked && retained && msg && !msg.includes('"' + this.cid + '"')) { this.readyState = 3; m.end(); netNewHostCode(); }
        return;
      }
      if (topic !== this.T('h')) return;
      const bar = msg.indexOf('|'); if (bar < 1) return;
      const id = msg.slice(0, bar), body = msg.slice(bar + 1);
      if (body === '\u0001join') { if (!this.peers.has(id)) { this.peers.add(id); this._emit('+' + id + '|internet'); } m.pub(this.T('c/' + id), JSON.stringify({ t: '_game', page: NET_PAGE })); return; }
      if (body === '\u0001leave') { if (this.peers.delete(id)) this._emit('-' + id); return; }
      if (body === '\u0001probe') { m.pub(this.T('c/' + id), JSON.stringify({ t: '_game', page: NET_PAGE })); return; }
      if (!this.peers.has(id)) { this.peers.add(id); this._emit('+' + id + '|internet'); }
      this._emit(id + '|' + body);
    };
    m.sub(this.T('info'), this.T('h'));
    setTimeout(() => {
      if (this.readyState === 3) return;
      checked = true;
      m.pub(this.T('info'), JSON.stringify({ page: NET_PAGE, host: this.cid, t: Date.now() }), true);
      this.readyState = 1; if (this.onopen) this.onopen();
    }, 900);
  }
  _clientOpen() {
    const m = this.m;
    let hostSeen = false;
    m.onmsg = (topic, msg) => {
      if (topic === this.T('info')) {
        if (!msg) { if (this.readyState === 1) { this._emit('{"t":"hostgone"}'); } return; }
        hostSeen = true;
        try { const i = JSON.parse(msg); if (i.page) { this.page = i.page; if (this.onpage) this.onpage(i.page); } } catch (e) { }
        if (this.probe) return;
        if (this.readyState === 0) { m.pub(this.T('h'), this.cid + '|\u0001join'); this.readyState = 1; if (this.onopen) this.onopen(); }
        return;
      }
      if (msg.charAt(0) === '{' && msg.indexOf('"_game"') > 0) return;
      this._emit(msg);
    };
    m.sub(this.T('info'), this.T('a'), this.T('c/' + this.cid));
    // ingen värd med den koden hos den här förmedlaren → prova nästa
    setTimeout(() => { if (!hostSeen && this.readyState === 0) { m.onclose = null; m.end(); this._tried = (this._tried || 0) + 1; if (this._tried < NET_BROKERS.length) this._try((NET_BROKER + 1) % NET_BROKERS.length, this._tried); else this._close('none'); } }, 3500);
  }
  _close(reason) {
    if (this.readyState === 3) return;
    this.readyState = 3; this.reason = reason || '';
    try { this.m && this.m.end(); } catch (e) { }
    if (this.onclose) this.onclose({ reason: this.reason });
  }
  send(s) {
    if (this.readyState !== 1) return;
    const m = this.m;
    if (!this.host) { m.pub(this.T('h'), this.cid + '|' + s); return; }
    const k = s.charAt(0);
    if (k === '*') m.pub(this.T('a'), s.slice(1));
    else if (k === '@') { const b = s.indexOf('|'); m.pub(this.T('c/' + s.slice(1, b)), s.slice(b + 1)); }
    else if (k === '!') { const id = s.slice(1); m.pub(this.T('c/' + id), '{"t":"hostgone"}'); if (this.peers.delete(id)) this._emit('-' + id); }
  }
  close() {
    this.onclose = null;
    if (this.m && this.m.open) {
      if (this.host) { this.m.pub(this.T('a'), '{"t":"hostgone"}'); this.m.pub(this.T('info'), '', true); }
      else this.m.pub(this.T('h'), this.cid + '|\u0001leave');
    }
    const m = this.m; this.readyState = 3;
    setTimeout(() => { try { m && m.end(); } catch (e) { } }, 150);
  }
}

/* WebSocket i samma wifi – eller förmedlaren på internet */
function netSocket(host) {
  if (NET_ONLINE) return new RelaySock(host, NET_ONLINE);
  return new WebSocket(`ws://${location.host}/ws${host ? '?host=1' : ''}`);
}
/* värd: ny internetmatch på den här sidan */
function netOnlineHostURL(page, params) { return `${page}?online=${encodeURIComponent(netNewCode())}&host=1${params ? '&' + params : ''}`; }
/* koden var upptagen: byt kod och ladda om */
function netNewHostCode() { const q = new URLSearchParams(location.search); q.set('online', netNewCode()); location.replace(NET_PAGE + '?' + q.toString()); }
/* klient: kolla vilket spel koden hör till och gå dit */
function netOnlineJoin(code, buildURL, status) {
  code = netCleanCode(code);
  if (!/^[A-Z]+-\d+$/.test(code)) { status && status('bad'); return; }
  status && status('wait');
  const s = new RelaySock(false, code);
  s.probe = true;
  let done = false;
  s.onpage = page => {
    if (done) return; done = true;
    s.onclose = null; s.readyState = 3; try { s.m.end(); } catch (e) { }
    const url = buildURL(page || NET_PAGE, code);
    location.href = url + (url.includes('?') ? '&' : '?') + 'b=' + NET_BROKER;
  };
  s.onclose = e => { if (!done) { done = true; status && status(e && e.reason === 'nobroker' ? 'lib' : 'none'); } };
}
const netWebLink = page => `${NET_WEB}${page}?online=${encodeURIComponent(NET_ONLINE || '')}&b=${NET_BROKER}`;
/* värdens kort i lobbyn: kod + QR */
function netHostCardHTML(page, cls, ok) {
  let qr = '';
  if (window.qrcode) { try { const q = qrcode(0, 'M'); q.addData(netWebLink(page)); q.make(); qr = q.createSvgTag(4, 2); } catch (e) { } }
  return `<div class="${cls || 'card'}"><h4>🌍 Internetmatch</h4>
    <div class="joininfo"><div class="qr">${qr}</div><div><p class="note">Koden:</p><div class="url" style="font-size:clamp(26px,7vmin,40px);letter-spacing:1px">${esc(NET_ONLINE || '')}</div></div></div>
    <p class="note">${ok ? '✅ Redo!' : '⏳ Ansluter till internet…'} Andra trycker <b>🔗 Gå med</b> och skriver koden – var som helst i världen. iPhone/iPad kan skanna QR-koden.</p></div>`;
}
/* gå med-kortet */
function netJoinCardHTML(cls) {
  return `<div class="${cls || 'card'}"><h4>🌍 Internetmatch – skriv koden</h4>
    <p class="note">Värden trycker 🌍 Starta internetmatch och får en kod, t.ex. KATT-42.</p>
    <div class="ipbox"><input id="codeIn" type="text" autocapitalize="characters" autocomplete="off" placeholder="KATT-42" value=""><button class="btn green small" id="codeGo">Gå med</button></div>
    <p class="note" id="codeMsg"></p></div>`;
}
const netStatusText = st => st === 'wait' ? '🌍 Letar efter matchen…' : st === 'bad' ? 'Skriv koden som står hos värden, t.ex. KATT-42.' : st === 'lib' ? '😕 Kommer inte ut på internet just nu – kolla uppkopplingen.' : '😕 Hittade ingen match med den koden. Kolla koden och att värden har lobbyn öppen.';
function netBindJoinCard(buildURL) {
  const inp = document.getElementById('codeIn'), btn = document.getElementById('codeGo'), msg = document.getElementById('codeMsg');
  if (!inp) return;
  const go = () => netOnlineJoin(inp.value, buildURL, st => { msg.textContent = netStatusText(st); inp.style.borderColor = st === 'wait' ? '' : '#FF4D6D'; });
  btn.onclick = go;
  inp.onkeydown = e => { if (e.key === 'Enter') go(); };
}
