// ════════════════════════════════════════════════════════════════════════════
// DEEP EXPLORER — ONE unified, vision-driven product demo for ANY web app.
//
// Flow per run:
//   1. Open the app and SCROLL the landing page top→bottom (show it, like the normal recorder).
//   2. LOG IN if asked — auto-fill the credentials (native form), else fall back to a visible
//      browser + human "I've logged in" confirm (Google OAuth / CAPTCHA can't be automated).
//   3. A perceive→reason→act loop: number the interactive things on screen, ask the vision brain
//      for ONE next action (explore a section / type-search / draw on a canvas / use the app's AI /
//      scroll / done), and DO it with a ghost cursor — guided by an ACTION-MEMORY so nothing is
//      ever repeated (if the brain picks something already done, we hard-skip and take the next
//      useful undone action instead). When the whole vision chain is exhausted we keep going on
//      our own (cover every remaining section).
//   4. Record at fixed fps; recording is paused while the brain "thinks" (badges up) AND every
//      wait (vision, login, nav) is logged to WaitTracker and trimmed from the final video.
// Reuses the app-demo ghost-cursor/draw/mark primitives and the shared web-login helpers.
// ════════════════════════════════════════════════════════════════════════════

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { brainText } from './vision-brain';
import { WaitTracker, cutWaitsFromVideo } from './wait-tracker';
import {
  injectOverlay, setCaption, glideTo, drawStroke, selectDrawTool,
  markInteractive, centerOf, UNSAFE, starPts, circlePts, Mark,
} from './app-demo';
import { attemptAutoLogin, isLikelyLoggedIn, clickByText } from './web-login';

puppeteerExtra.use(StealthPlugin());

export interface DeepExploreOptions {
  targetUrl: string;
  outputDir: string;
  loginWait?: boolean;            // headful + log in before exploring
  loginCredentials?: { username: string; password: string } | null; // auto-fill (runtime only, never logged)
  isLoggedIn?: () => boolean;     // human-confirm hook (true when user clicked "I've logged in")
  unattended?: boolean;           // automated run (no human to click "I've logged in") → short login grace, then public
  onStatus?: (msg: string) => void;
  maxSections?: number;           // how many distinct actions/sections to show (default 8)
  maxDepth?: number;              // kept for API compatibility (sub-page backtrack is automatic)
  fps?: number;                   // capture fps (default 6)
  timeBudgetSec?: number;         // hard wall-clock cap (default 240)
  aiPrompt?: string;              // hint to type into a search box / the app's AI
  viewport?: { width: number; height: number }; // recording size — adjustable (default full-HD 1920×1080)
  attachCdpUrl?: string;          // e.g. "http://localhost:9222" → drive your REAL, already-logged-in Chrome
}

