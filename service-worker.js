const APP_CACHE = 'estetica-app-v3';
const CDN_CACHE = 'estetica-cdn-v1';

// Arquivos locais do app — ficam em cache para funcionar offline
const APP_ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/app-agenda.js',
    './js/supabase-client.js',
    './js/popular-dados.js',
    './manifest.json'
];

// CDNs externas — não mudam, cache permanente
const CDN_ORIGINS = [
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net'
];

// 1. Instalação
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_CACHE).then((cache) => {
            return cache.addAll(APP_ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. Ativação — limpa caches antigos do app (CDN fica)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(
                names.map((name) => {
                    if (name !== APP_CACHE && name !== CDN_CACHE) {
                        return caches.delete(name);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

// 3. Interceptação de requisições
self.addEventListener('fetch', (event) => {
    // Ignora não-GET e Supabase API
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('supabase.co')) return;
    if (event.request.url.includes('chrome-extension')) return;

    const url = new URL(event.request.url);
    const isCdn = CDN_ORIGINS.some((origin) => url.hostname.includes(origin));

    if (isCdn) {
        // CDN: Cache First — não muda nunca, serve do cache direto
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CDN_CACHE).then((c) => c.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
    } else {
        // App local: Network First — sempre tenta buscar o mais novo
        // Se offline ou erro de rede, cai no cache
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const clone = response.clone();
                        caches.open(APP_CACHE).then((c) => c.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
    }
});
