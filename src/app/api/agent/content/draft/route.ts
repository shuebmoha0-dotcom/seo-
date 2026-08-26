/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
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

    let query = supabase
      .from('content_drafts')
      .select(`
        *,
        content_versions (*),
        content_qa_results (*),
        content_images (*)
      `)
      .order('created_at', { ascending: false });

    if (websiteId) {
      query = query.or(`website_id.eq.${websiteId},website_id.is.null`);
    }

    const { data: drafts, error } = await query;

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
      published_at: d.published_at || (d.status === 'published' ? d.updated_at : undefined),
      wordpress_post_id: d.wordpress_post_id,
      wordpress_post_url: d.wordpress_post_url,
      created_at: d.created_at,
      updated_at: d.updated_at,
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

    // Auto-load Project Memory & Custom Instructions from Supabase (Strict Zero-Duplication)
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
          // 1. Separate custom instructions and knowledge bank from standard facts
          const customInstrRow = memoryData.find((m: any) => m.source === 'project_custom_instructions');
          const knowledgeBankRow = memoryData.find((m: any) => m.source === 'project_knowledge_bank');
          const standardFacts = memoryData.filter(
            (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
          );

          if (!projectInstructions && customInstrRow?.content) {
            projectInstructions = customInstrRow.content;
          }

          if (!projectMemory && knowledgeBankRow?.content) {
            projectMemory = knowledgeBankRow.content;
          }

          // 2. Deduplicate standard facts by content
          if (standardFacts.length > 0) {
            const uniqueFacts = new Set<string>();
            const factBlocks: string[] = [];

            for (const f of standardFacts) {
              const text = f.content?.trim();
              if (text && !uniqueFacts.has(text)) {
                uniqueFacts.add(text);
                factBlocks.push(`[${f.category.toUpperCase()}] ${text}`);
              }
            }

            if (factBlocks.length > 0) {
              projectMemory = projectMemory
                ? `${projectMemory}\n\n${factBlocks.join('\n\n')}`
                : factBlocks.join('\n\n');
            }
          }
        }

        // Fallback to content_rules if custom instructions not yet found
        if (!projectInstructions) {
          const { data: websiteRules } = await supabase
            .from('content_rules')
            .select('custom_rules')
            .eq('website_id', website_id)
            .maybeSingle();

          if (websiteRules?.custom_rules) {
            projectInstructions = websiteRules.custom_rules;
          }
        }
      } catch (memErr) {
        console.warn('[Content Draft] Memory load error:', memErr);
      }
    }

    // Extract word count targets from custom instructions or rules
    const combinedInstructions = `${projectInstructions} ${rules?.custom_rules || ''} ${defaultRules.structure_rules}`;
    const wordRangeMatch = combinedInstructions.match(/(\d{3,5})\s*(?:to|-)\s*(\d{3,5})\s*words/i);
    const wordSingleMatch = combinedInstructions.match(/(?:at least|minimum|min|around|target|should be|approx|approximately)\s*(\d{3,5})\s*words/i) ||
                            combinedInstructions.match(/(\d{3,5})\s*words/i);

    if (wordRangeMatch) {
      defaultRules.word_count_min = parseInt(wordRangeMatch[1], 10);
      defaultRules.word_count_max = parseInt(wordRangeMatch[2], 10);
    } else if (wordSingleMatch && parseInt(wordSingleMatch[1], 10) >= 400) {
      const target = parseInt(wordSingleMatch[1], 10);
      defaultRules.word_count_min = target;
      defaultRules.word_count_max = Math.round(target * 1.35);
    } else if (!rules?.word_count_min) {
      defaultRules.word_count_min = 1200;
      defaultRules.word_count_max = 1800;
    }

    console.log(`[Content Draft] Applying target word count: ${defaultRules.word_count_min} - ${defaultRules.word_count_max} words`);

    // Auto-discover internal links if not provided
    if ((!internal_linking_opportunities || internal_linking_opportunities.length === 0) && website_id) {
      try {
        const { data: existingDrafts } = await supabase
          .from('content_drafts')
          .select('url_slug, seo_title, primary_keyword')
          .eq('website_id', website_id)
          .neq('url_slug', null)
          .limit(15);
          
        if (existingDrafts && existingDrafts.length > 0) {
          internal_linking_opportunities = existingDrafts
            // Don't link to itself if by chance we have the same keyword
            .filter((d: any) => d.primary_keyword !== primary_keyword)
            .map((d: any) => `/${d.url_slug} (Topic: ${d.seo_title || d.primary_keyword})`);
          
          console.log(`[Content Draft] Auto-discovered ${internal_linking_opportunities.length} internal links for context.`);
        }
      } catch (e) {
        console.warn('Failed to auto-fetch internal links', e);
      }
    }

    
    // Determine execution mode (sync for guest/demo, async for registered users)
    if (!website_id) {
      // SYNCHRONOUS EXECUTION
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

      return NextResponse.json({
        success: true,
        draft: {
          id: crypto.randomUUID(),
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
        }
      });
    }

    // ASYNCHRONOUS EXECUTION
    const placeholderDraft = {
      website_id,
      primary_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent,
      content_type: content_type || 'blog_article',
      target_audience: target_audience || defaultRules.audience,
      working_title: working_title || `Generating draft for "${primary_keyword}"...`,
      status: 'writing',
      current_version: 0,
    };

    const { data: savedDraft, error: draftErr } = await supabase
      .from('content_drafts')
      .insert(placeholderDraft)
      .select()
      .single();

    if (draftErr || !savedDraft) {
      throw new Error(draftErr?.message || 'Failed to create placeholder draft');
    }

    after(async () => {
      try {
        console.log(`[Content Draft Async] Starting generation for ${savedDraft.id}`);
        
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

        console.log(`[Content Draft Async] Finished generation for ${savedDraft.id}, updating DB.`);

        await supabase
          .from('content_drafts')
          .update({
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
            updated_at: new Date().toISOString()
          })
          .eq('id', savedDraft.id);

        try {
          await supabase.from('content_versions').insert({
            draft_id: savedDraft.id,
            version_number: 1,
            content_body: output.content_body,
            word_count: output.word_count,
            status: output.status,
            qa_results: output.qa,
          });
        } catch (vErr) { }

        try {
          await supabase.from('content_qa_results').insert({
            draft_id: savedDraft.id,
            version_number: 1,
            ...output.qa,
            facts_flagged: output.qa.facts_flagged,
          });
        } catch (qaErr) { }

        if (Array.isArray(output.images)) {
          for (const img of output.images) {
            try {
              await supabase.from('content_images').insert({
                draft_id: savedDraft.id,
                placement_context: img.placement_context || 'Article body',
                image_type: img.image_type || 'featured',
                purpose: img.purpose || 'Visual enhancement',
                alt_text: img.alt_text || '',
                suggested_filename: img.suggested_filename || 'image.webp',
                status: img.generation_status || 'created',
              });
            } catch (imgInsertErr) { }
          }
        }

        try {
          const memoryFact = `Published Content: "${output.working_title || output.seo_title}" covering target keyword "${output.primary_keyword}" (${output.search_intent} intent). Tailored for ${output.target_audience || 'target audience'}.`;
          await supabase.from('project_memory').insert({
            website_id,
            category: 'content',
            content: memoryFact,
            source: 'autonomous_article_learning',
            source_detail: `Generated from article: "${output.primary_keyword}"`,
            confidence: 'high',
            is_important: false,
            tags: ['article_coverage', output.primary_keyword],
          });
        } catch (autoLearnErr) { }

      } catch (saveError: any) {
        console.warn('[Draft Save Async] Error:', saveError);
        await supabase.from('content_drafts').update({ status: 'rejected', revision_notes: 'Generation failed: ' + saveError.message }).eq('id', savedDraft.id);
      }
    });

    return NextResponse.json({
      success: true,
      draft: {
        id: savedDraft.id,
        working_title: savedDraft.working_title,
        primary_keyword: savedDraft.primary_keyword,
        search_intent: savedDraft.search_intent,
        content_type: savedDraft.content_type,
        status: savedDraft.status,
        version: savedDraft.current_version,
      }
    });
} catch (error: any) {
    console.error('[Content Draft POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
