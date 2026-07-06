import { useState, useEffect, useRef } from 'react';
import { Sparkles, Film, Loader2, CheckCircle2, AlertCircle, RefreshCw, Copy, ExternalLink, Clipboard } from 'lucide-react';

interface AgentState {
  status: 'idle' | 'connecting' | 'no_chrome' | 'no_gemini_tab' | 'waiting_for_video' | 'downloading' | 'complete' | 'error';
  message: string;
  cdpPort: number;
  videoFound: boolean;
  clipId: string | null;
  filePath: string | null;
  fileSizeBytes: number;
  error: string | null;
}

interface OmniClip {
  id: string;
  sourceUrl: string | null;
  prompt: string | null;
  usedInMarketing: boolean;
  createdAt: string;
  streamUrl: string;
}

const CHROME_LAUNCH_CMD_WIN = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\\AppData\\Local\\AdeOmniChrome" https://gemini.google.com';

const STATUS_COLOR: Record<string, string> = {
  idle: 'text-slate-500',
  connecting: 'text-indigo-400',
  no_chrome: 'text-rose-400',
  no_gemini_tab: 'text-amber-400',
  waiting_for_video: 'text-purple-400',
  downloading: 'text-blue-400',
  complete: 'text-emerald-400',
  error: 'text-rose-400',
};

