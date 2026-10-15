import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    if (!website_id && !integration_id) {
      return NextResponse.json({ error: 'website_id or integration_id is required.' }, { status: 400 });
    }

    // Verify user owns the website
    let targetWebsiteId = website_id;
    if (!targetWebsiteId && integration_id) {
      const { data: intRec } = await supabase
        .from('integrations')
        .select('website_id')
        .eq('id', integration_id)
        .maybeSingle();
      targetWebsiteId = intRec?.website_id;
    }

    if (targetWebsiteId) {
      const { data: website } = await supabase
        .from('websites')
        .select('id, user_id')
        .eq('id', targetWebsiteId)
        .maybeSingle();

      const isPlatformAdmin = user.email === 'shuebmoha0@gmail.com';
      if (!website || (website.user_id !== user.id && !isPlatformAdmin)) {
        return NextResponse.json({ error: 'Forbidden: You do not own this website.' }, { status: 403 });
      }
    }

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
