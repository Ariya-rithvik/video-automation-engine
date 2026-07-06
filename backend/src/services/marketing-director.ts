// Marketing video "director" — uses Gemini 2.5 Flash with structured output (responseSchema)
// to produce a ScenePlan JSON from a website crawl. Remotion later renders this plan to MP4.
//
// Architectural note: this mirrors the pattern in gemini.ts:generateCrawlAnalysisFromAPI but
// asks for structured JSON instead of narration markdown. The schema is the contract with
// D:\production_product\remotion\src\types.ts (ScenePlan).

import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import Jimp from 'jimp';

// ─── Lazy SDK init (same pattern as gemini.ts) ──────────────────────────────────

let aiInstance: GoogleGenAI | null = null;
let initTried = false;

function getAI(): GoogleGenAI | null {
  if (initTried) return aiInstance;
  initTried = true;
  if (process.env.GEMINI_API_KEY) {
    try {
      aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      console.log('[MarketingDirector] Gemini SDK initialized.');
    } catch (err) {
      console.error('[MarketingDirector] SDK init failed:', err);
    }
  } else {
    console.warn('[MarketingDirector] GEMINI_API_KEY not set — director will return fallback plan.');
  }
  return aiInstance;
}

// ─── Types (mirror remotion/src/types.ts) ───────────────────────────────────────

export interface ScenePlan {
  meta: {
    title: string;
    tagline: string;
    brand: { primary: string; secondary: string; bg: string };
    fps: 30;
    totalFrames: number;
  };
  scenes: Array<{ type: string; durationFrames: number; props: Record<string, unknown> }>;
}

export type RecordMode = 'short' | 'full';

export interface DirectorRequest {
  crawlId: string;
  targetUrl: string;
  screenshotPaths: string[];
  discoveredPages: string[];
  // ── Duration control (both OPTIONAL; default = SHORT) ──
  // `recordMode`: 'short' ⇒ ~75s target, 'full' ⇒ up to ~180s. Defaults to 'short'.
  // `targetDurationSec`: explicit override in SECONDS. If set, it wins over recordMode.
  // Omitting both keeps the historical caller working and yields a tight (~75s) video.
  recordMode?: RecordMode;
  targetDurationSec?: number;
}

