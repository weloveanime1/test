import { useState } from 'react';
import type { Item } from '../lib/types';

interface Props {
  item: Item;
  fav: boolean;
  /** Watched fraction, 0 to 1. */
  progress?: number;
  onOpen: () => void;
  onFav: () => void;
}

export function Card({ item, fav, progress = 0, onOpen, onFav }: Props) {
  const [broken, setBroken] = useState(false);
  const initials = item.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className={`card ${item.kind === 'live' ? 'card-live' : 'card-poster'}`}>
      <button className="card-main" onClick={onOpen} title={item.name}>
        <div className="card-art">
          {item.logo && !broken ? (
            <img src={item.logo} loading="lazy" referrerPolicy="no-referrer" alt="" onError={() => setBroken(true)} />
          ) : (
            <span className="card-initials">{initials}</span>
          )}
          {item.rating && <span className="badge">★ {item.rating}</span>}
          {progress > 0 && (
            <div className="bar">
              <i style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </div>
          )}
        </div>
        <div className="card-name">{item.name}</div>
      </button>
      <button className={`fav ${fav ? 'on' : ''}`} onClick={onFav} aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}>
        {fav ? '★' : '☆'}
      </button>
    </div>
  );
}
