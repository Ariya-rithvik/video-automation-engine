import * as fs from 'fs';
import * as path from 'path';
import { ExecutionLog } from './watcher';
import { BrowserRecorder, CrawlResult } from './services/browser-recorder';

export interface SupervisorCrawlResult {
  message: string;
  discoveredPages: string[];
  screenshots: { [pageName: string]: string };
  videoPath: string;
  crawlDuration: number;
  crawlDetails: CrawlResult;
}

export interface SupervisorCrawlOptions {
  loginRequired?: boolean;
  onLoginStatus?: (msg: string) => void;
  onLoginAttention?: (info: { autoDetected: boolean }) => void;
  shouldResumeLogin?: () => boolean;
  loginCredentials?: { username: string; password: string } | null;
  attachCdpUrl?: string; // attach to the user's real, already-logged-in Chrome (debug port)
  recordMode?: 'short' | 'full'; // 'short' = quick ≤~2min time-boxed demo (default); 'full' = explore everything
  maxDemoSeconds?: number;        // optional hard cap on the demo's wall-clock time
  demonstrate?: boolean;          // true = drive/draw/AI (explore mode); false = JUST scroll+record (no AI, e.g. Zomato)
}

export async function runSupervisorCrawl(
  targetUrl: string,
  watchedDir: string,
  opts: SupervisorCrawlOptions = {},
): Promise<SupervisorCrawlResult> {
  console.log(`[Supervisor] Starting REAL browser crawl on: ${targetUrl}${opts.loginRequired ? ' (login-gated, visible browser)' : ''}`);

  // Ensure directories exist
  const screenshotsDir = watchedDir;
  const videoDir = path.join(watchedDir, '../output');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(videoDir, { recursive: true });

  // Create and run the real browser recorder.
  // Login-gated crawls run a VISIBLE Chrome with a persistent profile so the user can sign in.
  const loginProfileDir = path.join(watchedDir, '../data/login-crawl-profile');
  const recorder = new BrowserRecorder({
    viewport: { width: 1920, height: 1080 },
    timeout: 15000,
    maxPages: 20,
    waitAfterNav: 2500,
    screenshotDir: screenshotsDir,
    videoDir: videoDir,
    headless: !opts.loginRequired,
    loginWait: !!opts.loginRequired,
    userDataDir: opts.loginRequired ? loginProfileDir : undefined,
    onLoginStatus: opts.onLoginStatus,
    onLoginAttention: opts.onLoginAttention,
    shouldResumeLogin: opts.shouldResumeLogin,
    loginCredentials: opts.loginCredentials,
    attachCdpUrl: opts.attachCdpUrl,
    recordMode: opts.recordMode,
    maxDemoSeconds: opts.maxDemoSeconds,
    demonstrate: opts.demonstrate !== false, // default true (explore); false = just scroll+record (no AI)
  });

  const crawlResult = await recorder.crawl(targetUrl);

  // Build screenshots map
  const screenshots: { [pageName: string]: string } = {};
  const discoveredPageNames: string[] = [];
  for (const page of crawlResult.discoveredPages) {
    screenshots[page.name] = page.screenshotPath;
    discoveredPageNames.push(page.name);
    console.log(`[Supervisor] ✅ Real screenshot captured: "${page.name}" → ${page.screenshotPath}`);
  }

  // Write a SUCCESS execution log so the slicer can auto-process
  const executionLog: ExecutionLog = {
    status: 'SUCCESS',
    projectId: 'SupervisorCrawl',
    taskId: `crawl-${Date.now()}`,
    steps: crawlResult.discoveredPages.map((page) => ({
      step: page.name,
      timestamp: page.timestamp,
      description: `Supervisor crawled and captured "${page.title}" at ${page.url}`,
    })),
    error: null,
  };

  const logPath = path.join(watchedDir, 'crawled-run.json');
  fs.writeFileSync(logPath, JSON.stringify(executionLog, null, 2), 'utf-8');
  console.log(`[Supervisor] Execution log written: ${logPath}`);

  // Copy the video to the watched dir for the slicer
  const targetVideoPath = path.join(watchedDir, 'crawled-run.mp4');
  if (crawlResult.videoPath && fs.existsSync(crawlResult.videoPath)) {
    fs.copyFileSync(crawlResult.videoPath, targetVideoPath);
    console.log(`[Supervisor] Video recording saved: ${targetVideoPath}`);
  }

  return {
    message: `Supervisor crawled target app successfully. Visited ${discoveredPageNames.length} real pages, captured ${Object.keys(screenshots).length} screenshots and recorded video.`,
    discoveredPages: discoveredPageNames,
    screenshots,
    videoPath: targetVideoPath,
    crawlDuration: crawlResult.duration,
    crawlDetails: crawlResult,
  };
}
