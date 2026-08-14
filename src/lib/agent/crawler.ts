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

      const h1: string[] = [];
      $('h1').each((_, el) => { h1.push($(el).text().trim()); });

      const h2: string[] = [];
      $('h2').each((_, el) => { h2.push($(el).text().trim()); });
      
      const h3: string[] = [];
      $('h3').each((_, el) => { h3.push($(el).text().trim()); });

      const body_text = $('body').text().replace(/\s+/g, ' ').trim();

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

      const images: { src: string; alt: string }[] = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt') || '';
        if (src) {
          images.push({ src, alt });
        }
      });

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
      http_status,
      is_indexable: false
    };
  }
}
