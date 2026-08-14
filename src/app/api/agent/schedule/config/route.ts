import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ScheduleAgent } from '@/lib/agent/scheduleAgent';

// GET schedule config for a website
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');

    const supabase = await createClient();
    let query = supabase.from('scheduled_agent_configs').select('*');
    if (website_id) query = query.eq('website_id', website_id);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ config: data?.[0] || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST update schedule config (frequency, schedule_time, status pause/resume, budgets)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, frequency, schedule_time, timezone, status, daily_budget_usd, monthly_budget_usd } = body;

    if (!website_id) return NextResponse.json({ error: 'website_id is required' }, { status: 400 });

    const supabase = await createClient();
    const agent = new ScheduleAgent();

    const tempConfig: any = {
      website_id,
      frequency: frequency || 'daily',
      schedule_time: schedule_time || '09:00',
      timezone: timezone || 'America/New_York',
      status: status || 'active',
      daily_budget_usd: daily_budget_usd || 10.0,
      monthly_budget_usd: monthly_budget_usd || 100.0,
    };

    const nextRun = agent.computeNextRun(tempConfig);

    const { data, error } = await supabase
      .from('scheduled_agent_configs')
      .upsert({
        ...tempConfig,
        next_run_at: status === 'paused' ? null : nextRun,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'website_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, config: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
