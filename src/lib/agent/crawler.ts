import * as cheerio from 'cheerio';

export interface CrawledPageData {
  url: string;
  title: string | null;
  meta_description: string | null;
  h1: string[];
  h2: string[];
  h3: string[];
  body_text: string;
  canonical: string | null;
  robots_directives: string | null;
  internal_links: string[];
  external_links: string[];
  images: { src: string; alt: string }[];
  missing_alt_count?: number;
  word_count?: number;
  has_schema?: boolean;
  schema_types?: string[];
  viewport?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  http_status: number;
  is_indexable: boolean;
}

export class WebsiteCrawler {
  private userAgent: string;

  constructor(userAgent = 'Autonomous-SEO-Agent/1.0') {
    this.userAgent = userAgent;
  }

  async crawlPage(url: string, domain: string): Promise<CrawledPageData> {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': this.userAgent }
      });

      const http_status = response.status;
      if (!response.ok) {
        return this.getEmptyData(url, http_status);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const title = $('title').text() || null;
      const meta_description = $('meta[name="description"]').attr('content') || null;
      const robots_directives = $('meta[name="robots"]').attr('content') || null;
      const canonical = $('link[rel="canonical"]').attr('href') || null;
      const viewport = $('meta[name="viewport"]').attr('content') || null;
      const og_title = $('meta[property="og:title"]').attr('content') || null;
      const og_description = $('meta[property="og:description"]').attr('content') || null;
      const og_image = $('meta[property="og:image"]').attr('content') || null;

      const h1: string[] = [];
      $('h1').each((_, el) => { h1.push($(el).text().trim()); });

      const h2: string[] = [];
      $('h2').each((_, el) => { h2.push($(el).text().trim()); });
      
      const h3: string[] = [];
      $('h3').each((_, el) => { h3.push($(el).text().trim()); });

      const raw_body = $('body').text().replace(/\s+/g, ' ').trim();
      const word_count = raw_body ? raw_body.split(/\s+/).filter(Boolean).length : 0;
      const body_text = raw_body.length > 5000 ? raw_body.slice(0, 5000) : raw_body;

      const internal_links: string[] = [];
      const external_links: string[] = [];
      
      $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            const linkUrl = new URL(href, url);
            if (linkUrl.hostname === domain || linkUrl.hostname.includes(domain)) {
              internal_links.push(linkUrl.href);
            } else {
              external_links.push(linkUrl.href);
            }
          } catch (e) {
            // Invalid URL
          }
        }
      });

      let missing_alt_count = 0;
      const images: { src: string; alt: string }[] = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || '';
        if (src) {
          images.push({ src, alt });
          if (!alt.trim()) {
            missing_alt_count++;
          }
        }
      });

      const schema_types: string[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const content = $(el).html();
          if (content) {
            const parsed = JSON.parse(content);
            const extractType = (obj: any) => {
              if (!obj || typeof obj !== 'object') return;
              if (obj['@type']) {
                if (Array.isArray(obj['@type'])) {
                  schema_types.push(...obj['@type'].map(String));
                } else if (typeof obj['@type'] === 'string') {
                  schema_types.push(obj['@type']);
                }
              }
              if (Array.isArray(obj['@graph'])) {
                obj['@graph'].forEach(extractType);
              }
            };
            extractType(parsed);
          }
        } catch {
          // ignore malformed schema script
        }
      });
      const uniqueSchemaTypes = [...new Set(schema_types)];

      let is_indexable = true;
      if (robots_directives && robots_directives.toLowerCase().includes('noindex')) {
        is_indexable = false;
      }
      if (canonical && canonical !== url) {
        // Technically not non-indexable, but search engines will index the canonical instead
        is_indexable = false;
      }

      return {
        url,
        title,
        meta_description,
        h1,
        h2,
        h3,
        body_text,
        canonical,
        robots_directives,
        internal_links: [...new Set(internal_links)],
        external_links: [...new Set(external_links)],
        images,
        missing_alt_count,
        word_count,
        has_schema: uniqueSchemaTypes.length > 0,
        schema_types: uniqueSchemaTypes,
        viewport,
        og_title,
        og_description,
        og_image,
        http_status,
        is_indexable
      };

    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      return this.getEmptyData(url, 500);
    }
  }

  private getEmptyData(url: string, http_status: number): CrawledPageData {
    return {
      url,
      title: null,
      meta_description: null,
      h1: [],
      h2: [],
      h3: [],
      body_text: '',
      canonical: null,
      robots_directives: null,
      internal_links: [],
      external_links: [],
      images: [],
      missing_alt_count: 0,
      word_count: 0,
      has_schema: false,
      schema_types: [],
      viewport: null,
      og_title: null,
      og_description: null,
      og_image: null,
      http_status,
      is_indexable: false
    };
  }
}
