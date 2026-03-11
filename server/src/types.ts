export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Unknown';
export type Provider = 'youtube' | 'spotify';


export interface Album {
  id: string;           // YTM browseId / Spotify album ID
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

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Settings {
  reminderDays: number[];
  allowedTypes: ReleaseType[];
  notifyHour: number;       // desired LOCAL hour (0-23), e.g. 19 = 7 PM local time
  timezoneOffset: number;   // minutes west of UTC (from getTimezoneOffset()), e.g. 300 for EST
}

export const DEFAULT_SETTINGS: Settings = {
  reminderDays:   [1, 3, 7, 30],
  allowedTypes:   ['Album'],
  notifyHour:     19,
  timezoneOffset: 0,
};
