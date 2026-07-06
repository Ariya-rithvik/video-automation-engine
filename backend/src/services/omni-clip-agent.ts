// Gemini Omni clip agent — uses CDP attach to the user's REAL Chrome (started with
// --remote-debugging-port=9222) so we sidestep Google's anti-automation wall that blocks
// Puppeteer-launched Chromium from signing in.
//
// User flow:
//   1. User launches Chrome with the debug port (helper bat + UI instructions provided)
//   2. User navigates to gemini.google.com, prompts Gemini Omni for a video
//   3. User clicks our "Generate via Omni" button in the UI
//   4. This agent attaches to localhost:9222, finds the gemini tab, polls for a <video> element,
//      downloads the blob/URL to backend/data/omni-clips/, persists to DB
//   5. Marketing pipeline auto-pulls the latest clip into AnimatedFootage scene next render

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { insertOmniClip } from './database';

puppeteerExtra.use(StealthPlugin());

const DEFAULT_CDP_PORT = 9222;
const CLIPS_DIR = path.resolve(__dirname, '../../data/omni-clips');
const WATCH_TIMEOUT_MS = 10 * 60 * 1000; // up to 10 min for the user to prompt + Gemini to generate
const POLL_INTERVAL_MS = 2500;

export type OmniStatus =
  | 'idle'
  | 'connecting'         // attaching to Chrome via CDP
  | 'no_chrome'          // can't reach localhost:9222
  | 'no_gemini_tab'      // attached but no gemini.google.com tab open
  | 'waiting_for_video'  // attached + gemini tab found, polling for <video> to appear
  | 'downloading'
  | 'complete'
  | 'error';

export interface OmniState {
  status: OmniStatus;
  message: string;
  cdpPort: number;
  videoFound: boolean;
  clipId: string | null;
  filePath: string | null;
  fileSizeBytes: number;
  error: string | null;
}

class OmniClipAgent {
  private browser: Browser | null = null;
  private cdpPort = DEFAULT_CDP_PORT;
  private cancelRequested = false;

  private _state: OmniState = {
    status: 'idle',
    message: 'Agent is idle. Open Chrome with --remote-debugging-port=9222 and navigate to gemini.google.com to start.',
    cdpPort: DEFAULT_CDP_PORT,
    videoFound: false,
    clipId: null,
    filePath: null,
    fileSizeBytes: 0,
    error: null,
  };

  get state(): OmniState {
    return { ...this._state };
  }

  private updateState(updates: Partial<OmniState>) {
    this._state = { ...this._state, ...updates };
    console.log(`[OmniClipAgent] ${this._state.status}: ${this._state.message}`);
  }

  reset() {
    this.cancelRequested = false;
    this.updateState({
      status: 'idle',
      message: 'Agent is idle.',
      videoFound: false,
      clipId: null,
      filePath: null,
      fileSizeBytes: 0,
      error: null,
    });
  }

  cancel() {
    console.log('[OmniClipAgent] Cancel requested.');
    this.cancelRequested = true;
  }

  // ─── Main flow ────────────────────────────────────────────────────────────

