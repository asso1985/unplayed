export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Unknown';
export type Provider = 'youtube' | 'spotify';

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: string;
  thumbnail: string;
  releaseType: ReleaseType;
  savedAt: string;
  snoozedUntil: string | null;
  silenced: boolean;
  remindersSent: number[];
  ageDays: number;
  snoozedDaysLeft: number | null;
}

export interface Settings {
  reminderDays: number[];
  allowedTypes: ReleaseType[];
  notifyHour: number;       // desired LOCAL hour (0-23)
  timezoneOffset: number;   // minutes west of UTC from getTimezoneOffset()
}

export interface StatusResponse {
  authReady: boolean;
  albumCount: number;
  lastSync: string | null;
  pushKey: string;
  provider: Provider | null;
}

export interface AlbumsResponse {
  albums: Album[];
  settings: Settings;
}

export interface AuthStartResponse {
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

export interface AuthPollResponse {
  status: 'pending' | 'approved' | 'expired' | 'error';
  message?: string;
}

// BeforeInstallPromptEvent is not in standard lib.dom.d.ts
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
