import type Hls from 'hls.js';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  List,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useApp } from '../ctx';
import { nowNext, useEpg } from '../lib/epg';
import { clock, stamp } from '../lib/format';
import { needsProxy, proxied } from '../lib/net';
import { resolveUrl, usePersisted } from '../lib/store';
import type { Item, Playlist } from '../lib/types';
import { Art } from './Card';

type Engine = 'hls' | 'mpegts' | 'native';
type Opt = { id: number; label: string };
type MenuId = 'quality' | 'audio' | 'subs' | 'speed' | 'fit';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FITS: { css: CSSProperties['objectFit']; label: string }[] = [
  { css: 'contain', label: 'Fit' },
  { css: 'cover', label: 'Fill (crop)' },
  { css: 'fill', label: 'Stretch' },
];
const MAX_LIVE_RETRIES = 5;

function engineFor(url: string, live: boolean): Engine {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (/\.(mp4|mkv|webm|mov|m4v|avi|mp3|aac)$/.test(path)) return 'native';
  // Live links without a recognisable extension are almost always raw MPEG-TS.
  return path.endsWith('.ts') || live ? 'mpegts' : 'native';
}

/** One entry per rendition; renditions sharing a height are told apart by bitrate. */
function qualityOptions(levels: { height: number; bitrate: number }[]): Opt[] {
  const mbps = (l: { bitrate: number }) => `${(l.bitrate / 1e6).toFixed(1)} Mbps`;
  return levels
    .map((l, id) => ({ id, ...l }))
    .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate)
    .map((l) => {
      const shared = levels.filter((o) => o.height === l.height).length > 1;
      return { id: l.id, label: !l.height ? mbps(l) : shared ? `${l.height}p · ${mbps(l)}` : `${l.height}p` };
    });
}

const resolution = (height: number) => (height >= 2000 ? '4K' : height >= 1000 ? 'FHD' : height >= 700 ? 'HD' : height > 0 ? 'SD' : '');

interface Props {
  playlist: Playlist;
  item: Item;
  /** Channels or episodes around the current item, for previous/next. */
  queue: Item[];
  startAt: number;
  autoplayNext: boolean;
  onClose: () => void;
  onProgress: (item: Item, position: number, duration: number) => void;
  onPlay: (item: Item) => void;
}

/** The outer element survives item changes so fullscreen is kept when zapping channels. */
export function Player(props: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  return (
    <div className="player" ref={wrap}>
      <Core key={props.item.id} wrap={wrap} {...props} />
    </div>
  );
}

