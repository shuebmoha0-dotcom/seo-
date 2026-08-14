import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { draft_id, action, notes } = await request.json();
    if (!draft_id || !action) {
      return NextResponse.json({ error: 'draft_id and action are required' }, { status: 400 });
    }

    const supabase = await createClient();

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      revise: 'needs_revision',
    };

    const newStatus = statusMap[action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action. Must be: approve | reject | revise' }, { status: 400 });
    }

    const { error } = await supabase
      .from('content_drafts')
      .update({ status: newStatus, revision_notes: notes || null, updated_at: new Date().toISOString() })
      .eq('id', draft_id);

    if (error) throw error;

    return NextResponse.json({ success: true, draft_id, action, new_status: newStatus });
  } catch (error: any) {
    console.error('Content approval error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
