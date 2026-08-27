/**
 * Atomic Database Queue Manager for Worker Jobs
 */

import { createAdminClient } from '../lib/supabase/admin';
import { WORKER_CONFIG } from './config';
import { WorkerLogger } from './logger';
import { classifyError } from './errorClassifier';

export interface TaskExecutionJob {
  id: string;
  task_id: string;
  project_id: string;
  status: 'queued' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  started_at?: string;
  completed_at?: string;
  error?: string;
  result_summary?: string;
  locked_by?: string;
  locked_at?: string;
  heartbeat_at?: string;
  retry_count: number;
  max_retries: number;
  next_retry_at?: string;
  execution_payload?: Record<string, any>;
  created_at: string;
}

export class QueueManager {
  private supabase = createAdminClient();
  private workerId: string;
  private leaseDuration: number;

  constructor(workerId = WORKER_CONFIG.WORKER_ID, leaseDuration = WORKER_CONFIG.LEASE_DURATION_SECONDS) {
    this.workerId = workerId;
    this.leaseDuration = leaseDuration;
  }

  /**
   * Atomically claim the next available queued or stale task execution using PostgreSQL FOR UPDATE SKIP LOCKED
   */
  async claimNextJob(): Promise<TaskExecutionJob | null> {
    try {
      const { data, error } = await this.supabase.rpc('claim_next_task_execution', {
        p_worker_id: this.workerId,
        p_lease_duration_seconds: this.leaseDuration,
      });

      if (error) {
        WorkerLogger.error('Failed to claim job via RPC', error);
        return null;
      }

      if (data && data.length > 0) {
        const job = data[0] as TaskExecutionJob;
        WorkerLogger.info(`Claimed execution [${job.id}] for task [${job.task_id}] (attempt ${job.retry_count || 0})`);
        return job;
      }

      return null;
    } catch (err: any) {
      WorkerLogger.error('Unexpected exception during claimNextJob', err);
      return null;
    }
  }

  /**
   * Renew lease heartbeat for an actively running job
   */
  async renewHeartbeat(executionId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('renew_task_execution_heartbeat', {
        p_execution_id: executionId,
        p_worker_id: this.workerId,
      });

      if (error) {
        WorkerLogger.warn(`Failed to renew heartbeat for [${executionId}]`, { error: error.message });
        return false;
      }

      return !!data;
    } catch (err: any) {
      WorkerLogger.warn(`Heartbeat exception for [${executionId}]`, { error: err.message });
      return false;
    }
  }

  /**
   * Mark execution completed successfully
   */
  async completeJob(executionId: string, resultSummary: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('task_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          result_summary: resultSummary,
          locked_by: null,
          heartbeat_at: null,
        })
        .eq('id', executionId);

      if (error) {
        WorkerLogger.error(`Supabase error completing execution [${executionId}]`, error);
      } else {
        WorkerLogger.info(`Execution [${executionId}] marked COMPLETED`);
      }
    } catch (err: any) {
      WorkerLogger.error(`Failed to mark execution [${executionId}] completed`, err);
    }
  }

  /**
   * Pause execution for human approval (releases the worker safely)
   */
  async pauseForApproval(executionId: string, summary: string, payloadUpdates?: Record<string, any>): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        status: 'waiting_for_approval',
        result_summary: summary,
        locked_by: null,
        heartbeat_at: null,
      };

      if (payloadUpdates) {
        updateData.execution_payload = payloadUpdates;
      }

      const { error } = await this.supabase
        .from('task_executions')
        .update(updateData)
        .eq('id', executionId);

      if (error) {
        WorkerLogger.error(`Supabase error updating execution [${executionId}] to waiting_for_approval`, error);
      } else {
        WorkerLogger.info(`Execution [${executionId}] PAUSED FOR APPROVAL`);
      }
    } catch (err: any) {
      WorkerLogger.error(`Failed to pause execution [${executionId}] for approval`, err);
    }
  }

  /**
   * Handle job failure with error classification and exponential backoff retry
   */
  async failOrRetryJob(job: TaskExecutionJob, error: any): Promise<void> {
    try {
      const currentRetries = job.retry_count || 0;
      const classification = classifyError(error, currentRetries, job.max_retries || WORKER_CONFIG.DEFAULT_MAX_RETRIES);

      if (classification.canRetry && classification.nextRetryAt) {
        // Schedule retry
        await this.supabase
          .from('task_executions')
          .update({
            status: 'retrying',
            retry_count: currentRetries + 1,
            next_retry_at: classification.nextRetryAt,
            error: classification.reason,
            locked_by: null,
            heartbeat_at: null,
          })
          .eq('id', job.id);

        WorkerLogger.warn(`Execution [${job.id}] scheduled for retry in ${classification.delaySeconds}s: ${classification.reason}`);
      } else {
        // Mark permanently failed
        await this.supabase
          .from('task_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error: classification.reason,
            locked_by: null,
            heartbeat_at: null,
          })
          .eq('id', job.id);

        // Update parent task status if task_id exists
        if (job.task_id && job.task_id !== '00000000-0000-0000-0000-000000000000') {
          await this.supabase
            .from('tasks')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', job.task_id);
        }

        WorkerLogger.error(`Execution [${job.id}] permanently FAILED: ${classification.reason}`);
      }
    } catch (err: any) {
      WorkerLogger.error(`Failed to record failure/retry for [${job.id}]`, err);
    }
  }

  /**
   * Release lock cleanly during worker shutdown
   */
  async releaseJobLock(executionId: string): Promise<void> {
    try {
      await this.supabase
        .from('task_executions')
        .update({
          status: 'queued',
          locked_by: null,
          locked_at: null,
          heartbeat_at: null,
        })
        .eq('id', executionId)
        .eq('locked_by', this.workerId);

      WorkerLogger.info(`Released lock on execution [${executionId}] for graceful shutdown`);
    } catch (err: any) {
      WorkerLogger.warn(`Failed to release lock on [${executionId}]`, { error: err.message });
    }
  }
}
