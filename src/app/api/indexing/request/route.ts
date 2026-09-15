import { NextResponse } from 'next/server';
import { GoogleIndexingService } from '@/lib/connectors/googleIndexing';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, website_id, type = 'URL_UPDATED' } = body;

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const result = await GoogleIndexingService.requestIndexing({
      url,
      websiteId: website_id,
      type,
    });

    return NextResponse.json({
      success: result.success,
      url: result.url,
      google: result.google,
      indexNow: result.indexNow,
      summary: result.summary,
    });
  } catch (error: any) {
    console.error('[Indexing API Error]:', error);
    return NextResponse.json({ error: error.message || 'Indexing request failed' }, { status: 500 });
  }
}
