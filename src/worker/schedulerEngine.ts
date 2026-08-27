/**
 * Database-Backed Recurring Schedule Engine for Worker
 */

import { createAdminClient } from '../lib/supabase/admin';
import { WorkerLogger } from './logger';

export class SchedulerEngine {
  private supabase = createAdminClient();

  /**
   * Evaluates all due recurring tasks and schedules, atomically advancing next_run_at and queueing executions.
   */
  async checkAndEnqueueDueTasks(): Promise<number> {
    let enqueuedCount = 0;

    try {
      const now = new Date().toISOString();

      // 1. Check due tasks from public.tasks table
      const { data: dueTasks, error: taskErr } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('status', 'active')
        .lte('next_run_at', now)
        .limit(20);

      if (taskErr) {
        WorkerLogger.error('Failed to query due tasks', taskErr);
      } else if (dueTasks && dueTasks.length > 0) {
        for (const task of dueTasks) {
          try {
            const nextRun = this.computeNextRunTime(task.schedule_type, task.schedule_config, task.timezone);

            // Atomically update task next_run_at and last_run_at
            const { error: updateErr } = await this.supabase
              .from('tasks')
              .update({
                last_run_at: now,
                next_run_at: nextRun,
                updated_at: now,
              })
              .eq('id', task.id)
              .eq('next_run_at', task.next_run_at); // Optimistic concurrency check

            if (updateErr) {
              WorkerLogger.warn(`Task [${task.id}] already claimed by another scheduler instance`);
              continue;
            }

            // Enqueue new task_execution
            const { data: newExecution, error: execErr } = await this.supabase
              .from('task_executions')
              .insert({
                task_id: task.id,
                project_id: task.project_id,
                status: 'queued',
                execution_payload: {
                  goal: task.natural_language_instruction || task.name,
                  task_name: task.name,
                  schedule_type: task.schedule_type,
                  user_id: task.user_id,
                },
              })
              .select('id')
              .single();

            if (execErr) {
              WorkerLogger.error(`Failed to enqueue execution for task [${task.id}]`, execErr);
            } else if (newExecution) {
              enqueuedCount++;
              WorkerLogger.info(`Enqueued scheduled execution [${newExecution.id}] for task "${task.name}"`);
            }
          } catch (err: any) {
            WorkerLogger.error(`Error processing due task [${task.id}]`, err);
          }
        }
      }

      // 2. Check due scheduled website configs from public.scheduled_agent_configs
      const { data: dueConfigs, error: configErr } = await this.supabase
        .from('scheduled_agent_configs')
        .select('*, websites!inner(id, domain, url, project_id, user_id)')
        .eq('status', 'active')
        .lte('next_run_at', now)
        .limit(20);

      if (configErr) {
        WorkerLogger.error('Failed to query due website configs', configErr);
      } else if (dueConfigs && dueConfigs.length > 0) {
        for (const config of dueConfigs) {
          try {
            const nextRun = this.computeNextRunTime(config.frequency || 'daily', { time: config.schedule_time }, config.timezone);

            const { error: updateErr } = await this.supabase
              .from('scheduled_agent_configs')
              .update({
                last_run_at: now,
                next_run_at: nextRun,
                updated_at: now,
              })
              .eq('id', config.id)
              .eq('next_run_at', config.next_run_at);

            if (updateErr) {
              WorkerLogger.warn(`Config [${config.id}] already claimed by another scheduler instance`);
              continue;
            }

            const website = config.websites;

            // Enqueue website scheduled execution
            const { data: newExecution, error: execErr } = await this.supabase
              .from('task_executions')
              .insert({
                task_id: '00000000-0000-0000-0000-000000000000',
                project_id: website.project_id || '00000000-0000-0000-0000-000000000000',
                status: 'queued',
                execution_payload: {
                  type: 'scheduled_agent_run',
                  website_id: config.website_id,
                  website_url: website.url,
                  domain: website.domain,
                  user_id: website.user_id,
                  trigger_type: 'schedule',
                  config,
                },
              })
              .select('id')
              .single();

            if (execErr) {
              WorkerLogger.error(`Failed to enqueue scheduled run for website [${website.domain}]`, execErr);
            } else if (newExecution) {
              enqueuedCount++;
              WorkerLogger.info(`Enqueued scheduled agent execution [${newExecution.id}] for website "${website.domain}"`);
            }
          } catch (err: any) {
            WorkerLogger.error(`Error processing due website config [${config.id}]`, err);
          }
        }
      }
    } catch (err: any) {
      WorkerLogger.error('Scheduler iteration exception', err);
    }

    return enqueuedCount;
  }

  /**
   * Computes the next run time according to frequency rule
   */
  private computeNextRunTime(frequency: string, scheduleConfig?: any, _timezone = 'UTC'): string {
    const next = new Date();
    const freq = (frequency || 'daily').toLowerCase();

    if (freq === 'every_12_hours') {
      next.setHours(next.getHours() + 12);
    } else if (freq === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (freq === 'monthly') {
      next.setMonth(next.getMonth() + 1);
    } else if (freq === 'hourly') {
      next.setHours(next.getHours() + 1);
    } else {
      // Default: daily
      next.setDate(next.getDate() + 1);
    }

    // If a specific time is configured (e.g. "09:00")
    if (scheduleConfig?.time && typeof scheduleConfig.time === 'string') {
      const [hours, minutes] = scheduleConfig.time.split(':').map((s: string) => parseInt(s, 10));
      if (!isNaN(hours) && !isNaN(minutes)) {
        next.setHours(hours, minutes, 0, 0);
      }
    }

    return next.toISOString();
  }
}
