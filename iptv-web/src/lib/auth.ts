import type { Playlist } from './types';

export async function checkSession(): Promise<boolean> {
  const res = await fetch('/api/auth');
  await res.text();
  return res.ok;
}

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await res.text();
  if (res.ok) return true;
  if (res.status === 401) return false;
  throw new Error('The server could not check the password.');
}

export const logout = () =>
  Promise.all([fetch('/api/auth', { method: 'DELETE' }), fetch('/api/admin', { method: 'DELETE' })]).catch(() => {});

async function playlistsFrom(res: Response): Promise<Playlist[] | null> {
  if (res.status === 401) {
    await res.text();
    return null;
  }
  if (!res.ok) throw new Error('The server could not check the password.');
  return ((await res.json()) as { playlists?: Playlist[] }).playlists ?? [];
}

/** The shared playlists if this browser already unlocked them, otherwise null. */
export const sharedSession = () => fetch('/api/admin').then(playlistsFrom, () => null);

/** Unlocks the shared playlists. Returns null when the password is wrong. */
export const sharedLogin = (password: string) =>
  fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) }).then(playlistsFrom);
