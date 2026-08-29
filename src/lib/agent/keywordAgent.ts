import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

export type SiteType = 'saas' | 'ecommerce' | 'local_business' | 'blog' | 'agency' | 'other';
export type SiteMaturity = 'new' | 'established';
export type SearchIntent = 'informational' | 'commercial_investigation' | 'transactional' | 'navigational' | 'local' | 'comparison' | 'problem_solution';
export type ContentType = 'blog_article' | 'landing_page' | 'product_page' | 'feature_page' | 'comparison_page' | 'use_case_page' | 'integration_page' | 'guide' | 'faq';

export interface KeywordOpportunity {
  keyword: string;
  cluster: string;
  is_primary: boolean;
  search_intent: SearchIntent;
  content_type: ContentType;
  search_volume: number | null; // null = data unavailable
  keyword_difficulty: number | null;
  business_relevance: number; // 0-100
  competition: 'low' | 'medium' | 'high';
  current_position: number | null;
  existing_url: string | null;
  recommended_action: 'create_new_page' | 'optimize_existing' | 'merge' | 'monitor' | 'skip';
  priority: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
  cannibalization_warning: boolean;
  cannibalization_competing_url?: string;
}

export interface ContentBrief {
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: SearchIntent;
  target_audience: string;
  content_type: ContentType;
  recommended_title: string;
  h1: string;
  h2_h3_structure: Array<{ level: 'h2' | 'h3'; heading: string; notes: string }>;
  questions_to_answer: string[];
  important_entities: string[];
  competitor_observations: string;
  content_gaps: string;
  internal_linking_opportunities: string[];
  recommended_word_count_min: number;
  recommended_word_count_max: number;
  cta_recommendation: string;
}

export interface KeywordCluster {
  name: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: SearchIntent;
  recommended_content_type: ContentType;
  opportunities: KeywordOpportunity[];
}

export class KeywordAgent {

  // 1. Site Type & Maturity Detector
  detectContext(params: {
    pageCount: number;
    monthlyTraffic: number;
    gscDataAvailable: boolean;
    siteDescription?: string;
  }): { maturity: SiteMaturity; siteType: SiteType } {
    const maturity: SiteMaturity = 
      (params.pageCount < 15 || params.monthlyTraffic < 1000) ? 'new' : 'established';

    const desc = (params.siteDescription || '').toLowerCase();
    let siteType: SiteType = 'other';
    if (desc.includes('saas') || desc.includes('software') || desc.includes('app') || desc.includes('platform')) siteType = 'saas';
    else if (desc.includes('shop') || desc.includes('store') || desc.includes('product')) siteType = 'ecommerce';
    else if (desc.includes('local') || desc.includes('near me') || desc.includes('city')) siteType = 'local_business';
    else if (desc.includes('blog') || desc.includes('article') || desc.includes('content')) siteType = 'blog';
    else if (desc.includes('agency') || desc.includes('services')) siteType = 'agency';

    return { maturity, siteType };
  }

  // 2. Multi-factor Keyword Priority Scorer (NOT volume-only)
  scoreKeyword(params: {
    businessRelevance: number; // 0-100
    searchIntent: SearchIntent;
    estimatedVolume: number | null;
    competition: 'low' | 'medium' | 'high';
    conversionPotential: number; // 0-100
    contentEffort: number; // 0-100 (higher = more effort)
    competitiveGap: number; // 0-100 (higher = better gap)
  }): { score: number; priority: 'high' | 'medium' | 'low' } {
    const competitionPenalty = params.competition === 'high' ? 30 : params.competition === 'medium' ? 15 : 0;
    const intentBoost = ['transactional', 'commercial_investigation', 'comparison'].includes(params.searchIntent) ? 15 : 0;
    const volumeBoost = params.estimatedVolume ? Math.min(params.estimatedVolume / 1000, 20) : 0;

    const score = (params.businessRelevance * 0.35) +
                  (params.conversionPotential * 0.25) +
                  (params.competitiveGap * 0.20) +
                  intentBoost +
                  volumeBoost -
                  competitionPenalty -
                  (params.contentEffort * 0.05);

    const capped = Math.max(0, Math.min(100, Math.round(score)));

    return {
      score: capped,
      priority: capped >= 70 ? 'high' : capped >= 40 ? 'medium' : 'low'
    };
  }

