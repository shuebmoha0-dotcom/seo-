import { NextResponse } from 'next/server';
import { CrawlerService } from '@/lib/crawler/crawlerService';
import { validateAndNormalizeWordPressUrl } from '@/lib/utils/urlValidator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, project_id, target_url, max_pages, max_depth, site_tech } = body;

    if (!target_url) {
      return NextResponse.json({ error: 'Target URL is required.' }, { status: 400 });
    }

    const validation = validateAndNormalizeWordPressUrl(target_url);
    if (!validation.isValid || !validation.normalizedUrl) {
      return NextResponse.json({ error: validation.error || 'Invalid target URL.' }, { status: 400 });
    }

    const crawlerService = new CrawlerService();
    const result = await crawlerService.startCrawl({
      websiteId: website_id || 'default',
      projectId: project_id,
      targetUrl: validation.normalizedUrl,
      siteTech: site_tech,
      maxPages: max_pages ? parseInt(max_pages, 10) : 100,
      maxDepth: max_depth ? parseInt(max_depth, 10) : 3,
    });

    return NextResponse.json({
      success: true,
      crawl_id: result.crawl_id,
      task_id: result.task_id,
      status: result.status,
      target_url: result.target_url,
    });
  } catch (error: any) {
    console.error('[Crawler Start] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start crawl task.' }, { status: 500 });
  }
}
