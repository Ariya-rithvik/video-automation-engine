// CRITICAL: dotenv must load BEFORE any other imports so services reading process.env at module level get the values.
import 'dotenv/config';

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as path from 'path';
import apiRouter from './routes/api';
import { initWatcher } from './watcher';
import { initDatabase } from './services/database';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & logging middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('short'));
app.use(cors());
app.use(express.json({ limit: '25mb' }));   // animation engine accepts base64 app screenshots
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Setup paths
const watchDir = path.join(__dirname, '../watched');
const outputDir = path.join(__dirname, '../output');
const reportsDir = path.join(__dirname, '../reports');
const dataDir = path.join(__dirname, '../data');

// Initialize Database (SQLite)
initDatabase(dataDir);

// Mount API router
app.use('/api/v1', apiRouter);

// Serve the Animation Engine UI (open http://localhost:5000/animation/showcase-engine.html)
// Same-origin with the API → no CORS friction for the engine's fetch() calls.
app.use('/animation', express.static(path.join(__dirname, '../../animation')));

// Initialize Watcher
initWatcher(watchDir, outputDir, reportsDir);

// Simple healthcheck
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Autonomous Demo Engine Backend is running.',
    version: '2.0.0',
    mode: 'production',
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`==========================================================`);
  console.log(`  AUTONOMOUS DEMO ENGINE (ADE) v2.0 — PRODUCTION`);
  console.log(`  Listening on port: ${PORT}`);
  console.log(`  Watcher directory: ${watchDir}`);
  console.log(`  Output directory : ${outputDir}`);
  console.log(`  Reports directory: ${reportsDir}`);
  console.log(`  Database directory: ${dataDir}`);
  console.log(`  Browser Engine: Puppeteer (Headless Chrome)`);
  console.log(`==========================================================`);
});
