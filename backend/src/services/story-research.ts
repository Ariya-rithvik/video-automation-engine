// Story Studio — localized AI storytelling research.
//
// Pipeline (this file = the research + script tier):
//   1. INTAKE: topic + country + language (e.g. "manual scavenging deaths", "India", "Tanglish").
//   2. RESEARCH: Gemini WITH Google-Search grounding → latest facts, real statistics, dated
//      incidents — each backed by actual source URLs (the credibility gap in a plain LLM script).
//   3. SCRIPT: Gemini structures the research into a beat-by-beat storytelling script in the
//      requested language, where each beat carries: narration, on-screen caption, a B-roll search
//      query, an optional movie/series reference (the "audience-memory jog"), and stat callouts.
//
// Downstream tiers (separate files, later): YouTube trend miner, B-roll downloader, Remotion assembly.
//
// NOTE: grounding is a Gemini-only capability, so this tier uses Gemini directly (the swappable
// brain's fallbacks have no web search). Research stays factual — the model is told NOT to invent
// statistics and to mark anything uncertain.

import { brainText, brainChainSummary } from './vision-brain';
import { searchWeb, fetchPageText, type WebResult } from './web-search';

// ─── Types ───────────────────────────────────────────────────────────────────

export type StoryStatus = 'idle' | 'researching' | 'scripting' | 'complete' | 'error';

export interface StorySource { title: string; url: string; }
export interface StoryStat { label: string; value: string; note?: string; }
export interface StoryTimelineItem { date: string; event: string; }

export interface StoryBeat {
  id: number;
  narration: string;       // spoken line, in the requested language
  caption: string;         // short on-screen kinetic caption
  brollQuery: string;      // what to search YouTube for as B-roll for this beat
  movieRef?: string;       // optional: a film/series scene the audience remembers
  statCallout?: string;    // optional: a number to punch on screen
}

export interface StoryBrief {
  topic: string;
  country: string;
  language: string;
  headline: string;
  summary: string;
  facts: string[];
  stats: StoryStat[];
  timeline: StoryTimelineItem[];
  sources: StorySource[];
  script: StoryBeat[];
}

export interface StoryRequest { topic: string; country: string; language: string; }

export interface StoryState {
  status: StoryStatus;
  message: string;
  request: StoryRequest | null;
  brief: StoryBrief | null;
  error: string | null;
}

// ─── State (singleton, mirrors the other agents) ─────────────────────────────

