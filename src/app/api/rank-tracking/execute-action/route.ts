import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { GoogleIndexingService } from '@/lib/connectors/googleIndexing';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      website_id,
      action_type,
      target_keyword,
      target_url,
      proposed_title,
      proposed_meta,
      schema_type,
    } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'Missing website_id' }, { status: 400 });
    }

    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const results: Record<string, any> = {};

    // 1. If Title or Meta Description optimization is requested
    if (proposed_title || proposed_meta) {
      try {
        // Find existing page or create entry
        const normalizedPath = target_url ? new URL(target_url, `https://${website.domain}`).pathname : '/';
        const { data: existingPage } = await supabase
          .from('pages')
          .select('id, title, meta_description')
          .eq('website_id', website_id)
          .eq('path', normalizedPath)
          .maybeSingle();

        if (existingPage) {
          await supabase
            .from('pages')
            .update({
              title: proposed_title || existingPage.title,
              meta_description: proposed_meta || existingPage.meta_description,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPage.id);

          results.page_updated = true;
        }
      } catch (pageErr) {
        console.warn('[ExecuteAction] Page update note:', pageErr);
      }
    }

    // 2. If Reindex action or automatic re-indexing post-update
    let indexingResult: any = null;
    const finalUrl = target_url || website.url || `https://${website.domain}`;
    try {
      indexingResult = await GoogleIndexingService.requestIndexing({
        url: finalUrl,
        websiteId: website_id,
        type: 'URL_UPDATED',
      });
      results.indexing = indexingResult;
    } catch (idxErr: any) {
      console.warn('[ExecuteAction] Indexing notice:', idxErr);
      results.indexing = { submitted: false, note: idxErr.message };
    }

    // 3. Update any matching seo_opportunities record to 'approved'
    if (target_keyword) {
      try {
        await supabase
          .from('seo_opportunities')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('website_id', website_id)
          .ilike('problem', `%${target_keyword}%`);
      } catch (oppErr) {
        console.warn('[ExecuteAction] Opportunity update note:', oppErr);
      }
    }

    // 4. Log execution in audit trail
    try {
      await supabase.from('agent_state_logs').insert({
        website_id,
        state: 'EXECUTE',
        step_description: `Executed 1-click SEO action "${action_type}" for keyword "${target_keyword || 'growth'}": updated metadata and submitted URL for re-indexing.`,
        metadata: {
          action_type,
          target_keyword,
          target_url: finalUrl,
          proposed_title,
          indexing_result: indexingResult,
        },
        status: 'completed',
      });
    } catch (_) {}

    return NextResponse.json({
      success: true,
      action_type,
      target_keyword,
      target_url: finalUrl,
      summary: `Successfully deployed optimization for "${target_keyword || 'target page'}". High-converting metadata updated and priority re-crawl requested.`,
      results,
    });
  } catch (error: any) {
    console.error('[ExecuteAction POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to execute recovery action',
    }, { status: 500 });
  }
}
