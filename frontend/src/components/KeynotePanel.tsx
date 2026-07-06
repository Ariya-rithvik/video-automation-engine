import React from 'react';
import { Play, Pause, RefreshCw, Volume2, VolumeX, ShieldCheck } from 'lucide-react';

interface KeynotePanelProps {
  children: React.ReactNode;
  stepName: string;
  scriptText: string;
  isMuted: boolean;
  onToggleMute: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  status: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'IDLE';
}

export const KeynotePanel: React.FC<KeynotePanelProps> = ({
  children,
  stepName,
  scriptText,
  isMuted,
  onToggleMute,
  isPlaying,
  onTogglePlay,
  onReset,
  status,
}) => {
  return (
    <div className="perspective-1000 w-full max-w-4xl mx-auto my-6">
      <div className="preserve-3d rotate-y-keystone transition-transform duration-700 ease-out hover:rotate-y-0 hover:rotate-x-0 group">
        
        {/* Decorative ambient glowing ring behind the board */}
        <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-brand-500 to-indigo-500 opacity-20 blur-xl group-hover:opacity-40 transition duration-700"></div>

        {/* The Digital Keynote Board Container */}
        <div className="relative bg-glass rounded-2xl overflow-hidden shadow-glass hover:shadow-glass-hover transition-all duration-500 border border-slate-700/50">
          
          {/* Header Bar simulating Chrome / OS Window */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500/80 block"></span>
              <span className="w-3 h-3 rounded-full bg-green-500/80 block"></span>
              <span className="text-xs text-slate-400 font-medium pl-2 select-none tracking-wide">
                Keynote Presentation - {stepName || 'Select Segment'}
              </span>
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center space-x-3">
              {status === 'SUCCESS' && (
                <div className="flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified SUCCESS</span>
                </div>
              )}
              {status === 'FAILURE' && (
                <div className="flex items-center space-x-1.5 bg-rose-500/10 text-rose-400 px-2.5 py-0.5 rounded-full border border-rose-500/20 text-xs font-semibold uppercase tracking-wider">
                  <span>SYSTEM ERROR</span>
                </div>
              )}
            </div>
          </div>

          {/* The Visual Stage (Main viewport) */}
          <div className="relative bg-slate-950 aspect-video w-full flex items-center justify-center overflow-hidden">
            {children}
            
            {/* Ambient scanlines over the screen */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-brand-500/[0.01] to-transparent bg-[length:100%_4px] opacity-60"></div>
          </div>

          {/* Keynote Footer with synced controls & Voiceover display */}
          <div className="bg-slate-900/90 p-4 border-t border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Media Controls */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={onTogglePlay}
                  className="p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-md active:scale-95"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                </button>
                <button
                  onClick={onReset}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all active:scale-95"
                  title="Reset Segment"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  onClick={onToggleMute}
                  className={`p-2.5 rounded-xl transition-all active:scale-95 ${
                    isMuted 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                  title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>

              {/* Script Subtitle Overlay */}
              <div className="flex-1 bg-slate-950/80 rounded-xl border border-slate-800/80 p-3.5 md:mx-4">
                <div className="text-xs text-brand-500 uppercase tracking-widest font-bold mb-1">
                  AI Presenter voiceover
                </div>
                <p className="text-sm font-medium text-slate-100 leading-relaxed italic">
                  "{scriptText || 'Generating presentation script from execution steps...'}"
                </p>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
