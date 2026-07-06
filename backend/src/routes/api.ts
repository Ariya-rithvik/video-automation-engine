import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { exec } from 'child_process';
import puppeteerExtra from 'puppeteer-extra';
import { ExecutionLog } from '../watcher';
import { processSuccessRun } from '../slicer';
import { runSupervisorCrawl } from '../supervisor';
import { supervisorState } from '../services/supervisor-state';
import { runAgentTask, agentTask, requestAgentStop } from '../services/agent-task';
import { runStoryResearch, storyStudio, resetStory } from '../services/story-research';
import { runResearch, agentResearch, resetResearch } from '../services/agent-research';
import { listSkills } from '../services/agent-memory';
import { geminiAgent } from '../services/gemini-agent';
import { marketingAgent, resolveCrawlScreenshots, isMarketingBusy } from '../services/marketing-agent';
import { omniClipAgent } from '../services/omni-clip-agent';
import { searchSiteAndScreenshot } from '../services/search-crawler';
import { brainText, brainChainSummary } from '../services/vision-brain';
import { askBrowserLLM, askBrowserVision, browserLLMConfig, BrowserLLMProvider } from '../services/browser-llm';
import { generateAnimation, refineAnimation } from '../services/animation-engine';
import { runDeepExplore } from '../services/deep-explorer';
import {
  getAllDemos,
  getDemoById,
  deleteDemo,
  getAllBugReports,
  deleteBugReport,
  getAllCrawlSessions,
  getCrawlSessionById,
  insertCrawlSession,
  getRecentEvents,
  addEvent,
  insertBugReport,
  insertGeminiResult,
  getGeminiResultByCrawlId,
  getAllGeminiResults,
  getLatestMarketingJobByCrawlId,
  getAllMarketingJobs,
  getMarketingJobById,
  getAllOmniClips,
  getOmniClipById,
  deleteOmniClip,
  insertSearchCrawl,
  getSearchCrawlById,
  getAllSearchCrawls,
} from '../services/database';

const router = Router();

// ─── Demos ────────────────────────────────────────────────────────────────────

