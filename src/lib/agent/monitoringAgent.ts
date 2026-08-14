import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

export class MonitoringAgent {
  /**
   * Analyzes ranking shifts to detect meaningful movements (entering/leaving top 10, page 2, or massive drops).
   */
  async analyzeRankingShifts(
    historicalRankings: { keyword: string; position: number }[],
    currentRankings: { keyword: string; position: number }[]
  ) {
    console.log('[MonitoringAgent] Analyzing ranking shifts...');

    // Combine historical and current to find movements
    const movements = currentRankings.map(curr => {
      const hist = historicalRankings.find(h => h.keyword === curr.keyword);
      if (!hist) return null;
      return {
        keyword: curr.keyword,
        old_position: hist.position,
        new_position: curr.position,
        change: hist.position - curr.position
      };
    }).filter(Boolean);

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      
      
      schema: z.object({
        alerts: z.array(z.object({
          category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
          keyword: z.string(),
          what_happened: z.string(),
          why_it_matters: z.string(),
          evidence: z.string(),
          recommended_next_step: z.string()
        }))
      }),
      prompt: `
        You are an expert SEO Monitoring Analyst.
        Review the following ranking movements. Do not alert on tiny fluctuations (e.g., 4 -> 5).
        Only alert on significant changes:
        - Entering/leaving Top 10
        - Entering Page 2 (Positions 11-20)
        - Major drops for high-value keywords.
        
        Rank Movements: ${JSON.stringify(movements)}
      `
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

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      
      
      schema: z.object({
        alerts: z.array(z.object({
          category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
          affected_page: z.string(),
          what_happened: z.string(),
          why_it_matters: z.string(),
          evidence: z.string(),
          recommended_next_step: z.string()
        }))
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
      `
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

    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      
      
      schema: z.object({
        evaluations: z.array(z.object({
          action_id: z.string(),
          status: z.enum(['Positive signal', 'Negative signal', 'Inconclusive']),
          analysis: z.string(),
          decision: z.enum(['Keep', 'Revert', 'Extend experiment', 'Modify'])
        }))
      }),
      prompt: `
        You are an expert SEO Monitoring Analyst.
        Review previously executed SEO actions against their current metrics to see if they achieved the expected outcome.
        Do not declare success from insufficient data (use Inconclusive if unsure).
        
        Actions: ${JSON.stringify(actionHistory)}
        Current Metrics: ${JSON.stringify(currentMetrics)}
      `
    });

    return object.evaluations;
  }

  /**
   * General deduplication and formatting of alerts to pass to the Strategy Agent and Dashboard.
   */
  async generateIntelligentAlerts(rawEvents: any[]) {
    // In a real system, this would fetch active alerts from DB to prevent duplicate alerting on the same unresolved issue.
    const { object } = await LLMProvider.generateObject({
      agent: 'MonitoringAgent',
      
      
      schema: z.object({
        final_alerts: z.array(z.object({
          id: z.string(),
          category: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']),
          title: z.string(),
          what_happened: z.string(),
          why_it_matters: z.string(),
          evidence: z.string(),
          affected_target: z.string(),
          when_it_started: z.string(),
          recommended_next_step: z.string()
        }))
      }),
      prompt: `
        Filter these raw SEO monitoring events.
        Deduplicate them. Group related issues. 
        Format them into clear, actionable alerts.
        Only emit an alert if it is highly meaningful.
        
        Events: ${JSON.stringify(rawEvents)}
      `
    });

    return object.final_alerts;
  }
}
