// Theme tokens — controls the entire visual mode (light vs dark) for all scenes.
// User wanted the "clean professional product demo" look (Stripe, Linear, Notion, Figma vibe)
// instead of the "moody dark hero ad" look we had before. Light theme is now the default.

import type { ScenePlan } from './types';

export interface Theme {
  // Background + container surfaces
  bg: string;                  // scene background
  surface: string;             // card/panel background
  surfaceBorder: string;       // card border

  // Text
  text: string;                // primary text on bg
  textMuted: string;           // secondary text / labels

  // Effects (subtle on light, prominent on dark)
  glowOpacity: number;         // 0..1 — how strong GlowOrbs render
  gradientOpacity: number;     // 0..1 — how strong GradientBG renders
  particleColor: string;
  particleOpacity: number;
  noiseOpacity: number;

  // Shadows / depth
  cardShadow: string;          // box-shadow for floating cards
  cardShadowStrong: string;    // for hero elements that need more lift
}

export const LIGHT_THEME: Theme = {
  bg: '#F5F5F7',                        // Apple-style off-white
  surface: '#FFFFFF',
  surfaceBorder: '#E5E5E7',

  text: '#1A1A1A',
  textMuted: '#6E6E73',

  glowOpacity: 0.06,                    // very subtle, mostly a soft tint
  gradientOpacity: 0.04,
  particleColor: '#000000',
  particleOpacity: 0.05,
  noiseOpacity: 0.015,

  cardShadow: '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  cardShadowStrong: '0 24px 60px rgba(0,0,0,0.16), 0 8px 16px rgba(0,0,0,0.08)',
};

export const DARK_THEME: Theme = {
  bg: '#0F0F12',
  surface: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(255,255,255,0.12)',

  text: '#FFFFFF',
  textMuted: '#A0A0A0',

  glowOpacity: 0.32,
  gradientOpacity: 0.10,
  particleColor: '#FFFFFF',
  particleOpacity: 0.5,
  noiseOpacity: 0.04,

  cardShadow: '0 20px 60px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.25)',
  cardShadowStrong: '0 40px 100px rgba(0,0,0,0.5), 0 16px 40px rgba(0,0,0,0.3)',
};

// Resolve the theme from the plan. Plan can opt into dark with meta.theme = 'dark';
// otherwise defaults to LIGHT (the new professional default).
export function themeFor(plan: ScenePlan): Theme {
  const explicit = (plan.meta as any).theme;
  if (explicit === 'dark') return DARK_THEME;
  return LIGHT_THEME;
}
