// Agentic task loop — "Antigravity-style" web agent.
//
// Architecture (planner + executor, the standard agentic web-automation pattern):
//   1. PLANNER (Gemini): given a natural-language goal + the site, produce a short step plan.
//   2. EXECUTOR LOOP, per step:
//        a. Inject a visual overlay into the page (blue frame + "🤖 Agent working" badge).
//        b. Label every interactive element with a numbered marker ("set-of-marks").
//        c. Screenshot the labeled page.
//        d. Gemini Vision picks the NEXT action: {action, markId?, text?, reason} as JSON.
//        e. Animate a cursor to that element, highlight it, then click / type / scroll / wait.
//        f. Re-observe. If a login / CAPTCHA wall is detected → pause via the human-in-loop gate.
//      Repeat until Gemini says action="done" or maxSteps reached.
//
// Honest limits: each step is 1 Gemini Vision call (free tier ~20/day). Real sites are messy —
// this is a proof-of-concept that completes simple goals (search, navigate, click) and pauses
// for the human on anything it can't do (login, payment, CAPTCHA). Not a finished Operator.

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';
import { visionDecide, brainChainSummary } from './vision-brain';
import { createPlan, replan, detectStall, advancePlan, type AgentPlan } from './planner';
import { recallSkills, saveSkill, skillsAsContext, domainOf } from './agent-memory';
import { markImage, type MarkRect } from './agent-marks';

puppeteerExtra.use(StealthPlugin());

const REAL_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const SHOTS_DIR = path.resolve(__dirname, '../../data/agent-shots');
const USER_DATA_DIR = path.resolve(__dirname, '../../data/agent-chrome-profile');
const MAX_STEPS_DEFAULT = 12;
const MAX_REPLANS = 2;          // how many times the planner may re-plan on a stall
// Coordinates fed to location-gated sites (default: Chennai, India). Override via env.
const AGENT_GEO = {
  latitude: Number(process.env.AGENT_GEO_LAT || 13.0827),
  longitude: Number(process.env.AGENT_GEO_LNG || 80.2707),
};
const STEP_TIMEOUT_MS = 25000;
const LOGIN_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

let aiInstance: GoogleGenAI | null = null;
let aiTried = false;
function getAI(): GoogleGenAI | null {
  if (aiTried) return aiInstance;
  aiTried = true;
  if (process.env.GEMINI_API_KEY) {
    try { aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); }
    catch (e) { console.error('[AgentTask] SDK init failed:', e); }
  }
  return aiInstance;
}

// ─── State (singleton, mirrors other agents) ─────────────────────────────────

export type AgentTaskStatus =
  | 'idle' | 'planning' | 'running' | 'waiting_for_login' | 'waiting_for_input' | 'complete' | 'error' | 'stopped';

export interface AgentStep {
  index: number;
  action: string;       // navigate | click | type | scroll | wait | done | login
  detail: string;       // human-readable description
  reason?: string;      // why the model chose this
  screenshotId?: string; // basename of the screenshot taken at this step
  timestamp: string;
}

export interface AgentTaskState {
  status: AgentTaskStatus;
  goal: string | null;
  targetUrl: string | null;
  message: string;
  steps: AgentStep[];
  plan: AgentPlan | null;        // strategic plan from the planner tier (shown live in the UI)
  brain: string;                 // the active brain chain, e.g. "gemini-flash → qwen-vl-max"
  currentScreenshotId: string | null;
  needsAttention: boolean;       // login/CAPTCHA — user must act
  userConfirmedLogin: boolean;
  // Human-in-the-loop gates for supervised tasks (e.g. ordering food):
  //   • 'select'  — the agent found options and the user must pick one
  //   • 'confirm' — the agent is about to do something irreversible (place order) and needs approval
  awaitingInput: { kind: 'select' | 'confirm' | 'credentials'; question: string; options: string[] } | null;
  userInput: string | null;      // the choice/answer the human supplied
  userCredentials: { username: string; password: string } | null;  // assisted-login (transient, never stored)
  finalAnswer: string | null;
  error: string | null;
}

