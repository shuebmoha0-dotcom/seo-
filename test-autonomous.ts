import { Orchestrator } from './src/lib/agent/orchestrator';

async function runAutonomousTest() {
  console.log('=== STARTING AUTONOMOUS WORKFLOW TEST ===');
  
  const orchestrator = new Orchestrator();
  
  // 1. Initialize from GOAL
  const initialState = await orchestrator.initializeWorkflow('Grow organic traffic for example.com', {
    integrations: ['WordPress', 'GitHub'],
    project_memory: 'Focus on technical SEO guides.'
  });

  console.log('\nInitial Task Graph planned by LLM:');
  initialState.pending_tasks.forEach(t => {
    console.log(`- ${t.target_agent}: ${t.objective} (Deps: ${t.dependencies?.join(',') || 'none'})`);
  });

  // 2. Execute
  console.log('\n--- Executing Workflow ---');
  let finalState = await orchestrator.executeWorkflow(initialState);

  // 3. Check for Paused Approval Batching
  if (finalState.current_stage === 'PAUSED_FOR_APPROVAL' && finalState.pending_packages?.length) {
    const pkg = finalState.pending_packages[0];
    console.log('\n✅ Workflow paused for approval!');
    console.log(`Package Generated: ${pkg.title}`);
    console.log(`Contains ${pkg.actions.length} actions bundled together.`);

    // 4. Mock user clicking "Approve"
    console.log('\n--- User Approves Package ---');
    finalState = await orchestrator.resumeWorkflow(finalState, pkg.package_id);
  }

  console.log(`\nFinal State: ${finalState.current_stage}`);
  console.log('=== TEST COMPLETE ===');
}

runAutonomousTest().catch(console.error);
