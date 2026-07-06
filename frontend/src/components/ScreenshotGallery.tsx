import { useState, useEffect } from 'react';
import { Image, Maximize2, X, RefreshCw, Eye } from 'lucide-react';

interface ScreenshotGalleryProps {
  refreshTrigger: number;
}

export function ScreenshotGallery({ refreshTrigger }: ScreenshotGalleryProps) {
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  const fetchScreenshots = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/supervisor/screenshots');
      if (res.ok) {
        const data = await res.json();
        setScreenshots(data);
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScreenshots();
  }, [refreshTrigger]);

  const getPageLabel = (filename: string) => {
    // screenshot-Main_Dashboard.png -> Main Dashboard
    const nameWithoutPrefix = filename.replace('screenshot-', '').replace('.png', '');
    return nameWithoutPrefix.replace(/_/g, ' ');
  };

  return (
    <div className="bg-glass-heavy rounded-2xl p-5 border border-slate-800 shadow-lg transition-all duration-300 hover:border-brand-500/20">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4 select-none">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Image className="w-[18px] h-[18px] text-brand-500" />
          <span>Supervisor Feature Visualizer</span>
        </h3>
        <button
          onClick={fetchScreenshots}
          disabled={loading}
          className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          title="Refresh screenshot vault"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="text-[11px] text-slate-400 mb-4 bg-brand-500/5 border border-brand-500/10 p-2.5 rounded-xl leading-relaxed">
        <p className="font-semibold text-brand-400 flex items-center space-x-1.5 mb-1">
          <Eye className="w-3.5 h-3.5" />
          <span>Visual Feature Recording Engine</span>
        </p>
        <span>
          Antigravity uses the Supervisor specifically to discover features, capture high-res page screenshots, and record live session flows.
          <strong className="text-slate-300"> Bug fixes are intentionally decoupled</strong> to focus solely on flawless visual record keeping.
        </span>
      </div>

      {loading && screenshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2">
          <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Scanning screenshot vault...</span>
        </div>
      ) : screenshots.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/20">
          <Image className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
          <p className="text-xs text-slate-400 font-semibold">No screenshots captured yet</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">
            Input a URL above and trigger the Supervisor Crawl to snap app pages in high fidelity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 max-h-[280px] overflow-y-auto pr-1">
          {screenshots.map((file) => (
            <div
              key={file}
              onClick={() => setSelectedScreenshot(file)}
              className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60 transition-all duration-300 hover:border-brand-500/40 hover:shadow-md hover:shadow-brand-500/5"
            >
              {/* Premium thumbnail */}
              <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900 flex items-center justify-center relative">
                <img
                  src={`/api/v1/stream/screenshot/${file}`}
                  alt={getPageLabel(file)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to nice visual placeholder if stream fails
                    e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100%' height='100%' fill='%230f172a'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23475569' font-size='10'>Feature Preview</text></svg>";
                  }}
                />
                
                {/* Visual hover indicator */}
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                  <Maximize2 className="w-5 h-5 text-white transform scale-90 group-hover:scale-100 transition-all duration-300" />
                </div>
              </div>

              {/* Title tag */}
              <div className="p-2 border-t border-slate-900 bg-slate-950/80">
                <p className="text-[10px] font-bold text-slate-300 truncate tracking-wide">
                  {getPageLabel(file)}
                </p>
                <span className="text-[8px] text-brand-400 font-bold uppercase tracking-wider">
                  Verified Feature
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Premium zoomed image modal overlay */}
      {selectedScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md transition-all duration-300">
          <div className="relative max-w-4xl w-full p-4 mx-4 flex flex-col items-center bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl animate-scale-up">
            
            {/* Modal header */}
            <div className="w-full flex items-center justify-between pb-3.5 mb-4 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  {getPageLabel(selectedScreenshot)}
                </h4>
                <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest mt-0.5">
                  Pixel-Perfect High Fidelity Capture
                </p>
              </div>
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal content image frame */}
            <div className="w-full aspect-[16/10] overflow-hidden rounded-2xl border border-slate-950 bg-slate-950/50 flex items-center justify-center p-2 relative">
              <img
                src={`/api/v1/stream/screenshot/${selectedScreenshot}`}
                alt={getPageLabel(selectedScreenshot)}
                className="max-h-[550px] object-contain rounded-lg shadow-inner"
              />
            </div>

            {/* Modal footer information */}
            <div className="w-full mt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <span className="bg-slate-950/80 px-3 py-1 rounded-full border border-slate-800/60 font-mono">
                Asset Name: {selectedScreenshot}
              </span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                <span>Active Visual Record Verified</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
