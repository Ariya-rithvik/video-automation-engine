// Search crawler — navigates to a site, finds its search bar, types a query, captures
// screenshots of the top N product/result cards. Returns absolute paths to the PNG files.
//
// Used by the marketing pipeline so PromptThenGrid shows REAL search results (e.g. typing
// "iPhone 15" on amazon.in returns 4 actual iPhone 15 product cards), not random screenshots
// from the original crawl.
//
// Strategy:
//   1. Use puppeteer-extra + stealth (same stack as the rest of the codebase)
//   2. Headless Chrome navigates to the URL
//   3. Per-site selector profiles (Amazon, Flipkart, Zomato) + generic fallback for unknown sites
//   4. Type query → submit → wait for results → screenshot each card → save to backend/data/search-crawls/

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

puppeteerExtra.use(StealthPlugin());

const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const OUT_DIR = path.resolve(__dirname, '../../data/search-crawls');
const VIEWPORT_W = 1440;
const VIEWPORT_H = 900;
const RESULT_WAIT_MS = 8000;
const CARD_LIMIT = 6;

export interface SearchCrawlRequest {
  url: string;
  query: string;
  count?: number;
}

export interface SearchCrawlResult {
  success: boolean;
  resultsUrl: string;             // URL after the search submission (for debugging)
  screenshotPaths: string[];      // absolute paths to saved PNGs
  error: string | null;
}

// Per-site selector profiles. Falls back to generic if hostname not matched.
interface SiteProfile {
  searchInput: string[];      // CSS selectors to try for the search input
  searchSubmit?: string[];    // optional explicit submit button selectors (else press Enter)
  resultCard: string[];       // CSS selectors for the result product cards
  cardScreenshotPadding?: number; // pixels of padding around card screenshot
}

const SITE_PROFILES: Record<string, SiteProfile> = {
  'amazon': {
    searchInput: ['#twotabsearchtextbox', 'input[name="field-keywords"]', 'input[type="search"]'],
    searchSubmit: ['#nav-search-submit-button', 'input[type="submit"][value="Go"]'],
    resultCard: ['[data-component-type="s-search-result"]', '.s-result-item[data-component-type]', '[data-asin]:not([data-asin=""])'],
    cardScreenshotPadding: 12,
  },
  'flipkart': {
    searchInput: ['input[name="q"]', 'input[title*="Search"]', 'input[type="text"]'],
    resultCard: ['[data-id]', '._1AtVbE', '._13oc-S'],
    cardScreenshotPadding: 8,
  },
  'myntra': {
    searchInput: ['.desktop-searchBar input', 'input[placeholder*="Search"]'],
    resultCard: ['.product-base', '.search-searchProductsContainer .product-base'],
    cardScreenshotPadding: 8,
  },
  'zomato': {
    searchInput: ['input[placeholder*="restaurant"i]', 'input[type="text"]'],
    resultCard: ['[class*="restaurant"]', '[class*="ResCard"]', 'article'],
    cardScreenshotPadding: 8,
  },
  'github': {
    searchInput: ['input[name="q"]', '[data-target="qbsearch-input"]', 'input[type="search"]'],
    resultCard: ['.repo-list-item', '[data-testid="results-list"] > *', '.search-result'],
    cardScreenshotPadding: 8,
  },
};

function profileForUrl(url: string): SiteProfile {
  const host = (() => {
    try { return new URL(url).hostname.toLowerCase(); } catch { return url.toLowerCase(); }
  })();
  for (const key of Object.keys(SITE_PROFILES)) {
    if (host.includes(key)) return SITE_PROFILES[key];
  }
  // Generic fallback
  return {
    searchInput: ['input[type="search"]', 'input[name*="search" i]', 'input[name="q"]', 'input[placeholder*="search" i]', 'input[type="text"]'],
    resultCard: ['[class*="product"]', '[class*="card"]', '[class*="result"]', 'article', 'li[class*="item"]'],
    cardScreenshotPadding: 8,
  };
}

async function tryClick(page: Page, selectors: string[]): Promise<boolean> {
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        return true;
      }
    } catch { /* try next */ }
  }
  return false;
}

