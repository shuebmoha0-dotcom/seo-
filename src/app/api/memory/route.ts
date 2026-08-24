import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MemoryAgent } from '@/lib/agent/memoryAgent';

// GET all memories, project instructions, and knowledge bank
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let website_id = searchParams.get('website_id');
    const category = searchParams.get('category');
    const task_type = searchParams.get('task_type');
    const include_outdated = searchParams.get('include_outdated') === 'true';

    const supabase = await createClient();

    if (!website_id) {
      const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
      if (firstSite) website_id = firstSite.id;
    }

    let query = supabase
      .from('project_memory')
      .select('*')
      .order('is_important', { ascending: false })
      .order('created_at', { ascending: false });

    if (website_id) query = query.eq('website_id', website_id);
    if (category) query = query.eq('category', category);
    if (!include_outdated) query = query.eq('is_outdated', false);

    const { data, error } = await query;
    if (error) throw error;

    // Fetch custom instructions from content_rules
    let instructions = '';
    if (website_id) {
      const { data: rulesData } = await supabase
        .from('content_rules')
        .select('custom_rules')
        .eq('website_id', website_id)
        .maybeSingle();

      if (rulesData?.custom_rules) {
        instructions = rulesData.custom_rules;
      }
    }

    // Fetch large knowledge bank document from project_memory
    const knowledgeMemory = (data || []).find((m: any) => m.category === 'content_strategy' && m.source === 'project_knowledge_bank');

    if (task_type && data) {
      const agent = new MemoryAgent();
      const relevant = agent.filterForTask(data as any, task_type);
      return NextResponse.json({
        instructions,
        knowledge_bank: knowledgeMemory?.content || '',
        memories: relevant,
        total: data.length,
        filtered: relevant.length,
      });
    }

    return NextResponse.json({
      instructions,
      knowledge_bank: knowledgeMemory?.content || '',
      memories: data || [],
    });
  } catch (error: any) {
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

    const supabase = await createClient();

    if (!website_id) {
      const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
      if (firstSite) website_id = firstSite.id;
    }

    // 1. Save Claude-Projects Style Custom Instructions
    if (type === 'instructions') {
      if (website_id) {
        // Upsert in content_rules
        const { data: existing } = await supabase
          .from('content_rules')
          .select('id')
          .eq('website_id', website_id)
          .maybeSingle();

        if (existing) {
          await supabase
            .from('content_rules')
            .update({ custom_rules: instructions, updated_at: new Date().toISOString() })
            .eq('website_id', website_id);
        } else {
          await supabase.from('content_rules').insert({
            website_id,
            custom_rules: instructions,
            word_count_min: 900,
            word_count_max: 1500,
            language: 'U.S. English',
            tone: 'Professional, natural, helpful',
            audience: 'SaaS founders and search audience',
          });
        }
      }
      return NextResponse.json({ success: true, instructions });
    }

    // 2. Save Claude-Projects Style Knowledge Bank / Large Context
    if (type === 'knowledge_bank') {
      if (website_id) {
        const { data: existing } = await supabase
          .from('project_memory')
          .select('id')
          .eq('website_id', website_id)
          .eq('category', 'content_strategy')
          .eq('source', 'project_knowledge_bank')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('project_memory')
            .update({ content: knowledge_bank, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase.from('project_memory').insert({
            website_id,
            category: 'content_strategy',
            content: knowledge_bank,
            source: 'project_knowledge_bank',
            source_detail: 'User Knowledge Bank & Context Documents',
            confidence: 'high',
            is_important: true,
            tags: ['knowledge_bank', 'context_docs'],
          });
        }
      }
      return NextResponse.json({ success: true, knowledge_bank });
    }

    // 3. Save standard structured memory item
    if (!category || !content) {
      return NextResponse.json({ error: 'category and content are required' }, { status: 400 });
    }

    const { data: memory, error } = await supabase
      .from('project_memory')
      .insert({
        website_id,
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
    await supabase.from('memory_activity').insert({
      website_id,
      memory_id: memory.id,
      action,
      summary: agent.generateActivitySummary(action, { category, content }),
      triggered_by: triggered_by || 'agent',
    });

    return NextResponse.json({ success: true, memory });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
