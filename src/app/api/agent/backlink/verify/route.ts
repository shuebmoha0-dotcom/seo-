import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';

export async function POST(request: Request) {
  try {
    const { linking_url, target_url } = await request.json();
    const agent = new BacklinkAgent();

    const verification = await agent.verifyBacklink(linking_url, target_url);

    return NextResponse.json({ success: true, verification });
  } catch (error: any) {
    console.error('Error verifying backlink:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
