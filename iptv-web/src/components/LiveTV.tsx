import { Heart, Play, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { nowNext, useEpg, useInView } from '../lib/epg';
import { clock, matcher } from '../lib/format';
import { usePaged } from '../lib/paged';
import type { Item } from '../lib/types';
import { Art } from './Card';
import { Categories, groupCounts } from './Categories';

const FAVS = '\u2605favourites';
const share = (start: number, end: number) => Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));

function ChannelRow({ item, selected, onPick }: { item: Item; selected: boolean; onPick: () => void }) {
  const { playlist } = useApp();
  const [ref, seen] = useInView<HTMLButtonElement>();
  const { now, next } = nowNext(useEpg(playlist, item.streamId, seen));

  return (
    <button ref={ref} className={`ch ${selected ? 'on' : ''}`} onClick={onPick}>
      <span className="ch-logo">
        <Art src={item.logo} name={item.name} />
      </span>
      <span className="ch-body">
        <b>{item.name}</b>
        {now ? (
          <>
            <span className="ch-now">
              {clock(now.start)} – {clock(now.end)} · {now.title}
            </span>
            <span className="meter">
              <i style={{ width: `${share(now.start, now.end)}%` }} />
            </span>
            {next[0] && (
              <span className="ch-next">
                {clock(next[0].start)} · {next[0].title}
              </span>
            )}
          </>
        ) : (
          <span className="ch-next">{item.group}</span>
        )}
      </span>
    </button>
  );
}

function Preview({ item, onWatch }: { item: Item; onWatch: () => void }) {
  const { playlist, isFav, toggleFav } = useApp();
  const { now, next } = nowNext(useEpg(playlist, item.streamId));
  const fav = isFav(item);

  return (
    <aside className="preview">
      <div className="preview-head">
        <span className="badge live solid">LIVE</span>
        <span>{item.name}</span>
        {now && (
          <span>
            {clock(now.start)} – {clock(now.end)}
          </span>
        )}
      </div>
      <h2>{now?.title ?? item.name}</h2>
      {now?.description && <p className="plot">{now.description}</p>}
      {!now && <p className="plot">{item.group}</p>}
      {now && (
        <div className="preview-time">
          <span>{clock(now.start)}</span>
          <span className="meter">
            <i style={{ width: `${share(now.start, now.end)}%` }} />
          </span>
          <span>{clock(now.end)}</span>
        </div>
      )}
      <div className="actions">
        <button className="btn primary" onClick={onWatch}>
          <Play size={18} fill="currentColor" /> Watch now
        </button>
        <button className="btn glass" onClick={() => toggleFav(item)}>
          <Heart size={18} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'In favourites' : 'Favourite'}
        </button>
      </div>
      {next.length > 0 && (
        <div className="upnext">
          {next.slice(0, 4).map((p, i) => (
            <div key={p.start}>
              <small>
                {i === 0 ? 'Next · ' : ''}
                {clock(p.start)}
              </small>
              <b>{p.title}</b>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function LiveTV() {
  const { byKind, favs, play } = useApp();
  const channels = byKind.live;
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Item | null>(null);

  const groups = useMemo(() => groupCounts(channels), [channels]);
  const liveFavs = useMemo(() => favs.filter((f) => f.kind === 'live'), [favs]);
  const shown = useMemo(() => {
    const match = matcher(query);
    const base = group === FAVS ? liveFavs : group ? channels.filter((c) => c.group === group) : channels;
    return query.trim() ? base.filter((c) => match(c.name)) : base;
  }, [channels, liveFavs, group, query]);
  const [limit, sentinel] = usePaged(shown.length, 60, `${group}|${query}`);

  const selected = picked && shown.some((c) => c.id === picked.id) ? picked : (shown[0] ?? null);
  // With the preview pane visible the first click selects and the second plays; without it a click plays at once.
  const pick = (item: Item) => {
    const hasPreview = window.matchMedia('(min-width: 1100px)').matches;
    if (!hasPreview || selected?.id === item.id) play(item, shown);
    else setPicked(item);
  };

  return (
    <div className="livetv">
      <Categories groups={groups} total={channels.length} value={group} onChange={setGroup} pinned={[{ id: FAVS, label: '★ Favourites', count: liveFavs.length }]} />
      <section className="chlist">
        <header className="pane-head">
          <h1>{group === FAVS ? 'Favourites' : group || 'Live TV'}</h1>
          <label className="field">
            <Search size={16} />
            <input type="search" placeholder="Filter channels" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </header>
        {shown.length === 0 && <p className="empty">No channels here{query ? ` matching “${query}”` : ''}.</p>}
        <div className="ch-items">
          {shown.slice(0, limit).map((c, i) => (
            <ChannelRow key={`${c.id}-${i}`} item={c} selected={selected?.id === c.id} onPick={() => pick(c)} />
          ))}
        </div>
        {limit < shown.length && <div ref={sentinel} className="sentinel" />}
      </section>
      {selected && <Preview key={selected.id} item={selected} onWatch={() => play(selected, shown)} />}
    </div>
  );
}
