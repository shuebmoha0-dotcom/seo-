import { NextResponse } from 'next/server';
import { SerpReverseEngineer } from '@/lib/agent/serpReverseEngineer';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const query = (body.query || '').trim();
    const article_text = typeof body.article_text === 'string' ? body.article_text : undefined;

    if (!query) {
      return NextResponse.json({ error: 'Query is required for SERP reverse-engineering' }, { status: 400 });
    }

    const benchmark = await SerpReverseEngineer.reverseEngineerQuery(query, {
      maxCompetitors: body.max_competitors ? Number(body.max_competitors) : 5,
    });

    let score = null;
    if (article_text) {
      score = SerpReverseEngineer.scoreArticleAgainstSerp(article_text, benchmark);
    }

    return NextResponse.json({
      success: true,
      query,
      benchmark,
      score,
    });
  } catch (error: any) {
    console.error('[SERP Reverse-Engineer API Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reverse-engineer Page 1 SERP' },
      { status: 500 }
    );
  }
}
