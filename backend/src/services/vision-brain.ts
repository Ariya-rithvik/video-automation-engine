// Vision brain — the swappable "decide / reason" model layer for the agent.
//
// An ORDERED CHAIN of providers. The agent tries them top-to-bottom and uses the first that
// answers; if one errors (quota / 503 / network) it falls through to the next. Default order:
//
//     Gemini (primary, free tier)  →  Qwen (free trial)  →  GLM (recurring free)  →  custom
//
// You enable a fallback simply by pasting its key into .env — no code change:
//     QWEN_API_KEY=...      (Alibaba DashScope, Singapore — qwen-vl-max)
//     GLM_API_KEY=...       (Z.ai / Zhipu — glm-4.5v)        [alias: ZAI_API_KEY]
//     VISION_FALLBACK_KEY=. (any other OpenAI-compatible vision model, via PRESET or BASE_URL+MODEL)
//
// All non-Gemini providers speak the SAME OpenAI-compatible /chat/completions wire format, so they
// share one HTTP code path. Two public calls, both run the whole chain:
//     • visionDecide({prompt,imagePath}) → image → {action, markId?, text?, reason}   (executor)
//     • brainText({prompt,json?})        → text  → string                            (planner)

import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import { browserLLMConfig, askBrowserLLM, askBrowserVision } from './browser-llm';

export interface VisionDecision {
  action: string;      // click | type | scroll | wait | done
  markId?: number;
  text?: string;
  reason?: string;
  _provider?: string;  // which model actually answered (for logging/UI)
}

export interface VisionDecideInput {
  prompt: string;       // the full decision prompt (goal, plan, marks list, rules)
  imagePath: string;    // path to the marked screenshot (PNG)
}

export interface BrainTextInput {
  prompt: string;       // text-only prompt (used by the planner)
  json?: boolean;       // hint the model to return JSON
  maxTokens?: number;   // output budget (default 600; scripts need more)
}

export interface VisionTextInput {
  prompt: string;       // free-text prompt that may reference attached images
  imagesB64?: string[]; // raw base64 PNGs (no "data:" prefix); optional
  mimeType?: string;    // default image/png
  maxTokens?: number;   // output budget (default 2048)
  temperature?: number; // default 0.4
  json?: boolean;       // hint the model to return JSON
}

interface ProviderSpec {
  id: 'gemini' | 'groq' | 'qwen' | 'glm' | 'compat' | 'browser';
  label: string;                       // display label, e.g. "gemini-flash" / "browser-gemini"
  kind: 'gemini' | 'http' | 'browser'; // gemini = SDK, http = OpenAI-compatible REST, browser = web-app
  base?: string;                       // base URL (http only)
  model: string;
  key: string;
}

// ─── Presets (base URL + model + label) for the named providers ──────────────

const PRESETS: Record<string, { base: string; model: string; label: string }> = {
  groq:             { base: 'https://api.groq.com/openai/v1',                          model: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'llama4-scout·groq' },
  qwen:             { base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-vl-max',   label: 'qwen-vl-max' },
  glm:              { base: 'https://api.z.ai/api/paas/v4',                           model: 'glm-4.5v',      label: 'glm-4.5v·z.ai' },
  'glm-openrouter': { base: 'https://openrouter.ai/api/v1',                           model: 'z-ai/glm-4.5v', label: 'glm-4.5v·openrouter' },
};

// ─── Per-provider spec builders (return null when no key is configured) ──────

// Multiple Gemini keys (GEMINI_API_KEY, _2, _3) multiply the free 20-requests/day — we rotate on quota.
function geminiKeys(): string[] {
  return [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2, process.env.GEMINI_API_KEY_3]
    .map(k => (k || '').trim()).filter(Boolean);
}
function geminiSpec(): ProviderSpec | null {
  const keys = geminiKeys();
  if (!keys.length) return null;
  const label = keys.length > 1 ? `gemini-flash×${keys.length}` : 'gemini-flash';
  return { id: 'gemini', label, kind: 'gemini', model: 'gemini-2.5-flash', key: keys[0] };
}

// Groq — FREE, very fast Llama 4 Scout VISION via API. Scale-safe tier-2 fallback (serves all users,
// unlike the personal browser-AI). OpenAI-compatible, so it rides the same http path as qwen/glm.
function groqSpec(): ProviderSpec | null {
  const key = process.env.GROQ_API_KEY || '';
  if (!key) return null;
  return {
    id: 'groq', label: PRESETS.groq.label, kind: 'http',
    base: process.env.GROQ_BASE_URL || PRESETS.groq.base,
    model: process.env.GROQ_MODEL || PRESETS.groq.model, key,
  };
}

function qwenSpec(): ProviderSpec | null {
  const key = process.env.QWEN_API_KEY || '';
  if (!key) return null;
  return {
    id: 'qwen', label: PRESETS.qwen.label, kind: 'http',
    base: process.env.QWEN_BASE_URL || PRESETS.qwen.base,
    model: process.env.QWEN_MODEL || PRESETS.qwen.model, key,
  };
}

function glmSpec(): ProviderSpec | null {
  const key = process.env.GLM_API_KEY || process.env.ZAI_API_KEY || '';
  if (!key) return null;
  return {
    id: 'glm', label: PRESETS.glm.label, kind: 'http',
    base: process.env.GLM_BASE_URL || PRESETS.glm.base,
    model: process.env.GLM_MODEL || PRESETS.glm.model, key,
  };
}

function genericSpec(): ProviderSpec | null {
  const key = process.env.VISION_FALLBACK_KEY || '';
  if (!key) return null;
  const preset = PRESETS[(process.env.VISION_FALLBACK_PRESET || '').toLowerCase()];
  return {
    id: 'compat',
    label: preset?.label || process.env.VISION_FALLBACK_MODEL || 'custom-vlm',
    kind: 'http',
    base: process.env.VISION_FALLBACK_BASE_URL || preset?.base || PRESETS.qwen.base,
    model: process.env.VISION_FALLBACK_MODEL || preset?.model || PRESETS.qwen.model,
    key,
  };
}

// Browser-AI = the FREE fallback: drive the user's logged-in ChatGPT/Gemini WEB APP (text-only, so it
// only serves brainText, not visionDecide). Always LAST in the chain. Enabled via BROWSER_LLM env.
function browserSpec(): ProviderSpec | null {
  const cfg = browserLLMConfig();
  if (!cfg) return null;
  return { id: 'browser', label: cfg.label, kind: 'browser', model: cfg.provider, key: 'browser' };
}

// ─── The ordered chain ───────────────────────────────────────────────────────

function chain(): ProviderSpec[] {
  const all = [geminiSpec(), groqSpec(), qwenSpec(), glmSpec(), genericSpec(), browserSpec()].filter(Boolean) as ProviderSpec[];
  // De-dupe by id (e.g. someone set QWEN_API_KEY *and* VISION_FALLBACK_PRESET=qwen).
  const seen = new Set<string>();
  const uniq = all.filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)));

  // AGENT_VISION_PROVIDER promotes one provider to the FRONT (default 'gemini' is already first).
  const pref = (process.env.AGENT_VISION_PROVIDER || 'gemini').toLowerCase();
  const wanted = pref === 'openai' ? 'compat' : pref;
  const idx = uniq.findIndex(s => s.id === wanted);
  if (idx > 0) uniq.unshift(uniq.splice(idx, 1)[0]);

  return uniq;
}

