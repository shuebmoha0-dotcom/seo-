import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { draft_id, action, notes } = await request.json();
    if (!draft_id || !action) {
      return NextResponse.json({ error: 'draft_id and action are required' }, { status: 400 });
    }

    const supabase = await createClient();

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      revise: 'needs_revision',
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action. Must be: approve | reject | revise' }, { status: 400 });
    }

    const { data: updatedDraft, error } = await supabase
      .from('content_drafts')
      .update({ status: newStatus, revision_notes: notes || null, updated_at: new Date().toISOString() })
      .eq('id', draft_id)
      .select()
      .single();

    if (error) throw error;

    // When approved, automatically queue the post in WordPress Outbound Job Queue
    if (action === 'approve' && updatedDraft) {
      const { data: wpSite } = await supabase
        .from('wordpress_outbound_sites')
        .select('*')
        .eq('status', 'active')
        .order('last_ping_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (wpSite) {
        await supabase.from('wordpress_jobs').insert({
          site_id: wpSite.id,
          website_id: updatedDraft.website_id,
          job_type: 'create_post',
          payload: {
            title: updatedDraft.working_title,
            content: updatedDraft.content_body,
            slug: updatedDraft.url_slug,
            status: 'draft',
            seo_title: updatedDraft.seo_title || updatedDraft.working_title,
            meta_description: updatedDraft.meta_description || '',
            canonical_url: `${wpSite.site_url.replace(/\/$/, '')}/${updatedDraft.url_slug}/`,
          },
          idempotency_key: `create_post_draft_${updatedDraft.id}_${Date.now()}`,
          status: 'pending',
        });
        console.log(`[Content Approval] Queued create_post job for draft ${updatedDraft.id} on WordPress site ${wpSite.site_url}`);
      }
    }

    return NextResponse.json({ success: true, draft_id, action, new_status: newStatus });
  } catch (error: any) {
    console.error('Content approval error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
