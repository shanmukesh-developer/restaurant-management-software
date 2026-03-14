const CACHE_NAME = 'besta-v2';
const ASSETS = [
    '/',
    '/index.css',
    '/js/shared.js',
    '/js/fcm.js',
    '/images/logo-192.png',
    '/images/logo-512.png',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Outfit:wght@400;500;600;700;800&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Skip non-GET and API calls
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;
    
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request).then(fetchRes => {
                // Only cache successful responses
                if (!fetchRes || fetchRes.status !== 200 || fetchRes.type !== 'basic') {
                    return fetchRes;
                }
                const responseToCache = fetchRes.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
                return fetchRes;
            });
        }).catch(() => {
            if (event.request.mode === 'navigate') {
                return caches.match('/');
            }
        })
    );
});
