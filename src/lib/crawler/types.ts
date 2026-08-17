/**
 * Crawl & Website Analysis Architecture Types
 * 
 * Provider-agnostic interfaces for website analysis,
 * crawl adapters, normalization, and data reuse.
 */

import type { SiteTech, TechnicalIssue, CrawledUrl } from '@/lib/agent/technicalSeoAgent';
import type { NormalizedCrawlResult } from '@/lib/connectors/crawlerNormalizer';

export interface CrawlRequestOptions {
  websiteId: string;
  projectId?: string;
  targetUrl: string;
  siteTech?: SiteTech;
  maxPages?: number;
  maxDepth?: number;
  forceFresh?: boolean; // If false, reuses recent crawl data if available
  maxAgeHours?: number; // Cache TTL for data reuse (default 24h)
}

export interface CrawlTaskSummary {
  status: 'running' | 'completed' | 'failed';
  progress_percent?: number;
  pages_crawled?: number;
  pages_in_queue?: number;
  domain_info?: any;
  page_metrics?: any;
  error_message?: string;
  is_simulated?: boolean;
}

export interface ICrawlProviderAdapter {
  readonly providerName: string;
  submitCrawl(config: {
    target: string;
    max_crawl_pages?: number;
    max_crawl_depth?: number;
  }): Promise<{ task_id: string; cost: number; is_simulated: boolean }>;
  
  getTaskStatus(taskId: string): Promise<CrawlTaskSummary>;
  
  fetchCrawledPages(taskId: string, limit?: number, offset?: number): Promise<any[]>;
  
  fetchCrawledLinks?(taskId: string, limit?: number): Promise<any[]>;
  
  fetchCrawledResources?(taskId: string, limit?: number): Promise<any[]>;
}

export interface PostFixVerificationResult {
  verified: boolean;
  url: string;
  check_type: string;
  message: string;
  status_code?: number;
  timestamp: string;
}
