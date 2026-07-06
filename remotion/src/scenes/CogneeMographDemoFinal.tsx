import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ProductionBackgroundGrid, PremiumCard, AnimatedCurvedConnector } from '../components';
import { useAESnapSpring, animatedNumber } from '../animations';

export const CogneeMographDemoFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 1. Snappy spring physics for floating cards
  const card1Scale = useAESnapSpring({ delayFrames: 0, from: 0.3, to: 1, frame, fps });
  const card1Y = useAESnapSpring({ delayFrames: 0, from: 60, to: 0, frame, fps });

  const card2Scale = useAESnapSpring({ delayFrames: 15, from: 0.3, to: 1, frame, fps });
  const card2Y = useAESnapSpring({ delayFrames: 15, from: 60, to: 0, frame, fps });

  const card3Scale = useAESnapSpring({ delayFrames: 30, from: 0.3, to: 1, frame, fps });
  const card3Y = useAESnapSpring({ delayFrames: 30, from: 60, to: 0, frame, fps });

  // Animated metric counters
  const metricVal = animatedNumber(frame, 20, 40, '$7,500,000');
  const accuracyVal = animatedNumber(frame, 35, 30, '99.8%');

  return (
    <AbsoluteFill>
      {/* LAYER 1: Structural Grid Background */}
      <ProductionBackgroundGrid bgColor="#f8f9fa" gridColor="rgba(138, 43, 226, 0.04)" gridSize={80}>
        
        {/* Header / Title Overlay */}
        <div style={{ position: 'absolute', top: 60, left: 100, fontFamily: "'Poppins', 'Inter', sans-serif" }}>
          <div style={{ color: '#8A2BE2', fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
            Cognee Video Engine
          </div>
          <div style={{ color: '#1A1A1A', fontSize: 48, fontWeight: 800, letterSpacing: -1, marginTop: 8 }}>
            Automated Knowledge Graph Architecture
          </div>
        </div>

        {/* LAYER 2: Animated SVG Curved Connecting Wires */}
        <AnimatedCurvedConnector 
          from={{ x: 380, y: 340 }} 
          to={{ x: 780, y: 540 }} 
          startFrame={18} 
          durationFrames={22}
          color="#8A2BE2"
          strokeWidth={4}
        />

        <AnimatedCurvedConnector 
          from={{ x: 1080, y: 540 }} 
          to={{ x: 1480, y: 340 }} 
          startFrame={35} 
          durationFrames={22}
          color="#00C853"
          strokeWidth={4}
        />

        {/* LAYER 3: Dynamic Floating UI Cards */}
        
        {/* Node 1: Unstructured Input Data */}
        <div 
          style={{ 
            position: 'absolute', 
            left: 100, 
            top: 250, 
            transform: `scale(${card1Scale}) translateY(${card1Y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <PremiumCard width={340} height={200}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8A2BE2' }} />
              <span style={{ color: '#6E6E73', fontSize: 14, fontWeight: 700 }}>DATA INGESTION</span>
            </div>
            <div style={{ color: '#1A1A1A', fontSize: 26, fontWeight: 800, marginTop: 14 }}>
              Raw Documents
            </div>
            <div style={{ color: '#8A2BE2', fontSize: 32, fontWeight: 800, marginTop: 10 }}>
              {metricVal}
            </div>
            <div style={{ color: '#6E6E73', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
              Vectorized & Entity Extracted
            </div>
          </PremiumCard>
        </div>

        {/* Node 2: Cognee LLM Processing Core */}
        <div 
          style={{ 
            position: 'absolute', 
            left: 780, 
            top: 440, 
            transform: `scale(${card2Scale}) translateY(${card2Y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <PremiumCard width={360} height={220} borderRadius={20} style={{ border: '2px solid rgba(138, 43, 226, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#8A2BE2', fontSize: 14, fontWeight: 700 }}>COGNEE CORE ENGINE</span>
              <span style={{ background: 'rgba(138, 43, 226, 0.1)', color: '#8A2BE2', padding: '4px 10px', borderRadius: 12, fontSize: 12 }}>
                ACTIVE
              </span>
            </div>
            <div style={{ color: '#1A1A1A', fontSize: 28, fontWeight: 800, marginTop: 14 }}>
              Knowledge Graph
            </div>
            <div style={{ color: '#00C853', fontSize: 36, fontWeight: 800, marginTop: 8 }}>
              {accuracyVal}
            </div>
            <div style={{ color: '#6E6E73', fontSize: 13, marginTop: 6, fontWeight: 500 }}>
              Deterministic Memory Synthesis
            </div>
          </PremiumCard>
        </div>

        {/* Node 3: Structured Output Insights */}
        <div 
          style={{ 
            position: 'absolute', 
            left: 1440, 
            top: 250, 
            transform: `scale(${card3Scale}) translateY(${card3Y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <PremiumCard width={340} height={200}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00C853' }} />
              <span style={{ color: '#6E6E73', fontSize: 14, fontWeight: 700 }}>OUTPUT PIPELINE</span>
            </div>
            <div style={{ color: '#1A1A1A', fontSize: 26, fontWeight: 800, marginTop: 14 }}>
              Broadcast Video
            </div>
            <div style={{ color: '#1A1A1A', fontSize: 32, fontWeight: 800, marginTop: 10 }}>
              60 FPS Render
            </div>
            <div style={{ color: '#00C853', fontSize: 13, marginTop: 6, fontWeight: 600 }}>
              ✓ Hardware Accelerated MP4
            </div>
          </PremiumCard>
        </div>

      </ProductionBackgroundGrid>
    </AbsoluteFill>
  );
};
