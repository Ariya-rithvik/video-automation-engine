import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { processSuccessRun } from './slicer';
import { insertBugReport, addEvent } from './services/database';

export interface LogStep {
  step: string;
  timestamp: number; // in seconds
  description: string;
}

export interface ExecutionLog {
  status: 'SUCCESS' | 'FAILURE' | 'ERROR';
  projectId: string;
  taskId: string;
  steps: LogStep[];
  error?: string | null;
}

export function initWatcher(watchDir: string, outputDir: string, reportsDir: string) {
  // Ensure directories exist
  if (!fs.existsSync(watchDir)) fs.mkdirSync(watchDir, { recursive: true });
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  console.log(`[Watcher] Initializing file watcher on: ${watchDir}`);

  const watcher = chokidar.watch(watchDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
  });

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.json') return;

    console.log(`[Watcher] New execution log detected: ${path.basename(filePath)}`);
    
    // Allow a small delay for both files (.mp4 and .json) to finish writing
    setTimeout(async () => {
      try {
        const logContent = fs.readFileSync(filePath, 'utf-8');
        const log: ExecutionLog = JSON.parse(logContent);
        
        const baseName = path.basename(filePath, '.json');
        const videoPath = path.join(path.dirname(filePath), `${baseName}.mp4`);

        addEvent('log_detected', `Execution log detected: ${path.basename(filePath)}`, JSON.stringify({ status: log.status, projectId: log.projectId }));

        if (log.status === 'SUCCESS') {
          if (!fs.existsSync(videoPath)) {
            console.error(`[Watcher] SUCCESS log found but matching video file does not exist at: ${videoPath}`);
            return;
          }
          console.log(`[Watcher] Validation PASSED for Task ${log.taskId}. Slicing video...`);
          await processSuccessRun(videoPath, log, outputDir);
        } else {
          console.warn(`[Watcher] Validation FAILED for Task ${log.taskId}. Generating Bug-Fix Replay Report...`);
          generateBugReport(log, reportsDir);
        }
      } catch (err) {
        console.error(`[Watcher] Error parsing log file ${filePath}:`, err);
      }
    }, 1000);
  });
}

function generateBugReport(log: ExecutionLog, reportsDir: string) {
  const reportId = `${log.projectId}-${log.taskId}-${Date.now()}`;
  const reportFileName = `bug-report-${reportId}.json`;
  const reportPath = path.join(reportsDir, reportFileName);

  const report = {
    id: reportId,
    projectId: log.projectId,
    taskId: log.taskId,
    error: log.error || 'Unknown execution error occurred during browser workflow.',
    stepsBeforeFailure: log.steps || [],
    reportPath: reportPath,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  
  // Persist to database
  insertBugReport(report);

  console.log(`[Watcher] Bug-Fix Replay generated successfully at: ${reportPath}`);
}
