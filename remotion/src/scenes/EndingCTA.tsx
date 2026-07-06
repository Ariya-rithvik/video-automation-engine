// EndingCTA — closing moment. Lots of celebration energy: orbs, particles, rings, big pulsing CTA.

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, springScale, slideUp, pulse, charReveal, charSlideY, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, DecorRing, GradientBG, GlassCard, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const EndingCTA: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const theme = themeFor(plan);
  const title = props.title || props.headline || props.ctaText || `Get started with ${plan.meta.title}`;
  const url = props.url || '';
  const titleChars = Array.from(title);

  const buttonOpacity = fadeIn(frame, titleChars.length * 2 + 16, 14);
  const buttonY = slideUp(frame, titleChars.length * 2 + 16, 22, 50);
  const buttonScale = springScale(frame, titleChars.length * 2 + 16, fps);
  const buttonPulse = pulse(Math.max(0, frame - 60), fps, 0.04, 1.6);
  const exitOpacity = fadeOut(frame, durationInFrames, 10);

  // Background breathe + slow zoom
  const bgScale = 1 + (frame / durationInFrames) * 0.08;

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      {/* Subtle accent glow only on light theme — no rings or dense particles */}
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${bgScale})` }}>
        <GlowOrb color={brand.primary} size={1500} x="50%" y="50%" opacity={theme.glowOpacity * 2} blur={160} />
      </div>
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
          textAlign: 'center',
        }}
      >
        <AnimatedHeadline
          text={title}
          frame={frame}
          startAt={4}
          stagger={2}
          charDuration={10}
          charSlideDist={36}
          style={{
            color: theme.text,
            fontSize: 144,
            fontWeight: 900,
            margin: 0,
            letterSpacing: -5,
            lineHeight: 1.0,
            maxWidth: 1600,
            textAlign: 'center',
          }}
        />

        {url && (
          <div
            style={{
              opacity: buttonOpacity,
              transform: `translateY(${buttonY}px) scale(${buttonScale * buttonPulse})`,
              marginTop: 56,
            }}
          >
            <span
              style={{
                background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primary}dd 100%)`,
                color: '#ffffff',
                padding: '30px 88px',
                borderRadius: 999,
                fontSize: 44,
                fontWeight: 800,
                display: 'inline-block',
                boxShadow: `
                  0 32px 100px ${brand.primary}cc,
                  0 12px 30px ${brand.primary}80,
                  inset 0 1px 0 rgba(255,255,255,0.3)
                `,
                letterSpacing: 0.5,
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {prettyUrl(url)} →
            </span>
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname && u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}
