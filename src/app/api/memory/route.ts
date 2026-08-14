import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MemoryAgent } from '@/lib/agent/memoryAgent';

// GET all memories for a project (optionally filtered by category)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const website_id = searchParams.get('website_id');
    const category = searchParams.get('category');
    const task_type = searchParams.get('task_type'); // retrieve relevant subset for a task
    const include_outdated = searchParams.get('include_outdated') === 'true';

    const supabase = await createClient();
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

    // If task_type specified, filter to relevant subset
    if (task_type && data) {
      const agent = new MemoryAgent();
      const relevant = agent.filterForTask(data as any, task_type);
      return NextResponse.json({ memories: relevant, total: data.length, filtered: relevant.length });
    }

    return NextResponse.json({ memories: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST create a new memory (user or agent)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, category, content, source, source_detail, confidence, is_important, tags, triggered_by } = body;

    if (!category || !content) {
      return NextResponse.json({ error: 'category and content are required' }, { status: 400 });
    }

    const supabase = await createClient();
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

    // Log activity
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
