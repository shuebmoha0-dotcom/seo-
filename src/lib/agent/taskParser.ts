import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { RecurringTask, RecurringSchedule } from '../tasks/types';

export class TaskParser {
  /**
   * Translates a natural language command into a structured RecurringTask.
   */
  async parseTaskRequest(
    userPrompt: string, 
    project_id: string = 'default',
    user_id: string = 'admin'
  ): Promise<RecurringTask> {
    
    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent', // Routes to GPT-5.6 Luna (gpt-4o-mini) as requested
      schema: z.object({
        goal: z.string().describe("The cleaned, direct objective of the task (e.g. 'Create one SEO article')"),
        frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
        time: z.string().describe("HH:mm 24-hour format. Use 09:00 if unspecified."),
        day_of_week: z.string().optional().describe("e.g. 'Monday'. Only if weekly."),
        day_of_month: z.number().optional().describe("1-31. Only if monthly.")
      }),
      system: `You are an AI Task Parser for an SEO automation system.
The user will give you a natural language instruction to schedule a recurring SEO workflow.
Extract the underlying GOAL (what the agents actually need to accomplish) and the SCHEDULE.
Default to 09:00 if no time is provided.`,
      prompt: `User Request: "${userPrompt}"\nExtract the task configuration.`
    });

    const now = new Date();
    
    // Calculate a naive next_run_at based on today + time (Mock implementation for now)
    const [hours, minutes] = object.time.split(':');
    let nextRun = new Date(now);
    nextRun.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1); // push to tomorrow if time passed
    }

    const schedule: RecurringSchedule = {
      frequency: object.frequency,
      time: object.time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      day_of_week: object.day_of_week,
      day_of_month: object.day_of_month
    };

    return {
      task_id: `task_${Date.now()}`,
      project_id,
      user_id,
      original_prompt: userPrompt,
      goal: object.goal,
      schedule,
      status: 'active',
      next_run_at: nextRun.toISOString(),
      approval_policy: 'required_for_publish',
      execution_history: []
    };
  }
}
