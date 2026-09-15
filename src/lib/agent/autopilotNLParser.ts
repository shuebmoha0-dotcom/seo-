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
  | 'seo_diagnostic'
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
            'seo_diagnostic',
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
        system: `You are an elite, knowledgeable AI SEO Consultant and Growth Architect for the website "${params.domain}".
Your primary mission is to understand user natural language input with human-level nuance.

CLASSIFICATION RULES:
1. 'seo_diagnostic' (FORENSIC INVESTIGATION FOR RANKINGS, TRAFFIC & PERFORMANCE DROPS):
   - ANY question asking why rankings dropped, why traffic declined, or asking for a diagnosis/audit of lost search visibility (e.g. "why did my ranking drop?", "why is my traffic down?", "what happened to my positions?", "diagnose my site", "why am I not ranking for X?", "audit my drops").
   - Set intent_type to 'immediate_action' and action_type to 'seo_diagnostic'.
   - This triggers our multi-agent diagnostic engine to inspect live site evidence, isolate the true root cause (technical block, cannibalization, content decay, intent shift), and deliver a clear, step-by-step solution!

2. 'conversation_response' (For general educational dialogue & chit-chat):
   - General conceptual questions about SEO definitions, tools, or best practices (e.g. "what is bounce rate?", "what is a canonical tag?", "how does the content planner work?")
   - Casual conversation, greetings, compliments, check-ins, or questions about the agent's capabilities (e.g. "hello", "who are you?", "thanks")
   -> When intent_type is 'conversation_response', craft an insightful, authoritative, concise Markdown 'response_message'.

3. 'immediate_action' (FOR DIRECT COMMANDS):
   - ONLY when the user gives a clear imperative command to EXECUTE a change or run a workflow right now:
     • "write an article about [topic]" / "create a post on [topic]" -> action_type: 'write_article'
     • "find keywords" / "discover keyword opportunities" -> action_type: 'keyword_research'
     • "audit technical SEO" / "crawl my site" -> action_type: 'technical_audit'
     • "run tasks" / "execute scheduled jobs" -> action_type: 'run_scheduled_tasks'

4. 'recurring_schedule':
   - ONLY when the user explicitly requests an automated recurring cadence (e.g. "every day at 9am", "weekly report every Monday").`,
        prompt: `Current User Prompt: "${rawPrompt}"\nTarget Domain: "${params.domain}"${chatHistoryContext}`
      });

      let intent_type: AutopilotIntentType = object.intent_type;
      if (modeOverride === 'immediate') intent_type = 'immediate_action';
      if (modeOverride === 'recurring') intent_type = 'recurring_schedule';

      const action_type = object.action_type || (intent_type === 'conversation_response' ? 'answer_question' : 'general_optimization');
      const goal = object.goal || rawPrompt;
      const topic = object.topic || undefined;
      const target_url = object.target_url || undefined;
      const summary = object.summary || (intent_type === 'conversation_response' ? `Consultation response for ${params.domain}` : `Execute ${action_type} for ${params.domain}`);

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
        next_run_at: nextRunAt,
        response_message: object.response_message || undefined
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
    const lower = prompt.toLowerCase().trim();

    // 1. Check for questions or conversational queries
    const isQuestion = 
      /^(what|how|why|when|where|who|which|can\s+you|could\s+you|tell\s+me|explain|do\s+you|is\s+there|are\s+there|should\s+i|would\s+you|give\s+me\s+advice|help|i\s+need\s+to\s+know)\b/i.test(lower) ||
      lower.endsWith('?') ||
      /^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening|greetings|howdy|sup|yo|thanks|thank\s+you|ok|okay|cool|great)\b/i.test(lower);

    // Explicit imperative commands that take priority over questions
    const isImperativeWrite = /^(write|wrote|draft|create|generate|publish)\s+(an?\s+)?(article|blog|post|guide|content)\b/i.test(lower);
    const isImperativeAudit = /^(audit|scan|crawl|check)\s+(my|the|our)?\s*(site|website|page|seo)\b/i.test(lower);
    const isImperativeKeywords = /^(find|research|discover|get)\s+(me\s+)?(keywords|low\s+kd|opportunities)\b/i.test(lower);

    if (isQuestion && !isImperativeWrite && !isImperativeAudit && !isImperativeKeywords) {
      let response_message = `👋 I'm your AI SEO Consultant for *${domain}*.\n\nYou asked: _"${prompt}"_\n\nHow can I help you grow search traffic? You can ask me any SEO questions, analyze keywords, or tell me to write comprehensive articles!`;

      if (/(how\s+to\s+use|how\s+do\s+i\s+use|what\s+is|explain|need\s+to\s+(know\s+)?how\s+to\s+use)\s+(the\s+)?content\s+planner/i.test(lower) || lower.includes('use content planner') || lower.includes('how to use content planner')) {
        response_message = `📝 *How to Use the Content Planner:*\n\n1. **View Generated Articles:** Open \`/content-planner\` in your web dashboard to see all drafts with SEO scores, word counts, and featured images.\n2. **Generate from Telegram:** Simply tell me *\"Write an article about [topic]\"* right here. I will research keywords, weave internal links from live pages, generate featured graphics, and draft the post with Claude Sonnet 5.\n3. **One-Click Publishing:** When drafting finishes, you will receive an approval card here in Telegram. Tap *\"Approve & Publish Live\"* to push it directly to your WordPress site!\n4. **Real-Time Visibility:** Drafts display immediately without lag.`;
      } else if (/^(hello|hi|hey|good\s+morning|good\s+evening|howdy)\b/i.test(lower)) {
        response_message = `👋 Hello! I am your autonomous AI SEO Agent for *${domain}*.\n\nYou can chat with me naturally or assign tasks:\n\n• *\"Write an article about [topic]\"*\n• *\"Research top low-difficulty keywords\"*\n• *\"Audit technical SEO and page health\"*\n• *\"How do I use the Content Planner?\"*\n\nWhat would you like me to tackle today?`;
      } else if (lower.includes('keyword')) {
        response_message = `🎯 *Keyword Strategy for ${domain}:*\n\nTo drive qualified traffic, target search queries with monthly volume $\\ge$ 200 and Keyword Difficulty $\\le$ 35.\n\nWant me to research high-demand opportunities for your niche? Just say: *\"Find low competition keywords\"*.`;
      } else if (lower.includes('rank') || lower.includes('traffic')) {
        response_message = `📈 *Organic Growth Playbook for ${domain}:*\n\n1. Target low-KD long-tail keywords that competitors miss.\n2. Publish authoritative 1,200–1,600 word articles authored with Claude Sonnet 5.\n3. Weave internal links from existing articles to pass link equity.\n\nReady to publish? Text me: *\"Write an article about [topic]\"*!`;
      }

      return {
        intent_type: 'conversation_response',
        action_type: 'answer_question',
        goal: prompt,
        summary: `Conversational response for ${domain}`,
        response_message
      };
    }

    // 2. Check for recurring schedule
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

    // 3. Determine action type for explicit commands
    let action_type: AutopilotActionType = 'general_optimization';
    const isDiagnostic = /why.*(rank|drop|fall|traffic|declin|loss|lost|position)|diagnos|what happened to my (rank|traffic)|why.*not ranking/i.test(lower);
    if (isDiagnostic) {
      intent_type = 'immediate_action';
      action_type = 'seo_diagnostic';
    } else if (/^(run|run\s+now|run\s+task|run\s+tasks|run\s+all|run\s+scheduled|execute|start)$/i.test(lower) || /^run\b/i.test(lower)) {
      action_type = 'run_scheduled_tasks';
    } else if (
      isImperativeWrite ||
      lower.includes('write an article') ||
      lower.includes('write article') ||
      lower.includes('wrote article') ||
      lower.includes('create a post') ||
      lower.includes('draft article')
    ) {
      action_type = 'write_article';
    } else if (isImperativeKeywords || lower.includes('find keyword') || lower.includes('research keyword')) {
      action_type = 'keyword_research';
    } else if (isImperativeAudit || lower.includes('audit site') || lower.includes('crawl site')) {
      action_type = 'technical_audit';
    } else if (lower.includes('internal link') || lower.includes('link structure')) {
      action_type = 'internal_linking';
    } else if (lower.includes('on-page') || lower.includes('meta') || lower.includes('title tag') || lower.includes('heading')) {
      action_type = 'on_page_seo';
    }

    // Extract topic
    let topic: string | undefined = undefined;
    const cleanPrompt = prompt
      .replace(/^(write|wrote|draft|create|generate|publish)\s+(an?\s+)?(article|blog|post|guide|content)?\s*(about|on|covering|for)?\s*/i, '')
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
