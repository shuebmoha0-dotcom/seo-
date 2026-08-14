import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'company' | 'product' | 'audience' | 'brand' | 'content_strategy'
  | 'seo_strategy' | 'competitors' | 'keywords' | 'content'
  | 'preferences' | 'decisions' | 'experiments' | 'technical' | 'workflow';

export type MemoryConfidence = 'high' | 'medium' | 'low';

export interface MemoryItem {
  id: string;
  website_id?: string;
  category: MemoryCategory;
  content: string;
  source: string;
  source_detail?: string;
  confidence: MemoryConfidence;
  is_important: boolean;
  is_outdated: boolean;
  outdated_reason?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface MemoryActivityItem {
  id: string;
  memory_id: string;
  action: 'learned' | 'updated' | 'deleted' | 'marked_important' | 'user_added' | 'user_edited' | 'outdated';
  summary: string;
  triggered_by: 'agent' | 'user';
  created_at: string;
}

// Maps agent task types to relevant memory categories
const TASK_MEMORY_MAP: Record<string, MemoryCategory[]> = {
  content: ['brand', 'audience', 'product', 'content_strategy', 'preferences', 'decisions', 'company'],
  keyword_research: ['audience', 'seo_strategy', 'competitors', 'keywords', 'decisions', 'company', 'content_strategy'],
  internal_linking: ['content', 'technical', 'decisions', 'seo_strategy'],
  seo_strategy: ['seo_strategy', 'experiments', 'decisions', 'competitors', 'company', 'audience'],
  on_page_seo: ['brand', 'seo_strategy', 'content', 'keywords', 'decisions'],
  technical_seo: ['technical', 'decisions', 'workflow'],
  backlinks: ['seo_strategy', 'competitors', 'decisions'],
  competitor_analysis: ['competitors', 'seo_strategy', 'audience', 'keywords'],
  strategy: ['seo_strategy', 'experiments', 'decisions', 'competitors', 'company', 'audience', 'content_strategy'],
};

// ─── Memory Agent Class ───────────────────────────────────────────────────────

export class MemoryAgent {

  // 1. Extract relevant memories for a given task type
  filterForTask(memories: MemoryItem[], taskType: string): MemoryItem[] {
    const relevantCategories = TASK_MEMORY_MAP[taskType] || Object.keys(TASK_MEMORY_MAP).flatMap(k => TASK_MEMORY_MAP[k]);
    return memories
      .filter((m: any) => !m.is_outdated && relevantCategories.includes(m.category))
      .sort((a, b) => {
        // Important memories first, then high confidence
        if (a.is_important && !b.is_important) return -1;
        if (!a.is_important && b.is_important) return 1;
        const confOrder: Record<MemoryConfidence, number> = { high: 0, medium: 1, low: 2 };
        return confOrder[a.confidence] - confOrder[b.confidence];
      })
      .slice(0, 25); // Cap at 25 to keep context manageable
  }

  // 2. Format memories as concise context string for LLM injection
  formatForContext(memories: MemoryItem[]): string {
    if (memories.length === 0) return 'No project memory available.';

    const grouped: Partial<Record<MemoryCategory, MemoryItem[]>> = {};
    for (const m of memories) {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category]!.push(m);
    }

    const CATEGORY_LABELS: Record<MemoryCategory, string> = {
      company: 'Company',
      product: 'Product / Service',
      audience: 'Target Audience',
      brand: 'Brand Voice & Style',
      content_strategy: 'Content Strategy',
      seo_strategy: 'SEO Strategy',
      competitors: 'Competitors',
      keywords: 'Keyword Decisions',
      content: 'Existing Content',
      preferences: 'User Preferences',
      decisions: 'Important Decisions',
      experiments: 'Experiments & Results',
      technical: 'Technical Context',
      workflow: 'Workflow',
    };

