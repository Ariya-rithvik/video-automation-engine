// BeforeAfterSlider — two screenshots with a draggable-looking divider that scrubs across
// the frame to reveal the "after" state. If only one image is provided, falls back to a
// hue-shifted version on the right side as the "after".

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, easeOutCubic, easeInOutQuint, springScale } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, AnimatedHeadline } from '../effects';
import { ArrowLeftRight } from 'lucide-react';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export const BeforeAfterSlider: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const beforeUrl = (props.beforeUrl || props.screenshotUrl) as string | undefined;
  const afterUrl = (props.afterUrl || props.resultUrl || beforeUrl) as string | undefined;
  const caption = props.caption || props.title || 'Before / after';
  const beforeLabel = props.beforeLabel || 'BEFORE';
  const afterLabel = props.afterLabel || 'AFTER';

  // Slider scrubs 15% → 85% → 50% (settles at center)
  const SCRUB_START = 30;
  const SCRUB_TO_RIGHT_END = 95;
  const SCRUB_TO_CENTER_END = 130;

  let sliderPct = 15;
  if (frame < SCRUB_START) {
    sliderPct = 15;
  } else if (frame < SCRUB_TO_RIGHT_END) {
    sliderPct = interpolate(frame, [SCRUB_START, SCRUB_TO_RIGHT_END], [15, 85], { easing: easeInOutQuint });
  } else if (frame < SCRUB_TO_CENTER_END) {
    sliderPct = interpolate(frame, [SCRUB_TO_RIGHT_END, SCRUB_TO_CENTER_END], [85, 50], { easing: easeInOutQuint });
  } else {
    sliderPct = 50;
  }

  const frameEnter = springScale(frame, 6, fps);
  const frameOpacity = fadeIn(frame, 6, 14, easeOutCubic);
  const exitOpacity = fadeOut(frame, durationInFrames, 14);

  // Use a hue-shift filter on the "after" if it's the same image as "before"
  const sameImage = beforeUrl && afterUrl && beforeUrl === afterUrl;
  const afterFilter = sameImage ? 'hue-rotate(40deg) saturate(1.4) brightness(1.1)' : 'none';

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}10`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1100} x="50%" y="50%" opacity={0.25} blur={120} />
      <ParticleField count={28} color="#ffffff" minSize={2} maxSize={4} speed={0.4} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill style={{ opacity: exitOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
        {/* Caption */}
        <AnimatedHeadline
          text={caption}
          frame={frame}
          startAt={2}
          stagger={1.5}
          charDuration={10}
          charSlideDist={20}
          style={{
            position: 'absolute', top: 50, left: '50%', transform: 'translateX(-50%)',
            fontSize: 46, fontWeight: 800, color: brand.secondary, letterSpacing: -1.2,
            textAlign: 'center', maxWidth: 1300,
            textShadow: `0 4px 30px ${brand.primary}80`, zIndex: 30,
          }}
        />

        {/* Slider area */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: `translate(-50%, -50%) scale(${frameEnter})`,
          opacity: frameOpacity,
          width: 1480, height: 760,
          borderRadius: 18,
          overflow: 'hidden',
          background: '#161618',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 50px 120px ${brand.primary}40, 0 30px 70px rgba(0,0,0,0.6)`,
        }}>
          {/* Browser title bar */}
          <div style={{
            height: 40, background: 'linear-gradient(180deg, #1e1e21, #161618)',
            display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#ff5f57' }} />
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#febc2e' }} />
            <div style={{ width: 11, height: 11, borderRadius: 6, background: '#28c840' }} />
          </div>

          <div style={{ position: 'relative', width: '100%', height: 720, overflow: 'hidden' }}>
            {/* BEFORE — full bleed */}
            {beforeUrl && (
              <Img src={beforeUrl}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
            )}

            {/* AFTER — clipped to right of slider */}
            {afterUrl && (
              <div style={{
                position: 'absolute', inset: 0,
                clipPath: `polygon(${sliderPct}% 0, 100% 0, 100% 100%, ${sliderPct}% 100%)`,
              }}>
                <Img src={afterUrl}
                  style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'cover', objectPosition: 'top center',
                    filter: afterFilter,
                  }} />
              </div>
            )}

            {/* Labels */}
            <div style={{
              position: 'absolute', top: 30, left: 30,
              background: 'rgba(0,0,0,0.7)', color: '#fff',
              padding: '8px 18px', borderRadius: 999,
              fontSize: 18, fontWeight: 800, letterSpacing: 2,
              backdropFilter: 'blur(8px)',
            }}>{beforeLabel}</div>
            <div style={{
              position: 'absolute', top: 30, right: 30,
              background: brand.primary, color: '#fff',
              padding: '8px 18px', borderRadius: 999,
              fontSize: 18, fontWeight: 800, letterSpacing: 2,
              boxShadow: `0 6px 20px ${brand.primary}aa`,
            }}>{afterLabel}</div>

            {/* Divider line + handle */}
            <div style={{
              position: 'absolute', left: `${sliderPct}%`, top: 0, bottom: 0,
              width: 4, background: '#fff',
              boxShadow: '0 0 30px rgba(255,255,255,0.7)',
              transform: 'translateX(-50%)',
            }} />
            <div style={{
              position: 'absolute', left: `${sliderPct}%`, top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 64, height: 64, borderRadius: '50%',
              background: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 4px rgba(255,255,255,0.2)',
            }}>
              <ArrowLeftRight size={28} color="#111" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
