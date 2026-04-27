import webpush from 'web-push';
import * as db from './db';
import { Album } from './types';

export async function sendDigestPush(userId: string, count: number): Promise<void> {
  const subs = db.getPushSubs(userId);
  if (!subs.length) {
    console.log(`  ⚠️  sendDigestPush(${userId}): no push subscriptions — skipping`);
    return;
  }

  const payload = JSON.stringify({
    title:   `📀 ${count} albums need a listen`,
    body:    "Open Unplayed to see what's waiting.",
    icon:    '/icons/icon-192.png',
    url:     '/',
    albumId: '',
  });

  const dead: string[] = [];
  await Promise.allSettled(subs.map(async sub => {
    try { await webpush.sendNotification(sub, payload); }
    catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(sub.endpoint);
      else console.error('Push error', status, sub.endpoint.slice(0, 40));
    }
  }));
  dead.forEach(ep => db.removePushSub(ep));
}

export function initPush(): void {
  const pub  = process.env['VAPID_PUBLIC_KEY'];
  const priv = process.env['VAPID_PRIVATE_KEY'];
  const mail = process.env['VAPID_EMAIL'] ?? 'mailto:admin@example.com';
  if (!pub || !priv) { console.warn('⚠️  VAPID keys not set — push disabled'); return; }
  webpush.setVapidDetails(mail, pub, priv);
  console.log('✓ Push initialized (VAPID configured)');
}

export async function sendPush(
  userId: string,
  album: Album,
  title: string,
  body: string
): Promise<void> {
  const subs = db.getPushSubs(userId);
  if (!subs.length) {
    console.log(`  ⚠️  sendPush(${userId}): no push subscriptions — "${title}" not delivered`);
    return;
  }

  const provider = db.getUserProvider(userId);
  const url = provider === 'spotify'
    ? `https://open.spotify.com/album/${album.id}`
    : `https://music.youtube.com/browse/${album.id}`;

  const payload = JSON.stringify({
    title,
    body,
    icon: album.thumbnail || '/icons/icon-192.png',
    url,
    albumId: album.id,
  });

  const dead: string[] = [];
  let sent = 0;
  await Promise.allSettled(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) dead.push(sub.endpoint);
      else console.error('Push error', status, sub.endpoint.slice(0, 40));
    }
  }));
  dead.forEach(ep => db.removePushSub(ep));
  console.log(`  ✓ sendPush(${userId}): "${title}" — ${sent}/${subs.length} delivered, ${dead.length} dead`);
}
