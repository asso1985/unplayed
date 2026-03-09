import { Router, Request, Response } from 'express';
import fs from 'fs';
import { db, oauthStore, pushStore, PATHS } from '../store';
import { getLibraryAlbums } from '../ytmusic';
import { Album, PushSub } from '../types';
import { daysSince } from '../reminders';
import { startDeviceFlow, pollDeviceFlow } from '../oauth';

export const router = Router();

// In-memory pending device code — single user, so fine
let pendingDeviceCode: string | null = null;

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', (_req, res: Response) => {
  const data = db.load();
  res.json({
    authReady:  oauthStore.exists(),
    albumCount: data.albums.filter(a => !a.silenced).length,
    lastSync:   data.lastSync,
    pushKey:    process.env['VAPID_PUBLIC_KEY'] ?? '',
  });
});

// ── OAuth device flow ─────────────────────────────────────────────────────────

router.post('/auth/start', async (_req, res: Response) => {
  try {
    const result = await startDeviceFlow();
    pendingDeviceCode = result.deviceCode;
    res.json({
      userCode:        result.userCode,
      verificationUrl: result.verificationUrl,
      expiresIn:       result.expiresIn,
      interval:        result.interval,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post('/auth/poll', async (_req, res: Response) => {
  if (!pendingDeviceCode) {
    res.status(400).json({ error: 'No auth flow in progress' });
    return;
  }
  try {
    const result = await pollDeviceFlow(pendingDeviceCode);
    if (result.status === 'approved') {
      oauthStore.save(result.tokens);
      pendingDeviceCode = null;
    }
    res.json({ status: result.status, ...(result.status === 'error' && { message: (result as {message:string}).message }) });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.delete('/auth', (_req, res: Response) => {
  try { fs.unlinkSync(PATHS.auth); } catch {}
  pendingDeviceCode = null;
  res.json({ ok: true });
});

// ── Albums ────────────────────────────────────────────────────────────────────

router.get('/albums', (_req, res: Response) => {
  const data = db.load();
  const albums = data.albums
    .filter(a => !a.silenced)
    .map(a => ({
      ...a,
      ageDays: daysSince(a.savedAt),
      snoozedDaysLeft: a.snoozedUntil
        ? Math.max(0, Math.ceil((new Date(a.snoozedUntil).getTime() - Date.now()) / 86_400_000))
        : null,
    }))
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  res.json({ albums, settings: data.settings });
});

router.post('/albums/:id/silence', (req: Request, res: Response) => {
  const data = db.load();
  const album = data.albums.find(a => a.id === req.params['id']);
  if (!album) { res.status(404).json({ error: 'Not found' }); return; }
  album.silenced = true;
  db.save(data);
  res.json({ ok: true });
});

router.post('/albums/:id/snooze', (req: Request, res: Response) => {
  const { days } = req.body as { days?: number };
  if (!days || days < 1) { res.status(400).json({ error: 'days required' }); return; }
  const data = db.load();
  const album = data.albums.find(a => a.id === req.params['id']);
  if (!album) { res.status(404).json({ error: 'Not found' }); return; }
  album.snoozedUntil = new Date(Date.now() + days * 86_400_000).toISOString();
  db.save(data);
  res.json({ ok: true, snoozedUntil: album.snoozedUntil });
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', (_req, res: Response) => {
  res.json({ settings: db.load().settings });
});

router.post('/settings', (req: Request, res: Response) => {
  const { reminderDays, allowedTypes } = req.body as {
    reminderDays?: unknown;
    allowedTypes?: unknown;
  };
  if (!Array.isArray(reminderDays) || !reminderDays.every(d => typeof d === 'number' && d > 0)) {
    res.status(400).json({ error: 'reminderDays must be an array of positive numbers' });
    return;
  }
  const validTypes = ['Album', 'EP', 'Single', 'Unknown'];
  if (!Array.isArray(allowedTypes) || !allowedTypes.every(t => validTypes.includes(t as string))) {
    res.status(400).json({ error: 'allowedTypes must be Album, EP, Single, or Unknown' });
    return;
  }
  if ((allowedTypes as string[]).length === 0) {
    res.status(400).json({ error: 'Select at least one release type' });
    return;
  }
  const data = db.load();
  data.settings.reminderDays = (reminderDays as number[]).slice(0, 5).sort((a, b) => a - b);
  data.settings.allowedTypes = allowedTypes as import('../types').ReleaseType[];
  db.save(data);
  res.json({ ok: true, settings: data.settings });
});

// ── Push ──────────────────────────────────────────────────────────────────────

router.post('/push/subscribe', (req: Request, res: Response) => {
  const sub = req.body as PushSub;
  if (!sub?.endpoint || !sub?.keys) { res.status(400).json({ error: 'Invalid sub' }); return; }
  pushStore.add(sub);
  res.json({ ok: true });
});

// ── Manual cron trigger (for testing) ────────────────────────────────────────
router.post('/cron/run', async (_req, res: Response) => {
  try {
    const { main } = await import('../scripts/sync-and-remind');
    await main();
    res.json({ ok: true });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ── Debug YTM (remove after testing) ─────────────────────────────────────────
router.get('/debug/ytm', async (_req, res: Response) => {
  const tokens = oauthStore.load();
  if (!tokens) { res.json({ error: 'No tokens' }); return; }
  
  const r = await fetch('https://music.youtube.com/youtubei/v1/browse?alt=json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokens.accessToken}`,
      'X-Goog-AuthUser': '0',
      'Accept': '*/*',
      'Origin': 'https://music.youtube.com',
      'x-origin': 'https://music.youtube.com',
      'Referer': 'https://music.youtube.com/',
    },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00', hl: 'en', gl: 'US' } },
      browseId: 'FEmusic_liked_albums'
    }),
  });
  
  const text = await r.text();
  res.json({ status: r.status, body: text.slice(0, 2000) });
});
