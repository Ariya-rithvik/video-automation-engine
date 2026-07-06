// Headless verification of football.html: scrub every phase, check zero errors,
// confirm real images + video load, and screenshot key frames for visual review.
import puppeteer from 'puppeteer';
import * as path from 'path';

const URL = 'http://localhost:5000/animation/football.html';
const SHOT = (n: string) => path.join('D:\\production_product\\animation', `_test_${n}.png`);

(async () => {
  let pass = 0, fail = 0;
  const ok = (n: string, c: boolean, extra = '') => { c ? pass++ : fail++; console.log(`${c ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 760, deviceScaleFactor: 1 });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.bringToFront();

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));

  const seek = async (f: number) => {
    await page.evaluate((fr) => {
      const s = document.getElementById('scrub') as HTMLInputElement;
      s.value = String(fr); s.dispatchEvent(new Event('input', { bubbles: true }));
    }, f);
    await new Promise(r => setTimeout(r, 450));
  };
  const opacity = (sel: string) => page.$eval(sel, el => parseFloat(getComputedStyle(el).opacity));
  const imgOk = (sel: string) => page.$eval(sel, (el: any) => el.complete && el.naturalWidth > 0);

  // P1 lock
  await seek(60); ok('P1 lock visible', await opacity('#lock') > 0.8);
  await page.$eval('.stage', el => (el as any).scrollIntoView()); await (await page.$('.stage'))!.screenshot({ path: SHOT('1lock') });

  // P2 home
  await seek(520); ok('P2 home visible', await opacity('#home') > 0.8);
  ok('home apps rendered', (await page.$$('#apps .app')).length === 16, `${(await page.$$('#apps .app')).length} apps`);
  await (await page.$('.stage'))!.screenshot({ path: SHOT('2home') });

  // P3 gallery — real images loaded
  await seek(760); ok('P3 gallery visible', await opacity('#photos') > 0.8);
  ok('gallery thumb 0 image loaded', await imgOk('#ph-grid .thumb:nth-child(1) img'));
  ok('gallery thumb 6 image loaded', await imgOk('#ph-grid .thumb:nth-child(7) img'));
  await (await page.$('.stage'))!.screenshot({ path: SHOT('3gallery') });

  // P4 fullscreen photo
  await seek(1010); ok('P4 fullscreen visible', await opacity('#full') > 0.7);
  ok('fullscreen photo loaded', await imgOk('#full-img'));
  await (await page.$('.stage'))!.screenshot({ path: SHOT('4photo') });

  // P5 video — real video element healthy
  await seek(1320);
  const vinfo = await page.$eval('#finale-video', (v: any) => ({ dur: v.duration, vw: v.videoWidth, rs: v.readyState, ct: v.currentTime }));
  ok('P5 video scene visible', await opacity('#videoScene') > 0.8);
  ok('video has duration', vinfo.dur > 0, `dur=${(vinfo.dur || 0).toFixed(1)}s`);
  ok('video decodes frames', vinfo.vw > 0, `${vinfo.vw}px wide, readyState=${vinfo.rs}`);
  await (await page.$('.stage'))!.screenshot({ path: SHOT('5video') });

  // video actually plays forward
  await page.evaluate(() => {
    const b = document.getElementById('btn-play')!; // resume play
    const v = document.getElementById('finale-video') as HTMLVideoElement;
    v.currentTime = 0;
  });
  await page.evaluate(() => { (document.getElementById('finale-video') as HTMLVideoElement).play().catch(() => {}); });
  const t1 = await page.$eval('#finale-video', (v: any) => v.currentTime);
  await new Promise(r => setTimeout(r, 900));
  const t2 = await page.$eval('#finale-video', (v: any) => v.currentTime);
  ok('video plays (time advances)', t2 > t1, `${t1.toFixed(2)}→${t2.toFixed(2)}`);

  ok('zero console/page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n${fail === 0 ? '🎉 ALL PASS' : '⚠️  ' + fail + ' FAILED'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
