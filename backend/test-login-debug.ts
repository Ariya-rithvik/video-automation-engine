// Focused CollabCanvas login + post-login "hands" debug. Captures screenshots at each stage so we can SEE
// exactly where it breaks. Run: npx ts-node test-login-debug.ts
import 'dotenv/config';
import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import { attemptAutoLogin, isLikelyLoggedIn } from './src/services/web-login';
import { markInteractive } from './src/services/app-demo';
puppeteer.use(Stealth());

const OUT = 'D:\\production_product\\backend\\watched\\deep';
const URL = process.argv[2] || 'https://real-time-collaborative-digital-can.vercel.app/';
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

(async () => {
  const b = await (puppeteer as any).launch({ headless: false, defaultViewport: { width: 1440, height: 900 }, args: ['--no-sandbox', '--start-maximized'] });
  const page = (await b.pages())[0];
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(2500);
  await page.screenshot({ path: OUT + '\\dbg_1_landing.png' });
  console.log('① landing url:', page.url());

  const t0 = Date.now();
  const ok = await attemptAutoLogin(page, { username: 'ariya23jg@gmail.com', password: '123456' }, { screenshotDir: OUT });
  await sleep(2500);
  await page.screenshot({ path: OUT + '\\dbg_2_afterlogin.png' });
  const likely = await isLikelyLoggedIn(page);
  console.log(`② auto-login ok=${ok}  likely=${likely}  url=${page.url()}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  // does the page still show a password field? (means still on login)
  const hasPw = await page.evaluate(() => !!document.querySelector('input[type=password]')).catch(() => false);
  console.log('   still has password field?', hasPw);

  // POST-LOGIN hands test: can we see the app's interactive elements?
  const marks = await markInteractive(page);
  console.log('③ marks found:', marks.length);
  console.log(marks.slice(0, 22).map(m => `   ${m.id}[${m.kind}] ${m.label}`).join('\n'));
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas')).catch(() => false);
  console.log('   canvas present?', hasCanvas);
  await page.screenshot({ path: OUT + '\\dbg_3_marks.png' });

  await b.close();
  process.exit(0);
})().catch(e => { console.error('DEBUG FAILED:', e); process.exit(1); });
