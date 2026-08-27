import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { MemoryAgent } from '@/lib/agent/memoryAgent';

// GET all memories, project instructions, and knowledge bank
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let website_id = searchParams.get('website_id');
    const category = searchParams.get('category');
    const task_type = searchParams.get('task_type');
    const include_outdated = searchParams.get('include_outdated') === 'true';

    const supabase = createAdminClient();

    if (!website_id) {
      const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
      if (firstSite) website_id = firstSite.id;
    }

    let query = supabase
      .from('project_memory')
      .select('*')
      .order('is_important', { ascending: false })
      .order('created_at', { ascending: false });

    if (website_id) query = query.or(`website_id.eq.${website_id},website_id.is.null`);
    if (category) query = query.eq('category', category);
    if (!include_outdated) query = query.eq('is_outdated', false);

    const { data, error } = await query;
    if (error) throw error;

    // 1. Fetch instructions from project_memory first
    const instrMem = (data || []).find((m: any) => m.source === 'project_custom_instructions');
    let instructions = instrMem?.content || '';

    // If not in project_memory, fallback to content_rules
    if (!instructions && website_id) {
      try {
        const { data: rulesData } = await supabase
          .from('content_rules')
          .select('custom_rules')
          .eq('website_id', website_id)
          .maybeSingle();

        if (rulesData?.custom_rules) {
          instructions = rulesData.custom_rules;
        }
      } catch (rErr) {
        console.warn('[Memory GET] content_rules read error:', rErr);
      }
    }

    // 2. Fetch autonomous memory / knowledge space from project_memory
    const knowledgeMemory = (data || []).find((m: any) => m.source === 'project_knowledge_bank');
    const memory = knowledgeMemory?.content || '';

    // Filter out internal system memory rows from the public list of individual memory items
    const displayMemories = (data || []).filter(
      (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
    );

    return NextResponse.json({
      instructions,
      memory,
      knowledge_bank: memory,
      memories: displayMemories,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      }
    });
  } catch (error: any) {
    console.error('[Memory GET] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create/update project instructions, knowledge bank, or memory item
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let {
      website_id,
      type,
      instructions,
      memory,
      knowledge_bank,
      category,
      content,
      source,
      source_detail,
      confidence,
      is_important,
      tags,
      triggered_by,
    } = body;

    const supabase = createAdminClient();

    if (!website_id) {
      const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
      if (firstSite) website_id = firstSite.id;
    }

    // 1. Save Human Custom Instructions
    if (type === 'instructions') {
      const safeInstructions = instructions ?? '';

      await supabase
        .from('project_memory')
        .delete()
        .eq('source', 'project_custom_instructions');

      if (safeInstructions.trim()) {
        await supabase.from('project_memory').insert({
          website_id: website_id || null,
          category: 'brand',
          content: safeInstructions,
          source: 'project_custom_instructions',
          source_detail: 'Custom Project Instructions (Set by User)',
          confidence: 'high',
          is_important: true,
          tags: ['custom_instructions', 'human_directive'],
        });
      }

      // Also sync to content_rules if website exists
      if (website_id) {
        try {
          const { data: existingRule } = await supabase
            .from('content_rules')
            .select('id')
            .eq('website_id', website_id)
            .maybeSingle();

          if (existingRule) {
            await supabase
              .from('content_rules')
              .update({ custom_rules: safeInstructions, updated_at: new Date().toISOString() })
              .eq('id', existingRule.id);
          } else {
            await supabase.from('content_rules').insert({
              website_id,
              custom_rules: safeInstructions,
              word_count_min: 900,
              word_count_max: 1500,
              language: 'U.S. English',
              tone: 'Professional, natural, helpful',
              audience: 'SaaS founders and search audience',
            });
          }
        } catch (ruleErr) {
          console.warn('[Memory POST] content_rules sync error:', ruleErr);
        }
      }

      return NextResponse.json({ success: true, instructions: safeInstructions });
    }

    // 2. Save Autonomous Project Memory Space (Large Context)
    if (type === 'memory' || type === 'knowledge_bank') {
      const safeMemory = (memory !== undefined ? memory : knowledge_bank) ?? '';

      await supabase
        .from('project_memory')
        .delete()
        .eq('source', 'project_knowledge_bank');

      if (safeMemory.trim()) {
        await supabase.from('project_memory').insert({
          website_id: website_id || null,
          category: 'content_strategy',
          content: safeMemory,
          source: 'project_knowledge_bank',
          source_detail: 'Autonomous Project Memory Space',
          confidence: 'high',
          is_important: true,
          tags: ['project_memory', 'autonomous_learning'],
        });
      }

      return NextResponse.json({ success: true, memory: safeMemory });
    }

    // 3. Batch Import Memory & Custom Instructions
    if (type === 'import') {
      const { import_data, mode = 'merge' } = body;
      if (!import_data) {
        return NextResponse.json({ error: 'import_data is required' }, { status: 400 });
      }

      let importedInstructionsCount = 0;
      let importedMemoryCount = 0;

      // Handle custom instructions
      const customInstr = import_data.custom_instructions || (typeof import_data === 'string' ? import_data : '');
      if (customInstr && typeof customInstr === 'string' && customInstr.trim()) {
        await supabase
          .from('project_memory')
          .delete()
          .eq('source', 'project_custom_instructions');

        await supabase.from('project_memory').insert({
          website_id: website_id || null,
          category: 'brand',
          content: customInstr.trim(),
          source: 'project_custom_instructions',
          source_detail: 'Imported Custom Instructions',
          confidence: 'high',
          is_important: true,
          tags: ['custom_instructions', 'imported'],
        });
        importedInstructionsCount = 1;
      }

      // Handle autonomous memory space
      const incomingMemory = import_data.autonomous_memory || import_data.memory || import_data.knowledge_bank || '';
      if (incomingMemory && typeof incomingMemory === 'string' && incomingMemory.trim()) {
        let finalMemory = incomingMemory.trim();

        if (mode === 'merge') {
          const { data: currentMem } = await supabase
            .from('project_memory')
            .select('content')
            .eq('source', 'project_knowledge_bank')
            .maybeSingle();

          if (currentMem?.content) {
            finalMemory = `${currentMem.content.trim()}\n\n${finalMemory}`;
          }
        }

        await supabase
          .from('project_memory')
          .delete()
          .eq('source', 'project_knowledge_bank');

        await supabase.from('project_memory').insert({
          website_id: website_id || null,
          category: 'content_strategy',
          content: finalMemory,
          source: 'project_knowledge_bank',
          source_detail: 'Imported Project Memory Space',
          confidence: 'high',
          is_important: true,
          tags: ['project_memory', 'imported'],
        });
        importedMemoryCount = 1;
      }

      return NextResponse.json({
        success: true,
        message: 'Memory & instructions imported successfully!',
        instructions_imported: importedInstructionsCount,
        memory_imported: importedMemoryCount,
      });
    }

    // 4. Save individual structured memory item (backward compatibility)
    if (!category || !content) {
      return NextResponse.json({ error: 'category and content are required' }, { status: 400 });
    }

    const { data: memoryItem, error } = await supabase
      .from('project_memory')
      .insert({
        website_id: website_id || null,
        category,
        content,
        source: source || 'user_added',
        source_detail: source_detail || '',
        confidence: confidence || 'high',
        is_important: is_important || false,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, memory: memoryItem });
  } catch (error: any) {
    console.error('[Memory POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE clear instructions or memory
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'instructions';
    let website_id = searchParams.get('website_id');

    const supabase = createAdminClient();

    if (!website_id) {
      const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
      if (firstSite) website_id = firstSite.id;
    }

    if (type === 'instructions') {
      await supabase.from('project_memory').delete().eq('source', 'project_custom_instructions');
      if (website_id) {
        await supabase.from('content_rules').update({ custom_rules: '' }).eq('website_id', website_id);
      }
    } else if (type === 'memory') {
      await supabase.from('project_memory').delete().eq('source', 'project_knowledge_bank');
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Memory DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
