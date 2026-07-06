import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { ExecutionLog } from './watcher';
import { generatePresentationScript } from './services/gemini';
import { generateVoiceover } from './services/elevenlabs';
import { insertDemo } from './services/database';

// Check if ffmpeg is available on the system
let isFfmpegAvailable = false;
exec('ffmpeg -version', (err) => {
  if (!err) {
    isFfmpegAvailable = true;
    console.log('[Slicer] ffmpeg detected and ready for high-fidelity slicing.');
  } else {
    console.warn('[Slicer] WARNING: ffmpeg not detected in system PATH. Slicer will operate in Robust Mock Mode (copying/linking files).');
  }
});

export async function processSuccessRun(videoPath: string, log: ExecutionLog, outputDir: string) {
  console.log(`[Slicer] Processing video: ${videoPath} with ${log.steps.length} steps.`);
  fs.mkdirSync(outputDir, { recursive: true });
  
  for (let i = 0; i < log.steps.length; i++) {
    const step = log.steps[i];
    const segmentId = `${log.projectId}-${log.taskId}-${step.step.replace(/\s+/g, '_')}`;
    const outputVideoName = `segment-${segmentId}.mp4`;
    const outputVideoPath = path.join(outputDir, outputVideoName);
    
    const startTime = step.timestamp;
    const duration = 10; // Exactly 10 seconds as per blueprint

    console.log(`[Slicer] Slicing segment for step "${step.step}" starting at ${startTime}s...`);

    try {
      if (isFfmpegAvailable) {
        await sliceVideoWithFfmpeg(videoPath, startTime, duration, outputVideoPath);
      } else {
        await sliceVideoMock(videoPath, outputVideoPath);
      }

      console.log(`[Slicer] Segment saved successfully at: ${outputVideoPath}`);

      // Phase 3: Gemini generates a stunning script for this 10-second segment
      console.log(`[Slicer] AI: Generating script for step "${step.step}" via Gemini...`);
      const script = await generatePresentationScript(step, log);
      console.log(`[Slicer] Generated Script: "${script}"`);

      // Phase 3: ElevenLabs generates a voiceover track
      console.log(`[Slicer] AI: Generating neural voiceover via ElevenLabs...`);
      const audioPath = await generateVoiceover(segmentId, script, outputDir);

      // Persist to SQLite database (replaces old in-memory demoRegistry)
      insertDemo({
        id: segmentId,
        projectId: log.projectId,
        taskId: log.taskId,
        stepName: step.step,
        videoPath: outputVideoPath,
        audioPath: audioPath,
        script: script,
        duration: duration,
      });

    } catch (error) {
      console.error(`[Slicer] Error processing segment for step "${step.step}":`, error);
    }
  }
}

function sliceVideoWithFfmpeg(inputPath: string, start: number, duration: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -y -ss ${start} -i "${inputPath}" -t ${duration} -c:v libx264 -c:a aac -strict -2 -b:v 1500k -profile:v high -level 4.1 "${outputPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(`[Slicer] ffmpeg failed to slice. Falling back to copy simulation. Info: ${error.message}`);
        fs.copyFile(inputPath, outputPath, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  });
}

function sliceVideoMock(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.copyFile(inputPath, outputPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
