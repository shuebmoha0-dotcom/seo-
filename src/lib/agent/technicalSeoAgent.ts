import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteTech =
  | 'nextjs' | 'react' | 'astro' | 'nuxt' | 'static_html'
  | 'webflow' | 'wordpress' | 'shopify' | 'headless_cms' | 'custom' | 'unknown';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueCategory =
  | 'crawlability' | 'indexability' | 'redirects' | 'broken_links'
  | 'canonicals' | 'sitemap' | 'robots' | 'performance' | 'structured_data'
  | 'duplicates' | 'orphan_pages' | 'javascript' | 'hreflang'
  | 'security' | 'mobile' | 'pagination' | 'internal_links' | 'other';

export type AutomationLevel = 'auto' | 'semi_auto' | 'manual' | 'requires_approval';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface TechnicalIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  issue_type: string;
  title: string;
  description: string;
  evidence?: string;
  affected_urls: string[];
  affected_url_count: number;
  sample_url?: string;
  seo_impact: string;
  business_impact: string;
  recommended_fix: string;
  estimated_effort: 'minutes' | 'hours' | 'days' | 'weeks';
  risk_level: RiskLevel;
  automation_level: AutomationLevel;
  status: 'open' | 'in_progress' | 'fixed' | 'verified' | 'failed' | 'wont_fix' | 'acknowledged';
  pr_url?: string;
}

export interface CrawledUrl {
  url: string;
  status_code: number;
  redirect_target?: string;
  canonical_url?: string;
  canonical_is_self?: boolean;
  robots_directive?: string;
  in_sitemap: boolean;
  is_indexable: boolean;
  title?: string;
  meta_description?: string;
  h1?: string;
  word_count?: number;
  internal_links_in: number;
  internal_links_out: number;
  is_orphan: boolean;
  has_schema: boolean;
  schema_types?: string[];
  has_duplicate_title?: boolean;
  has_duplicate_meta?: boolean;
  has_thin_content?: boolean;
}

export interface CrawlResult {
  total_urls_found: number;
  total_urls_crawled: number;
  urls_200: number;
  urls_301: number;
  urls_302: number;
  urls_404: number;
  urls_5xx: number;
  urls_noindex: number;
  urls_indexed: number;
  urls_orphaned: number;
  broken_internal_links: number;
  crawlability_score: number;
  indexability_score: number;
  technical_health_score: number;
  urls: CrawledUrl[];
  issues: TechnicalIssue[];
  site_tech: SiteTech;
}

export interface CrawlInput {
  start_url: string;
  site_tech?: SiteTech;
  max_urls?: number;
  crawl_depth?: number;
  project_instructions?: string;
  is_new_website?: boolean;
}

// ─── Tech detection heuristics ────────────────────────────────────────────────
const TECH_SIGNALS: Record<SiteTech, { patterns: RegExp[]; fix_notes: string }> = {
  nextjs:      { patterns: [/__next/, /_next\/static/, /next\.js/i], fix_notes: 'Changes via next.config.ts, app/robots.ts, app/sitemap.ts, or metadata API.' },
  react:       { patterns: [/react\.production/, /react-dom/], fix_notes: 'Changes typically via build config or framework layer.' },
  astro:       { patterns: [/astro:/, /astro\.build/], fix_notes: 'Changes via astro.config.mjs, src/pages/, or frontmatter.' },
  nuxt:        { patterns: [/__nuxt/, /nuxt\.js/i], fix_notes: 'Changes via nuxt.config.ts or composables.' },
  static_html: { patterns: [/<html/i], fix_notes: 'Direct HTML file edits.' },
  webflow:     { patterns: [/webflow\.com/, /wf-form/], fix_notes: 'Changes via Webflow designer or page settings.' },
  wordpress:   { patterns: [/wp-content/, /wp-json/, /wordpress/i], fix_notes: 'Changes via theme, plugin, or WP admin.' },
  shopify:     { patterns: [/cdn\.shopify/, /myshopify\.com/], fix_notes: 'Changes via Shopify theme or admin panel.' },
  headless_cms:{ patterns: [/contentful/, /sanity\.io/, /prismic/], fix_notes: 'Changes via CMS API or content model.' },
  custom:      { patterns: [], fix_notes: 'Custom implementation — review server config and routing.' },
  unknown:     { patterns: [], fix_notes: 'Technology not detected. Manual inspection required.' },
};

// ─── Deterministic issue detection from crawl data ────────────────────────────

