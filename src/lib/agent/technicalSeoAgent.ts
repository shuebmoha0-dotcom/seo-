import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import type { NormalizedCrawlResult } from '@/lib/connectors/crawlerNormalizer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteTech =
  | 'nextjs' | 'react' | 'astro' | 'nuxt' | 'static_html'
  | 'webflow' | 'wordpress' | 'shopify' | 'headless_cms' | 'custom' | 'unknown';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type IssueCategory =
  | 'crawlability' | 'indexability' | 'redirects' | 'broken_links'
  | 'canonicals' | 'sitemap' | 'robots' | 'performance' | 'structured_data'
  | 'duplicates' | 'orphan_pages' | 'javascript' | 'hreflang'
  | 'security' | 'mobile' | 'pagination' | 'internal_links' | 'presentation' | 'other';

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
  has_multiple_h1?: boolean;
  has_wasted_h1?: boolean;
  has_presentation_issue?: boolean;
  missing_image_alt_count?: number;
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

export interface TechnicalAnalysisInput {
  start_url: string;
  crawl_data: NormalizedCrawlResult;
  site_tech?: SiteTech;
  project_instructions?: string;
  is_new_website?: boolean;
}

// ─── AI Analysis Layer (LLM reasoning over collected crawl data) ───────────────

async function analyzeWithAI(params: {
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
        additional_insights: z.array(z.object({
          category: z.enum([
            'crawlability', 'indexability', 'redirects', 'broken_links',
            'canonicals', 'sitemap', 'robots', 'performance', 'structured_data',
            'duplicates', 'orphan_pages', 'javascript', 'hreflang',
            'security', 'mobile', 'pagination', 'internal_links', 'presentation', 'other',
          ]),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          issue_type: z.string(),
          title: z.string(),
          description: z.string(),
          evidence: z.string().nullable(),
          seo_impact: z.string(),
          business_impact: z.string(),
          recommended_fix: z.string(),
          estimated_effort: z.enum(['minutes', 'hours', 'days', 'weeks']),
          risk_level: z.enum(['low', 'medium', 'high']),
          automation_level: z.enum(['auto', 'semi_auto', 'manual', 'requires_approval']),
        })),
        strategic_summary: z.string(),
      }),
      system: `You are an expert Technical SEO Specialist and Forensic Search Architect.
You analyze pre-collected website crawl data, DOM hierarchy, and on-page visual presentation signals.
Do NOT pretend to crawl the site yourself — analyze the supplied evidence.

MANDATORY HOLISTIC SCANNING DISCIPLINE:
You must proactively and autonomously evaluate ALL 8 ranking pillars across the site in every scan. Never wait for the user to request individual problem checks. Recognize every deficiency across:
1. FATAL CRAWL & INDEXING BLOCKERS (Severity: Critical): 5xx server errors, unintended noindex/nofollow directives on published content, broken canonical loops, or robots.txt barriers that block search engines.
2. HEADING HIERARCHY & TOPIC INTENT (Severity: High/Medium): Missing H1 tags, multiple stacked H1 headings, or wasted generic H1 tags (e.g. "Home", "Welcome", single-word generic text) that fail to establish primary topical relevance.
3. SERP CTR & METADATA READINESS (Severity: High/Medium): Missing meta descriptions, under-optimized meta (< 70 chars), truncated titles (> 65 chars), short titles (< 25 chars), or duplicate title/meta tags causing cannibalization.
4. CONTENT DEPTH & HELPFUL CONTENT RISKS (Severity: High): Thin content pages (< 350 words) vulnerable to Google Helpful Content demotion, superficial articles, or poor dwell-time signals.
5. PAGERANK DISTRIBUTION & LINK ARCHITECTURE (Severity: High/Medium): Orphan pages with 0 internal links, starved articles with fewer than 3 inbound links, or broken internal links (4xx errors).
6. STRUCTURED DATA & ENTITY GRAPH (Severity: Medium): Missing Schema.org JSON-LD structured data (Article, BlogPosting, FAQPage, BreadcrumbList, Organization) disqualifying pages from rich snippets and knowledge graph entity recognition.
7. IMAGE OPTIMIZATION & ACCESSIBILITY (Severity: Medium/Low): Images lacking descriptive ALT attributes preventing indexing in Google Image search and violating accessibility standards.
8. CANONICAL CONSISTENCY & URL CLEANLINESS (Severity: High/Medium): Missing canonical tags, non-self-referencing canonicals redirecting indexing authority elsewhere, or duplicate parameter URLs.
9. GUTENBERG BLOCK & PRESENTATION LAYOUT INTEGRITY (Severity: High): Corrupted list elements (<p><li>, <p><ul>), stray markdown markers (<li>>text), illegal <br> breaks inside lists, bloated Table of Contents, or outer div containers that crash WordPress Gutenberg block validation ("This block contains unexpected or invalid content - Attempt recovery").

REMEDIATION DISCIPLINE:
- Tailor recommended fixes specifically to the site technology: ${params.site_tech}.
- Mark issues as 'auto' for automation_level whenever they can be resolved autonomously via CMS metadata updates or HTML repair without structural code rewrites.`,
      prompt: `Analyze the following DataForSEO crawl summary and deterministic findings:

Website: ${params.start_url}
Technology: ${params.site_tech}
New Website: ${params.is_new_website ? 'Yes' : 'No'}

CRAWL EVIDENCE:
${params.crawl_summary}

DETERMINISTIC FINDINGS (${params.deterministic_issues.length}):
${params.deterministic_issues.map(i => `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

