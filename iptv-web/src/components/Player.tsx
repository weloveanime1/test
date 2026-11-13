import { useEffect, useRef, useState } from 'react';
import { needsProxy, proxied } from '../lib/net';
import type { Programme } from '../lib/types';

type Engine = 'hls' | 'mpegts' | 'native';

function engineFor(url: string, live: boolean): Engine {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (/\.(mp4|mkv|webm|mov|m4v|avi|mp3|aac)$/.test(path)) return 'native';
  // Live links without a recognisable extension are almost always raw MPEG-TS.
  return path.endsWith('.ts') || live ? 'mpegts' : 'native';
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

interface Props {
  url: string;
  title: string;
  live: boolean;
  startAt?: number;
  fav: boolean;
  epg?: Programme[];
  onFav: () => void;
  onClose: () => void;
  onProgress: (position: number, duration: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
}

/** Mount with `key={url}` so each stream starts from a clean state. */
export function Player({ url, title, live, startAt = 0, fav, epg, onFav, onClose, onProgress, onPrev, onNext }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [viaProxy, setViaProxy] = useState(() => needsProxy(url));
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'playing' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const progress = useRef(onProgress);
  progress.current = onProgress;

  useEffect(() => {
    const video = videoRef.current!;
    let gone = false;
    let teardown = () => {};
    setState('loading');

    // A direct attempt that fails is retried once through the proxy before giving up.
    const fail = () => {
      if (gone) return;
      if (viaProxy) setState('error');
      else setViaProxy(true);
    };
    const src = viaProxy ? proxied(url, true) : url;
    const engine = engineFor(url, live);

    (async () => {
      if (engine === 'hls') {
        const { default: Hls } = await import('hls.js');
        if (gone) return;
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.on(Hls.Events.ERROR, (_, data) => data.fatal && fail());
          hls.loadSource(src);
          hls.attachMedia(video);
          teardown = () => hls.destroy();
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

    const onError = () => fail();
    video.addEventListener('error', onError);
    return () => {
      gone = true;
      video.removeEventListener('error', onError);
      teardown();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, live, viaProxy, attempt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'PageUp') onPrev?.();
      else if (e.key === 'PageDown') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  // Report position every few seconds and once more when leaving.
  useEffect(() => {
    const video = videoRef.current!;
    // Tracked separately because the element is already reset by the time this cleanup runs.
    const last = { position: 0, duration: 0 };
    const track = () => {
      last.position = video.currentTime || 0;
      last.duration = Number.isFinite(video.duration) ? video.duration : 0;
    };
    const report = () => last.position > 0 && progress.current(last.position, last.duration);
    video.addEventListener('timeupdate', track);
    const timer = setInterval(report, 5000);
    return () => {
      video.removeEventListener('timeupdate', track);
      clearInterval(timer);
      report();
    };
  }, []);

  const now = Date.now();
  const current = epg?.find((p) => p.start <= now && now < p.end);
  const next = epg?.find((p) => p.start > now);

  const copy = async () => {
    await navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
  };

  return (
    <div className="player">
      <header className="player-bar">
        <button className="ghost" onClick={onClose} aria-label="Close player">
          ← Back
        </button>
        <div className="player-title">
          <strong>{title}</strong>
          {current && (
            <span>
              Now: {current.title} ({clock(current.start)}–{clock(current.end)}){next ? ` · Next: ${next.title}` : ''}
            </span>
          )}
        </div>
        {live && <span className="live-dot">LIVE</span>}
        {onPrev && (
          <button className="ghost" onClick={onPrev} title="Previous channel (PageUp)">
            ▲
          </button>
        )}
        {onNext && (
          <button className="ghost" onClick={onNext} title="Next channel (PageDown)">
            ▼
          </button>
        )}
        <button className={`ghost ${fav ? 'fav-on' : ''}`} onClick={onFav} aria-label="Toggle favourite">
          {fav ? '★' : '☆'}
        </button>
      </header>
      <div className="player-stage">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          onPlaying={() => setState('playing')}
          onLoadedMetadata={(e) => {
            if (!live && startAt > 0) e.currentTarget.currentTime = startAt;
          }}
        />
        {state === 'loading' && <div className="player-msg">Loading stream…</div>}
        {state === 'error' && (
          <div className="player-msg error">
            <p>This stream could not be played.</p>
            <small>It may be offline, or use a format browsers cannot decode (MKV/AVI files, HEVC video, AC3 audio).</small>
            <div className="row">
              <button onClick={() => { setViaProxy(needsProxy(url)); setAttempt((n) => n + 1); }}>Retry</button>
              <button className="secondary" onClick={copy}>
                {copied ? 'Link copied' : 'Copy stream link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
