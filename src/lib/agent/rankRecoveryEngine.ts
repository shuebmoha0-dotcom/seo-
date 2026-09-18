import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { DiagnosticAgent, DiagnosticFinding } from './diagnosticAgent';
import { DuplicateArticleChecker } from './duplicateChecker';
import { TelegramService } from '@/lib/telegram/telegramService';

export interface StrikingDistanceOpportunity {
  keyword: string;
  current_position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  page_url: string;
  page_id?: string;
  potential_target_position: number;
  estimated_click_multiplier: string;
  estimated_monthly_clicks_gain: number;
  root_opportunity: 'low_ctr_title' | 'missing_subtopic' | 'internal_link_deficit' | 'rich_snippet_schema';
  headline: string;
  prescriptive_actions: {
    title_hook_suggestion?: string;
    meta_description_suggestion?: string;
    recommended_h2_subtopics?: string[];
    internal_link_targets?: string[];
    schema_type?: 'FAQPage' | 'HowTo' | 'Article';
  };
}

export interface DetectedRankDrop {
  keyword: string;
  page_url: string;
  page_id?: string;
  previous_position: number;
  current_position: number;
  position_drop: number;
  traffic_loss_pct: number;
  severity: 'critical' | 'high' | 'medium';
  primary_root_cause: 'content_decay' | 'cannibalization' | 'technical_block' | 'link_starvation' | 'intent_shift';
  root_cause_explanation: string;
  evidence: string;
  recovery_plan: Array<{
    step: number;
    action_type: 'content_refresh' | 'canonical_fix' | 'internal_link' | 'reindex' | 'technical_fix';
    description: string;
    impact: string;
  }>;
}

export interface SiteGrowthAndRecoveryReport {
  domain: string;
  website_id: string;
  overall_health: 'healthy' | 'at_risk' | 'critical_drop' | 'recovering';
  avg_position: number;
  striking_distance_count: number;
  detected_drops_count: number;
  total_potential_clicks_gain: number;
  striking_distance_opportunities: StrikingDistanceOpportunity[];
  detected_rank_drops: DetectedRankDrop[];
  created_at: string;
}

