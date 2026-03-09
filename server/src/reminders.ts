import * as db from './db';
import { sendPush } from './push';
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

export async function runRemindersForUser(userId: string): Promise<{ sent: number; skipped: number }> {
  const albums = db.getAllAlbums(userId);
  const settings = db.getSettings(userId);
  let sent = 0, skipped = 0;

  for (const album of albums) {
    if (album.silenced || isSnoozed(album)) { skipped++; continue; }

    const due = nextDueReminder(album, settings.reminderDays);
    if (due === null) { skipped++; continue; }

    const { title, body } = reminderMessage(due);
    await sendPush(userId, album, title, `${album.title} by ${album.artist} — ${body}`);
    album.remindersSent.push(due);
    db.updateRemindersSent(userId, album.id, album.remindersSent);
    sent++;
  }

  return { sent, skipped };
}