export function activeProviderLabel(): string {
  return chain()[0]?.label || 'none';
}

/** Human-readable summary of the configured brain chain, e.g. "gemini-flash → qwen-vl-max". */
export function brainChainSummary(): string {
  return chain().map(s => s.label).join(' → ') || 'none';
}

// ─── Public: vision decision (executor) with chain fallback ──────────────────

export async function visionDecide(input: VisionDecideInput): Promise<VisionDecision> {
  let lastErr: any = null;
  for (const p of chain()) {
    try {
      if (p.kind === 'browser') {
        // FREE vision: upload the screenshot to the logged-in Gemini/ChatGPT web chat + parse its JSON.
        const cfg = browserLLMConfig();
        if (!cfg) continue;
        const ans = await askBrowserVision(input.prompt + '\n\nReply ONLY with the JSON object.', input.imagePath, cfg);
        const decision = parseDecision(ans);
        decision._provider = p.label;
        return decision;
      }
      const decision = p.kind === 'gemini' ? await decideGemini(input) : await decideHttp(p, input);
      decision._provider = p.label;
      return decision;
    } catch (err: any) {
      lastErr = err;
      console.warn(`[VisionBrain] ${p.id} (vision) failed, trying next:`, err?.message || err);
    }
  }
  console.error('[VisionBrain] All vision providers failed:', lastErr?.message || lastErr);
  return { action: 'wait', reason: 'All vision providers failed', _provider: 'none' };
}

// ─── Public: text reasoning (planner) with chain fallback ────────────────────

export async function brainText(input: BrainTextInput): Promise<string> {
  let lastErr: any = null;
  for (const p of chain()) {
    try {
      if (p.kind === 'gemini') return await textGemini(input);
      if (p.kind === 'browser') return await askBrowserLLM(input.prompt, browserLLMConfig()!);
      return await textHttp(p, input);
    } catch (err: any) {
      lastErr = err;
      console.warn(`[VisionBrain] ${p.id} (text) failed, trying next:`, err?.message || err);
    }
  }
  throw new Error('All text providers failed: ' + (lastErr?.message || lastErr));
}

// ─── Public: free-text reasoning that can SEE images (multimodal) ────────────
// With images → Gemini multimodal (key-rotated, relaxed safety); on failure, or
// with no images, falls through to the full text chain via brainText. Returns the
// raw model text (NOT the action schema that visionDecide enforces).
export async function visionText(input: VisionTextInput): Promise<string> {
  const imgs = (input.imagesB64 || []).filter(Boolean);
  if (!imgs.length) {
    return brainText({ prompt: input.prompt, json: input.json, maxTokens: input.maxTokens });
  }
  try {
    const res = await withGemini(ai => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: input.prompt },
          ...imgs.map(b => ({ inlineData: { mimeType: input.mimeType || 'image/png', data: b } })),
        ],
      }],
      config: {
        maxOutputTokens: input.maxTokens || 2048,
        temperature: input.temperature ?? 0.4,
        safetySettings: GEMINI_RELAXED_SAFETY,
        thinkingConfig: { thinkingBudget: 0 },
        ...(input.json ? { responseMimeType: 'application/json' } : {}),
      },
    }));
    return res.text || '';
  } catch (e: any) {
    console.warn('[VisionBrain] visionText (gemini multimodal) failed, falling back to text-only:', e?.message || e);
    return brainText({ prompt: input.prompt, json: input.json, maxTokens: input.maxTokens });
  }
}

