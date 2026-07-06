// TemplateCollage — multiple screenshot/template thumbnails arranged in a parallax-drifting
// grid. Adobe-Express-Panel-4 style — "look at the variety of content you can make."

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, popScale, floatY, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

// Hand-designed tile positions for visual rhythm (6 tiles, varying sizes, asymmetric)
const TILE_LAYOUT = [
  { x: 200,  y: 240, w: 380, h: 280, depth: 0.0 },
  { x: 620,  y: 180, w: 420, h: 320, depth: 0.1 },
  { x: 1080, y: 250, w: 320, h: 240, depth: 0.0 },
  { x: 1440, y: 200, w: 360, h: 300, depth: 0.15 },
  { x: 240,  y: 560, w: 460, h: 320, depth: 0.05 },
  { x: 740,  y: 540, w: 360, h: 340, depth: 0.0 },
  { x: 1140, y: 530, w: 420, h: 330, depth: 0.1 },
  { x: 1480, y: 540, w: 320, h: 280, depth: 0.15 },
];

export const TemplateCollage: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;
  const theme = themeFor(plan);

  const caption = props.caption || props.title || 'Endless variations';
  const rawImages = (props.images as string[] | undefined) || (props.resultImages as string[] | undefined) || [];

  // Use up to 8 images, cycling if fewer provided
  const tiles = TILE_LAYOUT.map((slot, i) => ({
    ...slot,
    url: rawImages[i % Math.max(1, rawImages.length)],
  })).slice(0, Math.max(6, Math.min(8, rawImages.length || 6)));

  const exitOpacity = fadeOut(frame, durationInFrames, 14);

  // Global drift — whole collage moves slowly left to right over the scene
  const globalDrift = interpolate(frame, [0, durationInFrames], [-30, 30]);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      <GlowOrb color={brand.primary} size={1300} x="50%" y="50%" opacity={theme.glowOpacity} blur={160} />
      <NoiseTexture opacity={theme.noiseOpacity} />

      <AbsoluteFill style={{ opacity: exitOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Caption */}
        {caption && (
          <AnimatedHeadline
            text={caption}
            frame={frame}
            startAt={2}
            stagger={1.5}
            charDuration={10}
            charSlideDist={22}
            style={{
              position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
              fontSize: 46, fontWeight: 800, color: theme.text, letterSpacing: -1.2,
              textAlign: 'center', maxWidth: 1300, zIndex: 30,
            }}
          />
        )}

        {/* Tiles */}
        {tiles.map((tile, i) => {
          const startAt = 18 + i * 6;
          const scale = popScale(frame, startAt, fps);
          const opacity = fadeIn(frame, startAt, 14, easeOutCubic);

          // Parallax: deeper tiles drift opposite + slower
          const parallaxX = globalDrift * (1 - tile.depth);
          const floatYOffset = floatY(frame, fps, 8 - tile.depth * 4, 4.5 + tile.depth * 2, i * 0.8);

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: tile.x,
                top: tile.y,
                width: tile.w,
                height: tile.h,
                opacity,
                transform: `scale(${scale}) translate(${parallaxX}px, ${floatYOffset}px)`,
                filter: tile.depth > 0 ? `blur(${tile.depth * 4}px) brightness(${1 - tile.depth * 0.2})` : 'none',
                borderRadius: 18,
                overflow: 'hidden',
                background: theme.surface,
                border: `1px solid ${theme.surfaceBorder}`,
                boxShadow: tile.depth > 0.05 ? theme.cardShadow : theme.cardShadowStrong,
              }}
            >
              {tile.url ? (
                <Img src={tile.url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#444', fontSize: 24, fontWeight: 700,
                  background: `linear-gradient(135deg, ${brand.primary}40 0%, ${brand.primary}10 100%)`,
                }}>
                  Template {i + 1}
                </div>
              )}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
