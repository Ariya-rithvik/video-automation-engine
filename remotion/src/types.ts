// Scene Plan schema — produced by Gemini (the "director"), consumed by Remotion (the "renderer").
// Shared by backend (marketing-director.ts) and Remotion (MarketingVideo.tsx, scenes/*).
//
// NOTE on prop shape: Gemini's structured-output schema lists every possible prop field at once
// (title, subtitle, headline, ctaText, url, screenshotUrl, bullets, floatingCards, stats).
// Each scene component picks the fields it cares about, with sensible fallbacks.
// We keep `props` as Record<string, any> here so the director isn't forced into a strict union.

export interface SceneMeta {
  title: string;
  tagline: string;
  brand: {
    primary: string;   // hex e.g. "#E23744" — used as ACCENT (buttons, cursor, ripples)
    secondary: string; // hex e.g. "#FFFFFF" — legacy; theme.text now drives body text
    bg: string;        // hex e.g. "#F5F5F7" — overridden by theme.bg if theme is set
  };
  theme?: 'light' | 'dark';  // visual mode. Defaults to 'light' (clean professional demo look).
  fps: 30;
  totalFrames: number;
}

export type SceneType =
  | 'TitleCard'
  | 'ScreenshotShowcase'
  | 'FeatureCallout'
  | 'PhoneMockup'
  | 'StatsRow'
  | 'ProcessSteps'
  | 'AnimatedFootage'
  | 'CursorClickReveal'
  | 'PromptThenGrid'
  | 'BeforeAfterSlider'
  | 'DeviceFrame'
  | 'TemplateCollage'
  | 'ProductSelectAndCart'
  | 'EndingCTA';

export interface Scene {
  type: SceneType;
  durationFrames: number;
  props: Record<string, any>;
}

export interface ScenePlan {
  meta: SceneMeta;
  scenes: Scene[];
}

// Default fallback plan used when no Gemini result is available (Studio preview, safety net).
export const FALLBACK_PLAN: ScenePlan = {
  meta: {
    title: 'Autonomous Demo Engine',
    tagline: 'AI-generated marketing videos from any website',
    brand: { primary: '#6366f1', secondary: '#ffffff', bg: '#0B0B0F' },
    fps: 30,
    totalFrames: 450, // 15s @ 30fps
  },
  scenes: [],
};
