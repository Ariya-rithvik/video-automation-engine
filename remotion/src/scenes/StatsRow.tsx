// StatsRow — big numbers in glass cards with animated counters + ambient particles.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, popScale, animatedNumber, slideUp, floatY, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard } from '../effects';
import { themeFor } from '../theme';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const StatsRow: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;
  const theme = themeFor(plan);

  const headline = props.headline || props.title || '';
  const rawStats = (props.stats as Array<{ value: string; label: string }> | undefined) || [];
  const stats = rawStats.slice(0, 4);

  const headlineOpacity = fadeIn(frame, 4, 12, easeOutCubic);
  const headlineY = slideUp(frame, 4, 18, 30);
  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      <GlowOrb color={brand.primary} size={1100} x="50%" y="50%" opacity={theme.glowOpacity} blur={150} />
      <NoiseTexture opacity={theme.noiseOpacity} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: 80,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {headline && (
          <h3
            style={{
              opacity: headlineOpacity,
              transform: `translateY(${headlineY}px)`,
              color: theme.text,
              fontSize: 60,
              fontWeight: 700,
              margin: '0 0 70px',
              textAlign: 'center',
              maxWidth: 1500,
              letterSpacing: -1.5,
            }}
          >
            {headline}
          </h3>
        )}

        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 36, width: '100%', maxWidth: 1700 }}>
          {stats.map((stat, i) => {
            const startAt = 22 + i * 14;
            const cardEntrance = popScale(frame, startAt, fps);
            const opacity = fadeIn(frame, startAt, 12, easeOutCubic);
            const numberCountStart = startAt + 6;
            const numberCountDuration = 42;
            const numberLandFrame = numberCountStart + numberCountDuration;
            const numberText = animatedNumber(frame, numberCountStart, numberCountDuration, stat.value);
            const float = floatY(frame, fps, 6, 4.5, i * 1.1);

            // Punch effect: when the number lands at its target, scale-pulse + glow flash
            const punchProgress = popScale(frame, numberLandFrame, fps);
            const numberScale = 0.9 + punchProgress * 0.15;  // 0.9 → 1.05
            const glowIntensity = Math.max(0, 1 - Math.max(0, frame - numberLandFrame) / 25);
            const glowStrength = 0.6 + glowIntensity * 0.6;

            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `scale(${cardEntrance}) translateY(${float}px)`,
                  flex: 1,
                }}
              >
                <div style={{
                  background: theme.surface,
                  border: `1px solid ${theme.surfaceBorder}`,
                  borderRadius: 24,
                  padding: '48px 24px',
                  textAlign: 'center',
                  boxShadow: theme.cardShadow,
                }}>
                  <div
                    style={{
                      color: brand.primary,
                      fontSize: 130,
                      fontWeight: 900,
                      letterSpacing: -4,
                      lineHeight: 1,
                      marginBottom: 18,
                      transform: `scale(${numberScale})`,
                      filter: `drop-shadow(0 0 ${10 + glowIntensity * 16}px ${brand.primary}${Math.round(glowStrength * 80).toString(16).padStart(2,'0')})`,
                    }}
                  >
                    {numberText}
                  </div>
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: 22,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 2.5,
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
