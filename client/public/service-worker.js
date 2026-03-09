self.addEventListener('push', e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(d.title || '🎵 Unplayed', {
    body:    d.body || '',
    icon:    d.icon || '/icons/icon-192.png',
    badge:   '/icons/icon-72.png',
    data:    { url: d.url, albumId: d.albumId },
    actions: [
      { action: 'open',    title: '▶ Open in YT Music' },
      { action: 'snooze',  title: '⏱ Snooze 3 days' },
      { action: 'silence', title: '✕ Stop reminding' },
    ],
    requireInteraction: true,
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { url, albumId } = e.notification.data ?? {};

  if (e.action === 'snooze' && albumId) {
    fetch(`/api/albums/${albumId}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 3 }),
    });
    return;
  }
  if (e.action === 'silence' && albumId) {
    fetch(`/api/albums/${albumId}/silence`, { method: 'POST' });
    return;
  }
  // 'open' or tap on body
  if (url) e.waitUntil(clients.openWindow(url));
});
