// CursorClickReveal — animated cursor pointer flies in, hovers on a UI element on the screenshot,
// clicks (ripple effect), then a "result" badge/highlight reveals. Adobe-Express-Panel-2 style.
//
// Props:
//   screenshotUrl — the UI to interact with (full-bleed)
//   clickX, clickY — coords as % of frame (50, 80 = center-bottom). Default 50/72.
//   actionLabel  — what the cursor "does" (e.g. "Remove background"). Shows as tooltip near cursor.
//   resultLabel  — confirmation toast after click (e.g. "✓ Background removed"). Optional.
//   caption      — top-of-frame caption explaining the action
//   resultUrl    — optional second image that wipes in after the click (if you have a real "after" frame)

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import {
  fadeIn, fadeOut, popScale, easeOutCubic, easeOutBack, easeInOutQuint,
} from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';
import { MousePointer2, CheckCircle2 } from 'lucide-react';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const CursorClickReveal: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const { brand } = plan.meta;
  const theme = themeFor(plan);

  const screenshotUrl = props.screenshotUrl as string | undefined;
  const resultUrl = props.resultUrl as string | undefined;
  const caption = props.caption || props.title || 'Click to transform';
  const actionLabel = props.actionLabel || 'Remove background';
  const resultLabel = props.resultLabel || '✓ Done';

  // Click target as % of frame
  const targetX = typeof props.clickX === 'number' ? props.clickX : 50;
  const targetY = typeof props.clickY === 'number' ? props.clickY : 72;
  const targetPx = { x: (targetX / 100) * width, y: (targetY / 100) * height };

  // ─── Timing milestones ──────────────────────────────────────────────────
  const CURSOR_ENTER_AT = 10;
  const CURSOR_ARRIVE_AT = 55;     // cursor lands on the target
  const CLICK_AT = 65;             // ripple + result starts
  const RESULT_AT = 85;            // result badge / wipe appears
  const EXIT_AT = durationInFrames - 14;

  // ─── Cursor path: from top-right off-screen → eased into target ─────────
  const startX = width + 100;
  const startY = -100;
  const cursorProgress = interpolate(frame, [CURSOR_ENTER_AT, CURSOR_ARRIVE_AT], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOutQuint,
  });
  const cursorX = startX + (targetPx.x - startX) * cursorProgress;
  const cursorY = startY + (targetPx.y - startY) * cursorProgress;

  // Cursor jiggle when it arrives (settling)
  const cursorPulse = frame > CURSOR_ARRIVE_AT
    ? 1 + Math.sin((frame - CURSOR_ARRIVE_AT) * 0.4) * 0.04 * Math.max(0, 1 - (frame - CURSOR_ARRIVE_AT) / 15)
    : 1;

  // ─── Click ripple ────────────────────────────────────────────────────────
  const rippleProgress = interpolate(frame, [CLICK_AT, CLICK_AT + 22], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
  });
  const rippleSize = 220 * rippleProgress;
  const rippleOpacity = 1 - rippleProgress;

  // Brief target highlight pulse
  const targetGlow = interpolate(frame, [CLICK_AT, CLICK_AT + 12, CLICK_AT + 28], [0, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ─── Tooltip near cursor (showing the action label) ─────────────────────
  const tooltipOpacity = fadeIn(frame, CURSOR_ARRIVE_AT - 5, 8, easeOutCubic) * (1 - fadeIn(frame, CLICK_AT + 5, 8, easeOutCubic));

  // ─── Result reveal — wipe or badge ──────────────────────────────────────
  const resultOpacity = fadeIn(frame, RESULT_AT, 16, easeOutCubic);
  const resultScale = popScale(frame, RESULT_AT, fps);
  // Optional wipe overlay if resultUrl provided
  const wipeProgress = interpolate(frame, [CLICK_AT + 6, CLICK_AT + 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
  });

  // ─── Caption + exit ─────────────────────────────────────────────────────
  const exitOpacity = fadeOut(frame, EXIT_AT + 14, 14);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      <GlowOrb color={brand.primary} size={1100} x="50%" y="50%" opacity={theme.glowOpacity} blur={140} />
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
            charSlideDist={20}
            style={{
              position: 'absolute',
              top: 50,
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 40,
              fontWeight: 800,
              color: theme.text,
              letterSpacing: -1,
              textAlign: 'center',
              maxWidth: 1200,
              zIndex: 20,
            }}
          />
        )}

        {/* Screenshot framed in a browser-window-style mat */}
        {screenshotUrl && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 1480,
              height: 760,
              borderRadius: 18,
              overflow: 'hidden',
              background: theme.surface,
              border: `1px solid ${theme.surfaceBorder}`,
              boxShadow: theme.cardShadowStrong,
            }}
          >
            {/* Browser title bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 40, zIndex: 2,
              background: 'linear-gradient(180deg, #1e1e21 0%, #161618 100%)',
              display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ width: 11, height: 11, borderRadius: 6, background: '#ff5f57' }} />
              <div style={{ width: 11, height: 11, borderRadius: 6, background: '#febc2e' }} />
              <div style={{ width: 11, height: 11, borderRadius: 6, background: '#28c840' }} />
            </div>
            {/* Screen */}
            <div style={{ position: 'absolute', top: 40, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
              <Img src={screenshotUrl}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
              {/* After-image wipes in from a clip-path */}
              {resultUrl && (
                <div style={{
                  position: 'absolute', inset: 0,
                  clipPath: `polygon(0 0, ${wipeProgress * 100}% 0, ${wipeProgress * 100}% 100%, 0 100%)`,
                }}>
                  <Img src={resultUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                </div>
              )}

              {/* Click-target glow flash */}
              <div style={{
                position: 'absolute',
                left: `${targetX}%`,
                top: `calc(${targetY}% - 40px)`,
                transform: 'translate(-50%, -50%)',
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${brand.primary}cc 0%, transparent 70%)`,
                opacity: targetGlow * 0.7,
                pointerEvents: 'none',
              }} />
            </div>
          </div>
        )}

        {/* Click ripple */}
        <div style={{
          position: 'absolute',
          left: targetPx.x,
          top: targetPx.y,
          width: rippleSize,
          height: rippleSize,
          marginLeft: -rippleSize / 2,
          marginTop: -rippleSize / 2,
          borderRadius: '50%',
          border: `3px solid ${brand.primary}`,
          opacity: rippleOpacity,
          pointerEvents: 'none',
        }} />

        {/* Tooltip floating near cursor */}
        <div style={{
          position: 'absolute',
          left: cursorX + 28,
          top: cursorY + 28,
          opacity: tooltipOpacity,
          background: '#fff',
          color: '#111',
          padding: '10px 16px',
          borderRadius: 10,
          fontSize: 18,
          fontWeight: 700,
          boxShadow: `0 8px 24px rgba(0,0,0,0.4)`,
          pointerEvents: 'none',
        }}>
          {actionLabel}
        </div>

        {/* Cursor on top */}
        <div style={{
          position: 'absolute',
          left: cursorX,
          top: cursorY,
          transform: `scale(${cursorPulse})`,
          transformOrigin: 'top left',
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.6))',
          pointerEvents: 'none',
        }}>
          <MousePointer2 size={48} color="#fff" strokeWidth={2.4} fill="#000" />
        </div>

        {/* Result toast — bottom-center */}
        <div style={{
          position: 'absolute',
          left: '50%',
          bottom: 80,
          transform: `translateX(-50%) scale(${resultScale})`,
          opacity: resultOpacity,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primary}cc 100%)`,
            color: '#fff',
            padding: '16px 32px',
            borderRadius: 999,
            fontSize: 26,
            fontWeight: 700,
            boxShadow: `0 16px 50px ${brand.primary}aa`,
          }}>
            <CheckCircle2 size={28} color="#fff" />
            {resultLabel}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
