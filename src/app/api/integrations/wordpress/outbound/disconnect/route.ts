import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const siteId = request.headers.get('X-SEO-Autopilot-Site-ID');
    if (!siteId) return NextResponse.json({ error: 'Missing Site-ID header' }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Explicitly update the status so the UI knows it's manually disconnected
    const { data: site } = await supabase.from('wordpress_outbound_sites')
      .update({ 
        status: 'revoked', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', siteId)
      .select('website_id')
      .maybeSingle();

    if (site?.website_id) {
      await supabase.from('integrations')
        .update({
          status: 'disconnected',
          status_message: 'Disconnected by WordPress plugin.',
          disconnected_at: new Date().toISOString(),
          has_access_token: false,
          updated_at: new Date().toISOString(),
        })
        .eq('website_id', site.website_id)
        .eq('provider', 'wordpress');
    }

    return NextResponse.json({ success: true, message: 'Site disconnected' });
  } catch (error: any) {
    console.error('[WP Outbound Disconnect Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
