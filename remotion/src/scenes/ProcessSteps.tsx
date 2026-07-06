// ProcessSteps — horizontal row of numbered steps with icons + connecting arrows.
// Adobe-tutorial style: each step demonstrates a part of a process (Browse → Order → Track → Enjoy).
// Stepper staggered reveal, arrows that draw from left to right between each pair.

import React, { Fragment } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import type { ScenePlan } from '../types';
import { fadeIn, fadeOut, popScale, floatY, easeOutCubic, easeOutQuart } from '../animations';
import { GlowOrb, ParticleField, NoiseTexture, GradientBG, GlassCard, AnimatedHeadline } from '../effects';
import { Icon } from '../icons';
import { ArrowRight } from 'lucide-react';

interface Props {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

interface Step {
  label: string;
  description: string;
  icon?: string;
}

const DEFAULT_STEPS: Step[] = [
  { label: 'BROWSE',  description: 'Explore options',     icon: 'Search' },
  { label: 'SELECT',  description: 'Pick your favorite',  icon: 'Star' },
  { label: 'ORDER',   description: 'Quick checkout',      icon: 'ShoppingCart' },
  { label: 'ENJOY',   description: 'Delivered to door',   icon: 'CheckCircle2' },
];

export const ProcessSteps: React.FC<Props> = ({ plan, props, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { brand } = plan.meta;

  const headline = props.headline || props.title || 'How it works';
  const rawSteps = props.steps as Step[] | undefined;
  const steps = (rawSteps && rawSteps.length > 0 ? rawSteps : DEFAULT_STEPS).slice(0, 4);

  // Stagger timing
  const STEP_BASE = 32;
  const STEP_GAP = 22;

  const exitOpacity = fadeOut(frame, durationInFrames, 12);

  return (
    <AbsoluteFill style={{ background: brand.bg, overflow: 'hidden' }}>
      <GradientBG from={brand.bg} via={`${brand.primary}11`} to={brand.bg} />
      <GlowOrb color={brand.primary} size={1100} x="50%" y="50%" opacity={0.25} blur={120} />
      <GlowOrb color={brand.primary} size={600}  x="15%" y="20%" opacity={0.18} blur={90} />
      <GlowOrb color={brand.primary} size={600}  x="85%" y="80%" opacity={0.18} blur={90} />

      <ParticleField count={40} color="#ffffff" minSize={2} maxSize={4.5} speed={0.5} />
      <NoiseTexture opacity={0.04} />

      <AbsoluteFill
        style={{
          opacity: exitOpacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          padding: 80,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Headline */}
        <AnimatedHeadline
          text={headline}
          frame={frame}
          startAt={4}
          stagger={2}
          charDuration={10}
          charSlideDist={26}
          style={{
            color: brand.secondary,
            fontSize: 68,
            fontWeight: 800,
            margin: 0,
            marginBottom: 90,
            letterSpacing: -2,
            textAlign: 'center',
            maxWidth: 1600,
            textShadow: `0 4px 30px ${brand.primary}50`,
          }}
        />

        {/* Steps row */}
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center', gap: 24, width: '100%', maxWidth: 1720 }}>
          {steps.map((step, i) => {
            const appearAt = STEP_BASE + i * STEP_GAP;
            const arrowAt = appearAt + 14;

            return (
              <Fragment key={i}>
                <StepCard
                  step={step}
                  index={i}
                  appearAt={appearAt}
                  frame={frame}
                  fps={fps}
                  brand={brand}
                />
                {i < steps.length - 1 && (
                  <ArrowConnector appearAt={arrowAt} frame={frame} fps={fps} color={brand.primary} />
                )}
              </Fragment>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ─── StepCard — single step with icon, label, description ────────────────────

const StepCard: React.FC<{
  step: Step;
  index: number;
  appearAt: number;
  frame: number;
  fps: number;
  brand: { primary: string; secondary: string; bg: string };
}> = ({ step, index, appearAt, frame, fps, brand }) => {
  const scale = popScale(frame, appearAt, fps);
  const opacity = fadeIn(frame, appearAt, 14, easeOutCubic);
  const float = floatY(frame, fps, 5, 4.5, index * 0.9);

  return (
    <div style={{ flex: 1, maxWidth: 360, opacity, transform: `scale(${scale}) translateY(${float}px)` }}>
      <GlassCard tint={brand.primary} radius={28} padding="36px 24px" style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
        {/* Step number badge (small, top-right) */}
        <div
          style={{
            position: 'absolute',
            top: 14,
            right: 18,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${brand.primary}30`,
            border: `1px solid ${brand.primary}80`,
            color: brand.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          {index + 1}
        </div>

        {/* Big icon in a glowing circle */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.primary}aa 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
            boxShadow: `0 12px 36px ${brand.primary}aa, 0 4px 12px rgba(0,0,0,0.3)`,
          }}
        >
          <Icon name={step.icon} size={48} color="#fff" strokeWidth={2.4} />
        </div>

        {/* Label */}
        <div
          style={{
            color: '#fff',
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          {step.label}
        </div>

        {/* Description */}
        <div
          style={{
            color: '#ffffffaa',
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.4,
            maxWidth: 220,
          }}
        >
          {step.description}
        </div>
      </GlassCard>
    </div>
  );
};

// ─── ArrowConnector — animated arrow between two steps ───────────────────────

const ArrowConnector: React.FC<{
  appearAt: number;
  frame: number;
  fps: number;
  color: string;
}> = ({ appearAt, frame, color }) => {
  const opacity = fadeIn(frame, appearAt, 10, easeOutCubic);
  // Line draws from left to right
  const drawProgress = interpolate(frame, [appearAt, appearAt + 14], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOutQuart,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', alignSelf: 'center', minWidth: 60, opacity }}>
      <div
        style={{
          flex: 1,
          height: 3,
          background: `linear-gradient(90deg, transparent 0%, ${color} ${drawProgress * 100}%, transparent ${drawProgress * 100 + 0.01}%)`,
          borderRadius: 2,
        }}
      />
      <div style={{ opacity: drawProgress, marginLeft: 4 }}>
        <ArrowRight size={32} color={color} strokeWidth={3} />
      </div>
    </div>
  );
};
