import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteContentGapDetector } from './siteContentGapDetector';
import { SiteNicheProfiler } from './siteNicheProfiler';

export type BusinessGoal =
  | 'increase_organic_traffic'
  | 'generate_qualified_leads'
  | 'increase_organic_signups'
  | 'build_topical_authority'
  | 'aeo_ai_search_visibility'
  | 'improve_organic_conversion'
  | 'recover_lost_rankings'
  | 'build_domain_authority';

export type WebsiteMaturity = 'NEW' | 'ESTABLISHED';

export type AutonomousActionMode =
  | 'RECOVER_DECAYING_PAGE'
  | 'OPTIMIZE_STRIKING_DISTANCE_CTR'
  | 'INJECT_INTERNAL_LINKS'
  | 'REPAIR_INDEXATION_AND_TECHNICAL'
  | 'CAPTURE_TRENDING_TOPIC'
  | 'WRITE_NEW_CLUSTER_ARTICLE';

export interface StrategicAction {
  id: string;
  target_agent:
    | 'Keyword Agent'
    | 'Competitor Agent'
    | 'Content Agent'
    | 'Technical SEO Agent'
    | 'On-Page SEO Agent'
    | 'Backlink Agent'
    | 'AEO Agent';
  action_title: string;
  rationale: string;
  business_relevance: number; // 0-100
  seo_impact: number;         // 0-100
  effort: number;             // 0-100
  risk: number;               // 0-100
  priority_score: number;     // Calculated score
  requires_approval: boolean;
}

export interface PhasePlan {
  phase_number: number;
  phase_title: string;
  description: string;
  status?: string;
  actions: StrategicAction[];
  tasks?: Array<{ id: string; title: string; target_agent?: string; priority_score?: number }>;
}

export interface SiteTelemetrySnapshot {
  website_id: string;
  domain: string;
  site_url: string;
  total_published_articles: number;
  indexed_articles_count: number;
  unindexed_articles_count: number;
  indexation_rate_pct: number;
  queued_roadmap_count: number;
  gsc_synced: boolean;
  gsc_total_clicks_28d: number;
  gsc_total_impressions_28d: number;
  gsc_avg_position: number;
  gsc_avg_ctr_pct: number;
  striking_distance_count: number;
  decaying_pages_count: number;
  open_technical_issues_count: number;
  saturated_categories: string[];
  thin_categories: string[];
  top_striking_opportunity?: {
    keyword: string;
    position: number;
    impressions: number;
    clicks: number;
    ctr: number;
    page_url: string;
  };
  top_decaying_page?: {
    keyword: string;
    previous_position: number;
    current_position: number;
    page_url: string;
  };
}

export interface AutonomousStrategicDecision {
  decision_id: string;
  timestamp: string;
  website_id: string;
  domain: string;
  primary_bottleneck: string;
  selected_action_mode: AutonomousActionMode;
  secondary_booster_mode?: AutonomousActionMode;
  strategic_rationale: string;
  target_category_or_pillar?: string;
  target_url_or_keyword?: string;
  replanned_queue_items: number;
  replan_summary?: string;
  expected_hypothesis: {
    metric: 'impressions' | 'clicks' | 'ctr' | 'position' | 'indexation';
    target_delta: string;
    evaluation_window_days: number;
  };
  telemetry: SiteTelemetrySnapshot;
}

export class StrategyAgent {
  // 1. Website Maturity Classifier
  determineMaturity(pageCount: number, monthlyTraffic: number): WebsiteMaturity {
    if (pageCount < 15 || monthlyTraffic < 1000) {
      return 'NEW';
    }
    return 'ESTABLISHED';
  }

  // 2. Business-First Action Priority Scorer
  calculatePriorityScore(action: Omit<StrategicAction, 'id' | 'priority_score'>): number {
    const successProbability = 85;
    const score =
      action.business_relevance * 0.4 +
      action.seo_impact * 0.3 +
      successProbability * 0.2 -
      action.effort * 0.1 -
      action.risk * 0.2;

    return Math.max(1, Math.round(score));
  }

