import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {beatPulse, low, rms, sectionColor, palette} from './timing';

// Deterministic pseudo-random so every frame agrees on particle positions.
function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type P = {x: number; y0: number; speed: number; size: number; drift: number; phase: number};

export const Background: React.FC<{t: number; section: string; intensity: number}> = ({t, section, intensity}) => {
  const particles = useMemo<P[]>(() => {
    const r = mulberry(1337);
    return Array.from({length: 90}, () => ({
      x: r() * 1920, y0: r() * 1080, speed: 18 + r() * 50, size: 2 + r() * 5, drift: (r() - 0.5) * 40, phase: r() * 6.28,
    }));
  }, []);

  const col = sectionColor(section);
  const pulse = beatPulse(t);
  const kick = low(t);
  const e = rms(t);
  const glow = 0.25 + 0.75 * kick * intensity;

  return (
    <AbsoluteFill style={{background: palette.bg, overflow: 'hidden'}}>
      {/* core glow that breathes with the kick */}
      <div style={{
        position: 'absolute', left: '50%', top: '55%', width: 1800, height: 1800,
        transform: `translate(-50%,-50%) scale(${0.9 + 0.18 * glow + 0.06 * pulse})`,
        background: `radial-gradient(circle, ${col.a}${hex(0.22 * intensity + 0.1 * pulse)} 0%, ${col.b}${hex(0.08 * intensity)} 30%, transparent 62%)`,
        filter: 'blur(10px)',
      }} />
      {/* diagonal light streak */}
      <div style={{
        position: 'absolute', left: -400, top: -200, width: 2800, height: 400, opacity: 0.08 + 0.1 * e * intensity,
        transform: `rotate(-18deg) translateY(${Math.sin(t * 0.4) * 60}px)`,
        background: `linear-gradient(90deg, transparent, ${col.b}, transparent)`, filter: 'blur(40px)',
      }} />
      {/* particles */}
      {particles.map((p, i) => {
        const y = ((p.y0 - t * p.speed * (0.6 + intensity)) % 1180 + 1180) % 1180 - 50;
        const x = p.x + Math.sin(t * 0.6 + p.phase) * p.drift;
        const o = interpolate(y, [0, 120, 900, 1080], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        const c = i % 7 === 0 ? col.b : col.a;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: p.size, height: p.size, borderRadius: '50%',
            background: c, opacity: o * (0.35 + 0.65 * e) * (0.5 + 0.5 * intensity),
            boxShadow: `0 0 ${p.size * 3}px ${c}`,
          }} />
        );
      })}
      {/* beat shock ring */}
      <div style={{
        position: 'absolute', left: '50%', top: '55%', width: 600, height: 600, borderRadius: '50%',
        border: `2px solid ${col.b}`, opacity: pulse * 0.35 * intensity,
        transform: `translate(-50%,-50%) scale(${1 + (1 - pulse) * 1.8})`,
      }} />
      {/* scanlines + vignette */}
      <AbsoluteFill style={{
        background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 4px)',
        mixBlendMode: 'overlay', opacity: 0.6,
      }} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.75) 100%)'}} />
    </AbsoluteFill>
  );
};

function hex(a: number) {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255);
  return v.toString(16).padStart(2, '0');
}