router.get('/demos', (req: Request, res: Response) => {
  try {
    const demos = getAllDemos();
    const safeDemos = demos.map(({ videoPath, audioPath, ...rest }) => rest);
    res.json(safeDemos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch demos: ' + (err as Error).message });
  }
});

router.delete('/demos/:id', (req: Request, res: Response) => {
  try {
    deleteDemo(req.params.id);
    res.json({ message: 'Demo deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Bug Reports ──────────────────────────────────────────────────────────────

router.get('/bugs', (req: Request, res: Response) => {
  try {
    res.json(getAllBugReports());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bug reports: ' + (err as Error).message });
  }
});

router.delete('/bugs/:id', (req: Request, res: Response) => {
  try {
    deleteBugReport(req.params.id);
    res.json({ message: 'Bug report deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Crawl Sessions ──────────────────────────────────────────────────────────

router.get('/crawls', (req: Request, res: Response) => {
  try {
    res.json(getAllCrawlSessions());
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Events Feed ──────────────────────────────────────────────────────────────

router.get('/events', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    res.json(getRecentEvents(Math.min(limit, 200)));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Ingestion ────────────────────────────────────────────────────────────────

router.post('/ingest-artifact', async (req: Request, res: Response) => {
  console.log('[API] Hook received artifact ingestion request:', req.body);
  const { projectId, taskId, videoPath, timestampLogs } = req.body;

  if (!videoPath || !timestampLogs) {
    res.status(400).json({ error: 'Missing required parameters videoPath or timestampLogs' });
    return;
  }

  try {
    const log: ExecutionLog = {
      status: 'SUCCESS',
      projectId: projectId || 'VisionAgent',
      taskId: taskId || 'task-101',
      steps: typeof timestampLogs === 'string' ? JSON.parse(timestampLogs) : timestampLogs,
    };

    const outputDir = path.join(__dirname, '../../output');
    addEvent('ingestion', `Webhook artifact received for ${log.projectId}`, JSON.stringify({ taskId: log.taskId }));

    processSuccessRun(videoPath, log, outputDir)
      .then(() => console.log('[API] Async processing of hook artifact completed.'))
      .catch((err: any) => console.error('[API] Async processing failed:', err));

    res.status(202).json({ message: 'Ingestion request received and processing started.' });
  } catch (err) {
    res.status(500).json({ error: 'Error processing webhook: ' + (err as Error).message });
  }
});

// ─── Manual Demo Generation ──────────────────────────────────────────────────

router.post('/generate-demo', async (req: Request, res: Response) => {
  const { logName } = req.body;
  if (!logName) {
    res.status(400).json({ error: 'Missing logName in request body.' });
    return;
  }

  const watchDir = path.join(__dirname, '../../watched');
  const logPath = path.join(watchDir, logName);

  if (!fs.existsSync(logPath)) {
    res.status(404).json({ error: `Execution log file not found at: ${logPath}` });
    return;
  }

  try {
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const log: ExecutionLog = JSON.parse(logContent);
    const baseName = path.basename(logPath, '.json');
    const videoPath = path.join(watchDir, `${baseName}.mp4`);

    addEvent('generation_started', `Manual demo generation triggered for ${logName}`);

    if (log.status === 'SUCCESS') {
      if (!fs.existsSync(videoPath)) {
        res.status(400).json({ error: `SUCCESS log found but matching video file does not exist at: ${videoPath}` });
        return;
      }
      const outputDir = path.join(__dirname, '../../output');
      await processSuccessRun(videoPath, log, outputDir);
      res.json({ message: 'Demo generated successfully!', status: 'SUCCESS' });
    } else {
      const reportsDir = path.join(__dirname, '../../reports');
      const reportId = `${log.projectId}-${log.taskId}-${Date.now()}`;
      const reportPath = path.join(reportsDir, `bug-report-${reportId}.json`);
      const report = {
        id: reportId,
        projectId: log.projectId,
        taskId: log.taskId,
        error: log.error || 'Unknown execution error',
        stepsBeforeFailure: log.steps || [],
        reportPath: reportPath,
      };
      fs.mkdirSync(reportsDir, { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      insertBugReport(report);
      res.json({ message: 'Bug-fix replay report generated successfully!', status: 'FAILURE', report });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to process run: ' + (err as Error).message });
  }
});

// ─── Video & Audio Streaming ─────────────────────────────────────────────────

router.get('/stream/video/:id', (req: Request, res: Response) => {
  const demo = getDemoById(req.params.id);
  if (!demo || !demo.videoPath || !fs.existsSync(demo.videoPath)) {
    res.status(404).json({ error: 'Video segment not found' });
    return;
  }

  const videoSize = fs.statSync(demo.videoPath).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(demo.videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(demo.videoPath).pipe(res);
  }
});

router.get('/stream/audio/:id', (req: Request, res: Response) => {
  const demo = getDemoById(req.params.id);
  if (!demo || !demo.audioPath || !fs.existsSync(demo.audioPath)) {
    res.status(404).json({ error: 'Audio track not found' });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
  fs.createReadStream(demo.audioPath).pipe(res);
});

// ─── Supervisor Crawl ────────────────────────────────────────────────────────

// ─── Brain test: confirm an AI brain actually ANSWERS. Sends a real prompt and returns the reply, so you
// can SEE the round-trip. mode 'browser' (default) forces the FREE browser-AI (drives your logged-in
// Gemini/ChatGPT web app, visible); mode 'chain' tests the full provider chain (Gemini API → … → browser).
router.post('/brain/test', async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt || 'Reply with EXACTLY this and nothing else: BRAIN_OK').slice(0, 500);
  const mode = String(req.body?.mode || 'browser');
  const provider = (String(req.body?.provider || process.env.BROWSER_LLM_PROVIDER || 'gemini').toLowerCase() === 'chatgpt' ? 'chatgpt' : 'gemini') as BrowserLLMProvider;
  const cdpUrl = String(req.body?.cdpUrl || process.env.BROWSER_LLM_CDP_URL || 'http://localhost:9222');
  const started = Date.now();
  try {
    let answer = '';
    let used = '';
    if (mode === 'chain') {
      answer = await brainText({ prompt } as any);
      used = brainChainSummary();
    } else {
      const cfg = browserLLMConfig() || { enabled: true, provider, cdpUrl, label: `browser-${provider}` };
      answer = await askBrowserLLM(prompt, cfg);
      used = cfg.label;
    }
    res.json({ ok: true, mode, provider, cdpUrl, used, ms: Date.now() - started, prompt, answer });
  } catch (err: any) {
    res.json({ ok: false, mode, provider, cdpUrl, ms: Date.now() - started, prompt, error: err?.message || String(err) });
  }
});

// FREE VISION test: upload a screenshot to your logged-in Gemini/ChatGPT web chat + read the answer.
// Proves the agent can SEE for $0. Pass {imagePath} or it uses the newest screenshot in /watched.
router.post('/brain/test-vision', async (req: Request, res: Response) => {
  const started = Date.now();
  const provider = (String(req.body?.provider || process.env.BROWSER_LLM_PROVIDER || 'gemini').toLowerCase() === 'chatgpt' ? 'chatgpt' : 'gemini') as BrowserLLMProvider;
  const cdpUrl = String(req.body?.cdpUrl || process.env.BROWSER_LLM_CDP_URL || 'http://localhost:9222');
  const prompt = String(req.body?.prompt || 'Look at this screenshot. In ONE sentence: what app/page is this and what is the main thing on screen?').slice(0, 800);
  let imagePath = String(req.body?.imagePath || '');
  if (!imagePath) {
    try {
      const wd = path.join(__dirname, '../../watched');
      const pngs = fs.readdirSync(wd).filter(f => f.toLowerCase().endsWith('.png')).map(f => path.join(wd, f));
      pngs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      imagePath = pngs[0] || '';
    } catch { /* none */ }
  }
  try {
    if (!imagePath) throw new Error('No image found — pass {imagePath} or run a crawl first so a screenshot lands in /watched.');
    const cfg = browserLLMConfig() || { enabled: true, provider, cdpUrl, label: `browser-${provider}` };
    const answer = await askBrowserVision(prompt, imagePath, cfg);
    res.json({ ok: true, provider, cdpUrl, imagePath, ms: Date.now() - started, prompt, answer });
  } catch (err: any) {
    res.json({ ok: false, provider, cdpUrl, imagePath, ms: Date.now() - started, error: err?.message || String(err) });
  }
});

// One-click test PAGE for the browser-AI brain — open http://localhost:5000/api/v1/brain/test-page
router.get('/brain/test-page', (_req: Request, res: Response) => {
  res.set('Content-Type', 'text/html').send(`<!doctype html><html><head><meta charset="utf-8"><title>Brain Test</title>
<style>body{font-family:system-ui,Segoe UI,Arial;background:#0b1220;color:#e5e7eb;max-width:720px;margin:40px auto;padding:0 16px}
button{background:#2563eb;color:#fff;border:0;padding:12px 20px;border-radius:8px;font-size:15px;cursor:pointer;margin:4px 6px 4px 0}
button.alt{background:#374151}select,input{background:#111827;color:#e5e7eb;border:1px solid #374151;border-radius:6px;padding:8px}
pre{white-space:pre-wrap;background:#111827;border:1px solid #374151;border-radius:8px;padding:14px;margin-top:16px}
.ok{color:#34d399}.err{color:#f87171}.muted{color:#9ca3af;font-size:13px;line-height:1.5}</style></head><body>
<h2>🧠 Browser-AI Brain — Test</h2>
<p class="muted">Confirms the agent can SEND a prompt to your logged-in AI and READ the answer back.<br>
1) Run <code>start-chrome-attach.bat</code> (Chrome opens on debug port 9222). 2) In that Chrome, open Gemini/ChatGPT and make sure you're signed in. 3) Click <b>Test browser-AI</b> and watch the prompt get typed in that Chrome.</p>
<p><label>Provider <select id="provider"><option value="gemini">Gemini (web)</option><option value="chatgpt">ChatGPT (web)</option></select></label>
&nbsp;<label>CDP <input id="cdp" value="http://localhost:9222" size="22"></label></p>
<p><input id="prompt" size="58" value="Reply with EXACTLY this and nothing else: BRAIN_OK"></p>
<button onclick="run('browser')">Test browser-AI (free)</button>
<button class="alt" onclick="run('chain')">Test full chain (API → browser)</button>
<pre id="out">Ready.</pre>
<script>
async function run(mode){var o=document.getElementById('out');o.className='';o.textContent='⏳ Sending to the AI… watch your Chrome window.';
var body={mode:mode,provider:document.getElementById('provider').value,cdpUrl:document.getElementById('cdp').value,prompt:document.getElementById('prompt').value};
try{var r=await fetch('/api/v1/brain/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var j=await r.json();
if(j.ok){o.className='ok';o.textContent='✅ AI replied via '+(j.used||mode)+' in '+j.ms+' ms:\\n\\n'+j.answer;}
else{o.className='err';o.textContent='❌ '+(j.error||'failed')+'\\n\\nHints: "cannot attach" → run start-chrome-attach.bat first. "no input box / logged in?" → open '+body.provider+' in that Chrome and sign in.';}
}catch(e){o.className='err';o.textContent='❌ '+e;}}
</script></body></html>`);
});

// ─── Animation Engine: idea/script (or topic + app screenshots) → playable phone animation ──
router.post('/animation/generate', async (req: Request, res: Response) => {
  const started = Date.now();
  try {
    const mode = String(req.body?.mode || 'idea') === 'topic' ? 'topic' : 'idea';
    const result = await generateAnimation({
      mode,
      idea: typeof req.body?.idea === 'string' ? req.body.idea : undefined,
      topic: typeof req.body?.topic === 'string' ? req.body.topic : undefined,
      imagesB64: Array.isArray(req.body?.imagesB64)
        ? req.body.imagesB64.map((s: any) => String(s).replace(/^data:[^,]+,/, '')).filter(Boolean)
        : undefined,
      style: req.body?.style,
      durationSec: Number(req.body?.durationSec) || undefined,
    });
    res.json({ ...result, ms: Date.now() - started });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err), ms: Date.now() - started });
  }
});

router.post('/animation/refine', async (req: Request, res: Response) => {
  const started = Date.now();
  try {
    const result = await refineAnimation({
      html: String(req.body?.html || ''),
      css: String(req.body?.css || ''),
      js: String(req.body?.js || ''),
      refinePrompt: String(req.body?.refinePrompt || ''),
      storyboard: Array.isArray(req.body?.storyboard) ? req.body.storyboard : undefined,
    });
    res.json({ ...result, ms: Date.now() - started });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err), ms: Date.now() - started });
  }
});

// Screencast Compiler: opens a headless page, seeks and screenshots frames, then compiles to MP4 via FFmpeg.
router.post('/animation/export', async (req: Request, res: Response) => {
  const started = Date.now();
  const { url, totalFrames, fps } = req.body;
  if (!url) {
    res.status(400).json({ error: 'Missing url parameter in request body.' });
    return;
  }

  const frames = Number(totalFrames) || 900;
  const rate = Number(fps) || 30;
  const tempDir = path.join(__dirname, `../../output/export-frames-${Date.now()}`);
  const outputFilename = `export-${Date.now()}.mp4`;
  const outputPath = path.join(__dirname, `../../output`, outputFilename);

  console.log(`[Export API] Starting export of URL: ${url} (${frames} frames @ ${rate}fps)`);

  let browser: any;
  try {
    fs.mkdirSync(tempDir, { recursive: true });

    // 1. Launch Puppeteer
    browser = await puppeteerExtra.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1024,576'
      ],
      defaultViewport: { width: 1024, height: 576 }
    });

    const page = await browser.newPage();
    
    // 2. Open page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    
    // 3. Stop autoplay loop
    await page.evaluate(() => {
      window.postMessage({ type: 'SET_PLAYING', playing: false }, '*');
    });
    
    // Let layout settle
    await new Promise(r => setTimeout(r, 1200));

    // 4. Capture frames sequentially
    for (let f = 0; f < frames; f++) {
      // Seek the timeline
      await page.evaluate((frameNo: number) => {
        window.postMessage({ type: 'SEEK', frame: frameNo }, '*');
      }, f);

      // Wait a tiny fraction of a second for canvas/DOM draws to finish
      await new Promise(r => setTimeout(r, 20));

      const framePath = path.join(tempDir, `frame_${String(f).padStart(6, '0')}.jpg`);
      
      // Target the viewport selector if present for a clean crop, else capture full page
      const viewportElement = await page.$('#viewport');
      if (viewportElement) {
        await viewportElement.screenshot({ path: framePath, type: 'jpeg', quality: 90 });
      } else {
        await page.screenshot({ path: framePath, type: 'jpeg', quality: 90 });
      }
    }

    await browser.close();
    browser = null;

    // 5. Compile frames into video using FFmpeg
    console.log(`[Export API] Compiling captured frames in ${tempDir} to ${outputPath}...`);
    const cmd = `ffmpeg -y -framerate ${rate} -i "${path.join(tempDir, 'frame_%06d.jpg')}" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset fast "${outputPath}"`;
    
    await new Promise<void>((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`[Export API] FFmpeg error: ${error.message}\nStderr: ${stderr}`);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    // 6. Clean up temporary frame folder
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    } catch (cleanupErr) {
      console.warn(`[Export API] Warning: Failed to clean up temp dir:`, cleanupErr);
    }

    res.json({
      success: true,
      filename: outputFilename,
      streamUrl: `/api/v1/animation/stream-export/${outputFilename}`,
      ms: Date.now() - started
    });

  } catch (err: any) {
    console.error(`[Export API] Export failed:`, err);
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    
    // Clean up temp dir if exists
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) fs.unlinkSync(path.join(tempDir, file));
        fs.rmdirSync(tempDir);
      }
    } catch { /* ignore */ }

    res.status(500).json({ success: false, error: err?.message || String(err), ms: Date.now() - started });
  }
});

// Stream compiled exports
router.get('/animation/stream-export/:filename', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.filename);
  const fp = path.resolve(__dirname, '../../output', safeName);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: 'Exported video not found.' });
    return;
  }
  
  const videoSize = fs.statSync(fp).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(fp, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(fp).pipe(res);
  }
});

