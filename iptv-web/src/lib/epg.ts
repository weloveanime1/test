import { useEffect, useRef, useState } from 'react';
import type { Playlist, Programme } from './types';
import { shortEpg } from './xtream';

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: Promise<Programme[]> }>();

// Guide requests are small but numerous; a few at a time keeps the provider and the proxy happy.
let running = 0;
const waiting: (() => void)[] = [];
function limited<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      job()
        .then(resolve, reject)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < 4) start();
    else waiting.push(start);
  });
}

function load(pl: Playlist, streamId: number): Promise<Programme[]> {
  const key = `${pl.id}:${streamId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = limited(() => shortEpg(pl, streamId)).catch(() => []);
  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Upcoming programmes for a channel. Only Xtream playlists carry a guide. */
export function useEpg(pl: Playlist, streamId: number | undefined, enabled = true): Programme[] {
  const [list, setList] = useState<Programme[]>([]);
  useEffect(() => {
    setList([]);
    if (!enabled || pl.type !== 'xtream' || streamId == null) return;
    let gone = false;
    load(pl, streamId).then((data) => !gone && setList(data));
    return () => {
      gone = true;
    };
  }, [pl, streamId, enabled]);
  return list;
}

export function nowNext(list: Programme[], at = Date.now()) {
  return { now: list.find((p) => p.start <= at && at < p.end), next: list.filter((p) => p.start > at) };
}

/** Becomes true once the element has scrolled into view, and stays true. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}
