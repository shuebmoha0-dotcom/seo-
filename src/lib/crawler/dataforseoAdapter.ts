/**
 * DataForSEO Internal Crawl Adapter
 * 
 * Communicates with DataForSEO On-Page APIs on behalf of CrawlService.
 * Never exposed directly to the frontend or customer UI.
 * Internal logging tags: crawl_provider=dataforseo
 */

import type { ICrawlProviderAdapter, CrawlTaskSummary } from './types';

export class DataForSEOAdapter implements ICrawlProviderAdapter {
  readonly providerName = 'dataforseo';
  private login?: string;
  private password?: string;
  private isConfigured: boolean;

  constructor() {
    this.login = process.env.DATAFORSEO_LOGIN;
    this.password = process.env.DATAFORSEO_PASSWORD;
    this.isConfigured = !!(this.login && this.password && !this.login.includes('your-'));
  }

  private get authHeader(): string {
    if (!this.login || !this.password) return '';
    return 'Basic ' + Buffer.from(`${this.login}:${this.password}`).toString('base64');
  }

  /**
   * Submit an On-Page crawl task to DataForSEO
   */
  async submitCrawl(config: {
    target: string;
    max_crawl_pages?: number;
    max_crawl_depth?: number;
  }): Promise<{ task_id: string; cost: number; is_simulated: boolean }> {
    if (!this.isConfigured) {
      console.log(`[CrawlService] crawl_provider=dataforseo mode=simulated target=${config.target}`);
      const simulatedTaskId = `dfs_task_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      return {
        task_id: simulatedTaskId,
        cost: 0.05,
        is_simulated: true,
      };
    }

    console.log(`[CrawlService] crawl_provider=dataforseo action=submit_task target=${config.target}`);
    const payload = [{
      target: config.target,
      max_crawl_pages: config.max_crawl_pages || 100,
      max_crawl_depth: config.max_crawl_depth || 3,
      load_resources: true,
      enable_javascript: false,
      respect_robots_txt: true,
      check_canonical: true,
      enable_content_parsing: true,
      calculate_keyword_density: true,
      pingback_url: null,
    }];

    const res = await fetch('https://api.dataforseo.com/v3/on_page/task_post', {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[CrawlService] crawl_provider=dataforseo error=task_post_failed status=${res.status} detail=${errorText}`);
      throw new Error(`Website analysis service error (${res.status})`);
    }

    const data = await res.json();
    const task = data.tasks?.[0];

    if (!task || task.status_code >= 40000) {
      console.error(`[CrawlService] crawl_provider=dataforseo error=${task?.status_message}`);
      throw new Error(task?.status_message || 'Failed to initialize website analysis.');
    }

