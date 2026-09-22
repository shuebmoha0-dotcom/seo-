import { LLMProvider } from '../tools/llm';
import { z } from 'zod';

export type AutopilotIntentType = 'immediate_action' | 'recurring_schedule' | 'conversation_response';

export type AutopilotActionType =
  | 'write_article'
  | 'edit_article'
  | 'generate_images'
  | 'keyword_research'
  | 'backlink_discovery'
  | 'technical_audit'
  | 'internal_linking'
  | 'on_page_seo'
  | 'run_scheduled_tasks'
  | 'general_optimization'
  | 'seo_diagnostic'
  | 'rank_recovery'
  | 'growth_acceleration'
  | 'site_status_summary'
  | 'content_ideas'
  | 'competitor_analysis'
  | 'indexing_check'
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
   * Parse any natural language prompt (conversational, messy, slang, typos, commands, multi-turn)
   * into a high-precision executable instruction or an expert consultative answer.
   */
  async parseInstruction(params: {
    prompt: string;
    domain: string;
    modeOverride?: 'auto' | 'immediate' | 'recurring';
    frequencyOverride?: string;
    chatHistory?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<ParsedAutopilotInstruction> {
    const rawPrompt = params.prompt.trim();
    const modeOverride = params.modeOverride || 'auto';
    const chatHistoryContext = params.chatHistory && params.chatHistory.length > 0
      ? `\n\nRecent Chat History:\n${params.chatHistory.map(h => `${h.role === 'user' ? 'User' : 'Agent'}: ${h.content}`).join('\n')}`
      : '';

    // 1. Context-Aware Keyword / Topic Resolution from Conversation Memory
    let contextResolvedTopic: string | undefined = undefined;
    if (params.chatHistory && params.chatHistory.length > 0) {
      if (/(about\s+that|about\s+it|write\s+it|draft\s+it|do\s+that|write\s+about\s+the\s+(first|second|third|last)|cover\s+that|already\s+written|recreate\s+images?|add\s+images?|generate\s+images?|no\s+images?|for\s+it|edit\s+it|edit\s+that|edit\s+the\s+article|edit\s+the\s+previous|edit\s+the\s+last|update\s+the\s+article)/i.test(rawPrompt)) {
        const lastAssistantMsg = [...params.chatHistory].reverse().find(m => m.role === 'assistant');
        if (lastAssistantMsg) {
          const quoted = lastAssistantMsg.content.match(/["'`]([^"'`]{3,80})["'`]/);
          if (quoted) {
            contextResolvedTopic = quoted[1];
          } else {
            const bullet = lastAssistantMsg.content.match(/[•\-\*]\s*([A-Za-z0-9\s]{3,50})/);
            if (bullet) contextResolvedTopic = bullet[1].trim();
          }
        }
      }
    }

    // 2. Try LLM-driven deep semantic understanding
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MonitoringAgent',
        complexity: 'simple',
        schema: z.object({
          intent_type: z.enum(['immediate_action', 'recurring_schedule', 'conversation_response']).describe(
            "Use 'immediate_action' for executable tasks (writing, editing, auditing, keyword research, rank recovery, growth acceleration, site status, content ideas). Use 'recurring_schedule' for recurring requests ('daily audit'). Use 'conversation_response' for general questions ('what is canonical tag')."
          ),
          action_type: z.enum([
            'write_article',
            'edit_article',
            'generate_images',
            'keyword_research',
            'backlink_discovery',
            'technical_audit',
            'internal_linking',
            'on_page_seo',
            'run_scheduled_tasks',
            'general_optimization',
            'seo_diagnostic',
            'rank_recovery',
            'growth_acceleration',
            'site_status_summary',
            'content_ideas',
            'competitor_analysis',
            'indexing_check',
            'answer_question'
          ]),
          goal: z.string().describe("Clear, concise goal statement resolving any vague pronouns using recent chat history."),
          topic: z.string().nullable().describe("Extracted keyword or content topic if specified, or null."),
          target_url: z.string().nullable().describe("Extracted URL if specified, or null."),
          summary: z.string().describe("1-sentence professional summary of the instruction."),
          frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']).nullable(),
          time: z.string().nullable(),
          day_of_week: z.string().nullable(),
          day_of_month: z.number().nullable(),
          response_message: z.string().nullable().describe("If intent_type is 'conversation_response', write a direct, helpful, consultative answer formatted in pristine Markdown. Otherwise null.")
        }),
        system: `You are an elite, human-level AI SEO Consultant and Autonomous Growth Architect for the website "${params.domain}".
Your mission is to understand user natural language with human-level nuance, handling typos, conversational speech, questions, and vague follow-ups.

INTENT CLASSIFICATION TAXONOMY:
1. 'site_status_summary':
   - Questions about performance, traffic, overview, or discoveries: "how is my site doing?", "what's my traffic?", "what are my rankings?", "what did you find?", "give me a status update", "show stats", "any updates?".
   - Set intent_type: 'immediate_action', action_type: 'site_status_summary'.

2. 'growth_acceleration' (RANK FASTER & DO EVERYTHING TO RANK FAST):
   - Requests to rank faster, rank them fast, boost rankings, find striking distance queries (pos 4-20), or get more clicks:
     "the agent should everything to achieve task like eg ranking them fast", "the agent should do everything to help users rank faster",
     "rank them fast", "ranking them fast", "rank faster", "how can I rank faster?", "how to get more clicks", "boost my rankings",
     "striking distance keywords", "low hanging fruit", "rank my site fast", "do everything to rank me fast", "help me rank fast".
   - Set intent_type: 'immediate_action', action_type: 'growth_acceleration'.

3. 'rank_recovery' (FORENSIC DROP DIAGNOSIS & RECOVERY):
   - Questions or requests about lost rankings, dropped positions, or traffic decline: "why did my ranking drop?", "why is traffic down?", "how to recover my rankings?", "fix my dropped ranking", "what happened to my positions?".
   - Set intent_type: 'immediate_action', action_type: 'rank_recovery'.

4. 'content_ideas':
   - Requests for article or content ideas: "what should I write next?", "give me post ideas", "suggest article topics", "what topics am I missing?".
   - Set intent_type: 'immediate_action', action_type: 'content_ideas'.

5. 'competitor_analysis':
   - Requests about competitors: "who are my competitors?", "audit my competitors", "scan competitors", "what are competitors doing?".
   - Set intent_type: 'immediate_action', action_type: 'competitor_analysis'.

6. 'backlink_discovery' (BACKLINKS, LINK PROSPECTING & COMPETITOR LINK SPYING):
   - Requests to find backlinks, link opportunities, spy on competitor links, or explain where and how to get backlinks:
     "find for me backlink", "find backlinks", "get backlinks", "backlinks for my site", "link opportunities", "where can I get links?",
     "where to get it exactly and how to exactly", "spy how competitor get links and explain how to get them", "competitor backlinks", "how to get backlinks".
   - Set intent_type: 'immediate_action', action_type: 'backlink_discovery'.

7. 'generate_images' (IMAGE CREATION / RE-CREATION FOR ARTICLES):
   - Requests to generate, recreate, include, or attach images/visuals to an article or topic:
     "recreate images", "it already written but has no images please recreate images", "generate images for that", "add images to article", "make hero image for [topic]", "include images again".
   - CRITICAL: Never set 'write_article' if the user says the article is already written, or asks only for images!
   - Set intent_type: 'immediate_action', action_type: 'generate_images'.

8. 'edit_article' (EDIT, UPDATE, OR MODIFY AN EXISTING ARTICLE):
   - Requests to edit, revise, update, or expand an already written article, draft, or post:
     "edit the previous article", "edit the last article", "edit post [topic]: [instructions]", "update conclusion", "add FAQ section to article", "modify the article", "change tone to casual", "shorten intro", "it looks good but please edit [change]".
   - CRITICAL: Never set 'write_article' if the user asks to edit, update, modify, or add to an existing article or draft.
   - Set intent_type: 'immediate_action', action_type: 'edit_article'.

9. 'indexing_check':
   - Questions about Google indexation: "is my site indexed?", "check indexing status", "submit URL to Google", "request indexing".
   - Set intent_type: 'immediate_action', action_type: 'indexing_check'.

10. 'write_article':
   - Imperative or casual requests to create brand new content from scratch: "write an article about [topic]", "draft a post on [topic]", "create a guide for [topic]".
   - DO NOT use if the user states the article is already written, asks to edit the article, or only asks for images.
   - Set intent_type: 'immediate_action', action_type: 'write_article'.

11. 'keyword_research':
   - Finding search queries: "find keywords", "discover keyword opportunities", "give me low KD keywords", "what are people searching for?".
   - Set intent_type: 'immediate_action', action_type: 'keyword_research'.

10. 'technical_audit':
   - Crawl and technical health: "audit technical SEO", "crawl my site", "check for 404 errors", "check broken links".
   - Set intent_type: 'immediate_action', action_type: 'technical_audit'.

11. 'conversation_response':
   - Purely educational dialogue, general SEO definitions, compliments, or greetings: "what is canonical tag?", "how does bounce rate work?", "hello", "who are you?", "thank you".
   - Set intent_type: 'conversation_response', action_type: 'answer_question', craft an insightful 'response_message'.

12. 'recurring_schedule':
   - Explicit recurring schedules: "every day at 9am", "weekly report every Monday".

ABSOLUTE GROUNDING MANDATE (RULE 9):
- NEVER fabricate traffic numbers, ranking positions, or crawl counts for "${params.domain}".
- If the user asks about their specific site traffic, performance, or discoveries, ALWAYS classify as 'site_status_summary', 'growth_acceleration', or 'rank_recovery' so live database evidence is retrieved.
- Never provide false or unverified claims. All tool actions must be grounded in reality.`,
        prompt: `User Input: "${rawPrompt}"\nTarget Domain: "${params.domain}"${contextResolvedTopic ? `\nResolved Topic from Context: "${contextResolvedTopic}"` : ''}${chatHistoryContext}`
      });

      let intent_type: AutopilotIntentType = object.intent_type;
      if (modeOverride === 'immediate') intent_type = 'immediate_action';
      if (modeOverride === 'recurring') intent_type = 'recurring_schedule';

      const action_type = object.action_type || (intent_type === 'conversation_response' ? 'answer_question' : 'general_optimization');
      const goal = object.goal || rawPrompt;
      const topic = object.topic || contextResolvedTopic || undefined;
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
        next_run_at: nextRunAt,
        response_message: object.response_message || undefined
      };
    } catch (err: any) {
      console.warn('[AutopilotNLParser] Fallback heuristic parsing:', err?.message || err);
      return this.heuristicFallback(rawPrompt, params.domain, modeOverride, params.frequencyOverride, contextResolvedTopic);
    }
  }

  /**
   * Ultra-robust deterministic fallback if LLM parse is slow or unavailable.
   * Handles typos, slang, questions, and multi-turn patterns.
   */
  private heuristicFallback(
    prompt: string,
    domain: string,
    modeOverride: string,
    frequencyOverride?: string,
    contextTopic?: string
  ): ParsedAutopilotInstruction {
    const lower = prompt.toLowerCase().trim();

    // 1. Explicit Action Matching (Highest Priority)
    // A. Site Status & Discovery Summary
    if (/(how.*(site|doing|progress)|status.*update|what.*(find|found|discover)|my.*(traffic|ranking|stats)|show.*(stats|traffic|rankings)|give me.*(report|update|status)|\/status)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'site_status_summary',
        goal: prompt,
        summary: `Generate real-time executive SEO briefing for ${domain}`,
      };
    }

    // B. Rank Drop & Forensic Recovery
    if (/(why.*(rank|drop|fall|traffic|declin|loss|lost|position)|recover.*(rank|ranking|drop|traffic|position)|fix.*(drop|ranking|rank)|help.*recover|why.*not ranking)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'rank_recovery',
        goal: prompt,
        summary: `Conduct forensic SEO drop investigation & recovery plan for ${domain}`,
      };
    }

    // C. Fast-Rank Growth & Striking Distance
    if (/(rank.*fast|ranking.*fast|rank.*faster|get.*more.*clicks|boost.*(ranks?|rankings?|traffic|clicks)|striking.*distance|low.*hanging.*fruit|push.*to.*top\s*3|click.*accelerator|do.*everything.*to.*rank|achieve.*task.*rank)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'growth_acceleration',
        goal: prompt,
        summary: `Execute full Fast-Rank Pipeline and rapid ranking acceleration for ${domain}`,
      };
    }

    // D. Content Ideas & What to Write Next
    if (/(what.*(write|cover).*next|give.*(article|post|content).*ideas|suggest.*(topics?|articles?|ideas)|what.*topics?.*missing|content.*recommendations?)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'content_ideas',
        goal: prompt,
        summary: `Recommend top high-ROI content opportunities with zero cannibalization for ${domain}`,
      };
    }

    // E. Competitor Analysis
    if (/(who.*competitors?|audit.*competitors?|scan.*competitors?|analyze.*competitor|competitor.*(analysis|gaps|intel))/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'competitor_analysis',
        goal: prompt,
        summary: `Analyze competitor search footprint and content gaps for ${domain}`,
      };
    }

    // E2. Backlink Discovery & Link Building
    if (/(find|get|discover|search|prospect|acquire|where).*?(backlinks?|links?|prospects?|outreach)|backlink/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'backlink_discovery',
        goal: prompt,
        summary: `Discover high-authority backlink prospects and digital PR targets for ${domain}`,
      };
    }

    // F. Indexing Status & Google Search Console Verification
    if (/(is.*(site|url|page).*indexed|check.*index(ing)?|submit.*google|request.*index(ing)?)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'indexing_check',
        goal: prompt,
        summary: `Check Google indexing signals and request priority re-crawl for ${domain}`,
      };
    }

    // F2. Image Generation & Re-creation for Articles
    const isImageGen = /(recreate|generate|create|make|add|include).*?(images?|visuals?|pictures?|graphics?|photos?)|has\s+no\s+images?|missing\s+images?|no\s+images?|recreate\s+image/i.test(lower);
    if (isImageGen) {
      const topic = contextTopic || prompt
        .replace(/^(it('?s)?\s+)?(already\s+written|written)?\s*(but\s+)?(has\s+no\s+images?|missing\s+images?)?\s*(please\s+)?(recreate|generate|create|make|add|include)?\s*(images?|visuals?|pictures?)?\s*(for|about|on)?\s*/i, '')
        .trim();
      return {
        intent_type: 'immediate_action',
        action_type: 'generate_images',
        goal: prompt,
        topic: topic || 'Target Article',
        summary: `Generate and embed high-resolution 16:9 visual assets into "${topic || 'article'}" for ${domain}`,
      };
    }

    // F3. Edit / Update Existing Article
    const isEditArticle = /(edit|update|modify|revise|change|shorten|expand|add\s+to|add\s+faq|improve).*?(previous|last|recent|existing)?\s*(article|post|draft|piece|content)/i.test(lower) ||
      /^(edit|update|modify|revise)\s+(the\s+)?(previous|last|recent|article|post|draft)/i.test(lower) ||
      /^(edit|update|modify|revise)\s*:/i.test(lower);
    if (isEditArticle) {
      const isPureImg = /(image|visual|photo|picture|graphic)/i.test(lower) && !/(text|paragraph|section|words?|content|intro|conclusion|faq|heading)/i.test(lower);
      if (isPureImg) {
        return {
          intent_type: 'immediate_action',
          action_type: 'generate_images',
          goal: prompt,
          topic: contextTopic || 'Target Article',
          summary: `Recreate and attach high-resolution visual assets for "${contextTopic || 'article'}"`,
        };
      }
      return {
        intent_type: 'immediate_action',
        action_type: 'edit_article',
        goal: prompt,
        topic: contextTopic || undefined,
        summary: `Edit existing article according to instructions: "${prompt.slice(0, 80)}"`,
      };
    }

    // G. Write Article (handles typos: wrtie, craete, etc.)
    const isExplicitWrite = /(wrtie|write|writ|draft|craete|create|make|generate|publish|post)\s+(an?\s+)?(article|blog|post|guide|content|piece)/i.test(lower);
    const isContextWrite = contextTopic && /(write\s+it|draft\s+it|cover\s+that|post\s+it|do\s+that)/i.test(lower);
    if ((isExplicitWrite || isContextWrite) && !lower.includes('already written') && !lower.includes('already wrote')) {
      let topic = contextTopic;
      if (!topic) {
        const cleanPrompt = prompt
          .replace(/^(write|wrote|draft|create|generate|publish)\s+(an?\s+)?(article|blog|post|guide|content)?\s*(about|on|covering|for)?\s*/i, '')
          .replace(/\s*(and\s+)?(post|publish)\s+it$/i, '')
          .trim();
        if (cleanPrompt && !/^(write|wrote|article|blog|post|guide|content|post\s+it)$/i.test(cleanPrompt)) {
          topic = cleanPrompt;
        } else {
          const match = prompt.match(/(?:about|on|covering|topic|for)\s+["']?([^"'.?,]+)["']?/i);
          if (match && match[1]) topic = match[1].trim();
        }
      }

      return {
        intent_type: 'immediate_action',
        action_type: 'write_article',
        goal: prompt,
        topic: topic || 'High-impact industry topic',
        summary: `Draft comprehensive 1,200–1,600 word SEO article on "${topic || 'target topic'}" for ${domain}`,
      };
    }

    // H. Keyword Research
    if (/(find|get|research|discover|show|give).*?(keywords?|kws|search terms?|queries)/i.test(lower) || lower.includes('keyword')) {
      const match = prompt.match(/(?:for|about|on|in)\s+["']?([^"'.?,]+)["']?/i);
      return {
        intent_type: 'immediate_action',
        action_type: 'keyword_research',
        goal: prompt,
        topic: match ? match[1].trim() : undefined,
        summary: `Discover high-demand, low-KD keyword opportunities for ${domain}`,
      };
    }

    // I. Technical Audit & Crawl
    if (/(audit|crawl|scan).*?(site|website|technical|seo|health|broken links?|errors?)/i.test(lower)) {
      return {
        intent_type: 'immediate_action',
        action_type: 'technical_audit',
        goal: prompt,
        summary: `Run technical SEO audit and crawler for ${domain}`,
      };
    }

    // J. Recurring Schedules
    if (modeOverride === 'recurring' || /(everyday|daily|every\s+day|every\s+morning|every\s+week|weekly|monthly)/i.test(lower)) {
      const freq = lower.includes('week') ? 'weekly' : lower.includes('month') ? 'monthly' : 'daily';
      return {
        intent_type: 'recurring_schedule',
        action_type: 'technical_audit',
        goal: prompt,
        summary: `Run ${freq} automated SEO audit for ${domain}`,
        schedule: {
          frequency: freq,
          time: '09:00',
          timezone: 'UTC',
        },
        next_run_at: new Date(Date.now() + 86400000).toISOString(),
      };
    }

    // 2. Conversational Dialogue & Helpful Consultative Q&A
    let response_message = `👋 I'm your AI SEO Consultant for *${domain}*.\n\nYou asked: _"${prompt}"_\n\nHow can I help you grow search traffic? You can ask me any SEO questions, analyze keywords, or tell me to write comprehensive articles!`;

    if (/^(hello|hi|hey|good\s+morning|good\s+evening|howdy|sup|yo)\b/i.test(lower)) {
      response_message = `👋 Hello! I am your Autonomous AI SEO Growth Agent for *${domain}*.\n\nYou can talk to me naturally or give me commands:\n\n• 📝 *"Write an article about [topic]"*\n• ⚡ *"How can I rank faster?"*\n• 🚨 *"Why did my ranking drop?"*\n• 🎯 *"Find low-competition keywords"*\n• 💡 *"What should I write next?"*\n• 📊 *"How is my site doing?"*\n\nWhat would you like to achieve today?`;
    } else if (/(thank|thanks|cool|awesome|great|perfect|good job)/i.test(lower)) {
      response_message = `🙌 You're very welcome! I'm constantly monitoring your search positions, click-through rates, and technical signals to help *${domain}* capture Page 1 rankings. Let me know what you'd like to work on next!`;
    } else if (/(who.*(are you|made you)|what can you do)/i.test(lower)) {
      response_message = `🤖 I am your Autonomous AI SEO Growth Agent for *${domain}*. Built with live Google Search Console intelligence, an enterprise editorial engine, and an automated rank recovery system.\n\nI autonomously:\n1. Write and publish 1,200–1,600 word articles with internal linking and diagrams\n2. Mine striking-distance queries (positions 4–20) for 8x click multipliers\n3. Perform forensic root-cause analysis when rankings drop\n4. Push instant Google Indexing requests.`;
    }

    return {
      intent_type: 'conversation_response',
      action_type: 'answer_question',
      goal: prompt,
      summary: `Consultative dialogue for ${domain}`,
      response_message,
    };
  }
}
