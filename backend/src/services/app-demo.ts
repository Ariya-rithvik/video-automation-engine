// ════════════════════════════════════════════════════════════════════════════
// APP DEMO — generic "AI hands" that DEMONSTRATE any web app (not a per-app script).
//
// Loop: perceive (screenshot + numbered marks of buttons/links AND text fields AND
// canvases) → reason (the free vision brain picks ONE action to show a feature:
// TYPE a realistic query, CLICK a result/feature, DRAW if it's a canvas, SCROLL,
// or DONE) → act (ghost hand does it) → caption it. Records at fixed fps; every
// wait (loads, the app's own AI thinking) is logged + trimmed from the final video.
// Brain = Gemini→Groq free vision chain. Safety: never logout/delete/pay/buy.
// ════════════════════════════════════════════════════════════════════════════

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { visionDecide } from './vision-brain';
import { WaitTracker, cutWaitsFromVideo } from './wait-tracker';

puppeteerExtra.use(StealthPlugin());

export interface AppDemoOptions {
  targetUrl: string;
  outputDir: string;
  loginWait?: boolean;
  isLoggedIn?: () => boolean;
  onStatus?: (msg: string) => void;
  fps?: number;
  timeBudgetSec?: number;
  maxSteps?: number;
  aiPrompt?: string;          // hint for what to type when the app has an AI/search box
}
export interface AppDemoResult {
  videoPath: string; rawVideoPath: string; durationSec: number; removedSec: number; did: string[];
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const log = (o: AppDemoOptions, m: string) => { console.log('[AppDemo] ' + m); o.onStatus?.(m); };
// Actions we must never perform on someone's app.
export const UNSAFE = /log ?out|sign ?out|delete|remove|trash|\bpay\b|buy|checkout|purchase|place order|unsubscribe|deactivate|cancel|update ?password|change ?password|update ?profile|update ?email|update ?account|save changes|old password|new password/i;

// ── In-page overlay (ghost cursor + caption). ──
export async function injectOverlay(page: Page) {
  await page.evaluate(() => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div'); c.id = '__demo_cursor';
    // A REAL-looking mouse pointer (black arrow, white outline) — not a glowing dot. Tip is the hotspot.
    c.innerHTML = '<svg width="20" height="20" viewBox="0 0 32 32" style="display:block"><path d="M10.9999 5.5L25.4999 18L16.4999 19L19.4999 26.5L15.9999 28L12.4999 20L6.4999 24V5.5Z" fill="#0b0b0c" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', zIndex: '2147483647', width: '20px', height: '20px', left: '50%', top: '50%',
      marginLeft: '-7px', marginTop: '-3px', pointerEvents: 'none', transformOrigin: '7px 3px', transform: 'scale(1)',
      transition: 'left .05s linear, top .05s linear, transform .08s ease', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.4))' } as any);
    document.body.appendChild(c);
    const cap = document.createElement('div'); cap.id = '__demo_cap';
    Object.assign(cap.style, { position: 'fixed', zIndex: '2147483646', left: '50%', bottom: '26px', transform: 'translateX(-50%)',
      maxWidth: '84%', padding: '10px 20px', borderRadius: '999px', background: 'rgba(10,14,22,.82)', color: '#fff',
      font: '600 16px Inter, system-ui, sans-serif', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.15)',
      boxShadow: '0 8px 30px rgba(0,0,0,.5)', opacity: '0', transition: 'opacity .3s', pointerEvents: 'none', textAlign: 'center' } as any);
    document.body.appendChild(cap);
  }).catch(() => {});
}
export const setCaption = (page: Page, t: string) => page.evaluate((x) => { const e = document.getElementById('__demo_cap'); if (e) { e.textContent = x; (e as HTMLElement).style.opacity = x ? '1' : '0'; } }, t).catch(() => {});
export const moveCursor = (page: Page, x: number, y: number) => page.evaluate((px, py) => { const e = document.getElementById('__demo_cursor'); if (e) { (e as HTMLElement).style.left = px + 'px'; (e as HTMLElement).style.top = py + 'px'; } }, x, y).catch(() => {});
export const pressCursor = (page: Page, d: boolean) => page.evaluate((x) => {
  const e = document.getElementById('__demo_cursor'); if (!e) return;
  (e as HTMLElement).style.transform = `scale(${x ? 0.82 : 1})`;   // press = shrink a touch (real click feel)
  if (x) {                                                          // click ripple for realism
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', zIndex: '2147483646', left: (e as HTMLElement).style.left, top: (e as HTMLElement).style.top,
      width: '8px', height: '8px', marginLeft: '-4px', marginTop: '-2px', borderRadius: '50%', border: '2px solid rgba(120,180,255,.95)',
      pointerEvents: 'none', transition: 'all .45s ease', opacity: '1' } as any);
    document.body.appendChild(r);
    requestAnimationFrame(() => { Object.assign(r.style, { width: '36px', height: '36px', marginLeft: '-18px', marginTop: '-16px', opacity: '0' } as any); });
    setTimeout(() => r.remove(), 480);
  }
}, d).catch(() => {});

