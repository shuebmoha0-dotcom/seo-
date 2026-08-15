import { NextResponse } from 'next/server';
import { CrawlerService } from '@/lib/crawler/crawlerService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const crawl_id = searchParams.get('crawl_id');
    const task_id = searchParams.get('task_id');

    if (!crawl_id || !task_id) {
      return NextResponse.json({ error: 'crawl_id and task_id parameters are required.' }, { status: 400 });
    }

    const crawlerService = new CrawlerService();
    const result = await crawlerService.pollAndProcess(crawl_id, task_id);

    return NextResponse.json({
      success: true,
      status: result.status,
      progress: result.progress,
      result: result.result,
    });
  } catch (error: any) {
    console.error('[Crawler Status] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to poll crawl status.' }, { status: 500 });
  }
}
