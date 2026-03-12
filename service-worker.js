const CACHE_NAME = 'estetica-premium-v4';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/supabase-client.js',
    './js/app-core.js',
    './js/app-dashboard.js',
    './js/app-clientes.js',
    './js/app-servicos.js',
    './js/app-estoque.js',
    './js/app-agendamentos.js',
    './js/app-automacoes.js',
    './js/app-agenda.js',
    './js/app-relatorios.js',
    './js/app-anamnese.js',
    'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap'
];

// 1. Instalação: Cache dos arquivos estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Cacheando arquivos estáticos');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting();
});

// 2. Ativação: Limpar caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🗑️ Service Worker: Limpando cache antigo', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Interceptação de Requisições (A CORREÇÃO ESTÁ AQUI)
self.addEventListener('fetch', (event) => {
    // 🛑 IMPORTANTE: Ignorar requisições que não sejam GET (POST, DELETE, PUT)
    // O erro "Failed to execute 'put' on 'Cache'" acontecia porque tentávamos cachear um POST
    if (event.request.method !== 'GET') {
        return; 
    }

    // Ignora URLs do Chrome Extension ou Supabase API (para garantir dados frescos)
    if (event.request.url.includes('chrome-extension') || event.request.url.includes('supabase.co')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Estratégia: Cache First, depois Network (Stale-while-revalidate light)
                // Se tem no cache, retorna. Se não, busca na rede.
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request).then((response) => {
                    // Verifica se a resposta é válida
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clona a resposta para salvar no cache
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });

                    return response;
                });
            })
    );
});