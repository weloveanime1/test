import React from 'react';
import {interpolate, Easing} from 'remotion';
import {Line, Word, Mode, modeOf, sectionColor, wordKind, palette, beatPulse, low} from './timing';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const outBack = Easing.out(Easing.back(1.6));
const outCubic = Easing.out(Easing.cubic);

function lineWindow(line: Line, next?: Line) {
  const mode = modeOf(line.section);
  const hold = mode === 'spoken' ? 1.3 : 0.55;
  const enter = line.start - 0.15;
  let holdEnd = line.end + hold;
  if (next) holdEnd = Math.min(holdEnd, next.start - 0.06);
  holdEnd = Math.max(holdEnd, line.end + 0.05);
  return {enter, holdEnd, exitEnd: holdEnd + 0.3};
}

export function isLineVisible(line: Line, next: Line | undefined, t: number) {
  const w = lineWindow(line, next);
  return t >= w.enter && t <= w.exitEnd;
}

function fontSize(mode: Mode, text: string) {
  const n = text.length;
  if (mode === 'spoken') return n <= 22 ? 78 : n <= 40 ? 64 : 54;
  if (mode === 'verse') return n <= 30 ? 118 : n <= 45 ? 98 : n <= 60 ? 84 : 72;
  // chorus / final
  if (/^arise[.,!\s]*(my heart)?[.,!\s]*$/i.test(text)) return 260;
  return n <= 20 ? 200 : n <= 40 ? 150 : 118;
}

const WordSpan: React.FC<{word: Word; t: number; mode: Mode; col: {a: string; b: string}; idx: number}> = ({word, t, mode, col, idx}) => {
  const dur = mode === 'spoken' ? 0.45 : 0.17;
  const p = clamp01((t - word.s) / dur);
  if (p <= 0) return <span style={{opacity: 0, display: 'inline-block'}}>{word.w}&nbsp;</span>;
  const kind = wordKind(word.w);
  const active = t >= word.s && t < word.e + 0.08;
  const isArise = /^arise/i.test(word.w);

  let color = palette.white;
  if (kind === 'her') color = palette.gold;
  else if (kind === 'accent') color = mode === 'final' ? palette.gold : col.a;
  if (mode === 'spoken') color = kind === 'her' ? palette.gold : '#e9e6f7';

  const scale = mode === 'spoken' ? 1 : 0.55 + 0.45 * outBack(p);
  const y = mode === 'spoken' ? (1 - outCubic(p)) * 14 : (1 - outBack(p)) * 40;
  const rot = mode === 'verse' ? (1 - p) * (idx % 2 ? 6 : -6) : 0;
  const glowSize = active ? 42 : 18;
  const glowCol = kind === 'plain' ? col.b : color;

  // Expanding ring on every "Arise"
  const ringP = isArise ? clamp01((t - word.s) / 0.9) : 1;

  return (
    <span style={{position: 'relative', display: 'inline-block', opacity: mode === 'spoken' ? 0.35 + 0.65 * p : 1}}>
      {isArise && ringP < 1 && (
        <span style={{
          position: 'absolute', left: '50%', top: '50%', width: '1.2em', height: '1.2em', borderRadius: '50%',
          border: `3px solid ${mode === 'final' ? palette.gold : col.b}`, opacity: (1 - ringP) * 0.9,
          transform: `translate(-50%,-50%) scale(${0.6 + ringP * 3.2})`, pointerEvents: 'none',
        }} />
      )}
      <span style={{
        display: 'inline-block',
        transform: `translateY(${y}px) scale(${scale}) rotate(${rot}deg)`,
        color,
        textShadow: `0 0 ${glowSize}px ${glowCol}, 0 0 ${glowSize * 2.2}px ${glowCol}66`,
        filter: active && mode !== 'spoken' ? 'brightness(1.25)' : undefined,
      }}>{word.w}</span>
      <span>&nbsp;</span>
    </span>
  );
};

export const LineView: React.FC<{line: Line; next?: Line; t: number; index: number; stackOffset?: number}> = ({line, next, t, index, stackOffset = 0}) => {
  const mode = modeOf(line.section);
  const col = sectionColor(line.section);
  const w = lineWindow(line, next);
  const enterP = clamp01((t - w.enter) / 0.3);
  const exitP = clamp01((t - w.holdEnd) / 0.3);
  const opacity = outCubic(enterP) * (1 - outCubic(exitP));
  const pulse = beatPulse(t);
  const kick = low(t);
  const shake = Math.max(0, kick - 0.78) * 45;
  const sx = Math.sin(t * 61) * shake, sy = Math.cos(t * 53) * shake;
  const size = fontSize(mode, line.text);

  const family = mode === 'spoken' ? 'Cinzel' : mode === 'verse' ? 'Anton' : 'Bebas Neue';
  const dir = index % 2 ? 1 : -1;
  const slideIn = (1 - outCubic(enterP)) * (mode === 'verse' ? 120 * dir : 0);
  const slideOut = outCubic(exitP) * (mode === 'spoken' ? -30 : -80);
  const scale = (mode === 'spoken' ? 1 : 1 + 0.035 * pulse) * (1 - 0.06 * exitP);
  const tilt = mode === 'verse' ? dir * 1.5 : 0;

  const align: React.CSSProperties['justifyContent'] = 'center';
  const maxWidth = mode === 'spoken' ? 1400 : mode === 'verse' ? 1480 : 1600;

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: '50%',
      transform: `translateY(calc(-50% + ${stackOffset}px)) translate(${slideIn + sx}px, ${slideOut + sy}px) scale(${scale}) rotate(${tilt}deg)`,
      opacity, display: 'flex', justifyContent: align, padding: '0 120px',
    }}>
      <div style={{
        maxWidth, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', rowGap: mode === 'spoken' ? 8 : 0,
        fontFamily: family, fontSize: size, lineHeight: mode === 'spoken' ? 1.35 : 1.0,
        textTransform: mode === 'spoken' ? 'none' : 'uppercase',
        letterSpacing: mode === 'spoken' ? '0.06em' : mode === 'verse' ? '0.01em' : '0.04em',
        fontWeight: mode === 'spoken' ? 500 : 400, textAlign: 'center',
      }}>
        {line.words.map((wd, i) => <WordSpan key={i} word={wd} t={t} mode={mode} col={col} idx={i} />)}
      </div>
    </div>
  );
};

/** Dimmed, already-sung chorus line held above the live one for an anthemic stacked look. */
export const GhostLine: React.FC<{line: Line; t: number; offset: number}> = ({line, t, offset}) => {
  const mode = modeOf(line.section);
  const col = sectionColor(line.section);
  const size = Math.min(fontSize(mode, line.text), 110) * 0.7;
  const fade = interpolate(t, [line.end, line.end + 0.3], [1, 0.32], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: '50%', transform: `translateY(calc(-50% + ${offset}px))`,
      display: 'flex', justifyContent: 'center', opacity: fade, padding: '0 160px',
    }}>
      <div style={{fontFamily: 'Bebas Neue', fontSize: size, textTransform: 'uppercase', letterSpacing: '0.06em', color: col.b, textAlign: 'center', textShadow: `0 0 20px ${col.b}55`}}>
        {line.text}
      </div>
    </div>
  );
};
