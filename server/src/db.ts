import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { ulid } from 'ulid';
import type { OAuthTokens } from './oauth';
import { Album, Settings, PushSub, ReleaseType, Provider, DEFAULT_SETTINGS } from './types';

const DATA_DIR = process.env['DATA_DIR'] ?? path.resolve('.');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'unplayed.db');

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    last_sync  TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tokens (
    user_id       TEXT PRIMARY KEY REFERENCES users(id),
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS albums (
    id             TEXT NOT NULL,
    user_id        TEXT NOT NULL REFERENCES users(id),
    title          TEXT NOT NULL,
    artist         TEXT NOT NULL,
    year           TEXT NOT NULL,
    thumbnail      TEXT NOT NULL,
    release_type   TEXT NOT NULL,
    saved_at       TEXT NOT NULL,
    snoozed_until  TEXT,
    silenced       INTEGER NOT NULL DEFAULT 0,
    reminders_sent TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id, id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id       TEXT PRIMARY KEY REFERENCES users(id),
    reminder_days TEXT NOT NULL DEFAULT '[3,7,30]',
    allowed_types TEXT NOT NULL DEFAULT '["Album"]',
    notify_hour   INTEGER NOT NULL DEFAULT 19
  );

  CREATE TABLE IF NOT EXISTS push_subs (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL,
    p256dh   TEXT NOT NULL,
    auth     TEXT NOT NULL,
    UNIQUE(user_id, endpoint)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               TEXT PRIMARY KEY,
    user_id          TEXT REFERENCES users(id),
    device_code      TEXT,
    oauth_state      TEXT,
    oauth_expires_at TEXT,
    created_at       TEXT NOT NULL,
    expires_at       TEXT NOT NULL
  );
`);

// ── Migrations (safe to re-run) ────────────────────────────────────────────────

const userCols = (sqlite.pragma('table_info(users)') as { name: string }[]).map(c => c.name);
if (!userCols.includes('provider')) {
  sqlite.exec("ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'youtube'");
}

const sessCols = (sqlite.pragma('table_info(sessions)') as { name: string }[]).map(c => c.name);
if (!sessCols.includes('oauth_state')) {
  sqlite.exec('ALTER TABLE sessions ADD COLUMN oauth_state TEXT');
}
if (!sessCols.includes('oauth_expires_at')) {
  sqlite.exec('ALTER TABLE sessions ADD COLUMN oauth_expires_at TEXT');
}

// ── Users ──────────────────────────────────────────────────────────────────────

const _insertUser = sqlite.prepare(
  `INSERT INTO users (id, provider, created_at) VALUES (?, ?, ?)`
);

export function createUser(provider: Provider = 'youtube'): string {
  const id = ulid();
  _insertUser.run(id, provider, new Date().toISOString());
  return id;
}

interface UserWithTokens {
  id: string;
  lastSync: string | null;
  provider: Provider;
  tokens: OAuthTokens;
}

const _usersWithTokens = sqlite.prepare(`
  SELECT u.id, u.last_sync, u.provider, t.access_token, t.refresh_token, t.expires_at
  FROM users u JOIN tokens t ON u.id = t.user_id
`);

export function getAllUsersWithTokens(): UserWithTokens[] {
  const rows = _usersWithTokens.all() as {
    id: string; last_sync: string | null; provider: string;
    access_token: string; refresh_token: string; expires_at: number;
  }[];
  return rows.map(r => ({
    id: r.id,
    lastSync: r.last_sync,
    provider: (r.provider ?? 'youtube') as Provider,
    tokens: {
      accessToken: r.access_token,
      refreshToken: r.refresh_token,
      expiresAt: r.expires_at,
    },
  }));
}

const _getUserProvider = sqlite.prepare(
  `SELECT provider FROM users WHERE id = ?`
);

export function getUserProvider(userId: string): Provider {
  const row = _getUserProvider.get(userId) as { provider: string } | undefined;
  return (row?.provider ?? 'youtube') as Provider;
}

const _setLastSync = sqlite.prepare(
  `UPDATE users SET last_sync = ? WHERE id = ?`
);

export function setLastSync(userId: string, iso: string): void {
  _setLastSync.run(iso, userId);
}

// ── Tokens ─────────────────────────────────────────────────────────────────────

const _getTokens = sqlite.prepare(
  `SELECT access_token, refresh_token, expires_at FROM tokens WHERE user_id = ?`
);

export function getTokens(userId: string): OAuthTokens | null {
  const row = _getTokens.get(userId) as {
    access_token: string; refresh_token: string; expires_at: number;
  } | undefined;
  if (!row) return null;
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    expiresAt: row.expires_at,
  };
}

const _upsertTokens = sqlite.prepare(`
  INSERT INTO tokens (user_id, access_token, refresh_token, expires_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at
`);

export function upsertTokens(userId: string, t: OAuthTokens): void {
  _upsertTokens.run(userId, t.accessToken, t.refreshToken, t.expiresAt);
}

const _deleteTokens = sqlite.prepare(`DELETE FROM tokens WHERE user_id = ?`);

export function deleteTokens(userId: string): void {
  _deleteTokens.run(userId);
}

const _deleteUserPushSubs = sqlite.prepare(`DELETE FROM push_subs WHERE user_id = ?`);

export function deleteUserPushSubs(userId: string): void {
  _deleteUserPushSubs.run(userId);
}

const _deleteUserSettings = sqlite.prepare(`DELETE FROM settings WHERE user_id = ?`);

export function deleteUserSettings(userId: string): void {
  _deleteUserSettings.run(userId);
}

const _unlinkSession = sqlite.prepare(`UPDATE sessions SET user_id = NULL WHERE id = ?`);

export function unlinkSession(sessionId: string): void {
  _unlinkSession.run(sessionId);
}

const _deleteUser = sqlite.prepare(`DELETE FROM users WHERE id = ?`);

export function deleteUser(userId: string): void {
  _deleteUser.run(userId);
}

const _deleteUserAlbums = sqlite.prepare('DELETE from albums WHERE user_id = ?')

export function deleteUserAlbums(userId: string): void {
  _deleteUserAlbums.run(userId);
}

// ── Albums ─────────────────────────────────────────────────────────────────────

const _getAlbums = sqlite.prepare(
  `SELECT * FROM albums WHERE user_id = ? AND silenced = 0 ORDER BY saved_at DESC`
);

export function getAlbums(userId: string): Album[] {
  const rows = _getAlbums.all(userId) as AlbumRow[];
  return rows.map(rowToAlbum);
}

const _getAllAlbums = sqlite.prepare(
  `SELECT * FROM albums WHERE user_id = ?`
);

export function getAllAlbums(userId: string): Album[] {
  const rows = _getAllAlbums.all(userId) as AlbumRow[];
  return rows.map(rowToAlbum);
}

const _getAlbumById = sqlite.prepare(
  `SELECT * FROM albums WHERE user_id = ? AND id = ?`
);

export function getAlbumById(userId: string, id: string): Album | null {
  const row = _getAlbumById.get(userId, id) as AlbumRow | undefined;
  return row ? rowToAlbum(row) : null;
}

const _albumExists = sqlite.prepare(
  `SELECT 1 FROM albums WHERE user_id = ? AND id = ?`
);

export function albumExists(userId: string, id: string): boolean {
  return _albumExists.get(userId, id) !== undefined;
}

const _insertAlbum = sqlite.prepare(`
  INSERT INTO albums (id, user_id, title, artist, year, thumbnail, release_type, saved_at, snoozed_until, silenced, reminders_sent)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export function insertAlbum(userId: string, a: Album): void {
  _insertAlbum.run(
    a.id, userId, a.title, a.artist, a.year, a.thumbnail,
    a.releaseType, a.savedAt, a.snoozedUntil, a.silenced ? 1 : 0,
    JSON.stringify(a.remindersSent),
  );
}

const _silenceAlbum = sqlite.prepare(
  `UPDATE albums SET silenced = 1 WHERE user_id = ? AND id = ?`
);

export function silenceAlbum(userId: string, id: string): boolean {
  return _silenceAlbum.run(userId, id).changes > 0;
}

const _snoozeAlbum = sqlite.prepare(
  `UPDATE albums SET snoozed_until = ? WHERE user_id = ? AND id = ?`
);

export function snoozeAlbum(userId: string, id: string, until: string): boolean {
  return _snoozeAlbum.run(until, userId, id).changes > 0;
}

const _updateRemindersSent = sqlite.prepare(
  `UPDATE albums SET reminders_sent = ? WHERE user_id = ? AND id = ?`
);

export function updateRemindersSent(userId: string, id: string, sent: number[]): void {
  _updateRemindersSent.run(JSON.stringify(sent), userId, id);
}

// album row helper
interface AlbumRow {
  id: string; user_id: string; title: string; artist: string; year: string;
  thumbnail: string; release_type: string; saved_at: string;
  snoozed_until: string | null; silenced: number; reminders_sent: string;
}

function rowToAlbum(r: AlbumRow): Album {
  return {
    id: r.id,
    title: r.title,
    artist: r.artist,
    year: r.year,
    thumbnail: r.thumbnail,
    releaseType: r.release_type as ReleaseType,
    savedAt: r.saved_at,
    snoozedUntil: r.snoozed_until,
    silenced: r.silenced === 1,
    remindersSent: JSON.parse(r.reminders_sent) as number[],
  };
}

// ── Settings ───────────────────────────────────────────────────────────────────

const _getSettings = sqlite.prepare(
  `SELECT * FROM settings WHERE user_id = ?`
);

export function getSettings(userId: string): Settings {
  const row = _getSettings.get(userId) as {
    reminder_days: string; allowed_types: string; notify_hour: number;
  } | undefined;
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    reminderDays: JSON.parse(row.reminder_days) as number[],
    allowedTypes: JSON.parse(row.allowed_types) as ReleaseType[],
    notifyHour: row.notify_hour,
  };
}

const _upsertSettings = sqlite.prepare(`
  INSERT INTO settings (user_id, reminder_days, allowed_types, notify_hour)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET
    reminder_days = excluded.reminder_days,
    allowed_types = excluded.allowed_types,
    notify_hour   = excluded.notify_hour
`);

export function upsertSettings(userId: string, s: Settings): void {
  _upsertSettings.run(
    userId,
    JSON.stringify(s.reminderDays),
    JSON.stringify(s.allowedTypes),
    s.notifyHour,
  );
}

// ── Push subscriptions ─────────────────────────────────────────────────────────

const _getPushSubs = sqlite.prepare(
  `SELECT endpoint, p256dh, auth FROM push_subs WHERE user_id = ?`
);

export function getPushSubs(userId: string): PushSub[] {
  const rows = _getPushSubs.all(userId) as { endpoint: string; p256dh: string; auth: string }[];
  return rows.map(r => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

const _addPushSub = sqlite.prepare(`
  INSERT INTO push_subs (id, user_id, endpoint, p256dh, auth)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(user_id, endpoint) DO NOTHING
`);

export function addPushSub(userId: string, sub: PushSub): void {
  _addPushSub.run(ulid(), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth);
}

const _removePushSub = sqlite.prepare(
  `DELETE FROM push_subs WHERE endpoint = ?`
);

export function removePushSub(endpoint: string): void {
  _removePushSub.run(endpoint);
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string | null;
  deviceCode: string | null;
  oauthState: string | null;
  oauthExpiresAt: string | null;
  createdAt: string;
  expiresAt: string;
}

const SESSION_DAYS = 90;

const _insertSession = sqlite.prepare(`
  INSERT INTO sessions (id, user_id, device_code, created_at, expires_at)
  VALUES (?, ?, NULL, ?, ?)
`);

export function createSession(userId?: string): Session {
  const id = ulid();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  const createdAt = now.toISOString();
  const expiresAt = expires.toISOString();
  _insertSession.run(id, userId ?? null, createdAt, expiresAt);
  return { id, userId: userId ?? null, deviceCode: null, oauthState: null, oauthExpiresAt: null, createdAt, expiresAt };
}

const _getSession = sqlite.prepare(
  `SELECT id, user_id, device_code, oauth_state, oauth_expires_at, created_at, expires_at FROM sessions WHERE id = ?`
);

export function getSession(id: string): Session | null {
  const row = _getSession.get(id) as {
    id: string; user_id: string | null; device_code: string | null;
    oauth_state: string | null; oauth_expires_at: string | null;
    created_at: string; expires_at: string;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    deviceCode: row.device_code,
    oauthState: row.oauth_state,
    oauthExpiresAt: row.oauth_expires_at,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

const _linkSession = sqlite.prepare(
  `UPDATE sessions SET user_id = ? WHERE id = ?`
);

export function linkSessionToUser(sessionId: string, userId: string): void {
  _linkSession.run(userId, sessionId);
}

const _setDeviceCode = sqlite.prepare(
  `UPDATE sessions SET device_code = ? WHERE id = ?`
);

export function setDeviceCode(sessionId: string, code: string | null): void {
  _setDeviceCode.run(code, sessionId);
}

const _setOAuthState = sqlite.prepare(
  `UPDATE sessions SET oauth_state = ?, oauth_expires_at = ? WHERE id = ?`
);

export function setOAuthState(sessionId: string, state: string, expiresAt: string): void {
  _setOAuthState.run(state, expiresAt, sessionId);
}

const _clearOAuthState = sqlite.prepare(
  `UPDATE sessions SET oauth_state = NULL, oauth_expires_at = NULL WHERE id = ?`
);

export function clearOAuthState(sessionId: string): void {
  _clearOAuthState.run(sessionId);
}

const _clearExpired = sqlite.prepare(
  `DELETE FROM sessions WHERE expires_at < ?`
);

export function clearExpiredSessions(): void {
  _clearExpired.run(new Date().toISOString());
}

// ── Album count (for status) ───────────────────────────────────────────────────

const _albumCount = sqlite.prepare(
  `SELECT COUNT(*) as cnt FROM albums WHERE user_id = ? AND silenced = 0`
);

export function albumCount(userId: string): number {
  return (_albumCount.get(userId) as { cnt: number }).cnt;
}

// ── Expose raw sqlite for migration script ─────────────────────────────────────

export { sqlite };