export interface DeepExploreResult {
  videoPath: string;
  rawVideoPath: string;
  visited: string[];              // human-readable list of what the demo did (for the UI badges)
  durationSec: number;
  removedSec: number;
  steps: number;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const log = (o: DeepExploreOptions, m: string) => { console.log('[DeepExplorer] ' + m); o.onStatus?.(m); };

// ── Action-memory: what we've already done, so we never repeat (the user's core ask). ──
interface ExploreMemory {
  scrolledHubs: Set<string>;   // urls whose page we already scrolled through -> blocks repeat "scroll"
  visitedSections: string[];   // section labels clicked (lowercased)
  typedFields: Set<string>;    // input labels already typed into (lowercased)
  drewCanvas: boolean;         // drew already
  usedAgent: boolean;          // triggered the app's AI already
  log: string[];               // human-readable history -> captions + summary + the result badges
}
const newMemory = (): ExploreMemory => ({ scrolledHubs: new Set(), visitedSections: [], typedFields: new Set(), drewCanvas: false, usedAgent: false, log: [] });
const totalActions = (m: ExploreMemory) => m.visitedSections.length + m.typedFields.size + (m.drewCanvas ? 1 : 0) + (m.usedAgent ? 1 : 0);
const memSummary = (m: ExploreMemory): string => {
  const p: string[] = [];
  if (m.scrolledHubs.size) p.push('scrolled the page');
  m.visitedSections.forEach(s => p.push('opened "' + s + '"'));
  m.typedFields.forEach(s => p.push('typed in "' + s + '"'));
  if (m.drewCanvas) p.push('drew on the canvas');
  if (m.usedAgent) p.push('used the app AI');
  return p.join(' | ');
};

// nav / CTA / destructive labels we never treat as "content sections"
const SKIP_LABEL = /^(home|sign ?in|log ?in|log ?out|sign ?out|get started|start (free|drawing free|deploying)?|deploy( now)?|menu|close|back|next|previous|cookie|accept|got it|subscribe|create account|donate|view source|view history|edit|upgrade|buy now|contact sales)$/i;

const alreadyDone = (page: Page, m: ExploreMemory, act: string, mark?: Mark): boolean => {
  if (act === 'click') return !!mark && m.visitedSections.includes(mark.label.toLowerCase());
  if (act === 'type') return !!mark && m.typedFields.has(mark.label.toLowerCase());
  if (act === 'draw') return m.drewCanvas;
  if (act === 'agent') return m.usedAgent;
  if (act === 'scroll') return m.scrolledHubs.has(page.url());
  return false;
};

// The app's primary sections — we want to tour ALL of these (breadth), not dive into one area.
const NAV_LABEL = /\b(my canvases|canvases|meetings|notifications|activity|settings|create meeting|join meeting|templates|projects|files|teams|members|integrations|profile|account|billing|gallery|explore|community)\b/i;
// NEVER type into these — they mutate the account / are credentials. (A demo must not edit the user's profile.)
const ACCOUNT_FIELD = /user ?name|e-?mail|pass|phone|mobile|address|first ?name|last ?name|full ?name|\bbio\b|company|card|cvv|otp/i;

// When vision repeats / fails, pick the next genuinely-undone useful action ourselves — BREADTH-FIRST so
// the whole app (every sidebar section) gets toured before we go deep into any one feature.
const pickUndone = (marks: Mark[], m: ExploreMemory): { act: string; mark?: Mark } | null => {
  const undoneClick = (x: Mark) => x.kind === 'click' && !m.visitedSections.includes(x.label.toLowerCase()) && !SKIP_LABEL.test(x.label.trim()) && !UNSAFE.test(x.label);
  // 1) HERO FIRST: get INTO the app's main surface so we can draw (New Canvas / Open Editor / New board…)
  if (!m.drewCanvas) {
    const create = marks.find(x => undoneClick(x) && /(new canvas|new board|new project|new design|create canvas|open editor|create new)/i.test(x.label));
    if (create) return { act: 'click', mark: create };
  }
  // 2) then an unvisited primary NAV/section (Meetings, Notifications, Activity, Settings, …)
  const nav = marks.find(x => undoneClick(x) && NAV_LABEL.test(x.label));
  if (nav) return { act: 'click', mark: nav };
  // 2) type ONLY into demo-worthy fields — a search box or a canvas/file NAME. Never random profile/login fields.
  const input = marks.find(x => x.kind === 'input' && !m.typedFields.has(x.label.toLowerCase()) && /(search|query|name|title|untitled|project)/i.test(x.label) && !UNSAFE.test(x.label) && !ACCOUNT_FIELD.test(x.label));
  if (input) return { act: 'type', mark: input };
  // 3) draw once if there's a canvas
  if (!m.drewCanvas) { const cv = marks.find(x => x.kind === 'canvas'); if (cv) return { act: 'draw', mark: cv }; }
  // 4) any other unvisited clickable
  const click = marks.find(undoneClick);
  if (click) return { act: 'click', mark: click };
  return null;
};

// Pick a realistic value to type, UNIQUE for name/title fields so "filename already exists" never blocks us.
const uniqueName = () => 'Demo ' + Date.now().toString().slice(-5);
const typeTextFor = (mark: Mark): string => {
  const l = mark.label.toLowerCase();
  if (/search|query/.test(l)) return 'design';     // a clean demo search query
  return uniqueName();                              // pickUndone only sends search/name fields → unique name
};

const scrollTopOf = (page: Page): Promise<number> =>
  page.evaluate(() => (document.scrollingElement?.scrollTop || window.scrollY || 0)).catch(() => 0) as Promise<number>;

// GRADUAL, readable scroll (matches the normal Zomato-style recorder: ~14px / 16ms ≈ 875px/s) so the
// viewer can actually read each screen — NOT a fast native smooth-jump.
async function smoothScroll(page: Page, dy: number): Promise<void> {
  await page.evaluate(async (total: number) => {
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const step = total >= 0 ? 14 : -14;
    const n = Math.max(1, Math.round(Math.abs(total) / 14));
    for (let i = 0; i < n; i++) { window.scrollBy(0, step); await sleep(16); }
  }, dy).catch(() => {});
}

// Scroll the current page top→bottom→top (one screen per step) so the video SHOWS it. Records into mem.
async function showLanding(page: Page, mem: ExploreMemory): Promise<void> {
  const url = page.url();
  if (mem.scrolledHubs.has(url)) return;
  await setCaption(page, "Here's the page").catch(() => {});
  const vh = (await page.evaluate(() => window.innerHeight).catch(() => 800)) || 800;
  for (let i = 0; i < 16; i++) {
    const before = await scrollTopOf(page);
    await smoothScroll(page, Math.round(vh * 0.9));   // ONE screen, gradual
    await sleep(1300);                                 // DWELL so the viewer can read this screen
    if (Math.abs((await scrollTopOf(page)) - before) < 12) break; // reached the bottom
  }
  const top = await scrollTopOf(page);
  if (top > 0) await smoothScroll(page, -top);         // gentle return to the top
  await sleep(600);
  mem.scrolledHubs.add(url);
  await setCaption(page, '').catch(() => {});
}

// Smooth-scroll through the just-opened section to reveal it (recorded).
async function showCurrent(page: Page): Promise<void> {
  await sleep(1600); // HOLD on the section so it's clearly shown in the video (recorded) even if it's short
  const vh = (await page.evaluate(() => window.innerHeight).catch(() => 800)) || 800;
  for (let i = 0; i < 2; i++) {                       // at most ~2 screens per section → keeps the video tight
    const before = await scrollTopOf(page);
    await smoothScroll(page, Math.round(vh * 0.85));  // gradual, one screen at a time
    await sleep(1100);                                 // dwell so the section is readable
    if (Math.abs((await scrollTopOf(page)) - before) < 12) break;
  }
  const top = await scrollTopOf(page);
  if (top > 0) await smoothScroll(page, -top);
  await sleep(500);
}

// Wait for client-side REDIRECTS to finish (url stops changing) so the frame doesn't detach mid-operation.
async function settleUrl(page: Page): Promise<void> {
  let last = '';
  for (let i = 0; i < 8; i++) {
    const u = page.url();
    if (u === last) { await sleep(400); return; }
    last = u; await sleep(700);
  }
}

// AI DECIDES the next action — Gemini Flash (TEXT over the DOM element list + the done-memory). No screenshot,
// no on-screen badges → fast, cheap, reliable, and zero flicker. Falls back to the deterministic pickUndone
// when the brain is unavailable. Returns a {act, mark} or null (let pickUndone handle it).
async function decideText(page: Page, marks: Mark[], mem: ExploreMemory, aiPrompt: string, wt: WaitTracker): Promise<{ act: string; mark?: Mark } | null> {
  const list = marks.map(m => `${m.id} [${m.kind}] ${m.label}`).join('\n');
  const done = memSummary(mem);
  const prompt = `You are demoing a web app by USING it. From the interactive elements below, pick the SINGLE best NEXT action that shows a real feature.
Elements (id [kind] label) — [input]=text field, [canvas]=drawing surface, [click]=button/link/section:
${list}

Already done — NEVER repeat any of these: ${done || '(nothing yet)'}.
${aiPrompt ? `User goal: ${aiPrompt}` : ''}
Rules — be a DEMO DIRECTOR, not a clicker:
- Show only the MEANINGFUL features; visit each main section once, THEN explore INSIDE that section before moving on.
- PREFER the app's standout AI / smart / suggest / generate features when present — they're the highlight.
- If several elements are REPETITIVE (e.g. 10 shape tools, a grid of cards), demo only ONE representative — never all of them.
- PRIORITY: if you have NOT drawn yet, FIRST open a canvas/editor ("New Canvas"/"Create"/"Open Editor") to reach a drawing surface and DRAW — that's the hero. Do this BEFORE secondary areas like Settings/Account.
- If a [canvas] exists and you haven't drawn yet, DRAW immediately.
- Do NOT choose "done" until you've drawn (when the app has a canvas) AND seen the main sections.
- NEVER pick log out / delete / pay / buy / checkout / password / account-settings.
Reply ONLY JSON: {"id": <element id>, "action": "click"|"type"|"draw"|"scroll"|"done", "why": "<max 4 words>"}`;
  try {
    const raw = await wt.wrap('AI deciding next step', () => brainText({ prompt, json: true, maxTokens: 120 }));
    const j: any = JSON.parse(String(raw).replace(/```json|```/g, '').trim());
    const act: string = String(j.action || '');
    if (!act || act === 'done') return null;
    if (act === 'scroll') return alreadyDone(page, mem, 'scroll') ? null : { act: 'scroll' };
    const mark = marks.find(m => m.id === Number(j.id));
    if (!mark || UNSAFE.test(mark.label) || alreadyDone(page, mem, act, mark)) return null; // invalid / unsafe / repeat
    if (act === 'type' && ACCOUNT_FIELD.test(mark.label)) return null; // NEVER type into account/credential fields
    return { act, mark };
  } catch { return null; }
}

export async function runDeepExplore(opts: DeepExploreOptions): Promise<DeepExploreResult> {
  const o = { maxSections: 8, maxDepth: 1, fps: 6, timeBudgetSec: 240, aiPrompt: '', ...opts };
  const vp = opts.viewport || { width: 1920, height: 1080 }; // adjustable full-screen recording size
  fs.mkdirSync(o.outputDir, { recursive: true });
  const framesDir = path.join(o.outputDir, 'frames-' + Date.now());
  fs.mkdirSync(framesDir, { recursive: true });

  // THREE launch modes:
  //  • ATTACH (best): connect to your REAL Chrome (start-chrome-attach.bat, port 9222) — already logged into every
  //    site, strongest anti-bot, ZERO login flow. The FillApp approach.
  //  • LOGIN: launch a visible browser with a persistent profile (fallback when not attaching).
  //  • PUBLIC: headless ephemeral browser for public sites.
  const attached = !!o.attachCdpUrl;
  let b: Browser;
  let page: Page;
  if (attached) {
    log(o, `🔗 Attaching to your real Chrome at ${o.attachCdpUrl} (already logged in)…`);
    b = await puppeteerExtra.connect({ browserURL: o.attachCdpUrl, defaultViewport: null }) as unknown as Browser;
    page = await b.newPage(); // a fresh tab in YOUR Chrome
  } else {
    // FULL-SCREEN recording at the (adjustable) viewport size — default 1920×1080.
    const profileDir = path.join(__dirname, '..', '..', 'output', 'ade-explore-profile');
    if (o.loginWait) fs.mkdirSync(profileDir, { recursive: true });
    b = await puppeteerExtra.launch({ headless: !o.loginWait, userDataDir: o.loginWait ? profileDir : undefined, defaultViewport: { width: vp.width, height: vp.height }, args: ['--no-sandbox', '--start-maximized', `--window-size=${vp.width},${vp.height}`] }) as unknown as Browser;
    page = (await b.pages())[0] || await b.newPage();
    await page.setViewport({ width: vp.width, height: vp.height });
  }

  const wt = new WaitTracker();
  let frameN = 0, recording = false, capturing = false, steps = 0;
  const t0 = Date.now();
  const overBudget = () => (Date.now() - t0) / 1000 > o.timeBudgetSec;

  // fixed-fps capture loop — single-flight; frameN only advances on SUCCESS so f%06d stays contiguous.
  const recTimer = setInterval(() => {
    if (!recording || capturing) return;
    capturing = true; const n = frameN + 1;
    page.screenshot({ path: path.join(framesDir, `f${String(n).padStart(6, '0')}.png`) as `${string}.png` })
      .then(() => { frameN = n; }).catch(() => {}).finally(() => { capturing = false; });
  }, Math.round(1000 / o.fps));

  const mem = newMemory();
  try {
    log(o, `Opening ${o.targetUrl}…`);
    await wt.wrap('navigate', async () => { await page.goto(o.targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}); });
    wt.reset(); await sleep(1200);
    await settleUrl(page); // absorb client-side redirects (e.g. vercel.com→/home) so the frame doesn't detach
    await injectOverlay(page);
    recording = true; // page is up → safe to film (screenshots hang DURING goto)

    // 1) Show the landing ONLY for PUBLIC runs. Login/attach runs go straight to login → the app first
    //    (user: "first explore then login is wrong"), then show the signed-in landing.
    if (!o.loginWait && !attached) await showLanding(page, mem);

    // 2) Login if requested — SKIPPED when attached (your real Chrome is already logged in everywhere).
    if (o.loginWait && !attached) {
      recording = false; // don't film the login (dead time, and we trim it anyway)
      let loggedIn = await isLikelyLoggedIn(page); // persisted profile? already signed in → skip login entirely
      if (loggedIn) log(o, '✅ Already signed in (persisted session).');
      if (!loggedIn && o.loginCredentials?.username) {
        log(o, '🔑 Auto-filling login…');
        await setCaption(page, 'Signing in…').catch(() => {});
        await wt.wrap('auto-login', async () => { loggedIn = await attemptAutoLogin(page, o.loginCredentials!, { screenshotDir: o.outputDir }); });
      }
      if (!loggedIn) {
        // Manual fallback (Google OAuth / CAPTCHA / no native form). ATTENDED (a human-confirm hook exists →
        // the UI "I've logged in" button can fire) → wait up to 150s. UNATTENDED (CLI / API with no human, e.g. a
        // scheduled production run) → only a brief grace for slow auth, then fall to the public tour so we NEVER
        // hang for minutes on a login nobody will complete.
        const attended = !!o.isLoggedIn && !o.unattended;
        const waitMs = attended ? 150000 : 20000;
        log(o, attended
          ? '🔐 Please log in in the opened browser, then click "I\'ve logged in".'
          : '⏳ Auto-login didn\'t confirm — waiting briefly, then will tour the public site.');
        await setCaption(page, 'Waiting for login…').catch(() => {});
        const dl = Date.now() + waitMs;
        await wt.wrap('waiting for login', async () => {
          while (Date.now() < dl && !(o.isLoggedIn?.() ?? false) && !(await isLikelyLoggedIn(page))) await sleep(1500);
        });
        loggedIn = (o.isLoggedIn?.() ?? false) || await isLikelyLoggedIn(page);
      }
      if (loggedIn) {
        log(o, '✅ Logged in.');
      } else {
        // Login never completed → NEVER emit an empty video: reset to the public site and tour that instead.
        log(o, '⚠️ Login not completed — touring the public site instead.');
        await wt.wrap('reset to public', async () => { await page.goto(o.targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}); await sleep(1200); });
        mem.scrolledHubs.clear(); // allow the public landing to be shown again
      }
      await injectOverlay(page);
      recording = true;
      await showLanding(page, mem); // show the (dashboard or public) landing once
    }

