import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { SiteNicheProfiler, SiteNicheProfile } from './siteNicheProfiler';

export interface FastRankTopic {
  keyword: string;
  role: 'pillar' | 'spoke';
  topic_type: 'reddit_displacement' | 'troubleshooting_guide' | 'comparison_alternative' | 'step_by_step_playbook';
  working_title: string;
  estimated_volume: number;
  estimated_kd: number;
  search_intent: 'informational' | 'commercial_investigation' | 'problem_solution' | 'comparison';
  why_rankable_fast: string;
  featured_snippet_target: string;
  internal_link_anchor: string;
  links_to?: string; // which topic it links to in the silo
}

export interface TopicalSiloBlueprint {
  silo_name: string;
  core_pillar: FastRankTopic;
  spokes: FastRankTopic[];
  linking_strategy: string;
  expected_ranking_timeframe: string;
}

export interface FastRankPlaybook {
  website_id: string;
  domain: string;
  site_niche: string;
  authority_status: {
    tier: 'new' | 'established';
    page_count: number;
    backlink_count: number;
    gsc_impressions: number;
    is_sandbox_constrained: boolean;
    diagnosis: string;
  };
  fast_rank_silo: TopicalSiloBlueprint;
  immediate_quick_wins: FastRankTopic[];
  technical_acceleration_checklist: Array<{
    item: string;
    status: 'ready' | 'recommended' | 'critical';
    action: string;
  }>;
  executive_summary_markdown: string;
}