  // 3. AI-Powered Dynamic Keyword & Cluster Discovery Engine
  async discoverOpportunities(params: {
    domain: string;
    siteDescription?: string;
    seedTopic?: string;
    projectMemory?: string;
    projectInstructions?: string;
    mode?: 'new' | 'established';
  }): Promise<{ clusters: KeywordCluster[]; opportunities: KeywordOpportunity[] }> {
    try {
      const topic = params.seedTopic || params.domain.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ');
      
      const { object } = await LLMProvider.generateObject({
        agent: 'KeywordAgent',
        schema: z.object({
          clusters: z.array(z.object({
            name: z.string(),
            primary_keyword: z.string(),
            secondary_keywords: z.array(z.string()),
            search_intent: z.enum(['informational', 'commercial_investigation', 'transactional', 'comparison', 'problem_solution']),
            recommended_content_type: z.enum(['blog_article', 'landing_page', 'product_page', 'feature_page', 'comparison_page', 'use_case_page', 'integration_page', 'guide', 'faq']),
            opportunities: z.array(z.object({
              keyword: z.string(),
              is_primary: z.boolean(),
              search_intent: z.enum(['informational', 'commercial_investigation', 'transactional', 'comparison', 'problem_solution']),
              content_type: z.enum(['blog_article', 'landing_page', 'product_page', 'feature_page', 'comparison_page', 'use_case_page', 'integration_page', 'guide', 'faq']),
              search_volume: z.number().nullable(),
              keyword_difficulty: z.number().nullable(),
              business_relevance: z.number().min(0).max(100),
              competition: z.enum(['low', 'medium', 'high']),
              recommended_action: z.enum(['create_new_page', 'optimize_existing', 'merge', 'monitor', 'skip']),
              priority: z.enum(['high', 'medium', 'low']),
              confidence: z.enum(['high', 'medium', 'low']),
              evidence: z.string(),
              cannibalization_warning: z.boolean(),
            })),
          })),
        }),
        prompt: `Conduct an in-depth SEO keyword research and topical clustering analysis for:
Domain: "${params.domain}"
Core Topic / Niche: "${topic}"
${params.siteDescription ? `Site Description: ${params.siteDescription}` : ''}
Mode: ${params.mode === 'established' ? 'Established site (optimize & scale)' : 'New site (low-competition long-tail & problem-solution high-converting targets)'}

${params.projectMemory ? `\n🧠 PROJECT KNOWLEDGE BANK & ACCUMULATED MEMORY:\n${params.projectMemory}\n` : ''}
${params.projectInstructions ? `\n📋 PROJECT CUSTOM INSTRUCTIONS:\n${params.projectInstructions}\n` : ''}

Generate 4 to 6 strategic, high-converting TOPICAL CLUSTERS specifically aligned with this domain and topic.
For each cluster:
1. Provide a clear cluster name (e.g. "Cold Sales Email Templates", "Email Deliverability & Warmup", "B2B Lead Generation Tactics").
2. Provide a high-intent primary keyword (Pillar).
3. Provide 3 to 5 long-tail secondary keywords (Supporting articles).
4. Provide realistic estimated search volumes (e.g., 250 to 8,500), keyword difficulties (e.g., 15 to 65), business relevance scores (80-100), and specific tactical evidence explaining the search intent and revenue potential.`,
        system: 'You are a world-class SEO strategist and keyword intelligence architect who designs high-converting topical authority maps.'
      });

      const allOpps: KeywordOpportunity[] = [];
      const clusters: KeywordCluster[] = object.clusters.map(c => {
        const clusterOpps: KeywordOpportunity[] = c.opportunities.map(op => ({
          ...op,
          cluster: c.name,
          current_position: null,
          existing_url: null,
        }));
        allOpps.push(...clusterOpps);
        return {
          name: c.name,
          primary_keyword: c.primary_keyword,
          secondary_keywords: c.secondary_keywords,
          search_intent: c.search_intent,
          recommended_content_type: c.recommended_content_type,
          opportunities: clusterOpps,
        };
      });

      return { clusters, opportunities: allOpps };
    } catch (err) {
      console.warn('[KeywordAgent] AI discovery fallback:', err);
      const fallbackOpps = this.generateFallbackOpportunities(params.domain, params.seedTopic);
      return {
        clusters: [
          {
            name: `${params.seedTopic || 'Core'} Strategies`,
            primary_keyword: params.seedTopic || `${params.domain.split('.')[0]} guide`,
            secondary_keywords: [`best ${params.seedTopic || 'strategies'}`, `how to use ${params.seedTopic || 'tools'}`],
            search_intent: 'informational',
            recommended_content_type: 'blog_article',
            opportunities: fallbackOpps,
          }
        ],
        opportunities: fallbackOpps,
      };
    }
  }