    // 3) Unified perceive → reason → act loop (generic for ANY app), memory prevents repeats.
    const maxSteps = Math.max(o.maxSections + 8, 16); // headroom so breadth + open-canvas + DRAW all fit
    const hubUrl = page.url();
    let sectionSteps = 0; // actions taken INSIDE the current section → explore-inside-then-return recursion
    for (let step = 0; step < maxSteps && !overBudget(); step++) {
      steps++;
      try {
      recording = false;                         // the decision/thinking window isn't filmed (trimmed too)
      const marks = await markInteractive(page, false); // NO visible badges → zero flicker in the live browser

      // ── DECIDE ──
      // FORCE the signature DRAW the moment we're inside an editor (canvas present) and haven't drawn — don't
      // let the brain wander past it. Otherwise AI FIRST (Gemini Flash, text + memory), then deterministic fallback.
      // A 'canvas' mark = a LARGE editor drawing surface (markInteractive only tags big ones, not decorative
      // hero canvases) → force the signature DRAW the moment we're on one and haven't drawn yet.
      const canvasMark = marks.find(m => m.kind === 'canvas');
      let pick: { act: string; mark?: Mark } | null =
        (canvasMark && !mem.drewCanvas) ? { act: 'draw', mark: canvasMark }
          : (marks.length ? await decideText(page, marks, mem, o.aiPrompt, wt) : null);
      if (!pick) pick = pickUndone(marks, mem);
      recording = true;

      if (!pick) {
        // A stale backtrack can leave us on a view with nothing new → return to the hub and try once more
        // before concluding (bounded: once back ON the hub, a second empty pick ends the run).
        if (page.url() !== hubUrl) {
          await wt.wrap('return to hub', async () => { await page.goto(hubUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); await sleep(1200); });
          await injectOverlay(page);
          continue;
        }
        if (!mem.scrolledHubs.has(page.url())) pick = { act: 'scroll' };
        else { log(o, `Done — toured ${totalActions(mem)} features in ${steps} steps.`); break; }
      }
      const act = pick.act;
      const mark = pick.mark;
      const reason = '';
      // Safety: never perform destructive actions on someone's app.
      if ((act === 'click' || act === 'type' || act === 'agent') && mark && UNSAFE.test(mark.label)) {
        mem.log.push('skipped unsafe: ' + mark.label); log(o, `Skipping sensitive "${mark.label}"`); continue;
      }

      // ── execute ──
      if (act === 'type' && mark) {
        const text = typeTextFor(mark); // clean value: 'design' for search, UNIQUE name for canvas/file fields
        await setCaption(page, reason || `⌨️  Typing "${text}"`).catch(() => {});
        const c = await centerOf(page, mark.id); if (c) await glideTo(page, c[0], c[1]);
        await page.click(`[data-demo-id="${mark.id}"]`).catch(() => {});
        await page.type(`[data-demo-id="${mark.id}"]`, text, { delay: 30 }).catch(() => {});
        await sleep(250); await page.keyboard.press('Enter').catch(() => {});
        mem.typedFields.add(mark.label.toLowerCase()); mem.log.push(`typed "${text}" in ${mark.label}`);
        log(o, `→ typed in "${mark.label}"`);
        await wt.wrap('results loading', async () => { await sleep(2200); });

      } else if (act === 'agent' && mark) {
        const text = (o.aiPrompt || 'Give me a quick summary').slice(0, 120);
        await setCaption(page, reason || '✨  Asking the app’s AI').catch(() => {});
        const c = await centerOf(page, mark.id); if (c) await glideTo(page, c[0], c[1]);
        await page.click(`[data-demo-id="${mark.id}"]`).catch(() => {});
        await page.type(`[data-demo-id="${mark.id}"]`, text, { delay: 25 }).catch(() => {});
        await sleep(250);
        if (!(await clickByText(page, ['send', 'generate', 'ask', 'run', 'submit', 'create']))) await page.keyboard.press('Enter').catch(() => {});
        mem.usedAgent = true; mem.log.push(`asked the AI: "${text}"`);
        log(o, '→ used the app AI');
        await wt.wrap('AI thinking', async () => { await sleep(4000); });

      } else if (act === 'draw') {
        await setCaption(page, reason || '✍️  Drawing on the canvas').catch(() => {});
        const c = mark ? await centerOf(page, mark.id) : null;
        const cx = c ? c[0] : 640, cy = c ? c[1] : 430;
        await glideTo(page, cx, cy); await page.mouse.click(cx, cy).catch(() => {}); // focus the canvas
        const tool = await selectDrawTool(page);
        await drawStroke(page, starPts(cx - 90, cy, 60));
        await drawStroke(page, circlePts(cx + 80, cy, 50));
        mem.drewCanvas = true; mem.log.push('drew on canvas' + (tool ? ` (${tool})` : ''));
        log(o, '→ drew on the canvas');
        await sleep(500);

      } else if (act === 'scroll') {
        await setCaption(page, reason || '↓  Scrolling through the page').catch(() => {});
        const vh = (await page.evaluate(() => window.innerHeight).catch(() => 800)) || 800;
        const before = await scrollTopOf(page);
        await smoothScroll(page, Math.round(vh * 0.85));  // gradual + readable (matches the normal recorder)
        await sleep(1200);                                 // dwell so the new screen is visible
        if (Math.abs((await scrollTopOf(page)) - before) < 12) mem.scrolledHubs.add(page.url()); // bottom → mark scrolled
        mem.log.push('scrolled');

      } else if (act === 'click' && mark) {
        await setCaption(page, reason || `👆  ${mark.label}`).catch(() => {});
        const c = await centerOf(page, mark.id); if (c) await glideTo(page, c[0], c[1]);
        await wt.wrap('open section + load', async () => {
          await page.click(`[data-demo-id="${mark.id}"]`).catch(() => {});
          await sleep(1600);
        });
        mem.visitedSections.push(mark.label.toLowerCase()); mem.log.push('opened ' + mark.label);
        log(o, `→ opened "${mark.label}"`);
        await showCurrent(page); // backtrack is handled at the loop level — AFTER we explore INSIDE this section

      } else {
        log(o, `Nothing actionable (${act}) — stopping.`); break;
      }
      // RECURSION ("explore inside exploring"): after a couple of actions INSIDE a section, return to the hub
      // for the next top-level section. Stay if we're in an editor we haven't drawn in yet.
      if (page.url() !== hubUrl) {
        const inEditor = await page.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
        sectionSteps++;
        if (sectionSteps >= 2 && !(inEditor && !mem.drewCanvas)) {
          await setCaption(page, '↩  Back').catch(() => {});
          await wt.wrap('back to hub', async () => {
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await sleep(700);
            if (page.url() !== hubUrl) { await page.goto(hubUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}); await sleep(700); }
            await settleUrl(page); await injectOverlay(page);
          });
          sectionSteps = 0;
        }
      } else sectionSteps = 0;
      await setCaption(page, '').catch(() => {});
      } catch (stepErr) {
        // A click/redirect can DETACH the frame mid-step → recover (return to hub) and keep going, never crash.
        console.warn('[DeepExplorer] step recovered:', (stepErr as Error).message);
        recording = false;
        await page.goto(hubUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await settleUrl(page); await injectOverlay(page).catch(() => {}); recording = true;
      }
    }
    log(o, `Demo done — ${totalActions(mem)} features shown in ${steps} steps.`);
  } catch (e) {
    console.warn('[DeepExplorer] run error:', (e as Error).message);
  } finally {
    recording = false;
    // let any IN-FLIGHT screenshot finish so the last frame isn't half-written (flaky ffmpeg fail otherwise)
    for (let i = 0; i < 20 && capturing; i++) await sleep(100);
    clearInterval(recTimer);
    await sleep(400);
    // ATTACH mode: close only OUR tab + disconnect — leave the user's real Chrome (and their tabs) running.
    try { if (attached) { try { await page.close(); } catch { /* */ } b.disconnect(); } else { await b.close(); } } catch { /* never leaves a zombie browser */ }
  }

  // ── Build raw video from frames, then cut the dead time ──
  const rawVideoPath = path.join(o.outputDir, `deep-explore-raw-${Date.now()}.mp4`);
  const videoPath = path.join(o.outputDir, `deep-explore-${Date.now()}.mp4`);
  const frameCount = fs.readdirSync(framesDir).filter(f => /^f\d{6}\.png$/.test(f)).length;
  if (frameCount === 0) { // nothing captured → don't crash ffmpeg; return an empty result
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* */ }
    return { videoPath: '', rawVideoPath: '', visited: mem.log, durationSec: 0, removedSec: 0, steps };
  }
  await new Promise<void>((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-framerate', String(o.fps), '-start_number', '1', '-i', path.join(framesDir, 'f%06d.png'),
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-vf', `scale=${vp.width}:-2`, '-movflags', '+faststart', rawVideoPath],
      { timeout: 300000 }, (e, _o, stderr) => e ? reject(new Error('ffmpeg compile: ' + (stderr || (e as Error).message).toString().slice(-400))) : resolve());
  });
  const cut = await cutWaitsFromVideo(rawVideoPath, wt.normalized(), videoPath, o.fps).catch(() => ({ cut: false, removedSec: 0 }));
  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* */ }

  const probe = (f: string) => new Promise<number>((res) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], (e, out) => res(e ? 0 : parseFloat((out || '').toString().trim()) || 0)));
  const durationSec = await probe(videoPath);
  return { videoPath, rawVideoPath, visited: mem.log, durationSec, removedSec: cut.removedSec || 0, steps };
}
