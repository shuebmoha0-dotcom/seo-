import { GSCConnector } from '../connectors/gsc';

export async function get_search_console_performance(accessToken: string, siteUrl: string, startDate: string, endDate: string) {
  try {
    const gsc = new GSCConnector(accessToken, siteUrl);
    const data = await gsc.get_top_opportunities(startDate, endDate);
    
    return {
      success: true,
      tool: 'get_search_console_performance',
      source: 'google_search_console',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'get_search_console_performance',
      error: { code: 'API_ERROR', message: error.message || 'Unknown error' }
    };
  }
}

export async function get_search_console_queries(accessToken: string, siteUrl: string, query: string, startDate: string, endDate: string) {
  try {
    const gsc = new GSCConnector(accessToken, siteUrl);
    const data = await gsc.get_query_metrics(query, startDate, endDate);
    
    return {
      success: true,
      tool: 'get_search_console_queries',
      source: 'google_search_console',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'get_search_console_queries',
      error: { code: 'API_ERROR', message: error.message || 'Unknown error' }
    };
  }
}
