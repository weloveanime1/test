import { ArrowLeft, Check, Copy, Heart, ExternalLink, Play, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../ctx';
import { plural, runtime } from '../lib/format';
import { img } from '../lib/net';
import { openInVlc, vlcLabel } from '../lib/sources';
import { resolveUrl } from '../lib/store';
import { isSeries, type Episode, type Info, type Item } from '../lib/types';
import { seriesInfo, vodInfo } from '../lib/xtream';
import { Art, Card } from './Card';

/** Full-page view of a movie or series: artwork, facts, actions and, for series, the episode list. */
export function Detail({ item, onClose }: { item: Item; onClose: () => void }) {
  const { playlist, byKind, play, isFav, toggleFav, history, progressOf } = useApp();
  const series = isSeries(item);
  const [info, setInfo] = useState<Info | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [season, setSeason] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const request =
      playlist.type !== 'xtream' ? null : series ? seriesInfo(playlist, item.seriesId!) : item.streamId != null ? vodInfo(playlist, item.streamId) : null;
    if (!request) return setState('ready');
    let gone = false;
    request.then(
      (data) => {
        if (gone) return;
        setInfo(data);
        setState('ready');
      },
      () => !gone && setState('error'),
    );
    return () => {
      gone = true;
    };
  }, [playlist, item, series]);

  const episodes = useMemo(() => {
    const toItem = (ep: Episode, s: number): Item => ({
      id: `episode:${ep.id}`,
      kind: 'series',
      name: `${item.name} · S${s} E${ep.num} · ${ep.title}`,
      group: item.group,
      logo: ep.image ?? item.logo,
      streamId: Number(ep.id),
      seriesId: item.seriesId,
      ext: ep.ext,
    });
    return (info?.seasons ?? []).flatMap((s) => s.episodes.map((ep) => ({ season: s.season, ep, item: toItem(ep, s.season) })));
  }, [info, item]);
  const queue = useMemo(() => episodes.map((e) => e.item), [episodes]);

  // The episode to offer on the main button: the one in progress, the one after a finished one, or the first.
  const upNext = useMemo(() => {
    const last = history.find((h) => h.item.seriesId === item.seriesId && h.item.streamId != null);
    const at = last ? episodes.findIndex((e) => e.item.id === last.item.id) : -1;
    if (at < 0) return episodes[0];
    const finished = last!.duration > 0 && last!.position >= last!.duration * 0.95;
    return finished ? (episodes[at + 1] ?? episodes[at]) : episodes[at];
  }, [history, episodes, item.seriesId]);

  const related = useMemo(() => (series ? [] : byKind[item.kind].filter((i) => i.group === item.group && i.id !== item.id).slice(0, 14)), [byKind, item, series]);

  const activeSeason = season ?? upNext?.season ?? info?.seasons?.[0]?.season ?? null;
  const fav = isFav(item);
  const progress = progressOf(item);
  const backdrop = info?.backdrop ?? item.backdrop ?? item.logo;
  const plot = info?.plot ?? item.plot;
  const rating = info?.rating ?? item.rating;
  const facts = [
    info?.year ?? item.year,
    info?.genre ?? item.genre,
    info?.duration ? runtime(info.duration) : undefined,
    series && info?.seasons?.length ? `${plural(info.seasons.length, 'season')} · ${plural(episodes.length, 'episode')}` : undefined,
  ].filter(Boolean);

  const copy = async () => {
    await navigator.clipboard?.writeText(resolveUrl(playlist, item)).catch(() => {});
    setCopied(true);
  };

  return (
    <div className="detail">
      {backdrop && <div className={`detail-bg ${info?.backdrop || item.backdrop ? '' : 'soft'}`} style={{ backgroundImage: `url("${img(backdrop)}")` }} />}
      <div className="detail-scroll">
        <button className="btn glass back" onClick={onClose}>
          <ArrowLeft size={18} /> Back
        </button>
        <div className="detail-top">
          <div className="detail-poster">
            <Art src={item.logo} name={item.name} />
          </div>
          <div className="detail-info">
            <span className="kicker">{series || item.kind === 'series' ? 'Series' : 'Movie'}</span>
            <h1>{item.name}</h1>
            <p className="meta">
              {facts.map((f) => (
                <span key={f}>{f}</span>
              ))}
              {rating && (
                <span className="score">
                  <Star size={13} fill="currentColor" /> {rating}
                </span>
              )}
            </p>
            {plot && <p className="plot">{plot}</p>}
            <div className="actions">
              {series ? (
                <button className="btn light" disabled={!upNext} onClick={() => upNext && play(upNext.item, queue)}>
                  <Play size={18} fill="currentColor" />
                  {upNext ? `Play S${upNext.season} E${upNext.ep.num}` : state === 'loading' ? 'Loading…' : 'No episodes'}
                </button>
              ) : (
                <button className="btn light" onClick={() => play(item)}>
                  <Play size={18} fill="currentColor" /> {progress > 0 ? 'Resume' : 'Play'}
                </button>
              )}
              <button className="btn glass" onClick={() => toggleFav(item)}>
                <Heart size={18} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'In my list' : 'My list'}
              </button>
              {info?.trailer && (
                <a className="btn glass" href={info.trailer} target="_blank" rel="noreferrer">
                  <ExternalLink size={18} /> Trailer
                </a>
              )}
              {!series && (
                <button className="btn glass" onClick={() => openInVlc(resolveUrl(playlist, item), item.name)} title="Plays formats that browsers cannot, such as AVI files or AC3 sound">
                  <ExternalLink size={18} /> {vlcLabel()}
                </button>
              )}
              {!series && (
                <button className="btn glass" onClick={copy} title="Copy the stream link to open it in another player such as VLC">
                  {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Link copied' : 'Copy link'}
                </button>
              )}
            </div>
            {info?.director && (
              <p className="credit">
                <small>Director</small> {info.director}
              </p>
            )}
            {info?.cast && (
              <p className="credit">
                <small>Cast</small> {info.cast.split(',').slice(0, 6).join(', ')}
              </p>
            )}
            {state === 'error' && <p className="form-error">More details could not be loaded from the provider.</p>}
          </div>
        </div>

        {series && (
          <div className="seasons">
            {state === 'loading' && <p className="empty">Loading episodes…</p>}
            {state === 'ready' && episodes.length === 0 && <p className="empty">No episodes available.</p>}
            {episodes.length > 0 && (
              <>
                <nav className="season-list" aria-label="Seasons">
                  {info!.seasons!.map((s) => (
                    <button key={s.season} className={s.season === activeSeason ? 'on' : ''} onClick={() => setSeason(s.season)}>
                      <b>Season {s.season}</b>
                      <small>{plural(s.episodes.length, 'episode')}</small>
                    </button>
                  ))}
                </nav>
                <ol className="episodes">
                  {episodes
                    .filter((e) => e.season === activeSeason)
                    .map(({ ep, item: epItem }) => {
                      const watched = progressOf(epItem);
                      return (
                        <li key={ep.id}>
                          <button onClick={() => play(epItem, queue)}>
                            <span className="ep-thumb">
                              <Art src={ep.image ?? item.logo} name={String(ep.num)} />
                              <span className="card-play">
                                <Play size={20} fill="currentColor" />
                              </span>
                              {watched > 0 && (
                                <span className="meter">
                                  <i style={{ width: `${Math.min(100, watched * 100)}%` }} />
                                </span>
                              )}
                            </span>
                            <span className="ep-body">
                              <b>
                                {ep.num}. {ep.title}
                              </b>
                              <span className="chips">
                                {ep.duration && <em>{runtime(ep.duration)}</em>}
                                {ep.rating && (
                                  <em className="score">
                                    <Star size={11} fill="currentColor" /> {ep.rating}
                                  </em>
                                )}
                              </span>
                              {ep.plot && <span className="ep-plot">{ep.plot}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ol>
              </>
            )}
          </div>
        )}

        {related.length > 0 && (
          <section className="related">
            <h2>More in {item.group}</h2>
            <div className="grid">
              {related.map((r) => (
                <Card key={r.id} item={r} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
