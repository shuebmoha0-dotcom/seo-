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

    // Check outbound heartbeat
    let wpQuery = supabase
      .from('wordpress_outbound_sites')
      .select('*')
      .eq('status', 'active')
      .order('last_ping_at', { ascending: false })
      .limit(1);

    if (website_id) wpQuery = wpQuery.eq('website_id', website_id);
    const { data: outboundSite } = await wpQuery.maybeSingle();

    const now = Date.now();
    let isConnected = false;
    let status = 'disconnected';
    let siteUrl = integration?.config?.site_url || outboundSite?.site_url;

    if (outboundSite && outboundSite.last_ping_at) {
      const minutesSincePing = (now - new Date(outboundSite.last_ping_at).getTime()) / (1000 * 60);
      if (minutesSincePing <= 1440) {
        isConnected = true;
        status = 'connected';
      }
    } else if (integration && integration.status === 'connected') {
      // Legacy inbound/app_password mode
      isConnected = true;
      status = 'connected';
    }

    if (!integration && !outboundSite) {
      return NextResponse.json({
        connected: false,
        status: 'disconnected',
      });
    }

    return NextResponse.json({
      connected: isConnected,
      status: status,
      id: integration?.id || outboundSite?.id,
      site_url: siteUrl,
      site_name: integration?.config?.site_name || outboundSite?.site_name,
      username: integration?.config?.username,
      seo_plugin: integration?.config?.seo_plugin || 'none',
      capabilities: integration?.capabilities || ['READ_CONTENT', 'CREATE_DRAFT', 'UPDATE_CONTENT', 'PUBLISH_CONTENT', 'UPLOAD_MEDIA', 'UPDATE_METADATA', 'ADD_INTERNAL_LINK'],
      last_tested_at: integration?.last_tested_at || outboundSite?.last_ping_at,
      last_success_at: integration?.last_success_at || outboundSite?.last_ping_at,
      last_synced_at: integration?.last_synced_at || outboundSite?.last_ping_at,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
