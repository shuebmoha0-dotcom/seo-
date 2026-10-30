import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'company'
  | 'product'
  | 'audience'
  | 'brand'
  | 'content_strategy'
  | 'seo_strategy'
  | 'competitors'
  | 'keywords'
  | 'content'
  | 'preferences'
  | 'decisions'
  | 'experiments'
  | 'technical'
  | 'workflow'
  | 'content_pillars'
  | 'trending_keywords';

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
  content: ['brand', 'audience', 'product', 'content_strategy', 'content_pillars', 'preferences', 'decisions', 'experiments', 'company'],
  keyword_research: ['audience', 'seo_strategy', 'competitors', 'keywords', 'content_pillars', 'trending_keywords', 'decisions', 'experiments', 'company', 'content_strategy'],
  internal_linking: ['content', 'technical', 'decisions', 'seo_strategy'],
  seo_strategy: ['seo_strategy', 'experiments', 'decisions', 'content_pillars', 'competitors', 'company', 'audience'],
  on_page_seo: ['brand', 'seo_strategy', 'content', 'keywords', 'decisions', 'experiments'],
  technical_seo: ['technical', 'decisions', 'workflow'],
  backlinks: ['seo_strategy', 'competitors', 'decisions'],
  competitor_analysis: ['competitors', 'seo_strategy', 'audience', 'keywords'],
  strategy: ['seo_strategy', 'experiments', 'decisions', 'content_pillars', 'competitors', 'company', 'audience', 'content_strategy'],
};

// ─── Memory Agent Class ───────────────────────────────────────────────────────

export class MemoryAgent {
  // 1. Extract relevant memories for a given task type
  filterForTask(memories: MemoryItem[], taskType: string): MemoryItem[] {
    const relevantCategories = TASK_MEMORY_MAP[taskType] || Object.keys(TASK_MEMORY_MAP).flatMap((k) => TASK_MEMORY_MAP[k]);
    return memories
      .filter((m: any) => {
        if (m.is_outdated) return false;
        if (!relevantCategories.includes(m.category)) return false;
        const text = (m.content || '').trim();
        if (text.length < 15) return false;
        if (/^(write article|hi|hello|status|check)/i.test(text)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_important && !b.is_important) return -1;
        if (!a.is_important && b.is_important) return 1;
        const confOrder: Record<MemoryConfidence, number> = { high: 0, medium: 1, low: 2 };
        return (confOrder[a.confidence] ?? 1) - (confOrder[b.confidence] ?? 1);
      })
      .slice(0, 25);
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
      content_pillars: 'Content Pillars & Saturation Rules',
      seo_strategy: 'SEO Strategy',
      competitors: 'Competitors',
      keywords: 'Keyword Decisions',
      trending_keywords: 'Trending Keywords',
      content: 'Existing Content',
      preferences: 'User Preferences',
      decisions: 'Autonomous Strategic Decisions',
      experiments: 'Outcome Experiments & Learnings',
      technical: 'Technical Context',
      workflow: 'Workflow',
    };

