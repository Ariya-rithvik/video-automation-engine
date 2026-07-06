import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { brainText, brainChainSummary } from './vision-brain';
import { attemptAutoLogin as autoLoginShared, isLikelyLoggedIn as likelyLoggedInShared, clickByText as clickByTextShared } from './web-login';

// Apply stealth plugin to bypass bot detection on production websites
puppeteerExtra.use(StealthPlugin());

// Real Chrome user-agent to avoid headless detection
const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface DiscoveredPage {
  name: string;
  url: string;
  title: string;
  screenshotPath: string;
  timestamp: number; // seconds offset in the recording
}

export interface CrawlResult {
  targetUrl: string;
  discoveredPages: DiscoveredPage[];
  videoPath: string;
  duration: number; // total seconds
  startedAt: string;
  completedAt: string;
}

export interface BrowserRecorderOptions {
  viewport?: { width: number; height: number };
  timeout?: number;       // max page load timeout (ms)
  maxPages?: number;       // max pages to crawl
  waitAfterNav?: number;  // ms to wait after navigation for SPA rendering
  screenshotDir: string;
  videoDir: string;
  headless?: boolean;     // false = visible Chrome (for manual login)
  loginWait?: boolean;    // true = pause after first navigation until user logs in
  userDataDir?: string;   // persistent profile dir (keeps login between runs)
  onLoginStatus?: (msg: string) => void; // callback to surface login-wait status to the UI
  onLoginAttention?: (info: { autoDetected: boolean }) => void; // called each poll while waiting; lets UI show the confirm box
  shouldResumeLogin?: () => boolean; // returns true when the USER has clicked "I've logged in"
  loginCredentials?: { username: string; password: string } | null; // auto-fill login (no AI needed)
  demonstrate?: boolean;  // true = drive the app (draw/type/AI/nav) on the first page, recorded (default true)
  attachCdpUrl?: string;  // e.g. "http://localhost:9222" → attach to your REAL, already-logged-in Chrome
  recordMode?: 'short' | 'full'; // 'short' = fast ~2-min demo (default); 'full' = thorough/longer demo
  maxDemoSeconds?: number; // wall-clock budget for the autonomous demo (0 = derive from recordMode)
}

const DEFAULT_OPTIONS: Required<BrowserRecorderOptions> = {
  viewport: { width: 1920, height: 1080 },
  timeout: 20000,
  maxPages: 20,
  waitAfterNav: 1500,
  screenshotDir: '',
  videoDir: '',
  headless: true,
  loginWait: false,
  userDataDir: '',
  onLoginStatus: () => {},
  onLoginAttention: () => {},
  shouldResumeLogin: () => false,
  loginCredentials: null,
  demonstrate: true,
  attachCdpUrl: '',
  recordMode: 'short',
  maxDemoSeconds: 0,
};

// Generalized "did the user finish logging in?" heuristic — domain-agnostic.
// Considered logged-in when the URL is no longer a login/auth page AND the page has
// meaningful content (not a near-empty auth shell).
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for the user to log in
const LOGIN_POLL_MS = 3000;

// ─── Browser Recorder ───────────────────────────────────────────────────────────

export class BrowserRecorder {
  private options: Required<BrowserRecorderOptions>;
  private browser: Browser | null = null;

