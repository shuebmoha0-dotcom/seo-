import { 
  get_keyword_data as dfs_keyword, 
  get_serp as dfs_serp, 
  find_competitors as dfs_competitors,
  get_ranking_data as dfs_rankings 
} from '../connectors/dataForSeoService';

/**
 * Platform-owned DataForSEO tools.
 * Safe abstractions over the raw service.
 */

export async function keyword_research_tool(keyword: string, location?: string) {
  try {
    const data = await dfs_keyword(keyword, location);
    return {
      success: true,
      tool: 'keyword_research_tool',
      source: 'dataforseo',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'keyword_research_tool',
      error: { code: 'API_ERROR', message: error.message }
    };
  }
}

export async function serp_analysis_tool(keyword: string, location?: string) {
  try {
    const data = await dfs_serp(keyword, location);
    return {
      success: true,
      tool: 'serp_analysis_tool',
      source: 'dataforseo',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'serp_analysis_tool',
      error: { code: 'API_ERROR', message: error.message }
    };
  }
}

export async function competitor_keyword_tool(domain: string) {
  try {
    const data = await dfs_competitors(domain);
    return {
      success: true,
      tool: 'competitor_keyword_tool',
      source: 'dataforseo',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      success: false,
      tool: 'competitor_keyword_tool',
      error: { code: 'API_ERROR', message: error.message }
    };
  }
}