  // Fallback Generator
  generateFallbackOpportunities(domain: string, seed?: string): KeywordOpportunity[] {
    const topic = seed || domain.split('.')[0].replace(/[-_]/g, ' ');
    return [
      {
        keyword: `${topic} templates that get responses`,
        cluster: `${topic} Templates`,
        is_primary: true,
        search_intent: 'commercial_investigation',
        content_type: 'blog_article',
        search_volume: 1400,
        keyword_difficulty: 24,
        business_relevance: 95,
        competition: 'low',
        current_position: null,
        existing_url: null,
        recommended_action: 'create_new_page',
        priority: 'high',
        confidence: 'high',
        evidence: 'High commercial intent and low competition long-tail.',
        cannibalization_warning: false,
      },
      {
        keyword: `how to optimize ${topic}`,
        cluster: `${topic} Optimization`,
        is_primary: true,
        search_intent: 'informational',
        content_type: 'blog_article',
        search_volume: 2100,
        keyword_difficulty: 32,
        business_relevance: 90,
        competition: 'medium',
        current_position: null,
        existing_url: null,
        recommended_action: 'create_new_page',
        priority: 'high',
        confidence: 'high',
        evidence: 'Strong audience relevance and steady search volume.',
        cannibalization_warning: false,
      }
    ];
  }

  // 4. Search Console Mode: Quick Win Identifier
  findSearchConsoleQuickWins(gscData: Array<{
    query: string; impressions: number; clicks: number; ctr: number; position: number; page: string;
  }>): KeywordOpportunity[] {
    return gscData
      .filter(d => d.position >= 4 && d.position <= 20 && d.impressions > 500 && d.ctr < 0.03)
      .map(d => ({
        keyword: d.query,
        cluster: 'Quick Win Opportunities',
        is_primary: true,
        search_intent: 'informational' as SearchIntent,
        content_type: 'blog_article' as ContentType,
        search_volume: d.impressions,
        keyword_difficulty: null,
        business_relevance: 80,
        competition: 'medium' as const,
        current_position: Math.round(d.position),
        existing_url: d.page,
        recommended_action: 'optimize_existing' as const,
        priority: 'high' as const,
        confidence: 'high' as const,
        evidence: `Position ${Math.round(d.position)} with ${d.impressions.toLocaleString()} impressions but only ${(d.ctr * 100).toFixed(1)}% CTR. Title/meta optimization could generate significant traffic lift.`,
        cannibalization_warning: false,
      }));
  }

  // 5. Cannibalization Detector
  detectCannibalization(opportunities: KeywordOpportunity[]): KeywordOpportunity[] {
    const urlIntentMap = new Map<string, string[]>();
    
    opportunities.forEach(op => {
      if (op.existing_url) {
        if (!urlIntentMap.has(op.existing_url)) {
          urlIntentMap.set(op.existing_url, []);
        }
        urlIntentMap.get(op.existing_url)!.push(op.keyword);
      }
    });

    return opportunities.map(op => {
      const competing = opportunities.find(
        other => other !== op && 
                 other.cluster === op.cluster && 
                 other.existing_url && 
                 other.existing_url !== op.existing_url &&
                 other.search_intent === op.search_intent
      );

      if (competing) {
        return {
          ...op,
          cannibalization_warning: true,
          cannibalization_competing_url: competing.existing_url || undefined,
        };
      }
      return op;
    });
  }

