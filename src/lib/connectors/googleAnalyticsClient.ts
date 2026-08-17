/**
 * Google Analytics 4 Client
 * 
 * Official Google Analytics Data & Admin API Client.
 * Isolates credentials from agents.
 */

import { google, analyticsdata_v1beta, analyticsadmin_v1beta } from 'googleapis';

export interface GA4PropertySummary {
  propertyId: string;
  displayName: string;
  account: string;
}

export interface GA4ReportRow {
  dimensionValues: Array<{ value?: string }>;
  metricValues: Array<{ value?: string }>;
}

export interface GA4ReportOptions {
  propertyId: string;
  startDate?: string;
  endDate?: string;
  metrics?: string[];
  dimensions?: string[];
  limit?: number;
}

export class GoogleAnalyticsClient {
  private dataApi: analyticsdata_v1beta.Analyticsdata;
  private adminApi: analyticsadmin_v1beta.Analyticsadmin;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    this.dataApi = google.analyticsdata({ version: 'v1beta', auth });
    this.adminApi = google.analyticsadmin({ version: 'v1beta', auth });
  }

  /**
   * 1. Retrieve list of accessible GA4 properties
   */
  async getProperties(): Promise<GA4PropertySummary[]> {
    try {
      const res = await this.adminApi.accountSummaries.list();
      const summaries = res.data.accountSummaries || [];
      const properties: GA4PropertySummary[] = [];

      for (const acc of summaries) {
        for (const prop of acc.propertySummaries || []) {
          properties.push({
            propertyId: (prop.property || '').replace(/^properties\//, ''),
            displayName: prop.displayName || acc.displayName || 'Unnamed Property',
            account: acc.displayName || 'Default Account',
          });
        }
      }

      return properties;
    } catch (err: any) {
      if (err.code === 401 || err.status === 401) {
        throw new Error('REAUTH_REQUIRED: Google Analytics token has expired or was revoked.');
      }
      throw err;
    }
  }

  /**
   * 2. Run a custom GA4 report
   */
  async getReport(options: GA4ReportOptions): Promise<{
    rows: GA4ReportRow[];
    rowCount: number;
  }> {
    const {
      propertyId,
      startDate = '28daysAgo',
      endDate = 'today',
      metrics = ['sessions', 'activeUsers', 'screenPageViews'],
      dimensions = ['pagePath'],
      limit = 100,
    } = options;

    try {
      const res = await this.dataApi.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: metrics.map(name => ({ name })),
          dimensions: dimensions.map(name => ({ name })),
          limit: String(limit),
        },
      });

      return {
        rows: (res.data.rows || []) as GA4ReportRow[],
        rowCount: res.data.rowCount || 0,
      };
    } catch (err: any) {
      if (err.code === 401 || err.status === 401) {
        throw new Error('REAUTH_REQUIRED: Google Analytics token has expired. Please reconnect.');
      }
      if (err.code === 403 || err.status === 403) {
        throw new Error(`Permission denied for GA4 property ${propertyId}. Verify user role in GA4.`);
      }
      throw err;
    }
  }

  /**
   * 3. Fetch Organic Search Landing Pages
   */
  async getLandingPages(propertyId: string, startDate = '28daysAgo', endDate = 'today', limit = 50): Promise<any[]> {
    const report = await this.getReport({
      propertyId,
      startDate,
      endDate,
      dimensions: ['pagePath'],
      metrics: ['sessions', 'activeUsers', 'engagementRate'],
      limit,
    });

    return report.rows.map(row => ({
      path: row.dimensionValues?.[0]?.value || '',
      sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
      users: parseInt(row.metricValues?.[1]?.value || '0', 10),
      engagementRate: parseFloat(row.metricValues?.[2]?.value || '0'),
    }));
  }

  /**
   * 4. Test connection and verify property access
   */
  async testConnection(propertyId?: string): Promise<{ ok: boolean; message: string }> {
    try {
      if (!propertyId) {
        const props = await this.getProperties();
        return {
          ok: true,
          message: `Successfully connected to Google Analytics (${props.length} accessible properties).`,
        };
      }

      await this.getReport({
        propertyId,
        startDate: '7daysAgo',
        endDate: 'today',
        metrics: ['sessions'],
        limit: 1,
      });

      return {
        ok: true,
        message: `Successfully verified access to GA4 property ${propertyId}.`,
      };
    } catch (err: any) {
      return {
        ok: false,
        message: err.message || 'Failed to verify Google Analytics connection.',
      };
    }
  }
}
