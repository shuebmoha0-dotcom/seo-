import { NextResponse } from 'next/server';
import { CrawlService } from '@/lib/crawler/crawlService';
import { validateAndNormalizeWordPressUrl } from '@/lib/utils/urlValidator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, project_id, target_url, max_pages, max_depth, site_tech, force_fresh } = body;

    if (!target_url) {
      return NextResponse.json({ error: 'Website URL is required.' }, { status: 400 });
    }

    const validation = validateAndNormalizeWordPressUrl(target_url);
    if (!validation.isValid || !validation.normalizedUrl) {
      return NextResponse.json({ error: validation.error || 'Invalid website URL.' }, { status: 400 });
    }

    const crawlService = new CrawlService();
    const result = await crawlService.getOrAnalyzeWebsite({
      websiteId: website_id || 'default',
      projectId: project_id,
      targetUrl: validation.normalizedUrl,
      siteTech: site_tech,
      maxPages: max_pages ? parseInt(max_pages, 10) : 100,
      maxDepth: max_depth ? parseInt(max_depth, 10) : 3,
      forceFresh: !!force_fresh,
    });

    return NextResponse.json({
      success: true,
      crawl_id: result.crawl_id,
      task_id: result.task_id,
      status: result.status,
      reused: result.reused,
      result: result.result,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[CrawlService Start] Error:', error);
    return NextResponse.json({ error: 'Website analysis could not be started. Please verify the URL and try again.' }, { status: 500 });
  }
}
