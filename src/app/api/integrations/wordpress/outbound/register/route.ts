import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hashSecret } from '@/lib/connectors/wordpressOutbound';
import { encryptCredential } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      site_url,
      site_name,
      secret_key,
      wp_version,
      php_version,
      plugin_version,
      seo_plugins,
      website_id,
    } = body;

    if (!site_url || !secret_key) {
      return NextResponse.json(
        { success: false, error: 'site_url and secret_key are required for registration.' },
        { status: 400 }
      );
    }

    const normalizedUrl = site_url.replace(/\/+$/, '').toLowerCase();
    const secretHash = hashSecret(secret_key);
    const supabase = await createClient();

    // 1. Resolve website_id if not explicitly provided
    let targetWebsiteId = website_id;
    if (!targetWebsiteId) {
      const hostname = new URL(normalizedUrl).hostname;
      const { data: web } = await supabase
        .from('websites')
        .select('id')
        .ilike('domain', `%${hostname}%`)
        .maybeSingle();

      if (web?.id) {
        targetWebsiteId = web.id;
      }
    }

    // 2. Check if outbound site record exists
    let query = supabase.from('wordpress_outbound_sites').select('*').eq('site_url', normalizedUrl);
    if (targetWebsiteId) {
      query = query.eq('website_id', targetWebsiteId);
    }
    const { data: existingSite } = await query.maybeSingle();

    let siteId: string;
    if (existingSite) {
      siteId = existingSite.id;
      await supabase
        .from('wordpress_outbound_sites')
        .update({
          site_name: site_name || existingSite.site_name,
          hmac_secret_hash: secretHash,
          status: 'active',
          wp_version: wp_version || existingSite.wp_version,
          php_version: php_version || existingSite.php_version,
          plugin_version: plugin_version || existingSite.plugin_version,
          seo_plugins: seo_plugins || existingSite.seo_plugins,
          last_ping_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId);
    } else {
      const { data: newSite, error: insErr } = await supabase
        .from('wordpress_outbound_sites')
        .insert({
          website_id: targetWebsiteId || null,
          site_url: normalizedUrl,
          site_name: site_name || 'WordPress Site',
          hmac_secret_hash: secretHash,
          status: 'active',
          wp_version,
          php_version,
          plugin_version,
          seo_plugins: seo_plugins || {},
          last_ping_at: new Date().toISOString(),
          last_sync_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insErr || !newSite) {
        throw new Error(insErr?.message || 'Failed to register outbound site.');
      }
      siteId = newSite.id;
    }

    // 3. Upsert into integrations table if website_id available
    if (targetWebsiteId) {
      const { data: intg } = await supabase
        .from('integrations')
        .upsert({
          website_id: targetWebsiteId,
          provider: 'wordpress',
          display_name: 'WordPress',
          status: 'connected',
          status_message: `Connected to ${site_name || normalizedUrl} via Outbound Agent Connector`,
          config: {
            site_url: normalizedUrl,
            site_id: siteId,
            connection_mode: 'outbound',
            auth_method: 'agent_connector',
            site_name: site_name || 'WordPress Site',
            seo_plugin: seo_plugins?.rank_math ? 'rankmath' : (seo_plugins?.yoast ? 'yoast' : 'none'),
            rank_math_detected: !!seo_plugins?.rank_math,
            plugin_version,
            wp_version,
          },
          capabilities: [
            'site:read', 'content:read', 'content:write', 'media:read', 'media:write', 'seo:read',
            'CREATE_DRAFT', 'UPDATE_CONTENT', 'PUBLISH_CONTENT', 'UPLOAD_MEDIA', 'UPDATE_METADATA'
          ],
          last_tested_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'website_id,provider' })
        .select('id')
        .single();

      if (intg?.id) {
        await supabase.from('integration_credentials').upsert({
          integration_id: intg.id,
          credential_type: 'outbound_hmac_secret',
          encrypted_value: encryptCredential(secret_key),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'integration_id,credential_type' });
      }
    }

    return NextResponse.json({
      success: true,
      site_id: siteId,
      status: 'active',
      message: 'WordPress site successfully registered for outbound agent operation.',
    });
  } catch (error: any) {
    console.error('[Outbound Register Error]:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Registration failed.' },
      { status: 500 }
    );
  }
}
