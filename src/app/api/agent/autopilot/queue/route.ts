import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SiteContentGapDetector } from '@/lib/agent/siteContentGapDetector';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Fetch existing queued drafts (status: 'brief_pending')
    const { data: existingQueue, error: qErr } = await supabase
      .from('content_drafts')
      .select('id, working_title, primary_keyword, search_intent, content_type, revision_notes, created_at')
      .eq('website_id', websiteId)
      .eq('status', 'brief_pending')
      .order('created_at', { ascending: true });

    if (qErr) throw qErr;

    let queue = existingQueue || [];

    // 2. If queue has fewer than 7 planned topics, automatically replenish with diverse, balanced categories
    if (queue.length < 7) {
      const { data: website } = await supabase
        .from('websites')
        .select('id, domain, url')
        .eq('id', websiteId)
        .single();

      if (website) {
        const inventory = await SiteContentGapDetector.getSiteInventory({ websiteId, domain: website.domain });
        const gaps = await SiteContentGapDetector.findContentGaps({
          inventory,
          websiteId,
          limit: 14,
        });

        const needed = 7 - queue.length;
        const existingKeywords = new Set([
          ...inventory.coveredTitles.map(t => t.toLowerCase()),
          ...queue.map(q => q.primary_keyword.toLowerCase()),
        ]);

        const candidateTopics = gaps.filter(g => !existingKeywords.has(g.keyword.toLowerCase()));

        // Insert new planned topics to bring the queue up to 7 days
        for (let i = 0; i < Math.min(needed, candidateTopics.length); i++) {
          const cand = candidateTopics[i];
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + (queue.length + i + 1));
          const dateStr = scheduledDate.toISOString().slice(0, 10);

          const { data: inserted } = await supabase
            .from('content_drafts')
            .insert({
              website_id: websiteId,
              primary_keyword: cand.keyword,
              working_title: cand.working_title,
              search_intent: cand.search_intent || 'informational',
              content_type: 'blog_article',
              status: 'brief_pending',
              url_slug: cand.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
              revision_notes: JSON.stringify({
                scheduled_date: dateStr,
                category: cand.target_category || 'General',
                search_volume: cand.estimated_volume || 1000,
                difficulty: cand.estimated_kd || 30,
                source: 'autopilot_queue_replenish',
              }),
            })
            .select('id, working_title, primary_keyword, search_intent, content_type, revision_notes, created_at')
            .single();

          if (inserted) {
            queue.push(inserted);
          }
        }
      }
    }

    // Format queue items with parsed notes and scheduled dates
    const formatted = queue.map((item, idx) => {
      let notes: any = {};
      try {
        notes = typeof item.revision_notes === 'string' ? JSON.parse(item.revision_notes) : (item.revision_notes || {});
      } catch (_) {}

      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + (idx + 1));

      return {
        id: item.id,
        working_title: item.working_title,
        primary_keyword: item.primary_keyword,
        category: notes.category || 'General',
        search_volume: notes.search_volume || 1200,
        difficulty: notes.difficulty || 28,
        scheduled_date: notes.scheduled_date || defaultDate.toISOString().slice(0, 10),
        status: 'scheduled',
      };
    });

    return NextResponse.json({
      success: true,
      queue: formatted,
    });
  } catch (error: any) {
    console.error('[Autopilot Queue GET Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { website_id, working_title, primary_keyword, category, scheduled_date } = body;

    if (!website_id || !working_title || !primary_keyword) {
      return NextResponse.json({ error: 'website_id, working_title, and primary_keyword are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const slug = primary_keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: item, error } = await supabase
      .from('content_drafts')
      .insert({
        website_id,
        working_title,
        primary_keyword,
        search_intent: 'informational',
        content_type: 'blog_article',
        status: 'brief_pending',
        url_slug: slug,
        revision_notes: JSON.stringify({
          scheduled_date: scheduled_date || new Date(Date.now() + 86400000).toISOString().slice(0, 10),
          category: category || 'Custom',
          search_volume: 1000,
          difficulty: 30,
          source: 'user_custom_queued',
        }),
      })
      .select('id, working_title, primary_keyword, status, revision_notes')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item });
  } catch (error: any) {
    console.error('[Autopilot Queue POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to add item to queue' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('content_drafts')
      .delete()
      .eq('id', id)
      .eq('status', 'brief_pending');

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Autopilot Queue DELETE Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete queued item' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, working_title, primary_keyword, category, swap } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (swap) {
      // Find candidate gap topic that is not yet used
      const { data: draft } = await supabase
        .from('content_drafts')
        .select('website_id')
        .eq('id', id)
        .single();

      if (draft?.website_id) {
        const { data: website } = await supabase
          .from('websites')
          .select('id, domain')
          .eq('id', draft.website_id)
          .single();

        if (website) {
          const inventory = await SiteContentGapDetector.getSiteInventory({ websiteId: website.id, domain: website.domain });
          const gaps = await SiteContentGapDetector.findContentGaps({
            inventory,
            websiteId: website.id,
            limit: 10,
          });

          const replacement = gaps.find(g => !inventory.coveredTitles.some(t => t.toLowerCase() === g.keyword.toLowerCase()));
          if (replacement) {
            await supabase
              .from('content_drafts')
              .update({
                working_title: replacement.working_title,
                primary_keyword: replacement.keyword,
                url_slug: replacement.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                revision_notes: JSON.stringify({
                  category: replacement.target_category,
                  search_volume: replacement.estimated_volume,
                  difficulty: replacement.estimated_kd,
                  swapped_at: new Date().toISOString(),
                }),
              })
              .eq('id', id);

            return NextResponse.json({
              success: true,
              item: {
                id,
                working_title: replacement.working_title,
                primary_keyword: replacement.keyword,
                category: replacement.target_category,
                search_volume: replacement.estimated_volume,
                difficulty: replacement.estimated_kd,
              },
            });
          }
        }
      }
    }

    // Standard edit
    const updatePayload: any = {};
    if (working_title) updatePayload.working_title = working_title;
    if (primary_keyword) {
      updatePayload.primary_keyword = primary_keyword;
      updatePayload.url_slug = primary_keyword.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    const { data: updated, error } = await supabase
      .from('content_drafts')
      .update(updatePayload)
      .eq('id', id)
      .select('id, working_title, primary_keyword')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[Autopilot Queue PUT Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update queue item' }, { status: 500 });
  }
}
