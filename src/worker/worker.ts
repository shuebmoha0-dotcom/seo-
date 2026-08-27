import http from 'http';
import { WORKER_CONFIG } from './config';
import { WorkerLogger } from './logger';
import { QueueManager, TaskExecutionJob } from './queueManager';
import { SchedulerEngine } from './schedulerEngine';
import { JobExecutor } from './jobExecutor';

export class RenderWorker {
  private workerId: string;
  private queueManager: QueueManager;
  private schedulerEngine: SchedulerEngine;
  private jobExecutor: JobExecutor;
  private httpServer: http.Server | null = null;

  private isRunning = false;
  private isShuttingDown = false;
  private activeJobs = new Map<string, TaskExecutionJob>();

  private pollTimer: NodeJS.Timeout | null = null;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPollAt: string | null = null;

  constructor() {
    this.workerId = WORKER_CONFIG.WORKER_ID;
    this.queueManager = new QueueManager(this.workerId);
    this.schedulerEngine = new SchedulerEngine();
    this.jobExecutor = new JobExecutor(this.queueManager);
  }

  /**
   * Start the worker process
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    WorkerLogger.info(`[WORKER_START] Starting Render Worker [${this.workerId}]`, {
      concurrency: WORKER_CONFIG.CONCURRENCY,
      pollIntervalMs: WORKER_CONFIG.POLL_INTERVAL_MS,
      leaseDurationSec: WORKER_CONFIG.LEASE_DURATION_SECONDS,
      nodeVersion: process.version,
    });

    // 1. Initial scheduler check
    await this.schedulerEngine.checkAndEnqueueDueTasks();

    // 2. Start Polling Loop for Queue
    this.scheduleNextPoll(100);

    // 3. Start Recurring Scheduler Loop
    this.schedulerTimer = setInterval(async () => {
      if (this.isShuttingDown) return;
      await this.schedulerEngine.checkAndEnqueueDueTasks();
    }, WORKER_CONFIG.SCHEDULER_INTERVAL_MS);

    // 4. Start Heartbeat Renewal Loop for Active Jobs
    this.heartbeatTimer = setInterval(async () => {
      await this.renewActiveHeartbeats();
    }, WORKER_CONFIG.HEARTBEAT_INTERVAL_MS);

    // 5. Start lightweight HTTP health server (enables running on Render Free Web Service tier)
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;
    try {
      this.httpServer = http.createServer((req, res) => {
        if (req.url === '/health' || req.url === '/' || req.url === '/status') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', worker: this.getHealthStatus() }, null, 2));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.httpServer.listen(port, () => {
        WorkerLogger.info(`Worker Health Check HTTP server listening on port ${port}`);
      });
    } catch (httpErr: any) {
      WorkerLogger.warn('Could not start HTTP health server', { error: httpErr.message });
    }

    // 6. Register Process Signal Handlers
    this.setupSignalHandlers();
  }

  /**
   * Main Queue Polling Loop with Concurrency Control
   */
  private scheduleNextPoll(delayMs = WORKER_CONFIG.POLL_INTERVAL_MS) {
    if (!this.isRunning || this.isShuttingDown) return;

    this.pollTimer = setTimeout(async () => {
      try {
        this.lastPollAt = new Date().toISOString();

        // Check if worker has available concurrency slots
        while (this.activeJobs.size < WORKER_CONFIG.CONCURRENCY && !this.isShuttingDown) {
          const job = await this.queueManager.claimNextJob();
          if (!job) break; // No more jobs available in queue right now

          this.processJobAsync(job);
        }
      } catch (err: any) {
        WorkerLogger.error('Error during queue poll tick', err);
      } finally {
        this.scheduleNextPoll();
      }
    }, delayMs);
  }

  /**
   * Process a claimed job asynchronously in the background pool
   */
  private async processJobAsync(job: TaskExecutionJob): Promise<void> {
    this.activeJobs.set(job.id, job);
    WorkerLogger.info(`[JOB_START] Executing job [${job.id}] | Active concurrency: ${this.activeJobs.size}/${WORKER_CONFIG.CONCURRENCY}`);

    try {
      await this.jobExecutor.execute(job);
    } catch (err: any) {
      WorkerLogger.error(`Unhandled error executing job [${job.id}]`, err);
    } finally {
      this.activeJobs.delete(job.id);
      WorkerLogger.info(`[JOB_FINISH] Finished job [${job.id}] | Active concurrency: ${this.activeJobs.size}/${WORKER_CONFIG.CONCURRENCY}`);
    }
  }

  /**
   * Heartbeat renewal for all active jobs
   */
  private async renewActiveHeartbeats(): Promise<void> {
    if (this.activeJobs.size === 0) return;

    const jobIds = Array.from(this.activeJobs.keys());
    for (const id of jobIds) {
      await this.queueManager.renewHeartbeat(id);
    }
  }

  /**
   * Graceful Shutdown on SIGTERM/SIGINT
   */
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    this.isRunning = false;

    WorkerLogger.info(`[SHUTDOWN_SIGNAL] Received ${signal}. Starting graceful shutdown...`, {
      activeJobs: this.activeJobs.size,
    });

    // Clear timers
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // Wait for in-flight active jobs to complete (up to timeout)
    if (this.activeJobs.size > 0) {
      WorkerLogger.info(`Waiting for ${this.activeJobs.size} in-flight jobs to complete...`);
      const startTime = Date.now();

      while (this.activeJobs.size > 0 && Date.now() - startTime < WORKER_CONFIG.SHUTDOWN_TIMEOUT_MS) {
        await new Promise((res) => setTimeout(res, 500));
      }
    }

    // Release locks on any remaining incomplete jobs so other workers can recover them
    if (this.activeJobs.size > 0) {
      WorkerLogger.warn(`Force-releasing ${this.activeJobs.size} unfinished jobs before exit`);
      for (const [id] of this.activeJobs) {
        await this.queueManager.releaseJobLock(id);
      }
    }

    WorkerLogger.info('[WORKER_SHUTDOWN] Worker stopped cleanly.');
    process.exit(0);
  }

  /**
   * Register system signal listeners
   */
  private setupSignalHandlers(): void {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('uncaughtException', (err) => {
      WorkerLogger.error('Uncaught worker exception', err);
    });
    process.on('unhandledRejection', (reason) => {
      WorkerLogger.error('Unhandled promise rejection in worker', reason);
    });
  }

  /**
   * Health status inspection
   */
  getHealthStatus() {
    return {
      workerId: this.workerId,
      status: this.isRunning ? 'healthy' : 'stopped',
      activeJobsCount: this.activeJobs.size,
      maxConcurrency: WORKER_CONFIG.CONCURRENCY,
      lastPollAt: this.lastPollAt,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
