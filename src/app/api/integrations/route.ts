import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET all integrations for a website
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    const supabase = createAdminClient();
    let query = supabase
      .from('integrations')
      .select('id, provider, display_name, config, capabilities, status, status_message, last_tested_at, last_synced_at, last_success_at, error_code, error_detail, connected_at, has_access_token, scopes')
      .order('created_at', { ascending: true });

    if (website_id) query = query.eq('website_id', website_id);

    let { data, error } = await query;
    if (error) throw error;

    // 2. Evaluate WordPress live connection based on real-time heartbeat liveness
    let wpQuery = supabase
      .from('wordpress_outbound_sites')
      .select('*')
      .eq('status', 'active')
      .order('last_ping_at', { ascending: false })
      .limit(1);

    if (website_id) wpQuery = wpQuery.eq('website_id', website_id);
    const { data: outboundSite } = await wpQuery.maybeSingle();

    const now = Date.now();
    let isWpLive = false;
    let wpStatus = 'disconnected';
    let wpMessage = 'Plugin disconnected or not active.';

    if (outboundSite && outboundSite.last_ping_at) {
      const minutesSincePing = (now - new Date(outboundSite.last_ping_at).getTime()) / (1000 * 60);
      if (minutesSincePing <= 120) {
        isWpLive = true;
        wpStatus = 'connected';
        wpMessage = `Connected to ${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector`;
      } else if (minutesSincePing <= 1440) {
        isWpLive = true;
        wpStatus = 'connected';
        wpMessage = `Connected to ${outboundSite.site_name || outboundSite.site_url} (Last sync: ${Math.round(minutesSincePing / 60)}h ago)`;
      } else {
        wpStatus = 'disconnected';
        wpMessage = `Plugin idle for >24 hours. Check Settings > SEO Autopilot in WordPress.`;
      }
    }

    // Update or insert WordPress in returned integrations list
    const wpIndex = (data || []).findIndex((i: any) => i.provider === 'wordpress');
    if (wpIndex !== -1 && data) {
      data[wpIndex].status = wpStatus;
      data[wpIndex].status_message = wpMessage;
      if (!isWpLive) {
        data[wpIndex].has_access_token = false;
      }
    } else if (outboundSite) {
      data = [
        ...(data || []),
        {
          id: outboundSite.id,
          provider: 'wordpress',
          display_name: 'WordPress',
          status: wpStatus,
          status_message: wpMessage,
          config: {
            site_url: outboundSite.site_url,
            site_id: outboundSite.id,
            connection_mode: 'outbound',
            auth_method: 'agent_connector',
            wp_version: outboundSite.wp_version,
            plugin_version: outboundSite.plugin_version,
          },
          capabilities: ['READ_CONTENT', 'CREATE_DRAFT', 'UPDATE_CONTENT', 'PUBLISH_CONTENT', 'UPLOAD_MEDIA', 'UPDATE_METADATA', 'ADD_INTERNAL_LINK'],
          last_tested_at: outboundSite.last_sync_at || outboundSite.last_ping_at,
          last_synced_at: outboundSite.last_sync_at || outboundSite.last_ping_at,
          last_success_at: outboundSite.last_sync_at || outboundSite.last_ping_at,
          error_code: null,
          error_detail: null,
          connected_at: outboundSite.created_at || new Date().toISOString(),
          has_access_token: isWpLive,
          scopes: ['site:read', 'content:read', 'content:write', 'media:read', 'media:write', 'seo:read'],
        } as any
      ];
    }

    return NextResponse.json({ integrations: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create/update integration record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, provider, config, capabilities, display_name } = body;

    if (!provider) return NextResponse.json({ error: 'provider is required' }, { status: 400 });

    const supabase = await createClient();

    // Upsert integration
    const { data, error } = await supabase
      .from('integrations')
      .upsert({
        website_id,
        provider,
        display_name: display_name || provider,
        config: config || {},
        capabilities: capabilities || [],
        status: 'testing',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'website_id,provider' })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, integration: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
