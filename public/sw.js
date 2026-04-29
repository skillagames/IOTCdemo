// Basic Service Worker for IoT Connect App - v2.7 (Stripped)
// Push notification functionality removed as per system cleanup requirements.

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'PING') {
    event.source.postMessage({ type: 'PONG' });
  }
});