router.post('/supervisor/crawl', async (req: Request, res: Response) => {
  const { targetUrl, autoGenerate, loginRequired, loginEmail, loginUsername, loginPassword, useRealChrome, cdpPort, recordMode, maxDemoSeconds, crawlMode } = req.body;
  const mode: 'short' | 'full' = recordMode === 'full' ? 'full' : 'short'; // default: quick (≤~3 min) demo
  // crawlMode: 'record' (DEFAULT) = JUST scroll + screenshot every page incl. sub-pages (no typing/
  // drawing, no AI — always works, e.g. Zomato). 'explore' (opt-in) = AI hand drives/draws/clicks/shows
  // features (needs a working brain). Default to RECORD so the app never stalls on AI quota.
  const demonstrate = crawlMode === 'explore';
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing targetUrl parameter in request body.' });
    return;
  }
  // ATTACH MODE: connect to the user's REAL, already-logged-in Chrome (started with
  // --remote-debugging-port). Best bot-detection bypass + no re-login. Implies "already logged in",
  // so we don't run the login flow.
  const attachCdpUrl = useRealChrome ? `http://localhost:${Number(cdpPort) || 9222}` : undefined;
  // Optional auto-login credentials (used to fill the login form, no AI needed). Providing them
  // implies a login-gated (visible) crawl. Ignored in attach mode.
  const loginCredentials = (!attachCdpUrl && (loginEmail || loginUsername) && loginPassword)
    ? { username: String(loginEmail || loginUsername), password: String(loginPassword) }
    : null;
  const needLogin = !attachCdpUrl && (!!loginRequired || !!loginCredentials);

  const watchDir = path.join(__dirname, '../../watched');
  try {
    addEvent('crawl_started', `Real browser crawl started for: ${targetUrl}${needLogin ? (loginCredentials ? ' (auto-login)' : ' (login-gated)') : ''}`);
    // Reset login flags for a fresh run
    supervisorState.set({
      status: needLogin ? 'waiting_for_login' : 'crawling',
      message: attachCdpUrl ? '🔗 Attaching to your real (logged-in) Chrome…' : (loginCredentials ? 'Opening Chrome + auto-logging in...' : (needLogin ? 'Opening visible Chrome for login...' : 'Crawling target site...')),
      targetUrl,
      loginRequired: needLogin,
      needsAttention: needLogin && !loginCredentials,
      userConfirmedLogin: false,
      autoDetectedLogin: false,
    });
    const result = await runSupervisorCrawl(targetUrl, watchDir, {
      loginRequired: needLogin,
      loginCredentials,
      attachCdpUrl,
      recordMode: mode,
      maxDemoSeconds: typeof maxDemoSeconds === 'number' ? maxDemoSeconds : undefined,
      demonstrate,
      onLoginStatus: (msg) => {
        supervisorState.set({ status: 'waiting_for_login', message: msg, needsAttention: true });
        addEvent('crawl_login', msg);
      },
      onLoginAttention: ({ autoDetected }) => {
        supervisorState.set({ needsAttention: true, autoDetectedLogin: autoDetected });
      },
      shouldResumeLogin: () => supervisorState.state.userConfirmedLogin,
    });
    supervisorState.set({ status: 'complete', message: `Crawled ${result.discoveredPages.length} pages.` });

    // Persist crawl session to database
    const sessionId = `crawl-${Date.now()}`;
    insertCrawlSession({
      id: sessionId,
      targetUrl,
      status: 'completed',
      discoveredPages: result.discoveredPages,
      screenshots: result.screenshots,
      videoPath: result.videoPath,
      durationSeconds: result.crawlDuration,
      startedAt: result.crawlDetails.startedAt,
      completedAt: result.crawlDetails.completedAt,
    });

    // ─── Auto-generate the marketing video (unless explicitly disabled) ──────
    // Fire-and-forget: the crawl response returns immediately; the marketing
    // pipeline runs in the background and the frontend polls /marketing/status.
    let autoStarted = false;
    if (autoGenerate !== false) {
      const kick = kickoffMarketing(sessionId, mode); // 'short' (≤~3min cut) or 'full' (longer)
      autoStarted = kick.started;
      if (kick.started) {
        addEvent('marketing_auto', `Auto-generation started for crawl ${sessionId}`);
      } else {
        addEvent('marketing_auto_skipped', `Auto-generation skipped (${kick.reason}) for crawl ${sessionId}`);
      }
    }

    res.json({ ...result, crawlId: sessionId, autoGenerateStarted: autoStarted });
  } catch (err: any) {
    supervisorState.set({ status: 'error', message: `Crawl failed: ${err.message}` });
    addEvent('crawl_failed', `Crawl failed for ${targetUrl}: ${err.message}`);
    res.status(500).json({ error: 'Supervisor crawl failed: ' + (err as Error).message });
  }
});

