// FeatureCallout — left-aligned big headline + subtitle/bullets wrapped in glass surface.
// Accent bar grows with elastic ease.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, slideFromLeft, slideUp, charReveal, charSlideY, easeOutBack, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard, AnimatedHeadline } from '../effects';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const FeatureCallout: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const headline = props.headline || props.title || 'Feature';
  const subtitle = props.subtitle || props.caption || '';
  const bullets = (props.bullets as string[] | undefined) || [];
  const headlineChars = Array.from(headline);

  const subtitleOpacity = fadeIn(frame, headlineChars.length * 2 + 14, 14);
  const subtitleY = slideUp(frame, headlineChars.length * 2 + 14, 18, 24);

  // Accent bar grows with elastic
  const barProgress = Math.max(0, Math.min(1, easeOutBack((frame - 2) / 24 || 0)));
  const barHeight = barProgress * 280;

  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}12`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1000} x="25%" y="50%" opacity={0.32} blur={120} />
      <GlowOrb color={brand.primary} size={600} x="85%" y="80%" opacity={0.18} blur={90} />

      <ParticleField count={35} color="#ffffff" minSize={2} maxSize={4} speed={0.4} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: 140,
          paddingRight: 140,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, maxWidth: 1600 }}>
          <div
            style={{
              width: 10,
              height: barHeight,
              background: `linear-gradient(180deg, ${brand.primary} 0%, ${brand.primary}66 100%)`,
              borderRadius: 5,
              flexShrink: 0,
              marginTop: 32,
              boxShadow: `0 0 40px ${brand.primary}cc, 0 0 80px ${brand.primary}55`,
            }}
          />

          <div style={{ flex: 1 }}>
            <AnimatedHeadline
              text={headline}
              frame={frame}
              startAt={4}
              stagger={2}
              charDuration={10}
              charSlideDist={32}
              style={{
                color: brand.secondary,
                fontSize: headline.length > 18 ? 88 : 112,
                fontWeight: 900,
                margin: 0,
                letterSpacing: -3,
                lineHeight: 1.05,
                maxWidth: 1500,
                wordBreak: 'normal',
                overflowWrap: 'normal',
                hyphens: 'none',
                textShadow: `0 6px 40px ${brand.primary}50`,
              }}
            />

            {subtitle && (
              <div
                style={{
                  opacity: subtitleOpacity,
                  transform: `translateY(${subtitleY}px)`,
                  marginTop: 36,
                  maxWidth: 1100,
                }}
              >
                <GlassCard tint={brand.primary} padding="20px 32px" radius={20}>
                  <p
                    style={{
                      color: brand.secondary,
                      fontSize: 38,
                      fontWeight: 500,
                      margin: 0,
                      lineHeight: 1.3,
                      letterSpacing: -0.3,
                    }}
                  >
                    {subtitle}
                  </p>
                </GlassCard>
              </div>
            )}

            {bullets.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '36px 0 0' }}>
                {bullets.slice(0, 4).map((b, i) => {
                  const bulletOpacity = fadeIn(frame, 32 + i * 8, 12, easeOutCubic);
                  const bulletX = slideFromLeft(frame, 32 + i * 8, 16, 60);
                  return (
                    <li
                      key={i}
                      style={{
                        opacity: bulletOpacity,
                        transform: `translateX(${bulletX}px)`,
                        color: brand.secondary,
                        fontSize: 36,
                        fontWeight: 500,
                        marginBottom: 18,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 18,
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: brand.primary,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: 20,
                          fontWeight: 900,
                          flexShrink: 0,
                          boxShadow: `0 4px 16px ${brand.primary}80`,
                        }}
                      >
                        ✓
                      </span>
                      {b}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
