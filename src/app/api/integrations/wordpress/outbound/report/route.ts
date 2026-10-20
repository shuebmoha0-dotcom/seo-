import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyOutboundRequest } from '@/lib/connectors/wordpressOutbound';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const verification = await verifyOutboundRequest(request, bodyText);

    if (!verification.valid || !verification.site) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const site = verification.site;
    const body = JSON.parse(bodyText);
    const { job_id, status, result, error } = body;

    if (!job_id || !status) {
      return NextResponse.json(
        { success: false, error: 'job_id and status are required.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Verify job belongs to this site
    const { data: job, error: fetchErr } = await supabase
      .from('wordpress_jobs')
      .select('*')
      .eq('id', job_id)
      .eq('site_id', site.id)
      .single();

    if (fetchErr || !job) {
      return NextResponse.json(
        { success: false, error: 'Job not found or does not belong to this site.' },
        { status: 404 }
      );
    }

    const isSuccess = status === 'success' || status === 'completed';
    const finalStatus = isSuccess ? 'completed' : 'failed';

    const { error: updateErr } = await supabase
      .from('wordpress_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        result: isSuccess ? (result || {}) : null,
        error: !isSuccess ? (error || { message: 'Execution failed.' }) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job_id);

    if (updateErr) {
      throw updateErr;
    }

    // Update content_drafts status to published with live URL
    if (isSuccess && job.job_type === 'create_post') {
      try {
        let draftId: string | null = null;
        if (job.idempotency_key?.startsWith('create_post_draft_')) {
          const parts = job.idempotency_key.split('_');
          if (parts[3] && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[3])) {
            draftId = parts[3];
          }
        }

        const wpMeta = JSON.stringify({
          wordpress_post_id: result?.post_id || null,
          wordpress_post_url: result?.permalink || null,
          published_at: new Date().toISOString(),
        });

        // Update with existing columns in content_drafts schema so Postgres never rejects the update
        const draftUpdatePayload: Record<string, any> = {
          status: 'published',
          revision_notes: wpMeta,
          updated_at: new Date().toISOString(),
        };

        if (draftId) {
          await supabase.from('content_drafts').update(draftUpdatePayload).eq('id', draftId);
          console.log(`[Outbound Report] Marked draft ${draftId} as published live: ${result?.permalink}`);
        } else if (job.payload?.title) {
          await supabase.from('content_drafts').update(draftUpdatePayload).eq('working_title', job.payload.title);
          console.log(`[Outbound Report] Marked draft title "${job.payload.title}" as published live: ${result?.permalink}`);
        }

        // Automatically trigger multi-engine indexing (Google, IndexNow, Sitemap) on live publication
        const liveUrl = result?.permalink || (job.payload?.slug && site.site_url ? `${site.site_url.replace(/\/+$/, '')}/${job.payload.slug}/` : null);
        if (liveUrl) {
          try {
            const { GoogleIndexingService } = await import('@/lib/connectors/googleIndexing');
            const idxRes = await GoogleIndexingService.requestIndexing({
              url: liveUrl,
              websiteId: job.website_id,
              type: 'URL_UPDATED',
            });
            console.log(`[Outbound Report] Auto-indexing completed for ${liveUrl}:`, idxRes.summary);
          } catch (idxErr) {
            console.warn('[Outbound Report] Auto-indexing notice:', idxErr);
          }
        }

        // GUARANTEE FEATURED IMAGE: Check if newly published WordPress post has a valid thumbnail
        const createdPostId = result?.post_id;
        const heroUrl = job.payload?.featured_image_url || job.payload?.image_url;
        if (createdPostId && heroUrl && typeof heroUrl === 'string' && heroUrl.startsWith('http')) {
          try {
            const siteUrl = site.site_url.replace(/\/+$/, '');
            let hasThumbnail = false;
            try {
              const wpCheck = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${createdPostId}`, {
                signal: AbortSignal.timeout(4000),
              });
              if (wpCheck.ok) {
                const wpData = await wpCheck.json();
                if (wpData.featured_media && wpData.featured_media > 0) {
                  hasThumbnail = true;
                }
              }
            } catch (_) {}

            if (!hasThumbnail) {
              console.log(`[Outbound Report] Post #${createdPostId} is missing featured media. Auto-healing via upload_media pipeline...`);
              const imgRes = await fetch(heroUrl, { signal: AbortSignal.timeout(8000) });
              if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                const base64Data = Buffer.from(buffer).toString('base64');
                const slug = job.payload?.slug || `post-${createdPostId}`;
                await supabase.from('wordpress_jobs').insert({
                  site_id: site.id,
                  website_id: job.website_id,
                  job_type: 'upload_media',
                  status: 'pending',
                  payload: {
                    file_name: `${slug}-featured.webp`,
                    file_data: base64Data,
                    alt_text: job.payload?.title || slug,
                    target_post_id: createdPostId,
                  },
                  idempotency_key: `upload_feat_${createdPostId}_${Date.now()}`,
                });

                // Wake WordPress to process the upload immediately
                fetch(`${siteUrl}/wp-cron.php?doing_wp_cron=${Date.now()}`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
                fetch(`${siteUrl}/wp-json/seo-autopilot/v1/status?wake=1`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
              }
            }
          } catch (featErr) {
            console.warn('[Outbound Report] Featured image auto-heal check error:', featErr);
          }
        }
      } catch (draftUpdErr) {
        console.warn('[Outbound Report] Draft status update error:', draftUpdErr);
      }
    }

    // Step 2: Handle upload_media completion with target_post_id
    if (isSuccess && job.job_type === 'upload_media' && job.payload?.target_post_id) {
      try {
        const mediaId = result?.media_id || result?.attachment_id;
        const targetPostId = job.payload.target_post_id;
        if (mediaId && targetPostId) {
          console.log(`[Outbound Report] Media #${mediaId} uploaded for post #${targetPostId}. Dispatching update_post to attach thumbnail...`);
          await supabase.from('wordpress_jobs').insert({
            site_id: site.id,
            website_id: job.website_id,
            job_type: 'update_post',
            status: 'pending',
            payload: {
              post_id: targetPostId,
              featured_media: mediaId,
            },
            idempotency_key: `update_feat_${targetPostId}_${mediaId}_${Date.now()}`,
          });

          // Wake WordPress
          const siteUrl = site.site_url.replace(/\/+$/, '');
          fetch(`${siteUrl}/wp-cron.php?doing_wp_cron=${Date.now()}`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
          fetch(`${siteUrl}/wp-json/seo-autopilot/v1/status?wake=1`, { method: 'GET', signal: AbortSignal.timeout(2000) }).catch(() => {});
        }
      } catch (mediaErr) {
        console.warn('[Outbound Report] Error queueing update_post from upload_media:', mediaErr);
      }
    }

    // Update site last_sync_at & integration status
    await supabase
      .from('wordpress_outbound_sites')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', site.id);

    if (site.website_id) {
      const integrationUpdate: Record<string, any> = {
        last_synced_at: new Date().toISOString(),
        status: isSuccess ? 'connected' : 'action_required',
      };
      if (isSuccess) {
        integrationUpdate.last_success_at = new Date().toISOString();
      }
      await supabase
        .from('integrations')
        .update(integrationUpdate)
        .eq('website_id', site.website_id)
        .eq('provider', 'wordpress');
    }

    return NextResponse.json({
      success: true,
      job_id,
      status: finalStatus,
      message: 'Job report recorded successfully.',
    });
  } catch (error: any) {
    console.error('[Outbound Report Error]:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Report failed.' },
      { status: 500 }
    );
  }
}