    return Object.entries(grouped)
      .map(([cat, items]) => {
        const label = CATEGORY_LABELS[cat as MemoryCategory] || cat;
        const lines = items!.map((m: any) =>
          `- ${m.content}${m.confidence === 'low' ? ' [unverified]' : ''}${m.is_important ? ' ⭐' : ''}`
        ).join('\n');
        return `${label}:\n${lines}`;
      })
      .join('\n\n');
  }

  // 3. Extract new memories from agent activity using AI
  async extractMemoriesFromActivity(params: {
    activity_type: string;
    activity_summary: string;
    user_messages?: string;
    agent_output?: string;
    existing_memory_ids?: string[];
  }): Promise<Array<{
    category: MemoryCategory;
    content: string;
    source: string;
    source_detail: string;
    confidence: MemoryConfidence;
    tags: string[];
    is_important: boolean;
  }>> {
    try {
      const { object } = await LLMProvider.generateObject({
      agent: 'MemoryAgent',
      
        
        schema: z.object({
          memories: z.array(z.object({
            category: z.enum([
              'company', 'product', 'audience', 'brand', 'content_strategy',
              'seo_strategy', 'competitors', 'keywords', 'content',
              'preferences', 'decisions', 'experiments', 'technical', 'workflow',
            ]),
            content: z.string(),
            confidence: z.enum(['high', 'medium', 'low']),
            is_important: z.boolean(),
            tags: z.array(z.string()),
          })),
        }),
        system: `You are a memory extraction specialist for an AI SEO agent system.

Your job: Extract DURABLE, PROJECT-RELEVANT information from agent activity that will help the agent work better on future tasks.

EXTRACT:
- Company/product/service information
- Target audience and market
- Brand voice and preferences
- SEO strategy decisions
- Content strategy decisions
- Competitor information
- Keyword decisions (included or excluded)
- Important user preferences
- Successful experiments
- Failed strategies
- Business goals
- Important constraints or rules

DO NOT EXTRACT:
- Temporary instructions for a single task
- One-off article requirements
- Sensitive personal data
- Trivial conversation details
- Unverified speculation
- Information that is already obvious from context

QUALITY BAR: Only extract memories that will genuinely help the agent do better work on future tasks. Be selective — 3 high-quality memories are better than 10 low-quality ones.`,
        prompt: `Activity type: ${params.activity_type}

${params.user_messages ? `User messages:\n${params.user_messages}\n` : ''}
${params.agent_output ? `Agent output/findings:\n${params.agent_output}\n` : ''}
Activity summary: ${params.activity_summary}

Extract durable project memories from this activity. Be selective and accurate.`,
      });

      return object.memories.map((m: any) => ({
        ...m,
        source: params.activity_type,
        source_detail: params.activity_summary.slice(0, 200),
      }));
    } catch {
      return [];
    }
  }

  // 4. Detect conflicts between new memory and existing memories
  detectConflicts(newContent: string, existingMemories: MemoryItem[]): MemoryItem[] {
    const newLower = newContent.toLowerCase();
    return existingMemories.filter(existing => {
      // Simple heuristic: same category + overlapping keywords suggests potential conflict
      const existingLower = existing.content.toLowerCase();
      const overlap = newLower.split(' ').filter(w => w.length > 4 && existingLower.includes(w));
      return overlap.length >= 3;
    });
  }

  // 5. Generate human-readable activity summary
  generateActivitySummary(
    action: MemoryActivityItem['action'],
    memory: { category: MemoryCategory; content: string }
  ): string {
    const actionPhrases: Record<MemoryActivityItem['action'], string> = {
      learned: '🧠 Agent learned',
      updated: '🧠 Agent updated',
      deleted: '🗑 Memory deleted',
      marked_important: '⭐ Marked as important',
      user_added: '✍️ User added',
      user_edited: '✏️ User edited',
      outdated: '⚠️ Marked outdated',
    };
    const phrase = actionPhrases[action] || 'Memory changed';
    const preview = memory.content.length > 80
      ? memory.content.slice(0, 77) + '…'
      : memory.content;
    return `${phrase}: "${preview}"`;
  }
}
