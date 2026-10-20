/**
 * Google Indexing & Multi-Search Engine IndexNow Service
 * 
 * Provides automated, permission-gated URL indexing for:
 * 1. Google Indexing API (URL_UPDATED notifications)
 * 2. IndexNow (Bing, Yandex, Naver, Seznam)
 * 3. Search Engine Sitemap Pings (Google & Bing)
 * 4. Google Search Console URL Inspection
 */

import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'fs';
import path from 'path';

export interface IndexingResult {
  success: boolean;
  url: string;
  blocker?: {
    type: 'GSC_OWNER_REQUIRED' | 'INDEXNOW_KEY_MISSING' | 'API_DISABLED' | 'AUTH_ERROR';
    message: string;
    actionRequired: string;
  };
  google?: {
    submitted: boolean;
    notifyTime?: string;
    error?: string;
    activationUrl?: string;
    accountEmail?: string;
  };
  indexNow?: {
    submitted: boolean;
    statusCode?: number;
    error?: string;
  };
  sitemap?: {
    pinged: boolean;
    urls: string[];
  };
  summary: string;
}

export interface UrlInspectionResult {
  success: boolean;
  url: string;
  verdict?: string;
  coverageState?: string;
  robotTxtState?: string;
  indexingState?: string;
  lastCrawlTime?: string;
  pageFetchState?: string;
  error?: string;
}

export class GoogleIndexingService {
  /**
   * Loads Google Cloud Service Account credentials from environment variables or local files.
   */
  static getServiceAccountCredentials(): { client_email?: string; private_key?: string; project_id?: string } | null {
    // 1. Raw JSON string in GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_APPLICATION_CREDENTIALS_JSON
    const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (rawJson) {
      try {
        const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
        if (parsed?.client_email && parsed?.private_key) return parsed;
      } catch (e: any) {
        console.warn('[GoogleIndexingService] Invalid JSON in GOOGLE_SERVICE_ACCOUNT_KEY:', e.message);
      }
    }

    // 2. File path in GOOGLE_APPLICATION_CREDENTIALS
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath) {
      try {
        if (fs.existsSync(credPath)) {
          const fileContent = fs.readFileSync(credPath, 'utf8');
          const parsed = JSON.parse(fileContent);
          if (parsed?.client_email && parsed?.private_key) return parsed;
        }
      } catch (e: any) {
        console.warn('[GoogleIndexingService] Failed to read file from GOOGLE_APPLICATION_CREDENTIALS:', e.message);
      }
    }

    // 3. Fallback to gcp-service-account.json in project root
    try {
      const rootPath = path.join(process.cwd(), 'gcp-service-account.json');
      if (fs.existsSync(rootPath)) {
        const fileContent = fs.readFileSync(rootPath, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed?.client_email && parsed?.private_key) return parsed;
      }
    } catch (_) {}

