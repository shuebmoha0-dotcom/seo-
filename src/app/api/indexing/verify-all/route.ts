import { NextResponse } from 'next/server';
import { PostIndexVerificationService } from '@/lib/services/postIndexVerificationService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, limit = 50, force_resubmit = false } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const report = await PostIndexVerificationService.verifyAndIndexAllPosts({
      websiteId: website_id,
      limit,
      forceResubmitAll: force_resubmit,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('[Verify All Indexing API Error]:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