// ─── Gemini implementations (SDK) ────────────────────────────────────────────

const geminiClients = new Map<string, GoogleGenAI>();
function clientFor(key: string): GoogleGenAI {
  let c = geminiClients.get(key);
  if (!c) { c = new GoogleGenAI({ apiKey: key }); geminiClients.set(key, c); }
  return c;
}
let geminiKeyIdx = 0;  // sticky: keep using the key that last worked
function isGeminiQuota(e: any): boolean {
  const m = (e?.message || String(e) || '').toLowerCase();
  return m.includes('429') || m.includes('quota') || m.includes('resource_exhausted') || m.includes('exceeded');
}
// Run a Gemini call, rotating across all configured keys when one hits its daily quota.
async function withGemini<T>(fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const keys = geminiKeys();
  if (!keys.length) throw new Error('Gemini not configured');
  let lastErr: any;
  for (let i = 0; i < keys.length; i++) {
    const idx = (geminiKeyIdx + i) % keys.length;
    try {
      const r = await fn(clientFor(keys[idx]));
      geminiKeyIdx = idx;                 // stick to the working key for next time
      return r;
    } catch (e: any) {
      lastErr = e;
      // Rotate on ANY failure (quota OR an invalid key), so one bad key never breaks the chain.
      const why = isGeminiQuota(e) ? 'quota' : 'error';
      console.warn(`[VisionBrain] Gemini key #${idx + 1}/${keys.length} ${why} (${(e?.message || '').slice(0, 70)}) — trying next…`);
    }
  }
  throw lastErr;                          // all keys exhausted → caller falls through to Qwen/GLM
}

// Awareness/journalism + messy real-world UIs get false-positive safety blocks (which return EMPTY,
// not an error). Relax thresholds so the brain isn't silently muzzled. Legit for this app's use.
const GEMINI_RELAXED_SAFETY: any[] = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

async function decideGemini(input: VisionDecideInput): Promise<VisionDecision> {
  const b64 = fs.readFileSync(input.imagePath).toString('base64');
  const res = await withGemini(ai => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: input.prompt }, { inlineData: { mimeType: 'image/png', data: b64 } }] }],
    config: { maxOutputTokens: 400, temperature: 0.2, responseMimeType: 'application/json', safetySettings: GEMINI_RELAXED_SAFETY, thinkingConfig: { thinkingBudget: 0 } },
  }));
  return parseDecision(res.text || '{}');
}

async function textGemini(input: BrainTextInput): Promise<string> {
  const res = await withGemini(ai => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: input.prompt,
    config: {
      maxOutputTokens: input.maxTokens || 600,
      temperature: 0.3,
      safetySettings: GEMINI_RELAXED_SAFETY,
      thinkingConfig: { thinkingBudget: 0 },   // 2.5-Flash "thinking" otherwise eats the output budget → truncated JSON
      ...(input.json ? { responseMimeType: 'application/json' } : {}),
    },
  }));
  return res.text || '';
}

// ─── Generic OpenAI-compatible implementations (Qwen / GLM / custom) ─────────

async function decideHttp(p: ProviderSpec, input: VisionDecideInput): Promise<VisionDecision> {
  const b64 = fs.readFileSync(input.imagePath).toString('base64');
  const content = await postChat(p, {
    model: p.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: input.prompt + '\n\nReply ONLY with the JSON object.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    }],
    temperature: 0.2,
    max_tokens: 300,
  });
  return parseDecision(content);
}

async function textHttp(p: ProviderSpec, input: BrainTextInput): Promise<string> {
  return postChat(p, {
    model: p.model,
    messages: [{ role: 'user', content: input.prompt }],
    temperature: 0.3,
    max_tokens: input.maxTokens || 600,
  });
}

async function postChat(p: ProviderSpec, body: unknown): Promise<string> {
  const res = await fetch(`${(p.base || '').replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${p.id} HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json: any = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? '';
  return typeof content === 'string' ? content : JSON.stringify(content);
}

// ─── Shared parser ───────────────────────────────────────────────────────────

function parseDecision(raw: string): VisionDecision {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    const j = JSON.parse(cleaned);
    return { action: j.action || 'wait', markId: j.markId, text: j.text, reason: j.reason };
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) {
      try { const j = JSON.parse(m[0]); return { action: j.action || 'wait', markId: j.markId, text: j.text, reason: j.reason }; }
      catch { /* fall through */ }
    }
    return { action: 'wait', reason: 'Could not parse vision decision' };
  }
}
