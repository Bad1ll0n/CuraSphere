// v2: a v1 guardava em cache TODAS as páginas HTML (rede primeiro, cópia para a cache). Todas as
// páginas da aplicação são renderizadas no servidor com dados do doente, por isso a ficha clínica
// ficava no CacheStorage do browser — em computadores partilhados do serviço — e sobrevivia ao
// logout. Nunca chegou a acontecer só porque o middleware redireccionava /sw.js para /login e o
// browser recusava registar um service worker atrás de um redirect.
//
// Regra agora: só se guarda o que é imutável e não tem dados (ficheiros de _next/static, com hash
// no nome). HTML e API vão sempre à rede; sem rede, uma página de aviso sem conteúdo clínico.
const CACHE_NAME = 'curasphere-v2';
const STATIC_ASSETS = ['/manifest.json'];

const PAGINA_SEM_REDE = `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>CuraSphere — sem ligação</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f8fafc;color:#0f172a">
<main style="max-width:28rem;padding:2rem;text-align:center"><h1 style="font-size:1.25rem">Sem ligação ao servidor</h1>
<p>Os dados clínicos não ficam guardados neste computador. Verifique a rede e volte a carregar a página.</p></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Apaga a cache v1 — e com ela qualquer página clínica que lá tenha ficado.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar extensões de browser, sockets, métodos non-GET e outras origens (API, armazenamento)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('socket.io')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Assets estáticos do Next.js: cache-first (são imutáveis com hash no nome)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Navegação: sempre rede, nunca cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () => new Response(PAGINA_SEM_REDE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      )
    );
  }
});
