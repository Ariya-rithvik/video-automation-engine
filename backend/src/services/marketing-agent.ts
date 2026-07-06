// Marketing agent — singleton state machine that orchestrates director → renderer → DB.
// Mirrors the GeminiAgent pattern so the frontend pattern (poll /status, display result) is consistent.

import * as fs from 'fs';
import * as path from 'path';
import { generateScenePlan, ScenePlan } from './marketing-director';
import { renderMarketingVideo } from './marketing-renderer';
import { searchSiteAndScreenshot } from './search-crawler';
import { pickDemoSearchQuery } from './gemini';
import { insertMarketingJob, getLatestMarketingJobByCrawlId, getLatestUnusedOmniClip, markOmniClipUsed, insertSearchCrawl, getRecentSearchCrawl } from './database';

// ─── Shared helper: resolve screenshot file paths for a crawl session ────────
// Used by both the manual /marketing/generate endpoint and the auto-trigger on crawl-complete.
// Tries each stored path; falls back to watched/ by basename; finally scans watched/ for any.
export function resolveCrawlScreenshots(
  crawl: { screenshots?: { [k: string]: string } | null },
  watchDir: string,
): string[] {
  const screenshotPaths: string[] = [];
  if (crawl.screenshots) {
    for (const [, screenshotPath] of Object.entries(crawl.screenshots)) {
      const p = screenshotPath as string;
      if (fs.existsSync(p)) {
        screenshotPaths.push(p);
      } else {
        const basename = path.basename(p);
        const watchedPath = path.join(watchDir, basename);
        if (fs.existsSync(watchedPath)) screenshotPaths.push(watchedPath);
      }
    }
  }
  if (screenshotPaths.length === 0) {
    try {
      const files = fs.readdirSync(watchDir);
      const shots = files.filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
      for (const f of shots.slice(0, 10)) screenshotPaths.push(path.join(watchDir, f));
    } catch { /* ignore */ }
  }
  return screenshotPaths;
}

// True if the marketing agent is mid-job (so callers can skip auto-triggering a second run).
export function isMarketingBusy(): boolean {
  const s = marketingAgent.state.status;
  return s !== 'idle' && s !== 'complete' && s !== 'error';
}

// Extract a clean brand name from URL hostname — e.g. "https://www.amazon.in" → "Amazon"
function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const first = host.split('.')[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    return 'this product';
  }
}

// Run a live search on the target site, returning absolute paths to result screenshots.
// Cached for 30 min per (url, query) so re-renders don't keep re-crawling.
async function liveSearchScreenshots(targetUrl: string, query: string, count = 4): Promise<string[]> {
  const cached = getRecentSearchCrawl(targetUrl, query, 30);
  if (cached && cached.screenshotPaths.length > 0) {
    console.log(`[MarketingAgent] Search cache hit: ${cached.id} (${cached.screenshotPaths.length} results)`);
    return cached.screenshotPaths;
  }

  console.log(`[MarketingAgent] Live search: ${targetUrl} for "${query}"`);
  const res = await searchSiteAndScreenshot({ url: targetUrl, query, count });
  if (!res.success || res.screenshotPaths.length === 0) {
    console.warn(`[MarketingAgent] Search crawl failed: ${res.error || 'no results'}`);
    return [];
  }

  const id = `search-${Date.now()}`;
  insertSearchCrawl({
    id, sourceUrl: targetUrl, query,
    resultsUrl: res.resultsUrl,
    screenshotPaths: res.screenshotPaths,
  });
  return res.screenshotPaths;
}

// Gemini's structured-output director persistently sticks to the original 5 scene types
// even when our prompt asks for the Adobe-style ones (CursorClickReveal, etc.). Rather than
// fight that with more prompt engineering, we force-inject them in code: if a returned plan
// has zero Adobe-style scenes, swap one PhoneMockup → CursorClickReveal and one FeatureCallout
// → TemplateCollage. Preserves Gemini's content (caption, screenshot choice) while upgrading
// the visual format.
const ADOBE_STYLE_TYPES = new Set([
  'CursorClickReveal', 'PromptThenGrid', 'BeforeAfterSlider', 'DeviceFrame', 'TemplateCollage',
]);

