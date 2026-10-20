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

    // FEATURED IMAGE RESILIENCE: If job payload has a remote HTTP featured_image_url and no direct featured_media,
    // verify the image is reachable and provide featured_image_data_uri alongside the standard HTTP featured_image_url.
    // Keeping featured_image_url as a valid HTTP URL ensures older plugin versions pass filter_var(..., FILTER_VALIDATE_URL),
    // while newer versions can use featured_image_data_uri. Any failure to set thumbnail is automatically self-healed by report/route.ts.
    if (
      jobPayload.featured_image_url &&
      typeof jobPayload.featured_image_url === 'string' &&
      jobPayload.featured_image_url.startsWith('http') &&
      !jobPayload.featured_media
    ) {
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
