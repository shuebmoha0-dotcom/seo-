/**
 * Internal Crawl & Website Analysis Service
 * 
 * Provider-agnostic central service for all SEO agents (Technical, On-Page,
 * Internal Linking, Monitoring, and Orchestrator).
 * 
 * Manages crawl adapters, data normalization, Supabase storage,
 * and smart data reuse to prevent redundant API calls.
 */

import { DataForSEOAdapter } from './dataforseoAdapter';
import type { ICrawlProviderAdapter, CrawlRequestOptions, PostFixVerificationResult } from './types';
import { normalizeDataForSEOResponse, NormalizedCrawlResult } from '@/lib/connectors/crawlerNormalizer';
import { createClient } from '@/lib/supabase/server';
import { compareCrawls, CrawlComparisonResult } from './crawlComparator';

export class CrawlService {
  private adapter: ICrawlProviderAdapter;

  constructor(adapter?: ICrawlProviderAdapter) {
    // Default internal provider is DataForSEOAdapter
    this.adapter = adapter || new DataForSEOAdapter();
  }

  /**
   * 1. Smart Website Analysis with Data Reuse:
   * Reuses recent crawl data if available within maxAgeHours (default 24h) unless forceFresh is true.
   */
  async getOrAnalyzeWebsite(options: CrawlRequestOptions): Promise<{
    reused: boolean;
    crawl_id: string;
    task_id?: string;
    status: 'completed' | 'running';
    result?: NormalizedCrawlResult;
    message: string;
  }> {
    const maxAgeHours = options.maxAgeHours || 24;

    // Check for cached/stored recent crawl unless forceFresh requested
    if (!options.forceFresh && options.websiteId && options.websiteId !== 'default') {
      const recent = await this.getLatestAnalysis(options.websiteId);
      if (recent && recent.completed_at) {
        const completedTime = new Date(recent.completed_at).getTime();
        const ageHours = (Date.now() - completedTime) / (1000 * 60 * 60);

        if (ageHours < maxAgeHours) {
          console.log(`[CrawlService] Reusing existing crawl data for website=${options.websiteId} age=${ageHours.toFixed(1)}h`);
          return {
            reused: true,
            crawl_id: recent.id,
            status: 'completed',
            result: {
              summary: {
                total_urls_found: recent.total_urls_found || recent.urls?.length || 0,
                total_urls_crawled: recent.total_urls_crawled || recent.urls?.length || 0,
                urls_200: recent.urls_200 || 0,
                urls_301: recent.urls_301 || 0,
                urls_302: recent.urls_302 || 0,
                urls_404: recent.urls_404 || 0,
                urls_5xx: recent.urls_5xx || 0,
                urls_noindex: recent.urls_noindex || 0,
                urls_indexed: recent.urls_indexed || 0,
                urls_orphaned: recent.urls_orphaned || 0,
                broken_internal_links: recent.broken_internal_links || 0,
                duplicate_titles_count: 0,
                duplicate_meta_count: 0,
                missing_h1_count: 0,
                missing_meta_count: 0,
                crawlability_score: recent.crawlability_score || 80,
                indexability_score: recent.indexability_score || 80,
                technical_health_score: recent.technical_health_score || 80,
              },
              pages: recent.urls || [],
              deterministic_issues: recent.issues || [],
            },
            message: 'Reused existing analysis data from today.',
          };
        }
      }
    }

    // Start fresh analysis
    const startResult = await this.startWebsiteAnalysis(options);
    return {
      reused: false,
      crawl_id: startResult.crawl_id,
      task_id: startResult.task_id,
      status: 'running',
      message: 'Website analysis started.',
    };
  }

  /**
   * 2. Initiate fresh asynchronous website crawl
   */
  async startWebsiteAnalysis(options: CrawlRequestOptions): Promise<{
    crawl_id: string;
    task_id: string;
    status: string;
    target_url: string;
  }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // A. Submit to crawl adapter
    const task = await this.adapter.submitCrawl({
      target: options.targetUrl,
      max_crawl_pages: options.maxPages || 100,
      max_crawl_depth: options.maxDepth || 3,
    });

    // B. Save crawl run record
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

    // C. Record usage event for internal cost tracking
    if (user) {
      await supabase.from('usage_events').insert({
        user_id: user.id,
        project_id: options.projectId || null,
        provider: this.adapter.providerName,
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
   * 3. Poll analysis progress and process results upon completion
   */
  async getAnalysisStatus(crawlId: string, taskId: string): Promise<{
    status: 'running' | 'completed' | 'failed';
    progress?: number;
    result?: NormalizedCrawlResult;
    error_message?: string;
  }> {
    const supabase = await createClient();

    // Check adapter task state
    const summary = await this.adapter.getTaskStatus(taskId);

    if (summary.status === 'running') {
      return { status: 'running', progress: summary.pages_crawled };
    }

    if (summary.status === 'failed') {
      const sanitizedError = 'Website analysis could not be completed. Please ensure the website is online.';
      await supabase
        .from('technical_crawls')
        .update({
          status: 'failed',
          error_message: summary.error_message || sanitizedError,
        })
        .eq('id', crawlId);

      return {
        status: 'failed',
        error_message: sanitizedError,
      };
    }

    // Fetch and normalize raw page data
    const rawPages = await this.adapter.fetchCrawledPages(taskId, 100);
    const normalized = normalizeDataForSEOResponse(rawPages, summary.page_metrics);

    // Update database record
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

    // Save crawled URLs
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

    // Save issues
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
   * 4. Retrieve latest stored analysis for a website
   */
  async getLatestAnalysis(websiteId: string): Promise<any | null> {
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
   * 5. Post-Fix Verification:
   * Performs a targeted verification on a specific URL after an approved change.
   */
  async verifyIssue(params: {
    websiteId: string;
    url: string;
    checkType: string;
  }): Promise<PostFixVerificationResult> {
    try {
      const res = await fetch(params.url, {
        headers: { 'User-Agent': 'SEO-Autopilot-Verifier/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      const isLive = res.ok;
      return {
        verified: isLive,
        url: params.url,
        check_type: params.checkType,
        status_code: res.status,
        message: isLive ? 'Verification complete: URL is live and responsive.' : `Verification alert: HTTP ${res.status}`,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        verified: false,
        url: params.url,
        check_type: params.checkType,
        message: 'Verification incomplete: Could not reach the target URL.',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 6. Retrieve analysis history and comparison
   */
  async getAnalysisHistory(websiteId: string, limit = 5): Promise<{
    history: any[];
    comparison?: CrawlComparisonResult | null;
  }> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('technical_crawls')
      .select('id, website_id, start_url, status, total_urls_crawled, urls_200, urls_404, broken_internal_links, technical_health_score, crawlability_score, indexability_score, started_at, completed_at, created_at')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(limit);

    const history = data || [];
    let comparison = null;

    if (history.length >= 2) {
      comparison = compareCrawls(history[0], history[1]);
    }

    return { history, comparison };
  }
}
