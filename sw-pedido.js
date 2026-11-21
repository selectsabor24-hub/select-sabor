// sw-pedido.js — Service Worker da página pública de pedidos (pedido.html)
// Escopo restrito a pedido.html: não interfere no Controle de Caixa (sw.js).
// Estratégia: network-first (sempre a versão mais nova); cache só se a rede falhar.
// Firebase e demais domínios externos nunca passam pelo cache.
const CACHE_NAME = 'pedido-v8'; // card de destaque: preço promocional com mais contraste

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
