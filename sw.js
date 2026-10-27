/* Service worker: l'app si apre anche con poco campo. Non intercetta mai i dati (Firestore/Auth). */
const VERSION = 'v4';
const SHELL = 'shell-' + VERSION, SDK = 'sdk-' + VERSION;
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon-48.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== SDK).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // librerie Firebase: cache dopo il primo uso (il file è versionato nell'URL)
  if (u.hostname === 'www.gstatic.com' && u.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.open(SDK).then(async c => { const hit = await c.match(r); if (hit) return hit; const res = await fetch(r); if (res.ok) c.put(r, res.clone()); return res; })); return; }
  if (u.origin !== location.origin) return;           // dati e login: sempre in rete, mai in cache
  // pagina: prima la rete (versione aggiornata), se manca il campo l'ultima copia salvata
  e.respondWith(fetch(r, {cache: 'no-cache'}).then(res => { if (res.ok) caches.open(SHELL).then(c => c.put(r, res.clone())); return res; })
    .catch(() => caches.match(r).then(h => h || caches.match('index.html'))));
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
