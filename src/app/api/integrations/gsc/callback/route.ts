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

    const host = request.headers.get('host') || 'seo-hazel-eight.vercel.app';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    const redirectUri = `${siteUrl}/api/integrations/gsc/callback`;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    let accessToken = 'gsc_access_token_simulated';
    let refreshToken = 'gsc_refresh_token_simulated';
    let expiresIn = 3600;

    if (clientId && clientSecret && !clientId.includes('your-') && code !== 'simulated_gsc_auth_code') {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('[GSC OAuth Callback] Token exchange failed:', err);
        return NextResponse.redirect(new URL('/integrations?error=token_exchange_failed', request.url));
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token || refreshToken;
      expiresIn = tokenData.expires_in || 3600;
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    // Upsert integration record in action_required (awaiting property selection)
    let integrationId: string | null = null;
    let query = supabase.from('integrations').select('id').eq('provider', 'google_search_console');
    if (website_id && website_id !== 'default') query = query.eq('website_id', website_id);

    const { data: existing } = await query.maybeSingle();

    const payload = {
      provider: 'google_search_console',
      display_name: 'Google Search Console',
      status: 'action_required',
      status_message: 'OAuth authorized — select a property to complete connection.',
      has_access_token: true,
      has_refresh_token: true,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
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
      const encryptedRefresh = encryptCredential(refreshToken);
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await supabase.from('integration_credentials').upsert({
        integration_id: integrationId,
        credential_type: 'oauth_tokens',
        encrypted_value: `${encryptedAccess}:::${encryptedRefresh}`,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });
    }

    return NextResponse.redirect(new URL(`/integrations?gsc_select=true&integration_id=${integrationId}`, request.url));
  } catch (error: any) {
    console.error('[GSC OAuth Callback] Error:', error);
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', request.url));
  }
}
