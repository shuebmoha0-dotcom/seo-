import { NextResponse } from 'next/server';
import { CrawlerService } from '@/lib/crawler/crawlerService';
import { compareCrawls } from '@/lib/crawler/crawlComparator';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';

    const crawlerService = new CrawlerService();
    const history = await crawlerService.getCrawlHistory(website_id, 10);

    let comparison = null;
    if (history.length >= 2) {
      comparison = compareCrawls(history[0], history[1]);
    }

    return NextResponse.json({
      success: true,
      history,
      comparison,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch crawl history.' }, { status: 500 });
  }
}
