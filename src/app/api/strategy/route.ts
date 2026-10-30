import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { StrategyAgent, BusinessGoal } from '@/lib/agent/strategyAgent';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ strategic_plans: [], project_memory: [], telemetry: null, latest_decision: null });
    }

    const supabase = await createClient();
    const adminSupabase = createAdminClient();
    const agent = new StrategyAgent();

    const [plansRes, memoryRes, telemetry] = await Promise.all([
      supabase
        .from('strategic_plans')
        .select('*')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('project_memory')
        .select('*')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(60),
      agent.collectEmpiricalTelemetry(websiteId).catch(() => null),
    ]);

    let plans = plansRes.data || [];

    // If no strategic plan exists yet or the existing plan has fake static act_4/act_1 templates, generate a fresh empirical plan
    const hasLegacyMock = plans.length > 0 && JSON.stringify(plans[0].phases || []).includes('18.4K impressions');
    if (plans.length === 0 || hasLegacyMock) {
      try {
        const roadmap = await agent.generateStrategyRoadmap(
          'ESTABLISHED',
          'increase_organic_traffic',
          0,
          0,
          websiteId
        );
        const { data: savedPlan } = await adminSupabase
          .from('strategic_plans')
          .insert({
            website_id: websiteId,
            goal: 'increase_organic_traffic',
            phases: roadmap.phases,
            status: 'active',
          })
          .select()
          .single();
        if (savedPlan) {
          plans = [savedPlan, ...plans.filter((p: any) => p.id !== savedPlan.id)];
        } else {
          plans = [{ id: 'live_empirical', website_id: websiteId, goal: 'increase_organic_traffic', phases: roadmap.phases, status: 'active' }];
        }
      } catch (genErr) {
        console.warn('[Strategy GET] Auto-roadmap generation notice:', genErr);
      }
    }

    // Filter out noisy raw chat/indexing operational logs so only strategic memories, experiments, pillars, and decisions appear
    const rawMemory = memoryRes.data || [];
    const strategicCategories = new Set([
      'decisions',
      'experiments',
      'seo_strategy',
      'content_strategy',
      'content_pillars',
      'trending_keywords',
      'company',
      'audience',
      'competitors',
      'keywords',
    ]);

    const cleanMemory = rawMemory.filter((m: any) => {
      if (m.is_outdated) return false;
      const content = (m.content || '').trim();
      if (content.length < 15) return false;
      if (/^(write article|hi|hello|status|check)/i.test(content)) return false;
      if (m.source === 'google_indexing_api') return false;
      return strategicCategories.has(m.category) || Boolean(m.is_important);
    });

    const latestDecision = cleanMemory.find(
      (m: any) => m.category === 'decisions' && m.source === 'autonomous_strategy_brain'
    ) || null;

    const outcomeEvaluations = cleanMemory.filter(
      (m: any) => m.category === 'experiments'
    );

    return NextResponse.json({
      strategic_plans: plans,
      project_memory: cleanMemory.slice(0, 25),
      latest_decision: latestDecision,
      outcome_evaluations: outcomeEvaluations.slice(0, 10),
      telemetry,
    });
  } catch (error: any) {
    console.error('[Strategy GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const { website_id, primary_goal } = await request.json();

    if (!website_id) {
      return NextResponse.json({ error: 'website_id is required' }, { status: 400 });
    }

    const { data: website } = await adminSupabase
      .from('websites')
      .select('*')
      .eq('id', website_id)
      .single();

    if (!website) {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }

    const agent = new StrategyAgent();
    const goal: BusinessGoal = primary_goal || 'increase_organic_traffic';

    const [roadmap, decision] = await Promise.all([
      agent.generateStrategyRoadmap('ESTABLISHED', goal, 0, 0, website_id),
      agent.diagnoseAndDecideNextAction(website_id, { goal }),
    ]);

    // Save to strategic_plans table
    const { data: savedPlan } = await adminSupabase
      .from('strategic_plans')
      .insert({
        website_id,
        goal,
        phases: roadmap.phases,
        status: 'active',
      })
      .select()
      .single();

    return NextResponse.json({
      success: true,
      plan: savedPlan || { website_id, goal, phases: roadmap.phases, status: 'active' },
      roadmap,
      decision,
      telemetry: roadmap.telemetry,
    });
  } catch (error: any) {
    console.error('[Strategy POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
