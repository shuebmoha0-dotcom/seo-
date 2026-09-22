import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '../tools/llm';
import { z } from 'zod';

export type AuthorityTier = 'new' | 'established';

export interface SiteNicheProfile {
  domain: string;
  websiteId?: string;
  siteUrl: string;
  primaryNiche: string;
  coreOfferings: string[];
  targetAudience: string;
  contentPillars: string[];
  nicheSeedKeywords: string[];
  negativeBoundaries: string[]; // What the site explicitly does NOT do
  liveCategories?: Array<{ name: string; count?: number }>;
  authorityTier: AuthorityTier;
  authorityMetrics: {
    pageCount: number;
    backlinkCount: number;
    gscImpressions: number;
    gscClicks: number;
    publishedArticlesCount: number;
  };
  keywordStrategy: {
    kdMin: number;
    kdMax: number;
    volumeMin: number;
    volumeMax: number;
    strategyDescription: string;
    focusIntent: 'long_tail_easy_wins' | 'competitive_authority_expansion';
  };
}

export class SiteNicheProfiler {
  /**
   * Profiles a website's exact niche, products/services, target audience,
   * and authority level to ensure 100% on-niche keyword recommendations
   * with appropriate Keyword Difficulty (KD) and real search volume.
   */
  static async profileSite(params: {
    websiteId?: string;
    domain: string;
    siteUrl?: string;
    forceFresh?: boolean;
  }): Promise<SiteNicheProfile> {
    const { websiteId, domain } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    // 1. Check for recent cached profile in project_memory (unless forceFresh)
    if (!params.forceFresh && websiteId) {
      try {
        const { data: cached } = await supabase
          .from('project_memory')
          .select('content, updated_at')
          .eq('website_id', websiteId)
          .eq('source', 'site_niche_profiler')
          .eq('is_outdated', false)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cached?.content) {
          const parsed = JSON.parse(cached.content) as SiteNicheProfile;
          if (
            parsed.primaryNiche &&
            parsed.authorityTier &&
            Array.isArray(parsed.contentPillars) &&
            parsed.contentPillars.length > 0 &&
            Array.isArray(parsed.nicheSeedKeywords) &&
            parsed.nicheSeedKeywords.length > 0
          ) {
            return parsed;
          }
        }
      } catch (cacheErr) {
        console.warn('[SiteNicheProfiler] Cache lookup note:', cacheErr);
      }
    }

    console.log(`[SiteNicheProfiler] Profiling site niche & authority for ${domain}...`);

    // 2. Gather live data across pages, categories, drafts, memory, and authority metrics
    let pagesData: Array<{ path: string; title?: string; meta_description?: string; h1?: string }> = [];
    let categoriesData: string[] = [];
    let existingArticleTitles: string[] = [];
    let projectMemoryContent = '';
    let contentRulesData: any = null;
    let pageCount = 0;
    let backlinkCount = 0;
    let gscImpressions = 0;
    let gscClicks = 0;
    let publishedArticlesCount = 0;

    if (websiteId) {
      const [
        pagesRes,
        draftsRes,
        backlinksRes,
        scRes,
        rulesRes,
        memoryRes,
      ] = await Promise.all([
        supabase.from('pages').select('path, title, meta_description, h1').eq('website_id', websiteId).limit(20),
        supabase.from('content_drafts').select('working_title, status').eq('website_id', websiteId).limit(30),
        supabase.from('acquired_backlinks').select('*', { count: 'exact', head: true }).eq('website_id', websiteId),
        supabase.from('search_console_data').select('impressions, clicks').eq('website_id', websiteId).limit(200),
        supabase.from('content_rules').select('*').eq('website_id', websiteId).maybeSingle(),
        supabase.from('project_memory').select('content, category, source').or(`website_id.eq.${websiteId},website_id.is.null`).eq('is_outdated', false).limit(10),
      ]);

      if (pagesRes.data) {
        pagesData = pagesRes.data;
        pageCount = pagesRes.data.length;
      }
      if (draftsRes.data) {
        existingArticleTitles = draftsRes.data.map(d => d.working_title).filter(Boolean);
        publishedArticlesCount = draftsRes.data.filter(d => d.status === 'published').length;
      }
      if (backlinksRes.count !== null && backlinksRes.count !== undefined) {
        backlinkCount = backlinksRes.count;
      }
      if (scRes.data && scRes.data.length > 0) {
        gscImpressions = scRes.data.reduce((sum, r) => sum + (Number(r.impressions) || 0), 0);
        gscClicks = scRes.data.reduce((sum, r) => sum + (Number(r.clicks) || 0), 0);
      }
      if (rulesRes.data) {
        contentRulesData = rulesRes.data;
      }
      if (memoryRes.data) {
        projectMemoryContent = memoryRes.data.map(m => `[${m.source || m.category}] ${m.content}`).join('\n\n');
      }
    }

