export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Unknown';


export interface Album {
  id: string;           // YTM browseId
  title: string;
  artist: string;
  year: string;
  thumbnail: string;
  releaseType: ReleaseType;
  savedAt: string;      // ISO — when we first saw it in the library
  // Reminder state
  snoozedUntil: string | null;  // ISO — if set, skip reminders until this date
  silenced: boolean;            // user hit "stop reminding", never ping again
  remindersSent: number[];      // days-since-saved at which we already fired
}

export interface Settings {
  reminderDays: number[];           // e.g. [3, 7, 30]
  allowedTypes: ReleaseType[];      // which release types to remind about
}

export interface AppData {
  albums: Album[];
  settings: Settings;
  lastSync: string | null;
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Settings {
  reminderDays: number[];
  allowedTypes: ReleaseType[];
  notifyHour: number;
}

export const DEFAULT_SETTINGS: Settings = {
  reminderDays:  [3, 7, 30],
  allowedTypes:  ['Album'],
  notifyHour:    19,
};
