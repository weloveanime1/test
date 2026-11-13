import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../lib/types';
import { Card } from './Card';

const PAGE = 120;

interface Props {
  title: string;
  items: Item[];
  isFav: (item: Item) => boolean;
  onOpen: (item: Item, list: Item[]) => void;
  onFav: (item: Item) => void;
}

export function Browse({ title, items, isFav, onOpen, onFav }: Props) {
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const it of items) counts.set(it.group, (counts.get(it.group) ?? 0) + 1);
    return [...counts];
  }, [items]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => (!group || it.group === group) && (!q || it.name.toLowerCase().includes(q)));
  }, [items, group, query]);

  useEffect(() => setLimit(PAGE), [group, query]);

  // Large playlists render a page at a time as the end of the grid scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((n) => n + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div className="browse">
      <aside className="groups">
        <button className={!group ? 'on' : ''} onClick={() => setGroup('')}>
          <span>All</span>
          <em>{items.length}</em>
        </button>
        {groups.map(([name, count]) => (
          <button key={name} className={group === name ? 'on' : ''} onClick={() => setGroup(name)}>
            <span>{name}</span>
            <em>{count}</em>
          </button>
        ))}
      </aside>
      <section className="results">
        <header className="results-head">
          <h1>{group || title}</h1>
          <input type="search" placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
        </header>
        {shown.length === 0 ? (
          <p className="empty">Nothing here{query ? ` matching “${query}”` : ''}.</p>
        ) : (
          <div className="grid">
            {shown.slice(0, limit).map((it, i) => (
              <Card key={`${it.id}-${i}`} item={it} fav={isFav(it)} onOpen={() => onOpen(it, shown)} onFav={() => onFav(it)} />
            ))}
          </div>
        )}
        {limit < shown.length && <div ref={sentinel} className="sentinel" />}
      </section>
    </div>
  );
}