// Infer sensible CursorClickReveal labels from the target URL so a converted scene
// reads as "Add to cart" for Amazon, "Order now" for Zomato, etc. — instead of generic.
function inferActionForUrl(targetUrl: string): { actionLabel: string; resultLabel: string; clickX: number; clickY: number } {
  const url = (targetUrl || '').toLowerCase();
  if (url.includes('amazon') || url.includes('flipkart') || url.includes('myntra') || url.includes('/shop') || url.includes('/store')) {
    return { actionLabel: 'Add to cart', resultLabel: '✓ Added to cart', clickX: 80, clickY: 65 };
  }
  if (url.includes('zomato') || url.includes('swiggy') || url.includes('food') || url.includes('eats') || url.includes('uber-eats')) {
    return { actionLabel: 'Order now', resultLabel: '✓ Order placed', clickX: 50, clickY: 78 };
  }
  if (url.includes('netflix') || url.includes('prime') || url.includes('hotstar') || url.includes('youtube')) {
    return { actionLabel: 'Play now', resultLabel: '▶ Now playing', clickX: 50, clickY: 60 };
  }
  if (url.includes('github') || url.includes('gitlab') || url.includes('vercel') || url.includes('linear') || url.includes('stripe')) {
    return { actionLabel: 'Try it free', resultLabel: '✓ Account created', clickX: 50, clickY: 70 };
  }
  if (url.includes('claude') || url.includes('openai') || url.includes('gemini') || url.includes('chatgpt')) {
    return { actionLabel: 'Send message', resultLabel: '✓ Generating...', clickX: 92, clickY: 88 };
  }
  return { actionLabel: 'Try it now', resultLabel: '✓ Done', clickX: 50, clickY: 78 };
}

