import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import '../fonts';
import {Backdrop} from './Backdrop';
import {ChunkView, EXIT} from './Lyrics';
import {Flash, Overlays, Slash} from './Overlays';
import {chorusAmount, CHUNKS, CUES, freezeAmount, impactPulse, isInvert, kick, panelShift, rewindAmount, snare} from './data';
import {clamp01} from './util';

export const LyricVideoV2: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const imp = impactPulse(t);
  const ch = chorusAmount(t);
  const beru = t >= CUES.beru ? Math.exp(-(t - CUES.beru) * 3.5) : 0;
  const shake = 22 * imp + 16 * beru + (ch > 0.5 ? 5 * kick(t, 14) : 0);
  const sx = Math.sin(t * 97.3) * shake;
  const sy = Math.cos(t * 83.1) * shake * 0.7;
  const rw = rewindAmount(t);
  const ca = Math.max(snare(t) * (ch > 0.5 ? 7 : 4), imp * 10, rw * 6 * (0.5 + 0.5 * Math.abs(Math.sin(t * 40))));
  const fz = freezeAmount(t);
  const shift = panelShift(t);
  const filter = isInvert(t)
    ? 'invert(1) hue-rotate(180deg)'
    : fz > 0.01 ? `grayscale(${(0.85 * fz).toFixed(2)}) contrast(${(1 + 0.15 * fz).toFixed(2)})` : undefined;

  const visible = CHUNKS.filter((c) => t >= c.enter - 0.02 && t <= c.exit + EXIT[c.style] + 0.02);
  const whispers = visible.filter((c) => c.style === 'whisper');
  const main = visible.filter((c) => c.style !== 'whisper');

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Audio src={staticFile('song.mp3')} />
      <AbsoluteFill style={{opacity: clamp01(t / 1.2)}}>
        <AbsoluteFill style={{filter, transform: shake > 0.3 ? `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)` : undefined}}>
          <Backdrop t={t} />
          {whispers.map((c) => <ChunkView key={c.id} c={c} t={t} ca={0} />)}
          <AbsoluteFill style={{transform: shift > 0.001 ? `translateX(${(-270 * shift).toFixed(1)}px) scale(${(1 - 0.16 * shift).toFixed(4)})` : undefined}}>
            {main.map((c) => <ChunkView key={c.id} c={c} t={t} ca={ca} />)}
          </AbsoluteFill>
          <Slash t={t} />
        </AbsoluteFill>
        <Overlays t={t} />
        <Flash t={t} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
