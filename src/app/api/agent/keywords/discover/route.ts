import { NextResponse } from 'next/server';
import { KeywordAgent } from '@/lib/agent/keywordAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id, site_description, page_count, monthly_traffic, mode } = await request.json();

    const agent = new KeywordAgent();
    const { maturity, siteType } = agent.detectContext({
      pageCount: page_count || 84,
      monthlyTraffic: monthly_traffic || 18247,
      gscDataAvailable: mode === 'established',
      siteDescription: site_description || 'SaaS project management software platform',
    });

    let opportunities;
    if (maturity === 'new') {
      opportunities = agent.generateNewSiteOpportunities(siteType, site_description || '');
    } else {
      // Simulated GSC data for established site
      opportunities = agent.findSearchConsoleQuickWins([
        { query: 'project management software', impressions: 18400, clicks: 258, ctr: 0.014, position: 6.2, page: '/features' },
        { query: 'best project management tools', impressions: 12600, clicks: 176, ctr: 0.014, position: 8.4, page: '/blog/best-tools' },
        { query: 'ai seo agent', impressions: 4200, clicks: 48, ctr: 0.011, position: 7.1, page: '/' },
        { query: 'autonomous seo tool', impressions: 2800, clicks: 28, ctr: 0.010, position: 11.3, page: '/' },
      ]);
    }

    opportunities = agent.detectCannibalization(opportunities);

    // Persist to Supabase if website_id provided
    const supabase = await createClient();
    if (website_id) {
      for (const op of opportunities) {
        await supabase.from('keyword_opportunities').insert({
          website_id,
          keyword: op.keyword,
          is_primary: op.is_primary,
          search_intent: op.search_intent,
          content_type: op.content_type,
          search_volume: op.search_volume,
          keyword_difficulty: op.keyword_difficulty,
          business_relevance: op.business_relevance,
          competition: op.competition,
          current_position: op.current_position,
          current_url: op.existing_url,
          recommended_action: op.recommended_action,
          priority: op.priority,
          confidence: op.confidence,
          evidence: op.evidence,
          cannibalization_warning: op.cannibalization_warning,
          cannibalization_competing_url: op.cannibalization_competing_url || null,
          data_available: op.search_volume !== null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      maturity,
      site_type: siteType,
      total_opportunities: opportunities.length,
      opportunities,
    });
  } catch (error: any) {
    console.error('Keyword discovery error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
