/* Bucinca Spel – offlinestöd för webbversionen (iPhone/iPad/dator).
   Sparar alla spelfiler första gången och svarar sedan från cachen; nya versioner hämtas i bakgrunden.
   Listan och versionen finns i pwa-files.json (genereras av tools/pwa_files.py vid bygget). */
const PREFIX = 'bucinca-';
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const r = await fetch('pwa-files.json', { cache: 'no-store' });
    const { version, files } = await r.json();
    const c = await caches.open(PREFIX + version);
    await c.addAll(files);
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    let version = null;
    try { version = (await (await fetch('pwa-files.json', { cache: 'no-store' })).json()).version; } catch (_) { }
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && version && k !== PREFIX + version) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const net = fetch(req).then(async res => {
      if (res.ok) { const keys = await caches.keys(); const c = await caches.open(keys.find(k => k.startsWith(PREFIX)) || PREFIX + 'runtime'); c.put(req, res.clone()); }
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});
