import { NextResponse } from 'next/server';
import { GoogleSuggestService } from '@/lib/services/googleSuggestService';
import { createClient } from '@/lib/supabase/server';
import { SiteNicheProfiler } from '@/lib/agent/siteNicheProfiler';

export async function POST(request: Request) {
  try {
    const { query, website_id } = await request.json();

    let seed = (query || '').trim();

    if (!seed && website_id) {
      const supabase = await createClient();
      const { data: website } = await supabase
        .from('websites')
        .select('id, domain, url')
        .eq('id', website_id)
        .maybeSingle();

      if (website) {
        try {
          const profile = await SiteNicheProfiler.profileSite({
            websiteId: website.id,
            domain: website.domain,
            siteUrl: website.url,
          });
          seed = profile.primaryNiche || website.domain.split('.')[0].replace(/[-_]/g, ' ');
        } catch {
          seed = website.domain.split('.')[0].replace(/[-_]/g, ' ');
        }
      }
    }

    if (!seed) {
      return NextResponse.json({ error: 'Search seed query or website_id is required' }, { status: 400 });
    }

    const liveResult = await GoogleSuggestService.expandLiveKeywords(seed);

    return NextResponse.json({
      success: true,
      result: liveResult,
    });
  } catch (error: any) {
    console.error('[Live Keywords POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to expand live Google search queries' }, { status: 500 });
  }
}