export class RankRecoveryEngine {
  /**
   * Scans a website's Search Console data, tracked keywords, and crawled pages to:
   * 1. Mine striking-distance opportunities (positions 4–20) for rapid ranking jumps.
   * 2. Detect ranking drops & formulate forensic 1-click recovery actions.
   */
  static async scanAndAnalyze(params: {
    websiteId: string;
    domain: string;
    siteUrl?: string;
  }): Promise<SiteGrowthAndRecoveryReport> {
    const { websiteId, domain } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    console.log(`[RankRecoveryEngine] Starting Growth & Recovery scan for ${domain}...`);

    // 1. Gather live site data in parallel with column pruning to conserve Render RAM
    const [scRes, kwRes, pagesRes, draftsRes] = await Promise.all([
      supabase
        .from('search_console_data')
        .select('query, position, impressions, clicks, ctr, date, page_id')
        .eq('website_id', websiteId)
        .order('date', { ascending: false })
        .limit(100),
      supabase
        .from('keywords')
        .select('term, volume, difficulty, intent')
        .eq('website_id', websiteId)
        .limit(50),
      supabase
        .from('pages')
        .select('id, path, title, meta_description, status_code, canonical_url, indexability_signals')
        .eq('website_id', websiteId)
        .limit(30),
      supabase
        .from('content_drafts')
        .select('id, working_title, primary_keyword, url_slug, status, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const scData = scRes.data || [];
    const keywordsData = kwRes.data || [];
    const pagesData = pagesRes.data || [];
    const draftsData = draftsRes.data || [];

    // Helper map of pages by id or path
    const pageMap = new Map<string, any>();
    for (const p of pagesData) {
      pageMap.set(p.id, p);
      pageMap.set(p.path, p);
    }

    // 2. Identify Striking-Distance Keywords (Positions 4.0 - 20.0)
    // Also include tracked keywords with high volume if SC data is sparse
    const strikingList: StrikingDistanceOpportunity[] = [];
    const processedQueries = new Set<string>();

    for (const row of scData) {
      const q = (row.query || '').trim();
      const pos = Number(row.position) || 0;
      const imps = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;
      const ctr = Number(row.ctr) || (imps > 0 ? clicks / imps : 0);

      if (!q || processedQueries.has(q.toLowerCase())) continue;

      // Position between 4.0 and 20.0
      if (pos >= 4.0 && pos <= 20.0 && imps >= 10) {
        processedQueries.add(q.toLowerCase());

        // Calculate expected click multiplier if pushed to Top 3 (approx 12% CTR baseline)
        const currentCtr = ctr > 0 ? ctr : 0.015;
        const targetCtr = 0.12;
        const multiplierNum = Math.max(1.5, Math.round((targetCtr / Math.max(currentCtr, 0.005)) * 10) / 10);
        const estimatedClicksGain = Math.round(imps * (targetCtr - currentCtr));

        const matchedPage = row.page_id ? pageMap.get(row.page_id) : null;
        const pageUrl = matchedPage?.path || `${siteUrl}/`;

        strikingList.push({
          keyword: q,
          current_position: Math.round(pos * 10) / 10,
          impressions: imps,
          clicks,
          ctr: Math.round(ctr * 1000) / 10,
          page_url: pageUrl,
          page_id: matchedPage?.id,
          potential_target_position: Math.min(3, Math.max(1, Math.round(pos - 4))),
          estimated_click_multiplier: `+${Math.round((multiplierNum - 1) * 100)}% clicks`,
          estimated_monthly_clicks_gain: Math.max(15, estimatedClicksGain),
          root_opportunity: ctr < 0.03 ? 'low_ctr_title' : 'missing_subtopic',
          headline: `Push "${q}" from #${Math.round(pos)} to Top 3`,
          prescriptive_actions: {
            title_hook_suggestion: `[Updated 2026] ${q.charAt(0).toUpperCase() + q.slice(1)}: Proven Practical Guide`,
            meta_description_suggestion: `Looking for ${q}? Discover actionable strategies, verified data, and step-by-step tactics to get results fast.`,
            recommended_h2_subtopics: [
              `Core Principles of ${q}`,
              `Step-by-Step Implementation Framework`,
              `Common Pitfalls to Avoid in 2026`,
            ],
            schema_type: 'FAQPage',
          },
        });
      }
    }

    // 3. Detect Ranking Drops (Pos >= 3 drop or significant traffic decline)
    const queryDateMap = new Map<string, { recentPos: number; pastPos: number; recentClicks: number; pastClicks: number }>();
    for (const r of scData) {
      const q = (r.query || '').trim().toLowerCase();
      if (!q) continue;
      const existing = queryDateMap.get(q);
      const pos = Number(r.position) || 0;
      const clicks = Number(r.clicks) || 0;
      if (!existing) {
        queryDateMap.set(q, { recentPos: pos, pastPos: pos, recentClicks: clicks, pastClicks: clicks });
      } else {
        existing.pastPos = pos;
        existing.pastClicks = clicks;
      }
    }

    const detectedDrops: DetectedRankDrop[] = [];

    for (const [q, data] of queryDateMap.entries()) {
      const posDiff = data.recentPos - data.pastPos;
      const clickDiffPct = data.pastClicks > 0 ? ((data.pastClicks - data.recentClicks) / data.pastClicks) * 100 : 0;

      if (posDiff >= 3 || (clickDiffPct >= 25 && data.pastClicks >= 10)) {
        let rootCause: DetectedRankDrop['primary_root_cause'] = 'content_decay';
        let explanation = `Position slipped from #${Math.round(data.pastPos)} to #${Math.round(data.recentPos)}. Competitors recently refreshed their content with fresher entities.`;
        let evidence = `Search Console recorded position drop of ${Math.round(posDiff * 10) / 10} points on query "${q}".`;

        const matchingDrafts = draftsData.filter(d => 
          (d.working_title || '').toLowerCase().includes(q) || 
          (d.primary_keyword || '').toLowerCase() === q
        );
        if (matchingDrafts.length > 1) {
          rootCause = 'cannibalization';
          explanation = `Internal keyword cannibalization detected between "${matchingDrafts[0].working_title}" and "${matchingDrafts[1].working_title}". Google is splitting search intent between multiple URLs.`;
          evidence = `Found ${matchingDrafts.length} separate published articles competing for the same query "${q}".`;
        }

        detectedDrops.push({
          keyword: q,
          page_url: `${siteUrl}/`,
          previous_position: Math.round(data.pastPos * 10) / 10,
          current_position: Math.round(data.recentPos * 10) / 10,
          position_drop: Math.round(posDiff * 10) / 10,
          traffic_loss_pct: Math.round(clickDiffPct),
          severity: posDiff >= 6 || clickDiffPct >= 50 ? 'critical' : 'high',
          primary_root_cause: rootCause,
          root_cause_explanation: explanation,
          evidence,
          recovery_plan: [
            {
              step: 1,
              action_type: 'content_refresh',
              description: `Inject updated 2026 statistics, fresh expert commentary, and 2 new subtopics addressing "${q}".`,
              impact: 'High (+4 to +8 positions)',
            },
            {
              step: 2,
              action_type: 'internal_link',
              description: `Inject 3 internal contextual links with anchor text "${q}" from high-authority index pages.`,
              impact: 'Medium (+2 to +3 positions)',
            },
            {
              step: 3,
              action_type: 'reindex',
              description: `Submit updated URL to Google Indexing API & IndexNow for priority re-crawl within 24 hours.`,
              impact: 'High (Immediate recrawl)',
            },
          ],
        });
      }
    }

    // 4. Calculate Overall Health & Summary Stats
    const totalPotentialClicks = strikingList.reduce((acc, curr) => acc + curr.estimated_monthly_clicks_gain, 0);
    const avgPosition = scData.length > 0 
      ? Math.round((scData.reduce((acc, curr) => acc + (Number(curr.position) || 0), 0) / scData.length) * 10) / 10 
      : 0;

    const overallHealth: SiteGrowthAndRecoveryReport['overall_health'] = 
      detectedDrops.some(d => d.severity === 'critical') 
        ? 'critical_drop'
        : detectedDrops.length > 0 
          ? 'at_risk' 
          : 'healthy';

    return {
      domain,
      website_id: websiteId,
      overall_health: overallHealth,
      avg_position: avgPosition,
      striking_distance_count: strikingList.length,
      detected_drops_count: detectedDrops.length,
      total_potential_clicks_gain: totalPotentialClicks,
      striking_distance_opportunities: strikingList.slice(0, 10),
      detected_rank_drops: detectedDrops.slice(0, 10),
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Persists growth opportunities and recovery plans directly into the `seo_opportunities` table
   * so they appear across the dashboard, Content Planner, and approval workflows.
   */
  static async persistOpportunitiesToDatabase(params: {
    websiteId: string;
    report: SiteGrowthAndRecoveryReport;
  }): Promise<number> {
    const { websiteId, report } = params;
    const supabase = createAdminClient();
    let savedCount = 0;

    const telegram = new TelegramService();

    // 1. Persist Rank Drop Recovery Actions & Broadcast to Bot
    for (const drop of report.detected_rank_drops) {
      try {
        const problem = `Ranking Drop on "${drop.keyword}": Slipped from #${drop.previous_position} to #${drop.current_position}`;
        const evidence = `${drop.root_cause_explanation} ${drop.evidence}`;
        const recommendedAction = drop.recovery_plan.map(p => `${p.step}. [${p.action_type.toUpperCase()}] ${p.description}`).join(' \n');

        const { data: existing } = await supabase
          .from('seo_opportunities')
          .select('id')
          .eq('website_id', websiteId)
          .eq('problem', problem)
          .maybeSingle();

        if (!existing) {
          await supabase.from('seo_opportunities').insert({
            website_id: websiteId,
            problem,
            evidence,
            recommended_action: recommendedAction,
            expected_impact: `Recover #${drop.previous_position} position and reclaim ${drop.traffic_loss_pct}% lost clicks`,
            confidence: 'high',
            effort: 'medium',
            risk: 'low',
            priority: drop.severity === 'critical' ? 'high' : 'medium',
            status: 'pending_approval',
          });
          savedCount++;

          // Broadcast alert to Telegram Bot subscribers
          try {
            await telegram.broadcastDiscovery({
              websiteId,
              domain: report.domain,
              type: 'rank_drop',
              dedupKey: `${websiteId}:drop:${drop.keyword.toLowerCase()}`,
              title: `Ranking Drop Alert: "${drop.keyword}"`,
              fields: [
                { label: 'Position Shift', value: `Decreased from #${drop.previous_position} to #${drop.current_position} (-${drop.position_drop})` },
                { label: 'Traffic Impact', value: `Lost ${drop.traffic_loss_pct}% clicks` },
                { label: 'Root Cause', value: drop.primary_root_cause.replace(/_/g, ' ').toUpperCase() },
                { label: 'Diagnosis', value: drop.root_cause_explanation },
                { label: 'Recovery Step 1', value: drop.recovery_plan[0]?.description || 'Refresh content & re-index' },
              ],
              actionLabel: 'Recover Ranking',
              actionUrl: '/rank-tracking',
            });
          } catch (tErr) {
            console.warn('[RankRecoveryEngine] Drop Telegram alert note:', tErr);
          }
        }
      } catch (err) {
        console.warn('[RankRecoveryEngine] Failed to save drop opportunity:', err);
      }
    }

    // 2. Persist Striking-Distance Growth Actions & Broadcast to Bot
    for (const opp of report.striking_distance_opportunities.slice(0, 5)) {
      try {
        const problem = `Striking-Distance Query: "${opp.keyword}" is at #${opp.current_position} (${opp.impressions.toLocaleString()} impressions)`;
        const evidence = `Current CTR is only ${opp.ctr}%. Pushing this keyword into Top 3 will generate an estimated ${opp.estimated_monthly_clicks_gain} additional clicks/mo (${opp.estimated_click_multiplier}).`;
        const recommendedAction = `1. Optimize Title Tag to: "${opp.prescriptive_actions.title_hook_suggestion}"\n2. Add H2 sections: ${opp.prescriptive_actions.recommended_h2_subtopics?.join(', ')}\n3. Add FAQ Schema markup for Rich Snippet visual expansion.`;

        const { data: existing } = await supabase
          .from('seo_opportunities')
          .select('id')
          .eq('website_id', websiteId)
          .eq('problem', problem)
          .maybeSingle();

        if (!existing) {
          await supabase.from('seo_opportunities').insert({
            website_id: websiteId,
            problem,
            evidence,
            recommended_action: recommendedAction,
            expected_impact: `${opp.estimated_click_multiplier} (+${opp.estimated_monthly_clicks_gain} monthly clicks)`,
            confidence: 'high',
            effort: 'low',
            risk: 'low',
            priority: 'high',
            status: 'pending_approval',
          });
          savedCount++;

          // Broadcast growth opportunity to Telegram Bot subscribers
          try {
            await telegram.broadcastDiscovery({
              websiteId,
              domain: report.domain,
              type: 'striking_distance',
              dedupKey: `${websiteId}:growth:${opp.keyword.toLowerCase()}`,
              title: `Fast-Rank Growth Opportunity: "${opp.keyword}"`,
              fields: [
                { label: 'Current Position', value: `#${opp.current_position} (${opp.impressions.toLocaleString()} impressions)` },
                { label: 'Target Position', value: `Top 3 (${opp.estimated_click_multiplier})` },
                { label: 'Estimated Click Unlock', value: `+${opp.estimated_monthly_clicks_gain} clicks/month` },
                { label: 'Recommended Title Hook', value: opp.prescriptive_actions.title_hook_suggestion || 'Update Title & Meta' },
              ],
              actionLabel: 'Deploy Booster',
              actionUrl: '/rank-tracking',
            });
          } catch (tErr) {
            console.warn('[RankRecoveryEngine] Growth Telegram alert note:', tErr);
          }
        }
      } catch (err) {
        console.warn('[RankRecoveryEngine] Failed to save growth opportunity:', err);
      }
    }

    console.log(`[RankRecoveryEngine] Saved ${savedCount} new recovery & growth opportunities for website ${websiteId}`);
    return savedCount;
  }
}
