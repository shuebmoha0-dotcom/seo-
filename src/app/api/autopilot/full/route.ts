export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { FullAutopilotEngine } from '@/lib/agent/fullAutopilotEngine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const status = await FullAutopilotEngine.getStatus(websiteId);
    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    console.error('[API Autopilot Full GET Error]:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Failed to fetch autopilot status' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, goal, cadence, auto_publish, auto_fix_technical } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const updated = await FullAutopilotEngine.enable({
      website_id,
      goal,
      cadence,
      auto_publish,
      auto_fix_technical,
    });

    return NextResponse.json({ success: true, status: updated });
  } catch (err: any) {
    console.error('[API Autopilot Full POST Error]:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Failed to enable autopilot' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const paused = await FullAutopilotEngine.disable(websiteId);
    return NextResponse.json({ success: true, status: paused });
  } catch (err: any) {
    console.error('[API Autopilot Full DELETE Error]:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Failed to pause autopilot' }, { status: 500 });
  }
}
