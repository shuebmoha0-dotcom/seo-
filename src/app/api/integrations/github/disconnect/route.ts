import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();

    let query = supabase.from('integrations').select('id, config').eq('provider', 'github');
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
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    return NextResponse.json({
      success: true,
      message: 'GitHub disconnected successfully. Historical Pull Requests and branch references preserved.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
