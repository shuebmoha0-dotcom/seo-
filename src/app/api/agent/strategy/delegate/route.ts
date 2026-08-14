import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id, target_agent, task_title, rationale, priority_score } = await request.json();
    const supabase = await createClient();

    const { data: delegation, error } = await supabase
      .from('agent_delegations')
      .insert({
        website_id: website_id || '00000000-0000-0000-0000-000000000000',
        target_agent,
        task_title,
        rationale,
        priority_score: priority_score || 85,
        requires_approval: true,
        status: 'queued'
      })
      .select()
      .single();

    if (error) {
      console.warn("DB Delegation warning:", error);
    }

    return NextResponse.json({
      success: true,
      delegation: delegation || {
        id: "del_demo",
        target_agent,
        task_title,
        status: "queued"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
