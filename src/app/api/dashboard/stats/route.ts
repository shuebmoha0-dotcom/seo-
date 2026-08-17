import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({
        stats: {
          tracked_keywords: 0,
          crawled_pages: 0,
          technical_issues: 0,
          pending_approvals: 0,
          tracked_competitors: 0,
          health_score: null,
        },
        recent_approvals: [],
        chart_data: [],
      });
    }

    const supabase = await createClient();

    // 1. Count Tracked Keywords
    const { count: keywordCount } = await supabase
      .from('keywords')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId);

    // 2. Count Crawled Pages
    const { count: pagesCount } = await supabase
      .from('pages')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId);

    // 3. Count Technical Issues
    const { count: issuesCount } = await supabase
      .from('technical_issues')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId)
      .eq('status', 'open');

    // 4. Count Pending Approvals
    const { data: approvals } = await supabase
      .from('seo_opportunities')
      .select('*')
      .eq('website_id', websiteId)
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. Count Competitors
    const { count: competitorsCount } = await supabase
      .from('competitors')
      .select('*', { count: 'exact', head: true })
      .eq('website_id', websiteId);

    // 6. Search Console Performance Data (if any)
    const { data: gscRows } = await supabase
      .from('search_console_data')
      .select('date, clicks, impressions')
      .eq('website_id', websiteId)
      .order('date', { ascending: true })
      .limit(30);

    const chartData = (gscRows || []).map(r => ({
      date: r.date,
      traffic: r.clicks || 0,
      impressions: r.impressions || 0,
    }));

    return NextResponse.json({
      stats: {
        tracked_keywords: keywordCount || 0,
        crawled_pages: pagesCount || 0,
        technical_issues: issuesCount || 0,
        pending_approvals: approvals?.length || 0,
        tracked_competitors: competitorsCount || 0,
        health_score: issuesCount !== null && issuesCount !== undefined ? Math.max(20, 100 - (issuesCount || 0) * 5) : null,
      },
      recent_approvals: approvals || [],
      chart_data: chartData,
    });
  } catch (error: any) {
    console.error('[Dashboard Stats GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
