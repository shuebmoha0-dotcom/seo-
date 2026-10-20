import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptCredential } from '@/lib/utils/encryption';
import { GoogleIndexingService } from '@/lib/connectors/googleIndexing';
import { google } from 'googleapis';

export async function GET() {
  const platformCreds = GoogleIndexingService.getServiceAccountCredentials();
  return NextResponse.json({
    success: true,
    client_email: platformCreds?.client_email || 'agent-398@gen-lang-client-0938255671.iam.gserviceaccount.com',
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, property_url, service_account_json, client_email, private_key, use_platform_account } = body;

    if (!property_url) {
      return NextResponse.json({ success: false, error: 'Property URL or Domain (e.g. https://example.com or sc-domain:example.com) is required.' }, { status: 400 });
    }

    let parsedEmail = client_email;
    let parsedKey = private_key;

    if (use_platform_account) {
      const platformCreds = GoogleIndexingService.getServiceAccountCredentials();
      if (!platformCreds?.client_email || !platformCreds?.private_key) {
        return NextResponse.json({
          success: false,
          error: 'Platform service account credentials are not configured on the server. Please contact support or provide a custom Service Account key.',
        }, { status: 500 });
      }
      parsedEmail = platformCreds.client_email;
      parsedKey = platformCreds.private_key;
    } else if (service_account_json) {
      try {
        const json = typeof service_account_json === 'string' ? JSON.parse(service_account_json) : service_account_json;
        parsedEmail = json.client_email || parsedEmail;
        parsedKey = json.private_key || parsedKey;
      } catch (pErr) {
        return NextResponse.json({ success: false, error: 'Invalid Service Account JSON format.' }, { status: 400 });
      }
    }

    if (!parsedEmail || !parsedKey) {
      return NextResponse.json({ success: false, error: 'Client Email and Private Key are required.' }, { status: 400 });
    }

    // Verify service account permissions using Google API
    try {
      const auth = new google.auth.JWT({
        email: parsedEmail,
        key: parsedKey,
        scopes: [
          'https://www.googleapis.com/auth/webmasters.readonly',
          'https://www.googleapis.com/auth/indexing',
        ],
      });

      const sc = google.searchconsole({ version: 'v1', auth });
      await sc.searchanalytics.query({
        siteUrl: property_url,
        requestBody: {
          startDate: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          rowLimit: 1,
        },
      });
    } catch (authErr: any) {
      console.warn('[GSC Service Account Test]', authErr.message);
      if (authErr.message?.includes('User does not have sufficient permissions') || authErr.code === 403) {
        return NextResponse.json({
          success: false,
          error: `Google Search Console permission error: Please add "${parsedEmail}" as an Owner in your Google Search Console settings (Settings > Users and permissions) for "${property_url}".`,
        }, { status: 403 });
      }
    }

    const supabase = createAdminClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_search_console');
    if (website_id) query = query.eq('website_id', website_id);

    const { data: existing } = await query.maybeSingle();

    const payload = {
      provider: 'google_search_console',
      display_name: 'Google Search Console',
      status: 'connected',
      status_message: `Connected via Service Account: ${property_url}`,
      config: {
        property_url,
        auth_type: 'service_account',
        client_email: parsedEmail,
      },
      capabilities: ['GET_SEARCH_ANALYTICS', 'READ_ANALYTICS', 'INDEX_URLS', 'URL_INSPECTION'],
      last_tested_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(website_id ? { website_id } : {}),
    };

    let integrationId = existing?.id;
    if (integrationId) {
      await supabase.from('integrations').update(payload).eq('id', integrationId);
    } else {
      const { data: inserted, error: insErr } = await supabase.from('integrations').insert(payload).select('id').single();
      if (insErr) throw insErr;
      integrationId = inserted.id;
    }

    const encryptedKey = encryptCredential(parsedKey);
    await supabase.from('integration_credentials').upsert({
      integration_id: integrationId,
      credential_type: 'service_account',
      encrypted_value: `${parsedEmail}:::${encryptedKey}`,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'integration_id,credential_type' });

    return NextResponse.json({
      success: true,
      message: `Google Search Console connected successfully to ${property_url}!`,
      property_url,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Failed to connect Service Account' }, { status: 500 });
  }
}
