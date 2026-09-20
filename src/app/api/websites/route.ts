import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WebsiteService } from '@/lib/services/websiteService';
import { checkWebsiteLimit } from '@/lib/billing/entitlements';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        websites: [],
        plan_limit: null,
      });
    }

    const websites = await WebsiteService.getUserWebsites(user.id);
    const limitInfo = await checkWebsiteLimit(user.id);

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const result = await WebsiteService.createWebsiteWithIntegration(user.id, body);

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

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const result = await WebsiteService.deleteWebsite(user.id, website_id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Website deleted successfully.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
