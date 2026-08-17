import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let query = supabase.from('integrations').select('id, config').eq('provider', 'custom_api');
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
      disconnected_at: new Date().toISOString(),
      has_access_token: false,
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'integration.disconnected',
        resource_type: 'integration',
        resource_id: integration.id,
        metadata: { provider: 'custom_api', site_url: integration.config?.site_url },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Custom Website API disconnected successfully. Historical data and tasks preserved.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to disconnect.' }, { status: 500 });
  }
}
