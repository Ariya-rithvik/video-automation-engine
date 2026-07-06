// Browser-AI brain — the FREE fallback "LLM" provider. Instead of a paid API, it drives the user's
// already-logged-in ChatGPT or Gemini WEB APP inside their real Chrome (attached via CDP, same debug
// port as the rest of attach mode), types the prompt, and scrapes the answer. $0 — only cost is the
// free account everyone already has. Fragile by nature (it scrapes a UI that changes), so it sits LAST
// in the brain chain: API providers are tried first, this catches the "quota exhausted" case.
//
// Enable via env (no code change):
//   BROWSER_LLM=1
//   BROWSER_LLM_PROVIDER=gemini | chatgpt        (default gemini)
//   BROWSER_LLM_CDP_URL=http://localhost:9222     (default; run start-chrome-attach.bat first)

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';

puppeteerExtra.use(StealthPlugin());

export type BrowserLLMProvider = 'gemini' | 'chatgpt';

export interface BrowserLLMConfig {
  enabled: boolean;
  provider: BrowserLLMProvider;
  cdpUrl: string;
  label: string;
}

export function browserLLMConfig(): BrowserLLMConfig | null {
  if (!/^(1|true|yes|on)$/i.test(process.env.BROWSER_LLM || '')) return null;
  const provider = (process.env.BROWSER_LLM_PROVIDER || 'gemini').toLowerCase() === 'chatgpt' ? 'chatgpt' : 'gemini';
  const cdpUrl = process.env.BROWSER_LLM_CDP_URL || 'http://localhost:9222';
  return { enabled: true, provider, cdpUrl, label: `browser-${provider}` };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const HOST: Record<BrowserLLMProvider, string> = { gemini: 'gemini.google.com', chatgpt: 'chatgpt.com' };
const URL_: Record<BrowserLLMProvider, string> = { gemini: 'https://gemini.google.com/app', chatgpt: 'https://chatgpt.com/' };
// input box selectors (several fallbacks — these UIs change often)
const INPUT_SEL: Record<BrowserLLMProvider, string> = {
  gemini: 'rich-textarea div[contenteditable="true"], div[contenteditable="true"], textarea',
  chatgpt: '#prompt-textarea, div[contenteditable="true"], textarea',
};

/** Ask the logged-in web LLM a TEXT question; returns the assistant's latest answer text. */
export async function askBrowserLLM(prompt: string, cfg: BrowserLLMConfig): Promise<string> {
  let browser: Browser | null = null;
  try {
    browser = await puppeteerExtra.connect({ browserURL: cfg.cdpUrl, defaultViewport: null }) as unknown as Browser;
  } catch (e) {
    throw new Error(`browser-LLM: cannot attach to Chrome at ${cfg.cdpUrl} (run start-chrome-attach.bat). ${(e as Error).message}`);
  }
  try {
    const host = HOST[cfg.provider];
    const pages = await browser.pages();
    let page: Page | null = null;
    for (const p of pages) { try { if (p.url().includes(host)) { page = p; break; } } catch { /* */ } }
    if (!page) {
      page = await browser.newPage();
      await page.goto(URL_[cfg.provider], { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3500);
    }
    await page.bringToFront().catch(() => {});

    // Must be logged in — if there's a Sign-in wall, bail (caller falls through / heuristic).
    const sel = INPUT_SEL[cfg.provider];
    try { await page.waitForSelector(sel, { timeout: 15000 }); }
    catch { throw new Error(`browser-LLM: no input box on ${host} — are you logged in?`); }

    // Type the prompt (flatten newlines so Enter doesn't submit early), then submit.
    await page.click(sel).catch(() => {});
    await page.evaluate((s) => { const el = document.querySelector(s) as any; if (el) el.focus(); }, sel);
    await page.keyboard.type(prompt.replace(/\s*\n\s*/g, ' '), { delay: 1 });
    await sleep(250);
    await page.keyboard.press('Enter');

    const answer = await waitForAnswer(page, cfg.provider);
    if (!answer) throw new Error('browser-LLM: empty answer');
    return answer;
  } finally {
    try { (browser as any).disconnect(); } catch { /* never close the user's Chrome */ }
  }
}

/**
 * VISION via the web app — uploads a screenshot to the logged-in Gemini/ChatGPT chat, asks about it,
 * and scrapes the answer. FREE multimodal (uses the account you already pay nothing for; no API quota).
 * Same fragile-UI caveat as askBrowserLLM, so it sits LAST in the vision chain.
 */
export async function askBrowserVision(prompt: string, imagePath: string, cfg: BrowserLLMConfig): Promise<string> {
  if (!imagePath || !fs.existsSync(imagePath)) throw new Error(`browser-vision: image not found: ${imagePath}`);
  let browser: Browser | null = null;
  try {
    browser = await puppeteerExtra.connect({ browserURL: cfg.cdpUrl, defaultViewport: null }) as unknown as Browser;
  } catch (e) {
    throw new Error(`browser-vision: cannot attach to Chrome at ${cfg.cdpUrl} (run start-chrome-attach.bat). ${(e as Error).message}`);
  }
  try {
    const host = HOST[cfg.provider];
    const pages = await browser.pages();
    let page: Page | null = null;
    for (const p of pages) { try { if (p.url().includes(host)) { page = p; break; } } catch { /* */ } }
    if (!page) {
      page = await browser.newPage();
      await page.goto(URL_[cfg.provider], { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(3500);
    }
    await page.bringToFront().catch(() => {});

    const sel = INPUT_SEL[cfg.provider];
    try { await page.waitForSelector(sel, { timeout: 15000 }); }
    catch { throw new Error(`browser-vision: no input box on ${host} — are you logged in?`); }

    // 1) Attach the image. Gemini has NO inline <input type=file>; you click "Upload and tools"
    //    → "Upload files", which opens a NATIVE file dialog. We intercept it at the CDP level
    //    (deterministic: dialog never shows, no race) and set the file by its backendNodeId.
    const upBtn = (await page.$('button[aria-label="Upload and tools"]'))
      || (await page.$('button[aria-label*="upload" i]'))
      || (await page.$('button[aria-label*="add" i]'));
    if (!upBtn) throw new Error('browser-vision: Gemini upload button not found (UI changed)');
    await upBtn.click().catch(() => {});
    await sleep(1100); // menu opens

    // Locate the "Upload files" menu item as a real handle.
    let item: any = null;
    for (const c of await page.$$('button,[role="menuitem"],[role="option"],a,div[role="button"]')) {
      const t = (await c.evaluate((el: any) => (el.textContent || '').trim()).catch(() => '')).toLowerCase();
      if (t === 'upload files' || /^upload files$/.test(t) || /upload from|from (this )?device|from computer/.test(t)) { item = c; break; }
    }
    if (!item) throw new Error('browser-vision: "Upload files" item not found in the upload menu');

    const client = await (page as any).createCDPSession();
    let uploaded = false;
    try {
      await client.send('Page.enable'); // REQUIRED so this session emits Page.fileChooserOpened
      await client.send('Page.setInterceptFileChooserDialog', { enabled: true });
      const ev: any = await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('no fileChooser event')), 15000);
        client.once('Page.fileChooserOpened', (e: any) => { clearTimeout(to); resolve(e); });
        item.click().catch(() => {});
      });
      await client.send('DOM.setFileInputFiles', { files: [imagePath], backendNodeId: ev.backendNodeId });
      uploaded = true;
    } catch {
      const inp = await page.$('input[type="file"]'); // fallback if a direct input appears
      if (inp) { await (inp as any).uploadFile(imagePath); uploaded = true; }
    } finally {
      try { await client.send('Page.setInterceptFileChooserDialog', { enabled: false }); } catch { /* */ }
      try { await client.detach(); } catch { /* */ }
    }
    if (!uploaded) throw new Error('browser-vision: could not attach image via the Gemini upload menu');
    await sleep(4800); // let the thumbnail finish uploading BEFORE we send (else it sends text-only)

    // 2) Type the prompt + submit.
    await page.click(sel).catch(() => {});
    await page.evaluate((s) => { const el = document.querySelector(s) as any; if (el) el.focus(); }, sel);
    await page.keyboard.type(prompt.replace(/\s*\n\s*/g, ' '), { delay: 1 });
    await sleep(300);
    await page.keyboard.press('Enter');

    const answer = await waitForAnswer(page, cfg.provider, 35000); // vision replies can take longer
    if (!answer) throw new Error('browser-vision: empty answer');
    return answer;
  } finally {
    try { (browser as any).disconnect(); } catch { /* never close the user's Chrome */ }
  }
}

// Poll the LAST assistant message until its text stops growing (streaming finished) or we time out.
async function waitForAnswer(page: Page, provider: BrowserLLMProvider, maxMs = 22000): Promise<string> {
  const deadline = Date.now() + maxMs; // cap per-answer wait so a throttled web-AI can't eat the demo budget
  let last = '';
  let stable = 0;
  await sleep(1500);
  while (Date.now() < deadline) {
    const txt = await page.evaluate((p) => {
      const sels = p === 'chatgpt'
        ? ['[data-message-author-role="assistant"]', '.markdown', '[class*="message"]']
        : ['message-content', '.model-response-text', '[class*="markdown"]', '[class*="response"]'];
      let nodes: Element[] = [];
      for (const s of sels) { const n = Array.from(document.querySelectorAll(s)); if (n.length) { nodes = n; break; } }
      if (!nodes.length) return '';
      return (nodes[nodes.length - 1].textContent || '').trim();
    }, provider).catch(() => '');
    if (txt && txt === last) { stable++; if (stable >= 2) break; } // ~3s unchanged → done
    else { last = txt; stable = 0; }
    await sleep(1500);
  }
  return last;
}
