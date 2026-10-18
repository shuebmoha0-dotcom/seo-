import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface StrikeDistanceOpportunity {
  keyword: string;
  current_position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  page_url?: string;
  traffic_upside: number; // estimated monthly clicks if moved to top 3
  opportunity_level: 'immediate_win' | 'high_leverage' | 'steady_gain';
  prescription: string;
  action_type: 'update_title_h1' | 'expand_supporting_depth' | 'add_internal_links' | 'add_faq_schema';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    // 1. Fetch website
    const { data: website, error: webErr } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (webErr || !website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 2. Fetch keyword rankings from database
    const { data: keywordsRows } = await supabase
      .from('keywords')
      .select('*')
      .eq('website_id', website_id);

    // 3. Check for GSC performance data in project_memory or integrations
    const { data: gscMemory } = await supabase
      .from('project_memory')
      .select('content')
      .eq('website_id', website_id)
      .eq('category', 'search_console_performance')
      .maybeSingle();

    let strikeDistanceKws: StrikeDistanceOpportunity[] = [];

    // Process keywords from database
    for (const kw of (keywordsRows || [])) {
      const pos = kw.current_position || kw.baseline_position;
      const impressions = kw.impressions || (kw.search_volume ? Math.round(kw.search_volume * 0.7) : 0);
      const clicks = kw.clicks || 0;

      // Strike distance: Page 2 or bottom of Page 1 (positions 7.5 to 25.0)
      if (pos && pos >= 7.5 && pos <= 25.0) {
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 1.5;
        // If moved to Top 3 (avg 18% CTR):
        const potentialClicks = Math.round(impressions * 0.18);
        const upside = Math.max(0, potentialClicks - clicks);

        let prescription = 'Update primary H1 heading and title tag to include exact target entity.';
        let action_type: StrikeDistanceOpportunity['action_type'] = 'update_title_h1';

        if (pos >= 15.0) {
          prescription = 'Add 2 dedicated H2 sections answering core questions and add 3 internal links from high-authority pages.';
          action_type = 'expand_supporting_depth';
        } else if (ctr < 2.0 && impressions > 300) {
          prescription = 'High impressions but low CTR: Rewrite meta description with compelling action hook and add FAQ schema markup.';
          action_type = 'add_faq_schema';
        }

        strikeDistanceKws.push({
          keyword: kw.keyword,
          current_position: Number(pos.toFixed(1)),
          impressions,
          clicks,
          ctr: Number(ctr.toFixed(1)),
          page_url: kw.landing_page || undefined,
          traffic_upside: upside,
          opportunity_level: pos <= 12.0 ? 'immediate_win' : pos <= 18.0 ? 'high_leverage' : 'steady_gain',
          prescription,
          action_type,
        });
      }
    }

    // If GSC memory exists, parse additional queries
    if (gscMemory?.content) {
      try {
        const parsed = JSON.parse(gscMemory.content);
        if (Array.isArray(parsed.queries)) {
          for (const q of parsed.queries) {
            const pos = q.position;
            const impressions = q.impressions || 0;
            const clicks = q.clicks || 0;
            if (pos >= 7.5 && pos <= 25.0 && !strikeDistanceKws.some(k => k.keyword.toLowerCase() === q.query.toLowerCase())) {
              const ctr = impressions > 0 ? (clicks / impressions) * 100 : 1.2;
              const upside = Math.max(0, Math.round(impressions * 0.18) - clicks);
              strikeDistanceKws.push({
                keyword: q.query,
                current_position: Number(pos.toFixed(1)),
                impressions,
                clicks,
                ctr: Number(ctr.toFixed(1)),
                page_url: q.page,
                traffic_upside: upside,
                opportunity_level: pos <= 12.0 ? 'immediate_win' : 'high_leverage',
                prescription: 'Strike-distance query from Google Search Console. Optimize content entity density to jump to Page 1.',
                action_type: 'update_title_h1',
              });
            }
          }
        }
      } catch {}
    }

    // Sort by highest traffic upside
    strikeDistanceKws.sort((a, b) => b.traffic_upside - a.traffic_upside);

    return NextResponse.json({
      success: true,
      website_domain: website.domain,
      total_strike_distance_keywords: strikeDistanceKws.length,
      potential_monthly_traffic_gain: strikeDistanceKws.reduce((acc, k) => acc + k.traffic_upside, 0),
      quick_wins: strikeDistanceKws,
    });
  } catch (error: any) {
    console.error('[Quick Wins GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to calculate strike-distance quick wins' }, { status: 500 });
  }
}
