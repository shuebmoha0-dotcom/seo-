import { NextResponse } from 'next/server';
import { StrategyAgent, BusinessGoal } from '@/lib/agent/strategyAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id, primary_goal } = await request.json();
    const supabase = await createClient();

    // Fetch site pages & Search console count
    let pageCount = 84;
    let traffic = 18247;

    if (website_id) {
      const { count } = await supabase
        .from('pages')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', website_id);
      if (count !== null) pageCount = count;
    }

    const agent = new StrategyAgent();
    const maturity = agent.determineMaturity(pageCount, traffic);
    const roadmap = await agent.generateStrategyRoadmap(
      maturity,
      (primary_goal as BusinessGoal) || 'generate_qualified_leads',
      pageCount,
      100
    );

    // Save plan to Supabase if website_id present
    if (website_id) {
      await supabase.from('strategic_plans').insert({
        website_id,
        website_maturity: maturity,
        phases: JSON.parse(JSON.stringify(roadmap.phases)),
        status: 'active'
      });
    }

    return NextResponse.json({ success: true, roadmap });
  } catch (error: any) {
    console.error('Error executing Strategy Agent evaluation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