// Poll supervisor crawl status — used by the UI to show the login-wait banner.
router.get('/supervisor/status', (req: Request, res: Response) => {
  res.json(supervisorState.state);
});

// User clicked "I've logged in — continue" in the web app. Unblocks the waiting crawl.
router.post('/supervisor/confirm-login', (req: Request, res: Response) => {
  supervisorState.confirmLogin();
  addEvent('crawl_login_confirmed', 'User confirmed login — resuming crawl.');
  res.json({ message: 'Login confirmed. Resuming crawl.', status: supervisorState.state });
});

// ─── Deep Explore: recursive vision-driven site tour → wait-cut video ──────────
// Reuses supervisorState for status + the existing /supervisor/confirm-login button.
let deepBusy = false;
let lastDeep: { videoPath: string; visited: string[]; durationSec: number; removedSec: number; steps: number; targetUrl: string } | null = null;

// Is a debug Chrome actually listening (start-chrome-attach.bat)? Quick probe so we only auto-attach when it works.
function chromeDebugReachable(cdpUrl: string, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const u = new URL('/json/version', cdpUrl);
      const req = http.get({ hostname: u.hostname, port: u.port, path: u.pathname, timeout: timeoutMs }, (r) => {
        r.resume(); resolve((r.statusCode || 0) >= 200 && (r.statusCode || 0) < 500);
      });
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error', () => resolve(false));
    } catch { resolve(false); }
  });
}

