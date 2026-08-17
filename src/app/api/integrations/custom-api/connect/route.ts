import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CustomSaaSClient } from '@/lib/connectors/customSaaSClient';
import { encryptCredential } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, project_id, site_url, api_base_url, auth_type, api_key, header_name, content_endpoint, media_endpoint, publish_endpoint } = body;

    if (!site_url || !api_base_url || !api_key) {
      return NextResponse.json({ success: false, error: 'Site URL, API Base URL, and API Key are required.' }, { status: 400 });
    }

    // 1. Live test & capability discovery
    const client = new CustomSaaSClient({
      site_url,
      api_base_url,
      auth_type: auth_type || 'bearer_token',
      api_key,
      header_name,
      content_endpoint,
      media_endpoint,
      publish_endpoint,
    });

    const test = await client.testAndDiscoverCapabilities();
    if (!test.ok) {
      return NextResponse.json({ success: false, error: test.message }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Encrypt token
    const encryptedKey = encryptCredential(api_key);

    // 3. Upsert into integrations
    const integrationPayload: Record<string, any> = {
      provider: 'custom_api',
      display_name: 'Custom Website API',
      config: {
        site_url: site_url.replace(/\/$/, ''),
        api_base_url: api_base_url.replace(/\/$/, ''),
        auth_type: auth_type || 'bearer_token',
        header_name: header_name || 'X-API-Key',
        content_endpoint: content_endpoint || '/api/content',
        media_endpoint: media_endpoint || '/api/media',
        publish_endpoint: publish_endpoint || '/api/publish',
      },
      capabilities: test.capabilities,
      status: 'connected',
      status_message: `Connected to API at ${api_base_url}`,
      last_tested_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      has_access_token: true,
      updated_at: new Date().toISOString(),
    };

    if (website_id) integrationPayload.website_id = website_id;

    let integrationId: string | null = null;
    let query = supabase.from('integrations').select('id').eq('provider', 'custom_api');
    if (website_id) query = query.eq('website_id', website_id);
    const { data: existing } = await query.maybeSingle();

    if (existing?.id) {
      integrationId = existing.id;
      await supabase.from('integrations').update(integrationPayload).eq('id', integrationId);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('integrations')
        .insert(integrationPayload)
        .select('id')
        .single();
      if (insertError) throw insertError;
      integrationId = inserted.id;
    }

    // 4. Save encrypted credentials
    if (integrationId) {
      await supabase.from('integration_credentials').upsert({
        integration_id: integrationId,
        credential_type: auth_type === 'bearer_token' ? 'bearer_token' : 'api_key',
        encrypted_value: encryptedKey,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });
    }

    // 5. Update website platform
    if (website_id) {
      await supabase.from('websites').update({
        platform: 'custom',
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', website_id);
    }

    // 6. Audit log
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        project_id: project_id || null,
        action: 'integration.connected',
        resource_type: 'integration',
        resource_id: integrationId,
        metadata: { provider: 'custom_api', site_url, api_base_url },
      });
    }

    return NextResponse.json({
      success: true,
      integration_id: integrationId,
      capabilities: test.capabilities,
      message: 'Custom Website API connected successfully!',
    });
  } catch (error: any) {
    console.error('[Custom API Connect] Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect Custom Website API.' }, { status: 500 });
  }
}
