export type Kind = 'live' | 'movie' | 'series';

export interface Item {
  id: string;
  kind: Kind;
  name: string;
  group: string;
  logo?: string;
  /** Direct stream URL. Absent for Xtream items, whose URL is built from the playlist login. */
  url?: string;
  streamId?: number;
  /** Set on a series and on each of its episodes; an episode also has a streamId. */
  seriesId?: number;
  ext?: string;
  rating?: string;
  /** Unix seconds when the provider added the title. */
  added?: number;
  plot?: string;
  backdrop?: string;
  year?: string;
  genre?: string;
}

export interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'xtream';
  url?: string;
  server?: string;
  username?: string;
  password?: string;
  updatedAt: number;
  count: number;
}

export interface HistoryEntry {
  key: string;
  playlistId: string;
  item: Item;
  position: number;
  duration: number;
  at: number;
}

export interface Episode {
  id: string;
  num: number;
  title: string;
  ext: string;
  image?: string;
  plot?: string;
  /** Seconds. */
  duration?: number;
  rating?: string;
}

export interface Season {
  season: number;
  episodes: Episode[];
}

export interface Info {
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  year?: string;
  /** Seconds. */
  duration?: number;
  backdrop?: string;
  trailer?: string;
  rating?: string;
  seasons?: Season[];
}

export interface Programme {
  title: string;
  description?: string;
  start: number;
  end: number;
}

export interface Settings {
  accent: string;
  autoplayNext: boolean;
}

/** A series entry opens a detail page; everything else can be played. */
export const isSeries = (item: Item) => item.kind === 'series' && item.seriesId != null && item.streamId == null && !item.url;
