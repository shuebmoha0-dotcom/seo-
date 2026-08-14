/**
 * Google Analytics 4 Connector
 * Uses Google OAuth — credentials never exposed to agents.
 */

import type { IConnector, ConnectorType, Capability, ConnectorMetadata, GenericAction, ActionResult } from './types';
import { ConnectorErrors } from './types';
import { google, analyticsdata_v1beta } from 'googleapis';

interface GA4Config {
  property_id: string; // e.g. "123456789"
  measurement_id?: string;
}

export class GoogleAnalyticsConnector implements IConnector {
  readonly type: ConnectorType = 'google_analytics';
  readonly capabilities: Set<Capability> = new Set(['GET_GA_DATA', 'READ_ANALYTICS']);

  private client: analyticsdata_v1beta.Analyticsdata;
  private config: GA4Config;

  constructor(accessToken: string, config: GA4Config) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.client = google.analyticsdata({ version: 'v1beta', auth });
    this.config = config;
  }

  async testConnection(): Promise<{ ok: boolean; message: string; details?: Record<string, any> }> {
    try {
      const res = await this.client.properties.runReport({
        property: `properties/${this.config.property_id}`,
        requestBody: {
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          limit: '1',
        },
      });
      return { ok: true, message: `Connected to GA4 property ${this.config.property_id}`, details: { property_id: this.config.property_id } };
    } catch (err: any) {
      if (err.code === 401) return { ok: false, message: 'GA4 access token expired. Please reconnect.' };
      if (err.code === 403) return { ok: false, message: 'GA4 permission denied. Check property access.' };
      return { ok: false, message: err.message || 'GA4 connection failed' };
    }
  }

  canExecute(action: string): boolean {
    return ['get_ga_data'].includes(action);
  }

  async execute(action: GenericAction): Promise<ActionResult> {
    if (action.type === 'get_ga_data') return this.getGAData(action.payload);
    return { success: false, error: `GA4 connector does not support: ${action.type}`, error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY };
  }

  private async getGAData(payload: any): Promise<ActionResult> {
    try {
      const { start_date = '28daysAgo', end_date = 'today', metrics = ['sessions', 'organicGoogleSearchSessions'], dimensions = ['pagePath'] } = payload;
      const res = await this.client.properties.runReport({
        property: `properties/${this.config.property_id}`,
        requestBody: {
          dateRanges: [{ startDate: start_date, endDate: end_date }],
          metrics: metrics.map((m: string) => ({ name: m })),
          dimensions: dimensions.map((d: string) => ({ name: d })),
          limit: String(payload.limit || 50),
        },
      });
      return { success: true, data: { rows: res.data.rows || [], row_count: res.data.rowCount } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.AUTH_EXPIRED };
    }
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'google_analytics',
      display_name: 'Google Analytics 4',
      icon: '📊',
      description: 'Connect Google Analytics 4 to link SEO performance with business outcomes.',
      capabilities: [...this.capabilities],
      config: { property_id: this.config.property_id, measurement_id: this.config.measurement_id },
    };
  }
}
