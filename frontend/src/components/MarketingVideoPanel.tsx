import { useState, useEffect, useRef } from 'react';
import { Film, Loader2, CheckCircle2, AlertCircle, Sparkles, Play, RefreshCw } from 'lucide-react';

interface MarketingVideoPanelProps {
  crawlId: string | null;
}

interface AgentState {
  status: 'idle' | 'directing' | 'bundling' | 'rendering' | 'complete' | 'error';
  message: string;
  crawlId: string | null;
  progress: number;
  jobId: string | null;
  videoPath: string | null;
  error: string | null;
}

interface Result {
  id: string;
  crawlId: string;
  status: string;
  durationSeconds: number;
  error: string | null;
  createdAt: string;
  streamUrl: string | null;
  shortsStreamUrl?: string | null;
  scenePlan?: any;
}

const STATUS_COLOR: Record<string, string> = {
  idle: 'text-slate-500',
  directing: 'text-indigo-400',
  bundling: 'text-blue-400',
  rendering: 'text-purple-400',
  complete: 'text-emerald-400',
  error: 'text-rose-400',
};

export function MarketingVideoPanel({ crawlId }: MarketingVideoPanelProps) {
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status — start fast (component mount), keep going while busy
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/v1/marketing/status');
        if (res.ok) {
          const data: AgentState = await res.json();
          setAgentState(data);

          if (data.status === 'complete' && data.crawlId) {
            fetchResult(data.crawlId);
          }

          if (data.status === 'idle' || data.status === 'complete' || data.status === 'error') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch { /* ignore */ }
    };

    pollStatus();
    pollRef.current = setInterval(pollStatus, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Load existing result whenever the selected crawl changes
  useEffect(() => {
    if (crawlId) fetchResult(crawlId);
    else setResult(null);
  }, [crawlId]);

  const fetchResult = async (cId: string) => {
    try {
      const res = await fetch(`/api/v1/marketing/result/${cId}`);
      if (res.ok) setResult(await res.json());
    } catch { /* ignore */ }
  };

  const start = async () => {
    if (!crawlId) return;
    setLoading(true);

    try {
      const res = await fetch('/api/v1/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crawlId }),
      });
      const data = await res.json();

      if (res.ok || res.status === 202) {
        setAgentState(data.status);
        // Restart polling
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const sRes = await fetch('/api/v1/marketing/status');
              if (sRes.ok) {
                const sData: AgentState = await sRes.json();
                setAgentState(sData);
                if (sData.status === 'complete' && sData.crawlId) {
                  fetchResult(sData.crawlId);
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                } else if (sData.status === 'error') {
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                }
              }
            } catch { /* ignore */ }
          }, 2000);
        }
      } else {
        setAgentState({
          status: 'error', message: data.error, crawlId, progress: 0,
          jobId: null, videoPath: null, error: data.error,
        });
      }
    } catch (err: any) {
      setAgentState({
        status: 'error', message: 'Failed to start marketing pipeline', crawlId,
        progress: 0, jobId: null, videoPath: null, error: String(err),
      });
    } finally {
      setLoading(false);
    }
  };

  const isActive = agentState && !['idle', 'complete', 'error'].includes(agentState.status);
  const statusColor = STATUS_COLOR[agentState?.status || 'idle'] || STATUS_COLOR.idle;

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300 hover:border-purple-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Film className="w-[18px] h-[18px] text-purple-400" />
          <span>Marketing Video (Gemini + Remotion)</span>
        </h3>
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isActive
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : agentState?.status === 'complete'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : agentState?.status === 'error'
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-slate-900 text-slate-500 border-slate-800'
        }`}>
          {isActive ? <Loader2 className="w-3 h-3 animate-spin" />
            : agentState?.status === 'complete' ? <CheckCircle2 className="w-3 h-3" />
            : agentState?.status === 'error' ? <AlertCircle className="w-3 h-3" />
            : <Film className="w-3 h-3" />}
          <span>{agentState?.status || 'idle'}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Status banner */}
        {agentState && agentState.status !== 'idle' && (
          <div className={`p-3.5 rounded-xl border ${
            agentState.status === 'error'
              ? 'bg-rose-500/5 border-rose-500/20'
              : agentState.status === 'complete'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-purple-500/5 border-purple-500/20'
          }`}>
            <p className={`text-xs font-bold ${statusColor}`}>{agentState.message}</p>

            {/* Progress bar — only meaningful during render */}
            {(agentState.status === 'bundling' || agentState.status === 'rendering') && (
              <div className="mt-2.5">
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.round(agentState.progress * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={start}
          disabled={!crawlId || loading || !!isActive}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
        >
          {isActive ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generating video...</span>
            </>
          ) : agentState?.status === 'complete' ? (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Regenerate Marketing Video</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate Marketing Video</span>
            </>
          )}
        </button>

        {!crawlId && (
          <p className="text-[10px] text-slate-500 text-center">
            Select a crawl above to generate a marketing video.
          </p>
        )}

        {/* Result */}
        {result && result.streamUrl && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Play className="w-3.5 h-3.5" />
                <span>Rendered Video</span>
              </h4>
              <span className="text-[10px] text-slate-500">{result.durationSeconds?.toFixed(1)}s</span>
            </div>
            {/* 16:9 landscape */}
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Landscape 16:9</div>
            <video
              key={result.id}
              src={result.streamUrl}
              controls
              className="w-full rounded-xl bg-slate-950 border border-slate-800"
              style={{ aspectRatio: '16/9' }}
            />

            {/* 9:16 vertical Shorts — only when available */}
            {result.shortsStreamUrl && (
              <>
                <div className="text-[10px] font-bold text-pink-400 uppercase tracking-wider pt-1">Shorts 9:16</div>
                <video
                  key={result.id + '-shorts'}
                  src={result.shortsStreamUrl}
                  controls
                  className="rounded-xl bg-slate-950 border border-slate-800 mx-auto"
                  style={{ aspectRatio: '9/16', maxHeight: 480 }}
                />
              </>
            )}

            <div className="text-[10px] text-slate-500 text-right">
              {new Date(result.createdAt).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
