import { LLMProvider } from '../tools/llm';

import { z } from 'zod';
import { CrawledPageData } from './crawler';
import { SEOOpportunity, Priority, Confidence, Effort, Risk } from './types';

export class ReasoningEngine {
  
  // Zod schema matching the SEOOpportunity interface
  private static opportunitySchema = z.object({
    problem: z.string().describe("The core SEO issue identified on the page."),
    evidence: z.string().describe("Data backing up the problem (e.g. 'Average position 6.2, Impressions 18,400, CTR 1.4%')"),
    recommended_action: z.string().describe("The specific action to take (e.g. 'Test a stronger title and meta description aligned with search intent')"),
    expected_impact: z.string().describe("What we expect to happen if implemented (e.g. 'Increased CTR and bump to position 3-4')"),
    confidence: z.enum(['high', 'medium', 'low']).describe("Confidence that this action will have the expected impact"),
    effort: z.enum(['high', 'medium', 'low']).describe("Development/implementation effort required"),
    risk: z.enum(['high', 'medium', 'low']).describe("Risk of negative SEO impact if it backfires"),
    priority: z.enum(['high', 'medium', 'low']).describe("Overall priority to assign to this task")
  });

  async analyzePageAndMetrics(
    page: CrawledPageData, 
    gscData: any, // Typed properly in a full app
    keywordData: any
  ): Promise<SEOOpportunity[]> {
    
    // Construct the prompt context
    const context = `
      You are an elite, senior SEO architect analyzing a SaaS website page.
      
      URL: ${page.url}
      Title: ${page.title || 'None'}
      Meta Description: ${page.meta_description || 'None'}
      H1: ${page.h1.join(', ') || 'None'}
      Is Indexable: ${page.is_indexable}
      
      Google Search Console Data:
      ${JSON.stringify(gscData, null, 2)}
      
      Keyword/SERP Data:
      ${JSON.stringify(keywordData, null, 2)}
      
      Analyze the provided data. Does this page have high impressions but low CTR? Does it rank on page 2 (positions 11-20)? 
      Is the title poorly optimized? 
      
      Decide what is actually worth doing. Do not just list trivial problems. Provide concrete, highly impactful SEO recommendations.
      If the page is performing perfectly, you can return an empty array.
    `;

    try {
      const { object } = await LLMProvider.generateObject({
      agent: 'Reasoning',
      
         // Or any other model
        schema: z.object({
          opportunities: z.array(ReasoningEngine.opportunitySchema)
        }),
        prompt: context,
        system: "You are an autonomous SEO agent. Make strategic, data-driven decisions. Only suggest changes if the evidence supports a positive ROI."
      });

      return object.opportunities as SEOOpportunity[];
    } catch (error) {
      console.error('Failed to generate SEO opportunities:', error);
      throw error;
    }
  }
}
