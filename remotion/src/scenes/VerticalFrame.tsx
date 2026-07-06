// VerticalFrame — renders the existing 16:9 scene content inside a 9:16 Shorts frame WITHOUT
// touching any scene's internal layout. The scenes assume a 1920×1080 coordinate space, so we
// render them in a real 1920×1080 stage and scale that stage to fit the 1080px width
// (scale = 1080/1920 = 0.5625 → rendered ≈ 1080×607), centered vertically. The top dead-space
// holds a kinetic caption synced to the active scene; the bottom holds a brand bar.
//
// This is the reframe strategy from the plan: reuse all 13 scenes, get a legit Shorts format.

import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import type { ScenePlan } from '../types';
import { themeFor } from '../theme';
import { KineticCaption } from '../KineticCaption';

interface Props {
  plan: ScenePlan;
  children: React.ReactNode;   // the scene <Series> (or fallback) rendered at 1920×1080
}

const STAGE_W = 1920;
const STAGE_H = 1080;
const FRAME_W = 1080;
const SCALE = FRAME_W / STAGE_W; // 0.5625

export const VerticalFrame: React.FC<Props> = ({ plan, children }) => {
  const theme = themeFor(plan);
  const frame = useCurrentFrame();

  // Find the active scene's caption + the frame it became active (for caption sync)
  let acc = 0;
  let activeCaption = plan.meta.tagline || plan.meta.title;
  let captionStart = 0;
  for (const s of plan.scenes || []) {
    const dur = Math.max(1, s.durationFrames);
    if (frame >= acc && frame < acc + dur) {
      activeCaption =
        (s.props && (s.props.caption || s.props.headline || s.props.title)) ||
        plan.meta.tagline ||
        plan.meta.title;
      captionStart = acc;
      break;
    }
    acc += dur;
  }

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Subtle brand tint top + bottom for depth */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 40% at 50% 0%, ${plan.meta.brand.primary}14 0%, transparent 60%),
                       radial-gradient(ellipse 120% 40% at 50% 100%, ${plan.meta.brand.primary}10 0%, transparent 60%)`,
        }}
      />

      {/* ── Top: kinetic caption band ── */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 0,
          right: 0,
          height: 460,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <KineticCaption
          text={activeCaption}
          startFrame={captionStart}
          brandColor={plan.meta.brand.primary}
          textColor={theme.text}
          fontSize={88}
          maxWidth={960}
        />
      </div>

      {/* ── Center: the 16:9 scene stage, scaled to fit width, framed like a screen ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${SCALE})`,
          transformOrigin: 'center center',
          borderRadius: 28 / SCALE,                 // visually ~28px after scaling
          overflow: 'hidden',
          boxShadow: `0 ${40 / SCALE}px ${120 / SCALE}px rgba(0,0,0,0.18)`,
          border: `${2 / SCALE}px solid ${theme.surfaceBorder}`,
          background: '#000',
        }}
      >
        {children}
      </div>

      {/* ── Bottom: brand bar ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: plan.meta.brand.primary,
            boxShadow: `0 0 18px ${plan.meta.brand.primary}`,
          }}
        />
        <div
          style={{
            color: theme.text,
            fontSize: 46,
            fontWeight: 800,
            letterSpacing: -1,
          }}
        >
          {plan.meta.title}
        </div>
      </div>
    </AbsoluteFill>
  );
};
