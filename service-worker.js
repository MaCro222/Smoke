// Service Worker for AutoMap PWA

const CACHE_NAME = 'automap-v1.0.0';
const DYNAMIC_CACHE = 'automap-dynamic-v1.0.0';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/config.js',
    '/utils.js',
    '/storage.js',
    '/map.js',
    '/app.js',
    '/manifest.json',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => {
                console.error('[SW] Cache installation failed:', err);
            })
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
    );
    
    // Claim all clients immediately
    return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome extension requests
    if (request.url.startsWith('chrome-extension://')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // Return cached version and update cache in background
                    updateCache(request);
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(request)
                    .then(networkResponse => {
                        // Cache successful responses
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(request, responseToCache);
                                });
                        }
                        
                        return networkResponse;
                    })
                    .catch(error => {
                        console.error('[SW] Fetch failed:', error);
                        
                        // Return offline page for navigation requests
                        if (request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

// Update cache in background
function updateCache(request) {
    fetch(request)
        .then(response => {
            if (response && response.status === 200) {
                caches.open(DYNAMIC_CACHE)
                    .then(cache => {
                        cache.put(request, response);
                    });
            }
        })
        .catch(error => {
            console.error('[SW] Background update failed:', error);
        });
}

// Background sync (for future implementation)
self.addEventListener('sync', event => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-machines') {
        event.waitUntil(syncMachines());
    }
});

// Sync machines with server (placeholder)
async function syncMachines() {
    console.log('[SW] Syncing machines...');
    // TODO: Implement sync with Firebase
}

// Push notification (for future implementation)
self.addEventListener('push', event => {
    console.log('[SW] Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'Neue Aktualisierung verfügbar',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification('AutoMap', options)
    );
});

// Notification click
self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification clicked');
    
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

// Message from client
self.addEventListener('message', event => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
    
    if (event.data.action === 'clearCache') {
        event.waitUntil(
            caches.keys()
                .then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            return caches.delete(cacheName);
                        })
                    );
                })
                .then(() => {
                    console.log('[SW] All caches cleared');
                    event.ports[0].postMessage({ success: true });
                })
        );
    }
});

console.log('[SW] Service Worker loaded');
