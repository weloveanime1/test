import { del, get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { parseM3U } from './m3u';
import { fetchText } from './net';
import type { Item, Playlist, Settings } from './types';
import { loadXtream, megabytes, xtreamUrl, type LoadTask } from './xtream';

export const ACCENTS = [
  { name: 'Crimson', value: '#e5173f' },
  { name: 'Himalaya blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Violet', value: '#8b5cf6' },
];
export const DEFAULT_SETTINGS: Settings = { accent: ACCENTS[0].value, autoplayNext: true };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** State mirrored to localStorage. Everything the app remembers stays in this browser. */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or disabled: keep working in memory.
    }
  }, [key, value]);
  return [value, setValue] as const;
}

// Channel lists can hold tens of thousands of entries, too large for localStorage.
const itemsKey = (id: string) => `iptv.items.${id}`;
export const loadCached = (id: string) => get<Item[]>(itemsKey(id));
export const saveItems = (id: string, items: Item[]) => set(itemsKey(id), items);
export const dropItems = (id: string) => del(itemsKey(id));

export const canRefresh = (pl: Playlist) => pl.type === 'xtream' || !!pl.url;

export async function fetchItems(pl: Playlist, task: LoadTask = {}): Promise<Item[]> {
  if (pl.type === 'xtream') return loadXtream(pl, task);
  if (!pl.url) throw new Error('This playlist was added from a file. Add the file again to update it.');
  task.onProgress?.('Contacting the provider…');
  const text = await fetchText(pl.url, { signal: task.signal, onBytes: (n) => task.onProgress?.(`Downloading playlist… ${megabytes(n)}`) });
  task.onProgress?.('Reading channels…');
  const items = parseM3U(text);
  if (!items.length) throw new Error('No channels found. Is this an M3U playlist?');
  return items;
}

export function resolveUrl(pl: Playlist, item: Item): string {
  return item.url ?? xtreamUrl(pl, item.kind, item.streamId ?? 0, item.ext);
}

export const newId = () => Math.random().toString(36).slice(2, 10);
