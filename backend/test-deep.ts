import 'dotenv/config';
import { runDeepExplore } from './src/services/deep-explorer';
import { brainChainSummary } from './src/services/vision-brain';

(async () => {
  console.log('brain chain:', brainChainSummary());
  const r = await runDeepExplore({
    targetUrl: 'https://real-time-collaborative-digital-can.vercel.app/',
    outputDir: 'D:\\production_product\\backend\\watched\\deep',
    loginWait: false,
    maxSections: 4,
    maxDepth: 0,
    fps: 6,
    timeBudgetSec: 110,
    onStatus: (m) => console.log('  •', m),
  });
  console.log('\n════ RESULT ════');
  console.log('visited :', JSON.stringify(r.visited));
  console.log('steps   :', r.steps);
  console.log('video   :', r.videoPath, '(' + r.durationSec.toFixed(1) + 's, cut ' + r.removedSec.toFixed(1) + 's of waits)');
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
