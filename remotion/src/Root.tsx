// Composition registration — Remotion's entry "manifest".
// Uses calculateMetadata so the actual rendered duration matches scenePlan.meta.totalFrames
// at runtime (Gemini decides; we honor).

import React from 'react';
import { Composition } from 'remotion';
import { MarketingVideo } from './MarketingVideo';
import { FALLBACK_PLAN, type ScenePlan } from './types';

// Shared duration calc — both compositions sum scene durations (single source of truth).
function calcDuration({ props }: { props: Record<string, unknown> }) {
  const plan = (props as { scenePlan?: ScenePlan }).scenePlan || FALLBACK_PLAN;
  const totalFromScenes = (plan.scenes || []).reduce(
    (acc, s) => acc + Math.max(1, s.durationFrames),
    0,
  );
  const total = totalFromScenes > 0 ? totalFromScenes : plan.meta.totalFrames;
  return { durationInFrames: total, fps: plan.meta.fps };
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Landscape 16:9 — the primary marketing ad */}
      <Composition
        id="MarketingVideo"
        component={MarketingVideo}
        durationInFrames={FALLBACK_PLAN.meta.totalFrames}
        fps={FALLBACK_PLAN.meta.fps}
        width={1920}
        height={1080}
        defaultProps={{ scenePlan: FALLBACK_PLAN, format: 'landscape' as const }}
        calculateMetadata={calcDuration}
      />

      {/* Vertical 9:16 — YouTube Shorts cut (same scenes, reframed + kinetic captions) */}
      <Composition
        id="MarketingVideoShorts"
        component={MarketingVideo}
        durationInFrames={FALLBACK_PLAN.meta.totalFrames}
        fps={FALLBACK_PLAN.meta.fps}
        width={1080}
        height={1920}
        defaultProps={{ scenePlan: FALLBACK_PLAN, format: 'shorts' as const }}
        calculateMetadata={calcDuration}
      />
    </>
  );
};
