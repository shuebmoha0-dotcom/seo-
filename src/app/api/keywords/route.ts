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
    const body = await request.json();
    const { website_id, seed_topic, mode } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    // 1. Fetch project memory & custom instructions
    let projectMemory = '';
    let projectInstructions = '';
    try {
      const { data: memData } = await supabase
        .from('project_memory')
        .select('*')
        .or(`website_id.eq.${website_id},website_id.is.null`)
        .eq('is_outdated', false);

      if (memData) {
        const customInstrRow = memData.find((m: any) => m.source === 'project_custom_instructions');
        const knowledgeBankRow = memData.find((m: any) => m.source === 'project_knowledge_bank');
        if (customInstrRow?.content) projectInstructions = customInstrRow.content;
        if (knowledgeBankRow?.content) projectMemory = knowledgeBankRow.content;
      }
    } catch {}

    const agent = new KeywordAgent();

    // 2. Run AI-driven topical clustering and discovery
    const { clusters, opportunities } = await agent.discoverOpportunities({
      domain: website.domain,
      seedTopic: seed_topic,
      projectMemory,
      projectInstructions,
      mode: mode || 'new',
    });

    // 3. Save clusters and opportunities to Supabase
    for (const c of clusters) {
      const { data: clusterRow } = await supabase
        .from('keyword_clusters')
        .insert({
          website_id,
          cluster_name: c.name,
          primary_keyword: c.primary_keyword,
          secondary_keywords: c.secondary_keywords,
          search_intent: c.search_intent,
          recommended_content_type: c.recommended_content_type,
          status: 'discovered',
        })
        .select('id')
        .single();

      const clusterId = clusterRow?.id;

      // Save opportunities for this cluster
      for (const op of c.opportunities) {
        await supabase.from('keyword_opportunities').insert({
          website_id,
          cluster_id: clusterId || null,
          keyword: op.keyword,
          is_primary: op.is_primary,
          search_intent: op.search_intent,
          content_type: op.content_type,
          search_volume: op.search_volume,
          keyword_difficulty: op.keyword_difficulty,
          business_relevance: op.business_relevance,
          competition: op.competition,
          recommended_action: op.recommended_action,
          priority: op.priority,
          confidence: op.confidence,
          evidence: op.evidence,
          status: 'pending',
        });

        // Also upsert to raw keywords table for quick tracking
        await supabase.from('keywords').upsert({
          website_id,
          term: op.keyword,
          intent: op.search_intent,
          difficulty: op.keyword_difficulty ? String(op.keyword_difficulty) : op.competition,
          volume: op.search_volume || 0,
        }, { onConflict: 'website_id,term' });
      }
    }

    return NextResponse.json({ success: true, clusters, opportunities });
  } catch (error: any) {
    console.error('[Keywords POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
