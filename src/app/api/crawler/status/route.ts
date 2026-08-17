import { NextResponse } from 'next/server';
import { CrawlService } from '@/lib/crawler/crawlService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const crawl_id = searchParams.get('crawl_id');
    const task_id = searchParams.get('task_id');

    if (!crawl_id || !task_id) {
      return NextResponse.json({ error: 'crawl_id and task_id parameters are required.' }, { status: 400 });
    }

    const crawlService = new CrawlService();
    const result = await crawlService.getAnalysisStatus(crawl_id, task_id);

    return NextResponse.json({
      success: true,
      status: result.status,
      progress: result.progress,
      result: result.result,
      error_message: result.error_message,
    });
  } catch (error: any) {
    console.error('[CrawlService Status] Error:', error);
    return NextResponse.json({ error: 'Unable to check website analysis status.' }, { status: 500 });
  }
}
