// PhoneMockup — phone center stage with the dark-moody Zomato-red look the user liked.
//   * front phone scales 1.0 → 1.08 → 1.0 (subtle, barely-perceptible camera drift)
//   * the screenshot inside the phone slowly pans top→bottom so full food image is seen
//   * floating glass bubbles stay sharp + readable, only their organic floatY drift
//   * NO back-phone reveal, NO outward parallax, NO bubble blur, NO dimming
// Everything else (GradientBG + GlowOrbs + DecorRings + ParticleField + NoiseTexture)
// is preserved exactly as the previous good version.

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import {
  fadeIn, fadeOut, springScale, popScale, floatY, charReveal, charSlideY,
  easeOutCubic, easeInOutQuint,
} from '../animations';
import { GlassCard, GlowOrb, ParticleField, NoiseTexture, DecorRing, GradientBG, AnimatedHeadline } from '../effects';
import { Icon } from '../icons';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

const DEFAULT_CARDS = [
  { label: 'FAST',     value: 'Instant',   icon: 'Zap' },
  { label: 'TRUSTED',  value: '4.9 ★',     icon: 'Star' },
  { label: 'GLOBAL',   value: 'Anywhere',  icon: 'Globe' },
  { label: 'SECURE',   value: 'Encrypted', icon: 'ShieldCheck' },
];

// Bubble positions (x, y offset from scene center)
const BUBBLE_POSITIONS = [
  { x: -560, y: -180 },  // top-left
  { x:  560, y: -120 },  // top-right
  { x: -540, y:  220 },  // bottom-left
  { x:  580, y:  260 },  // bottom-right
];

export const PhoneMockup: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const screenshotUrl = props.screenshotUrl as string | undefined;
  const caption = props.title || props.caption || props.headline || '';
  const rawCards = props.floatingCards as Array<{ label: string; value: string; icon?: string }> | undefined;
  const cards = (rawCards && rawCards.length > 0 ? rawCards : DEFAULT_CARDS).slice(0, 4);

  // ─── Subtle camera drift ───────────────────────────────────────────────
  // Gentle 1.0 → 1.08 → 1.0 ease-in-out over the whole scene. Barely perceptible.
  // No more aggressive dolly-in, no zoomIntensity-driven parallax/blur/dimming.
  const mid = durationInFrames / 2;
  const cameraZoom = frame < mid
    ? interpolate(frame, [0, mid], [1.0, 1.08], { easing: easeInOutQuint, extrapolateRight: 'clamp' })
    : interpolate(frame, [mid, durationInFrames], [1.08, 1.0], { easing: easeInOutQuint, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ─── Phone geometry ────────────────────────────────────────────────────
  const phoneW = 440;
  const phoneH = 900;
  const bezel = 14;
  const screenW = phoneW - bezel * 2;
  const screenH = phoneH - bezel * 2 - 32;

  // Phone entrance + ongoing float
  const phoneEntrance = springScale(frame, 6, fps);
  const phoneOpacity = fadeIn(frame, 6, 14);
  const phoneFloat = floatY(frame, fps, 8, 4.5, 0);

  // ─── Slow vertical pan inside the phone ────────────────────────────────
  // objectPosition Y goes from 0% (top) to 100% (bottom) over the scene.
  // Eased so the pan is slow at start/end, faster in the middle.
  const panProgress = interpolate(frame, [10, durationInFrames - 10], [0, 100], {
    easing: easeInOutQuint, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ─── Caption — character reveal ─────────────────────────────────────────
  const captionChars = Array.from(caption);

  // ─── Exit fade ─────────────────────────────────────────────────────────
  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}11`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1100} x="30%" y="35%" opacity={0.35} blur={120} />
      <GlowOrb color={brand.primary} size={800}  x="80%" y="80%" opacity={0.22} blur={100} />

      {/* Decorative rings around phone — static, no camera scaling */}
      <AbsoluteFill
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DecorRing size={1100} color={`${brand.primary}22`} spinSpeed={4} dashed />
        <DecorRing size={1400} color={`${brand.primary}15`} spinSpeed={-3} />
        <DecorRing size={1750} color={`${brand.primary}0c`} spinSpeed={2} dashed />
      </AbsoluteFill>

      <ParticleField count={50} color="#ffffff" minSize={2} maxSize={5} speed={0.6} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Caption — word-wrapped reveal, positioned above the phone with high z-index */}
        {caption && (
          <AnimatedHeadline
            text={caption}
            frame={frame}
            startAt={22}
            stagger={1.6}
            charDuration={10}
            charSlideDist={22}
            style={{
              position: 'absolute',
              top: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 38,
              fontWeight: 800,
              color: brand.secondary,
              letterSpacing: -1,
              textAlign: 'center',
              maxWidth: 1100,
              textShadow: `0 4px 30px ${brand.primary}90, 0 2px 8px rgba(0,0,0,0.8)`,
              zIndex: 10,
              padding: '4px 16px',
            }}
          />
        )}

        {/* ── Front phone (the hero) — subtle 1.08x camera drift ── */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${phoneFloat}px) scale(${phoneEntrance * cameraZoom})`,
            opacity: phoneOpacity,
            width: phoneW,
            height: phoneH,
            background: 'linear-gradient(135deg, #161618 0%, #0a0a0c 100%)',
            borderRadius: 56,
            border: '3px solid #26262b',
            boxShadow: `
              0 80px 160px ${brand.primary}50,
              0 40px 80px rgba(0,0,0,0.7),
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
            padding: bezel,
          }}
        >
          {/* Notch */}
          <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 140, height: 28, background: '#000', borderRadius: 14, zIndex: 3 }} />

          {/* Screen — slow vertical pan over the screenshot */}
          <div
            style={{
              width: screenW,
              height: screenH,
              marginTop: 32,
              borderRadius: 42,
              overflow: 'hidden',
              background: '#1a1a1a',
              position: 'relative',
            }}
          >
            {screenshotUrl ? (
              <Img
                src={screenshotUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: `center ${panProgress}%`,
                }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 24 }}>
                No screenshot
              </div>
            )}

            {/* Glass reflection */}
            <div
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '35%',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>

        {/* ── Floating bubble cards — sharp, always readable, only floatY drift ── */}
        {cards.map((card, i) => {
          const pos = BUBBLE_POSITIONS[i] || BUBBLE_POSITIONS[i % BUBBLE_POSITIONS.length];
          const appearAt = 40 + i * 8;
          const entrance = popScale(frame, appearAt, fps);
          const opacityIn = fadeIn(frame, appearAt, 12, easeOutCubic);
          const driftY = floatY(frame, fps, 14, 3.5 + i * 0.4, i * 0.9);
          const driftX = floatY(frame, fps, 8, 4.2 + i * 0.3, i * 1.1 + 1);

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: `
                  translate(
                    calc(-50% + ${pos.x + driftX}px),
                    calc(-50% + ${pos.y + driftY}px)
                  )
                  scale(${entrance})
                `,
                opacity: opacityIn,
              }}
            >
              <GlassCard width={240} tint={brand.primary} padding="22px 24px" radius={28}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primary}aa 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `0 6px 20px ${brand.primary}80`,
                    }}
                  >
                    <Icon name={card.icon} size={28} color="#fff" strokeWidth={2.4} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#ffffffaa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>
                      {card.label}
                    </div>
                    <div style={{ fontSize: 22, color: '#fff', fontWeight: 800, lineHeight: 1.1 }}>
                      {card.value}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
