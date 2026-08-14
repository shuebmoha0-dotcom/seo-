import { NextResponse } from 'next/server';
import { OnPageSEOAgent } from '@/lib/agent/onPageAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      website_id, url, target_keyword, secondary_keywords,
      search_intent, content_type, page_data, existing_website_pages,
      project_instructions, project_memory,
    } = body;

    if (!url || !target_keyword) {
      return NextResponse.json({ error: 'url and target_keyword are required' }, { status: 400 });
    }

    const agent = new OnPageSEOAgent();

    // Build page data — use provided data or create minimal stub for demo
    const page = page_data || {
      url,
      title: '',
      meta_description: '',
      h1: '',
      h2s: [],
      h3s: [],
      content_body: '',
      word_count: 0,
      images: [],
      internal_links: [],
    };

    const result = await agent.analyze({
      page,
      target_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent: search_intent || 'informational',
      content_type: content_type || 'blog_article',
      existing_website_pages: existing_website_pages || [],
      project_instructions,
      project_memory,
    });

    // Persist to Supabase
    const supabase = await createClient();
    if (website_id) {
      const { data: analysis } = await supabase
        .from('on_page_analyses')
        .insert({
          website_id,
          url,
          page_title: page.title,
          meta_description: page.meta_description,
          h1: page.h1,
          h2s: page.h2s,
          h3s: page.h3s,
          word_count: page.word_count,
          canonical_url: page.canonical_url,
          target_keyword,
          secondary_keywords: secondary_keywords || [],
          search_intent,
          content_type,
          intent_alignment_score: result.diagnostic_scores.intent_alignment,
          content_coverage_score: result.diagnostic_scores.content_coverage,
          technical_score: result.diagnostic_scores.technical,
          metadata_score: result.diagnostic_scores.metadata,
          linking_score: result.diagnostic_scores.linking,
          overall_diagnostic: result.diagnostic_scores.overall,
          existing_schema: page.existing_schema || null,
          status: result.status === 'pass' ? 'ready' : 'needs_content_agent',
          requires_content_agent: result.content_agent_task.triggered,
          requires_image_agent: result.image_agent_task.triggered,
        })
        .select()
        .single();

      if (analysis) {
        // Save recommendations
        for (const rec of result.recommendations) {
          await supabase.from('on_page_recommendations').insert({
            analysis_id: analysis.id,
            ...rec,
          });
        }

        // Save QA
        await supabase.from('on_page_qa').insert({
          analysis_id: analysis.id,
          ...result.qa,
        });
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('On-page analysis error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
