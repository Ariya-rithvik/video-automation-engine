import { useEffect, useState, useRef } from 'react';
import { KeynotePanel } from './components/KeynotePanel';
import { VideoPlayer } from './components/VideoPlayer';
import { ScreenshotGallery } from './components/ScreenshotGallery';
import { EventFeed } from './components/EventFeed';
import { CrawlHistory } from './components/CrawlHistory';
import { CrawlVideoPlayer } from './components/CrawlVideoPlayer';
import { GeminiPanel } from './components/GeminiPanel';
import { MarketingVideoPanel } from './components/MarketingVideoPanel';
import { OmniClipPanel } from './components/OmniClipPanel';
import { AgentTaskPanel } from './components/AgentTaskPanel';
import { StoryStudioPanel } from './components/StoryStudioPanel';
import { DeepExplorePanel } from './components/DeepExplorePanel';
import { DemoItem, BugReport } from './types';
import {
  Sparkles, ShieldAlert, Cpu, RefreshCw, Link2, Camera,
  Globe, Video, ChevronRight,
  Telescope, Bot, Clapperboard, Megaphone, Scissors, Play, History,
  type LucideIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

// ─── Sidebar Navigation ─────────────────────────────────────────────────────────

type Section = 'crawler' | 'explore' | 'agent' | 'story' | 'gemini' | 'marketing' | 'omni' | 'demo' | 'history';

const NAV: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: 'crawler', label: 'Website Crawler', icon: Globe },
  { id: 'explore', label: 'Deep Explore', icon: Telescope },
  { id: 'agent', label: 'AI Agent', icon: Bot },
  { id: 'story', label: 'Story Studio', icon: Clapperboard },
  { id: 'gemini', label: 'Gemini Script', icon: Sparkles },
  { id: 'marketing', label: 'Marketing Video', icon: Megaphone },
  { id: 'omni', label: 'Omni Clips', icon: Scissors },
  { id: 'demo', label: 'Demo Engine', icon: Play },
  { id: 'history', label: 'History & Events', icon: History },
];

