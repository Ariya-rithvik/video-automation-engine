import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { generateCrawlAnalysisFromAPI } from './gemini';

puppeteerExtra.use(StealthPlugin());

const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const GEMINI_URL = 'https://gemini.google.com/app';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for user to login
const RESPONSE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes for Gemini to respond
const POLL_INTERVAL_MS = 3000;

// ─── Types ──────────────────────────────────────────────────────────────────────

export type GeminiAgentStatus =
  | 'idle'
  | 'launching'
  | 'waiting_for_login'
  | 'logged_in'
  | 'uploading'
  | 'prompting'
  | 'generating'
  | 'extracting'
  | 'complete'
  | 'error';

export interface GeminiAgentState {
  status: GeminiAgentStatus;
  message: string;
  crawlId: string | null;
  result: string | null;
  error: string | null;
}

export interface GeminiGenerateRequest {
  crawlId: string;
  targetUrl: string;
  screenshotPaths: string[];
  videoPath?: string;
  discoveredPages: string[];
  customPrompt?: string;
}

// ─── Persistence & Debug Paths ──────────────────────────────────────────────────

const COOKIE_PATH = path.join(__dirname, '../../data/gemini-cookies.json');
const USER_DATA_DIR = path.join(__dirname, '../../data/chrome-profile');
const DEBUG_DIR = path.join(__dirname, '../../data/gemini-debug');

function saveCookies(cookies: any[]) {
  try {
    fs.mkdirSync(path.dirname(COOKIE_PATH), { recursive: true });
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`[GeminiAgent] 🍪 Saved ${cookies.length} cookies for future sessions.`);
  } catch (err) {
    console.warn('[GeminiAgent] Failed to save cookies:', err);
  }
}

function loadCookies(): any[] | null {
  try {
    if (fs.existsSync(COOKIE_PATH)) {
      const data = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf-8'));
      console.log(`[GeminiAgent] 🍪 Loaded ${data.length} saved cookies.`);
      return data;
    }
  } catch (err) {
    console.warn('[GeminiAgent] Failed to load cookies:', err);
  }
  return null;
}

// ─── Gemini Agent ───────────────────────────────────────────────────────────────

class GeminiAgent {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private _state: GeminiAgentState = {
    status: 'idle',
    message: 'Agent is idle.',
    crawlId: null,
    result: null,
    error: null,
  };

  // Status change callback for real-time updates
  private onStatusChange?: (state: GeminiAgentState) => void;

  get state(): GeminiAgentState {
    return { ...this._state };
  }

  setStatusCallback(cb: (state: GeminiAgentState) => void) {
    this.onStatusChange = cb;
  }

  private updateState(updates: Partial<GeminiAgentState>) {
    this._state = { ...this._state, ...updates };
    console.log(`[GeminiAgent] ${this._state.status}: ${this._state.message}`);
    this.onStatusChange?.(this._state);
  }

  // ─── Browser Lifecycle ──────────────────────────────────────────────────────

  async launchBrowser(): Promise<void> {
    this.updateState({ status: 'launching', message: 'Opening Chrome browser (visible mode)...' });

    fs.mkdirSync(USER_DATA_DIR, { recursive: true });

    this.browser = await puppeteerExtra.launch({
      headless: false, // VISIBLE browser - user can see and interact
      defaultViewport: null, // Use full window size
      userDataDir: USER_DATA_DIR, // Persistent profile — Google login survives between runs
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--lang=en-US,en',
        '--start-maximized',
      ],
    }) as unknown as Browser;

