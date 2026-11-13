import type { Item, Kind } from './types';

const ATTR = /([\w-]+)="([^"]*)"/g;

export function kindOf(url: string): Kind {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.includes('/series/')) return 'series';
  if (path.includes('/movie/') || /\.(mp4|mkv|avi|mov|m4v|webm)$/.test(path)) return 'movie';
  return 'live';
}

export function parseM3U(text: string): Item[] {
  const items: Item[] = [];
  let info: { name: string; group: string; logo?: string } | null = null;
  let extGroup = '';

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attrs: Record<string, string> = {};
      for (const m of line.matchAll(ATTR)) attrs[m[1].toLowerCase()] = m[2];
      // The display name follows the first comma once the quoted attributes are removed.
      const rest = line.replace(ATTR, '');
      const comma = rest.indexOf(',');
      const name = (comma >= 0 ? rest.slice(comma + 1).trim() : '') || attrs['tvg-name'] || 'Untitled';
      info = { name, group: attrs['group-title'] ?? '', logo: attrs['tvg-logo'] || undefined };
    } else if (line.startsWith('#EXTGRP:')) {
      extGroup = line.slice(8).trim();
    } else if (!line.startsWith('#')) {
      items.push({
        id: line,
        kind: kindOf(line),
        name: info?.name ?? line,
        group: info?.group || extGroup || 'Uncategorized',
        logo: info?.logo,
        url: line,
      });
      info = null;
      extGroup = '';
    }
  }
  return items;
}