router.post('/explore/deep', (req: Request, res: Response) => {
  const targetUrl = String(req.body?.targetUrl || '').trim();
  if (!targetUrl) { res.status(400).json({ error: 'Missing targetUrl' }); return; }
  if (deepBusy) { res.status(409).json({ error: 'A deep tour is already running.' }); return; }
  const loginRequired = !!req.body?.loginRequired;
  const maxSections = Math.max(1, Math.min(20, Number(req.body?.maxSections) || 10));
  const maxDepth = Math.max(0, Math.min(2, Number(req.body?.maxDepth) || 0));
  const vp = req.body?.viewport;
  const viewport = vp && Number(vp.width) && Number(vp.height) ? { width: Number(vp.width), height: Number(vp.height) } : undefined;
  // Attach to the user's REAL, already-logged-in Chrome (run start-chrome-attach.bat first) — best reliability.
  const useRealChrome = !!req.body?.useRealChrome;
  const explicitAttachUrl = useRealChrome ? (process.env.ATTACH_CDP_URL || 'http://localhost:9222') : undefined;
  const autoAttachUrl = process.env.ATTACH_CDP_URL || 'http://localhost:9222';
  const mode: 'tour' | 'demo' = String(req.body?.mode || 'tour') === 'demo' ? 'demo' : 'tour';
  const aiPrompt = typeof req.body?.aiPrompt === 'string' && req.body.aiPrompt.trim() ? req.body.aiPrompt.trim() : undefined;
  // Login credentials are used at RUN TIME only — never logged or persisted. Accept username or email.
  const lc = req.body?.loginCredentials;
  const loginCredentials = lc && (lc.username || lc.email) && lc.password
    ? { username: String(lc.username || lc.email), password: String(lc.password) } : null;
  deepBusy = true;
  supervisorState.set({
    status: loginRequired ? 'waiting_for_login' : 'crawling',
    message: loginRequired
      ? (loginCredentials ? 'Opening browser — signing in…' : 'Opening browser — please log in, then click "I\'ve logged in".')
      : 'Starting AI demo…',
    targetUrl, loginRequired, needsAttention: loginRequired, userConfirmedLogin: false, autoDetectedLogin: false,
  });
  addEvent('deep_explore_started', `AI demo started for: ${targetUrl}`);
  (async () => {
    try {
      // RELIABILITY: prefer attaching to the user's REAL, already-logged-in Chrome. Explicit useRealChrome always
      // attaches; otherwise, when a login is required but NO credentials were given (the flaky case — it would
      // otherwise wait for a human), auto-upgrade to attach IF a debug Chrome is actually reachable on 9222.
      let attachCdpUrl = explicitAttachUrl;
      if (!attachCdpUrl && loginRequired && !loginCredentials && await chromeDebugReachable(autoAttachUrl)) {
        attachCdpUrl = autoAttachUrl;
        supervisorState.set({ message: '🔗 Found your logged-in Chrome — attaching (no re-login needed).', needsAttention: false });
        addEvent('deep_explore_attach', `Auto-attached to ${autoAttachUrl}`);
      }
      // ONE unified flow: scroll the landing → (login) → vision-driven explore/type/draw/agent, memory-deduped.
      const r = await runDeepExplore({
        targetUrl,
        outputDir: path.join(__dirname, '../../output/deep'),
        loginWait: loginRequired && !attachCdpUrl, // attach = already logged in, skip the login flow
        loginCredentials,
        isLoggedIn: () => supervisorState.state.userConfirmedLogin,
        unattended: !!req.body?.unattended, // automated caller → don't wait minutes for a manual login
        onStatus: (m) => {
          // Keep the UI status honest: once we're past login (signed in, attached, or fell back to public),
          // leave the "waiting_for_login" phase so the confirm prompt disappears and it reads as "running".
          const past = /Logged in|Already signed in|Found your logged-in|touring the public/i.test(m);
          supervisorState.set(past ? { status: 'crawling', message: m, needsAttention: false } : { message: m });
        },
        maxSections, maxDepth, aiPrompt, viewport, attachCdpUrl, timeBudgetSec: 300,
      });
      lastDeep = { videoPath: r.videoPath, visited: r.visited, durationSec: r.durationSec, removedSec: r.removedSec, steps: r.steps, targetUrl };
      if (!r.videoPath) {
        // Never report a false success: zero frames captured → say so plainly instead of "complete".
        supervisorState.set({ status: 'error', message: 'No video was produced (nothing could be recorded). Check the URL / login and try again.', needsAttention: false });
        addEvent('deep_explore_empty', `deep produced no video (${r.steps} steps)`);
      } else {
        supervisorState.set({ status: 'complete', message: `Demo done — ${r.visited.length} steps, ${r.durationSec.toFixed(0)}s video (cut ${r.removedSec.toFixed(0)}s of waits).`, needsAttention: false });
        addEvent('deep_explore_done', `AI demo done: ${r.steps} steps.`);
      }
    } catch (e: any) {
      supervisorState.set({ status: 'error', message: 'Demo failed: ' + (e?.message || e), needsAttention: false });
      addEvent('deep_explore_failed', `deep failed: ${e?.message || e}`);
    } finally { deepBusy = false; }
  })();
  res.json({ started: true, mode, targetUrl, maxSections, maxDepth });
});

router.get('/explore/deep/result', (_req: Request, res: Response) => {
  res.json({ busy: deepBusy, status: supervisorState.state, result: lastDeep ? { ...lastDeep, streamUrl: '/api/v1/explore/deep/video' } : null });
});

router.get('/explore/deep/video', (req: Request, res: Response) => {
  const f = lastDeep?.videoPath;
  if (!f || !fs.existsSync(f)) { res.status(404).json({ error: 'No deep-tour video yet.' }); return; }
  const stat = fs.statSync(f);
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': 'video/mp4' });
    fs.createReadStream(f, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
    fs.createReadStream(f).pipe(res);
  }
});

// ─── Agentic Task Loop (Antigravity-style web agent) ─────────────────────────

router.post('/agent/task', (req: Request, res: Response) => {
  const { goal, targetUrl, maxSteps, loginMode } = req.body || {};
  if (!goal || !targetUrl) {
    res.status(400).json({ error: 'Missing goal or targetUrl.' });
    return;
  }
  const busy = ['planning', 'running', 'waiting_for_login'].includes(agentTask.state.status);
  if (busy) {
    res.status(409).json({ error: 'Agent is already running a task.', status: agentTask.state });
    return;
  }
  addEvent('agent_task_started', `Agent task: "${goal}" on ${targetUrl}`);
  res.status(202).json({ message: 'Agent task started.', status: agentTask.state });

  runAgentTask({ goal, targetUrl, maxSteps, loginMode }).then((final) => {
    addEvent('agent_task_done', `Agent task ${final.status}: ${final.finalAnswer || final.error || ''}`);
  }).catch((err) => {
    console.error('[API] Agent task crashed:', err);
    addEvent('agent_task_failed', `Agent task crashed: ${err.message}`);
  });
});

router.get('/agent/status', (req: Request, res: Response) => {
  res.json(agentTask.state);
});

router.post('/agent/confirm-login', (req: Request, res: Response) => {
  agentTask.confirmLogin();
  res.json({ message: 'Login confirmed.', status: agentTask.state });
});

// Human supplies a selection (value = the chosen option text) or approves a confirm gate (no value).
router.post('/agent/answer', (req: Request, res: Response) => {
  const { value } = req.body || {};
  agentTask.provideInput(typeof value === 'string' && value.trim() ? value.trim() : '__APPROVED__');
  res.json({ message: 'Input received.', status: agentTask.state });
});

// Assisted login: user submits credentials in ADE; agent fills the form (transient, never stored).
router.post('/agent/credentials', (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  agentTask.provideCredentials(String(username || ''), String(password || ''));
  res.json({ message: 'Credentials received.' });   // never echo them back
});

router.post('/agent/stop', (req: Request, res: Response) => {
  requestAgentStop();
  res.json({ message: 'Stop requested.', status: agentTask.state });
});

