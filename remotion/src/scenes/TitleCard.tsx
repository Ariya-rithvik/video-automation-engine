// TitleCard — character-by-character headline reveal over particle field + glow orbs.
// First impression of the video, so we go big on motion + ambient depth.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';
import {
  fadeIn, fadeOut, springScale, charReveal, charSlideY, slideUp, easeOutCubic,
} from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, DecorRing, GradientBG, GlassCard, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const TitleCard: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const theme = themeFor(plan);
  const headline = props.headline || props.title || plan.meta.title;
  const subtitle = props.subtitle || plan.meta.tagline;
  const headlineChars = Array.from(headline);

  // Subtle scale-in container
  const containerScale = springScale(frame, 2, fps);
  const subtitleOpacity = fadeIn(frame, headlineChars.length * 2 + 14, 16, easeOutCubic);
  const subtitleY = slideUp(frame, headlineChars.length * 2 + 14, 22, 30);
  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      {/* On LIGHT theme: subtle accent glow only, no decor rings, very faint particles */}
      <GlowOrb color={brand.primary} size={1000} x="25%" y="30%" opacity={theme.glowOpacity} blur={140} />
      <GlowOrb color={brand.primary} size={800}  x="75%" y="70%" opacity={theme.glowOpacity * 0.7} blur={120} />
      <NoiseTexture opacity={theme.noiseOpacity} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          transform: `scale(${containerScale})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: 80,
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Word-wrapped title — chars stay together within each word */}
        <AnimatedHeadline
          text={headline}
          frame={frame}
          startAt={4}
          stagger={2}
          charDuration={10}
          charSlideDist={40}
          style={{
            color: theme.text,
            fontSize: 170,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -6,
            lineHeight: 0.95,
            textAlign: 'center',
            maxWidth: 1700,
          }}
        />

        {/* Subtitle in glass pill */}
        {subtitle && (
          <div style={{ opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`, marginTop: 40 }}>
            <p
              style={{
                color: theme.textMuted,
                fontSize: 38,
                fontWeight: 500,
                margin: 0,
                lineHeight: 1.3,
                letterSpacing: -0.3,
                textAlign: 'center',
                maxWidth: 1400,
              }}
            >
              {subtitle}
            </p>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