  async start(opts?: { cdpPort?: number; promptHint?: string }): Promise<OmniState> {
    this.cancelRequested = false;
    this.cdpPort = opts?.cdpPort || DEFAULT_CDP_PORT;
    this._state.cdpPort = this.cdpPort;

    fs.mkdirSync(CLIPS_DIR, { recursive: true });

    // 1. Connect via CDP
    this.updateState({
      status: 'connecting',
      message: `🔌 Attaching to your Chrome via debug port ${this.cdpPort}...`,
      videoFound: false,
      clipId: null,
      filePath: null,
      fileSizeBytes: 0,
      error: null,
    });

    try {
      this.browser = await puppeteerExtra.connect({
        browserURL: `http://localhost:${this.cdpPort}`,
        defaultViewport: null,
      }) as unknown as Browser;
    } catch (err: any) {
      this.updateState({
        status: 'no_chrome',
        message: `❌ Could not connect to Chrome on port ${this.cdpPort}. Launch Chrome with the debug flag first.`,
        error: err?.message || String(err),
      });
      return this.state;
    }

    // 2. Find the gemini.google.com tab
    let geminiPage: Page | null = null;
    try {
      const pages = await this.browser.pages();
      for (const p of pages) {
        const url = p.url();
        if (url.includes('gemini.google.com')) {
          geminiPage = p;
          console.log('[OmniClipAgent] Found gemini tab:', url);
          break;
        }
      }
    } catch (err: any) {
      this.updateState({
        status: 'error',
        message: `❌ Could not list browser tabs: ${err?.message || String(err)}`,
        error: err?.message || String(err),
      });
      return this.state;
    }

    if (!geminiPage) {
      this.updateState({
        status: 'no_gemini_tab',
        message: '❌ No tab is open at gemini.google.com. Open one in your Chrome, then click Generate again.',
      });
      // Detach but don't kill user's Chrome
      try { this.browser.disconnect(); } catch { /* ignore */ }
      this.browser = null;
      return this.state;
    }

    // 3. Watch for a <video> element to appear with a real src
    this.updateState({
      status: 'waiting_for_video',
      message: '👀 Watching Gemini tab. Submit your video prompt in the page when ready — I\'ll grab the clip the moment it renders.',
    });

    const videoInfo = await this.waitForVideo(geminiPage);

    if (!videoInfo) {
      if (this.cancelRequested) {
        this.updateState({ status: 'idle', message: 'Cancelled by user.' });
      } else {
        this.updateState({
          status: 'error',
          message: '⏰ Timed out waiting for a video to appear (10 min limit).',
          error: 'Video wait timeout',
        });
      }
      try { this.browser.disconnect(); } catch { /* ignore */ }
      this.browser = null;
      return this.state;
    }

    // 4. Download the video
    this.updateState({
      status: 'downloading',
      message: `⬇️ Downloading clip (${videoInfo.srcKind} URL)...`,
      videoFound: true,
    });

    const clipId = `omni-${Date.now()}`;
    const filePath = path.join(CLIPS_DIR, `${clipId}.mp4`);

    try {
      if (videoInfo.srcKind === 'blob') {
        // Download from inside the page context (blob URLs are origin-scoped)
        const base64 = await geminiPage.evaluate(async (videoSrc: string) => {
          const res = await fetch(videoSrc);
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }, videoInfo.src);

        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      } else {
        // Direct https URL — fetch from page context too (in case cookies/auth are needed)
        const base64 = await geminiPage.evaluate(async (videoSrc: string) => {
          const res = await fetch(videoSrc, { credentials: 'include' });
          if (!res.ok) throw new Error(`Fetch returned ${res.status}`);
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }, videoInfo.src);

        fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
      }
    } catch (err: any) {
      this.updateState({
        status: 'error',
        message: `❌ Download failed: ${err?.message || String(err)}`,
        error: err?.message || String(err),
      });
      try { this.browser.disconnect(); } catch { /* ignore */ }
      this.browser = null;
      return this.state;
    }

    const sizeBytes = fs.statSync(filePath).size;
    if (sizeBytes < 1000) {
      this.updateState({
        status: 'error',
        message: `❌ Downloaded file is suspiciously small (${sizeBytes} bytes). Likely got a placeholder, not the real video.`,
        error: 'Tiny file',
      });
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      try { this.browser.disconnect(); } catch { /* ignore */ }
      this.browser = null;
      return this.state;
    }

    // 5. Persist + finish
    try {
      insertOmniClip({
        id: clipId,
        filePath,
        sourceUrl: videoInfo.src.slice(0, 500),
        prompt: opts?.promptHint || null,
      });
    } catch (err) {
      console.warn('[OmniClipAgent] DB persist failed (clip still on disk):', err);
    }

    this.updateState({
      status: 'complete',
      message: `✅ Clip saved (${(sizeBytes / 1024 / 1024).toFixed(2)} MB). Ready to use in next marketing video.`,
      videoFound: true,
      clipId,
      filePath,
      fileSizeBytes: sizeBytes,
    });

    // Detach (don't close user's Chrome!)
    try { this.browser.disconnect(); } catch { /* ignore */ }
    this.browser = null;

    return this.state;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async waitForVideo(page: Page): Promise<{ src: string; srcKind: 'blob' | 'http' } | null> {
    const start = Date.now();

    while (Date.now() - start < WATCH_TIMEOUT_MS) {
      if (this.cancelRequested) return null;

      try {
        // Find the largest visible <video> with a real src — Gemini might have multiple
        // (e.g. UI previews) so prefer the one with biggest displayed size
        const found = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          let best: { src: string; area: number } | null = null;
          for (const v of videos) {
            const src = v.currentSrc || v.src;
            if (!src) continue;
            const rect = v.getBoundingClientRect();
            const area = rect.width * rect.height;
            if (area < 100) continue; // skip invisible / tiny
            if (!best || area > best.area) {
              best = { src, area };
            }
          }
          return best;
        });

        if (found?.src) {
          const srcKind: 'blob' | 'http' = found.src.startsWith('blob:') ? 'blob' : 'http';
          console.log(`[OmniClipAgent] Found video: ${srcKind} src, area=${Math.round(found.area)}px²`);
          // Wait a moment so the video is fully buffered / not still loading
          await this.sleep(1500);
          return { src: found.src, srcKind };
        }

        // Update message with elapsed time so frontend feedback feels alive
        const elapsedSec = Math.round((Date.now() - start) / 1000);
        if (elapsedSec > 0 && elapsedSec % 10 === 0) {
          this.updateState({
            status: 'waiting_for_video',
            message: `👀 Watching Gemini tab (${elapsedSec}s elapsed). Generate the video — I'll grab it the moment it renders.`,
          });
        }
      } catch (err) {
        console.warn('[OmniClipAgent] Page evaluate failed (page may be navigating):', err);
      }

      await this.sleep(POLL_INTERVAL_MS);
    }
    return null;
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

export const omniClipAgent = new OmniClipAgent();