export interface DirectorResult {
  success: boolean;
  plan: ScenePlan | null;
  error: string | null;
  screenshotsUsed: string[];
  model: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const TOTAL_BUDGET_BYTES = 18 * 1024 * 1024;
const TARGET_FPS = 30;

// Per-scene duration band (frames @ 30fps). Snappy floor, comfortable ceiling.
const SCENE_MIN_FRAMES = 90;   // 3s
const SCENE_MAX_FRAMES = 210;  // 7s

// Default target seconds per record mode. SHORT is the default everywhere.
const SHORT_TARGET_SEC = 75;   // tight hackathon-demo length
const FULL_TARGET_SEC = 180;   // up to ~3 min when explicitly requested

// ─── Duration plan ───────────────────────────────────────────────────────────────
// One place that turns (recordMode, targetDurationSec) into every downstream budget.
//
// IMPORTANT: the marketing-agent post-processes the director's plan (forceAdobeStyleScenes
// converts OR inserts a few extra scenes; an Omni clip may add one more), and the rendered
// length is the SUM of scene.durationFrames (see remotion/src/Root.tsx calcDuration). So we
// aim the director's OWN scene-sum a little UNDER the nominal target to leave headroom for
// those insertions, while still landing inside the short(60–90s)/full(≤180s) envelope.
interface DurationPlan {
  mode: RecordMode;
  targetSec: number;     // nominal user-facing target
  targetFrames: number;  // director's internal scene-sum target (with insertion headroom)
  minFrames: number;     // clamp floor for the director's scene-sum
  maxFrames: number;     // clamp ceiling for the director's scene-sum
  maxScenes: number;     // cap on number of scenes the director emits
}

function resolveDurationPlan(req: DirectorRequest): DurationPlan {
  const mode: RecordMode = req.recordMode === 'full' ? 'full' : 'short';

  // Effective target seconds: explicit override wins, else per-mode default.
  // Clamp to a sane envelope so a stray value can't produce a 1-frame or 10-min video.
  const rawSec = typeof req.targetDurationSec === 'number' && req.targetDurationSec > 0
    ? req.targetDurationSec
    : (mode === 'full' ? FULL_TARGET_SEC : SHORT_TARGET_SEC);
  const targetSec = Math.round(Math.min(Math.max(rawSec, 30), 200));

  // Reserve headroom for the agent's downstream scene insertions. Short videos get more
  // relative headroom (they insert proportionally more), full videos less.
  const headroom = mode === 'full' ? 0.90 : 0.82;
  const targetFrames = Math.round(targetSec * TARGET_FPS * headroom);

  // Clamp window around the internal target (±~20%), but never below one snappy scene.
  const minFrames = Math.max(SCENE_MIN_FRAMES, Math.round(targetFrames * 0.8));
  const maxFrames = Math.round(targetFrames * 1.2);

  // Scene count: ~6.5s average per scene fills the budget without dragging. But it MUST be
  // large enough that the window is actually reachable under the per-scene ceiling (7s) — a
  // 3-minute video genuinely needs more scenes. We take the larger of the two, capped at 30.
  const byPace = Math.round(targetFrames / (6.5 * TARGET_FPS));
  const byFeasibility = Math.ceil(maxFrames / SCENE_MAX_FRAMES);
  const maxScenes = Math.max(3, Math.min(30, Math.max(byPace, byFeasibility)));

  return { mode, targetSec, targetFrames, minFrames, maxFrames, maxScenes };
}

// Always-works fallback plan (single OneScenePan-style scene, no screenshots needed)
function fallbackPlan(targetUrl: string): ScenePlan {
  const hostname = (() => { try { return new URL(targetUrl).hostname.replace(/^www\./, ''); } catch { return targetUrl; } })();
  return {
    meta: {
      title: hostname,
      tagline: 'A polished marketing video, generated from the live site',
      brand: { primary: '#6366f1', secondary: '#ffffff', bg: '#0B0B0F' },
      fps: TARGET_FPS,
      totalFrames: 450,
    },
    scenes: [],
  };
}

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

// ─── Screenshot curation ──────────────────────────────────────────────────────────
// The user complained the video "only shows drawing" — i.e. many near-identical shots of
// one screen. Crawls also emit blank/loading frames and bursts like "…--1/--2/--3" of the
// same page. We therefore: (a) drop blank/near-blank frames, (b) drop near-duplicates via a
// perceptual average-hash, (c) group what's left by page-family (filename) and pick a DIVERSE
// subset round-robin across families so the video spans different pages/features, (d) cap the
// count to the duration budget. Everything degrades gracefully: if Jimp can't decode an image
// we keep it and fall back to filename-only diversity, so the director never crashes here.

interface ShotMeta {
  path: string;
  family: string;   // page/feature key from the filename (burst index stripped)
  hash: string;     // 64-bit average hash as a bit string, or '' if undecodable
  brightness: number; // mean luma 0..255 (for blank detection); NaN if undecodable
  variance: number;   // luma variance (near-0 ⇒ flat/blank); NaN if undecodable
}

// Derive a "page family" key from a screenshot filename so bursts of the same screen collapse.
// e.g. "screenshot-Coimbatore_Movie_Tickets…--3.png" → "coimbatore movie tickets…"
//      "demo-ai-2.png" → "demo ai", "demo-canvas.png" → "demo canvas"
function familyKey(p: string): string {
  let base = path.basename(p, path.extname(p));
  base = base.replace(/^screenshot[-_]/i, '');
  // Strip trailing burst indices: "--3", "-2", "_4", " (1)"
  base = base.replace(/[\s_(-]*\(?\d{1,3}\)?$/, '');
  base = base.replace(/[-_]+/g, ' ').trim().toLowerCase();
  return base || path.basename(p).toLowerCase();
}

// Average hash (aHash): downscale to 8x8 grayscale, threshold each pixel against the mean.
// Cheap and robust to compression/minor motion — perfect for "is this basically the same shot".
async function fingerprint(p: string): Promise<{ hash: string; brightness: number; variance: number }> {
  const img = await Jimp.read(p);
  img.grayscale().resize(8, 8, Jimp.RESIZE_BILINEAR);
  const vals: number[] = [];
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (_x, _y, idx) {
    vals.push(this.bitmap.data[idx]); // R channel == luma after grayscale
  });
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length;
  const hash = vals.map(v => (v >= mean ? '1' : '0')).join('');
  return { hash, brightness: mean, variance };
}

function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// Returns a curated, de-duplicated, diversity-ordered subset of screenshot paths.
async function curateScreenshots(
  paths: string[],
  maxCount: number,
  onStatus?: (msg: string) => void,
): Promise<string[]> {
  // 1. Existing files within the per-file + total size budget (unchanged policy).
  const sizeOk: string[] = [];
  let running = 0;
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    let sz: number;
    try { sz = fs.statSync(p).size; } catch { continue; }
    if (sz > MAX_IMAGE_BYTES) continue;
    if (running + sz > TOTAL_BUDGET_BYTES) break;
    sizeOk.push(p);
    running += sz;
  }
  if (sizeOk.length <= 1) return sizeOk.slice(0, maxCount);