export function OmniClipPanel() {
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [clips, setClips] = useState<OmniClip[]>([]);
  const [showSteps, setShowSteps] = useState(true);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll agent status while busy
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/omni/status');
        if (res.ok) {
          const data: AgentState = await res.json();
          setAgent(data);
          if (data.status === 'idle' || data.status === 'complete' || data.status === 'error' || data.status === 'no_chrome' || data.status === 'no_gemini_tab') {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
          if (data.status === 'complete') fetchClips();
        }
      } catch { /* ignore */ }
    };

    tick();
    fetchClips();
    pollRef.current = setInterval(tick, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fetchClips = async () => {
    try {
      const res = await fetch('/api/v1/omni/clips');
      if (res.ok) setClips(await res.json());
    } catch { /* ignore */ }
  };

  const startAgent = async () => {
    try {
      await fetch('/api/v1/omni/reset', { method: 'POST' });
      await fetch('/api/v1/omni/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      // Restart polling
      if (!pollRef.current) {
        pollRef.current = setInterval(async () => {
          try {
            const res = await fetch('/api/v1/omni/status');
            if (res.ok) {
              const data: AgentState = await res.json();
              setAgent(data);
              if (['idle', 'complete', 'error', 'no_chrome', 'no_gemini_tab'].includes(data.status)) {
                if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                if (data.status === 'complete') fetchClips();
              }
            }
          } catch { /* ignore */ }
        }, 1500);
      }
    } catch { /* ignore */ }
  };

  const cancelAgent = async () => {
    try { await fetch('/api/v1/omni/cancel', { method: 'POST' }); } catch { /* ignore */ }
  };

  const deleteClip = async (id: string) => {
    try {
      await fetch(`/api/v1/omni/clips/${id}`, { method: 'DELETE' });
      fetchClips();
    } catch { /* ignore */ }
  };

  const copyChromeCmd = async () => {
    try {
      await navigator.clipboard.writeText(CHROME_LAUNCH_CMD_WIN);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const isBusy = agent && ['connecting', 'waiting_for_video', 'downloading'].includes(agent.status);
  const latestClip = clips[0] || null;
  const nextRenderClip = clips.find(c => !c.usedInMarketing) || null;
  const statusColor = STATUS_COLOR[agent?.status || 'idle'] || STATUS_COLOR.idle;

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300 hover:border-pink-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Sparkles className="w-[18px] h-[18px] text-pink-400" />
          <span>Gemini Omni Clip Bridge</span>
        </h3>
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isBusy ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
          : agent?.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : (agent?.status === 'error' || agent?.status === 'no_chrome' || agent?.status === 'no_gemini_tab') ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          : 'bg-slate-900 text-slate-500 border-slate-800'
        }`}>
          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" />
            : agent?.status === 'complete' ? <CheckCircle2 className="w-3 h-3" />
            : ['error', 'no_chrome', 'no_gemini_tab'].includes(agent?.status || '') ? <AlertCircle className="w-3 h-3" />
            : <Film className="w-3 h-3" />}
          <span>{agent?.status || 'idle'}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Steps banner */}
        {showSteps && (
          <div className="bg-pink-500/5 border border-pink-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-pink-400 uppercase tracking-wider">Setup steps</span>
              <button onClick={() => setShowSteps(false)} className="text-[10px] text-slate-500 hover:text-slate-300">hide</button>
            </div>
            <ol className="text-xs text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
              <li>
                Launch Chrome with debug port:
                <div className="mt-1.5 flex items-center space-x-2">
                  <code className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-pink-300 overflow-x-auto whitespace-nowrap">
                    chrome.exe --remote-debugging-port=9222
                  </code>
                  <button
                    onClick={copyChromeCmd}
                    className="shrink-0 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] text-slate-300 flex items-center space-x-1"
                  >
                    {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy full cmd'}</span>
                  </button>
                </div>
              </li>
              <li>
                Open <a href="https://gemini.google.com" target="_blank" rel="noreferrer" className="text-pink-400 hover:underline inline-flex items-center space-x-1">gemini.google.com <ExternalLink className="w-3 h-3" /></a> in that Chrome window
              </li>
              <li>Click <strong>Start Watching</strong> below — we attach to your Chrome via CDP</li>
              <li>In Gemini, prompt Omni for a 10-second video (give reference images if you want)</li>
              <li>Once it renders, we auto-download and inject it into your next marketing video</li>
            </ol>
          </div>
        )}

        {/* Status banner */}
        {agent && agent.status !== 'idle' && (
          <div className={`p-3.5 rounded-xl border ${
            agent.status === 'error' || agent.status === 'no_chrome' || agent.status === 'no_gemini_tab'
              ? 'bg-rose-500/5 border-rose-500/20'
              : agent.status === 'complete'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-pink-500/5 border-pink-500/20'
          }`}>
            <p className={`text-xs font-bold ${statusColor}`}>{agent.message}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex space-x-2">
          <button
            onClick={startAgent}
            disabled={!!isBusy}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Watching...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{agent?.status === 'complete' ? 'Watch for Another' : 'Start Watching'}</span>
              </>
            )}
          </button>
          {isBusy && (
            <button
              onClick={cancelAgent}
              className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Next-render badge */}
        {nextRenderClip && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Clip <code className="bg-slate-950 px-1.5 py-0.5 rounded text-[10px]">{nextRenderClip.id}</code> will be auto-injected into your next marketing video.</span>
          </div>
        )}

        {/* Latest clip preview */}
        {latestClip && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Latest Omni clip</h4>
            <video
              key={latestClip.id}
              src={latestClip.streamUrl}
              controls
              muted
              className="w-full rounded-xl bg-slate-950 border border-slate-800"
              style={{ aspectRatio: '16/9' }}
            />
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{new Date(latestClip.createdAt).toLocaleString()}</span>
              <button
                onClick={() => deleteClip(latestClip.id)}
                className="text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Older clips list */}
        {clips.length > 1 && (
          <details className="text-xs text-slate-400">
            <summary className="cursor-pointer hover:text-slate-200">All clips ({clips.length})</summary>
            <ul className="mt-2 space-y-1">
              {clips.slice(1).map(c => (
                <li key={c.id} className="flex items-center justify-between bg-slate-950/50 rounded p-2">
                  <span className="font-mono text-[10px]">{c.id}</span>
                  <div className="flex items-center space-x-2">
                    {c.usedInMarketing && <span className="text-[9px] uppercase text-slate-500">used</span>}
                    <button onClick={() => deleteClip(c.id)} className="text-rose-400 text-[10px]">del</button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
