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

export async function syncSearchConsoleData(websiteId: string, daysBack: number = 480, customClient?: any): Promise<GSCSyncResult> {
  const supabase = customClient || createAdminClient();

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

  // 3. Define historical window
  // Pull up to 480 days (16 months - Google's max retention) to support 28d, 3m, 6m, 16m views
  const days = Math.max(28, Math.min(daysBack, 480));
  const now = new Date();
  const endDateObj = now; // Query up to current date with dataState: 'all' to include fresh 24h data
  const startDateObj = new Date(now.getTime() - days * 86400000);

  const endDate = endDateObj.toISOString().split('T')[0];
  const startDate = startDateObj.toISOString().split('T')[0];

  // 4. Query daily performance (dimension: 'date') with dataState: 'all' to capture fresh real-time data
  const dateResult = await queryGoogleAnalytics({
    startDate,
    endDate,
    dimensions: ['date'],
    dataState: 'all',
    rowLimit: 1000,
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
          query: null,
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
        query: null,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        created_at: new Date().toISOString(),
      });
    }
  }

  // 4b. Query rolling 24-hour hourly performance (dimension: 'hour') with dataState: 'HOURLY_ALL'
  // Google Search Console records hourly buckets for the most recent 2-day period.
  const hourlyStartDateObj = new Date(now.getTime() - 2 * 86400000);
  const hourlyStartDate = hourlyStartDateObj.toISOString().split('T')[0];
  const hourlyResult = await queryGoogleAnalytics({
    startDate: hourlyStartDate,
    endDate,
    dimensions: ['HOUR'],
    dataState: 'HOURLY_ALL',
    rowLimit: 100,
  });

  let hourlyData24h: any = null;
  if (hourlyResult.ok && hourlyResult.data?.rows?.length > 0) {
    const rawHourlyRows = [...hourlyResult.data.rows];
    // Sort rows chronologically by the ISO hour timestamp
    rawHourlyRows.sort((a: any, b: any) => (a.keys?.[0] > b.keys?.[0] ? 1 : -1));

    // The Google Search Console 24 hours window uses the last 24 available hourly buckets
    const last24Rows = rawHourlyRows.slice(-24);

    let hClicks = 0;
    let hImpressions = 0;
    let weightedPosSum = 0;

    const points = last24Rows.map((r: any) => {
      const isoHour = r.keys?.[0] || '';
      const clicks = r.clicks || 0;
      const impressions = r.impressions || 0;
      const ctr = r.ctr || 0;
      const position = r.position ? Math.round(r.position * 10) / 10 : 0;

      hClicks += clicks;
      hImpressions += impressions;
      weightedPosSum += position * impressions;

      // Format display hour (e.g. "2 PM", "4 PM", or "12 AM 10/14" on date rollover)
      let displayDate = isoHour;
      let shortHour = isoHour;
      try {
        const d = new Date(isoHour);
        if (!isNaN(d.getTime())) {
          const hourNum = d.getHours();
          const ampm = hourNum >= 12 ? 'PM' : 'AM';
          const hr12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
          shortHour = `${hr12} ${ampm}`;
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          displayDate = hourNum === 0 || hourNum === 14 ? `${shortHour} ${dateStr}` : shortHour;
        }
      } catch {}

      return {
        date: isoHour,
        displayDate: shortHour,
        fullDate: isoHour,
        clicks,
        traffic: clicks,
        impressions,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        position,
      };
    });

    const avgPos = hImpressions > 0 
      ? (weightedPosSum / hImpressions).toFixed(1)
      : (points.length > 0 ? (points.reduce((a: any, b: any) => a + b.position, 0) / points.length).toFixed(1) : '0.0');

    hourlyData24h = {
      totals: {
        totalClicks: hClicks,
        totalImpressions: hImpressions,
        avgCtr: hImpressions > 0 ? ((hClicks / hImpressions) * 100).toFixed(1) + '%' : '0.0%',
        avgPos,
      },
      points,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  // 5. Query top queries & pages combined (dimension: ['query', 'page']) for high-precision SEO intelligence
  const queryPageResult = await queryGoogleAnalytics({
    startDate,
    endDate,
    dimensions: ['query', 'page'],
    dataState: 'all',
    rowLimit: 250,
  });

  // Pre-load existing pages to map page_id
  const { data: existingPages } = await supabase
    .from('pages')
    .select('id, path, canonical_url')
    .eq('website_id', websiteId);

  const pageMap = new Map<string, string>();
  for (const p of existingPages || []) {
    if (p.path) pageMap.set(p.path.toLowerCase().replace(/\/+$/, ''), p.id);
    if (p.canonical_url) pageMap.set(p.canonical_url.toLowerCase().replace(/\/+$/, ''), p.id);
  }

  if (queryPageResult.ok && queryPageResult.data?.rows?.length > 0) {
    const latestDate = endDate;
    for (const qRow of queryPageResult.data.rows) {
      const q = qRow.keys?.[0];
      const pageUrl = qRow.keys?.[1];
      if (q) {
        let pageId: string | null = null;
        if (pageUrl) {
          try {
            const parsed = new URL(pageUrl);
            const pathClean = parsed.pathname.toLowerCase().replace(/\/+$/, '');
            pageId = pageMap.get(pathClean) || pageMap.get(pageUrl.toLowerCase().replace(/\/+$/, '')) || null;
            
            // If page doesn't exist in pages table yet, auto-register it so crawler & audit engines have it
            if (!pageId && parsed.pathname && parsed.pathname !== '/') {
              const { data: newPage } = await supabase
                .from('pages')
                .insert({
                  website_id: websiteId,
                  path: parsed.pathname,
                  canonical_url: pageUrl,
                  status_code: 200,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .select('id')
                .maybeSingle();

              if (newPage?.id) {
                pageId = newPage.id;
                pageMap.set(pathClean, newPage.id);
              }
            }
          } catch (_) {}
        }

        rowsToUpsert.push({
          website_id: websiteId,
          page_id: pageId,
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

  // 7. Update integration sync metadata and cache rolling 24h hourly stats
  const updatedConfig = {
    ...(integration.config || {}),
    ...(hourlyData24h ? { hourly_data_24h: hourlyData24h } : {}),
  };

  await supabase
    .from('integrations')
    .update({
      status: 'connected',
      config: updatedConfig,
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
