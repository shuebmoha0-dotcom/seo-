import { createAdminClient } from '@/lib/supabase/admin';
import * as cheerio from 'cheerio';

export interface LiveSiteLink {
  title: string;
  url: string;
  slug: string;
  source: 'wordpress_api' | 'sitemap' | 'html_crawl' | 'database';
}

export class SiteLinkCrawler {
  /**
   * Discovers real, published internal pages by live-crawling the site.
   */
  static async discoverLiveInternalLinks(params: {
    websiteId?: string;
    currentKeyword?: string;
    siteUrl?: string;
  }): Promise<string[]> {
    const supabase = createAdminClient();
    const discoveredLinks: LiveSiteLink[] = [];
    const seenUrls = new Set<string>();

    let targetSiteUrl = params.siteUrl;

    // 1. Resolve site URL if not provided
    if (!targetSiteUrl && params.websiteId) {
      const { data: site } = await supabase.from('websites').select('url, domain').eq('id', params.websiteId).maybeSingle();
      if (site?.url) targetSiteUrl = site.url;
      else if (site?.domain) targetSiteUrl = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;
    }

    if (!targetSiteUrl) {
      // Check WordPress integration
      const { data: wpInt } = await supabase.from('integrations').select('config').eq('provider', 'wordpress').eq('status', 'connected').maybeSingle();
      if (wpInt?.config?.site_url) {
        targetSiteUrl = wpInt.config.site_url;
      }
    }

    if (!targetSiteUrl) {
      // Check outbound sites
      const { data: obSite } = await supabase.from('wordpress_outbound_sites').select('site_url').eq('status', 'active').limit(1).maybeSingle();
      if (obSite?.site_url) {
        targetSiteUrl = obSite.site_url;
      }
    }

    if (targetSiteUrl) {
      targetSiteUrl = targetSiteUrl.replace(/\/+$/, '');

      // Method A: Live WordPress REST API
      try {
        console.log(`[SiteLinkCrawler] Live crawling WordPress REST API: ${targetSiteUrl}/wp-json/wp/v2/posts...`);
        const wpRes = await fetch(`${targetSiteUrl}/wp-json/wp/v2/posts?per_page=30&_fields=id,slug,title,link`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Autonomous-SEO-Agent/1.0)' },
          signal: AbortSignal.timeout(4000),
        });

        if (wpRes.ok) {
          const posts = await wpRes.json();
          if (Array.isArray(posts)) {
            for (const p of posts) {
              const rawTitle = p.title?.rendered ? cheerio.load(p.title.rendered).text().trim() : p.slug;
              const linkUrl = p.link || `/${p.slug}/`;
              if (rawTitle && linkUrl && !seenUrls.has(linkUrl)) {
                seenUrls.add(linkUrl);
                discoveredLinks.push({
                  title: rawTitle,
                  url: linkUrl,
                  slug: p.slug,
                  source: 'wordpress_api',
                });
              }
            }
            console.log(`[SiteLinkCrawler] Successfully discovered ${discoveredLinks.length} live posts via WordPress API.`);
          }
        }
      } catch (err: any) {
        console.warn('[SiteLinkCrawler] WordPress REST API crawl notice:', err.message);
      }

      // Method B: Live XML Sitemap Crawling
      if (discoveredLinks.length < 5) {
        const sitemapUrls = [
          `${targetSiteUrl}/wp-sitemap-posts-post-1.xml`,
          `${targetSiteUrl}/post-sitemap.xml`,
          `${targetSiteUrl}/sitemap.xml`,
        ];

        for (const smUrl of sitemapUrls) {
          try {
            console.log(`[SiteLinkCrawler] Crawling XML sitemap: ${smUrl}...`);
            const sRes = await fetch(smUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Autonomous-SEO-Agent/1.0)' },
              signal: AbortSignal.timeout(3500),
            });

            if (sRes.ok) {
              const xmlText = await sRes.text();
              const $ = cheerio.load(xmlText, { xmlMode: true });
              $('url loc').each((_, el) => {
                const loc = $(el).text().trim();
                if (loc && !seenUrls.has(loc) && !loc.endsWith('.xml')) {
                  seenUrls.add(loc);
                  const pathParts = new URL(loc).pathname.replace(/\/+$/, '').split('/');
                  const slug = pathParts[pathParts.length - 1] || 'article';
                  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                  discoveredLinks.push({
                    title,
                    url: loc,
                    slug,
                    source: 'sitemap',
                  });
                }
              });

              if (discoveredLinks.length >= 5) break;
            }
          } catch {}
        }
      }
    }

    // Method C: Supabase database crawl_pages and content_drafts
    try {
      const { data: dbDrafts } = await supabase
        .from('content_drafts')
        .select('url_slug, working_title, primary_keyword')
        .neq('url_slug', null)
        .limit(20);

      if (dbDrafts) {
        for (const d of dbDrafts) {
          const slug = d.url_slug.replace(/^\//, '');
          const relativeUrl = `/${slug}/`;
          if (!seenUrls.has(relativeUrl)) {
            seenUrls.add(relativeUrl);
            discoveredLinks.push({
              title: d.working_title || d.primary_keyword,
              url: relativeUrl,
              slug,
              source: 'database',
            });
          }
        }
      }
    } catch {}

    // Filter out current article/keyword to avoid linking to itself
    const currentKwLower = (params.currentKeyword || '').toLowerCase().trim();
    const filtered = discoveredLinks.filter(item => {
      const titleLower = item.title.toLowerCase();
      const slugLower = item.slug.toLowerCase();
      return !titleLower.includes(currentKwLower) && !slugLower.includes(currentKwLower.replace(/\s+/g, '-'));
    });

    // Format into clear, exact live link specifications for the LLM
    const formatted = filtered.map(item => {
      const liveUrl = item.url.startsWith('http') ? item.url : `/${item.slug.replace(/^\//, '')}/`;
      const shortAnchor = item.title.split(':')[0].split('—')[0].replace(/^\s*|\s*$/g, '');
      return `URL: ${liveUrl} | Topic: "${item.title}" | Example Anchor: [${shortAnchor.toLowerCase()}](${liveUrl})`;
    });

    console.log(`[SiteLinkCrawler] Discovered ${formatted.length} verified live internal links for article generation.`);
    return formatted.slice(0, 8);
  }
}