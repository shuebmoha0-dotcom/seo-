import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '@/lib/tools/llm';
import { z } from 'zod';
import { DuplicateArticleChecker } from './duplicateChecker';

export interface CoveredItem {
  id?: string;
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
              id: d.id,
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
    websiteId?: string;
    siteProfile?: import('./siteNicheProfiler').SiteNicheProfile;
    projectMemory?: string;
    projectInstructions?: string;
    limit?: number;
  }): Promise<ContentGapOpportunity[]> {
    const { inventory, websiteId, projectMemory, projectInstructions, limit = 5 } = params;

    let profile = params.siteProfile;
    if (!profile) {
      try {
        const { SiteNicheProfiler } = await import('./siteNicheProfiler');
        profile = await SiteNicheProfiler.profileSite({
          websiteId,
          domain: inventory.domain,
          siteUrl: inventory.siteUrl,
        });
      } catch (_) {}
    }

    const coveredTitlesSample = inventory.coveredTitles.slice(0, 30);
    const categoryList = inventory.categories.map(c => `• ${c.name} (${c.count || 0} existing articles)`).join('\n');

    const isEstablished = profile?.authorityTier === 'established';
    const kdMin = profile?.keywordStrategy?.kdMin || (isEstablished ? 30 : 10);
    const kdMax = profile?.keywordStrategy?.kdMax || (isEstablished ? 55 : 30);
    const volMin = profile?.keywordStrategy?.volumeMin || (isEstablished ? 1000 : 250);
    const volMax = profile?.keywordStrategy?.volumeMax || (isEstablished ? 20000 : 2500);

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
            estimated_volume: z.number().default(isEstablished ? 1800 : 850),
            estimated_kd: z.number().default(isEstablished ? 38 : 22),
            gap_rationale: z.string(),
          })),
        }),
        system: `You are an elite SEO Growth Architect and Topical Authority Engineer.
Your task is to conduct an intelligent CONTENT GAP ANALYSIS strictly tailored for the commercial client website "${inventory.domain}".

EXACT CLIENT NICHE & PRODUCT PROFILE:
• Primary Niche: ${profile?.primaryNiche || inventory.domain}
• Core Offerings / Solutions: ${profile?.coreOfferings?.join(', ') || 'Domain specific services and products'}
• Target Audience: ${profile?.targetAudience || 'Target customers and searchers'}
${profile?.negativeBoundaries?.length ? `• OUT-OF-SCOPE BOUNDARIES (DO NOT RECOMMEND): ${profile.negativeBoundaries.join('; ')}` : ''}

AUTHORITY TIER & DIFFICULTY TARGETING:
• Authority Level: ${isEstablished ? 'ESTABLISHED SITE (with backlink equity and indexed authority)' : 'NEW / EARLY STAGE SITE (low domain authority)'}
• Target Keyword Difficulty: ${isEstablished ? `MEDIUM (KD ${kdMin}–${kdMax})` : `EASY TO RANK (KD ${kdMin}–${kdMax}, strictly KD <= 30)`}
• Search Demand Floor: REAL TRAFFIC ONLY (${volMin.toLocaleString()} to ${volMax.toLocaleString()}/mo) — ZERO tolerance for ghost keywords (< 200/mo).

VERIFIED SITE CATEGORIES & COVERAGE:
${categoryList || '• General Industry Topics'}

ALREADY PUBLISHED ARTICLES (DO NOT DUPLICATE OR CANNIBALIZE):
${coveredTitlesSample.length > 0 ? coveredTitlesSample.map(t => `- "${t}"`).join('\n') : '• No published articles detected yet.'}

${projectMemory ? `CLIENT BRAND MEMORY:\n${projectMemory.slice(0, 400)}\n` : ''}
${projectInstructions ? `Instructions: ${projectInstructions.slice(0, 200)}` : ''}

STRICT ANTI-CANNIBALIZATION & RELEVANCE MANDATE:
1. Stay 100% strictly within the website's primary niche ("${profile?.primaryNiche || inventory.domain}"). Never recommend unrelated industries.
2. NEVER suggest a topic or keyword that is already covered by any published article above.
3. If the site already has a guide on a specific subtopic, DO NOT suggest another variation of that same concept.
4. Identify TRUE CONTENT GAPS in under-served categories (${inventory.thinCategories.join(', ') || 'categories needing depth'}).`,
        prompt: `Generate ${limit} distinct, high-impact CONTENT GAP opportunities that directly expand topical authority for "${profile?.primaryNiche || inventory.domain}" without cannibalizing existing posts.`
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
