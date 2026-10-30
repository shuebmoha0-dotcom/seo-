import { LLMProvider } from '@/lib/tools/llm';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteNicheProfile } from './siteNicheProfiler';
import { SiteInventory } from './siteContentGapDetector';
import { DuplicateArticleChecker } from './duplicateChecker';

export interface TrendingKeywordOpportunity {
  keyword: string;
  working_title: string;
  target_category: string;
  trend_type: 'breakout' | 'industry_shift' | 'tool_release' | 'regulatory_update' | 'rising_search';
  urgency: 'high' | 'medium';
  search_intent: 'informational' | 'commercial' | 'problem_solution' | 'comparison';
  estimated_volume: number;
  estimated_kd: number;
  first_mover_advantage: string;
  trend_evidence: string;
}

export class TrendKeywordDetector {
  /**
   * Discovers real-time trending, breakout, and emerging keyword opportunities
   * for any client website to capture search traffic before competitors.
   */
  static async discoverTrendingKeywords(params: {
    websiteId: string;
    domain: string;
    siteUrl?: string;
    siteProfile: SiteNicheProfile;
    inventory: SiteInventory;
    limit?: number;
  }): Promise<TrendingKeywordOpportunity[]> {
    const { websiteId, domain, siteProfile, inventory, limit = 6 } = params;

    const coveredTitlesSample = inventory.coveredTitles.slice(0, 35);
    const primaryNiche = siteProfile.primaryNiche || domain;
    const contentPillars = siteProfile.contentPillars || [];
    const isEstablished = siteProfile.authorityTier === 'established';

    // Target KD ranges based on domain authority
    const targetKdMax = isEstablished ? 50 : 30;
    const targetVolMin = isEstablished ? 800 : 250;

    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'KeywordAgent',
        complexity: 'complex',
        schema: z.object({
          trends: z.array(z.object({
            keyword: z.string().describe('The breakout or rising search query'),
            working_title: z.string().describe('Engaging, timely editorial headline (50-65 chars) capitalizing on the trend'),
            target_category: z.string().describe('The content pillar or category this belongs to'),
            trend_type: z.enum(['breakout', 'industry_shift', 'tool_release', 'regulatory_update', 'rising_search']),
            urgency: z.enum(['high', 'medium']),
            search_intent: z.enum(['informational', 'commercial', 'problem_solution', 'comparison']),
            estimated_volume: z.number().describe('Estimated monthly search volume (>= 250)'),
            estimated_kd: z.number().describe('Estimated keyword difficulty (0-100)'),
            first_mover_advantage: z.string().describe('Why writing on this right now outranks slow competitors'),
            trend_evidence: z.string().describe('What triggered this trend (e.g. 2026 algorithm change, new tool feature, market shift)'),
          })),
        }),
        system: `You are a real-time SEO Trend Analyst and First-Mover Intelligence Agent.
Your job is to identify BREAKING, RISING, and TRENDING search opportunities in Google Search for "${domain}" (${primaryNiche}) that competitors have not yet fully targeted.

CLIENT NICHE PROFILE:
• Primary Niche: ${primaryNiche}
• Target Audience: ${siteProfile.targetAudience}
• Core Offerings: ${siteProfile.coreOfferings.join(', ')}
• Content Pillars: ${contentPillars.join(', ')}
• Negative Boundaries: ${siteProfile.negativeBoundaries.join('; ')}

AUTHORITY & DIFFICULTY RULES:
• Site Tier: ${isEstablished ? 'Established' : 'New / Early Stage (Low Authority)'}
• Maximum Keyword Difficulty: KD <= ${targetKdMax} (Must be easily rankable for this domain)
• Minimum Search Volume: Volume >= ${targetVolMin}/mo (Strictly NO ghost keywords with 0-50 volume)

CATEGORICAL SPREAD & ANTI-REPETITION MANDATE:
1. MULTI-PILLAR ROTATION:
   - Do NOT dump all trending queries into one category.
   - Distribute the trending keywords across different categories:
     ${inventory.categories.map(c => `* ${c.name} (currently has ${c.count || 0} articles)`).join('\n     ')}
   - HEAVILY PRIORITIZE thin/under-served categories (${inventory.thinCategories.join(', ') || 'categories with fewer articles'}).
   - Strictly limit queries in saturated categories (such as categories with >20 posts).

2. REAL-WORLD 2026 SEARCH TREND TRIGGERS TO EXPLORE:
   - Platform & Algorithm Updates: Google Postmaster, Yahoo DMARC/SPF requirements, LinkedIn algorithm shifts, spam filter changes.
   - New Tool Releases & Tech Stack Shifts: Emerging AI agents, new software features, tool pricing shifts, migrations/alternatives.
   - Modern Tactical Frameworks: Trigger-based prospecting, signal-led outbound, multi-threading buying groups, intent-driven follow-ups.
   - Comparative Queries: "X vs Y in 2026", "alternatives to X", "best tool for Y in 2026".

ALREADY PUBLISHED ARTICLES (NEVER DUPLICATE):
${coveredTitlesSample.map(t => `- "${t}"`).join('\n')}`,
        prompt: `Discover ${limit} high-velocity, real-time TRENDING keyword opportunities in "${primaryNiche}" across diverse categories. Ensure each has real search demand, easy rankability (KD <= ${targetKdMax}), and provides first-mover advantage over competitors.`,
      });

      // Filter against inventory to prevent duplicates
      const validTrends: TrendingKeywordOpportunity[] = [];
      for (const t of object.trends) {
        const dupCheck = DuplicateArticleChecker.findDuplicateInInventory(t.keyword, inventory);
        if (!dupCheck.isDuplicate) {
          validTrends.push(t);
        }
      }

      // Save discovered trending opportunities to database
      if (validTrends.length > 0) {
        const supabase = createAdminClient();
        for (const t of validTrends) {
          try {
            await supabase.from('keyword_opportunities').insert({
              website_id: websiteId,
              keyword: t.keyword,
              is_primary: true,
              search_intent: t.search_intent,
              content_type: 'blog_article',
              search_volume: t.estimated_volume,
              keyword_difficulty: t.estimated_kd,
              business_relevance: 95,
              competition: t.estimated_kd < 25 ? 'low' : 'medium',
              recommended_action: 'create_new_page',
              priority: t.urgency === 'high' ? 'high' : 'medium',
              confidence: 'high',
              evidence: `[TREND: ${t.trend_type.toUpperCase()}] ${t.trend_evidence} — ${t.first_mover_advantage}`,
              status: 'pending',
            });

            await supabase.from('keywords').upsert({
              website_id: websiteId,
              term: t.keyword,
              intent: t.search_intent,
              difficulty: String(t.estimated_kd),
              volume: t.estimated_volume,
            }, { onConflict: 'website_id,term' });
          } catch (_) {}
        }

        // Store trend audit in persistent memory
        try {
          const memoryContent = `🔥 Real-Time Search Trends Discovered (${new Date().toISOString().split('T')[0]}):\n` +
            validTrends.map(t => `• "${t.keyword}" (${t.estimated_volume}/mo, KD ${t.estimated_kd}) [${t.target_category}] - ${t.trend_evidence}`).join('\n');
          await supabase.from('project_memory').insert({
            website_id: websiteId,
            category: 'trending_keywords',
            content: memoryContent,
            source: 'trend_keyword_detector',
            confidence: 'high',
          });
        } catch (_) {}
      }

      return validTrends.slice(0, limit);
    } catch (err: any) {
      console.warn('[TrendKeywordDetector] Trend discovery notice:', err?.message || err);
      return [];
    }
  }
}
