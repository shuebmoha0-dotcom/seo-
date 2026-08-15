import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    const supabase = await createClient();
    let query = supabase
      .from('integrations')
      .select('id, provider, display_name, config, capabilities, status, status_message, last_tested_at, last_synced_at, last_success_at, connected_at, created_at')
      .eq('provider', 'wordpress');

    if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error } = await query.maybeSingle();

    if (error) throw error;

    if (!integration) {
      return NextResponse.json({
        connected: false,
        status: 'disconnected',
      });
    }

    return NextResponse.json({
      connected: integration.status === 'connected',
      status: integration.status,
      id: integration.id,
      site_url: integration.config?.site_url,
      site_name: integration.config?.site_name,
      username: integration.config?.username,
      seo_plugin: integration.config?.seo_plugin || 'none',
      capabilities: integration.capabilities || [],
      last_tested_at: integration.last_tested_at,
      last_success_at: integration.last_success_at,
      last_synced_at: integration.last_synced_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
