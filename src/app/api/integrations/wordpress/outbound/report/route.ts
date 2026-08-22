import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOutboundRequest } from '@/lib/connectors/wordpressOutbound';

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

    const supabase = await createClient();

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