function Core({ wrap, playlist, item, queue, startAt, autoplayNext, onClose, onProgress, onPlay }: Props & { wrap: RefObject<HTMLDivElement | null> }) {
  const { isFav, toggleFav } = useApp();
  const url = resolveUrl(playlist, item);
  const live = item.kind === 'live';
  const index = queue.findIndex((q) => q.id === item.id);
  const wraps = live && queue.length > 1 && index >= 0;
  const prev = index > 0 ? queue[index - 1] : wraps ? queue[queue.length - 1] : undefined;
  const next = index >= 0 && index < queue.length - 1 ? queue[index + 1] : wraps ? queue[0] : undefined;
  const epg = nowNext(useEpg(playlist, live ? item.streamId : undefined));

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retries = useRef(0);
  const position = useRef({ time: startAt, duration: 0 });
  const hideTimer = useRef(0);

  const [viaProxy, setViaProxy] = useState(() => needsProxy(url));
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading');
  const [paused, setPaused] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = usePersisted('nepalhub.volume', 1);
  const [muted, setMuted] = useState(false);
  const [height, setHeight] = useState(0);
  const [levels, setLevels] = useState<Opt[]>([]);
  const [audios, setAudios] = useState<Opt[]>([]);
  const [subs, setSubs] = useState<Opt[]>([]);
  const [level, setLevel] = useState(-1);
  const [audio, setAudio] = useState(0);
  const [sub, setSub] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [fit, setFit] = useState(0);
  const [menu, setMenu] = useState<null | 'root' | MenuId>(null);
  const [panel, setPanel] = useState(false);
  const [active, setActive] = useState(true);
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);

  // Stream setup. A direct attempt that fails is retried through the proxy; live streams then keep reconnecting.
  useEffect(() => {
    const video = videoRef.current!;
    let gone = false;
    let teardown = () => {};
    let retryTimer = 0;
    let recovered = false;
    setStatus('loading');

    const fail = () => {
      if (gone) return;
      if (!viaProxy) return setViaProxy(true);
      if (live && retries.current < MAX_LIVE_RETRIES) {
        retries.current++;
        retryTimer = window.setTimeout(() => setAttempt((n) => n + 1), 2500);
        return;
      }
      setStatus('error');
    };
    const src = viaProxy ? proxied(url, true) : url;
    const engine = engineFor(url, live);

    (async () => {
      if (engine === 'hls') {
        const { default: HlsLib } = await import('hls.js');
        if (gone) return;
        if (HlsLib.isSupported()) {
          const hls = new HlsLib();
          hlsRef.current = hls;
          hls.on(HlsLib.Events.MANIFEST_PARSED, () => setLevels(qualityOptions(hls.levels)));
          hls.on(HlsLib.Events.AUDIO_TRACKS_UPDATED, () => {
            setAudios(hls.audioTracks.map((t, id) => ({ id, label: t.name || t.lang || `Track ${id + 1}` })));
            setAudio(Math.max(0, hls.audioTrack));
          });
          hls.on(HlsLib.Events.SUBTITLE_TRACKS_UPDATED, () => {
            setSubs(hls.subtitleTracks.map((t, id) => ({ id, label: t.name || t.lang || `Track ${id + 1}` })));
            setSub(hls.subtitleTrack);
          });
          hls.on(HlsLib.Events.ERROR, (_, data) => {
            if (!data.fatal) return;
            if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && !recovered) {
              recovered = true;
              hls.recoverMediaError();
              return;
            }
            fail();
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          teardown = () => {
            hlsRef.current = null;
            hls.destroy();
          };
        } else {
          video.src = src; // Safari on iPhone plays HLS natively.
        }
      } else if (engine === 'mpegts') {
        const { default: mpegts } = await import('mpegts.js');
        if (gone) return;
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer({ type: 'mpegts', isLive: true, url: new URL(src, location.href).href });
          player.on(mpegts.Events.ERROR, fail);
          player.attachMediaElement(video);
          player.load();
          teardown = () => player.destroy();
        } else {
          video.src = src;
        }
      } else {
        video.src = src;
      }
      video.play().catch(() => {});
    })();

    video.addEventListener('error', fail);
    return () => {
      gone = true;
      clearTimeout(retryTimer);
      video.removeEventListener('error', fail);
      teardown();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, live, viaProxy, attempt]);

  // Save the position every few seconds and once more on the way out.
  const report = useRef(onProgress);
  report.current = onProgress;
  useEffect(() => {
    const send = () => position.current.duration > 0 && report.current(item, position.current.time, position.current.duration);
    const timer = setInterval(send, 5000);
    return () => {
      clearInterval(timer);
      send();
    };
  }, [item]);

  useEffect(() => {
    const video = videoRef.current!;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);
  useEffect(() => {
    videoRef.current!.playbackRate = speed;
  }, [speed, status]);

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement);
    onChange();
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const poke = useCallback(() => {
    setActive(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), 3200);
  }, []);
  useEffect(() => {
    poke();
    return () => clearTimeout(hideTimer.current);
  }, [poke]);

  const toggle = () => {
    const video = videoRef.current!;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };
  const seekTo = (t: number) => {
    const video = videoRef.current!;
    if (Number.isFinite(video.duration)) video.currentTime = Math.min(Math.max(0, t), video.duration);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) return void document.exitFullscreen();
    const el = wrap.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    // iPhones can only make the video element itself fullscreen.
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    else video?.webkitEnterFullscreen?.();
  };
  const togglePip = () => {
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else videoRef.current?.requestPictureInPicture?.().catch(() => {});
  };
  const retry = () => {
    retries.current = 0;
    setViaProxy(needsProxy(url));
    setAttempt((n) => n + 1);
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const actions: Record<string, () => void> = {
      Escape: () => (menu ? setMenu(null) : panel ? setPanel(false) : onClose()),
      ' ': toggle,
      k: toggle,
      f: toggleFull,
      m: () => setMuted((v) => !v),
      ArrowLeft: () => !live && seekTo(videoRef.current!.currentTime - 10),
      ArrowRight: () => !live && seekTo(videoRef.current!.currentTime + 10),
      ArrowUp: () => setVolume((v) => Math.min(1, Math.round((v + 0.1) * 10) / 10)),
      ArrowDown: () => setVolume((v) => Math.max(0, Math.round((v - 0.1) * 10) / 10)),
      PageUp: () => prev && onPlay(prev),
      PageDown: () => next && onPlay(next),
      n: () => next && onPlay(next),
      p: () => prev && onPlay(prev),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    poke();
    action();
  };
  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const menus: Record<MenuId, { label: string; options: Opt[]; value: number; set: (id: number) => void; show: boolean }> = {
    quality: {
      label: 'Quality',
      options: [{ id: -1, label: 'Auto' }, ...levels],
      value: level,
      show: levels.length > 1,
      set: (id) => {
        if (hlsRef.current) hlsRef.current.currentLevel = id;
        setLevel(id);
      },
    },
    audio: {
      label: 'Audio',
      options: audios,
      value: audio,
      show: audios.length > 1,
      set: (id) => {
        if (hlsRef.current) hlsRef.current.audioTrack = id;
        setAudio(id);
      },
    },
    subs: {
      label: 'Subtitles',
      options: [{ id: -1, label: 'Off' }, ...subs],
      value: sub,
      show: subs.length > 0,
      set: (id) => {
        if (hlsRef.current) {
          hlsRef.current.subtitleDisplay = id >= 0;
          hlsRef.current.subtitleTrack = id;
        }
        setSub(id);
      },
    },
    speed: {
      label: 'Speed',
      options: SPEEDS.map((s, id) => ({ id, label: s === 1 ? 'Normal' : `${s}×` })),
      value: SPEEDS.indexOf(speed),
      show: !live,
      set: (id) => setSpeed(SPEEDS[id]),
    },
    fit: { label: 'Picture', options: FITS.map((f, id) => ({ id, label: f.label })), value: fit, show: true, set: setFit },
  };
  const current = menu && menu !== 'root' ? menus[menu] : null;

  const showUi = active || paused || menu !== null || panel || status !== 'playing';
  const remaining = Math.max(0, duration - time);
  const nearEnd = !live && !!next && duration > 0 && remaining < 30;
  const badge = resolution(height);
  const fav = isFav(item);
  // Long channel lists are shown as a window around the current channel.
  const windowStart = Math.max(0, index - 60);
  const seekStyle = { '--played': `${duration ? (time / duration) * 100 : 0}%`, '--buffered': `${duration ? (buffered / duration) * 100 : 0}%` } as CSSProperties;

  return (
    <div className={`p-root ${showUi ? 'ui' : ''}`} onMouseMove={poke} onTouchStart={poke}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ objectFit: FITS[fit].css }}
        onClick={() => (showUi ? toggle() : poke())}
        onDoubleClick={toggleFull}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onWaiting={() => setStatus((s) => (s === 'error' ? s : 'loading'))}
        onPlaying={() => {
          retries.current = 0;
          setStatus('playing');
        }}
        onLoadedMetadata={(e) => {
          setHeight(e.currentTarget.videoHeight);
          if (!live && position.current.time > 0) e.currentTarget.currentTime = position.current.time;
        }}
        onResize={(e) => setHeight(e.currentTarget.videoHeight)}
        onDurationChange={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setTime(v.currentTime);
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          if (!live && v.currentTime > 0 && Number.isFinite(v.duration)) position.current = { time: v.currentTime, duration: v.duration };
        }}
        onEnded={() => autoplayNext && !live && next && onPlay(next)}
      />

      {status === 'loading' && (
        <div className="p-center">
          <LoaderCircle className="spin" size={56} />
        </div>
      )}
      {status === 'error' && (
        <div className="p-center p-error">
          <h3>This stream could not be played</h3>
          <p>It may be offline, or use a format browsers cannot decode (MKV/AVI files, HEVC video, AC3 audio).</p>
          <div className="actions">
            <button className="btn light" onClick={retry}>
              Try again
            </button>
            <button className="btn glass" onClick={copy}>
              {copied ? 'Link copied' : 'Copy stream link'}
            </button>
          </div>
        </div>
      )}

      <header className="p-top">
        <button className="p-btn" onClick={onClose} aria-label="Close player">
          <ArrowLeft size={22} />
        </button>
        <div className="p-title">
          <b>{item.name}</b>
          <span>{epg.now ? `${epg.now.title}${epg.next[0] ? ` · Next: ${epg.next[0].title}` : ''}` : item.group}</span>
        </div>
        {live && <span className="badge live solid">LIVE</span>}
        {badge && <span className="badge">{badge}</span>}
        <button className={`p-btn ${fav ? 'accent' : ''}`} onClick={() => toggleFav(item)} aria-label="Toggle favourite">
          <Heart size={20} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </header>

      {nearEnd && (
        <button className="btn light p-next" onClick={() => onPlay(next!)}>
          <SkipForward size={18} fill="currentColor" /> Next episode
        </button>
      )}

      <footer className="p-bottom">
        {live
          ? epg.now && (
              <div className="p-seek">
                <span>{clock(epg.now.start)}</span>
                <span className="meter">
                  <i style={{ width: `${Math.min(100, ((Date.now() - epg.now.start) / (epg.now.end - epg.now.start)) * 100)}%` }} />
                </span>
                <span>{clock(epg.now.end)}</span>
              </div>
            )
          : duration > 0 && (
              <div className="p-seek">
                <span>{stamp(time)}</span>
                <input type="range" className="seek" min={0} max={duration} step={0.1} value={time} style={seekStyle} aria-label="Seek" onChange={(e) => seekTo(Number(e.target.value))} />
                <span>-{stamp(remaining)}</span>
              </div>
            )}
        <div className="p-row">
          <div className="p-group">
            {prev && (
              <button className="p-btn" onClick={() => onPlay(prev)} title={live ? 'Previous channel (PageUp)' : 'Previous episode'} aria-label="Previous">
                <SkipBack size={20} fill="currentColor" />
              </button>
            )}
            {!live && (
              <button className="p-btn" onClick={() => seekTo(time - 10)} title="Back 10 seconds (←)" aria-label="Back 10 seconds">
                <RotateCcw size={20} />
              </button>
            )}
            <button className="p-btn big" onClick={toggle} title="Play or pause (Space)" aria-label={paused ? 'Play' : 'Pause'}>
              {paused ? <Play size={26} fill="currentColor" /> : <Pause size={26} fill="currentColor" />}
            </button>
            {!live && (
              <button className="p-btn" onClick={() => seekTo(time + 10)} title="Forward 10 seconds (→)" aria-label="Forward 10 seconds">
                <RotateCw size={20} />
              </button>
            )}
            {next && (
              <button className="p-btn" onClick={() => onPlay(next)} title={live ? 'Next channel (PageDown)' : 'Next episode'} aria-label="Next">
                <SkipForward size={20} fill="currentColor" />
              </button>
            )}
            <div className="p-vol">
              <button className="p-btn" onClick={() => setMuted((v) => !v)} title="Mute (M)" aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                className="seek"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                style={{ '--played': `${(muted ? 0 : volume) * 100}%`, '--buffered': '0%' } as CSSProperties}
                aria-label="Volume"
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  setMuted(false);
                }}
              />
            </div>
          </div>
          <span className="p-hint">{!live && duration > 0 && `Ends at ${clock(Date.now() + (remaining * 1000) / speed)}`}</span>
          <div className="p-group">
            {queue.length > 1 && (
              <button className={`p-btn ${panel ? 'accent' : ''}`} onClick={() => setPanel((v) => !v)} title={live ? 'Channels' : 'Episodes'} aria-label={live ? 'Channels' : 'Episodes'}>
                <List size={20} />
              </button>
            )}
            <button className={`p-btn ${menu ? 'accent' : ''}`} onClick={() => setMenu((m) => (m ? null : 'root'))} title="Playback settings" aria-label="Playback settings">
              <SlidersHorizontal size={20} />
            </button>
            {document.pictureInPictureEnabled && (
              <button className="p-btn" onClick={togglePip} title="Picture in picture" aria-label="Picture in picture">
                <PictureInPicture2 size={20} />
              </button>
            )}
            <button className="p-btn" onClick={toggleFull} title="Fullscreen (F)" aria-label="Fullscreen">
              {full ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </footer>

      {menu && (
        <div className="p-menu" role="menu">
          {current ? (
            <>
              <button className="p-menu-head" onClick={() => setMenu('root')}>
                <ChevronLeft size={18} /> {current.label}
              </button>
              {current.options.map((o) => (
                <button key={o.id} role="menuitemradio" aria-checked={o.id === current.value} onClick={() => current.set(o.id)}>
                  <span>{o.label}</span>
                  {o.id === current.value && <Check size={16} />}
                </button>
              ))}
            </>
          ) : (
            (Object.keys(menus) as MenuId[])
              .filter((id) => menus[id].show)
              .map((id) => (
                <button key={id} role="menuitem" onClick={() => setMenu(id)}>
                  <span>{menus[id].label}</span>
                  <em>{menus[id].options.find((o) => o.id === menus[id].value)?.label}</em>
                  <ChevronRight size={16} />
                </button>
              ))
          )}
        </div>
      )}

      {panel && <Panel title={live ? "Channels" : "Episodes"} items={queue.slice(windowStart, windowStart + 200)} currentId={item.id} onPlay={onPlay} onClose={() => setPanel(false)} />}
    </div>
  );
}

function Panel({ title, items, currentId, onPlay, onClose }: { title: string; items: Item[]; currentId: string; onPlay: (item: Item) => void; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('.on')?.scrollIntoView({ block: 'center' });
  }, []);

  return (
    <aside className='p-panel'>
      <header>
        <b>{title}</b>
        <button className='p-btn' onClick={onClose} aria-label='Close list'>
          <X size={18} />
        </button>
      </header>
      <div className='p-panel-list' ref={list}>
        {items.map((q) => (
          <button key={q.id} className={q.id === currentId ? 'on' : ''} onClick={() => onPlay(q)}>
            <span className='ch-logo'>
              <Art src={q.logo} name={q.name} />
            </span>
            <span>{q.name}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
