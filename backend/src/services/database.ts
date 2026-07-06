import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

let db: Database.Database;

export function initDatabase(dataDir: string): Database.Database {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'ade.sqlite');
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS demos (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      step_name TEXT NOT NULL,
      video_path TEXT,
      audio_path TEXT,
      script TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      error TEXT NOT NULL,
      steps_json TEXT NOT NULL DEFAULT '[]',
      report_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS crawl_sessions (
      id TEXT PRIMARY KEY,
      target_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      discovered_pages TEXT NOT NULL DEFAULT '[]',
      screenshots_json TEXT NOT NULL DEFAULT '{}',
      video_path TEXT,
      duration_seconds REAL DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gemini_results (
      id TEXT PRIMARY KEY,
      crawl_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      screenshots_used TEXT NOT NULL DEFAULT '[]',
      video_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS marketing_jobs (
      id TEXT PRIMARY KEY,
      crawl_id TEXT NOT NULL,
      scene_plan_json TEXT NOT NULL DEFAULT '{}',
      video_path TEXT,
      shorts_video_path TEXT,
      duration_seconds REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS omni_clips (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      source_url TEXT,
      prompt TEXT,
      used_in_marketing INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS search_crawls (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      query TEXT NOT NULL,
      results_url TEXT,
      screenshot_paths_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ─── Migrations for existing DBs (CREATE TABLE IF NOT EXISTS won't add new columns) ──
  migrateAddColumn('marketing_jobs', 'shorts_video_path', 'TEXT');

  console.log('[Database] SQLite initialized at:', dbPath);
  return db;
}

// Safely add a column if it doesn't already exist (SQLite has no ADD COLUMN IF NOT EXISTS).
function migrateAddColumn(table: string, column: string, type: string) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
      console.log(`[Database] Migrated: added ${table}.${column}`);
    }
  } catch (err) {
    console.warn(`[Database] Migration ${table}.${column} failed:`, err);
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// ─── Demo Operations ─────────────────────────────────────────────────────────

export function insertDemo(demo: {
  id: string;
  projectId: string;
  taskId: string;
  stepName: string;
  videoPath: string;
  audioPath: string | null;
  script: string;
  duration: number;
}) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO demos (id, project_id, task_id, step_name, video_path, audio_path, script, duration)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(demo.id, demo.projectId, demo.taskId, demo.stepName, demo.videoPath, demo.audioPath, demo.script, demo.duration);
  addEvent('demo_created', `Demo segment created: ${demo.stepName}`, JSON.stringify({ demoId: demo.id }));
}

export function getAllDemos() {
  return getDb().prepare('SELECT * FROM demos ORDER BY created_at DESC').all().map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    stepName: row.step_name,
    videoPath: row.video_path,
    audioPath: row.audio_path,
    script: row.script,
    duration: row.duration,
    createdAt: row.created_at,
  }));
}

export function getDemoById(id: string) {
  const row: any = getDb().prepare('SELECT * FROM demos WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    stepName: row.step_name,
    videoPath: row.video_path,
    audioPath: row.audio_path,
    script: row.script,
    duration: row.duration,
    createdAt: row.created_at,
  };
}

export function deleteDemo(id: string) {
  getDb().prepare('DELETE FROM demos WHERE id = ?').run(id);
}

// ─── Bug Report Operations ───────────────────────────────────────────────────

export function insertBugReport(report: {
  id: string;
  projectId: string;
  taskId: string;
  error: string;
  stepsBeforeFailure: any[];
  reportPath: string;
}) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO bug_reports (id, project_id, task_id, error, steps_json, report_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(report.id, report.projectId, report.taskId, report.error, JSON.stringify(report.stepsBeforeFailure), report.reportPath);
  addEvent('bug_reported', `Bug report: ${report.error.substring(0, 80)}`, JSON.stringify({ reportId: report.id }));
}

export function getAllBugReports() {
  return getDb().prepare('SELECT * FROM bug_reports ORDER BY created_at DESC').all().map((row: any) => ({
    id: row.id,
    projectId: row.project_id,
    taskId: row.task_id,
    error: row.error,
    stepsBeforeFailure: JSON.parse(row.steps_json || '[]'),
    reportPath: row.report_path,
    timestamp: row.created_at,
  }));
}

export function deleteBugReport(id: string) {
  getDb().prepare('DELETE FROM bug_reports WHERE id = ?').run(id);
}

// ─── Crawl Session Operations ────────────────────────────────────────────────

export function insertCrawlSession(session: {
  id: string;
  targetUrl: string;
  status: string;
  discoveredPages: string[];
  screenshots: { [key: string]: string };
  videoPath: string;
  durationSeconds: number;
  startedAt: string;
  completedAt: string;
}) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO crawl_sessions (id, target_url, status, discovered_pages, screenshots_json, video_path, duration_seconds, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    session.id, session.targetUrl, session.status,
    JSON.stringify(session.discoveredPages), JSON.stringify(session.screenshots),
    session.videoPath, session.durationSeconds, session.startedAt, session.completedAt
  );
  addEvent('crawl_completed', `Crawl completed: ${session.targetUrl} (${session.discoveredPages.length} pages)`, JSON.stringify({ sessionId: session.id }));
}

