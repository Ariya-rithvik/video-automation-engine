// ProductSelectAndCart — the "pick a product → add to cart → order placed" finale.
// Continues the purchase-journey storyline from PromptThenGrid.
//
// Storyboard (timings scale with durationInFrames; given values assume ~8s @ 30fps = 240f):
//   Phase 1 (0..35f):    4 result tiles visible in a row (like the end of PromptThenGrid).
//                        One product (the "hero") highlights with a glow.
//   Phase 2 (35..80f):   Hero product slides from its grid position to center + grows large.
//                        The other 3 tiles fade out and drift away.
//   Phase 3 (80..110f):  "Add to Cart" button materializes next to the hero product.
//   Phase 4 (110..145f): Cursor enters from the right, lands on the Add to Cart button.
//                        Double click ripple. Button highlights orange.
//   Phase 5 (145..175f): "✓ Added to Cart" toast pops up. Brief hold.
//   Phase 6 (175..210f): Card slides up, "Place Order" button appears + cursor clicks.
//   Phase 7 (210..end):  Big "✓ Order placed!" with sparkles. Cursor fades.
//
// Props:
//   selectedImage   — URL of the product to feature as the hero (the one that gets added to cart)
//   otherImages     — URLs of the 3 other result tiles shown initially
//   caption         — overall scene caption ("Get it in one click")
//   productLabel    — what to call the product ("Nike Air Max", "Wireless Earbuds")
//   ctaLabel        — primary CTA text ("Add to Cart" for ecom, "Order Now" for food, etc.)
//   confirmLabel    — confirmation toast ("✓ Added to Cart", "✓ Order placed")

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, popScale, springScale, easeOutCubic, easeInOutQuint } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';
import { CheckCircle2, MousePointer2, Sparkles } from 'lucide-react';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const ProductSelectAndCart: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;
  const theme = themeFor(plan);

  const selectedImage = props.selectedImage as string | undefined;
  const rawOthers = (props.otherImages as string[] | undefined) || [];
  const otherImages = rawOthers.slice(0, 3);
  const caption = props.caption || props.title || 'One click away';
  const productLabel = props.productLabel || 'This product';
  const ctaLabel = props.ctaLabel || 'Add to Cart';
  const confirmLabel = props.confirmLabel || '✓ Added to Cart';
  const finaleLabel = props.finaleLabel || '✓ Order placed!';

  // ─── Timeline (frame markers, scale with duration) ──────────────────────
  const total = durationInFrames;
  const ratio = total / 240; // baseline 8s
  const ZOOM_HERO_START = Math.round(35 * ratio);
  const ZOOM_HERO_END = Math.round(80 * ratio);
  const CTA_APPEAR = Math.round(95 * ratio);
  const CURSOR_ENTER = Math.round(110 * ratio);
  const CURSOR_LAND = Math.round(135 * ratio);
  const TOAST_APPEAR = Math.round(150 * ratio);
  const TOAST_HOLD_END = Math.round(180 * ratio);
  const FINALE_START = Math.round(200 * ratio);

  // ─── Hero product zoom/slide ────────────────────────────────────────────
  const heroProgress = interpolate(frame, [ZOOM_HERO_START, ZOOM_HERO_END], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOutQuint,
  });
  // Hero tile: starts at first grid position (left), ends at center, grows
  // Grid positions assumed: 4 tiles in a row, each ~330x220, centered horizontally with 16px gap
  // Each tile is at x = center + (i - 1.5) * 346 = center + (-519, -173, +173, +519)
  // We pick index 0 (leftmost) as the hero
  const HERO_START_X = -519;
  const HERO_END_X = 0;
  const HERO_START_Y = 0;
  const HERO_END_Y = 0;
  const heroX = HERO_START_X + (HERO_END_X - HERO_START_X) * heroProgress;
  const heroY = HERO_START_Y + (HERO_END_Y - HERO_START_Y) * heroProgress;
  const heroScale = 1.0 + 1.8 * heroProgress; // 1.0 → 2.8x size

  // Other tiles fade out + drift away
  const othersOpacity = interpolate(frame, [ZOOM_HERO_START, ZOOM_HERO_START + 18], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
  });
  const othersDrift = interpolate(frame, [ZOOM_HERO_START, ZOOM_HERO_END], [0, 40], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
  });

  // ─── "Add to Cart" button — appears next to hero after zoom ─────────────
  const ctaOpacity = fadeIn(frame, CTA_APPEAR, 12, easeOutCubic);
  const ctaScale = springScale(frame, CTA_APPEAR, fps);
  const ctaClickPulse = (frame >= CURSOR_LAND && frame < CURSOR_LAND + 18)
    ? 1 + Math.sin((frame - CURSOR_LAND) * 0.4) * 0.06 : 1;
  // CTA fades out when toast appears
  const ctaFadeOut = interpolate(frame, [TOAST_APPEAR, TOAST_APPEAR + 14], [1, 0.3], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ─── Cursor — enters from right, lands on CTA, clicks ───────────────────
  const cursorStartX = 1920;
  const cursorStartY = 800;
  const cursorEndX = 1190; // near CTA button (right of hero, center vertical)
  const cursorEndY = 580;
  const cursorProgress = interpolate(frame, [CURSOR_ENTER, CURSOR_LAND], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
  });
  const cursorX = cursorStartX + (cursorEndX - cursorStartX) * cursorProgress;
  const cursorY = cursorStartY + (cursorEndY - cursorStartY) * cursorProgress;
  // Cursor visible during phases 4-6, fades during finale
  const cursorOpacity = interpolate(
    frame,
    [CURSOR_ENTER - 4, CURSOR_ENTER + 6, FINALE_START - 10, FINALE_START],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── Click ripple ───────────────────────────────────────────────────────
  const ripple = interpolate(frame, [CURSOR_LAND, CURSOR_LAND + 28], [0, 220], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const rippleOpacity = interpolate(frame, [CURSOR_LAND, CURSOR_LAND + 28], [0.85, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ─── "Added to Cart" toast ──────────────────────────────────────────────
  const toastScale = popScale(frame, TOAST_APPEAR, fps);
  const toastOpacity = interpolate(frame, [TOAST_APPEAR, TOAST_APPEAR + 12, FINALE_START - 6, FINALE_START + 6],
    [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ─── Finale: "Order placed!" with sparkles ──────────────────────────────
  const finaleScale = springScale(frame, FINALE_START, fps);
  const finaleOpacity = fadeIn(frame, FINALE_START, 14, easeOutCubic);

  // ─── Exit fade ──────────────────────────────────────────────────────────
  const exitOpacity = fadeOut(frame, durationInFrames, 14);

  const TILE_W = 330;
  const TILE_H = 220;

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      <GlowOrb color={brand.primary} size={1200} x="50%" y="50%" opacity={theme.glowOpacity} blur={150} />
      <NoiseTexture opacity={theme.noiseOpacity} />

      <AbsoluteFill style={{ opacity: exitOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Caption */}
        <AnimatedHeadline
          text={caption}
          frame={frame}
          startAt={2}
          stagger={1.5}
          charDuration={10}
          charSlideDist={22}
          style={{
            position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
            fontSize: 50, fontWeight: 800, color: theme.text, letterSpacing: -1.5,
            textAlign: 'center', maxWidth: 1500,
            zIndex: 30,
          }}
        />

        {/* Scene area centered vertically below caption */}
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

          {/* Other 3 tiles — visible early, fade out */}
          {othersOpacity > 0.01 && otherImages.map((url, i) => {
            const xOffset = [-173, 173, 519][i] || 0; // positions 2, 3, 4 (skipping hero index 0)
            const drift = (i - 1) * 30 + othersDrift;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%', top: '50%',
                  transform: `translate(calc(-50% + ${xOffset + drift}px), -50%)`,
                  width: TILE_W, height: TILE_H,
                  borderRadius: 16,
                  overflow: 'hidden',
                  background: '#fff',
                  border: `2px solid ${brand.primary}40`,
                  boxShadow: `0 16px 50px ${brand.primary}40`,
                  opacity: othersOpacity,
                }}
              >
                <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
              </div>
            );
          })}

          {/* Hero product tile — zooms from left to center */}
          {selectedImage && (
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: `translate(calc(-50% + ${heroX}px), calc(-50% + ${heroY}px)) scale(${heroScale})`,
              width: TILE_W, height: TILE_H,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#fff',
              border: `3px solid ${brand.primary}`,
              boxShadow: `0 24px 80px ${brand.primary}80, 0 12px 24px rgba(0,0,0,0.5)`,
              zIndex: 5,
            }}>
              <Img src={selectedImage} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
            </div>
          )}

          {/* "Add to Cart" button — appears next to hero (right side).
              Use maxWidth + nowrap to ensure long labels don't overflow the frame. */}
          {ctaOpacity > 0.01 && (
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: `translate(calc(-50% + 480px), calc(-50% + 0px)) scale(${ctaScale * ctaClickPulse})`,
              opacity: ctaOpacity * ctaFadeOut,
              background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primary}cc 100%)`,
              color: '#fff',
              padding: '24px 48px',
              borderRadius: 14,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: 0.5,
              boxShadow: `0 12px 36px ${brand.primary}aa, 0 4px 12px rgba(0,0,0,0.4)`,
              border: '1px solid rgba(255,255,255,0.2)',
              zIndex: 10,
              maxWidth: 360,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {ctaLabel}
            </div>
          )}

          {/* Click ripple */}
          {rippleOpacity > 0 && (
            <div style={{
              position: 'absolute',
              left: cursorEndX, top: cursorEndY,
              width: ripple, height: ripple,
              marginLeft: -ripple / 2, marginTop: -ripple / 2,
              borderRadius: '50%',
              border: `3px solid ${brand.primary}`,
              opacity: rippleOpacity,
              pointerEvents: 'none',
              zIndex: 15,
            }} />
          )}

          {/* "Added to Cart" toast — bounded width to keep on-screen */}
          {toastOpacity > 0.01 && (
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: `translate(calc(-50% + 480px), calc(-50% + 100px)) scale(${toastScale})`,
              opacity: toastOpacity,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '18px 30px',
              borderRadius: 999,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 0.5,
              display: 'flex', alignItems: 'center', gap: 10,
              boxShadow: '0 12px 36px rgba(16, 185, 129, 0.6), 0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 20,
              maxWidth: 380,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              <CheckCircle2 size={28} strokeWidth={3} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{confirmLabel}</span>
            </div>
          )}

          {/* Finale: big "Order placed!" overlay */}
          {finaleOpacity > 0.01 && (
            <div style={{
              position: 'absolute',
              left: '50%', top: '50%',
              transform: `translate(-50%, -50%) scale(${finaleScale})`,
              opacity: finaleOpacity,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
              zIndex: 25,
            }}>
              <div style={{
                width: 160, height: 160,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 24px 80px rgba(16, 185, 129, 0.8), 0 0 80px rgba(16, 185, 129, 0.5)',
              }}>
                <CheckCircle2 size={100} color="#fff" strokeWidth={3} />
              </div>
              <div style={{
                fontSize: 72, fontWeight: 900, color: theme.text, letterSpacing: -2,
                maxWidth: 1500, textAlign: 'center', padding: '0 60px',
                overflowWrap: 'anywhere',
              }}>
                {finaleLabel}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sparkles
                    key={i}
                    size={32}
                    color={brand.primary}
                    strokeWidth={2.5}
                    style={{
                      transform: `translateY(${Math.sin((frame - FINALE_START + i * 4) * 0.3) * 10}px)`,
                      filter: `drop-shadow(0 0 8px ${brand.primary})`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cursor */}
          <div style={{
            position: 'absolute',
            left: cursorX, top: cursorY,
            opacity: cursorOpacity,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))',
            pointerEvents: 'none',
            zIndex: 30,
          }}>
            <MousePointer2 size={48} color="#fff" strokeWidth={2.4} fill="#000" />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
