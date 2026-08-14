import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// PATCH update integration status/config
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, status_message, config, error_code, error_detail, last_success_at, last_synced_at } = body;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('integrations')
      .update({
        ...(status !== undefined && { status }),
        ...(status_message !== undefined && { status_message }),
        ...(config !== undefined && { config }),
        ...(error_code !== undefined && { error_code }),
        ...(error_detail !== undefined && { error_detail }),
        ...(last_success_at !== undefined && { last_success_at }),
        ...(last_synced_at !== undefined && { last_synced_at }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, integration: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE disconnect integration
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Soft disconnect — keep record, clear credentials reference
    const { error } = await supabase
      .from('integrations')
      .update({
        status: 'disconnected',
        has_access_token: false,
        has_refresh_token: false,
        disconnected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;

    // Remove credentials
    await supabase.from('integration_credentials').delete().eq('integration_id', id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
