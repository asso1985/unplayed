import * as db from './db';
import { sendPush, sendDigestPush } from './push';
import { Album } from './types';

export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000);
}

function isSnoozed(album: Album): boolean {
  if (!album.snoozedUntil) return false;
  return new Date(album.snoozedUntil) > new Date();
}

function nextDueReminder(album: Album, reminderDays: number[]): number | null {
  for (const day of [...reminderDays].sort((a, b) => a - b)) {
    if (album.remindersSent.includes(day)) continue;
    if (daysSince(album.savedAt) >= day) return day;
  }
  return null;
}

function reminderMessage(dayThreshold: number): { title: string; body: string } {
  if (dayThreshold <= 3)  return { title: '🎵 New save!',      body: 'You liked this a few days ago — ready to listen?' };
  if (dayThreshold <= 7)  return { title: '🎶 Still unheard?', body: "A week since you saved this. Give it a spin." };
  return                         { title: '📀 Long time…',     body: `It's been ${dayThreshold} days. Don't let this one slip away.` };
}

/** If more than this many albums are due at once, send a single digest instead */
const DIGEST_THRESHOLD = 2;

export async function runRemindersForUser(userId: string): Promise<{ sent: number; skipped: number }> {
  const albums = db.getAllAlbums(userId);
  const settings = db.getSettings(userId);
  let skipped = 0;

  // 1. Collect all due reminders
  const due: { album: Album; day: number }[] = [];
  for (const album of albums) {
    if (album.silenced || isSnoozed(album)) { skipped++; continue; }
    const day = nextDueReminder(album, settings.reminderDays);
    if (day === null) { skipped++; continue; }
    due.push({ album, day });
  }

  if (due.length === 0) return { sent: 0, skipped };

  // 2. Mark all as reminded regardless of send mode
  for (const { album, day } of due) {
    album.remindersSent.push(day);
    db.updateRemindersSent(userId, album.id, album.remindersSent);
  }

  // 3. Send: individual if few, digest if many
  if (due.length <= DIGEST_THRESHOLD) {
    for (const { album, day } of due) {
      const { title, body } = reminderMessage(day);
      await sendPush(userId, album, title, `${album.title} by ${album.artist} — ${body}`);
    }
  } else {
    await sendDigestPush(userId, due.length);
  }

  return { sent: due.length, skipped };
}
