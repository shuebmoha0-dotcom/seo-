/**
 * Google Indexing & Multi-Search Engine IndexNow Service
 * 
 * Provides automated, permission-gated URL indexing for:
 * 1. Google Indexing API (URL_UPDATED notifications)
 * 2. IndexNow (Bing, Yandex, Naver, Seznam)
 * 3. Google Search Console URL Inspection
 */

import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';

export interface IndexingResult {
  success: boolean;
  url: string;
  google?: {
    submitted: boolean;
    notifyTime?: string;
    error?: string;
  };
  indexNow?: {
    submitted: boolean;
    statusCode?: number;
    error?: string;
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
   * Submits a URL for instant indexing to Google and IndexNow
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

    // 1. Google Indexing API Submission
    try {
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      let authClient: any = null;

      if (serviceAccountJson) {
        try {
          const credentials = JSON.parse(serviceAccountJson);
          authClient = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/indexing'],
          });
        } catch (e: any) {
          console.warn('[GoogleIndexingService] Invalid service account JSON:', e.message);
        }
      }

      if (!authClient && websiteId) {
        const supabase = createAdminClient();
        const { data: creds } = await supabase
          .from('integration_credentials')
          .select('encrypted_value, credential_type')
          .eq('credential_type', 'google_oauth_token')
          .limit(1)
          .maybeSingle();

        if (creds?.encrypted_value) {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: creds.encrypted_value });
          authClient = auth;
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
        googleError = 'Google Service Account or OAuth not configured. Setup service account in Settings > Google Indexing.';
      }
    } catch (gErr: any) {
      console.warn('[GoogleIndexingService] Google API call failed:', gErr.message || gErr);
      googleError = gErr.message || 'Google Indexing API call failed';
    }

    result.google = {
      submitted: googleSubmitted,
      notifyTime: googleNotifyTime,
      error: googleError,
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
        keyLocation: 'https://' + host + '/' + key + '.txt',
        urlList: [url],
      };

      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowBody),
        signal: AbortSignal.timeout(6000),
      });

      indexNowStatusCode = res.status;
      if (res.ok || res.status === 200 || res.status === 202) {
        indexNowSubmitted = true;
      } else {
        indexNowError = 'IndexNow returned HTTP ' + res.status;
      }
    } catch (inErr: any) {
      console.warn('[GoogleIndexingService] IndexNow submission error:', inErr.message || inErr);
      indexNowError = inErr.message || 'IndexNow network error';
    }

    result.indexNow = {
      submitted: indexNowSubmitted,
      statusCode: indexNowStatusCode,
      error: indexNowError,
    };

    result.success = googleSubmitted || indexNowSubmitted;

    const parts = [];
    if (googleSubmitted) {
      parts.push('🟢 Google Indexing API: Submitted (' + type + ')');
    } else if (googleError) {
      parts.push('⚠️ Google Indexing API: ' + googleError);
    }

    if (indexNowSubmitted) {
      parts.push('🟢 IndexNow (Bing/Yandex): Submitted (HTTP ' + (indexNowStatusCode || 200) + ')');
    } else if (indexNowError) {
      parts.push('⚠️ IndexNow: ' + indexNowError);
    }

    result.summary = parts.join('\n');

    try {
      const supabase = createAdminClient();
      await supabase.from('project_memory').insert({
        website_id: websiteId || null,
        category: 'workflow',
        content: 'Indexing requested for ' + url + ': ' + result.summary,
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
  }): Promise<UrlInspectionResult> {
    const { inspectionUrl, siteUrl, accessToken } = params;
    try {
      const token = accessToken || process.env.GOOGLE_SEARCH_CONSOLE_TOKEN;
      if (!token) {
        return {
          success: false,
          url: inspectionUrl,
          error: 'Google Search Console access token is required to inspect URLs.',
        };
      }

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: token });

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
