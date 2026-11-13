import { fetchJson } from './net';
import type { Item, Kind, Playlist, Programme, Season } from './types';

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v));
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

export function normalizeServer(input: string): string {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  return new URL(s).origin;
}

function api(pl: Playlist, action?: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ username: pl.username ?? '', password: pl.password ?? '', ...(action ? { action } : {}), ...extra });
  return fetchJson<unknown>(`${pl.server}/player_api.php?${q}`);
}

export function xtreamUrl(pl: Playlist, kind: Kind, id: string | number, ext?: string): string {
  const base = `${pl.server}/${kind}/${encodeURIComponent(pl.username ?? '')}/${encodeURIComponent(pl.password ?? '')}/${id}`;
  // HLS output is the one live format browsers handle reliably.
  return kind === 'live' ? `${base}.m3u8` : `${base}.${ext || 'mp4'}`;
}

export async function loadXtream(pl: Playlist): Promise<Item[]> {
  const login = (await api(pl)) as { user_info?: { auth?: unknown } } | null;
  if (!login?.user_info || Number(login.user_info.auth) === 0) {
    throw new Error('Login failed. Check the server address, username and password.');
  }
  const actions = ['get_live_categories', 'get_live_streams', 'get_vod_categories', 'get_vod_streams', 'get_series_categories', 'get_series'];
  // A provider without movies or series should not fail the whole login.
  const [liveCats, live, vodCats, vod, seriesCats, series] = await Promise.all(actions.map((a) => api(pl, a).then(rows, () => [])));
  const names = (cats: Row[]) => new Map(cats.map((c) => [str(c.category_id), str(c.category_name)]));
  const build = (list: Row[], cats: Row[], kind: Kind): Item[] => {
    const cat = names(cats);
    return list.map((r) => {
      const id = Number(kind === 'series' ? r.series_id : r.stream_id);
      return {
        id: `${kind}:${id}`,
        kind,
        name: str(r.name) || 'Untitled',
        group: cat.get(str(r.category_id)) || 'Uncategorized',
        logo: str(kind === 'series' ? r.cover : r.stream_icon) || undefined,
        ...(kind === 'series' ? { seriesId: id } : { streamId: id }),
        ext: str(r.container_extension) || undefined,
        rating: kind === 'live' || !Number(r.rating) ? undefined : Number(r.rating).toFixed(1),
      };
    });
  };
  return [...build(live, liveCats, 'live'), ...build(vod, vodCats, 'movie'), ...build(series, seriesCats, 'series')];
}

export async function seriesInfo(pl: Playlist, seriesId: number): Promise<{ plot: string; seasons: Season[] }> {
  const data = (await api(pl, 'get_series_info', { series_id: String(seriesId) })) as { info?: Row; episodes?: Record<string, Row[]> } | null;
  const seasons = Object.entries(data?.episodes ?? {})
    .map(([season, eps]) => ({
      season: Number(season),
      episodes: rows(eps).map((e, i) => ({
        id: str(e.id),
        num: Number(e.episode_num) || i + 1,
        title: str(e.title) || `Episode ${i + 1}`,
        ext: str(e.container_extension) || 'mp4',
        image: str((e.info as Row | undefined)?.movie_image) || undefined,
      })),
    }))
    .sort((a, b) => a.season - b.season);
  return { plot: str(data?.info?.plot), seasons };
}

function decodeBase64(text: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
  } catch {
    return text;
  }
}

export async function shortEpg(pl: Playlist, streamId: number): Promise<Programme[]> {
  const data = (await api(pl, 'get_short_epg', { stream_id: String(streamId), limit: '4' })) as { epg_listings?: unknown } | null;
  return rows(data?.epg_listings).map((p) => ({
    title: decodeBase64(str(p.title)),
    start: Number(p.start_timestamp) * 1000,
    end: Number(p.stop_timestamp) * 1000,
  }));
}
