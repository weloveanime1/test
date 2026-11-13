import { Heart, Play, Star } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../ctx';
import { initials } from '../lib/format';
import { img } from '../lib/net';
import type { Item } from '../lib/types';

/** Artwork with a lettered fallback for missing or broken images. */
export function Art({ src, name }: { src?: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span className="art-fallback">{initials(name)}</span>;
  return <img src={img(src)} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt="" onError={() => setBroken(true)} />;
}

export function Card({ item, queue }: { item: Item; queue?: Item[] }) {
  const { open, isFav, toggleFav, progressOf } = useApp();
  const live = item.kind === 'live';
  const fav = isFav(item);
  const progress = live ? 0 : progressOf(item);
  const sub = live ? item.group : [item.year, item.genre?.split(/[,/]/)[0]?.trim()].filter(Boolean).join(' · ');

  return (
    <div className={`card ${live ? 'channel' : 'poster'}`}>
      <button className="card-hit" onClick={() => open(item, queue)} title={item.name}>
        <div className="card-art">
          <Art src={item.logo} name={item.name} />
          <span className="card-play">
            <Play size={22} fill="currentColor" />
          </span>
          {item.rating && (
            <span className="badge rating">
              <Star size={11} fill="currentColor" /> {item.rating}
            </span>
          )}
          {live && <span className="badge live">LIVE</span>}
          {progress > 0 && (
            <div className="meter">
              <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="card-name">{item.name}</div>
        {sub && <div className="card-sub">{sub}</div>}
      </button>
      <button className={`card-fav ${fav ? 'on' : ''}`} onClick={() => toggleFav(item)} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}>
        <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}
