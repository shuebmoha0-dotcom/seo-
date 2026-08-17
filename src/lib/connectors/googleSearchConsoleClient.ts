/**
 * Google Search Console Client
 * 
 * Official Google Webmasters/Search Console API client.
 * Tokens are isolated from agents.
 */

import { google, searchconsole_v1 } from 'googleapis';

export interface GSCPerformanceRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

export interface GSCAnalyticsOptions {
  startDate: string;
  endDate: string;
  dimensions?: Array<'query' | 'page' | 'country' | 'device' | 'searchAppearance' | 'date'>;
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: any[];
}

export class GoogleSearchConsoleClient {
  private api: searchconsole_v1.Searchconsole;
  private siteUrl?: string;

  constructor(accessToken: string, siteUrl?: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    this.api = google.searchconsole({
      version: 'v1',
      auth,
    });
    this.siteUrl = siteUrl;
  }

  /**
   * 1. Retrieve list of verified Search Console sites / properties
   */
  async getSites(): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    try {
      const res = await this.api.sites.list();
      const entries = res.data.siteEntry || [];
      return entries.map(e => ({
        siteUrl: e.siteUrl || '',
        permissionLevel: e.permissionLevel || 'siteOwner',
      }));
    } catch (err: any) {
      if (err.code === 401 || err.status === 401) {
        throw new Error('REAUTH_REQUIRED: Google OAuth token has expired or was revoked.');
      }
      throw new Error(`Search Console sites fetch error: ${err.message}`);
    }
  }

  /**
   * 2. Query search performance analytics (queries, pages, clicks, impressions, ctr, position)
   */
  async getSearchAnalytics(options: GSCAnalyticsOptions, customSiteUrl?: string): Promise<GSCPerformanceRow[]> {
    const targetSite = customSiteUrl || this.siteUrl;
    if (!targetSite) {
      throw new Error('Site URL is required to query Search Console performance data.');
    }

    try {
      const res = await this.api.searchanalytics.query({
        siteUrl: targetSite,
        requestBody: {
          startDate: options.startDate,
          endDate: options.endDate,
          dimensions: options.dimensions || ['query', 'page'],
          rowLimit: options.rowLimit || 1000,
          startRow: options.startRow || 0,
          dimensionFilterGroups: options.dimensionFilterGroups,
        },
      });

      return (res.data.rows || []).map(r => ({
        keys: r.keys,
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));
    } catch (err: any) {
      if (err.code === 401 || err.status === 401) {
        throw new Error('REAUTH_REQUIRED: Google OAuth token has expired. Please reconnect Search Console.');
      }
      if (err.code === 403 || err.status === 403) {
        throw new Error(`Permission denied for Search Console property: ${targetSite}. Verify access in Google Search Console.`);
      }
      throw err;
    }
  }

  /**
   * 3. Query performance for a specific URL path
   */
  async getPagePerformance(pageUrl: string, startDate: string, endDate: string): Promise<GSCPerformanceRow[]> {
    return this.getSearchAnalytics({
      startDate,
      endDate,
      dimensions: ['query'],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'page',
              operator: 'equals',
              expression: pageUrl,
            },
          ],
        },
      ],
    });
  }

  /**
   * 4. Query performance for a specific search query
   */
  async getQueryPerformance(query: string, startDate: string, endDate: string): Promise<GSCPerformanceRow[]> {
    return this.getSearchAnalytics({
      startDate,
      endDate,
      dimensions: ['page'],
      dimensionFilterGroups: [
        {
          filters: [
            {
              dimension: 'query',
              operator: 'equals',
              expression: query,
            },
          ],
        },
      ],
    });
  }

  /**
   * 5. Test connection and verify property access
   */
  async testConnection(targetProperty?: string): Promise<{ ok: boolean; message: string }> {
    const prop = targetProperty || this.siteUrl;
    try {
      if (!prop) {
        const sites = await this.getSites();
        return {
          ok: true,
          message: `Successfully connected to Google Search Console (${sites.length} accessible properties).`,
        };
      }

      await this.getSearchAnalytics({
        startDate: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        rowLimit: 1,
      }, prop);

      return {
        ok: true,
        message: `Successfully verified Search Console access for ${prop}.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || 'Failed to verify Google Search Console connection.',
      };
    }
  }
}
