import { api } from './api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function syncSubscriptionToServer(vapidKey: string): Promise<void> {
  const reg = await navigator.serviceWorker.register('/service-worker.js');
  await navigator.serviceWorker.ready;

  const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
  });

  const j = sub.toJSON();
  await api.pushSubscribe({
    endpoint: j.endpoint!,
    keys: j.keys as { p256dh: string; auth: string },
  });
}

export async function registerPushSubscription(vapidKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission denied');
  await syncSubscriptionToServer(vapidKey);
}

/**
 * Re-POST the existing subscription to the server on app load if permission is
 * already granted. Self-heals after dead-endpoint cleanup, DB wipes, or PWA
 * reinstalls — cases where the browser still has a subscription (or can mint
 * one without prompting) but the server row is gone.
 */
export async function ensurePushSubscription(vapidKey: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    await syncSubscriptionToServer(vapidKey);
  } catch (e) {
    console.warn('ensurePushSubscription failed:', e);
  }
}
