import fs from 'fs';
import path from 'path';
import { AppData, PushSub, DEFAULT_SETTINGS } from './types';

const DATA_DIR = process.env['DATA_DIR'] ?? path.resolve('.');

export const PATHS = {
  data: path.join(DATA_DIR, 'data.json'),
  subs: path.join(DATA_DIR, 'push_subscriptions.json'),
  auth: path.join(DATA_DIR, 'auth.json'),
};

function read<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; }
  catch { return fallback; }
}

function write(p: string, data: unknown): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export const db = {
  load: (): AppData => {
    const d = read<Partial<AppData>>(PATHS.data, {});
    return {
      albums:   d.albums   ?? [],
      settings: d.settings ?? { ...DEFAULT_SETTINGS },
      lastSync: d.lastSync ?? null,
    };
  },
  save: (data: AppData): void => write(PATHS.data, data),
};

export const pushStore = {
  all: (): PushSub[] => read<PushSub[]>(PATHS.subs, []),
  add(sub: PushSub): void {
    const subs = this.all();
    if (!subs.find(s => s.endpoint === sub.endpoint)) {
      subs.push(sub);
      write(PATHS.subs, subs);
    }
  },
  remove(endpoint: string): void {
    write(PATHS.subs, this.all().filter(s => s.endpoint !== endpoint));
  },
};

import type { OAuthTokens } from './oauth';

export const oauthStore = {
  exists: (): boolean => fs.existsSync(PATHS.auth),
  load:   (): OAuthTokens | null => read<OAuthTokens | null>(PATHS.auth, null),
  save:   (tokens: OAuthTokens): void => write(PATHS.auth, tokens),
};