    return null;
  }

  /**
   * Submits a URL for instant indexing to Google, IndexNow, and Search Engine re-crawl pings
   */
  static async requestIndexing(params: {
    url: string;
    websiteId?: string;
    type?: 'URL_UPDATED' | 'URL_DELETED';
  }): Promise<IndexingResult> {
    const { url, websiteId, type = 'URL_UPDATED' } = params;
    const result: IndexingResult = {
      success: false,
      url,
      summary: '',
    };

    let googleSubmitted = false;
    let googleError: string | undefined;
    let googleNotifyTime: string | undefined;
    let googleActivationUrl: string | undefined;

    const credentials = this.getServiceAccountCredentials();
    const serviceAccountEmail = credentials?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    // 1. Google Indexing API Submission
    try {
      let authClient: any = null;

      if (credentials?.client_email && credentials?.private_key) {
        authClient = new google.auth.JWT({
          email: credentials.client_email,
          key: credentials.private_key,
          scopes: ['https://www.googleapis.com/auth/indexing'],
        });
      }

      // If no service account, check for saved OAuth token in database
      if (!authClient && websiteId) {
        const supabase = createAdminClient();
        const { data: intg } = await supabase
          .from('integrations')
          .select('id')
          .eq('website_id', websiteId)
          .eq('provider', 'google_search_console')
          .maybeSingle();

        if (intg?.id) {
          const { data: creds } = await supabase
            .from('integration_credentials')
            .select('encrypted_value, credential_type')
            .eq('integration_id', intg.id)
            .maybeSingle();

          if (creds?.encrypted_value) {
            const { decryptCredential } = await import('@/lib/utils/encryption');
            const parts = creds.encrypted_value.split(':::');
            const token = decryptCredential(parts[0]);
            if (token) {
              const auth = new google.auth.OAuth2();
              auth.setCredentials({ access_token: token });
              authClient = auth;
            }
          }
        }
      }

      if (authClient) {
        const indexing = google.indexing({
          version: 'v3',
          auth: authClient,
        });

        const res = await indexing.urlNotifications.publish({
          requestBody: {
            url,
            type,
          },
        });

        if (res.data?.urlNotificationMetadata?.latestUpdate?.notifyTime) {
          googleSubmitted = true;
          googleNotifyTime = res.data.urlNotificationMetadata.latestUpdate.notifyTime;
        } else {
          googleSubmitted = true;
        }
      } else {
        googleError = 'Google Service Account credentials not found on server.';
      }
    } catch (gErr: any) {
      const respData = gErr?.response?.data;
      const rawMessage = respData?.error?.message || gErr?.message || 'Google Indexing API call failed';
      const reason = respData?.error?.details?.[0]?.reason || respData?.error?.errors?.[0]?.reason;
      const actUrl = respData?.error?.details?.[0]?.metadata?.activationUrl || respData?.error?.details?.[2]?.links?.[0]?.url;

      if (actUrl) googleActivationUrl = actUrl;

      if (rawMessage.includes('Web Search Indexing API has not been used') || reason === 'SERVICE_DISABLED') {
        googleError = `Web Search Indexing API is disabled in GCP project. Enable at: ${actUrl || 'https://console.cloud.google.com/apis/library/indexing.googleapis.com'}`;
      } else if (rawMessage.includes('Permission denied') || respData?.error?.code === 403) {
        googleError = `GSC Owner Verification Required: Service Account (${serviceAccountEmail || 'agent'}) must be added as an Owner in Google Search Console for this domain.`;
      } else {
        googleError = rawMessage;
      }
    }

    result.google = {
      submitted: googleSubmitted,
      notifyTime: googleNotifyTime,
      error: googleError,
      activationUrl: googleActivationUrl,
      accountEmail: serviceAccountEmail,
    };

    // 2. IndexNow API Submission (Bing, Yandex, Naver, Seznam)
    let indexNowSubmitted = false;
    let indexNowError: string | undefined;
    let indexNowStatusCode: number | undefined;

    try {
      const parsedUrl = new URL(url);
      const host = parsedUrl.host;
      const key = process.env.INDEXNOW_KEY || 'seautopilotindexnowkey';

      const indexNowBody = {
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: [url],
      };

      // Submit to both primary IndexNow gateway and Bing directly
      const [resIndexNow] = await Promise.allSettled([
        fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(indexNowBody),
          signal: AbortSignal.timeout(6000),
        }),
        fetch('https://www.bing.com/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(indexNowBody),
          signal: AbortSignal.timeout(6000),
        }),
      ]);

      if (resIndexNow.status === 'fulfilled') {
        const response = resIndexNow.value;
        indexNowStatusCode = response.status;
        if (response.ok || response.status === 200 || response.status === 202) {
          indexNowSubmitted = true;
        } else {
          indexNowError = `IndexNow returned HTTP ${response.status}`;
        }
      } else {
        indexNowError = resIndexNow.reason?.message || 'IndexNow request failed';
      }
    } catch (inErr: any) {
      indexNowError = inErr.message || 'IndexNow network error';
    }

    result.indexNow = {
      submitted: indexNowSubmitted,
      statusCode: indexNowStatusCode,
      error: indexNowError,
    };

    // 3. Search Engine Sitemap & Crawler Pings (Google & Bing)
    let sitemapPinged = false;
    const pingedUrls: string[] = [];
    try {
      const parsedUrl = new URL(url);
      const sitemapUrl = `https://${parsedUrl.host}/sitemap.xml`;
      await Promise.allSettled([
        fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { signal: AbortSignal.timeout(4000) }),
        fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`, { signal: AbortSignal.timeout(4000) }),
      ]);
      sitemapPinged = true;
      pingedUrls.push(sitemapUrl);
    } catch (_) {}

    result.sitemap = {
      pinged: sitemapPinged,
      urls: pingedUrls,
    };

    result.success = googleSubmitted || indexNowSubmitted;

    if (!googleSubmitted && googleError?.includes('Owner Verification Required')) {
      result.blocker = {
        type: 'GSC_OWNER_REQUIRED',
        message: googleError,
        actionRequired: `Add service account "${serviceAccountEmail || 'agent'}" as Owner in Google Search Console under Settings -> Users and permissions.`,
      };
    } else if (!indexNowSubmitted && indexNowError?.includes('403')) {
      result.blocker = {
        type: 'INDEXNOW_KEY_MISSING',
        message: indexNowError,
        actionRequired: 'IndexNow key verification file missing from site root.',
      };
    }

    // Build user-facing Markdown summary
    const parts = [];
    parts.push(`📄 *Target URL:* \`${url}\`\n`);

    if (googleSubmitted) {
      parts.push(`🟢 *Google Indexing API:* Submitted successfully (${type})`);
      if (googleNotifyTime) parts.push(`   _Notified at:_ \`${googleNotifyTime}\``);
    } else if (googleError) {
      parts.push(`⚠️ *Google Indexing API:* ${googleError}`);
    }

    if (indexNowSubmitted) {
      parts.push(`🟢 *IndexNow (Bing, Yandex, Naver):* Submitted successfully (HTTP ${indexNowStatusCode || 200})`);
    } else if (indexNowError) {
      parts.push(`⚠️ *IndexNow:* ${indexNowError}`);
    }

    if (sitemapPinged) {
      parts.push(`🟢 *Sitemap Re-crawl Ping:* Dispatched to Google & Bing crawlers`);
    }

    if (result.blocker) {
      parts.push(`\n🚨 *Action Required:* ${result.blocker.actionRequired}`);
    }

    result.summary = parts.join('\n');

    // Save submission log to project_memory
    try {
      const supabase = createAdminClient();
      await supabase.from('project_memory').insert({
        website_id: websiteId || null,
        category: 'workflow',
        content: `Indexing submission for ${url}:\n${result.summary}`,
        source: 'user_instruction',
        confidence: 'high',
      });
    } catch (_) {}

    return result;
  }

  /**
   * Inspects a URL using Google Search Console URL Inspection API
   */
  static async inspectUrl(params: {
    inspectionUrl: string;
    siteUrl: string;
    accessToken?: string;
    websiteId?: string;
  }): Promise<UrlInspectionResult> {
    const { inspectionUrl, siteUrl, accessToken, websiteId } = params;
    try {
      let token = accessToken || process.env.GOOGLE_SEARCH_CONSOLE_TOKEN;
      let refreshToken: string | undefined = undefined;

      if (!token) {
        try {
          const supabase = createAdminClient();
          let intQuery = supabase
            .from('integrations')
            .select('id, config')
            .eq('provider', 'google_search_console');

          if (websiteId) {
            intQuery = intQuery.eq('website_id', websiteId);
          }

          const { data: intRows } = await intQuery;
          // Prefer row matching siteUrl/domain or first available
          const cleanSiteUrl = siteUrl.replace(/\/+$/, '').toLowerCase();
          const targetInt = (intRows || []).find((r: any) => {
            const prop = (r.config?.property_url || '').replace(/\/+$/, '').toLowerCase();
            return prop.includes(cleanSiteUrl) || cleanSiteUrl.includes(prop);
          }) || (intRows && intRows[0]);

          if (targetInt?.id) {
            const { data: creds } = await supabase
              .from('integration_credentials')
              .select('encrypted_value')
              .eq('integration_id', targetInt.id)
              .maybeSingle();

            if (creds?.encrypted_value) {
              const { decryptCredential } = await import('@/lib/utils/encryption');
              const parts = creds.encrypted_value.split(':::');
              token = decryptCredential(parts[0]);
              if (parts[1]) {
                refreshToken = decryptCredential(parts[1]);
              }
            }
          }
        } catch (dbErr) {
          console.warn('[GoogleIndexingService] Error loading credentials from DB:', dbErr);
        }
      }

      if (!token) {
        return {
          success: false,
          url: inspectionUrl,
          error: 'Google Search Console access token is required to inspect URLs.',
        };
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const auth = new google.auth.OAuth2(clientId, clientSecret);
      auth.setCredentials({
        access_token: token,
        refresh_token: refreshToken || undefined,
      });

      const searchconsole = google.searchconsole({
        version: 'v1',
        auth,
      });

      const res = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl,
          siteUrl,
        },
      });

      const inspectionResult = res.data?.inspectionResult;
      const indexStatusResult = inspectionResult?.indexStatusResult;

      return {
        success: true,
        url: inspectionUrl,
        verdict: indexStatusResult?.verdict || 'UNKNOWN',
        coverageState: indexStatusResult?.coverageState || 'UNKNOWN',
        robotTxtState: indexStatusResult?.robotsTxtState || 'UNKNOWN',
        indexingState: indexStatusResult?.indexingState || 'UNKNOWN',
        lastCrawlTime: indexStatusResult?.lastCrawlTime || undefined,
        pageFetchState: indexStatusResult?.pageFetchState || 'UNKNOWN',
      };
    } catch (err: any) {
      console.warn('[GoogleIndexingService] URL Inspection error:', err.message || err);
      return {
        success: false,
        url: inspectionUrl,
        error: err.message || 'Inspection request failed',
      };
    }
  }
}
