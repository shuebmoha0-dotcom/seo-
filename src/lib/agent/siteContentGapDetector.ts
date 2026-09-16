import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '@/lib/tools/llm';
import { z } from 'zod';
import { DuplicateArticleChecker } from './duplicateChecker';

export interface CoveredItem {
  title: string;
  slug: string;
  url?: string;
  primary_keyword?: string;
  category?: string;
  source: 'wordpress' | 'database_draft' | 'database_page';
  status?: string;
}

export interface SiteInventory {
  domain: string;
  siteUrl: string;
  coveredItems: CoveredItem[];
  coveredTitles: string[];
  coveredKeywords: string[];
  categories: Array<{ id?: number; name: string; slug: string; count?: number }>;
  thinCategories: string[];
}

export interface ContentGapOpportunity {
  keyword: string;
  working_title: string;
  target_category: string;
  gap_type: 'missing_pillar' | 'under_served_category' | 'comparison_gap' | 'how_to_guide' | 'buyer_intent';
  search_intent: 'informational' | 'commercial' | 'transactional';
  estimated_volume: number;
  estimated_kd: number;
  gap_rationale: string;
}

export class SiteContentGapDetector {
  /**
   * 1. Crawls and compiles complete inventory of existing content for any client website
   */
  static async getSiteInventory(params: {
    websiteId?: string;
    domain: string;
    siteUrl?: string;
  }): Promise<SiteInventory> {
    const { websiteId, domain } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    const coveredMap = new Map<string, CoveredItem>();
    const categories: Array<{ id?: number; name: string; slug: string; count?: number }> = [];

    // A. Query Supabase content_drafts (strictly published, ready_for_approval, or approved — NEVER writing or failed)
    try {
      let draftQuery = supabase
        .from('content_drafts')
        .select('id, working_title, primary_keyword, url_slug, status, revision_notes, website_id')
        .in('status', ['published', 'ready_for_approval', 'approved']);

      if (websiteId) {
        draftQuery = draftQuery.eq('website_id', websiteId);
      }

      const { data: drafts } = await draftQuery.limit(50);
      if (drafts) {
        for (const d of drafts) {
          const title = (d.working_title || '').trim();
          if (title && !coveredMap.has(title.toLowerCase())) {
            let wpUrl: string | undefined;
            if (d.revision_notes && typeof d.revision_notes === 'string' && d.revision_notes.startsWith('{')) {
              try {
                const parsed = JSON.parse(d.revision_notes);
                if (parsed.wordpress_post_url) wpUrl = parsed.wordpress_post_url;
                if (parsed.link) wpUrl = wpUrl || parsed.link;
                if (parsed.url) wpUrl = wpUrl || parsed.url;
              } catch (_) {}
            }
            const fallbackSlug = (d.url_slug || '').replace(/^\/+/, '');
            // Only provide a live URL if confirmed via wpUrl or if status is officially published
            const resolvedUrl = wpUrl || (d.status === 'published' && fallbackSlug ? `${siteUrl}/${fallbackSlug}` : undefined);

            coveredMap.set(title.toLowerCase(), {
              title,
              slug: fallbackSlug,
              url: resolvedUrl,
              primary_keyword: d.primary_keyword,
              status: d.status,
              source: 'database_draft',
            });
          }
        }
      }
    } catch (dErr) {
      console.warn('[SiteContentGapDetector] Draft inventory query warning:', dErr);
    }

    // B. Query Supabase pages
    try {
      if (websiteId) {
        const { data: pages } = await supabase
          .from('pages')
          .select('title, h1, path')
          .eq('website_id', websiteId)
          .limit(30);

        if (pages) {
          for (const p of pages) {
            const title = (p.title || p.h1 || '').trim();
            if (title && !coveredMap.has(title.toLowerCase())) {
              coveredMap.set(title.toLowerCase(), {
                title,
                slug: p.path.replace(/^\/+|\/+$/g, ''),
                url: p.path.startsWith('http') ? p.path : `${siteUrl}/${p.path.replace(/^\/+/, '')}`,
                source: 'database_page',
              });
            }
          }
        }
      }
    } catch (_) {}

    // C. Live Crawl client WordPress API (Categories & Posts) with 3s timeout
    try {
      const [catRes, postRes] = await Promise.all([
        fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=20`, {
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'SEO-Autopilot-GapDetector/1.0' },
        }),
        fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=50&_fields=id,title,slug,link`, {
          signal: AbortSignal.timeout(3500),
          headers: { 'User-Agent': 'SEO-Autopilot-GapDetector/1.0' },
        }),
      ]);

      if (catRes.ok) {
        const rawCats = await catRes.json();
        if (Array.isArray(rawCats)) {
          for (const c of rawCats) {
            if (c.slug !== 'uncategorized' && c.name) {
              categories.push({
                id: c.id,
                name: c.name.replace(/&amp;/g, '&'),
                slug: c.slug,
                count: c.count || 0,
              });
            }
          }
        }
      }

      if (postRes.ok) {
        const rawPosts = await postRes.json();
        if (Array.isArray(rawPosts)) {
          for (const p of rawPosts) {
            const rawTitle = p.title?.rendered ? p.title.rendered.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").trim() : '';
            if (rawTitle && !coveredMap.has(rawTitle.toLowerCase())) {
              coveredMap.set(rawTitle.toLowerCase(), {
                title: rawTitle,
                slug: p.slug,
                url: p.link,
                source: 'wordpress',
              });
            }
          }
        }
      }
    } catch (crawlErr) {
      console.warn('[SiteContentGapDetector] Live WordPress crawl skipped (using database inventory):', crawlErr);
    }

