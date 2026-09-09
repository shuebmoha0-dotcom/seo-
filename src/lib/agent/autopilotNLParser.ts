import { LLMProvider } from '../tools/llm';
import { z } from 'zod';

export type AutopilotIntentType = 'immediate_action' | 'recurring_schedule';

export type AutopilotActionType =
  | 'write_article'
  | 'keyword_research'
  | 'technical_audit'
  | 'internal_linking'
  | 'on_page_seo'
  | 'run_scheduled_tasks'
  | 'general_optimization';

export interface AutopilotSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  time: string; // HH:mm
  day_of_week?: string;
  day_of_month?: number;
  timezone: string;
}

export interface ParsedAutopilotInstruction {
  intent_type: AutopilotIntentType;
  action_type: AutopilotActionType;
  goal: string;
  topic?: string;
  target_url?: string;
  summary: string;
  schedule?: AutopilotSchedule;
  next_run_at?: string;
}

export class AutopilotNLParser {
  /**
   * Intelligently parses natural language into either an immediate execution command
   * or a recurring scheduled workflow.
   */
  async parseInstruction(params: {
    prompt: string;
    domain: string;
    modeOverride?: 'auto' | 'immediate' | 'recurring';
    frequencyOverride?: string;
  }): Promise<ParsedAutopilotInstruction> {
    const rawPrompt = params.prompt.trim();
    const modeOverride = params.modeOverride || 'auto';

    // Direct check for "run" / "execute" trigger
    if (/^(run|run\s+now|run\s+task|run\s+tasks|run\s+all|run\s+scheduled|execute|start)$/i.test(rawPrompt) || /^run\b/i.test(rawPrompt)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'run_scheduled_tasks',
        goal: rawPrompt,
        summary: `Execute active scheduled tasks for ${params.domain}`,
      };
    }