class AgentTaskStore {
  private _state: AgentTaskState = this.fresh();
  private fresh(): AgentTaskState {
    return {
      status: 'idle', goal: null, targetUrl: null, message: 'Agent idle.',
      steps: [], plan: null, brain: 'none', currentScreenshotId: null, needsAttention: false,
      userConfirmedLogin: false, awaitingInput: null, userInput: null, userCredentials: null,
      finalAnswer: null, error: null,
    };
  }
  get state() { return { ...this._state, steps: [...this._state.steps] }; }
  set(p: Partial<AgentTaskState>) {
    this._state = { ...this._state, ...p };
    console.log(`[AgentTask] ${this._state.status}: ${this._state.message}`);
  }
  addStep(s: AgentStep) { this._state.steps = [...this._state.steps, s]; }
  confirmLogin() { this._state.userConfirmedLogin = true; this._state.needsAttention = false; console.log('[AgentTask] ✅ user confirmed login'); }
  // Human supplies a selection / answer, or approves an irreversible action.
  provideInput(value: string) { this._state.userInput = value; this._state.awaitingInput = null; this._state.needsAttention = false; console.log('[AgentTask] ✅ user input:', value); }
  provideCredentials(username: string, password: string) { this._state.userCredentials = { username, password }; this._state.awaitingInput = null; this._state.needsAttention = false; console.log('[AgentTask] ✅ credentials received (assisted login)'); }
  reset() { this._state = this.fresh(); }
}
export const agentTask = new AgentTaskStore();

let stopRequested = false;
export function requestAgentStop() { stopRequested = true; }

// ─── Page instrumentation (runs in page context) ─────────────────────────────
// Split into two concerns so the HUMAN never sees the AI's numbered markers:
//   • PAGE_OVERLAY: the blue "agent working" frame + animated cursor — STAYS visible.
//   • PAGE_LABEL:   red numbered markers on interactive elements — added ONLY just before
//                   the AI screenshot, then removed immediately (PAGE_UNLABEL) so the live
//                   window the user watches stays clean.

const PAGE_OVERLAY = `
(function() {
  if (!document.getElementById('ade-agent-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'ade-agent-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;border:6px solid #2563eb;box-shadow:inset 0 0 40px rgba(37,99,235,0.35);';
    const badge = document.createElement('div');
    badge.textContent = '🤖 ADE Agent is working…';
    badge.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#2563eb;color:#fff;font:700 14px Inter,system-ui,sans-serif;padding:8px 18px;border-radius:999px;box-shadow:0 6px 20px rgba(37,99,235,0.5);z-index:2147483647;pointer-events:none;';
    overlay.appendChild(badge);
    document.body.appendChild(overlay);
  }
  if (!document.getElementById('ade-agent-cursor')) {
    const cursor = document.createElement('div');
    cursor.id = 'ade-agent-cursor';
    cursor.style.cssText = 'position:fixed;width:24px;height:24px;z-index:2147483647;pointer-events:none;transition:left .5s cubic-bezier(.33,1,.68,1),top .5s cubic-bezier(.33,1,.68,1);left:50%;top:50%;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5));';
    cursor.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="#000" stroke-width="1.5"><path d="M5 2l14 7-6 2-2 6-6-15z"/></svg>';
    document.body.appendChild(cursor);
  }
})()
`;

// Adds red numbered markers + sets data-ade-id, returns the marks array. Called right before
// the AI screenshot only.
const PAGE_LABEL = `
(function() {
  document.querySelectorAll('[data-ade-marker]').forEach(e => e.remove());
  const SEL = 'a,button,input,textarea,select,[role=button],[role=link],[role=tab],[onclick]';
  const els = Array.from(document.querySelectorAll(SEL));
  const marks = [];
  let id = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    id++;
    const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('name') || el.getAttribute('value') || '').trim().slice(0, 60);
    el.setAttribute('data-ade-id', String(id));
    const m = document.createElement('div');
    m.setAttribute('data-ade-marker', String(id));
    m.textContent = String(id);
    m.style.cssText = 'position:fixed;z-index:2147483645;background:#ef4444;color:#fff;font:700 11px monospace;padding:1px 4px;border-radius:4px;pointer-events:none;left:' + Math.max(0, r.left) + 'px;top:' + Math.max(0, r.top) + 'px;';
    document.body.appendChild(m);
    marks.push({ id, label, tag: el.tagName.toLowerCase(), x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });
  }
  return marks;
})()
`;

