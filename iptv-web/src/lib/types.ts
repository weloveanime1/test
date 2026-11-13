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
  seriesId?: number;
  ext?: string;
  rating?: string;
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
}

export interface Season {
  season: number;
  episodes: Episode[];
}

export interface Programme {
  title: string;
  start: number;
  end: number;
}