    this.page = await this.browser.newPage();
    await this.page.setUserAgent(REAL_USER_AGENT);
    await this.page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    // Load saved cookies if available
    const savedCookies = loadCookies();
    if (savedCookies && savedCookies.length > 0) {
      try {
        await this.page.setCookie(...savedCookies);
        console.log('[GeminiAgent] Applied saved cookies.');
      } catch {
        console.warn('[GeminiAgent] Could not apply saved cookies.');
      }
    }
  }

  // ─── Debug Capture ──────────────────────────────────────────────────────────
  // Saves a screenshot + HTML + URL/title so we can SEE what the agent sees.

  private async captureDebug(label: string): Promise<void> {
    if (!this.page) return;
    try {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_');
      const base = `${ts}_${safeLabel}`;
      const screenshotPath = path.join(DEBUG_DIR, `${base}.png`);
      const htmlPath = path.join(DEBUG_DIR, `${base}.html`);
      const url = this.page.url();
      const title = await this.page.title().catch(() => 'unknown');
      await this.page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: false });
      const html = await this.page.content().catch(() => '');
      fs.writeFileSync(htmlPath, `<!-- URL: ${url}\n     TITLE: ${title}\n     LABEL: ${label}\n-->\n${html}`);
      console.log(`[GeminiAgent] 📸 Captured "${label}" → ${path.basename(screenshotPath)} | URL: ${url}`);
    } catch (err) {
      console.warn(`[GeminiAgent] Debug capture failed for "${label}":`, err);
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.page) {
      // Save cookies before closing
      try {
        const cookies = await this.page.cookies();
        saveCookies(cookies);
      } catch { /* ignore */ }
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  // ─── Login Detection ────────────────────────────────────────────────────────

  private async isLoggedIn(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const url = this.page.url();

      // Hard guard: any Google sign-in / account-chooser URL means NOT logged in to Gemini
      if (
        url.includes('accounts.google.com') ||
        url.includes('/signin') ||
        url.includes('/ServiceLogin') ||
        url.includes('/AccountChooser') ||
        url.includes('/InteractiveLogin')
      ) {
        return false;
      }

      // Must be on the Gemini app specifically (not the marketing landing page which has demo widgets)
      if (!url.includes('gemini.google.com/app')) return false;

      // Require BOTH a chat input AND a logged-in-only marker (sidebar / new-chat button / user avatar)
      const chatInput = await this.page.$(
        'rich-textarea, .input-area .ql-editor, [data-test-id="chat-input"], [data-test-id="input-area"]'
      );
      const loggedInMarker = await this.page.$(
        '[data-test-id="new-chat-button"], [aria-label="New chat"], .new-chat-button, ' +
        '[data-test-id="side-nav"], side-navigation, [aria-label*="account" i]'
      );

      return !!(chatInput && loggedInMarker);
    } catch {
      return false;
    }
  }

  private async isLoginPage(): Promise<boolean> {
    if (!this.page) return false;
    try {
      const url = this.page.url();
      if (url.includes('accounts.google.com') || url.includes('signin')) return true;

      const signInBtn = await this.page.$('a[href*="accounts.google"], [data-action="sign in"], .sign-in-button');
      if (signInBtn) return true;

      return false;
    } catch {
      return false;
    }
  }

  async waitForLogin(): Promise<boolean> {
    if (!this.page) return false;

    this.updateState({
      status: 'waiting_for_login',
      message: '🔐 Please login to Google in the Chrome window. I\'ll wait...',
    });

    const startTime = Date.now();

    while (Date.now() - startTime < LOGIN_TIMEOUT_MS) {
      const loggedIn = await this.isLoggedIn();
      if (loggedIn) {
        this.updateState({ status: 'logged_in', message: '✅ Login detected! Taking over now...' });

        // Save cookies after successful login
        try {
          const cookies = await this.page.cookies();
          saveCookies(cookies);
        } catch { /* ignore */ }

        return true;
      }
      await this.sleep(POLL_INTERVAL_MS);
    }

    this.updateState({ status: 'error', message: '⏰ Login timeout (5 minutes). Please try again.', error: 'Login timeout' });
    return false;
  }

  // ─── File Upload ────────────────────────────────────────────────────────────

  async uploadFiles(filePaths: string[]): Promise<boolean> {
    if (!this.page) return false;

    const validFiles = filePaths.filter(f => fs.existsSync(f));
    if (validFiles.length === 0) {
      console.log('[GeminiAgent] No valid files to upload.');
      return true; // Not an error, just nothing to upload
    }

    this.updateState({
      status: 'uploading',
      message: `📎 Uploading ${validFiles.length} file(s) to Gemini...`,
    });

    try {
      // Find the file upload button/area - Gemini uses an attachment icon
      // Click the attachment/upload button to trigger file input
      const uploadButton = await this.page.$(
        'button[aria-label*="upload"], button[aria-label*="Upload"], ' +
        'button[aria-label*="Add file"], button[aria-label*="attach"], ' +
        'button[aria-label*="Attach"], [data-tooltip*="Upload"], ' +
        '.upload-button, [aria-label*="image"]'
      );

      if (uploadButton) {
        await uploadButton.click();
        await this.sleep(1500);
      }

      // Look for the file input element (may be hidden)
      // Gemini creates a file input when the upload button is clicked
      let fileInput = await this.page.$('input[type="file"]');

      if (!fileInput) {
        // Try clicking any "Upload file" option in a dropdown menu
        const uploadOption = await this.page.$('[role="menuitem"]');
        if (uploadOption) {
          const text = await this.page.evaluate(el => el.textContent, uploadOption);
          if (text && (text.includes('Upload') || text.includes('file'))) {
            await uploadOption.click();
            await this.sleep(1500);
            fileInput = await this.page.$('input[type="file"]');
          }
        }
      }

      if (!fileInput) {
        // Inject a file input as fallback
        await this.page.evaluate(() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.id = 'ade-file-input';
          input.multiple = true;
          input.style.display = 'none';
          document.body.appendChild(input);
        });
        fileInput = await this.page.$('#ade-file-input') as typeof fileInput;
      }

      if (fileInput) {
        // Upload files (Puppeteer handles the file dialog)
        await fileInput.uploadFile(...validFiles);
        this.updateState({
          status: 'uploading',
          message: `📎 Uploaded ${validFiles.length} file(s). Waiting for processing...`,
        });
        // Wait for Gemini to process the uploads
        await this.sleep(3000 + (validFiles.length * 1000));
        return true;
      } else {
        console.warn('[GeminiAgent] Could not find file input element. Proceeding with text-only prompt.');
        return true;
      }
    } catch (err) {
      console.warn('[GeminiAgent] File upload failed:', err);
      return true; // Continue with text-only prompt
    }
  }

  // ─── Send Prompt ────────────────────────────────────────────────────────────

  async sendPrompt(promptText: string): Promise<boolean> {
    if (!this.page) return false;

    this.updateState({
      status: 'prompting',
      message: '✏️ Typing prompt into Gemini...',
    });

    try {
      // Find the chat input area
      const inputSelectors = [
        'div[contenteditable="true"]',
        '.ql-editor',
        'rich-textarea',
        '[aria-label*="prompt"]',
        '.input-area textarea',
        'textarea',
        '.text-input-field',
      ];

      let inputEl = null;
      for (const sel of inputSelectors) {
        inputEl = await this.page.$(sel);
        if (inputEl) break;
      }

      if (!inputEl) {
        this.updateState({ status: 'error', message: '❌ Could not find Gemini chat input.', error: 'Chat input not found' });
        return false;
      }

      // Click to focus the input
      await inputEl.click();
      await this.sleep(500);

      // Type the prompt (use keyboard for contenteditable divs)
      await this.page.keyboard.type(promptText, { delay: 10 });
      await this.sleep(1000);

      // Find and click the send/submit button
      const sendButton = await this.page.$(
        'button[aria-label*="Send"], button[aria-label*="send"], ' +
        'button[aria-label*="Submit"], .send-button, ' +
        '[data-tooltip*="Send"], button.send'
      );

      if (sendButton) {
        await sendButton.click();
      } else {
        // Fallback: press Enter
        await this.page.keyboard.press('Enter');
      }

      this.updateState({
        status: 'generating',
        message: '🧠 Gemini is generating a response...',
      });

      return true;
    } catch (err) {
      this.updateState({ status: 'error', message: `❌ Failed to send prompt: ${err}`, error: String(err) });
      return false;
    }
  }

  // ─── Wait for Response ──────────────────────────────────────────────────────

  async waitForResponse(): Promise<boolean> {
    if (!this.page) return false;

    const startTime = Date.now();

    // Wait for Gemini to start responding (look for loading indicators)
    await this.sleep(3000);

    while (Date.now() - startTime < RESPONSE_TIMEOUT_MS) {
      try {
        // Check if Gemini is still generating (look for stop button or loading indicator)
        const isGenerating = await this.page.$(
          'button[aria-label*="Stop"], button[aria-label*="stop"], ' +
          '.loading-indicator, .generating-indicator, ' +
          '[data-tooltip*="Stop"], .stop-button'
        );

        if (!isGenerating) {
          // No stop button means generation is complete
          // Wait a bit more to ensure the full response is rendered
          await this.sleep(2000);

          // Double-check it's really done
          const stillGenerating = await this.page.$(
            'button[aria-label*="Stop"], .loading-indicator'
          );

          if (!stillGenerating) {
            this.updateState({
              status: 'extracting',
              message: '📋 Extracting Gemini\'s response...',
            });
            return true;
          }
        }

        this.updateState({
          status: 'generating',
          message: `🧠 Gemini is generating... (${Math.round((Date.now() - startTime) / 1000)}s)`,
        });
      } catch {
        // Page might be updating, continue polling
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    // Timeout - but still try to extract what we have
    this.updateState({
      status: 'extracting',
      message: '⏰ Response timeout, extracting partial response...',
    });
    return true;
  }

  // ─── Extract Response ───────────────────────────────────────────────────────

  async extractResponse(): Promise<string | null> {
    if (!this.page) return null;

    // Safety: refuse to extract if we ended up on a sign-in page
    const url = this.page.url();
    if (url.includes('accounts.google.com') || url.includes('/signin') || url.includes('/ServiceLogin')) {
      console.error('[GeminiAgent] Refusing to extract — still on Google sign-in:', url);
      return null;
    }

    try {
      // Get all message containers - the last one is Gemini's response
      const response = await this.page.evaluate(() => {
        // Try multiple selectors for Gemini's response containers
        const selectors = [
          '.model-response-text',
          '.response-container',
          '.message-content',
          '[data-message-author-role="model"]',
          '.markdown-main-panel',
          'message-content',
        ];

        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          if (els.length > 0) {
            const last = els[els.length - 1];
            return last.textContent?.trim() || null;
          }
        }

        // Fallback: get all text from response-like containers
        const allMessages = document.querySelectorAll('[class*="response"], [class*="message"], [class*="answer"]');
        if (allMessages.length > 0) {
          const last = allMessages[allMessages.length - 1];
          return last.textContent?.trim() || null;
        }

        // Last resort: get the main content area
        const main = document.querySelector('main, .main-content, [role="main"]');
        if (main) {
          const text = main.textContent || '';
          // Extract the last substantial block of text
          const blocks = text.split('\n').filter((line: string) => line.trim().length > 50);
          if (blocks.length > 0) {
            return blocks.slice(-10).join('\n').trim();
          }
        }

        return null;
      });

      return response;
    } catch (err) {
      console.error('[GeminiAgent] Failed to extract response:', err);
      return null;
    }
  }

  // ─── Main Flow ──────────────────────────────────────────────────────────────

  async generate(request: GeminiGenerateRequest): Promise<GeminiAgentState> {
    try {
      this.updateState({
        status: 'launching',
        message: 'Starting Gemini agent...',
        crawlId: request.crawlId,
        result: null,
        error: null,
      });

      // 1. Launch visible browser
      await this.launchBrowser();

      // 2. Navigate to Gemini
      this.updateState({ status: 'launching', message: '🌐 Navigating to Gemini...' });
      await this.page!.goto(GEMINI_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.sleep(3000);
      await this.captureDebug('01-after-navigate');

      // 3. Check login status
      const alreadyLoggedIn = await this.isLoggedIn();
      console.log(`[GeminiAgent] Initial isLoggedIn check: ${alreadyLoggedIn} (URL: ${this.page!.url()})`);
      if (!alreadyLoggedIn) {
        await this.captureDebug('02-before-login-wait');
        const loginSuccess = await this.waitForLogin();
        if (!loginSuccess) {
          await this.captureDebug('03-login-timeout');
          console.log('[GeminiAgent] Browser left OPEN for inspection (login timeout).');
          return this.state;
        }
        await this.captureDebug('04-after-login-success');
      } else {
        this.updateState({ status: 'logged_in', message: '✅ Already logged in (profile worked!)' });
        await this.captureDebug('04-already-logged-in');
      }

      // 4. Small delay to ensure Gemini UI is fully loaded
      await this.sleep(2000);

      // 5. Upload screenshots (try first few, not all 20)
      const screenshotsToUpload = request.screenshotPaths.slice(0, 5); // Max 5 screenshots
      if (screenshotsToUpload.length > 0) {
        await this.captureDebug('05-before-upload');
        await this.uploadFiles(screenshotsToUpload);
        await this.captureDebug('06-after-upload');
      }

      // 6. Try uploading video if small enough (under 20MB)
      if (request.videoPath && fs.existsSync(request.videoPath)) {
        const videoSize = fs.statSync(request.videoPath).size;
        if (videoSize < 20 * 1024 * 1024) { // Under 20MB
          this.updateState({ status: 'uploading', message: '🎬 Uploading crawl video...' });
          await this.uploadFiles([request.videoPath]);
        } else {
          console.log(`[GeminiAgent] Video too large (${Math.round(videoSize / 1024 / 1024)}MB), using screenshots only.`);
        }
      }

      // 7. Build and send prompt
      await this.captureDebug('07-before-prompt');
      const prompt = request.customPrompt || this.buildPrompt(request);
      const sendSuccess = await this.sendPrompt(prompt);
      if (!sendSuccess) {
        await this.captureDebug('08-prompt-failed');
        console.log('[GeminiAgent] Browser left OPEN for inspection (sendPrompt failed).');
        return this.state;
      }
      await this.captureDebug('08-after-prompt-sent');

      // 8. Wait for response
      await this.waitForResponse();
      await this.captureDebug('09-after-response');

      // 9. Extract response
      const response = await this.extractResponse();

      if (response) {
        this.updateState({
          status: 'complete',
          message: `✅ Gemini generated analysis! (${response.length} chars)`,
          result: response,
        });
        await this.captureDebug('10-complete');
        // On success, close browser
        await this.closeBrowser();
      } else {
        this.updateState({
          status: 'error',
          message: '❌ Could not extract Gemini\'s response. The page DOM may have changed.',
          error: 'Response extraction failed',
        });
        await this.captureDebug('10-extract-failed');
        console.log('[GeminiAgent] Browser left OPEN for inspection (extract failed).');
      }

      return this.state;

    } catch (err: any) {
      this.updateState({
        status: 'error',
        message: `❌ Agent error: ${err.message}`,
        error: err.message,
      });
      await this.captureDebug('99-exception').catch(() => {});
      console.log('[GeminiAgent] Browser left OPEN for inspection (exception):', err.message);
      return this.state;
    }
  }

  // ─── API Path (no browser, uses @google/genai directly) ────────────────────
  // Bypasses the visible-Chrome flow entirely. Reuses the same state machine
  // so the existing GeminiPanel UI works unchanged.

  async generateViaAPI(request: GeminiGenerateRequest): Promise<GeminiAgentState> {
    this.updateState({
      status: 'launching',
      message: '🚀 Starting Gemini API agent (no browser)...',
      crawlId: request.crawlId,
      result: null,
      error: null,
    });

    const onStatus = (msg: string) => {
      this.updateState({
        status: msg.startsWith('📦') ? 'uploading' : 'generating',
        message: msg,
      });
    };

    const apiResult = await generateCrawlAnalysisFromAPI(
      {
        crawlId: request.crawlId,
        targetUrl: request.targetUrl,
        screenshotPaths: request.screenshotPaths,
        discoveredPages: request.discoveredPages,
        customPrompt: request.customPrompt,
      },
      onStatus,
    );

    if (apiResult.success && apiResult.response) {
      this.updateState({
        status: 'complete',
        message: `✅ Gemini ${apiResult.model} generated analysis! (${apiResult.response.length} chars)`,
        result: apiResult.response,
      });
    } else {
      this.updateState({
        status: 'error',
        message: `❌ ${apiResult.error}`,
        error: apiResult.error,
      });
    }

    return this.state;
  }

  // ─── Prompt Builder ─────────────────────────────────────────────────────────

  private buildPrompt(request: GeminiGenerateRequest): string {
    const pageList = request.discoveredPages.map(p => p.replace(/_/g, ' ')).join(', ');

    return `I'm showing you screenshots${request.videoPath ? ' and a video recording' : ''} of a website crawl of ${request.targetUrl}.

The crawl discovered ${request.discoveredPages.length} pages: ${pageList}.

Please analyze each page and generate a professional demo script that:
1. Describes what each page/feature does based on what you see
2. Highlights the key UI elements, design choices, and functionality visible
3. Uses a confident, professional narrator tone (like an Apple keynote presentation)
4. Each page section should be 2-3 sentences of narration

Format your response as:

**SUMMARY**
[One paragraph overview of the entire website/app]

**PAGE SCRIPTS**

**[Page Name]**
[2-3 sentence narration for this page]

(Repeat for each page you can identify from the screenshots)`;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset() {
    this.updateState({
      status: 'idle',
      message: 'Agent is idle.',
      crawlId: null,
      result: null,
      error: null,
    });
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────────

export const geminiAgent = new GeminiAgent();