    return {
      task_id: task.id,
      cost: task.cost || 0.05,
      is_simulated: false,
    };
  }

  /**
   * Check DataForSEO task state
   */
  async getTaskStatus(taskId: string): Promise<CrawlTaskSummary> {
    if (!this.isConfigured || taskId.startsWith('dfs_task_')) {
      return {
        status: 'completed',
        progress_percent: 100,
        pages_crawled: 15,
        pages_in_queue: 0,
        page_metrics: {
          links_internal: 84,
          links_external: 12,
          duplicate_title: 2,
          duplicate_description: 1,
          broken_links: 2,
          status_4xx: 1,
          status_5xx: 0,
          noindex: 2,
        },
        is_simulated: true,
      };
    }

    const res = await fetch(`https://api.dataforseo.com/v3/on_page/summary/${taskId}`, {
      headers: { 'Authorization': this.authHeader },
    });

    if (!res.ok) {
      console.error(`[CrawlService] crawl_provider=dataforseo error=summary_fetch_failed status=${res.status}`);
      throw new Error('Unable to retrieve analysis status');
    }

    const data = await res.json();
    const task = data.tasks?.[0];
    if (!task) throw new Error('Analysis task record not found');

    const result = task.result?.[0];
    const crawlProgress = result?.crawl_progress;

    if (crawlProgress === 'in_progress') {
      return {
        status: 'running',
        pages_crawled: result?.crawl_status?.pages_crawled || 0,
        pages_in_queue: result?.crawl_status?.pages_in_queue || 0,
        is_simulated: false,
      };
    }

    if (crawlProgress === 'finished') {
      return {
        status: 'completed',
        progress_percent: 100,
        pages_crawled: result?.crawl_status?.pages_crawled || 0,
        domain_info: result?.domain_info,
        page_metrics: result?.page_metrics,
        is_simulated: false,
      };
    }

    return {
      status: 'failed',
      error_message: task.status_message,
      is_simulated: false,
    };
  }

  /**
   * Fetch crawled pages from DataForSEO
   */
  async fetchCrawledPages(taskId: string, limit = 100, offset = 0): Promise<any[]> {
    if (!this.isConfigured || taskId.startsWith('dfs_task_')) {
      return this.generateSimulatedPages();
    }

    const payload = [{
      id: taskId,
      limit,
      offset,
      filters: ['resource_type', '=', 'html'],
    }];

    const res = await fetch('https://api.dataforseo.com/v3/on_page/pages', {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`[CrawlService] crawl_provider=dataforseo error=pages_fetch_failed status=${res.status}`);
      throw new Error('Unable to fetch website page data');
    }

    const data = await res.json();
    return data.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Fetch crawled links
   */
  async fetchCrawledLinks(taskId: string, limit = 100): Promise<any[]> {
    if (!this.isConfigured || taskId.startsWith('dfs_task_')) {
      return [];
    }

    const payload = [{ id: taskId, limit }];
    const res = await fetch('https://api.dataforseo.com/v3/on_page/links', {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Fetch media resources
   */
  async fetchCrawledResources(taskId: string, limit = 100): Promise<any[]> {
    if (!this.isConfigured || taskId.startsWith('dfs_task_')) {
      return [];
    }

    const payload = [{
      id: taskId,
      limit,
      filters: ['resource_type', '=', 'image'],
    }];

    const res = await fetch('https://api.dataforseo.com/v3/on_page/resources', {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.tasks?.[0]?.result?.[0]?.items || [];
  }

  /**
   * Internal simulation generator
   */
  private generateSimulatedPages(): any[] {
    return [
      {
        url: 'https://example.com/',
        status_code: 200,
        meta: {
          title: 'SEO Autopilot — Autonomous AI SEO SaaS',
          description: 'Autonomous AI agents that optimize, write, and monitor your website ranking 24/7.',
          canonical: 'https://example.com/',
          robots: { noindex: false, nofollow: false },
          htags: { h1: ['Autonomous SEO for Modern SaaS'], h2: ['How it works', 'Features', 'Pricing'] },
          content: { plain_text_word_count: 950 },
        },
        page_timing: { duration_time: 240 },
        size: 42000,
        checks: {
          is_broken: false,
          is_redirect: false,
          is_4xx: false,
          is_5xx: false,
          duplicate_title: false,
          duplicate_description: false,
          canonical: true,
          has_render_blocking_resources: true,
        },
      },
      {
        url: 'https://example.com/blog/ai-seo-agent',
        status_code: 200,
        meta: {
          title: 'Complete Guide to AI SEO Agents (2026)',
          description: 'Learn how AI SEO agents execute autonomous keyword research, content drafting, and internal linking.',
          canonical: 'https://example.com/blog/ai-seo-agent',
          robots: { noindex: false, nofollow: false },
          htags: { h1: ['Complete Guide to AI SEO Agents'], h2: ['What is an SEO Agent?', 'Key Capabilities'] },
          content: { plain_text_word_count: 2400 },
        },
        page_timing: { duration_time: 310 },
        size: 68000,
        checks: {
          is_broken: false,
          is_redirect: false,
          canonical: true,
          duplicate_title: false,
        },
      },
      {
        url: 'https://example.com/pricing',
        status_code: 200,
        meta: {
          title: 'Pricing — Plans for Startups & Scaleups',
          description: '',
          canonical: 'https://example.com/pricing',
          robots: { noindex: false, nofollow: false },
          htags: { h1: ['Simple, Transparent Pricing'], h2: ['Starter', 'Growth', 'Enterprise'] },
          content: { plain_text_word_count: 550 },
        },
        page_timing: { duration_time: 190 },
        size: 35000,
        checks: {
          is_broken: false,
          no_description: true,
          duplicate_title: false,
        },
      },
      {
        url: 'https://example.com/features',
        status_code: 200,
        meta: {
          title: 'SEO Autopilot — Features',
          description: 'Explore all AI SEO features.',
          canonical: '',
          robots: { noindex: false, nofollow: false },
          htags: { h1: [], h2: ['Keyword Clustering', 'On-Page Audits'] },
          content: { plain_text_word_count: 820 },
        },
        page_timing: { duration_time: 210 },
        size: 44000,
        checks: {
          is_broken: false,
          no_h1_tag: true,
          no_canonical: true,
        },
      },
      {
        url: 'https://example.com/legacy-api',
        status_code: 404,
        meta: {
          title: '404 Not Found',
          description: '',
          robots: { noindex: true, nofollow: true },
          htags: { h1: ['Page Not Found'] },
          content: { plain_text_word_count: 45 },
        },
        page_timing: { duration_time: 95 },
        size: 8000,
        checks: {
          is_broken: true,
          is_4xx: true,
        },
      },
      {
        url: 'https://example.com/admin',
        status_code: 200,
        meta: {
          title: 'Admin Portal',
          description: 'Internal admin portal.',
          robots: { noindex: true, nofollow: true },
          htags: { h1: ['Admin Login'] },
          content: { plain_text_word_count: 120 },
        },
        page_timing: { duration_time: 150 },
        size: 18000,
        checks: {
          is_broken: false,
          noindex: true,
        },
      },
      {
        url: 'https://example.com/blog/old-post',
        status_code: 200,
        meta: {
          title: 'Complete Guide to AI SEO Agents (2026)',
          description: 'Learn how AI SEO agents execute autonomous keyword research.',
          canonical: 'https://example.com/blog/old-post',
          robots: { noindex: false, nofollow: false },
          htags: { h1: ['Old AI SEO Post'] },
          content: { plain_text_word_count: 180 },
        },
        page_timing: { duration_time: 280 },
        size: 29000,
        checks: {
          is_broken: false,
          duplicate_title: true,
          low_content_rate: true,
        },
      },
    ];
  }
}
