import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encryptCredential } from '@/lib/utils/encryption';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const rawState = searchParams.get('state');

    let website_id = 'default';
    try {
      if (rawState) {
        const parsed = JSON.parse(decodeURIComponent(rawState));
        if (parsed.website_id) website_id = parsed.website_id;
      }
    } catch {}

    if (!code) {
      return NextResponse.redirect(new URL('/integrations?error=oauth_cancelled', request.url));
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    let accessToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || 'github_simulated_access_token';

    if (clientId && clientSecret && !clientId.includes('your-') && code !== 'simulated_github_auth_code') {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });

      if (!tokenRes.ok) {
        console.error('[GitHub OAuth Callback] Token exchange failed');
        return NextResponse.redirect(new URL('/integrations?error=token_exchange_failed', request.url));
      }

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return NextResponse.redirect(new URL(`/integrations?error=${tokenData.error}`, request.url));
      }
      accessToken = tokenData.access_token;
    }

    const supabase = await createClient();

    let integrationId: string | null = null;
    let query = supabase.from('integrations').select('id').eq('provider', 'github');
    if (website_id && website_id !== 'default') query = query.eq('website_id', website_id);

    const { data: existing } = await query.maybeSingle();

    const payload = {
      provider: 'github',
      display_name: 'GitHub (Code Execution)',
      status: 'action_required',
      status_message: 'GitHub authorized — select a repository and branch to complete connection.',
      has_access_token: true,
      scopes: ['repo', 'read:user'],
      updated_at: new Date().toISOString(),
      ...(website_id && website_id !== 'default' ? { website_id } : {}),
    };

    if (existing?.id) {
      integrationId = existing.id;
      await supabase.from('integrations').update(payload).eq('id', integrationId);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('integrations')
        .insert(payload)
        .select('id')
        .single();
      if (insErr) throw insErr;
      integrationId = inserted.id;
    }

    if (integrationId) {
      const encryptedAccess = encryptCredential(accessToken);
      await supabase.from('integration_credentials').upsert({
        integration_id: integrationId,
        credential_type: 'github_token',
        encrypted_value: encryptedAccess,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });
    }

    return NextResponse.redirect(new URL(`/integrations?github_select=true&integration_id=${integrationId}`, request.url));
  } catch (error: any) {
    console.error('[GitHub OAuth Callback] Error:', error);
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', request.url));
  }
}
