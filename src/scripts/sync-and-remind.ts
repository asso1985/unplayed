/**
 * sync-and-remind.ts
 * Run by Railway cron every 6 hours.
 * 1. Auto-refreshes OAuth token if needed
 * 2. Pulls latest liked albums from YT Music
 * 3. Adds new ones to the db (filtered by allowedTypes)
 * 4. Fires any due push notifications
 */
import { db, oauthStore } from '../store';
import { getLibraryAlbums } from '../ytmusic';
import { initPush, sendPush } from '../push';
import { runReminders } from '../reminders';
import { getValidAccessToken } from '../oauth';
import { Album } from '../types';

async function main() {
  console.log(`[${new Date().toISOString()}] Unplayed cron starting…`);
  initPush();

  // ── 1. Check auth ──────────────────────────────────────────────────────────
  if (!oauthStore.exists()) {
    console.warn('No OAuth tokens — skipping sync. Complete setup in the app.');
  } else {
    try {
      // Auto-refresh token if expiring soon
      let tokens = oauthStore.load()!;
      const fresh = await getValidAccessToken(tokens);
      if (fresh.accessToken !== tokens.accessToken) {
        oauthStore.save(fresh);
        console.log('✓ Access token refreshed');
        tokens = fresh;
      }

      // ── 2. Sync ─────────────────────────────────────────────────────────────
      const fetched = await getLibraryAlbums(tokens.accessToken);
      const data    = db.load();
      const known   = new Set(data.albums.map(a => a.id));
      let added = 0;

      for (const ytm of fetched) {
        if (known.has(ytm.browseId)) continue;
        // Respect allowed release types
        const allowed = data.settings.allowedTypes;
        if (ytm.releaseType !== 'Unknown' && !allowed.includes(ytm.releaseType)) continue;

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
        data.albums.push(album);
        known.add(ytm.browseId);
        added++;
      }

      data.lastSync = new Date().toISOString();
      db.save(data);
      console.log(`✓ Sync — ${added} new, ${fetched.length} total in library`);
    } catch (err: unknown) {
      const msg = (err as Error).message ?? String(err);
      console.error('Sync failed:', msg);

      // If it looks like an auth error, send a push notification
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid_grant')) {
        console.log('Auth error — sending push notification to re-authenticate');
        await sendPush(
          { id: '', title: 'Unplayed', artist: '', year: '', thumbnail: '',
            releaseType: 'Unknown', savedAt: '', snoozedUntil: null,
            silenced: false, remindersSent: [] },
          '🔐 Unplayed needs re-authentication',
          'Your YouTube Music connection expired. Open Unplayed to reconnect.'
        );
      }
    }
  }

  // ── 3. Reminders ────────────────────────────────────────────────────────────
  const currentHour = new Date().getUTCHours();
  const notifyHour  = db.load().settings.notifyHour ?? 19;
  if (currentHour === notifyHour) {
    const { sent, skipped } = await runReminders();
    console.log(`✓ Reminders — ${sent} sent, ${skipped} skipped`);
  } else {
    console.log(`✓ Reminders — skipped (current=${currentHour} UTC, notify=${notifyHour} UTC)`);
  }
}

export { main };
// Only auto-run if called directly
if (require.main === module) {
  main().catch(err => { console.error('Cron fatal:', err); process.exit(1); });
}
