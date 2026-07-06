import { useState, useEffect } from 'react';
import { Globe, Clock, Image, CheckCircle2, XCircle, History, ChevronDown, ChevronUp } from 'lucide-react';

interface CrawlSession {
  id: string;
  targetUrl: string;
  status: string;
  discoveredPages: string[];
  screenshots: Record<string, string>;
  videoPath: string;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

interface CrawlHistoryProps {
  selectedId?: string | null;
  onSelect?: (crawlId: string) => void;
}

export function CrawlHistory({ selectedId, onSelect }: CrawlHistoryProps = {}) {
  const [crawls, setCrawls] = useState<CrawlSession[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCrawls = async () => {
    try {
      const res = await fetch('/api/v1/crawls');
      if (res.ok) {
        const data = await res.json();
        setCrawls(data);
      }
    } catch (err) {
      console.error('Failed to fetch crawls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCrawls();
    const timer = setInterval(fetchCrawls, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-glass-heavy rounded-2xl p-5 border border-slate-800 shadow-lg transition-all duration-300 hover:border-brand-500/20">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <History className="w-[18px] h-[18px] text-brand-500" />
          <span>Crawl History</span>
        </h3>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
          {crawls.length} session{crawls.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-medium">Loading crawl history...</span>
        </div>
      ) : crawls.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-xl border border-dashed border-slate-800/80 bg-slate-950/20">
          <Globe className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
          <p className="text-xs text-slate-400 font-semibold">No crawls yet</p>
          <p className="text-[10px] text-slate-500 mt-1 max-w-[220px] mx-auto">
            Enter a URL in the Supervisor panel and click "Explore & Record" to start.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
          {crawls.map((crawl) => {
            const isExpanded = expandedId === crawl.id;
            const pageCount = crawl.discoveredPages?.length || 0;
            const screenshotCount = crawl.screenshots ? Object.keys(crawl.screenshots).length : 0;

            const isSelected = selectedId === crawl.id;

            return (
              <div
                key={crawl.id}
                className={`rounded-xl border bg-slate-950/50 overflow-hidden transition-all duration-300 ${
                  isSelected
                    ? 'border-brand-500 ring-2 ring-brand-500/40 shadow-[0_0_20px_rgba(0,102,255,0.25)]'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card header */}
                <button
                  onClick={() => {
                    setExpandedId(isExpanded ? null : crawl.id);
                    onSelect?.(crawl.id);
                  }}
                  className="w-full p-3.5 text-left flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">
                        {crawl.targetUrl}
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        {/* Status */}
                        {crawl.status === 'completed' ? (
                          <span className="flex items-center space-x-1 text-[10px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 text-[10px] font-bold text-rose-400">
                            <XCircle className="w-3 h-3" />
                            <span>Failed</span>
                          </span>
                        )}

                        {/* Pages */}
                        <span className="flex items-center space-x-1 text-[10px] text-slate-500">
                          <Globe className="w-3 h-3" />
                          <span>{pageCount} pages</span>
                        </span>

                        {/* Screenshots */}
                        <span className="flex items-center space-x-1 text-[10px] text-slate-500">
                          <Image className="w-3 h-3" />
                          <span>{screenshotCount} shots</span>
                        </span>

                        {/* Duration */}
                        <span className="flex items-center space-x-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatDuration(crawl.durationSeconds)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {isSelected && (
                      <span className="text-[9px] font-black text-brand-400 bg-brand-500/15 border border-brand-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Selected
                      </span>
                    )}
                    <div className="text-slate-500 group-hover:text-slate-300 transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3.5 pb-3.5 pt-0 border-t border-slate-800/50 space-y-3 animate-scale-up">
                    {/* Timestamps */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2">
                      <span>Started: <span className="text-slate-400">{formatTime(crawl.startedAt)}</span></span>
                      <span>Finished: <span className="text-slate-400">{formatTime(crawl.completedAt)}</span></span>
                    </div>

                    {/* Discovered pages */}
                    {pageCount > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Discovered Pages
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {crawl.discoveredPages.map((page) => (
                            <span
                              key={page}
                              className="px-2 py-0.5 text-[10px] font-medium text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-full"
                            >
                              {page.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