// Aggressive Adobe-style force-injection. GUARANTEES the rendered plan contains all three
// killer demo scenes — CursorClickReveal, PromptThenGrid, TemplateCollage — every render.
// Convert weaker scenes into Adobe ones where possible; insert new scenes when no conversion
// candidate exists. The user repeatedly asked for "Adobe Express demo style" — this is the
// only reliable way given Gemini won't pick the new scene types from the enum.
async function forceAdobeStyleScenes(
  plan: ScenePlan,
  availableScreenshots: string[],
  targetUrl: string,
): Promise<ScenePlan> {
  const scenes = [...plan.scenes];
  const has = (t: string) => scenes.some(s => s.type === t);

  // Use targetUrl directly (Gemini's meta.title is often a paraphrase like "Shop Anything"
  // — not the actual brand). URL hostname is the canonical brand identifier.
  const urlDefaults = inferActionForUrl(targetUrl);
  const brand = brandFromUrl(targetUrl);
  const firstScreenshot = availableScreenshots[0];
  const fourScreenshots = availableScreenshots.slice(0, 4);
  const eightScreenshots = availableScreenshots.slice(0, 8);
  const DEFAULT_FRAMES = 180; // 6s per inserted scene — shorter, less drag

  // Helper: find first scene of given types we can safely convert (preserves original duration + caption)
  function findConvertible(types: string[]): number {
    return scenes.findIndex(s => types.includes(s.type));
  }

  // Find a good insertion index — before EndingCTA if present, else end
  function insertIndex(): number {
    const ctaIdx = scenes.findIndex(s => s.type === 'EndingCTA');
    return ctaIdx >= 0 ? ctaIdx : scenes.length;
  }

  // 1. CursorClickReveal — convert PhoneMockup, then ScreenshotShowcase, then insert new
  if (!has('CursorClickReveal') && firstScreenshot) {
    let idx = findConvertible(['PhoneMockup', 'ScreenshotShowcase']);
    if (idx >= 0) {
      const orig = scenes[idx];
      scenes[idx] = {
        type: 'CursorClickReveal',
        durationFrames: orig.durationFrames,
        props: {
          screenshotUrl: orig.props.screenshotUrl || firstScreenshot,
          caption: orig.props.title || orig.props.caption || orig.props.headline || `One click on ${brand}`,
          ...urlDefaults,
        },
      };
      console.log(`[MarketingAgent] Forced: ${orig.type} #${idx} → CursorClickReveal`);
    } else {
      scenes.splice(insertIndex(), 0, {
        type: 'CursorClickReveal',
        durationFrames: DEFAULT_FRAMES,
        props: {
          screenshotUrl: firstScreenshot,
          caption: `One click on ${brand}`,
          ...urlDefaults,
        },
      });
      console.log('[MarketingAgent] Inserted new CursorClickReveal scene');
    }
  }

  // 2. PromptThenGrid — REAL search demo: pick query via Gemini, run live search-crawler,
  // use returned product screenshots as the result tiles. Falls back to crawl screenshots
  // if search-crawler can't reach the site.
  if (!has('PromptThenGrid')) {
    let searchQuery = '';
    let searchResults: string[] = [];
    try {
      searchQuery = await pickDemoSearchQuery(targetUrl);
      console.log(`[MarketingAgent] Demo search query for ${brand}: "${searchQuery}"`);
      searchResults = await liveSearchScreenshots(targetUrl, searchQuery, 4);
    } catch (err) {
      console.warn('[MarketingAgent] Search crawl failed, falling back to crawl screenshots:', err);
    }

    // If live search failed, fall back to using regular crawl screenshots so the scene still renders
    const resultImages = searchResults.length >= 4
      ? searchResults.map(p => path.basename(p))
      : fourScreenshots;

    // Build a friendly caption
    const captionText = `Search "${searchQuery || brand}" on ${brand}`;
    const promptText = searchQuery || `best on ${brand}`;

    let idx = findConvertible(['FeatureCallout']);
    if (idx >= 0) {
      const orig = scenes[idx];
      scenes[idx] = {
        type: 'PromptThenGrid',
        durationFrames: orig.durationFrames,
        props: {
          caption: orig.props.headline || captionText,
          promptText,
          buttonLabel: 'Search',
          resultImages,
        },
      };
      console.log(`[MarketingAgent] Forced: FeatureCallout #${idx} → PromptThenGrid (live search: ${searchResults.length > 0 ? 'YES' : 'fallback'})`);
    } else if (resultImages.length >= 4) {
      scenes.splice(insertIndex(), 0, {
        type: 'PromptThenGrid',
        durationFrames: DEFAULT_FRAMES,
        props: {
          caption: captionText,
          promptText,
          buttonLabel: 'Search',
          resultImages,
        },
      });
      console.log(`[MarketingAgent] Inserted new PromptThenGrid scene (live search: ${searchResults.length > 0 ? 'YES' : 'fallback'})`);
    }
  }

  // 2b. ProductSelectAndCart — full purchase-flow finale. Inserts right after PromptThenGrid,
  // using its first result image as the "hero product" the cursor clicks Add to Cart on.
  if (!has('ProductSelectAndCart')) {
    const promptGridIdx = scenes.findIndex(s => s.type === 'PromptThenGrid');
    if (promptGridIdx >= 0) {
      const pgScene = scenes[promptGridIdx];
      const gridImages = (pgScene.props.resultImages as string[] | undefined) || [];
      if (gridImages.length >= 1) {
        const selectedImage = gridImages[0];
        const otherImages = gridImages.slice(1, 4);
        // Map URL-aware action labels to "Add to Cart" / "Order now" / "Play now" etc.
        const ctaLabel = urlDefaults.actionLabel;
        const confirmLabel = urlDefaults.resultLabel;
        // Finale text varies by category — order-placed for shopping, etc.
        const finaleLabel = /cart|order|add/i.test(ctaLabel)
          ? '✓ Order placed!'
          : /play/i.test(ctaLabel)
            ? '▶ Now playing'
            : '✓ All set!';
        scenes.splice(promptGridIdx + 1, 0, {
          type: 'ProductSelectAndCart',
          durationFrames: 240, // 8s — needs space for the multi-phase storyboard
          props: {
            caption: `Get it in one click`,
            selectedImage,
            otherImages,
            productLabel: brand,
            ctaLabel,
            confirmLabel,
            finaleLabel,
          },
        });
        console.log(`[MarketingAgent] Inserted ProductSelectAndCart after PromptThenGrid (CTA: "${ctaLabel}")`);
      }
    }
  }

  // 3. TemplateCollage — convert any remaining FeatureCallout/StatsRow/ScreenshotShowcase, else insert
  if (!has('TemplateCollage') && availableScreenshots.length >= 4) {
    let idx = findConvertible(['FeatureCallout', 'StatsRow', 'ScreenshotShowcase']);
    if (idx >= 0) {
      const orig = scenes[idx];
      scenes[idx] = {
        type: 'TemplateCollage',
        durationFrames: orig.durationFrames,
        props: {
          caption: orig.props.headline || orig.props.subtitle || orig.props.caption || `Explore everything ${brand} offers`,
          images: eightScreenshots,
        },
      };
      console.log(`[MarketingAgent] Forced: ${orig.type} #${idx} → TemplateCollage`);
    } else {
      scenes.splice(insertIndex(), 0, {
        type: 'TemplateCollage',
        durationFrames: DEFAULT_FRAMES,
        props: {
          caption: `Explore everything ${brand} offers`,
          images: eightScreenshots,
        },
      });
      console.log('[MarketingAgent] Inserted new TemplateCollage scene');
    }
  }

  // Re-compute total frames
  const newTotal = scenes.reduce((acc, s) => acc + Math.max(1, s.durationFrames), 0);
  return { ...plan, meta: { ...plan.meta, totalFrames: newTotal }, scenes };
}

