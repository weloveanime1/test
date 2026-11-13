import { useEffect, useState } from 'react';
import type { Episode, Item, Playlist, Season } from '../lib/types';
import { seriesInfo } from '../lib/xtream';

interface Props {
  playlist: Playlist;
  series: Item;
  onPlay: (episode: Episode, season: number) => void;
  onClose: () => void;
}

export function SeriesDetail({ playlist, series, onPlay, onClose }: Props) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [plot, setPlot] = useState('');
  const [season, setSeason] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let gone = false;
    seriesInfo(playlist, series.seriesId!).then(
      (info) => {
        if (gone) return;
        setSeasons(info.seasons);
        setPlot(info.plot);
        setSeason(info.seasons[0]?.season ?? 0);
      },
      (err) => !gone && setError(err instanceof Error ? err.message : 'Could not load episodes.'),
    );
    return () => {
      gone = true;
    };
  }, [playlist, series.seriesId]);

  const episodes = seasons?.find((s) => s.season === season)?.episodes ?? [];

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{series.name}</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {plot && <p className="plot">{plot}</p>}
        {error && <p className="form-error">{error}</p>}
        {!seasons && !error && <p className="empty">Loading episodes…</p>}
        {seasons && seasons.length === 0 && <p className="empty">No episodes available.</p>}
        {seasons && seasons.length > 0 && (
          <>
            <div className="tabs">
              {seasons.map((s) => (
                <button key={s.season} className={s.season === season ? 'on' : ''} onClick={() => setSeason(s.season)}>
                  Season {s.season}
                </button>
              ))}
            </div>
            <ul className="episodes">
              {episodes.map((ep) => (
                <li key={ep.id}>
                  <button onClick={() => onPlay(ep, season)}>
                    <em>{ep.num}</em>
                    <span>{ep.title}</span>
                    <i>▶</i>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
