import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WebsiteService } from '@/lib/services/websiteService';
import { checkWebsiteLimit } from '@/lib/billing/entitlements';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const websites = await WebsiteService.getUserWebsites(userId);
    const limitInfo = await checkWebsiteLimit(userId);

    return NextResponse.json({
      websites,
      plan_limit: limitInfo,
    });
  } catch (error: any) {
    console.error('[Websites GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch websites.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const body = await request.json();

    const result = await WebsiteService.createWebsiteWithIntegration(userId, body);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create website.' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Websites POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create website.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('id');

    if (!website_id) {
      return NextResponse.json({ error: 'website id is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const result = await WebsiteService.deleteWebsite(userId, website_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Website deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
