import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({
        competitors: [],
        threats: [],
        gaps: [],
        kpis: { tracked_competitors: 0, keyword_overlap: 0, content_gaps: 0, serp_threats: 0 }
      });
    }

    const supabase = await createClient();

    // 1. Fetch real competitors for this website
    const { data: competitors, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('website_id', websiteId)
      .order('overlap_score', { ascending: false });

    if (compError) throw compError;

    // 2. Fetch real threats
    const { data: threats, error: threatError } = await supabase
      .from('competitor_threats')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (threatError) throw threatError;

    // 3. Fetch real content gaps
    const { data: gaps, error: gapError } = await supabase
      .from('content_gaps')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (gapError) throw gapError;

    // Calculate aggregated KPIs from actual stored database records
    const trackedCount = competitors?.length || 0;
    const totalOverlapKeywords = (competitors || []).reduce((acc, c) => acc + (c.overlap_keywords || 0), 0);
    const gapsCount = gaps?.length || 0;
    const threatsCount = threats?.filter(t => t.status === 'active')?.length || 0;

    return NextResponse.json({
      competitors: competitors || [],
      threats: threats || [],
      gaps: gaps || [],
      kpis: {
        tracked_competitors: trackedCount,
        keyword_overlap: totalOverlapKeywords,
        content_gaps: gapsCount,
        serp_threats: threatsCount,
      }
    });
  } catch (error: any) {
    console.error('[Competitors GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load competitors' }, { status: 500 });
  }
}
