import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import type { Item } from '../lib/types';
import { Card } from './Card';

interface Props {
  title: string;
  items: Item[];
  onMore?: () => void;
}

export function Row({ title, items, onMore }: Props) {
  const track = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="row">
      <header>
        <h2>{title}</h2>
        {onMore && (
          <button className="link" onClick={onMore}>
            Show all <ChevronRight size={16} />
          </button>
        )}
      </header>
      <div className="row-wrap">
        <button className="row-arrow left" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>
          <ChevronLeft size={22} />
        </button>
        <div className="row-track" ref={track}>
          {items.map((it, i) => (
            <Card key={`${it.id}-${i}`} item={it} queue={items} />
          ))}
        </div>
        <button className="row-arrow right" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}
