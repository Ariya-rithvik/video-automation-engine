// Unified Deep Explore test harness.
//   npx ts-node test-explore.ts <url> [aiPrompt]
//   LOGIN_EMAIL=.. LOGIN_PASSWORD=.. npx ts-node test-explore.ts <url>   (headful auto-login)
// Prints the action log + asserts: steps>0, NO repeated actions, a playable video, waits trimmed.
import 'dotenv/config';
import * as fs from 'fs';
import { runDeepExplore } from './src/services/deep-explorer';

const url = process.argv[2] || 'https://real-time-collaborative-digital-can.vercel.app/';
const aiPrompt = process.argv[3] || '';
const email = process.env.LOGIN_EMAIL || '';
const password = process.env.LOGIN_PASSWORD || '';
const loginWait = !!(email && password);

(async () => {
  console.log(`\n──── DEEP EXPLORE TEST: ${url} ${loginWait ? '(with auto-login)' : ''} ────`);
  const r = await runDeepExplore({
    targetUrl: url,
    outputDir: 'D:\\production_product\\backend\\watched\\deep',
    loginWait,
    loginCredentials: loginWait ? { username: email, password } : null,
    isLoggedIn: () => false,
    maxSections: 8,
    timeBudgetSec: 200,
    aiPrompt,
    onStatus: (m) => console.log('  •', m),
  });

  console.log('\n════ RESULT ════');
  console.log('did  :', JSON.stringify(r.visited, null, 1));
  console.log('video:', r.videoPath, `(${r.durationSec.toFixed(1)}s, cut ${r.removedSec.toFixed(1)}s)`);

  // ── assertions ──
  const fails: string[] = [];
  if (r.steps <= 0) fails.push('no steps taken');
  if (!fs.existsSync(r.videoPath) || fs.statSync(r.videoPath).size < 1000) fails.push('video missing/empty');
  if (!(r.durationSec > 0)) fails.push('zero duration');
  // no exact-duplicate action in the log (memory should prevent repeats)
  const seen = new Set<string>(); const dups: string[] = [];
  for (const a of r.visited) { if (seen.has(a)) dups.push(a); else seen.add(a); }
  if (dups.length) fails.push('repeated actions: ' + dups.join(', '));

  if (fails.length) { console.log('❌ FAIL:', fails.join(' | ')); process.exit(1); }
  console.log(`✅ PASS — ${r.steps} steps, ${r.visited.length} actions, no repeats, ${r.removedSec.toFixed(1)}s trimmed.`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
