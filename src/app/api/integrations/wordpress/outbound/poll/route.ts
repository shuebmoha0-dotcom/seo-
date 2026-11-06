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
    const supabase = createAdminClient();

    // Parse body for optional health telemetry
    let bodyData: any = {};
    try {
      bodyData = JSON.parse(bodyText);
    } catch {}

    // 1. Update site health timestamp & versions
    const updatePayload: Record<string, any> = {
      last_ping_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (bodyData.telemetry) {
      if (bodyData.telemetry.wp_version) updatePayload.wp_version = bodyData.telemetry.wp_version;
      if (bodyData.telemetry.php_version) updatePayload.php_version = bodyData.telemetry.php_version;
      if (bodyData.telemetry.plugin_version) updatePayload.plugin_version = bodyData.telemetry.plugin_version;
      if (bodyData.telemetry.seo_plugins) updatePayload.seo_plugins = bodyData.telemetry.seo_plugins;
    }
    await supabase.from('wordpress_outbound_sites').update(updatePayload).eq('id', site.id);

    // Reclaim stale jobs that were claimed more than 5 minutes ago without completion
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('wordpress_jobs')
      .update({ status: 'pending', claimed_at: null, claimed_by: null })
      .eq('status', 'claimed')
      .lt('claimed_at', staleThreshold);

    // 2. Concurrency-safe job claim
    // Select the oldest pending job for this site and atomically mark it 'claimed'
    let jobsQuery = supabase
      .from('wordpress_jobs')
      .select('*')
      .eq('status', 'pending');

    if (site.website_id) {
      jobsQuery = jobsQuery.or(`site_id.eq.${site.id},website_id.eq.${site.website_id}`);
    } else {
      jobsQuery = jobsQuery.eq('site_id', site.id);
    }

    const { data: pendingJobs, error: jobErr } = await jobsQuery
      .order('created_at', { ascending: true })
      .limit(1);

    if (jobErr) {
      return NextResponse.json({ success: false, error: jobErr.message }, { status: 500 });
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        has_job: false,
        job: null,
      });
    }

    const targetJob = pendingJobs[0];

    // Atomically transition status from 'pending' to 'claimed'
    const { data: claimedJob, error: claimErr } = await supabase
      .from('wordpress_jobs')
      .update({
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by: site.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetJob.id)
      .eq('status', 'pending') // Concurrency guard
      .select('*')
      .maybeSingle();

    if (claimErr || !claimedJob) {
      // Another worker claimed this job concurrently
      return NextResponse.json({
        success: true,
        has_job: false,
        job: null,
      });
    }

    const jobPayload = { ...(claimedJob.payload || {}) };

    // CRITICAL THUMBNAIL PROTECTION:
    // Never deliver a falsy featured_media (0, null, "") to WordPress because op_update_post in PHP
    // calls delete_post_thumbnail($post_id) whenever isset($payload['featured_media']) && empty($payload['featured_media'])!
    if ('featured_media' in jobPayload && (!jobPayload.featured_media || Number(jobPayload.featured_media) <= 0)) {
      delete jobPayload.featured_media;
    }

    // RESOLVE POST_ID FROM SLUG ON UPDATE_POST:
    // Ensure update_post jobs queued by slug never fail with "Post #0 not found"
    if (
      claimedJob.job_type === 'update_post' &&
      !jobPayload.post_id &&
      !jobPayload.id &&
      jobPayload.slug &&
      site.site_url
    ) {
      try {
        const cleanSiteUrl = site.site_url.replace(/\/+$/, '');
        const wpLookup = await fetch(
          `${cleanSiteUrl}/wp-json/wp/v2/posts?slug=${encodeURIComponent(jobPayload.slug)}&_fields=id,featured_media`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (wpLookup.ok) {
          const wpPosts = await wpLookup.json();
          if (Array.isArray(wpPosts) && wpPosts.length > 0 && wpPosts[0].id) {
            jobPayload.post_id = Number(wpPosts[0].id);
          }
        }
      } catch (_) {}
    }

    // WORDPRESS CATEGORY RESOLUTION SAFETY NET:
    // If a create_post job is claimed without category_ids, resolve the matching WordPress category ID dynamically
    // so posts are placed into their true pillar (e.g., LinkedIn Outreach, Outreach Strategy, AI Tools & Reviews) instead of the default category.
    if (
      claimedJob.job_type === 'create_post' &&
      (!Array.isArray(jobPayload.category_ids) || jobPayload.category_ids.length === 0) &&
      site.site_url
    ) {
      try {
        const { resolveWordPressCategoryIds } = await import('@/lib/connectors/wordpressOutbound');
        const resolvedCatIds = await resolveWordPressCategoryIds({
          siteUrl: site.site_url,
          targetCategory: jobPayload.target_category || jobPayload.category,
          title: jobPayload.title,
          keyword: jobPayload.primary_keyword || jobPayload.focus_keyword,
        });
        if (resolvedCatIds.length > 0) {
          jobPayload.category_ids = resolvedCatIds;
        }
      } catch (_) {}
    }

    // GUARANTEE FEATURED IMAGE URL ON CREATE_POST:
    // If a create_post job has no featured_image_url and no featured_media, resolve from content_drafts or curated 16:9 fallback
    if (
      claimedJob.job_type === 'create_post' &&
      !jobPayload.featured_image_url &&
      !jobPayload.featured_image_data_uri &&
      !jobPayload.featured_media
    ) {
      try {
        if (jobPayload.slug || jobPayload.title) {
          let draftQuery = supabase
            .from('content_drafts')
            .select('revision_notes, content_body')
            .eq('website_id', claimedJob.website_id);
          if (jobPayload.slug) {
            draftQuery = draftQuery.eq('url_slug', jobPayload.slug);
          } else {
            draftQuery = draftQuery.eq('working_title', jobPayload.title);
          }
          const { data: dRow } = await draftQuery.limit(1).maybeSingle();
          if (dRow?.revision_notes) {
            const notes = typeof dRow.revision_notes === 'string' ? JSON.parse(dRow.revision_notes) : dRow.revision_notes;
            if (notes?.featured_image_url) {
              jobPayload.featured_image_url = notes.featured_image_url;
            }
          }
          if (!jobPayload.featured_image_url && dRow?.content_body) {
            const bodyImg = dRow.content_body.match(/!\[.*?\]\(((?:https?:\/\/|data:image\/)[^\s\)]+)\)/i);
            if (bodyImg) jobPayload.featured_image_url = bodyImg[1];
          }
        }
        if (!jobPayload.featured_image_url) {
          const { CuratedEditorialProvider } = await import('@/lib/ai/imageRouter');
          jobPayload.featured_image_url = CuratedEditorialProvider.generateImage(
            jobPayload.title || jobPayload.primary_keyword || jobPayload.focus_keyword || jobPayload.slug || 'B2B Strategy'
          ).url;
        }
      } catch (_) {}
    }

    // FEATURED IMAGE RESILIENCE: If job payload has a remote HTTP featured_image_url and no direct featured_media,
    // verify the image is reachable and provide featured_image_data_uri alongside the standard HTTP featured_image_url.
    if (
      jobPayload.featured_image_url &&
      typeof jobPayload.featured_image_url === 'string' &&
      !jobPayload.featured_media
    ) {
      if (jobPayload.featured_image_url.startsWith('data:image/')) {
        jobPayload.featured_image_data_uri = jobPayload.featured_image_url;
      } else if (jobPayload.featured_image_url.startsWith('http') && !jobPayload.featured_image_data_uri) {
        try {
          const imgRes = await fetch(jobPayload.featured_image_url, { signal: AbortSignal.timeout(6000) });
          if (imgRes.ok) {
            const contentType = (imgRes.headers.get('content-type') || 'image/webp').split(';')[0].trim();
            const buffer = await imgRes.arrayBuffer();
            jobPayload.featured_image_data_uri = `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
          }
        } catch (imgErr) {
          console.warn(`[Outbound Poll] Failed to inline featured image for job ${claimedJob.id}:`, imgErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      has_job: true,
      job: {
        id: claimedJob.id,
        job_type: claimedJob.job_type,
        payload: jobPayload,
        created_at: claimedJob.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Outbound Poll Error]:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Poll failed.' },
      { status: 500 }
    );
  }
}
