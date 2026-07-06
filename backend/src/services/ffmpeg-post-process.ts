// FFmpeg post-process — applies cinematic polish to Remotion's raw render.
// Headless, deterministic, runs after renderMedia produces the raw MP4.
//
// Filter chain (in order):
//   1. Slight contrast + saturation bump (gives "graded" feel)
//   2. Soft vignette (darkens corners — cinematic framing)
//   3. Subtle film grain (organic texture)
//   4. Optional bloom on highlights (premium glow)
//
// No external LUT file required — uses FFmpeg's built-in `eq`, `vignette`, `noise` filters.
// If `ffmpeg` is not in PATH the post-process is a no-op and we return the input file unchanged.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface PostProcessOptions {
  // Light: subtle grade, barely-perceptible grain. Good default for clean professional demos.
  // Medium: more saturation, more grain, deeper vignette. Premium look.
  // Heavy: cinematic — strong grade, heavy grain, dramatic vignette + bloom.
  intensity?: 'light' | 'medium' | 'heavy';
  // Skip the post-process entirely (for debugging / comparing before/after)
  skip?: boolean;
}

export interface PostProcessResult {
  success: boolean;
  outputPath: string;          // path of the polished file (or input if skipped/failed)
  appliedFilters: string[];    // human-readable list of what was applied
  durationMs: number;
  error: string | null;
}

function filterChainFor(intensity: 'light' | 'medium' | 'heavy'): string {
  // Each filter chain is one continuous -vf argument
  switch (intensity) {
    case 'heavy':
      return [
        // Lift shadows slightly + boost contrast + saturation
        'curves=master=\'0/0.05 0.5/0.5 1/1\'',
        'eq=contrast=1.12:saturation=1.15:brightness=0.01',
        // Strong vignette — narrower aperture = darker corners
        'vignette=PI/4',
        // Heavier film grain
        'noise=alls=10:allf=t',
        // Subtle bloom approximation: gaussian blur then screen-blend back
        'split[a][b];[b]gblur=sigma=18:steps=2,eq=brightness=0.2[blur];[a][blur]blend=all_mode=screen:all_opacity=0.18',
      ].join(',');

    case 'medium':
      return [
        'eq=contrast=1.08:saturation=1.08:brightness=0.005',
        'vignette=PI/5',
        'noise=alls=6:allf=t',
      ].join(',');

    case 'light':
    default:
      return [
        'eq=contrast=1.05:saturation=1.04',
        'vignette=PI/6',
        'noise=alls=3:allf=t',
      ].join(',');
  }
}

export function postProcessVideo(
  inputPath: string,
  opts: PostProcessOptions = {},
): Promise<PostProcessResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const intensity = opts.intensity || 'medium';

    if (opts.skip) {
      resolve({
        success: true,
        outputPath: inputPath,
        appliedFilters: ['(skipped)'],
        durationMs: 0,
        error: null,
      });
      return;
    }

    if (!fs.existsSync(inputPath)) {
      resolve({
        success: false,
        outputPath: inputPath,
        appliedFilters: [],
        durationMs: 0,
        error: `Input not found: ${inputPath}`,
      });
      return;
    }

    const ext = path.extname(inputPath);
    const base = inputPath.slice(0, -ext.length);
    const outputPath = `${base}-polished${ext}`;
    const filterChain = filterChainFor(intensity);

    // FFmpeg arguments. -y overwrites, -preset fast for speed, crf 20 for good quality.
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', filterChain,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      outputPath,
    ];

    console.log(`[FFmpegPostProcess] Starting ${intensity} grade on ${path.basename(inputPath)}`);
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      // ffmpeg not installed or not on PATH — fail gracefully, return original
      console.warn('[FFmpegPostProcess] ffmpeg spawn failed:', err.message);
      resolve({
        success: false,
        outputPath: inputPath,
        appliedFilters: [],
        durationMs: Date.now() - startedAt,
        error: `ffmpeg not available: ${err.message}`,
      });
    });

    proc.on('close', (code) => {
      const durationMs = Date.now() - startedAt;
      if (code === 0 && fs.existsSync(outputPath)) {
        const filters = filterChain.split(',').map(f => f.split('=')[0]);
        console.log(`[FFmpegPostProcess] ✅ Polished in ${durationMs}ms → ${path.basename(outputPath)}`);
        resolve({
          success: true,
          outputPath,
          appliedFilters: filters,
          durationMs,
          error: null,
        });
      } else {
        const tail = stderr.split('\n').slice(-6).join('\n');
        console.error(`[FFmpegPostProcess] ❌ exit ${code}. Tail of stderr:\n${tail}`);
        resolve({
          success: false,
          outputPath: inputPath, // fallback to original
          appliedFilters: [],
          durationMs,
          error: `ffmpeg exit ${code}: ${tail.slice(0, 300)}`,
        });
      }
    });
  });
}
