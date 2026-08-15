import { NextResponse } from 'next/server';
import { TechnicalSEOAgent } from '@/lib/agent/technicalSeoAgent';
import { CrawlerService } from '@/lib/crawler/crawlerService';
import { DataForSEOCrawler } from '@/lib/connectors/dataforseoCrawler';
import { normalizeDataForSEOResponse } from '@/lib/connectors/crawlerNormalizer';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, project_id, start_url, site_tech, max_urls, crawl_depth, project_instructions, is_new_website } = body;

    if (!start_url) return NextResponse.json({ error: 'start_url is required' }, { status: 400 });

    const dfs = new DataForSEOCrawler();
    const task = await dfs.submitCrawlTask({
      target: start_url,
      max_crawl_pages: max_urls || 100,
      max_crawl_depth: crawl_depth || 3,
    });

    const summary = await dfs.getTaskSummary(task.task_id);
    const rawPages = await dfs.getPages(task.task_id, max_urls || 100);
    const normalized = normalizeDataForSEOResponse(rawPages, summary.page_metrics, site_tech);

    // LLM Reasoning Analysis over the collected DataForSEO crawl data
    const agent = new TechnicalSEOAgent();
    const result = await agent.analyze({
      start_url,
      crawl_data: normalized,
      site_tech: site_tech || 'unknown',
      project_instructions,
      is_new_website: is_new_website || false,
    });

    // Persist to Supabase
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Record crawl session
    const { data: crawl } = await supabase
      .from('technical_crawls')
      .insert({
        website_id: website_id || null,
        start_url,
        site_tech: result.site_tech,
        max_urls: max_urls || 100,
        crawl_depth: crawl_depth || 3,
        total_urls_found: result.total_urls_found,
        total_urls_crawled: result.total_urls_crawled,
        urls_200: result.urls_200,
        urls_301: result.urls_301,
        urls_302: result.urls_302,
        urls_404: result.urls_404,
        urls_5xx: result.urls_5xx,
        urls_noindex: result.urls_noindex,
        urls_indexed: result.urls_indexed,
        urls_orphaned: result.urls_orphaned,
        broken_internal_links: result.broken_internal_links,
        crawlability_score: result.crawlability_score,
        indexability_score: result.indexability_score,
        technical_health_score: result.technical_health_score,
        status: 'completed',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (crawl) {
      // 2. Persist crawled URLs
      if (result.urls.length > 0) {
        const urlRows = result.urls.map(u => ({
          crawl_id: crawl.id,
          url: u.url,
          status_code: u.status_code,
          redirect_target: u.redirect_target,
          canonical_url: u.canonical_url,
          canonical_is_self: u.canonical_is_self,
          robots_directive: u.robots_directive,
          in_sitemap: u.in_sitemap,
          is_indexable: u.is_indexable,
          title: u.title,
          meta_description: u.meta_description,
          h1: u.h1,
          word_count: u.word_count,
          internal_links_in: u.internal_links_in,
          internal_links_out: u.internal_links_out,
          is_orphan: u.is_orphan,
          has_schema: u.has_schema,
          schema_types: u.schema_types,
          has_duplicate_title: u.has_duplicate_title,
          has_duplicate_meta: u.has_duplicate_meta,
          has_thin_content: u.has_thin_content,
        }));
        await supabase.from('crawled_urls').insert(urlRows);
      }

      // 3. Persist technical issues
      if (result.issues.length > 0) {
        const issueRows = result.issues.map(issue => ({
          crawl_id: crawl.id,
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

      // 4. Record Usage Event
      if (user) {
        await supabase.from('usage_events').insert({
          user_id: user.id,
          project_id: project_id || null,
          provider: 'dataforseo',
          model: 'on_page_crawl',
          api_type: 'crawl',
          agent_type: 'TechnicalSEOAgent',
          api_calls: 1,
          estimated_cost: task.cost || 0.05,
          currency: 'USD',
        });
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Technical SEO crawl error:', error);
    return NextResponse.json({ error: error.message || 'Crawl failed.' }, { status: 500 });
  }
}
