import { LLMProvider } from '../tools/llm';

import { z } from 'zod';
import { SEOOpportunity, GenericAction } from './types';

/**
 * The Internal Linking Agent is responsible for analyzing the website's
 * internal link structure, finding orphans, and distributing link equity
 * contextually to build topical authority.
 */
export class InternalLinkingAgent {
  /**
   * Analyzes a list of pages to find orphans (pages with 0 or very few incoming links)
   */
  async detectOrphanPages(siteGraph: { url: string; incoming_links: number; title: string; content_summary: string }[]) {
    console.log('[InternalLinkingAgent] Detecting orphan pages...');
    
    const orphans = siteGraph.filter(p => p.incoming_links < 2);
    if (orphans.length === 0) return [];

    const { object } = await LLMProvider.generateObject({
      agent: 'InternalLinkingAgent',
      
      
      schema: z.object({
        recommendations: z.array(z.object({
          orphan_url: z.string(),
          recommended_source_url: z.string(),
          suggested_anchor: z.string(),
          reason: z.string()
        }))
      }),
      prompt: `
        You are an expert SEO Internal Linking Agent.
        The following pages on the website are "orphans" or weakly connected (very few incoming internal links).
        Review the site graph and recommend ONE high-quality, contextually relevant source page to link TO each orphan.
        Do NOT recommend linking just for the sake of it—only if it makes topical sense.
        
        Orphans: ${JSON.stringify(orphans)}
        Full Site Graph context: ${JSON.stringify(siteGraph.slice(0, 50))} // truncated for prompt limits
      `
    });

    return object.recommendations;
  }

  /**
   * Discovers contextual link opportunities between established articles, 
   * pillar pages, and product pages.
   */
  async findLinkOpportunities(
    sourceContent: { url: string; title: string; text: string },
    targetPages: { url: string; title: string; topic: string }[]
  ): Promise<SEOOpportunity[]> {
    console.log(`[InternalLinkingAgent] Finding link opportunities for ${sourceContent.url}`);

    const { object } = await LLMProvider.generateObject({
      agent: 'InternalLinkingAgent',
      
      
      schema: z.object({
        opportunities: z.array(z.object({
          target_url: z.string(),
          suggested_anchor: z.string(),
          placement_context: z.string(),
          reason: z.string(),
          expected_impact: z.string(),
          confidence: z.enum(['high', 'medium', 'low']),
          priority: z.enum(['high', 'medium', 'low'])
        }))
      }),
      prompt: `
        You are an expert SEO Internal Linking Agent.
        Analyze the provided SOURCE content and find organic, contextually relevant places 
        to add internal links pointing to the TARGET pages.
        
        Rules:
        - Relevance and usefulness come first.
        - Generate natural, descriptive anchor text. No "click here".
        - Do not keyword stuff.
        - Ensure the link reflects actual topic relationships.
        
        Source Page: ${sourceContent.url}
        Source Title: ${sourceContent.title}
        Source Content Snippet: ${sourceContent.text.substring(0, 3000)}
        
        Available Target Pages:
        ${JSON.stringify(targetPages)}
      `
    });

    return object.opportunities.map((opp: any) => ({
      problem: `Page lacks optimal internal link to ${opp.target_url}`,
      evidence: `Contextually relevant mention found in text: "${opp.placement_context}"`,
      recommended_action: `Add internal link to ${opp.target_url} using anchor text "${opp.suggested_anchor}"`,
      expected_impact: opp.expected_impact,
      confidence: opp.confidence,
      effort: 'low',
      risk: 'low',
      priority: opp.priority
    }));
  }

  /**
   * Prepares the technical action payload for an approved internal link
   */
  prepareAction(
    sourceUrl: string, 
    targetUrl: string, 
    anchorText: string, 
    placementContext: string
  ): GenericAction {
    return {
      type: 'add_internal_link',
      target_url: sourceUrl,
      payload: {
        target_href: targetUrl,
        anchor_text: anchorText,
        placement_context: placementContext
      }
    };
  }
}
