import { useState, useEffect, useRef } from 'react';
import { Bot, Loader2, CheckCircle2, AlertCircle, Square, Play, MousePointer2, Circle, Hand, BellRing, Check, Send, KeyRound, LogIn } from 'lucide-react';

interface AgentStep {
  index: number;
  action: string;
  detail: string;
  reason?: string;
  screenshotId?: string;
  timestamp: string;
}

interface PlanStep {
  id: number;
  text: string;
  status: 'pending' | 'active' | 'done';
}

interface AgentPlan {
  goal: string;
  successCriteria: string;
  revision: number;
  steps: PlanStep[];
}

interface AwaitingInput {
  kind: 'select' | 'confirm' | 'credentials';
  question: string;
  options: string[];
}

interface AgentState {
  status: 'idle' | 'planning' | 'running' | 'waiting_for_login' | 'waiting_for_input' | 'complete' | 'error' | 'stopped';
  goal: string | null;
  targetUrl: string | null;
  message: string;
  steps: AgentStep[];
  currentScreenshotId: string | null;
  needsAttention: boolean;
  finalAnswer: string | null;
  error: string | null;
  brain: string;
  plan: AgentPlan | null;
  awaitingInput: AwaitingInput | null;
  userInput: string | null;
}

const ACTION_ICON: Record<string, string> = {
  navigate: '🌐', click: '🖱️', type: '⌨️', scroll: '↕️', wait: '⏳', done: '✅', login: '🔐',
};

