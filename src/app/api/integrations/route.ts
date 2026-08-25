import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET all integrations for a website
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    const supabase = await createClient();
    let query = supabase
      .from('integrations')
      .select('id, provider, display_name, config, capabilities, status, status_message, last_tested_at, last_synced_at, last_success_at, error_code, error_detail, connected_at, has_access_token, scopes')
      .order('created_at', { ascending: true });

    if (website_id) query = query.eq('website_id', website_id);

    let { data, error } = await query;
    if (error) throw error;

    // Check if WordPress outbound site is active and ensure it reflects in integrations
    const { data: outboundSite } = await supabase
      .from('wordpress_outbound_sites')
      .select('*')
      .eq('status', 'active')
      .order('last_ping_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (outboundSite) {
      const wpItem = (data || []).find((i: any) => i.provider === 'wordpress');
      if (!wpItem) {
        // Run a quick live health check on the site to see if the plugin is actually still installed
        let liveStatus = 'connected';
        let liveMessage = `Connected to ${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector`;
        
        try {
          const siteUrl = outboundSite.site_url.replace(/\/+$/, '');
          const ping = await fetch(`${siteUrl}/wp-json/seo-autopilot/v1/status`, { 
            method: 'GET', 
            signal: AbortSignal.timeout(6000) 
          });
          
          if (!ping.ok) {
            liveStatus = 'action_required';
            liveMessage = 'Plugin returned an error. It may be deactivated or restricted by a firewall.';
            supabase.from('wordpress_outbound_sites')
              .update({ status: 'action_required', updated_at: new Date().toISOString() })
              .eq('id', outboundSite.id)
              .then(() => {});
          } else {
            // Restore active status if it was erroneously marked action_required
            supabase.from('wordpress_outbound_sites')
              .update({ status: 'active', updated_at: new Date().toISOString() })
              .eq('id', outboundSite.id)
              .then(() => {});
          }
        } catch (e) {
          // Fallback to connected if it merely timed out, to avoid aggressively marking action required
          liveStatus = 'connected';
          liveMessage = `Connected to ${outboundSite.site_name || outboundSite.site_url} via Outbound Agent Connector (Slow connection)`;
        }

        data = [
          ...(data || []),
          {
            id: outboundSite.id,
            provider: 'wordpress',
            display_name: 'WordPress',
            status: liveStatus,
            status_message: liveMessage,
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
            has_access_token: true,
            scopes: ['site:read', 'content:read', 'content:write', 'media:read', 'media:write', 'seo:read'],
          } as any
        ];
      }
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
