import { searchconsole_v1, google } from 'googleapis';
import { SearchConsoleConnector } from '../agent/types';

export class GSCConnector implements SearchConsoleConnector {
  private api: searchconsole_v1.Searchconsole;
  private siteUrl: string;

  constructor(accessToken: string, siteUrl: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    
    this.api = google.searchconsole({
      version: 'v1',
      auth: auth,
    });
    this.siteUrl = siteUrl;
  }

  async get_page_metrics(url: string, start_date: string, end_date: string): Promise<any> {
    try {
      const response = await this.api.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: start_date,
          endDate: end_date,
          dimensions: ['page'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'equals',
                  expression: url
                }
              ]
            }
          ]
        }
      });
      return response.data.rows || [];
    } catch (error) {
      console.error('Error fetching GSC page metrics:', error);
      throw error;
    }
  }

  async get_query_metrics(query: string, start_date: string, end_date: string): Promise<any> {
    try {
      const response = await this.api.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: start_date,
          endDate: end_date,
          dimensions: ['query', 'page'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'equals',
                  expression: query
                }
              ]
            }
          ]
        }
      });
      return response.data.rows || [];
    } catch (error) {
      console.error('Error fetching GSC query metrics:', error);
      throw error;
    }
  }

  async get_top_opportunities(start_date: string, end_date: string): Promise<any> {
    // Custom method to fetch high impression, low CTR pages as requested in prompt
    try {
      const response = await this.api.searchanalytics.query({
        siteUrl: this.siteUrl,
        requestBody: {
          startDate: start_date,
          endDate: end_date,
          dimensions: ['page', 'query'],
          rowLimit: 1000,
        }
      });
      
      const rows = response.data.rows || [];
      // Example logic: Impressions > 1000, CTR < 0.03, Position > 5
      return rows.filter(row => 
        (row.impressions || 0) > 1000 && 
        (row.ctr || 0) < 0.03 &&
        (row.position || 0) > 5 &&
        (row.position || 0) < 20
      );
    } catch (error) {
      console.error('Error fetching top GSC opportunities:', error);
      throw error;
    }
  }
}
