import { LLMProvider } from '../tools/llm';
import { z } from 'zod';

export type AutopilotIntentType = 'immediate_action' | 'recurring_schedule' | 'conversation_response';

export type AutopilotActionType =
  | 'write_article'
  | 'keyword_research'
  | 'technical_audit'
  | 'internal_linking'
  | 'on_page_seo'
  | 'run_scheduled_tasks'
  | 'general_optimization'
  | 'answer_question';

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
  response_message?: string;
}

export class AutopilotNLParser {
  /**
   * Parse a natural language prompt into an executable instruction or a conversational response.
   */
  async parseInstruction(params: {
    prompt: string;
    domain: string;
    modeOverride?: 'auto' | 'immediate' | 'recurring';
    frequencyOverride?: string;
    chatHistory?: { role: 'user' | 'assistant', content: string }[];
  }): Promise<ParsedAutopilotInstruction> {
    const rawPrompt = params.prompt.trim();
    const modeOverride = params.modeOverride || 'auto';
    const chatHistoryContext = params.chatHistory && params.chatHistory.length > 0 
      ? `\n\nRecent Chat History:\n${params.chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Agent'}: ${h.content}`).join('\n')}`
      : '';

    // 1. Try LLM-driven deep understanding
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MonitoringAgent',
        schema: z.object({
          intent_type: z.enum(['immediate_action', 'recurring_schedule', 'conversation_response']).describe(
            "Use 'conversation_response' if the user is asking a general support question, SEO question, or chatting (e.g. 'How do I connect WordPress?', 'What is my score?'). Use 'immediate_action' for tasks like 'write an article' or 'audit site'. Use 'recurring_schedule' for 'daily audit'."
          ),
          action_type: z.enum([
            'write_article',
            'keyword_research',
            'technical_audit',
            'internal_linking',
            'on_page_seo',
            'run_scheduled_tasks',
            'general_optimization',
            'answer_question'
          ]),
          goal: z.string().describe("Clear, concise goal statement based on the user's current prompt AND the chat history context if they are referencing something from before (e.g. 'make it longer' -> 'Make the article about email warmup longer')"),
          topic: z.string().nullable().describe("Extracted topic or keyword focus if applicable (resolved using chat history if needed)"),
          target_url: z.string().nullable().describe("Extracted target URL if mentioned"),
          summary: z.string().describe("A professional, 1-sentence description of the interpreted instruction"),
          frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']).nullable().describe("Recurring cadence if applicable"),
          time: z.string().nullable().describe("HH:mm 24-hour format if specified, or null"),
          day_of_week: z.string().nullable().describe("e.g. 'Monday' if specified"),
          day_of_month: z.number().nullable(),
          response_message: z.string().nullable().describe("If intent_type is 'conversation_response', write a direct, helpful Markdown response to the user's question here. Use the persona of an expert AI SEO Consultant. Otherwise null.")
        }),
        system: `You are an advanced Natural Language Task Parser for an Autonomous SEO AI system.
Understand the user's natural language input for domain "${params.domain}".
CRITICAL:
- If the user asks a question, requests support, or chats, use 'conversation_response' and provide a helpful 'response_message'.
- If the user asks to "run", "run task", "execute", or "start", classify as 'immediate_action' with action_type 'run_scheduled_tasks'.
- If the user asks to write an article, draft a post, research keywords, or audit the site WITHOUT a recurring word (every/daily/weekly/monthly), classify as 'immediate_action'.
- Do NOT force one-time actions into a recurring schedule.
- If the user specifies recurrence (e.g. "every Monday at 9am", "daily audit"), classify as 'recurring_schedule'.
- If the user is referring to "it", "that", "the article", "the first one", look at the 'Recent Chat History' to resolve the subject into the 'goal' and 'topic'.`,
        prompt: `Current User Prompt: "${rawPrompt}"\nTarget Domain: "${params.domain}"${chatHistoryContext}`
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

    // Check for conversational greetings
    if (/^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|greetings|howdy|sup|yo)\b/i.test(lower) || lower === 'hello' || lower === 'hi' || lower === 'hey') {
      return {
        intent_type: 'conversation_response',
        action_type: 'answer_question',
        goal: prompt,
        summary: `Conversational greeting for ${domain}`,
        response_message: `👋 Hello! I am your autonomous AI SEO Agent for *${domain}*.\n\nYou can ask me questions or assign tasks directly:\n\n• *\"Write an article about [topic]\"*\n• *\"Research top low-difficulty keywords\"*\n• *\"Audit technical SEO and page health\"*\n• *\"How do I use the Content Planner?\"*\n\nWhat would you like me to tackle today?`
      };
    }

    // Check for how to use Content Planner questions
    if (/(how\s+to\s+use|how\s+do\s+i\s+use|what\s+is|explain|need\s+to\s+(know\s+)?how\s+to\s+use)\s+(the\s+)?content\s+planner/i.test(lower) || lower.includes('use content planner') || lower.includes('how to use content planner')) {
      return {
        intent_type: 'conversation_response',
        action_type: 'answer_question',
        goal: prompt,
        summary: `Explanation of Content Planner for ${domain}`,
        response_message: `📝 *How to Use the Content Planner:*\n\n1. **View Generated Articles:** Open \`/content-planner\` in your web dashboard to see all drafts with SEO scores, word counts, and featured images.\n2. **Generate from Telegram:** Simply tell me *\"Write an article about [topic]\"* right here. I will research keywords, weave internal links from live pages, generate featured graphics, and draft the post with Claude Sonnet 5.\n3. **One-Click Publishing:** When drafting finishes, you will receive an approval card here in Telegram. Tap *\"Approve & Publish Live\"* to push it directly to your WordPress site!\n4. **Real-Time Visibility:** Drafts display immediately without lag.`
      };
    }

    // Check for general help / capabilities
    if (/^(help|\/help|what\s+can\s+you\s+do|who\s+are\s+you)/i.test(lower)) {
      return {
        intent_type: 'conversation_response',
        action_type: 'answer_question',
        goal: prompt,
        summary: `Help information for ${domain}`,
        response_message: `🤖 *SEO Agent Capabilities for ${domain}:*\n\n• \`/status\` — View site health & active tasks\n• *\"Write an article about [topic]\"* — Full multi-agent content drafting\n• *\"Find low competition keywords\"* — High-ROI keyword discovery\n• *\"Audit technical SEO\"* — Live site crawl & issue detection\n• *\"How do I use Content Planner?\"* — Feature guide`
      };
    }

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
    } else if (
      /(write|wrote|draft|create|generate)\s+(an?\s+)?(article|blog|post|guide|content)/i.test(lower) ||
      /^(write|wrote)\s+article/i.test(lower) ||
      lower.includes('article') ||
      lower.includes('blog') ||
      lower.includes('post it')
    ) {
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
    const cleanPrompt = prompt
      .replace(/^(write|wrote|draft|create|generate)\s+(an?\s+)?(article|blog|post|guide|content)?\s*(about|on|covering|for)?\s*/i, '')
      .replace(/\s*(and\s+)?(post|publish)\s+it$/i, '')
      .trim();
    if (cleanPrompt && !/^(write|wrote|article|blog|post|guide|content|post\s+it)$/i.test(cleanPrompt)) {
      topic = cleanPrompt;
    } else {
      const aboutMatch = prompt.match(/(?:about|on|covering|topic|for)\s+["']?([^"'.?,]+)["']?/i);
      if (aboutMatch && aboutMatch[1]) {
        topic = aboutMatch[1].trim();
      }
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
