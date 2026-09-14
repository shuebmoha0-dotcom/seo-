export const maxDuration = 60;
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { ContentAgent } from '@/lib/agent/contentAgent';
import { createAdminClient } from '@/lib/supabase/admin';

function safeBackground(fn: () => Promise<void>) {
  setImmediate(async () => {
    try {
      await fn();
    } catch (err: any) {
      console.error('[Content Draft Background Error]:', err?.message || err);
    }
  });
}

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

    // Fast read-only: resolve status cleanly without background loops
    const formattedDrafts = (drafts || []).map((d: any) => {
      let currentStatus = d.status || 'ready_for_approval';
      const hasRealBody = d.content_body && d.content_body.length > 300 && !d.content_body.includes('AI agent is writing this article in the background...');
      
      // If draft has actual content but status was stuck on writing/generating, auto-mark ready_for_approval
      if ((currentStatus === 'writing' || currentStatus === 'generating') && hasRealBody) {
        currentStatus = 'ready_for_approval';
        supabase.from('content_drafts').update({ status: 'ready_for_approval' }).eq('id', d.id).then(() => {});
      } else if ((currentStatus === 'writing' || currentStatus === 'generating') && !hasRealBody) {
        // If it has no body and is older than 2 minutes, mark failed so it never hangs in UI
        const ageMs = Date.now() - new Date(d.created_at || 0).getTime();
        if (ageMs > 120000) {
          currentStatus = 'failed';
          supabase.from('content_drafts').update({
            status: 'failed',
            revision_notes: 'Drafting timed out. Click Generate Draft to retry with Claude Sonnet 5.'
          }).eq('id', d.id).then(() => {});
        }
      }

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
            .eq('website_id', targetWebsiteId)
            .maybeSingle();

          if (websiteRules?.custom_rules) {
            projectInstructions = websiteRules.custom_rules;
          }
        }
      } catch (memErr) {
        console.warn('[Content Draft] Memory load error:', memErr);
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

    // 0. Anti-Duplication Guard: Prevent creating duplicate articles or cannibalizing keywords
    if (!revision_notes && !body.force_duplicate) {
      const { DuplicateArticleChecker } = await import('@/lib/agent/duplicateChecker');
      const dupCheck = await DuplicateArticleChecker.check({
        website_id: targetWebsiteId,
        primary_keyword,
        working_title,
      });

      if (dupCheck.isDuplicate) {
        console.warn(`[Content Draft] Duplicate article prevented: ${dupCheck.reason}`);
        return NextResponse.json({
          error: 'DUPLICATE_ARTICLE_PREVENTED',
          message: dupCheck.reason,
          matched_article: dupCheck.matchedArticle,
          is_duplicate: true,
        }, { status: 409 });
      }
    }

    // Generate draft synchronously via ContentAgent (Claude Sonnet 5 writer)
    console.log(`[Content Draft] Running generation for "${working_title || primary_keyword}"...`);
    const output = await agent.runFullPipeline(
      {
        website_id: website_id || undefined,
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

    const draftId = crypto.randomUUID();
    let savedDraft: any = {
      id: draftId,
      website_id: website_id || null,
      primary_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent,
      content_type: content_type || 'blog_article',
      target_audience: target_audience || defaultRules.audience,
      working_title: output.working_title || working_title || primary_keyword,
      h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
      content_body: output.content_body,
      word_count: output.word_count,
      reading_time_minutes: output.reading_time_minutes,
      seo_title: output.seo_title,
      meta_description: output.meta_description,
      url_slug: output.url_slug,
      status: output.status || 'ready_for_approval',
      current_version: 1,
    };

    if (website_id) {
      try {
        const { data: inserted, error: draftErr } = await supabase
          .from('content_drafts')
          .insert(savedDraft)
          .select()
          .single();

        if (draftErr) {
          console.error('[Content Draft] Save draft error:', draftErr);
        } else if (inserted) {
          savedDraft = inserted;
        }

        try {
          await supabase.from('content_versions').insert({
            draft_id: draftId,
            version_number: 1,
            content_body: output.content_body,
            word_count: output.word_count,
            status: output.status || 'ready_for_approval',
            qa_results: output.qa,
          });
        } catch {}

        if (output.images && output.images.length > 0) {
          for (const img of output.images) {
            if (img.image_url) {
              try {
                await supabase.from('content_images').insert({
                  draft_id: draftId,
                  image_url: img.image_url,
                  alt_text: img.alt_text,
                  caption: (img as any).caption || img.alt_text,
                  position: (img as any).position || 'featured',
                });
              } catch {}
            }
          }
        }
      } catch (dbErr) {
        console.error('[Content Draft] DB insert error:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      draft: {
        ...savedDraft,
        qa: output.qa,
        images: output.images,
      }
    });
  } catch (error: any) {
    console.error('[Content Draft POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