function App() {
  const [section, setSection] = useState<Section>('crawler');

  // Demo state
  const [demos, setDemos] = useState<DemoItem[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  // Supervisor Crawl State
  const [targetUrl, setTargetUrl] = useState('');
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [attachRealChrome, setAttachRealChrome] = useState(false);
  const [crawlMode, setCrawlMode] = useState<'record' | 'explore'>('record');
  const [recordMode, setRecordMode] = useState<'short' | 'full'>('short');
  const [loginBanner, setLoginBanner] = useState<string | null>(null);
  const [loginAutoDetected, setLoginAutoDetected] = useState(false);
  const [loginConfirming, setLoginConfirming] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<string[]>([]);
  const [screenshotRefreshTrigger, setScreenshotRefreshTrigger] = useState(0);
  const [eventRefreshTrigger, setEventRefreshTrigger] = useState(0);
  const [latestCrawlVideo, setLatestCrawlVideo] = useState<string | null>(null);

  // Gemini AI script generation — which crawl the user has chosen to analyze
  const [selectedCrawlId, setSelectedCrawlId] = useState<string | null>(null);

  // Voice State
  const [voiceMode, setVoiceMode] = useState<'standard' | 'elevenlabs'>('standard');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSpeechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const selectedDemoIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedDemoIdRef.current = selectedDemoId;
  }, [selectedDemoId]);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchData = async () => {
    try {
      const demoRes = await fetch('/api/v1/demos');
      if (demoRes.ok) {
        const demoData = await demoRes.json();
        setDemos(demoData);
        if (demoData.length > 0 && !selectedDemoIdRef.current) {
          setSelectedDemoId(demoData[0].id);
        }
      }

      const bugRes = await fetch('/api/v1/bugs');
      if (bugRes.ok) {
        const bugData = await bugRes.json();
        setBugs(bugData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for latest crawl video on mount
  useEffect(() => {
    fetch('/api/v1/crawls')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (data.length > 0 && data[0].status === 'completed') {
          setLatestCrawlVideo(`/api/v1/stream/crawl-video/${data[0].id}`);
        }
      })
      .catch(() => {});
  }, [screenshotRefreshTrigger]);

  const activeDemo = demos.find((item) => item.id === selectedDemoId) || null;

  // ─── TTS / Voiceover ──────────────────────────────────────────────────────

  useEffect(() => {
    stopAudioAndSpeech();
    if (!activeDemo || !isPlaying) return;
    if (voiceMode === 'elevenlabs' && activeDemo.audioPath) {
      audioRef.current = new Audio(`/api/v1/stream/audio/${activeDemo.id}`);
      audioRef.current.muted = isMuted;
      audioRef.current.play().catch(() => speakWithWebSpeech(activeDemo.script));
      audioRef.current.onended = () => setIsPlaying(false);
    } else {
      speakWithWebSpeech(activeDemo.script);
    }
    return () => stopAudioAndSpeech();
  }, [selectedDemoId, isPlaying, voiceMode]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = isMuted;
    if (isMuted) {
      window.speechSynthesis.cancel();
    } else if (isPlaying && activeDemo) {
      if (voiceMode === 'standard' || !activeDemo.audioPath) speakWithWebSpeech(activeDemo.script);
    }
  }, [isMuted, voiceMode]);

  const speakWithWebSpeech = (text: string) => {
    window.speechSynthesis.cancel();
    if (isMuted) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const premium = voices.find(v => v.name.includes('Google US English') || v.name.includes('Natural') || v.lang.startsWith('en-US'));
    if (premium) utterance.voice = premium;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    currentSpeechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopAudioAndSpeech = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis.cancel();
  };

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSelectDemo = (demoId: string) => {
    setSelectedDemoId(demoId);
    setIsPlaying(true);
    confetti({ particleCount: 60, spread: 60, origin: { y: 0.8 }, colors: ['#0066ff', '#4f46e5', '#3b82f6'] });
  };

  const triggerMockPipeline = async (type: 'success' | 'failure') => {
    setLoading(true);
    setGenerationStatus(`Triggering ${type.toUpperCase()} run...`);
    try {
      const response = await fetch('/api/v1/generate-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logName: type === 'success' ? 'run-success.json' : 'run-failure.json' }),
      });
      const data = await response.json();
      if (response.ok) {
        setGenerationStatus(`✅ ${data.message}`);
        await fetchData();
        setEventRefreshTrigger(p => p + 1);
        if (type === 'success') confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      } else {
        setGenerationStatus(`❌ ${data.error}`);
      }
    } catch {
      setGenerationStatus('❌ Failed to connect to pipeline.');
    } finally {
      setLoading(false);
      setTimeout(() => setGenerationStatus(null), 4000);
    }
  };

  const confirmLogin = async () => {
    setLoginConfirming(true);
    try {
      await fetch('/api/v1/supervisor/confirm-login', { method: 'POST' });
      setLoginBanner(null);
      setLoginAutoDetected(false);
    } catch { /* ignore */ }
    finally { setLoginConfirming(false); }
  };

  const handleSupervisorCrawl = async () => {
    if (!targetUrl.trim()) return;
    setCrawlLoading(true);
    setLoginBanner(null);
    setCrawlStatus(loginRequired ? 'Opening visible Chrome for login...' : 'Launching stealth Chrome browser...');
    setCrawlProgress([loginRequired ? '🔓 Opening visible Chrome — please log in when it appears' : '🚀 Initializing Puppeteer headless browser']);

    // When login is required, poll the supervisor status so we can show the live login-wait banner.
    let loginPoll: ReturnType<typeof setInterval> | null = null;
    if (loginRequired) {
      loginPoll = setInterval(async () => {
        try {
          const sres = await fetch('/api/v1/supervisor/status');
          if (sres.ok) {
            const s = await sres.json();
            if (s.status === 'waiting_for_login' && s.needsAttention) {
              setLoginBanner(s.message);
              setLoginAutoDetected(!!s.autoDetectedLogin);
            } else if (s.status === 'crawling' || s.status === 'complete') {
              setLoginBanner(null);
              setLoginAutoDetected(false);
            }
          }
        } catch { /* ignore */ }
      }, 2000);
    }

    try {
      const addProgress = (msg: string) => setCrawlProgress(prev => [...prev.slice(-8), msg]);

      if (!loginRequired) {
        setTimeout(() => addProgress('🌐 Navigating to target URL...'), 1500);
        setTimeout(() => addProgress('📸 Capturing page screenshots...'), 4000);
        setTimeout(() => addProgress('🔍 Discovering internal links via DOM traversal...'), 7000);
        setTimeout(() => addProgress('🎬 Recording screencast frames...'), 10000);
        setTimeout(() => addProgress('📄 Crawling discovered sub-pages...'), 15000);
      }

      const res = await fetch('/api/v1/supervisor/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, loginRequired, useRealChrome: attachRealChrome, crawlMode, recordMode }),
      });
      const data = await res.json();

      if (res.ok) {
        const pageCount = data.discoveredPages?.length || 0;
        addProgress(`✅ Crawl complete! ${pageCount} pages, screenshots & video captured.`);
        if (data.autoGenerateStarted) {
          addProgress('🎬 Auto-generating marketing video...');
        }
        setCrawlStatus(`Crawled ${pageCount} pages successfully!`);
        setScreenshotRefreshTrigger(p => p + 1);
        setEventRefreshTrigger(p => p + 1);
        // Auto-select the new crawl so the Marketing panel shows live generation status
        if (data.crawlId) setSelectedCrawlId(data.crawlId);
        await fetchData();

        // Update crawl video
        if (data.crawlDetails?.videoPath) {
          const crawlsRes = await fetch('/api/v1/crawls');
          if (crawlsRes.ok) {
            const crawlsData = await crawlsRes.json();
            if (crawlsData.length > 0) {
              setLatestCrawlVideo(`/api/v1/stream/crawl-video/${crawlsData[0].id}`);
            }
          }
        }

        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ['#6366f1', '#a855f7', '#3b82f6'] });
        setTimeout(() => { setCrawlStatus(null); setCrawlLoading(false); setCrawlProgress([]); }, 3000);
      } else {
        setCrawlStatus(`❌ ${data.error}`);
        addProgress(`❌ Crawl failed: ${data.error}`);
        setTimeout(() => { setCrawlStatus(null); setCrawlLoading(false); }, 4000);
      }
    } catch {
      setCrawlStatus('❌ Failed to connect to crawling service.');
      setTimeout(() => { setCrawlStatus(null); setCrawlLoading(false); setCrawlProgress([]); }, 4000);
    } finally {
      if (loginPoll) clearInterval(loginPoll);
      setLoginBanner(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  const activeNav = NAV.find((n) => n.id === section) ?? NAV[0];
  const ActiveIcon = activeNav.icon;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">

      {/* ═══ Sidebar (left) ═══ */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/80">
          <div className="p-2.5 bg-brand-500 rounded-xl text-white shadow-lg shadow-brand-500/20">
            <Cpu className="w-6 h-6" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-black tracking-tight text-white">Autonomous Demo Engine</h1>
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400">v2.0</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  section === item.id
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-5 py-3 border-t border-slate-800/80 text-[10px] text-slate-600 leading-relaxed select-none">
          Real browser crawling, recording &amp; AI demo generation.
        </div>
      </aside>

      {/* ═══ Main content (right side) ═══ */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto">

        {/* Top bar: section title + mobile nav */}
        <div className="sticky top-0 z-20 bg-slate-950/85 backdrop-blur border-b border-slate-800/80 px-4 md:px-8 py-3 flex items-center gap-3">
          <span className="md:hidden p-1.5 bg-brand-500 rounded-lg text-white"><Cpu className="w-4 h-4" /></span>
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <ActiveIcon className="w-4 h-4 text-brand-400" /> {activeNav.label}
          </h2>
          <div className="md:hidden ml-auto flex gap-1 overflow-x-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`shrink-0 p-2 rounded-lg ${section === item.id ? 'bg-brand-500 text-white' : 'text-slate-500'}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Ambient background gradient */}
        <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-brand-500/[0.04] to-transparent pointer-events-none -z-10"></div>

        <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">

      {/* ═══ WEBSITE CRAWLER ═══ */}
      {section === 'crawler' && (
        <div className="space-y-6">

            {/* ── Crawler Input Card ── */}
            <div className="bg-glass-heavy rounded-2xl p-6 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 pb-4 border-b border-slate-800 mb-5 select-none">
                <Camera className="w-5 h-5 text-brand-500" />
                <h2 className="text-lg font-bold text-white">App Supervisor Explorer</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">
                    Target Website URL
                  </label>
                  <div className="flex items-center space-x-3">
                    <div className="relative flex-1">
                      <Link2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
                      <input
                        type="url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder="https://www.example.com"
                        disabled={crawlLoading}
                        onKeyDown={(e) => e.key === 'Enter' && handleSupervisorCrawl()}
                        className="w-full bg-slate-950/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm font-medium text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all disabled:opacity-50"
                      />
                    </div>
                    <button
                      onClick={handleSupervisorCrawl}
                      disabled={crawlLoading || !targetUrl.trim()}
                      className="py-3 px-6 bg-gradient-to-r from-brand-500 to-indigo-600 hover:from-brand-600 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center space-x-2 shrink-0"
                    >
                      {crawlLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Crawling...</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          <span>Explore & Record</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick URL suggestions */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Try:</span>
                  {['https://www.zomato.com', 'https://www.amazon.in', 'https://claude.ai', 'https://github.com'].map(url => (
                    <button
                      key={url}
                      onClick={() => setTargetUrl(url)}
                      disabled={crawlLoading}
                      className="px-2.5 py-1 text-[10px] font-medium text-slate-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-brand-500/30 hover:text-brand-400 transition-all disabled:opacity-50"
                    >
                      {new URL(url).hostname.replace('www.', '')}
                    </button>
                  ))}
                </div>

                {/* Requires-login toggle — opens a visible Chrome for manual auth */}
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={loginRequired}
                    onChange={(e) => setLoginRequired(e.target.checked)}
                    disabled={crawlLoading}
                    className="w-4 h-4 rounded accent-brand-500"
                  />
                  <span className="text-[11px] font-medium text-slate-300">
                    🔐 Requires login (opens a visible Chrome — sign in, then I crawl behind auth)
                  </span>
                </label>

                {/* Attach to the user's REAL Chrome (already logged in) via CDP — strongest bot-detection
                    bypass + no re-login. Requires running start-chrome-attach.bat first (debug port 9222). */}
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={attachRealChrome}
                    onChange={(e) => setAttachRealChrome(e.target.checked)}
                    disabled={crawlLoading}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className="text-[11px] font-medium text-slate-300">
                    🔗 Attach to my Chrome (run <code className="text-emerald-300">start-chrome-attach.bat</code> first — real, logged-in browser; best for bot-walled sites)
                  </span>
                </label>

                {/* Crawl MODE — record (no AI, always works) vs explore (AI-driven demo) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">
                    Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCrawlMode('record')}
                      disabled={crawlLoading}
                      className={`text-left px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
                        crawlMode === 'record'
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-300 ring-1 ring-brand-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-brand-500/30 hover:text-brand-400'
                      }`}
                    >
                      📹 Just record — scrolls + captures every page & sub-page (no AI, always works)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCrawlMode('explore')}
                      disabled={crawlLoading}
                      className={`text-left px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
                        crawlMode === 'explore'
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-300 ring-1 ring-brand-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-brand-500/30 hover:text-brand-400'
                      }`}
                    >
                      🤖 Explore & demo — AI draws / types / clicks to show features (needs AI)
                    </button>
                  </div>
                </div>

                {/* Video LENGTH — short curated highlights vs full recording */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 select-none">
                    Video Length
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecordMode('short')}
                      disabled={crawlLoading}
                      className={`text-left px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
                        recordMode === 'short'
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-300 ring-1 ring-brand-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-brand-500/30 hover:text-brand-400'
                      }`}
                    >
                      3-minute video (curated highlights)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordMode('full')}
                      disabled={crawlLoading}
                      className={`text-left px-3 py-2.5 rounded-xl border text-[11px] font-medium transition-all disabled:opacity-50 ${
                        recordMode === 'full'
                          ? 'bg-brand-500/15 border-brand-500/50 text-brand-300 ring-1 ring-brand-500/30'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-brand-500/30 hover:text-brand-400'
                      }`}
                    >
                      Full video
                    </button>
                  </div>
                </div>

                {/* Login-wait CONFIRM BOX — prominent, pulsing, with the action button.
                    Handles login / CAPTCHA / "are you a robot?" — user confirms when truly done. */}
                {loginBanner && (
                  <div className={`rounded-2xl p-4 border-2 space-y-3 shadow-lg ${
                    loginAutoDetected
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-emerald-500/20'
                      : 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/20 animate-pulse'
                  }`}>
                    <div className="flex items-start space-x-2.5">
                      <span className="text-xl shrink-0">{loginAutoDetected ? '✅' : '🔐'}</span>
                      <div className="flex-1">
                        <p className="text-sm font-black text-white">
                          {loginAutoDetected ? 'Looks like you\'re logged in!' : 'Action needed — please log in'}
                        </p>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{loginBanner}</p>
                      </div>
                    </div>
                    <button
                      onClick={confirmLogin}
                      disabled={loginConfirming}
                      className={`w-full py-3 rounded-xl text-sm font-black text-white transition-all active:scale-[0.98] shadow-md ${
                        loginAutoDetected
                          ? 'bg-emerald-500 hover:bg-emerald-600'
                          : 'bg-amber-500 hover:bg-amber-600'
                      } disabled:opacity-50`}
                    >
                      {loginConfirming ? 'Resuming...' : '✓ I\'ve logged in — continue'}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center">
                      Finish login + any CAPTCHA in the Chrome window, then click above. I'll take over.
                    </p>
                  </div>
                )}

                {/* Live crawl progress log */}
                {crawlProgress.length > 0 && (
                  <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-900 max-h-[180px] overflow-y-auto">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                      </span>
                      <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Live Telemetry</span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      {crawlProgress.map((msg, i) => (
                        <p key={i} className={`leading-relaxed ${i === crawlProgress.length - 1 ? 'text-brand-400 font-bold' : 'text-slate-500'}`}>
                          {msg}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status banner */}
                {crawlStatus && !crawlLoading && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-400 font-bold flex items-center space-x-2">
                    <span>✅</span>
                    <span>{crawlStatus}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Crawl Video Player ── */}
            <CrawlVideoPlayer
              videoUrl={latestCrawlVideo}
              title="Latest Crawl Recording"
            />

          {/* ── Screenshot Gallery ── */}
          <ScreenshotGallery refreshTrigger={screenshotRefreshTrigger} />
        </div>
      )}

      {/* ═══ DEEP EXPLORE ═══ */}
      {section === 'explore' && <div className="space-y-6"><DeepExplorePanel /></div>}

      {/* ═══ AI AGENT ═══ */}
      {section === 'agent' && <div className="space-y-6"><AgentTaskPanel /></div>}

      {/* ═══ STORY STUDIO ═══ */}
      {section === 'story' && <div className="space-y-6"><StoryStudioPanel /></div>}

      {/* ═══ GEMINI SCRIPT ═══ */}
      {section === 'gemini' && <div className="space-y-6"><GeminiPanel crawlId={selectedCrawlId} /></div>}

      {/* ═══ MARKETING VIDEO ═══ */}
      {section === 'marketing' && <div className="space-y-6"><MarketingVideoPanel crawlId={selectedCrawlId} /></div>}

      {/* ═══ OMNI CLIPS ═══ */}
      {section === 'omni' && <div className="space-y-6"><OmniClipPanel /></div>}

      {/* ═══ HISTORY & EVENTS ═══ */}
      {section === 'history' && (
        <div className="space-y-6">
          <CrawlHistory selectedId={selectedCrawlId} onSelect={setSelectedCrawlId} />
          <EventFeed refreshTrigger={eventRefreshTrigger} />
        </div>
      )}

      {/* ═══ DEMO ENGINE ═══ */}
      {section === 'demo' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Keynote + Blueprint */}
          <div className="lg:col-span-2 space-y-6">

            {generationStatus && (
              <div className="bg-glass border-brand-500/30 p-3.5 rounded-xl text-xs text-brand-500 flex items-center space-x-2 font-bold shadow-md animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{generationStatus}</span>
              </div>
            )}

            {/* Voice Over Select */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-glass-heavy p-4 rounded-2xl border border-slate-800 gap-3 select-none">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse"></span>
                  <span>Keynote voiceover strategy</span>
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Choose the speech synthesis technology for narration.
                </p>
              </div>
              <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => { setVoiceMode('standard'); stopAudioAndSpeech(); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-300 ${
                    voiceMode === 'standard' ? 'bg-brand-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Standard Speech
                </button>
                <button
                  onClick={() => { setVoiceMode('elevenlabs'); stopAudioAndSpeech(); }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all duration-300 ${
                    voiceMode === 'elevenlabs'
                      ? 'bg-gradient-to-r from-purple-500 to-brand-500 text-white shadow-md'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  ElevenLabs AI Voice
                </button>
              </div>
            </div>

            {/* Keynote Player */}
            <KeynotePanel
              stepName={activeDemo?.stepName || ''}
              scriptText={activeDemo?.script || ''}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              onReset={() => { setIsPlaying(false); setTimeout(() => setIsPlaying(true), 100); }}
              status={demos.length > 0 ? 'SUCCESS' : 'IDLE'}
            >
              <VideoPlayer
                demoId={activeDemo?.id || null}
                videoUrl={activeDemo ? `/api/v1/stream/video/${activeDemo.id}` : null}
                isPlaying={isPlaying}
                onEnded={() => { setIsPlaying(false); setTimeout(() => setIsPlaying(true), 200); }}
                stepName={activeDemo?.stepName || ''}
              />
            </KeynotePanel>

            {/* Demo Segment Selector (dynamic, not hardcoded) */}
            {demos.length > 0 && (
              <div className="bg-glass-heavy rounded-2xl p-6 border border-slate-800 shadow-xl">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white tracking-wide">Demo Segments</h3>
                  <p className="text-xs text-slate-400">Click a segment to play its verified demo loop with AI narration.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {demos.map((demo) => {
                    const isActive = selectedDemoId === demo.id;
                    return (
                      <button
                        key={demo.id}
                        onClick={() => handleSelectDemo(demo.id)}
                        className={`relative text-left p-4 rounded-xl border transition-all duration-300 ${
                          isActive
                            ? 'bg-slate-900 border-brand-500 shadow-[0_0_15px_rgba(0,102,255,0.25)]'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/60'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-brand-500 to-indigo-500 opacity-30 blur-[2px] -z-10"></div>
                        )}
                        <div className="flex items-center space-x-3">
                          <div className="p-2 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white shadow-md shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-slate-100 block truncate">{demo.stepName}</span>
                            <span className="text-[10px] text-slate-500">{demo.duration}s segment</span>
                          </div>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Controls + Bug reports */}
          <div className="space-y-6">

            {/* Pipeline Controls */}
            <div className="bg-glass-heavy rounded-2xl p-5 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 pb-3.5 border-b border-slate-800 mb-4 select-none">
                <Sparkles className="w-[18px] h-[18px] text-brand-500" />
                <h3 className="text-sm font-bold text-white">Pipeline Controls</h3>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => triggerMockPipeline('success')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate SUCCESS Demo</span>
                </button>
                <button
                  onClick={() => triggerMockPipeline('failure')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all active:scale-95"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Simulate FAILURE Run</span>
                </button>
              </div>

              {/* Navigate to crawl */}
              <button
                onClick={() => setSection('crawler')}
                className="w-full mt-4 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-bold transition-all"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Go to Website Crawler</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Bug-Fix Replays */}
            <div className="bg-glass-heavy rounded-2xl p-5 border border-slate-800 shadow-lg">
              <div className="flex items-center space-x-2 pb-3.5 border-b border-slate-800 mb-4 select-none">
                <ShieldAlert className="w-[18px] h-[18px] text-rose-500" />
                <h3 className="text-sm font-bold text-white">Bug-Fix Replays</h3>
              </div>
              {bugs.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    No exceptions recorded. All demos passed safety assertions.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {bugs.map((bug) => (
                    <div key={bug.id} className="p-3.5 rounded-xl bg-rose-500/[0.04] border border-rose-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-rose-400 uppercase tracking-wider">{bug.taskId}</span>
                        <span className="text-[10px] text-slate-500">{new Date(bug.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-mono bg-slate-950 p-2 rounded-lg text-rose-300 border border-rose-500/10 overflow-x-auto whitespace-pre-wrap select-all">
                        {bug.error}
                      </p>
                      <div className="text-[10px] text-slate-400 leading-relaxed">
                        <span className="font-bold text-slate-300">Steps before failure:</span>
                        <ol className="list-decimal list-inside mt-1 space-y-0.5">
                          {bug.stepsBeforeFailure.map((step, idx) => (
                            <li key={idx} className="truncate">
                              <span className="font-medium text-slate-300">{step.step}</span>: {step.description}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event Feed on demo tab too */}
            <EventFeed refreshTrigger={eventRefreshTrigger} />
          </div>
        </div>
      )}

        </div>
      </main>
    </div>
  );
}

export default App;
