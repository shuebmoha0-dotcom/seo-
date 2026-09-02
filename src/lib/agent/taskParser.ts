import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { RecurringTask, RecurringSchedule } from '../tasks/types';

export class TaskParser {
  /**
   * Translates a natural language command into a structured RecurringTask.
   * Includes bulletproof heuristic fallback to guarantee zero unhandled errors.
   */
  async parseTaskRequest(
    userPrompt: string, 
    project_id: string = 'default',
    user_id: string = 'admin'
  ): Promise<RecurringTask> {
    let goal = userPrompt.trim();
    let frequency: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily';
    let time = '09:00';
    let day_of_week: string | undefined = undefined;
    let day_of_month: number | undefined = undefined;

    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MonitoringAgent',
        schema: z.object({
          goal: z.string().describe("The cleaned, direct objective of the task (e.g. 'Create one SEO article')"),
          frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
          time: z.string().describe("HH:mm 24-hour format. Use 09:00 if unspecified."),
          day_of_week: z.string().nullable().describe("e.g. 'Monday'. Only if weekly."),
          day_of_month: z.number().nullable().describe("1-31. Only if monthly.")
        }),
        system: `You are an AI Task Parser for an SEO automation system.
The user will give you a natural language instruction to schedule a recurring SEO workflow.
Extract the underlying GOAL (what the agents actually need to accomplish) and the SCHEDULE.
Default to 09:00 if no time is provided.`,
        prompt: `User Request: "${userPrompt}"\nExtract the task configuration.`
      });

      if (object?.goal) goal = object.goal;
      if (object?.frequency) frequency = object.frequency;
      if (object?.time) time = object.time;
      if (object?.day_of_week) day_of_week = object.day_of_week;
      if (object?.day_of_month) day_of_month = object.day_of_month;
    } catch (err: any) {
      console.warn('[TaskParser] LLM parse fallback triggered:', err?.message);
      const lower = userPrompt.toLowerCase();
      if (lower.includes('week') || lower.includes('monday') || lower.includes('friday')) {
        frequency = 'weekly';
        if (lower.includes('monday')) day_of_week = 'Monday';
        else if (lower.includes('friday')) day_of_week = 'Friday';
      } else if (lower.includes('month')) {
        frequency = 'monthly';
        day_of_month = 1;
      } else {
        frequency = 'daily';
      }
      goal = userPrompt.replace(/^(please\s+|can\s+you\s+)/i, '').trim();
    }

    const now = new Date();
    const [hours, minutes] = time.split(':');
    const parsedHours = parseInt(hours, 10);
    const parsedMinutes = parseInt(minutes, 10);
    
    let nextRun = new Date(now);
    nextRun.setHours(!isNaN(parsedHours) ? parsedHours : 9, !isNaN(parsedMinutes) ? parsedMinutes : 0, 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + (frequency === 'weekly' ? 7 : 1));
    }

    const schedule: RecurringSchedule = {
      frequency,
      time: time || '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      day_of_week: day_of_week || undefined,
      day_of_month: day_of_month || undefined
    };

    return {
      task_id: `task_${Date.now()}`,
      project_id,
      user_id,
      original_prompt: userPrompt,
      goal,
      schedule,
      status: 'active',
      next_run_at: nextRun.toISOString(),
      approval_policy: 'required_for_publish',
      execution_history: []
    };
  }
}
