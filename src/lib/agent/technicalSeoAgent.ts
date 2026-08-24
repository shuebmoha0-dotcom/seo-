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
            'security', 'mobile', 'pagination', 'internal_links', 'other',
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
      system: `You are an expert Technical SEO Specialist and Search Architect.
You analyze pre-collected website crawl data provided by DataForSEO.
Do NOT pretend to crawl the site yourself — analyze the supplied evidence.

CRITICAL PRINCIPLES:
- Only flag issues with genuine, measurable search indexability or crawlability impact.
- High-risk changes (robots.txt, canonical loops, 301 redirect chains) must ALWAYS require human approval.
- Explain clearly WHY an issue matters for search engines and user conversion.
- Tailor recommended fixes specifically to the site technology: ${params.site_tech}.`,
      prompt: `Analyze the following DataForSEO crawl summary and deterministic findings:

Website: ${params.start_url}
Technology: ${params.site_tech}
New Website: ${params.is_new_website ? 'Yes' : 'No'}

CRAWL EVIDENCE:
${params.crawl_summary}

DETERMINISTIC FINDINGS (${params.deterministic_issues.length}):
${params.deterministic_issues.map(i => `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`).join('\n')}

Identify high-impact technical root-cause recommendations that can be routed to WordPress, GitHub PR, or Custom API fixes.`,
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