    const coveredItems = Array.from(coveredMap.values());
    const coveredTitles = coveredItems.map(i => i.title);
    const coveredKeywords = coveredItems.map(i => i.primary_keyword).filter(Boolean) as string[];

    // Identify thin categories (< 3 published articles)
    const thinCategories = categories
      .filter(c => (c.count || 0) < 3)
      .map(c => c.name);

    return {
      domain,
      siteUrl,
      coveredItems,
      coveredTitles,
      coveredKeywords,
      categories,
      thinCategories,
    };
  }

  /**
   * 2. Intelligent Content Gap Analysis
   * Compares client's current content footprint against topical domain possibilities to find UNCOVERED opportunities.
   */
  static async findContentGaps(params: {
    inventory: SiteInventory;
    projectMemory?: string;
    projectInstructions?: string;
    limit?: number;
  }): Promise<ContentGapOpportunity[]> {
    const { inventory, projectMemory, projectInstructions, limit = 5 } = params;

    const coveredTitlesSample = inventory.coveredTitles.slice(0, 30);
    const categoryList = inventory.categories.map(c => `• ${c.name} (${c.count || 0} existing articles)`).join('\n');

    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'KeywordAgent',
        complexity: 'simple',
        schema: z.object({
          gaps: z.array(z.object({
            keyword: z.string(),
            working_title: z.string(),
            target_category: z.string(),
            gap_type: z.enum(['missing_pillar', 'under_served_category', 'comparison_gap', 'how_to_guide', 'buyer_intent']),
            search_intent: z.enum(['informational', 'commercial', 'transactional']),
            estimated_volume: z.number().default(850),
            estimated_kd: z.number().default(22),
            gap_rationale: z.string(),
          })),
        }),
        system: `You are an elite SEO Growth Architect and Topical Authority Engineer.
Your task is to conduct an intelligent CONTENT GAP ANALYSIS for the commercial client website "${inventory.domain}".

VERIFIED SITE CATEGORIES & COVERAGE:
${categoryList || '• General Industry Topics'}

ALREADY PUBLISHED ARTICLES (DO NOT DUPLICATE OR CANNIBALIZE):
${coveredTitlesSample.length > 0 ? coveredTitlesSample.map(t => `- "${t}"`).join('\n') : '• No published articles detected yet.'}

CLIENT NICHE CONTEXT & BRAND MEMORY:
${projectMemory ? projectMemory.slice(0, 400) : `Commercial niche for ${inventory.domain}`}
${projectInstructions ? `Instructions: ${projectInstructions.slice(0, 200)}` : ''}

STRICT ANTI-CANNIBALIZATION MANDATE:
1. NEVER suggest a topic or keyword that is already covered by any of the published articles listed above.
2. If the site already has a "Cold Email Follow Up Templates" post, DO NOT suggest another follow-up template article.
3. Identify TRUE CONTENT GAPS:
   - Under-served categories with 0 or few articles (${inventory.thinCategories.join(', ') || 'categories needing depth'}).
   - Missing technical guides, comparison frameworks, tool reviews, or step-by-step implementation playbooks.
4. DEMAND FLOOR:
   - Every keyword must have realistic search demand (>= 250 to 2,500/mo) and low difficulty (KD <= 30).
   - Zero ghost keywords.`,
        prompt: `Generate ${limit} distinct, high-impact CONTENT GAP opportunities that this website has NOT covered yet. Each opportunity must directly expand the site's topical authority without cannibalizing existing posts.`
      });

      // Filter out any accidental overlaps using DuplicateArticleChecker
      const validatedGaps: ContentGapOpportunity[] = [];
      for (const gap of object.gaps) {
        let isOverlapping = false;
        for (const existingTitle of inventory.coveredTitles) {
          const wordsA = DuplicateArticleChecker.extractCoreWords(gap.working_title);
          const wordsB = DuplicateArticleChecker.extractCoreWords(existingTitle);
          const overlap = DuplicateArticleChecker.calculateOverlap(wordsA, wordsB);
          if (overlap >= 0.6) {
            isOverlapping = true;
            console.log(`[SiteContentGapDetector] Rejected overlapping gap "${gap.working_title}" (overlaps with "${existingTitle}")`);
            break;
          }
        }

        if (!isOverlapping) {
          validatedGaps.push(gap);
        }
      }

      return validatedGaps.slice(0, limit);
    } catch (err: any) {
      console.warn('[SiteContentGapDetector] Content gap discovery error:', err?.message || err);
      return [];
    }
  }
}
