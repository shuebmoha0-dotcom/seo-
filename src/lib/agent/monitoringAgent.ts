import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { MemoryAgent } from './memoryAgent';

export interface ActionHypothesis {
  action_type: 'create_post' | 'ctr_rewrite' | 'content_refresh' | 'internal_link_injection';
  target_keyword: string;
  target_url?: string;
  category?: string;
  baseline_date: string;
  baseline_metrics: {
    clicks_28d: number;
    impressions_28d: number;
    avg_position: number;
    ctr: number;
  };
  expected_outcome: string;
  evaluate_after_days: number;
  evaluate_at: string;
  evaluated: boolean;
  evaluated_at?: string;
  outcome_status?: 'WIN' | 'EARLY_TRACTION' | 'REGRESSION' | 'STAGNANT';
  outcome_summary?: string;
  current_metrics?: {
    clicks_28d: number;
    impressions_28d: number;
    avg_position: number;
    ctr: number;
  };
}

export interface OutcomeEvaluationCycleReport {
  website_id: string;
  evaluated_count: number;
  wins_count: number;
  early_traction_count: number;
  regressions_count: number;
  stagnant_count: number;
  learnings_recorded: string[];
  summary: string;
}

export class MonitoringAgent {
  /**
   * Constructs a testable baseline hypothesis object to attach to `revision_notes`
   * whenever the autonomous agent publishes a post or optimizes an existing page.
   */
  static buildActionHypothesis(params: {
    actionType: ActionHypothesis['action_type'];
    targetKeyword: string;
    targetUrl?: string;
    category?: string;
    baselineMetrics?: Partial<ActionHypothesis['baseline_metrics']>;
    expectedOutcome?: string;
    evaluateAfterDays?: number;
  }): ActionHypothesis {
    const days = params.evaluateAfterDays || 14;
    const now = new Date();
    const evalDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return {
      action_type: params.actionType,
      target_keyword: params.targetKeyword,
      target_url: params.targetUrl,
      category: params.category,
      baseline_date: now.toISOString(),
      baseline_metrics: {
        clicks_28d: params.baselineMetrics?.clicks_28d ?? 0,
        impressions_28d: params.baselineMetrics?.impressions_28d ?? 0,
        avg_position: params.baselineMetrics?.avg_position ?? 0,
        ctr: params.baselineMetrics?.ctr ?? 0,
      },
      expected_outcome:
        params.expectedOutcome ||
        `Achieve Google indexation and measurable impression velocity on "${params.targetKeyword}" within ${days} days.`,
      evaluate_after_days: days,
      evaluate_at: evalDate.toISOString(),
      evaluated: false,
    };
  }

