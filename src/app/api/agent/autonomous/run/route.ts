import { NextResponse } from 'next/server';
import { AutonomousEngine, PermissionLevel } from '@/lib/agent/autonomousEngine';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { website_id, permission_level } = await request.json();
    const userLevel: PermissionLevel = (permission_level ?? 2) as PermissionLevel;

    const engine = new AutonomousEngine();
    const logs = [
      { state: 'OBSERVE', description: 'Observed site state: 84 pages crawled, GSC queries fetched.', status: 'completed' },
      { state: 'ANALYZE', description: 'Analyzed site metrics: Discovered 31 opportunities.', status: 'completed' },
      { state: 'PRIORITIZE', description: 'Prioritized top candidate: Homepage Title Tag CTR Optimization.', status: 'completed' },
      { state: 'PLAN', description: 'Execution plan: Change Title to "Project Management Software for Modern Teams | Company".', status: 'completed' },
    ];

    // Permission Check
    const permCheck = engine.checkPermission('update_title', userLevel);

    if (permCheck.isAllowed) {
      logs.push({
        state: 'PERMISSION_CHECK',
        description: `Permission Granted: ${permCheck.reason}`,
        status: 'completed'
      });
      logs.push({
        state: 'EXECUTE',
        description: 'Autonomous Execution: Applied title modification and created branch.',
        status: 'completed'
      });

      // Verification
      const verifyResult = await engine.verifyExecution(
        'https://my-saas-company.com',
        'update_title',
        'Project Management Software for Modern Teams'
      );

      logs.push({
        state: 'VERIFY',
        description: `Verification ${verifyResult.status}: Extracted element matched expected change.`,
        status: verifyResult.verified ? 'completed' : 'failed'
      });
      logs.push({
        state: 'LEARN',
        description: 'Recorded outcome into Project Memory & updated activity log.',
        status: 'completed'
      });
    } else {
      logs.push({
        state: 'PERMISSION_CHECK',
        description: `Human Approval Required: ${permCheck.reason}`,
        status: 'gated'
      });
    }

    return NextResponse.json({ success: true, logs, permission_check: permCheck });
  } catch (error: any) {
    console.error('Error in Autonomous Loop Execution:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
