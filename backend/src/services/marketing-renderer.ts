// Remotion render wrapper — bundles D:\production_product\remotion\src\index.ts and
// renders the "MarketingVideo" composition to an MP4 file in backend/output/.
//
// Bundling is expensive (~10s cold) so we cache the serveUrl across calls.
// Rendering itself is Chromium-per-frame; ~30-90s for a 15-30s @ 30fps composition.

import { bundle } from '@remotion/bundler';
import { selectComposition, renderMedia } from '@remotion/renderer';
import * as fs from 'fs';
import * as path from 'path';
import type { ScenePlan } from './marketing-director';
import { postProcessVideo } from './ffmpeg-post-process';

const REMOTION_ENTRY = path.resolve(__dirname, '../../../remotion/src/index.ts');
const OUTPUT_DIR = path.resolve(__dirname, '../../output');
const COMPOSITION_ID = 'MarketingVideo';
const COMPOSITION_ID_SHORTS = 'MarketingVideoShorts';
const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://localhost:5000';

// Rewrite bare screenshot filenames in scene props to fully-qualified URLs that Remotion's
// headless Chromium can fetch via the backend's stream endpoint. Handles both screenshotUrl
// (PhoneMockup, ScreenshotShowcase) and clipUrls[] (AnimatedFootage).
function toStreamUrl(filename: string): string {
  if (/^https?:\/\//i.test(filename)) return filename;
  const base = path.basename(filename);
  // Search-crawl screenshots (search-<ts>-<n>.png) live in data/search-crawls/ — route to that endpoint
  if (filename.includes('search-crawls') || /^search-\d+-\d+\.png$/i.test(base)) {
    return `${BACKEND_BASE_URL}/api/v1/search-crawl/file/${encodeURIComponent(base)}`;
  }
  // Regular crawl screenshots live in watched/
  return `${BACKEND_BASE_URL}/api/v1/stream/screenshot/${encodeURIComponent(base)}`;
}

function rewriteScenePlanAssets(plan: ScenePlan): ScenePlan {
  // All scene-prop fields that may carry image filenames Gemini emitted (single)
  const SINGLE_IMAGE_FIELDS = ['screenshotUrl', 'resultUrl', 'beforeUrl', 'afterUrl', 'selectedImage', 'heroImage'];
  // All scene-prop fields that may carry image-filename arrays
  const ARRAY_IMAGE_FIELDS = ['clipUrls', 'resultImages', 'images', 'otherImages'];

  return {
    ...plan,
    scenes: (plan.scenes || []).map((scene) => {
      const newProps: Record<string, any> = { ...scene.props };

      for (const f of SINGLE_IMAGE_FIELDS) {
        if (typeof newProps[f] === 'string' && newProps[f].length > 0) {
          newProps[f] = toStreamUrl(newProps[f]);
        }
      }

      for (const f of ARRAY_IMAGE_FIELDS) {
        if (Array.isArray(newProps[f])) {
          newProps[f] = newProps[f]
            .filter((u: unknown) => typeof u === 'string' && u.length > 0)
            .map((u: string) => toStreamUrl(u));
        }
      }

      return { ...scene, props: newProps };
    }),
  };
}

let cachedServeUrl: string | null = null;

export interface RenderRequest {
  jobId: string;
  crawlId: string;
  scenePlan: ScenePlan;
}

export interface RenderResult {
  success: boolean;
  videoPath: string | null;        // 16:9 landscape
  shortsVideoPath: string | null;  // 9:16 vertical Shorts
  durationSeconds: number;
  error: string | null;
}

// Render a single composition id to a file, then FFmpeg-polish it. Returns the final (polished) path.
async function renderAndPolish(
  serveUrl: string,
  compositionId: string,
  format: 'landscape' | 'shorts',
  planForRender: ScenePlan,
  outputLocation: string,
  onProgress?: (progress: number) => void,
): Promise<{ path: string; durationSeconds: number } | null> {
  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps: { scenePlan: planForRender, format },
  });
  const durationSeconds = composition.durationInFrames / composition.fps;
  console.log(`[MarketingRenderer] ${compositionId}: ${composition.durationInFrames}f @ ${composition.fps}fps (${composition.width}x${composition.height})`);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps: { scenePlan: planForRender, format },
    imageFormat: 'jpeg',
    concurrency: 4,
    onProgress: ({ progress }) => onProgress?.(progress),
  });

  if (!fs.existsSync(outputLocation)) {
    console.error(`[MarketingRenderer] ${compositionId} render produced no file`);
    return null;
  }

  const polished = await postProcessVideo(outputLocation, { intensity: 'medium' });
  const finalPath = polished.success ? polished.outputPath : outputLocation;
  if (polished.success && polished.outputPath !== outputLocation) {
    try { fs.unlinkSync(outputLocation); } catch { /* ignore */ }
  }
  return { path: finalPath, durationSeconds };
}

