import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { encryptCredential } from '@/lib/utils/encryption';

const WORDPRESS_CAPABILITIES = [
  'READ_CONTENT',
  'READ_SITE_STRUCTURE',
  'READ_MEDIA',
  'CREATE_DRAFT',
  'UPDATE_CONTENT',
  'UPDATE_TITLE',
  'UPDATE_META_DESCRIPTION',
  'UPDATE_METADATA',
  'ADD_INTERNAL_LINK',
  'ADD_MEDIA',
  'SET_FEATURED_IMAGE',
  'PUBLISH_CONTENT',
  'VERIFY_CONTENT',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { site_url, username, application_password, seo_plugin, website_id, project_id } = body;

    if (!site_url || !username || !application_password) {
      return NextResponse.json(
        { success: false, error: 'Site URL, WordPress username, and Application Password are required.' },
        { status: 400 }
      );
    }

    // 1. Live connection test
    const client = new WordPressClient({
      siteUrl: site_url,
      username,
      applicationPassword: application_password,
      seoPlugin: seo_plugin || 'none',
    });

    const testResult = await client.testConnection();
    if (!testResult.ok) {
      return NextResponse.json({
        success: false,
        error: testResult.message,
      }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Encrypt Application Password
    const encryptedPassword = encryptCredential(application_password);

    // 3. Upsert into integrations table
    const integrationPayload: Record<string, any> = {
      provider: 'wordpress',
      display_name: 'WordPress',
      config: {
        site_url: site_url.replace(/\/$/, ''),
        username: testResult.username || username,
        site_name: testResult.siteName || 'WordPress Site',
        seo_plugin: testResult.detectedPlugin || seo_plugin || 'none',
      },
      capabilities: WORDPRESS_CAPABILITIES,
      status: 'connected',
      status_message: `Connected to ${testResult.siteName || site_url} as ${testResult.username || username}`,
      last_tested_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      has_access_token: true,
      updated_at: new Date().toISOString(),
    };

    if (website_id) integrationPayload.website_id = website_id;

    // Check existing integration
    let integrationId: string | null = null;
    let query = supabase.from('integrations').select('id').eq('provider', 'wordpress');
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

    // 4. Save encrypted credentials in integration_credentials
    if (integrationId) {
      await supabase.from('integration_credentials').upsert({
        integration_id: integrationId,
        credential_type: 'app_password',
        encrypted_value: encryptedPassword,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });
    }

    // 5. Update website status if website_id provided
    if (website_id) {
      await supabase.from('websites').update({
        platform: 'wordpress',
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', website_id);
    }

    // 6. Record Audit Log
    if (user) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        project_id: project_id || null,
        action: 'integration.connected',
        resource_type: 'integration',
        resource_id: integrationId,
        metadata: {
          provider: 'wordpress',
          site_url: site_url.replace(/\/$/, ''),
          username,
        },
      });
    }

    return NextResponse.json({
      success: true,
      integration_id: integrationId,
      site_name: testResult.siteName,
      username: testResult.username,
      seo_plugin: testResult.detectedPlugin,
      message: `Connected successfully to ${testResult.siteName}!`,
    });
  } catch (error: any) {
    console.error('[WordPress Connect] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to save WordPress connection.',
    }, { status: 500 });
  }
}
