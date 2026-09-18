import { NextResponse } from 'next/server';
import { KeywordAgent } from '@/lib/agent/keywordAgent';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

async function getSupabase() {
  try {
    return await createClient();
  } catch {
    return createAdminClient();
  }
}

export async function POST(request: Request) {
  try {
    const { website_id, site_description, page_count, monthly_traffic, mode } = await request.json();

    const supabase = await getSupabase();
    const agent = new KeywordAgent();

    let siteDomain = '';
    let siteUrl = '';
    let siteProfile: any = null;

    if (website_id) {
      const { data: web } = await supabase
        .from('websites')
        .select('domain, url')
        .eq('id', website_id)
        .maybeSingle();

      if (web) {
        siteDomain = web.domain;
        siteUrl = web.url || `https://${web.domain}`;
        siteProfile = await SiteNicheProfiler.profileSite({
          websiteId: website_id,
          domain: siteDomain,
          siteUrl,
        });
      }
    }

    const effectivePageCount = page_count ?? siteProfile?.authorityMetrics?.pageCount ?? 0;
    const effectiveTraffic = monthly_traffic ?? siteProfile?.authorityMetrics?.gscImpressions ?? 0;
    const effectiveDescription = site_description || siteProfile?.primaryNiche || siteDomain;

    const { maturity, siteType } = agent.detectContext({
      pageCount: effectivePageCount,
      monthlyTraffic: effectiveTraffic,
      gscDataAvailable: mode === 'established' || siteProfile?.authorityTier === 'established',
      siteDescription: effectiveDescription,
    });

    let opportunities: any[] = [];

    // If established and website_id is provided, check for REAL Search Console data
    if ((maturity === 'established' || mode === 'established') && website_id) {
      const { data: gscData } = await supabase
        .from('search_console_data')
        .select('query, impressions, clicks, ctr, position, page')
        .eq('website_id', website_id)
        .order('impressions', { ascending: false })
        .limit(100);

      if (gscData && gscData.length > 0) {
        opportunities = agent.findSearchConsoleQuickWins(
          gscData.map((d: any) => ({
            query: d.query,
            impressions: Number(d.impressions) || 0,
            clicks: Number(d.clicks) || 0,
            ctr: Number(d.ctr) || (d.impressions > 0 ? (d.clicks / d.impressions) : 0),
            position: Number(d.position) || 10,
            page: d.page || '/',
          }))
        );
      }
    }

    // If no opportunities from GSC (or new site), generate targeted opportunities for the site's exact niche
    if (opportunities.length === 0) {
      opportunities = agent.generateNewSiteOpportunities(siteType, effectiveDescription, siteProfile || undefined);
    }

    opportunities = agent.detectCannibalization(opportunities);

    // Persist to Supabase if website_id provided
    if (website_id && opportunities.length > 0) {
      for (const op of opportunities) {
        try {
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
        } catch (insertErr) {
          console.warn('[Keywords Discover] Insert warning:', insertErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      maturity,
      site_type: siteType,
      site_niche: siteProfile?.primaryNiche || effectiveDescription,
      total_opportunities: opportunities.length,
      opportunities,
    });
  } catch (error: any) {
    console.error('Keyword discovery error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
