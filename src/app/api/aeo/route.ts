import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AeoMonitorService } from '@/lib/services/aeoMonitorService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Enforce multi-tenant ownership check on websiteId (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain')
      .eq('id', websiteId)
      .maybeSingle();

    if (!website || (user?.id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await AeoMonitorService.getOrRunReport(websiteId);
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[AEO GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load AEO & AI Mentions report' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, custom_prompt } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    // Enforce multi-tenant ownership check on websiteId (Rule 10)
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain')
      .eq('id', website_id)
      .maybeSingle();

    if (!website || (user?.id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const report = await AeoMonitorService.getOrRunReport(website_id, {
      forceFresh: true,
      customPrompt: custom_prompt,
    });

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[AEO POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute live AEO scan' }, { status: 500 });
  }
}
