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

    // 2. Fetch knowledge bank from project_memory
    const knowledgeMemory = (data || []).find((m: any) => m.source === 'project_knowledge_bank');
    const knowledge_bank = knowledgeMemory?.content || '';

    // Filter out internal system memory rows from the public list of individual memory items
    const displayMemories = (data || []).filter(
      (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
    );

    if (task_type && displayMemories) {
      const agent = new MemoryAgent();
      const relevant = agent.filterForTask(displayMemories as any, task_type);
      return NextResponse.json({
        instructions,
        knowledge_bank,
        memories: relevant,
        total: displayMemories.length,
        filtered: relevant.length,
      });
    }

    return NextResponse.json({
      instructions,
      knowledge_bank,
      memories: displayMemories,
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

    // 1. Save Claude-Projects Style Custom Instructions
    if (type === 'instructions') {
      const safeInstructions = instructions ?? '';

      // Overwrite/replace any previous custom instruction rows (guarantees zero duplication)
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
          source_detail: 'Custom Project Instructions (Claude Project Style)',
          confidence: 'high',
          is_important: true,
          tags: ['custom_instructions', 'claude_project_prompt'],
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

    // 2. Save Claude-Projects Style Knowledge Bank / Large Context
    if (type === 'knowledge_bank') {
      const safeKnowledge = knowledge_bank ?? '';

      // Overwrite/replace any previous knowledge bank rows (guarantees zero duplication)
      await supabase
        .from('project_memory')
        .delete()
        .eq('source', 'project_knowledge_bank');

      if (safeKnowledge.trim()) {
        await supabase.from('project_memory').insert({
          website_id: website_id || null,
          category: 'content_strategy',
          content: safeKnowledge,
          source: 'project_knowledge_bank',
          source_detail: 'Project Knowledge Bank & Context Documents',
          confidence: 'high',
          is_important: true,
          tags: ['knowledge_bank', 'context_docs'],
        });
      }

      return NextResponse.json({ success: true, knowledge_bank: safeKnowledge });
    }

    // 3. Batch Import Memory & Custom Instructions
    if (type === 'import') {
      const { import_data, mode = 'merge' } = body;
      if (!import_data) {
        return NextResponse.json({ error: 'import_data is required' }, { status: 400 });
      }

      let importedInstructionsCount = 0;
      let importedMemoriesCount = 0;

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

      // Handle memories array
      const rawMemories = Array.isArray(import_data.memories)
        ? import_data.memories
        : Array.isArray(import_data)
        ? import_data
        : [];

      if (rawMemories.length > 0) {
        if (mode === 'replace') {
          // Delete non-instruction memories
          await supabase
            .from('project_memory')
            .delete()
            .neq('source', 'project_custom_instructions')
            .neq('source', 'project_knowledge_bank');
        }

        const validMemories = rawMemories.map((m: any) => ({
          website_id: website_id || null,
          category: m.category || 'brand',
          content: (m.content || m.text || (typeof m === 'string' ? m : '')).trim(),
          source: m.source || 'imported_memory',
          source_detail: m.source_detail || 'Imported Memory Item',
          confidence: m.confidence || 'high',
          is_important: !!m.is_important,
          tags: Array.isArray(m.tags) ? m.tags : ['imported'],
        })).filter((m: any) => m.content.length > 0);

        if (validMemories.length > 0) {
          const { error: insErr } = await supabase.from('project_memory').insert(validMemories);
          if (insErr) throw insErr;
          importedMemoriesCount = validMemories.length;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Imported successfully: ${importedInstructionsCount} instruction set and ${importedMemoriesCount} memory items.`,
        instructions_count: importedInstructionsCount,
        memories_count: importedMemoriesCount,
      });
    }

    // 4. Save standard structured memory item
    if (!category || !content) {
      return NextResponse.json({ error: 'category and content are required' }, { status: 400 });
    }

    const { data: memory, error } = await supabase
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

    const agent = new MemoryAgent();
    const action = triggered_by === 'user' ? 'user_added' : 'learned';
    try {
      await supabase.from('memory_activity').insert({
        website_id: website_id || null,
        memory_id: memory.id,
        action,
        summary: agent.generateActivitySummary(action, { category, content }),
        triggered_by: triggered_by || 'agent',
      });
    } catch (actErr) {
      console.warn('[Memory POST] Activity log error:', actErr);
    }

    return NextResponse.json({ success: true, memory });
  } catch (error: any) {
    console.error('[Memory POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE clear instructions, knowledge bank, or memories
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const website_id = searchParams.get('website_id');

    const supabase = createAdminClient();

    if (type === 'instructions') {
      await supabase
        .from('project_memory')
        .delete()
        .eq('source', 'project_custom_instructions');

      if (website_id) {
        await supabase
          .from('content_rules')
          .update({ custom_rules: '', updated_at: new Date().toISOString() })
          .eq('website_id', website_id);
      }

      return NextResponse.json({ success: true, message: 'Custom instructions deleted' });
    }

    if (type === 'knowledge_bank') {
      await supabase
        .from('project_memory')
        .delete()
        .eq('source', 'project_knowledge_bank');

      return NextResponse.json({ success: true, message: 'Knowledge bank deleted' });
    }

    return NextResponse.json({ error: 'Valid type parameter required (instructions or knowledge_bank)' }, { status: 400 });
  } catch (error: any) {
    console.error('[Memory DELETE] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