export function AgentTaskPanel() {
  const [goal, setGoal] = useState('');
  const [url, setUrl] = useState('');
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [typedChoice, setTypedChoice] = useState('');
  const [assistedLogin, setAssistedLogin] = useState(false);
  const [credUser, setCredUser] = useState('');
  const [credPass, setCredPass] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/agent/status');
        if (res.ok) {
          const data: AgentState = await res.json();
          setAgent(data);
          if (['idle', 'complete', 'error', 'stopped'].includes(data.status)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch { /* ignore */ }
    };
    tick();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/agent/status');
        if (res.ok) {
          const data: AgentState = await res.json();
          setAgent(data);
          if (['idle', 'complete', 'error', 'stopped'].includes(data.status)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch { /* ignore */ }
    }, 1500);
  };

  const startTask = async () => {
    if (!goal.trim() || !url.trim()) return;
    await fetch('/api/v1/agent/reset', { method: 'POST' });
    await fetch('/api/v1/agent/task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, targetUrl: url, loginMode: assistedLogin ? 'assisted' : 'manual' }),
    });
    startPolling();
  };

  const confirmLogin = async () => {
    setConfirming(true);
    try { await fetch('/api/v1/agent/confirm-login', { method: 'POST' }); } catch { /* ignore */ }
    finally { setConfirming(false); }
  };

  const stopTask = async () => {
    try { await fetch('/api/v1/agent/stop', { method: 'POST' }); } catch { /* ignore */ }
  };

  // For 'select': pass { value }. For 'confirm' approval: pass undefined → empty body {}.
  const answerAgent = async (value?: string) => {
    setSending(true);
    try {
      await fetch('/api/v1/agent/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value === undefined ? {} : { value }),
      });
      setTypedChoice('');
    } catch { /* ignore */ }
    finally { setSending(false); }
  };

  // Used once to fill a login form, then cleared. Never logged or persisted.
  const submitCredentials = async () => {
    setSending(true);
    try {
      await fetch('/api/v1/agent/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: credUser, password: credPass }),
      });
    } catch { /* ignore */ }
    finally {
      setCredUser('');
      setCredPass('');
      setSending(false);
    }
  };

  const isRunning = agent && ['planning', 'running', 'waiting_for_login', 'waiting_for_input'].includes(agent.status);
  const statusColor = agent?.status === 'complete' ? 'text-emerald-400'
    : agent?.status === 'error' ? 'text-rose-400'
    : agent?.status === 'waiting_for_login' ? 'text-amber-400'
    : isRunning ? 'text-blue-400' : 'text-slate-500';

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all hover:border-blue-500/20">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Bot className="w-[18px] h-[18px] text-blue-400" />
          <span>Agent — Do Anything (beta)</span>
        </h3>
        <div className="flex items-center space-x-1.5">
          {agent?.brain && agent.brain !== 'none' && (
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold border bg-slate-900 text-slate-400 border-slate-800 max-w-[200px]">
              <span>🧠</span>
              <span className="truncate">{agent.brain}</span>
            </div>
          )}
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
            isRunning ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            : agent?.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : agent?.status === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-slate-900 text-slate-500 border-slate-800'
          }`}>
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" />
              : agent?.status === 'complete' ? <CheckCircle2 className="w-3 h-3" />
              : agent?.status === 'error' ? <AlertCircle className="w-3 h-3" />
              : <Bot className="w-3 h-3" />}
            <span>{agent?.status || 'idle'}</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Inputs */}
        <div className="space-y-2.5">
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder='Goal — e.g. "search for wireless earbuds"'
            disabled={!!isRunning}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Start URL — e.g. https://www.amazon.in"
            disabled={!!isRunning}
            className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
          <label className="flex items-center space-x-2 px-1 select-none cursor-pointer group">
            <input
              type="checkbox"
              checked={assistedLogin}
              onChange={(e) => setAssistedLogin(e.target.checked)}
              disabled={!!isRunning}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950/80 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Assisted login (let the agent type my credentials)</span>
            </span>
          </label>
          <div className="flex space-x-2">
            <button
              onClick={startTask}
              disabled={!!isRunning || !goal.trim() || !url.trim()}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Working...</span></>
                : <><Play className="w-4 h-4" /><span>Run Agent</span></>}
            </button>
            {isRunning && (
              <button onClick={stopTask} className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 text-sm font-bold rounded-xl transition-all flex items-center space-x-1.5">
                <Square className="w-3.5 h-3.5" /><span>Stop</span>
              </button>
            )}
          </div>
        </div>

        {/* Status line */}
        {agent && agent.status !== 'idle' && (
          <p className={`text-xs font-bold ${statusColor}`}>{agent.message}</p>
        )}

        {/* Login / CAPTCHA confirm box */}
        {agent?.needsAttention && (
          <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-2xl p-4 space-y-3 animate-pulse shadow-lg shadow-amber-500/20">
            <div className="flex items-start space-x-2.5">
              <span className="text-xl">🔐</span>
              <div>
                <p className="text-sm font-black text-white">Action needed</p>
                <p className="text-xs text-slate-300 mt-1">Finish login / CAPTCHA in the Chrome window, then click below. The agent will resume.</p>
              </div>
            </div>
            <button onClick={confirmLogin} disabled={confirming}
              className="w-full py-3 rounded-xl text-sm font-black text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-[0.98]">
              {confirming ? 'Resuming...' : "✓ I've logged in — continue"}
            </button>
          </div>
        )}

        {/* Human-in-the-loop gate: pick an option or approve an irreversible action */}
        {agent?.awaitingInput && (
          <div className="bg-indigo-500/10 border-2 border-indigo-500/50 rounded-2xl p-4 space-y-3 shadow-lg shadow-indigo-500/20">
            <div className="flex items-start space-x-2.5">
              <span className="text-xl">{agent.awaitingInput.kind === 'select' ? '🙋' : agent.awaitingInput.kind === 'credentials' ? '🔐' : '🔔'}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1">
                  {agent.awaitingInput.kind === 'select'
                    ? <><Hand className="w-3 h-3" /><span>Your choice needed</span></>
                    : agent.awaitingInput.kind === 'credentials'
                    ? <><KeyRound className="w-3 h-3" /><span>Login needed</span></>
                    : <><BellRing className="w-3 h-3" /><span>Approval needed</span></>}
                </p>
                <p className="text-sm font-black text-white mt-1">{agent.awaitingInput.question}</p>
              </div>
            </div>

            {agent.awaitingInput.kind === 'credentials' ? (
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={credUser}
                  onChange={(e) => setCredUser(e.target.value)}
                  placeholder="Username / email / phone"
                  autoComplete="username"
                  disabled={sending}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <input
                  type="password"
                  value={credPass}
                  onChange={(e) => setCredPass(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !sending) submitCredentials(); }}
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={sending}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  onClick={submitCredentials}
                  disabled={sending}
                  className="w-full py-3 rounded-xl text-sm font-black text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  <span>{sending ? 'Submitting…' : 'Submit login'}</span>
                </button>
                <p className="text-[10px] text-slate-500 text-center">Used once to fill the form — never stored.</p>
              </div>
            ) : agent.awaitingInput.kind === 'select' ? (
              <div className="space-y-2.5">
                {agent.awaitingInput.options.filter((o) => o && o.trim()).slice(0, 8).length > 0 && (
                  <div className="space-y-1.5">
                    {agent.awaitingInput.options
                      .filter((o) => o && o.trim())
                      .slice(0, 8)
                      .map((option, i) => (
                        <button
                          key={`${i}-${option}`}
                          onClick={() => answerAgent(option)}
                          disabled={sending}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-200 bg-slate-950/70 border border-indigo-500/30 hover:bg-indigo-500/20 hover:border-indigo-500/60 disabled:opacity-50 transition-all active:scale-[0.99]"
                        >
                          {option}
                        </button>
                      ))}
                  </div>
                )}
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={typedChoice}
                    onChange={(e) => setTypedChoice(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && typedChoice.trim() && !sending) answerAgent(typedChoice.trim()); }}
                    placeholder="Or type your own choice…"
                    disabled={sending}
                    className="flex-1 bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => { if (typedChoice.trim()) answerAgent(typedChoice.trim()); }}
                    disabled={sending || !typedChoice.trim()}
                    className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold rounded-xl transition-all flex items-center space-x-1.5 active:scale-[0.98]"
                  >
                    <Send className="w-3.5 h-3.5" /><span>Send</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => answerAgent()}
                  disabled={sending}
                  className="w-full py-3 rounded-xl text-sm font-black text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{sending ? 'Sending…' : 'Approve & Continue'}</span>
                </button>
                <button
                  onClick={stopTask}
                  disabled={sending}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-rose-300 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-50 transition-all flex items-center justify-center space-x-1.5 active:scale-[0.98]"
                >
                  <Square className="w-3.5 h-3.5" /><span>Stop</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Live screenshot of what the agent sees */}
        {agent?.currentScreenshotId && (
          <div>
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center space-x-1">
              <MousePointer2 className="w-3 h-3" /><span>What the agent sees</span>
            </div>
            <img
              key={agent.currentScreenshotId}
              src={`/api/v1/agent/shot/${agent.currentScreenshotId}`}
              alt="agent view"
              className="w-full rounded-xl border border-slate-800 bg-slate-950"
            />
          </div>
        )}

        {/* Plan from the planner tier */}
        {agent?.plan && (
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Plan</div>
              {agent.plan.revision > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  re-planned ×{agent.plan.revision}
                </span>
              )}
            </div>
            {agent.plan.successCriteria && (
              <div className="text-[10px] text-slate-500">🎯 {agent.plan.successCriteria}</div>
            )}
            <div className="space-y-1">
              {agent.plan.steps.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-start space-x-2 text-xs rounded-lg p-2 ${
                    p.status === 'active' ? 'bg-blue-500/10' : 'bg-slate-950/50'
                  }`}
                >
                  <span className="mt-0.5 shrink-0">
                    {p.status === 'done' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : p.status === 'active' ? <Loader2 className="w-3.5 h-3.5 text-blue-300 animate-spin" />
                      : <Circle className="w-3.5 h-3.5 text-slate-600" fill="currentColor" />}
                  </span>
                  <div className="min-w-0">
                    <span className="text-slate-600 font-medium mr-1.5">{i + 1}.</span>
                    <span className={
                      p.status === 'done' ? 'text-slate-500 line-through'
                        : p.status === 'active' ? 'text-blue-300 font-medium'
                        : 'text-slate-400'
                    }>{p.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step log */}
        {agent && agent.steps.length > 0 && (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Steps ({agent.steps.length})</div>
            {agent.steps.map((s) => (
              <div key={s.index} className="flex items-start space-x-2 text-xs bg-slate-950/50 rounded-lg p-2">
                <span>{ACTION_ICON[s.action] || '•'}</span>
                <div className="min-w-0">
                  <div className="text-slate-200 font-medium">{s.detail}</div>
                  {s.reason && <div className="text-[10px] text-slate-500 truncate">{s.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Final answer */}
        {agent?.finalAnswer && agent.status === 'complete' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-200">
            <span className="font-bold">Result: </span>{agent.finalAnswer}
          </div>
        )}

        <p className="text-[10px] text-slate-600 leading-relaxed">
          ⚠️ Beta: opens a visible Chrome with a blue "agent working" overlay. Each step is an AI vision call
          (free-tier limited). It pauses for login/CAPTCHA. Best at simple goals (search, navigate, click).
        </p>
      </div>
    </div>
  );
}
