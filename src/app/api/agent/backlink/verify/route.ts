import { NextResponse } from 'next/server';
import { BacklinkAgent } from '@/lib/agent/backlinkAgent';
import { BacklinkMonitorService } from '@/lib/services/backlinkMonitorService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { linking_url, target_url, website_id } = body;

    if (website_id && !linking_url) {
      const monitorResult = await BacklinkMonitorService.runDailyBacklinkDiscoveryAndMonitor({
        websiteId: website_id,
        batchSize: 10,
        forceNewBatch: false,
        triggerReason: 'manual_scan',
      });
      return NextResponse.json({
        success: true,
        monitor_result: monitorResult,
      });
    }

    const agent = new BacklinkAgent();
    const verification = await agent.verifyBacklink(linking_url, target_url);

    return NextResponse.json({ success: true, verification });
  } catch (error: any) {
    console.error('Error verifying backlink:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
