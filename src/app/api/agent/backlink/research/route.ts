import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { BacklinkMonitorService } from '@/lib/services/backlinkMonitorService';

export async function POST(request: Request) {
  try {
    const { website_id, batch_size } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    const supabase = createAdminClient();

    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, domain')
      .eq('id', website_id)
      .maybeSingle();

    if (!website || (user?.id && website.user_id && website.user_id !== user.id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cycleResult = await BacklinkMonitorService.runDailyBacklinkDiscoveryAndMonitor({
      websiteId: website_id,
      batchSize: batch_size || 15,
      forceNewBatch: true,
      triggerReason: 'manual_scan',
    });

    return NextResponse.json({
      success: true,
      newly_discovered: cycleResult.newly_discovered_count,
      total_active_prospects: cycleResult.total_active_prospects,
      total_acquired_backlinks: cycleResult.total_acquired_backlinks,
      target_goal: cycleResult.target_goal,
      prospects: cycleResult.new_prospects,
      summary: cycleResult.summary,
    });
  } catch (error: any) {
    console.error('Error running backlink research:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
