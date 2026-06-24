// FESTIO Service Worker
const CACHE_NAME = 'festio-cache-v1';

self.addEventListener('install', event => {
  self.skipWaiting();
  console.log('[ServiceWorker] Install');
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  console.log('[ServiceWorker] Activate');
});

self.addEventListener('push', event => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'FESTIO 알림';
    const options = {
      body: data.body || data.message || '새로운 알림이 있습니다.',
      icon: data.icon || '/assets/img/festio_logo.png',
      badge: '/assets/img/festio_logo.png',
      vibrate: data.vibrate || [200, 100, 200, 100, 200, 100, 400],
      data: data.url || '/'
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[ServiceWorker] Push event error', e);
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // 이미 열려있는 창이 있으면 포커스
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // 열려있는 창이 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