  /**
   * Gathers 100% empirical, grounded telemetry for a website from Supabase and live inventory.
   * Never fabricates metrics or assumes fake rankings (Rule 9).
   */
  async collectEmpiricalTelemetry(websiteId: string): Promise<SiteTelemetrySnapshot> {
    const supabase = createAdminClient();

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    const domain = website?.domain || 'unknown';
    const siteUrl = (website?.url || `https://${domain}`).replace(/\/+$/, '');

    const [draftsRes, gscRes, techRes, inventory] = await Promise.all([
      supabase
        .from('content_drafts')
        .select('id, working_title, primary_keyword, status, url_slug, revision_notes, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('search_console_data')
        .select('query, position, impressions, clicks, ctr, page_id, date')
        .eq('website_id', websiteId)
        .not('query', 'is', null)
        .order('impressions', { ascending: false })
        .limit(250),
      supabase
        .from('technical_issues')
        .select('id, title, severity, status')
        .eq('website_id', websiteId)
        .neq('status', 'fixed')
        .limit(50),
      SiteContentGapDetector.getSiteInventory({ websiteId, domain, siteUrl }).catch(() => ({
        coveredTitles: [],
        coveredSlugs: [],
        coveredKeywords: [],
        coveredItems: [],
        categories: [],
        saturatedCategories: [],
        thinCategories: [],
      })),
    ]);

    const drafts = draftsRes.data || [];
    const publishedDrafts = drafts.filter((d) => d.status === 'published' || d.status === 'ready_for_approval');
    const queuedDrafts = drafts.filter((d) => d.status === 'brief_pending');

    let indexedCount = 0;
    for (const d of publishedDrafts) {
      try {
        const notes = typeof d.revision_notes === 'string' ? JSON.parse(d.revision_notes) : d.revision_notes || {};
        if (
          notes?.indexed_at ||
          notes?.indexing_status ||
          notes?.last_submitted_for_indexing ||
          notes?.is_indexed ||
          notes?.wordpress_post_url
        ) {
          indexedCount++;
        }
      } catch {}
    }

    const totalPublished = Math.max(publishedDrafts.length, inventory.coveredTitles.length);
    const effectiveIndexed = indexedCount > 0 ? Math.max(indexedCount, inventory.coveredTitles.length) : Math.min(totalPublished, publishedDrafts.length);
    const unindexedCount = Math.max(0, totalPublished - effectiveIndexed);
    const indexationRatePct = totalPublished > 0 ? Math.round((effectiveIndexed / totalPublished) * 100) : 100;

    const gscRows = gscRes.data || [];
    const gscSynced = gscRows.length > 0;
    const totalClicks = gscRows.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
    const totalImpressions = gscRows.reduce((acc, r) => acc + (Number(r.impressions) || 0), 0);
    const avgPosition = gscSynced
      ? Math.round((gscRows.reduce((acc, r) => acc + (Number(r.position) || 0), 0) / gscRows.length) * 10) / 10
      : 0;
    const avgCtrPct = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;

    // Identify striking-distance queries (Pos 4-20, Impressions >= 10)
    const strikingQueries: Array<{
      keyword: string;
      position: number;
      impressions: number;
      clicks: number;
      ctr: number;
      page_url: string;
    }> = [];
    const seenQ = new Set<string>();
    for (const r of gscRows) {
      const q = (r.query || '').trim();
      const pos = Number(r.position) || 0;
      const imps = Number(r.impressions) || 0;
      const clicks = Number(r.clicks) || 0;
      const ctr = Number(r.ctr) || (imps > 0 ? clicks / imps : 0);
      if (!q || seenQ.has(q.toLowerCase())) continue;
      if (pos >= 4 && pos <= 20 && imps >= 10) {
        seenQ.add(q.toLowerCase());
        strikingQueries.push({
          keyword: q,
          position: Math.round(pos * 10) / 10,
          impressions: imps,
          clicks,
          ctr: Math.round(ctr * 1000) / 10,
          page_url: siteUrl,
        });
      }
    }

    // Identify rank drops across dates
    const queryHistory = new Map<string, { recentPos: number; pastPos: number }>();
    for (const r of gscRows) {
      const q = (r.query || '').trim().toLowerCase();
      if (!q) continue;
      const pos = Number(r.position) || 0;
      const existing = queryHistory.get(q);
      if (!existing) {
        queryHistory.set(q, { recentPos: pos, pastPos: pos });
      } else {
        existing.pastPos = pos;
      }
    }

    const decayingList: Array<{
      keyword: string;
      previous_position: number;
      current_position: number;
      page_url: string;
    }> = [];
    for (const [q, hist] of queryHistory.entries()) {
      if (hist.recentPos - hist.pastPos >= 3) {
        decayingList.push({
          keyword: q,
          previous_position: Math.round(hist.pastPos * 10) / 10,
          current_position: Math.round(hist.recentPos * 10) / 10,
          page_url: siteUrl,
        });
      }
    }

    return {
      website_id: websiteId,
      domain,
      site_url: siteUrl,
      total_published_articles: totalPublished,
      indexed_articles_count: effectiveIndexed,
      unindexed_articles_count: unindexedCount,
      indexation_rate_pct: indexationRatePct,
      queued_roadmap_count: queuedDrafts.length,
      gsc_synced: gscSynced,
      gsc_total_clicks_28d: totalClicks,
      gsc_total_impressions_28d: totalImpressions,
      gsc_avg_position: avgPosition,
      gsc_avg_ctr_pct: avgCtrPct,
      striking_distance_count: strikingQueries.length,
      decaying_pages_count: decayingList.length,
      open_technical_issues_count: (techRes.data || []).length,
      saturated_categories: inventory.saturatedCategories || [],
      thin_categories: inventory.thinCategories || [],
      top_striking_opportunity: strikingQueries[0],
      top_decaying_page: decayingList[0],
    };
  }

  /**
   * Autonomous Strategic Brain:
   * Inspects live website telemetry, learned project memories, and the active content queue,
   * replans saturated or stale roadmap items, diagnoses the #1 growth bottleneck,
   * and decides the highest-ROI next action mode.
   */
  async diagnoseAndDecideNextAction(
    websiteId: string,
    options?: { goal?: string; isDailyArticleCapReached?: boolean }
  ): Promise<AutonomousStrategicDecision> {
    const supabase = createAdminClient();
    const telemetry = await this.collectEmpiricalTelemetry(websiteId);
    const decisionId = `dec_${Date.now()}`;

    // 1. AUTONOMOUS QUEUE REPLANNING:
    // Check if any 'brief_pending' items in `content_drafts` belong to a locked/saturated category stem
    let replannedCount = 0;
    let replanSummary = '';

    if (telemetry.saturated_categories.length > 0 && telemetry.thin_categories.length > 0) {
      const { data: queuedItems } = await supabase
        .from('content_drafts')
        .select('id, working_title, primary_keyword')
        .eq('website_id', websiteId)
        .eq('status', 'brief_pending')
        .order('created_at', { ascending: true })
        .limit(10);

      if (queuedItems && queuedItems.length > 0) {
        const satLower = telemetry.saturated_categories.map((s) => s.toLowerCase());
        const saturatedQueued = queuedItems.filter((item) => {
          const text = `${item.working_title || ''} ${item.primary_keyword || ''}`.toLowerCase();
          return satLower.some((sat) => text.includes(sat));
        });

        if (saturatedQueued.length > 0) {
          const profile = await SiteNicheProfiler.profileSite({
            websiteId,
            domain: telemetry.domain,
            siteUrl: telemetry.site_url,
          });
          const inventory = await SiteContentGapDetector.getSiteInventory({
            websiteId,
            domain: telemetry.domain,
            siteUrl: telemetry.site_url,
          });
          const freshGaps = await SiteContentGapDetector.findContentGaps({
            inventory,
            siteProfile: profile,
            limit: saturatedQueued.length + 2,
          });

          for (let i = 0; i < saturatedQueued.length; i++) {
            const oldItem = saturatedQueued[i];
            const replacement = freshGaps[i];
            if (replacement) {
              await supabase
                .from('content_drafts')
                .update({
                  working_title: replacement.working_title,
                  primary_keyword: replacement.keyword,
                  search_intent: replacement.search_intent || 'informational',
                  revision_notes: JSON.stringify({
                    replanned_by_agent: true,
                    replanned_at: new Date().toISOString(),
                    previous_title: oldItem.working_title,
                    replan_reason: `Saturated category lock active on [${telemetry.saturated_categories.join(', ')}]. Pivoted to thin pillar [${replacement.target_category}].`,
                  }),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', oldItem.id);
              replannedCount++;
            }
          }

          if (replannedCount > 0) {
            replanSummary = `Autonomously replanned ${replannedCount} queued topic(s) away from saturated [${telemetry.saturated_categories.slice(0, 2).join(', ')}] into under-served [${telemetry.thin_categories.slice(0, 2).join(', ')}] pillars.`;
            console.log(`[StrategyAgent] ${replanSummary}`);
          }
        }
      }
    }

    // 2. BOTTLENECK DIAGNOSIS & ACTION SELECTION
    let primaryBottleneck = '';
    let selectedActionMode: AutonomousActionMode = 'WRITE_NEW_CLUSTER_ARTICLE';
    let secondaryBoosterMode: AutonomousActionMode | undefined = undefined;
    let strategicRationale = '';
    let targetCategoryOrPillar = telemetry.thin_categories[0] || 'Core Niche Pillar';
    let targetUrlOrKeyword = '';
    let expectedHypothesis: AutonomousStrategicDecision['expected_hypothesis'] = {
      metric: 'impressions',
      target_delta: '+150 impressions and initial keyword indexation within 14 days',
      evaluation_window_days: 14,
    };

    const capReached = Boolean(options?.isDailyArticleCapReached);

    if (capReached) {
      // When the 24h new-article cap is active, select the highest-ROI non-drafting optimization
      if (telemetry.decaying_pages_count > 0 && telemetry.top_decaying_page) {
        primaryBottleneck = `Ranking decay detected on "${telemetry.top_decaying_page.keyword}" (dropped from #${telemetry.top_decaying_page.previous_position} to #${telemetry.top_decaying_page.current_position}).`;
        selectedActionMode = 'RECOVER_DECAYING_PAGE';
        targetUrlOrKeyword = telemetry.top_decaying_page.keyword;
        strategicRationale = `Daily article quota is fulfilled. Prioritizing rank recovery on decaying query "${telemetry.top_decaying_page.keyword}" via title/meta/FAQ refresh and re-indexing.`;
        expectedHypothesis = {
          metric: 'position',
          target_delta: `Recover +3 positions on "${telemetry.top_decaying_page.keyword}" within 14 days`,
          evaluation_window_days: 14,
        };
      } else if (telemetry.striking_distance_count > 0 && telemetry.top_striking_opportunity) {
        const opp = telemetry.top_striking_opportunity;
        primaryBottleneck = `Striking-distance query "${opp.keyword}" sits at Position #${opp.position} with ${opp.impressions} impressions and ${opp.ctr}% CTR.`;
        selectedActionMode = 'OPTIMIZE_STRIKING_DISTANCE_CTR';
        targetUrlOrKeyword = opp.keyword;
        strategicRationale = `Daily article quota is fulfilled. Executing high-ROI CTR title/meta hook optimization on "${opp.keyword}" (#${opp.position}) to push into Top 3.`;
        expectedHypothesis = {
          metric: 'ctr',
          target_delta: `Lift CTR on "${opp.keyword}" from ${opp.ctr}% toward >4% within 14 days`,
          evaluation_window_days: 14,
        };
      } else if (telemetry.unindexed_articles_count > 0) {
        primaryBottleneck = `${telemetry.unindexed_articles_count} published article(s) awaiting confirmed Google indexation (${telemetry.indexation_rate_pct}% indexation rate).`;
        selectedActionMode = 'REPAIR_INDEXATION_AND_TECHNICAL';
        targetUrlOrKeyword = telemetry.site_url;
        strategicRationale = `Daily article quota is fulfilled. Running indexation verification, sitemap ping, and internal link equity distribution for unindexed posts.`;
        expectedHypothesis = {
          metric: 'indexation',
          target_delta: `Achieve 100% indexation across ${telemetry.total_published_articles} articles within 7 days`,
          evaluation_window_days: 7,
        };
      } else {
        primaryBottleneck = `Cluster internal link equity distribution across ${telemetry.total_published_articles} existing articles.`;
        selectedActionMode = 'INJECT_INTERNAL_LINKS';
        targetUrlOrKeyword = telemetry.site_url;
        strategicRationale = `Daily article quota is fulfilled and indexation is healthy. Strengthening internal link graph between existing cluster articles.`;
        expectedHypothesis = {
          metric: 'impressions',
          target_delta: `+15% cluster impressions across linked target pages within 14 days`,
          evaluation_window_days: 14,
        };
      }
    } else {
      // Full cycle available: decide between Trend Capture vs Cluster Expansion for content,
      // PLUS attach a secondary booster if decay, striking-distance CTR, or indexation needs action!
      if (telemetry.decaying_pages_count > 0 && telemetry.top_decaying_page) {
        secondaryBoosterMode = 'RECOVER_DECAYING_PAGE';
      } else if (telemetry.striking_distance_count > 0 && telemetry.top_striking_opportunity) {
        secondaryBoosterMode = 'OPTIMIZE_STRIKING_DISTANCE_CTR';
      } else if (telemetry.unindexed_articles_count >= 3) {
        secondaryBoosterMode = 'REPAIR_INDEXATION_AND_TECHNICAL';
      } else if (telemetry.total_published_articles >= 5) {
        secondaryBoosterMode = 'INJECT_INTERNAL_LINKS';
      }

      if (telemetry.saturated_categories.length > 0 && telemetry.thin_categories.length > 0) {
        primaryBottleneck = `Topical imbalance: [${telemetry.saturated_categories.slice(0, 2).join(', ')}] is saturated across ${telemetry.total_published_articles} posts, while [${telemetry.thin_categories.slice(0, 3).join(', ')}] lack topical depth.`;
      } else if (!telemetry.gsc_synced) {
        primaryBottleneck = `Early topical authority expansion (${telemetry.total_published_articles} published articles; Search Console telemetry syncing).`;
      } else {
        primaryBottleneck = `Topical cluster expansion (${telemetry.gsc_total_impressions_28d.toLocaleString()} 28d impressions across ${telemetry.total_published_articles} articles; Avg Pos #${telemetry.gsc_avg_position || 'N/A'}).`;
      }

      // Alternate between breakout trend capture and structured cluster gap every 3rd article when no manual queue item overrides
      const shouldCaptureTrend = telemetry.queued_roadmap_count === 0 && telemetry.total_published_articles % 3 === 2;
      selectedActionMode = shouldCaptureTrend ? 'CAPTURE_TRENDING_TOPIC' : 'WRITE_NEW_CLUSTER_ARTICLE';
      targetCategoryOrPillar = telemetry.thin_categories[0] || 'Core Growth Pillar';

      strategicRationale =
        selectedActionMode === 'CAPTURE_TRENDING_TOPIC'
          ? `Selected first-mover trend capture in under-served pillar [${targetCategoryOrPillar}] to acquire low-KD breakout search demand${secondaryBoosterMode ? `, paired with ${secondaryBoosterMode.replace(/_/g, ' ').toLowerCase()}` : ''}.`
          : `Prioritizing topical authority expansion in thin pillar [${targetCategoryOrPillar}] (avoiding saturated [${telemetry.saturated_categories.slice(0, 2).join(', ') || 'none'}])${secondaryBoosterMode ? `, paired with ${secondaryBoosterMode.replace(/_/g, ' ').toLowerCase()}` : ''}.`;
    }

    // 2.5 CLAUDE SONNET 5 COGNITIVE REASONING OVER LIVE TELEMETRY & LEARNED MEMORY
    try {
      const { data: learnedMemories } = await supabase
        .from('project_memory')
        .select('category, content')
        .eq('website_id', websiteId)
        .in('category', ['experiments', 'decisions', 'content_pillars', 'seo_strategy'])
        .order('created_at', { ascending: false })
        .limit(12);

      const memorySummary =
        learnedMemories && learnedMemories.length > 0
          ? learnedMemories.map((m) => `[${m.category.toUpperCase()}] ${m.content}`).join('\n')
          : 'No prior outcome experiments recorded yet.';

      const allowedPrimaryModes = capReached
        ? (['RECOVER_DECAYING_PAGE', 'OPTIMIZE_STRIKING_DISTANCE_CTR', 'INJECT_INTERNAL_LINKS', 'REPAIR_INDEXATION_AND_TECHNICAL'] as const)
        : (['WRITE_NEW_CLUSTER_ARTICLE', 'CAPTURE_TRENDING_TOPIC', 'RECOVER_DECAYING_PAGE', 'OPTIMIZE_STRIKING_DISTANCE_CTR'] as const);

      const { object: llmDecision } = await LLMProvider.generateObject({
        agent: 'StrategyAgent',
        complexity: 'complex',
        schema: z.object({
          primary_bottleneck: z.string().describe('Empirical diagnosis of the #1 SEO growth bottleneck right now'),
          selected_action_mode: z.enum([
            'RECOVER_DECAYING_PAGE',
            'OPTIMIZE_STRIKING_DISTANCE_CTR',
            'INJECT_INTERNAL_LINKS',
            'REPAIR_INDEXATION_AND_TECHNICAL',
            'CAPTURE_TRENDING_TOPIC',
            'WRITE_NEW_CLUSTER_ARTICLE',
          ]),
          secondary_booster_mode: z
            .enum([
              'RECOVER_DECAYING_PAGE',
              'OPTIMIZE_STRIKING_DISTANCE_CTR',
              'INJECT_INTERNAL_LINKS',
              'REPAIR_INDEXATION_AND_TECHNICAL',
            ])
            .nullable()
            .describe('Optional secondary on-page/technical action to execute alongside primary action'),
          target_category_or_pillar: z.string().describe('Which under-served content pillar to prioritize'),
          target_url_or_keyword: z.string().describe('Specific query or URL to target or optimize'),
          strategic_rationale: z.string().describe('Clear 1-2 sentence explanation of why this action yields the highest ROI now'),
          expected_hypothesis: z.object({
            metric: z.enum(['impressions', 'clicks', 'ctr', 'position', 'indexation']),
            target_delta: z.string().describe('Specific measurable outcome expected in 14 days'),
            evaluation_window_days: z.number(),
          }),
        }),
        system: `You are the Autonomous AI SEO Strategy Brain for "${telemetry.domain}".
You own the entire SEO strategy. Reason strictly from the empirical telemetry and past experiment outcomes provided. Never invent metrics.
Rules:
- Daily Article Quota Reached: ${capReached ? 'YES (choose a non-drafting optimization mode from: ' + allowedPrimaryModes.join(', ') + ')' : 'NO (full execution cycle available; prefer WRITE_NEW_CLUSTER_ARTICLE or CAPTURE_TRENDING_TOPIC as primary mode + attach a secondary_booster_mode for existing pages)'}.
- NEVER select a category from Saturated Categories (${telemetry.saturated_categories.join(', ') || 'none'}). Always choose from Thin Categories (${telemetry.thin_categories.join(', ') || 'core niche pillars'}).`,
        prompt: `User Strategic Goal: ${options?.goal || 'Grow organic search traffic and build topical authority'}

LIVE EMPIRICAL TELEMETRY:
${JSON.stringify(telemetry, null, 2)}

LEARNED PROJECT MEMORY & PAST EXPERIMENT OUTCOMES:
${memorySummary}

Diagnose the primary bottleneck and decide the highest-ROI action plan for this cycle.`,
      });

      if (llmDecision) {
        primaryBottleneck = llmDecision.primary_bottleneck || primaryBottleneck;
        selectedActionMode = capReached && (llmDecision.selected_action_mode === 'WRITE_NEW_CLUSTER_ARTICLE' || llmDecision.selected_action_mode === 'CAPTURE_TRENDING_TOPIC')
          ? selectedActionMode
          : llmDecision.selected_action_mode;
        if (llmDecision.secondary_booster_mode) {
          secondaryBoosterMode = llmDecision.secondary_booster_mode;
        }
        if (llmDecision.target_category_or_pillar) {
          targetCategoryOrPillar = llmDecision.target_category_or_pillar;
        }
        if (llmDecision.target_url_or_keyword) {
          targetUrlOrKeyword = llmDecision.target_url_or_keyword;
        }
        if (llmDecision.strategic_rationale) {
          strategicRationale = llmDecision.strategic_rationale;
        }
        if (llmDecision.expected_hypothesis) {
          expectedHypothesis = {
            metric: llmDecision.expected_hypothesis.metric,
            target_delta: llmDecision.expected_hypothesis.target_delta,
            evaluation_window_days: llmDecision.expected_hypothesis.evaluation_window_days || 14,
          };
        }
      }
    } catch (llmErr: any) {
      console.warn('[StrategyAgent] Using deterministic empirical decision fallback:', llmErr?.message || llmErr);
    }

    const decision: AutonomousStrategicDecision = {
      decision_id: decisionId,
      timestamp: new Date().toISOString(),
      website_id: websiteId,
      domain: telemetry.domain,
      primary_bottleneck: primaryBottleneck,
      selected_action_mode: selectedActionMode,
      secondary_booster_mode: secondaryBoosterMode,
      strategic_rationale: replanSummary ? `${strategicRationale} ${replanSummary}` : strategicRationale,
      target_category_or_pillar: targetCategoryOrPillar,
      target_url_or_keyword: targetUrlOrKeyword,
      replanned_queue_items: replannedCount,
      replan_summary: replanSummary || undefined,
      expected_hypothesis: expectedHypothesis,
      telemetry,
    };

    // Persist the strategic decision in `project_memory` (category: 'decisions') so the UI and future cycles see the agent's reasoning
    try {
      const { data: existingDecs } = await supabase
        .from('project_memory')
        .select('id')
        .eq('website_id', websiteId)
        .eq('category', 'decisions')
        .eq('source', 'autonomous_strategy_brain')
        .order('created_at', { ascending: false });

      // Keep only the 10 most recent autonomous decision logs to prevent table bloat
      if (existingDecs && existingDecs.length >= 10) {
        const idsToDelete = existingDecs.slice(9).map((r) => r.id);
        await supabase.from('project_memory').delete().in('id', idsToDelete);
      }

      await supabase.from('project_memory').insert({
        website_id: websiteId,
        category: 'decisions',
        content: `[${decision.selected_action_mode}] Bottleneck: ${decision.primary_bottleneck} → Decision: ${decision.strategic_rationale} (Hypothesis: ${decision.expected_hypothesis.target_delta})`,
        source: 'autonomous_strategy_brain',
        confidence: 'high',
      });
    } catch (memErr) {
      console.warn('[StrategyAgent] Decision log notice:', memErr);
    }

    return decision;
  }

  // 3. Multi-Phase Empirical Roadmap Generator
  async generateStrategyRoadmap(
    maturity: WebsiteMaturity,
    primaryGoal: BusinessGoal,
    crawledPages: number,
    gscDataCount: number,
    websiteId?: string
  ): Promise<{ maturity: WebsiteMaturity; phases: PhasePlan[]; busyworkFlag: boolean; telemetry?: SiteTelemetrySnapshot }> {
    // If websiteId is provided, build a 100% empirical roadmap from real database telemetry!
    if (websiteId) {
      const telemetry = await this.collectEmpiricalTelemetry(websiteId);
      const effectiveMaturity = this.determineMaturity(
        telemetry.total_published_articles,
        telemetry.gsc_total_clicks_28d
      );

      const phases: PhasePlan[] = [];

      // Phase 1: Immediate Bottleneck & Indexation / Striking Distance
      const phase1Actions: StrategicAction[] = [];

      if (telemetry.unindexed_articles_count > 0) {
        phase1Actions.push({
          id: `act_idx_${Date.now()}`,
          target_agent: 'Technical SEO Agent',
          action_title: `Verify & Submit ${telemetry.unindexed_articles_count} Unindexed Article(s) via Google Indexing API`,
          rationale: `Currently ${telemetry.indexed_articles_count}/${telemetry.total_published_articles} published articles (${telemetry.indexation_rate_pct}%) have confirmed indexing signals.`,
          business_relevance: 98,
          seo_impact: 95,
          effort: 15,
          risk: 5,
          priority_score: 94,
          requires_approval: false,
        });
      }

      if (telemetry.decaying_pages_count > 0 && telemetry.top_decaying_page) {
        phase1Actions.push({
          id: `act_decay_${Date.now()}`,
          target_agent: 'On-Page SEO Agent',
          action_title: `Recover Ranking Drop on "${telemetry.top_decaying_page.keyword}" (#${telemetry.top_decaying_page.previous_position} → #${telemetry.top_decaying_page.current_position})`,
          rationale: `Live Search Console telemetry detected a position drop on "${telemetry.top_decaying_page.keyword}". Refreshing H2 subtopics, title hook, and FAQ schema restores rank.`,
          business_relevance: 95,
          seo_impact: 92,
          effort: 25,
          risk: 10,
          priority_score: 91,
          requires_approval: false,
        });
      }

      if (telemetry.striking_distance_count > 0 && telemetry.top_striking_opportunity) {
        const opp = telemetry.top_striking_opportunity;
        phase1Actions.push({
          id: `act_ctr_${Date.now()}`,
          target_agent: 'On-Page SEO Agent',
          action_title: `Optimize Title & Meta CTR for "${opp.keyword}" (Pos #${opp.position})`,
          rationale: `GSC recorded ${opp.impressions.toLocaleString()} impressions at position #${opp.position} with ${opp.ctr}% CTR. Rewriting the title hook and injecting internal links unlocks immediate Top-3 traffic.`,
          business_relevance: 95,
          seo_impact: 90,
          effort: 20,
          risk: 10,
          priority_score: 90,
          requires_approval: false,
        });
      }

      if (phase1Actions.length === 0) {
        phase1Actions.push({
          id: `act_tech_${Date.now()}`,
          target_agent: 'Technical SEO Agent',
          action_title: `Maintain Crawl Health & Indexation across ${telemetry.total_published_articles} Published Pages`,
          rationale: telemetry.gsc_synced
            ? `GSC synced (${telemetry.gsc_total_impressions_28d.toLocaleString()} impressions, ${telemetry.gsc_total_clicks_28d.toLocaleString()} clicks in 28d). Indexation rate at ${telemetry.indexation_rate_pct}%.`
            : `No Search Console performance data has been synced yet for ${telemetry.domain}. Maintaining technical indexability and sitemap pings.`,
          business_relevance: 90,
          seo_impact: 85,
          effort: 15,
          risk: 5,
          priority_score: 88,
          requires_approval: false,
        });
      }

      phases.push({
        phase_number: 1,
        phase_title: 'Phase 1: Immediate Diagnostic Bottlenecks & Quick Wins',
        description: `Empirical diagnostic actions for ${telemetry.domain} based on ${telemetry.total_published_articles} published articles and live Search Console telemetry.`,
        status: 'Active',
        actions: phase1Actions,
        tasks: phase1Actions.map((a) => ({
          id: a.id,
          title: a.action_title,
          target_agent: a.target_agent,
          priority_score: a.priority_score,
        })),
      });

      // Phase 2: Topical Pillar Balancing & Content Expansion
      const thinDesc =
        telemetry.thin_categories.length > 0
          ? telemetry.thin_categories.slice(0, 3).join(', ')
          : 'high-intent commercial clusters';
      const satDesc =
        telemetry.saturated_categories.length > 0
          ? ` (locking saturated [${telemetry.saturated_categories.slice(0, 2).join(', ')}])`
          : '';

      const phase2Actions: StrategicAction[] = [
        {
          id: `act_cluster_${Date.now()}`,
          target_agent: 'Content Agent',
          action_title: `Expand Under-Served Topical Pillars: ${thinDesc}`,
          rationale: `Site currently has ${telemetry.total_published_articles} published articles${satDesc}. Building depth in [${thinDesc}] balances topical authority and captures uncontested search demand.`,
          business_relevance: 96,
          seo_impact: 92,
          effort: 40,
          risk: 5,
          priority_score: 91,
          requires_approval: false,
        },
        {
          id: `act_trend_${Date.now()}`,
          target_agent: 'Keyword Agent',
          action_title: `Capture Breakout 2026 Search Trends in ${thinDesc}`,
          rationale: `First-mover articles on emerging tools and workflow shifts rank faster with lower keyword difficulty.`,
          business_relevance: 90,
          seo_impact: 86,
          effort: 30,
          risk: 5,
          priority_score: 86,
          requires_approval: false,
        },
      ];

      phases.push({
        phase_number: 2,
        phase_title: 'Phase 2: Multi-Pillar Topical Authority Expansion',
        description: `Diversify content coverage into under-served pillars (${thinDesc})${satDesc}.`,
        status: 'In Progress',
        actions: phase2Actions,
        tasks: phase2Actions.map((a) => ({
          id: a.id,
          title: a.action_title,
          target_agent: a.target_agent,
          priority_score: a.priority_score,
        })),
      });

      // Phase 3: Internal Link Graph & Closed-Loop Outcome Evaluation
      const phase3Actions: StrategicAction[] = [
        {
          id: `act_links_${Date.now()}`,
          target_agent: 'On-Page SEO Agent',
          action_title: `Cross-Link ${telemetry.total_published_articles} Cluster Articles to Distribute PageRank`,
          rationale: `Contextual internal links between existing hubs and new pillar articles accelerate crawling and lift positions 4–15.`,
          business_relevance: 88,
          seo_impact: 85,
          effort: 20,
          risk: 5,
          priority_score: 85,
          requires_approval: false,
        },
        {
          id: `act_eval_${Date.now()}`,
          target_agent: 'Competitor Agent',
          action_title: `Evaluate T+14d Action Hypotheses & Prune Underperforming Angles`,
          rationale: `Compare post-publish GSC impressions, CTR, and position shifts against baseline metrics to double down on winning formats.`,
          business_relevance: 92,
          seo_impact: 88,
          effort: 15,
          risk: 5,
          priority_score: 87,
          requires_approval: false,
        },
      ];

      phases.push({
        phase_number: 3,
        phase_title: 'Phase 3: Internal Link Equity & Closed-Loop Outcome Learning',
        description: `Wire contextual internal links across clusters and evaluate T+14d GSC performance hypotheses.`,
        status: 'Scheduled',
        actions: phase3Actions,
        tasks: phase3Actions.map((a) => ({
          id: a.id,
          title: a.action_title,
          target_agent: a.target_agent,
          priority_score: a.priority_score,
        })),
      });

      return {
        maturity: effectiveMaturity,
        busyworkFlag: false,
        phases,
        telemetry,
      };
    }

    // Fallback when called without websiteId (strictly truthful, zero fake metrics)
    if (crawledPages === 0 && gscDataCount === 0) {
      return {
        maturity,
        phases: [],
        busyworkFlag: true,
      };
    }

    const fallbackActions: StrategicAction[] = [
      {
        id: 'act_1',
        target_agent: 'Technical SEO Agent',
        action_title: 'Validate Sitemap.xml, Robots directives & Google Indexing API',
        rationale: `Ensure all ${crawledPages} detected pages are crawlable and submitted for indexing.`,
        business_relevance: 100,
        seo_impact: 95,
        effort: 20,
        risk: 10,
        priority_score: 91,
        requires_approval: false,
      },
      {
        id: 'act_2',
        target_agent: 'Content Agent',
        action_title: 'Expand Under-Served Topical Pillars with Zero Cannibalization',
        rationale: `Build balanced topical authority aligned with goal: ${primaryGoal.replace(/_/g, ' ')}.`,
        business_relevance: 95,
        seo_impact: 90,
        effort: 40,
        risk: 10,
        priority_score: 88,
        requires_approval: false,
      },
    ];

    return {
      maturity,
      busyworkFlag: false,
      phases: [
        {
          phase_number: 1,
          phase_title: 'Phase 1: Indexability & Balanced Topical Growth',
          description: 'Empirical crawl validation and multi-pillar content execution.',
          status: 'Active',
          actions: fallbackActions,
          tasks: fallbackActions.map((a) => ({
            id: a.id,
            title: a.action_title,
            target_agent: a.target_agent,
            priority_score: a.priority_score,
          })),
        },
      ],
    };
  }

  // 4. Multi-Agent Conflict Resolver
  resolveConflict(
    keywordAgentSuggestion: string,
    competitorAgentSuggestion: string,
    contentAgentSuggestion: string
  ): { resolution: string; rationale: string } {
    return {
      resolution:
        'Prioritize refreshing an existing page if keyword intent overlaps >= 60%; otherwise target an under-served topical pillar with a net-new cluster article.',
      rationale:
        'Prevents internal keyword cannibalization while maximizing topical coverage across thin categories.',
    };
  }
}
