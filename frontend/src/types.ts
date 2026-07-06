export interface LogStep {
  step: string;
  timestamp: number;
  description: string;
}

export interface DemoItem {
  id: string;
  projectId: string;
  taskId: string;
  stepName: string;
  videoPath: string;
  audioPath: string | null;
  script: string;
  duration: number;
  createdAt?: string;
}

export interface BugReport {
  id: string;
  projectId: string;
  taskId: string;
  error: string;
  stepsBeforeFailure: LogStep[];
  reportPath: string;
  timestamp: string;
}

export interface CrawlSession {
  id: string;
  targetUrl: string;
  status: 'completed' | 'failed' | 'running';
  discoveredPages: string[];
  screenshots: Record<string, string>;
  videoPath: string;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
}

export interface EventItem {
  id: number;
  type: string;
  message: string;
  metadata: Record<string, any>;
  createdAt: string;
}
