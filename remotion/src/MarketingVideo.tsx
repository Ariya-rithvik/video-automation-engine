// Top-level composition. Sequences the scenes from Gemini's plan, or falls back to OneScenePan
// when scenes[] is empty. Supports two output formats:
//   - 'landscape' (16:9, 1920x1080): scenes render full-frame as designed.
//   - 'shorts'    (9:16, 1080x1920): the 16:9 scene stage is reframed into the vertical center
//                  by VerticalFrame, with kinetic captions above and a brand bar below.

import React from 'react';
import { AbsoluteFill, Series, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ScenePlan } from './types';
import { FALLBACK_PLAN } from './types';
import { SCENE_REGISTRY, OneScenePan } from './scenes';
import { VerticalFrame } from './scenes/VerticalFrame';
import { ProductionBackgroundGrid, PremiumCard, AnimatedCurvedConnector } from './components';
import { useAESnapSpring } from './animations';

interface Props {
  scenePlan?: ScenePlan;
  format?: 'landscape' | 'shorts';
}

/**
 * MainAutomatedScene — Assembly line composition file using After Effects dynamic styling
 */
export const MainAutomatedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Calculate snappy spring animations for our modules
  const card1Scale = useAESnapSpring({ delayFrames: 0, from: 0.4, to: 1, frame, fps });
  const card2Scale = useAESnapSpring({ delayFrames: 15, from: 0.4, to: 1, frame, fps });

  return (
    <AbsoluteFill>
      {/* LAYER 1: The Faint After Effects Style Structural Grid Background */}
      <ProductionBackgroundGrid bgColor="#f8f9fa" gridSize={80}>
        
        {/* LAYER 2: The Animated SVG Connecting Wire (Curves from Card A to Card B) */}
        <AnimatedCurvedConnector 
          from={{ x: 200, y: 300 }} 
          to={{ x: 700, y: 500 }} 
          startFrame={25} 
          durationFrames={20}
          color="#8A2BE2"
        />

        {/* LAYER 3: Dynamic Floating HTML/CSS Layout Cards */}
        {/* Card A: Company Data Node */}
        <div style={{ position: 'absolute', left: 100, top: 200, transform: `scale(${card1Scale})` }}>
          <PremiumCard width={300} height={180}>
            <div style={{ color: '#00FF1A', fontSize: 14 }}>Company Data</div>
            <div style={{ fontSize: 24, marginTop: 10 }}>Internal Docs</div>
          </PremiumCard>
        </div>

        {/* Card B: LLM Processing Node */}
        <div style={{ position: 'absolute', left: 600, top: 400, transform: `scale(${card2Scale})` }}>
          <PremiumCard width={300} height={180}>
            <div style={{ color: '#8A2BE2', fontSize: 14 }}>LLM Engine</div>
            <div style={{ fontSize: 24, marginTop: 10 }}>Knowledge Processing</div>
          </PremiumCard>
        </div>

      </ProductionBackgroundGrid>
    </AbsoluteFill>
  );
};

export const MarketingVideo: React.FC<Props> = ({ scenePlan = FALLBACK_PLAN, format = 'landscape' }) => {
  // The scene timeline is identical for both formats — only the framing differs.
  const sceneContent =
    !scenePlan.scenes || scenePlan.scenes.length === 0 ? (
      <OneScenePan plan={scenePlan} />
    ) : (
      <Series>
        {scenePlan.scenes.map((scene, i) => {
          const Component = SCENE_REGISTRY[scene.type];
          const dur = Math.max(1, scene.durationFrames);
          if (!Component) {
            return (
              <Series.Sequence key={i} durationInFrames={dur}>
                <AbsoluteFill style={{ background: scenePlan.meta.brand.bg }} />
              </Series.Sequence>
            );
          }
          return (
            <Series.Sequence key={i} durationInFrames={dur}>
              <Component plan={scenePlan} props={scene.props} durationInFrames={dur} />
            </Series.Sequence>
          );
        })}
      </Series>
    );

  if (format === 'shorts') {
    return <VerticalFrame plan={scenePlan}>{sceneContent}</VerticalFrame>;
  }
  return sceneContent;
};
