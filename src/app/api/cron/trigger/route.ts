import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ScheduleAgent } from '@/lib/agent/scheduleAgent';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    const supabase = await createClient();
    
    // Find all websites that have active scheduled configurations
    const { data: configs } = await supabase
      .from('scheduled_agent_configs')
      .select('*')
      .eq('status', 'active');

    if (!configs || configs.length === 0) {
      return NextResponse.json({ success: true, message: 'No active schedules found.' });
    }

    const agent = new ScheduleAgent();
    const results = [];

    for (const config of configs) {
      try {
        const { data: website } = await supabase
          .from('websites')
          .select('domain')
          .eq('id', config.website_id)
          .single();

        if (website) {
          const runResult = await agent.executeRun({
            website_id: config.website_id,
            website_url: `https://${website.domain}`,
            trigger_type: 'schedule',
            config,
          });
          
          results.push({ website_id: config.website_id, status: runResult.status });
        }
      } catch (err) {
        console.error(`Error running schedule for ${config.website_id}`, err);
        results.push({ website_id: config.website_id, error: true });
      }
    }

    return NextResponse.json({ success: true, executed: results.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
