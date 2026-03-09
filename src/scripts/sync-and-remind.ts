/**
 * sync-and-remind.ts
 * Run by cron every 6 hours (in-process via node-cron).
 * Iterates all users with OAuth tokens:
 *   1. Auto-refreshes each user's access token
 *   2. Pulls latest liked albums from YT Music
 *   3. Adds new ones to the DB (filtered by allowedTypes)
 *   4. Fires any due push notifications
 */
import * as db from '../db';
import { getLibraryAlbums } from '../ytmusic';
import { initPush, sendPush } from '../push';
import { runRemindersForUser } from '../reminders';
import { getValidAccessToken } from '../oauth';
import { Album } from '../types';

async function syncUser(user: { id: string; lastSync: string | null; tokens: import('../oauth').OAuthTokens }) {
  // Auto-refresh token if expiring soon
  let tokens = user.tokens;
  const fresh = await getValidAccessToken(tokens);
  if (fresh.accessToken !== tokens.accessToken) {
    db.upsertTokens(user.id, fresh);
    console.log(`  ✓ Token refreshed for ${user.id}`);
    tokens = fresh;
  }

  // Sync albums
  const fetched = await getLibraryAlbums(tokens.accessToken);
  const settings = db.getSettings(user.id);
  let added = 0;

  for (const ytm of fetched) {
    if (db.albumExists(user.id, ytm.browseId)) continue;
    // Respect allowed release types
    if (ytm.releaseType !== 'Unknown' && !settings.allowedTypes.includes(ytm.releaseType)) continue;

    const album: Album = {
      id:            ytm.browseId,
      title:         ytm.title,
      artist:        ytm.artist,
      year:          ytm.year,
      thumbnail:     ytm.thumbnail,
      releaseType:   ytm.releaseType,
      savedAt:       new Date().toISOString(),
      snoozedUntil:  null,
      silenced:      false,
      remindersSent: [],
    };
    db.insertAlbum(user.id, album);
    added++;
  }

  db.setLastSync(user.id, new Date().toISOString());
  console.log(`  ✓ Sync — ${added} new, ${fetched.length} total in library`);
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
    console.log(`Processing user ${user.id}…`);
    try {
      await syncUser(user);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      console.error(`  Sync failed for ${user.id}:`, msg);

      // If auth error, notify the user to re-authenticate
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid_grant')) {
        console.log(`  Auth error — sending push to re-authenticate`);
        await sendPush(
          user.id,
          { id: '', title: 'Unplayed', artist: '', year: '', thumbnail: '',
            releaseType: 'Unknown', savedAt: '', snoozedUntil: null,
            silenced: false, remindersSent: [] },
          '🔐 Unplayed needs re-authentication',
          'Your YouTube Music connection expired. Open Unplayed to reconnect.'
        );
      }
    }

    // Reminders — only if current UTC hour matches user's notifyHour
    const currentHour = new Date().getUTCHours();
    const notifyHour = db.getSettings(user.id).notifyHour ?? 19;
    if (currentHour === notifyHour) {
      const { sent, skipped } = await runRemindersForUser(user.id);
      console.log(`  ✓ Reminders — ${sent} sent, ${skipped} skipped`);
    } else {
      console.log(`  ✓ Reminders — skipped (current=${currentHour} UTC, notify=${notifyHour} UTC)`);
    }
  }
}

export { main };
// Only auto-run if called directly
if (require.main === module) {
  main().catch(err => { console.error('Cron fatal:', err); process.exit(1); });
}