const OMNI_CLIP_DEFAULT_FRAMES = 240; // 8s for an Omni scene if we have to inject one

// If there's an unused Omni clip in the DB, splice it into the plan's AnimatedFootage scene
// (or insert a new AnimatedFootage scene before the EndingCTA). Marks the clip as used so
// subsequent renders don't keep injecting the same one.
function injectOmniClipIfAvailable(plan: ScenePlan, backendBaseUrl: string): ScenePlan {
  const clip = getLatestUnusedOmniClip();
  if (!clip) return plan;

  const streamUrl = `${backendBaseUrl}/api/v1/omni/clips/${clip.id}/stream`;
  const scenes = [...plan.scenes];

  // 1. Look for existing AnimatedFootage scene to override
  const existingIdx = scenes.findIndex((s) => s.type === 'AnimatedFootage');
  if (existingIdx >= 0) {
    scenes[existingIdx] = {
      ...scenes[existingIdx],
      props: {
        ...scenes[existingIdx].props,
        clipUrls: [streamUrl],
        caption: scenes[existingIdx].props.caption || 'Generated by Gemini Omni',
      },
    };
    console.log(`[MarketingAgent] Injected Omni clip ${clip.id} into existing AnimatedFootage scene #${existingIdx}`);
  } else {
    // 2. Insert a new AnimatedFootage scene before the EndingCTA (or at end)
    const insertAt = Math.max(0, scenes.findIndex((s) => s.type === 'EndingCTA'));
    const finalInsertAt = insertAt < 0 ? scenes.length : insertAt;
    scenes.splice(finalInsertAt, 0, {
      type: 'AnimatedFootage',
      durationFrames: OMNI_CLIP_DEFAULT_FRAMES,
      props: {
        clipUrls: [streamUrl],
        caption: 'See it in motion',
        headline: 'Generated by Gemini Omni',
      },
    });
    console.log(`[MarketingAgent] Injected new AnimatedFootage scene at index ${finalInsertAt} for Omni clip ${clip.id}`);
  }

  // 3. Re-balance: simplest — let calculateMetadata in Root.tsx use the new sum (since it sums
  // scene.durationFrames). Update meta.totalFrames so director's stored value matches.
  const newTotal = scenes.reduce((acc, s) => acc + Math.max(1, s.durationFrames), 0);
  const newPlan: ScenePlan = {
    ...plan,
    meta: { ...plan.meta, totalFrames: newTotal },
    scenes,
  };

  // 4. Mark clip used so we don't re-inject on next render
  try { markOmniClipUsed(clip.id); } catch { /* ignore */ }

  return newPlan;
}