  constructor(opts: BrowserRecorderOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...opts };
  }

  /**
   * Crawls a target URL, discovers pages, captures screenshots, and records video.
   * This is the main entry point for the real browser-based supervisor.
   */
  async crawl(targetUrl: string): Promise<CrawlResult> {
    const startedAt = new Date().toISOString();
    console.log(`[BrowserRecorder] Launching stealth Chrome for: ${targetUrl}`);

    // Ensure output directories exist
    fs.mkdirSync(this.options.screenshotDir, { recursive: true });
    fs.mkdirSync(this.options.videoDir, { recursive: true });

    // For login-gated crawls we run a VISIBLE Chrome with a persistent profile so the user
    // can log in once and the session persists. CDP screencast still records the crawl after login.
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--lang=en-US,en',
    ];
    if (this.options.headless) {
      launchArgs.push('--disable-gpu', '--window-size=1920,1080');
    } else {
      launchArgs.push('--start-fullscreen');   // visible login crawl → fill the screen, no oversizing
    }

    // ATTACH MODE: connect to the user's REAL, already-logged-in Chrome (started with
    // --remote-debugging-port). Real fingerprint + real cookies = best bot-detection bypass AND no
    // re-login. We open a NEW TAB in that browser (so we own it / don't disturb their tabs) and never
    // close the browser on teardown — just disconnect.
    const attached = !!this.options.attachCdpUrl;
    let page: Page;
    if (attached) {
      console.log(`[BrowserRecorder] 🔗 Attaching to your real Chrome at ${this.options.attachCdpUrl} …`);
      this.browser = await puppeteerExtra.connect({ browserURL: this.options.attachCdpUrl, defaultViewport: null }) as unknown as Browser;
      page = await this.browser.newPage();
      await page.bringToFront().catch(() => {});
    } else {
      this.browser = await puppeteerExtra.launch({
        headless: this.options.headless,
        args: launchArgs,
        defaultViewport: this.options.headless ? this.options.viewport : null, // visible → use the real window size
        ...(this.options.userDataDir ? { userDataDir: this.options.userDataDir } : {}),
      }) as unknown as Browser;
      page = await this.browser.newPage();
      if (this.options.headless) {
        await page.setViewport(this.options.viewport);
      } else {
        // Visible (login) crawl: force TRUE fullscreen so it fits the screen exactly (scaled displays make
        // --start-maximized oversize). Don't pin a viewport — let the page fill the window so the user can
        // log in comfortably.
        try {
          const s = await page.createCDPSession();
          const { windowId } = await s.send('Browser.getWindowForTarget') as any;
          await s.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
          await s.detach();
          console.log('[BrowserRecorder] 🖥️ visible window set to fullscreen');
        } catch (e) { console.warn(`[BrowserRecorder] fullscreen failed: ${(e as Error).message}`); }
      }
      await page.setUserAgent(REAL_USER_AGENT);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    }

    // Screencast setup — factored so it can be RE-ATTACHED if we have to recreate the page mid-crawl.
    const framesDir = path.join(this.options.videoDir, '_frames_tmp');
    fs.mkdirSync(framesDir, { recursive: true });
    let frameCount = 0;
    const attachScreencast = async (p: Page) => {
      const c = await p.createCDPSession();
      c.on('Page.screencastFrame', (event: any) => {
        // ACK FIRST so Chrome isn't throttled waiting on us (blocking writes before ack were the lag),
        // then write the frame asynchronously.
        c.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {});
        const framePath = path.join(framesDir, `frame_${String(frameCount).padStart(6, '0')}.jpg`);
        frameCount++;
        fs.promises.writeFile(framePath, Buffer.from(event.data, 'base64')).catch(() => {});
      });
      await c.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: this.options.viewport.width, maxHeight: this.options.viewport.height, everyNthFrame: 2 });
      return c;
    };
    let cdp = await attachScreencast(page);

    // Recover from a DETACHED/crashed frame mid-crawl (heavy sites like BookMyShow drop the frame after a
    // client-side reload → every later navigation fails). Recreate the page + re-attach screencast. Capped.
    let recreations = 0;
    const recreatePage = async (): Promise<boolean> => {
      if (recreations >= 3) return false;
      recreations++;
      try {
        try { await cdp.send('Page.stopScreencast'); } catch { /* */ }
        try { await cdp.detach(); } catch { /* */ }
        try { await page.close(); } catch { /* */ }
        page = await this.browser!.newPage();
        if (this.options.headless) await page.setViewport(this.options.viewport);
        await page.setUserAgent(REAL_USER_AGENT);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
        cdp = await attachScreencast(page);
        console.log(`[BrowserRecorder] ♻️ recreated page after frame detach (#${recreations})`);
        return true;
      } catch (e) { console.warn(`[BrowserRecorder] recreatePage failed: ${(e as Error).message}`); return false; }
    };

    const discoveredPages: DiscoveredPage[] = [];
    const visitedUrls = new Set<string>();
    const urlsToVisit: string[] = [targetUrl];
    let timeOffset = 0;
    let deepDemos = 0; // # of human-like demo passes done; other pages are just scroll+record

    // ─── Login-gated crawl: navigate to target, then wait for the user to log in ──
    // (Skipped entirely in attach mode — the real Chrome is already logged in.)
    if (this.options.loginWait && !attached) {
      try {
        console.log('[BrowserRecorder] Login-gated crawl — navigating to target...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: this.options.timeout });
        await this.waitForContent(page);

        // EXPLORE THE PUBLIC LANDING PAGE FIRST (scroll through ALL of it + record) BEFORE logging in —
        // otherwise the agent jumps straight to the login form and the marketing/landing content is never
        // shown. (User: "you clicked login without exploring anything".) This is step 1 of explore-all.
        if (this.options.demonstrate) {
          try {
            this.options.onLoginStatus('🔎 Exploring the landing page before login…');
            const landingName = this.sanitizeFileName((await page.title().catch(() => '')) || 'Landing_Page');
            const landingShots = await this.captureSections(page, landingName);
            landingShots.forEach((shotPath, i) => {
              discoveredPages.push({ name: landingShots.length > 1 ? `${landingName}_${i + 1}` : landingName, url: page.url(), title: landingName, screenshotPath: shotPath, timestamp: timeOffset });
              timeOffset += 3;
            });
            console.log(`[BrowserRecorder] 📸 Explored landing page BEFORE login (${landingShots.length} section shots)`);
          } catch (e) { console.warn('[BrowserRecorder] landing-page pre-login explore failed:', (e as Error).message); }
        }

        let loggedIn = false;
        // Try AUTO-login first if credentials were supplied (pure DOM, no AI needed).
        if (this.options.loginCredentials && this.options.loginCredentials.username) {
          this.options.onLoginStatus('🔑 Auto-filling your login…');
          loggedIn = await this.attemptAutoLogin(page, this.options.loginCredentials);
          this.options.onLoginStatus(loggedIn ? '✅ Auto-login succeeded — crawling behind auth…' : '⚠️ Auto-login could not complete — please finish login in the Chrome window.');
        }
        // Fall back when auto-login didn't clearly succeed.
        if (!loggedIn) {
          if (this.options.loginCredentials) {
            // AUTO mode (creds given): do NOT block ~5 min for a human — that records a huge static video.
            // The persistent profile is usually already signed in, so just proceed with what's on screen.
            loggedIn = await this.isLikelyLoggedIn(page);
            this.options.onLoginStatus(loggedIn ? '✅ Looks logged in — exploring…' : '➡️ Login uncertain — exploring whatever is visible…');
            console.log(`[BrowserRecorder] auto mode: proceeding without manual wait (likelyLoggedIn=${loggedIn})`);
          } else {
            // MANUAL mode (no creds): wait for the human to sign in / clear CAPTCHA, then continue.
            loggedIn = await this.waitForManualLogin(page);
            if (!loggedIn) {
              this.options.onLoginStatus('⏰ Login timed out (5 min). Crawling whatever is visible.');
              console.warn('[BrowserRecorder] Login wait timed out — proceeding with current page.');
            } else {
              this.options.onLoginStatus('✅ Login detected — crawling behind authentication...');
            }
          }
        }
        // Re-seed the crawl from wherever the user ended up (often a dashboard URL).
        const postLoginUrl = page.url();
        if (postLoginUrl && !urlsToVisit.includes(postLoginUrl)) {
          urlsToVisit.unshift(postLoginUrl);
        }
        // Now DEMONSTRATE the app: open the editor, draw on the canvas, click through features — recorded.
        if (loggedIn && this.options.demonstrate) {
          this.options.onLoginStatus('🎬 Logged in — demonstrating features (drawing + clicking)…');
          await this.demonstrateApp(page);
          deepDemos = 1;
        }
      } catch (err) {
        console.warn('[BrowserRecorder] Login-wait navigation failed:', err);
      }
    }

    try {
      while (urlsToVisit.length > 0 && discoveredPages.length < this.options.maxPages) {
        const currentUrl = urlsToVisit.shift()!;
        const normalizedUrl = this.normalizeUrl(currentUrl);

        if (visitedUrls.has(normalizedUrl)) continue;
        visitedUrls.add(normalizedUrl);

        console.log(`[BrowserRecorder] Navigating to: ${currentUrl}`);

        try {
          await page.goto(currentUrl, {
            // 'networkidle2' NEVER settles on realtime/animated sites (websockets, polling, looping
            // animations) → it blocked ~20s recording a BLANK page (the "25s of nothing" at the start).
            // domcontentloaded + a short settle shows the page in ~1-2s instead.
            waitUntil: 'domcontentloaded',
            timeout: this.options.timeout,
          });

          // Wait for the SPA to actually RENDER content (capped) — not a blind sleep that scrolls an empty page.
          await this.waitForContent(page);

          // Get page title
          const pageTitle = await page.title() || this.extractPageName(currentUrl);
          const pageName = this.sanitizeFileName(pageTitle || this.extractPageName(currentUrl));

          // ONE slow, CONSISTENT scroll-through that records a gentle pan AND captures section shots
          // (replaces the old autoScroll-then-capture double pass that looked fast + jerky). It also
          // triggers lazy/animated content as it descends.
          const sectionShots = await this.captureSections(page, pageName);
          sectionShots.forEach((shotPath, i) => {
            discoveredPages.push({
              name: sectionShots.length > 1 ? `${pageName}_${i + 1}` : pageName,
              url: currentUrl,
              title: pageTitle,
              screenshotPath: shotPath,
              timestamp: timeOffset,
            });
            timeOffset += 3;
          });
          console.log(`[BrowserRecorder] 📸 Captured ${sectionShots.length} section shot(s) for: ${pageName}`);

          // Discover internal links on this page
          const newLinks = await this.discoverLinks(page, targetUrl);
          for (const link of newLinks) {
            const normalizedLink = this.normalizeUrl(link);
            if (!visitedUrls.has(normalizedLink) && !urlsToVisit.includes(link)) {
              urlsToVisit.push(link);
            }
          }

          // DECIDE per page: an interactive app surface → human-like demo (draw / AI snap / meeting / nav);
          // plain content → just the scroll+record above. First page always gets a demo (it opens the app);
          // later pages only if they look interactive. Capped so long crawls stay reasonable.
          if (this.options.demonstrate && deepDemos < 2) {
            const shouldDemo = deepDemos === 0 || await this.pageLooksInteractive(page);
            if (shouldDemo) {
              deepDemos++;
              this.options.onLoginStatus?.('🎬 Demonstrating the app’s features…');
              await this.demonstrateApp(page);
            }
          }
        } catch (navError: any) {
          console.warn(`[BrowserRecorder] ⚠️ Failed to navigate to ${currentUrl}: ${navError.message}`);
          // If the frame/page died, recreate it so the rest of the crawl can continue (else every
          // subsequent goto reuses the dead frame and fails the same way).
          if (/detached|target closed|session closed|page has been closed|execution context was destroyed/i.test(navError.message || '')) {
            const recovered = await recreatePage();
            if (!recovered) { console.warn('[BrowserRecorder] page unrecoverable — stopping crawl early.'); break; }
          }
        }
      }
    } finally {
      // Stop screencast + detach — both defensively wrapped: if login timed out and the page/session
      // was already torn down, these throw "Session already detached" and would otherwise 500 the crawl.
      try { await cdp.send('Page.stopScreencast'); } catch (e) { /* already stopped */ }
      try { await cdp.detach(); } catch (e) { /* already detached / page closed */ }
    }

    // Compile video from captured frames (live screencast).
    const videoPath = path.join(this.options.videoDir, `crawl-recording-${Date.now()}.mp4`);
    if (frameCount > 0) {
      console.log(`[BrowserRecorder] 🎬 Compiling ${frameCount} frames into video...`);
      await this.compileFramesToVideo(framesDir, videoPath);
    } else {
      console.log(`[BrowserRecorder] No screencast frames captured, generating placeholder video...`);
      await this.generatePlaceholderVideo(videoPath, timeOffset || 10);
    }

    // Clean up temp frames
    this.cleanupDir(framesDir);

    // Close the browser we launched — but in ATTACH mode just disconnect + close our tab, leaving the
    // user's real Chrome (and their other tabs) running.
    if (attached) {
      try { await page.close(); } catch { /* ignore */ }
      try { this.browser.disconnect(); } catch { /* ignore */ }
    } else {
      await this.browser.close();
    }
    this.browser = null;

    const completedAt = new Date().toISOString();
    console.log(`[BrowserRecorder] ✅ Crawl complete. ${discoveredPages.length} pages, ${frameCount} frames.`);

    return {
      targetUrl,
      discoveredPages,
      videoPath,
      duration: timeOffset || 10,
      startedAt,
      completedAt,
    };
  }

  /**
   * Smooth-scrolls the page top→bottom (recorded by the screencast) then back to top.
   * Loads lazy/animated content and gives the video real motion. Safety-capped against infinite scroll.
   */
  // Tag the page's REAL scroller (largest overflow container — handles scroll-hijack SPAs) so every
  // scroll/read targets the same element, and reset it to the top.
  private async tagScrollerAndReset(page: Page): Promise<void> {
    await page.evaluate(() => {
      let best: any = document.scrollingElement || document.documentElement;
      let bestH = best.scrollHeight - best.clientHeight;
      document.querySelectorAll('main,div,section,[class*=scroll],[class*=overflow],[class*=container]').forEach((el: any) => {
        const s = getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > bestH) { bestH = el.scrollHeight - el.clientHeight; best = el; }
      });
      try { best.setAttribute('data-ade-scroller', '1'); } catch (e) { /* */ }
      if (best.scrollTo) best.scrollTo(0, 0); else best.scrollTop = 0;
      window.scrollTo(0, 0);
    }).catch(() => {});
  }

  private scrollTopOf(page: Page): Promise<number> {
    return page.evaluate(() => { const el: any = document.querySelector('[data-ade-scroller]') || document.scrollingElement || document.documentElement; return el ? (el.scrollTop || window.scrollY || 0) : (window.scrollY || 0); }).catch(() => 0) as Promise<number>;
  }

  /** Wait for the SPA to actually PAINT content before we scroll/shoot. Polls page height until it's clearly
   *  taller than the viewport (real content has rendered) or it stops growing, capped at maxMs. This replaces
   *  both extremes: 'networkidle2' hangs ~20s on realtime sites (dead start), while a blind short sleep fires
   *  before the SPA renders → we scrolled an EMPTY page (1 shot, title "frontend"). */
  private async waitForContent(page: Page, maxMs = 7000): Promise<void> {
    const start = Date.now();
    let lastH = -1, stable = 0;
    while (Date.now() - start < maxMs) {
      const h = await page.evaluate(() => {
        const el: any = document.scrollingElement || document.documentElement;
        return Math.max(el ? el.scrollHeight : 0, document.body ? document.body.scrollHeight : 0);
      }).catch(() => 0);
      if (h > this.options.viewport.height * 1.3) { await this.sleep(600); return; } // real content → tiny paint buffer
      if (h > 0 && h === lastH) { if (++stable >= 3) { await this.sleep(300); return; } } else stable = 0; // short page settled
      lastH = h;
      await this.sleep(300);
    }
  }

  // Slow, CONSISTENT full scroll: gentle descent to the bottom, then gentle return to top. Used on the
  // sub-pages walkFeatures visits. Uses the same ~600px/s primitive as the capture pass for consistency.
  private async autoScroll(page: Page): Promise<void> {
    try {
      const vh = this.options.viewport.height;
      await this.tagScrollerAndReset(page);
      await this.sleep(300);
      for (let i = 0; i < 10; i++) {
        const before = await this.scrollTopOf(page);
        await this.smoothScrollBy(page, vh);   // advance ONE full screen (no overlap)
        const media = await this.playVisibleMedia(page);
        await this.sleep(media ? 5000 : 1000); // dwell ~5s on a gif/video, else ~1s
        if (Math.abs((await this.scrollTopOf(page)) - before) < 12) break; // reached the bottom
      }
      const top = await this.scrollTopOf(page);
      if (top > 0) await this.smoothScrollBy(page, -top); // gentle return
      await this.sleep(300);
    } catch (e) {
      console.warn(`[BrowserRecorder] autoScroll failed: ${(e as Error).message}`);
    }
  }

  /** Scroll the active scroller by `dy`px (negative = up) — SLOW + smooth so the recording is easy to
   *  follow (user: "scroll slow"). ~12px / 20ms ≈ 600px/s → a full screen takes ~1.8s, then the caller
   *  holds ~1s on the section. This single function controls scroll speed everywhere. */
  private async smoothScrollBy(page: Page, dy: number): Promise<void> {
    try {
      await page.evaluate(async (total: number) => {
        const el: any = document.querySelector('[data-ade-scroller]') || document.scrollingElement || document.documentElement;
        const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
        const stepPx = total >= 0 ? 14 : -14;   // MEDIUM (a touch slow): smooth + readable, not a fast jump
        const n = Math.max(1, Math.round(Math.abs(total) / 14));
        for (let i = 0; i < n; i++) {
          if (el && el.scrollBy) el.scrollBy(0, stepPx); else if (el) el.scrollTop += stepPx;
          window.scrollBy(0, stepPx);
          await sleep(16);                       // 14px / 16ms ≈ 875px/s → a full screen in ~1.2s
        }
      }, dy);
    } catch { /* ignore */ }
  }

  // PLAY any inline video in view (muted, in place — never fullscreen) so it's not frozen, and report
  // whether a video / animated GIF / animation is on screen so the caller can DWELL longer on it.
  private async playVisibleMedia(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        const inView = (el: any) => { const r = el.getBoundingClientRect(); return r.bottom > 60 && r.top < (window.innerHeight - 60) && r.width > 160 && r.height > 120; };
        const vids = (Array.from(document.querySelectorAll('video')) as any[]).filter(inView);
        vids.forEach((v) => { try { v.muted = true; v.removeAttribute('controls'); const p = v.play && v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* */ } });
        try { if (document.fullscreenElement) (document as any).exitFullscreen && (document as any).exitFullscreen(); } catch (e) { /* never let a video take over fullscreen */ }
        const gifs = (Array.from(document.querySelectorAll('img')) as any[]).filter((i) => /\.gif(\?|#|$)/i.test(String(i.currentSrc || i.src || '')) && inView(i));
        const anim = (Array.from(document.querySelectorAll('lottie-player,[class*=lottie i],[class*=animation i]')) as any[]).filter(inView);
        return vids.length > 0 || gifs.length > 0 || anim.length > 0;
      });
    } catch { return false; }
  }

  /**
   * Captures viewport screenshots at several scroll positions. Tall pages → multiple section shots
   * (hero / features / CTA); short pages → just one.
   */
  private async captureSections(page: Page, baseName: string): Promise<string[]> {
    const paths: string[] = [];
    const seenSizes = new Set<number>();
    const vh = this.options.viewport.height;
    let lastSig = '';
    const shoot = async (i: number) => {
      const p = path.join(this.options.screenshotDir, `screenshot-${baseName}-${i}.png`);
      try {
        await page.screenshot({ path: p, fullPage: false, type: 'png' });
        let size = 0; try { size = fs.statSync(p).size; } catch { /* */ }
        if (size && seenSizes.has(size)) { try { fs.unlinkSync(p); } catch { /* */ } } // duplicate → drop
        else { seenSizes.add(size); paths.push(p); }
      } catch { /* */ }
    };
    // Signature of the CURRENT section = its visible HEADING text. Stable across video frames / floating
    // animations (unlike images), so a sticky/pinned hero collapses to ONE entry → no lingering/repeat.
    const viewSig = (): Promise<string> => page.evaluate(() => {
      const out: string[] = [];
      (Array.from(document.querySelectorAll('h1,h2,h3,h4,[class*="title" i],[class*="heading" i]')) as any[]).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top >= -60 && r.top < window.innerHeight - 40 && r.width > 40 && r.height > 10) { const t = ((el.textContent || '') as string).trim().replace(/\s+/g, ' '); if (t.length > 2) out.push(t.slice(0, 40)); }
      });
      return out.join(' | ');
    }).catch(() => '') as Promise<string>;
    try {
      await this.tagScrollerAndReset(page);
      await this.sleep(300);
      // PAGE-BY-PAGE viewport paging (user's ask): advance EXACTLY one screen (viewport height) each step,
      // so every screen is shown in full and the next screen begins where the last ended — no half-section
      // overlap, no uneven section-snap jumps. Caps at 16 screens so very tall pages stay bounded.
      lastSig = await viewSig();
      const m0 = await this.playVisibleMedia(page); await this.sleep(m0 ? 4000 : 1100); await shoot(1);
      let shot = 1;
      for (let i = 2; i <= 16; i++) {
        const before = await this.scrollTopOf(page);
        await this.smoothScrollBy(page, vh);            // exactly ONE viewport height
        const after = await this.scrollTopOf(page);
        const moved = Math.abs(after - before);
        const sig = await viewSig();
        const media = await this.playVisibleMedia(page);
        await this.sleep(media ? 4000 : 1100);          // dwell so each screen is readable in the video
        if (!(sig && sig === lastSig)) { lastSig = sig; await shoot(++shot); } // skip identical sticky view
        if (moved < 12) break;                          // reached the bottom → stop
      }
      const topNow = await this.scrollTopOf(page);
      if (topNow > 0) await this.smoothScrollBy(page, -topNow); // gentle return to top
    } catch (e) {
      console.warn(`[BrowserRecorder] captureSections failed: ${(e as Error).message}`);
    }
    if (paths.length === 0) { // safety: always return at least one shot
      try { const p = path.join(this.options.screenshotDir, `screenshot-${baseName}-1.png`); await page.screenshot({ path: p, fullPage: false, type: 'png' }); paths.push(p); } catch { /* ignore */ }
    }
    return paths;
  }

  // ─── Post-login feature DEMONSTRATION (drives the app, draws, shows tools — recorded) ──────
  // Not just screenshots: open the editor, DRAW on the canvas with real mouse strokes, click tools,
  // visit each sidebar page. Pure Puppeteer (no AI). The screencast records the whole demo.
  private async demonstrateApp(page: Page): Promise<void> {
    try {
      console.log('[BrowserRecorder] 🎬 Demonstrating app features…');
      // GENERIC, brain-driven exploration first — the agent LOOKS at the page and DECIDES what to
      // demonstrate, so it works for ANY app / ANY new feature with NO per-feature code. The hardcoded
      // heuristic below is only a fallback when no AI brain is available (e.g. quota exhausted).
      if (await this.autonomousDemo(page)) return;
      console.log('[BrowserRecorder] demo: no AI brain available → using heuristic demo');
      const dashUrl = page.url();
      const isEditorUrl = () => /\/(paint|canvas|editor|board|draw|whiteboard)\//i.test(page.url()) || (page.url() !== dashUrl && /\/(paint|canvas|editor|board|draw)\b/i.test(page.url()));
      // 1. PREFER opening an EXISTING canvas — clicking "Open Editor" on a recent canvas goes straight
      //    to the editor (no modal, no required name) → far more reliable than creating a new one.
      if (await this.clickByText(page, ['open editor', 'open canvas'])) {
        await this.sleep(2800);
      }
      // 2. Fallback: no existing canvas → create one via the "New Canvas" modal.
      if (!isEditorUrl()) {
        if (await this.clickByText(page, ['new canvas', 'create canvas', 'start drawing', 'new project', 'new board', 'blank canvas', 'create new'])) {
          await this.sleep(1500);
        }
        // The New-Canvas click opens a MODAL with a name field + a "Create" button (custom classes,
        // NOT [role=dialog]). It renders async, so WAIT for the name field (by placeholder) before
        // filling — filling too early is why it was flaky. Verify the value stuck (React can drop it).
        if (page.url() === dashUrl) {
          let tagged = false;
          for (let t = 0; t < 8 && !tagged; t++) {
            tagged = await page.evaluate(() => {
              const inputs = Array.from(document.querySelectorAll('input,textarea')) as any[];
              const notSearch = (i: any) => !/search/i.test((i.placeholder || '') + (i.getAttribute('aria-label') || '') + (i.type || ''));
              const byPlaceholder = inputs.find((i) => /canvas name|enter canvas|name your|untitled/i.test(i.placeholder || '') && i.offsetParent !== null);
              const fallback = inputs.filter((i) => { const r = i.getBoundingClientRect(); const ty = (i.type || 'text').toLowerCase(); return r.width > 60 && r.height > 12 && i.offsetParent !== null && (ty === 'text' || ty === '') && !i.value && notSearch(i); }).pop();
              const el = byPlaceholder || fallback;
              if (!el) return false;
              el.setAttribute('data-ade-cname', '1');
              return true;
            });
            if (!tagged) await this.sleep(700);
          }
          if (tagged) {
            for (let attempt = 0; attempt < 3; attempt++) {
              await page.click('[data-ade-cname]').catch(() => {});
              await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
              await page.keyboard.press('Backspace').catch(() => {});
              await page.type('[data-ade-cname]', 'Demo Canvas', { delay: 30 });
              await this.sleep(180);
              const ok = await page.evaluate(() => { const el = document.querySelector('[data-ade-cname]') as any; return el && String(el.value || '').length > 0; });
              if (ok) break;
            }
            await this.sleep(250);
          }
          const createBtn = await page.evaluate(() => {
            const btns = (Array.from(document.querySelectorAll('button,[role=button],[type=submit]')) as any[]).filter((b) => b.offsetParent !== null);
            const exact = btns.find((b) => { const t = (b.textContent || '').trim().toLowerCase(); return t === 'create' || t === 'create canvas' || t === 'create board' || t === 'done'; });
            const hit = exact || btns.find((b) => { const t = (b.textContent || '').trim().toLowerCase(); return /^create\b/.test(t) && !t.includes('meeting'); });
            if (!hit) return null;
            const r = hit.getBoundingClientRect();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (hit.textContent || '').trim().slice(0, 24) };
          });
          if (createBtn) {
            await page.mouse.click(createBtn.x, createBtn.y, { delay: 50 });
            console.log(`[BrowserRecorder] demo: clicked "${createBtn.text}" → entering editor`);
            for (let t = 0; t < 10 && !isEditorUrl(); t++) await this.sleep(700); // wait for the editor route
          }
        }
      }
      if (isEditorUrl()) console.log(`[BrowserRecorder] demo: in editor → ${page.url()}`);
      // 2c. GENERIC fallback for non-canvas apps: if still on the landing page, click a primary CTA to
      //     enter the app's main workspace (safe — these don't sign up / pay).
      else if (page.url() === dashUrl) {
        if (await this.clickByText(page, ['get started', 'try it', 'try for free', 'launch app', 'open app', 'start now', 'start creating', 'go to app', 'new document', 'new doc', 'compose', 'create new'])) {
          await this.sleep(2500);
        }
      }

      // 2. WAIT for a real drawing surface to mount. The editor is a hash-route SPA that loads async,
      //    so polling (up to ~14s) is essential — the old code checked once, too early, and missed it.
      //    Priority: <canvas> → large <svg> → known whiteboard containers → big editor div.
      let box: { x: number; y: number; w: number; h: number } | null = null;
      for (let tries = 0; tries < 14 && !box; tries++) {
        box = await page.evaluate(() => {
          const sels = ['canvas', 'svg', '[class*=excalidraw]', '[class*=tldraw]', '[class*=konva]', '[class*=whiteboard]', '[class*=canvas]', '[class*=board]', '[class*=stage]', '[class*=drawing]', '[data-testid*=canvas]', '[class*=editor]'];
          for (const sel of sels) {
            let best: any = null; let bestArea = 0;
            for (const e of Array.from(document.querySelectorAll(sel)) as any[]) {
              const r = e.getBoundingClientRect();
              const area = r.width * r.height;
              if (r.width > 260 && r.height > 260 && area > bestArea) { best = { x: r.left, y: r.top, w: r.width, h: r.height }; bestArea = area; }
            }
            if (best) return best; // first selector in priority order that yields a surface wins
          }
          return null;
        });
        if (!box) await this.sleep(1000);
      }

      // 3. DRAW (paint/whiteboard apps) + cycle colors so the palette shows in the video.
      if (box) {
        console.log(`[BrowserRecorder] demo: drawing surface found (${Math.round(box.w)}×${Math.round(box.h)}) — selecting a tool + drawing`);
        await this.selectDrawTool(page);
        await this.drawOnCanvas(page, box);
        await this.demoPalette(page, box);
      } else {
        // No surface — dump a screenshot + DOM inventory so an unknown app can be debugged later.
        console.log('[BrowserRecorder] demo: no drawing surface found — exercising other features');
        try {
          await page.screenshot({ path: path.join(this.options.screenshotDir, 'demo-no-surface.png'), fullPage: false });
          const inv = await page.evaluate(() => {
            const labels = (Array.from(document.querySelectorAll('button,[role=button],a')) as any[]).filter((e) => e.offsetParent !== null).map((e) => (e.textContent || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 26)).filter(Boolean).slice(0, 24);
            return { url: location.href, canvases: document.querySelectorAll('canvas').length, svgs: document.querySelectorAll('svg').length, labels };
          });
          console.log('[BrowserRecorder] demo DOM inventory (no surface):', JSON.stringify(inv));
        } catch { /* ignore */ }
      }

      // 4. AI FEATURES (explicit ask): click any "AI / Generate / Suggest / Magic" control, WAIT so the
      //    result renders on camera, then click an AI suggestion to APPLY it if a suggestion panel shows.
      await this.demoAiFeatures(page);

      // 5. TYPE into a rich-text editor if the app has one (shows the editing feature on any app).
      await this.demoTyping(page);

      // 6. Walk the sidebar / nav / tabs so the demo shows every section (generic across apps).
      await this.walkFeatures(page);

      // 6b. Showcase OTHER create-features (CollabCanvas "Create Meeting" etc.) — open the dialog on
      //     camera so the video records the feature, then close it (we don't create real junk).
      await this.demoSecondaryFeatures(page);

      // 7. SAMPLE SEARCH last (it may filter the page) — type a query + Enter, then clear it.
      await this.demoSearch(page);

      console.log('[BrowserRecorder] 🎬 Feature demonstration complete.');
    } catch (e) {
      console.warn(`[BrowserRecorder] demonstrateApp failed: ${(e as Error).message}`);
    }
  }

  // ─── GENERIC autonomous demo: the agent LOOKS at the page and DECIDES what to demonstrate, for ANY
  // app / ANY new feature, with NO per-feature code. It builds a text inventory of on-screen elements
  // (set-of-marks), asks the swappable brain (Gemini → … → browser-AI) for the next action, and does it
  // (click / draw / type / scroll). Drawing happens ONLY when the brain picks a canvas — so it's not
  // hardcoded. Returns false if NO brain is available on the first decision → caller uses the heuristic.
  private async autonomousDemo(page: Page): Promise<boolean> {
    const MAX_STEPS = 22;
    const history: string[] = [];
    let anyBrain = false;
    let plan = '';
    // Wall-clock budget so a "short" demo wraps up in ~2 min (user complained it ran ~20 min). 0 ⇒ derive
    // from recordMode: short ≈ 110s, full ≈ 300s. An explicit maxDemoSeconds overrides the mode default.
    const budgetSec = this.options.maxDemoSeconds && this.options.maxDemoSeconds > 0 ? this.options.maxDemoSeconds : (this.options.recordMode === 'full' ? 300 : 110);
    const demoStart = Date.now();
    console.log(`[BrowserRecorder] 🧠 autonomous demo starting (brain: ${brainChainSummary()})`);
    // PLAN FIRST (strategy agent): ask the brain which standout features to show + in what order. This
    // is also the gate — if NO brain answers here, we bail to the heuristic demo.
    try {
      const title = await page.title().catch(() => '');
      plan = await brainText({ prompt: `A user opened the web app "${title}" (${page.url()}). In 4-6 short bullets, list the STANDOUT features a promo video should DEMONSTRATE, in the order to show them. Be specific to this kind of app (drawing app → draw on canvas, AI shape-suggestion, colors, layers, real-time collab; etc.). Plain bullet list, no preamble.`, maxTokens: 220 } as any);
      anyBrain = true;
      if (plan) console.log('[BrowserRecorder] 🧠 demo plan:\n' + plan.split('\n').map((l) => '   ' + l).join('\n'));
    } catch (e) {
      console.warn('[BrowserRecorder] autonomous demo: planning brain unavailable —', (e as Error).message);
      return false; // no brain → caller uses heuristic demo
    }
    let drawnOnce = false;              // ensure we draw at least once when a canvas exists
    let acted = 0;                      // count of REAL actions (so the brain can't "done" too soon)
    const sectionsShown = new Set<string>(); // distinct nav/sidebar sections visited (for breadth)
    for (let step = 0; step < MAX_STEPS; step++) {
      // Time-box: stop as soon as the wall-clock budget is hit so the demo stays short.
      if ((Date.now() - demoStart) / 1000 >= budgetSec) { console.log('[BrowserRecorder] 🧠 demo: time budget reached (' + budgetSec + 's) — wrapping up'); break; }
      // 1) Inventory the interactive elements currently visible (text-only set-of-marks).
      const inv: any[] = await page.evaluate(() => {
        const out: any[] = []; const seen = new Set<string>();
        const push = (el: any, kind: string) => {
          const r = el.getBoundingClientRect();
          if (el.offsetParent === null || r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > innerHeight) return;
          const label = (((el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder'))) || el.textContent || '') as string).trim().replace(/\s+/g, ' ').slice(0, 40);
          const key = kind + '|' + label + '|' + Math.round(r.left) + ',' + Math.round(r.top);
          if (seen.has(key)) return; seen.add(key);
          const id = out.length; el.setAttribute('data-ade-demo-id', String(id));
          out.push({ id, kind, label, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) });
        };
        (Array.from(document.querySelectorAll('canvas,svg')) as any[]).forEach((e) => { const r = e.getBoundingClientRect(); if (r.width > 240 && r.height > 240) push(e, 'canvas'); });
        (Array.from(document.querySelectorAll('a,button,[role=button],[role=tab],[role=radio],input,textarea,[contenteditable=true],[class*=tool],[class*=card]')) as any[]).slice(0, 400).forEach((e) => {
          const t = (e.tagName || '').toLowerCase();
          // accessibility-style classification: nav/sidebar landmark → "nav" (a distinct SECTION of the app)
          const inNav = !!(e.closest && e.closest('nav,aside,[class*=sidebar],[class*=side-bar],[class*=menu],[role=navigation]'));
          const kind = (t === 'input' || t === 'textarea' || e.getAttribute?.('contenteditable') === 'true') ? 'input'
            : inNav ? 'nav'
            : (e.getAttribute?.('role') === 'tab' ? 'tab' : 'button');
          push(e, kind);
        });
        return out.slice(0, 44);
      });
      if (!inv.length) break;
      const byId: Record<number, any> = {}; inv.forEach((e) => { byId[e.id] = e; });
      const list = inv.map((e) => `${e.id}: [${e.kind}] "${e.label || '(icon)'}"${e.kind === 'canvas' ? ' ← drawing surface' : ''}`).join('\n');

      // 2) Ask the brain for the next demo action.
      const canvasPresent = inv.some((e) => e.kind === 'canvas');
      const navItems = inv.filter((e) => e.kind === 'nav').map((e) => `"${e.label}"`).filter((l) => l !== '""').join(', ') || '(none on this screen)';
      const prompt = `You are an autonomous agent DEMONSTRATING a web app's features for a promo video — a curious user who explores EVERY part of the app.
GOAL: cover BREADTH — visit the different SECTIONS in the nav/sidebar (not just one screen), and show the standout feature of each. If there's a drawing canvas, DRAW on it; use AI/Generate buttons; open dialogs; switch tabs; type a short sample into editable fields.
RULES:
- Do NOT say "done" until you've shown at least 4 DIFFERENT sections/areas of the app.
- If a drawing canvas is listed and you have NOT drawn yet, your next action MUST be "draw".
- After exploring one area, go to a SECTION you haven't shown yet (use the nav items). Don't repeat "Already done".
- NEVER log out, delete, pay/checkout, or open external links.
Page: "${await page.title().catch(() => '')}"   (drawn yet: ${drawnOnce ? 'yes' : 'no'})
App sections in the nav (visit several you HAVEN'T shown): ${navItems}
Sections shown so far: ${sectionsShown.size ? [...sectionsShown].join(', ') : 'none'}
Demo plan (features to show, in order):
${plan || '(no plan)'}
Visible elements:
${list}
Already done (${acted}): ${history.length ? history.join(' | ') : 'none'}
Reply with ONE JSON object only: {"action":"click"|"draw"|"type"|"scroll"|"done","id":<element id or -1>,"text":"<only for type>","why":"<max 6 words>"}`;
      let raw = '';
      try { raw = await brainText({ prompt, json: true, maxTokens: 160 } as any); }
      catch (e) {
        // Brain died (e.g. all free quota 429). If we barely started, fall back to the FREE heuristic demo
        // so the user still gets a full demo; if we already did a good chunk, keep what we recorded.
        console.warn('[BrowserRecorder] autonomous demo: brain unavailable —', (e as Error).message);
        return acted >= 3;
      }
      anyBrain = true;
      let dec: any = null;
      try { dec = JSON.parse((raw.match(/\{[\s\S]*\}/) || [raw])[0]); } catch { /* */ }
      if (!dec || !dec.action) { history.push('(unparseable)'); continue; }
      // FORCE a draw if a canvas is present and we haven't drawn — the standout feature must be shown.
      if (canvasPresent && !drawnOnce && dec.action !== 'draw') { const c = inv.find((e) => e.kind === 'canvas'); dec = { action: 'draw', id: c.id, why: 'draw on the canvas first' }; }
      // Don't let the brain finish early — require BREADTH: several actions AND a few distinct sections.
      if (dec.action === 'done') {
        if (acted < 6 || (sectionsShown.size < 3 && acted < 12)) { history.push('(early done ignored — explore more sections)'); await this.sleep(300); continue; }
        console.log('[BrowserRecorder] 🧠 demo: brain says done'); break;
      }

      // 3) Execute the chosen action (with a hard safety net: never click destructive/pay controls).
      const urlBefore = page.url();
      const el = byId[dec.id];
      let didAct = true;
      try {
        if (dec.action === 'draw') {
          const c = (el && el.kind === 'canvas') ? el : inv.find((e) => e.kind === 'canvas');
          if (c) { await this.selectDrawTool(page); await this.drawOnCanvas(page, { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h }); drawnOnce = true; } else didAct = false;
        } else if (dec.action === 'type' && el) {
          await page.mouse.click(el.x, el.y, { delay: 40 });
          await page.keyboard.type(String(dec.text || 'Demo ✨').slice(0, 60), { delay: 22 });
        } else if (dec.action === 'scroll') {
          await this.smoothScrollBy(page, Math.floor(this.options.viewport.height * 0.8));
        } else if (dec.action === 'click' && el) {
          if (/log ?out|sign out|delete|remove|trash|\bpay\b|purchase|checkout|buy now|place order/i.test(el.label || '')) { history.push(`click BLOCKED "${el.label}"`); didAct = false; }
          else { await page.mouse.click(el.x, el.y, { delay: 50 }); if (el.kind === 'nav' && el.label) sectionsShown.add(el.label); } // track distinct sections
        } else { didAct = false; }
        if (didAct) { acted++; console.log(`[BrowserRecorder] 🧠 demo: ${dec.action}${dec.id >= 0 ? ' #' + dec.id : ''} "${el?.label || ''}" — ${dec.why || ''}`); history.push(`${dec.action} ${el ? '"' + (el.label || el.kind) + '"' : ''}`.trim()); }
      } catch { history.push(`${dec.action} (failed)`); }
      await this.sleep(this.options.recordMode === 'full' ? 1400 : 800); // let the result render so it's recorded
      if (page.url() !== urlBefore) {
        await this.sleep(1200);
        // After navigating into an editor, the drawing canvas mounts ASYNC — poll for it (up to ~6s)
        // before the next decision so the brain + the force-draw rule actually SEE the canvas.
        for (let w = 0; w < 6; w++) {
          const hasCanvas = await page.evaluate(() => Array.from(document.querySelectorAll('canvas,svg')).some((e: any) => { const r = e.getBoundingClientRect(); return r.width > 240 && r.height > 240; })).catch(() => false);
          if (hasCanvas) break;
          await this.sleep(1000);
        }
      }
    }
    await page.evaluate(() => document.querySelectorAll('[data-ade-demo-id]').forEach((e) => e.removeAttribute('data-ade-demo-id'))).catch(() => {});
    if (anyBrain) console.log(`[BrowserRecorder] 🧠 autonomous demo done (${history.length} actions)`);
    return anyBrain;
  }

  // Select a freehand/pen tool before drawing. Targets SMALL toolbar icons (so it never clicks a big
  // brand/CTA button like "Excalidraw+"), then presses the "P" shortcut (freedraw on Excalidraw/tldraw
  // and most canvas apps) as a reliable, harmless fallback. Generic across drawing apps.
  private async selectDrawTool(page: Page): Promise<void> {
    try {
      const clicked = await page.evaluate(() => {
        const kw = ['freedraw', 'free draw', 'pencil', 'pen', 'draw', 'brush', 'marker', 'scribble', 'freehand'];
        const bad = /excalidraw|sign|share|upgrade|plus|collab|menu|export|library|help|account|profile/;
        const els = Array.from(document.querySelectorAll('button,[role=button],[role=radio],[class*=ToolIcon],[class*=tool],[class*=Tool]')) as any[];
        const cand = els.find((e) => {
          const lab = ((e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + (e.textContent || '')).trim().toLowerCase();
          const r = e.getBoundingClientRect();
          if (e.offsetParent === null || r.width > 120 || r.width < 14 || r.height > 120) return false; // toolbar icons are small
          if (!lab || bad.test(lab)) return false;
          return kw.some((k) => lab === k || lab.startsWith(k + ' ') || lab.includes(' ' + k) || lab.includes(k));
        });
        if (!cand) return null;
        const r = cand.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), lab: (cand.getAttribute('aria-label') || cand.textContent || '').trim().slice(0, 24) };
      });
      if (clicked) { await page.mouse.click(clicked.x, clicked.y, { delay: 40 }); console.log(`[BrowserRecorder] demo: selected tool "${clicked.lab}"`); }
      await page.keyboard.press('KeyP').catch(() => {}); // freedraw shortcut on most canvas apps; harmless otherwise
      await this.sleep(400);
    } catch { /* ignore */ }
  }

  private async drawOnCanvas(page: Page, box: { x: number; y: number; w: number; h: number }): Promise<void> {
    const { x, y, w, h } = box;
    const P = (fx: number, fy: number) => ({ x: Math.round(x + fx * w), y: Math.round(y + fy * h) });
    // Draw ROUGH, hand-drawn shapes ON PURPOSE — a wobbly circle + a crooked rectangle. This is what
    // triggers CollabCanvas's standout AI shape-prediction ("you drew a circle — snap it clean?").
    // A clean drawing wouldn't show off that feature; an imperfect human-like one does.
    const jit = (v: number) => Math.round(v * (0.88 + Math.random() * 0.24));
    const circle: { x: number; y: number }[] = [];
    const cx = x + w * 0.30, cy = y + h * 0.48, rad = Math.min(w, h) * 0.16;
    for (let a = -Math.PI / 2; a <= Math.PI * 1.65; a += 0.32) circle.push({ x: Math.round(cx + Math.cos(a) * jit(rad)), y: Math.round(cy + Math.sin(a) * jit(rad)) });
    const wobble = (p: { x: number; y: number }) => ({ x: p.x + Math.round((Math.random() - 0.5) * 12), y: p.y + Math.round((Math.random() - 0.5) * 12) });
    const roughRect = [P(0.60, 0.32), P(0.86, 0.34), P(0.85, 0.62), P(0.60, 0.60), P(0.60, 0.32)].map(wobble);
    const strokes = [circle, roughRect];
    console.log('[BrowserRecorder] ✏️ drawing a rough circle + rectangle (to trigger AI shape-prediction)…');
    for (const stroke of strokes) {
      await page.mouse.move(stroke[0].x, stroke[0].y);
      await this.sleep(200);
      await page.mouse.down();
      // more interpolation steps + a small pause per segment → smooth, human-looking pen motion.
      for (let i = 1; i < stroke.length; i++) { await page.mouse.move(stroke[i].x, stroke[i].y, { steps: 28 }); await this.sleep(150); }
      await page.mouse.up();
      await this.sleep(700);
    }
    // proof shot of the drawing
    try { await page.screenshot({ path: path.join(this.options.screenshotDir, 'demo-canvas.png'), fullPage: false }); } catch { /* ignore */ }
  }

  // Cycle a few color swatches and draw a short stroke after each, so the palette/colors feature is
  // visibly exercised in the video. Best-effort — silently does nothing if there's no palette.
  private async demoPalette(page: Page, box: { x: number; y: number; w: number; h: number }): Promise<void> {
    try {
      const swatches = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('[class*=color] button,[class*=color] [role=button],[class*=swatch],[aria-label*=color i],button[style*=background],div[style*=background-color]')) as any[];
        const out: any[] = []; const seen = new Set<string>();
        for (const e of els) {
          const r = e.getBoundingClientRect();
          if (r.width >= 10 && r.width <= 64 && r.height >= 10 && r.height <= 64 && e.offsetParent !== null) {
            const k = Math.round(r.left) + ',' + Math.round(r.top);
            if (seen.has(k)) continue; seen.add(k);
            out.push({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
          }
        }
        return out.slice(0, 4);
      });
      let i = 0;
      for (const s of swatches) {
        await page.mouse.click(s.x, s.y, { delay: 40 });
        await this.sleep(280);
        const yy = box.y + box.h * 0.16 + i * 26;
        await page.mouse.move(box.x + box.w * 0.10, yy);
        await page.mouse.down();
        await page.mouse.move(box.x + box.w * 0.42, yy, { steps: 12 });
        await page.mouse.up();
        await this.sleep(240); i++;
      }
      if (swatches.length) console.log(`[BrowserRecorder] demo: cycled ${swatches.length} color(s)`);
    } catch { /* ignore */ }
  }

  // Showcase AI features on camera. Clicks AI/Generate/Suggest/Magic controls, WAITS for the result to
  // render, screenshots it, then applies a suggestion if an AI panel appears. Generic across apps.
  private async demoAiFeatures(page: Page): Promise<number> {
    const AI_KW = ['ai suggestion', 'ai assist', 'generate', 'suggest', 'magic', 'enhance', 'autocomplete', 'auto-complete', 'copilot', 'co-pilot', 'summari', 'improve', 'rewrite', 'smart', 'assistant', '✨', 'gpt', 'gemini', ' ai', 'ai '];
    let shown = 0;
    try {
      for (let round = 0; round < 2; round++) {
        const target = await page.evaluate((kw) => {
          const bad = /logout|sign out|log out|delete|remove|trash|upgrade|buy|pay|subscribe|billing|invite|share/;
          const els = Array.from(document.querySelectorAll('button,[role=button],a,[class*=btn],[class*=tool],[class*=chip],[aria-label]')) as any[];
          const cand = els.find((e) => {
            if (e.getAttribute('data-ade-ai-done') || e.offsetParent === null) return false;
            const s = ((e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).trim().toLowerCase();
            if (!s || s.length > 40 || bad.test(s)) return false;
            return kw.some((k: string) => s.includes(k));
          });
          if (!cand) return null;
          cand.setAttribute('data-ade-ai-done', '1');
          cand.scrollIntoView({ block: 'center' });
          const r = cand.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: (cand.textContent || cand.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 30) };
        }, AI_KW);
        if (!target) break;
        await page.mouse.click(target.x, target.y, { delay: 50 });
        console.log(`[BrowserRecorder] demo: triggered AI feature "${target.text}"`);
        await this.sleep(4800); // let the AI result render so it's visible in the video
        // If an AI suggestion panel appeared, click the first real option inside it to APPLY the result.
        const applied = await page.evaluate(() => {
          const wraps = Array.from(document.querySelectorAll('div,section,aside,form')) as any[];
          const panel = wraps.find((c) => {
            const t = (c.textContent || '').toLowerCase();
            const r = c.getBoundingClientRect();
            return c.offsetParent !== null && r.width > 140 && r.width < 1000 && r.height < 360 && /ai suggestion|suggestions|generated|ai result/.test(t) && t.length < 240;
          });
          if (!panel) return null;
          const btns = (Array.from(panel.querySelectorAll('button,[role=button]')) as any[]).filter((b) => {
            const t = (b.textContent || b.getAttribute('aria-label') || '').trim().toLowerCase();
            return b.offsetParent !== null && !/close|cancel|none|✕|×|dismiss/.test(t);
          });
          if (!btns.length) return null;
          const b = btns[0]; const r = b.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
        });
        if (applied) {
          await page.mouse.click(applied.x, applied.y, { delay: 50 });
          console.log('[BrowserRecorder] demo: applied an AI suggestion');
          await this.sleep(2600);
        }
        try { await page.screenshot({ path: path.join(this.options.screenshotDir, `demo-ai-${round + 1}.png`), fullPage: false }); } catch { /* ignore */ }
        shown++;
        await this.sleep(700);
      }
      if (shown) console.log(`[BrowserRecorder] demo: showcased ${shown} AI feature(s)`);
    } catch { /* ignore */ }
    return shown;
  }

  // Type a sample sentence into a rich-text editor / textarea (NOT a search box) to show editing.
  private async demoTyping(page: Page): Promise<void> {
    try {
      const ok = await page.evaluate(() => {
        const isSearch = (e: any) => /search/i.test((e.placeholder || '') + (e.getAttribute('aria-label') || ''));
        const cands = Array.from(document.querySelectorAll('[contenteditable=true],textarea,[role=textbox]')) as any[];
        const el = cands.find((e) => { const r = e.getBoundingClientRect(); return r.width > 200 && r.height > 36 && e.offsetParent !== null && !isSearch(e); });
        if (!el) return false;
        el.setAttribute('data-ade-type', '1'); el.scrollIntoView({ block: 'center' });
        return true;
      });
      if (!ok) return;
      await page.click('[data-ade-type]').catch(() => {});
      await page.keyboard.type('Demoing the editor — fast, collaborative, AI-powered. ✨', { delay: 24 });
      console.log('[BrowserRecorder] demo: typed sample text into an editor');
      await this.sleep(1000);
    } catch { /* ignore */ }
  }

  // Type a query into a search box + press Enter, then clear it (so it doesn't hide later content).
  private async demoSearch(page: Page): Promise<void> {
    try {
      const ok = await page.evaluate(() => {
        const cands = Array.from(document.querySelectorAll('input[type=search],input[placeholder*=search i],input[aria-label*=search i]')) as any[];
        const el = cands.find((e) => { const r = e.getBoundingClientRect(); return r.width > 80 && e.offsetParent !== null; });
        if (!el) return false;
        el.setAttribute('data-ade-search', '1'); el.scrollIntoView({ block: 'center' });
        return true;
      });
      if (!ok) return;
      await page.click('[data-ade-search]').catch(() => {});
      await page.type('[data-ade-search]', 'design', { delay: 45 });
      await this.sleep(800);
      await page.keyboard.press('Enter').catch(() => {});
      console.log('[BrowserRecorder] demo: ran a sample search');
      await this.sleep(1600);
      // clear it
      await page.click('[data-ade-search]').catch(() => {});
      await page.keyboard.down('Control'); await page.keyboard.press('KeyA'); await page.keyboard.up('Control');
      await page.keyboard.press('Backspace').catch(() => {});
      await this.sleep(400);
    } catch { /* ignore */ }
  }

  // Walk the sidebar / nav / tabs so the demo visits every section. Generic + SAFE: skips
  // logout/delete/billing and external links; works on any site (nav, aside, [role=tab]).
  private async walkFeatures(page: Page): Promise<void> {
    try {
      const navTargets = await page.evaluate(() => {
        const bad = /logout|sign out|log out|sign up|sign in|log in|login|register|delete|remove|trash|upgrade|buy|subscribe|billing|pay|invite/;
        const sel = 'nav a, nav button, aside a, aside button, [class*=sidebar] a, [class*=sidebar] button, [role=tab], [class*=nav] a, [class*=menu] a, [class*=tab] [role=button]';
        const els = Array.from(document.querySelectorAll(sel)) as any[];
        const seen = new Set<string>(); const out: any[] = [];
        for (const e of els) {
          const t = (e.textContent || e.getAttribute('aria-label') || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (!t || t.length > 28 || bad.test(t) || e.offsetParent === null) continue;
          const href = e.getAttribute && e.getAttribute('href');
          if (href && /^https?:\/\//i.test(href) && !href.includes(location.host)) continue; // skip external
          if (seen.has(t)) continue; seen.add(t);
          const b = e.getBoundingClientRect();
          if (b.width < 8 || b.height < 8) continue;
          out.push({ x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2), label: t });
        }
        return out.slice(0, 8);
      });
      for (const t of navTargets) {
        try {
          await page.mouse.click(t.x, t.y, { delay: 40 });
          console.log('[BrowserRecorder] demo: opened "' + t.label + '"');
          await this.sleep(1600);
          await this.autoScroll(page);
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // Showcase secondary "create" features (e.g. CollabCanvas "Create Meeting") by opening their dialog
  // ON CAMERA, then closing with Escape so we record the feature without creating real clutter.
  private async demoSecondaryFeatures(page: Page): Promise<void> {
    try {
      const opened = await this.clickByText(page, ['create meeting', 'new meeting', 'start meeting', 'schedule meeting', 'create room', 'new room', 'host meeting']);
      if (opened) {
        await this.sleep(2400); // let the dialog render so it's on camera
        try { await page.screenshot({ path: path.join(this.options.screenshotDir, 'demo-meeting.png'), fullPage: false }); } catch { /* */ }
        console.log('[BrowserRecorder] demo: opened the Create-Meeting dialog (feature showcase)');
        await page.keyboard.press('Escape').catch(() => {});
        await this.sleep(900);
      }
    } catch { /* ignore */ }
  }

  // Decide per page: does it have an interactive app surface worth a human-like demo, or is it just
  // content to scroll past? (canvas / svg drawing surface, an editor toolbar, or a rich-text editor.)
  private async pageLooksInteractive(page: Page): Promise<boolean> {
    try {
      return await page.evaluate(() => {
        const big = (sel: string) => Array.from(document.querySelectorAll(sel)).some((e: any) => { const r = e.getBoundingClientRect(); return r.width > 260 && r.height > 260; });
        if (big('canvas') || big('svg') || big('[class*=excalidraw],[class*=tldraw],[class*=konva],[class*=whiteboard],[class*=canvas],[class*=board],[class*=editor]')) return true;
        if (document.querySelector('[contenteditable=true]')) return true;
        // a real tool palette (several small tool buttons clustered)
        const tools = Array.from(document.querySelectorAll('[class*=tool],[class*=Tool],[role=radio]')).filter((e: any) => { const r = e.getBoundingClientRect(); return e.offsetParent !== null && r.width > 14 && r.width < 90; });
        return tools.length >= 4;
      });
    } catch { return false; }
  }

  private async clickByText(page: Page, keywords: string[]): Promise<boolean> {
    return clickByTextShared(page, keywords); // shared impl in web-login.ts
  }

  /**
   * Discovers all internal links on the current page.
   */
  private async discoverLinks(page: Page, baseUrl: string): Promise<string[]> {
    const baseOrigin = new URL(baseUrl).origin;

    try {
      // Extract all href values from anchor tags
      const hrefs = await page.$$eval('a[href]', (anchors) =>
        anchors.map((a) => (a as any).href).filter(Boolean)
      );

      // Also get data-href attributes
      const dataHrefs = await page.$$eval('[data-href]', (els) =>
        els.map((el) => el.getAttribute('data-href')).filter(Boolean)
      );

      const allHrefs = [...hrefs, ...dataHrefs] as string[];

      // Filter to internal links only
      const urls: string[] = [];
      for (const href of allHrefs) {
        try {
          const resolved = new URL(href, baseUrl);
          if (
            resolved.origin === baseOrigin &&
            !resolved.hash &&
            !resolved.href.startsWith('javascript:') &&
            !resolved.href.startsWith('mailto:') &&
            !resolved.href.startsWith('tel:')
          ) {
            urls.push(resolved.href);
          }
        } catch {
          // Ignore invalid URLs
        }
      }
      return [...new Set(urls)];
    } catch {
      return [];
    }
  }

  /**
   * Compiles JPEG frames into an MP4 video using ffmpeg.
   */
  private compileFramesToVideo(framesDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = `ffmpeg -y -framerate 10 -i "${framesDir}/frame_%06d.jpg" -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 -b:v 4000k -preset medium "${outputPath}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.warn(`[BrowserRecorder] ffmpeg frame compilation failed: ${error.message}`);
          // Fallback: generate a placeholder
          this.generatePlaceholderVideo(outputPath, 10).then(resolve).catch(reject);
        } else {
          console.log(`[BrowserRecorder] Video compiled successfully: ${outputPath}`);
          resolve();
        }
      });
    });
  }

  /**
   * Generates a solid-color placeholder video when frame capture fails.
   */
  private generatePlaceholderVideo(outputPath: string, durationSec: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = `ffmpeg -y -f lavfi -i "color=c=0x0b1d3a:size=1920x1080:rate=30:duration=${durationSec}" -c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.1 -b:v 500k "${outputPath}"`;
      exec(cmd, (error) => {
        if (error) {
          console.error(`[BrowserRecorder] Placeholder video generation failed: ${error.message}`);
          // Last resort: create a tiny file so pipeline doesn't crash
          fs.writeFileSync(outputPath, Buffer.alloc(0));
        }
        resolve();
      });
    });
  }

  /**
   * Extracts a readable page name from a URL path.
   */
  private extractPageName(url: string): string {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length === 0) return 'Home';
      // Capitalize and clean up the last segment
      const last = segments[segments.length - 1];
      return last
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '') // Remove file extensions
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      return 'Page';
    }
  }

  /**
   * Sanitizes a string for use as a file name.
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 60);
  }

  /**
   * Normalizes a URL for deduplication (removes trailing slash, hash, query).
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}`;
    } catch {
      return url;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Auto-login (fill credentials, no AI) ───────────────────────────────────
  // If a login form isn't visible, click a "Sign in / Log in / Get started" trigger to reveal it,
  // then fill email + password and submit. Pure DOM — works without any AI quota.
  private async attemptAutoLogin(page: Page, creds: { username: string; password: string }): Promise<boolean> {
    return autoLoginShared(page, creds, { screenshotDir: this.options.screenshotDir }); // shared impl in web-login.ts
  }

  // ─── Manual login wait (visible browser, HUMAN-CONFIRMED) ───────────────────
  // The user is the source of truth: we block until they click "I've logged in" in our
  // web app (shouldResumeLogin() → true). The auto-heuristic is only a HINT we surface to
  // the UI ("looks like you're in — click to continue"). This is what makes CAPTCHAs,
  // "are you a robot?", and 2FA work — the human decides when it's actually done.
  private async waitForManualLogin(page: Page): Promise<boolean> {
    this.options.onLoginStatus('🔐 Please log in (and clear any CAPTCHA / "are you a robot?") in the Chrome window, then click "I\'ve logged in — continue" in this app.');
    const start = Date.now();
    while (Date.now() - start < LOGIN_TIMEOUT_MS) {
      // 1. User explicitly confirmed → resume immediately.
      if (this.options.shouldResumeLogin()) {
        this.options.onLoginStatus('✅ Login confirmed by you — taking over now.');
        return true;
      }

      // 2. Heuristic hint — surface to UI so the confirm box can nudge "looks ready".
      const autoDetected = await this.isLikelyLoggedIn(page);
      this.options.onLoginAttention({ autoDetected });

      const elapsed = Math.round((Date.now() - start) / 1000);
      if (elapsed > 0 && elapsed % 15 === 0) {
        this.options.onLoginStatus(
          autoDetected
            ? `✅ Looks like you're logged in (${elapsed}s) — click "I've logged in — continue" when ready.`
            : `🔐 Waiting for login (${elapsed}s)... finish in the Chrome window, then confirm here.`,
        );
      }
      await this.sleep(LOGIN_POLL_MS);
    }
    return false; // timed out — caller proceeds with whatever's on screen
  }

  private async isLikelyLoggedIn(page: Page): Promise<boolean> {
    return likelyLoggedInShared(page); // shared impl in web-login.ts
  }

  private cleanupDir(dirPath: string) {
    try {
      if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          fs.unlinkSync(path.join(dirPath, file));
        }
        fs.rmdirSync(dirPath);
      }
    } catch (e) {
      console.warn(`[BrowserRecorder] Cleanup warning: ${(e as Error).message}`);
    }
  }
}
