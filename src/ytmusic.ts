/**
 * ytmusic.ts
 * Minimal inline YT Music client — fetches liked/saved albums only.
 * No external dependencies, just native fetch (Node 18+).
 */

export type ReleaseType = 'Album' | 'EP' | 'Single' | 'Unknown';

export interface YTMAlbum {
  browseId: string;
  title: string;
  artist: string;
  year: string;
  thumbnail: string;
  releaseType: ReleaseType;
}

// (header-paste auth removed — see oauth.ts for device flow)

/** Safely pluck a nested value from YTM's deeply nested JSON */
function nav(obj: unknown, ...path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function firstText(runs: unknown): string {
  if (!Array.isArray(runs) || !runs.length) return '';
  return String(nav(runs[0], 'text') ?? '');
}

function joinRuns(runs: unknown): string {
  if (!Array.isArray(runs)) return '';
  return runs.map((r: unknown) => String(nav(r, 'text') ?? '')).join('');
}

function bestThumb(thumbnails: unknown): string {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return '';
  const last = thumbnails[thumbnails.length - 1];
  return String(nav(last, 'url') ?? '');
}

function parseAlbumItem(item: unknown): YTMAlbum | null {
  try {
    const mrlire = nav(item, 'musicTwoRowItemRenderer') as Record<string, unknown>;
    if (!mrlire) return null;

    const browseId = String(
      nav(mrlire, 'navigationEndpoint', 'browseEndpoint', 'browseId') ?? ''
    );
    if (!browseId) return null;

    const title = firstText(nav(mrlire, 'title', 'runs'));
    const subtitleRuns = nav(mrlire, 'subtitle', 'runs');
    // Subtitle format: ["Album", " • ", "Artist", " • ", "2023"]
    let artist = '';
    let year = '';
    let releaseType: ReleaseType = 'Unknown';
    if (Array.isArray(subtitleRuns)) {
      const texts = subtitleRuns.map((r: unknown) => String(nav(r, 'text') ?? ''));
      const parts = texts.filter(t => t.trim() && t.trim() !== '\u2022' && t.trim() !== '•');
      // 3+ parts: type • artist • year
      if (parts.length >= 3) {
        const raw = parts[0].trim();
        releaseType = (['Album', 'EP', 'Single'].includes(raw) ? raw : 'Unknown') as ReleaseType;
        artist = parts[parts.length - 2] ?? '';
        year   = parts[parts.length - 1] ?? '';
      } else if (parts.length === 2) {
        artist = parts[0] ?? '';
        year   = parts[1] ?? '';
      } else if (parts.length === 1) {
        artist = parts[0] ?? '';
      }
    }

    const thumbnail = bestThumb(
      nav(mrlire, 'thumbnailRenderer', 'musicThumbnailRenderer', 'thumbnail', 'thumbnails')
    );

    return { browseId, title, artist, year, thumbnail, releaseType };
  } catch {
    return null;
  }
}

/** Fetch all saved/liked albums from the user's YT Music library */
export async function getLibraryAlbums(
  accessToken: string,
  maxAlbums = 200
): Promise<YTMAlbum[]> {
  const context = {
    client: {
      clientName: 'TVHTML5',
      clientVersion: '7.20240101.00.00',
      hl: 'en',
      gl: 'US',
    },
  };

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'X-Goog-AuthUser': '0',
    'Accept': '*/*',
  };

  const albums: YTMAlbum[] = [];
  let continuation: string | null = null;

  do {
    const body: Record<string, unknown> = { context, browseId: 'FEmusic_liked_albums' };
    if (continuation) body['continuation'] = continuation;

    const res = await fetch('https://youtubei.googleapis.com/youtubei/v1/browse', {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`YTM API error: ${res.status} ${res.statusText}`);
    const json = await res.json() as unknown;

    // Extract items — location differs on first vs continuation pages
    let items: unknown[] = [];
    if (!continuation) {
      const grid = nav(
        json,
        'contents', 'singleColumnBrowseResultsRenderer', 'tabs', '0',
        'tabRenderer', 'content', 'sectionListRenderer', 'contents', '0',
        'gridRenderer', 'items'
      );
      items = Array.isArray(grid) ? grid : [];
    } else {
      const contItems = nav(json, 'continuationContents', 'gridContinuation', 'items');
      items = Array.isArray(contItems) ? contItems : [];
    }

    for (const item of items) {
      const parsed = parseAlbumItem(item);
      if (parsed) albums.push(parsed);
    }

    // Check for next page token
    const token = nav(
      json,
      'continuations', '0', 'nextContinuationData', 'continuation'
    ) ?? nav(
      json,
      'continuationContents', 'gridContinuation', 'continuations', '0',
      'nextContinuationData', 'continuation'
    );
    continuation = typeof token === 'string' ? token : null;

  } while (continuation && albums.length < maxAlbums);

  return albums;
}