function detectIssuesFromCrawl(urls: CrawledUrl[], siteTech: SiteTech): TechnicalIssue[] {
  const issues: TechnicalIssue[] = [];
  const techNotes = TECH_SIGNALS[siteTech]?.fix_notes || '';
  let idCounter = 0;
  const nextId = () => `issue-${++idCounter}`;

  const broken404 = urls.filter(u => u.status_code === 404);
  const broken5xx = urls.filter(u => u.status_code >= 500);
  const noindex = urls.filter(u => !u.is_indexable && u.status_code === 200);
  const orphans = urls.filter(u => u.is_orphan && u.is_indexable);
  const redirectChains = urls.filter(u => [301, 302].includes(u.status_code));
  const missingCanonical = urls.filter(u => u.is_indexable && !u.canonical_url);
  const thinContent = urls.filter(u => u.has_thin_content && u.is_indexable);
  const dupTitles = urls.filter(u => u.has_duplicate_title);
  const noMeta = urls.filter(u => u.is_indexable && !u.meta_description);
  const noH1 = urls.filter(u => u.is_indexable && !u.h1);
  const notInSitemap = urls.filter(u => u.is_indexable && !u.in_sitemap && u.status_code === 200);

  if (broken404.length > 0) {
    issues.push({
      id: nextId(), category: 'broken_links', severity: broken404.length > 10 ? 'critical' : 'high',
      issue_type: 'broken_internal_links',
      title: `${broken404.length} page${broken404.length > 1 ? 's' : ''} returning 404`,
      description: `${broken404.length} URL${broken404.length > 1 ? 's' : ''} found returning HTTP 404. These break user experience and waste crawl budget.`,
      evidence: `Sample: ${broken404.slice(0, 3).map(u => u.url).join(', ')}`,
      affected_urls: broken404.map(u => u.url),
      affected_url_count: broken404.length,
      sample_url: broken404[0]?.url,
      seo_impact: 'Wastes crawl budget; broken links reduce internal link equity.',
      business_impact: 'Users hitting 404s leave the site.',
      recommended_fix: `Set up 301 redirects to relevant pages or remove links to these URLs. ${techNotes}`,
      estimated_effort: broken404.length > 20 ? 'hours' : 'minutes',
      risk_level: 'medium', automation_level: 'requires_approval', status: 'open',
    });
  }

  if (broken5xx.length > 0) {
    issues.push({
      id: nextId(), category: 'crawlability', severity: 'critical',
      issue_type: 'server_errors',
      title: `${broken5xx.length} server error${broken5xx.length > 1 ? 's' : ''} (5xx)`,
      description: `${broken5xx.length} URL${broken5xx.length > 1 ? 's' : ''} returning 5xx server errors. Critical — prevents crawling and indexing.`,
      evidence: `Sample: ${broken5xx.slice(0, 3).map(u => u.url).join(', ')}`,
      affected_urls: broken5xx.map(u => u.url),
      affected_url_count: broken5xx.length,
      sample_url: broken5xx[0]?.url,
      seo_impact: 'Google cannot crawl or index pages with server errors.',
      business_impact: 'Users cannot reach these pages.',
      recommended_fix: 'Investigate server/application errors. Check error logs immediately.',
      estimated_effort: 'hours', risk_level: 'high', automation_level: 'manual', status: 'open',
    });
  }

  if (noindex.length > 0) {
    const importantNoindex = noindex.filter(u => (u.internal_links_in || 0) > 3);
    if (importantNoindex.length > 0) {
      issues.push({
        id: nextId(), category: 'indexability', severity: 'high',
        issue_type: 'unintentional_noindex',
        title: `${importantNoindex.length} potentially important page${importantNoindex.length > 1 ? 's' : ''} blocked from indexing`,
        description: `${importantNoindex.length} page${importantNoindex.length > 1 ? 's with' : ' with'} significant internal links ${importantNoindex.length > 1 ? 'are' : 'is'} marked noindex. Verify these are intentional.`,
        evidence: `${importantNoindex.slice(0, 3).map(u => u.url).join(', ')}`,
        affected_urls: importantNoindex.map(u => u.url),
        affected_url_count: importantNoindex.length,
        sample_url: importantNoindex[0]?.url,
        seo_impact: 'These pages cannot appear in search results.',
        business_impact: 'Potential loss of organic visibility on important pages.',
        recommended_fix: 'Verify noindex directives are intentional. Remove if pages should be indexed.',
        estimated_effort: 'minutes', risk_level: 'medium', automation_level: 'requires_approval', status: 'open',
      });
    }
  }

  if (orphans.length > 0) {
    issues.push({
      id: nextId(), category: 'orphan_pages', severity: orphans.length > 5 ? 'high' : 'medium',
      issue_type: 'orphan_pages',
      title: `${orphans.length} orphan page${orphans.length > 1 ? 's' : ''} with no internal links`,
      description: `${orphans.length} indexable page${orphans.length > 1 ? 's have' : ' has'} zero internal links pointing to it. Google may struggle to discover and value these pages.`,
      evidence: `Sample: ${orphans.slice(0, 3).map(u => u.url).join(', ')}`,
      affected_urls: orphans.map(u => u.url),
      affected_url_count: orphans.length,
      sample_url: orphans[0]?.url,
      seo_impact: 'Orphan pages receive minimal PageRank and may not be crawled regularly.',
      business_impact: 'Content investment not supported by site structure.',
      recommended_fix: 'Add relevant internal links to these pages from related content.',
      estimated_effort: 'hours', risk_level: 'low', automation_level: 'semi_auto', status: 'open',
    });
  }

  if (redirectChains.length > 0) {
    const chains302 = redirectChains.filter(u => u.status_code === 302 && u.redirect_target);
    if (chains302.length > 0) {
      issues.push({
        id: nextId(), category: 'redirects', severity: 'medium',
        issue_type: 'temporary_redirects',
        title: `${chains302.length} temporary redirect${chains302.length > 1 ? 's' : ''} (302) may be permanent`,
        description: `${chains302.length} URL${chains302.length > 1 ? 's are' : ' is'} using 302 (temporary) redirects. If these are permanent URL changes, 301s should be used instead.`,
        evidence: `Sample: ${chains302.slice(0, 3).map(u => `${u.url} → ${u.redirect_target}`).join(', ')}`,
        affected_urls: chains302.map(u => u.url),
        affected_url_count: chains302.length,
        sample_url: chains302[0]?.url,
        seo_impact: '302 redirects may not pass full link equity to the destination.',
        business_impact: 'Link equity loss if these are permanent moves.',
        recommended_fix: 'Review each 302. Change to 301 if the redirect is permanent.',
        estimated_effort: 'hours', risk_level: 'high', automation_level: 'requires_approval', status: 'open',
      });
    }
  }

  if (missingCanonical.length > 0) {
    issues.push({
      id: nextId(), category: 'canonicals', severity: 'medium',
      issue_type: 'missing_canonical',
      title: `${missingCanonical.length} indexable page${missingCanonical.length > 1 ? 's' : ''} missing canonical tag`,
      description: `${missingCanonical.length} page${missingCanonical.length > 1 ? 's' : ''} that could appear in search results ${missingCanonical.length > 1 ? 'do' : 'does'} not have a canonical tag. This can cause duplicate content issues.`,
      affected_urls: missingCanonical.map(u => u.url),
      affected_url_count: missingCanonical.length,
      sample_url: missingCanonical[0]?.url,
      seo_impact: 'Without canonicals, Google must determine the preferred version itself, sometimes incorrectly.',
      business_impact: 'Potential duplicate content dilution.',
      recommended_fix: `Add self-referencing canonical tags to all indexable pages. ${techNotes}`,
      estimated_effort: missingCanonical.length > 50 ? 'hours' : 'minutes',
      risk_level: 'low', automation_level: 'semi_auto', status: 'open',
    });
  }

  if (thinContent.length > 0) {
    issues.push({
      id: nextId(), category: 'indexability', severity: 'medium',
      issue_type: 'thin_content',
      title: `${thinContent.length} page${thinContent.length > 1 ? 's' : ''} with thin content`,
      description: `${thinContent.length} indexable page${thinContent.length > 1 ? 's have' : ' has'} fewer than 300 words. Thin content may be considered low-value by search engines.`,
      affected_urls: thinContent.map(u => u.url),
      affected_url_count: thinContent.length,
      sample_url: thinContent[0]?.url,
      seo_impact: 'Thin pages may not rank well or may negatively affect domain quality perception.',
      business_impact: 'Missed organic traffic opportunity.',
      recommended_fix: 'Expand content where appropriate, or add noindex if pages serve a non-SEO purpose.',
      estimated_effort: 'days', risk_level: 'low', automation_level: 'manual', status: 'open',
    });
  }

  if (dupTitles.length > 0) {
    issues.push({
      id: nextId(), category: 'duplicates', severity: 'medium',
      issue_type: 'duplicate_titles',
      title: `${dupTitles.length} page${dupTitles.length > 1 ? 's' : ''} with duplicate title tags`,
      description: `${dupTitles.length} page${dupTitles.length > 1 ? 's share' : ' shares'} a title tag with at least one other page. Unique titles help Google understand page relevance.`,
      affected_urls: dupTitles.map(u => u.url),
      affected_url_count: dupTitles.length,
      sample_url: dupTitles[0]?.url,
      seo_impact: 'Duplicate titles confuse search engines about page purpose.',
      business_impact: 'Reduced organic click-through due to generic titles.',
      recommended_fix: 'Write unique, descriptive titles for each page.',
      estimated_effort: 'hours', risk_level: 'low', automation_level: 'semi_auto', status: 'open',
    });
  }

  if (noMeta.length > 5) {
    issues.push({
      id: nextId(), category: 'indexability', severity: 'low',
      issue_type: 'missing_meta_descriptions',
      title: `${noMeta.length} indexable page${noMeta.length > 1 ? 's' : ''} missing meta descriptions`,
      description: `${noMeta.length} page${noMeta.length > 1 ? 's are' : ' is'} missing meta descriptions. Google will generate its own, often poorly.`,
      affected_urls: noMeta.slice(0, 20).map(u => u.url),
      affected_url_count: noMeta.length,
      sample_url: noMeta[0]?.url,
      seo_impact: 'Missing meta descriptions reduce CTR control.',
      business_impact: 'Lower qualified click-through from SERPs.',
      recommended_fix: 'Write unique meta descriptions (130–155 chars) for all important pages.',
      estimated_effort: 'hours', risk_level: 'low', automation_level: 'semi_auto', status: 'open',
    });
  }

  if (notInSitemap.length > 0) {
    const importantMissing = notInSitemap.filter(u => (u.internal_links_in || 0) > 2);
    if (importantMissing.length > 0) {
      issues.push({
        id: nextId(), category: 'sitemap', severity: 'medium',
        issue_type: 'pages_missing_from_sitemap',
        title: `${importantMissing.length} indexable page${importantMissing.length > 1 ? 's' : ''} not in XML sitemap`,
        description: `${importantMissing.length} page${importantMissing.length > 1 ? 's' : ''} with internal links are indexed but not in the sitemap, reducing crawl discovery.`,
        affected_urls: importantMissing.map(u => u.url),
        affected_url_count: importantMissing.length,
        sample_url: importantMissing[0]?.url,
        seo_impact: 'Pages not in sitemap rely solely on internal links for discovery.',
        business_impact: 'New content may be crawled slower.',
        recommended_fix: `Add important indexable pages to the XML sitemap. ${techNotes}`,
        estimated_effort: 'minutes', risk_level: 'low', automation_level: 'semi_auto', status: 'open',
      });
    }
  }

  return issues;
}

