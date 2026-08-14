import { NextResponse } from 'next/server';
import { ContentAgent } from '@/lib/agent/contentAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, primary_keyword, secondary_keywords, search_intent, content_type, target_audience, working_title, competitor_gaps, internal_linking_opportunities, entities, revision_notes, rules } = body;

    if (!primary_keyword || !search_intent) {
      return NextResponse.json({ error: 'primary_keyword and search_intent are required' }, { status: 400 });
    }

    const agent = new ContentAgent();

    const defaultRules = {
      word_count_min: rules?.word_count_min || 900,
      word_count_max: rules?.word_count_max || 1500,
      language: rules?.language || 'U.S. English',
      tone: rules?.tone || 'Professional, natural, helpful',
      audience: rules?.audience || target_audience || 'SaaS founders and marketing teams',
      author_style: rules?.author_style || 'Experienced SEO content writer',
      structure_rules: rules?.structure_rules || 'Use H2 and H3 headings. Short paragraphs.',
      paragraph_style: rules?.paragraph_style || 'Short and easy to read.',
      image_rules: rules?.image_rules || 'Include relevant original images.',
      source_rules: rules?.source_rules || 'Use reliable sources. Verify factual claims.',
      brand_rules: rules?.brand_rules || 'Do not make unsupported claims.',
      cta_rules: rules?.cta_rules || 'Include one relevant CTA.',
      avoid_rules: rules?.avoid_rules || 'No keyword stuffing. No filler. No robotic language.',
      custom_rules: rules?.custom_rules || '',
    };

    const output = await agent.runFullPipeline({
      primary_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent,
      content_type: content_type || 'blog_article',
      target_audience: target_audience || 'SaaS founders and marketing teams',
      working_title,
      competitor_gaps,
      internal_linking_opportunities: internal_linking_opportunities || [],
      entities: entities || [],
      rules: defaultRules,
    }, revision_notes);

    // Persist draft to Supabase
    const supabase = await createClient();
    if (website_id) {
      const { data: draft } = await supabase
        .from('content_drafts')
        .insert({
          website_id,
          primary_keyword,
          secondary_keywords: secondary_keywords || [],
          search_intent,
          content_type: content_type || 'blog_article',
          target_audience,
          working_title: output.working_title,
          h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
          content_body: output.content_body,
          word_count: output.word_count,
          reading_time_minutes: output.reading_time_minutes,
          seo_title: output.seo_title,
          meta_description: output.meta_description,
          url_slug: output.url_slug,
          status: output.status,
          current_version: 1,
        })
        .select()
        .single();

      if (draft) {
        // Save version
        await supabase.from('content_versions').insert({
          draft_id: draft.id,
          version_number: 1,
          content_body: output.content_body,
          word_count: output.word_count,
          status: output.status,
          qa_results: output.qa,
        });

        // Save QA results
        await supabase.from('content_qa_results').insert({
          draft_id: draft.id,
          version_number: 1,
          ...output.qa,
          facts_flagged: output.qa.facts_flagged,
        });

        // Save image requirements
        for (const img of output.images) {
          await supabase.from('content_images').insert({
            draft_id: draft.id,
            ...img,
          });
        }
      }
    }

    return NextResponse.json({ success: true, output });
  } catch (error: any) {
    console.error('Content draft error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
