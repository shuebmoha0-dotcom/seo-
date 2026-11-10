import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ArticleQualityAuditor } from '@/lib/services/articleQualityAuditor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const userClient = await createClient().catch(() => null);
    const body = await request.json().catch(() => ({}));
    const { website_id } = body;

    const result = await ArticleQualityAuditor.scanAndCleanAllArticles({
      websiteId: website_id,
      customClient: userClient || createAdminClient(),
    });

    return NextResponse.json({
      success: true,
      result,
      summary: `Scanned ${result.total_scanned} article(s). Identified and auto-healed ${result.total_cleaned} article(s), dispatching ${result.wordpress_updates_dispatched} clean update(s) to WordPress.`,
    });
  } catch (error: any) {
    console.error('[Article Audit & Clean] Error:', error);
    return NextResponse.json({ error: error.message || 'Audit scan failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id') || undefined;
    const userClient = await createClient().catch(() => null);

    const result = await ArticleQualityAuditor.scanAndCleanAllArticles({
      websiteId: website_id,
      customClient: userClient || createAdminClient(),
    });

    return NextResponse.json({
      success: true,
      result,
      summary: `Scanned ${result.total_scanned} article(s). Identified and auto-healed ${result.total_cleaned} article(s), dispatching ${result.wordpress_updates_dispatched} clean update(s) to WordPress.`,
    });
  } catch (error: any) {
    console.error('[Article Audit & Clean] Error:', error);
    return NextResponse.json({ error: error.message || 'Audit scan failed' }, { status: 500 });
  }
}