// Removes the red markers (keeps the blue frame + cursor) so the human sees a clean page.
const PAGE_UNLABEL = `(function(){ document.querySelectorAll('[data-ade-marker]').forEach(e=>e.remove()); })()`;

// PAGE_MARKS: like PAGE_LABEL but adds NO visible markers — it just tags elements with data-ade-id and
// returns their rects (+ devicePixelRatio). The numbered boxes are drawn onto the AI's screenshot COPY
// (server-side, via agent-marks.ts), so the live window the human watches never flickers.
const PAGE_MARKS = `
(function() {
  document.querySelectorAll('[data-ade-id]').forEach(e => e.removeAttribute('data-ade-id'));
  const SEL = 'a,button,input,textarea,select,[role=button],[role=link],[role=tab],[onclick]';
  const els = Array.from(document.querySelectorAll(SEL));
  const marks = [];
  let id = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') continue;
    id++;
    const label = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || el.getAttribute('name') || el.getAttribute('value') || '').trim().slice(0, 60).replace(/\\s+/g, ' ');
    el.setAttribute('data-ade-id', String(id));
    marks.push({ id, label, tag: el.tagName.toLowerCase(),
      x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      left: Math.round(r.left), top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    if (id >= 60) break;
  }
  return { dpr: window.devicePixelRatio || 1, marks };
})()
`;

// ─── Main ────────────────────────────────────────────────────────────────────

export interface AgentTaskRequest {
  goal: string;
  targetUrl: string;
  maxSteps?: number;
  loginMode?: 'manual' | 'assisted';   // assisted = collect credentials in ADE and fill the form
}

