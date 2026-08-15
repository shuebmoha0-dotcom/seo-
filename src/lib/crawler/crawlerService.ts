/**
 * Shared Technical SEO Crawler Service
 * 
 * Orchestrates DataForSEO crawl tasks, polls for completion,
 * normalizes crawl data, records usage events, and persists findings to Supabase.
 * 
 * Reusable by: Technical SEO Agent, On-Page SEO Agent, Internal Linking Agent, Monitoring Agent.
 */

import { DataForSEOCrawler } from '@/lib/connectors/dataforseoCrawler';
import { normalizeDataForSEOResponse, NormalizedCrawlResult } from '@/lib/connectors/crawlerNormalizer';
import { createClient } from '@/lib/supabase/server';
import type { SiteTech } from '@/lib/agent/technicalSeoAgent';

export interface StartCrawlOptions {
  websiteId: string;
  projectId?: string;
  targetUrl: string;
  siteTech?: SiteTech;
  maxPages?: number;
  maxDepth?: number;
}

export class CrawlerService {
  private dfsCrawler: DataForSEOCrawler;

  constructor() {
    this.dfsCrawler = new DataForSEOCrawler();
  }

  /**
   * 1. Start a new asynchronous Technical SEO crawl
   */
  async startCrawl(options: StartCrawlOptions): Promise<{
    crawl_id: string;
    task_id: string;
    status: string;
    target_url: string;
  }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // A. Submit task to DataForSEO
    const task = await this.dfsCrawler.submitCrawlTask({
      target: options.targetUrl,
      max_crawl_pages: options.maxPages || 100,
      max_crawl_depth: options.maxDepth || 3,
      load_resources: true,
      respect_robots_txt: true,
      check_canonical: true,
    });

    // B. Create row in technical_crawls table
    const { data: crawlRow, error: insertError } = await supabase
      .from('technical_crawls')
      .insert({
        website_id: options.websiteId,
        start_url: options.targetUrl,
        site_tech: options.siteTech || 'unknown',
        crawl_depth: options.maxDepth || 3,
        max_urls: options.maxPages || 100,
        crawl_mode: 'full',
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // C. Record DataForSEO API Usage event
    if (user) {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        project_id: options.projectId || null,
        provider: 'dataforseo',
        model: 'on_page_crawl',
        api_type: 'crawl',
        agent_type: 'TechnicalSEOAgent',
        api_calls: 1,
        estimated_cost: task.cost || 0.05,
        currency: 'USD',
      });
    }

    return {
      crawl_id: crawlRow.id,
      task_id: task.task_id,
      status: 'running',
      target_url: options.targetUrl,
    };
  }

  /**
   * 2. Poll & Process crawl results once completed
   */
  async pollAndProcess(crawlId: string, taskId: string): Promise<{
    status: 'running' | 'completed' | 'failed';
    progress?: number;
    result?: NormalizedCrawlResult;
  }> {
    const supabase = await createClient();

    // Check DataForSEO task state
    const summary = await this.dfsCrawler.getTaskSummary(taskId);

    if (summary.status === 'running') {
      return { status: 'running', progress: summary.pages_crawled };
    }

    if (summary.status === 'failed') {
      await supabase
        .from('technical_crawls')
        .update({ status: 'failed', error_message: 'DataForSEO crawl task failed' })
        .eq('id', crawlId);
      return { status: 'failed' };
    }

    // Fetch raw pages
    const rawPages = await this.dfsCrawler.getPages(taskId, 100);

    // Normalize data
    const normalized = normalizeDataForSEOResponse(rawPages, summary.page_metrics);

    // Update technical_crawls table
    await supabase
      .from('technical_crawls')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        total_urls_found: normalized.summary.total_urls_found,
        total_urls_crawled: normalized.summary.total_urls_crawled,
        urls_200: normalized.summary.urls_200,
        urls_301: normalized.summary.urls_301,
        urls_302: normalized.summary.urls_302,
        urls_404: normalized.summary.urls_404,
        urls_5xx: normalized.summary.urls_5xx,
        urls_noindex: normalized.summary.urls_noindex,
        urls_indexed: normalized.summary.urls_indexed,
        urls_orphaned: normalized.summary.urls_orphaned,
        broken_internal_links: normalized.summary.broken_internal_links,
        crawlability_score: normalized.summary.crawlability_score,
        indexability_score: normalized.summary.indexability_score,
        technical_health_score: normalized.summary.technical_health_score,
      })
      .eq('id', crawlId);

    // Insert crawled URLs (batch upsert)
    if (normalized.pages.length > 0) {
      const pageRows = normalized.pages.map(p => ({
        crawl_id: crawlId,
        url: p.url,
        status_code: p.status_code,
        redirect_target: p.redirect_target,
        canonical_url: p.canonical_url,
        canonical_is_self: p.canonical_is_self,
        robots_directive: p.robots_directive,
        in_sitemap: p.in_sitemap,
        is_indexable: p.is_indexable,
        title: p.title,
        meta_description: p.meta_description,
        h1: p.h1,
        word_count: p.word_count,
        internal_links_in: p.internal_links_in,
        internal_links_out: p.internal_links_out,
        is_orphan: p.is_orphan,
        has_schema: p.has_schema,
        schema_types: p.schema_types,
        has_duplicate_title: p.has_duplicate_title,
        has_duplicate_meta: p.has_duplicate_meta,
        has_thin_content: p.has_thin_content,
      }));

      await supabase.from('crawled_urls').insert(pageRows);
    }

    // Insert detected technical issues
    if (normalized.deterministic_issues.length > 0) {
      const issueRows = normalized.deterministic_issues.map(issue => ({
        crawl_id: crawlId,
        category: issue.category,
        severity: issue.severity,
        issue_type: issue.issue_type,
        title: issue.title,
        description: issue.description,
        evidence: issue.evidence,
        affected_urls: issue.affected_urls,
        affected_url_count: issue.affected_url_count,
        sample_url: issue.sample_url,
        seo_impact: issue.seo_impact,
        business_impact: issue.business_impact,
        recommended_fix: issue.recommended_fix,
        estimated_effort: issue.estimated_effort,
        risk_level: issue.risk_level,
        automation_level: issue.automation_level,
        status: 'open',
      }));

      await supabase.from('technical_issues').insert(issueRows);
    }

    return {
      status: 'completed',
      result: normalized,
    };
  }

  /**
   * 3. Fetch latest crawl results for a website
   */
  async getLatestCrawl(websiteId: string): Promise<any | null> {
    const supabase = await createClient();

    const { data: crawl } = await supabase
      .from('technical_crawls')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!crawl) return null;

    const [urlsRes, issuesRes] = await Promise.all([
      supabase.from('crawled_urls').select('*').eq('crawl_id', crawl.id),
      supabase.from('technical_issues').select('*').eq('crawl_id', crawl.id),
    ]);

    return {
      ...crawl,
      urls: urlsRes.data || [],
      issues: issuesRes.data || [],
    };
  }

  /**
   * 4. Retrieve historical crawl runs for monitoring comparison
   */
  async getCrawlHistory(websiteId: string, limit = 5): Promise<any[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('technical_crawls')
      .select('id, website_id, start_url, status, total_urls_crawled, urls_200, urls_404, broken_internal_links, technical_health_score, crawlability_score, indexability_score, started_at, completed_at, created_at')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }
}
