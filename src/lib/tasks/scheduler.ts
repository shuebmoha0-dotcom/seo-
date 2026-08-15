import { RecurringTask } from './types';
import { Orchestrator } from '../agent/orchestrator';

// In a real production system, this would be BullMQ, Redis, or a cron server.
// For this environment, we mock the scheduler state in memory.
let scheduledTasks: RecurringTask[] = [];
let schedulerInterval: NodeJS.Timeout | null = null;

export const SchedulerEngine = {

  registerTask(task: RecurringTask) {
    scheduledTasks.push(task);
    console.log(`[Scheduler] Task registered: ${task.task_id} - Next run: ${task.next_run_at}`);
  },

  getTasks() {
    return scheduledTasks;
  },

  updateTaskStatus(taskId: string, status: 'active' | 'paused') {
    const task = scheduledTasks.find(t => t.task_id === taskId);
    if (task) {
      task.status = status;
    }
  },

  deleteTask(taskId: string) {
    scheduledTasks = scheduledTasks.filter(t => t.task_id !== taskId);
  },

  start() {
    if (schedulerInterval) return;
    console.log('[Scheduler] Background engine started. Checking every 60s.');
    schedulerInterval = setInterval(async () => {
      const now = new Date();
      for (const task of scheduledTasks) {
        if (task.status === 'active' && new Date(task.next_run_at) <= now) {
          console.log(`[Scheduler] Task DUE: ${task.task_id} -> "${task.goal}"`);
          await SchedulerEngine.executeTask(task);
        }
      }
    }, 60 * 1000);
  },

  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  },

  async executeTask(task: RecurringTask) {
    console.log(`[Scheduler] Handoff to Orchestrator for: ${task.task_id}`);

    const run_id = `run_${Date.now()}`;
    task.last_run_at = new Date().toISOString();

    const next = new Date();
    if (task.schedule.frequency === 'daily') {
      next.setDate(next.getDate() + 1);
    } else if (task.schedule.frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    task.next_run_at = next.toISOString();

    // Explicitly typed so status can be mutated after creation
    const executionRecord: {
      run_id: string;
      date: string;
      status: 'completed' | 'failed' | 'awaiting_approval' | 'executing';
      workflow_id: string;
      summary?: string;
    } = {
      run_id,
      date: new Date().toISOString(),
      status: 'executing',
      workflow_id: ''
    };
    task.execution_history.unshift(executionRecord);

    try {
      const orchestrator = new Orchestrator();

      const state = await orchestrator.initializeWorkflow(task.goal, {
        task_id: task.task_id,
        project_id: task.project_id
      });
      executionRecord.workflow_id = state.workflow_id;

      const finalState = await orchestrator.executeWorkflow(state);

      if (finalState.current_stage === 'PAUSED_FOR_APPROVAL') {
        executionRecord.status = 'awaiting_approval';
        executionRecord.summary = 'Workflow paused. Package requires approval.';
      } else if (finalState.current_stage === 'COMPLETED') {
        executionRecord.status = 'completed';
        executionRecord.summary = 'Workflow completed automatically.';
      } else {
        executionRecord.status = 'failed';
        executionRecord.summary = `Workflow ended in state: ${finalState.current_stage}`;
      }
    } catch (error) {
      console.error(`[Scheduler] Execution failed for task ${task.task_id}`, error);
      executionRecord.status = 'failed';
      executionRecord.summary = 'Critical error during workflow initialization.';
    }
  }
};
