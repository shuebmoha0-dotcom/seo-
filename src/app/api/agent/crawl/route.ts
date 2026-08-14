import { NextResponse } from 'next/server';
import { WebsiteCrawler } from '@/lib/agent/crawler';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    const domain = new URL(url).hostname;
    const crawler = new WebsiteCrawler();
    const pageData = await crawler.crawlPage(url, domain);

    const supabase = await createClient();

    // Find target website
    const { data: website } = await supabase
      .from('websites')
      .select('id')
      .eq('domain', domain)
      .single();

    if (website) {
      // Upsert page into pages table
      await supabase.from('pages').upsert({
        website_id: website.id,
        path: new URL(url).pathname || '/',
        title: pageData.title,
        meta_description: pageData.meta_description,
        h1: pageData.h1[0] || null,
        canonical_url: pageData.canonical,
        status_code: pageData.http_status,
        indexability_signals: { is_indexable: pageData.is_indexable, directives: pageData.robots_directives },
        last_crawled_at: new Date().toISOString()
      }, { onConflict: 'website_id,path' });
    }

    return NextResponse.json({ success: true, page: pageData });
  } catch (error: any) {
    console.error('Error crawling website:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
