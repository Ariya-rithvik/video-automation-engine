import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { LogStep, ExecutionLog } from '../watcher';

let aiInstance: any = null;

// ─── Crawl Analysis (Multimodal API) ────────────────────────────────────────────

export interface CrawlAnalysisRequest {
  crawlId: string;
  targetUrl: string;
  screenshotPaths: string[];
  discoveredPages: string[];
  customPrompt?: string;
}

export interface CrawlAnalysisResult {
  success: boolean;
  response: string | null;
  error: string | null;
  screenshotsUsed: string[];
  model: string;
}

const MAX_SCREENSHOTS = 15;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // skip individual files > 4MB (per-image limit for inline)
const TOTAL_BUDGET_BYTES = 18 * 1024 * 1024; // total payload safety cap

function mimeFor(p: string): string {
  const ext = path.extname(p).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

// Short, fast Gemini call — returns ONE popular product/service to search for on the given site.
// Used by the marketing pipeline to pick a demo query for the PromptThenGrid scene.
export async function pickDemoSearchQuery(targetUrl: string): Promise<string> {
  if (!aiInstance) {
    return defaultQueryForUrl(targetUrl);
  }
  try {
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `For the website ${targetUrl}, name ONE popular product, service, or category that would make a compelling marketing-video search demo.

Reply with just the search query — 2 to 4 words max, plain text, no quotes, no commentary, no punctuation at the end.

Examples:
- For amazon.in → "wireless earbuds"
- For zomato.com → "biryani near me"
- For netflix.com → "comedy movies"
- For github.com → "react components"

Your answer:`,
      config: {
        maxOutputTokens: 16,
        temperature: 0.5,
      },
    });
    const text = (response.text || '').trim().replace(/^["'`\s]+|["'`\s.!?]+$/g, '');
    if (text && text.length > 0 && text.length < 60) return text;
  } catch (err) {
    console.warn('[Gemini] pickDemoSearchQuery failed:', err);
  }
  return defaultQueryForUrl(targetUrl);
}

function defaultQueryForUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('amazon') || u.includes('flipkart') || u.includes('shop')) return 'wireless earbuds';
  if (u.includes('zomato') || u.includes('swiggy') || u.includes('food')) return 'pizza near me';
  if (u.includes('netflix') || u.includes('prime') || u.includes('hotstar')) return 'comedy movies';
  if (u.includes('github') || u.includes('gitlab')) return 'react components';
  if (u.includes('myntra') || u.includes('ajio')) return 'running shoes';
  return 'best deals';
}

export async function generateCrawlAnalysisFromAPI(
  request: CrawlAnalysisRequest,
  onStatus?: (msg: string) => void
): Promise<CrawlAnalysisResult> {
  if (!aiInstance) {
    return {
      success: false,
      response: null,
      error: 'GEMINI_API_KEY is not configured. Add it to backend/.env and restart.',
      screenshotsUsed: [],
      model: 'none',
    };
  }

  // Filter valid screenshots respecting size budget
  const candidates = request.screenshotPaths.filter(p => fs.existsSync(p));
  const picked: string[] = [];
  let runningBytes = 0;
  for (const p of candidates) {
    if (picked.length >= MAX_SCREENSHOTS) break;
    const size = fs.statSync(p).size;
    if (size > MAX_IMAGE_BYTES) continue;
    if (runningBytes + size > TOTAL_BUDGET_BYTES) break;
    picked.push(p);
    runningBytes += size;
  }

  if (picked.length === 0) {
    return {
      success: false,
      response: null,
      error: `No screenshots fit the size budget (max ${MAX_SCREENSHOTS} files, ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB each).`,
      screenshotsUsed: [],
      model: 'gemini-2.5-flash',
    };
  }

  onStatus?.(`📦 Encoding ${picked.length} screenshot(s) (${Math.round(runningBytes / 1024 / 1024)}MB total)...`);

  const imageParts = picked.map(p => ({
    inlineData: {
      mimeType: mimeFor(p),
      data: fs.readFileSync(p).toString('base64'),
    },
  }));

  const pageList = request.discoveredPages.map(s => s.replace(/_/g, ' ')).join(', ');
  const promptText = request.customPrompt || `I'm showing you ${picked.length} screenshots from a website crawl of ${request.targetUrl}.

The crawl discovered ${request.discoveredPages.length} pages in total: ${pageList}.

Please analyze each screenshot and generate a professional demo script that:
1. Describes what each page/feature does based on what you see
2. Highlights the key UI elements, design choices, and functionality visible
3. Uses a confident, professional narrator tone (like an Apple keynote)
4. Each page section should be 2-3 sentences of narration

Format your response as:

**SUMMARY**
[One paragraph overview of the entire website/app]

**PAGE SCRIPTS**

**[Page Name]**
[2-3 sentence narration for this page]

(Repeat for each distinct page you can identify from the screenshots.)`;

  onStatus?.('🧠 Sending to Gemini 2.5 Flash...');

  try {
    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }, ...imageParts],
        },
      ],
    });

    const text = (response.text || '').trim();
    if (!text) {
      return {
        success: false,
        response: null,
        error: 'Gemini API returned an empty response.',
        screenshotsUsed: picked.map(p => path.basename(p)),
        model: 'gemini-2.5-flash',
      };
    }

    return {
      success: true,
      response: text,
      error: null,
      screenshotsUsed: picked.map(p => path.basename(p)),
      model: 'gemini-2.5-flash',
    };
  } catch (err: any) {
    return {
      success: false,
      response: null,
      error: `Gemini API error: ${err?.message || String(err)}`,
      screenshotsUsed: picked.map(p => path.basename(p)),
      model: 'gemini-2.5-flash',
    };
  }
}

if (process.env.GEMINI_API_KEY) {
  try {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('[Gemini Service] Google Gen AI SDK initialized successfully.');
  } catch (err) {
    console.error('[Gemini Service] Error initializing Google Gen AI SDK:', err);
  }
} else {
  console.warn('[Gemini Service] WARNING: GEMINI_API_KEY is not defined. Operating in Local Smart Rule Fallback Mode.');
}

export async function generatePresentationScript(step: LogStep, log: ExecutionLog): Promise<string> {
  const cleanDescription = step.description.replace(/\.\s*$/, '');
  const defaultScript = `Let's look at the ${step.step} workflow for ${log.projectId}. Here, we see that ${cleanDescription}. The interface behaves exactly as designed.`;

  if (!aiInstance) {
    // Return standard professional keynote script format for demo purposes
    return defaultScript;
  }

  try {
    const prompt = `
      You are Google I/O keynote presenter. Generate an ultra-punchy, engaging, 1-sentence presentation script for a 10-second visual demo segment.
      The segment represents the following step in our software system:
      
      System Name: ${log.projectId}
      Workflow Step: ${step.step}
      Step Description: ${step.description}
      
      Guidelines:
      - The script must be concise and take exactly 7 to 9 seconds to speak (around 20-30 words).
      - Maintain a premium, high-energy, polished presentation tone.
      - Focus on the value and verification of the feature.
      - Do not include hashtags or extra instructions, just return the raw spoken script text.
    `;

    const response = await aiInstance.models.generateContent({
      model: 'gemini-2.5-flash', // Using current stable Gemini model
      contents: prompt,
    });

    return response.text?.trim() || defaultScript;
  } catch (err) {
    console.error('[Gemini Service] Error calling Gemini API, falling back to local script:', err);
    return defaultScript;
  }
}
