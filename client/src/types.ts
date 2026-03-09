export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Unknown';

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
  notifyHour: number;
}

export interface StatusResponse {
  authReady: boolean;
  albumCount: number;
  lastSync: string | null;
  pushKey: string;
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
