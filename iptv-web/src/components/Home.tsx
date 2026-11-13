import { Bookmark, ChevronRight, Clapperboard, Film, Tv } from 'lucide-react';
import { useMemo } from 'react';
import { useApp, type Tab } from '../ctx';
import { plural } from '../lib/format';
import type { Item } from '../lib/types';
import { Hero } from './Hero';
import { Row } from './Row';

const newest = (items: Item[]) =>
  items
    .filter((i) => i.added)
    .sort((a, b) => b.added! - a.added!)
    .slice(0, 24);
const topRated = (items: Item[]) =>
  items
    .filter((i) => Number(i.rating) >= 7)
    .sort((a, b) => Number(b.rating) - Number(a.rating))
    .slice(0, 24);

export function Home() {
  const { playlist, byKind, favs, history, go } = useApp();

  const featured = useMemo(() => {
    const worth = (i: Item) => (i.backdrop ? 4 : 0) + (i.plot ? 2 : 0) + (Number(i.rating) || 0) / 10 + (i.added ?? 0) / 1e11;
    return [...byKind.movie, ...byKind.series]
      .filter((i) => i.logo || i.backdrop)
      .sort((a, b) => worth(b) - worth(a))
      .slice(0, 6);
  }, [byKind]);

  const rows = useMemo(
    () => ({
      newMovies: newest(byKind.movie),
      newSeries: newest(byKind.series),
      topMovies: topRated(byKind.movie),
      topSeries: topRated(byKind.series),
    }),
    [byKind],
  );

  const resume = history.filter((e) => e.item.kind !== 'live' && e.position > 5 && (!e.duration || e.position < e.duration * 0.95)).map((e) => e.item);
  const recent = history.filter((e) => e.item.kind === 'live').map((e) => e.item);

  const tiles: { tab: Tab; label: string; sub: string; icon: React.ReactNode }[] = [
    { tab: 'live', label: 'Live TV', sub: plural(byKind.live.length, 'channel'), icon: <Tv size={22} /> },
    { tab: 'movie', label: 'Movies', sub: plural(byKind.movie.length, 'movie'), icon: <Film size={22} /> },
    { tab: 'series', label: 'Series', sub: plural(byKind.series.length, 'series', 'series'), icon: <Clapperboard size={22} /> },
    { tab: 'library', label: 'My list', sub: plural(favs.length, 'title'), icon: <Bookmark size={22} /> },
  ];

  return (
    <div className="page home">
      {featured.length > 0 ? (
        <Hero items={featured} />
      ) : (
        <section className="hero plain">
          <div className="hero-body">
            <span className="kicker">Playlist</span>
            <h1>{playlist.name}</h1>
            <p className="plot">Your channels are ready. Pick up where you left off or browse everything below.</p>
          </div>
        </section>
      )}

      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.tab} className={`tile tile-${t.tab}`} onClick={() => go(t.tab)}>
            {t.icon}
            <span>
              <b>{t.label}</b>
              <small>{t.sub}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>

      <Row title="Continue watching" items={resume} />
      <Row title="Recently watched channels" items={recent} />
      <Row title="My list" items={favs} onMore={() => go('library')} />
      <Row title="Live TV" items={byKind.live.slice(0, 24)} onMore={() => go('live')} />
      <Row title="New movies" items={rows.newMovies} onMore={() => go('movie')} />
      <Row title="Top rated movies" items={rows.topMovies} />
      {rows.newMovies.length === 0 && <Row title="Movies" items={byKind.movie.slice(0, 24)} onMore={() => go('movie')} />}
      <Row title="New series" items={rows.newSeries} onMore={() => go('series')} />
      <Row title="Top rated series" items={rows.topSeries} />
      {rows.newSeries.length === 0 && <Row title="Series" items={byKind.series.slice(0, 24)} onMore={() => go('series')} />}
    </div>
  );
}
