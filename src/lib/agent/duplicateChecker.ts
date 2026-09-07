import { createAdminClient } from '@/lib/supabase/admin';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  confidence: 'exact' | 'high' | 'medium' | 'none';
  reason?: string;
  matchedArticle?: {
    id?: string;
    title: string;
    slug?: string;
    primary_keyword?: string;
    status?: string;
    url?: string;
    source: 'content_drafts' | 'crawled_urls' | 'wordpress_jobs';
  };
}

export class DuplicateArticleChecker {
  /**
   * Stop words to ignore during title & keyword similarity comparisons
   */
  private static STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'how', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'was', 'what', 'when', 'where', 'which', 'who', 'will', 'with',
    'the', 'your', 'you', 'our', 'we', 'more', 'get', 'best', 'top'
  ]);

  /**
   * Normalize a text string for comparison (lowercased, punctuation stripped)
   */
  public static normalize(text?: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract meaningful keywords (excluding stop words and numbers)
   */
  public static extractCoreWords(text?: string): Set<string> {
    const normalized = this.normalize(text);
    const words = normalized.split(' ').filter(w => w.length > 2 && !this.STOP_WORDS.has(w) && isNaN(Number(w)));
    return new Set(words);
  }

  /**
   * Calculate Jaccard similarity between two sets of words (0.0 to 1.0)
   */
  public static calculateOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Generate clean slug
   */
  public static toSlug(text?: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Comprehensive check across content_drafts, crawled_urls, and wordpress_jobs
   */
  public static async check(params: {
    website_id?: string;
    primary_keyword?: string;
    working_title?: string;
    url_slug?: string;
  }): Promise<DuplicateCheckResult> {
    const supabase = createAdminClient();
    const targetKw = this.normalize(params.primary_keyword);
    const targetTitle = this.normalize(params.working_title);
    const targetSlug = this.toSlug(params.url_slug || params.primary_keyword || params.working_title);
    const targetWords = this.extractCoreWords(`${params.working_title || ''} ${params.primary_keyword || ''}`);

    // 1. Query existing content_drafts for the website
    let draftsQuery = supabase
      .from('content_drafts')
      .select('id, working_title, primary_keyword, url_slug, status, website_id');

    if (params.website_id) {
      draftsQuery = draftsQuery.or(`website_id.eq.${params.website_id},website_id.is.null`);
    }

    const { data: drafts } = await draftsQuery;

    if (drafts && drafts.length > 0) {
      for (const d of drafts) {
        const dKw = this.normalize(d.primary_keyword);
        const dTitle = this.normalize(d.working_title);
        const dSlug = this.toSlug(d.url_slug || d.primary_keyword || d.working_title);

        // Exact keyword match
        if (targetKw && dKw && targetKw === dKw) {
          return {
            isDuplicate: true,
            confidence: 'exact',
            reason: `An article targeting the exact primary keyword "${d.primary_keyword}" already exists: "${d.working_title}" (${d.status}).`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              source: 'content_drafts',
            },
          };
        }

        // Exact slug match
        if (targetSlug && dSlug && targetSlug === dSlug) {
          return {
            isDuplicate: true,
            confidence: 'exact',
            reason: `An article with the exact URL slug "/${d.url_slug}" already exists: "${d.working_title}".`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              source: 'content_drafts',
            },
          };
        }

        // High title/keyword word overlap (Jaccard similarity >= 0.70)
        const dWords = this.extractCoreWords(`${d.working_title} ${d.primary_keyword}`);
        const overlap = this.calculateOverlap(targetWords, dWords);
        if (overlap >= 0.70) {
          return {
            isDuplicate: true,
            confidence: 'high',
            reason: `Topic heavily overlaps (${Math.round(overlap * 100)}% similarity) with existing article "${d.working_title}". Writing this would cause SEO keyword cannibalization.`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              source: 'content_drafts',
            },
          };
        }
      }
    }

    // 2. Query crawled URLs on the website (live site content)
    if (params.website_id) {
      const { data: crawled } = await supabase
        .from('crawled_urls')
        .select('url, title, h1')
        .eq('website_id', params.website_id);

      if (crawled && crawled.length > 0) {
        for (const p of crawled) {
          const pageTitle = this.normalize(p.title);
          const pageWords = this.extractCoreWords(`${p.title || ''} ${p.h1 || ''}`);
          const overlap = this.calculateOverlap(targetWords, pageWords);

          if (overlap >= 0.75) {
            return {
              isDuplicate: true,
              confidence: 'high',
              reason: `Topic is already covered on your live website at ${p.url} ("${p.title}").`,
              matchedArticle: {
                title: p.title || p.url,
                url: p.url,
                source: 'crawled_urls',
              },
            };
          }
        }
      }
    }

    // 3. Query wordpress_jobs (recently published or queued posts)
    const { data: jobs } = await supabase
      .from('wordpress_jobs')
      .select('payload')
      .order('created_at', { ascending: false })
      .limit(20);

    if (jobs && jobs.length > 0) {
      for (const j of jobs) {
        const postTitle = j.payload?.title;
        const postSlug = j.payload?.slug;
        if (!postTitle) continue;

        const jWords = this.extractCoreWords(postTitle);
        const overlap = this.calculateOverlap(targetWords, jWords);

        if (overlap >= 0.75 || (targetSlug && postSlug && targetSlug === postSlug)) {
          return {
            isDuplicate: true,
            confidence: 'high',
            reason: `An article with this topic was recently created or scheduled on WordPress: "${postTitle}".`,
            matchedArticle: {
              title: postTitle,
              slug: postSlug,
              source: 'wordpress_jobs',
            },
          };
        }
      }
    }

    return {
      isDuplicate: false,
      confidence: 'none',
    };
  }

  /**
   * Retrieves a clean list of all currently covered topics on a website
   * to inject as negative constraints into Autonomous/Autopilot prompts.
   */
  public static async getCoveredTopics(website_id?: string): Promise<string[]> {
    const supabase = createAdminClient();
    const topics = new Set<string>();

    // 1. From content_drafts
    let query = supabase.from('content_drafts').select('working_title, primary_keyword');
    if (website_id) {
      query = query.or(`website_id.eq.${website_id},website_id.is.null`);
    }
    const { data: drafts } = await query;
    (drafts || []).forEach(d => {
      if (d.working_title) topics.add(d.working_title.trim());
      if (d.primary_keyword) topics.add(d.primary_keyword.trim());
    });

    // 2. From crawled URLs
    if (website_id) {
      const { data: crawled } = await supabase
        .from('crawled_urls')
        .select('title')
        .eq('website_id', website_id);
      (crawled || []).forEach(c => {
        if (c.title) topics.add(c.title.replace(/\s*[-|]\s*.*$/, '').trim());
      });
    }

    return Array.from(topics).filter(Boolean).slice(0, 30);
  }
}
