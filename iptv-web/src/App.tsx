import { useCallback, useEffect, useMemo, useState } from 'react';
import { AddPlaylist } from './components/AddPlaylist';
import { Browse } from './components/Browse';
import { Card } from './components/Card';
import { Player } from './components/Player';
import { SeriesDetail } from './components/SeriesDetail';
import { dropItems, fetchItems, loadCached, resolveUrl, saveItems, usePersisted } from './lib/store';
import type { Episode, HistoryEntry, Item, Kind, Playlist, Programme } from './lib/types';
import { shortEpg } from './lib/xtream';

type Tab = 'home' | Kind | 'favs' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'live', label: 'Live TV', icon: '◉' },
  { id: 'movie', label: 'Movies', icon: '▶' },
  { id: 'series', label: 'Series', icon: '☰' },
  { id: 'favs', label: 'Favourites', icon: '★' },
  { id: 'settings', label: 'Playlists', icon: '⚙' },
];
const TITLES: Record<Kind, string> = { live: 'Live TV', movie: 'Movies', series: 'Series' };
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function App() {
  const [playlists, setPlaylists] = usePersisted<Playlist[]>('iptv.playlists', []);
  const [activeId, setActiveId] = usePersisted<string | null>('iptv.active', null);
  const [favs, setFavs] = usePersisted<Record<string, Item>>('iptv.favs', {});
  const [history, setHistory] = usePersisted<HistoryEntry[]>('iptv.history', []);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [playing, setPlaying] = useState<{ item: Item; list: Item[] } | null>(null);
  const [series, setSeries] = useState<Item | null>(null);
  const [epg, setEpg] = useState<Programme[]>([]);

  const active = playlists.find((p) => p.id === activeId) ?? playlists[0] ?? null;
  const keyOf = useCallback((item: Item) => `${active?.id}|${item.id}`, [active?.id]);

  useEffect(() => {
    if (!active) return setItems([]);
    let gone = false;
    loadCached(active.id).then((cached) => !gone && setItems(cached ?? []));
    return () => {
      gone = true;
    };
  }, [active?.id]);

  const byKind = useMemo(() => {
    const out: Record<Kind, Item[]> = { live: [], movie: [], series: [] };
    for (const it of items) out[it.kind].push(it);
    return out;
  }, [items]);

  const addPlaylist = async (playlist: Playlist, list: Item[]) => {
    await saveItems(playlist.id, list);
    setPlaylists((all) => [...all, playlist]);
    setActiveId(playlist.id);
    setItems(list);
    setTab('home');
  };

  const refresh = async (playlist: Playlist) => {
    setBusy(true);
    setNotice('');
    try {
      const list = await fetchItems(playlist);
      await saveItems(playlist.id, list);
      setPlaylists((all) => all.map((p) => (p.id === playlist.id ? { ...p, count: list.length, updatedAt: Date.now() } : p)));
      if (playlist.id === active?.id) setItems(list);
      setNotice(`“${playlist.name}” updated: ${list.length} items.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (playlist: Playlist) => {
    if (!confirm(`Remove “${playlist.name}” and its favourites and history?`)) return;
    const mine = (key: string) => key.startsWith(`${playlist.id}|`);
    dropItems(playlist.id);
    setPlaylists((all) => all.filter((p) => p.id !== playlist.id));
    setFavs((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !mine(k))));
    setHistory((h) => h.filter((e) => !mine(e.key)));
  };

  const isFav = useCallback((item: Item) => keyOf(item) in favs, [favs, keyOf]);
  const toggleFav = useCallback(
    (item: Item) =>
      setFavs((f) => {
        const next = { ...f };
        const key = keyOf(item);
        if (key in next) delete next[key];
        else next[key] = item;
        return next;
      }),
    [keyOf, setFavs],
  );

  const record = useCallback(
    (item: Item, position: number, duration: number) => {
      if (!active) return;
      const entry: HistoryEntry = { key: keyOf(item), playlistId: active.id, item, position, duration, at: Date.now() };
      setHistory((h) => [entry, ...h.filter((e) => e.key !== entry.key)].slice(0, 40));
    },
    [active, keyOf, setHistory],
  );

  const open = useCallback((item: Item, list: Item[] = []) => {
    if (item.kind === 'series' && item.seriesId != null) return setSeries(item);
    setPlaying({ item, list: item.kind === 'live' ? list : [] });
  }, []);

  const playEpisode = (ep: Episode, season: number) => {
    if (!series) return;
    const item: Item = {
      id: `episode:${ep.id}`,
      kind: 'series',
      name: `${series.name} · S${season}E${ep.num} · ${ep.title}`,
      group: series.group,
      logo: ep.image ?? series.logo,
      streamId: Number(ep.id),
      ext: ep.ext,
    };
    setPlaying({ item, list: [] });
  };

  const current = playing?.item;
  useEffect(() => {
    setEpg([]);
    if (!active || !current) return;
    if (current.kind === 'live') record(current, 0, 0);
    if (active.type !== 'xtream' || current.kind !== 'live' || current.streamId == null) return;
    let gone = false;
    shortEpg(active, current.streamId).then((list) => !gone && setEpg(list), () => {});
    return () => {
      gone = true;
    };
    // Only a change of stream should re-run this.
  }, [current?.id]);

  const step = (delta: number) => {
    if (!playing || playing.list.length < 2) return;
    const i = playing.list.findIndex((it) => it.id === playing.item.id);
    const next = playing.list[(i + delta + playing.list.length) % playing.list.length];
    setPlaying({ item: next, list: playing.list });
  };
  const closePlayer = useCallback(() => setPlaying(null), []);

  const mine = history.filter((e) => e.playlistId === active?.id);
  const resume = mine.filter((e) => e.item.kind !== 'live' && e.position > 5 && (!e.duration || e.position < e.duration * 0.95));
  const recent = mine.filter((e) => e.item.kind === 'live');
  const favList = Object.entries(favs)
    .filter(([k]) => k.startsWith(`${active?.id}|`))
    .map(([, item]) => item);
  const startAt = current ? (resume.find((e) => e.key === keyOf(current))?.position ?? 0) : 0;

  const row = (title: string, list: Item[], progress?: (item: Item) => number) =>
    list.length > 0 && (
      <section className="shelf" key={title}>
        <h2>{title}</h2>
        <div className="shelf-row">
          {list.map((it, i) => (
            <Card key={`${it.id}-${i}`} item={it} fav={isFav(it)} progress={progress?.(it)} onOpen={() => open(it, list)} onFav={() => toggleFav(it)} />
          ))}
        </div>
      </section>
    );

  if (!active) {
    return (
      <main className="welcome">
        <h1>StreamDeck IPTV</h1>
        <p>A free IPTV player that runs in your browser. It includes no channels: add a playlist you are allowed to use.</p>
        <AddPlaylist onAdd={addPlaylist} />
        <small>Playlists, logins, favourites and history are stored only in this browser.</small>
      </main>
    );
  }

  return (
    <div className="app">
      <nav className="side">
        <div className="brand">StreamDeck</div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <i>{t.icon}</i>
            <span>{t.label}</span>
          </button>
        ))}
        <div className="side-foot" title="Active playlist">
          {active.name}
        </div>
      </nav>

      <main className="content">
        {tab === 'home' && (
          <div className="page">
            <h1>{active.name}</h1>
            <p className="muted">
              {count(byKind.live.length, 'channel', 'channels')} · {count(byKind.movie.length, 'movie', 'movies')} ·{' '}
              {count(byKind.series.length, 'series', 'series')}
            </p>
            {row('Continue watching', resume.map((e) => e.item), (it) => {
              const e = resume.find((h) => h.item.id === it.id);
              return e?.duration ? e.position / e.duration : 0.05;
            })}
            {row('Recently watched channels', recent.map((e) => e.item))}
            {row('Favourites', favList)}
            {row('Live TV', byKind.live.slice(0, 18))}
            {row('Movies', byKind.movie.slice(0, 18))}
            {row('Series', byKind.series.slice(0, 18))}
            {items.length === 0 && <p className="empty">This playlist is empty. Update it from the Playlists tab.</p>}
          </div>
        )}

        {(tab === 'live' || tab === 'movie' || tab === 'series') && (
          <Browse key={`${active.id}-${tab}`} title={TITLES[tab]} items={byKind[tab]} isFav={isFav} onOpen={open} onFav={toggleFav} />
        )}

        {tab === 'favs' && (
          <div className="page">
            <h1>Favourites</h1>
            {favList.length === 0 ? (
              <p className="empty">Press ☆ on any channel, movie or series to keep it here.</p>
            ) : (
              <div className="grid">
                {favList.map((it) => (
                  <Card key={it.id} item={it} fav onOpen={() => open(it, favList.filter((f) => f.kind === 'live'))} onFav={() => toggleFav(it)} />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="page narrow">
            <h1>Playlists</h1>
            {notice && <p className="notice">{notice}</p>}
            <ul className="playlists">
              {playlists.map((p) => (
                <li key={p.id} className={p.id === active.id ? 'on' : ''}>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.type === 'xtream' ? 'Xtream Codes' : p.url ? 'M3U link' : 'M3U file'} · {p.count} items · updated{' '}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </small>
                  </div>
                  {p.id !== active.id && (
                    <button className="secondary" onClick={() => setActiveId(p.id)}>
                      Use
                    </button>
                  )}
                  {(p.type === 'xtream' || p.url) && (
                    <button className="secondary" disabled={busy} onClick={() => refresh(p)}>
                      {busy ? '…' : 'Update'}
                    </button>
                  )}
                  <button className="secondary danger" onClick={() => remove(p)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <h2>Add another playlist</h2>
            <AddPlaylist onAdd={addPlaylist} />
            <p className="muted">Playlists, logins, favourites and history are stored only in this browser.</p>
          </div>
        )}
      </main>

      {series && !playing && <SeriesDetail playlist={active} series={series} onPlay={playEpisode} onClose={() => setSeries(null)} />}

      {playing && current && (
        <Player
          key={current.id}
          url={resolveUrl(active, current)}
          title={current.name}
          live={current.kind === 'live'}
          startAt={startAt}
          fav={isFav(current)}
          epg={epg}
          onFav={() => toggleFav(current)}
          onClose={closePlayer}
          onProgress={(position, duration) => current.kind !== 'live' && record(current, position, duration)}
          onPrev={playing.list.length > 1 ? () => step(-1) : undefined}
          onNext={playing.list.length > 1 ? () => step(1) : undefined}
        />
      )}
    </div>
  );
}
