import { SEODataConnector } from '../agent/types';

export class DataForSEOConnector implements SEODataConnector {
  private login: string;
  private password: string;
  private baseUrl: string = 'https://api.dataforseo.com/v3';

  constructor(login: string, password: string) {
    this.login = login;
    this.password = password;
  }

  private get authHeader() {
    return 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64');
  }

  async get_serp_results(keyword: string, location_name: string = 'United States'): Promise<any> {
    const postData = [{
      keyword: keyword,
      location_name: location_name,
      language_name: 'English',
      depth: 20
    }];

    try {
      const response = await fetch(`${this.baseUrl}/serp/google/organic/live/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) {
        throw new Error(`DataForSEO API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tasks?.[0]?.result?.[0]?.items || [];
    } catch (error) {
      console.error('Error fetching DataForSEO SERP:', error);
      throw error;
    }
  }

  async get_keyword_metrics(keyword: string): Promise<{ volume: number; difficulty: number; cpc?: number }> {
    const postData = [{
      keywords: [keyword],
      location_name: 'United States',
      language_name: 'English'
    }];

    try {
      const response = await fetch(`${this.baseUrl}/dataforseo_labs/google/keyword_metrics/live`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) {
        throw new Error(`DataForSEO API error: ${response.statusText}`);
      }

      const data = await response.json();
      const item = data.tasks?.[0]?.result?.[0]?.items?.[0];
      const metrics = item?.keyword_info;
      const props = item?.keyword_properties;
      
      const difficulty = typeof props?.keyword_difficulty === 'number'
        ? props.keyword_difficulty
        : typeof metrics?.competition_level === 'number'
          ? Math.round(metrics.competition_level * 100)
          : 25;

      return {
        volume: metrics?.search_volume || 0,
        difficulty,
        cpc: metrics?.cpc || 0
      };
    } catch (error) {
      console.error('Error fetching DataForSEO keyword metrics:', error);
      throw error;
    }
  }
}

