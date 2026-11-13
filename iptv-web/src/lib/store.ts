import { del, get, set } from 'idb-keyval';
import { useEffect, useState } from 'react';
import { parseM3U } from './m3u';
import { fetchText } from './net';
import type { Item, Playlist } from './types';
import { loadXtream, xtreamUrl } from './xtream';

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

export async function fetchItems(pl: Playlist): Promise<Item[]> {
  if (pl.type === 'xtream') return loadXtream(pl);
  if (!pl.url) throw new Error('This playlist was added from a file. Add the file again to update it.');
  const items = parseM3U(await fetchText(pl.url));
  if (!items.length) throw new Error('No channels found. Is this an M3U playlist?');
  return items;
}

export function resolveUrl(pl: Playlist, item: Item): string {
  return item.url ?? xtreamUrl(pl, item.kind, item.streamId ?? 0, item.ext);
}

export const newId = () => Math.random().toString(36).slice(2, 10);
