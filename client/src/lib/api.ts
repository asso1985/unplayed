import type {
  StatusResponse,
  AlbumsResponse,
  AuthStartResponse,
  AuthPollResponse,
  Settings,
} from '@/types';

async function json<T>(r: Response): Promise<T> {
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? `Request failed (${r.status})`);
  return data as T;
}

function post<T = unknown>(url: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => json<T>(r));
}

export const api = {
  getStatus: () => fetch('/api/status').then(r => json<StatusResponse>(r)),
  getAlbums: () => fetch('/api/albums').then(r => json<AlbumsResponse>(r)),

  startAuth: () => post<AuthStartResponse>('/api/auth/start'),
  pollAuth:  () => post<AuthPollResponse>('/api/auth/poll'),
  deleteAuth: () => fetch('/api/auth', { method: 'DELETE' }).then(r => json(r)),

  snoozeAlbum:  (id: string, days: number) => post(`/api/albums/${id}/snooze`, { days }),
  silenceAlbum: (id: string) => post(`/api/albums/${id}/silence`),

  saveSettings: (s: { reminderDays: number[]; allowedTypes: string[]; notifyHour: number }) =>
    post<{ ok: boolean; settings: Settings }>('/api/settings', s),

  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string } }) =>
    post('/api/push/subscribe', sub),

  runSync: () => post('/api/sync'),
};
