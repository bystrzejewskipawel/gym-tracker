/* Gym Tracker service worker: shows the "rest is over" notification, but only if
 * the app is NOT currently on screen. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // The timer is already visible on screen: stay quiet. (Chrome allows skipping the
      // notification when a window of the site is visible.)
      if (windows.some((client) => client.visibilityState === 'visible')) return;

      await self.registration.showNotification(data.title || 'Rest over', {
        body: data.body || '',
        tag: 'rest-timer', // a newer one replaces an older one
        renotify: true,
        vibrate: [200, 100, 200],
        icon: '/icon-192.png'
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    })()
  );
});
