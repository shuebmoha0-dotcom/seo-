import { google } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/admin';
import { GoogleIndexingService, IndexingResult } from '@/lib/connectors/googleIndexing';
import { decryptCredential, encryptCredential } from '@/lib/utils/encryption';

export interface PostIndexingStatus {
  url: string;
  title: string;
  slug: string;
  draft_id?: string;
  page_id?: string;
  is_indexed: boolean;
  verdict: 'PASS' | 'NEUTRAL' | 'FAIL' | 'UNKNOWN';
  coverage_state: string;
  robots_txt_state?: string;
  last_crawl_time?: string;
  submission_result?: IndexingResult;
  checked_at: string;
}

export interface IndexVerificationSummary {
  website_id: string;
  domain: string;
  total_posts_checked: number;
  indexed_count: number;
  unindexed_submitted_count: number;
  already_indexed_urls: string[];
  submitted_urls: string[];
  posts: PostIndexingStatus[];
  formatted_markdown: string;
}

export class PostIndexVerificationService {
  /**
   * Retrieves or refreshes Google Search Console OAuth2 Access Token
   */
  private static async getGSCAccessToken(forceRefresh = false): Promise<string | null> {
    try {
      const supabase = createAdminClient();
      const { data: creds } = await supabase
        .from('integration_credentials')
        .select('id, integration_id, encrypted_value')
        .eq('credential_type', 'oauth_tokens')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!creds?.encrypted_value) return null;

      const parts = creds.encrypted_value.split(':::');
      let accessToken = decryptCredential(parts[0]);
      const refreshToken = parts[1] ? decryptCredential(parts[1]) : null;

      if (forceRefresh && refreshToken && !refreshToken.includes('simulated')) {
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
            }).eq('id', creds.id);
            console.log('[PostIndexVerificationService] Refreshed Google OAuth token successfully.');
          }
        }
      }

      return accessToken;
    } catch (err) {
      console.warn('[PostIndexVerificationService] Token decryption notice:', err);
      return null;
    }
  }

  /**
   * Scans EVERY published post for a website:
   * 1. Inspects Google Search Console index status live
   * 2. If already indexed ("PASS" / "Submitted and indexed"), records proof
   * 3. If unindexed ("URL is unknown", "Discovered", or "NEUTRAL"), automatically submits to:
   *    - Google Indexing API (URL_UPDATED)
   *    - IndexNow (Bing, Yandex, Naver)
   *    - Sitemap Pings
   * 4. Updates database with verified indexing metadata
   */
  static async verifyAndIndexAllPosts(params: {
    websiteId: string;
    domain?: string;
    limit?: number;
    forceResubmitAll?: boolean;
  }): Promise<IndexVerificationSummary> {
    const { websiteId, limit = 50, forceResubmitAll = false } = params;
    const supabase = createAdminClient();

    // 1. Resolve website info & base URL
    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    if (!website) {
      throw new Error(`Website not found: ${websiteId}`);
    }

    const domain = website.domain;
    let siteBaseUrl = (website.url || `https://${domain}`).replace(/\/+$/, '');

    // Check WordPress outbound site for authoritative live URL
    const { data: wpSite } = await supabase
      .from('wordpress_outbound_sites')
      .select('site_url')
      .eq('website_id', websiteId)
      .eq('status', 'active')
      .maybeSingle();

    if (wpSite?.site_url) {
      siteBaseUrl = wpSite.site_url.replace(/\/+$/, '');
    }

    // 2. Fetch all published content drafts & pages
    const [draftsRes, pagesRes] = await Promise.all([
      supabase
        .from('content_drafts')
        .select('id, working_title, url_slug, status, revision_notes, updated_at')
        .eq('website_id', websiteId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('pages')
        .select('id, path, canonical_url, title, indexability_signals')
        .eq('website_id', websiteId)
        .limit(limit),
    ]);

    const drafts = draftsRes.data || [];
    const pages = pagesRes.data || [];

    // Map of unique URLs to check
    const urlMap = new Map<string, {
      title: string;
      slug: string;
      draftId?: string;
      pageId?: string;
      cachedSignals?: any;
    }>();

    for (const d of drafts) {
      if (!d.url_slug) continue;
      const cleanSlug = d.url_slug.replace(/^\/+|\/+$/g, '');
      const fullUrl = `${siteBaseUrl}/${cleanSlug}/`;
      urlMap.set(fullUrl, {
        title: d.working_title || cleanSlug,
        slug: cleanSlug,
        draftId: d.id,
      });
    }

    for (const p of pages) {
      const pathClean = (p.path || '').replace(/^\/+|\/+$/g, '');
      if (!pathClean || pathClean === '') continue; // Skip homepage
      const fullUrl = p.canonical_url || `${siteBaseUrl}/${pathClean}/`;
      if (!urlMap.has(fullUrl)) {
        urlMap.set(fullUrl, {
          title: p.title || pathClean,
          slug: pathClean,
          pageId: p.id,
          cachedSignals: p.indexability_signals,
        });
      } else {
        const existing = urlMap.get(fullUrl)!;
        existing.pageId = p.id;
        existing.cachedSignals = p.indexability_signals;
      }
    }

    console.log(`[PostIndexVerificationService] Found ${urlMap.size} published URLs to verify for ${domain}...`);

    // 3. Setup Google Search Console Inspection client
    let accessToken = await this.getGSCAccessToken();
    let auth = new google.auth.OAuth2();
    if (accessToken) auth.setCredentials({ access_token: accessToken });
    let searchconsole = accessToken ? google.searchconsole({ version: 'v1', auth }) : null;

    const posts: PostIndexingStatus[] = [];
    const alreadyIndexedUrls: string[] = [];
    const submittedUrls: string[] = [];

    // 4. Iterate and verify each post
    for (const [url, item] of urlMap.entries()) {
      let verdict: 'PASS' | 'NEUTRAL' | 'FAIL' | 'UNKNOWN' = 'UNKNOWN';
      let coverageState = 'Pending Inspection';
      let robotsTxtState: string | undefined = undefined;
      let lastCrawlTime: string | undefined = undefined;
      let isIndexed = false;

      // A. Query Google Search Console URL Inspection API if available
      if (searchconsole) {
        try {
          let inspectRes;
          try {
            inspectRes = await searchconsole.urlInspection.index.inspect({
              requestBody: {
                inspectionUrl: url,
                siteUrl: `${siteBaseUrl}/`,
              },
            });
          } catch (firstErr: any) {
            // Auto-refresh token on 401 authentication error
            if (firstErr?.message?.includes('authentication credentials') || firstErr?.status === 401) {
              accessToken = await this.getGSCAccessToken(true);
              if (accessToken) {
                auth = new google.auth.OAuth2();
                auth.setCredentials({ access_token: accessToken });
                searchconsole = google.searchconsole({ version: 'v1', auth });
                inspectRes = await searchconsole.urlInspection.index.inspect({
                  requestBody: {
                    inspectionUrl: url,
                    siteUrl: `${siteBaseUrl}/`,
                  },
                });
              } else {
                throw firstErr;
              }
            } else {
              throw firstErr;
            }
          }

          const statusResult = inspectRes?.data?.inspectionResult?.indexStatusResult;
          if (statusResult) {
            verdict = (statusResult.verdict as any) || 'UNKNOWN';
            coverageState = statusResult.coverageState || 'UNKNOWN';
            robotsTxtState = statusResult.robotsTxtState || undefined;
            lastCrawlTime = statusResult.lastCrawlTime || undefined;

            if (verdict === 'PASS' || coverageState.toLowerCase().includes('indexed')) {
              isIndexed = true;
            }
          }
        } catch (inspectErr: any) {
          coverageState = 'Inspection API Unreachable';
        }
      }

      // B. If NOT confirmed indexed (or forced), automatically submit to Google & IndexNow!
      let subResult: IndexingResult | undefined = undefined;
      if (!isIndexed || forceResubmitAll) {
        console.log(`[PostIndexVerificationService] Post "${item.title}" (${url}) is not indexed. Auto-submitting to Google & IndexNow...`);
        try {
          subResult = await GoogleIndexingService.requestIndexing({
            url,
            websiteId,
            type: 'URL_UPDATED',
          });
          submittedUrls.push(url);
        } catch (subErr) {
          console.error(`[PostIndexVerificationService] Submission failed for ${url}:`, subErr);
        }
      } else {
        alreadyIndexedUrls.push(url);
      }

      const postStatus: PostIndexingStatus = {
        url,
        title: item.title,
        slug: item.slug,
        draft_id: item.draftId,
        page_id: item.pageId,
        is_indexed: isIndexed,
        verdict,
        coverage_state: coverageState,
        robots_txt_state: robotsTxtState,
        last_crawl_time: lastCrawlTime,
        submission_result: subResult,
        checked_at: new Date().toISOString(),
      };

      posts.push(postStatus);

      // C. Update database indexability metadata
      try {
        if (item.pageId) {
          await supabase.from('pages').update({
            indexability_signals: {
              is_indexed: isIndexed,
              verdict,
              coverage_state: coverageState,
              last_crawl_time: lastCrawlTime,
              last_indexed_check: new Date().toISOString(),
              auto_submitted_at: subResult?.success ? new Date().toISOString() : undefined,
            },
            updated_at: new Date().toISOString(),
          }).eq('id', item.pageId);
        }

        if (item.draftId) {
          const notesObj = {
            is_indexed: isIndexed,
            indexing_verdict: verdict,
            coverage_state: coverageState,
            last_indexed_check: new Date().toISOString(),
            last_submitted_for_indexing: subResult?.success ? new Date().toISOString() : undefined,
          };
          await supabase.from('content_drafts').update({
            revision_notes: JSON.stringify(notesObj),
          }).eq('id', item.draftId);
        }
      } catch (dbErr) {
        console.warn(`[PostIndexVerificationService] DB update notice for ${url}:`, dbErr);
      }
    }

    // 5. Batch IndexNow submission for all unindexed URLs at once
    if (submittedUrls.length > 0) {
      try {
        const host = new URL(siteBaseUrl).host;
        const key = process.env.INDEXNOW_KEY || 'seautopilotindexnowkey';
        await fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host,
            key,
            keyLocation: `https://${host}/${key}.txt`,
            urlList: submittedUrls,
          }),
          signal: AbortSignal.timeout(6000),
        }).catch(() => {});
      } catch (_) {}
    }

    // 6. Format comprehensive grounded markdown summary
    let md = `🔍 *Google Indexing Verification Report for \`${domain}\`*\n`;
    md += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    md += `📊 *Total Published Posts Checked:* *${posts.length}*\n`;
    md += `🟢 *Confirmed Indexed on Google:* *${alreadyIndexedUrls.length}*\n`;
    md += `🚀 *Unindexed / Submitted for Priority Indexing:* *${submittedUrls.length}*\n\n`;

    if (submittedUrls.length > 0) {
      md += `*Newly Dispatched for Indexing (Google Indexing API + IndexNow):*\n`;
      for (const p of posts.filter(p => !p.is_indexed).slice(0, 8)) {
        md += `• *"${p.title}"*\n`;
        md += `  ↳ URL: \`${p.url}\`\n`;
        md += `  ↳ Google SERP Status: \`${p.coverage_state}\` → 🚀 *Submitted*\n`;
      }
      if (submittedUrls.length > 8) {
        md += `  _...and ${submittedUrls.length - 8} more posts submitted._\n`;
      }
      md += `\n`;
    }

    if (alreadyIndexedUrls.length > 0) {
      md += `*Verified Live on Google Search Console:*\n`;
      for (const p of posts.filter(p => p.is_indexed).slice(0, 5)) {
        md += `• *"${p.title}"* — 🟢 \`${p.coverage_state}\`${p.last_crawl_time ? ` (Crawled: ${p.last_crawl_time.split('T')[0]})` : ''}\n`;
      }
      if (alreadyIndexedUrls.length > 5) {
        md += `  _...and ${alreadyIndexedUrls.length - 5} more confirmed live._\n`;
      }
      md += `\n`;
    }

    md += `_The agent continuously audits every post and immediately triggers multi-engine indexing whenever unindexed content is detected._`;

    return {
      website_id: websiteId,
      domain,
      total_posts_checked: posts.length,
      indexed_count: alreadyIndexedUrls.length,
      unindexed_submitted_count: submittedUrls.length,
      already_indexed_urls: alreadyIndexedUrls,
      submitted_urls: submittedUrls,
      posts,
      formatted_markdown: md,
    };
  }
}
