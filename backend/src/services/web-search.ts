// Keyless web search + light page-text fetch — gives the Story Studio REAL sources & numbers.
//
// Gemini's free-tier googleSearch grounding only returns the *queries* it would run (searchEntryPoint +
// webSearchQueries), NOT the actual results/URLs (no groundingChunks). So we do the search ourselves via
// DuckDuckGo's HTML endpoint (no API key), then fetch a few result pages and hand the real text to Gemini
// to synthesize — with the real result URLs as citations.
//
// Optional upgrade: if TAVILY_API_KEY is set, use Tavily (cleaner LLM-oriented results) instead of DDG.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface WebResult { title: string; url: string; snippet: string; }

// ─── Public: search ──────────────────────────────────────────────────────────

export async function searchWeb(query: string, max = 8): Promise<WebResult[]> {
  if (process.env.TAVILY_API_KEY) {
    try { return await searchTavily(query, max); }
    catch (e: any) { console.warn('[WebSearch] Tavily failed, falling back to DDG:', e?.message); }
  }
  return searchDuckDuckGo(query, max);
}

// ─── DuckDuckGo HTML (no key) ────────────────────────────────────────────────

async function searchDuckDuckGo(query: string, max: number): Promise<WebResult[]> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await httpText(url, 15000, { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' });
  const out: WebResult[] = [];
  const seen = new Set<string>();

  // Titles + links: <a ... class="result__a" href="...uddg=ENCODED...">TITLE</a>
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && out.length < max) {
    const realUrl = decodeDdgHref(m[1]);
    const title = stripTags(m[2]).trim();
    if (!realUrl || seen.has(realUrl)) continue;
    seen.add(realUrl);
    out.push({ title: title || realUrl, url: realUrl, snippet: '' });
  }

  // Snippets (best-effort, same document order): class="result__snippet" ...>SNIPPET</a>
  const snips: string[] = [];
  const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let s: RegExpExecArray | null;
  while ((s = snipRe.exec(html))) snips.push(stripTags(s[1]).trim());
  out.forEach((r, i) => { if (snips[i]) r.snippet = snips[i]; });

  return out;
}

function decodeDdgHref(href: string): string {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return ''; } }
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  return '';
}

// ─── Tavily (optional, keyed) ────────────────────────────────────────────────

async function searchTavily(query: string, max: number): Promise<WebResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, max_results: max, search_depth: 'basic' }),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const j: any = await res.json();
  return (j.results || []).slice(0, max).map((r: any) => ({
    title: r.title || r.url, url: r.url, snippet: r.content || '',
  }));
}

// ─── Page-text fetch (for real numbers) ──────────────────────────────────────

export async function fetchPageText(url: string, maxChars = 2500): Promise<string> {
  try {
    if (/\.(pdf|jpg|jpeg|png|gif|webp|mp4|zip|doc|docx)(\?|$)/i.test(url)) return ''; // skip binaries
    const html = await httpText(url, 12000, { 'User-Agent': UA });
    return htmlToText(html).slice(0, maxChars);
  } catch { return ''; }
}

// ─── Low-level helpers ───────────────────────────────────────────────────────

async function httpText(url: string, timeoutMs: number, headers: Record<string, string>): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.includes('text/html') && !ct.includes('text/plain') && !ct.includes('xml')) {
      // non-text body; skip
      return '';
    }
    return await res.text();
  } finally { clearTimeout(t); }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(s: string): string { return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'); }
