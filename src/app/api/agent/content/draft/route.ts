import { NextResponse } from 'next/server';
import { ContentAgent } from '@/lib/agent/contentAgent';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let websiteId = searchParams.get('website_id');

    const supabase = await createClient();

    // If websiteId is missing, resolve the first active website
    if (!websiteId) {
      const { data: firstSite } = await supabase
        .from('websites')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (firstSite) {
        websiteId = firstSite.id;
      }
    }

    if (!websiteId) {
      return NextResponse.json({ drafts: [] });
    }

    const { data: drafts, error } = await supabase
      .from('content_drafts')
      .select(`
        *,
        content_versions (*),
        content_qa_results (*),
        content_images (*)
      `)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedDrafts = (drafts || []).map((d: any) => ({
      id: d.id,
      working_title: d.working_title,
      primary_keyword: d.primary_keyword,
      search_intent: d.search_intent,
      content_type: d.content_type,
      word_count: d.word_count || 0,
      reading_time: d.reading_time_minutes || 0,
      status: d.status || 'ready_for_approval',
      version: d.current_version || 1,
      seo_title: d.seo_title,
      meta_description: d.meta_description,
      url_slug: d.url_slug,
      content_body: d.content_body,
      qa: d.content_qa_results?.[0] || null,
      images: d.content_images || [],
    }));

    return NextResponse.json({ drafts: formattedDrafts });
  } catch (error: any) {
    console.error('[Content Draft GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let {
      website_id,
      primary_keyword,
      secondary_keywords,
      search_intent,
      content_type,
      target_audience,
      working_title,
      competitor_gaps,
      internal_linking_opportunities,
      entities,
      revision_notes,
      rules,
    } = body;

    if (!primary_keyword) {
      return NextResponse.json({ error: 'primary_keyword is required' }, { status: 400 });
    }

    // Auto-default search intent if omitted by user
    if (!search_intent) {
      const lower = primary_keyword.toLowerCase();
      if (lower.includes('best') || lower.includes('vs') || lower.includes('review') || lower.includes('top')) {
        search_intent = 'commercial';
      } else if (lower.includes('buy') || lower.includes('price') || lower.includes('pricing') || lower.includes('discount')) {
        search_intent = 'transactional';
      } else {
        search_intent = 'informational';
      }
    }

    const supabase = await createClient();

    // Auto-resolve website_id if not provided from UI
    if (!website_id) {
      const { data: firstSite } = await supabase
        .from('websites')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (firstSite) {
        website_id = firstSite.id;
      }
    }

    const agent = new ContentAgent();

    const defaultRules = {
      word_count_min: rules?.word_count_min || 900,
      word_count_max: rules?.word_count_max || 1500,
      language: rules?.language || 'U.S. English',
      tone: rules?.tone || 'Professional, natural, helpful',
      audience: rules?.audience || target_audience || 'Business founders and search audience',
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

    // Auto-load Project Memory & Custom Instructions from Supabase
    let projectInstructions = body.project_instructions || '';
    let projectMemory = body.project_memory || '';

    if (website_id) {
      try {
        const { data: memoryData } = await supabase
          .from('project_memory')
          .select('*')
          .eq('website_id', website_id)
          .eq('is_outdated', false)
          .order('is_important', { ascending: false });

        if (memoryData && memoryData.length > 0) {
          const memoryBlocks = memoryData.map((m: any) => `[${m.category.toUpperCase()}] ${m.content}`).join('\n\n');
          projectMemory = projectMemory ? `${projectMemory}\n\n${memoryBlocks}` : memoryBlocks;
        }

        const { data: websiteRules } = await supabase
          .from('content_rules')
          .select('*')
          .eq('website_id', website_id)
          .maybeSingle();

        if (websiteRules?.custom_rules) {
          projectInstructions = projectInstructions
            ? `${projectInstructions}\n\n${websiteRules.custom_rules}`
            : websiteRules.custom_rules;
        }
      } catch (memErr) {
        console.warn('[Content Draft] Memory load error:', memErr);
      }
    }

    const output = await agent.runFullPipeline(
      {
        primary_keyword,
        secondary_keywords: secondary_keywords || [],
        search_intent,
        content_type: content_type || 'blog_article',
        target_audience: target_audience || defaultRules.audience,
        working_title: working_title || undefined,
        competitor_gaps,
        internal_linking_opportunities: internal_linking_opportunities || [],
        entities: entities || [],
        project_instructions: projectInstructions || undefined,
        project_memory: projectMemory || undefined,
        rules: defaultRules,
      },
      revision_notes
    );

    // Persist draft to Supabase
    let savedDraft = null;

    if (website_id) {
      try {
        const { data: draft, error: draftErr } = await supabase
          .from('content_drafts')
          .insert({
            website_id,
            primary_keyword,
            secondary_keywords: secondary_keywords || [],
            search_intent,
            content_type: content_type || 'blog_article',
            target_audience: target_audience || defaultRules.audience,
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

        if (!draftErr && draft) {
          savedDraft = draft;

          // Save version
          try {
            await supabase.from('content_versions').insert({
              draft_id: draft.id,
              version_number: 1,
              content_body: output.content_body,
              word_count: output.word_count,
              status: output.status,
              qa_results: output.qa,
            });
          } catch (vErr) {
            console.warn('[Draft Save] Version insert error:', vErr);
          }

          // Save QA results
          try {
            await supabase.from('content_qa_results').insert({
              draft_id: draft.id,
              version_number: 1,
              ...output.qa,
              facts_flagged: output.qa.facts_flagged,
            });
          } catch (qaErr) {
            console.warn('[Draft Save] QA insert error:', qaErr);
          }

          // Save image requirements safely
          if (Array.isArray(output.images)) {
            for (const img of output.images) {
              try {
                await supabase.from('content_images').insert({
                  draft_id: draft.id,
                  placement_context: img.placement_context || 'Article body',
                  image_type: img.image_type || 'featured',
                  purpose: img.purpose || 'Visual enhancement',
                  alt_text: img.alt_text || '',
                  suggested_filename: img.suggested_filename || 'image.webp',
                  status: img.generation_status || 'created',
                });
              } catch (imgInsertErr) {
                console.warn('[Draft Save] content_images insert skipped:', imgInsertErr);
              }
            }
          }
        }
      } catch (saveError) {
        console.warn('[Draft Save] Draft DB insert error:', saveError);
      }
    }

    return NextResponse.json({
      success: true,
      draft: savedDraft
        ? {
            id: savedDraft.id,
            working_title: savedDraft.working_title,
            primary_keyword: savedDraft.primary_keyword,
            search_intent: savedDraft.search_intent,
            content_type: savedDraft.content_type,
            word_count: savedDraft.word_count,
            reading_time: savedDraft.reading_time_minutes,
            status: savedDraft.status,
            version: savedDraft.current_version,
            seo_title: savedDraft.seo_title,
            meta_description: savedDraft.meta_description,
            url_slug: savedDraft.url_slug,
            content_body: savedDraft.content_body,
            qa: output.qa,
            images: output.images,
          }
        : {
            id: 'temp-' + Date.now(),
            working_title: output.working_title,
            primary_keyword,
            search_intent,
            content_type: content_type || 'blog_article',
            word_count: output.word_count,
            reading_time: output.reading_time_minutes,
            status: output.status,
            version: 1,
            seo_title: output.seo_title,
            meta_description: output.meta_description,
            url_slug: output.url_slug,
            content_body: output.content_body,
            qa: output.qa,
            images: output.images,
          },
    });
  } catch (error: any) {
    console.error('[Content Draft POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
