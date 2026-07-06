// Deterministic test of the animation pipeline WITHOUT the cloud brain:
//   1) feed a representative delimiter-framed "model output" through parseAnimation
//   2) assemble the sandbox doc exactly like the engine does
//   3) actually RUN it in headless Chrome → prove the playback shim auto-plays,
//      honors SEEK, and throws zero errors.
import puppeteer from 'puppeteer';
import { parseAnimation } from './src/services/animation-engine';

// A realistic phone music-app animation in the exact format the AI is told to emit.
const RAW = `Here is your animation:
===TITLE===
Pulse — Feel the Beat
===SCRIPT===
Open Pulse and the Now Playing screen glows to life. Tap play and the equalizer dances to the beat. It ends on a bold Pulse logo.
===STORYBOARD===
- Phase 1: Now Playing screen fades in (0s-4s)
- Phase 2: Tap play, equalizer comes alive (4s-18s)
- Phase 3: Pulse logo outro (18s-30s)
===META===
{"totalFrames": 900, "phases": [{"label":"NOWPLAYING","frame":0},{"label":"EQUALIZER","frame":120},{"label":"OUTRO","frame":540}]}
===HTML===
<div class="phone"><div class="screen">
  <div class="scene np on" id="np">
    <div class="art"></div><div class="track">Midnight Drive</div>
    <div class="eq" id="eq"><i></i><i></i><i></i><i></i><i></i></div>
    <button class="play" id="play">PLAY</button>
  </div>
  <div class="scene outro" id="outro"><div class="logo">PULSE</div><div class="tag">FEEL THE BEAT</div></div>
</div><div class="cursor" id="cur"></div></div>
===CSS===
body{margin:0;background:#05060a;font-family:system-ui;overflow:hidden}
.phone{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:320px;height:640px;border-radius:44px;background:#0b0f1a;border:10px solid #11151f;box-shadow:0 0 60px rgba(0,212,255,.15)}
.screen{position:absolute;inset:10px;border-radius:34px;overflow:hidden;background:radial-gradient(circle at 50% 20%,#10243a,#05060a)}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;opacity:0;transition:opacity .5s}
.scene.on{opacity:1}
.art{width:160px;height:160px;border-radius:18px;background:linear-gradient(135deg,#00d4ff,#7a00ff);box-shadow:0 0 30px rgba(0,212,255,.5)}
.track{color:#fff;font-weight:700;font-size:18px}
.eq{display:flex;gap:6px;height:60px;align-items:flex-end}
.eq i{width:10px;height:10px;background:#00d4ff;border-radius:3px;box-shadow:0 0 10px #00d4ff}
.play{background:#00d4ff;color:#04121a;border:0;border-radius:20px;padding:8px 22px;font-weight:900}
.logo{color:#00d4ff;font-size:48px;font-weight:900;letter-spacing:2px;text-shadow:0 0 30px rgba(0,212,255,.6)}
.tag{color:#cbd5e1;letter-spacing:4px;font-size:12px;margin-top:8px}
.cursor{position:absolute;width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 16px #fff;opacity:0;pointer-events:none}
===JS===
const TOTAL_FRAMES = 900;
const np = document.getElementById('np');
const outro = document.getElementById('outro');
const bars = Array.from(document.querySelectorAll('.eq i'));
const cur = document.getElementById('cur');
function show(el,on){ el.classList.toggle('on', on); }
function updateShowcase(frame){
  const inOutro = frame >= 540;
  show(np, !inOutro);
  show(outro, inOutro);
  // cursor taps PLAY around frame 90-130
  if(frame>=90 && frame<540){
    const t = Math.max(0, Math.min(1,(frame-90)/40));
    cur.style.opacity = (t>0 && t<1)?1:0;
    cur.style.left = (220 - 40*t)+'px';
    cur.style.top = (430 - 10*t)+'px';
  } else { cur.style.opacity = 0; }
  // equalizer dances once playing (frame>=120)
  if(frame>=120 && !inOutro){
    bars.forEach((b,i)=>{ const h = 12 + 44*Math.abs(Math.sin((frame*0.12)+(i*0.9))); b.style.height = h+'px'; });
  }
}
===END===`;

(async () => {
  let pass = 0, fail = 0;
  const ok = (name: string, cond: boolean, extra = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✅' : '❌'} ${name}${extra ? '  — ' + extra : ''}`); };

  // ── 1) Parse ──
  const a = parseAnimation(RAW, 900);
  ok('title parsed', a.title === 'Pulse — Feel the Beat', a.title);
  ok('script parsed', a.script.includes('Now Playing'));
  ok('storyboard 3 phases', a.storyboard.length === 3, `${a.storyboard.length}`);
  ok('meta phases parsed', a.phases.length === 3 && a.phases[0].frame === 0, JSON.stringify(a.phases));
  ok('totalFrames 900', a.totalFrames === 900, `${a.totalFrames}`);
  ok('html has phone', a.html.includes('class="phone"'));
  ok('css extracted', a.css.includes('.eq i'));
  ok('js has updateShowcase', a.js.includes('function updateShowcase'));
  ok('js keeps TOTAL_FRAMES', /TOTAL_FRAMES\s*=\s*900/.test(a.js));
  ok('SHIM appended', a.js.includes('ENGINE PLAYBACK SHIM') && a.js.includes('FRAME_UPDATE'));
  ok('no stray delimiters in code', !a.html.includes('===') && !a.js.includes('===CSS==='));

  // ── 2) Assemble exactly like the engine ──
  const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${a.css}</style></head><body>${a.html}<script>${a.js}<\/script></body></html>`;

  // ── 3) Run it for real ──
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.bringToFront();   // ensure rAF isn't throttled as a background tab
  await page.setContent(doc, { waitUntil: 'load' });
  await page.evaluate(() => {
    (window as any).__frames = [];
    window.addEventListener('message', (e: any) => { if (e.data && e.data.type === 'FRAME_UPDATE') (window as any).__frames.push(e.data.frame); });
  });

  await new Promise(r => setTimeout(r, 900));
  const autoFrames: number[] = await page.evaluate(() => (window as any).__frames.slice());
  ok('phone rendered in DOM', await page.$('.phone') !== null);
  ok('shim auto-plays (FRAME_UPDATE firing)', autoFrames.length > 3, `${autoFrames.length} ticks`);
  ok('frames advance over time', autoFrames[autoFrames.length - 1] > autoFrames[0], `${autoFrames[0]?.toFixed(0)}→${autoFrames[autoFrames.length - 1]?.toFixed(0)}`);

  // SEEK while paused → frame should pin near 600
  await page.evaluate(() => { window.postMessage({ type: 'SET_PLAYING', playing: false }, '*'); window.postMessage({ type: 'SEEK', frame: 600 }, '*'); (window as any).__frames = []; });
  await new Promise(r => setTimeout(r, 700));   // let the sample's .5s opacity transition settle
  const seekFrames: number[] = await page.evaluate(() => (window as any).__frames.slice());
  const lastSeek = seekFrames[seekFrames.length - 1] ?? -1;
  ok('SEEK honored (paused at ~600)', Math.abs(lastSeek - 600) < 2, `last=${lastSeek}`);

  // outro scene visible at frame 600
  const outroVisible = await page.evaluate(() => getComputedStyle(document.getElementById('outro')!).opacity);
  ok('updateShowcase painted outro at f600', parseFloat(outroVisible) > 0.5, `opacity=${outroVisible}`);

  ok('zero runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
