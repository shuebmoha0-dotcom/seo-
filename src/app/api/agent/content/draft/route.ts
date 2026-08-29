export const maxDuration = 60;
export const dynamic = 'force-dynamic';
/* eslint-disable prefer-const, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { ContentAgent } from '@/lib/agent/contentAgent';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let websiteId = searchParams.get('website_id');

    const supabase = createAdminClient();

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

    let { data: drafts, error } = await query;

    if (error) throw error;

    // Fallback: if website filter returned 0 drafts, return all available drafts so the user never sees an empty screen
    if (!drafts || drafts.length === 0) {
      const { data: allDrafts } = await supabase
        .from('content_drafts')
        .select(`
          *,
          content_versions (*),
          content_qa_results (*),
          content_images (*)
        `)
        .order('created_at', { ascending: false });

      if (allDrafts && allDrafts.length > 0) {
        drafts = allDrafts;
      }
    }

    const now = Date.now();

    // Self-Healing Watchdog: auto-heal any stale placeholder drafts in the background
    const stuckDrafts = (drafts || []).filter(
      (d: any) =>
        (d.status === 'writing' || d.status === 'generating' || d.content_body?.includes('AI agent is writing this article in the background...')) &&
        d.created_at &&
        now - new Date(d.created_at).getTime() > 40000
    );

    if (stuckDrafts.length > 0) {
      after(async () => {
        for (const stuck of stuckDrafts) {
          try {
            console.log(`[Watchdog] Auto-healing stuck draft ${stuck.id} for "${stuck.primary_keyword}"...`);
            const watchdogAgent = new ContentAgent();
            const output = await watchdogAgent.runFullPipeline({
              website_id: stuck.website_id,
              primary_keyword: stuck.primary_keyword,
              secondary_keywords: stuck.secondary_keywords || [],
              search_intent: stuck.search_intent || 'informational',
              content_type: stuck.content_type || 'blog_article',
              target_audience: stuck.target_audience || 'Target audience and searchers',
              working_title: stuck.working_title?.replace('Writing article for "', '')?.replace('"...', ''),
              rules: {
                word_count_min: stuck.rules?.word_count_min || 800,
                word_count_max: stuck.rules?.word_count_max || 1200,
                language: stuck.rules?.language || 'U.S. English',
                tone: stuck.rules?.tone || 'Actionable, authoritative, first-person',
                audience: stuck.target_audience || 'Target audience and searchers interested in ' + stuck.primary_keyword,
                author_style: 'Alex Mercer (experienced sales & outreach consultant)',
                structure_rules: 'Use H2 and H3 headings. Short paragraphs.',
                paragraph_style: 'Short and easy to read.',
                image_rules: 'Include relevant original images.',
                source_rules: 'Use reliable sources. Verify factual claims.',
                brand_rules: 'Do not make unsupported claims.',
                cta_rules: 'Include one relevant CTA.',
                avoid_rules: 'No keyword stuffing. No filler. No robotic language.',
              },
            });

            await supabase.from('content_drafts').update({
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
              updated_at: new Date().toISOString(),
            }).eq('id', stuck.id);

            try {
              await supabase.from('content_versions').insert({
                draft_id: stuck.id,
                version_number: 1,
                content_body: output.content_body,
                word_count: output.word_count,
                status: output.status,
                qa_results: output.qa,
              });
            } catch {}

            console.log(`[Watchdog] Auto-healed stuck draft ${stuck.id} successfully!`);
          } catch (wErr) {
            console.warn(`[Watchdog] Failed to auto-heal draft ${stuck.id}:`, wErr);
          }
        }
      });
    }

    const formattedDrafts = (drafts || []).map((d: any) => {
      let currentStatus = d.status || 'ready_for_approval';

      return {
        id: d.id,
        working_title: d.working_title,
        primary_keyword: d.primary_keyword,
        search_intent: d.search_intent,
        content_type: d.content_type,
        word_count: d.word_count || 0,
        reading_time: d.reading_time_minutes || 0,
        status: currentStatus,
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
      };
    });

    return NextResponse.json(
      { drafts: formattedDrafts },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[Content Draft GET] Error:', error);
    return NextResponse.json(
      { error: error.message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        },
      }
    );
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

    const supabase = createAdminClient();

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

    let targetWebsiteId = website_id;
    try {
      if (!targetWebsiteId) {
        const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
        if (firstSite) targetWebsiteId = firstSite.id;
      }

      let memoryQuery = supabase
        .from('project_memory')
        .select('*')
        .eq('is_outdated', false)
        .order('is_important', { ascending: false });

      if (targetWebsiteId) {
        memoryQuery = memoryQuery.or(`website_id.eq.${targetWebsiteId},website_id.is.null`);
      }

      const { data: memoryData } = await memoryQuery;

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

    // Extract word count targets: prioritize user-selected rules from UI, then custom instructions, then standard 800-1200 default
    if (rules?.word_count_min && rules?.word_count_max) {
      defaultRules.word_count_min = rules.word_count_min;
      defaultRules.word_count_max = rules.word_count_max;
    } else {
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
      } else {
        defaultRules.word_count_min = 800;
        defaultRules.word_count_max = 1200;
      }
    }

    console.log(`[Content Draft] Applying target word count: ${defaultRules.word_count_min} - ${defaultRules.word_count_max} words`);

    // Live crawl site to discover real published internal links
    if (!internal_linking_opportunities || internal_linking_opportunities.length < 3) {
      try {
        const { SiteLinkCrawler } = await import('@/lib/agent/siteLinkCrawler');
        const liveLinks = await SiteLinkCrawler.discoverLiveInternalLinks({
          websiteId: targetWebsiteId,
          currentKeyword: primary_keyword,
        });

        if (liveLinks && liveLinks.length > 0) {
          internal_linking_opportunities = liveLinks;
        }
      } catch (crawlErr) {
        console.warn('[Content Draft] Live link crawl error:', crawlErr);
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
    const draftId = crypto.randomUUID();
    const placeholderDraft = {
      id: draftId,
      website_id,
      primary_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent,
      content_type: content_type || 'blog_article',
      target_audience: target_audience || defaultRules.audience,
      working_title: working_title || `Writing article for "${primary_keyword}"...`,
      status: 'writing',
      current_version: 1,
      seo_title: working_title || `Draft for ${primary_keyword}`,
      meta_description: 'Writing article...',
      url_slug: 'draft-' + Date.now(),
      content_body: 'AI agent is writing this article in the background...',
      h1: working_title,
      word_count: 1500,
      reading_time_minutes: 5,
    };

    const { error: draftErr } = await supabase.from('content_drafts').insert(placeholderDraft);

    if (draftErr) {
      throw new Error(draftErr.message || 'Failed to create placeholder draft');
    }
    const savedDraft = { id: draftId, ...placeholderDraft };

    // Enqueue job for the Render 24/7 Background Worker
    try {
      const { data: websiteRow } = await supabase
        .from('websites')
        .select('project_id')
        .eq('id', website_id)
        .maybeSingle();

      let projectId = websiteRow?.project_id;
      if (!projectId) {
        const { data: fallbackProj } = await supabase.from('projects').select('id').limit(1).maybeSingle();
        projectId = fallbackProj?.id;
      }

      let taskId: string | null = null;
      if (projectId) {
        const { data: existingTask } = await supabase
          .from('tasks')
          .select('id')
          .eq('project_id', projectId)
          .limit(1)
          .maybeSingle();

        if (existingTask) {
          taskId = existingTask.id;
        } else {
          const { data: newTask } = await supabase
            .from('tasks')
            .insert({
              project_id: projectId,
              title: 'Content Draft Generation',
              task_type: 'content_generation',
              status: 'active',
            })
            .select('id')
            .single();
          taskId = newTask?.id || null;
        }
      }

      if (projectId && taskId) {
        const { error: insError } = await supabase.from('task_executions').insert({
          task_id: taskId,
          project_id: projectId,
          status: 'queued',
          execution_payload: {
            type: 'content_draft',
            draft_id: draftId,
            website_id,
            content_input: {
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
            revision_notes,
          },
        });

        if (insError) {
          console.error('[Content Draft] Enqueue error:', insError);
        } else {
          console.log(`[Content Draft] Successfully enqueued background job for draft ${draftId} to Render worker.`);
        }
      }
    } catch (qErr) {
      console.warn('[Content Draft] Queue enqueue notice:', qErr);
    }

    // Double-Redundancy Fallback: Execute via after() in background runtime
    after(async () => {
      try {
        console.log(`[Content Draft] Running fallback parallel generation for draft ${draftId}...`);
        const fallbackAgent = new ContentAgent();
        const output = await fallbackAgent.runFullPipeline({
          website_id,
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
        }, revision_notes);

        // Check if draft is still in placeholder/writing state
        const { data: latest } = await supabase.from('content_drafts').select('status, content_body').eq('id', draftId).maybeSingle();
        if (latest && (latest.status === 'writing' || latest.content_body?.includes('AI agent is writing this article in the background...'))) {
          await supabase.from('content_drafts').update({
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
            updated_at: new Date().toISOString(),
          }).eq('id', draftId);

          try {
            await supabase.from('content_versions').insert({
              draft_id: draftId,
              version_number: 1,
              content_body: output.content_body,
              word_count: output.word_count,
              status: output.status,
              qa_results: output.qa,
            });
          } catch {}

          console.log(`[Content Draft] Parallel generation completed draft ${draftId} successfully!`);
        }
      } catch (err: any) {
        console.warn(`[Content Draft] Parallel generation note:`, err);
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