    // 3. Fallback: If pages are empty in database, live fetch homepage metadata (3s timeout)
    if (pagesData.length === 0) {
      try {
        const homeRes = await fetch(siteUrl, {
          signal: AbortSignal.timeout(3500),
          headers: { 'User-Agent': 'SEO-Autopilot-Profiler/1.0' },
        });
        if (homeRes.ok) {
          const html = await homeRes.text();
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
          const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

          if (titleMatch || metaDescMatch || h1Match) {
            pagesData.push({
              path: '/',
              title: titleMatch ? titleMatch[1].trim() : undefined,
              meta_description: metaDescMatch ? metaDescMatch[1].trim() : undefined,
              h1: h1Match ? h1Match[1].trim() : undefined,
            });
            pageCount = 1;
          }
        }
      } catch (fetchErr) {
        console.warn('[SiteNicheProfiler] Live homepage fetch notice:', fetchErr);
      }
    }

    // 4. Also fetch WordPress categories if available
    let categoriesWithCounts: Array<{ name: string; count?: number }> = [];
    try {
      const catRes = await fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=20`, {
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': 'SEO-Autopilot-Profiler/1.0' },
      });
      if (catRes.ok) {
        const rawCats = await catRes.json();
        if (Array.isArray(rawCats)) {
          for (const c of rawCats) {
            if (c.slug !== 'uncategorized' && c.name) {
              const cleanName = c.name.replace(/&amp;/g, '&');
              categoriesData.push(cleanName);
              categoriesWithCounts.push({ name: cleanName, count: c.count || 0 });
            }
          }
        }
      }
    } catch (_) {}

    // 5. Determine Authority Tier (New vs Established)
    // A site is 'established' ONLY if it has significant backlink equity, many pages, or verified GSC traffic
    const isEstablished = backlinkCount >= 8 || pageCount >= 20 || gscImpressions >= 3000 || publishedArticlesCount >= 12;
    const authorityTier: AuthorityTier = isEstablished ? 'established' : 'new';

    const keywordStrategy = authorityTier === 'established'
      ? {
          kdMin: 30,
          kdMax: 55,
          volumeMin: 1000,
          volumeMax: 20000,
          strategyDescription: `Established domain with backlink equity (${backlinkCount} backlinks, ${pageCount} pages, ${gscImpressions.toLocaleString()} GSC impressions). Target medium-difficulty keywords (KD 30–55) with high search volume (1,000–15,000+/mo) to expand core topical authority.`,
          focusIntent: 'competitive_authority_expansion' as const,
        }
      : {
          kdMin: 10,
          kdMax: 30,
          volumeMin: 250,
          volumeMax: 2500,
          strategyDescription: `New / early-stage domain (${backlinkCount} backlinks, ${pageCount} indexed pages). Target EASY-TO-RANK long-tail keywords (KD 10–28, strictly KD <= 30) that have REAL search volume (250–2,500/mo). Zero tolerance for ghost keywords (< 200/mo).`,
          focusIntent: 'long_tail_easy_wins' as const,
        };

    // 6. Synthesize Exact Site Niche Profile via AI
    const homepage = pagesData.find(p => p.path === '/' || p.path === '') || pagesData[0];
    const evidenceSummary = {
      domain,
      siteUrl,
      homepageTitle: homepage?.title || '',
      homepageMetaDescription: homepage?.meta_description || '',
      homepageH1: homepage?.h1 || '',
      otherSamplePages: pagesData.slice(1, 6).map(p => ({ path: p.path, title: p.title, h1: p.h1 })),
      categoriesWithPostCounts: categoriesWithCounts,
      existingArticlesSample: existingArticleTitles.slice(0, 15),
      contentRulesAudience: contentRulesData?.audience || '',
      projectMemoryExcerpt: projectMemoryContent.slice(0, 800),
    };

    let primaryNiche = `${domain.replace(/\.[a-z]+$/i, '').replace(/[-_]/g, ' ')}`;
    let coreOfferings: string[] = [];
    let contentPillars: string[] = categoriesData.length > 0 ? categoriesData.slice(0, 5) : [primaryNiche];
    let nicheSeedKeywords: string[] = [];
    let targetAudience = contentRulesData?.audience || `Prospective customers and visitors of ${domain}`;
    let negativeBoundaries: string[] = [
      'Do not recommend unrelated generic software',
      'Do not recommend business plan templates unless specifically an online business planning tool',
      'Do not recommend unrelated coding tutorials',
    ];

    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'DiagnosticAgent',
        complexity: 'simple',
        schema: z.object({
          primary_niche: z.string().describe('Exact, highly specific industry and niche of this website (e.g. "B2B Cold Email Outreach & Sales Automation", "Dental Implants Clinic", "AI Video Editing SaaS")'),
          core_offerings: z.array(z.string()).describe('3-5 core products, services, or solutions this website provides'),
          target_audience: z.string().describe('Specific buyer persona or reader audience who uses this website'),
          content_pillars: z.array(z.string()).describe('3-5 foundational content pillars derived directly from verified site categories and articles'),
          niche_seed_keywords: z.array(z.string()).describe('6-10 real, high-intent Google search keywords that potential customers/readers use to find information in this exact niche (e.g. "cold email templates", "email warm up guide", "cold email deliverability", "b2b sales email", "cold outreach follow up")'),
          negative_boundaries: z.array(z.string()).describe('3-5 unrelated niches or topic areas that this website DOES NOT belong to, to prevent cross-niche hallucination'),
        }),
        system: `You are an elite Business Analyst and SEO Growth Architect.
Your task is to analyze evidence from the website "${domain}" and identify its EXACT, HIGH-PRECISION NICHE, CONTENT PILLARS, and SEARCH SEED KEYWORDS.

STRICT GROUNDING MANDATE:
- Heavily weigh the site's ACTUAL categories, published article titles, and knowledge bank.
- If the site has articles about Cold Email, Deliverability, and Outreach, the niche IS Cold Email Outreach & Sales Automation.
- Do NOT guess generic niches from bare domain syllables. Use the empirical evidence provided.
- Provide 6 to 10 realistic search queries that people in this niche actually search for in Google.`,
        prompt: `Analyze the site evidence for "${domain}" and extract the exact niche, offerings, target audience, content pillars, seed keywords, and negative boundaries:\n\n${JSON.stringify(evidenceSummary, null, 2)}`
      });

      if (object.primary_niche) primaryNiche = object.primary_niche;
      if (object.core_offerings?.length > 0) coreOfferings = object.core_offerings;
      if (object.target_audience) targetAudience = object.target_audience;
      if (object.content_pillars?.length > 0) contentPillars = object.content_pillars;
      if (object.niche_seed_keywords?.length > 0) nicheSeedKeywords = object.niche_seed_keywords;
      if (object.negative_boundaries?.length > 0) negativeBoundaries = object.negative_boundaries;
    } catch (llmErr) {
      console.warn('[SiteNicheProfiler] AI profiling fallback:', llmErr);
      if (homepage?.title) {
        primaryNiche = homepage.title.replace(/\s*[-|]\s*.*$/, '').trim();
      }
      if (nicheSeedKeywords.length === 0 && categoriesData.length > 0) {
        nicheSeedKeywords = categoriesData.map(c => c.toLowerCase());
      }
    }

    if (nicheSeedKeywords.length === 0) {
      nicheSeedKeywords = [
        primaryNiche.toLowerCase(),
        ...contentPillars.map(p => p.toLowerCase()),
      ].slice(0, 8);
    }

    const profile: SiteNicheProfile = {
      domain,
      websiteId,
      siteUrl,
      primaryNiche,
      coreOfferings,
      targetAudience,
      contentPillars,
      nicheSeedKeywords,
      negativeBoundaries,
      liveCategories: categoriesWithCounts,
      authorityTier,
      authorityMetrics: {
        pageCount,
        backlinkCount,
        gscImpressions,
        gscClicks,
        publishedArticlesCount,
      },
      keywordStrategy,
    };

    // 7. Cache in project_memory for fast subsequent retrieval
    if (websiteId) {
      try {
        await supabase.from('project_memory').upsert({
          website_id: websiteId,
          source: 'site_niche_profiler',
          category: 'site_niche_profile',
          content: JSON.stringify(profile),
          is_outdated: false,
          confidence: 'high',
        });
      } catch (_) {}
    }

    return profile;
  }
}
