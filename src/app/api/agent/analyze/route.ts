import { NextResponse } from 'next/server';
import { ReasoningEngine } from '@/lib/agent/reasoning';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id } = await request.json();
    const supabase = await createClient();

    // 1. Create Agent Run
    const { data: run } = await supabase
      .from('agent_runs')
      .insert({ website_id, status: 'running', started_at: new Date().toISOString() })
      .select()
      .single();

    // 2. Fetch pages for website
    const { data: pages } = await supabase
      .from('pages')
      .select('*')
      .eq('website_id', website_id);

    // 3. Fetch GSC data
    const { data: gscData } = await supabase
      .from('search_console_data')
      .select('*')
      .eq('website_id', website_id);

    const reasoning = new ReasoningEngine();
    const allOpportunities = [];

    // Analyze each crawled page
    if (pages && pages.length > 0) {
      for (const page of pages) {
        const pageGsc = (gscData || []).filter(g => g.page_id === page.id);
        const opportunities = await reasoning.analyzePageAndMetrics(
          {
            url: page.path,
            title: page.title,
            meta_description: page.meta_description,
            h1: page.h1 ? [page.h1] : [],
            h2: [],
            h3: [],
            body_text: '',
            canonical: page.canonical_url,
            robots_directives: page.indexability_signals?.directives || null,
            internal_links: [],
            external_links: [],
            images: [],
            http_status: page.status_code || 200,
            is_indexable: page.indexability_signals?.is_indexable ?? true
          },
          pageGsc,
          {}
        );

        for (const opp of opportunities) {
          const { data: oppRecord } = await supabase
            .from('seo_opportunities')
            .insert({
              website_id,
              page_id: page.id,
              agent_run_id: run?.id,
              problem: opp.problem,
              evidence: opp.evidence,
              recommended_action: opp.recommended_action,
              expected_impact: opp.expected_impact,
              confidence: opp.confidence,
              effort: opp.effort,
              risk: opp.risk,
              priority: opp.priority,
              status: 'pending_approval'
            })
            .select()
            .single();

          allOpportunities.push(oppRecord);
        }
      }
    }

    // Mark run complete
    if (run) {
      await supabase
        .from('agent_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', run.id);
    }

    return NextResponse.json({ success: true, opportunities: allOpportunities });
  } catch (error: any) {
    console.error('Error running agent analysis:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
