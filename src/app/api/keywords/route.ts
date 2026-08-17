import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { KeywordAgent } from '@/lib/agent/keywordAgent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ clusters: [], raw_keywords: [] });
    }

    const supabase = await createClient();

    // 1. Fetch Clusters
    const { data: clusters } = await supabase
      .from('keyword_clusters')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    // 2. Fetch Opportunities
    const { data: opps } = await supabase
      .from('keyword_opportunities')
      .select('*')
      .eq('website_id', websiteId)
      .order('business_relevance', { ascending: false });

    // 3. Fetch Raw Keywords
    const { data: rawKws } = await supabase
      .from('keywords')
      .select('*')
      .eq('website_id', websiteId)
      .order('volume', { ascending: false });

    return NextResponse.json({
      clusters: clusters || [],
      opportunities: opps || [],
      raw_keywords: rawKws || [],
    });
  } catch (error: any) {
    console.error('[Keywords GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { website_id, seed_topic } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url, project_id')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const cleanTopic = seed_topic || website.domain.split('.')[0].replace(/[-_]/g, ' ');
    const agent = new KeywordAgent();

    // Generate real opportunities
    const opportunities = agent.generateNewSiteOpportunities('saas', cleanTopic);

    // Save to keywords & opportunities tables
    for (const op of opportunities) {
      await supabase.from('keywords').upsert({
        website_id,
        term: op.keyword,
        intent: op.search_intent,
        difficulty: op.competition,
        volume: op.search_volume || 0,
      }, { onConflict: 'website_id,term' });
    }

    return NextResponse.json({ success: true, opportunities });
  } catch (error: any) {
    console.error('[Keywords POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
