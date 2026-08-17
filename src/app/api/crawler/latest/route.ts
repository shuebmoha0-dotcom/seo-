import { NextResponse } from 'next/server';
import { CrawlService } from '@/lib/crawler/crawlService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';

    const crawlService = new CrawlService();
    const latest = await crawlService.getLatestAnalysis(website_id);

    return NextResponse.json({
      success: true,
      crawl: latest,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch latest website analysis.' }, { status: 500 });
  }
}
