import 'dotenv/config';
import { runAppDemo } from './src/services/app-demo';

const url = process.argv[2] || 'https://real-time-collaborative-digital-can.vercel.app/';
const aiPrompt = process.argv[3] || 'draw a smiling sun with rays';

(async () => {
  const r = await runAppDemo({
    targetUrl: url,
    outputDir: 'D:\\production_product\\backend\\watched\\deep',
    loginWait: false,
    fps: 7,
    timeBudgetSec: 150,
    maxSteps: 8,
    aiPrompt,
    onStatus: (m) => console.log('  •', m),
  });
  console.log('\n════ RESULT (' + url + ') ════');
  console.log('did  :', JSON.stringify(r.did, null, 1));
  console.log('video:', r.videoPath, `(${r.durationSec.toFixed(1)}s, cut ${r.removedSec.toFixed(1)}s of waits)`);
  process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
