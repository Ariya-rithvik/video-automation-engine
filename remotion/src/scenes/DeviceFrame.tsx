// DeviceFrame — wraps a screenshot in a device mockup (laptop, tablet, or watch).
// PhoneMockup already covers phones richly; this scene handles the other form factors.

import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, springScale, floatY, easeOutCubic, easeInOutQuint } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, AnimatedHeadline } from '../effects';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

type DeviceType = 'laptop' | 'tablet' | 'watch';

export const DeviceFrame: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const screenshotUrl = props.screenshotUrl as string | undefined;
  const caption = props.caption || props.title || '';
  const deviceType = (props.deviceType as DeviceType) || 'laptop';

  // Entrance
  const deviceScale = springScale(frame, 8, fps);
  const deviceOpacity = fadeIn(frame, 8, 16, easeOutCubic);
  const deviceFloat = floatY(frame, fps, 8, 5, 0);

  // Slow pan inside the device
  const panProgress = interpolate(frame, [10, durationInFrames - 10], [0, 100], {
    easing: easeInOutQuint, extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const exitOpacity = fadeOut(frame, durationInFrames, 14);

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}12`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1100} x="50%" y="55%" opacity={0.30} blur={120} />
      <GlowOrb color={brand.primary} size={600} x="15%" y="20%" opacity={0.18} blur={90} />
      <ParticleField count={32} color="#ffffff" minSize={2} maxSize={4.5} speed={0.45} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill style={{ opacity: exitOpacity, fontFamily: 'Inter, system-ui, sans-serif' }}>
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
              fontSize: 44, fontWeight: 800, color: brand.secondary, letterSpacing: -1.2,
              textAlign: 'center', maxWidth: 1300, zIndex: 20,
              textShadow: `0 4px 30px ${brand.primary}80`,
            }}
          />
        )}

        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {deviceType === 'laptop' && (
            <LaptopMockup
              screenshotUrl={screenshotUrl}
              panProgress={panProgress}
              brand={brand}
              opacity={deviceOpacity}
              scale={deviceScale}
              float={deviceFloat}
            />
          )}
          {deviceType === 'tablet' && (
            <TabletMockup
              screenshotUrl={screenshotUrl}
              panProgress={panProgress}
              brand={brand}
              opacity={deviceOpacity}
              scale={deviceScale}
              float={deviceFloat}
            />
          )}
          {deviceType === 'watch' && (
            <WatchMockup
              screenshotUrl={screenshotUrl}
              brand={brand}
              opacity={deviceOpacity}
              scale={deviceScale}
              float={deviceFloat}
            />
          )}
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── Laptop ─────────────────────────────────────────────────────────────────

const LaptopMockup: React.FC<any> = ({ screenshotUrl, panProgress, brand, opacity, scale, float }) => {
  const lapW = 1400;
  const lapH = 850;
  return (
    <div style={{
      opacity, transform: `scale(${scale}) translateY(${float}px)`,
      width: lapW, height: lapH + 36, position: 'relative',
    }}>
      {/* Screen */}
      <div style={{
        width: lapW, height: lapH,
        background: '#1a1a1d', borderRadius: 18,
        border: '12px solid #0a0a0c',
        padding: 0,
        boxShadow: `0 50px 120px ${brand.primary}40, 0 30px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)`,
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Camera notch */}
        <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 80, height: 6, background: '#000', borderRadius: 4, zIndex: 2 }} />
        {screenshotUrl ? (
          <Img src={screenshotUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${panProgress}%` }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No screenshot</div>
        )}
      </div>
      {/* Base hinge */}
      <div style={{
        width: lapW + 80, height: 26, marginLeft: -40, marginTop: 4,
        background: 'linear-gradient(180deg, #2a2a2e 0%, #0a0a0c 100%)',
        borderRadius: '0 0 24px 24px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      }} />
      <div style={{
        width: 200, height: 8, margin: '0 auto', marginTop: -8,
        background: '#000', borderRadius: '0 0 8px 8px',
      }} />
    </div>
  );
};

// ─── Tablet ─────────────────────────────────────────────────────────────────

const TabletMockup: React.FC<any> = ({ screenshotUrl, panProgress, brand, opacity, scale, float }) => {
  const tabW = 800;
  const tabH = 1060;
  return (
    <div style={{
      opacity, transform: `scale(${scale}) translateY(${float}px)`,
      width: tabW, height: tabH,
      background: 'linear-gradient(135deg, #1a1a1d 0%, #0a0a0c 100%)',
      borderRadius: 36,
      border: '14px solid #26262b',
      boxShadow: `0 50px 120px ${brand.primary}40, 0 30px 70px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)`,
      padding: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {screenshotUrl ? (
        <Img src={screenshotUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${panProgress}%` }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>No screenshot</div>
      )}
    </div>
  );
};

// ─── Watch ──────────────────────────────────────────────────────────────────

const WatchMockup: React.FC<any> = ({ screenshotUrl, brand, opacity, scale, float }) => {
  return (
    <div style={{
      opacity, transform: `scale(${scale}) translateY(${float}px)`,
      width: 360, height: 420, position: 'relative',
    }}>
      {/* Watch case */}
      <div style={{
        width: 360, height: 420,
        background: 'linear-gradient(135deg, #2a2a2e 0%, #0a0a0c 100%)',
        borderRadius: 70,
        border: '8px solid #26262b',
        boxShadow: `0 50px 120px ${brand.primary}40, 0 30px 70px rgba(0,0,0,0.6)`,
        padding: 50,
        overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', height: '100%',
          background: '#000', borderRadius: 38,
          overflow: 'hidden',
        }}>
          {screenshotUrl ? (
            <Img src={screenshotUrl}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : null}
        </div>
      </div>
      {/* Digital crown */}
      <div style={{
        position: 'absolute', right: -10, top: 150,
        width: 14, height: 60, background: '#1a1a1d', borderRadius: 4,
        border: '1px solid #333',
      }} />
    </div>
  );
};
