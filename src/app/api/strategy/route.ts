import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StrategyAgent } from '@/lib/agent/strategyAgent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ strategic_plans: [], project_memory: [] });
    }

    const supabase = await createClient();

    const { data: plans } = await supabase
      .from('strategic_plans')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    const { data: memory } = await supabase
      .from('project_memory')
      .select('*')
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      strategic_plans: plans || [],
      project_memory: memory || [],
    });
  } catch (error: any) {
    console.error('[Strategy GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { website_id, primary_goal } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const { data: website } = await supabase
      .from('websites')
      .select('*')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const agent = new StrategyAgent();
    const roadmap = await agent.generateStrategyRoadmap(
      'ESTABLISHED',
      primary_goal || 'increase_organic_traffic',
      50,
      100
    );

    // Save to strategic_plans table
    const { data: savedPlan } = await supabase
      .from('strategic_plans')
      .insert({
        website_id,
        goal: primary_goal || 'increase_organic_traffic',
        phases: roadmap.phases,
        status: 'active',
      })
      .select()
      .single();

    return NextResponse.json({ success: true, plan: savedPlan, roadmap });
  } catch (error: any) {
    console.error('[Strategy POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
