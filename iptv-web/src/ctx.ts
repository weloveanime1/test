import { createContext, useContext } from 'react';
import type { HistoryEntry, Item, Kind, Playlist } from './lib/types';

export type Tab = 'home' | Kind | 'library' | 'settings';

export interface AppCtx {
  playlist: Playlist;
  byKind: Record<Kind, Item[]>;
  favs: Item[];
  history: HistoryEntry[];
  isFav: (item: Item) => boolean;
  toggleFav: (item: Item) => void;
  /** Watched fraction of a title, 0 to 1. */
  progressOf: (item: Item) => number;
  /** Opens the detail page for movies and series, plays everything else. */
  open: (item: Item, queue?: Item[]) => void;
  play: (item: Item, queue?: Item[]) => void;
  go: (tab: Tab) => void;
}

export const AppContext = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside the app shell');
  return ctx;
}
