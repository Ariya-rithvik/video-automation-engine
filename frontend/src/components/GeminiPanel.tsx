import { useState, useEffect, useRef } from 'react';
import { Sparkles, Brain, AlertCircle, CheckCircle2, RefreshCw, Upload, Loader2, LogIn, Copy, Check } from 'lucide-react';

interface GeminiPanelProps {
  crawlId: string | null;
  onRefresh?: () => void;
}

interface AgentStatus {
  status: string;
  message: string;
  crawlId: string | null;
  result: string | null;
  error: string | null;
}

interface GeminiResult {
  id: string;
  crawlId: string;
  prompt: string;
  response: string;
  screenshotsUsed: string[];
  videoUsed: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; pulse: boolean }> = {
  idle: { color: 'text-slate-500', icon: <Brain className="w-4 h-4" />, pulse: false },
  launching: { color: 'text-blue-400', icon: <Loader2 className="w-4 h-4 animate-spin" />, pulse: true },
  waiting_for_login: { color: 'text-yellow-400', icon: <LogIn className="w-4 h-4" />, pulse: true },
  logged_in: { color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" />, pulse: false },
  uploading: { color: 'text-blue-400', icon: <Upload className="w-4 h-4 animate-bounce" />, pulse: true },
  prompting: { color: 'text-indigo-400', icon: <Sparkles className="w-4 h-4" />, pulse: true },
  generating: { color: 'text-purple-400', icon: <Brain className="w-4 h-4 animate-pulse" />, pulse: true },
  extracting: { color: 'text-cyan-400', icon: <RefreshCw className="w-4 h-4 animate-spin" />, pulse: true },
  complete: { color: 'text-emerald-400', icon: <CheckCircle2 className="w-4 h-4" />, pulse: false },
  error: { color: 'text-rose-400', icon: <AlertCircle className="w-4 h-4" />, pulse: false },
};

export function GeminiPanel({ crawlId, onRefresh }: GeminiPanelProps) {
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [result, setResult] = useState<GeminiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Poll agent status when busy
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/v1/gemini/status');
        if (res.ok) {
          const data = await res.json();
          setAgentStatus(data);

          // If complete with result, fetch the saved result
          if (data.status === 'complete' && data.crawlId && data.result) {
            fetchResult(data.crawlId);
          }

          // Stop polling when done
          if (data.status === 'idle' || data.status === 'complete' || data.status === 'error') {
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        }
      } catch { /* ignore */ }
    };

    pollStatus();
    pollRef.current = setInterval(pollStatus, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Fetch saved result for the current crawl
  const fetchResult = async (cId: string) => {
    try {
      const res = await fetch(`/api/v1/gemini/result/${cId}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch { /* ignore */ }
  };

  // Load existing result if crawlId changes
  useEffect(() => {
    if (crawlId) {
      fetchResult(crawlId);
    }
  }, [crawlId]);

  const startGeneration = async () => {
    if (!crawlId) return;
    setLoading(true);

    try {
      const body: any = { crawlId };
      if (customPrompt.trim()) body.customPrompt = customPrompt.trim();

      const res = await fetch('/api/v1/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setAgentStatus(data.status);
        // Start polling
        if (!pollRef.current) {
          pollRef.current = setInterval(async () => {
            try {
              const statusRes = await fetch('/api/v1/gemini/status');
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                setAgentStatus(statusData);
                if (statusData.status === 'complete' && statusData.crawlId) {
                  fetchResult(statusData.crawlId);
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                }
                if (statusData.status === 'error') {
                  if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
                }
              }
            } catch { /* ignore */ }
          }, 2000);
        }
      } else {
        setAgentStatus({ status: 'error', message: data.error, crawlId, result: null, error: data.error });
      }
    } catch (err) {
      setAgentStatus({ status: 'error', message: 'Failed to start agent', crawlId, result: null, error: 'Connection failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result?.response) {
      navigator.clipboard.writeText(result.response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isActive = agentStatus && !['idle', 'complete', 'error'].includes(agentStatus.status);
  const statusCfg = STATUS_CONFIG[agentStatus?.status || 'idle'] || STATUS_CONFIG.idle;

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all duration-300 hover:border-brand-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Brain className="w-[18px] h-[18px] text-purple-400" />
          <span>Gemini AI Script Generator</span>
        </h3>
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isActive
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : agentStatus?.status === 'complete'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-slate-900 text-slate-500 border-slate-800'
        }`}>
          {statusCfg.icon}
          <span>{agentStatus?.status || 'idle'}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* Status display when active */}
        {agentStatus && agentStatus.status !== 'idle' && (
          <div className={`p-3.5 rounded-xl border ${
            agentStatus.status === 'waiting_for_login'
              ? 'bg-yellow-500/5 border-yellow-500/20'
              : agentStatus.status === 'error'
              ? 'bg-rose-500/5 border-rose-500/20'
              : agentStatus.status === 'complete'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-brand-500/5 border-brand-500/20'
          }`}>
            <div className="flex items-center space-x-2">
              {statusCfg.pulse && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    agentStatus.status === 'waiting_for_login' ? 'bg-yellow-500' : 'bg-brand-500'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    agentStatus.status === 'waiting_for_login' ? 'bg-yellow-500' : 'bg-brand-500'
                  }`}></span>
                </span>
              )}
              <p className={`text-xs font-bold ${statusCfg.color}`}>
                {agentStatus.message}
              </p>
            </div>

            {/* Special login notification */}
            {agentStatus.status === 'waiting_for_login' && (
              <div className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-[11px] text-yellow-300 font-medium leading-relaxed">
                  ⚡ A Chrome window has opened on your computer. Please complete the Google login there.
                  The agent will detect when you're logged in and continue automatically.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Custom prompt toggle */}
        <div>
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors"
          >
            {showPrompt ? '▼ Hide custom prompt' : '▶ Custom prompt (optional)'}
          </button>
          {showPrompt && (
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Override the default prompt sent to Gemini... (leave empty for default)"
              className="w-full mt-2 bg-slate-950/80 border border-slate-800 rounded-xl py-2.5 px-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 resize-none h-20"
            />
          )}
        </div>

        {/* Generate button */}
        <button
          onClick={startGeneration}
          disabled={!crawlId || loading || !!isActive}
          className="w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
        >
          {isActive ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Agent is working...</span>
            </>
          ) : (
            <>
              <Brain className="w-4 h-4" />
              <span>Generate AI Demo Script</span>
            </>
          )}
        </button>

        {!crawlId && (
          <p className="text-[10px] text-slate-500 text-center">
            Run a crawl first, then select it to generate an AI script.
          </p>
        )}

        {/* Result display */}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generated Script</span>
              </h4>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white transition-all"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-900 max-h-[400px] overflow-y-auto">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                {result.response}
              </pre>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span>{result.screenshotsUsed?.length || 0} screenshots used</span>
              <span>{new Date(result.createdAt).toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
