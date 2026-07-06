// PromptThenGrid — REAL product-demo flow:
//   Phase 1 (0..15f):    Wide shot. Caption visible. Cursor enters from off-screen right.
//   Phase 2 (15..40f):   Camera ZOOMS IN on the search bar (scale 1.0 → 1.35, focused on top).
//   Phase 3 (40..55f):   Cursor lands on search bar. Click ripple. Bar visually focuses.
//   Phase 4 (55..130f):  Typewriter types query INSIDE the bar (zoomed view, readable).
//   Phase 5 (130..160f): Camera PULLS BACK (scale 1.35 → 1.0). Cursor fades. Search bar dims.
//   Phase 6 (160..end):  4 result tiles cascade in below with stagger + spring.
//
// Mirrors the CursorClickReveal cursor styling so it feels like the same pipeline.

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, popScale, easeOutCubic, easeInOutQuint } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, AnimatedHeadline } from '../effects';
import { themeFor } from '../theme';
import { Sparkles, Search, MousePointer2 } from 'lucide-react';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const PromptThenGrid: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;
  const theme = themeFor(plan);

  const caption = props.caption || props.title || 'Search anything';
  const promptText = props.promptText || 'wireless earbuds';
  const resultImages = (props.resultImages as string[] | undefined) || [];

  // ─── Timing (frame markers) — slower, more like real product-demo cadence ──
  const total = durationInFrames;
  const ZOOM_IN_END = Math.min(36, Math.round(total * 0.16));
  const CURSOR_LAND_BAR = ZOOM_IN_END + 8;
  const TYPE_START = CURSOR_LAND_BAR + 6;
  // ~10 frames per character (per reference video) — slow, deliberate typing
  const TYPE_DURATION = Math.min(110, Math.max(50, promptText.length * 10));
  const TYPE_END = TYPE_START + TYPE_DURATION;
  const HOLD_TYPED = TYPE_END + 14;
  // Second click — cursor slides to the Search button on the right
  const CURSOR_TO_BTN_START = HOLD_TYPED;
  const CURSOR_LAND_BTN = CURSOR_TO_BTN_START + 18;
  const ZOOM_OUT_END = CURSOR_LAND_BTN + 24;
  const GRID_START = ZOOM_OUT_END - 8;
  const GRID_STAGGER = 10;

  // ─── Camera zoom on the search bar (scale 1.0 → 1.35 → 1.0) ─────────────
  // origin: top-center (where the search bar lives)
  let cameraZoom = 1.0;
  if (frame < ZOOM_IN_END) {
    cameraZoom = interpolate(frame, [4, ZOOM_IN_END], [1.0, 1.35], {
      easing: easeInOutQuint, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
  } else if (frame < CURSOR_LAND_BTN) {
    cameraZoom = 1.35;
  } else {
    cameraZoom = interpolate(frame, [CURSOR_LAND_BTN, ZOOM_OUT_END], [1.35, 1.0], {
      easing: easeInOutQuint, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
  }
  // Zoom intensity 0..1 — used to keep search bar centered when zoomed
  const zoomIntensity = (cameraZoom - 1.0) / 0.35;

  // ─── Search bar position (fixed in the layout — camera moves around it) ─
  // Bar is at the top of the frame so when we zoom in (origin top-center), it stays in view
  const SEARCH_BAR_Y = 290;            // y position
  const SEARCH_BAR_W = 1200;
  const SEARCH_BAR_H = 96;
  const SEARCH_BAR_RIGHT = (1920 + SEARCH_BAR_W) / 2;  // right edge of the bar

  // ─── Cursor animation — TWO clicks: search bar, then search button ──────
  // Reference video: cursor moves in a CURVED ARC (lifts up then settles), not straight line.
  // Click 1: search bar (input area). Click 2: search button (right side).
  const cursorEnterAt = 4;
  const cursorStartX = 2000;
  const cursorStartY = 850;

  // Click 1 target: inside the search input, ~center-left of the bar
  const click1X = (1920 - SEARCH_BAR_W) / 2 + 220;
  const click1Y = SEARCH_BAR_Y + SEARCH_BAR_H / 2 + 14;

  // Click 2 target: the "Search" button on the right end of the bar
  const click2X = SEARCH_BAR_RIGHT - 90;
  const click2Y = SEARCH_BAR_Y + SEARCH_BAR_H / 2 + 14;

  // Phase A: cursor enters → arcs to search bar
  // Phase B: cursor slides → search button (shorter arc)
  let cursorX = cursorStartX, cursorY = cursorStartY;
  if (frame < CURSOR_LAND_BAR) {
    const p = interpolate(frame, [cursorEnterAt, CURSOR_LAND_BAR], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
    });
    // Arc: Y lifts up by 80px at midpoint (sine bow)
    const arcLift = Math.sin(p * Math.PI) * -90;
    cursorX = cursorStartX + (click1X - cursorStartX) * p;
    cursorY = cursorStartY + (click1Y - cursorStartY) * p + arcLift;
  } else if (frame < CURSOR_TO_BTN_START) {
    // Sit at click1 during typing
    cursorX = click1X;
    cursorY = click1Y;
  } else if (frame < CURSOR_LAND_BTN) {
    const p = interpolate(frame, [CURSOR_TO_BTN_START, CURSOR_LAND_BTN], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeOutCubic,
    });
    // Smaller arc lift for the shorter horizontal trip
    const arcLift = Math.sin(p * Math.PI) * -30;
    cursorX = click1X + (click2X - click1X) * p;
    cursorY = click1Y + (click2Y - click1Y) * p + arcLift;
  } else {
    cursorX = click2X;
    cursorY = click2Y;
  }

  const cursorOpacity = interpolate(
    frame,
    [cursorEnterAt - 4, cursorEnterAt + 4, CURSOR_LAND_BTN + 14, CURSOR_LAND_BTN + 28],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── Click ripples — two click moments, brand-color (auto-yellow for Amazon) ──
  // Click 1 ripple on search bar
  const ripple1A = interpolate(frame, [CURSOR_LAND_BAR, CURSOR_LAND_BAR + 28], [0, 220], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const ripple1AOpacity = interpolate(frame, [CURSOR_LAND_BAR, CURSOR_LAND_BAR + 28], [0.85, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  // Click 2 ripple on search button — bigger, more dramatic (per reference)
  const ripple2A = interpolate(frame, [CURSOR_LAND_BTN, CURSOR_LAND_BTN + 32], [0, 320], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const ripple2AOpacity = interpolate(frame, [CURSOR_LAND_BTN, CURSOR_LAND_BTN + 32], [0.95, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ─── Blue focus ring on input click — Amazon-style "you're typing here" feedback ──
  const focusRingOpacity = interpolate(
    frame,
    [CURSOR_LAND_BAR, CURSOR_LAND_BAR + 6, HOLD_TYPED, HOLD_TYPED + 8],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── Typing inside the bar ──────────────────────────────────────────────
  const charsRevealed = Math.max(0, Math.min(
    promptText.length,
    Math.floor(interpolate(frame, [TYPE_START, TYPE_END], [0, promptText.length], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    })),
  ));
  const typedText = promptText.slice(0, charsRevealed);
  const cursorBlink = Math.floor((frame / fps) * 2) % 2 === 0;
  const showCaretAfterText = frame >= TYPE_START && frame < HOLD_TYPED;

  // ─── Search bar focus state ──────────────────────────────────────────────
  // Bar "lights up" when cursor lands; dims as camera pulls back
  const barFocus = interpolate(frame, [CURSOR_LAND_BAR - 4, CURSOR_LAND_BAR + 6, CURSOR_LAND_BTN, ZOOM_OUT_END],
    [0, 1, 1, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ─── Caption fades during zoom-in, returns when camera pulls back ───────
  const captionOpacity = interpolate(
    frame,
    [2, 16, ZOOM_IN_END, ZOOM_OUT_END - 8, ZOOM_OUT_END],
    [0, 1, 0.15, 0.15, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // ─── Result grid (appears after camera pulls back) ──────────────────────
  // Tiles cascade in with spring + stagger
  const gridOpacity = fadeIn(frame, GRID_START, 14, easeOutCubic);

  // ─── Exit fade ──────────────────────────────────────────────────────────
  const exitOpacity = fadeOut(frame, durationInFrames, 14);

  return (
    <AbsoluteFill style={{ background: theme.bg, overflow: 'hidden' }}>
      <GlowOrb color={brand.primary} size={1100} x="50%" y="40%" opacity={theme.glowOpacity} blur={140} />
      <NoiseTexture opacity={theme.noiseOpacity} />

      <AbsoluteFill style={{ opacity: exitOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* Caption — dims during zoom so it doesn't distract */}
        <AnimatedHeadline
          text={caption}
          frame={frame}
          startAt={2}
          stagger={1.5}
          charDuration={10}
          charSlideDist={22}
          style={{
            position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
            fontSize: 50, fontWeight: 800, color: theme.text, letterSpacing: -1.5,
            textAlign: 'center', maxWidth: 1400,
            zIndex: 30,
            opacity: captionOpacity,
          }}
        />

        {/* CAMERA-ZOOMED LAYER — search bar + cursor sit inside this */}
        <div
          style={{
            position: 'absolute', inset: 0,
            transform: `scale(${cameraZoom}) translateY(${zoomIntensity * 60}px)`,
            transformOrigin: '50% 30%',
          }}
        >
          {/* Search bar — fixed at top, "focused" when bar lights up */}
          <div
            style={{
              position: 'absolute',
              top: SEARCH_BAR_Y,
              left: '50%',
              transform: `translateX(-50%) scale(${1 + barFocus * 0.02})`,
              width: SEARCH_BAR_W,
              height: SEARCH_BAR_H,
              background: 'linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%)',
              border: `3px solid ${brand.primary}${Math.round(60 + barFocus * 195).toString(16).padStart(2, '0')}`,
              borderRadius: 16,
              boxShadow: `
                0 ${10 + barFocus * 30}px ${30 + barFocus * 50}px ${brand.primary}${Math.round(barFocus * 200).toString(16).padStart(2, '0')},
                0 8px 24px rgba(0,0,0,0.3)
              `,
              display: 'flex',
              alignItems: 'center',
              padding: '0 22px',
              gap: 18,
              transition: 'none',
            }}
          >
            <Search size={36} color="#666" strokeWidth={2.5} />
            <div style={{
              flex: 1,
              color: '#111',
              fontSize: 36,
              fontWeight: 500,
              letterSpacing: -0.5,
              lineHeight: 1,
            }}>
              {typedText}
              {showCaretAfterText && cursorBlink && (
                <span style={{ color: brand.primary, marginLeft: 2, fontWeight: 300 }}>|</span>
              )}
            </div>
            <div style={{
              background: brand.primary,
              color: '#fff',
              padding: '12px 28px',
              borderRadius: 10,
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: 0.5,
              boxShadow: `0 4px 12px ${brand.primary}88`,
            }}>
              Search
            </div>
          </div>

          {/* Click 1 ripple — emits from search bar click point */}
          {ripple1AOpacity > 0 && (
            <div style={{
              position: 'absolute',
              left: click1X, top: click1Y,
              width: ripple1A, height: ripple1A,
              marginLeft: -ripple1A / 2, marginTop: -ripple1A / 2,
              borderRadius: '50%',
              border: `3px solid ${brand.primary}`,
              opacity: ripple1AOpacity,
              pointerEvents: 'none',
            }} />
          )}

          {/* Click 2 ripple — bigger, from search button click */}
          {ripple2AOpacity > 0 && (
            <div style={{
              position: 'absolute',
              left: click2X, top: click2Y,
              width: ripple2A, height: ripple2A,
              marginLeft: -ripple2A / 2, marginTop: -ripple2A / 2,
              borderRadius: '50%',
              border: `4px solid ${brand.primary}`,
              opacity: ripple2AOpacity,
              pointerEvents: 'none',
              boxShadow: `0 0 40px ${brand.primary}`,
            }} />
          )}

          {/* Blue focus ring — appears when cursor clicks the search input (Amazon-style) */}
          {focusRingOpacity > 0 && (
            <div style={{
              position: 'absolute',
              top: SEARCH_BAR_Y - 6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: SEARCH_BAR_W + 12,
              height: SEARCH_BAR_H + 12,
              borderRadius: 22,
              border: '4px solid #007185',  // Amazon's signature focus blue
              opacity: focusRingOpacity,
              pointerEvents: 'none',
              boxShadow: '0 0 24px rgba(0, 113, 133, 0.5)',
            }} />
          )}

          {/* Cursor — same styling as CursorClickReveal */}
          <div style={{
            position: 'absolute',
            left: cursorX,
            top: cursorY,
            opacity: cursorOpacity,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))',
            pointerEvents: 'none',
            zIndex: 25,
          }}>
            <MousePointer2 size={48} color="#fff" strokeWidth={2.4} fill="#000" />
          </div>
        </div>

        {/* RESULT GRID — appears after camera pulls back, below the search bar */}
        <div
          style={{
            position: 'absolute',
            top: 480,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 1300,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 22,
            opacity: gridOpacity,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => {
            const startAt = GRID_START + i * GRID_STAGGER;
            const scale = popScale(frame, startAt, fps);
            const opacity = fadeIn(frame, startAt, 12, easeOutCubic);
            const url = resultImages[i % Math.max(1, resultImages.length)];
            return (
              <div key={i} style={{
                opacity, transform: `scale(${scale})`,
                aspectRatio: '16/11',
                borderRadius: 16,
                overflow: 'hidden',
                background: '#fff',
                border: `2px solid ${brand.primary}40`,
                boxShadow: `0 16px 50px ${brand.primary}50, 0 6px 16px rgba(0,0,0,0.4)`,
                position: 'relative',
              }}>
                {url ? (
                  <Img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#aaa', fontSize: 22, fontWeight: 700,
                  }}>Result {i + 1}</div>
                )}
                {/* Sparkle badge */}
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  background: brand.primary, padding: '6px 12px', borderRadius: 999,
                  fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 1,
                  display: 'flex', alignItems: 'center', gap: 4,
                  boxShadow: `0 4px 12px ${brand.primary}80`,
                }}>
                  <Sparkles size={12} strokeWidth={3} />
                  LIVE
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