Perform a comprehensive, all-pillar technical review. Identify any latent or root-cause technical ranking hindrances across all 8 pillars and provide high-leverage recommendations ready for autonomous remediation via WordPress outbound queue or Git PR.`,
    });

    return object.additional_insights.map((insight: any, idx: number) => ({
      ...insight,
      id: `ai-insight-${idx + 1}`,
      affected_urls: [],
      affected_url_count: 0,
      status: 'open' as const,
    }));
  } catch (error) {
    console.warn('[TechnicalSEOAgent] AI enhancement skipped:', error);
    return [];
  }
}

// ─── Main Technical SEO Agent ──────────────────────────────────────────────────

export class TechnicalSEOAgent {
  /**
   * Analyzes normalized crawl data collected by DataForSEO.
   * Does NOT crawl the web directly with LLM tokens.
   */
  async analyze(input: TechnicalAnalysisInput): Promise<CrawlResult> {
    const { crawl_data, start_url } = input;
    const siteTech: SiteTech = input.site_tech || 'unknown';
    const { summary, pages, deterministic_issues } = crawl_data;

    // Format crawl summary for AI reasoning
    const crawlSummary = `
- Total URLs: ${summary.total_urls_crawled}
- 200 OK: ${summary.urls_200}
- 301/302 Redirects: ${summary.urls_301 + summary.urls_302}
- 404/4xx Errors: ${summary.urls_404}
- 5xx Server Errors: ${summary.urls_5xx}
- Noindex Pages: ${summary.urls_noindex}
- Indexed Pages: ${summary.urls_indexed}
- Orphan Pages: ${summary.urls_orphaned}
- Duplicate Titles: ${summary.duplicate_titles_count}
- Missing Meta Descriptions: ${summary.missing_meta_count}
- Missing H1s: ${summary.missing_h1_count}
- Crawlability Score: ${summary.crawlability_score}/100
- Indexability Score: ${summary.indexability_score}/100
- Technical Health Score: ${summary.technical_health_score}/100
`.trim();

    // LLM analysis over the collected evidence
    const aiInsights = await analyzeWithAI({
      start_url,
      site_tech: siteTech,
      crawl_summary: crawlSummary,
      deterministic_issues,
      is_new_website: input.is_new_website,
    });

    const allIssues = [...deterministic_issues, ...aiInsights];

    // Priority sorting: critical → high → medium → low → info
    const severityOrder: Record<IssueSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return {
      total_urls_found: summary.total_urls_found,
      total_urls_crawled: summary.total_urls_crawled,
      urls_200: summary.urls_200,
      urls_301: summary.urls_301,
      urls_302: summary.urls_302,
      urls_404: summary.urls_404,
      urls_5xx: summary.urls_5xx,
      urls_noindex: summary.urls_noindex,
      urls_indexed: summary.urls_indexed,
      urls_orphaned: summary.urls_orphaned,
      broken_internal_links: summary.broken_internal_links,
      crawlability_score: summary.crawlability_score,
      indexability_score: summary.indexability_score,
      technical_health_score: summary.technical_health_score,
      urls: pages,
      issues: allIssues,
      site_tech: siteTech,
    };
  }
}
