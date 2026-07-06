// AnimatedFootage — "video clip" feel by crossfading 2-3 screenshots with Ken Burns zoom + pan.
// Stand-in for actual AI-generated video footage (Veo). When Veo is wired in later, the same
// scene can render a single <Video> tag instead of stacked <Img>s.

import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, slideUp, easeInOutQuint, easeOutCubic } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard, AnimatedHeadline } from '../effects';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const AnimatedFootage: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { brand } = plan.meta;

  const clipUrls = (props.clipUrls as string[] | undefined)?.filter(Boolean) || [];
  const caption = props.caption || props.title || '';
  const headline = props.headline || '';

  const captionOpacity = fadeIn(frame, 18, 16, easeOutCubic);
  const captionY = slideUp(frame, 18, 22, 30);
  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  // No clips? Render a moody "coming soon" placeholder so we still have a scene
  const hasClips = clipUrls.length > 0;

  // If we have exactly one clip URL pointing at a real video file (.mp4/.webm), play it as
  // a <Video> — that's the path for Gemini Omni clips. Otherwise crossfade as screenshots.
  const isVideoClip = clipUrls.length === 1 && /\.(mp4|webm|mov)(\?|$)/i.test(clipUrls[0]);

  // Each clip gets equal slice of the scene
  const clipDuration = hasClips ? durationInFrames / clipUrls.length : durationInFrames;
  const crossfadeFrames = 22; // soft overlap between clips

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}11`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1200} x="50%" y="50%" opacity={0.30} blur={130} />
      <GlowOrb color={brand.primary} size={600}  x="20%" y="20%" opacity={0.20} blur={90} />
      <GlowOrb color={brand.primary} size={600}  x="80%" y="80%" opacity={0.20} blur={90} />

      {/* Footage stack — each clip fades in over the previous */}
      <AbsoluteFill style={{ opacity: exitOpacity, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1500,
            height: 800,
            borderRadius: 24,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: `0 60px 140px ${brand.primary}55, 0 30px 60px rgba(0,0,0,0.7)`,
            border: `1px solid rgba(255,255,255,0.08)`,
            background: '#0f0f12',
          }}
        >
          {isVideoClip ? (
            // Real video clip (e.g. Gemini Omni output) — play with OffthreadVideo for smooth render
            <OffthreadVideo
              src={clipUrls[0]}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              muted
            />
          ) : hasClips ? (
            clipUrls.map((url, i) => {
              const clipStart = i * clipDuration;
              const localFrame = frame - clipStart;

              // Opacity: fade in over crossfadeFrames at start, fade out over crossfadeFrames at end.
              // First clip starts fully visible (no fade-in), last clip ends without fade-out.
              const inOp = i === 0 ? 1 : interpolate(localFrame, [0, crossfadeFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOutQuint });
              const outOp = i === clipUrls.length - 1 ? 1 : interpolate(localFrame, [clipDuration - crossfadeFrames, clipDuration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeInOutQuint });
              const opacity = Math.min(inOp, outOp);

              // Ken Burns: each clip zooms 1.0 → 1.18 across its window, alternates pan direction
              const zoom = interpolate(localFrame, [0, clipDuration], [1.0, 1.18], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const panX = interpolate(localFrame, [0, clipDuration], [i % 2 === 0 ? -3 : 3, i % 2 === 0 ? 3 : -3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              const panY = interpolate(localFrame, [0, clipDuration], [-2, 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

              return (
                <Img
                  key={i}
                  src={url}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: `${50 + panX}% ${50 + panY}%`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    opacity,
                  }}
                />
              );
            })
          ) : (
            // No clips provided — animated gradient placeholder
            <AbsoluteFill style={{
              background: `linear-gradient(135deg, ${brand.primary}40 0%, ${brand.bg} 50%, ${brand.primary}20 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: brand.secondary,
              fontSize: 32,
              fontWeight: 600,
              opacity: 0.6,
            }}>
              <span>🎞 Footage</span>
            </AbsoluteFill>
          )}

          {/* Soft vignette to draw focus to center */}
          <AbsoluteFill style={{
            background: `radial-gradient(circle, transparent 50%, ${brand.bg}99 100%)`,
            pointerEvents: 'none',
          }} />
        </div>
      </AbsoluteFill>

      <ParticleField count={30} color="#ffffff" minSize={1.5} maxSize={4} speed={0.4} />
      <NoiseTexture opacity={0.04} />

      {/* Caption / headline overlay at top */}
      {caption && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: '50%',
            transform: `translateX(-50%) translateY(${captionY}px)`,
            opacity: captionOpacity * exitOpacity,
            zIndex: 10,
            textAlign: 'center',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <GlassCard tint={brand.primary} padding="18px 36px" radius={999}>
            <div style={{ color: brand.secondary, fontSize: 36, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2 }}>
              {caption}
            </div>
          </GlassCard>
        </div>
      )}

      {headline && (
        <div
          style={{
            position: 'absolute',
            bottom: 70,
            left: '50%',
            transform: 'translateX(-50%)',
            opacity: exitOpacity,
            zIndex: 10,
            textAlign: 'center',
          }}
        >
          <AnimatedHeadline
            text={headline}
            frame={frame}
            startAt={32}
            stagger={1.8}
            charDuration={10}
            charSlideDist={20}
            style={{
              color: brand.secondary,
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: -1,
              textShadow: `0 4px 30px ${brand.primary}90, 0 2px 8px rgba(0,0,0,0.8)`,
              maxWidth: 1200,
            }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};
