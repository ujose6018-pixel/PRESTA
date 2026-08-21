/* Caudal · service worker
   Sube el número de VER en cada publicación (o corré publicar.py, que
   lo hace junto con las URLs de los módulos). */
const VER = 'caudal-v10';

const ASSETS = [
  './', './index.html', './ahorro.html', './fiado.html', './financiacion.html',
  './presupuesto.html', './analisis.html', './presta.html', './ronda.html',
  './core.js?v=10', './analisis.js?v=10', './theme.css?v=10',
  './manifest.json',
  './icons/mark.svg', './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];

/* Instalar. cache.addAll() falla entera si un solo archivo falta, así que
   se cachea uno por uno y se ignoran los que no estén. */
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VER);
    await Promise.all(ASSETS.map((u) => cache.add(u).catch(() => {})));
    await self.skipWaiting();          // no esperar a que cierren las pestañas
  })());
});

/* Activar: borrar versiones viejas y tomar control de las pestañas abiertas. */
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* Red primero. En archivos propios se fuerza no-store para que el caché
   HTTP del navegador no devuelva código viejo: esa fue justamente la causa
   de que el HTML nuevo cargara con el core.js anterior. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const propio = new URL(req.url).origin === self.location.origin;

  e.respondWith((async () => {
    try {
      const res = await fetch(req, propio ? { cache: 'no-store' } : undefined);
      if (res && res.ok && propio) {
        const cache = await caches.open(VER);
        cache.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const inicio = await caches.match('./index.html');
        if (inicio) return inicio;
      }
      return new Response('Sin conexión', { status: 503, statusText: 'Sin conexión' });
    }
  })());
});
