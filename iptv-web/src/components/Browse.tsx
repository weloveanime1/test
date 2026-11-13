import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { matcher, plural } from '../lib/format';
import { usePaged } from '../lib/paged';
import type { Item } from '../lib/types';
import { Card } from './Card';
import { Categories, groupCounts } from './Categories';

type Sort = 'default' | 'new' | 'rating' | 'name';
const SORTS: Record<Sort, { label: string; compare?: (a: Item, b: Item) => number }> = {
  default: { label: 'Provider order' },
  new: { label: 'Recently added', compare: (a, b) => (b.added ?? 0) - (a.added ?? 0) },
  rating: { label: 'Top rated', compare: (a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0) },
  name: { label: 'A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
};

/** Poster grid for movies or series with categories, sorting and a filter. */
export function Browse({ title, noun, items }: { title: string; noun: string; items: Item[] }) {
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('default');

  const groups = useMemo(() => groupCounts(items), [items]);
  const shown = useMemo(() => {
    const match = matcher(query);
    const list = items.filter((it) => (!group || it.group === group) && (!query.trim() || match(it.name)));
    const compare = SORTS[sort].compare;
    return compare ? list.sort(compare) : list;
  }, [items, group, query, sort]);
  const [limit, sentinel] = usePaged(shown.length, 90, `${group}|${query}|${sort}`);

  return (
    <div className="browse">
      <Categories groups={groups} total={items.length} value={group} onChange={setGroup} />
      <section className="results">
        <header className="pane-head">
          <div>
            <h1>{group || title}</h1>
            <small>{plural(shown.length, noun, noun === 'series' ? 'series' : undefined)}</small>
          </div>
          <div className="tools">
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort order">
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="field">
              <Search size={16} />
              <input type="search" placeholder={`Filter ${title.toLowerCase()}`} value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
          </div>
        </header>
        {shown.length === 0 ? (
          <p className="empty">Nothing here{query ? ` matching “${query}”` : ''}.</p>
        ) : (
          <div className="grid">
            {shown.slice(0, limit).map((it, i) => (
              <Card key={`${it.id}-${i}`} item={it} />
            ))}
          </div>
        )}
        {limit < shown.length && <div ref={sentinel} className="sentinel" />}
      </section>
    </div>
  );
}
