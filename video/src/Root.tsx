import React from 'react';
import {Composition} from 'remotion';
import {LyricVideo} from './LyricVideo';
import {LyricVideoV2} from './v2/Video';
import beats from './data/beats.json';

export const FPS = 30;
export const FPS2 = 60;
export const Root: React.FC = () => (
  <>
    <Composition
      id="LyricVideo"
      component={LyricVideo}
      durationInFrames={Math.ceil(beats.duration * FPS) + 60}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="LyricVideoV2"
      component={LyricVideoV2}
      durationInFrames={Math.ceil(beats.duration * FPS2) + 2 * FPS2}
      fps={FPS2}
      width={1920}
      height={1080}
    />
  </>
);