export async function runAgentTask(req: AgentTaskRequest): Promise<AgentTaskState> {
  stopRequested = false;
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const ai = getAI();
  if (!ai) {
    agentTask.set({ status: 'error', message: 'GEMINI_API_KEY not set.', error: 'no_api_key' });
    return agentTask.state;
  }

  const maxSteps = req.maxSteps || MAX_STEPS_DEFAULT;
  let replanCount = 0;
  agentTask.reset();
  const brain = brainChainSummary();
  agentTask.set({ status: 'planning', goal: req.goal, targetUrl: req.targetUrl, brain, message: `🧠 Planning the task… (brain: ${brain})` });

  // 1. PLANNER (strategic tier) — recall what worked on this site before (skill memory), then plan.
  const recalled = recallSkills(domainOf(req.targetUrl), req.goal);
  let plan: AgentPlan | null = null;
  try {
    plan = await createPlan(req.goal, req.targetUrl, skillsAsContext(recalled));
    const memo = recalled.length ? ` (reused ${recalled.length} learned skill${recalled.length > 1 ? 's' : ''})` : '';
    agentTask.set({ plan, message: `🧠 Plan ready — ${plan.steps.length} steps${memo}.` });
    console.log('[AgentTask] Plan:', plan.steps.map(s => s.text));
  } catch (e: any) {
    console.warn('[AgentTask] Planner failed, proceeding without explicit plan:', e?.message);
  }

  let browser: Browser | null = null;
  try {
    agentTask.set({ status: 'running', message: '🌐 Opening visible Chrome...' });
    browser = await puppeteerExtra.launch({
      headless: false,
      defaultViewport: null,
      userDataDir: USER_DATA_DIR,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--start-maximized','--lang=en-US,en'],
    }) as unknown as Browser;

    const page = await browser.newPage();
    await page.setUserAgent(REAL_USER_AGENT);
    // Put the window in TRUE fullscreen so the page always fills the screen exactly — no oversizing,
    // no cut-off edges, and no fragile screen-size/DPR math (which breaks on scaled displays). Do NOT
    // call setViewport — it shrinks the page back to a small box.
    try {
      const session = await page.target().createCDPSession();
      const { windowId } = await session.send('Browser.getWindowForTarget') as any;
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
      await session.detach();
      console.log('[AgentTask] 🖥️ window set to fullscreen');
    } catch (e: any) { console.warn('[AgentTask] fullscreen failed:', e?.message); }

    // Pre-authorize geolocation so location-gated sites (Zomato, Swiggy, food/delivery, maps) show
    // content instead of a "set your location" wall. The native Chrome "Allow location?" popup is NOT
    // part of the page, so the vision agent can't click it — we grant it here + feed coordinates.
    try {
      const ctx = browser.defaultBrowserContext();
      await ctx.overridePermissions(new URL(req.targetUrl).origin, ['geolocation']);
      await page.setGeolocation(AGENT_GEO);
      console.log(`[AgentTask] 📍 geolocation granted @ ${AGENT_GEO.latitude},${AGENT_GEO.longitude}`);
    } catch (e: any) { console.warn('[AgentTask] geolocation grant failed:', e?.message); }

    await page.goto(req.targetUrl, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS });
    await sleep(2500);

    // 2. EXECUTOR LOOP
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      if (stopRequested) { agentTask.set({ status: 'stopped', message: 'Stopped by user.' }); break; }

      // Login / CAPTCHA gate (manual by default; 'assisted' fills credentials the user types into ADE)
      if (await looksLikeAuthWall(page)) {
        let resumed = false;
        if (req.loginMode === 'assisted') {
          const creds = await waitForCredentials();
          if (creds) resumed = await fillLoginForm(page, creds.username, creds.password);
          // assisted couldn't finish (e.g. OTP site has no password field) → fall through to manual
        }
        if (!resumed) {
          const ok = await waitForLoginConfirm();
          if (!ok) { agentTask.set({ status: 'error', message: '⏰ Login wait timed out.', error: 'login_timeout' }); break; }
        }
        await sleep(1500);
      }

      // Keep the blue frame + cursor visible (persistent, no red numbers for the human).
      try { await page.evaluate(PAGE_OVERLAY); } catch { /* page navigating */ }

      // (a) Tag interactive elements — NO visible markers (returns rects + devicePixelRatio).
      let marks: Array<{ id: number; label: string; tag: string; x: number; y: number; left: number; top: number; w: number; h: number }> = [];
      let dpr = 1;
      try { const res: any = await page.evaluate(PAGE_MARKS); marks = res?.marks || []; dpr = res?.dpr || 1; } catch { /* page navigating */ }

      // (b) ONE clean screenshot — shown to the human AND the base for the AI's marked copy.
      const cleanId = `agent-${Date.now()}-${stepIndex}`;
      const cleanPath = path.join(SHOTS_DIR, `${cleanId}.png`);
      try { await page.screenshot({ path: cleanPath as `${string}.png` }); } catch { /* ignore */ }
      agentTask.set({ currentScreenshotId: cleanId, message: `👁️ Step ${stepIndex + 1}: deciding next action...` });

      // (c) Draw the numbered markers onto a COPY for the AI only → live window stays clean (no flicker).
      const shotPath = await markImage(cleanPath, marks as MarkRect[], dpr);

      // Ask the vision brain (Gemini → Qwen/GLM fallback) for the next action.
      const planSteps = plan ? plan.steps.map(s => s.text) : [];
      const lastInput = agentTask.state.userInput;
      const decision = await decideNextAction(ai, req.goal, planSteps, page.url(), marks, shotPath, agentTask.state.steps, lastInput);
      if (lastInput) agentTask.set({ userInput: null });   // consumed — don't re-inject next time
      console.log(`[AgentTask] Step ${stepIndex + 1} decision (via ${decision.provider}):`, decision);

      // The marked copy was for the AI only — delete it; keep the clean one for the UI.
      if (shotPath !== cleanPath) { try { fs.unlinkSync(shotPath); } catch { /* ignore */ } }

      const step: AgentStep = {
        index: stepIndex,
        action: decision.action,
        detail: describeAction(decision, marks),
        reason: decision.reason,
        screenshotId: cleanId,
        timestamp: new Date().toISOString(),
      };
      agentTask.addStep(step);
      agentTask.set({ message: `▶️ ${step.detail}` });

      // Execute
      if (decision.action === 'done') {
        if (plan) { plan = { ...plan, steps: plan.steps.map(s => ({ ...s, status: 'done' as const })) }; agentTask.set({ plan }); }
        // Skill memory: remember the action sequence that worked, so next time is faster + surer.
        try {
          const actions = agentTask.state.steps.filter(s => s.action !== 'wait' && s.action !== 'done').map(s => s.detail);
          if (actions.length) saveSkill({ domain: domainOf(req.targetUrl), goal: req.goal, steps: actions });
        } catch { /* ignore */ }
        agentTask.set({ status: 'complete', message: '✅ Task complete.', finalAnswer: decision.text || 'Done.' });
        break;
      }

      // Human-in-the-loop gate: the agent needs the user to CHOOSE an option.
      if (decision.action === 'ask_user') {
        const answer = await waitForUserInput('select', decision.text || 'Please choose an option.', marks);
        if (answer === null) { agentTask.set({ status: 'error', message: '⏰ Timed out waiting for your choice.', error: 'input_timeout' }); break; }
        continue; // re-observe; next decision sees the user's choice
      }
      // Human-in-the-loop gate: approve an irreversible / payment action before it happens.
      if (decision.action === 'confirm') {
        const ok = await waitForUserInput('confirm', decision.text || 'Approve this action?', []);
        if (ok === null) { agentTask.set({ status: 'error', message: '⏰ Timed out waiting for your approval.', error: 'confirm_timeout' }); break; }
        continue; // re-observe; next decision proceeds now that it's approved
      }

      await executeAction(page, decision, marks);
      await sleep(1800); // let the page settle

      // Plan bookkeeping: advance the active step after a real (non-wait) action.
      if (plan && decision.action !== 'wait') {
        plan = advancePlan(plan);
        agentTask.set({ plan });
      }

      // Stall detection → strategic re-plan (corrects the course without a human).
      if (plan && replanCount < MAX_REPLANS &&
          detectStall(agentTask.state.steps.map(s => ({ action: s.action, detail: s.detail })))) {
        replanCount++;
        agentTask.set({ message: `🔁 Stuck — re-planning (revision ${replanCount})…` });
        try {
          plan = await replan({
            goal: req.goal,
            targetUrl: req.targetUrl,
            currentUrl: page.url(),
            completedSteps: agentTask.state.steps.map(s => s.detail),
            reason: 'Agent repeated the same action or waited repeatedly without progress.',
            previousRevision: plan.revision,
          });
          agentTask.set({ plan, message: `🧠 New plan — ${plan.steps.length} steps.` });
        } catch (e: any) {
          console.warn('[AgentTask] Replan failed:', e?.message);
        }
      }
    }

    if (agentTask.state.status === 'running') {
      agentTask.set({ status: 'complete', message: `Reached step limit (${maxSteps}). Stopping.`, finalAnswer: 'Reached max steps.' });
    }
  } catch (err: any) {
    agentTask.set({ status: 'error', message: `❌ ${err?.message || err}`, error: String(err?.message || err) });
  } finally {
    // Leave the browser open briefly on success so the user sees the result, then close.
    if (browser) {
      try { await sleep(2000); await browser.close(); } catch { /* ignore */ }
    }
  }

  return agentTask.state;
}