export async function renderMarketingVideo(
  request: RenderRequest,
  onProgress?: (phase: 'bundling' | 'rendering', progress: number) => void,
): Promise<RenderResult> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    // 1. Bundle (cached after first run)
    if (!cachedServeUrl) {
      onProgress?.('bundling', 0);
      console.log('[MarketingRenderer] Bundling Remotion entry:', REMOTION_ENTRY);
      cachedServeUrl = await bundle({
        entryPoint: REMOTION_ENTRY,
        // webpackOverride: (cfg) => cfg, // pass-through; customize later if needed
      });
      console.log('[MarketingRenderer] Bundle ready at:', cachedServeUrl);
      onProgress?.('bundling', 1);
    }

    // 2. Rewrite asset URLs so Remotion's Chromium can fetch screenshots from the backend
    const planForRender = rewriteScenePlanAssets(request.scenePlan);

    const ts = Date.now();
    const landscapeOut = path.join(OUTPUT_DIR, `marketing-${request.crawlId}-${ts}.mp4`);
    const shortsOut = path.join(OUTPUT_DIR, `marketing-${request.crawlId}-${ts}-shorts.mp4`);

    // 3. Render the 16:9 LANDSCAPE composition (primary). Progress 0 → 0.6.
    onProgress?.('rendering', 0);
    const landscape = await renderAndPolish(
      cachedServeUrl, COMPOSITION_ID, 'landscape', planForRender, landscapeOut,
      (p) => onProgress?.('rendering', p * 0.6),
    );
    if (!landscape) {
      return { success: false, videoPath: null, shortsVideoPath: null, durationSeconds: 0, error: 'Landscape render produced no file.' };
    }
    console.log(`[MarketingRenderer] ✅ Landscape ready: ${landscape.path}`);

    // 4. Render the 9:16 SHORTS composition (same bundle + scenePlan). Progress 0.6 → 1.0.
    //    Shorts is a bonus — never fail the whole job if only the vertical cut breaks.
    let shortsPath: string | null = null;
    try {
      const shorts = await renderAndPolish(
        cachedServeUrl, COMPOSITION_ID_SHORTS, 'shorts', planForRender, shortsOut,
        (p) => onProgress?.('rendering', 0.6 + p * 0.4),
      );
      shortsPath = shorts ? shorts.path : null;
      if (shortsPath) console.log(`[MarketingRenderer] ✅ Shorts ready: ${shortsPath}`);
    } catch (shortsErr: any) {
      console.warn('[MarketingRenderer] Shorts render failed (landscape still OK):', shortsErr?.message || shortsErr);
    }

    onProgress?.('rendering', 1);
    return {
      success: true,
      videoPath: landscape.path,
      shortsVideoPath: shortsPath,
      durationSeconds: landscape.durationSeconds,
      error: null,
    };
  } catch (err: any) {
    console.error('[MarketingRenderer] Render failed:', err);
    return {
      success: false,
      videoPath: null,
      shortsVideoPath: null,
      durationSeconds: 0,
      error: err?.message || String(err),
    };
  }
}
