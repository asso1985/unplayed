/**
 * oauth.ts
 * Google Device Authorization Flow for YouTube Music access.
 *
 * Flow:
 *   1. POST /api/auth/start  → get device_code + user_code
 *   2. User visits google.com/device, enters user_code
 *   3. Poll /api/auth/poll   → exchanges device_code for tokens
 *   4. Store refresh_token, auto-renew access_token forever
 *
 * Scopes: youtube readonly is enough to read the liked albums library.
 */

// ---------------------------------------------------------------------------
// You need a Google OAuth client ID + secret.
// Create one at console.cloud.google.com:
//   APIs & Services → Credentials → Create → OAuth client ID → TV and Limited Input
// Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Railway env vars.
// ---------------------------------------------------------------------------

const DEVICE_AUTH_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL       = 'https://oauth2.googleapis.com/token';
const SCOPE           = 'https://www.googleapis.com/auth/youtube';

export interface OAuthTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;   // unix ms
}

export interface DeviceCodeResponse {
  deviceCode:      string;
  userCode:        string;
  verificationUrl: string;
  expiresIn:       number;   // seconds
  interval:        number;   // polling interval seconds
}

function clientId():     string { return process.env['GOOGLE_CLIENT_ID']     ?? ''; }
function clientSecret(): string { return process.env['GOOGLE_CLIENT_SECRET'] ?? ''; }

/** Step 1 — request a device code */
export async function startDeviceFlow(): Promise<DeviceCodeResponse> {
  if (!clientId()) throw new Error('GOOGLE_CLIENT_ID env var not set');

  const res = await fetch(DEVICE_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), scope: SCOPE }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Device flow start failed: ${res.status} ${text}`);
  }

  const json = await res.json() as {
    device_code: string;
    user_code: string;
    verification_url: string;
    expires_in: number;
    interval: number;
  };

  return {
    deviceCode:      json.device_code,
    userCode:        json.user_code,
    verificationUrl: json.verification_url,
    expiresIn:       json.expires_in,
    interval:        json.interval,
  };
}

/** Step 2 — poll until the user approves or the code expires */
export type PollResult =
  | { status: 'pending' }
  | { status: 'approved'; tokens: OAuthTokens }
  | { status: 'expired' }
  | { status: 'error'; message: string };

export async function pollDeviceFlow(deviceCode: string): Promise<PollResult> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId(),
      client_secret: clientSecret(),
      device_code:   deviceCode,
      grant_type:    'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });

  const json = await res.json() as Record<string, unknown>;

  if (json['error']) {
    const err = String(json['error']);
    if (err === 'authorization_pending') return { status: 'pending' };
    if (err === 'expired_token')         return { status: 'expired' };
    return { status: 'error', message: err };
  }

  if (!json['access_token'] || !json['refresh_token']) {
    return { status: 'error', message: 'Missing tokens in response' };
  }

  return {
    status: 'approved',
    tokens: {
      accessToken:  String(json['access_token']),
      refreshToken: String(json['refresh_token']),
      expiresAt:    Date.now() + Number(json['expires_in'] ?? 3600) * 1000,
    },
  };
}

/** Refresh an expired access token using the stored refresh token */
export async function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId(),
      client_secret: clientSecret(),
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const json = await res.json() as Record<string, unknown>;

  return {
    accessToken:  String(json['access_token']),
    refreshToken: refreshToken,  // refresh tokens don't rotate (usually)
    expiresAt:    Date.now() + Number(json['expires_in'] ?? 3600) * 1000,
  };
}

/** Get a valid access token — refreshes automatically if expired */
export async function getValidAccessToken(stored: OAuthTokens): Promise<OAuthTokens> {
  // Refresh 5 minutes before expiry to be safe
  if (Date.now() < stored.expiresAt - 5 * 60 * 1000) return stored;
  return refreshAccessToken(stored.refreshToken);
}
