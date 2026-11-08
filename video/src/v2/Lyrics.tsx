import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Chunk, CUES, GOLD, Kind, kick, Pal, PAL, Row, Style, WordBox} from './data';
import {clamp01, inCubic, mixHex, outCubic, outExpo, rgba} from './util';

const ENTER: Record<Style, number> = {verse: 0.16, chorus: 0.26, name: 0.45, echo: 0.12, spoken: 0.5, whisper: 0.5};
export const EXIT: Record<Style, number> = {verse: 0.16, chorus: 0.22, name: 0.25, echo: 0.15, spoken: 0.45, whisper: 1.0};
const WHITE = '#f6f4ff';
const YOFF = 18;

const colorOf = (k: Kind, pal: Pal) => (k === 'her' ? GOLD : k === 'accent' ? pal.a : WHITE);

const BlockWord: React.FC<{c: Chunk; r: Row; w: WordBox; t: number; pal: Pal; ca: number}> = ({c, r, w, t, pal, ca}) => {
  const f = r.f;
  const echo = r.echo || c.style === 'echo';
  const sung = c.style !== 'verse';
  const pre = sung ? 0.06 : 0.04;
  const dur = c.style === 'name' ? 0.5 : sung ? 0.22 : 0.13;
  const p = clamp01((t - (w.s - pre)) / dur);
  const since = t - w.s;
  const active = since >= -pre && t <= w.e + 0.06;
  const pop = since >= 0 ? Math.exp(-since * 9) : 0;
  const color = colorOf(w.k, pal);
  const capTop = (c.capTop ?? 0) * f;
  const box: React.CSSProperties = {position: 'absolute', left: w.x, top: r.y - capTop, width: w.w + 2, height: f};
  const base: React.CSSProperties = {
    position: 'absolute', left: 0, top: 0, fontFamily: c.font, fontWeight: c.weight, fontSize: f,
    lineHeight: `${f}px`, letterSpacing: `${c.ls}em`, whiteSpace: 'pre',
  };

  if (echo) {
    const ep = outExpo(p);
    const stroke = color === WHITE ? pal.a : color;
    return (
      <div style={box}>
        <span style={{
          ...base, color: 'transparent', WebkitTextStroke: `${Math.max(1.5, f * 0.011).toFixed(1)}px ${rgba(stroke, 0.95)}`,
          opacity: ep, transform: `scale(${(1.25 - 0.25 * ep).toFixed(4)})`, transformOrigin: '50% 60%',
          textShadow: `0 0 18px ${rgba(pal.a, 0.45)}`,
        }}>{w.t}</span>
      </div>
    );
  }

  if (c.style === 'name') {
    const np = outCubic(p);
    return (
      <div style={box}>
        <span style={{
          ...base, background: 'linear-gradient(180deg, #fff7dc 0%, #f6c95b 52%, #b9832a 100%)',
          WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', opacity: np,
          filter: `drop-shadow(0 0 ${active ? 26 : 16}px rgba(246,201,91,${active ? 0.75 : 0.5}))`,
          transform: `translateY(${((1 - np) * 30).toFixed(1)}px)`,
        }}>{w.t}</span>
      </div>
    );
  }

  const shadows: string[] = [];
  if (ca > 0.5) shadows.push(`${(-ca).toFixed(1)}px 0 0 rgba(255,45,95,0.7)`, `${ca.toFixed(1)}px 0 0 rgba(45,210,255,0.7)`);
  shadows.push(`0 0 ${active ? 30 : 16}px ${rgba(w.k === 'plain' ? pal.b : color, active ? 0.85 : 0.5)}`);
  // Mask reveal: the word slides up from behind its own baseline.
  const pad = f * 0.1;
  const slide = (1 - outExpo(p)) * (r.h + pad * 2);
  const clipBottom = f - capTop - r.h - pad;
  return (
    <div style={{...box, clipPath: p < 1 ? `inset(-300px -300px ${clipBottom.toFixed(1)}px -300px)` : undefined}}>
      {p < 1 && <span style={{...base, color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.14)'}}>{w.t}</span>}
      {p > 0 && (
        <span style={{
          ...base, color, textShadow: shadows.join(', '),
          transform: `translateY(${slide.toFixed(1)}px) scale(${(1 + 0.07 * pop).toFixed(4)})`, transformOrigin: '50% 75%',
        }}>{w.t}</span>
      )}
    </div>
  );
};

const NameDecor: React.FC<{c: Chunk; pe: number}> = ({c, pe}) => {
  const W = c.W ?? 0;
  const H = c.H ?? 0;
  const lw = 240 * pe;
  return (
    <>
      <div style={{
        position: 'absolute', left: W / 2 - 300, width: 600, top: -70, textAlign: 'center', fontFamily: 'Inter', fontWeight: 600,
        fontSize: 18, letterSpacing: '0.6em', paddingLeft: '0.6em', color: rgba(GOLD, 0.85 * pe),
      }}>S-RANK HUNTER</div>
      <div style={{position: 'absolute', top: H / 2, right: W + 40, width: lw, height: 2, background: `linear-gradient(90deg, transparent, ${GOLD})`}} />
      <div style={{position: 'absolute', top: H / 2, left: W + 40, width: lw, height: 2, background: `linear-gradient(90deg, ${GOLD}, transparent)`}} />
    </>
  );
};

const BlockView: React.FC<{c: Chunk; t: number; ca: number}> = ({c, t, ca}) => {
  const pal = PAL[c.key];
  const W = c.W ?? 0;
  const H = c.H ?? 0;
  const pe = outExpo(clamp01((t - c.enter) / ENTER[c.style]));
  const px = inCubic(clamp01((t - c.exit) / EXIT[c.style]));
  const variant = c.style === 'verse' ? [1, 0, 2, 3][c.id % 4] : c.style === 'chorus' ? [0, 3][c.id % 2] : 0;
  let x = 0;
  let y = 0;
  let s = 1;
  let rx = 0;
  let bx = 0;
  let by = 0;
  let blur = 0;
  if (c.style === 'name') {
    s = 1.12 - 0.12 * pe + 0.08 * px;
    blur = (1 - pe) * 14 + px * 10;
  } else if (variant === 0) {
    s = (1.3 - 0.3 * pe) * (1 + 0.45 * px);
    blur = (1 - pe) * 10 + px * 12;
  } else if (variant === 1 || variant === 2) {
    const dir = variant === 1 ? 1 : -1;
    x = dir * ((1 - pe) * 440 - px * 440);
    bx = (1 - pe + px) * 28;
  } else {
    rx = -(1 - pe) * 70 + px * 70;
    y = (1 - pe) * 110 - px * 110;
    by = (1 - pe + px) * 14;
  }
  const life = clamp01((t - c.start) / Math.max(0.4, c.exit - c.start));
  const push = 1 + (c.style === 'chorus' ? 0.05 : 0.03) * life;
  const punch = 1 + kick(t) * (c.style === 'verse' ? 0.028 : 0.05);
  const rot = c.style === 'verse' ? ((c.id % 3) - 1) * 1.4 : 0;
  const opacity = clamp01(pe * 1.6) * (1 - px);
  const fid = `mb${c.id}`;
  const useMb = bx > 0.6 || by > 0.6;
  const filter = [useMb ? `url(#${fid})` : '', blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <>
      {useMb && (
        <svg width={0} height={0} style={{position: 'absolute'}}>
          <defs>
            <filter id={fid} x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation={`${bx.toFixed(1)} ${by.toFixed(1)}`} />
            </filter>
          </defs>
        </svg>
      )}
      <div style={{
        position: 'absolute', left: 960 - W / 2, top: 540 + YOFF - H / 2, width: W, height: H, opacity, filter,
        transform: `perspective(1600px) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateX(${rx.toFixed(2)}deg) rotate(${rot}deg) scale(${(s * push * punch).toFixed(4)})`,
      }}>
        {c.style === 'name' && <NameDecor c={c} pe={pe} />}
        {(c.rows ?? []).map((r, ri) => r.words.map((w, wi) => <BlockWord key={`${ri}-${wi}`} c={c} r={r} w={w} t={t} pal={pal} ca={ca} />))}
      </div>
    </>
  );
};

const SpokenWord: React.FC<{w: WordBox; t: number; pal: Pal; last: boolean}> = ({w, t, pal, last}) => {
  const ep = outCubic(clamp01((t - (w.s - 0.1)) / 0.45));
  const col = w.k === 'her' ? GOLD : w.k === 'accent' ? mixHex(WHITE, pal.a, 0.6) : WHITE;
  return (
    <span style={{
      display: 'inline-block', marginRight: last ? 0 : '0.32em', opacity: 0.1 + 0.9 * ep, color: col,
      filter: ep < 0.99 ? `blur(${((1 - ep) * 6).toFixed(1)}px)` : undefined,
      transform: `translateY(${((1 - ep) * 12).toFixed(1)}px)`,
      textShadow: `0 0 ${(10 + 14 * ep).toFixed(1)}px ${rgba(w.k === 'her' ? GOLD : pal.a, 0.35 * ep)}`,
    }}>{w.t}</span>
  );
};

const SpokenView: React.FC<{c: Chunk; t: number}> = ({c, t}) => {
  const pal = PAL[c.key];
  const pe = outCubic(clamp01((t - c.enter) / ENTER.spoken));
  const isErase = Math.abs(c.start - CUES.erase.a) < 0.35;
  // "Erase my name": a soft wipe removes the line instead of a fade.
  const ep = isErase ? clamp01((t - (c.end + 0.15)) / 0.7) : 0;
  const px = isErase ? clamp01((t - (c.end + 0.85)) / 0.1) : inCubic(clamp01((t - c.exit) / EXIT.spoken));
  const words = c.words ?? [];
  const wipe = ep * 120 - 10;
  const textStyle: React.CSSProperties & {textWrap?: string} = {
    maxWidth: 1380, textAlign: 'center', fontFamily: 'Cinzel', fontWeight: 500, fontSize: c.section === 'Bridge' ? 66 : 58,
    lineHeight: 1.45, letterSpacing: '0.05em', color: WHITE, textWrap: 'balance',
    WebkitMaskImage: ep > 0 ? `linear-gradient(90deg, transparent ${wipe.toFixed(1)}%, black ${(wipe + 10).toFixed(1)}%)` : undefined,
    maskImage: ep > 0 ? `linear-gradient(90deg, transparent ${wipe.toFixed(1)}%, black ${(wipe + 10).toFixed(1)}%)` : undefined,
  };
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: pe * (1 - px), transform: `translateY(${(YOFF - px * 24).toFixed(1)}px)`}}>
      <div style={textStyle}>
        {words.map((w, i) => <SpokenWord key={i} w={w} t={t} pal={pal} last={i === words.length - 1} />)}
      </div>
    </AbsoluteFill>
  );
};

const WhisperView: React.FC<{c: Chunk; t: number}> = ({c, t}) => {
  const pe = outCubic(clamp01((t - c.enter) / ENTER.whisper));
  const px = clamp01((t - c.exit) / EXIT.whisper);
  const life = clamp01((t - c.enter) / (c.exit + EXIT.whisper - c.enter));
  const ls = 0.25 + 0.35 * life;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: pe * (1 - px)}}>
      <div style={{
        fontFamily: 'Cinzel', fontWeight: 400, fontSize: 210, letterSpacing: `${ls.toFixed(3)}em`, paddingLeft: `${ls.toFixed(3)}em`,
        color: 'rgba(255,243,209,0.16)', textShadow: `0 0 40px ${rgba(GOLD, 0.35)}`, transform: `scale(${(1 + 0.08 * life).toFixed(4)})`,
      }}>ARISE</div>
    </AbsoluteFill>
  );
};

export const ChunkView: React.FC<{c: Chunk; t: number; ca: number}> = ({c, t, ca}) => {
  if (c.style === 'spoken') return <SpokenView c={c} t={t} />;
  if (c.style === 'whisper') return <WhisperView c={c} t={t} />;
  return <BlockView c={c} t={t} ca={ca} />;
};
