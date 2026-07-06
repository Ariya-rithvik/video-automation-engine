import { useState, useEffect, useRef } from 'react';
import { Telescope, Loader2, CheckCircle2, AlertCircle, LogIn, Scissors, Compass } from 'lucide-react';

// ── Backend: POST /explore/deep · GET /explore/deep/result · POST /supervisor/confirm-login ──
interface SupStatus {
  status: 'idle' | 'crawling' | 'waiting_for_login' | 'complete' | 'error';
  message: string;
  needsAttention: boolean;
}
interface DeepResult {
  videoPath: string; visited: string[]; durationSec: number; removedSec: number; steps: number;
  targetUrl: string; streamUrl: string;
}

export function DeepExplorePanel() {
  const [targetUrl, setTargetUrl] = useState('https://real-time-collaborative-digital-can.vercel.app/');
  const [loginRequired, setLoginRequired] = useState(false);
  const [attachChrome, setAttachChrome] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [maxSections, setMaxSections] = useState(8);
  const [aiPrompt, setAiPrompt] = useState('');
  const [status, setStatus] = useState<SupStatus | null>(null);
  const [result, setResult] = useState<DeepResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = async () => {
    try {
      const r = await fetch('/api/v1/explore/deep/result').then(x => x.json());
      setStatus(r.status); setBusy(r.busy);
      if (r.result) setResult(r.result);
    } catch { /* ignore */ }
  };
  useEffect(() => { poll(); pollRef.current = setInterval(poll, 2000); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, []);

  const start = async () => {
    setErr(null);
    if (!targetUrl.trim()) { setErr('Enter a URL'); return; }
    // Credentials are sent ONLY on this request and only when login is required — never stored.
    const loginCredentials = loginRequired && loginEmail.trim() && loginPassword
      ? { username: loginEmail.trim(), password: loginPassword } : undefined;
    try {
      const r = await fetch('/api/v1/explore/deep', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: targetUrl.trim(), loginRequired, useRealChrome: attachChrome, maxSections, maxDepth: 0, aiPrompt: aiPrompt.trim() || undefined, loginCredentials }),
      }).then(x => x.json());
      if (r.error) setErr(r.error); else { setBusy(true); setResult(null); }
    } catch (e: any) { setErr(e.message); }
  };
  const confirmLogin = () => fetch('/api/v1/supervisor/confirm-login', { method: 'POST' }).catch(() => {});

  const st = status?.status;
  const running = busy || st === 'crawling' || st === 'waiting_for_login';

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Telescope className="h-5 w-5 text-cyan-400" />
        <h2 className="text-sm font-bold tracking-wide text-white">DEEP EXPLORE — AI demos any app → auto-cut video</h2>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        One flow: it scrolls the landing page, logs in if needed, then the vision brain USES the app —
        opening sections, typing/searching, drawing, or asking the app's AI — and never repeats a step.
        ffmpeg trims the thinking/loading time out. Powered by the free Gemini/Groq vision chain.
      </p>

      <div className="space-y-3">
        <input
          value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://your-app.com"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        />

        <input
          value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
          placeholder="Optional: what to type / ask the app's AI (e.g. “draw a flowchart”, “summarize this”)"
          className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        />

        <label className="flex items-center gap-2 cursor-pointer text-xs text-emerald-300">
          <input type="checkbox" checked={attachChrome} onChange={e => setAttachChrome(e.target.checked)} />
          🔗 Attach to my Chrome — already logged in, most reliable (run <code className="mx-1 text-emerald-200">start-chrome-attach.bat</code> first)
        </label>
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={loginRequired} onChange={e => setLoginRequired(e.target.checked)} />
            🔐 Requires login (opens a visible browser)
          </label>
          <label className="flex items-center gap-2">
            Steps
            <input type="number" min={1} max={12} value={maxSections} onChange={e => setMaxSections(+e.target.value)}
              className="w-14 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-white" />
          </label>
        </div>

        {loginRequired && (
          <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-[11px] text-amber-300/90">
              Auto-fills these on a normal email/password form. For Google sign-in / CAPTCHA it can't auto-fill —
              just sign in yourself in the opened window and click “I've logged in”. Credentials are sent only with
              this run and never stored.
            </p>
            <input
              value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="email (optional)"
              autoComplete="off"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
            <input
              value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="password (optional)"
              type="password" autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
            />
          </div>
        )}

        <button
          onClick={start} disabled={running}
          className="w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
        >
          {running ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Running…</span>
            : <span className="flex items-center justify-center gap-2"><Compass className="h-4 w-4" /> Start AI demo</span>}
        </button>
      </div>

      {/* status */}
      {status && st !== 'idle' && (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-3 text-xs">
          <div className="flex items-center gap-2">
            {st === 'complete' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              : st === 'error' ? <AlertCircle className="h-4 w-4 text-red-400" />
                : <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />}
            <span className="text-slate-200">{status.message}</span>
          </div>
          {st === 'waiting_for_login' && status.needsAttention && (
            <button onClick={confirmLogin} className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">
              <LogIn className="h-4 w-4" /> I've logged in — continue
            </button>
          )}
        </div>
      )}

      {err && <div className="mt-3 text-xs text-red-400">{err}</div>}

      {/* result */}
      {result && (
        <div className="mt-4">
          <video key={result.durationSec} controls className="w-full rounded-lg border border-white/10 bg-black" src={`/api/v1/explore/deep/video?t=${result.durationSec}`} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400"><Scissors className="h-3 w-3" /> cut {result.removedSec.toFixed(0)}s of waiting · {result.durationSec.toFixed(0)}s final</span>
            <span>· {result.steps} steps</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.visited.map((v, i) => (
              <span key={i} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">{v.slice(0, 32)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
