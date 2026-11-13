import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { matcher } from '../lib/format';
import type { Item, Kind } from '../lib/types';
import { Card } from './Card';

const SECTIONS: [Kind, string][] = [
  ['live', 'Channels'],
  ['movie', 'Movies'],
  ['series', 'Series'],
];

function Sections({ pick, limit }: { pick: (kind: Kind) => Item[]; limit?: number }) {
  return (
    <>
      {SECTIONS.map(([kind, label]) => {
        const list = pick(kind);
        if (list.length === 0) return null;
        return (
          <section className="section" key={kind}>
            <h2>
              {label} <small>{list.length.toLocaleString()}</small>
            </h2>
            <div className={`grid ${kind === 'live' ? 'wide' : ''}`}>
              {list.slice(0, limit).map((it, i) => (
                <Card key={`${it.id}-${i}`} item={it} queue={kind === 'live' ? list : undefined} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/** Favourites and watch history. */
export function Library() {
  const { favs, history } = useApp();
  const [tab, setTab] = useState<'favs' | 'history'>('favs');
  const source = tab === 'favs' ? favs : history.map((h) => h.item);

  return (
    <div className="page padded">
      <header className="pane-head">
        <h1>My list</h1>
        <div className="tabs">
          <button className={tab === 'favs' ? 'on' : ''} onClick={() => setTab('favs')}>
            Favourites
          </button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>
            History
          </button>
        </div>
      </header>
      {source.length === 0 ? (
        <p className="empty">
          {tab === 'favs' ? 'Press the heart on any channel, movie or series to keep it here.' : 'Everything you watch will show up here.'}
        </p>
      ) : (
        <Sections pick={(kind) => source.filter((i) => i.kind === kind)} />
      )}
    </div>
  );
}

/** Results of the search box in the top bar, across the whole playlist. */
export function SearchResults({ query }: { query: string }) {
  const { byKind } = useApp();
  const found = useMemo(() => {
    const match = matcher(query);
    return { live: byKind.live.filter((i) => match(i.name)), movie: byKind.movie.filter((i) => match(i.name)), series: byKind.series.filter((i) => match(i.name)) };
  }, [byKind, query]);
  const total = found.live.length + found.movie.length + found.series.length;

  return (
    <div className="page padded">
      <header className="pane-head">
        <h1>Results for “{query}”</h1>
      </header>
      {total === 0 ? <p className="empty">Nothing found. Try a shorter or different search.</p> : <Sections pick={(kind) => found[kind]} limit={60} />}
    </div>
  );
}