    // 1. Try LLM-driven deep understanding
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MonitoringAgent',
        schema: z.object({
          intent_type: z.enum(['immediate_action', 'recurring_schedule']).describe(
            "Use 'immediate_action' if the user wants an action done right now (e.g. 'write an article about email warm-up', 'audit technical SEO', 'find keywords'). Use 'recurring_schedule' only if they express recurring frequency or schedule (e.g. 'every Monday', 'daily at 9am', 'weekly publish')."
          ),
          action_type: z.enum([
            'write_article',
            'keyword_research',
            'technical_audit',
            'internal_linking',
            'on_page_seo',
            'run_scheduled_tasks',
            'general_optimization'
          ]),
          goal: z.string().describe("Clear, concise goal statement (e.g. 'Draft SEO article: 7 Best Email Warmup Strategies')"),
          topic: z.string().nullable().describe("Extracted topic or keyword focus if applicable"),
          target_url: z.string().nullable().describe("Extracted target URL if mentioned"),
          summary: z.string().describe("A professional, 1-sentence description of the interpreted instruction"),
          frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']).nullable().describe("Recurring cadence if applicable"),
          time: z.string().nullable().describe("HH:mm 24-hour format if specified, or null"),
          day_of_week: z.string().nullable().describe("e.g. 'Monday' if specified"),
          day_of_month: z.number().nullable()
        }),
        system: `You are an advanced Natural Language Task Parser for an Autonomous SEO AI system.
Understand the user's natural language input for domain "${params.domain}".
CRITICAL:
- If the user asks to "run", "run task", "execute", or "start", classify as 'immediate_action' with action_type 'run_scheduled_tasks'.
- If the user asks to write an article, draft a post, research keywords, or audit the site WITHOUT a recurring word (every/daily/weekly/monthly), classify as 'immediate_action'.
- Do NOT force one-time actions into a recurring schedule.
- If the user specifies recurrence (e.g. "every Monday at 9am", "daily audit"), classify as 'recurring_schedule'.`,
        prompt: `User Prompt: "${rawPrompt}"\nTarget Domain: "${params.domain}"`
      });

      let intent_type: AutopilotIntentType = object.intent_type;
      if (modeOverride === 'immediate') intent_type = 'immediate_action';
      if (modeOverride === 'recurring') intent_type = 'recurring_schedule';

      const action_type = object.action_type || 'general_optimization';
      const goal = object.goal || rawPrompt;
      const topic = object.topic || undefined;
      const target_url = object.target_url || undefined;
      const summary = object.summary || `Execute ${action_type} for ${params.domain}`;

      let schedule: AutopilotSchedule | undefined = undefined;
      let nextRunAt: string | undefined = undefined;

      if (intent_type === 'recurring_schedule') {
        const freq = (params.frequencyOverride && params.frequencyOverride !== 'auto')
          ? (params.frequencyOverride as any)
          : (object.frequency || 'daily');
        const timeStr = object.time || '09:00';
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        schedule = {
          frequency: freq,
          time: timeStr,
          day_of_week: object.day_of_week || undefined,
          day_of_month: object.day_of_month || undefined,
          timezone
        };

        const now = new Date();
        const [hours, minutes] = timeStr.split(':');
        const parsedHours = parseInt(hours, 10);
        const parsedMinutes = parseInt(minutes, 10);

        const nextDate = new Date(now);
        nextDate.setHours(!isNaN(parsedHours) ? parsedHours : 9, !isNaN(parsedMinutes) ? parsedMinutes : 0, 0, 0);
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + (freq === 'weekly' ? 7 : 1));
        }
        nextRunAt = nextDate.toISOString();
      }

      return {
        intent_type,
        action_type,
        goal,
        topic,
        target_url,
        summary,
        schedule,
        next_run_at: nextRunAt
      };
    } catch (err: any) {
      console.warn('[AutopilotNLParser] Fallback heuristic parsing:', err?.message || err);
      return this.heuristicFallback(rawPrompt, params.domain, modeOverride, params.frequencyOverride);
    }
  }

  /**
   * Deterministic fallback if LLM parse fails
   */
  private heuristicFallback(
    prompt: string,
    domain: string,
    modeOverride: string,
    frequencyOverride?: string
  ): ParsedAutopilotInstruction {
    const lower = prompt.toLowerCase();

    // 1. Determine intent
    let intent_type: AutopilotIntentType = 'immediate_action';
    if (modeOverride === 'recurring') {
      intent_type = 'recurring_schedule';
    } else if (modeOverride === 'immediate') {
      intent_type = 'immediate_action';
    } else if (
      lower.includes('every') ||
      lower.includes('daily') ||
      lower.includes('weekly') ||
      lower.includes('monthly') ||
      lower.includes('schedule') ||
      lower.includes('recurring')
    ) {
      intent_type = 'recurring_schedule';
    }

    // 2. Determine action type
    let action_type: AutopilotActionType = 'general_optimization';
    if (/^(run|run\s+now|run\s+task|run\s+tasks|run\s+all|run\s+scheduled|execute|start)$/i.test(lower) || /^run\b/i.test(lower)) {
      action_type = 'run_scheduled_tasks';
    } else if (lower.includes('article') || lower.includes('write') || lower.includes('blog') || lower.includes('post') || lower.includes('draft') || lower.includes('content')) {
      action_type = 'write_article';
    } else if (lower.includes('keyword') || lower.includes('cluster') || lower.includes('search volume') || lower.includes('intent')) {
      action_type = 'keyword_research';
    } else if (lower.includes('technical') || lower.includes('audit') || lower.includes('crawl') || lower.includes('broken') || lower.includes('status code')) {
      action_type = 'technical_audit';
    } else if (lower.includes('internal link') || lower.includes('link structure')) {
      action_type = 'internal_linking';
    } else if (lower.includes('on-page') || lower.includes('meta') || lower.includes('title tag') || lower.includes('heading')) {
      action_type = 'on_page_seo';
    }

    // Extract topic
    let topic: string | undefined = undefined;
    const aboutMatch = prompt.match(/(?:about|on|covering|topic|for)\s+["']?([^"'.?,]+)["']?/i);
    if (aboutMatch && aboutMatch[1]) {
      topic = aboutMatch[1].trim();
    }

    let schedule: AutopilotSchedule | undefined = undefined;
    let nextRunAt: string | undefined = undefined;

    if (intent_type === 'recurring_schedule') {
      let freq: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily';
      if (frequencyOverride && frequencyOverride !== 'auto') {
        freq = frequencyOverride as any;
      } else if (lower.includes('week') || lower.includes('monday') || lower.includes('friday')) {
        freq = 'weekly';
      } else if (lower.includes('month')) {
        freq = 'monthly';
      }

      schedule = {
        frequency: freq,
        time: '09:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      };

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + (freq === 'weekly' ? 7 : 1));
      nextRunAt = nextDate.toISOString();
    }

    return {
      intent_type,
      action_type,
      goal: prompt,
      topic,
      summary: `${intent_type === 'immediate_action' ? 'Immediate' : 'Scheduled'} ${action_type.replace('_', ' ')} for ${domain}`,
      schedule,
      next_run_at: nextRunAt
    };
  }
}