// ─── Diagnostic Scores ────────────────────────────────────────────────────────
function computeScores(urls: CrawledUrl[], issues: TechnicalIssue[]): {
  crawlability: number;
  indexability: number;
  technical_health: number;
} {
  const total = urls.length || 1;
  const ok200 = urls.filter(u => u.status_code === 200).length;
  const indexed = urls.filter(u => u.is_indexable && u.status_code === 200).length;
  const criticalIssues = issues.filter(i => i.severity === 'critical').length;
  const highIssues = issues.filter(i => i.severity === 'high').length;

  const crawlability = Math.max(0, Math.min(100,
    Math.round((ok200 / total) * 100) - (criticalIssues * 15) - (highIssues * 5)
  ));
  const indexability = Math.max(0, Math.min(100,
    Math.round((indexed / total) * 100) - (criticalIssues * 10) - (highIssues * 3)
  ));
  const technical_health = Math.round((crawlability + indexability) / 2);

  return { crawlability, indexability, technical_health };
}

// ─── Site tech detection ──────────────────────────────────────────────────────
export function detectSiteTech(html: string, headers: Record<string, string>): SiteTech {
  for (const [tech, cfg] of Object.entries(TECH_SIGNALS)) {
    if (tech === 'unknown' || tech === 'custom') continue;
    const haystack = html + JSON.stringify(headers);
    if (cfg.patterns.some(p => p.test(haystack))) {
      return tech as SiteTech;
    }
  }
  return 'unknown';
}

