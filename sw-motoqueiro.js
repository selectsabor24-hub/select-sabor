// sw-motoqueiro.js — Service Worker do app do motoqueiro (motoqueiro.html)
// Escopo restrito a motoqueiro.html: não interfere no Controle de Caixa (sw.js)
// nem na página de pedidos (sw-pedido.js).
// Estratégia: network-first (sempre a versão mais nova); cache só se a rede falhar.
// Firebase e demais domínios externos nunca passam pelo cache.
// Também cuida do toque na notificação de "nova entrega": abre/foca o app.
const CACHE_NAME = 'motoqueiro-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('_fresh') || url.searchParams.has('_v')) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then(c => c || caches.match(req, { ignoreSearch: true })))
  );
});

// Push (avisos com a tela bloqueada): mostra a notificação com som e vibração
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Select Sabor', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Select Sabor', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'entrega',
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 150, 500, 150, 500],
    data: { url: d.url || '' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow('./motoqueiro.html');
    })
  );
});
