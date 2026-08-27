import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = createAdminClient();

    let query = supabase.from('integrations').select('id, config').eq('provider', 'google_search_console');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration } = await query.maybeSingle();
    if (!integration) {
      return NextResponse.json({ success: true, message: 'Integration already disconnected.' });
    }

    await supabase.from('integration_credentials').delete().eq('integration_id', integration.id);

    await supabase.from('integrations').update({
      status: 'disconnected',
      status_message: 'Disconnected by user',
      has_access_token: false,
      has_refresh_token: false,
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    return NextResponse.json({
      success: true,
      message: 'Google Search Console disconnected. Historical data preserved.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
