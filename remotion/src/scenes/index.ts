// Scene registry — maps Gemini's scene `type` string to the React component.
// MarketingVideo.tsx looks up components via this registry, so adding a new scene type
// is just: write the component, add it here.

import type React from 'react';
import type { ScenePlan } from '../types';
import { TitleCard } from './TitleCard';
import { PhoneMockup } from './PhoneMockup';
import { FeatureCallout } from './FeatureCallout';
import { StatsRow } from './StatsRow';
import { EndingCTA } from './EndingCTA';
import { ScreenshotShowcase } from './ScreenshotShowcase';
import { ProcessSteps } from './ProcessSteps';
import { AnimatedFootage } from './AnimatedFootage';
import { CursorClickReveal } from './CursorClickReveal';
import { PromptThenGrid } from './PromptThenGrid';
import { BeforeAfterSlider } from './BeforeAfterSlider';
import { DeviceFrame } from './DeviceFrame';
import { TemplateCollage } from './TemplateCollage';
import { ProductSelectAndCart } from './ProductSelectAndCart';
import { OneScenePan } from './OneScenePan';
import { CogneeMographDemoFinal } from './CogneeMographDemoFinal';

export interface SceneComponentProps {
  plan: ScenePlan;
  props: Record<string, any>;
  durationInFrames: number;
}

export type SceneComponent = React.FC<SceneComponentProps>;

export const SCENE_REGISTRY: Record<string, SceneComponent> = {
  TitleCard,
  PhoneMockup,
  FeatureCallout,
  StatsRow,
  EndingCTA,
  ScreenshotShowcase,
  ProcessSteps,
  AnimatedFootage,
  CursorClickReveal,
  PromptThenGrid,
  BeforeAfterSlider,
  DeviceFrame,
  TemplateCollage,
  ProductSelectAndCart,
  CogneeMographDemoFinal,
};

// Re-exports for direct import where needed
export {
  TitleCard, PhoneMockup, FeatureCallout, StatsRow, EndingCTA, ScreenshotShowcase,
  ProcessSteps, AnimatedFootage, CursorClickReveal, PromptThenGrid, BeforeAfterSlider,
  DeviceFrame, TemplateCollage, ProductSelectAndCart, OneScenePan, CogneeMographDemoFinal,
};
