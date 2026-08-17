import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CustomSaaSClient } from '@/lib/connectors/customSaaSClient';
import { decryptCredential } from '@/lib/utils/encryption';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { website_id, integration_id } = body;

    const supabase = await createClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'custom_api');
    if (integration_id) query = query.eq('id', integration_id);
    else if (website_id) query = query.eq('website_id', website_id);

    const { data: integration, error: intError } = await query.maybeSingle();
    if (intError || !integration) {
      return NextResponse.json({ ok: false, error: 'No Custom API integration found.' }, { status: 404 });
    }

    const { data: creds, error: credError } = await supabase
      .from('integration_credentials')
      .select('encrypted_value, credential_type')
      .eq('integration_id', integration.id)
      .single();

    if (credError || !creds?.encrypted_value) {
      return NextResponse.json({ ok: false, error: 'No credentials found for Custom API.' }, { status: 400 });
    }

    const apiKey = decryptCredential(creds.encrypted_value);
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'Failed to decrypt credentials.' }, { status: 500 });
    }

    const client = new CustomSaaSClient({
      site_url: integration.config?.site_url,
      api_base_url: integration.config?.api_base_url,
      auth_type: integration.config?.auth_type || 'bearer_token',
      api_key: apiKey,
      header_name: integration.config?.header_name,
      content_endpoint: integration.config?.content_endpoint,
      media_endpoint: integration.config?.media_endpoint,
      publish_endpoint: integration.config?.publish_endpoint,
    });

    const test = await client.testAndDiscoverCapabilities();

    await supabase.from('integrations').update({
      status: test.ok ? 'connected' : 'error',
      status_message: test.message,
      last_tested_at: new Date().toISOString(),
      ...(test.ok && { last_success_at: new Date().toISOString() }),
      capabilities: test.capabilities,
      updated_at: new Date().toISOString(),
    }).eq('id', integration.id);

    return NextResponse.json({
      ok: test.ok,
      message: test.message,
      capabilities: test.capabilities,
      last_tested_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Verification failed.' }, { status: 500 });
  }
}
