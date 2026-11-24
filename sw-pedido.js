// sw-pedido.js — Service Worker da página pública de pedidos (pedido.html)
// Escopo restrito a pedido.html: não interfere no Controle de Caixa (sw.js).
// Estratégia: ABRE NA HORA — responde do cache e confere a versão nova em segundo plano
// (stale-while-revalidate). Se a página mudou, avisa o app, que se recarrega sozinho
// (quando o cliente não está digitando). Firebase e demais domínios externos nunca passam pelo cache.
const CACHE_NAME = 'pedido-v25'; // abre na hora (cache) + confere versão nova em segundo plano; ajuste automático de tela
const PAGINA = './pedido.html';
const BASICO = [PAGINA, './manifest-pedido.json', './img/logo.png', './img/icon-192.png', './img/icon-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => Promise.all(BASICO.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Busca a versão atual no servidor, guarda no cache e, se a página HTML mudou, avisa os clientes abertos.
async function atualizar(urlBusca, chave, ehPagina) {
  try {
    const res = await fetch(urlBusca, { cache: 'no-cache' }); // sempre revalida com o servidor
    if (!res || !res.ok) return;
    const cache = await caches.open(CACHE_NAME);
    let mudou = false;
    if (ehPagina) {
      const antigo = await cache.match(chave);
      if (antigo) {
        const [a, b] = await Promise.all([antigo.clone().text(), res.clone().text()]);
        mudou = a !== b;
      }
    }
    await cache.put(chave, res);
    if (mudou) {
      const clientes = await self.clients.matchAll({ type: 'window' });
      clientes.forEach(c => c.postMessage({ tipo: 'nova-versao' }));
    }
  } catch (e) { /* sem rede: segue com o cache */ }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.has('_fresh') || url.searchParams.has('_v')) return;

  // A página abre com ?loja=...&mesa=...&p=...; o arquivo é o mesmo, então usa uma única cópia no cache.
  const ehPagina = req.mode === 'navigate' || url.pathname.endsWith('/pedido.html');
  const chave = ehPagina ? new Request(url.origin + url.pathname) : req;
  const urlBusca = ehPagina ? url.origin + url.pathname : req;

  event.respondWith((async () => {
    const guardado = await caches.match(chave);
    if (guardado) {
      event.waitUntil(atualizar(urlBusca, chave, ehPagina)); // confere a versão nova sem fazer o cliente esperar
      return guardado;
    }
    try {
      const res = await fetch(urlBusca, { cache: 'no-cache' });
      if (res && res.ok) {
        const copia = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(c => c.put(chave, copia)));
      }
      return res;
    } catch (e) {
      const alt = await caches.match(req, { ignoreSearch: true });
      return alt || Response.error();
    }
  })());
});