router.post('/agent/reset', (req: Request, res: Response) => {
  agentTask.reset();
  res.json({ message: 'Agent reset.', status: agentTask.state });
});

// ─── Story Studio (localized AI storytelling research → sourced script) ───────

router.post('/story/research', (req: Request, res: Response) => {
  const { topic, country, language } = req.body || {};
  if (!topic || !country || !language) {
    res.status(400).json({ error: 'Missing topic, country, or language.' });
    return;
  }
  const busy = ['researching', 'scripting'].includes(storyStudio.state.status);
  if (busy) {
    res.status(409).json({ error: 'Story Studio is already working.', status: storyStudio.state });
    return;
  }
  addEvent('story_research_started', `Story: "${topic}" (${country} / ${language})`);
  res.status(202).json({ message: 'Story research started.', status: storyStudio.state });

  runStoryResearch({ topic, country, language }).then((final) => {
    addEvent('story_research_done', `Story ${final.status}: ${final.brief?.headline || final.error || ''}`);
  }).catch((err) => {
    console.error('[API] Story research crashed:', err);
    addEvent('story_research_failed', `Story research crashed: ${err.message}`);
  });
});

router.get('/story/status', (req: Request, res: Response) => {
  res.json(storyStudio.state);
});

router.post('/story/reset', (req: Request, res: Response) => {
  resetStory();
  res.json({ message: 'Story Studio reset.', status: storyStudio.state });
});

// ─── Agent Research (Extract → Reason → Act: scrape any list, rank by your criteria) ──

router.post('/agent/research', (req: Request, res: Response) => {
  const { url, goal, maxItems } = req.body || {};
  if (!url || !goal) {
    res.status(400).json({ error: 'Missing url or goal.' });
    return;
  }
  if (['opening', 'extracting', 'ranking'].includes(agentResearch.state.status)) {
    res.status(409).json({ error: 'Research already running.', status: agentResearch.state });
    return;
  }
  addEvent('agent_research_started', `Research: "${goal}" on ${url}`);
  res.status(202).json({ message: 'Research started.', status: agentResearch.state });

  runResearch({ url, goal, maxItems })
    .then((f) => addEvent('agent_research_done', `Research ${f.status}: ${f.items.length} items`))
    .catch((err) => console.error('[API] Research crashed:', err));
});

router.get('/agent/research/status', (req: Request, res: Response) => {
  res.json(agentResearch.state);
});

router.post('/agent/research/reset', (req: Request, res: Response) => {
  resetResearch();
  res.json({ message: 'Research reset.', status: agentResearch.state });
});

// ─── Agent Skill Memory (self-improving agent — what it has learned per site) ──
router.get('/agent/skills', (req: Request, res: Response) => {
  res.json({ skills: listSkills() });
});

// Stream a step screenshot by id
router.get('/agent/shot/:id', (req: Request, res: Response) => {
  const safe = path.basename(req.params.id).replace(/[^a-zA-Z0-9_-]/g, '');
  const fp = path.resolve(__dirname, '../../data/agent-shots', `${safe}.png`);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: 'Screenshot not found.' });
    return;
  }
  res.sendFile(fp);
});

