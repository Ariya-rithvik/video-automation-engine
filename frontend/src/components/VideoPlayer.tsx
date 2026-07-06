import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Terminal, CheckCircle2 } from 'lucide-react';

interface VideoPlayerProps {
  demoId: string | null;
  videoUrl: string | null;
  isPlaying: boolean;
  onEnded: () => void;
  stepName: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  demoId,
  videoUrl,
  isPlaying,
  onEnded,
  stepName,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [useSimulation, setUseSimulation] = useState(false);
  const [progress, setProgress] = useState(0);

  // Sync video play/pause with prop
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && !useSimulation) {
        videoRef.current.play().catch(() => {
          // If video fails to play (e.g., dummy video files seeded), fall back to beautiful canvas simulation!
          setUseSimulation(true);
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, useSimulation, videoUrl]);

  // Reset simulation when demoId changes
  useEffect(() => {
    setUseSimulation(false);
    setProgress(0);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [demoId]);

  // Canvas Simulation Animation Loop
  useEffect(() => {
    if (!useSimulation || !canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let localProgress = progress;

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw premium tech-grid background
      ctx.strokeStyle = 'rgba(0, 102, 255, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Progress calculation (10 seconds total segment loop)
      localProgress += 0.01;
      if (localProgress >= 1) {
        localProgress = 0;
        onEnded(); // Loop completed
      }
      setProgress(localProgress);

      // Render step specific high-fidelity simulations
      const cleanStep = stepName.toLowerCase();
      if (cleanStep.includes('auth') || cleanStep.includes('login')) {
        drawAuthenticationSim(ctx, canvas.width, canvas.height, localProgress);
      } else if (cleanStep.includes('dashboard') || cleanStep.includes('main')) {
        drawDashboardSim(ctx, canvas.width, canvas.height, localProgress);
      } else if (cleanStep.includes('settings') || cleanStep.includes('config')) {
        drawSettingsSim(ctx, canvas.width, canvas.height, localProgress);
      } else {
        drawDefaultSim(ctx, canvas.width, canvas.height, localProgress, stepName);
      }

      // Draw active timer bar at bottom
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(20, canvas.height - 20, canvas.width - 40, 6);
      ctx.fillStyle = 'rgba(0, 102, 255, 0.85)';
      ctx.fillRect(20, canvas.height - 20, (canvas.width - 40) * localProgress, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [useSimulation, isPlaying, stepName]);

  // Simulation Renderers
  const drawAuthenticationSim = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    // Glass card background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    const cardW = 380;
    const cardH = 260;
    const cardX = (w - cardW) / 2;
    const cardY = (h - cardH) / 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 16, true, true);

    // Glowing border ring
    ctx.shadowColor = 'rgba(0, 102, 255, 0.4)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = 'rgba(0, 102, 255, 0.5)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 16, false, true);
    ctx.shadowBlur = 0; // reset

    // Draw Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('VisionAgent Secure Gateway', cardX + 30, cardY + 45);

    // Input fields styling
    ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, cardX + 30, cardY + 70, cardW - 60, 40, 8, true, true);
    roundRect(ctx, cardX + 30, cardY + 130, cardW - 60, 40, 8, true, true);

    // Username input text typing animation
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Inter, sans-serif';
    const email = 'developer@visionagent.ai';
    const emailCharCount = Math.floor(Math.min(t * 2.5, 1) * email.length);
    ctx.fillText(email.substring(0, emailCharCount) + (t < 0.4 && t * 10 % 2 === 0 ? '|' : ''), cardX + 45, cardY + 95);

    // Password typing dots animation
    const pwDots = '•••••••••••••';
    const pwProgress = Math.max(0, (t - 0.45) / 0.35);
    const pwCharCount = Math.floor(Math.min(pwProgress, 1) * pwDots.length);
    ctx.fillText(pwDots.substring(0, pwCharCount) + (t >= 0.45 && t < 0.8 && t * 10 % 2 === 0 ? '|' : ''), cardX + 45, cardY + 155);

    // Verify authentication button
    if (t > 0.85) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)'; // emerald
      roundRect(ctx, cardX + 30, cardY + 195, cardW - 60, 40, 8, true, false);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓ ACCESS GRANTED', w / 2, cardY + 220);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(0, 102, 255, 0.8)';
      roundRect(ctx, cardX + 30, cardY + 195, cardW - 60, 40, 8, true, false);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AUTHENTICATING...', w / 2, cardY + 220);
      ctx.textAlign = 'left';
    }
  };

  const drawDashboardSim = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    // Draw telemetry dashboard structure
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    roundRect(ctx, 30, 30, w - 60, h - 70, 12, true, true);

    // Sidebar
    ctx.fillStyle = 'rgba(8, 14, 28, 0.8)';
    roundRect(ctx, 30, 30, 160, h - 70, 12, true, false);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(30, 30, 160, h - 70);

    // Sidebar items
    ctx.fillStyle = 'rgba(0, 102, 255, 0.15)';
    roundRect(ctx, 40, 50, 140, 32, 6, true, false);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.fillText('Live Dashboard', 55, 71);

    ctx.fillStyle = '#64748b';
    ctx.fillText('System Status', 55, 121);
    ctx.fillText('DB Cluster 1', 55, 171);
    ctx.fillText('Settings API', 55, 221);

    // Main section
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillText('Real-Time Telemetry Feed', 215, 65);

    // Draw SVG metric cards
    const cardW = 160;
    const cardH = 80;
    const cardY = 90;
    
    // CPU Card
    ctx.fillStyle = 'rgba(30, 41, 59, 0.5)';
    roundRect(ctx, 215, cardY, cardW, cardH, 8, true, true);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('SYSTEM WORKLOAD', 225, cardY + 25);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px Outfit, sans-serif';
    const cpuVal = Math.floor(45 + Math.sin(t * 15) * 15);
    ctx.fillText(`${cpuVal}%`, 225, cardY + 55);

    // Network Card
    roundRect(ctx, 395, cardY, cardW, cardH, 8, true, true);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText('WEBSOCKET PACKETS', 405, cardY + 25);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 22px Outfit, sans-serif';
    const packets = Math.floor(1000 + t * 450);
    ctx.fillText(`${packets} / s`, 405, cardY + 55);

    // Render rise diagram
    ctx.strokeStyle = 'rgba(0, 102, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(215, 300);
    
    const steps = 30;
    const stepW = 320 / steps;
    for (let i = 0; i <= Math.floor(t * steps); i++) {
      const x = 215 + i * stepW;
      const y = 300 - Math.sin(i * 0.4 + t * 5) * 45 - Math.sin(i * 0.1) * 20;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw grid bounds under graph
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(215, 305);
    ctx.lineTo(535, 305);
    ctx.stroke();
  };

  const drawSettingsSim = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => {
    // Settings configuration modal interface
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    const modalW = 440;
    const modalH = 280;
    const modalX = (w - modalW) / 2;
    const modalY = (h - modalH) / 2;
    roundRect(ctx, modalX, modalY, modalW, modalH, 14, true, true);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.fillText('Advanced Alert Parameters', modalX + 30, modalY + 45);

    // Option 1
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText('Auto-Ingest Watcher Monitoring', modalX + 30, modalY + 95);
    
    // Toggle switch
    ctx.fillStyle = 'rgba(0, 102, 255, 0.8)';
    roundRect(ctx, modalX + 330, modalY + 80, 50, 24, 12, true, false);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(modalX + 368, modalY + 92, 9, 0, Math.PI * 2);
    ctx.fill();

    // Option 2 Slider
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Telemetry Slice Frame Length', modalX + 30, modalY + 160);
    
    // Slider bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, modalX + 30, modalY + 185, 380, 8, 4, true, false);

    const sliderProgress = Math.min(t * 1.35, 1);
    ctx.fillStyle = 'rgba(0, 102, 255, 0.8)';
    roundRect(ctx, modalX + 30, modalY + 185, 380 * sliderProgress, 8, 4, true, false);

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(modalX + 30 + 380 * sliderProgress, modalY + 189, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.fillText(`${Math.floor(sliderProgress * 100)}%`, modalX + 380, modalY + 155);

    // Save button trigger
    if (t > 0.8) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      roundRect(ctx, modalX + 30, modalY + 220, 380, 36, 8, true, false);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✓ CONFIGURATION COMMITTED TO LEDGER', w / 2, modalY + 242);
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = 'rgba(30, 41, 59, 0.6)';
      roundRect(ctx, modalX + 30, modalY + 220, 380, 36, 8, true, true);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('COMMIT CONFIGURATION', w / 2, modalY + 242);
      ctx.textAlign = 'left';
    }
  };

  const drawDefaultSim = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, name: string) => {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    roundRect(ctx, 40, 40, w - 80, h - 90, 12, true, true);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Executing Segment: ${name}`, w / 2, h / 2 - 30);

    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Synthesizing visual environment details...', w / 2, h / 2 + 10);

    // Drawing loading spinner
    ctx.strokeStyle = 'rgba(0, 102, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 60, 20, t * Math.PI * 2, (t + 0.75) * Math.PI * 2);
    ctx.stroke();
    
    ctx.textAlign = 'left';
  };

  // Helper function to draw rounded rectangles in canvas
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill = true,
    stroke = false
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  return (
    <div className="relative w-full h-full min-h-[380px] bg-slate-950 flex items-center justify-center">
      {useSimulation ? (
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full object-cover max-w-full rounded-b-xl"
        />
      ) : (
        <>
          {videoUrl ? (
            <video
              ref={videoRef}
              src={videoUrl}
              onEnded={onEnded}
              onError={() => setUseSimulation(true)}
              className="w-full h-full object-cover max-w-full rounded-b-xl"
              playsInline
              muted
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
              <div className="p-4 rounded-full bg-brand-500/10 text-brand-500 animate-pulse border border-brand-500/20">
                <Sparkles className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white uppercase tracking-wider">
                Waiting for Video Payload
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Trigger a demo pipeline verification step or upload a telemetry run in the watched folder to generate the high-fidelity keynote cuts.
              </p>
            </div>
          )}
        </>
      )}

      {/* Floating Info Overlay */}
      {demoId && (
        <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur border border-slate-800/80 px-3 py-2 rounded-xl flex items-center space-x-2.5 shadow-lg select-none">
          {useSimulation ? (
            <div className="flex items-center space-x-1 text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
              <Terminal className="w-3 h-3" />
              <span>VFX SIMULATOR</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3 h-3" />
              <span>RECORDING STREAM</span>
            </div>
          )}
          <div className="h-4 w-[1px] bg-slate-800"></div>
          <span className="text-xs font-semibold text-slate-200">{stepName}</span>
        </div>
      )}
    </div>
  );
};