// ─── AI-Enhanced Analysis ─────────────────────────────────────────────────────
async function enhanceWithAI(params: {
  start_url: string;
  site_tech: SiteTech;
  crawl_summary: string;
  deterministic_issues: TechnicalIssue[];
  is_new_website?: boolean;
}): Promise<TechnicalIssue[]> {
  try {
    const { object } = await LLMProvider.generateObject({
      agent: 'TechnicalSEOAgent',
      
      
      schema: z.object({
        additional_issues: z.array(z.object({
          category: z.enum([
            'crawlability', 'indexability', 'redirects', 'broken_links',
            'canonicals', 'sitemap', 'robots', 'performance', 'structured_data',
            'duplicates', 'orphan_pages', 'javascript', 'hreflang',
            'security', 'mobile', 'pagination', 'internal_links', 'other',
          ]),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          issue_type: z.string(),
          title: z.string(),
          description: z.string(),
          evidence: z.string().optional(),
          seo_impact: z.string(),
          business_impact: z.string(),
          recommended_fix: z.string(),
          estimated_effort: z.enum(['minutes', 'hours', 'days', 'weeks']),
          risk_level: z.enum(['low', 'medium', 'high']),
          automation_level: z.enum(['auto', 'semi_auto', 'manual', 'requires_approval']),
        })),
        tech_specific_notes: z.string(),
      }),
      system: `You are an expert Technical SEO specialist. You diagnose technical SEO issues that have real, meaningful impact on crawlability, indexability, and search visibility.

CRITICAL PRINCIPLES:
- Only flag issues that have meaningful SEO impact
- Never create busywork recommendations
- A technically imperfect site is not automatically broken
- HIGH-RISK changes (robots, canonicals, redirects, URL restructuring) always require_approval
- Be specific to the site technology: ${params.site_tech}
- For new websites, focus on foundations: crawlability, indexability, HTTPS, sitemap, robots, canonicals, URL structure
- Consider the ${params.is_new_website ? 'NEW WEBSITE' : 'ESTABLISHED WEBSITE'} context`,
      prompt: `Analyze this technical SEO crawl and provide additional insights.

URL: ${params.start_url}
Technology: ${params.site_tech}
New Website: ${params.is_new_website ? 'Yes' : 'No'}

Crawl Summary:
${params.crawl_summary}

Deterministic issues already found (${params.deterministic_issues.length}):
${params.deterministic_issues.map(i => `- ${i.severity.toUpperCase()}: ${i.title}`).join('\n')}

Identify any additional technical issues not already covered. Focus on issues specific to ${params.site_tech} architecture. Be selective — only flag issues with meaningful SEO impact.`,
    });

    return object.additional_issues.map((issue: any, i: any) => ({
      ...issue,
      id: `ai-issue-${i + 1}`,
      affected_urls: [],
      affected_url_count: 0,
      status: 'open' as const,
    }));
  } catch {
    return [];
  }
}

