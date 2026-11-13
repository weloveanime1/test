import { dropItems } from './store';
import type { Playlist } from './types';

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export const COLORS = ['#e5173f', '#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308'];

/** The profile whose playlists come from the site owner. It is opened with the admin password. */
export const SHARED: Profile = { id: 'admin', name: 'Nepalhub TV', color: '#f5c518' };

/** Where a profile keeps its data. The first profile keeps the keys used before profiles existed. */
export const prefixFor = (id: string) => (id === 'main' ? 'iptv.' : `iptv.p.${id}.`);

const KEYS = ['playlists', 'active', 'favs', 'history', 'settings'];

/** Anything saved before profiles existed becomes the first profile. */
export function initialProfiles(): Profile[] {
  try {
    const legacy = JSON.parse(localStorage.getItem('iptv.playlists') ?? '[]');
    return Array.isArray(legacy) && legacy.length > 0 ? [{ id: 'main', name: 'Me', color: COLORS[0] }] : [];
  } catch {
    return [];
  }
}

export function removeProfileData(id: string) {
  const prefix = prefixFor(id);
  try {
    const playlists = JSON.parse(localStorage.getItem(`${prefix}playlists`) ?? '[]') as Playlist[];
    for (const p of playlists) dropItems(p.id);
  } catch {
    // Nothing cached to remove.
  }
  for (const key of KEYS) localStorage.removeItem(prefix + key);
}

/** The value the site owner pastes into ADMIN_PLAYLISTS to share these playlists. */
export function shareCode(playlists: Playlist[]): string {
  return JSON.stringify(
    playlists
      .filter((p) => p.type === 'xtream' || p.url)
      .map(({ id, name, type, url, server, username, password }) => ({ id: id.replace(/^shared-/, ''), name, type, url, server, username, password })),
  );
}
