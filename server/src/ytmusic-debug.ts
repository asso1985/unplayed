/**
 * ytmusic-debug.ts
 * One-shot probe for alternative YouTube InnerTube clients, used to figure out
 * whether any non-TVHTML5 client returns a fuller library when called with the
 * existing OAuth Bearer token. Not used by the regular sync path.
 */

interface ClientConfig {
  clientName: string;
  clientVersion: string;
  extraHeaders?: Record<string, string>;
}

interface ProbeResult {
  clientName: string;
  clientVersion: string;
  status: number;
  ok: boolean;
  bodyTopKeys: string[];
  // Best-effort item count by walking common shapes
  itemCounts: Record<string, number>;
  errorMessage: string | null;
  rawSample: unknown;
}

const CLIENTS: ClientConfig[] = [
  // Baseline — what the live sync uses today.
  { clientName: 'TVHTML5', clientVersion: '7.20240101.00.00' },
  // Alternative TV variants.
  { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0' },
  // iOS music client — sometimes accepts Bearer.
  { clientName: 'IOS_MUSIC', clientVersion: '7.27.1' },
  // Android music client.
  { clientName: 'ANDROID_MUSIC', clientVersion: '7.27.52' },
  // Web music client (music.youtube.com). Usually needs SAPISIDHASH cookie auth,
  // but worth a probe to confirm rejection mode.
  { clientName: 'WEB_REMIX', clientVersion: '1.20240101.01.00' },
];

function objectKeys(v: unknown): string[] {
  return v && typeof v === 'object' ? Object.keys(v as Record<string, unknown>) : [];
}

/** Recursively count occurrences of a key, capped to avoid runaway. */
function countKeyOccurrences(node: unknown, key: string, cap = 10000): number {
  let n = 0;
  const stack: unknown[] = [node];
  while (stack.length && n < cap) {
    const cur = stack.pop();
    if (!cur || typeof cur !== 'object') continue;
    if (Array.isArray(cur)) {
      for (const item of cur) stack.push(item);
    } else {
      for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
        if (k === key) n++;
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return n;
}

export async function probeClients(accessToken: string): Promise<ProbeResult[]> {
  const results: ProbeResult[] = [];

  for (const client of CLIENTS) {
    const body = {
      context: { client: { ...client, hl: 'en', gl: 'US' } },
      browseId: 'FEmusic_liked_albums',
    };
    try {
      const res = await fetch('https://youtubei.googleapis.com/youtubei/v1/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Goog-AuthUser': '0',
          'Accept': '*/*',
          ...(client.extraHeaders ?? {}),
        },
        body: JSON.stringify(body),
      });

      let json: unknown = null;
      let parseError: string | null = null;
      try {
        json = await res.json();
      } catch (e: unknown) {
        parseError = (e as Error).message;
      }

      results.push({
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        status: res.status,
        ok: res.ok,
        bodyTopKeys: objectKeys(json),
        itemCounts: {
          tileRenderer: countKeyOccurrences(json, 'tileRenderer'),
          musicTwoRowItemRenderer: countKeyOccurrences(json, 'musicTwoRowItemRenderer'),
          musicResponsiveListItemRenderer: countKeyOccurrences(json, 'musicResponsiveListItemRenderer'),
          gridRenderer: countKeyOccurrences(json, 'gridRenderer'),
          musicShelfRenderer: countKeyOccurrences(json, 'musicShelfRenderer'),
        },
        errorMessage: parseError,
        // Trim sample heavily — we only need shape, not contents.
        rawSample: trimSample(json, 3),
      });
    } catch (err: unknown) {
      results.push({
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        status: 0,
        ok: false,
        bodyTopKeys: [],
        itemCounts: {},
        errorMessage: (err as Error).message,
        rawSample: null,
      });
    }
  }

  return results;
}

/** Trim object tree to maxDepth so we can ship a shape preview without the body. */
function trimSample(node: unknown, depth: number): unknown {
  if (depth <= 0) return Array.isArray(node) ? `[Array(${node.length})]` : typeof node;
  if (node == null) return node;
  if (Array.isArray(node)) {
    return node.slice(0, 2).map(v => trimSample(v, depth - 1));
  }
  if (typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = trimSample(v, depth - 1);
    }
    return out;
  }
  return node;
}
