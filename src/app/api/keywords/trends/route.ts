import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { TrendKeywordDetector } from '@/lib/agent/trendKeywordDetector';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';
import { SiteContentGapDetector } from '@/lib/agent/siteContentGapDetector';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, limit = 6 } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 1. Profile site niche and content footprint
    const siteProfile = await SiteNicheProfiler.profileSite({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    const inventory = await SiteContentGapDetector.getSiteInventory({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
    });

    // 2. Discover real-time trending keyword opportunities
    const trends = await TrendKeywordDetector.discoverTrendingKeywords({
      websiteId: website.id,
      domain: website.domain,
      siteUrl: website.url,
      siteProfile,
      inventory,
      limit,
    });

    return NextResponse.json({
      success: true,
      domain: website.domain,
      trends_count: trends.length,
      trends,
    });
  } catch (error: any) {
    console.error('[Keywords Trends API Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to discover trends' }, { status: 500 });
  }
}
