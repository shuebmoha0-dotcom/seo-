import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { KeywordResearchAgent } from '@/lib/agent/keywordAgent';
import { serp_analysis_tool } from '@/lib/tools/dataforseo';

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
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
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
    const agent = new KeywordResearchAgent();

    // Generate real clusters
    const result = await agent.runFullResearch({
      website_id,
      company_description: `Business and services for ${website.domain}`,
      core_product: cleanTopic,
      target_audience: 'searchers looking for solutions on ' + website.domain,
      primary_topics: [cleanTopic, `${cleanTopic} software`, `how to use ${cleanTopic}`],
      stage: 'phase1_foundation',
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[Keywords POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
