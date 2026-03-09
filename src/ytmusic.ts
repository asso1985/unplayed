/**
 * ytmusic.ts
 * Fetches liked/saved albums from YT Music using OAuth Bearer token.
 * Uses the TVHTML5 client which accepts standard OAuth tokens.
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

/** Safely pluck a nested value */
function nav(obj: unknown, ...path: (string | number)[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseReleaseType(raw: string): { releaseType: ReleaseType; year: string } {
  // Format: "Album • 2026" or "EP • 2024" or "Single • 2023"
  const parts = raw.split('•').map(s => s.trim());
  const typeRaw = parts[0]?.trim() ?? '';
  const year = parts[1]?.trim() ?? '';
  const releaseType = (['Album', 'EP', 'Single'].includes(typeRaw) ? typeRaw : 'Unknown') as ReleaseType;
  return { releaseType, year };
}

function parseTileRenderer(tile: unknown): YTMAlbum | null {
  try {
    const meta = nav(tile, 'metadata', 'tileMetadataRenderer');
    const title = str(nav(meta, 'title', 'runs', 0, 'text'));
    const browseId = str(nav(meta, 'title', 'runs', 0, 'navigationEndpoint', 'browseEndpoint', 'browseId'));
    if (!browseId || !title) return null;

    const artist = str(nav(meta, 'lines', 0, 'lineRenderer', 'items', 0, 'lineItemRenderer', 'text', 'simpleText'));
    const line2 = str(nav(meta, 'lines', 1, 'lineRenderer', 'items', 0, 'lineItemRenderer', 'text', 'simpleText'));
    const { releaseType, year } = parseReleaseType(line2);

    const thumbnails = nav(tile, 'header', 'tileHeaderRenderer', 'thumbnail', 'thumbnails');
    const thumbArr = Array.isArray(thumbnails) ? thumbnails : [];
    const thumbnail = str(nav(thumbArr[thumbArr.length - 1], 'url'));

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

    // First page: navigate to the Albums tab (selected:true) gridRenderer items
    let items: unknown[] = [];
    if (!continuation) {
      const sections = nav(json, 'contents', 'tvBrowseRenderer', 'content',
        'tvSecondaryNavRenderer', 'sections', 0,
        'tvSecondaryNavSectionRenderer', 'tabs') as unknown[];

      if (Array.isArray(sections)) {
        for (const tab of sections) {
          const selected = nav(tab, 'tabRenderer', 'selected');
          if (selected) {
            const grid = nav(tab, 'tabRenderer', 'content', 'tvSurfaceContentRenderer',
              'content', 'gridRenderer', 'items');
            if (Array.isArray(grid)) items = grid;
            break;
          }
        }
      }
    } else {
      // Continuation page
      const grid = nav(json, 'continuationContents', 'gridContinuation', 'items');
      if (Array.isArray(grid)) items = grid;
    }

    for (const item of items) {
      const tile = nav(item, 'tileRenderer');
      if (!tile) continue;
      const parsed = parseTileRenderer(tile);
      if (parsed) albums.push(parsed);
    }

    // Check for next page
    const token = nav(json,
      'continuations', 0, 'nextContinuationData', 'continuation'
    ) ?? nav(json,
      'continuationContents', 'gridContinuation', 'continuations', 0,
      'nextContinuationData', 'continuation'
    );
    continuation = typeof token === 'string' ? token : null;

  } while (continuation && albums.length < maxAlbums);

  return albums;
}
