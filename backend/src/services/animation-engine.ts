// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION ENGINE — turn an idea/script (or a topic + app screenshots) into a
// self-contained, playable phone-UI animation (HTML + CSS + JS).
//
// Design principle (so generation is RELIABLE and never "breaks"):
//   The AI only writes the CREATIVE parts — the HTML scenes, the CSS, and ONE
//   function `updateShowcase(frame)` plus `const TOTAL_FRAMES`. It must NOT write
//   the playback loop or the postMessage wiring. WE append a fixed PLAYBACK SHIM
//   (rAF loop + SEEK / SET_SPEED / SET_PLAYING / FRAME_UPDATE protocol) so every
//   generated animation plugs straight into the showcase-engine's scrubber, speed
//   and phase controls. This removes a whole class of "the timeline is broken" bugs.
//
// Output is DELIMITER-framed (===HTML=== …), not JSON — large code blocks can't
// break a JSON parser this way.
// ═══════════════════════════════════════════════════════════════════════════

import { brainText, visionText, brainChainSummary } from './vision-brain';
import { searchWeb, fetchPageText } from './web-search';

export type AniMode = 'idea' | 'topic';
export type AniStyle = 'cyberpunk' | 'cosmic' | 'minimalist';

export interface GenerateAnimationReq {
  mode: AniMode;
  idea?: string;          // mode 'idea': the user's narration / script / concept
  topic?: string;         // mode 'topic': the app/brand name (e.g. "Uber")
  imagesB64?: string[];   // mode 'topic': raw base64 screenshots of the app (no data: prefix)
  style?: AniStyle;
  durationSec?: number;   // default 45
}

export interface RefineAnimationReq {
  html: string;
  css: string;
  js: string;
  refinePrompt: string;
  storyboard?: string[];
}

export interface AnimationResult {
  ok: boolean;
  title: string;
  script: string;
  research?: string;
  sources?: string[];
  storyboard: string[];
  phases: { label: string; frame: number }[];
  totalFrames: number;
  html: string;
  css: string;
  js: string;
  provider: string;
  note?: string;
  error?: string;
}

const FPS = 30;

// ─── The fixed PLAYBACK SHIM (appended to every generated JS) ────────────────
// References `updateShowcase` and `TOTAL_FRAMES` from the AI's code (same <script>
// scope). Drives the timeline + speaks the showcase-engine's postMessage protocol.
export function playbackShim(): string {
  return `
// ── ENGINE PLAYBACK SHIM (auto-added — do not edit) ──────────────────────────
;(function(){
  var __f = 0, __playing = true, __speed = 1, __last = 0;
  function __total(){ return (typeof TOTAL_FRAMES !== 'undefined' && TOTAL_FRAMES > 0) ? TOTAL_FRAMES : 1350; }
  function __draw(f){ try { if (typeof updateShowcase === 'function') updateShowcase(f); } catch (e) { /* keep looping */ } }
  function __tick(ts){
    if (!__last) __last = ts;
    var dt = ts - __last; __last = ts;
    if (__playing) {
      __f += __speed * (dt / (1000 / ${FPS}));
      if (__f >= __total()) __f = 0;
      if (__f < 0) __f = 0;
    }
    __draw(__f);
    try { parent.postMessage({ type: 'FRAME_UPDATE', frame: __f }, '*'); } catch (e) {}
    requestAnimationFrame(__tick);
  }
  window.addEventListener('message', function(e){
    var d = (e && e.data) || {};
    if (d.type === 'SEEK')        { __f = +d.frame || 0; __draw(__f); }
    else if (d.type === 'SET_SPEED')   { __speed = +d.speed || 1; }
    else if (d.type === 'SET_PLAYING') { __playing = !!d.playing; __last = 0; }
  });
  __draw(0);
  requestAnimationFrame(__tick);
})();`;
}