export function getAllCrawlSessions() {
  return getDb().prepare('SELECT * FROM crawl_sessions ORDER BY started_at DESC').all().map((row: any) => ({
    id: row.id,
    targetUrl: row.target_url,
    status: row.status,
    discoveredPages: JSON.parse(row.discovered_pages || '[]'),
    screenshots: JSON.parse(row.screenshots_json || '{}'),
    videoPath: row.video_path,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  }));
}

export function getCrawlSessionById(id: string) {
  const row: any = getDb().prepare('SELECT * FROM crawl_sessions WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    targetUrl: row.target_url,
    status: row.status,
    discoveredPages: JSON.parse(row.discovered_pages || '[]'),
    screenshots: JSON.parse(row.screenshots_json || '{}'),
    videoPath: row.video_path,
    durationSeconds: row.duration_seconds,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

// ─── Event Log Operations ────────────────────────────────────────────────────

export function addEvent(type: string, message: string, metadata: string = '{}') {
  getDb().prepare('INSERT INTO events (type, message, metadata) VALUES (?, ?, ?)').run(type, message, metadata);
}

export function getRecentEvents(limit: number = 50) {
  return getDb().prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?').all(limit).map((row: any) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  }));
}

// ─── Gemini Result Operations ────────────────────────────────────────────────

export function insertGeminiResult(result: {
  id: string;
  crawlId: string;
  prompt: string;
  response: string;
  screenshotsUsed: string[];
  videoUsed: string | null;
}) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO gemini_results (id, crawl_id, prompt, response, screenshots_used, video_used)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(result.id, result.crawlId, result.prompt, result.response, JSON.stringify(result.screenshotsUsed), result.videoUsed);
  addEvent('gemini_generated', `AI script generated for crawl ${result.crawlId}`, JSON.stringify({ resultId: result.id }));
}

export function getGeminiResultByCrawlId(crawlId: string) {
  const row: any = getDb().prepare('SELECT * FROM gemini_results WHERE crawl_id = ? ORDER BY created_at DESC LIMIT 1').get(crawlId);
  if (!row) return null;
  return {
    id: row.id,
    crawlId: row.crawl_id,
    prompt: row.prompt,
    response: row.response,
    screenshotsUsed: JSON.parse(row.screenshots_used || '[]'),
    videoUsed: row.video_used,
    createdAt: row.created_at,
  };
}

export function getAllGeminiResults() {
  return getDb().prepare('SELECT * FROM gemini_results ORDER BY created_at DESC').all().map((row: any) => ({
    id: row.id,
    crawlId: row.crawl_id,
    prompt: row.prompt,
    response: row.response,
    screenshotsUsed: JSON.parse(row.screenshots_used || '[]'),
    videoUsed: row.video_used,
    createdAt: row.created_at,
  }));
}

// ─── Marketing Job Operations ────────────────────────────────────────────────

export function insertMarketingJob(job: {
  id: string;
  crawlId: string;
  scenePlanJson: string;
  videoPath: string | null;
  shortsVideoPath?: string | null;
  durationSeconds: number;
  status: string;
  error: string | null;
}) {
  const stmt = getDb().prepare(`
    INSERT OR REPLACE INTO marketing_jobs (id, crawl_id, scene_plan_json, video_path, shorts_video_path, duration_seconds, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(job.id, job.crawlId, job.scenePlanJson, job.videoPath, job.shortsVideoPath ?? null, job.durationSeconds, job.status, job.error);
  addEvent('marketing_job_created', `Marketing video job ${job.status} for crawl ${job.crawlId}`, JSON.stringify({ jobId: job.id }));
}

function rowToMarketingJob(row: any) {
  return {
    id: row.id,
    crawlId: row.crawl_id,
    scenePlanJson: row.scene_plan_json,
    videoPath: row.video_path,
    shortsVideoPath: row.shorts_video_path || null,
    durationSeconds: row.duration_seconds,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  };
}

export function getMarketingJobById(id: string) {
  const row: any = getDb().prepare('SELECT * FROM marketing_jobs WHERE id = ?').get(id);
  return row ? rowToMarketingJob(row) : null;
}

export function getLatestMarketingJobByCrawlId(crawlId: string) {
  const row: any = getDb().prepare('SELECT * FROM marketing_jobs WHERE crawl_id = ? ORDER BY created_at DESC LIMIT 1').get(crawlId);
  return row ? rowToMarketingJob(row) : null;
}

export function getAllMarketingJobs() {
  return getDb().prepare('SELECT * FROM marketing_jobs ORDER BY created_at DESC').all().map(rowToMarketingJob);
}

// ─── Omni Clip Operations ────────────────────────────────────────────────────

export function insertOmniClip(clip: {
  id: string;
  filePath: string;
  sourceUrl: string | null;
  prompt: string | null;
}) {
  getDb().prepare(`
    INSERT OR REPLACE INTO omni_clips (id, file_path, source_url, prompt)
    VALUES (?, ?, ?, ?)
  `).run(clip.id, clip.filePath, clip.sourceUrl, clip.prompt);
  addEvent('omni_clip_saved', `Omni clip saved: ${clip.id}`, JSON.stringify({ clipId: clip.id }));
}

function rowToOmniClip(row: any) {
  return {
    id: row.id,
    filePath: row.file_path,
    sourceUrl: row.source_url,
    prompt: row.prompt,
    usedInMarketing: !!row.used_in_marketing,
    createdAt: row.created_at,
  };
}

export function getOmniClipById(id: string) {
  const row: any = getDb().prepare('SELECT * FROM omni_clips WHERE id = ?').get(id);
  return row ? rowToOmniClip(row) : null;
}

export function getLatestUnusedOmniClip() {
  const row: any = getDb()
    .prepare('SELECT * FROM omni_clips WHERE used_in_marketing = 0 ORDER BY created_at DESC LIMIT 1')
    .get();
  return row ? rowToOmniClip(row) : null;
}

export function getLatestOmniClip() {
  const row: any = getDb()
    .prepare('SELECT * FROM omni_clips ORDER BY created_at DESC LIMIT 1')
    .get();
  return row ? rowToOmniClip(row) : null;
}

export function getAllOmniClips() {
  return getDb().prepare('SELECT * FROM omni_clips ORDER BY created_at DESC').all().map(rowToOmniClip);
}

export function markOmniClipUsed(id: string) {
  getDb().prepare('UPDATE omni_clips SET used_in_marketing = 1 WHERE id = ?').run(id);
}

export function deleteOmniClip(id: string) {
  getDb().prepare('DELETE FROM omni_clips WHERE id = ?').run(id);
}

// ─── Search Crawl Operations ─────────────────────────────────────────────────

export function insertSearchCrawl(crawl: {
  id: string;
  sourceUrl: string;
  query: string;
  resultsUrl: string | null;
  screenshotPaths: string[];
}) {
  getDb().prepare(`
    INSERT OR REPLACE INTO search_crawls (id, source_url, query, results_url, screenshot_paths_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(crawl.id, crawl.sourceUrl, crawl.query, crawl.resultsUrl, JSON.stringify(crawl.screenshotPaths));
  addEvent('search_crawl_saved', `Search crawl saved: ${crawl.id} (query="${crawl.query}")`, JSON.stringify({ crawlId: crawl.id }));
}

function rowToSearchCrawl(row: any) {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    query: row.query,
    resultsUrl: row.results_url,
    screenshotPaths: JSON.parse(row.screenshot_paths_json || '[]') as string[],
    createdAt: row.created_at,
  };
}

export function getSearchCrawlById(id: string) {
  const row: any = getDb().prepare('SELECT * FROM search_crawls WHERE id = ?').get(id);
  return row ? rowToSearchCrawl(row) : null;
}

export function getRecentSearchCrawl(sourceUrl: string, query: string, maxAgeMinutes: number = 30) {
  // Cache hit if a crawl for the same url+query exists within the time window
  const row: any = getDb()
    .prepare(`SELECT * FROM search_crawls WHERE source_url = ? AND query = ? AND created_at > datetime('now', ? || ' minutes') ORDER BY created_at DESC LIMIT 1`)
    .get(sourceUrl, query, `-${maxAgeMinutes}`);
  return row ? rowToSearchCrawl(row) : null;
}

export function getAllSearchCrawls() {
  return getDb().prepare('SELECT * FROM search_crawls ORDER BY created_at DESC LIMIT 50').all().map(rowToSearchCrawl);
}

