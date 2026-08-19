import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { decryptCredential } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();

    // 1. Fetch integration record
    let query = supabase.from('integrations').select('*').eq('provider', 'wordpress');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error: intError } = await query.maybeSingle();
    if (intError || !integration) {
      return NextResponse.json({ ok: false, error: 'No WordPress integration found to verify.' }, { status: 404 });
    }

    // 2. Fetch encrypted credential
    const { data: creds, error: credError } = await supabase
      .from('integration_credentials')
      .select('encrypted_value, credential_type')
      .eq('integration_id', integration.id)
      .in('credential_type', ['agent_connector', 'app_password', 'botcreds'])
      .maybeSingle();

    if (credError || !creds?.encrypted_value) {
      return NextResponse.json({ ok: false, error: 'No stored credentials found for this WordPress site.' }, { status: 400 });
    }

    // 3. Decrypt password or API key
    const applicationPassword = decryptCredential(creds.encrypted_value);
    if (!applicationPassword) {
      return NextResponse.json({ ok: false, error: 'Failed to decrypt credentials.' }, { status: 500 });
    }

    // 4. Run live test
    const client = new WordPressClient({
      siteUrl: integration.config?.site_url,
      username: integration.config?.username,
      applicationPassword,
      apiKey: applicationPassword,
      authMethod: integration.config?.auth_method || creds.credential_type,
      seoPlugin: integration.config?.seo_plugin || 'none',
    });

    const testResult = await client.testConnection();

    // 5. Update status
    await supabase.from('integrations').update({
      status: testResult.ok ? 'connected' : 'error',
      status_message: testResult.message,
      last_tested_at: new Date().toISOString(),
      ...(testResult.ok && { last_success_at: new Date().toISOString() }),
      error_detail: testResult.ok ? null : testResult.message,
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    return NextResponse.json({
      ok: testResult.ok,
      message: testResult.message,
      site_name: testResult.siteName,
      username: testResult.username,
      last_tested_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Verification failed.' }, { status: 500 });
  }
}