export class FastRankEngine {
  /**
   * Generates a complete Fast-Rank Playbook specifically engineered for new and
   * low-authority websites to rank in 2 to 4 weeks without waiting for backlink equity.
   */
  static async generateFastRankPlaybook(params: {
    websiteId: string;
    domain: string;
    siteUrl?: string;
    forceFresh?: boolean;
  }): Promise<FastRankPlaybook> {
    const { websiteId, domain } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    console.log(`[FastRankEngine] Synthesizing Fast-Rank Playbook for new/early-stage site: ${domain}...`);

    // 1. Profile site niche and extract verified content pillars & live categories
    const siteProfile = await SiteNicheProfiler.profileSite({
      websiteId,
      domain,
      siteUrl,
    });

    // 2. Fetch existing published content to ensure zero cannibalization
    const [draftsRes, pagesRes, scRes] = await Promise.all([
      supabase.from('content_drafts').select('working_title, primary_keyword, status').eq('website_id', websiteId).limit(40),
      supabase.from('pages').select('path, title').eq('website_id', websiteId).limit(30),
      supabase.from('search_console_data').select('clicks, impressions').eq('website_id', websiteId).limit(10),
    ]);

    const existingTitles = (draftsRes.data || []).map((d: any) => d.working_title || d.primary_keyword);
    const existingKeywords = (draftsRes.data || []).map((d: any) => (d.primary_keyword || '').toLowerCase());
    const totalGscImpressions = (scRes.data || []).reduce((acc: number, curr: any) => acc + (curr.impressions || 0), 0);
    const totalPages = pagesRes.data?.length || 0;

    const isSandboxConstrained = siteProfile.authorityTier === 'new' || totalPages < 25 || siteProfile.authorityMetrics.backlinkCount < 10;

    // 3. AI-driven Fast-Rank Zero-Competition Discovery & Silo Architect
    const promptContext = {
      domain,
      primaryNiche: siteProfile.primaryNiche,
      contentPillars: siteProfile.contentPillars,
      coreOfferings: siteProfile.coreOfferings,
      targetAudience: siteProfile.targetAudience,
      liveCategories: siteProfile.liveCategories,
      existingTitlesSample: existingTitles.slice(0, 15),
      authorityTier: siteProfile.authorityTier,
      pageCount: totalPages,
      backlinks: siteProfile.authorityMetrics.backlinkCount,
    };

    const { object } = await LLMProvider.generateObject({
      agent: 'GrowthAgent',
      schema: z.object({
        silo_name: z.string().describe('The primary topical authority silo name (e.g. "Cold Email Deliverability & Primary Inbox Silo")'),
        core_pillar: z.object({
          keyword: z.string(),
          working_title: z.string(),
          estimated_volume: z.number().min(250).max(1800),
          estimated_kd: z.number().min(8).max(22),
          search_intent: z.enum(['informational', 'commercial_investigation', 'problem_solution', 'comparison']),
          why_rankable_fast: z.string(),
          featured_snippet_target: z.string().describe('The exact 1-sentence question this pillar answers directly in its first 100 words'),
          internal_link_anchor: z.string(),
        }),
        spokes: z.array(z.object({
          keyword: z.string(),
          topic_type: z.enum(['reddit_displacement', 'troubleshooting_guide', 'comparison_alternative', 'step_by_step_playbook']),
          working_title: z.string(),
          estimated_volume: z.number().min(200).max(1200),
          estimated_kd: z.number().min(5).max(18),
          search_intent: z.enum(['informational', 'commercial_investigation', 'problem_solution', 'comparison']),
          why_rankable_fast: z.string(),
          featured_snippet_target: z.string(),
          internal_link_anchor: z.string(),
        })).min(3).max(4),
        linking_strategy: z.string().describe('Clear explanation of how the spokes link up to the pillar and each other to trigger topical authority algorithms'),
        quick_wins: z.array(z.object({
          keyword: z.string(),
          working_title: z.string(),
          estimated_volume: z.number(),
          estimated_kd: z.number(),
          why_rankable_fast: z.string(),
        })).min(2).max(3),
      }),
      prompt: `
        You are the Chief SEO Growth Engineer specialized in RAPID RANKING FOR NEW WEBSITES.
        
        WEBSITE PROFILE & LIVE EVIDENCE:
        ${JSON.stringify(promptContext, null, 2)}

        CRITICAL FAST-RANK RULES FOR NEW DOMAINS (0-30 BACKLINKS):
        1. ZERO GHOST KEYWORDS: Never suggest keywords with negligible (< 200/mo) search volume. Ranking for a term with 0 searches brings 0 visitors.
        2. EASY-TO-RANK ONLY (KD 5–20, STRICTLY KD <= 22):
           - New sites have low domain authority. They CANNOT rank for head terms.
           - Target specific long-tail queries where Google Page 1 currently ranks weak forum threads (Reddit, Quora), outdated PDFs, or thin articles that can be displaced.
        3. TOPICAL SILO ARCHITECTURE:
           - Build 1 Core Pillar (1,500 words, comprehensive anchor guide).
           - Build 3 Spoke Articles (1,200 words each, targeting specific questions, troubleshooting, or comparisons).
           - Every spoke MUST link up to the Pillar with a specific natural anchor text.
        4. FEATURED SNIPPET (POSITION 0) TARGETING:
           - Provide the exact question that can be answered in the first 80-120 words of the post so Google awards Position 0 immediately.
        5. ZERO CANNIBALIZATION:
           - Do NOT duplicate any already published article titles listed above.
      `
    });

    // Format spokes with pillar linkage
    const formattedSpokes: FastRankTopic[] = object.spokes.map((s: any) => ({
      ...s,
      role: 'spoke',
      links_to: object.core_pillar.keyword,
    }));

    const formattedPillar: FastRankTopic = {
      ...object.core_pillar,
      role: 'pillar',
      topic_type: 'step_by_step_playbook',
      links_to: undefined,
    };

    const fastRankSilo: TopicalSiloBlueprint = {
      silo_name: object.silo_name,
      core_pillar: formattedPillar,
      spokes: formattedSpokes,
      linking_strategy: object.linking_strategy,
      expected_ranking_timeframe: '14 to 28 days upon indexing',
    };

    const immediateQuickWins: FastRankTopic[] = object.quick_wins.map((q: any) => ({
      keyword: q.keyword,
      role: 'spoke',
      topic_type: 'reddit_displacement',
      working_title: q.working_title,
      estimated_volume: q.estimated_volume,
      estimated_kd: q.estimated_kd,
      search_intent: 'problem_solution',
      why_rankable_fast: q.why_rankable_fast,
      featured_snippet_target: `How to master ${q.keyword}`,
      internal_link_anchor: q.keyword,
    }));

    // 4. Technical Acceleration & Indexing Checklist
    const technicalChecklist = [
      {
        item: 'Instant Search Engine Pinging (IndexNow & Google API)',
        status: 'ready' as const,
        action: 'Automatically pings Bing, Yandex, Naver, and Google Indexing API the moment posts are published.',
      },
      {
        item: 'Position 0 Featured Snippet Formatting',
        status: 'ready' as const,
        action: 'Places a concise 40-60 word Direct Answer Paragraph right under H1 for Google snippet capture.',
      },
      {
        item: 'Structured FAQPage Schema (JSON-LD)',
        status: 'ready' as const,
        action: 'Embeds structured schema so Google renders expandable question accordions directly in SERPs.',
      },
      {
        item: 'Bi-Directional Topical Silo Internal Linking',
        status: 'recommended' as const,
        action: 'Links all 3 spoke articles up to the pillar guide with descriptive anchor text.',
      },
    ];

    // 5. Generate pristine Executive Summary Markdown
    let md = `🚀 *New Site Fast-Rank Strategy: ${domain}*\n`;
    md += `🎯 *Niche:* ${siteProfile.primaryNiche}\n`;
    md += `📊 *Authority Status:* ${siteProfile.authorityTier === 'new' ? '🌱 Early-Stage / New Domain' : '⚡ Authority Expanding'}\n\n`;

    md += `### 💡 Why New Sites Rank Faster With Topical Silos:\n`;
    md += `Because this domain has low backlink equity, Google will ignore isolated single articles. Instead, we execute a **Topical Authority Silo (1 Pillar + 3 Spokes)** targeting low-difficulty terms where Google currently ranks Reddit or thin forum threads. Once the 4-article cluster is published and interconnected, Google grants topical authority in **14–28 days**!\n\n`;

    md += `### 🏗️ Primary Fast-Rank Silo: *"${fastRankSilo.silo_name}"*\n\n`;
    md += `⭐ *Core Pillar Guide:* \n`;
    md += `• *"${fastRankSilo.core_pillar.working_title}"*\n`;
    md += `  ↳ _Target Query:_ \`${fastRankSilo.core_pillar.keyword}\` · ~${fastRankSilo.core_pillar.estimated_volume.toLocaleString()}/mo · KD ${fastRankSilo.core_pillar.estimated_kd} (Easy)\n`;
    md += `  ↳ _Rankability:_ ${fastRankSilo.core_pillar.why_rankable_fast}\n\n`;

    md += `🔗 *Supporting Spoke Articles (Cluster):*\n`;
    fastRankSilo.spokes.forEach((s, idx) => {
      md += `${idx + 1}️⃣ *"${s.working_title}"*\n`;
      md += `   ↳ _Target Query:_ \`${s.keyword}\` · ~${s.estimated_volume.toLocaleString()}/mo · KD ${s.estimated_kd}\n`;
      md += `   ↳ _Opportunity:_ ${s.why_rankable_fast}\n`;
      md += `   ↳ _Internal Link Anchor:_ \`[${s.internal_link_anchor}]\` ➔ Links to Pillar\n\n`;
    });

    md += `### ⚡ Instant Ranking Acceleration Protocol:\n`;
    technicalChecklist.forEach(c => {
      md += `• ✅ *${c.item}*: ${c.action}\n`;
    });

    md += `\n💬 *Ready to launch? Reply with "Write ${fastRankSilo.core_pillar.keyword}" to draft the Pillar Guide immediately!*`;

    // 6. Save opportunities to database for persistence
    try {
      // 1. Create or link the Topical Silo cluster in keyword_clusters
      const { data: clusterRow } = await supabase
        .from('keyword_clusters')
        .insert({
          website_id: websiteId,
          cluster_name: fastRankSilo.silo_name,
          primary_keyword: fastRankSilo.core_pillar.keyword,
          secondary_keywords: fastRankSilo.spokes.map(s => s.keyword),
          search_intent: fastRankSilo.core_pillar.search_intent,
          recommended_content_type: 'guide',
          status: 'discovered',
        })
        .select('id')
        .single();

      const clusterId = clusterRow?.id || null;

      // 2. Save opportunities so they appear in Content Planner and Keywords
      for (const item of [fastRankSilo.core_pillar, ...fastRankSilo.spokes]) {
        await supabase.from('keyword_opportunities').upsert({
          website_id: websiteId,
          cluster_id: clusterId,
          keyword: item.keyword,
          is_primary: item.role === 'pillar',
          search_intent: item.search_intent,
          content_type: item.role === 'pillar' ? 'guide' : 'blog_article',
          search_volume: item.estimated_volume,
          keyword_difficulty: item.estimated_kd,
          business_relevance: 95,
          competition: item.estimated_kd <= 15 ? 'low' : 'medium',
          recommended_action: 'create_new_page',
          priority: item.role === 'pillar' ? 'high' : 'medium',
          confidence: 'high',
          evidence: item.why_rankable_fast,
          status: 'pending',
        }, { onConflict: 'website_id,keyword' });

        await supabase.from('keywords').upsert({
          website_id: websiteId,
          term: item.keyword,
          intent: item.search_intent,
          difficulty: String(item.estimated_kd),
          volume: item.estimated_volume,
        }, { onConflict: 'website_id,term' });
      }

      // Cache playbook in project_memory
      await supabase.from('project_memory').upsert({
        website_id: websiteId,
        source: 'fast_rank_playbook',
        category: 'growth_strategy',
        content: JSON.stringify({
          silo: fastRankSilo,
          quick_wins: immediateQuickWins,
          summary: md,
        }),
        is_outdated: false,
        confidence: 'high',
      });
    } catch (saveErr) {
      console.warn('[FastRankEngine] DB persistence notice:', saveErr);
    }

    return {
      website_id: websiteId,
      domain,
      site_niche: siteProfile.primaryNiche,
      authority_status: {
        tier: siteProfile.authorityTier,
        page_count: totalPages,
        backlink_count: siteProfile.authorityMetrics.backlinkCount,
        gsc_impressions: totalGscImpressions,
        is_sandbox_constrained: isSandboxConstrained,
        diagnosis: isSandboxConstrained
          ? 'Early-stage domain with low backlink equity. Standard head terms will stall; requires topical silo clustering and low-KD forum displacement to rank.'
          : 'Established domain with baseline topical authority ready for commercial keyword expansion.',
      },
      fast_rank_silo: fastRankSilo,
      immediate_quick_wins: immediateQuickWins,
      technical_acceleration_checklist: technicalChecklist,
      executive_summary_markdown: md,
    };
  }
}
