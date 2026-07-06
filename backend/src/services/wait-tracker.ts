// Wait-time tracker → cut dead time out of a recorded crawl/agent video.
//
// The agent spends big chunks just WAITING (≈20s per free-vision Gemini call, page loads, etc.).
// We log each wait as an interval (relative to the recording's start clock), then ffmpeg removes
// those ranges so the final video is tight. Best structure = an ORDERED ARRAY of {start,end,reason}
// intervals (no key needed — a hashmap buys nothing for "delete these time ranges").

import { execFile } from 'child_process';
import * as fs from 'fs';

export interface WaitInterval { startSec: number; endSec: number; reason: string; }

export class WaitTracker {
  private t0 = Date.now();
  private cur: { start: number; reason: string } | null = null;
  readonly intervals: WaitInterval[] = [];

  /** Call once when the screen recording starts so wait times line up with video time. */
  reset() { this.t0 = Date.now(); this.cur = null; this.intervals.length = 0; }

  private now() { return (Date.now() - this.t0) / 1000; }

  /** Mark the start of a wait (brain call, navigation, sleep…). */
  begin(reason: string) { if (this.cur) this.end(); this.cur = { start: this.now(), reason }; }

  /** Mark the end of the current wait (ignores blips < 0.4s). */
  end() {
    if (!this.cur) return;
    const endSec = this.now();
    if (endSec - this.cur.start >= 0.4) this.intervals.push({ startSec: this.cur.start, endSec, reason: this.cur.reason });
    this.cur = null;
  }

  /** Convenience: time an async op as a tracked wait. */
  async wrap<T>(reason: string, fn: () => Promise<T>): Promise<T> {
    this.begin(reason);
    try { return await fn(); } finally { this.end(); }
  }

  totalWaitSec(): number { return this.intervals.reduce((s, i) => s + (i.endSec - i.startSec), 0); }

  /** Merge overlapping/adjacent intervals (defensive) and sort. */
  normalized(padSec = 0.15): WaitInterval[] {
    const xs = [...this.intervals].sort((a, b) => a.startSec - b.startSec);
    const out: WaitInterval[] = [];
    for (const iv of xs) {
      const s = Math.max(0, iv.startSec + padSec), e = iv.endSec - padSec; // shave edges so cuts aren't abrupt
      if (e <= s) continue;
      const last = out[out.length - 1];
      if (last && s <= last.endSec + 0.1) { last.endSec = Math.max(last.endSec, e); last.reason += ' + ' + iv.reason; }
      else out.push({ startSec: s, endSec: e, reason: iv.reason });
    }
    return out;
  }
}

/**
 * Remove the given (dead) intervals from a SILENT video → a tight cut.
 * Our crawl screencasts have no audio, so a video-only select filter is enough.
 */
export function cutWaitsFromVideo(input: string, intervals: WaitInterval[], output: string, fps = 30): Promise<{ cut: boolean; removedSec: number }> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(input)) return reject(new Error('cutWaits: input not found: ' + input));
    const keepers = intervals.filter(i => i.endSec > i.startSec);
    if (!keepers.length) { fs.copyFileSync(input, output); return resolve({ cut: false, removedSec: 0 }); }
    // Drop frames whose timestamp falls inside ANY wait range, then re-stamp PTS so it's seamless.
    const drop = keepers.map(i => `between(t,${i.startSec.toFixed(2)},${i.endSec.toFixed(2)})`).join('+');
    const vf = `select='not(${drop})',setpts=N/FRAME_RATE/TB`;
    const removedSec = keepers.reduce((s, i) => s + (i.endSec - i.startSec), 0);
    const args = ['-y', '-i', input, '-vf', vf, '-r', String(fps), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output];
    execFile('ffmpeg', args, { timeout: 300000 }, (err) => {
      if (err) return reject(new Error('cutWaits ffmpeg failed: ' + (err.message || err)));
      resolve({ cut: true, removedSec });
    });
  });
}
