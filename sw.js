/* Service worker: l'app si apre anche con poco campo. Non intercetta mai i dati (Firestore/Auth). */
const VERSION = 'v18';
const SHELL = 'shell-' + VERSION, SDK = 'sdk-' + VERSION, FONTS = 'fonts-v1';
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-48.png'];
const NET_WAIT = 3000;   // con campo scarso: dopo 3 secondi si apre l'ultima copia salvata (e intanto si aggiorna)
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== SDK && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // librerie Firebase: cache dopo il primo uso (il file è versionato nell'URL)
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; })); return; }
  // caratteri (Google Fonts): copia salvata subito, aggiornata in background
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })); return; }
  if (u.origin !== location.origin) return;           // dati e login: sempre in rete, mai in cache
  // pagina: prima la rete (versione aggiornata); se la rete è lenta o assente, l'ultima copia salvata
  e.respondWith((async () => {
    const net = fetch(r, {cache: 'no-cache'}).then(res => { if (res.ok) { const cp = res.clone(); caches.open(SHELL).then(c => c.put(r, cp)); } return res; });
    e.waitUntil(net.catch(() => {}));
    const cached = () => caches.match(r).then(h => h || caches.match('index.html'));
    let timer;
    const slow = new Promise(res => { timer = setTimeout(() => cached().then(h => h && res(h)), NET_WAIT); });
    try { return await Promise.race([net, slow]); }
    catch(err) { const h = await cached(); if (h) return h; throw err; }
    finally { clearTimeout(timer); }
  })());
});

// tocco su una notifica: porta in primo piano l'app (o la apre)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