// ─── Decider (vision) ────────────────────────────────────────────────────────

interface Decision { action: string; markId?: number; text?: string; reason?: string; provider?: string; }

// Decision is delegated to the swappable vision-brain (Gemini → Qwen/GLM fallback).
async function decideNextAction(
  _ai: GoogleGenAI | null, goal: string, plan: string[], currentUrl: string,
  marks: Array<{ id: number; label: string; tag: string }>,
  shotPath: string, priorSteps: AgentStep[], lastUserInput: string | null,
): Promise<Decision> {
  const marksList = marks.map(m => `[${m.id}] <${m.tag}> ${m.label || '(no label)'}`).join('\n').slice(0, 6000);
  const history = priorSteps.slice(-5).map(s => `- ${s.action}: ${s.detail}`).join('\n') || '(none yet)';
  const userSaid = lastUserInput
    ? `\n⭐ THE USER JUST RESPONDED: "${lastUserInput}" — honor this now (click the option they chose, or proceed because they approved).\n`
    : '';

  const prompt = `You are a careful web agent controlling a real browser. Decide the SINGLE next action toward the goal.

GOAL: ${goal}
CURRENT URL: ${currentUrl}
PLAN (guidance, not rigid):
${plan.map((p, i) => `${i + 1}. ${p}`).join('\n') || '(no plan)'}

ACTIONS ALREADY TAKEN:
${history}
${userSaid}
The screenshot shows the page with numbered RED markers on interactive elements:
${marksList}

Reply with ONE JSON object, no markdown:
{"action":"click|type|scroll|wait|ask_user|confirm|done","markId":<number for click/type>,"text":"<text to type | question to ask | what you will confirm | final answer>","reason":"<short why>"}

Rules:
- "click": set markId to the element's number.
- "type": set markId (the input) AND text. (We auto-press Enter after typing into search-like inputs.)
- "scroll": scrolls down to reveal more.
- "wait": page still loading.
- "ask_user": when the USER must choose between options (which restaurant / dish / variant / address), put a clear question in "text". NEVER guess such choices for them.
- "confirm": BEFORE any irreversible or payment action (place order, pay, submit, delete), put exactly what you are about to do in "text" and wait for approval. For payment ALWAYS prefer Cash on Delivery (COD).
- "done": the goal is achieved — short result summary in "text".
- SAFETY: never place an order or pay without first using "confirm" and getting the user's approval. Prefer the fewest steps.`;

  const decision = await visionDecide({ prompt, imagePath: shotPath });
  return { action: decision.action, markId: decision.markId, text: decision.text, reason: decision.reason, provider: decision._provider };
}

