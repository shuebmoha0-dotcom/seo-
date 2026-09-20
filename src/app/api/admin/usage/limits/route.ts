import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const userRole = user.user_metadata?.role || (user as any).role;
    let isAdmin = isPlatformAdmin(user.email, userRole);
    if (!isAdmin) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (isPlatformAdmin(user.email, dbUser?.role || userRole)) {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator privileges required" },
        { status: 403 }
      );
    }

    const { data: controls, error } = await supabase
      .from("admin_usage_controls")
      .select("*")
      .eq("id", "global")
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("[Admin Limits API] Error reading limits:", error);
      return NextResponse.json({ error: "Failed to read controls" }, { status: 500 });
    }

    return NextResponse.json({
      controls: controls || {
        id: "global",
        monthly_token_budget: 5000000,
        monthly_cost_budget: 50.0,
        alert_threshold_percent: 80,
        token_conservation_mode: true,
        hard_stop_on_limit: false,
        max_tokens_per_run: 15000,
        per_website_token_cap: 1000000,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const userRole = user.user_metadata?.role || (user as any).role;
    let isAdmin = isPlatformAdmin(user.email, userRole);
    if (!isAdmin) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (isPlatformAdmin(user.email, dbUser?.role || userRole)) {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator privileges required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      monthly_token_budget,
      monthly_cost_budget,
      alert_threshold_percent,
      token_conservation_mode,
      hard_stop_on_limit,
      max_tokens_per_run,
      per_website_token_cap,
    } = body;

    const payload: any = {
      id: "global",
      updated_at: new Date().toISOString(),
      updated_by: user.email || "admin",
    };

    if (monthly_token_budget !== undefined) payload.monthly_token_budget = Number(monthly_token_budget);
    if (monthly_cost_budget !== undefined) payload.monthly_cost_budget = Number(monthly_cost_budget);
    if (alert_threshold_percent !== undefined) payload.alert_threshold_percent = Number(alert_threshold_percent);
    if (token_conservation_mode !== undefined) payload.token_conservation_mode = Boolean(token_conservation_mode);
    if (hard_stop_on_limit !== undefined) payload.hard_stop_on_limit = Boolean(hard_stop_on_limit);
    if (max_tokens_per_run !== undefined) payload.max_tokens_per_run = Number(max_tokens_per_run);
    if (per_website_token_cap !== undefined) payload.per_website_token_cap = Number(per_website_token_cap);

    const { data: updated, error: upsertError } = await supabase
      .from("admin_usage_controls")
      .upsert(payload)
      .select()
      .single();

    if (upsertError) {
      console.error("[Admin Limits API] Error updating controls:", upsertError);
      return NextResponse.json({ error: "Failed to update controls" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Token usage controls updated successfully",
      controls: updated,
    });
  } catch (err: any) {
    console.error("[Admin Limits API] Unexpected error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
