import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';

export async function POST(request: Request) {
  try {
    const { prospect, customer_url, asset_name } = await request.json();
    const agent = new BacklinkAgent();

    const draft = await agent.draftOutreach(
      prospect,
      customer_url || 'https://my-saas-company.com',
      asset_name || '2026 SaaS Productivity Benchmark Report'
    );

    return NextResponse.json({ success: true, draft });
  } catch (error: any) {
    console.error('Error drafting backlink outreach:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
