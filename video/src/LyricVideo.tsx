import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';
import './fonts';
import {Background} from './Background';
import {LineView, GhostLine, isLineVisible} from './Lyrics';
import {Hud, SystemNotice, TitleCard} from './Hud';
import {lines, currentLineIndex, modeOf, DURATION} from './timing';

const SYSTEM_LINE = lines.findIndex((l) => l.text.startsWith('System popped up'));

export const LyricVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const cur = currentLineIndex(t);
  const curLine = cur >= 0 ? lines[cur] : undefined;
  const section = curLine?.section ?? 'Intro';
  const mode = modeOf(section);
  const intensity = mode === 'spoken' ? 0.45 : mode === 'verse' ? 0.85 : 1;

  const visible: number[] = [];
  for (let i = Math.max(0, cur - 2); i < Math.min(lines.length, cur + 2); i++) {
    if (isLineVisible(lines[i], lines[i + 1], t)) visible.push(i);
  }
  // In chorus sections, keep the previous line as a dim ghost above the live one.
  const ghost = (mode === 'chorus' || mode === 'final') && cur > 0 && lines[cur - 1].section === section && t < lines[cur].start + 1.6 ? cur - 1 : -1;

  const sysLine = lines[SYSTEM_LINE];
  const fadeOut = interpolate(t, [DURATION - 0.3, DURATION + 1.2], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{background: '#04030a'}}>
      <Audio src={staticFile('song.mp3')} />
      <AbsoluteFill style={{opacity: fadeOut}}>
        <Background t={t} section={section} intensity={intensity} />
        {ghost >= 0 && visible.length < 2 && <GhostLine line={lines[ghost]} t={t} offset={-230} />}
        {visible.map((i) => (
          <LineView key={i} line={lines[i]} next={lines[i + 1]} t={t} index={i} stackOffset={ghost >= 0 && visible.length < 2 ? 60 : 0} />
        ))}
        {sysLine && <SystemNotice t={t} from={sysLine.start + 0.1} to={sysLine.end + 0.9} />}
        <Hud t={t} section={section} level={Math.max(1, cur + 1)} />
        <TitleCard t={t} from={DURATION - 5.2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