export async function glideTo(page: Page, x: number, y: number, steps = 14) {
  const cur = await page.evaluate(() => { const e = document.getElementById('__demo_cursor'); return e ? [parseFloat((e as HTMLElement).style.left) || 640, parseFloat((e as HTMLElement).style.top) || 400] : [640, 400]; }).catch(() => [640, 400]) as number[];
  for (let i = 1; i <= steps; i++) { const nx = cur[0] + (x - cur[0]) * i / steps, ny = cur[1] + (y - cur[1]) * i / steps; await moveCursor(page, nx, ny); await page.mouse.move(nx, ny); await sleep(16); }
}
export async function drawStroke(page: Page, pts: [number, number][]) {
  if (!pts.length) return;
  await glideTo(page, pts[0][0], pts[0][1]); await pressCursor(page, true); await page.mouse.down(); await sleep(60);
  for (let i = 1; i < pts.length; i++) { await moveCursor(page, pts[i][0], pts[i][1]); await page.mouse.move(pts[i][0], pts[i][1], { steps: 2 }); await sleep(14); }
  await page.mouse.up(); await pressCursor(page, false); await sleep(120);
}
// Canvas apps default to a SELECT tool — pick a pen/shape tool so strokes register.
export async function selectDrawTool(page: Page): Promise<string> {
  const clicked = await page.evaluate(() => {
    // a real freedraw/shape TOOL — not a toggle like "keep tool active after drawing" (lock).
    const want = /\b(freedraw|pencil|pen|brush|marker|draw|rectangle|ellipse|oval)\b/i;
    const skip = /(lock|keep|active|after|library|colou?r|stroke|background|delete|zoom|undo|redo|hand|reset|menu|share|collaborat|export|image|frame|laser|text|eraser|arrow)/i;
    // 1) known tool ids/labels first (excalidraw/tldraw): title/aria starts with the tool name.
    const known = ['[data-testid="toolbar-freedraw"]', '[data-testid="toolbar-pencil"]',
      '[title^="Draw"]', '[title^="Pencil"]', '[title^="Pen"]', '[aria-label^="Draw"]',
      '[aria-label^="Pencil"]', '[aria-label^="Pen"]', '[data-testid="toolbar-rectangle"]', '[title^="Rectangle"]'];
    for (const sel of known) {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (el && el.getBoundingClientRect().width > 0) { el.click(); return (el.getAttribute('title') || el.getAttribute('aria-label') || sel).slice(0, 28); }
    }
    // 2) generic scan, skipping lock/colour/etc. toggles.
    const els = Array.from(document.querySelectorAll('button,[role="button"],[role="radio"],[aria-label],[title],[data-tool],[data-testid]')) as HTMLElement[];
    for (const el of els) {
      const t = (el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('data-tool') || el.getAttribute('data-testid') || el.textContent || '').replace(/\s+/g, ' ').trim();
      const r = el.getBoundingClientRect();
      if (want.test(t) && !skip.test(t) && r.width > 0 && r.height > 0 && r.width < 120 && r.top < 140) { el.click(); return t.slice(0, 28); }
    }
    return '';
  }).catch(() => '');
  if (clicked) { await sleep(250); return clicked; }
  // keyboard fallbacks: excalidraw 7=freedraw, tldraw d, generic p (canvas must be focused first)
  for (const k of ['7', 'p', 'd']) { await page.keyboard.press(k as any).catch(() => {}); await sleep(110); }
  return 'pen';
}

