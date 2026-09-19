export const maxDuration = 60;
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { FullAutopilotEngine } from '@/lib/agent/fullAutopilotEngine';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id } = body;

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    // Execute in foreground up to serverless limits, or launch safely
    const result = await FullAutopilotEngine.runAutonomousCycle(website_id, { force: true });
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error('[API Autopilot Run-Now Error]:', err?.message || err);
    return NextResponse.json({ error: err?.message || 'Autonomous cycle failed' }, { status: 500 });
  }
}