class StoryStore {
  private _s: StoryState = this.fresh();
  private fresh(): StoryState {
    return { status: 'idle', message: 'Story Studio idle.', request: null, brief: null, error: null };
  }
  get state() { return { ...this._s, brief: this._s.brief ? { ...this._s.brief } : null }; }
  set(p: Partial<StoryState>) {
    this._s = { ...this._s, ...p };
    console.log(`[StoryStudio] ${this._s.status}: ${this._s.message}`);
  }
  reset() { this._s = this.fresh(); }
}
export const storyStudio = new StoryStore();
export function resetStory() { storyStudio.reset(); }

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function runStoryResearch(req: StoryRequest): Promise<StoryState> {
  // Brain-agnostic: research synthesis + scripting both go through brainText (Gemini → Qwen/GLM chain),
  // so the whole pipeline keeps working even when Gemini's daily quota is exhausted.
  if (brainChainSummary() === 'none') {
    storyStudio.set({ status: 'error', message: 'No AI brain configured. Set GEMINI_API_KEY or a fallback key (QWEN_API_KEY / GLM_API_KEY).', error: 'no_api_key' });
    return storyStudio.state;
  }

  storyStudio.reset();
  storyStudio.set({ status: 'researching', request: req, message: `🔎 Researching "${req.topic}" in ${req.country}…` });

  // 1) RESEARCH — REAL keyless web search (DuckDuckGo) + page fetch, synthesized by the brain with
  //    REAL source URLs. (Gemini free-tier grounding only returns the queries, not the results.)
  let researchText = '';
  let sources: StorySource[] = [];
  try {
    const queries = [
      `${req.topic} ${req.country} latest`,
      `${req.topic} ${req.country} death toll statistics`,
      `${req.topic} ${req.country} news 2024 2025`,
    ];
    const results: WebResult[] = [];
    const seen = new Set<string>();
    for (const q of queries) {
      try {
        for (const r of await searchWeb(q, 6)) if (!seen.has(r.url)) { seen.add(r.url); results.push(r); }
      } catch (e: any) { console.warn(`[StoryStudio] search "${q}" failed:`, e?.message); }
    }
    storyStudio.set({ message: `🔎 Found ${results.length} sources — reading the top pages…` });

    // Fetch real text from the top few pages so the numbers come from real content, not model memory.
    const top = results.slice(0, 5);
    const fetched = await Promise.all(top.map(async (r) => ({ r, text: await fetchPageText(r.url, 2200) })));
    const corpus = fetched.filter(f => f.text).map(f => `SOURCE: ${f.r.title}\nURL: ${f.r.url}\n${f.text}`).join('\n\n---\n\n').slice(0, 9000);
    const snippetBlock = results.map(r => `- ${r.title} (${r.url})${r.snippet ? ': ' + r.snippet : ''}`).join('\n').slice(0, 3000);
    sources = mergeSources(results.map(r => ({ title: r.title, url: r.url })), []);
    console.log(`[StoryStudio] web search → ${results.length} results, ${fetched.filter(f => f.text).length} pages read, corpus ${corpus.length} chars.`);

    const synthPrompt = `You are an investigative researcher. Below are REAL web search results and page extracts about:
TOPIC: ${req.topic}   COUNTRY: ${req.country}

SEARCH RESULTS:
${snippetBlock || '(none)'}

PAGE EXTRACTS:
"""
${corpus || '(page text could not be fetched — rely on the result titles/snippets above and flag uncertainty)'}
"""

Write a factual briefing:
- Overview (2-3 sentences).
- KEY STATISTICS: exact numbers WITH the year, especially HOW MANY DIED. Take numbers ONLY from the extracts/snippets
  above and name the source for each. If a number isn't in the material, write "not found in sources" — do NOT invent it.
- RECENT INCIDENTS: named, dated cases.
Be specific and concise.`;

    researchText = await withRetry('research-synth', () => brainText({ prompt: synthPrompt, maxTokens: 1600 }));
    if (!researchText.trim()) throw new Error('empty-research');
    console.log(`[StoryStudio] Research synthesized — ${researchText.length} chars, ${sources.length} real sources.`);
  } catch (e: any) {
    // Last resort: brain's own knowledge (still asks for a SOURCES list to extract URLs from).
    console.warn('[StoryStudio] Web-search research failed, using brain knowledge:', e?.message);
    try {
      const fallbackPrompt = `Report the real, current facts and known statistics about "${req.topic}" in ${req.country},
especially HOW MANY PEOPLE DIED (with years). Do NOT invent numbers; flag anything uncertain. End with a section
"SOURCES:" listing the most likely official source URLs (government/NCSK/courts/reputable news), one per line.`;
      researchText = await withRetry('research(fallback)', () => brainText({ prompt: fallbackPrompt, maxTokens: 1600 }));
      if (sources.length === 0) sources = extractUrlsFromText(researchText);
    } catch (e2: any) {
      storyStudio.set({ status: 'error', message: `Research failed: ${e2?.message || e2}`, error: 'research_failed' });
      return storyStudio.state;
    }
  }

  // 2) SCRIPT — structure the research into a localized, beat-by-beat storytelling script (JSON).
  storyStudio.set({ status: 'scripting', message: `✍️ Writing the ${req.language} story script…` });
  try {
    const filmIndustry = filmIndustryHint(req.language, req.country);
    const scriptPrompt = `You are a storytelling scriptwriter for short awareness videos. Turn the RESEARCH below into a
moving, RESPECTFUL, factual short-video script in this language: ${req.language}
("Tanglish" = Tamil in English letters; "Hinglish" = Hindi in English letters; otherwise write natively).

TOPIC: ${req.topic}   COUNTRY: ${req.country}
AUDIENCE: ${req.language}-speaking viewers in ${req.country}. Everything must feel NATIVE to THIS audience —
movie references come from ${filmIndustry}, and B-roll footage must be ${req.country}-specific (not generic).

RESEARCH (use ONLY facts found here — never invent statistics):
"""
${researchText.slice(0, 6000)}
"""

Return ONLY this JSON (no markdown):
{
  "headline": "<punchy title in ${req.language}>",
  "summary": "<2-sentence English summary of the video for the creator>",
  "facts": ["<key factual point>", ...],
  "stats": [{"label":"<what it measures>","value":"<number/figure>","note":"<year/source/uncertainty>"}],
  "timeline": [{"date":"<when>","event":"<what happened>"}],
  "script": [
    {
      "id": 0,
      "narration": "<one spoken line in ${req.language}>",
      "caption": "<short punchy on-screen caption in ${req.language}>",
      "brollQuery": "<YouTube search query for REAL footage for this beat — COUNTRY-SPECIFIC to ${req.country}; write it in ${req.language} words when that finds better local footage, otherwise English, but ALWAYS include the country/region>",
      "movieRef": "<optional: a scene from ${filmIndustry} that THIS audience instantly recognizes, formatted 'Movie (year) — the X scene'; omit if none truly fits>",
      "statCallout": "<optional: a number to flash on screen, or omit>"
    }
  ]
}

Rules:
- 6 to 12 beats. Emotional arc: hook → human story → the hard facts (with real numbers) → systemic cause → call to action.
- Keep it humane and non-sensational. Honor the people involved.
- Every statistic must trace to the research. If unsure, soften the wording.
- brollQuery MUST be concrete, findable, and ${req.country}-specific (e.g. "sewer worker cleaning manhole ${req.country}", "sanitation worker protest ${req.country}").
- movieRef MUST come from ${filmIndustry} — never a random foreign film the audience wouldn't know.`;

    // Scripting via the swappable brain (Gemini relaxed-safety → Qwen/GLM fallback). Retry on
    // transient 503s or an empty result (the model occasionally returns nothing under load).
    const scriptRaw = await withRetry('scripting', async () => {
      const out = await brainText({ prompt: scriptPrompt, json: true, maxTokens: 2800 });
      if (buildBrief(req, out, sources).script.length === 0) throw new Error('empty-script: model returned no beats');
      return out;
    });
    const brief = buildBrief(req, scriptRaw, sources);
    storyStudio.set({ status: 'complete', brief, message: `✅ Story ready — ${brief.script.length} beats, ${brief.sources.length} sources.` });
  } catch (e: any) {
    storyStudio.set({ status: 'error', message: `Scripting failed: ${e?.message || e}`, error: 'script_failed' });
  }

  return storyStudio.state;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Map the chosen language (+ country for English) to the film industry THAT audience knows, so movie
// references and B-roll feel native (Hindi→Bollywood, Tamil→Kollywood, English/US→Hollywood, …).
function filmIndustryHint(language: string, country: string): string {
  const l = (language || '').toLowerCase();
  const pairs: Array<[RegExp, string]> = [
    [/tamil|tanglish/, 'Kollywood (Tamil cinema)'],
    [/telugu/, 'Tollywood (Telugu cinema)'],
    [/hindi|hinglish/, 'Bollywood (Hindi cinema)'],
    [/malayalam/, 'Mollywood (Malayalam cinema)'],
    [/kannada/, 'Sandalwood (Kannada cinema)'],
    [/bengali/, 'Bengali (Tollywood Kolkata) cinema'],
    [/marathi/, 'Marathi cinema'],
    [/portug/, 'Brazilian / Portuguese cinema'],
    [/ital/, 'Italian cinema'],
    [/arab/, 'Egyptian / Arab cinema'],
    [/spanish|espa|castell/, 'Spanish / Latin-American cinema'],
    [/french|franc/, 'French cinema'],
    [/korean/, 'Korean cinema (Hallyuwood)'],
    [/japanese|nihongo/, 'Japanese cinema'],
  ];
  for (const [re, ind] of pairs) if (re.test(l)) return ind;
  if (/english/.test(l)) {
    const c = (country || '').toLowerCase();
    if (/india/.test(c)) return 'Bollywood + Hollywood (Indian-English audience)';
    if (/nigeria/.test(c)) return 'Nollywood (Nigerian cinema)';
    if (/\buk|britain|england/.test(c)) return 'British + Hollywood cinema';
    return 'Hollywood';
  }
  return `${country || 'national'} cinema`;
}

// Pull http(s) URLs straight out of the research text (the model writes a "SOURCES:" list). This is a
// reliable backstop when grounding metadata doesn't surface chunks.
function extractUrlsFromText(text: string): StorySource[] {
  const out: StorySource[] = [];
  const seen = new Set<string>();
  const matches = (text || '').match(/\bhttps?:\/\/[^\s)\]>"']+/gi) || [];
  for (let url of matches) {
    url = url.replace(/[.,;:]+$/, '');                 // strip trailing punctuation
    if (seen.has(url)) continue;
    seen.add(url);
    let title = url;
    try { title = new URL(url).hostname.replace(/^www\./, ''); } catch { /* keep url */ }
    out.push({ title, url });
  }
  return out.slice(0, 12);
}

function mergeSources(a: StorySource[], b: StorySource[]): StorySource[] {
  const out: StorySource[] = [];
  const seen = new Set<string>();
  for (const s of [...a, ...b]) {
    if (!s.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out.slice(0, 12);
}

let groundingLogged = false;
function groundingChunkCount(res: any): number {
  const gm = res?.candidates?.[0]?.groundingMetadata;
  if (gm && !groundingLogged) {
    groundingLogged = true;
    console.log('[StoryStudio] groundingMetadata keys:', Object.keys(gm), '| webSearchQueries:', gm.webSearchQueries);
  }
  return gm?.groundingChunks?.length || 0;
}

function buildBrief(req: StoryRequest, rawJson: string, sources: StorySource[]): StoryBrief {
  const j = safeParse(rawJson) || {};
  const script: StoryBeat[] = Array.isArray(j.script)
    ? j.script.map((b: any, i: number) => ({
        id: typeof b.id === 'number' ? b.id : i,
        narration: String(b.narration || '').trim(),
        caption: String(b.caption || '').trim(),
        brollQuery: String(b.brollQuery || '').trim(),
        movieRef: b.movieRef ? String(b.movieRef).trim() : undefined,
        statCallout: b.statCallout ? String(b.statCallout).trim() : undefined,
      })).filter((b: StoryBeat) => b.narration || b.caption)
    : [];

  return {
    topic: req.topic,
    country: req.country,
    language: req.language,
    headline: String(j.headline || req.topic).trim(),
    summary: String(j.summary || '').trim(),
    facts: Array.isArray(j.facts) ? j.facts.map((f: any) => String(f).trim()).filter(Boolean) : [],
    stats: Array.isArray(j.stats)
      ? j.stats.map((s: any) => ({ label: String(s.label || '').trim(), value: String(s.value || '').trim(), note: s.note ? String(s.note).trim() : undefined }))
              .filter((s: StoryStat) => s.label || s.value)
      : [],
    timeline: Array.isArray(j.timeline)
      ? j.timeline.map((t: any) => ({ date: String(t.date || '').trim(), event: String(t.event || '').trim() })).filter((t: StoryTimelineItem) => t.event)
      : [],
    sources,
    script,
  };
}

function safeParse(raw: string): any | null {
  const cleaned = (raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(cleaned); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
  }
}

// Gemini free tier 503s ("high demand") and occasionally returns empty — both transient. Retry w/ backoff.
function isTransient(e: any): boolean {
  const m = (e?.message || String(e) || '').toLowerCase();
  return ['503', 'unavailable', 'overloaded', 'high demand', '429', 'resource_exhausted',
          'rate limit', 'empty-script', 'timeout', 'econnreset', 'fetch failed']
    .some(s => m.includes(s));
}

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e: any) {
      lastErr = e;
      if (!isTransient(e) || i === attempts - 1) throw e;
      const wait = 2500 * (i + 1) + Math.floor(Math.random() * 800);
      console.warn(`[StoryStudio] ${label} transient fail ${i + 1}/${attempts}, retry in ${wait}ms:`, e?.message);
      storyStudio.set({ message: `⏳ ${label}: model busy — retrying (${i + 1}/${attempts})…` });
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
