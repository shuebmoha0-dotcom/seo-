import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH approve/reject/regenerate a specific image asset
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, rejection_reason, regeneration_prompt } = body;

    const supabase = await createClient();

    let newStatus: string;
    if (action === 'approve') newStatus = 'approved';
    else if (action === 'reject') newStatus = 'rejected';
    else if (action === 'regenerate') newStatus = 'needs_regeneration';
    else return NextResponse.json({ error: 'action must be approve | reject | regenerate' }, { status: 400 });

    const { data, error } = await supabase
      .from('image_assets')
      .update({
        status: newStatus,
        rejection_reason: rejection_reason || null,
        regeneration_prompt: regeneration_prompt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update parent plan ready count
    if (action === 'approve' && data.plan_id) {
      const { count } = await supabase
        .from('image_assets')
        .select('*', { count: 'exact' })
        .eq('plan_id', data.plan_id)
        .eq('status', 'approved');

      await supabase
        .from('image_plans')
        .update({ total_images_ready: count || 0, updated_at: new Date().toISOString() })
        .eq('id', data.plan_id);
    }

    return NextResponse.json({ success: true, asset: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
