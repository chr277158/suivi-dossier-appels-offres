self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? '' };
  }

  event.waitUntil(self.registration.showNotification(payload.title || 'Rappel', {
    body: payload.body || 'Un rappel arrive à échéance.',
    tag: payload.tag || 'application-reminder',
    data: { url: payload.url || '/#/reminders' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/#/reminders', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(target);
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
