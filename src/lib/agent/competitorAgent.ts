import { LLMProvider } from '../tools/llm';

import { z } from 'zod';
import { SEOOpportunity } from './types';

export class CompetitorAgent {
  /**
   * Discovers and classifies real SEO and SERP competitors.
   * Identifies direct, SERP, content, and commercial competitors.
   */
  async discoverCompetitors(
    customerDomain: string,
    targetKeywords: string[],
    serpData: { keyword: string; results: { url: string; title: string; domain: string }[] }[]
  ) {
    console.log('[CompetitorAgent] Discovering competitors based on SERP overlap...');

    const { object } = await LLMProvider.generateObject({
      agent: 'CompetitorAgent',
      
      
      schema: z.object({
        competitors: z.array(z.object({
          domain: z.string(),
          classification: z.enum(['direct', 'serp', 'content', 'commercial']),
          reason: z.string(),
          relevance_score: z.number().min(1).max(100),
          overlap_keywords: z.array(z.string())
        }))
      }),
      prompt: `
        You are an expert SEO Competitor Intelligence Agent.
        Analyze the SERP data for the target keywords of the customer domain: ${customerDomain}.
        Identify the real SEO competitors. Keep in mind a competitor may just be an informational blog occupying SERP space (Content Competitor) rather than a Direct business competitor.
        Provide concrete reasons and an internal relevance score (1-100).
        
        Target Keywords: ${JSON.stringify(targetKeywords)}
        SERP Data: ${JSON.stringify(serpData)}
      `
    });

    return object.competitors.sort((a: any, b: any) => b.relevance_score - a.relevance_score);
  }

  /**
   * Analyzes keyword gaps between the customer and a competitor.
   * Identifies long-tail opportunities and high-intent gaps.
   */
  async analyzeKeywordGaps(
    customerKeywords: { keyword: string; position: number; volume: number }[],
    competitorKeywords: { keyword: string; position: number; volume: number; domain: string }[]
  ): Promise<SEOOpportunity[]> {
    console.log('[CompetitorAgent] Analyzing keyword gaps...');

    const { object } = await LLMProvider.generateObject({
      agent: 'CompetitorAgent',
      
      
      schema: z.object({
        opportunities: z.array(z.object({
          keyword: z.string(),
          competitor_domain: z.string(),
          gap_type: z.enum(['missing', 'losing', 'long-tail']),
          intent: z.string(),
          reason: z.string(),
          priority: z.enum(['high', 'medium', 'low']),
          confidence: z.enum(['high', 'medium', 'low'])
        }))
      }),
      prompt: `
        You are an expert SEO Competitor Intelligence Agent.
        Compare the customer's ranking keywords with the competitor's ranking keywords.
        Find actionable keyword gaps (where the customer is missing out entirely, or losing badly).
        Do NOT recommend every gap; focus on realistic, high-value, and long-tail opportunities.
        
        Customer Keywords: ${JSON.stringify(customerKeywords)}
        Competitor Keywords: ${JSON.stringify(competitorKeywords)}
      `
    });

    return object.opportunities.map((opp: any) => ({
      problem: `Competitor gap detected for keyword: ${opp.keyword}`,
      evidence: `Competitor ${opp.competitor_domain} is ranking well for this ${opp.gap_type} keyword. Search intent is ${opp.intent}.`,
      recommended_action: `Target keyword: ${opp.keyword} (Gap type: ${opp.gap_type})`,
      expected_impact: opp.reason,
      confidence: opp.confidence,
      effort: 'medium',
      risk: 'low',
      priority: opp.priority
    }));
  }

  /**
   * Compares a customer page against a competitor page to find content gaps.
   */
  async analyzeContentGaps(
    customerPage: { url: string; content: string },
    competitorPage: { url: string; content: string }
  ) {
    console.log(`[CompetitorAgent] Analyzing content gaps for ${customerPage.url} vs ${competitorPage.url}`);

    const { object } = await LLMProvider.generateObject({
      agent: 'CompetitorAgent',
      
      
      schema: z.object({
        content_gaps: z.array(z.object({
          missing_topic: z.string(),
          competitor_coverage: z.string(),
          recommendation: z.string(),
          priority: z.enum(['high', 'medium', 'low'])
        })),
        differentiation_opportunities: z.array(z.string())
      }),
      prompt: `
        You are an expert SEO Competitor Intelligence Agent.
        Compare the content of the customer's page against the competitor's ranking page.
        Identify missing topics, subtopics, use cases, or depth. 
        Crucially, do NOT recommend copying. Identify how the customer can cover the topic BETTER or DIFFERENTLY (differentiation).
        
        Customer Page (${customerPage.url}):
        ${customerPage.content.substring(0, 4000)}
        
        Competitor Page (${competitorPage.url}):
        ${competitorPage.content.substring(0, 4000)}
      `
    });

    return object;
  }

  /**
   * Detects threats where a competitor has overtaken the customer.
   */
  async analyzeSerpThreats(
    rankingChanges: { keyword: string; customer_old: number; customer_new: number; competitor_domain: string; competitor_old: number; competitor_new: number }[]
  ) {
    const threats = rankingChanges.filter(
      change => change.customer_new > change.customer_old && change.competitor_new < change.competitor_old && change.competitor_new < change.customer_new
    );

    if (threats.length === 0) return [];

    console.log(`[CompetitorAgent] Detected ${threats.length} SERP threats. Analyzing...`);

    const { object } = await LLMProvider.generateObject({
      agent: 'CompetitorAgent',
      
      
      schema: z.object({
        threat_responses: z.array(z.object({
          keyword: z.string(),
          threat_level: z.enum(['critical', 'high', 'moderate']),
          analysis: z.string(),
          recommended_response: z.string()
        }))
      }),
      prompt: `
        You are an expert SEO Competitor Intelligence Agent.
        The following SERP changes indicate that competitors have recently overtaken the customer for important keywords.
        Analyze these movements and recommend a strategic response (e.g. content refresh, investigate search intent shift, improve internal linking).
        
        Threat Data: ${JSON.stringify(threats)}
      `
    });

    return object.threat_responses;
  }
}
