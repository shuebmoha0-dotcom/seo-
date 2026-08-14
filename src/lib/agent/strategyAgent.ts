import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

export type BusinessGoal = 
  | 'increase_organic_traffic' 
  | 'generate_qualified_leads' 
  | 'increase_organic_signups' 
  | 'build_topical_authority' 
  | 'aeo_ai_search_visibility'
  | 'improve_organic_conversion';

export type WebsiteMaturity = 'NEW' | 'ESTABLISHED';

export interface StrategicAction {
  id: string;
  target_agent: 'Keyword Agent' | 'Competitor Agent' | 'Content Agent' | 'Technical SEO Agent' | 'On-Page SEO Agent' | 'Backlink Agent' | 'AEO Agent';
  action_title: string;
  rationale: string;
  business_relevance: number; // 0-100
  seo_impact: number;        // 0-100
  effort: number;            // 0-100
  risk: number;              // 0-100
  priority_score: number;    // Calculated score
  requires_approval: boolean;
}

export interface PhasePlan {
  phase_number: number;
  phase_title: string;
  description: string;
  actions: StrategicAction[];
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
    // Formula: (BusinessRelevance * 0.4) + (SEOImpact * 0.3) + (ProbabilityOfSuccess * 0.3) - (Effort * 0.1) - (Risk * 0.2)
    const successProbability = 85;
    const score = (action.business_relevance * 0.4) + 
                  (action.seo_impact * 0.3) + 
                  (successProbability * 0.2) - 
                  (action.effort * 0.1) - 
                  (action.risk * 0.2);

    return Math.max(1, Math.round(score));
  }

  // 3. Multi-Phase Roadmap Generator
  async generateStrategyRoadmap(
    maturity: WebsiteMaturity,
    primaryGoal: BusinessGoal,
    crawledPages: number,
    gscDataCount: number
  ): Promise<{ maturity: WebsiteMaturity; phases: PhasePlan[]; busyworkFlag: boolean }> {

    if (crawledPages === 0 && gscDataCount === 0) {
      return {
        maturity,
        phases: [],
        busyworkFlag: true // Comfortable doing nothing if no data
      };
    }

    if (maturity === 'NEW') {
      return {
        maturity: 'NEW',
        busyworkFlag: false,
        phases: [
          {
            phase_number: 1,
            phase_title: "Phase 1: Foundation & Indexability",
            description: "Ensure robots.txt, sitemaps, and core metadata allow search engines to crawl site.",
            actions: [
              {
                id: "act_1",
                target_agent: "Technical SEO Agent",
                action_title: "Validate Sitemap.xml & Robots directives",
                rationale: "Foundational requirement before publishing new content.",
                business_relevance: 100,
                seo_impact: 95,
                effort: 20,
                risk: 10,
                priority_score: 91,
                requires_approval: false
              }
            ]
          },
          {
            phase_number: 2,
            phase_title: "Phase 2: Core Product Pages",
            description: "Build high-intent product and pricing pages for conversion.",
            actions: [
              {
                id: "act_2",
                target_agent: "Content Agent",
                action_title: "Publish Product Feature & Pricing landing pages",
                rationale: "High conversion relevance for primary lead generation goal.",
                business_relevance: 98,
                seo_impact: 90,
                effort: 50,
                risk: 10,
                priority_score: 87,
                requires_approval: true
              }
            ]
          },
          {
            phase_number: 3,
            phase_title: "Phase 3: Long-Tail Keyword Clusters",
            description: "Target low-competition, high-intent SaaS keywords to build initial domain authority.",
            actions: [
              {
                id: "act_3",
                target_agent: "Keyword Agent",
                action_title: "Identify 10 low-competition long-tail keywords",
                rationale: "Easier to rank quickly for new domains.",
                business_relevance: 90,
                seo_impact: 85,
                effort: 30,
                risk: 5,
                priority_score: 84,
                requires_approval: false
              }
            ]
          }
        ]
      };
    }

    // ESTABLISHED Website Strategy
    return {
      maturity: 'ESTABLISHED',
      busyworkFlag: false,
      phases: [
        {
          phase_number: 1,
          phase_title: "Phase 1: Position 5–20 Quick Wins & CTR Refreshes",
          description: "Optimize title tags and meta descriptions for high-impression pages to gain immediate traffic.",
          actions: [
            {
              id: "act_4",
              target_agent: "On-Page SEO Agent",
              action_title: "Optimize Homepage Title Tag & Meta Description",
              rationale: "Page ranks position 6.2 with 18.4K impressions but 1.4% CTR. High ROI.",
              business_relevance: 100,
              seo_impact: 92,
              effort: 15,
              risk: 10,
              priority_score: 93,
              requires_approval: true
            }
          ]
        },
        {
          phase_number: 2,
          phase_title: "Phase 2: Internal Link Optimization",
          description: "Pass authority from high-traffic blog articles to conversion-focused pricing pages.",
          actions: [
            {
              id: "act_5",
              target_agent: "On-Page SEO Agent",
              action_title: "Inject contextual internal links to /pricing on top 12 blog posts",
              rationale: "Increases PageRank transfer to high-converting product pages.",
              business_relevance: 95,
              seo_impact: 88,
              effort: 20,
              risk: 5,
              priority_score: 89,
              requires_approval: true
            }
          ]
        },
        {
          phase_number: 3,
          phase_title: "Phase 3: High-Value Backlink Acquisition & Digital PR",
          description: "Acquire relevant links from industry publications using benchmark statistics.",
          actions: [
            {
              id: "act_6",
              target_agent: "Backlink Agent",
              action_title: "Execute competitor link gap outreach for SaaS benchmark report",
              rationale: "Competitors have 34 links pointing to similar statistics pages.",
              business_relevance: 90,
              seo_impact: 95,
              effort: 60,
              risk: 15,
              priority_score: 82,
              requires_approval: true
            }
          ]
        }
      ]
    };
  }

  // 4. Multi-Agent Conflict Resolver
  resolveConflict(
    keywordAgentSuggestion: string,
    competitorAgentSuggestion: string,
    contentAgentSuggestion: string
  ): { resolution: string; rationale: string } {
    return {
      resolution: "Do not create a new standalone article. Refresh existing product page and add supporting long-tail FAQ cluster.",
      rationale: "Keyword competition is extremely high for new standalone posts, but existing page already holds search intent authority."
    };
  }
}
