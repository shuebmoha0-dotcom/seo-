import { NextResponse } from 'next/server';
import { TechnicalSEOAgent } from '@/lib/agent/technicalSeoAgent';
import { CrawlService } from '@/lib/crawler/crawlService';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ result: null });
    }

    const supabase = await createClient();

    // 1. Fetch latest crawl
    const { data: latestCrawl, error: crawlErr } = await supabase
      .from('technical_crawls')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (crawlErr || !latestCrawl) {
      return NextResponse.json({ result: null });
    }

    // 2. Fetch issues
    const { data: issues } = await supabase
      .from('technical_issues')
      .select('*')
      .eq('crawl_id', latestCrawl.id);

    // 3. Fetch crawled urls
    const { data: urls } = await supabase
      .from('crawled_urls')
      .select('*')
      .eq('crawl_id', latestCrawl.id)
      .limit(100);

    const result = {
      total_urls_found: latestCrawl.total_urls_found || 0,
      total_urls_crawled: latestCrawl.total_urls_crawled || 0,
      urls_200: latestCrawl.urls_200 || 0,
      urls_301: latestCrawl.urls_301 || 0,
      urls_302: latestCrawl.urls_302 || 0,
      urls_404: latestCrawl.urls_404 || 0,
      urls_5xx: latestCrawl.urls_5xx || 0,
      urls_noindex: latestCrawl.urls_noindex || 0,
      urls_indexed: latestCrawl.urls_indexed || 0,
      urls_orphaned: latestCrawl.urls_orphaned || 0,
      broken_internal_links: latestCrawl.broken_internal_links || 0,
      crawlability_score: latestCrawl.crawlability_score || 80,
      indexability_score: latestCrawl.indexability_score || 80,
      technical_health_score: latestCrawl.technical_health_score || 80,
      site_tech: latestCrawl.site_tech || 'unknown',
      urls: (urls || []).map((u: any) => ({
        url: u.url,
        status_code: u.status_code || 200,
        is_indexable: u.is_indexable ?? true,
        in_sitemap: u.in_sitemap ?? false,
        internal_links_in: u.internal_links_in || 0,
        is_orphan: u.is_orphan ?? false,
        has_schema: u.has_schema ?? false,
        word_count: u.word_count,
        h1: u.h1,
        title: u.title,
        robots_directive: u.robots_directive,
        canonical_url: u.canonical_url,
      })),
      issues: (issues || []).map((i: any) => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        issue_type: i.issue_type,
        title: i.title,
        description: i.description,
        evidence: i.evidence,
        affected_urls: i.affected_urls || [],
        affected_url_count: i.affected_url_count || 1,
        sample_url: i.sample_url,
        seo_impact: i.seo_impact,
        business_impact: i.business_impact,
        recommended_fix: i.recommended_fix,
        estimated_effort: i.estimated_effort,
        risk_level: i.risk_level,
        automation_level: i.automation_level,
        status: i.status || 'open',
      })),
    };

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('[Technical SEO GET] Error:', error);
    return NextResponse.json({ result: null });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, project_id, start_url, site_tech, max_urls, crawl_depth, project_instructions, is_new_website, force_fresh } = body;

    if (!start_url) return NextResponse.json({ error: 'start_url is required' }, { status: 400 });

    const crawlService = new CrawlService();
    const analysis = await crawlService.getOrAnalyzeWebsite({
      websiteId: website_id || 'default',
      projectId: project_id,
      targetUrl: start_url,
      siteTech: site_tech || 'unknown',
      maxPages: max_urls || 100,
      maxDepth: crawl_depth || 3,
      forceFresh: !!force_fresh,
    });

    let normalizedData = analysis.result;

    // If analysis had to be freshly polled
    if (!normalizedData && analysis.task_id) {
      const poll = await crawlService.getAnalysisStatus(analysis.crawl_id, analysis.task_id);
      normalizedData = poll.result;
    }

    if (!normalizedData) {
      return NextResponse.json({ error: 'Website analysis is in progress. Please check status shortly.' }, { status: 202 });
    }

    // LLM Reasoning Analysis over the collected normalized crawl data
    const agent = new TechnicalSEOAgent();
    const result = await agent.analyze({
      start_url,
      crawl_data: normalizedData,
      site_tech: site_tech || 'unknown',
      project_instructions,
      is_new_website: is_new_website || false,
    });

    return NextResponse.json({ success: true, result, reused: analysis.reused });
  } catch (error: any) {
    console.error('[TechnicalSEOAgent Route] Error:', error);
    return NextResponse.json({ error: 'Website analysis failed. Please check if the site is reachable.' }, { status: 500 });
  }
}
