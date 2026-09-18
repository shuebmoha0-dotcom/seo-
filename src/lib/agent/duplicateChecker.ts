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
   * Evaluates whether two topics/titles/keywords are duplicates or heavily overlapping
   */
  public static isTopicDuplicate(target: string, existing: string): { isDuplicate: boolean; reason?: string; overlap: number } {
    if (!target || !existing) return { isDuplicate: false, overlap: 0 };
    const normA = this.normalize(target);
    const normB = this.normalize(existing);

    if (normA === normB) {
      return { isDuplicate: true, reason: 'Exact match', overlap: 1.0 };
    }

    const slugA = this.toSlug(target);
    const slugB = this.toSlug(existing);
    if (slugA && slugB && slugA === slugB) {
      return { isDuplicate: true, reason: 'Exact slug match', overlap: 1.0 };
    }

    const wordsA = this.extractCoreWords(target);
    const wordsB = this.extractCoreWords(existing);
    if (wordsA.size === 0 || wordsB.size === 0) return { isDuplicate: false, overlap: 0 };

    // Stem plural words (e.g. "messages" -> "message", "templates" -> "template") for accurate comparison
    const stemWord = (w: string) => w.replace(/ies$/, 'y').replace(/(es|s)$/, '');
    const stemmedA = new Set(Array.from(wordsA).map(stemWord));
    const stemmedB = new Set(Array.from(wordsB).map(stemWord));

    let intersection = 0;
    for (const w of stemmedA) {
      if (stemmedB.has(w)) intersection++;
    }
    const union = new Set([...stemmedA, ...stemmedB]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    const subsetA = intersection / stemmedA.size;
    const subsetB = intersection / stemmedB.size;

    // 1. High overlap criteria: >= 75% Jaccard or virtually all core words match (>= 85% bidirectional)
    if (jaccard >= 0.75 || (subsetA >= 0.85 && subsetB >= 0.85)) {
      return {
        isDuplicate: true,
        reason: `High topical overlap (${Math.round(Math.max(jaccard, subsetA, subsetB) * 100)}%) with "${existing}"`,
        overlap: Math.max(jaccard, subsetA, subsetB),
      };
    }

    // 2. Direct phrase containment ONLY if the contained phrase is comprehensive (>= 4 core words AND >= 85% containment)
    // NEVER trigger on 1-3 word generic phrases (like "cold email" or "seo")
    if (normA.length >= 25 && normB.length >= 25 && (normA.includes(normB) || normB.includes(normA))) {
      const minCoreWords = Math.min(stemmedA.size, stemmedB.size);
      const maxSubset = Math.max(subsetA, subsetB);
      if (minCoreWords >= 4 && maxSubset >= 0.85) {
        return {
          isDuplicate: true,
          reason: `Direct phrase containment with "${existing}"`,
          overlap: 0.90,
        };
      }
    }

    return { isDuplicate: false, overlap: Math.max(jaccard, subsetA, subsetB) };
  }

  /**
   * Scans a target keyword or title against the entire site inventory.
   * Under Rule 9 (Absolute Grounding), isDuplicate: true is ONLY returned
   * if verifiable proof exists (a live URL or verified content_drafts ID).
   */
  public static findDuplicateInInventory(
    target: string,
    inventory: {
      siteUrl?: string;
      domain?: string;
      coveredItems?: Array<{ id?: string; title: string; primary_keyword?: string; url?: string; slug?: string; status?: string; source?: string }>;
      coveredTitles?: string[];
      coveredKeywords?: string[];
    }
  ): { isDuplicate: boolean; existingTitle?: string; url?: string; draftId?: string; reason?: string; overlap: number; status?: string } {
    if (!target) return { isDuplicate: false, overlap: 0 };
    const siteUrl = (inventory.siteUrl || (inventory.domain ? `https://${inventory.domain}` : '')).replace(/\/+$/, '');

    const resolveUrl = (item?: { url?: string; slug?: string; title?: string; status?: string }): string | undefined => {
      if (item?.url && item.url.startsWith('http')) return item.url;
      if (item?.status === 'published') {
        if (siteUrl && item?.slug) return `${siteUrl}/${item.slug.replace(/^\/+/, '')}`;
        if (siteUrl && item?.title) return `${siteUrl}/${this.toSlug(item.title)}`;
      }
      return undefined;
    };

    // Helper: only claim duplicate if verifiable proof (live URL or draft ID) exists
    const buildVerifiedResult = (
      matchedItem: { id?: string; title: string; primary_keyword?: string; url?: string; slug?: string; status?: string; source?: string } | undefined,
      matchResult: { isDuplicate: boolean; reason?: string; overlap: number },
      fallbackTitle: string
    ) => {
      if (!matchResult.isDuplicate) return { isDuplicate: false, overlap: matchResult.overlap };
      
      const resolvedUrl = resolveUrl(matchedItem);
      const draftId = matchedItem?.id;

      // RULE 9 MANDATE: If neither a live URL nor a database draft ID exists,
      // we do not have verifiable proof of this article. Never false-positive block.
      if (!resolvedUrl && !draftId) {
        console.warn(`[DuplicateArticleChecker] Ignored unverified duplicate match for "${fallbackTitle}" (no live URL or draft ID found)`);
        return { isDuplicate: false, overlap: matchResult.overlap };
      }

      return {
        isDuplicate: true,
        existingTitle: matchedItem?.title || fallbackTitle,
        url: resolvedUrl,
        draftId,
        reason: matchResult.reason,
        overlap: matchResult.overlap,
        status: matchedItem?.status,
      };
    };

    // 1. Check coveredItems
    if (inventory.coveredItems && inventory.coveredItems.length > 0) {
      for (const item of inventory.coveredItems) {
        const matchTitle = this.isTopicDuplicate(target, item.title);
        if (matchTitle.isDuplicate) {
          const verified = buildVerifiedResult(item, matchTitle, item.title);
          if (verified.isDuplicate) return verified;
        }
        if (item.primary_keyword) {
          const matchKw = this.isTopicDuplicate(target, item.primary_keyword);
          if (matchKw.isDuplicate) {
            const verified = buildVerifiedResult(item, matchKw, item.primary_keyword);
            if (verified.isDuplicate) return verified;
          }
        }
      }
    }

    // 2. Check coveredTitles
    if (inventory.coveredTitles && inventory.coveredTitles.length > 0) {
      for (const title of inventory.coveredTitles) {
        const match = this.isTopicDuplicate(target, title);
        if (match.isDuplicate) {
          const matchedItem = inventory.coveredItems?.find(i => i.title.toLowerCase() === title.toLowerCase());
          const verified = buildVerifiedResult(matchedItem, match, title);
          if (verified.isDuplicate) return verified;
        }
      }
    }

    // 3. Check coveredKeywords
    if (inventory.coveredKeywords && inventory.coveredKeywords.length > 0) {
      for (const kw of inventory.coveredKeywords) {
        const match = this.isTopicDuplicate(target, kw);
        if (match.isDuplicate) {
          const matchedItem = inventory.coveredItems?.find(i => (i.primary_keyword || '').toLowerCase() === kw.toLowerCase() || i.title.toLowerCase() === kw.toLowerCase());
          const verified = buildVerifiedResult(matchedItem, match, kw);
          if (verified.isDuplicate) return verified;
        }
      }
    }

    return { isDuplicate: false, overlap: 0 };
  }

  /**
   * Comprehensive check across content_drafts, crawled_urls, pages, and wordpress_jobs
   */
  public static async check(params: {
    website_id?: string;
    primary_keyword?: string;
    working_title?: string;
    url_slug?: string;
    exclude_draft_id?: string;
    site_url?: string;
  }): Promise<DuplicateCheckResult> {
    const supabase = createAdminClient();
    const targetKw = this.normalize(params.primary_keyword);
    const targetTitle = this.normalize(params.working_title);
    const targetSlug = this.toSlug(params.url_slug || params.primary_keyword || params.working_title);
    const targetWords = this.extractCoreWords(`${params.working_title || ''} ${params.primary_keyword || ''}`);

    // 1. Query existing content_drafts (ONLY completed/published or ready drafts — NEVER writing or failed drafts!)
    let draftsQuery = supabase
      .from('content_drafts')
      .select('id, working_title, primary_keyword, url_slug, status, website_id, revision_notes')
      .in('status', ['published', 'ready_for_approval', 'approved']);

    if (params.exclude_draft_id) {
      draftsQuery = draftsQuery.neq('id', params.exclude_draft_id);
    }

    if (params.website_id) {
      draftsQuery = draftsQuery.or(`website_id.eq.${params.website_id},website_id.is.null`);
    }

    const { data: drafts } = await draftsQuery;

    if (drafts && drafts.length > 0) {
      for (const d of drafts) {
        // Resolve URL if available
        let dUrl: string | undefined;
        if (d.revision_notes && typeof d.revision_notes === 'string' && d.revision_notes.startsWith('{')) {
          try {
            const parsed = JSON.parse(d.revision_notes);
            if (parsed.wordpress_post_url) dUrl = parsed.wordpress_post_url;
            if (parsed.link) dUrl = dUrl || parsed.link;
          } catch (_) {}
        }
        if (!dUrl && params.site_url && d.url_slug) {
          dUrl = `${params.site_url.replace(/\/+$/, '')}/${d.url_slug.replace(/^\/+/, '')}`;
        }

        const dKw = this.normalize(d.primary_keyword);
        const dTitle = this.normalize(d.working_title);
        const dSlug = this.toSlug(d.url_slug || d.primary_keyword || d.working_title);

        // Exact keyword match
        if (targetKw && dKw && targetKw === dKw) {
          return {
            isDuplicate: true,
            confidence: 'exact',
            reason: `An article targeting the primary keyword "${d.primary_keyword}" already exists: "${d.working_title}" ${dUrl ? `(${dUrl})` : `(${d.status})`}.`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              url: dUrl,
              source: 'content_drafts',
            },
          };
        }

        // Exact slug match
        if (targetSlug && dSlug && targetSlug === dSlug) {
          return {
            isDuplicate: true,
            confidence: 'exact',
            reason: `An article with URL slug "/${d.url_slug}" already exists: "${d.working_title}" ${dUrl ? `(${dUrl})` : ''}.`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              url: dUrl,
              source: 'content_drafts',
            },
          };
        }

        // High title/keyword overlap check using isTopicDuplicate
        const targetString = `${params.working_title || ''} ${params.primary_keyword || ''}`.trim();
        const existingString = `${d.working_title || ''} ${d.primary_keyword || ''}`.trim();
        const match = this.isTopicDuplicate(targetString, existingString);
        if (match.isDuplicate) {
          return {
            isDuplicate: true,
            confidence: 'high',
            reason: `Topic already covered in article "${d.working_title}" ${dUrl ? `(${dUrl})` : ''}. Writing this would cause SEO keyword cannibalization.`,
            matchedArticle: {
              id: d.id,
              title: d.working_title,
              slug: d.url_slug,
              primary_keyword: d.primary_keyword,
              status: d.status,
              url: dUrl,
              source: 'content_drafts',
            },
          };
        }
      }
    }

    // 2. Query pages table (Supabase live site content and sitemap)
    if (params.website_id) {
      const { data: pages } = await supabase
        .from('pages')
        .select('path, title, h1')
        .eq('website_id', params.website_id);

      if (pages && pages.length > 0) {
        const targetString = `${params.working_title || ''} ${params.primary_keyword || ''}`.trim();
        const utilityPaths = new Set(['/', '/about', '/about-us', '/contact', '/contact-us', '/privacy', '/privacy-policy', '/terms', '/terms-of-service', '/login', '/signup']);
        for (const p of pages) {
          if (utilityPaths.has(p.path.toLowerCase().replace(/\/+$/, '') || '/')) continue;
          const cleanTitle = (p.title || '').replace(/\s*[-|]\s*.*$/, '').trim();
          const cleanH1 = (p.h1 || '').replace(/\s*[-|]\s*.*$/, '').trim();
          const pageText = `${cleanTitle} ${cleanH1}`.trim();
          if (!pageText) continue;

          const match = this.isTopicDuplicate(targetString, pageText);

          if (match.isDuplicate) {
            const pageFullUrl = params.site_url && !p.path.startsWith('http')
              ? `${params.site_url.replace(/\/+$/, '')}/${p.path.replace(/^\/+/, '')}`
              : p.path;
            return {
              isDuplicate: true,
              confidence: 'high',
              reason: `Topic is already covered on your live website at ${pageFullUrl} ("${cleanTitle || cleanH1}").`,
              matchedArticle: {
                title: cleanTitle || cleanH1 || p.path,
                url: pageFullUrl,
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
      .limit(25);

    if (jobs && jobs.length > 0) {
      const targetString = `${params.working_title || ''} ${params.primary_keyword || ''}`.trim();
      for (const j of jobs) {
        const postTitle = j.payload?.title;
        const postSlug = j.payload?.slug;
        if (!postTitle) continue;

        const match = this.isTopicDuplicate(targetString, postTitle);

        if (match.isDuplicate || (targetSlug && postSlug && targetSlug === postSlug)) {
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

    // 2. From pages
    if (website_id) {
      const { data: pages } = await supabase
        .from('pages')
        .select('title, h1')
        .eq('website_id', website_id);
      (pages || []).forEach(p => {
        if (p.title) topics.add(p.title.replace(/\s*[-|]\s*.*$/, '').trim());
        if (p.h1) topics.add(p.h1.replace(/\s*[-|]\s*.*$/, '').trim());
      });
    }

    return Array.from(topics).filter(Boolean).slice(0, 50);
  }
}
