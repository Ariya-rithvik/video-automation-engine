// Agent "Extract → Reason → Act" mode — turn any list page into a queryable database.
//
// The big idea: a website's own filters/sorts can't always express what you want (e.g. Devpost lets
// you sort by prize OR by deadline, never both). So we SCRAPE the list into our own rows, then let the
// BRAIN rank/filter by the user's *combined* criteria — a query the site itself forbids.
//
//   1. EXTRACT  — open the page, scroll, scrape repeated items into {title, url, context}. (No AI key
//                 needed — pure DOM. So even with the brain quota exhausted, you still get the raw list.)
//   2. REASON   — brainText ranks/filters the rows by the user's goal, reading numbers (prize, dates)
//                 out of each item's text. (Needs a brain key; gracefully degrades to the raw list.)
//   3. ACT      — return the ranked shortlist (the caller can then open / order the top pick).

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser } from 'puppeteer';
import { brainText, brainChainSummary } from './vision-brain';

puppeteerExtra.use(StealthPlugin());

const REAL_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const MAX_ITEMS_DEFAULT = 40;

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResearchStatus = 'idle' | 'opening' | 'extracting' | 'ranking' | 'complete' | 'error';

interface RawRow { title: string; url: string; context: string; }
export interface ResearchItem { title: string; url: string; why?: string; }

export interface ResearchRequest { url: string; goal: string; maxItems?: number; }

export interface ResearchState {
  status: ResearchStatus;
  message: string;
  url: string | null;
  goal: string | null;
  rawCount: number;       // how many items were scraped
  ranked: boolean;        // did the brain rank them, or is this the raw scrape?
  items: ResearchItem[];
  answer: string | null;  // 1-2 sentence brain summary of the top picks
  error: string | null;
}

// ─── State (singleton) ───────────────────────────────────────────────────────

class ResearchStore {
  private _s: ResearchState = this.fresh();
  private fresh(): ResearchState {
    return { status: 'idle', message: 'Research idle.', url: null, goal: null, rawCount: 0, ranked: false, items: [], answer: null, error: null };
  }
  get state() { return { ...this._s, items: [...this._s.items] }; }
  set(p: Partial<ResearchState>) {
    this._s = { ...this._s, ...p };
    console.log(`[AgentResearch] ${this._s.status}: ${this._s.message}`);
  }
  reset() { this._s = this.fresh(); }
}
export const agentResearch = new ResearchStore();
export function resetResearch() { agentResearch.reset(); }

// ─── Main entry ──────────────────────────────────────────────────────────────

export async function runResearch(req: ResearchRequest): Promise<ResearchState> {
  const maxItems = req.maxItems || MAX_ITEMS_DEFAULT;
  agentResearch.reset();
  agentResearch.set({ status: 'opening', url: req.url, goal: req.goal, message: `🌐 Opening ${req.url}…` });

  let browser: Browser | null = null;
  try {
    browser = await puppeteerExtra.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=en-US,en'],
    }) as unknown as Browser;
    const page = await browser.newPage();
    await page.setUserAgent(REAL_UA);
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(req.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Many list pages load their items via JS after load — wait for the network to settle.
    try { await page.waitForNetworkIdle({ idleTime: 1200, timeout: 12000 }); } catch { /* chatty site */ }
    await sleep(1800);

    // 1) EXTRACT — scroll + scrape repeated items.
    agentResearch.set({ status: 'extracting', message: '📋 Reading the list…' });
    let rows: RawRow[] = [];
    for (let i = 0; i < 6; i++) {
      let batch: RawRow[] = [];
      try { batch = await page.evaluate(EXTRACT_FN) as RawRow[]; } catch { /* page busy */ }
      rows = dedupe([...rows, ...batch]);
      agentResearch.set({ message: `📋 Extracted ${rows.length} items…`, rawCount: rows.length });
      if (rows.length >= maxItems) break;
      try { await page.evaluate('window.scrollBy(0, document.body.scrollHeight)'); } catch { /* ignore */ }
      await sleep(1600);
    }
    rows = rows.slice(0, maxItems);

    // Always surface the raw scrape, so extraction is useful even with no brain key.
    agentResearch.set({ items: rows.map(r => ({ title: r.title, url: r.url })), rawCount: rows.length });

    if (rows.length === 0) {
      agentResearch.set({ status: 'complete', message: 'No list items found on that page.' });
      return agentResearch.state;
    }

    // 2) REASON — rank by the user's combined criteria (needs a brain key; degrades gracefully).
    if (brainChainSummary() === 'none') {
      agentResearch.set({ status: 'complete', ranked: false, message: `✅ Scraped ${rows.length} items. (No brain key → showing raw list; add a key to rank by your criteria.)` });
      return agentResearch.state;
    }

    agentResearch.set({ status: 'ranking', message: `🧠 Ranking ${rows.length} items by: "${req.goal}"…` });
    try {
      const ranked = await rankRows(req.url, req.goal, rows);
      if (ranked.items.length === 0) throw new Error('empty ranking');
      agentResearch.set({ status: 'complete', ranked: true, items: ranked.items, answer: ranked.answer, message: `✅ Ranked — top ${ranked.items.length} for "${req.goal}".` });
    } catch (e: any) {
      // keep the raw list we already set
      agentResearch.set({ status: 'complete', ranked: false, message: `✅ Scraped ${rows.length} items (ranking unavailable: ${e?.message || e}). Showing raw list.` });
    }
  } catch (err: any) {
    agentResearch.set({ status: 'error', message: `❌ ${err?.message || err}`, error: String(err?.message || err) });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
  return agentResearch.state;
}