// ─── Executor ────────────────────────────────────────────────────────────────

async function executeAction(page: Page, d: Decision, marks: Array<{ id: number; x: number; y: number }>): Promise<void> {
  const target = d.markId != null ? marks.find(m => m.id === d.markId) : undefined;

  // Animate the on-page cursor + highlight the target before acting
  if (target) {
    await page.evaluate((x, y) => {
      const c = document.getElementById('ade-agent-cursor');
      if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
      const marker = document.querySelector('[data-ade-id="' + (window as any).__adeTargetId + '"]');
    }, target.x, target.y).catch(() => {});
    // Highlight the actual element
    await page.evaluate((id) => {
      const el = document.querySelector('[data-ade-id="' + id + '"]') as HTMLElement | null;
      if (el) { el.style.outline = '4px solid #22c55e'; el.style.outlineOffset = '2px'; el.scrollIntoView({ block: 'center' }); }
    }, d.markId).catch(() => {});
    await sleep(700);
  }

  try {
    if (d.action === 'click' && target) {
      await page.mouse.click(target.x, target.y, { delay: 60 });
    } else if (d.action === 'type' && target) {
      await page.mouse.click(target.x, target.y, { delay: 60 });
      await sleep(300);
      if (d.text) await page.keyboard.type(d.text, { delay: 40 });
      await sleep(400);
      await page.keyboard.press('Enter').catch(() => {});
    } else if (d.action === 'scroll') {
      await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.8)));
    } else if (d.action === 'wait') {
      await sleep(2000);
    }
  } catch (e) {
    console.warn('[AgentTask] executeAction failed:', e);
  }
}

// ─── Auth-wall detection + login gate ────────────────────────────────────────

async function looksLikeAuthWall(page: Page): Promise<boolean> {
  try {
    const url = page.url().toLowerCase();
    if (/\/login|\/signin|\/sign-in|\/auth|accounts\.|\/sessions\/new/.test(url)) return true;
    return await page.evaluate(() => {
      const hasPw = !!document.querySelector('input[type=password]');
      const txt = (document.body?.innerText || '').toLowerCase();
      const captcha = txt.includes('are you a robot') || txt.includes('verify you are human') || !!document.querySelector('iframe[src*=recaptcha],iframe[src*=hcaptcha]');
      // OTP / login-modal heuristics (e.g. Zomato logs in via phone + OTP, no password field)
      const otp = /\b(otp|one[- ]time password|verification code|enter the code|verify your (mobile|phone|number))\b/.test(txt);
      const loginPrompt = /(log ?in to continue|login to continue|please log ?in|sign ?in to (order|continue|checkout))/.test(txt);
      const phoneInput = !!document.querySelector('input[type=tel]');
      return hasPw || captcha || otp || (loginPrompt && phoneInput);
    });
  } catch { return false; }
}

async function waitForLoginConfirm(): Promise<boolean> {
  agentTask.set({ status: 'waiting_for_login', needsAttention: true, message: '🔐 Login / CAPTCHA detected. Please complete it in the Chrome window, then click "I\'ve logged in — continue".' });
  const start = Date.now();
  while (Date.now() - start < LOGIN_WAIT_TIMEOUT_MS) {
    if (stopRequested) return false;
    if (agentTask.state.userConfirmedLogin) {
      agentTask.set({ status: 'running', needsAttention: false, userConfirmedLogin: false, message: '✅ Login confirmed — resuming.' });
      return true;
    }
    await sleep(2000);
  }
  return false;
}