// ─── Main Agent Class ─────────────────────────────────────────────────────────

export class TechnicalSEOAgent {

  // Simulate crawl (in production: real HTTP crawler)
  private simulateCrawl(input: CrawlInput): CrawledUrl[] {
    const base = input.start_url.replace(/\/$/, '');
    const pages: Array<Partial<CrawledUrl> & { url: string }> = [
      { url: base + '/',                  status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 15, internal_links_out: 8,  word_count: 850,  has_schema: true,  is_orphan: false, canonical_url: base + '/' },
      { url: base + '/blog',              status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 6,  internal_links_out: 12, word_count: 420,  has_schema: false, is_orphan: false },
      { url: base + '/blog/ai-seo-agent', status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 3,  internal_links_out: 4,  word_count: 2400, has_schema: false, is_orphan: false, meta_description: 'Learn about AI SEO agents.', h1: 'AI SEO Agent Guide' },
      { url: base + '/blog/old-post',     status_code: 200, is_indexable: true,  in_sitemap: false, internal_links_in: 0,  internal_links_out: 0,  word_count: 180,  has_schema: false, is_orphan: true,  has_thin_content: true },
      { url: base + '/pricing',           status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 8,  internal_links_out: 3,  word_count: 600,  has_schema: true,  is_orphan: false, canonical_url: base + '/pricing' },
      { url: base + '/features',          status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 5,  internal_links_out: 6,  word_count: 950,  has_schema: false, is_orphan: false },
      { url: base + '/about',             status_code: 200, is_indexable: true,  in_sitemap: false, internal_links_in: 2,  internal_links_out: 2,  word_count: 350,  has_schema: false, is_orphan: false },
      { url: base + '/old-page',          status_code: 301, is_indexable: false, in_sitemap: true,  internal_links_in: 1,  internal_links_out: 0,  is_orphan: false, redirect_target: base + '/features' },
      { url: base + '/api/legacy',        status_code: 404, is_indexable: false, in_sitemap: false, internal_links_in: 3,  internal_links_out: 0,  is_orphan: false },
      { url: base + '/docs',              status_code: 200, is_indexable: false, in_sitemap: false, internal_links_in: 2,  internal_links_out: 0,  is_orphan: true,  robots_directive: 'noindex' },
      { url: base + '/login',             status_code: 200, is_indexable: false, in_sitemap: false, internal_links_in: 4,  internal_links_out: 1,  is_orphan: false, robots_directive: 'noindex' },
      { url: base + '/blog/post-2',       status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 1,  internal_links_out: 2,  word_count: 1800, has_schema: false, is_orphan: false, has_duplicate_title: true },
      { url: base + '/blog/post-3',       status_code: 200, is_indexable: true,  in_sitemap: true,  internal_links_in: 1,  internal_links_out: 2,  word_count: 1650, has_schema: false, is_orphan: false, has_duplicate_title: true },
    ];

    return pages.map(p => ({
      url: p.url,
      status_code: p.status_code ?? 200,
      redirect_target: p.redirect_target,
      canonical_url: p.canonical_url,
      canonical_is_self: p.canonical_url === p.url,
      robots_directive: p.robots_directive || 'index, follow',
      in_sitemap: p.in_sitemap ?? false,
      is_indexable: p.is_indexable ?? true,
      title: p.url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Home',
      meta_description: p.meta_description || undefined,
      h1: p.h1 || undefined,
      word_count: p.word_count || 0,
      internal_links_in: p.internal_links_in ?? 0,
      internal_links_out: p.internal_links_out ?? 0,
      external_links_out: 0,
      is_orphan: p.is_orphan ?? false,
      has_schema: p.has_schema ?? false,
      schema_types: p.has_schema ? ['Organization'] : [],
      has_duplicate_title: p.has_duplicate_title ?? false,
      has_duplicate_meta: false,
      has_thin_content: p.has_thin_content ?? ((p.word_count || 0) < 300 && (p.is_indexable ?? true)),
    }));
  }

