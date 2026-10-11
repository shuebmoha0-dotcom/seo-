import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = createAdminClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_search_console');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error } = await query.maybeSingle();
    if (error || !integration) {
      return NextResponse.json({ ok: false, error: 'Google Search Console is not connected.' }, { status: 404 });
    }

    // Execute real sync
    const propertyUrl = integration.config?.property_url || 'Search Console property';
    const targetSiteId = integration.website_id || website_id;
    let syncResult = null;
    if (targetSiteId) {
      const { syncSearchConsoleData } = await import('@/lib/services/gscSyncService');
      syncResult = await syncSearchConsoleData(targetSiteId);
    }

    return NextResponse.json({
      ok: true,
      message: `Verified connection to Search Console (${propertyUrl}). ${syncResult?.syncedRows || 0} performance records synced.`,
      last_tested_at: new Date().toISOString(),
      sync: syncResult,
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Verification failed.' }, { status: 500 });
  }
}
