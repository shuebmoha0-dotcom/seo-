import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();

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

    // 2. Concurrency-safe job claim
    // Select the oldest pending job for this site and atomically mark it 'claimed'
    const { data: pendingJobs, error: jobErr } = await supabase
      .from('wordpress_jobs')
      .select('*')
      .eq('site_id', site.id)
      .eq('status', 'pending')
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

    return NextResponse.json({
      success: true,
      has_job: true,
      job: {
        id: claimedJob.id,
        job_type: claimedJob.job_type,
        payload: claimedJob.payload,
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
