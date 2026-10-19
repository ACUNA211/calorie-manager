/* global clients */
// Push handlers (ticket 54). vite-plugin-pwa generates the offline service worker and pulls
// this file in with importScripts (see vite.config.js), so the offline behaviour of ticket 03
// is untouched. Plain classic script: no imports.

// Parses the message the send-push Edge Function sends: { title, body, url, tag }.
function readPushMessage(event) {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  return {
    title: typeof data.title === 'string' && data.title ? data.title : 'Calorie Manager',
    body: typeof data.body === 'string' ? data.body : '',
    url: typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
  };
}

self.addEventListener('push', (event) => {
  const message = readPushMessage(event);
  // Every push must show a notification (iPhone revokes the permission otherwise).
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      icon: '/icons/icon-192.png',
      tag: message.tag,
      data: { url: message.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => 'focus' in client);
      if (open) {
        return open
          .focus()
          .then((focused) => (focused.navigate ? focused.navigate(target) : focused));
      }
      return clients.openWindow(target);
    })
  );
});
