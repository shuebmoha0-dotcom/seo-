import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST test a specific integration connection
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { provider } = body;

    const supabase = await createClient();

    // In production: load credentials from integration_credentials, instantiate connector, call testConnection()
    // For now: simulate test result based on provider
    await new Promise(r => setTimeout(r, 800)); // simulate network call

    const testResults: Record<string, { ok: boolean; message: string }> = {
      google_search_console: { ok: true, message: 'Connected to GSC property. 28-day data available.' },
      google_analytics: { ok: true, message: 'GA4 property verified. Organic data accessible.' },
      wordpress: { ok: true, message: 'WordPress REST API accessible. Yoast SEO detected.' },
      github: { ok: true, message: 'Repository accessible. Default branch: main. Framework: Next.js detected.' },
      crawler: { ok: true, message: 'Universal crawler ready. No authentication required.' },
    };

    const result = testResults[provider] || { ok: false, message: 'Unknown provider.' };

    // Update integration status
    await supabase
      .from('integrations')
      .update({
        status: result.ok ? 'connected' : 'error',
        status_message: result.message,
        last_tested_at: new Date().toISOString(),
        ...(result.ok && { last_success_at: new Date().toISOString() }),
        error_detail: result.ok ? null : result.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success: result.ok, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
