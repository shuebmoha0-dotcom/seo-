import { generateObject } from 'ai'; // Not LLM tool, but SDK for structured parsing if needed
import * as cheerio from 'cheerio';

export interface CrawlResult {
  url: string;
  status_code: number;
  title: string;
  meta_description: string;
  h1: string[];
  h2: string[];
  word_count: number;
  internal_links: string[];
  external_links: string[];
}

/**
 * Basic server-side Website Crawler Tool.
 * Respects limits and returns structured SEO data.
 */
export async function crawl_website(url: string, limit = 10): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const visited = new Set<string>();
  const queue = [url];
  
  const baseUrl = new URL(url).origin;

  while (queue.length > 0 && results.length < limit) {
    const currentUrl = queue.shift()!;
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    try {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'SEO-Platform-CrawlerBot/1.0',
        }
      });
      
      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('title').text() || '';
      const meta_description = $('meta[name="description"]').attr('content') || '';
      const h1: string[] = [];
      $('h1').each((_, el) => { h1.push($(el).text().trim()); });
      
      const h2: string[] = [];
      $('h2').each((_, el) => { h2.push($(el).text().trim()); });

      const word_count = $('body').text().split(/\s+/).filter(Boolean).length;

      const internal_links: string[] = [];
      const external_links: string[] = [];
      
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        
        try {
          const target = new URL(href, currentUrl);
          if (target.origin === baseUrl) {
            if (!internal_links.includes(target.href)) internal_links.push(target.href);
            if (!visited.has(target.href)) queue.push(target.href);
          } else {
            if (!external_links.includes(target.href)) external_links.push(target.href);
          }
        } catch {
          // ignore invalid URLs
        }
      });

      results.push({
        url: currentUrl,
        status_code: response.status,
        title,
        meta_description,
        h1,
        h2,
        word_count,
        internal_links,
        external_links
      });
      
    } catch (error) {
      console.error(`[Crawler] Failed to crawl ${currentUrl}:`, error);
      results.push({
        url: currentUrl,
        status_code: 500,
        title: '',
        meta_description: '',
        h1: [],
        h2: [],
        word_count: 0,
        internal_links: [],
        external_links: []
      });
    }
  }

  return results;
}
