import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {bgTime, chorusAmount, CUES, GOLD, kick, low, Pal, paletteAt, rainAmount, rms} from './data';
import {clamp01, mulberry, rgba} from './util';

const SMOKE = [staticFile('tex/smoke0.png'), staticFile('tex/smoke1.png')];

const maskStyle = (url: string, x: number, y: number): React.CSSProperties => ({
  WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`,
  WebkitMaskSize: '2048px 1024px', maskSize: '2048px 1024px',
  WebkitMaskRepeat: 'repeat', maskRepeat: 'repeat',
  WebkitMaskPosition: `${x.toFixed(1)}px ${y.toFixed(1)}px`, maskPosition: `${x.toFixed(1)}px ${y.toFixed(1)}px`,
});

const Smoke: React.FC<{T: number; pal: Pal; e: number}> = ({T, pal, e}) => (
  <>
    <AbsoluteFill style={{
      background: `linear-gradient(to top, ${rgba(pal.b, 0.6)} 0%, ${rgba(pal.b, 0.22)} 40%, transparent 74%)`,
      opacity: 0.5 + 0.45 * e, ...maskStyle(SMOKE[0], -T * 26, -T * 9),
    }} />
    <AbsoluteFill style={{
      background: `linear-gradient(to top, ${rgba(pal.a, 0.5)} 0%, ${rgba(pal.a, 0.14)} 45%, transparent 82%)`,
      opacity: 0.45 + 0.45 * e, ...maskStyle(SMOKE[1], T * 18 + 700, -T * 14 + 300),
    }} />
  </>
);

const TICKS = Array.from({length: 48}, (_, i) => i);
/** The Gate: rotating rune rings and light rays behind the chorus. */
const Portal: React.FC<{T: number; k: number; lo: number; pal: Pal; amt: number}> = ({T, k, lo, pal, amt}) => {
  const s = (0.88 + 0.12 * amt) * (1 + 0.05 * k + 0.03 * lo);
  return (
    <AbsoluteFill style={{opacity: amt}}>
      <AbsoluteFill style={{
        background: `repeating-conic-gradient(from ${(T * 7).toFixed(2)}deg at 50% 56%, ${rgba(pal.a, 0.14)} 0deg 1.4deg, transparent 1.4deg 10deg)`,
        WebkitMaskImage: 'radial-gradient(circle at 50% 56%, transparent 13%, black 26%, transparent 64%)',
        maskImage: 'radial-gradient(circle at 50% 56%, transparent 13%, black 26%, transparent 64%)',
        opacity: 0.45 + 0.55 * lo,
      }} />
      <svg width={1920} height={1080} style={{position: 'absolute', left: 0, top: 0}}>
        <g transform={`translate(960 605) scale(${s.toFixed(4)})`}>
          <circle r={410} fill="none" stroke={rgba(pal.a, 0.35)} strokeWidth={2} />
          <circle r={440} fill="none" stroke={rgba(pal.b, 0.45)} strokeWidth={10} strokeDasharray="3 22" transform={`rotate(${(T * 14).toFixed(2)})`} />
          <circle r={372} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="90 40 14 40" transform={`rotate(${(-T * 22).toFixed(2)})`} />
          <circle r={500} fill="none" stroke={rgba(pal.a, 0.18)} strokeWidth={1} />
          {TICKS.map((i) => (
            <rect key={i} x={-2} y={-530} width={4} height={i % 4 === 0 ? 22 : 10} fill={rgba(pal.b, 0.5)}
              transform={`rotate(${((i * 360) / TICKS.length + T * 5).toFixed(2)})`} />
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

const EMBERS = (() => {
  const r = mulberry(4242);
  return Array.from({length: 70}, () => ({x: r() * 1920, y0: r() * 1250, sp: 25 + r() * 70, size: 3 + r() * 7, sway: 10 + r() * 40, ph: r() * 6.28, hue: r()}));
})();
const Embers: React.FC<{T: number; t: number; pal: Pal; e: number; ch: number}> = ({T, t, pal, e, ch}) => (
  <>
    {EMBERS.map((p, i) => {
      const y = (((p.y0 - T * p.sp * (0.7 + 0.8 * ch)) % 1250) + 1250) % 1250 - 80;
      const x = p.x + Math.sin(T * 0.7 + p.ph) * p.sway;
      const fade = clamp01(y / 160) * clamp01((1100 - y) / 220);
      const col = t > CUES.sheEnters && p.hue > 0.72 ? GOLD : p.hue > 0.4 ? pal.a : pal.b;
      const sz = p.size * (1 + 0.6 * ch);
      return (
        <div key={i} style={{
          position: 'absolute', left: x - sz, top: y - sz, width: sz * 2, height: sz * 2, borderRadius: '50%',
          background: `radial-gradient(circle, rgba(255,255,255,0.9) 0%, ${rgba(col, 0.8)} 25%, transparent 70%)`,
          opacity: fade * (0.35 + 0.65 * e),
        }} />
      );
    })}
  </>
);

const DROPS = (() => {
  const r = mulberry(99);
  return Array.from({length: 120}, () => ({x: r() * 2300 - 100, ph: r() * 1400, sp: 1500 + r() * 900, len: 40 + r() * 80, o: 0.12 + r() * 0.3}));
})();
const Rain: React.FC<{t: number; amt: number}> = ({t, amt}) =>
  amt < 0.01 ? null : (
    <AbsoluteFill style={{opacity: amt}}>
      {DROPS.map((d, i) => {
        const y = ((d.ph + t * d.sp) % 1400) - 200;
        return (
          <div key={i} style={{
            position: 'absolute', left: d.x - y * 0.21, top: y, width: 1.6, height: d.len, transform: 'rotate(12deg)',
            background: `linear-gradient(to bottom, transparent, rgba(200,215,255,${d.o.toFixed(2)}))`,
          }} />
        );
      })}
    </AbsoluteFill>
  );

/** Warm light sweep the moment she walks in. */
const GoldSweep: React.FC<{t: number}> = ({t}) => {
  const p = (t - CUES.sheEnters + 0.1) / 1.3;
  if (p < 0 || p > 1) return null;
  return (
    <div style={{
      position: 'absolute', top: -300, left: -900 + p * 3400, width: 700, height: 1700, transform: 'rotate(18deg)',
      background: `linear-gradient(90deg, transparent, ${rgba(GOLD, 0.22)}, rgba(255,244,214,0.35), ${rgba(GOLD, 0.22)}, transparent)`,
      opacity: Math.sin(p * Math.PI),
    }} />
  );
};

export const Backdrop: React.FC<{t: number}> = ({t}) => {
  const pal = paletteAt(t);
  const T = bgTime(t);
  const k = kick(t);
  const e = rms(t);
  const lo = low(t);
  const ch = chorusAmount(t);
  const glow = 0.95 + 0.12 * lo + 0.05 * k;
  return (
    <AbsoluteFill style={{background: pal.bg, overflow: 'hidden'}}>
      <div style={{
        position: 'absolute', left: -40, top: -400, width: 2000, height: 2000, transform: `scale(${glow.toFixed(4)})`,
        background: `radial-gradient(circle, ${rgba(pal.a, 0.16 + 0.18 * ch + 0.1 * k)} 0%, ${rgba(pal.b, 0.07 + 0.05 * ch)} 28%, transparent 60%)`,
      }} />
      <Smoke T={T} pal={pal} e={e} />
      {ch > 0.01 && <Portal T={T} k={k} lo={lo} pal={pal} amt={ch} />}
      <Embers T={T} t={t} pal={pal} e={e} ch={ch} />
      <Rain t={t} amt={rainAmount(t)} />
      <GoldSweep t={t} />
    </AbsoluteFill>
  );
};