// Pause and wait for the human to make a choice ('select') or approve an action ('confirm').
// Returns the user's value, or null on timeout/stop.
async function waitForUserInput(kind: 'select' | 'confirm', question: string, marks: Array<{ label: string }>): Promise<string | null> {
  const options = kind === 'select' ? marks.map(m => m.label).filter(Boolean).slice(0, 12) : [];
  agentTask.set({
    status: 'waiting_for_input',
    needsAttention: true,
    awaitingInput: { kind, question, options },
    message: kind === 'confirm' ? `🔔 Approve to continue: ${question}` : `🙋 ${question}`,
  });
  const start = Date.now();
  while (Date.now() - start < LOGIN_WAIT_TIMEOUT_MS) {
    if (stopRequested) return null;
    const v = agentTask.state.userInput;
    if (v != null) {
      agentTask.set({ status: 'running', needsAttention: false, awaitingInput: null, message: kind === 'confirm' ? '✅ Approved — continuing.' : `✅ You chose: ${v}` });
      return v;   // left in state.userInput so the next decision can read it
    }
    await sleep(1500);
  }
  return null;
}

// Assisted login: wait for the user to type credentials into ADE (transient, never stored).
async function waitForCredentials(): Promise<{ username: string; password: string } | null> {
  agentTask.set({
    status: 'waiting_for_input', needsAttention: true,
    awaitingInput: { kind: 'credentials', question: 'Enter your login for this site (used once, never stored).', options: [] },
    message: '🔐 Enter your login in ADE to continue.',
  });
  const start = Date.now();
  while (Date.now() - start < LOGIN_WAIT_TIMEOUT_MS) {
    if (stopRequested) return null;
    if (agentTask.state.userCredentials) {
      const c = agentTask.state.userCredentials;
      agentTask.set({ status: 'running', needsAttention: false, awaitingInput: null, userCredentials: null, message: '🔐 Filling your login…' });
      return c;
    }
    await sleep(1500);
  }
  return null;
}

// Best-effort: fill the visible username/password fields and submit. Returns true only if a PASSWORD
// field was filled (a full login). If only a phone field exists (OTP site), returns false so the caller
// falls back to manual (the user completes the OTP themselves).
async function fillLoginForm(page: Page, username: string, password: string): Promise<boolean> {
  try {
    const filled: any = await page.evaluate((u: string, p: string) => {
      const vis = (el: any) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const pick = (sel: string) => (Array.from(document.querySelectorAll(sel)) as any[]).find(vis);
      const setVal = (el: any, v: string) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      const uEl = pick('input[type=email],input[type=tel],input[autocomplete=username],input[name*=user],input[name*=email],input[name*=phone],input[id*=user],input[id*=email],input[type=text]');
      const pEl = pick('input[type=password]');
      if (uEl) setVal(uEl, u);
      if (pEl) setVal(pEl, p);
      return { hasUser: !!uEl, hasPass: !!pEl };
    }, username, password);
    if (!filled.hasUser && !filled.hasPass) return false;
    await sleep(400);
    await page.keyboard.press('Enter').catch(() => {});
    await sleep(1500);
    return !!filled.hasPass;
  } catch (e) { console.warn('[AgentTask] fillLoginForm failed:', e); return false; }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function describeAction(d: Decision, marks: Array<{ id: number; label: string }>): string {
  const label = d.markId != null ? (marks.find(m => m.id === d.markId)?.label || `element #${d.markId}`) : '';
  switch (d.action) {
    case 'click': return `Click "${label}"`;
    case 'type': return `Type "${d.text}" into "${label}"`;
    case 'scroll': return 'Scroll down';
    case 'wait': return 'Wait for page';
    case 'ask_user': return `🙋 Asking you: ${d.text || 'choose an option'}`;
    case 'confirm': return `🔔 Awaiting your approval: ${d.text || 'action'}`;
    case 'done': return `Done — ${d.text || 'goal reached'}`;
    default: return d.action;
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