  // 2. Fingerprint each (Jimp). Undecodable images keep going with empty hash/NaN stats.
  const metas: ShotMeta[] = [];
  for (const p of sizeOk) {
    let fp = { hash: '', brightness: NaN, variance: NaN };
    try { fp = await fingerprint(p); } catch { /* keep, fall back to filename diversity */ }
    metas.push({ path: p, family: familyKey(p), ...fp });
  }

  // 3. Drop blank / near-blank frames (flat luma that's almost all-white or all-dark/loading).
  //    Guard: only drop if we'd still have ≥3 shots left, so a sparse crawl isn't gutted.
  const isBlank = (m: ShotMeta) =>
    Number.isFinite(m.variance) && m.variance < 12 &&
    (m.brightness > 247 || m.brightness < 8);
  const nonBlank = metas.filter(m => !isBlank(m));
  let pool = nonBlank.length >= 3 ? nonBlank : metas;

  // 4. Drop near-duplicates via aHash Hamming distance. Keep the first of each cluster.
  const DUP_THRESHOLD = 6; // out of 64 bits; ≤6 differing ⇒ "basically identical"
  const deduped: ShotMeta[] = [];
  for (const m of pool) {
    const dup = m.hash && deduped.some(k => k.hash && hamming(k.hash, m.hash) <= DUP_THRESHOLD);
    if (!dup) deduped.push(m);
  }

  // 5. Group by page-family, preserving discovery order within each family.
  const families = new Map<string, ShotMeta[]>();
  for (const m of deduped) {
    const arr = families.get(m.family) || [];
    arr.push(m);
    families.set(m.family, arr);
  }

  // 6. Round-robin across families: one shot per family per pass. This guarantees VARIETY —
  //    we span every distinct page/feature before ever taking a second shot of any one screen.
  const buckets = Array.from(families.values());
  const ordered: ShotMeta[] = [];
  for (let pass = 0; ordered.length < deduped.length; pass++) {
    let advanced = false;
    for (const b of buckets) {
      if (b[pass]) { ordered.push(b[pass]); advanced = true; }
    }
    if (!advanced) break;
  }

  const picked = ordered.slice(0, maxCount).map(m => m.path);
  const dropped = sizeOk.length - picked.length;
  onStatus?.(`🎞️ Curated ${picked.length} diverse screenshot(s) across ${families.size} page(s) (deduped/blank-dropped ${dropped}).`);
  console.log(`[MarketingDirector] Curation: ${sizeOk.length} eligible → ${deduped.length} unique → ${picked.length} picked across ${families.size} families.`);
  return picked;
}

// ─── Schema (passed to responseSchema for structured output) ────────────────────

