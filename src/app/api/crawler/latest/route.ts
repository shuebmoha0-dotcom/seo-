import { NextResponse } from 'next/server';
import { CrawlerService } from '@/lib/crawler/crawlerService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';

    const crawlerService = new CrawlerService();
    const latest = await crawlerService.getLatestCrawl(website_id);

    return NextResponse.json({
      success: true,
      crawl: latest,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch latest crawl.' }, { status: 500 });
  }
}