// List all captured screenshots
router.get('/supervisor/screenshots', (req: Request, res: Response) => {
  const watchDir = path.join(__dirname, '../../watched');
  try {
    if (!fs.existsSync(watchDir)) {
      res.json([]);
      return;
    }
    const files = fs.readdirSync(watchDir);
    const screenshotFiles = files.filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
    res.json(screenshotFiles);
  } catch (err: any) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Stream specific page screenshot
router.get('/stream/screenshot/:name', (req: Request, res: Response) => {
  const name = req.params.name;
  const safeName = path.basename(name);
  const screenshotPath = path.join(__dirname, '../../watched', safeName);

  if (!fs.existsSync(screenshotPath)) {
    res.status(404).json({ error: 'Screenshot not found' });
    return;
  }
  res.sendFile(screenshotPath);
});

// Stream crawl session video by crawl ID
router.get('/stream/crawl-video/:id', (req: Request, res: Response) => {
  const crawls = getAllCrawlSessions();
  const crawl = crawls.find(c => c.id === req.params.id);
  if (!crawl || !crawl.videoPath) {
    res.status(404).json({ error: 'Crawl video not found' });
    return;
  }

  const videoPath = crawl.videoPath;
  if (!fs.existsSync(videoPath)) {
    res.status(404).json({ error: 'Video file missing from disk' });
    return;
  }

  const videoSize = fs.statSync(videoPath).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Stream the latest crawl video (convenience shortcut)
router.get('/stream/latest-crawl-video', (req: Request, res: Response) => {
  const crawls = getAllCrawlSessions();
  if (crawls.length === 0) {
    res.status(404).json({ error: 'No crawl videos available' });
    return;
  }

  const latest = crawls[0]; // Already sorted by most recent
  const videoPath = latest.videoPath;

  if (!videoPath || !fs.existsSync(videoPath)) {
    res.status(404).json({ error: 'Latest crawl video file missing' });
    return;
  }

  const videoSize = fs.statSync(videoPath).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// ─── Gemini Agent ────────────────────────────────────────────────────────────

// Start Gemini agent for a crawl session
router.post('/gemini/generate', async (req: Request, res: Response) => {
  const { crawlId, customPrompt } = req.body;

  if (!crawlId) {
    res.status(400).json({ error: 'Missing crawlId parameter.' });
    return;
  }

  // Check if agent is already busy
  if (geminiAgent.state.status !== 'idle' && geminiAgent.state.status !== 'complete' && geminiAgent.state.status !== 'error') {
    res.status(409).json({ error: 'Gemini agent is currently busy.', status: geminiAgent.state });
    return;
  }

  // Find the crawl session
  const crawl = getCrawlSessionById(crawlId);
  if (!crawl) {
    res.status(404).json({ error: `Crawl session ${crawlId} not found.` });
    return;
  }

  // Build screenshot file paths from crawl data
  const watchDir = path.join(__dirname, '../../watched');
  const screenshotPaths: string[] = [];
  if (crawl.screenshots) {
    for (const [, screenshotPath] of Object.entries(crawl.screenshots)) {
      const p = screenshotPath as string;
      if (fs.existsSync(p)) {
        screenshotPaths.push(p);
      } else {
        // Try watched dir with the page name
        const basename = path.basename(p);
        const watchedPath = path.join(watchDir, basename);
        if (fs.existsSync(watchedPath)) {
          screenshotPaths.push(watchedPath);
        }
      }
    }
  }

  // If no screenshots found from crawl data, scan the watched dir
  if (screenshotPaths.length === 0) {
    try {
      const files = fs.readdirSync(watchDir);
      const screenshots = files.filter(f => f.startsWith('screenshot-') && f.endsWith('.png'));
      for (const f of screenshots.slice(0, 5)) {
        screenshotPaths.push(path.join(watchDir, f));
      }
    } catch { /* ignore */ }
  }

  addEvent('gemini_started', `Gemini agent launched for crawl ${crawlId}`);

  // Start the generation asynchronously
  res.json({ message: 'Gemini agent started.', status: geminiAgent.state });

  // Run in background — uses Gemini API (no browser, no login)
  geminiAgent.generateViaAPI({
    crawlId,
    targetUrl: crawl.targetUrl,
    screenshotPaths,
    videoPath: crawl.videoPath || undefined,
    discoveredPages: crawl.discoveredPages || [],
    customPrompt,
  }).then((finalState) => {
    if (finalState.result) {
      insertGeminiResult({
        id: `gemini-${Date.now()}`,
        crawlId,
        prompt: customPrompt || 'default',
        response: finalState.result,
        screenshotsUsed: screenshotPaths.map(p => path.basename(p)),
        videoUsed: crawl.videoPath ? path.basename(crawl.videoPath) : null,
      });
    }
  }).catch((err) => {
    console.error('[API] Gemini agent failed:', err);
    addEvent('gemini_failed', `Gemini agent error: ${err.message}`);
  });
});

// Get current agent status
router.get('/gemini/status', (req: Request, res: Response) => {
  res.json(geminiAgent.state);
});

// Get generated result for a crawl
router.get('/gemini/result/:crawlId', (req: Request, res: Response) => {
  const result = getGeminiResultByCrawlId(req.params.crawlId);
  if (!result) {
    res.status(404).json({ error: 'No Gemini result found for this crawl.' });
    return;
  }
  res.json(result);
});

// Get all Gemini results
router.get('/gemini/results', (req: Request, res: Response) => {
  res.json(getAllGeminiResults());
});

// Reset agent to idle
router.post('/gemini/reset', (req: Request, res: Response) => {
  geminiAgent.reset();
  res.json({ message: 'Agent reset to idle.', status: geminiAgent.state });
});

// ─── Marketing Video (Gemini director + Remotion renderer) ───────────────────

// Shared kickoff used by both the manual endpoint and the auto-trigger on crawl-complete.
// Returns whether a job started (false = busy or crawl missing).
function kickoffMarketing(crawlId: string, recordMode: 'short' | 'full' = 'short'): { started: boolean; reason?: 'busy' | 'crawl_not_found' } {
  if (isMarketingBusy()) return { started: false, reason: 'busy' };

  const crawl = getCrawlSessionById(crawlId);
  if (!crawl) return { started: false, reason: 'crawl_not_found' };

  const watchDir = path.join(__dirname, '../../watched');
  const screenshotPaths = resolveCrawlScreenshots(crawl, watchDir);

  addEvent('marketing_started', `Marketing video pipeline launched for crawl ${crawlId} (${recordMode})`);

  marketingAgent.generate({
    crawlId,
    targetUrl: crawl.targetUrl,
    screenshotPaths,
    discoveredPages: crawl.discoveredPages || [],
    recordMode, // 'short' = tight ~75s cut; 'full' = longer (up to ~3 min+)
  }).then((finalState) => {
    if (finalState.status === 'complete') {
      addEvent('marketing_completed', `Marketing video rendered for crawl ${crawlId}`, JSON.stringify({ jobId: finalState.jobId }));
    } else {
      addEvent('marketing_failed', `Marketing pipeline failed: ${finalState.error}`);
    }
  }).catch((err) => {
    console.error('[API] Marketing agent crashed:', err);
    addEvent('marketing_failed', `Marketing agent crashed: ${err.message}`);
  });

  return { started: true };
}

router.post('/marketing/generate', async (req: Request, res: Response) => {
  const { crawlId, recordMode } = req.body;
  if (!crawlId) {
    res.status(400).json({ error: 'Missing crawlId parameter.' });
    return;
  }
  const result = kickoffMarketing(crawlId, recordMode === 'full' ? 'full' : 'short');
  if (!result.started) {
    if (result.reason === 'crawl_not_found') {
      res.status(404).json({ error: `Crawl session ${crawlId} not found.` });
    } else {
      res.status(409).json({ error: 'Marketing agent is currently busy.', status: marketingAgent.state });
    }
    return;
  }
  res.status(202).json({ message: 'Marketing video pipeline started.', status: marketingAgent.state });
});

router.get('/marketing/status', (req: Request, res: Response) => {
  res.json(marketingAgent.state);
});

router.get('/marketing/result/:crawlId', (req: Request, res: Response) => {
  const job = getLatestMarketingJobByCrawlId(req.params.crawlId);
  if (!job) {
    res.status(404).json({ error: 'No marketing video found for this crawl.' });
    return;
  }
  // Don't leak local file paths — replace with stream URL
  res.json({
    id: job.id,
    crawlId: job.crawlId,
    status: job.status,
    durationSeconds: job.durationSeconds,
    error: job.error,
    createdAt: job.createdAt,
    streamUrl: job.videoPath ? `/api/v1/marketing/stream/${job.id}` : null,
    shortsStreamUrl: job.shortsVideoPath ? `/api/v1/marketing/stream-shorts/${job.id}` : null,
    scenePlan: job.scenePlanJson ? JSON.parse(job.scenePlanJson) : null,
  });
});

router.get('/marketing/results', (req: Request, res: Response) => {
  res.json(getAllMarketingJobs().map(j => ({
    id: j.id,
    crawlId: j.crawlId,
    status: j.status,
    durationSeconds: j.durationSeconds,
    error: j.error,
    createdAt: j.createdAt,
    streamUrl: j.videoPath ? `/api/v1/marketing/stream/${j.id}` : null,
  })));
});

router.get('/marketing/stream/:id', (req: Request, res: Response) => {
  const job = getMarketingJobById(req.params.id);
  if (!job || !job.videoPath || !fs.existsSync(job.videoPath)) {
    res.status(404).json({ error: 'Marketing video file not found.' });
    return;
  }

  const videoPath = job.videoPath;
  const videoSize = fs.statSync(videoPath).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': videoSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Stream the vertical 9:16 Shorts cut (range requests)
router.get('/marketing/stream-shorts/:id', (req: Request, res: Response) => {
  const job = getMarketingJobById(req.params.id);
  if (!job || !job.shortsVideoPath || !fs.existsSync(job.shortsVideoPath)) {
    res.status(404).json({ error: 'Shorts video file not found.' });
    return;
  }
  const videoPath = job.shortsVideoPath;
  const videoSize = fs.statSync(videoPath).size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': videoSize, 'Content-Type': 'video/mp4' });
    fs.createReadStream(videoPath).pipe(res);
  }
});

router.post('/marketing/reset', (req: Request, res: Response) => {
  marketingAgent.reset();
  res.json({ message: 'Marketing agent reset to idle.', status: marketingAgent.state });
});

// ─── Gemini Omni Clip (CDP attach to user's real Chrome) ─────────────────────

router.post('/omni/start', (req: Request, res: Response) => {
  const { cdpPort, promptHint } = req.body || {};

  const busyStatuses = ['connecting', 'waiting_for_video', 'downloading'];
  if (busyStatuses.includes(omniClipAgent.state.status)) {
    res.status(409).json({ error: 'Omni clip agent is already running.', status: omniClipAgent.state });
    return;
  }

  addEvent('omni_started', `Omni clip agent started${promptHint ? ` (hint: ${promptHint.slice(0, 60)})` : ''}`);
  res.status(202).json({ message: 'Omni clip agent started.', status: omniClipAgent.state });

  omniClipAgent.start({ cdpPort, promptHint }).then((finalState) => {
    if (finalState.status === 'complete') {
      addEvent('omni_complete', `Omni clip saved: ${finalState.clipId}`);
    } else if (finalState.status === 'error') {
      addEvent('omni_failed', `Omni clip failed: ${finalState.error}`);
    }
  }).catch((err) => {
    console.error('[API] Omni agent crashed:', err);
    addEvent('omni_failed', `Omni agent crashed: ${err.message}`);
  });
});

router.get('/omni/status', (req: Request, res: Response) => {
  res.json(omniClipAgent.state);
});

router.post('/omni/cancel', (req: Request, res: Response) => {
  omniClipAgent.cancel();
  res.json({ message: 'Cancel signal sent.', status: omniClipAgent.state });
});

router.post('/omni/reset', (req: Request, res: Response) => {
  omniClipAgent.reset();
  res.json({ message: 'Omni agent reset.', status: omniClipAgent.state });
});

router.get('/omni/clips', (req: Request, res: Response) => {
  res.json(getAllOmniClips().map(c => ({
    id: c.id,
    sourceUrl: c.sourceUrl,
    prompt: c.prompt,
    usedInMarketing: c.usedInMarketing,
    createdAt: c.createdAt,
    streamUrl: `/api/v1/omni/clips/${c.id}/stream`,
  })));
});

router.get('/omni/clips/:id', (req: Request, res: Response) => {
  const clip = getOmniClipById(req.params.id);
  if (!clip) {
    res.status(404).json({ error: 'Omni clip not found.' });
    return;
  }
  res.json({
    id: clip.id,
    sourceUrl: clip.sourceUrl,
    prompt: clip.prompt,
    usedInMarketing: clip.usedInMarketing,
    createdAt: clip.createdAt,
    streamUrl: `/api/v1/omni/clips/${clip.id}/stream`,
  });
});

router.delete('/omni/clips/:id', (req: Request, res: Response) => {
  const clip = getOmniClipById(req.params.id);
  if (!clip) {
    res.status(404).json({ error: 'Omni clip not found.' });
    return;
  }
  try { if (fs.existsSync(clip.filePath)) fs.unlinkSync(clip.filePath); } catch { /* ignore */ }
  deleteOmniClip(clip.id);
  res.json({ message: 'Deleted.', id: clip.id });
});

// ─── Search Crawl (puppeteer search → screenshot results) ───────────────────

router.post('/search-crawl', async (req: Request, res: Response) => {
  const { url, query, count } = req.body || {};
  if (!url || !query) {
    res.status(400).json({ error: 'Missing url or query in request body.' });
    return;
  }
  try {
    addEvent('search_crawl_started', `Search crawl: ${url} for "${query}"`);
    const result = await searchSiteAndScreenshot({ url, query, count });

    if (!result.success) {
      res.status(500).json({ error: result.error, resultsUrl: result.resultsUrl });
      return;
    }

    const id = `search-${Date.now()}`;
    insertSearchCrawl({
      id,
      sourceUrl: url,
      query,
      resultsUrl: result.resultsUrl,
      screenshotPaths: result.screenshotPaths,
    });

    res.json({
      id,
      query,
      resultsUrl: result.resultsUrl,
      count: result.screenshotPaths.length,
      streamUrls: result.screenshotPaths.map((_, i) => `/api/v1/search-crawl/${id}/${i}`),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || String(err) });
  }
});

router.get('/search-crawl', (req: Request, res: Response) => {
  res.json(getAllSearchCrawls().map(c => ({
    id: c.id,
    sourceUrl: c.sourceUrl,
    query: c.query,
    resultsUrl: c.resultsUrl,
    count: c.screenshotPaths.length,
    createdAt: c.createdAt,
    streamUrls: c.screenshotPaths.map((_, i) => `/api/v1/search-crawl/${c.id}/${i}`),
  })));
});

// Serve search-crawl screenshots by basename — used when Remotion fetches them during render
router.get('/search-crawl/file/:name', (req: Request, res: Response) => {
  const safeName = path.basename(req.params.name);
  const fp = path.resolve(__dirname, '../../data/search-crawls', safeName);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ error: 'Search crawl screenshot not found.' });
    return;
  }
  res.sendFile(fp);
});

router.get('/search-crawl/:id/:idx', (req: Request, res: Response) => {
  const crawl = getSearchCrawlById(req.params.id);
  if (!crawl) {
    res.status(404).json({ error: 'Search crawl not found.' });
    return;
  }
  const idx = parseInt(req.params.idx, 10);
  const filepath = crawl.screenshotPaths[idx];
  if (!filepath || !fs.existsSync(filepath)) {
    res.status(404).json({ error: 'Result screenshot not found.' });
    return;
  }
  res.sendFile(filepath);
});

router.get('/omni/clips/:id/stream', (req: Request, res: Response) => {
  const clip = getOmniClipById(req.params.id);
  if (!clip || !fs.existsSync(clip.filePath)) {
    res.status(404).json({ error: 'Omni clip file missing on disk.' });
    return;
  }
  const videoSize = fs.statSync(clip.filePath).size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : videoSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(clip.filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${videoSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    });
    file.pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': videoSize, 'Content-Type': 'video/mp4' });
    fs.createReadStream(clip.filePath).pipe(res);
  }
});

export default router;