export type MarketingStatus =
  | 'idle'
  | 'directing'    // Gemini composing the scene plan
  | 'bundling'     // Remotion bundling (first-run cost)
  | 'rendering'    // Chromium per-frame rendering
  | 'complete'
  | 'error';

export interface MarketingState {
  status: MarketingStatus;
  message: string;
  crawlId: string | null;
  progress: number;         // 0..1 — meaningful only during rendering
  jobId: string | null;
  videoPath: string | null;
  error: string | null;
}

export interface MarketingGenerateRequest {
  crawlId: string;
  targetUrl: string;
  screenshotPaths: string[];
  discoveredPages: string[];
  recordMode?: 'short' | 'full'; // 'short' = tight ~75s cut (default); 'full' = longer (up to ~3 min+)
}

class MarketingAgent {
  private _state: MarketingState = {
    status: 'idle',
    message: 'Marketing agent is idle.',
    crawlId: null,
    progress: 0,
    jobId: null,
    videoPath: null,
    error: null,
  };

  get state(): MarketingState {
    return { ...this._state };
  }

  private updateState(updates: Partial<MarketingState>) {
    this._state = { ...this._state, ...updates };
    console.log(`[MarketingAgent] ${this._state.status} (${Math.round(this._state.progress * 100)}%): ${this._state.message}`);
  }

  reset() {
    this.updateState({
      status: 'idle',
      message: 'Marketing agent is idle.',
      crawlId: null,
      progress: 0,
      jobId: null,
      videoPath: null,
      error: null,
    });
  }

