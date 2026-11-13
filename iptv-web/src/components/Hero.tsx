import { Info, Play, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../ctx';
import { img } from '../lib/net';
import { isSeries, type Item } from '../lib/types';

/** Rotating showcase of featured titles at the top of Home. */
export function Hero({ items }: { items: Item[] }) {
  const { open, play } = useApp();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(timer);
  }, [paused, items.length]);

  const item = items[index % items.length];
  if (!item) return null;
  const art = item.backdrop ?? item.logo;

  return (
    <section className="hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {art && <div key={item.id} className={`hero-bg ${item.backdrop ? '' : 'soft'}`} style={{ backgroundImage: `url("${img(art)}")` }} />}
      {!item.backdrop && item.logo && <img key={`p-${item.id}`} className="hero-poster" src={img(item.logo)} alt="" referrerPolicy="no-referrer" />}
      <div className="hero-body" key={`b-${item.id}`}>
        <span className="kicker">{item.kind === 'series' ? 'Series' : 'Movie'}</span>
        <h1>{item.name}</h1>
        <p className="meta">
          {item.year && <span>{item.year}</span>}
          {item.genre && <span>{item.genre.split(/[,/]/).slice(0, 2).join(', ')}</span>}
          {item.rating && (
            <span className="score">
              <Star size={13} fill="currentColor" /> {item.rating}
            </span>
          )}
        </p>
        {item.plot && <p className="plot">{item.plot}</p>}
        <div className="actions">
          <button className="btn light" onClick={() => (isSeries(item) ? open(item) : play(item))}>
            <Play size={18} fill="currentColor" /> Watch now
          </button>
          <button className="btn glass" onClick={() => open(item)}>
            <Info size={18} /> More info
          </button>
        </div>
      </div>
      {items.length > 1 && (
        <div className="hero-dots">
          {items.map((it, i) => (
            <button key={it.id} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={`Show ${it.name}`} />
          ))}
        </div>
      )}
    </section>
  );
}
