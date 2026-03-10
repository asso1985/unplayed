/**
 * spotify.ts
 * Spotify OAuth Authorization Code flow + library fetch.
 *
 * Flow:
 *   1. GET /api/auth/spotify/start  → redirect browser to Spotify consent page
 *   2. User approves in popup window
 *   3. Spotify redirects popup to GET /api/auth/spotify/callback?code=&state=
 *   4. Server exchanges code for tokens, links session, closes popup
 *   5. Parent window polls /api/auth/poll → 'approved' when session.userId is set
 *
 * Scopes: user-library-read (saved albums — no Premium required)
 */

import type { OAuthTokens } from './oauth';
import type { ReleaseType } from './types';

const SPOTIFY_AUTH_URL  = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SCOPE     = 'user-library-read';

function clientId():     string { return process.env['SPOTIFY_CLIENT_ID']     ?? ''; }
function clientSecret(): string { return process.env['SPOTIFY_CLIENT_SECRET'] ?? ''; }
function redirectUri():  string { return process.env['SPOTIFY_REDIRECT_URI']  ?? ''; }

/** Base64 encoded "client_id:client_secret" for Basic auth header */
function basicAuth(): string {
  return Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
}

/** Build the Spotify authorization URL to redirect the user to */
export function getSpotifyAuthUrl(state: string): string {
  if (!clientId()) throw new Error('SPOTIFY_CLIENT_ID env var not set');
  if (!redirectUri()) throw new Error('SPOTIFY_REDIRECT_URI env var not set');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId(),
    scope:         SPOTIFY_SCOPE,
    redirect_uri:  redirectUri(),
    state,
  });
  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens */
export async function exchangeCode(code: string): Promise<OAuthTokens> {
  if (!clientSecret()) throw new Error('SPOTIFY_CLIENT_SECRET env var not set');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: redirectUri(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token exchange failed: ${res.status} ${text}`);
  }

  const json = await res.json() as Record<string, unknown>;

  if (!json['access_token']) {
    throw new Error(`Spotify token exchange: missing access_token`);
  }

  return {
    accessToken:  String(json['access_token']),
    refreshToken: String(json['refresh_token'] ?? ''),
    expiresAt:    Date.now() + Number(json['expires_in'] ?? 3600) * 1000,
  };
}

/** Refresh an expired Spotify access token */
export async function refreshSpotifyToken(refreshToken: string): Promise<OAuthTokens> {
  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify token refresh failed: ${res.status} ${text}`);
  }

  const json = await res.json() as Record<string, unknown>;

  return {
    accessToken:  String(json['access_token']),
    // Spotify doesn't always return a new refresh token — keep the existing one
    refreshToken: json['refresh_token'] ? String(json['refresh_token']) : refreshToken,
    expiresAt:    Date.now() + Number(json['expires_in'] ?? 3600) * 1000,
  };
}

/** Get a valid access token — refreshes automatically 5 minutes before expiry */
export async function getValidSpotifyToken(stored: OAuthTokens): Promise<OAuthTokens> {
  if (Date.now() < stored.expiresAt - 5 * 60 * 1000) return stored;
  return refreshSpotifyToken(stored.refreshToken);
}

// ── Library fetch ──────────────────────────────────────────────────────────────

export interface SpotifyAlbum {
  id:          string;
  title:       string;
  artist:      string;
  year:        string;
  thumbnail:   string;
  releaseType: ReleaseType;
}

type SpotifyAlbumType = 'album' | 'single' | 'compilation';

function mapReleaseType(type: SpotifyAlbumType): ReleaseType {
  if (type === 'single')  return 'Single';
  return 'Album'; // 'album' and 'compilation'
}

interface SpotifyApiAlbum {
  id:           string;
  name:         string;
  artists:      { name: string }[];
  release_date: string;
  album_type:   SpotifyAlbumType;
  images:       { url: string; height: number; width: number }[];
}

interface SpotifySavedAlbumItem {
  added_at: string;
  album:    SpotifyApiAlbum;
}

interface SpotifyPagedResponse {
  items: SpotifySavedAlbumItem[];
  next:  string | null;
  total: number;
}

/** Fetch all saved albums from the user's Spotify library (paginated) */
export async function getSpotifyLibraryAlbums(accessToken: string): Promise<SpotifyAlbum[]> {
  const albums: SpotifyAlbum[] = [];
  let url: string | null = 'https://api.spotify.com/v1/me/albums?limit=50';

  while (url) {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Spotify library fetch failed: ${res.status} ${text}`);
    }

    const page = await res.json() as SpotifyPagedResponse;

    for (const item of page.items) {
      const a = item.album;
      albums.push({
        id:          a.id,
        title:       a.name,
        artist:      a.artists[0]?.name ?? 'Unknown Artist',
        year:        a.release_date?.substring(0, 4) ?? '',
        thumbnail:   a.images[0]?.url ?? '',
        releaseType: mapReleaseType(a.album_type),
      });
    }

    url = page.next;
  }

  return albums;
}