  // Full analysis pipeline
  async analyze(input: CrawlInput): Promise<CrawlResult> {
    const urls = this.simulateCrawl(input);
    const siteTech: SiteTech = input.site_tech || 'unknown';

    // Run deterministic checks
    const deterministicIssues = detectIssuesFromCrawl(urls, siteTech);

    // Build crawl summary for AI
    const u200 = urls.filter(u => u.status_code === 200).length;
    const u404 = urls.filter(u => u.status_code === 404).length;
    const uNoindex = urls.filter(u => !u.is_indexable).length;
    const uOrphan = urls.filter(u => u.is_orphan).length;
    const crawlSummary = `URLs found: ${urls.length} | 200: ${u200} | 404: ${u404} | noindex: ${uNoindex} | orphans: ${uOrphan} | sitemapped: ${urls.filter(u => u.in_sitemap).length}`;

    // AI enhancement
    const aiIssues = await enhanceWithAI({
      start_url: input.start_url,
      site_tech: siteTech,
      crawl_summary: crawlSummary,
      deterministic_issues: deterministicIssues,
      is_new_website: input.is_new_website,
    });

    const allIssues = [...deterministicIssues, ...aiIssues];

    // Sort: critical → high → medium → low
    const severityOrder: Record<IssueSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const scores = computeScores(urls, allIssues);

    return {
      total_urls_found: urls.length,
      total_urls_crawled: urls.length,
      urls_200: u200,
      urls_301: urls.filter(u => u.status_code === 301).length,
      urls_302: urls.filter(u => u.status_code === 302).length,
      urls_404: u404,
      urls_5xx: urls.filter(u => u.status_code >= 500).length,
      urls_noindex: uNoindex,
      urls_indexed: urls.filter(u => u.is_indexable && u.status_code === 200).length,
      urls_orphaned: uOrphan,
      broken_internal_links: u404,
      crawlability_score: scores.crawlability,
      indexability_score: scores.indexability,
      technical_health_score: scores.technical_health,
      urls,
      issues: allIssues,
      site_tech: siteTech,
    };
  }
}
