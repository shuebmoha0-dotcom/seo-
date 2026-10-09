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

    const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'outdart.com';
    const isLocal = rawHost.includes('localhost') || rawHost.includes('127.0.0.1');
    const siteUrl = isLocal ? `http://${rawHost}` : 'https://outdart.com';
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

    // Fetch user verified properties directly from Google Webmasters API
    let matchedProperty: string | null = null;
    let availableProperties: Array<{ siteUrl: string; permissionLevel: string }> = [];

    if (accessToken && !accessToken.includes('simulated')) {
      try {
        const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          const entries = sitesData.siteEntry || [];
          availableProperties = entries.map((s: any) => ({
            siteUrl: s.siteUrl,
            permissionLevel: s.permissionLevel,
          }));
        }
      } catch (siteErr) {
        console.error('[GSC OAuth Callback] Failed to fetch sites from Google:', siteErr);
      }
    }

    // Lookup current website domain/url to auto-match
    let targetDomain = '';
    if (website_id && website_id !== 'default') {
      const { data: web } = await supabase.from('websites').select('domain, url').eq('id', website_id).maybeSingle();
      if (web) {
        targetDomain = (web.domain || web.url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      }
    }

    // Auto-match algorithm:
    // If a property matches the client website domain or URL, automatically select it!
    if (availableProperties.length > 0) {
      if (targetDomain) {
        const directMatch = availableProperties.find(p => {
          const cleanP = p.siteUrl.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
          return cleanP === targetDomain;
        });
        if (directMatch) {
          matchedProperty = directMatch.siteUrl;
        }
      }

      // If only 1 property exists in the user's GSC account, auto-pick it
      if (!matchedProperty && availableProperties.length === 1) {
        matchedProperty = availableProperties[0].siteUrl;
      }
    }

    const isConnected = !!matchedProperty;
    const payload = {
      provider: 'google_search_console',
      display_name: 'Google Search Console',
      status: isConnected ? 'connected' : 'action_required',
      status_message: isConnected
        ? `Connected to ${matchedProperty}. Performance metrics actively synced.`
        : 'OAuth authorized — select a property to complete connection.',
      has_access_token: true,
      has_refresh_token: true,
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
      config: isConnected ? { property_url: matchedProperty, auto_matched: true } : {},
      capabilities: ['GET_SEARCH_ANALYTICS', 'READ_ANALYTICS'],
      last_tested_at: new Date().toISOString(),
      last_success_at: isConnected ? new Date().toISOString() : null,
      last_synced_at: isConnected ? new Date().toISOString() : null,
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

      const { error: credErr } = await supabase.from('integration_credentials').upsert({
        integration_id: integrationId,
        credential_type: 'oauth_tokens',
        encrypted_value: `${encryptedAccess}:::${encryptedRefresh}`,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'integration_id,credential_type' });

      if (credErr) {
        console.error('[GSC OAuth Callback] Credential upsert error:', credErr);
        throw credErr;
      }
    }

    if (isConnected) {
      return NextResponse.redirect(new URL(`/integrations?gsc_connected=true&property=${encodeURIComponent(matchedProperty!)}`, request.url));
    }

    return NextResponse.redirect(new URL(`/integrations?gsc_select=true&integration_id=${integrationId}`, request.url));
  } catch (error: any) {
    console.error('[GSC OAuth Callback] Error:', error);
    return NextResponse.redirect(new URL('/integrations?error=oauth_failed', request.url));
  }
}