  async generate(request: MarketingGenerateRequest): Promise<MarketingState> {
    const jobId = `marketing-${Date.now()}`;

    this.updateState({
      status: 'directing',
      message: '🎬 Director (Gemini) composing scene plan...',
      crawlId: request.crawlId,
      progress: 0,
      jobId,
      videoPath: null,
      error: null,
    });

    // 1. Director
    const directorResult = await generateScenePlan(
      {
        crawlId: request.crawlId,
        targetUrl: request.targetUrl,
        screenshotPaths: request.screenshotPaths,
        discoveredPages: request.discoveredPages,
        recordMode: request.recordMode || 'short', // short=tight ~75s cut; full=longer
      },
      (msg) => this.updateState({ message: msg }),
    );

    if (!directorResult.success) {
      // Director failed (API outage, parse loops). Before giving up, try to recover the
      // last successful scene plan from DB for this crawl — render new code over old plan.
      const previousJob = getLatestMarketingJobByCrawlId(request.crawlId);
      const previousPlanOk = previousJob
        && previousJob.scenePlanJson
        && previousJob.scenePlanJson !== '{}';

      if (previousPlanOk) {
        try {
          const reusedPlan = JSON.parse(previousJob.scenePlanJson);
          if (reusedPlan?.scenes?.length > 0) {
            console.log(`[MarketingAgent] Director failed — reusing last successful plan from job ${previousJob.id}`);
            this.updateState({
              status: 'directing',
              message: `♻️ Director API unavailable. Reusing last successful scene plan from ${new Date(previousJob.createdAt).toLocaleString()}.`,
            });
            // Fall through to renderer with the reused plan
            await this.renderAndPersist(jobId, request.crawlId, reusedPlan);
            return this.state;
          }
        } catch { /* fall through to error */ }
      }

      // No salvageable previous plan — surface failure
      this.updateState({
        status: 'error',
        message: `❌ Director failed: ${directorResult.error}`,
        error: directorResult.error,
      });
      this.persist(jobId, request.crawlId, directorResult.plan, null, 0, 'error', directorResult.error);
      return this.state;
    }

    if (!directorResult.plan) {
      this.updateState({
        status: 'error',
        message: '❌ Director returned no plan.',
        error: 'Director returned no plan',
      });
      this.persist(jobId, request.crawlId, null, null, 0, 'error', 'Director returned no plan');
      return this.state;
    }

    // 1. Force-inject Adobe-style scenes (Gemini persistently won't pick them)
    // Now async — does a live search-crawl for the PromptThenGrid scene
    this.updateState({
      status: 'directing',
      message: '🔍 Searching the live site for demo results...',
    });
    const screenshotNames = request.screenshotPaths.map(p => path.basename(p));
    let plan = await forceAdobeStyleScenes(directorResult.plan, screenshotNames, request.targetUrl);

    // 2. Splice in latest unused Omni clip (no-op if none)
    const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:5000';
    plan = injectOmniClipIfAvailable(plan, backendBaseUrl);

    await this.renderAndPersist(jobId, request.crawlId, plan);

    return this.state;
  }

  // Shared render+persist used by both fresh director path and "reuse previous plan" path
  private async renderAndPersist(jobId: string, crawlId: string, scenePlan: ScenePlan): Promise<void> {
    this.updateState({
      status: 'bundling',
      message: '📦 Bundling Remotion (cached after first run)...',
      progress: 0,
    });

    const renderResult = await renderMarketingVideo(
      { jobId, crawlId, scenePlan },
      (phase, progress) => {
        if (phase === 'bundling') {
          this.updateState({
            status: 'bundling',
            message: `📦 Bundling Remotion... ${Math.round(progress * 100)}%`,
            progress,
          });
        } else if (phase === 'rendering') {
          this.updateState({
            status: 'rendering',
            message: `🎥 Rendering video frames... ${Math.round(progress * 100)}%`,
            progress,
          });
        }
      },
    );

    if (!renderResult.success || !renderResult.videoPath) {
      this.updateState({
        status: 'error',
        message: `❌ Render failed: ${renderResult.error}`,
        error: renderResult.error,
      });
      this.persist(jobId, crawlId, scenePlan, null, 0, 'error', renderResult.error);
      return;
    }

    const shortsNote = renderResult.shortsVideoPath ? ' + 9:16 Shorts' : '';
    this.updateState({
      status: 'complete',
      message: `✅ Marketing video rendered!${shortsNote} (${renderResult.durationSeconds.toFixed(1)}s)`,
      progress: 1,
      videoPath: renderResult.videoPath,
    });
    this.persist(jobId, crawlId, scenePlan, renderResult.videoPath, renderResult.durationSeconds, 'complete', null, renderResult.shortsVideoPath);
  }

  private persist(
    jobId: string,
    crawlId: string,
    plan: ScenePlan | null,
    videoPath: string | null,
    durationSeconds: number,
    status: string,
    error: string | null,
    shortsVideoPath: string | null = null,
  ) {
    try {
      insertMarketingJob({
        id: jobId,
        crawlId,
        scenePlanJson: plan ? JSON.stringify(plan) : '{}',
        videoPath,
        shortsVideoPath,
        durationSeconds,
        status,
        error,
      });
    } catch (err) {
      console.warn('[MarketingAgent] DB persist failed:', err);
    }
  }
}

export const marketingAgent = new MarketingAgent();
