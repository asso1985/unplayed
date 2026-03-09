/**
 * migrate-json.ts
 * One-time migration: reads existing JSON files and imports into SQLite.
 *
 * Usage:
 *   DATA_DIR=/data node dist/scripts/migrate-json.js
 *
 * Safe to re-run — it will skip if any users already exist.
 */
import fs from 'fs';
import path from 'path';
import * as db from '../db';
import { Album, PushSub, Settings, DEFAULT_SETTINGS } from '../types';
import type { OAuthTokens } from '../oauth';

const DATA_DIR = process.env['DATA_DIR'] ?? path.resolve('.');

const PATHS = {
  data: path.join(DATA_DIR, 'data.json'),
  subs: path.join(DATA_DIR, 'push_subscriptions.json'),
  auth: path.join(DATA_DIR, 'auth.json'),
};

function readJson<T>(p: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; }
  catch { return fallback; }
}

function main() {
  console.log('Unplayed JSON → SQLite migration');
  console.log(`DATA_DIR: ${DATA_DIR}`);

  // Check if already migrated
  const existing = db.getAllUsersWithTokens();
  if (existing.length > 0) {
    console.log(`Already have ${existing.length} user(s) in SQLite — skipping migration.`);
    return;
  }

  // Read JSON files
  const appData = readJson<{ albums?: Album[]; settings?: Settings; lastSync?: string | null }>(PATHS.data, {});
  const pushSubs = readJson<PushSub[]>(PATHS.subs, []);
  const tokens = readJson<OAuthTokens | null>(PATHS.auth, null);

  const albums = appData.albums ?? [];
  const settings = appData.settings ?? { ...DEFAULT_SETTINGS };
  const lastSync = appData.lastSync ?? null;

  console.log(`Found: ${albums.length} albums, ${pushSubs.length} push subs, tokens=${!!tokens}`);

  // Create user
  const userId = db.createUser();
  console.log(`Created user: ${userId}`);

  // Import tokens
  if (tokens) {
    db.upsertTokens(userId, tokens);
    console.log('✓ Tokens imported');
  }

  // Import settings
  db.upsertSettings(userId, settings);
  console.log('✓ Settings imported');

  // Set lastSync
  if (lastSync) {
    db.setLastSync(userId, lastSync);
    console.log(`✓ lastSync set to ${lastSync}`);
  }

  // Import albums
  for (const album of albums) {
    db.insertAlbum(userId, album);
  }
  console.log(`✓ ${albums.length} albums imported`);

  // Import push subscriptions
  for (const sub of pushSubs) {
    db.addPushSub(userId, sub);
  }
  console.log(`✓ ${pushSubs.length} push subscriptions imported`);

  console.log('\nMigration complete! JSON files left intact for manual cleanup.');
}

main();
