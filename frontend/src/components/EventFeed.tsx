import { useState, useEffect, useRef } from 'react';
import { Terminal, Activity } from 'lucide-react';

interface EventItem {
  id: number;
  type: string;
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
}

interface EventFeedProps {
  refreshTrigger: number;
}

const EVENT_COLORS: Record<string, string> = {
  crawl_started: 'text-brand-400',
  crawl_completed: 'text-emerald-400',
  crawl_failed: 'text-rose-400',
  demo_created: 'text-indigo-400',
  generation_started: 'text-yellow-400',
  ingestion: 'text-slate-400',
};

const EVENT_ICONS: Record<string, string> = {
  crawl_started: '🌐',
  crawl_completed: '✅',
  crawl_failed: '❌',
  demo_created: '🎬',
  generation_started: '⚙️',
  ingestion: '📥',
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr.replace(' ', 'T') + 'Z').getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));

  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function EventFeed({ refreshTrigger }: EventFeedProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/events?limit=50');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, 5000);
    return () => clearInterval(timer);
  }, [refreshTrigger]);

  return (
    <div className="bg-glass-heavy rounded-2xl p-5 border border-slate-800 shadow-lg transition-all duration-300 hover:border-brand-500/20">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2 select-none">
          <Terminal className="w-[18px] h-[18px] text-brand-500" />
          <span>Live Event Feed</span>
        </h3>
        <div className="flex items-center space-x-2">
          <Activity className={`w-3.5 h-3.5 text-brand-500 ${loading ? 'animate-pulse' : ''}`} />
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="bg-slate-950 rounded-xl p-3.5 font-mono text-[11px] space-y-1.5 border border-slate-900 max-h-[280px] overflow-y-auto scrollbar-thin"
      >
        {events.length === 0 ? (
          <div className="text-center py-6">
            <Terminal className="w-6 h-6 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No events yet</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Start a crawl to see real-time activity</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start space-x-2 py-1 px-1 rounded hover:bg-slate-900/50 transition-colors group"
            >
              <span className="text-[10px] shrink-0 mt-[1px]">
                {EVENT_ICONS[event.type] || '📋'}
              </span>
              <span className={`flex-1 leading-relaxed ${EVENT_COLORS[event.type] || 'text-slate-400'}`}>
                {event.message}
              </span>
              <span className="text-[9px] text-slate-600 shrink-0 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                {relativeTime(event.createdAt)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
