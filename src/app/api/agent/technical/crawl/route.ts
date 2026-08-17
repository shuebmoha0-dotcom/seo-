import { NextResponse } from 'next/server';
import { TechnicalSEOAgent } from '@/lib/agent/technicalSeoAgent';
import { CrawlService } from '@/lib/crawler/crawlService';
import { createClient } from '@/lib/supabase/server';

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