    return Object.entries(grouped)
      .map(([cat, items]) => {
        const label = CATEGORY_LABELS[cat as MemoryCategory] || cat;
        const lines = items!
          .map((m: any) => `- ${m.content}${m.confidence === 'low' ? ' [unverified]' : ''}${m.is_important ? ' ⭐' : ''}`)
          .join('\n');
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
  }): Promise<
    Array<{
      category: MemoryCategory;
      content: string;
      source: string;
      source_detail: string;
      confidence: MemoryConfidence;
      tags: string[];
      is_important: boolean;
    }>
  > {
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MemoryAgent',
        complexity: 'complex',
        schema: z.object({
          memories: z.array(
            z.object({
              category: z.enum([
                'company',
                'product',
                'audience',
                'brand',
                'content_strategy',
                'seo_strategy',
                'competitors',
                'keywords',
                'content',
                'preferences',
                'decisions',
                'experiments',
                'technical',
                'workflow',
              ]),
              content: z.string(),
              confidence: z.enum(['high', 'medium', 'low']),
              is_important: z.boolean(),
              tags: z.array(z.string()),
            })
          ),
        }),
        system: `You are a memory extraction specialist for an AI SEO agent system.
Your job: Extract DURABLE, PROJECT-RELEVANT information from agent activity that will help the agent work better on future tasks.
Only extract memories that will genuinely help the agent do better work on future tasks (max 3 concise items).`,
        prompt: `Activity type: ${params.activity_type}
${params.user_messages ? `User messages:\n${params.user_messages}\n` : ''}
${params.agent_output ? `Agent output/findings:\n${params.agent_output}\n` : ''}
Activity summary: ${params.activity_summary}

Extract durable project memories from this activity.`,
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

  /**
   * Records a deterministic, empirical experiment learning in `project_memory` (category: 'experiments')
   * without burning extra LLM tokens.
   */
  static async recordExperimentOutcome(params: {
    websiteId: string;
    outcomeStatus: 'WIN' | 'EARLY_TRACTION' | 'REGRESSION' | 'STAGNANT';
    learningSummary: string;
    sourceDetail?: string;
  }): Promise<void> {
    try {
      const supabase = createAdminClient();

      // Prevent duplicate identical learning strings
      const { data: existing } = await supabase
        .from('project_memory')
        .select('id, content')
        .eq('website_id', params.websiteId)
        .eq('category', 'experiments')
        .order('created_at', { ascending: false })
        .limit(15);

      if (existing && existing.some((e) => e.content === params.learningSummary)) {
        return;
      }

      // Cap 'experiments' memories at 15 most recent per website to keep context sharp
      if (existing && existing.length >= 15) {
        const oldIds = existing.slice(14).map((e) => e.id);
        await supabase.from('project_memory').delete().in('id', oldIds);
      }

      await supabase.from('project_memory').insert({
        website_id: params.websiteId,
        category: 'experiments',
        content: params.learningSummary,
        source: `outcome_evaluator_${params.outcomeStatus.toLowerCase()}`,
        confidence: 'high',
      });
    } catch (err) {
      console.warn('[MemoryAgent] Failed to record experiment outcome:', err);
    }
  }

  /**
   * Prunes operational noise (such as raw "Write article" chat strings or stale indexing logs)
   * from `project_memory` so strategic LLM prompts receive clean, high-signal context.
   */
  static async pruneOperationalNoise(websiteId: string): Promise<number> {
    try {
      const supabase = createAdminClient();
      const { data: rows } = await supabase
        .from('project_memory')
        .select('id, category, content, source, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(300);

      if (!rows || rows.length === 0) return 0;

      const idsToDelete: string[] = [];
      let indexingLogCount = 0;

      for (const r of rows) {
        const text = (r.content || '').trim();
        // Remove trivial 1-3 word chat echoes ("Write article", "Hi", etc.)
        if (text.length < 18 && r.category !== 'content_pillars') {
          idsToDelete.push(r.id);
          continue;
        }
        // Keep only the 10 most recent google_indexing_api logs in project_memory
        if (r.source === 'google_indexing_api') {
          indexingLogCount++;
          if (indexingLogCount > 10) {
            idsToDelete.push(r.id);
          }
        }
      }

      if (idsToDelete.length > 0) {
        await supabase.from('project_memory').delete().in('id', idsToDelete.slice(0, 100));
      }

      return idsToDelete.length;
    } catch (err) {
      console.warn('[MemoryAgent] Prune notice:', err);
      return 0;
    }
  }

  // 4. Detect conflicts between new memory and existing memories
  detectConflicts(newContent: string, existingMemories: MemoryItem[]): MemoryItem[] {
    const newLower = newContent.toLowerCase();
    return existingMemories.filter((existing) => {
      const existingLower = existing.content.toLowerCase();
      const overlap = newLower.split(' ').filter((w) => w.length > 4 && existingLower.includes(w));
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
    const preview = memory.content.length > 80 ? memory.content.slice(0, 77) + '…' : memory.content;
    return `${phrase}: "${preview}"`;
  }
}