const STYLE_NOTES: Record<AniStyle, string> = {
  cyberpunk:   'Cyberpunk neon: dark charcoal/black background, electric cyan + magenta accents, thin glowing borders, grid lines, monospace touches.',
  cosmic:      'Cosmic data universe: deep space gradient (indigo→black), starfield dots, soft purple/blue glows, floating particles, luminous orbs.',
  minimalist:  'Minimalist corporate sleek: clean light or near-black background, ONE confident accent color, generous spacing, crisp typography, subtle shadows.',
};

// ─── Shared contract appended to every prompt ────────────────────────────────
function contractBlock(totalFrames: number, style: AniStyle): string {
  return `
TECHNICAL CONTRACT (follow EXACTLY — this is non-negotiable):
• The animation is a SMARTPHONE mockup centered on a 1024x576 stage. Draw a phone
  body (~320px wide, ~660px tall, rounded ~44px, dark bezel, a small notch/speaker)
  centered horizontally, slightly cropped at the bottom is fine. The APP UI happens
  INSIDE the phone screen. Add a subtle virtual fingertip/cursor (a small glowing
  dot) to show taps. Optionally a brand outro fills the whole stage at the end.
• Timeline is FRAME-BASED at ${FPS}fps. Total length = ${totalFrames} frames
  (~${Math.round(totalFrames / FPS)}s). Split into 4–6 PHASES.
• In the JS you MUST declare exactly:  const TOTAL_FRAMES = ${totalFrames};
  and define  function updateShowcase(frame) { ... }  which, given the current
  frame, shows/hides the right scene and drives every element (transforms, opacity,
  cursor position) purely as a function of \`frame\`. It must be deterministic and
  idempotent (calling it with any frame paints that exact moment — needed for the
  scrubber). Cache DOM refs with document.getElementById at the top.
• DO NOT write any requestAnimationFrame loop, setInterval, setTimeout-driven loop,
  or window 'message' listener. DO NOT call updateShowcase yourself. The host engine
  appends the loop + controls and calls updateShowcase for you.
• SANDBOX: the iframe runs with sandbox="allow-scripts" (no network, no same-origin).
  Use ONLY inline CSS shapes, gradients, box-shadows, and emoji/unicode glyphs for
  imagery. NO external images, fonts, scripts, or fetch(). System fonts only.
• Keep CSS efficient and the JS focused (be concise so the whole thing fits).
  Everything must run offline with zero console errors.
• AESTHETIC: ${STYLE_NOTES[style]}

OUTPUT FORMAT — return PLAIN TEXT with these exact delimiter lines, nothing before
===TITLE=== and nothing after ===END===:
===TITLE===
<short title, one line>
===SCRIPT===
<the 2-5 sentence voiceover/narration script for the video>
===STORYBOARD===
- Phase 1: <what happens> (0s–?s)
- Phase 2: ...
- Phase 3: ...
- Phase 4: ...
===META===
{"totalFrames": ${totalFrames}, "phases": [{"label":"INTRO","frame":0},{"label":"...","frame":<startFrame>}]}
===HTML===
<the inner HTML for the phone + scenes — no <html>/<head>/<body> wrappers>
===CSS===
<the full CSS>
===JS===
<JS: const TOTAL_FRAMES = ${totalFrames}; then function updateShowcase(frame){...}; plus any const DOM refs/helpers. NO loop, NO message listener.>
===END===`;
}

