import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { ProductionBackgroundGrid, PremiumCard, AnimatedCurvedConnector } from '../components';
import { useAESnapSpring, animatedNumber } from '../animations';
import { GlowOrb, ParticleField } from '../effects';

export const CogneeMographDemoFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── 1. Continuous 3D Camera Drift & Tilt ───────────────────────────────────
  const cameraRotateX = interpolate(frame, [0, 180], [10, 4], { extrapolateRight: 'clamp' });
  const cameraRotateY = interpolate(frame, [0, 180], [-12, -4], { extrapolateRight: 'clamp' });
  const cameraScale = interpolate(frame, [0, 180], [0.95, 1.05], { extrapolateRight: 'clamp' });

  // ─── 2. Snappy AE Spring Animations for Cards ──────────────────────────────
  const card1Scale = useAESnapSpring({ delayFrames: 0, from: 0.3, to: 1, frame, fps });
  const card1Y = useAESnapSpring({ delayFrames: 0, from: 80, to: 0, frame, fps });

  const card2Scale = useAESnapSpring({ delayFrames: 15, from: 0.3, to: 1, frame, fps });
  const card2Y = useAESnapSpring({ delayFrames: 15, from: 80, to: 0, frame, fps });

  const card3Scale = useAESnapSpring({ delayFrames: 30, from: 0.3, to: 1, frame, fps });
  const card3Y = useAESnapSpring({ delayFrames: 30, from: 80, to: 0, frame, fps });

  // Floating oscillation for dynamic 3D depth
  const float1 = Math.sin((frame / fps) * 2.5) * 8;
  const float2 = Math.cos((frame / fps) * 2.5) * 10;
  const float3 = Math.sin((frame / fps) * 2.0 + 1) * 8;

  // Animated metric numbers
  const metricVal = animatedNumber(frame, 20, 40, '$7,500,000');
  const accuracyVal = animatedNumber(frame, 35, 30, '99.8%');

  return (
    <AbsoluteFill style={{ backgroundColor: '#f8f9fa', overflow: 'hidden' }}>
      
      {/* LAYER 1: Subtle Ambient Radial Glow Orbs */}
      <GlowOrb color="#8A2BE2" size={900} x="20%" y="30%" opacity={0.12} blur={100} />
      <GlowOrb color="#00C853" size={800} x="80%" y="70%" opacity={0.10} blur={110} />
      <GlowOrb color="#3B82F6" size={700} x="50%" y="50%" opacity={0.08} blur={90} />

      {/* Ambient Particle Field for 3D depth */}
      <ParticleField count={25} color="#8A2BE2" minSize={2} maxSize={4} speed={0.4} />

      {/* LAYER 2: Structural Faint Grid (80px micro technical grid, NOT block slides) */}
      <ProductionBackgroundGrid bgColor="transparent" gridColor="rgba(138, 43, 226, 0.035)" gridSize={80}>
        
        {/* Header / Title Overlay (Sleek Modern SaaS Branding) */}
        <div style={{ position: 'absolute', top: 50, left: 90, fontFamily: "'Poppins', 'Inter', sans-serif", zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'linear-gradient(135deg, #8A2BE2, #4A00E0)', padding: '6px 14px', borderRadius: 20, color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 1.5 }}>
              COGNEE PROMO ENGINE
            </div>
            <span style={{ color: '#6E6E73', fontSize: 14, fontWeight: 600 }}>v2.4 Autonomous Pipeline</span>
          </div>
          <div style={{ color: '#1A1A1A', fontSize: 44, fontWeight: 800, letterSpacing: -1.5, marginTop: 12, lineHeight: 1.1 }}>
            Automated Knowledge Graph Architecture
          </div>
        </div>

        {/* ─── 3D CAMERA STAGE ─────────────────────────────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            perspective: '1200px',
            transformStyle: 'preserve-3d',
            transform: `scale(${cameraScale}) rotateX(${cameraRotateX}deg) rotateY(${cameraRotateY}deg)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* LAYER 3: Animated SVG Curved Connecting Wires */}
          <AnimatedCurvedConnector 
            from={{ x: 420, y: 360 }} 
            to={{ x: 800, y: 550 }} 
            startFrame={18} 
            durationFrames={22}
            color="#8A2BE2"
            strokeWidth={4}
          />

          <AnimatedCurvedConnector 
            from={{ x: 1160, y: 550 }} 
            to={{ x: 1520, y: 360 }} 
            startFrame={35} 
            durationFrames={22}
            color="#00C853"
            strokeWidth={4}
          />

          {/* LAYER 4: Dynamic Floating 3D Cards */}
          
          {/* Card 1: Data Ingestion Node */}
          <div 
            style={{ 
              position: 'absolute', 
              left: 100, 
              top: 260, 
              transform: `scale(${card1Scale}) translateY(${card1Y + float1}px) rotateY(6deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <PremiumCard width={360} height={220} borderRadius={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#8A2BE2', boxShadow: '0 0 10px #8A2BE2' }} />
                  <span style={{ color: '#6E6E73', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>DATA INGESTION</span>
                </div>
                <span style={{ background: '#f0e6ff', color: '#8A2BE2', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                  LIVE
                </span>
              </div>
              <div style={{ color: '#1A1A1A', fontSize: 24, fontWeight: 800, marginTop: 14 }}>
                Unstructured Vector Stream
              </div>
              <div style={{ color: '#8A2BE2', fontSize: 36, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>
                {metricVal}
              </div>
              <div style={{ color: '#6E6E73', fontSize: 13, marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#8A2BE2' }}>⚡</span> Entity Extraction & Chunking
              </div>
            </PremiumCard>
          </div>

          {/* Card 2: Cognee Core Processing Engine (Hero Center Piece) */}
          <div 
            style={{ 
              position: 'absolute', 
              left: 780, 
              top: 430, 
              transform: `scale(${card2Scale}) translateY(${card2Y + float2}px) translateZ(40px) rotateY(-4deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <PremiumCard 
              width={380} 
              height={240} 
              borderRadius={24} 
              style={{ 
                border: '2px solid rgba(138, 43, 226, 0.3)',
                boxShadow: '0 35px 80px rgba(138, 43, 226, 0.15), 0 10px 25px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#8A2BE2', fontSize: 13, fontWeight: 800, letterSpacing: 1.2 }}>COGNEE GRAPH ENGINE</span>
                <span style={{ background: '#00C853', color: '#ffffff', padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 800, boxShadow: '0 4px 12px rgba(0,200,83,0.3)' }}>
                  ● ACTIVE CORE
                </span>
              </div>
              <div style={{ color: '#1A1A1A', fontSize: 28, fontWeight: 800, marginTop: 14 }}>
                Deterministic Memory
              </div>
              <div style={{ color: '#00C853', fontSize: 42, fontWeight: 800, marginTop: 6, letterSpacing: -1 }}>
                {accuracyVal}
              </div>
              <div style={{ color: '#6E6E73', fontSize: 13, marginTop: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#00C853' }}>✓</span> Real-Time Graph Synthesis
              </div>
            </PremiumCard>
          </div>

          {/* Card 3: Broadcast Video Output */}
          <div 
            style={{ 
              position: 'absolute', 
              left: 1440, 
              top: 260, 
              transform: `scale(${card3Scale}) translateY(${card3Y + float3}px) rotateY(-8deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <PremiumCard width={360} height={220} borderRadius={20}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#00C853', boxShadow: '0 0 10px #00C853' }} />
                  <span style={{ color: '#6E6E73', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>BROADCAST RENDER</span>
                </div>
                <span style={{ background: '#e6f9ed', color: '#00C853', padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
                  READY
                </span>
              </div>
              <div style={{ color: '#1A1A1A', fontSize: 24, fontWeight: 800, marginTop: 14 }}>
                60 FPS Video Stream
              </div>
              <div style={{ color: '#1A1A1A', fontSize: 34, fontWeight: 800, marginTop: 8, letterSpacing: -1 }}>
                4K Ultra MP4
              </div>
              <div style={{ color: '#00C853', fontSize: 13, marginTop: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎬</span> Hardware Accelerated FFmpeg
              </div>
            </PremiumCard>
          </div>

        </div>

      </ProductionBackgroundGrid>
    </AbsoluteFill>
  );
};
