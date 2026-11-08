import React from 'react';
import {Composition} from 'remotion';
import {LyricVideo} from './LyricVideo';
import beats from './data/beats.json';

export const FPS = 30;
export const Root: React.FC = () => (
  <Composition
    id="LyricVideo"
    component={LyricVideo}
    durationInFrames={Math.ceil(beats.duration * FPS) + 60}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