const SCENE_PLAN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    meta: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        tagline: { type: Type.STRING },
        brand: {
          type: Type.OBJECT,
          properties: {
            primary: { type: Type.STRING },
            secondary: { type: Type.STRING },
            bg: { type: Type.STRING },
          },
          required: ['primary', 'secondary', 'bg'],
        },
        fps: { type: Type.INTEGER },
        totalFrames: { type: Type.INTEGER },
      },
      required: ['title', 'tagline', 'brand', 'fps', 'totalFrames'],
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ['TitleCard', 'ScreenshotShowcase', 'FeatureCallout', 'PhoneMockup', 'StatsRow', 'ProcessSteps', 'AnimatedFootage', 'CursorClickReveal', 'PromptThenGrid', 'BeforeAfterSlider', 'DeviceFrame', 'TemplateCollage', 'EndingCTA'] },
          durationFrames: { type: Type.INTEGER },
          props: {
            type: Type.OBJECT,
            // Free-form per scene type — Gemini fills in based on type. We validate post-parse.
            properties: {
              title:         { type: Type.STRING },
              subtitle:      { type: Type.STRING },
              caption:       { type: Type.STRING },
              headline:      { type: Type.STRING },
              ctaText:       { type: Type.STRING },
              url:           { type: Type.STRING },
              screenshotUrl: { type: Type.STRING },
              bullets:       { type: Type.ARRAY, items: { type: Type.STRING } },
              floatingCards: { type: Type.ARRAY, items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  icon:  { type: Type.STRING },
                },
              }},
              stats:         { type: Type.ARRAY, items: {
                type: Type.OBJECT,
                properties: { value: { type: Type.STRING }, label: { type: Type.STRING } },
              }},
              steps:         { type: Type.ARRAY, items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  description: { type: Type.STRING },
                  icon: { type: Type.STRING },
                },
              }},
              // CursorClickReveal / BeforeAfterSlider props
              actionLabel:   { type: Type.STRING },
              resultLabel:   { type: Type.STRING },
              resultUrl:     { type: Type.STRING },
              beforeUrl:     { type: Type.STRING },
              afterUrl:      { type: Type.STRING },
              beforeLabel:   { type: Type.STRING },
              afterLabel:    { type: Type.STRING },
              clickX:        { type: Type.NUMBER },
              clickY:        { type: Type.NUMBER },
              // PromptThenGrid / TemplateCollage props
              promptText:    { type: Type.STRING },
              buttonLabel:   { type: Type.STRING },
              resultImages:  { type: Type.ARRAY, items: { type: Type.STRING } },
              images:        { type: Type.ARRAY, items: { type: Type.STRING } },
              // DeviceFrame props
              deviceType:    { type: Type.STRING },
              clipUrls:      { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
        required: ['type', 'durationFrames', 'props'],
      },
    },
  },
  required: ['meta', 'scenes'],
};

// ─── Director ───────────────────────────────────────────────────────────────────

