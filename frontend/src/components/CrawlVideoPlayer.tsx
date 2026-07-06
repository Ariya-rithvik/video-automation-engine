import { useRef, useState } from 'react';
import { Video, Download, Play } from 'lucide-react';

interface CrawlVideoPlayerProps {
  videoUrl: string | null;
  title: string;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export function CrawlVideoPlayer({ videoUrl, title }: CrawlVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speed, setSpeed] = useState(1);

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  };

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300 hover:border-brand-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Video className="w-[18px] h-[18px] text-brand-500" />
          <span>{title || 'Crawl Recording'}</span>
        </h3>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[10px] font-bold text-slate-400 hover:text-white transition-all"
          >
            <Download className="w-3 h-3" />
            <span>Download</span>
          </a>
        )}
      </div>

      {/* Video area */}
      {videoUrl ? (
        <>
          <div className="relative bg-slate-950 aspect-video w-full">
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="w-full h-full object-contain"
              playsInline
            />
          </div>

          {/* Speed controls */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-900/50">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Playback Speed</span>
            <div className="flex items-center space-x-1.5">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSpeedChange(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    speed === s
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'bg-slate-950 text-slate-500 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-slate-950/50">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 mb-4">
            <Play className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-xs text-slate-400 font-semibold">No recording available</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] text-center">
            Start a crawl to capture a real browser session video.
          </p>
        </div>
      )}
    </div>
  );
}
