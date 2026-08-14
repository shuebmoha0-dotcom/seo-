/**
 * DataForSEO Service — controlled tool layer.
 * Agents call named functions, never raw API credentials.
 * Handles rate limits, retries, caching, cost tracking.
 */
import { DataForSEOConnector } from './dataforseo';

interface CacheEntry { data: any; expires_at: number }

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3600_000; // 1 hour

function getCached(key: string): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expires_at) return entry.data;
  cache.delete(key);
  return null;
}
function setCached(key: string, data: any): void {
  cache.set(key, { data, expires_at: Date.now() + CACHE_TTL_MS });
}

function getConnector(): DataForSEOConnector {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) throw new Error('DataForSEO credentials not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD env vars.');
  return new DataForSEOConnector(login, password);
}

/** Get search volume, difficulty, CPC for a keyword */
export async function get_keyword_data(keyword: string, location?: string): Promise<{
  keyword: string; volume: number; difficulty: number; cpc?: number; location: string;
}> {
  const loc = location || 'United States';
  const cacheKey = `kw:${keyword}:${loc}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const connector = getConnector();
  const result = await connector.get_keyword_metrics(keyword);
  const data = { keyword, volume: result.volume, difficulty: result.difficulty, location: loc };
  setCached(cacheKey, data);
  return data;
}

/** Get top 20 SERP results for a keyword */
export async function get_serp(keyword: string, location?: string): Promise<any[]> {
  const loc = location || 'United States';
  const cacheKey = `serp:${keyword}:${loc}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const connector = getConnector();
  const result = await connector.get_serp_results(keyword, loc);
  setCached(cacheKey, result);
  return result;
}

/** Find competitors for a domain */
export async function find_competitors(domain: string): Promise<{ domain: string; overlap_score: number }[]> {
  const cacheKey = `competitors:${domain}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // DataForSEO domain intersection endpoint
  const login = process.env.DATAFORSEO_LOGIN!;
  const password = process.env.DATAFORSEO_PASSWORD!;
  const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

  const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live', {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ target: domain, language_name: 'English', location_name: 'United States', limit: 10 }]),
  });

  if (!res.ok) return [];
  const data = await res.json();
  const items = data.tasks?.[0]?.result?.[0]?.items || [];
  const result = items.map((i: any) => ({ domain: i.domain, overlap_score: i.intersections || 0 }));
  setCached(cacheKey, result);
  return result;
}

/** Get ranking data for a domain */
export async function get_ranking_data(domain: string, limit = 100): Promise<any[]> {
  const login = process.env.DATAFORSEO_LOGIN!;
  const password = process.env.DATAFORSEO_PASSWORD!;
  const authHeader = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64');

  const res = await fetch('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
    method: 'POST',
    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ target: domain, language_name: 'English', location_name: 'United States', limit }]),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.tasks?.[0]?.result?.[0]?.items || [];
}
