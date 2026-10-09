import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptCredential, encryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const integration_id = searchParams.get('integration_id');

    const supabase = createAdminClient();

    let query = supabase.from('integrations').select('*').eq('provider', 'google_search_console');
    if (integration_id) query = query.eq('id', integration_id);
    const { data: integration } = await query.maybeSingle();

    if (!integration) {
      return NextResponse.json({ properties: [] });
    }

    const { data: creds } = await supabase
      .from('integration_credentials')
      .select('encrypted_value')
      .eq('integration_id', integration.id)
      .single();

    let accessToken = '';
    let refreshToken = '';
    if (creds?.encrypted_value) {
      const parts = creds.encrypted_value.split(':::');
      accessToken = decryptCredential(parts[0]);
      if (parts[1]) refreshToken = decryptCredential(parts[1]);
    }

    if (accessToken && !accessToken.includes('simulated')) {
      let res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      // If token expired (401), automatically refresh using the refresh token
      if (res.status === 401 && refreshToken && !refreshToken.includes('simulated')) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        if (clientId && clientSecret) {
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: refreshToken,
              grant_type: 'refresh_token',
            }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            const encryptedAccess = encryptCredential(accessToken);
            const encryptedRefresh = encryptCredential(refreshToken);
            await supabase.from('integration_credentials').update({
              encrypted_value: `${encryptedAccess}:::${encryptedRefresh}`,
              updated_at: new Date().toISOString(),
            }).eq('integration_id', integration.id);

            // Retry with refreshed access token
            res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });
          }
        }
      }

      if (res.ok) {
        const data = await res.json();
        const siteEntries = data.siteEntry || [];
        const properties = siteEntries.map((s: any) => ({
          siteUrl: s.siteUrl,
          permissionLevel: s.permissionLevel,
        }));
        return NextResponse.json({ properties });
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || 'Google Search Console API request failed.';
        const isApiDisabled = errMsg.includes('disabled') || errMsg.includes('has not been used in project');
        return NextResponse.json({
          properties: [],
          error: errMsg,
          api_disabled: isApiDisabled,
          activation_url: 'https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=1036462372466',
        });
      }
    }

    return NextResponse.json({ properties: [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch GSC properties' }, { status: 500 });
  }
}
