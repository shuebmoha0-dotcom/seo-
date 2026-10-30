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
  saturatedCategories: string[];
  recentOverusedThemes?: string[];
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
   * 1. Crawls and compiles complete inventory of existing content for any client website (Newest First)
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

    // A. Query Supabase content_drafts ORDERED BY NEWEST FIRST so coveredItems[0..10] are always the most recent posts!
    try {
      let draftQuery = supabase
        .from('content_drafts')
        .select('id, working_title, primary_keyword, url_slug, status, revision_notes, website_id, created_at')
        .in('status', ['published', 'ready_for_approval', 'approved', 'brief_pending'])
        .order('created_at', { ascending: false });

      if (websiteId) {
        draftQuery = draftQuery.eq('website_id', websiteId);
      }

      const { data: drafts } = await draftQuery.limit(100);
      if (drafts) {
        for (const d of drafts) {
          const title = (d.working_title || '').trim();
          if (title && !coveredMap.has(title.toLowerCase())) {
            let wpUrl: string | undefined;
            let draftCategory: string | undefined;
            if (d.revision_notes && typeof d.revision_notes === 'string' && d.revision_notes.startsWith('{')) {
              try {
                const parsed = JSON.parse(d.revision_notes);
                if (parsed.wordpress_post_url) wpUrl = parsed.wordpress_post_url;
                if (parsed.link) wpUrl = wpUrl || parsed.link;
                if (parsed.url) wpUrl = wpUrl || parsed.url;
                if (parsed.target_category) draftCategory = parsed.target_category;
              } catch (_) {}
            }
            const fallbackSlug = (d.url_slug || '').replace(/^\/+/, '');
            const resolvedUrl = wpUrl || (d.status === 'published' && fallbackSlug ? `${siteUrl}/${fallbackSlug}` : undefined);

            coveredMap.set(title.toLowerCase(), {
              id: d.id,
              title,
              slug: fallbackSlug,
              url: resolvedUrl,
              primary_keyword: d.primary_keyword,
              category: draftCategory,
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

    // C. Live Crawl client WordPress API (Categories & Posts) with 3s timeout (only if response is JSON)
    try {
      const [catRes, postRes] = await Promise.all([
        fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=25`, {
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'SEO-Autopilot-GapDetector/1.0' },
        }),
        fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=50&_fields=id,title,slug,link,categories`, {
          signal: AbortSignal.timeout(3500),
          headers: { 'User-Agent': 'SEO-Autopilot-GapDetector/1.0' },
        }),
      ]);

      const catContentType = catRes.headers.get('content-type') || '';
      if (catRes.ok && catContentType.includes('application/json')) {
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

      const postContentType = postRes.headers.get('content-type') || '';
      if (postRes.ok && postContentType.includes('application/json')) {
        const rawPosts = await postRes.json();
        const catMap = new Map<number, string>();
        for (const cat of categories) {
          if (cat.id) catMap.set(cat.id, cat.name);
        }

        if (Array.isArray(rawPosts)) {
          for (const p of rawPosts) {
            const rawTitle = p.title?.rendered ? p.title.rendered.replace(/&amp;/g, '&').replace(/&#8217;/g, "'").trim() : '';
            const postCats: number[] = Array.isArray(p.categories) ? p.categories : [];
            const categoryName = postCats.length > 0 && catMap.has(postCats[0]) ? catMap.get(postCats[0]) : undefined;

            if (rawTitle) {
              const existing = coveredMap.get(rawTitle.toLowerCase());
              if (existing) {
                if (!existing.category && categoryName) existing.category = categoryName;
                if (!existing.url && p.link) existing.url = p.link;
              } else {
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
      }
    } catch (_) {
      // Non-WordPress sites (e.g. Next.js / custom CMS) naturally skip WP REST API
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
    } catch (_) {}

    const coveredItems = Array.from(coveredMap.values());
    const coveredTitles = coveredItems.map(i => i.title);
    const coveredKeywords = coveredItems.map(i => i.primary_keyword).filter(Boolean) as string[];

    // E. Dynamic Multi-Tenant Category & Pillar Resolution (Rule 8 Compliant)
    let finalCategories = [...categories];
    if (finalCategories.length === 0 && websiteId) {
      // Load dynamic content pillars from project_memory for non-WordPress sites
      try {
        const { data: memRows } = await supabase
          .from('project_memory')
          .select('source, category, content')
          .eq('website_id', websiteId)
          .eq('source', 'site_niche_profiler')
          .eq('is_outdated', false)
          .order('created_at', { ascending: false })
          .limit(1);

        const dynamicPillars: string[] = [];
        const liveCatsFromProfile: Array<{ name: string; count: number }> = [];
        for (const row of memRows || []) {
          try {
            const parsed = JSON.parse(row.content);
            if (Array.isArray(parsed.liveCategories) && parsed.liveCategories.length > 0) {
              for (const lc of parsed.liveCategories) {
                if (lc?.name && typeof lc.name === 'string') {
                  liveCatsFromProfile.push({ name: lc.name.trim(), count: Number(lc.count || 0) });
                }
              }
            }
            if (Array.isArray(parsed.contentPillars)) {
              for (const p of parsed.contentPillars) {
                if (typeof p === 'string' && p.trim() && !dynamicPillars.includes(p.trim())) {
                  dynamicPillars.push(p.trim());
                }
              }
            }
          } catch (_) {}
        }

        if (liveCatsFromProfile.length > 0) {
          finalCategories = liveCatsFromProfile.map((lc, idx) => ({
            id: idx + 1,
            name: lc.name,
            slug: DuplicateArticleChecker.toSlug(lc.name),
            count: lc.count,
          }));
        } else if (dynamicPillars.length > 0) {
          finalCategories = dynamicPillars.slice(0, 8).map((name, idx) => {
            const pillarWords = DuplicateArticleChecker.extractCoreWords(name);
            let count = 0;
            for (const title of coveredTitles) {
              const titleWords = DuplicateArticleChecker.extractCoreWords(title);
              if (DuplicateArticleChecker.calculateOverlap(pillarWords, titleWords) >= 0.25) {
                count++;
              }
            }
            return {
              id: idx + 1,
              name,
              slug: DuplicateArticleChecker.toSlug(name),
              count,
            };
          });
        }
      } catch (_) {}
    }

    // F. Empirical Title-Stem & Recent-Post Saturation Analysis
    // Detects overused concepts across both the last 10 recent posts AND the full inventory
    const recentTitles = coveredTitles.slice(0, 10);
    const recentStemCounts = new Map<string, number>();
    const totalStemCounts = new Map<string, number>();

    const stemToken = (w: string) => w.replace(/ies$/, 'y').replace(/(es|s)$/, '');

    for (const t of recentTitles) {
      const words = Array.from(DuplicateArticleChecker.extractCoreWords(t)).map(stemToken);
      for (const w of words) {
        if (w.length >= 3) {
          recentStemCounts.set(w, (recentStemCounts.get(w) || 0) + 1);
        }
      }
    }

    for (const t of coveredTitles) {
      const words = Array.from(DuplicateArticleChecker.extractCoreWords(t)).map(stemToken);
      for (const w of words) {
        if (w.length >= 3) {
          totalStemCounts.set(w, (totalStemCounts.get(w) || 0) + 1);
        }
      }
    }

    const recentOverusedThemes: string[] = [];
    for (const [stem, count] of recentStemCounts.entries()) {
      // Any core topical stem appearing in >= 2 of the last 10 articles is flagged as recently overused
      if (count >= 2) {
        recentOverusedThemes.push(stem);
      }
    }
    for (const [stem, count] of totalStemCounts.entries()) {
      // Any core topical stem appearing in >= 25% of all articles (min 3) is flagged as saturated
      if (count >= 3 && count / Math.max(1, coveredTitles.length) >= 0.25 && !recentOverusedThemes.includes(stem)) {
        recentOverusedThemes.push(stem);
      }
    }

    // G. Compute Saturated vs Thin Categories
    const saturatedCategories: string[] = [];
    const counts = finalCategories.map(c => c.count || 0).sort((a, b) => a - b);
    const medianCount = counts.length > 0 ? counts[Math.floor(counts.length / 2)] : 2;

    for (const cat of finalCategories) {
      const catCount = cat.count || 0;
      const catStems = Array.from(DuplicateArticleChecker.extractCoreWords(cat.name)).map(stemToken);
      const hitsOverusedStem = catStems.some(s => recentOverusedThemes.includes(s));

      if (
        (catCount >= 10 && catCount >= Math.max(4, medianCount * 1.5)) ||
        (coveredTitles.length >= 8 && catCount / coveredTitles.length >= 0.30) ||
        (hitsOverusedStem && catCount >= 3)
      ) {
        if (!saturatedCategories.includes(cat.name)) {
          saturatedCategories.push(cat.name);
        }
      }
    }

    const thinCategories = finalCategories
      .filter(c => !saturatedCategories.includes(c.name))
      .sort((a, b) => (a.count || 0) - (b.count || 0))
      .map(c => c.name);

    return {
      domain,
      siteUrl,
      coveredItems,
      coveredTitles,
      coveredKeywords,
      categories: finalCategories,
      thinCategories,
      saturatedCategories,
      recentOverusedThemes,
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

    let activeMemory = projectMemory || '';
    if (!activeMemory && websiteId) {
      try {
        const supabase = createAdminClient();
        const { data: mems } = await supabase
          .from('project_memory')
          .select('content')
          .eq('website_id', websiteId)
          .neq('category', 'telegram_vault')
          .neq('category', 'workflow')
          .limit(8);
        if (mems && mems.length > 0) {
          activeMemory = mems
            .map(m => m.content)
            .filter(Boolean)
            .join('\n');
        }
      } catch (_) {}
    }

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

    const mostRecent10 = inventory.coveredTitles.slice(0, 10);
    const coveredTitlesSample = inventory.coveredTitles.slice(0, 45);
    const categoryList = inventory.categories.map(c => `• ${c.name} (${c.count || 0} existing articles)`).join('\n');
    const overusedThemes = inventory.recentOverusedThemes || [];

    const isEstablished = profile?.authorityTier === 'established';
    const kdMin = profile?.keywordStrategy?.kdMin || (isEstablished ? 30 : 10);
    const kdMax = profile?.keywordStrategy?.kdMax || (isEstablished ? 55 : 30);
    const volMin = profile?.keywordStrategy?.volumeMin || (isEstablished ? 1000 : 250);
    const volMax = profile?.keywordStrategy?.volumeMax || (isEstablished ? 20000 : 2500);

    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'KeywordAgent',
        complexity: 'complex',
        schema: z.object({
          gaps: z.array(z.object({
            keyword: z.string(),
            working_title: z.string().describe('Compelling publication-ready editorial article title, 50-65 chars, NEVER bare generic 1-3 word keyword'),
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
• Content Pillars: ${profile?.contentPillars?.join(' | ') || inventory.thinCategories.join(' | ')}
• Target Audience: ${profile?.targetAudience || 'Target customers and searchers'}
${profile?.negativeBoundaries?.length ? `• OUT-OF-SCOPE BOUNDARIES (DO NOT RECOMMEND): ${profile.negativeBoundaries.join('; ')}` : ''}

AUTHORITY TIER & DIFFICULTY TARGETING:
• Authority Level: ${isEstablished ? 'ESTABLISHED SITE (with backlink equity and indexed authority)' : 'NEW / EARLY STAGE SITE (low domain authority)'}
• Target Keyword Difficulty: ${isEstablished ? `MEDIUM (KD ${kdMin}–${kdMax})` : `EASY TO RANK (KD ${kdMin}–${kdMax}, strictly KD <= 30)`}
• Search Demand Floor: REAL TRAFFIC ONLY (${volMin.toLocaleString()} to ${volMax.toLocaleString()}/mo) — ZERO tolerance for ghost keywords (< 200/mo).

VERIFIED SITE CATEGORIES & COVERAGE:
${categoryList || '• General Industry Topics'}

MOST RECENTLY PUBLISHED ARTICLES (DO NOT WRITE SIMILAR SUBTOPICS OR ANGLES TO THESE):
${mostRecent10.length > 0 ? mostRecent10.map((t, idx) => `${idx + 1}. "${t}"`).join('\n') : '• None yet.'}

OVERUSED RECENT WORD STEMS / THEMES (STRICTLY AVOID REPEATING THESE CONCEPTS):
${overusedThemes.length > 0 ? `[${overusedThemes.join(', ')}] — You MUST pivot away from these overused terms and explore fresh, under-served pillars!` : '• None flagged.'}

FULL PUBLISHED INVENTORY (ZERO DUPLICATION ALLOWED):
${coveredTitlesSample.length > 0 ? coveredTitlesSample.map(t => `- "${t}"`).join('\n') : '• No published articles detected yet.'}

${activeMemory ? `CLIENT BRAND MEMORY & STRATEGY RULES:\n${activeMemory.slice(0, 800)}\n` : ''}
${projectInstructions ? `Instructions: ${projectInstructions.slice(0, 200)}` : ''}

STRICT TOPIC DIVERSITY & ANTI-REPETITION MANDATE:
1. COMPLETE PILLAR ROTATION: Every single proposed gap MUST belong to a DIFFERENT category or content pillar. NEVER return multiple gaps focused on the same subtopic or category.
2. LOCK OUT SATURATED CATEGORIES & OVERUSED THEMES:
${inventory.saturatedCategories && inventory.saturatedCategories.length > 0 ? `   • SATURATED CATEGORIES LOCKED FROM NEW WRITING: [${inventory.saturatedCategories.join(', ')}] already have excessive articles. STRICTLY DO NOT propose topics in these saturated categories.\n` : ''}   • UNDER-REPRESENTED PILLARS TO PRIORITIZE: Focus 100% on: [${inventory.thinCategories.join(', ') || profile?.contentPillars?.join(', ') || 'All under-served pillars'}].
3. ZERO SIMILARITY TO RECENT 10 POSTS: Do not propose another variation of topics covered in the Most Recently Published Articles list above.
4. DIVERSIFY SEARCH INTENT & FORMAT: Mix formats across pillars (e.g. 1 head-to-head comparison, 1 step-by-step technical tutorial, 1 data/benchmark breakdown, 1 buyer evaluation guide).
5. EDITORIAL TITLE QUALITY: working_title MUST be a specific, engaging editorial title (50–65 characters) — avoid repetitive title templates like ": A Practical B2B Playbook" or "for Lean B2B Teams" on every post!`,
        prompt: `Generate ${Math.max(limit, 6)} distinct, non-overlapping CONTENT GAP opportunities spanning DIFFERENT under-represented categories and pillars for "${profile?.primaryNiche || inventory.domain}".`
      });

      const validatedGaps: ContentGapOpportunity[] = [];
      for (const gap of object.gaps) {
        let title = (gap.working_title || '').trim();
        const titleWords = title.split(/\s+/).filter(Boolean);
        if (!title || titleWords.length <= 3 || title.toLowerCase() === gap.keyword.trim().toLowerCase()) {
          const kw = gap.keyword.charAt(0).toUpperCase() + gap.keyword.slice(1);
          title = `${kw}: Step-by-Step Implementation & Benchmarks`;
          gap.working_title = title;
        }

        let isOverlapping = false;
        const gapText = `${gap.working_title} ${gap.keyword}`;
        const wordsA = DuplicateArticleChecker.extractCoreWords(gapText);

        // 1. Check against all covered titles
        for (let idx = 0; idx < inventory.coveredTitles.length; idx++) {
          const existingTitle = inventory.coveredTitles[idx];
          const dupMatch = DuplicateArticleChecker.isTopicDuplicate(gapText, existingTitle);
          if (dupMatch.isDuplicate) {
            isOverlapping = true;
            console.log(`[SiteContentGapDetector] Rejected duplicate gap "${gap.working_title}" (matches "${existingTitle}")`);
            break;
          }

          const wordsB = DuplicateArticleChecker.extractCoreWords(existingTitle);
          const overlap = DuplicateArticleChecker.calculateOverlap(wordsA, wordsB);
          // Stricter overlap threshold (0.38) against the 10 most recent articles, 0.48 against older articles
          const threshold = idx < 10 ? 0.38 : 0.48;
          if (overlap >= threshold) {
            isOverlapping = true;
            console.log(`[SiteContentGapDetector] Rejected similar gap "${gap.working_title}" (${Math.round(overlap * 100)}% overlap with "${existingTitle}")`);
            break;
          }
        }

        // 2. Also ensure no two validated gaps in the same batch overlap with each other
        if (!isOverlapping) {
          for (const accepted of validatedGaps) {
            const acceptedWords = DuplicateArticleChecker.extractCoreWords(`${accepted.working_title} ${accepted.keyword}`);
            if (
              DuplicateArticleChecker.calculateOverlap(wordsA, acceptedWords) >= 0.35 ||
              accepted.target_category.toLowerCase() === gap.target_category.toLowerCase()
            ) {
              isOverlapping = true;
              break;
            }
          }
        }

        if (!isOverlapping) {
          validatedGaps.push(gap);
        }
      }

      // Rank validated gaps by diversity score so index 0 is always the freshest pillar
      return this.rankCandidatesByDiversity(validatedGaps, inventory).slice(0, limit);
    } catch (err: any) {
      console.warn('[SiteContentGapDetector] Content gap discovery error:', err?.message || err);
      return [];
    }
  }

  /**
   * Ranks a list of candidate topics from most diverse/under-represented to least,
   * penalizing any stems or categories that appeared in the last 10 published articles.
   */
  static rankCandidatesByDiversity<T extends { keyword: string; working_title?: string; target_category?: string }>(
    candidates: T[],
    inventory: SiteInventory
  ): T[] {
    if (!candidates || candidates.length === 0) return [];

    // 1. Inspect the 10 most recent covered items (which are newest-first)
    const recentItems = inventory.coveredItems.slice(0, 10);
    const recentTitles = recentItems.map(i => i.title.toLowerCase());
    const recentCategories = recentItems.map(i => (i.category || '').toLowerCase()).filter(Boolean);

    const stemToken = (w: string) => w.replace(/ies$/, 'y').replace(/(es|s)$/, '');
    const recentWords = new Map<string, number>();

    recentTitles.forEach((title, idx) => {
      const words = Array.from(DuplicateArticleChecker.extractCoreWords(title)).map(stemToken);
      // Weight the last 4 articles extra heavily (weight 3) vs articles 5-10 (weight 1.5)
      const recencyWeight = idx < 4 ? 3 : 1.5;
      for (const w of words) {
        recentWords.set(w, (recentWords.get(w) || 0) + recencyWeight);
      }
    });

    const overusedSet = new Set((inventory.recentOverusedThemes || []).map(stemToken));

    const scored = candidates.map(c => {
      const combinedText = `${c.working_title || ''} ${c.keyword}`;
      const cat = (c.target_category || '').toLowerCase();

      const dup = DuplicateArticleChecker.findDuplicateInInventory(combinedText, inventory);
      if (dup.isDuplicate && (dup.url || dup.draftId)) {
        return { candidate: c, score: -9999 };
      }

      let score = 100;

      const candWords = Array.from(DuplicateArticleChecker.extractCoreWords(combinedText)).map(stemToken);
      for (const w of candWords) {
        const recentWeight = recentWords.get(w) || 0;
        if (recentWeight > 0) {
          score -= recentWeight * 35;
        }
        if (overusedSet.has(w)) {
          score -= 55;
        }
      }

      if (cat) {
        const isSaturated = (inventory.saturatedCategories || []).some(
          sc => sc.toLowerCase() === cat || cat.includes(sc.toLowerCase()) || sc.toLowerCase().includes(cat)
        );
        if (isSaturated) {
          score -= 160;
        }

        const wasRecentlyUsed = recentCategories.some(rc => rc === cat || rc.includes(cat) || cat.includes(rc));
        if (wasRecentlyUsed) {
          score -= 80;
        } else {
          score += 65;
        }

        const isThin = inventory.thinCategories.some(
          tc => tc.toLowerCase() === cat || cat.includes(tc.toLowerCase()) || tc.toLowerCase().includes(cat)
        );
        if (isThin) {
          score += 95;
        }
      }

      return { candidate: c, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter(s => s.score > -5000).map(s => s.candidate);
  }

  /**
   * Selects the single most balanced, diverse topic from a list of candidates.
   */
  static selectBalancedTopic<T extends { keyword: string; working_title?: string; target_category?: string }>(
    candidates: T[],
    inventory: SiteInventory
  ): T | null {
    const ranked = this.rankCandidatesByDiversity(candidates, inventory);
    return ranked[0] || candidates[0] || null;
  }
}
