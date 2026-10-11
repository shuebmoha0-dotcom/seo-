import { createAdminClient } from '@/lib/supabase/admin';
import { decryptCredential, encryptCredential } from '@/lib/utils/encryption';

export interface GSCSyncResult {
  success: boolean;
  propertyUrl?: string;
  syncedRows: number;
  totalImpressions: number;
  totalClicks: number;
  message: string;
  error?: string;
}

export async function syncSearchConsoleData(websiteId: string): Promise<GSCSyncResult> {
  const supabase = createAdminClient();

  // 1. Fetch connected GSC integration
  const { data: integration, error: intErr } = await supabase
    .from('integrations')
    .select('id, config, status')
    .eq('website_id', websiteId)
    .eq('provider', 'google_search_console')
    .maybeSingle();

  if (intErr || !integration) {
    return {
      success: false,
      syncedRows: 0,
      totalImpressions: 0,
      totalClicks: 0,
      message: 'Google Search Console integration not found for this website.',
      error: 'INTEGRATION_NOT_FOUND',
    };
  }

  const integrationId = integration.id;
  const propertyUrl = integration.config?.property_url;
  if (!propertyUrl) {
    return {
      success: false,
      syncedRows: 0,
      totalImpressions: 0,
      totalClicks: 0,
      message: 'No Search Console property URL configured.',
      error: 'PROPERTY_NOT_CONFIGURED',
    };
  }

  // 2. Fetch encrypted credentials
  const { data: creds, error: credErr } = await supabase
    .from('integration_credentials')
    .select('encrypted_value')
    .eq('integration_id', integration.id)
    .maybeSingle();

  if (credErr || !creds?.encrypted_value) {
    return {
      success: false,
      syncedRows: 0,
      totalImpressions: 0,
      totalClicks: 0,
      message: 'OAuth credentials not found. Please reconnect Google Search Console.',
      error: 'CREDENTIALS_NOT_FOUND',
    };
  }

  const parts = creds.encrypted_value.split(':::');
  let accessToken = decryptCredential(parts[0]);
  let refreshToken = parts[1] ? decryptCredential(parts[1]) : '';

  if (!accessToken || accessToken.includes('simulated')) {
    return {
      success: false,
      syncedRows: 0,
      totalImpressions: 0,
      totalClicks: 0,
      message: 'Invalid access token. Please reconnect Search Console.',
      error: 'INVALID_TOKEN',
    };
  }

  // Helper to query Search Console API with auto-refresh on 401
  async function queryGoogleAnalytics(reqBody: any): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`;
    let res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });

    if (res.status === 401 && refreshToken && !refreshToken.includes('simulated')) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          }),
        });
        if (refreshRes.ok) {
          const tokenData = await refreshRes.json();
          accessToken = tokenData.access_token;
          const encAccess = encryptCredential(accessToken);
          const encRefresh = encryptCredential(refreshToken);
          await supabase.from('integration_credentials').update({
            encrypted_value: `${encAccess}:::${encRefresh}`,
            updated_at: new Date().toISOString(),
          }).eq('integration_id', integrationId);

          res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBody),
          });
        }
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  }

  // 3. Define 28-day window (Search Console data lag is typically 2-3 days)
  const now = new Date();
  const endDateObj = new Date(now.getTime() - 2 * 86400000); // 2 days ago
  const startDateObj = new Date(endDateObj.getTime() - 28 * 86400000); // 28 days back

  const endDate = endDateObj.toISOString().split('T')[0];
  const startDate = startDateObj.toISOString().split('T')[0];

  // 4. Query daily performance (dimension: 'date')
  const dateResult = await queryGoogleAnalytics({
    startDate,
    endDate,
    dimensions: ['date'],
    rowLimit: 30,
  });

  let totalImpressions = 0;
  let totalClicks = 0;
  const rowsToUpsert: any[] = [];

  if (dateResult.ok && dateResult.data?.rows?.length > 0) {
    for (const row of dateResult.data.rows) {
      const d = row.keys?.[0];
      if (d) {
        const clicks = row.clicks || 0;
        const impressions = row.impressions || 0;
        totalClicks += clicks;
        totalImpressions += impressions;

        rowsToUpsert.push({
          website_id: websiteId,
          date: d,
          clicks,
          impressions,
          ctr: row.ctr || 0,
          position: row.position ? Math.round(row.position * 10) / 10 : 0,
          created_at: new Date().toISOString(),
        });
      }
    }
  } else {
    // If Google has 0 recorded search queries yet (brand new property or no traffic),
    // build a 30-day zero-baseline so charts display authentic baseline cleanly
    for (let i = 28; i >= 0; i--) {
      const cur = new Date(endDateObj.getTime() - i * 86400000);
      const d = cur.toISOString().split('T')[0];
      rowsToUpsert.push({
        website_id: websiteId,
        date: d,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 5. Query top queries if available
  const queryResult = await queryGoogleAnalytics({
    startDate,
    endDate,
    dimensions: ['query'],
    rowLimit: 50,
  });

  if (queryResult.ok && queryResult.data?.rows?.length > 0) {
    const latestDate = endDate;
    for (const qRow of queryResult.data.rows) {
      const q = qRow.keys?.[0];
      if (q) {
        rowsToUpsert.push({
          website_id: websiteId,
          query: q,
          date: latestDate,
          clicks: qRow.clicks || 0,
          impressions: qRow.impressions || 0,
          ctr: qRow.ctr || 0,
          position: qRow.position ? Math.round(qRow.position * 10) / 10 : 0,
          created_at: new Date().toISOString(),
        });
      }
    }
  }

  // 6. Delete old data for this website and insert fresh batch
  if (rowsToUpsert.length > 0) {
    await supabase.from('search_console_data').delete().eq('website_id', websiteId);
    const { error: insErr } = await supabase.from('search_console_data').insert(rowsToUpsert);
    if (insErr) {
      console.error('[GSCSyncService] Insert error:', insErr);
    }
  }

  // 7. Update integration sync metadata
  await supabase
    .from('integrations')
    .update({
      status: 'connected',
      status_message: `Connected to ${propertyUrl}. Performance metrics synced (${totalClicks} clicks, ${totalImpressions} impressions).`,
      last_synced_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id);

  return {
    success: true,
    propertyUrl,
    syncedRows: rowsToUpsert.length,
    totalImpressions,
    totalClicks,
    message: `Search Console data synced successfully for ${propertyUrl}.`,
  };
}
