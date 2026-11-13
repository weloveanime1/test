import { needsProxy, proxied } from './net';
import { resolveUrl } from './store';
import type { Item, Playlist } from './types';
import { xtreamUrl } from './xtream';

export type Engine = 'hls' | 'mpegts' | 'native';
export interface Source {
  url: string;
  engine: Engine;
}
export interface Attempt extends Source {
  proxy: boolean;
}

const pathOf = (url: string) => url.split(/[?#]/)[0].toLowerCase();

/** Ways to play an item, best first. The player works down the list until one starts. */
export function sourcesFor(pl: Playlist, item: Item): Source[] {
  const live = item.kind === 'live';
  // Xtream channels are offered as HLS and as MPEG-TS; providers often allow only one of the two.
  if (live && !item.url && item.streamId != null) {
    return [
      { url: xtreamUrl(pl, 'live', item.streamId, 'm3u8'), engine: 'hls' },
      { url: xtreamUrl(pl, 'live', item.streamId, 'ts'), engine: 'mpegts' },
    ];
  }
  const url = resolveUrl(pl, item);
  const path = pathOf(url);
  if (path.endsWith('.m3u8')) return [{ url, engine: 'hls' }];
  if (/\.(mp4|mkv|webm|mov|m4v|avi|mp3|aac|flv|wmv|mpg|mpeg)$/.test(path)) return [{ url, engine: 'native' }];
  if (path.endsWith('.ts')) {
    // Xtream-style links usually answer on the HLS address too.
    const hls = /\/live\/[^/]+\/[^/]+\/\d+\.ts$/.test(path) ? [{ url: url.replace(/\.ts(?=$|[?#])/i, '.m3u8'), engine: 'hls' as const }] : [];
    return [{ url, engine: 'mpegts' }, ...hls];
  }
  // Links without an extension: live ones are usually MPEG-TS and sometimes HLS.
  if (live) return [{ url, engine: 'mpegts' }, { url, engine: 'hls' }];
  return [{ url, engine: 'native' }];
}

/** Each source is tried straight from the browser when that is allowed, then through the relay. */
export function attemptsFor(sources: Source[]): Attempt[] {
  return sources.flatMap((s) => (needsProxy(s.url) ? [{ ...s, proxy: true }] : [{ ...s, proxy: false }, { ...s, proxy: true }]));
}

/** Asks the relay what the provider answers, to explain a failure in plain words. */
export async function diagnose(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(proxied(url, true), { headers: { range: 'bytes=0-0' } });
    await res.body?.cancel().catch(() => {});
  } catch {
    return 'The connection dropped while loading the stream. Check your internet connection.';
  }
  if (res.status === 401) return 'Your session has expired. Reload the page and enter the access password again.';
  if (res.status === 404) return 'The provider says this stream does not exist (error 404). It may have been removed.';
  if (res.status === 502 || res.status === 504) return 'The provider’s server did not answer. It may be offline, or it may block cloud servers like the one this site runs on.';
  if (res.status >= 400) {
    return `The provider refused to send this stream (error ${res.status}). The subscription may have expired, be in use on another device, or the provider may block cloud servers.`;
  }
  const type = (res.headers.get('content-type') ?? '').split(';')[0];
  return `The stream is reachable${type ? ` (${type})` : ''}, but this browser cannot decode its video or audio format. It will play in an app such as VLC.`;
}

const mobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);
export const vlcLabel = () => (mobile() ? 'Open in VLC' : 'Download for VLC');

/** Hands the stream to VLC: by app link on phones, by a small playlist file on computers. */
export function openInVlc(url: string, name: string) {
  const link = document.createElement('a');
  if (/android/i.test(navigator.userAgent)) link.href = `vlc://${url}`;
  else if (mobile()) link.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(url)}`;
  else {
    link.href = URL.createObjectURL(new Blob([`#EXTM3U\n#EXTINF:-1,${name}\n${url}\n`], { type: 'audio/x-mpegurl' }));
    link.download = `${name.replace(/[^\w .-]+/g, ' ').trim() || 'stream'}.m3u`;
  }
  link.click();
}