export const starPts = (cx: number, cy: number, R: number): [number, number][] => { const p: [number, number][] = []; for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; p.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); } return p; };
export const circlePts = (cx: number, cy: number, r: number, n = 40): [number, number][] => { const p: [number, number][] = []; for (let i = 0; i <= n; i++) { const a = i / n * 2 * Math.PI - Math.PI / 2; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };

export interface Mark { id: number; kind: 'input' | 'click' | 'canvas'; label: string; }

// ── Number the interactive things on screen (inputs + clickables + canvas). ──
export async function markInteractive(page: Page, showBadges = true): Promise<Mark[]> {
  return page.evaluate((badges: boolean) => {
    document.querySelectorAll('[data-demo-badge]').forEach(b => b.remove());
    document.querySelectorAll('[data-demo-id]').forEach(e => e.removeAttribute('data-demo-id'));
    const vis = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 20 && r.height > 12 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.1; };
    const out: { id: number; kind: string; label: string }[] = []; let id = 0; const seen = new Set<string>();
    const add = (el: Element, kind: string, label: string) => {
      // Strip a leading Material-icon ligature glued to the text ("add_boxNew Canvas" -> "New Canvas",
      // "grid_viewMy Canvases" -> "My Canvases") so dedup + captions are clean and repeats are caught.
      // Strip Material-icon ligatures glued to the text: underscore form ("add_boxNew Canvas") AND the
      // Material-Symbols form where a lowercase icon name is glued before the Capitalized label
      // ("homeHome"→"Home", "settingsSettings"→"Settings", "logoutLogout"→"Logout").
      label = (label || '').replace(/^\s*[a-z]+(?:_[a-z]+)+\s*/, '').replace(/^[a-z]{2,20}(?=[A-Z])/, '').replace(/\s+/g, ' ').trim();
      if (id >= 22 || !label || label.length < 2 || !vis(el)) return;
      const key = kind + '|' + label.toLowerCase(); if (seen.has(key)) return; seen.add(key); id++;
      el.setAttribute('data-demo-id', String(id));
      if (badges) { // visible numbered badge — ONLY when an image model needs to map numbers→positions.
        const r = el.getBoundingClientRect();         // Skipped in DOM/text-decision mode → no on-screen flicker.
        const b = document.createElement('div'); b.setAttribute('data-demo-badge', '1'); b.textContent = String(id);
        Object.assign(b.style, { position: 'fixed', left: Math.max(0, Math.min(innerWidth - 22, r.left)) + 'px', top: Math.max(0, Math.min(innerHeight - 16, r.top)) + 'px',
          zIndex: '2147483646', background: kind === 'input' ? '#0a84ff' : kind === 'canvas' ? '#30d158' : '#ff2d55', color: '#fff', font: '700 12px monospace', padding: '1px 5px', borderRadius: '6px', pointerEvents: 'none' } as any);
        document.body.appendChild(b);
      }
      out.push({ id, kind, label: label.replace(/\s+/g, ' ').trim().slice(0, 42) });
    };
    for (const el of Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=password]), textarea, [contenteditable="true"]')))
      add(el, 'input', (el.getAttribute('placeholder') || el.getAttribute('aria-label') || (el as HTMLInputElement).name || 'text field'));
    for (const el of Array.from(document.querySelectorAll('canvas, [class*="canvas" i], [class*="whiteboard" i]'))) {
      const r = el.getBoundingClientRect(); // a REAL editor surface fills most of the screen — not a small hero/preview canvas
      if (r.width > innerWidth * 0.5 && r.height > innerHeight * 0.4) add(el, 'canvas', 'drawing canvas');
    }
    for (const el of Array.from(document.querySelectorAll('a[href],button,[role="button"],[role="tab"],[role="menuitem"],[class*="card" i]')))
      add(el, 'click', (el.textContent || el.getAttribute('aria-label') || ''));
    return out;
  }, showBadges) as Promise<Mark[]>;
}
export const clearMarks = (page: Page) => page.evaluate(() => document.querySelectorAll('[data-demo-badge]').forEach(b => b.remove())).catch(() => {});
export const centerOf = (page: Page, id: number) => page.evaluate((i) => { const el = document.querySelector(`[data-demo-id="${i}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width, r.height]; }, id).catch(() => null) as Promise<number[] | null>;

export async function runAppDemo(opts: AppDemoOptions): Promise<AppDemoResult> {
  const o = { fps: 7, timeBudgetSec: 150, maxSteps: 9, aiPrompt: '', ...opts };
  fs.mkdirSync(o.outputDir, { recursive: true });
  const framesDir = path.join(o.outputDir, 'demo-frames-' + Date.now());
  fs.mkdirSync(framesDir, { recursive: true });

  const b = await puppeteerExtra.launch({ headless: !o.loginWait, defaultViewport: { width: 1280, height: 800 }, args: ['--no-sandbox'] }) as unknown as Browser;
  const page = (await b.pages())[0] || await b.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const wt = new WaitTracker();
  let frameN = 0, recording = false, capturing = false;
  const recTimer = setInterval(() => {
    if (!recording || capturing) return; capturing = true; const n = frameN + 1;
    page.screenshot({ path: path.join(framesDir, `f${String(n).padStart(6, '0')}.png`) as `${string}.png` })
      .then(() => { frameN = n; }).catch(() => {}).finally(() => { capturing = false; });
  }, Math.round(1000 / o.fps));

  const did: string[] = [];
  const t0 = Date.now();
  const overBudget = () => (Date.now() - t0) / 1000 > o.timeBudgetSec;
  try {
    log(o, `Opening ${o.targetUrl}…`);
    await wt.wrap('navigate', async () => { await page.goto(o.targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {}); });
    wt.reset(); await sleep(800);
    await injectOverlay(page);
    recording = true; // page loaded → film the opening from the very START (capture hangs only DURING goto)
    await setCaption(page, 'Opening the app…');
    await sleep(2000); // record the app's opening / hero reveal so the video shows the start, not just login
    await setCaption(page, '');

    if (o.loginWait) {
      recording = false; // pause ONLY for the manual login — keeps the visible browser smooth, and the
      await setCaption(page, 'Waiting for login…'); //  dead login time is cut from the final video anyway
      const dl = Date.now() + 300000;
      await wt.wrap('waiting for human login', async () => { while (Date.now() < dl && !(o.isLoggedIn?.() ?? false)) await sleep(1500); });
      await injectOverlay(page);
      recording = true; // login done → resume filming the actual demo
    }

    // ── perceive → reason → act loop (generic for ANY app) ──
    for (let step = 0; step < o.maxSteps && !overBudget(); step++) {
      recording = false;                       // hide the numbered badges from the film
      const marks = await markInteractive(page);
      const shot = path.join(framesDir, `_d_${step}.png`);
      let decision: any = { action: 'done' };
      if (marks.length) {
        await page.screenshot({ path: shot as `${string}.png` }).catch(() => {});
        const list = marks.map(m => `${m.id}[${m.kind}]: ${m.label}`).join('\n');
        const prompt = `You are giving a friendly screen-recorded DEMO of this web app — show how it works by USING it.
Numbered badges mark things you can use — [input]=a text field you can TYPE in, [canvas]=a drawing surface, [click]=a button/link.
Already done this demo: ${did.length ? did.join(' | ') : '(nothing yet)'}.
On screen:\n${list}\n
Pick the SINGLE best next action to demonstrate a real feature (vary it — don't repeat what's done):
- {"action":"type","markId":N,"text":"<a realistic value to show, e.g. a search query>","reason":"short caption"}  (then Enter)
- {"action":"click","markId":N,"reason":"short caption"}
- {"action":"draw","markId":N,"reason":"short caption"}   (only if a [canvas] exists)
- {"action":"scroll","reason":"short caption"}
- {"action":"done","reason":"short caption"}   (once the main features are shown)
NEVER choose log out, delete, remove, pay, buy, checkout, or anything destructive. Reply ONLY the JSON.`;
        decision = await wt.wrap('vision: decide next action', () => visionDecide({ prompt, imagePath: shot }));
      }
      await clearMarks(page); recording = true;

      const reason = (decision.reason || '').toString().slice(0, 90);
      const mark = marks.find(m => m.id === decision.markId);
      const act = decision.action;

      if (act === 'done' || (!mark && act !== 'scroll' && act !== 'draw')) { log(o, `Demo done (${reason}).`); break; }
      if ((act === 'click' || act === 'type') && mark && UNSAFE.test(mark.label)) { did.push('skipped unsafe: ' + mark.label); log(o, `Skipping sensitive "${mark.label}"`); continue; }

      if (act === 'type' && mark) {
        const text = (decision.text || o.aiPrompt || 'hello').toString().slice(0, 80);
        await setCaption(page, reason || `⌨️  Typing "${text}"`);
        const c = await centerOf(page, mark.id); if (c) await glideTo(page, c[0], c[1]);
        await pressCursor(page, true); await page.click(`[data-demo-id="${mark.id}"]`).catch(() => {}); await pressCursor(page, false);
        await page.type(`[data-demo-id="${mark.id}"]`, text, { delay: 30 }).catch(() => {});
        await sleep(250); await page.keyboard.press('Enter').catch(() => {});
        did.push(`typed "${text}" in ${mark.label}`);
        await wt.wrap('results loading', async () => { await sleep(2200); });
      } else if (act === 'draw') {
        await setCaption(page, reason || '✍️  Drawing on the canvas');
        const c = mark ? await centerOf(page, mark.id) : null;
        const cx = c ? c[0] : 640, cy = c ? c[1] : 430;
        await glideTo(page, cx, cy); await page.mouse.click(cx, cy).catch(() => {}); // focus the canvas
        const tool = await selectDrawTool(page);                                    // pick a pen/shape tool
        await drawStroke(page, starPts(cx - 90, cy, 60));
        await drawStroke(page, circlePts(cx + 80, cy, 50));
        did.push('drew on canvas' + (tool ? ` (${tool})` : ''));
        await sleep(500);
      } else if (act === 'scroll') {
        await setCaption(page, reason || '↓  Scrolling through the page');
        await page.evaluate(() => window.scrollBy({ top: Math.round(innerHeight * 0.8), behavior: 'smooth' })).catch(() => {});
        did.push('scrolled');
        await sleep(900);
      } else if (act === 'click' && mark) {
        await setCaption(page, reason || `👆  ${mark.label}`);
        const c = await centerOf(page, mark.id); if (c) await glideTo(page, c[0], c[1]);
        await pressCursor(page, true);
        await wt.wrap('action + load', async () => { await page.click(`[data-demo-id="${mark.id}"]`).catch(() => {}); await sleep(1800); });
        await pressCursor(page, false);
        did.push('clicked ' + mark.label);
        await injectOverlay(page); // in case it navigated
      }
      await sleep(500);
    }

    await setCaption(page, '✦  Made with AI hands');
    await sleep(1800); await setCaption(page, '');
    log(o, `Demo done — ${did.length} actions.`);
  } finally {
    recording = false; clearInterval(recTimer); await sleep(300);
    try { await b.close(); } catch { /* */ }
  }

  log(o, `captured ${frameN} frames @ ${o.fps}fps`);
  if (frameN < 2) throw new Error(`app-demo captured no frames (${frameN})`);
  const rawVideoPath = path.join(o.outputDir, `app-demo-raw-${Date.now()}.mp4`);
  const videoPath = path.join(o.outputDir, `app-demo-${Date.now()}.mp4`);
  await new Promise<void>((resolve, reject) => {
    execFile('ffmpeg', ['-y', '-framerate', String(o.fps), '-start_number', '1', '-i', path.join(framesDir, 'f%06d.png'),
      '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-vf', 'scale=1280:-2', '-movflags', '+faststart', rawVideoPath],
      { timeout: 300000 }, (e) => e ? reject(new Error('ffmpeg: ' + e.message)) : resolve());
  });
  const cut = await cutWaitsFromVideo(rawVideoPath, wt.normalized(), videoPath, o.fps).catch(() => ({ cut: false, removedSec: 0 }));
  try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch { /* */ }
  const probe = (f: string) => new Promise<number>((res) => execFile('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], (e, out) => res(e ? 0 : parseFloat((out || '').toString().trim()) || 0)));
  return { videoPath, rawVideoPath, durationSec: await probe(videoPath), removedSec: cut.removedSec || 0, did };
}
