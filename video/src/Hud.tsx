import React from 'react';
import {AbsoluteFill, interpolate, Easing} from 'remotion';
import {DURATION, palette, beatPulse, beatIndex} from './timing';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export const Hud: React.FC<{t: number; section: string; level: number}> = ({t, section, level}) => {
  const boot = clamp01(t / 1.2);
  const pulse = beatPulse(t);
  const bi = beatIndex(t);
  const prog = t / DURATION;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', fontFamily: 'Inter', color: palette.white, opacity: boot}}>
      {/* system panel */}
      <div style={{
        position: 'absolute', left: 64, top: 56, padding: '14px 22px', minWidth: 300,
        border: `1px solid ${palette.electric}aa`, borderRadius: 6, background: 'rgba(8,12,30,0.55)',
        boxShadow: `0 0 ${18 + pulse * 20}px ${palette.electric}55, inset 0 0 30px rgba(94,162,255,0.08)`,
        transform: `translateX(${(1 - Easing.out(Easing.cubic)(boot)) * -60}px)`,
      }}>
        <div style={{fontSize: 15, letterSpacing: '0.35em', color: palette.electric, fontWeight: 600}}>⟐ SYSTEM</div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 6}}>
          <span style={{fontFamily: 'Bebas Neue', fontSize: 44, letterSpacing: '0.08em'}}>LV. {String(level).padStart(2, '0')}</span>
          <span style={{fontSize: 15, letterSpacing: '0.25em', color: '#b7b3d6', textTransform: 'uppercase'}}>{section}</span>
        </div>
        <div style={{marginTop: 8, height: 3, background: '#1d2340', borderRadius: 2, overflow: 'hidden'}}>
          <div style={{width: `${(level % 10) * 10 + 5}%`, height: '100%', background: `linear-gradient(90deg, ${palette.electric}, ${palette.violet})`}} />
        </div>
      </div>

      {/* title */}
      <div style={{position: 'absolute', right: 64, top: 56, textAlign: 'right'}}>
        <div style={{fontFamily: 'Bebas Neue', fontSize: 40, letterSpacing: '0.12em', color: palette.white, textShadow: `0 0 18px ${palette.violet}`}}>ARISE, MY HEART</div>
        <div style={{fontSize: 14, letterSpacing: '0.35em', color: '#b7b3d6', marginTop: 2}}>SUNG JINWOO × CHA HAE-IN</div>
      </div>

      {/* beat meter */}
      <div style={{position: 'absolute', right: 64, bottom: 64, display: 'flex', gap: 8}}>
        {[0, 1, 2, 3].map((k) => {
          const on = bi >= 0 && bi % 4 === k;
          return <div key={k} style={{width: 34, height: 6, borderRadius: 3, background: on ? palette.violet : '#2a2748', boxShadow: on ? `0 0 14px ${palette.violet}` : undefined, opacity: on ? 0.5 + 0.5 * pulse : 1}} />;
        })}
      </div>

      {/* progress */}
      <div style={{position: 'absolute', left: 64, right: 64, bottom: 44, height: 2, background: '#1d1b33'}}>
        <div style={{width: `${prog * 100}%`, height: '100%', background: `linear-gradient(90deg, ${palette.violet}, ${palette.electric})`, boxShadow: `0 0 10px ${palette.electric}`}} />
        <div style={{position: 'absolute', left: 0, top: 10, fontSize: 14, letterSpacing: '0.2em', color: '#8d89ad'}}>{mmss(t)} / {mmss(DURATION)}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Solo-Leveling style notification popping during "System popped up: Player, you accept?" */
export const SystemNotice: React.FC<{t: number; from: number; to: number}> = ({t, from, to}) => {
  if (t < from || t > to + 0.4) return null;
  const inP = clamp01((t - from) / 0.25), outP = clamp01((t - to) / 0.4);
  const s = Easing.out(Easing.back(1.4))(inP) * (1 - outP);
  const sel = t > from + 1.2;
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 170, width: 760, transform: `translateX(-50%) scale(${s})`, opacity: 1 - outP,
      border: `2px solid ${palette.electric}`, borderRadius: 8, background: 'rgba(5,10,32,0.82)', color: palette.white, fontFamily: 'Inter',
      boxShadow: `0 0 40px ${palette.electric}88, inset 0 0 40px rgba(94,162,255,0.12)`, padding: '18px 28px', textAlign: 'center',
    }}>
      <div style={{color: palette.electric, letterSpacing: '0.4em', fontSize: 18, fontWeight: 700}}>! NOTIFICATION</div>
      <div style={{fontSize: 24, marginTop: 10, lineHeight: 1.4}}>You have acquired the qualifications to be a <b>Player</b>.<br />Will you accept?</div>
      <div style={{display: 'flex', justifyContent: 'center', gap: 32, marginTop: 14, fontFamily: 'Bebas Neue', fontSize: 34, letterSpacing: '0.15em'}}>
        <span style={{padding: '2px 26px', border: `1px solid ${palette.electric}`, background: sel ? palette.electric : 'transparent', color: sel ? '#06102a' : palette.white}}>YES</span>
        <span style={{padding: '2px 26px', border: `1px solid #3a4160`, color: '#7f87a6'}}>NO</span>
      </div>
    </div>
  );
};

export const TitleCard: React.FC<{t: number; from: number}> = ({t, from}) => {
  if (t < from) return null;
  const p = clamp01((t - from) / 1.4);
  const o = Easing.out(Easing.cubic)(p);
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: o, background: `rgba(4,3,10,${0.4 * o})`}}>
      <div style={{fontFamily: 'Bebas Neue', fontSize: 190, letterSpacing: '0.1em', color: palette.gold, textShadow: `0 0 40px ${palette.gold}88, 0 0 120px ${palette.violet}`, transform: `scale(${0.92 + 0.08 * o})`}}>ARISE, MY HEART</div>
      <div style={{fontFamily: 'Cinzel', fontSize: 40, letterSpacing: '0.3em', color: palette.white, marginTop: 6, opacity: interpolate(p, [0.4, 1], [0, 1], {extrapolateLeft: 'clamp'})}}>Sung Jinwoo × Cha Hae-In</div>
      <div style={{fontFamily: 'Inter', fontSize: 16, letterSpacing: '0.4em', color: '#8d89ad', marginTop: 30, opacity: interpolate(p, [0.6, 1], [0, 1], {extrapolateLeft: 'clamp'})}}>A SOLO LEVELING LOVE STORY</div>
    </AbsoluteFill>
  );
};
