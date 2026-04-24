/**
 * sync-and-remind.ts
 * Run by cron every 6 hours (in-process via node-cron).
 * Iterates all users with OAuth tokens:
 *   1. Auto-refreshes each user's access token (provider-aware)
 *   2. Pulls latest saved albums (YouTube Music or Spotify)
 *   3. Adds new ones to the DB (filtered by allowedTypes)
 *   4. Fires any due push notifications
 */
import * as db from '../db';
import { getLibraryAlbums as getYTMLibraryAlbums } from '../ytmusic';
import { getSpotifyLibraryAlbums, getValidSpotifyToken } from '../spotify';
import { initPush, sendPush } from '../push';
import { runRemindersForUser } from '../reminders';
import { getValidAccessToken } from '../oauth';
import { Album } from '../types';
import type { OAuthTokens } from '../oauth';
import type { Provider } from '../types';

interface SyncUser {
  id: string;
  lastSync: string | null;
  provider: Provider;
  tokens: OAuthTokens;
}

export async function syncUser(user: SyncUser) {
  // Auto-refresh token if expiring soon (provider-aware)
  let tokens = user.tokens;
  const fresh = user.provider === 'spotify'
    ? await getValidSpotifyToken(tokens)
    : await getValidAccessToken(tokens);

  if (fresh.accessToken !== tokens.accessToken) {
    db.upsertTokens(user.id, fresh);
    console.log(`  ✓ Token refreshed for ${user.id}`);
    tokens = fresh;
  }

  // Fetch library (provider-aware)
  const fetched = user.provider === 'spotify'
    ? await getSpotifyLibraryAlbums(tokens.accessToken)
    : await getYTMLibraryAlbums(tokens.accessToken);

  const settings = db.getSettings(user.id);
  let added = 0;

  for (const item of fetched) {
    // Both YTMAlbum and SpotifyAlbum expose: id (or browseId), title, artist, year, thumbnail, releaseType
    const albumId = 'browseId' in item ? item.browseId : item.id;

    if (db.albumExists(user.id, albumId)) continue;
    // Respect allowed release types
    if (item.releaseType !== 'Unknown' && !settings.allowedTypes.includes(item.releaseType)) continue;

    const album: Album = {
      id:            albumId,
      title:         item.title,
      artist:        item.artist,
      year:          item.year,
      thumbnail:     item.thumbnail,
      releaseType:   item.releaseType,
      savedAt:       'savedAt' in item ? item.savedAt : new Date().toISOString(),
      snoozedUntil:  null,
      silenced:      false,
      remindersSent: [],
    };
    db.insertAlbum(user.id, album);
    added++;
  }

  db.setLastSync(user.id, new Date().toISOString());
  console.log(`  ✓ Sync [${user.provider}] — ${added} new, ${fetched.length} total in library`);
}

async function main() {
  console.log(`[${new Date().toISOString()}] Unplayed cron starting…`);
  initPush();

  const users = db.getAllUsersWithTokens();
  if (!users.length) {
    console.log('No users with tokens — nothing to do.');
    return;
  }

  for (const user of users) {
    console.log(`Processing user ${user.id} [${user.provider}]…`);
    try {
      await syncUser(user);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      console.error(`  Sync failed for ${user.id}:`, msg);

      // If auth error, clear the invalid tokens and notify the user to re-authenticate.
      // Deleting tokens means the UI will show the login screen on next visit instead
      // of silently failing every 6 hours with the same invalid_grant error.
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid_grant')) {
        console.log(`  Auth error — clearing tokens and sending push to re-authenticate`);
        db.deleteTokens(user.id);
        await sendPush(
          user.id,
          { id: '', title: 'Unplayed', artist: '', year: '', thumbnail: '',
            releaseType: 'Unknown', savedAt: '', snoozedUntil: null,
            silenced: false, remindersSent: [] },
          '🔐 Unplayed needs re-authentication',
          'Your music connection expired. Open Unplayed to reconnect.'
        );
      }
    }

    // Reminders — only if current local hour (per user's timezone) matches notifyHour
    const utcHour = new Date().getUTCHours();
    const settings = db.getSettings(user.id);
    const tzOffset = settings.timezoneOffset ?? 0; // minutes west of UTC
    // Convert UTC to user's local hour (handles fractional-hour timezones, e.g. India UTC+5:30)
    const localHour = Math.floor(((utcHour * 60 - tzOffset) % 1440 + 1440) % 1440 / 60);
    if (localHour === settings.notifyHour) {
      const { sent, skipped } = await runRemindersForUser(user.id);
      console.log(`  ✓ Reminders — ${sent} sent, ${skipped} skipped`);
    } else {
      console.log(`  ✓ Reminders — skipped (local=${localHour}, notify=${settings.notifyHour})`);
    }
  }
}

export { main };
// Only auto-run if called directly
if (require.main === module) {
  main().catch(err => { console.error('Cron fatal:', err); process.exit(1); });
}
