import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import * as db from '../db';
import { daysSince } from '../reminders';
import { startDeviceFlow, pollDeviceFlow } from '../oauth';
import { getSpotifyAuthUrl, exchangeCode } from '../spotify';

export const router = Router();

/** Return userId or send 401. */
function requireUser(req: Request, res: Response): string | null {
  if (!req.userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  return req.userId;
}

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/status', (req: Request, res: Response) => {
  const userId = req.userId;
  const hasTokens = userId ? db.getTokens(userId) !== null : false;
  const count = userId ? db.albumCount(userId) : 0;
  const users = userId ? db.getAllUsersWithTokens() : [];
  const lastSync = users.find(u => u.id === userId)?.lastSync ?? null;
  const provider = userId ? db.getUserProvider(userId) : null;

  res.json({
    authReady:  hasTokens,
    albumCount: count,
    lastSync,
    pushKey:    process.env['VAPID_PUBLIC_KEY'] ?? '',
    provider,
  });
});

// ── YouTube Music OAuth device flow ───────────────────────────────────────────

router.post('/auth/start', async (req: Request, res: Response) => {
  try {
    const result = await startDeviceFlow();
    db.setDeviceCode(req.sessionId, result.deviceCode);
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

router.post('/auth/poll', async (req: Request, res: Response) => {
  const session = db.getSession(req.sessionId);

  if (session?.deviceCode) {
    // ── YouTube Music device code flow ──────────────────────────────────────
    try {
      const result = await pollDeviceFlow(session.deviceCode);
      if (result.status === 'approved') {
        let userId = req.userId;
        if (!userId) {
          userId = db.createUser('youtube');
          db.linkSessionToUser(req.sessionId, userId);
          req.userId = userId;
        }
        db.upsertTokens(userId, result.tokens);
        db.setDeviceCode(req.sessionId, null);
      }
      res.json({
        status: result.status,
        ...(result.status === 'error' && { message: (result as { message: string }).message }),
      });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }

  } else if (session?.oauthState) {
    // ── Spotify callback flow — check if callback has completed ─────────────
    if (new Date() > new Date(session.oauthExpiresAt!)) {
      db.clearOAuthState(req.sessionId);
      res.json({ status: 'expired' });
    } else if (session.userId) {
      db.clearOAuthState(req.sessionId);
      res.json({ status: 'approved' });
    } else {
      res.json({ status: 'pending' });
    }

  } else {
    res.status(400).json({ error: 'No auth flow in progress' });
  }
});

router.delete('/auth', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  db.deleteTokens(userId);
  db.setDeviceCode(req.sessionId, null);
  db.clearOAuthState(req.sessionId);
  db.deleteUserAlbums(userId);
  res.json({ ok: true });
});

// ── Spotify OAuth ─────────────────────────────────────────────────────────────

router.get('/auth/spotify/start', (req: Request, res: Response) => {
  try {
    const state = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    db.setOAuthState(req.sessionId, state, expiresAt);
    res.redirect(getSpotifyAuthUrl(state));
  } catch (err: unknown) {
    res.status(500).send(`<html><body><p>Error: ${(err as Error).message}</p></body></html>`);
  }
});

const CLOSE_POPUP_HTML = `<!DOCTYPE html>
<html>
<head><title>Connected</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0f;color:#fff;}</style>
</head>
<body>
<div style="text-align:center">
  <p style="font-size:1.2rem">✓ Spotify connected!</p>
  <p style="color:#aaa;font-size:0.85rem">You can close this window.</p>
</div>
<script>setTimeout(()=>window.close(),1000);</script>
</body>
</html>`;

router.get('/auth/spotify/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    res.send(`<html><body><p>Spotify auth denied: ${error}</p><script>setTimeout(()=>window.close(),3000)</script></body></html>`);
    return;
  }

  const session = db.getSession(req.sessionId);

  if (!session?.oauthState || session.oauthState !== state) {
    res.status(400).send('<html><body><p>Invalid state parameter.</p></body></html>');
    return;
  }

  if (new Date() > new Date(session.oauthExpiresAt!)) {
    db.clearOAuthState(req.sessionId);
    res.status(400).send('<html><body><p>Auth flow expired. Please try again.</p></body></html>');
    return;
  }

  try {
    const tokens = await exchangeCode(code!);
    let userId = req.userId;
    if (!userId) {
      userId = db.createUser('spotify');
      db.linkSessionToUser(req.sessionId, userId);
      req.userId = userId;
    }
    db.upsertTokens(userId, tokens);
    // Keep oauthState set — poll endpoint uses its presence to detect Spotify flow,
    // and checks session.userId to determine approval. It clears state on 'approved'.
    res.send(CLOSE_POPUP_HTML);
  } catch (err: unknown) {
    res.status(500).send(`<html><body><p>Error: ${(err as Error).message}</p><script>setTimeout(()=>window.close(),5000)</script></body></html>`);
  }
});

// ── Albums ────────────────────────────────────────────────────────────────────

router.get('/albums', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const albums = db.getAlbums(userId).map(a => ({
    ...a,
    ageDays: daysSince(a.savedAt),
    snoozedDaysLeft: a.snoozedUntil
      ? Math.max(0, Math.ceil((new Date(a.snoozedUntil).getTime() - Date.now()) / 86_400_000))
      : null,
  }));
  res.json({ albums, settings: db.getSettings(userId) });
});

router.post('/albums/:id/silence', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  if (!db.silenceAlbum(userId, req.params['id']!)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true });
});

router.post('/albums/:id/snooze', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { days } = req.body as { days?: number };
  if (!days || days < 1) { res.status(400).json({ error: 'days required' }); return; }
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  if (!db.snoozeAlbum(userId, req.params['id']!, until)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true, snoozedUntil: until });
});

// ── Settings ──────────────────────────────────────────────────────────────────

router.get('/settings', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  res.json({ settings: db.getSettings(userId) });
});

router.post('/settings', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const { reminderDays, allowedTypes, notifyHour } = req.body as {
    reminderDays?: unknown;
    allowedTypes?: unknown;
    notifyHour?: unknown;
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
  if (notifyHour !== undefined && (typeof notifyHour !== 'number' || notifyHour < 0 || notifyHour > 23)) {
    res.status(400).json({ error: 'notifyHour must be 0-23' });
    return;
  }

  const current = db.getSettings(userId);
  const updated = {
    reminderDays: (reminderDays as number[]).slice(0, 5).sort((a, b) => a - b),
    allowedTypes: allowedTypes as import('../types').ReleaseType[],
    notifyHour: notifyHour !== undefined ? (notifyHour as number) : current.notifyHour,
  };
  db.upsertSettings(userId, updated);
  res.json({ ok: true, settings: updated });
});

// ── Push ──────────────────────────────────────────────────────────────────────

router.post('/push/subscribe', (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const sub = req.body as import('../types').PushSub;
  if (!sub?.endpoint || !sub?.keys) { res.status(400).json({ error: 'Invalid sub' }); return; }
  db.addPushSub(userId, sub);
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

// ── Test push ────────────────────────────────────────────────────────────────
router.post('/push/test', async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const { sendPush } = await import('../push');
  const fakeAlbum = {
    id: 'test', title: 'Test Album', artist: 'Test Artist', year: '2024',
    thumbnail: '', releaseType: 'Album' as const, savedAt: new Date().toISOString(),
    snoozedUntil: null, silenced: false, remindersSent: []
  };
  await sendPush(userId, fakeAlbum, '🎵 Test notification', 'Unplayed push notifications are working!');
  res.json({ ok: true });
});