async function findAndTypeSearch(page: Page, profile: SiteProfile, query: string): Promise<boolean> {
  for (const sel of profile.searchInput) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      await el.focus();
      // Clear any existing text in the input, then type the query
      await page.evaluate((node: any) => { if (node) node.value = ''; }, el).catch(() => {});
      await el.type(query, { delay: 30 });
      return true;
    } catch { /* try next */ }
  }
  return false;
}

async function captureCardScreenshots(page: Page, profile: SiteProfile, count: number, crawlId: string): Promise<string[]> {
  const paths: string[] = [];
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Try each card selector until one returns enough elements
  for (const sel of profile.resultCard) {
    let cards;
    try {
      cards = await page.$$(sel);
    } catch { continue; }
    if (!cards || cards.length === 0) continue;

    let captured = 0;
    for (let i = 0; i < cards.length && captured < count; i++) {
      try {
        const box = await cards[i].boundingBox();
        if (!box || box.width < 100 || box.height < 100) continue; // skip tiny / invisible

        // Scroll the card into view so screenshot includes loaded images
        await cards[i].evaluate((el: any) => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 250));

        const filename = `search-${crawlId}-${captured + 1}.png`;
        const filepath = path.join(OUT_DIR, filename);

        await cards[i].screenshot({ path: filepath as `${string}.png` });
        const stat = fs.statSync(filepath);
        if (stat.size < 500) {
          try { fs.unlinkSync(filepath); } catch { /* ignore */ }
          continue;
        }
        paths.push(filepath);
        captured++;
      } catch (err) {
        console.warn(`[SearchCrawler] Card ${i} screenshot failed:`, err);
      }
    }
    if (paths.length > 0) {
      console.log(`[SearchCrawler] Captured ${paths.length} cards with selector ${sel}`);
      return paths;
    }
  }

  console.warn('[SearchCrawler] No result cards matched any selector');
  return paths;
}

export async function searchSiteAndScreenshot(request: SearchCrawlRequest): Promise<SearchCrawlResult> {
  const targetCount = Math.min(CARD_LIMIT, Math.max(1, request.count || 4));
  const profile = profileForUrl(request.url);
  const crawlId = `${Date.now()}`;

  let browser: Browser | null = null;
  try {
    console.log(`[SearchCrawler] Launching for ${request.url} — query: "${request.query}"`);
    browser = await puppeteerExtra.launch({
      headless: true,
      defaultViewport: { width: VIEWPORT_W, height: VIEWPORT_H },
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=en-US,en'],
    }) as unknown as Browser;

    const page = await browser.newPage();
    await page.setUserAgent(REAL_USER_AGENT);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // 1. Navigate
    await page.goto(request.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));

    // 2. Type query into search input
    const typed = await findAndTypeSearch(page, profile, request.query);
    if (!typed) {
      return {
        success: false,
        resultsUrl: page.url(),
        screenshotPaths: [],
        error: 'Could not find a search input matching known selectors.',
      };
    }

    // 3. Submit — try explicit button first, else press Enter
    if (profile.searchSubmit && profile.searchSubmit.length > 0) {
      const clicked = await tryClick(page, profile.searchSubmit);
      if (!clicked) {
        await page.keyboard.press('Enter');
      }
    } else {
      await page.keyboard.press('Enter');
    }

    // 4. Wait for results page
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: RESULT_WAIT_MS });
    } catch {
      // Some SPAs don't navigate — wait for any DOM mutation
    }
    await new Promise(r => setTimeout(r, 2000));

    const resultsUrl = page.url();
    console.log(`[SearchCrawler] Results page: ${resultsUrl}`);

    // 5. Capture top N card screenshots
    const screenshotPaths = await captureCardScreenshots(page, profile, targetCount, crawlId);

    if (screenshotPaths.length === 0) {
      return {
        success: false,
        resultsUrl,
        screenshotPaths: [],
        error: 'Search submitted but no result cards could be captured.',
      };
    }

    return {
      success: true,
      resultsUrl,
      screenshotPaths,
      error: null,
    };
  } catch (err: any) {
    return {
      success: false,
      resultsUrl: request.url,
      screenshotPaths: [],
      error: `Search crawler crashed: ${err?.message || String(err)}`,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
}