export async function generateScenePlan(
  request: DirectorRequest,
  onStatus?: (msg: string) => void,
): Promise<DirectorResult> {
  const ai = getAI();
  if (!ai) {
    return {
      success: true, // fallback IS a valid output — we want the pipeline to keep going
      plan: fallbackPlan(request.targetUrl),
      error: 'GEMINI_API_KEY not set; returning fallback plan.',
      screenshotsUsed: [],
      model: 'fallback',
    };
  }

  // Resolve the duration budget (default = SHORT) once; it drives scene count, frame totals
  // and how many distinct screenshots we curate.
  const dur = resolveDurationPlan(request);
  console.log(`[MarketingDirector] Mode=${dur.mode} target≈${dur.targetSec}s (director scene-sum target ${dur.targetFrames}f, ≤${dur.maxScenes} scenes).`);

  // Curate screenshots: dedupe near-identical/blank frames and select a DIVERSE subset that
  // spans different pages/features (fixes "only shows drawing"). Cap the count to the budget —
  // roughly one screenshot per scene, a touch more for variety, bounded so the JSON stays small.
  const maxScreenshots = Math.max(4, Math.min(12, dur.maxScenes + 2));
  const picked = await curateScreenshots(request.screenshotPaths, maxScreenshots, onStatus);

  if (picked.length === 0) {
    return {
      success: true,
      plan: fallbackPlan(request.targetUrl),
      error: 'No screenshots fit the size budget; returning fallback plan.',
      screenshotsUsed: [],
      model: 'fallback',
    };
  }

  onStatus?.(`📦 Encoding ${picked.length} screenshot(s) for the director...`);

  const imageParts = picked.map(p => ({
    inlineData: {
      mimeType: mimeFor(p),
      data: fs.readFileSync(p).toString('base64'),
    },
  }));

  const pageList = request.discoveredPages.map(s => s.replace(/_/g, ' ')).join(', ');
  const screenshotFilenames = picked.map(p => path.basename(p));

  const targetSecForPrompt = Math.round(dur.targetFrames / TARGET_FPS);
  const sceneCountHint = Math.max(3, Math.min(dur.maxScenes, Math.round(dur.targetFrames / (6.5 * TARGET_FPS))));
  const prompt = `You are the director of a ~${targetSecForPrompt} second polished marketing hero video for a SaaS/consumer product.

Target site: ${request.targetUrl}
Discovered pages: ${pageList}
Attached: ${picked.length} screenshots, file names: ${screenshotFilenames.join(', ')}

Your job: emit a ScenePlan JSON describing about ${sceneCountHint} scenes (at most ${dur.maxScenes}) that show off the product like a Stripe or Linear marketing video.

Hard rules:
- fps = 30
- totalFrames MUST be between ${dur.minFrames} and ${dur.maxFrames} (about ${targetSecForPrompt}s). KEEP IT TIGHT — do not pad to fill time.
- Emit AT MOST ${dur.maxScenes} scenes. Fewer, stronger scenes beat many filler scenes.
- Each scene's durationFrames MUST be between ${SCENE_MIN_FRAMES} (3s) and ${SCENE_MAX_FRAMES} (7s). Snappy pacing — viewers shouldn't wait too long on any one scene.
- Show VARIETY: each scene should highlight a DIFFERENT page/feature. Do NOT reuse the same screenshot across multiple scenes.
- Sum of scene durationFrames MUST equal totalFrames (we will validate)
- Use ONLY these scene types: TitleCard, PhoneMockup, FeatureCallout, ScreenshotShowcase, StatsRow, ProcessSteps, AnimatedFootage, CursorClickReveal, PromptThenGrid, BeforeAfterSlider, DeviceFrame, TemplateCollage, EndingCTA
- For PhoneMockup and ScreenshotShowcase, screenshotUrl MUST be one of the attached filenames listed above (exact match)
- Brand colors: pick hex values that match the product's actual visual identity from the screenshots
- Open with TitleCard, end with EndingCTA. Put PhoneMockup or ScreenshotShowcase second to hook the viewer. Include AT LEAST ONE ProcessSteps scene mid-video — it shows a 3–4 step user journey (e.g. "Browse → Order → Track → Enjoy"), which feels more like a real demo.
- Stats must be realistic for what you know about this brand — invent plausible numbers if needed
- Captions and bullets: punchy, 3–6 words max each. No filler
- FeatureCallout "headline" must be at most 22 characters TOTAL including spaces — long headlines wrap badly. Examples that fit: "Grow Your Business" (18), "Fast Free Delivery" (18), "Build Your Brand" (16). Bad: "Grow Your Restaurant Business" (29 — too long). If you can't shorten naturally, drop a word.
- TitleCard "title" must be at most 18 characters
- EndingCTA "title" must be at most 24 characters

CRITICAL — keep the JSON small:
- For any "url" field: use the CANONICAL short URL only (e.g. "https://www.zomato.com" or "https://www.zomato.com/partner") — NEVER copy tracking parameters, NEVER include "?app=" "?channel=" "?adjust_" or any query strings. Strip everything after the path.
- Every string field max 80 characters
- No markdown formatting, no commentary, just the JSON object

CRITICAL — brand colors are for a CLEAN PROFESSIONAL product demo (Stripe/Linear/Notion style):
- "brand.bg" MUST be a near-white off-white between #F0F0F2 and #FFFFFF (e.g. "#F5F5F7", "#FAFAFA"). NEVER dark, NEVER saturated. This is a clean demo background.
- "brand.primary" should be the actual brand accent color (vivid, saturated, e.g. "#E23744" for Zomato, "#FF9900" for Amazon). Used ONLY as accent on buttons, cursor, ripples — NOT as background tint.
- "brand.secondary" should be the dark text color (e.g. "#1A1A1A" or "#333333") that reads against the light bg.

For PhoneMockup scenes, you MUST include 3–4 floatingCards. Each card:
- "label": ALL CAPS short word, max 10 chars (e.g. "FAST", "TRUSTED", "RATING", "ORDERS")
- "value": punchy short fact, max 14 chars (e.g. "<30 min", "4.9 ★", "10M+ users", "Free")
- "icon": see the icon list below.
- Pick icons that genuinely match the brand category (e.g. for a food app: Pizza, Truck, Star, Clock; for an education app: GraduationCap, BookOpen, Award, Users)

For AnimatedFootage scenes, you MAY use this when you want a "video clip" feel — multiple screenshots crossfading with Ken Burns zoom. Each:
- "clipUrls": array of 2–3 attached screenshot filenames (must match exactly)
- "caption": one short headline (max 30 chars) overlaid on the footage
- "headline": optional — appears below caption (max 22 chars)
Use AnimatedFootage 0–1 times per video. Best at mid-video for variety.

PREFER concrete product-demonstration scenes over static showcase scenes. Use AT LEAST 2 of these per video:
- CursorClickReveal — shows a cursor clicking a UI element on a screenshot. Props: screenshotUrl (required, one of the attached filenames), caption, actionLabel (what the click does, e.g. "Add to cart"), resultLabel (confirmation, e.g. "✓ Item added"), clickX (0-100 % of frame width, default 50), clickY (0-100 % of frame height, default 72). Use this to demonstrate a specific feature.
- PromptThenGrid — fake AI prompt input typewriters in, generates 4 result tiles. Props: caption, promptText (what's typed, e.g. "Find pizza near me"), buttonLabel (default "Generate"), resultImages (4 attached filenames to show as results).
- BeforeAfterSlider — split-screen slider revealing edit. Props: beforeUrl + afterUrl (both attached filenames; if you only have one, use same for both — code will apply a color shift to "after"), caption, beforeLabel ("BEFORE"), afterLabel ("AFTER").
- DeviceFrame — wraps a screenshot in a laptop / tablet / watch mockup. Props: screenshotUrl, caption, deviceType ("laptop" | "tablet" | "watch", default laptop).
- TemplateCollage — 6–8 screenshots arranged in a parallax-drifting grid. Props: caption, images (array of attached filenames). Great for "look at the variety" moments.

For ProcessSteps scenes, you MUST include 3–4 steps in the "steps" array. Each step:
- "label": ALL CAPS short verb, max 12 chars (e.g. "BROWSE", "ORDER", "TRACK", "ENJOY")
- "description": 3–6 word explanation of what happens (e.g. "Explore restaurants near you")
- "icon": see the icon list below.
- Order matters — first step is leftmost. The scene auto-renders connecting arrows between them.
- Also include a "headline" string at most 30 chars to title the steps (e.g. "How Zomato Works")

Icon name list (case-sensitive, use EXACTLY): Calendar, Download, GraduationCap, ShoppingCart, ShoppingBag, Star, Clock, Users, Zap, Award, Heart, Coffee, Phone, Camera, Music, Film, MapPin, MessageSquare, Search, Settings, ShieldCheck, Truck, Package, ChefHat, Pizza, UtensilsCrossed, Briefcase, CreditCard, DollarSign, TrendingUp, Sparkles, ThumbsUp, Gift, Globe, Mail, Bell, BookOpen, Bookmark, Headphones, PlayCircle, Video, Mic, Send, CheckCircle2, ArrowRight, Bike, Car, Plane, Home, Building, Flame, Cloud, Sun, Moon

Return ONLY the JSON conforming to the schema.`;

  onStatus?.('🎬 Director (Gemini) is composing the scene plan...');

  // Retry loop — Gemini occasionally falls into URL repetition loops when screenshots embed
  // long tracking URLs. We try up to 3 times, escalating prompt strictness + cooling temperature.
  let rawPlan: ScenePlan | null = null;
  let lastError = '';
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Backoff so retries don't hammer Gemini during a 503 / high-demand window
    if (attempt > 1) {
      const waitMs = 4000 * (attempt - 1); // 4s, 8s
      console.log(`[MarketingDirector] Waiting ${waitMs}ms before retry ${attempt}...`);
      onStatus?.(`⏳ Director retrying (attempt ${attempt}/${MAX_ATTEMPTS}) after ${waitMs / 1000}s wait...`);
      await new Promise(r => setTimeout(r, waitMs));
    }

    const attemptPrompt = attempt === 1
      ? prompt
      : `${prompt}\n\n⚠️ RETRY ${attempt}. Previous attempt produced an infinite URL repetition loop. THIS TIME: every url field must be either "" (empty string) OR a canonical URL UNDER 40 characters total. Example: "https://www.zomato.com" (22 chars) is good. Anything with "?app=" "?channel=" "_deeplink_" "_button_" "?adjust_" is forbidden — set those to "" instead. NO query strings. NO tracking params. NO exceptions.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: attemptPrompt }, ...imageParts],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: SCENE_PLAN_SCHEMA,
          maxOutputTokens: 8192,
          temperature: attempt === 1 ? 0.7 : 0.3,
          stopSequences: ['_deeplink_click', '_app_download_button', '?app=1&channel', '?adjust_t='],
        },
      });

      const text = (response.text || '').trim();
      if (!text) {
        lastError = `Attempt ${attempt}: empty response`;
        console.warn(`[MarketingDirector] ${lastError}`);
        continue;
      }

      try {
        rawPlan = JSON.parse(text);
        if (attempt > 1) console.log(`[MarketingDirector] ✅ Recovered on attempt ${attempt}`);
        break; // success
      } catch (parseErr) {
        console.error(`[MarketingDirector] Attempt ${attempt} JSON parse failed.`);
        console.error('  Response length:', text.length, 'chars');
        console.error('  Last 200:', text.slice(-200));
        lastError = `Attempt ${attempt} parse error: ${(parseErr as Error).message}`;
      }
    } catch (apiErr: any) {
      lastError = `Attempt ${attempt} API error: ${apiErr?.message || String(apiErr)}`;
      console.error(`[MarketingDirector] ${lastError}`);
    }
  }

  if (!rawPlan) {
    return {
      success: false,
      plan: fallbackPlan(request.targetUrl),
      error: `Director failed after ${MAX_ATTEMPTS} attempts. Last: ${lastError}`,
      screenshotsUsed: screenshotFilenames,
      model: 'fallback',
    };
  }

  try {

    const normalized = normalizePlan(rawPlan, request.targetUrl, dur);

    return {
      success: true,
      plan: normalized,
      error: null,
      screenshotsUsed: screenshotFilenames,
      model: 'gemini-2.5-flash',
    };
  } catch (err: any) {
    return {
      success: true,
      plan: fallbackPlan(request.targetUrl),
      error: `Director API error: ${err?.message || String(err)}`,
      screenshotsUsed: screenshotFilenames,
      model: 'fallback',
    };
  }
}

// ─── Validation / Normalization ─────────────────────────────────────────────────
// Gemini sometimes returns scenes whose durations don't sum to totalFrames, or invalid brand colors.
// We fix these silently so Remotion never sees a broken plan.

function normalizePlan(p: ScenePlan, targetUrl: string, dur: DurationPlan): ScenePlan {
  const fb = fallbackPlan(targetUrl);

  // Target the director's internal scene-sum, clamped into the resolved window. This (NOT
  // meta.totalFrames per se) is what Remotion renders, since Root.tsx sums scene durations.
  const totalFrames = Math.min(
    Math.max(p.meta?.totalFrames || dur.targetFrames, dur.minFrames),
    dur.maxFrames,
  );

  // Meta defaults
  const meta = {
    title: (p.meta?.title || fb.meta.title).slice(0, 60),
    tagline: (p.meta?.tagline || fb.meta.tagline).slice(0, 200),
    brand: {
      primary: validHex(p.meta?.brand?.primary) || fb.meta.brand.primary,
      secondary: validHex(p.meta?.brand?.secondary) || fb.meta.brand.secondary,
      bg: clampBgLight(validHex(p.meta?.brand?.bg) || '#F5F5F7'),
    },
    theme: 'light' as const,  // force the new professional product-demo look
    fps: 30 as const,
    totalFrames,
  };

  // Drop scenes with unknown types or zero/negative duration
  const validTypes = new Set(['TitleCard', 'ScreenshotShowcase', 'FeatureCallout', 'PhoneMockup', 'StatsRow', 'ProcessSteps', 'AnimatedFootage', 'CursorClickReveal', 'PromptThenGrid', 'BeforeAfterSlider', 'DeviceFrame', 'TemplateCollage', 'ProductSelectAndCart', 'EndingCTA']);
  let scenes = (p.scenes || []).filter(s => validTypes.has(s.type) && s.durationFrames > 0);

  // ── Cap the number of scenes to the duration budget ──
  // Gemini sometimes ignores the count rule. Trim the MIDDLE so the narrative arc survives:
  // always keep the opening TitleCard and the closing EndingCTA, drop interior scenes from the
  // back of the middle (later/weaker scenes go first). The agent will still inject its few
  // Adobe-style scenes afterward, so we deliberately leave a little room under maxScenes.
  const sceneCap = Math.max(3, dur.maxScenes);
  if (scenes.length > sceneCap) {
    const first = scenes[0];
    const last = scenes[scenes.length - 1];
    const keepFirst = first?.type === 'TitleCard';
    const keepLast = last?.type === 'EndingCTA';
    const head = keepFirst ? [first] : [];
    const tail = keepLast ? [last] : [];
    const middle = scenes.slice(head.length, scenes.length - tail.length);
    const middleBudget = Math.max(0, sceneCap - head.length - tail.length);
    scenes = [...head, ...middle.slice(0, middleBudget), ...tail];
  }

  // Cap TitleCard duration at 90 frames (3s) — user wants the opening snappy, not 10s freeze
  for (const s of scenes) {
    if (s.type === 'TitleCard' && s.durationFrames > 90) s.durationFrames = 90;
  }

  // Clamp every scene into the snappy per-scene band before rebalancing.
  for (const s of scenes) {
    s.durationFrames = Math.min(Math.max(s.durationFrames, SCENE_MIN_FRAMES), SCENE_MAX_FRAMES);
  }

  // Re-balance durations so they sum exactly to the target (this sum IS the rendered length).
  if (scenes.length > 0) {
    const n = scenes.length;
    // The target must be reachable while every scene stays inside the band. If Gemini returned
    // too few scenes to fill the budget, we honor the band and end up a bit shorter (still > min);
    // if it returned many, we land on target. Either way every scene stays snappy.
    const feasibleMin = n * SCENE_MIN_FRAMES;
    const feasibleMax = n * SCENE_MAX_FRAMES;
    const goal = Math.min(Math.max(meta.totalFrames, feasibleMin), feasibleMax);

    // Scale toward the goal, clamping into the band.
    const sum = scenes.reduce((acc, s) => acc + s.durationFrames, 0) || 1;
    const ratio = goal / sum;
    for (const s of scenes) {
      s.durationFrames = Math.min(Math.max(Math.round(s.durationFrames * ratio), SCENE_MIN_FRAMES), SCENE_MAX_FRAMES);
    }

    // Distribute the residual one frame at a time, only onto scenes with headroom in the band,
    // so the sum hits `goal` exactly without pushing any scene out of range.
    let residual = goal - scenes.reduce((acc, s) => acc + s.durationFrames, 0);
    let guard = residual === 0 ? 0 : Math.abs(residual) + n + 8;
    while (residual !== 0 && guard-- > 0) {
      const step = residual > 0 ? 1 : -1;
      let changed = false;
      for (const s of scenes) {
        if (residual === 0) break;
        const next = s.durationFrames + step;
        if (next >= SCENE_MIN_FRAMES && next <= SCENE_MAX_FRAMES) {
          s.durationFrames = next;
          residual -= step;
          changed = true;
        }
      }
      if (!changed) break; // no scene has headroom — accept the closest feasible sum
    }
  }

  // Keep meta.totalFrames consistent with the actual scene-sum we just produced.
  if (scenes.length > 0) {
    meta.totalFrames = scenes.reduce((acc, s) => acc + s.durationFrames, 0);
  }

  return { meta, scenes };
}

function validHex(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  return /^#[0-9a-f]{6}$/i.test(s) ? s : null;
}

// Relative luminance per WCAG (0..1). White = 1, black = 0.
function hexLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0.5;
  const [r, g, b] = [m[1], m[2], m[3]].map(c => parseInt(c, 16) / 255);
  const toLin = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

// Force brand.bg LIGHT — we want a clean professional product-demo aesthetic, not a moody hero ad.
// Gemini might suggest dark or saturated colors; we clamp them to a near-white off-white.
function clampBgLight(bg: string): string {
  return hexLuminance(bg) < 0.85 ? '#F5F5F7' : bg;
}
