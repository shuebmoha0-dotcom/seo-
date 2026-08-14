import { GoogleAnalyticsConnector } from '../connectors/googleAnalytics';

export async function get_analytics_data(accessToken: string, propertyId: string, startDate: string, endDate: string) {
  try {
    // Instantiate the connector (using a dummy token or from env)
    const connector = new GoogleAnalyticsConnector(accessToken, { property_id: propertyId });
    const data = await connector.execute({
      type: 'get_ga_data',
      proposed_by: 'tool',
      payload: { start_date: startDate, end_date: endDate }
    });
    
    return {
      success: true,
      tool: 'get_analytics_data',
      source: 'google_analytics',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'get_analytics_data',
      error: { code: 'API_ERROR', message: error.message || 'Unknown error' }
    };
  }
}