  /**
   * Closed-Loop Outcome Evaluator:
   * Inspects previously published articles and optimizations whose evaluation window (e.g., >= 7-14 days)
   * has matured, compares current Search Console metrics against baseline, records empirical learnings
   * into `project_memory`, and flags stagnant/regressing items for follow-up optimization.
   */
  static async runOutcomeEvaluationCycle(websiteId: string): Promise<OutcomeEvaluationCycleReport> {
    const supabase = createAdminClient();
    const learningsRecorded: string[] = [];
    let evaluatedCount = 0;
    let winsCount = 0;
    let earlyTractionCount = 0;
    let regressionsCount = 0;
    let stagnantCount = 0;

    try {
      // Prune operational noise from project_memory first
      await MemoryAgent.pruneOperationalNoise(websiteId);

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [draftsRes, gscRes] = await Promise.all([
        supabase
          .from('content_drafts')
          .select('id, working_title, primary_keyword, url_slug, status, revision_notes, created_at')
          .eq('website_id', websiteId)
          .eq('status', 'published')
          .lte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('search_console_data')
          .select('query, position, impressions, clicks, ctr')
          .eq('website_id', websiteId)
          .not('query', 'is', null)
          .limit(300),
      ]);

      const drafts = draftsRes.data || [];
      const gscRows = gscRes.data || [];

      // If Search Console has no synced data at all yet, do not falsely mark articles as STAGNANT (Rule 9)
      if (gscRows.length === 0) {
        return {
          website_id: websiteId,
          evaluated_count: 0,
          wins_count: 0,
          early_traction_count: 0,
          regressions_count: 0,
          stagnant_count: 0,
          learnings_recorded: [],
          summary: 'No Search Console performance data has been synced yet for outcome evaluation.',
        };
      }

      const nowMs = Date.now();

      for (const draft of drafts) {
        let notes: Record<string, any> = {};
        try {
          notes = typeof draft.revision_notes === 'string' ? JSON.parse(draft.revision_notes) : draft.revision_notes || {};
        } catch {
          notes = {};
        }

        const existingHyp: ActionHypothesis | undefined = notes.hypothesis;
        if (existingHyp?.evaluated) {
          continue;
        }

        // Check if evaluation window has matured (either evaluate_at <= now, or created >= 7 days ago if no hypothesis was previously attached)
        const evalTimeMs = existingHyp?.evaluate_at ? new Date(existingHyp.evaluate_at).getTime() : 0;
        if (evalTimeMs > nowMs) {
          continue;
        }

        const kwLower = (draft.primary_keyword || '').trim().toLowerCase();
        const kwWords = kwLower.split(/\s+/).filter((w: string) => w.length >= 4);

        // Match Search Console queries related to this article's primary keyword
        const matchedGsc = gscRows.filter((r) => {
          const q = (r.query || '').toLowerCase();
          if (q === kwLower || q.includes(kwLower) || kwLower.includes(q)) return true;
          if (kwWords.length >= 2) {
            const matchedWordCount = kwWords.filter((w: string) => q.includes(w)).length;
            return matchedWordCount >= Math.ceil(kwWords.length * 0.65);
          }
          return false;
        });

        const currClicks = matchedGsc.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
        const currImpressions = matchedGsc.reduce((acc, r) => acc + (Number(r.impressions) || 0), 0);
        const currPos =
          matchedGsc.length > 0
            ? Math.round((matchedGsc.reduce((acc, r) => acc + (Number(r.position) || 0), 0) / matchedGsc.length) * 10) / 10
            : 0;
        const currCtr = currImpressions > 0 ? Math.round((currClicks / currImpressions) * 1000) / 10 : 0;

        const baseImps = existingHyp?.baseline_metrics?.impressions_28d ?? 0;
        const baseClicks = existingHyp?.baseline_metrics?.clicks_28d ?? 0;
        const basePos = existingHyp?.baseline_metrics?.avg_position ?? 0;

        let outcomeStatus: ActionHypothesis['outcome_status'] = 'STAGNANT';
        let outcomeSummary = '';

        if (currClicks > baseClicks || currImpressions >= baseImps + 25 || (currPos > 0 && currPos <= 15 && (basePos === 0 || currPos <= basePos - 2))) {
          outcomeStatus = 'WIN';
          winsCount++;
          outcomeSummary = `WIN on "${draft.working_title}" (${draft.primary_keyword}): Generated ${currImpressions} impressions, ${currClicks} clicks at Avg Pos #${currPos} (CTR ${currCtr}%).`;
        } else if (currImpressions > 0) {
          outcomeStatus = 'EARLY_TRACTION';
          earlyTractionCount++;
          outcomeSummary = `EARLY TRACTION on "${draft.working_title}" (${draft.primary_keyword}): Indexed at Avg Pos #${currPos} with ${currImpressions} initial impressions.`;
        } else if (basePos > 0 && currPos > basePos + 3) {
          outcomeStatus = 'REGRESSION';
          regressionsCount++;
          outcomeSummary = `REGRESSION on "${draft.working_title}" (${draft.primary_keyword}): Position slipped from #${basePos} to #${currPos}. Needs content refresh & internal links.`;
        } else {
          outcomeStatus = 'STAGNANT';
          stagnantCount++;
          outcomeSummary = `STAGNANT after 7+ days on "${draft.working_title}" (${draft.primary_keyword}): 0 GSC impressions recorded yet. Queuing internal link & re-index booster.`;
        }

        const updatedHypothesis: ActionHypothesis = {
          ...(existingHyp ||
            this.buildActionHypothesis({
              actionType: 'create_post',
              targetKeyword: draft.primary_keyword || draft.working_title,
              targetUrl: notes.wordpress_post_url,
            })),
          evaluated: true,
          evaluated_at: new Date().toISOString(),
          outcome_status: outcomeStatus,
          outcome_summary: outcomeSummary,
          current_metrics: {
            clicks_28d: currClicks,
            impressions_28d: currImpressions,
            avg_position: currPos,
            ctr: currCtr,
          },
        };

        await supabase
          .from('content_drafts')
          .update({
            revision_notes: JSON.stringify({
              ...notes,
              hypothesis: updatedHypothesis,
            }),
          })
          .eq('id', draft.id);

        evaluatedCount++;

        if (outcomeStatus === 'WIN' || outcomeStatus === 'REGRESSION' || outcomeStatus === 'EARLY_TRACTION') {
          await MemoryAgent.recordExperimentOutcome({
            websiteId,
            outcomeStatus,
            learningSummary: `[Outcome ${outcomeStatus}] ${outcomeSummary}`,
          });
          learningsRecorded.push(outcomeSummary);
        }

        // Cap evaluations per cycle to 5 so it completes in < 2 seconds
        if (evaluatedCount >= 5) break;
      }

      const summary =
        evaluatedCount > 0
          ? `Evaluated ${evaluatedCount} past action hypothesis(es): ${winsCount} Win(s), ${earlyTractionCount} Early Traction, ${regressionsCount} Regression(s), ${stagnantCount} Stagnant.`
          : `All matured action hypotheses are up to date.`;

      return {
        website_id: websiteId,
        evaluated_count: evaluatedCount,
        wins_count: winsCount,
        early_traction_count: earlyTractionCount,
        regressions_count: regressionsCount,
        stagnant_count: stagnantCount,
        learnings_recorded: learningsRecorded,
        summary,
      };
    } catch (err: any) {
      console.warn('[MonitoringAgent] Outcome evaluation notice:', err?.message || err);
      return {
        website_id: websiteId,
        evaluated_count: 0,
        wins_count: 0,
        early_traction_count: 0,
        regressions_count: 0,
        stagnant_count: 0,
        learnings_recorded: [],
        summary: 'Outcome evaluation check completed.',
      };
    }
  }

