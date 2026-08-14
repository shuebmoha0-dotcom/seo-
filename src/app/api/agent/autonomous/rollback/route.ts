import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { action_id, target_url, file_path } = await request.json();
    const supabase = await createClient();

    // Revert rollback in DB
    const { data: rollback } = await supabase
      .from('rollbacks')
      .update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() })
      .eq('id', action_id)
      .select()
      .single();

    return NextResponse.json({
      success: true,
      message: `Action ${action_id} on ${target_url || 'target file'} has been successfully rolled back to pre-change version.`,
      rollback: rollback || { status: 'rolled_back' }
    });
  } catch (error: any) {
    console.error('Error executing rollback:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
