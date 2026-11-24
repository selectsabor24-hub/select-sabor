// sw-motoqueiro.js — Service Worker do app do motoqueiro (motoqueiro.html)
// Escopo restrito a motoqueiro.html: não interfere no Controle de Caixa (sw.js)
// nem na página de pedidos (sw-pedido.js).
// Estratégia: network-first (sempre a versão mais nova); cache só se a rede falhar.
// Firebase e demais domínios externos nunca passam pelo cache.
// Também cuida do toque na notificação de "nova entrega": abre/foca o app.
const CACHE_NAME = 'motoqueiro-v11'; // toque padrão: telefone antigo (embutido); instalar o app; ajuste automático de tela

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

// Push (avisos com a tela bloqueada): mostra a notificação com som e vibração.
// Entrega pronta (tag "pronto-...") vira "chamada": vibração longa + botões Aceitar / Recusar.
self.addEventListener('push', event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Select Sabor', body: event.data ? event.data.text() : '' }; }
  const tag = d.tag || 'entrega';
  let pedido = '';
  try { pedido = new URL(d.url || '', self.location.href).searchParams.get('chamada') || ''; } catch (e) {}
  const chamada = /^pronto-/.test(tag) && !!pedido;
  event.waitUntil(self.registration.showNotification(d.title || 'Select Sabor', {
    body: d.body || '',
    icon: 'img/icon-192.png',
    badge: 'img/icon-192.png',
    tag: tag,
    renotify: true,
    requireInteraction: true,
    vibrate: chamada ? [800, 250, 800, 250, 800, 250, 800] : [500, 150, 500, 150, 500],
    actions: chamada ? [{ action: 'aceitar', title: '✅ Aceitar' }, { action: 'recusar', title: '❌ Recusar' }] : [],
    data: { url: d.url || '', pedido: pedido }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const dados = event.notification.data || {};
  const acao = (event.action === 'aceitar' || event.action === 'recusar') ? event.action : '';
  const id = dados.pedido || '';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if ('focus' in c) {
          if (acao && id) c.postMessage({ tipo: 'acao', acao: acao, id: id });
          return c.focus();
        }
      }
      const q = acao && id ? '?acao=' + acao + '&id=' + encodeURIComponent(id) : '';
      return self.clients.openWindow('./motoqueiro.html' + q);
    })
  );
});