// Tiny worked example so the model copies the exact updateShowcase pattern.
const PATTERN_EXAMPLE = `
PATTERN EXAMPLE (style only — invent your own scenes; keep this structure):
HTML:  <div class="phone"><div class="screen">
         <div class="scene s1" id="s1"><div class="app-title">Hello</div></div>
         <div class="scene s2" id="s2"><div class="card" id="card">Tap</div></div>
       </div><div class="cursor" id="cur"></div></div>
CSS:   .scene{position:absolute;inset:0;opacity:0;transition:opacity .4s}
       .scene.on{opacity:1}  .cursor{position:absolute;width:18px;height:18px;border-radius:50%;
       background:rgba(255,255,255,.9);box-shadow:0 0 14px #fff;opacity:0}
JS:    const TOTAL_FRAMES = 1350;
       const s1=document.getElementById('s1'), s2=document.getElementById('s2'),
             card=document.getElementById('card'), cur=document.getElementById('cur');
       function show(el,on){ el.classList.toggle('on', on); }
       function updateShowcase(frame){
         const p1 = frame < 400, p2 = frame >= 400;
         show(s1,p1); show(s2,p2);
         if(p2){ // animate the cursor tapping the card between frame 420-480
           const t = Math.max(0, Math.min(1,(frame-420)/60));
           cur.style.opacity = t>0?1:0;
           cur.style.left = (160 - 20*t) + 'px'; cur.style.top = (300 - 10*t) + 'px';
           card.style.transform = 'scale(' + (1 - 0.06*Math.sin(t*Math.PI)) + ')';
         }
       }`;

// ─── Parse the delimiter-framed model output ─────────────────────────────────
function section(raw: string, name: string): string {
  // Capture text between ===NAME=== and the next ===WORD=== (or end of string).
  const re = new RegExp(`===\\s*${name}\\s*===\\r?\\n([\\s\\S]*?)(?:\\r?\\n===\\s*[A-Z]+\\s*===|$)`, 'i');
  const m = raw.match(re);
  return m ? m[1].trim() : '';
}

function stripFence(code: string): string {
  return code
    .replace(/^```[a-zA-Z]*\s*\r?\n?/, '')
    .replace(/\r?\n?```\s*$/, '')
    .trim();
}

