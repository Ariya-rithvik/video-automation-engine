// Reusable visual primitives — glass surfaces, glow orbs, particle fields, depth layers.
// Imported by every scene to keep the visual language consistent.

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { floatY, spin } from './animations';

// ─── GlassCard — frosted-glass surface with backdrop blur ───────────────────

interface GlassCardProps {
  children?: React.ReactNode;
  width?: number | string;
  height?: number | string;
  radius?: number;
  tint?: string;            // hex of subtle color tint
  borderColor?: string;
  padding?: number | string;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children, width, height, radius = 24, tint = '#ffffff',
  borderColor, padding, style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(135deg, ${tint}1f 0%, ${tint}0a 100%)`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${borderColor || `${tint}33`}`,
        borderRadius: radius,
        padding,
        boxShadow: `
          inset 0 1px 0 ${tint}33,
          0 20px 60px rgba(0,0,0,0.4),
          0 8px 24px rgba(0,0,0,0.25)
        `,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Inner highlight at top */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, height: '40%',
          background: `linear-gradient(180deg, ${tint}1a 0%, transparent 100%)`,
          pointerEvents: 'none',
          borderRadius: `${radius}px ${radius}px 0 0`,
        }}
      />
      {children}
    </div>
  );
};

// ─── GlowOrb — large blurred radial decoration ──────────────────────────────

interface GlowOrbProps {
  color: string;            // hex
  size?: number;
  x?: number | string;
  y?: number | string;
  opacity?: number;
  blur?: number;
}

export const GlowOrb: React.FC<GlowOrbProps> = ({
  color, size = 600, x = '50%', y = '50%', opacity = 0.5, blur = 80,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: typeof x === 'number' ? `${x}px` : x,
        top: typeof y === 'number' ? `${y}px` : y,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: `radial-gradient(circle, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── ParticleField — N floating particles for ambient depth ─────────────────

interface ParticleFieldProps {
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
  speed?: number;            // 1 = normal, 2 = fast
}

// Deterministic pseudo-random — same seed always gives same particle positions
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  count = 40, color = '#ffffff', minSize = 2, maxSize = 6, speed = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const particles = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: seededRandom(i * 13.7) * width,
      y: seededRandom(i * 27.3) * height,
      size: minSize + seededRandom(i * 41.1) * (maxSize - minSize),
      opacity: 0.2 + seededRandom(i * 53.9) * 0.6,
      phase: seededRandom(i * 67.7) * Math.PI * 2,
      period: 3 + seededRandom(i * 79.1) * 4,
      driftX: seededRandom(i * 91.3) * 60 - 30,
    }));
  }, [count, width, height, minSize, maxSize]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {particles.map((p, i) => {
        const yOff = floatY(frame, fps, 30 * speed, p.period, p.phase);
        const xOff = floatY(frame, fps, p.driftX, p.period * 1.4, p.phase * 0.7);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: p.x + xOff,
              top: p.y + yOff,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: color,
              opacity: p.opacity,
              boxShadow: `0 0 ${p.size * 3}px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── DepthLayer — applies parallax-friendly transform based on depth ────────
// Depth: 0 = foreground (largest, sharpest), 1 = far background (smallest, hazy)

interface DepthLayerProps {
  depth: number; // 0..1
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const DepthLayer: React.FC<DepthLayerProps> = ({ depth, children, style }) => {
  const scale = 1 - depth * 0.15;          // far things appear smaller
  const opacity = 1 - depth * 0.35;
  const blur = depth * 1.5;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${scale})`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── NoiseTexture — subtle SVG grain overlay ────────────────────────────────

export const NoiseTexture: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity, mixBlendMode: 'overlay' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="noiseFilter">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#noiseFilter)" />
    </svg>
  );
};

// ─── DecorRing — slowly rotating decorative ring ────────────────────────────

interface DecorRingProps {
  size: number;
  color: string;
  opacity?: number;
  dashed?: boolean;
  spinSpeed?: number; // deg/sec
}

export const DecorRing: React.FC<DecorRingProps> = ({ size, color, opacity = 0.3, dashed = false, spinSpeed = 8 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rotation = spin(frame, fps, spinSpeed);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: '50%',
        border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
        opacity,
        transform: `rotate(${rotation}deg)`,
        pointerEvents: 'none',
      }}
    />
  );
};

// ─── AnimatedHeadline — word-level wrap with per-character reveal ───────────
// Each word stays as one unit (no mid-word breaks), but characters within still
// animate individually. Fixes the "Grow Your Restau-rant" bug.

interface AnimatedHeadlineProps {
  text: string;
  frame: number;
  startAt: number;
  stagger?: number;        // frames between consecutive characters
  charDuration?: number;   // fade-in duration per character
  charSlideDist?: number;  // px each char slides up from
  style?: React.CSSProperties;
}

export const AnimatedHeadline: React.FC<AnimatedHeadlineProps> = ({
  text, frame, startAt, stagger = 2, charDuration = 10, charSlideDist = 30, style,
}) => {
  // Split into words; each word stays together (whiteSpace nowrap)
  const words = text.split(/(\s+)/);
  let charIndex = 0;

  return (
    <div
      style={{
        // Defensive bounds: never let text escape its container, even with super-long words
        overflowWrap: 'anywhere',
        wordBreak: 'normal',
        overflow: 'hidden',
        ...style,
      }}
    >
      {words.map((word, wi) => {
        if (/^\s+$/.test(word)) {
          // Render whitespace as literal space — wraps normally
          charIndex += word.length;
          return <span key={wi}>{word}</span>;
        }
        const chars = Array.from(word);
        return (
          <span
            key={wi}
            style={{
              // Keep characters of one word together when possible, but allow break
              // (overflowWrap: 'anywhere' on parent) if the word is wider than container.
              whiteSpace: 'normal',
              display: 'inline-block',
              maxWidth: '100%',
            }}
          >
            {chars.map((c) => {
              const i = charIndex++;
              const op = Math.max(0, Math.min(1, (frame - startAt - i * stagger) / charDuration));
              const slideProgress = Math.max(0, Math.min(1, (frame - startAt - i * stagger) / (charDuration + 4)));
              const y = charSlideDist * (1 - slideProgress);
              return (
                <span
                  key={i}
                  style={{
                    opacity: op,
                    transform: `translateY(${y}px)`,
                    display: 'inline-block',
                  }}
                >
                  {c}
                </span>
              );
            })}
          </span>
        );
      })}
    </div>
  );
};

// ─── GradientBG — premium-feeling animated gradient background ──────────────

interface GradientBGProps {
  from: string;
  via?: string;
  to: string;
  animate?: boolean;
}

export const GradientBG: React.FC<GradientBGProps> = ({ from, via, to, animate = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = animate ? 135 + Math.sin((frame / fps) * 0.3) * 15 : 135;
  const stops = via ? `${from}, ${via}, ${to}` : `${from}, ${to}`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(${angle}deg, ${stops})`,
      }}
    />
  );
};