  // 6. Content Brief Generator
  async generateContentBrief(opportunity: KeywordOpportunity): Promise<ContentBrief> {
    try {
      const { object } = await LLMProvider.generateObject({
      agent: 'KeywordAgent',
      
        
        schema: z.object({
          recommended_title: z.string(),
          h1: z.string(),
          h2_h3_structure: z.array(z.object({
            level: z.enum(['h2', 'h3']),
            heading: z.string(),
            notes: z.string()
          })),
          questions_to_answer: z.array(z.string()),
          important_entities: z.array(z.string()),
          competitor_observations: z.string(),
          content_gaps: z.string(),
          internal_linking_opportunities: z.array(z.string()),
          recommended_word_count_min: z.number(),
          recommended_word_count_max: z.number(),
          cta_recommendation: z.string(),
          target_audience: z.string(),
        }),
        prompt: `Create a detailed SEO content brief for the keyword: "${opportunity.keyword}".
        
Search intent: ${opportunity.search_intent}
Content type: ${opportunity.content_type}
Business relevance: ${opportunity.business_relevance}/100
Evidence: ${opportunity.evidence}

Generate a practical, intent-focused brief. Do not pad word count artificially. Recommend word count based on topic complexity and SERP expectations.`,
        system: 'You are an expert SEO strategist creating precise, audience-first content briefs.'
      });

      return {
        primary_keyword: opportunity.keyword,
        secondary_keywords: [],
        search_intent: opportunity.search_intent,
        target_audience: object.target_audience,
        content_type: opportunity.content_type,
        recommended_title: object.recommended_title,
        h1: object.h1,
        h2_h3_structure: object.h2_h3_structure,
        questions_to_answer: object.questions_to_answer,
        important_entities: object.important_entities,
        competitor_observations: object.competitor_observations,
        content_gaps: object.content_gaps,
        internal_linking_opportunities: object.internal_linking_opportunities,
        recommended_word_count_min: object.recommended_word_count_min,
        recommended_word_count_max: object.recommended_word_count_max,
        cta_recommendation: object.cta_recommendation,
      };
    } catch (error) {
      // Fallback structured brief
      return {
        primary_keyword: opportunity.keyword,
        secondary_keywords: [],
        search_intent: opportunity.search_intent,
        target_audience: 'SaaS founders and marketing teams',
        content_type: opportunity.content_type,
        recommended_title: `${opportunity.keyword.charAt(0).toUpperCase() + opportunity.keyword.slice(1)}: Complete Guide`,
        h1: opportunity.keyword.charAt(0).toUpperCase() + opportunity.keyword.slice(1),
        h2_h3_structure: [
          { level: 'h2', heading: 'What Is It?', notes: 'Define the core concept clearly.' },
          { level: 'h2', heading: 'Why It Matters', notes: 'Explain business impact for SaaS.' },
          { level: 'h2', heading: 'How To Get Started', notes: 'Step-by-step actionable guide.' },
          { level: 'h3', heading: 'Common Mistakes to Avoid', notes: 'Address audience pain points.' },
          { level: 'h2', heading: 'Next Steps', notes: 'CTA to product.' },
        ],
        questions_to_answer: [
          `What is ${opportunity.keyword}?`,
          `Why does ${opportunity.keyword} matter for SaaS companies?`,
          `How do I get started with ${opportunity.keyword}?`,
        ],
        important_entities: ['SaaS', 'SEO', 'organic traffic', 'search intent'],
        competitor_observations: 'Competitors cover this topic broadly. Opportunity to go more specific and actionable.',
        content_gaps: 'No existing resource addresses this specifically for SaaS companies.',
        internal_linking_opportunities: ['/features', '/pricing', '/blog'],
        recommended_word_count_min: 900,
        recommended_word_count_max: 1500,
        cta_recommendation: 'Start your free trial of the AI SEO Agent.',
      };
    }
  }
}