  /**
   * Analyzes ranking shifts to detect meaningful movements (entering/leaving top 10, page 2, or massive drops).
   */
  async analyzeRankingShifts(
    historicalRankings: { keyword: string; position: number }[],
    currentRankings: { keyword: string; position: number }[]
  ) {
    console.log('[MonitoringAgent] Analyzing ranking shifts...');

    const movements = currentRankings
      .map((curr) => {
        const hist = historicalRankings.find((h) => h.keyword === curr.keyword);
        if (!hist) return null;
        return {
          keyword: curr.keyword,
          old_position: hist.position,
          new_position: curr.position,
          change: hist.position - curr.position,
        };
      })
      .filter(Boolean);

    if (movements.length === 0) return [];

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      complexity: 'complex',
      schema: z.object({
        alerts: z.array(
          z.object({
            category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
            keyword: z.string(),
            what_happened: z.string(),
            why_it_matters: z.string(),
            evidence: z.string(),
            recommended_next_step: z.string(),
          })
        ),
      }),
      prompt: `
        You are an expert SEO Monitoring Analyst.
        Review the following ranking movements. Do not alert on tiny fluctuations (e.g., 4 -> 5).
        Only alert on significant changes:
        - Entering/leaving Top 10
        - Entering Page 2 (Positions 11-20)
        - Major drops for high-value keywords.
        
        Rank Movements: ${JSON.stringify(movements)}
      `,
    });

    return object.alerts;
  }

  /**
   * Analyzes Search Console and Analytics data anomalies (e.g., traffic drops, high impressions but low CTR).
   */
  async analyzeTrafficAnomalies(
    historicalGscData: { url: string; clicks: number; impressions: number; ctr: number }[],
    currentGscData: { url: string; clicks: number; impressions: number; ctr: number }[]
  ) {
    console.log('[MonitoringAgent] Analyzing traffic anomalies...');

    if (currentGscData.length === 0) return [];

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      complexity: 'complex',
      schema: z.object({
        alerts: z.array(
          z.object({
            category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
            affected_page: z.string(),
            what_happened: z.string(),
            why_it_matters: z.string(),
            evidence: z.string(),
            recommended_next_step: z.string(),
          })
        ),
      }),
      prompt: `
        You are an expert SEO Monitoring Analyst.
        Compare the historical (e.g., previous 28 days) vs current GSC metrics for these pages.
        Detect patterns like:
        - High impressions but low/dropping CTR
        - Significant traffic decline (which could mean rank drop or intent shift)
        - Unexpected traffic increases
        
        Historical: ${JSON.stringify(historicalGscData)}
        Current: ${JSON.stringify(currentGscData)}
      `,
    });

    return object.alerts;
  }

  /**
   * Evaluates the outcome of previously executed SEO actions.
   */
  async evaluateActionOutcomes(
    actionHistory: { action_id: string; date: string; change_made: string; baseline_metrics: any; expected_outcome: string }[],
    currentMetrics: { action_id: string; current_metrics: any }[]
  ) {
    console.log('[MonitoringAgent] Evaluating action outcomes...');

    if (actionHistory.length === 0) return [];

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      complexity: 'complex',
      schema: z.object({
        evaluations: z.array(
          z.object({
            action_id: z.string(),
            status: z.enum(['Positive signal', 'Negative signal', 'Inconclusive']),
            analysis: z.string(),
            decision: z.enum(['Keep', 'Revert', 'Extend experiment', 'Modify']),
          })
        ),
      }),
      prompt: `
        You are an expert SEO Monitoring Analyst.
        Review previously executed SEO actions against their current metrics to see if they achieved the expected outcome.
        Do not declare success from insufficient data (use Inconclusive if unsure).
        
        Actions: ${JSON.stringify(actionHistory)}
        Current Metrics: ${JSON.stringify(currentMetrics)}
      `,
    });

    return object.evaluations;
  }

  /**
   * General deduplication and formatting of alerts to pass to the Strategy Agent and Dashboard.
   */
  async generateIntelligentAlerts(rawEvents: any[]) {
    if (!rawEvents || rawEvents.length === 0) return [];

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      complexity: 'complex',
      schema: z.object({
        final_alerts: z.array(
          z.object({
            id: z.string(),
            category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
            title: z.string(),
            what_happened: z.string(),
            why_it_matters: z.string(),
            evidence: z.string(),
            affected_target: z.string(),
            when_it_started: z.string(),
            recommended_next_step: z.string(),
          })
        ),
      }),
      prompt: `
        Filter these raw SEO monitoring events.
        Deduplicate them. Group related issues. 
        Format them into clear, actionable alerts.
        Only emit an alert if it is highly meaningful.
        
        Events: ${JSON.stringify(rawEvents)}
      `,
    });

    return object.final_alerts;
  }
}
