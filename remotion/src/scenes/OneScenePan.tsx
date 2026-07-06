// OneScenePan — the safety-net scene. Always renders something watchable.
// Used as: (a) fallback when Gemini's JSON fails validation, (b) Remotion Studio preview, (c) MVP demo.
// Look: full-bleed gradient + Ken Burns zoom + title → tagline → CTA rotating in/out.

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';

interface Props {
  plan: ScenePlan;
}

export const OneScenePan: React.FC<Props> = ({ plan }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Ken Burns: 1.0x → 1.15x over the full scene
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15]);

  // Three text beats: title → tagline → CTA, each fades in then out
  const beatLen = durationInFrames / 3;
  const titleOpacity = interpolate(frame, [0, 15, beatLen - 15, beatLen], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const taglineOpacity = interpolate(frame, [beatLen, beatLen + 15, beatLen * 2 - 15, beatLen * 2], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [beatLen * 2, beatLen * 2 + 15, durationInFrames], [0, 1, 1], { extrapolateRight: 'clamp' });

  // Slight Y drift for the CTA "pop"
  const ctaY = interpolate(frame, [beatLen * 2, beatLen * 2 + 30], [40, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: plan.meta.brand.bg, overflow: 'hidden' }}>
      {/* Radial glow that breathes with Ken Burns */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 50% at center, ${plan.meta.brand.primary}55 0%, transparent 70%)`,
          transform: `scale(${scale})`,
        }}
      />

      {/* Center stack */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 80,
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            opacity: titleOpacity,
            color: plan.meta.brand.secondary,
            fontSize: 140,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          {plan.meta.title}
        </h1>

        <p
          style={{
            opacity: taglineOpacity,
            color: plan.meta.brand.secondary,
            fontSize: 56,
            fontWeight: 400,
            margin: 0,
            maxWidth: 1400,
            position: 'absolute',
            lineHeight: 1.25,
          }}
        >
          {plan.meta.tagline}
        </p>

        <div
          style={{
            opacity: ctaOpacity,
            transform: `translateY(${ctaY}px)`,
            position: 'absolute',
          }}
        >
          <span
            style={{
              background: plan.meta.brand.primary,
              color: plan.meta.brand.secondary,
              padding: '24px 72px',
              borderRadius: 16,
              fontSize: 44,
              fontWeight: 700,
              display: 'inline-block',
              boxShadow: `0 20px 60px ${plan.meta.brand.primary}66`,
            }}
          >
            Get started →
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
