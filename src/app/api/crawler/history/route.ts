import { NextResponse } from 'next/server';
import { CrawlService } from '@/lib/crawler/crawlService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || 'default';

    const crawlService = new CrawlService();
    const { history, comparison } = await crawlService.getAnalysisHistory(website_id, 10);

    return NextResponse.json({
      success: true,
      history,
      comparison,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch analysis history.' }, { status: 500 });
  }
}
