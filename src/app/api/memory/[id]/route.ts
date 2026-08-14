import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MemoryAgent } from '@/lib/agent/memoryAgent';

// PATCH update a memory (edit content, mark important, mark outdated)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, is_important, is_outdated, outdated_reason, confidence, tags, triggered_by } = body;

    const supabase = await createClient();
    const { data: memory, error } = await supabase
      .from('project_memory')
      .update({
        ...(content !== undefined && { content }),
        ...(is_important !== undefined && { is_important }),
        ...(is_outdated !== undefined && { is_outdated }),
        ...(outdated_reason !== undefined && { outdated_reason }),
        ...(confidence !== undefined && { confidence }),
        ...(tags !== undefined && { tags }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    const agent = new MemoryAgent();
    let action: any = 'user_edited';
    if (is_important === true) action = 'marked_important';
    else if (is_outdated === true) action = 'outdated';
    else if (triggered_by === 'agent') action = 'updated';

    await supabase.from('memory_activity').insert({
      website_id: memory.website_id,
      memory_id: id,
      action,
      summary: agent.generateActivitySummary(action, { category: memory.category, content: memory.content }),
      triggered_by: triggered_by || 'user',
    });

    return NextResponse.json({ success: true, memory });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE remove a memory
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: memory } = await supabase
      .from('project_memory')
      .select('website_id, category, content')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('project_memory').delete().eq('id', id);
    if (error) throw error;

    if (memory) {
      const agent = new MemoryAgent();
      await supabase.from('memory_activity').insert({
        website_id: memory.website_id,
        memory_id: null,
        action: 'deleted',
        summary: agent.generateActivitySummary('deleted', { category: memory.category as any, content: memory.content }),
        triggered_by: 'user',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
