/**
 * Render Background Worker Configuration & Environment Loader
 */

import fs from 'fs';
import path from 'path';

// Automatically load local .env files if running outside Next.js / in local dev
function loadLocalEnv() {
  const envFiles = ['.env.local', '.env.development.local', '.env'];
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...rest] = trimmed.split('=');
            const rawVal = rest.join('=').replace(/^["']|["']$/g, '').trim();
            const cleanKey = key.trim();
            if (rawVal && rawVal !== '[SENSITIVE]' && !rawVal.includes('placeholder')) {
              process.env[cleanKey] = rawVal;
            }
          }
        }
      } catch {}
    }
  }
}

loadLocalEnv();

export const WORKER_CONFIG = {
  // Worker Identity
  WORKER_ID: process.env.RENDER_INSTANCE_ID || `worker_${process.pid}_${Math.random().toString(36).substring(2, 7)}`,

  // Concurrency: Max simultaneous jobs running on this worker instance
  CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '3', 10),

  // Polling Interval: How often to poll the database queue for new jobs (in ms)
  POLL_INTERVAL_MS: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '3000', 10),

  // Scheduler Interval: How often to check for recurring due tasks (in ms)
  SCHEDULER_INTERVAL_MS: parseInt(process.env.WORKER_SCHEDULER_INTERVAL_MS || '30000', 10),

  // Heartbeat Interval: How often active jobs renew their lease (in ms)
  HEARTBEAT_INTERVAL_MS: parseInt(process.env.WORKER_HEARTBEAT_INTERVAL_MS || '15000', 10),

  // Lease Duration: How long a job lock is valid before being considered abandoned (in seconds)
  LEASE_DURATION_SECONDS: parseInt(process.env.WORKER_LEASE_DURATION_SECONDS || '180', 10),

  // Retry Policies
  DEFAULT_MAX_RETRIES: 3,
  INITIAL_RETRY_BACKOFF_SECONDS: 15,
  MAX_RETRY_BACKOFF_SECONDS: 900, // 15 mins max backoff

  // Graceful Shutdown Timeout (in ms)
  SHUTDOWN_TIMEOUT_MS: 25000,
};