function parseStoryboard(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map(l => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseMeta(block: string, totalFramesFallback: number): { totalFrames: number; phases: { label: string; frame: number }[] } {
  let totalFrames = totalFramesFallback;
  let phases: { label: string; frame: number }[] = [];
  try {
    const m = block.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      if (Number.isFinite(j.totalFrames) && j.totalFrames > 0) totalFrames = Math.round(j.totalFrames);
      if (Array.isArray(j.phases)) {
        phases = j.phases
          .filter((p: any) => p && typeof p.label === 'string' && Number.isFinite(p.frame))
          .map((p: any) => ({ label: String(p.label).slice(0, 16).toUpperCase(), frame: Math.max(0, Math.round(p.frame)) }))
          .slice(0, 6);
      }
    }
  } catch { /* fall back below */ }
  if (!phases.length) {
    // Even quarters as a sane default.
    phases = [0, 0.25, 0.5, 0.75].map((q, i) => ({ label: `PHASE_${i + 1}`, frame: Math.round(totalFrames * q) }));
  }
  // Always start at 0 and keep ascending.
  phases.sort((a, b) => a.frame - b.frame);
  if (phases[0].frame !== 0) phases.unshift({ label: 'INTRO', frame: 0 });
  return { totalFrames, phases: phases.slice(0, 6) };
}

export function parseAnimation(raw: string, totalFramesFallback: number): Omit<AnimationResult, 'ok' | 'provider' | 'research'> {
  const title = section(raw, 'TITLE').split(/\r?\n/)[0]?.slice(0, 80) || 'Generated Animation';
  const script = section(raw, 'SCRIPT') || '';
  const storyboard = parseStoryboard(section(raw, 'STORYBOARD'));
  const meta = parseMeta(section(raw, 'META'), totalFramesFallback);
  const html = stripFence(section(raw, 'HTML'));
  const css = stripFence(section(raw, 'CSS'));
  let js = stripFence(section(raw, 'JS'));

  if (!html || !js) {
    throw new Error('Model output missing HTML or JS section');
  }
  // Guarantee TOTAL_FRAMES exists even if the model forgot it.
  if (!/TOTAL_FRAMES\s*=/.test(js)) {
    js = `const TOTAL_FRAMES = ${meta.totalFrames};\n` + js;
  }
  // Append the engine playback shim (the loop + protocol we own).
  js = js + '\n' + playbackShim();

  return {
    title,
    script,
    storyboard: storyboard.length ? storyboard : ['Phase 1: Intro', 'Phase 2: Feature', 'Phase 3: Action', 'Phase 4: Outro'],
    phases: meta.phases,
    totalFrames: meta.totalFrames,
    html,
    css,
    js,
  };
}

// ─── Prompt builders ─────────────────────────────────────────────────────────
function ideaPrompt(idea: string, totalFrames: number, style: AniStyle): string {
  return `You are an elite motion-graphics engineer. Build a polished, cinematic SMARTPHONE
app animation from the user's idea/script below. Make it feel premium and on-brand.

USER'S IDEA / SCRIPT:
"""${idea.trim().slice(0, 2000)}"""

Design 4–6 phases that tell this story inside a phone UI (app screens, taps, transitions,
a satisfying outro). Use motion: eases, slides, scale pops, gl.
${PATTERN_EXAMPLE}
${contractBlock(totalFrames, style)}`;
}

function topicPrompt(topic: string, research: string, totalFrames: number, style: AniStyle, hasImages: boolean): string {
  return `You are an elite motion-graphics engineer making a short promo animation for the app
"${topic}". ${hasImages ? 'Screenshots of the real app are attached — match its real UI layout, colors, and key screens.' : ''}

WHAT THE APP IS (use this to script an authentic story — its real identity & signature features):
"""${research.trim().slice(0, 1500)}"""

Write a SCRIPT, then build a phone animation that recreates this app's signature flow
(its iconic screens and the one action it's famous for), ending on a brand outro.
${PATTERN_EXAMPLE}
${contractBlock(totalFrames, style)}`;
}

// Research the topic with REAL web search (keyless DDG, reused from Story Studio), then synthesize a
// factual, script-ready brief. Falls back to model knowledge if search is unavailable.
async function researchApp(topic: string, imagesB64?: string[]): Promise<{ brief: string; sources: string[] }> {
  let webContext = '';
  const sources: string[] = [];
  try {
    const results = await searchWeb(`${topic} features — what it does, latest announcements`, 6);
    for (const r of results.slice(0, 5)) {
      sources.push(r.url);
      webContext += `- ${r.title}${r.snippet ? `: ${r.snippet}` : ''}\n`;
    }
    // Pull deeper text from the single best source for richer, specific detail.
    if (results[0]?.url) {
      try {
        const deep = await fetchPageText(results[0].url, 1800);
        if (deep) webContext += `\nTOP SOURCE EXCERPT (${results[0].url}):\n${deep}\n`;
      } catch { /* snippets alone are fine */ }
    }
  } catch (e: any) {
    console.warn('[AnimationEngine] web search failed; using model knowledge only:', e?.message || e);
  }

  const prompt = `${webContext ? `WEB RESEARCH about "${topic}":\n${webContext}\n` : ''}Using ${webContext ? 'the research above' : 'your own knowledge'}, write a tight brief for a 45-50s promo animation about "${topic}".
Cover, specifically and factually: what it is, its REAL signature features / recent announcements, its visual identity (primary colors, logo vibe), and the ONE iconic moment a promo should recreate.${imagesB64?.length ? ' Screenshots are attached — ground the look in them.' : ''} Keep it to 5-7 sentences.`;
  try {
    const brief = (await visionText({ prompt, imagesB64, maxTokens: 600, temperature: 0.3 })).trim();
    return { brief: brief || webContext || topic, sources };
  } catch (e: any) {
    return { brief: webContext || `${topic} — recreate its signature screen and primary action with its known brand colors.`, sources };
  }
}

// ─── Public: generate ────────────────────────────────────────────────────────
export async function generateAnimation(req: GenerateAnimationReq): Promise<AnimationResult> {
  const style: AniStyle = (['cyberpunk', 'cosmic', 'minimalist'] as AniStyle[]).includes(req.style as AniStyle)
    ? (req.style as AniStyle) : 'cyberpunk';
  const dur = Math.max(15, Math.min(90, req.durationSec || 45));
  const totalFrames = Math.round(dur * FPS);

  let research: string | undefined;
  let sources: string[] | undefined;
  let prompt: string;
  let imagesB64: string[] | undefined;

  if (req.mode === 'topic') {
    const topic = (req.topic || '').trim();
    if (!topic) return errResult('A topic is required for topic mode.');
    imagesB64 = (req.imagesB64 || []).slice(0, 4); // cap to keep payload + tokens sane
    const r = await researchApp(topic, imagesB64);
    research = r.brief;
    sources = r.sources;
    prompt = topicPrompt(topic, r.brief, totalFrames, style, !!imagesB64.length);
  } else {
    const idea = (req.idea || '').trim();
    if (!idea) return errResult('An idea or script is required for idea mode.');
    prompt = ideaPrompt(idea, totalFrames, style);
  }

  try {
    // Use visionText so topic-mode screenshots ground the look; it delegates to the
    // full text chain (Gemini→OpenRouter→browser-AI) when there are no images.
    const raw = await visionText({ prompt, imagesB64, maxTokens: 8192, temperature: 0.6 });
    const parsed = parseAnimation(raw, totalFrames);
    return { ok: true, provider: brainChainSummary(), research, sources, ...parsed };
  } catch (e: any) {
    return errResult(e?.message || String(e), research);
  }
}

// ─── Public: refine ──────────────────────────────────────────────────────────
export async function refineAnimation(req: RefineAnimationReq): Promise<AnimationResult> {
  const refine = (req.refinePrompt || '').trim();
  if (!refine) return errResult('A refinement instruction is required.');

  // Strip our shim from the JS before sending (the model edits only the creative code).
  const cleanJs = (req.js || '').split('// ── ENGINE PLAYBACK SHIM')[0].trim();
  const totalFramesFallback = (() => {
    const m = cleanJs.match(/TOTAL_FRAMES\s*=\s*(\d+)/);
    return m ? parseInt(m[1], 10) : 1350;
  })();

  const prompt = `You are refining an existing phone animation. Apply ONLY this change, keep
everything else intact and working:

CHANGE REQUESTED: "${refine.slice(0, 600)}"

CURRENT CODE:
===HTML===
${(req.html || '').slice(0, 8000)}
===CSS===
${(req.css || '').slice(0, 8000)}
===JS===
${cleanJs.slice(0, 8000)}

Return the FULL updated code in this exact format (keep the same TECHNICAL CONTRACT:
const TOTAL_FRAMES, function updateShowcase(frame), NO loop, NO message listener,
sandbox-safe, no external assets):
===NOTE===
<one short sentence describing what you changed>
===HTML===
<updated html>
===CSS===
<updated css>
===JS===
<updated js>
===END===`;

  try {
    const raw = await brainText({ prompt, maxTokens: 8192 });
    const note = section(raw, 'NOTE').split(/\r?\n/)[0] || 'Applied your refinement.';
    const html = stripFence(section(raw, 'HTML'));
    const css = stripFence(section(raw, 'CSS'));
    let js = stripFence(section(raw, 'JS'));
    if (!html || !js) throw new Error('Refine output missing HTML or JS');
    if (!/TOTAL_FRAMES\s*=/.test(js)) js = `const TOTAL_FRAMES = ${totalFramesFallback};\n` + js;
    js = js + '\n' + playbackShim();
    const meta = parseMeta('', totalFramesFallback);
    return {
      ok: true,
      provider: brainChainSummary(),
      title: 'Refined',
      script: '',
      storyboard: req.storyboard || [],
      phases: meta.phases,
      totalFrames: totalFramesFallback,
      html, css, js,
      note,
    };
  } catch (e: any) {
    return errResult(e?.message || String(e));
  }
}

function errResult(error: string, research?: string): AnimationResult {
  return {
    ok: false, error, research,
    title: '', script: '', storyboard: [], phases: [], totalFrames: 0,
    html: '', css: '', js: '', provider: brainChainSummary(),
  };
}
