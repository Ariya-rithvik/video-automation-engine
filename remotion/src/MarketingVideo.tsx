// Top-level composition. Sequences the scenes from Gemini's plan, or falls back to OneScenePan
// when scenes[] is empty. Supports two output formats:
//   - 'landscape' (16:9, 1920x1080): scenes render full-frame as designed.
//   - 'shorts'    (9:16, 1080x1920): the 16:9 scene stage is reframed into the vertical center
//                  by VerticalFrame, with kinetic captions above and a brand bar below.

import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import type { ScenePlan } from './types';
import { FALLBACK_PLAN } from './types';
import { SCENE_REGISTRY, OneScenePan } from './scenes';
import { VerticalFrame } from './scenes/VerticalFrame';

interface Props {
  scenePlan?: ScenePlan;
  format?: 'landscape' | 'shorts';
}

export const MarketingVideo: React.FC<Props> = ({ scenePlan = FALLBACK_PLAN, format = 'landscape' }) => {
  // The scene timeline is identical for both formats — only the framing differs.
  const sceneContent =
    !scenePlan.scenes || scenePlan.scenes.length === 0 ? (
      <OneScenePan plan={scenePlan} />
    ) : (
      <Series>
        {scenePlan.scenes.map((scene, i) => {
          const Component = SCENE_REGISTRY[scene.type];
          const dur = Math.max(1, scene.durationFrames);
          if (!Component) {
            return (
              <Series.Sequence key={i} durationInFrames={dur}>
                <AbsoluteFill style={{ background: scenePlan.meta.brand.bg }} />
              </Series.Sequence>
            );
          }
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              <Component plan={scenePlan} props={scene.props} durationInFrames={dur} />
            </Series.Sequence>
          );
        })}
      </Series>
    );

  if (format === 'shorts') {
    return <VerticalFrame plan={scenePlan}>{sceneContent}</VerticalFrame>;
  }
  return sceneContent;
};
