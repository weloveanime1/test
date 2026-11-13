import { fetchJson } from './net';
import type { Info, Item, Kind, Playlist, Programme, Season } from './types';

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? '' : String(v).trim());
const opt = (v: unknown) => str(v) || undefined;
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const first = (v: unknown) => opt(Array.isArray(v) ? v[0] : v);
const score = (v: unknown) => (Number(v) > 0 ? Number(v).toFixed(1) : undefined);
const yearOf = (v: unknown) => /\d{4}/.exec(str(v))?.[0];

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
  // HLS is the live format browsers handle best, so it is the default for channels.
  return `${base}.${ext || (kind === 'live' ? 'm3u8' : 'mp4')}`;
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
      const item: Item = {
        id: `${kind}:${id}`,
        kind,
        name: str(r.name) || 'Untitled',
        group: cat.get(str(r.category_id)) || 'Uncategorized',
        logo: opt(kind === 'series' ? r.cover : r.stream_icon),
        ...(kind === 'series' ? { seriesId: id } : { streamId: id }),
      };
      if (kind === 'live') return item;
      return {
        ...item,
        ext: opt(r.container_extension),
        rating: score(r.rating),
        added: Number(kind === 'series' ? r.last_modified : r.added) || undefined,
        // Kept short: the whole catalogue is cached in the browser.
        plot: opt(r.plot)?.slice(0, 320),
        backdrop: first(r.backdrop_path),
        year: yearOf(r.releaseDate ?? r.release_date ?? r.year),
        genre: opt(r.genre),
      };
    });
  };
  return [...build(live, liveCats, 'live'), ...build(vod, vodCats, 'movie'), ...build(series, seriesCats, 'series')];
}

function seconds(row: Row | undefined): number | undefined {
  if (!row) return undefined;
  if (Number(row.duration_secs) > 0) return Number(row.duration_secs);
  const parts = str(row.duration).split(':').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}

function infoOf(info: Row | undefined): Info {
  const trailer = opt(info?.youtube_trailer);
  return {
    plot: opt(info?.plot ?? info?.description),
    cast: opt(info?.cast ?? info?.actors),
    director: opt(info?.director),
    genre: opt(info?.genre),
    year: yearOf(info?.releasedate ?? info?.releaseDate ?? info?.release_date),
    duration: seconds(info),
    backdrop: first(info?.backdrop_path),
    trailer: trailer && (/^https?:/i.test(trailer) ? trailer : `https://www.youtube.com/watch?v=${encodeURIComponent(trailer)}`),
    rating: score(info?.rating),
  };
}

export async function vodInfo(pl: Playlist, streamId: number): Promise<Info> {
  const data = (await api(pl, 'get_vod_info', { vod_id: String(streamId) })) as { info?: Row } | null;
  return infoOf(Array.isArray(data?.info) ? undefined : data?.info);
}

export async function seriesInfo(pl: Playlist, seriesId: number): Promise<Info> {
  const data = (await api(pl, 'get_series_info', { series_id: String(seriesId) })) as { info?: Row; episodes?: Record<string, Row[]> } | null;
  const seasons: Season[] = Object.entries(data?.episodes ?? {})
    .map(([season, eps]) => ({
      season: Number(season),
      episodes: rows(eps).map((e, i) => {
        const info = (Array.isArray(e.info) ? undefined : e.info) as Row | undefined;
        return {
          id: str(e.id),
          num: Number(e.episode_num) || i + 1,
          title: str(e.title) || `Episode ${i + 1}`,
          ext: str(e.container_extension) || 'mp4',
          image: opt(info?.movie_image),
          plot: opt(info?.plot),
          duration: seconds(info),
          rating: score(info?.rating),
        };
      }),
    }))
    .filter((s) => s.episodes.length > 0)
    .sort((a, b) => a.season - b.season);
  return { ...infoOf(Array.isArray(data?.info) ? undefined : data?.info), seasons };
}

function decodeBase64(text: string): string {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
  } catch {
    return text;
  }
}

export async function shortEpg(pl: Playlist, streamId: number): Promise<Programme[]> {
  const data = (await api(pl, 'get_short_epg', { stream_id: String(streamId), limit: '6' })) as { epg_listings?: unknown } | null;
  return rows(data?.epg_listings)
    .map((p) => ({
      title: decodeBase64(str(p.title)),
      description: decodeBase64(str(p.description)) || undefined,
      start: Number(p.start_timestamp) * 1000,
      end: Number(p.stop_timestamp) * 1000,
    }))
    .filter((p) => p.end > p.start);
}
