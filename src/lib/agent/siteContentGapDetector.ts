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
        fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=50&_fields=id,title,slug,link,categories`, {
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
        const catMap = new Map<number, string>();
        for (const cat of categories) {
          if (cat.id) catMap.set(cat.id, cat.name);
        }

        if (Array.isArray(rawPosts)) {
          for (const p of rawPosts) {
            const rawTitle = p.title?.rendered ? p.title.rendered.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").trim() : '';
            if (rawTitle && !coveredMap.has(rawTitle.toLowerCase())) {
              const postCats: number[] = Array.isArray(p.categories) ? p.categories : [];
              const categoryName = postCats.length > 0 && catMap.has(postCats[0]) ? catMap.get(postCats[0]) : undefined;
              coveredMap.set(rawTitle.toLowerCase(), {
                title: rawTitle,
                slug: p.slug,
                url: p.link,
                category: categoryName,
                source: 'wordpress',
              });
            }
          }
        }
      }
    } catch (crawlErr) {
      console.warn('[SiteContentGapDetector] Live WordPress crawl skipped (using database inventory):', crawlErr);
    }

    // D. Query Supabase wordpress_jobs (all completed, queued, or recently published jobs)
    try {
      let jobsQuery = supabase
        .from('wordpress_jobs')
        .select('id, payload, website_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (websiteId) {
        jobsQuery = jobsQuery.eq('website_id', websiteId);
      }

      const { data: jobs } = await jobsQuery;
      if (jobs) {
        for (const j of jobs) {
          const postTitle = (j.payload?.title || '').trim();
          const postSlug = (j.payload?.slug || '').trim();
          const postUrl = j.payload?.canonical_url || (siteUrl && postSlug ? `${siteUrl}/${postSlug}` : undefined);
          const postKw = j.payload?.primary_keyword || j.payload?.focus_keyword;
          if (postTitle && !coveredMap.has(postTitle.toLowerCase())) {
            coveredMap.set(postTitle.toLowerCase(), {
              id: j.id,
              title: postTitle,
              slug: postSlug,
              url: postUrl,
              primary_keyword: postKw,
              status: j.status || 'published',
              source: 'wordpress',
            });
          }
        }
      }
    } catch (jErr) {
      console.warn('[SiteContentGapDetector] wordpress_jobs query notice:', jErr);
    }

    // E. Query recent autopilot tasks for any last_article_title in stats
    try {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('schedule_config')
        .or('name.eq.Zero-Touch Full Autopilot,schedule_config->>full_autopilot.eq.true')
        .limit(10);

      if (tasks) {
        for (const t of tasks) {
          const lastTitle = t.schedule_config?.last_article_title || t.schedule_config?.stats?.last_article_title;
          const lastUrl = t.schedule_config?.last_article_url || t.schedule_config?.stats?.last_article_url;
          if (lastTitle && !coveredMap.has(lastTitle.toLowerCase())) {
            coveredMap.set(lastTitle.toLowerCase(), {
              title: lastTitle,
              slug: DuplicateArticleChecker.toSlug(lastTitle),
              url: lastUrl,
              status: 'published',
              source: 'wordpress',
            });
          }
        }
      }
    } catch (_) {}

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
            estimated_volume: z.number().describe('Estimated monthly search volume'),
            estimated_kd: z.number().describe('Estimated keyword difficulty score from 0 to 100'),
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

STRICT TOPIC DIVERSITY & ANTI-REPETITION MANDATE:
1. COMPLETE CATEGORY DIVERSITY: Every single proposed gap MUST belong to a DIFFERENT category or content pillar. NEVER return multiple gaps focused on the same subtopic or category.
2. ROTATE AWAY FROM SATURATED TOPICS: Look at the ALREADY PUBLISHED ARTICLES. If recent articles heavily cover one concept, all proposed gaps MUST explore the OTHER under-represented or thin categories (${inventory.thinCategories.join(', ') || 'categories with fewer posts'}).
3. DIVERSIFY SEARCH INTENT: Provide a balanced mix across categories (e.g. one tool review/comparison, one strategic framework, one channel execution guide, one troubleshooting/optimization guide).
4. ZERO DUPLICATION: Never suggest a topic, angle, or keyword that overlaps with any published article above.`,
        prompt: `Generate ${limit} distinct, high-impact CONTENT GAP opportunities spanning DIFFERENT categories and pillars for "${profile?.primaryNiche || inventory.domain}" without cannibalizing existing posts.`
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

  /**
   * Selects the most balanced, diverse topic from a list of candidates.
   * Prevents writing repeating/similar topics by penalizing concepts that appeared
   * in recent articles, boosting under-represented categories, and rotating pillars.
   */
  static selectBalancedTopic<T extends { keyword: string; working_title?: string; target_category?: string }>(
    candidates: T[],
    inventory: SiteInventory
  ): T | null {
    if (!candidates || candidates.length === 0) return null;

    // 1. Get the most recent 5 covered items (published or drafts)
    const recentItems = inventory.coveredItems.slice(0, 5);
    const recentTitles = recentItems.map(i => i.title.toLowerCase());
    const recentCategories = recentItems.map(i => (i.category || '').toLowerCase()).filter(Boolean);

    // Extract word frequencies from recent titles
    const recentWords = new Map<string, number>();
    const stopWords = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'how', 'to', 'in', 'of', 'on', 'a', 'an', 'is', 'are', 'your', 'best', 'guide', 'practical', 'complete', 'what', 'when', 'why', 'step']);
    for (const title of recentTitles) {
      const words = title.split(/[\s\-_:,|]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 3 && !stopWords.has(w));
      for (const w of words) {
        recentWords.set(w, (recentWords.get(w) || 0) + 1);
      }
    }

    // 2. Score each candidate
    const scored = candidates.map(c => {
      const title = (c.working_title || c.keyword).toLowerCase();
      const cat = (c.target_category || '').toLowerCase();

      // Check strict duplicate
      const dup = DuplicateArticleChecker.findDuplicateInInventory(c.keyword, inventory);
      if (dup.isDuplicate && (dup.url || dup.draftId)) {
        return { candidate: c, score: -9999 };
      }

      let score = 100;

      // Penalize words that appeared frequently in recent articles
      const candWords = title.split(/[\s\-_:,|]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 3 && !stopWords.has(w));
      for (const w of candWords) {
        const count = recentWords.get(w) || 0;
        if (count > 0) {
          // If word was in recent titles, heavily penalize repetition
          score -= count * 40;
        }
      }

      // Category diversity scoring
      if (cat) {
        const wasRecentlyUsed = recentCategories.includes(cat);
        if (wasRecentlyUsed) {
          score -= 30; // Rotate away from recently written category
        } else {
          score += 50; // Boost fresh category
        }

        const isThin = inventory.thinCategories.some(tc => tc.toLowerCase() === cat);
        if (isThin) {
          score += 40; // Boost thin category
        }
      }

      return { candidate: c, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    const best = scored.find(s => s.score > -5000);
    return best ? best.candidate : candidates[0] || null;
  }
}