// ─── Reasoning (brain ranks the scraped rows) ────────────────────────────────

async function rankRows(url: string, goal: string, rows: RawRow[]): Promise<{ answer: string; items: ResearchItem[] }> {
  const list = rows.map((r, i) => `${i + 1}. ${r.title} | ${r.url} | ${r.context}`).join('\n').slice(0, 12000);
  const prompt = `These rows were scraped from ${url}. The user wants: "${goal}".

Re-rank and filter them by the user's criteria — INCLUDING combinations the website itself can't filter
(e.g. "ending soon AND highest prize"). Read any numbers in each row's text (prize amounts, deadlines,
dates, ratings, price) and use them. Only use items from the list; never invent entries.

Return ONLY this JSON (no markdown):
{"answer":"<1-2 sentences naming the best picks>","ranked":[{"title":"...","url":"...","why":"<≤12 words, cite the numbers>"}]}
Return the TOP 8 only. Keep every "why" under 12 words so the JSON stays small.

LIST:
${list}`;

  // The brain can be flaky (sometimes a perfect JSON, sometimes a short/garbled one) — retry a few times.
  let lastRaw = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await brainText({ prompt, json: true, maxTokens: 3500 });
    lastRaw = raw;
    const j = safeParse(raw) || {};
    let arr: any = j.ranked || j.ranking || j.results || j.items || j.list || j.top;
    if (!Array.isArray(arr)) arr = extractArray(raw);   // salvage a [...] even if the wrapper broke
    const items: ResearchItem[] = Array.isArray(arr)
      ? arr.slice(0, 10).map((x: any) => ({ title: String(x.title || x.name || '').trim(), url: String(x.url || x.link || '').trim(), why: (x.why || x.reason) ? String(x.why || x.reason).trim() : undefined }))
                  .filter((x: ResearchItem) => x.title || x.url)
      : [];
    console.log(`[AgentResearch] rank attempt ${attempt}: keys=[${Object.keys(j).join(',') || 'NONE'}] items=${items.length} raw=${raw.length}ch`);
    if (items.length) return { answer: String(j.answer || j.summary || '').trim(), items };
    console.warn(`[AgentResearch] rank attempt ${attempt} empty; preview=${JSON.stringify(raw.slice(0, 140))}`);
  }
  throw new Error(`ranking parse failed after 3 tries (last ${lastRaw.length}ch)`);
}

// ─── DOM extraction (runs in the page) ───────────────────────────────────────
// Smarter generic heuristic: real list/result items are the LARGEST cluster of structurally-similar
// "cards" (same container class), NOT the handful of one-off nav/marketing links. So we: drop links
// inside <header>/<nav>/<footer>/<aside>, group the rest by their card's class signature, and keep the
// biggest group (the actual list). Each row = anchor title + url + the card's text (prize/date/price).

const EXTRACT_FN = `(() => {
  const bad = new Set(['HEADER','NAV','FOOTER','ASIDE']);
  const inChrome = (el) => { let p = el; for (let i=0;i<6 && p;i++){ if (bad.has(p.tagName)) return true; p = p.parentElement; } return false; };
  const cardOf = (a) => { let c = a; for (let i=0;i<2 && c.parentElement;i++) c = c.parentElement; return c; };
  const keyOf = (a) => { const c = cardOf(a); const cls = (c.className && typeof c.className === 'string') ? c.className.trim().split(/\\s+/).slice(0,3).join('.') : ''; return c.tagName + '|' + cls; };
  const anchors = Array.from(document.querySelectorAll('a[href]')).filter((a) => {
    const t = (a.innerText || '').trim();
    return t.length >= 15 && /^https?:/i.test(a.href || '') && !inChrome(a) && a.offsetParent !== null;
  });
  const groups = {};
  for (const a of anchors) { const k = keyOf(a); (groups[k] = groups[k] || []).push(a); }
  let best = [];
  for (const k in groups) if (groups[k].length > best.length) best = groups[k];
  const chosen = best.length >= 4 ? best : anchors;   // fall back to all if no clear cluster
  const out = []; const seen = new Set();
  for (const a of chosen) {
    const href = a.href; if (!href || seen.has(href)) continue; seen.add(href);
    const title = (a.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 160);
    const card = cardOf(a); const context = (card.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 300);
    out.push({ title, url: href, context });
    if (out.length >= 80) break;
  }
  return out;
})()`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dedupe(rows: RawRow[]): RawRow[] {
  const seen = new Set<string>();
  const out: RawRow[] = [];
  for (const r of rows) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
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

// Salvage the first JSON array-of-objects from a possibly-broken response.
function extractArray(raw: string): any[] | null {
  const m = (raw || '').match(/\[\s*\{[\s\S]*\}\s*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* unrecoverable */ } }
  return null;
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
