import { useState, useEffect, useRef } from 'react';
import { BookOpen, Loader2, CheckCircle2, AlertCircle, Sparkles, ExternalLink, Quote } from 'lucide-react';

// ─── Backend contract (POST /story/research, GET /story/status, POST /story/reset) ──

interface StoryRequest {
  topic: string;
  country: string;
  language: string;
}

interface StoryStat {
  label: string;
  value: string;
  note?: string;
}

interface StoryTimelineEntry {
  date: string;
  event: string;
}

interface StorySource {
  title: string;
  url: string;
}

interface StoryBeat {
  id: number;
  narration: string;
  caption: string;
  brollQuery: string;
  movieRef?: string;
  statCallout?: string;
}

interface StoryBrief {
  topic: string;
  country: string;
  language: string;
  headline: string;          // in the chosen language
  summary: string;           // English, for the creator
  facts: string[];
  stats: StoryStat[];
  timeline: StoryTimelineEntry[];
  sources: StorySource[];
  script: StoryBeat[];
}

interface StoryState {
  status: 'idle' | 'researching' | 'scripting' | 'complete' | 'error';
  message: string;
  request: StoryRequest | null;
  brief: StoryBrief | null;
  error: string | null;
}

export function StoryStudioPanel() {
  const [topic, setTopic] = useState('');
  const [country, setCountry] = useState('India');
  const [language, setLanguage] = useState('Tanglish');
  const [story, setStory] = useState<StoryState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll once on mount to restore any in-flight / completed state.
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/v1/story/status');
        if (res.ok) {
          const data: StoryState = await res.json();
          setStory(data);
          if (['idle', 'complete', 'error'].includes(data.status)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          } else if (!pollRef.current) {
            // A job is still running (e.g. after a refresh) — resume polling.
            startPolling();
          }
        }
      } catch { /* ignore */ }
    };
    tick();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/v1/story/status');
        if (res.ok) {
          const data: StoryState = await res.json();
          setStory(data);
          if (['idle', 'complete', 'error'].includes(data.status)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        }
      } catch { /* ignore */ }
    }, 1500);
  };

  const generateStory = async () => {
    if (!topic.trim() || isWorking) return;
    await fetch('/api/v1/story/reset', { method: 'POST' });
    await fetch('/api/v1/story/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, country, language }),
    });
    startPolling();
  };

  const isWorking = !!story && ['researching', 'scripting'].includes(story.status);
  const statusColor = story?.status === 'complete' ? 'text-emerald-400'
    : story?.status === 'error' ? 'text-rose-400'
    : isWorking ? 'text-blue-400' : 'text-slate-500';

  const brief = story?.brief ?? null;

  return (
    <div className="bg-glass-heavy rounded-2xl border border-slate-800 shadow-lg overflow-hidden transition-all hover:border-blue-500/20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <BookOpen className="w-[18px] h-[18px] text-blue-400" />
          <span>Story Studio — Localized Research</span>
        </h3>
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
          isWorking ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
          : story?.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          : story?.status === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          : 'bg-slate-900 text-slate-500 border-slate-800'
        }`}>
          {isWorking ? <Loader2 className="w-3 h-3 animate-spin" />
            : story?.status === 'complete' ? <CheckCircle2 className="w-3 h-3" />
            : story?.status === 'error' ? <AlertCircle className="w-3 h-3" />
            : <BookOpen className="w-3 h-3" />}
          <span>{story?.status || 'idle'}</span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Inputs */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateStory()}
              placeholder="e.g. manual scavenging / sewer worker deaths"
              disabled={isWorking}
              className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
            />
          </div>
          <div className="flex space-x-2.5">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateStory()}
                placeholder="India"
                disabled={isWorking}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generateStory()}
                placeholder="Tanglish"
                disabled={isWorking}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>
          </div>
          <button
            onClick={generateStory}
            disabled={isWorking || !topic.trim()}
            className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            {isWorking ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Researching...</span></>
              : <><Sparkles className="w-4 h-4" /><span>Generate Story</span></>}
          </button>
        </div>

        {/* Live status line */}
        {story && story.status !== 'idle' && story.message && (
          <div className="flex items-center space-x-2">
            {isWorking && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 shrink-0" />}
            <p className={`text-xs font-bold ${statusColor}`}>{story.message}</p>
          </div>
        )}

        {/* Error box */}
        {story?.status === 'error' && story.error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-200">
            <span className="font-bold">Error: </span>{story.error}
          </div>
        )}

        {/* ─── Brief ─── */}
        {brief && (
          <div className="space-y-5">

            {/* Headline + English summary */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Headline</div>
              <h4 className="text-lg font-black text-white leading-snug">{brief.headline}</h4>
              {brief.summary && (
                <p className="text-xs text-slate-400 leading-relaxed">{brief.summary}</p>
              )}
            </div>

            {/* Script beats */}
            {brief.script?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Script ({brief.script.length} beats)</div>
                <div className="space-y-2">
                  {brief.script.map((beat, i) => (
                    <div key={beat.id} className="bg-slate-950/50 rounded-xl p-3 space-y-2 border border-slate-800/60">
                      <div className="flex items-start space-x-2.5">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/15 text-blue-300 text-[10px] font-black flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <p className="text-sm text-slate-100 leading-relaxed">{beat.narration}</p>
                          {beat.caption && (
                            <div className="flex items-start space-x-1.5 text-[11px] text-slate-500 italic">
                              <Quote className="w-3 h-3 mt-0.5 shrink-0 text-slate-600" />
                              <span>{beat.caption}</span>
                            </div>
                          )}
                          {(beat.brollQuery || beat.movieRef || beat.statCallout) && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {beat.brollQuery && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-900 text-slate-400 border border-slate-800">
                                  🔎 {beat.brollQuery}
                                </span>
                              )}
                              {beat.movieRef && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                  🎞️ {beat.movieRef}
                                </span>
                              )}
                              {beat.statCallout && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                  📊 {beat.statCallout}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key stats */}
            {brief.stats?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key stats</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {brief.stats.map((stat, i) => (
                    <div key={i} className="bg-slate-950/50 rounded-xl p-3 border border-slate-800/60">
                      <div className="text-base font-black text-white leading-tight">{stat.value}</div>
                      <div className="text-xs text-slate-300 font-medium mt-0.5">{stat.label}</div>
                      {stat.note && <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">{stat.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            {brief.timeline?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timeline</div>
                <div className="space-y-1">
                  {brief.timeline.map((entry, i) => (
                    <div key={i} className="flex items-start space-x-2.5 text-xs bg-slate-950/50 rounded-lg p-2">
                      <span className="shrink-0 font-bold text-blue-300 tabular-nums">{entry.date}</span>
                      <span className="text-slate-600">→</span>
                      <span className="text-slate-300 leading-relaxed">{entry.event}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Facts */}
            {brief.facts?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facts</div>
                <ul className="space-y-1.5">
                  {brief.facts.map((fact, i) => (
                    <li key={i} className="flex items-start space-x-2 text-xs text-slate-300 leading-relaxed">
                      <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sources — credibility */}
            {brief.sources?.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sources ({brief.sources.length})</div>
                <div className="flex flex-wrap gap-2">
                  {brief.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-200 transition-all max-w-full"
                    >
                      <span className="truncate">{source.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer note */}
        <p className="text-[10px] text-slate-600 leading-relaxed">
          📰 Research is grounded in live web sources; verify figures before publishing.
        </p>
      </div>
    </div>
  );
}
