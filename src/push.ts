import webpush from 'web-push';
import { pushStore } from './store';
import { Album } from './types';

export function initPush(): void {
  const pub  = process.env['VAPID_PUBLIC_KEY'];
  const priv = process.env['VAPID_PRIVATE_KEY'];
  const mail = process.env['VAPID_EMAIL'] ?? 'mailto:admin@example.com';
  if (!pub || !priv) { console.warn('⚠️  VAPID keys not set — push disabled'); return; }
  webpush.setVapidDetails(mail, pub, priv);
}

export async function sendPush(
  album: Album,
  title: string,
  body: string
): Promise<void> {
  const subs = pushStore.all();
  if (!subs.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon: album.thumbnail || '/icons/icon-192.png',
    url: `https://music.youtube.com/browse/${album.id}`,
    albumId: album.id,
  });

  const dead: string[] = [];
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(sub.endpoint);
      else console.error('Push error', status, sub.endpoint.slice(0, 40));
    }
  }));
  dead.forEach(ep => pushStore.remove(ep));
}
