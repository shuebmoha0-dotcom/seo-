/**
 * Render Background Worker CLI Entry Point
 */

import { RenderWorker } from './worker';
import { WorkerLogger } from './logger';

async function main() {
  WorkerLogger.info('Initializing Autonomous SEO Background Worker...');

  try {
    const worker = new RenderWorker();
    await worker.start();
    WorkerLogger.info('Autonomous SEO Background Worker is RUNNING and listening for jobs 24/7.');
  } catch (err: any) {
    WorkerLogger.error('Fatal failure starting background worker', err);
    process.exit(1);
  }
}

main();
