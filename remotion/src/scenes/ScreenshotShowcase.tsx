// ScreenshotShowcase — full-bleed screenshot in browser frame, with glass caption + ambient depth.

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, slideUp, springScale, floatY, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard, DecorRing } from '../effects';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const ScreenshotShowcase: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const screenshotUrl = props.screenshotUrl as string | undefined;
  const caption = props.caption || props.headline || props.title || '';

  const frameScale = springScale(frame, 6, fps);
  const frameOpacity = fadeIn(frame, 6, 14, easeOutCubic);
  const frameFloat = floatY(frame, fps, 6, 4.5, 0);

  const captionOpacity = fadeIn(frame, 28, 14);
  const captionY = slideUp(frame, 28, 18, 24);

  const imgScale = 1 + (frame / durationInFrames) * 0.05;
  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}12`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1300} x="50%" y="55%" opacity={0.35} blur={140} />
      <GlowOrb color={brand.primary} size={600} x="15%" y="15%" opacity={0.2} blur={90} />
      <GlowOrb color={brand.primary} size={600} x="85%" y="85%" opacity={0.2} blur={90} />

      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <DecorRing size={1900} color={`${brand.primary}0e`} spinSpeed={2} dashed />
      </AbsoluteFill>

      <ParticleField count={40} color="#ffffff" minSize={1.5} maxSize={4.5} speed={0.5} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: 60,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Browser window frame */}
        <div
          style={{
            opacity: frameOpacity,
            transform: `scale(${frameScale}) translateY(${frameFloat}px)`,
            width: 1480,
            background: '#161618',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: `
              0 60px 140px ${brand.primary}55,
              0 30px 70px rgba(0,0,0,0.7),
              inset 0 1px 0 rgba(255,255,255,0.08)
            `,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Title bar */}
          <div
            style={{
              height: 46,
              background: 'linear-gradient(180deg, #1e1e21 0%, #161618 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '0 18px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ width: 13, height: 13, borderRadius: 7, background: '#ff5f57', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
            <div style={{ width: 13, height: 13, borderRadius: 7, background: '#febc2e', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
            <div style={{ width: 13, height: 13, borderRadius: 7, background: '#28c840', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
          </div>
          {/* Screen */}
          <div style={{ height: 800, overflow: 'hidden', position: 'relative', background: '#0f0f12' }}>
            {screenshotUrl ? (
              <Img
                src={screenshotUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                  transform: `scale(${imgScale})`,
                  transformOrigin: 'center top',
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 28 }}>
                No screenshot
              </div>
            )}
          </div>
        </div>

        {/* Caption in glass pill */}
        {caption && (
          <div style={{ opacity: captionOpacity, transform: `translateY(${captionY}px)`, marginTop: 50 }}>
            <GlassCard tint={brand.primary} padding="22px 48px" radius={999}>
              <p
                style={{
                  color: brand.secondary,
                  fontSize: 42,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: -0.5,
                  maxWidth: 1300,
                }}
              >
                {caption}
              </p>
            </GlassCard>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
