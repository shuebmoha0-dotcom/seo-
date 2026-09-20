import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prospect = body.prospect;
    const targetUrl = body.customer_url || body.linkTargetUrl || 'https://example.com';
    const assetName = body.asset_name || prospect?.linkable_asset || body.siteName || 'Industry Benchmark Report';

    const agent = new BacklinkAgent();

    const draft = await agent.draftOutreach(
      prospect,
      targetUrl,
      assetName
    );

    return NextResponse.json({ success: true, draft });
  } catch (error: any) {
    console.error('Error drafting backlink outreach:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
