// Animation helpers — return values to spread into style{}.
// All functions assume `frame` is scene-local (you're inside a <Series.Sequence>).

import { interpolate, spring, Easing } from 'remotion';

// ─── Easing curves (named so scenes read like prose) ─────────────────────────

export const easeOutCubic = Easing.bezier(0.33, 1, 0.68, 1);
export const easeOutQuart = Easing.bezier(0.25, 1, 0.5, 1);
export const easeOutExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOutQuint = Easing.bezier(0.83, 0, 0.17, 1);
export const easeOutBack = Easing.bezier(0.34, 1.56, 0.64, 1); // overshoots slightly

// ─── Entrance / exit ────────────────────────────────────────────────────────

export function fadeIn(frame: number, startAt: number, duration = 15, easing = easeOutCubic): number {
  return interpolate(frame, [startAt, startAt + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

export function fadeOut(frame: number, endAt: number, duration = 15, easing = easeOutCubic): number {
  return interpolate(frame, [endAt - duration, endAt], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

export function fadeInOut(frame: number, sceneDuration: number, fadeFrames = 12): number {
  return Math.min(fadeIn(frame, 0, fadeFrames), fadeOut(frame, sceneDuration, fadeFrames));
}

export function slideUp(frame: number, startAt: number, duration = 20, distance = 60, easing = easeOutQuart): number {
  return interpolate(frame, [startAt, startAt + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

export function slideFromLeft(frame: number, startAt: number, duration = 20, distance = 120, easing = easeOutQuart): number {
  return interpolate(frame, [startAt, startAt + duration], [-distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

export function springScale(frame: number, startAt: number, fps = 30): number {
  return spring({
    frame: Math.max(0, frame - startAt),
    fps,
    config: { damping: 12, stiffness: 100, mass: 1 },
    from: 0.5,
    to: 1,
  });
}

export function popScale(frame: number, startAt: number, fps = 30): number {
  return spring({
    frame: Math.max(0, frame - startAt),
    fps,
    config: { damping: 10, stiffness: 140, mass: 0.8 },
    from: 0,
    to: 1,
  });
}

export interface AEPopConfig {
  delayFrames?: number;
  from?: number;
  to?: number;
  frame?: number;
  fps?: number;
}

/**
 * High-velocity After Effects "Snap & Bounce" Spring Physics
 * Uses stiffness=180, damping=12, mass=0.8 to create an aggressive snap with a subtle overshoot bounce.
 */
export function useAESnapSpring(options: AEPopConfig = {}): number {
  const { delayFrames = 0, from = 0, to = 1, frame = 0, fps = 30 } = options;
  return spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: {
      stiffness: 180, // Explosive initial velocity
      damping: 12,    // Allows a slight overshoot bounce
      mass: 0.8,      // Lightweight & snappy response
    },
    from,
    to,
  });
}


// ─── Ongoing / organic motion ───────────────────────────────────────────────

// Subtle pulse — used for CTAs / hero elements
export function pulse(frame: number, fps = 30, amplitude = 0.04, periodSeconds = 1.6): number {
  const t = (frame / fps) / periodSeconds;
  return 1 + amplitude * Math.sin(t * 2 * Math.PI);
}

// Sine-wave float — y offset that oscillates organically. Phase staggers multiple elements.
export function floatY(frame: number, fps = 30, amplitude = 20, periodSeconds = 4, phase = 0): number {
  const t = (frame / fps) / periodSeconds;
  return amplitude * Math.sin(t * 2 * Math.PI + phase);
}

// Slow rotation — degrees per second. Useful for decorative rings/orbs.
export function spin(frame: number, fps = 30, degreesPerSecond = 12): number {
  return (frame / fps) * degreesPerSecond;
}

// Parallax — same scene-relative time, but elements at different `depth` (0 = foreground, 1 = far)
// drift at different rates. Returns a Y offset useful for a passive scene drift.
export function parallaxDrift(frame: number, sceneDuration: number, depth: number, maxDrift = 40): number {
  const progress = frame / Math.max(1, sceneDuration);
  // Deeper layers drift less — feels like a camera move
  const factor = 1 - depth * 0.7;
  return progress * maxDrift * factor;
}

// ─── Counters ───────────────────────────────────────────────────────────────

// Counter that ticks 0 → target over `duration` frames. Strips suffixes (Crore, Lakh, %, +, k, m, etc),
// animates the number, re-appends the suffix. Output formatted with commas.
export function animatedNumber(
  frame: number,
  startAt: number,
  duration: number,
  finalValue: string,
): string {
  const match = /^([\d,\.]+)\s*(.*)$/.exec(finalValue.trim());
  if (!match) return finalValue;
  const numericPart = parseFloat(match[1].replace(/,/g, ''));
  const suffix = match[2] || '';
  if (!isFinite(numericPart)) return finalValue;

  const progress = interpolate(frame, [startAt, startAt + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOutQuart,
  });
  const current = numericPart * progress;
  const decimals = match[1].includes('.') ? (match[1].split('.')[1]?.length || 0) : 0;
  const formatted = current.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return suffix ? `${formatted}${suffix.startsWith('+') || suffix.startsWith('%') ? suffix : ' ' + suffix}` : formatted;
}

// Per-character stagger: returns opacity 0..1 for character at index `i` of the string.
// Each character starts `stagger` frames after the previous.
export function charReveal(frame: number, startAt: number, i: number, stagger = 2, duration = 10): number {
  return fadeIn(frame, startAt + i * stagger, duration, easeOutQuart);
}

// Y offset for character stagger — pairs with charReveal for slide-up letters.
export function charSlideY(frame: number, startAt: number, i: number, stagger = 2, duration = 14, distance = 30): number {
  return slideUp(frame, startAt + i * stagger, duration, distance, easeOutQuart);
}
