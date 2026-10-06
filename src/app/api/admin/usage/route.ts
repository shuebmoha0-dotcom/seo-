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

    // Check platform admin status strictly for shuebmoha0@gmail.com
    if (!isPlatformAdmin(user.email)) {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator privileges required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "all_time";
    
    let startDate: string | null = null;
    if (period === "current_month") {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else if (period === "last_2_weeks") {
      const now = new Date();
      now.setDate(now.getDate() - 14);
      startDate = now.toISOString();
    } else if (period === "last_3_months") {
      const now = new Date();
      now.setMonth(now.getMonth() - 3);
      startDate = now.toISOString();
    }

    // Fetch Admin Usage Controls
    const { data: controlsData } = await supabase
      .from("admin_usage_controls")
      .select("*")
      .eq("id", "global")
      .maybeSingle();

    const controls = controlsData || {
      id: "global",
      monthly_token_budget: 5000000,
      monthly_cost_budget: 50.0,
      alert_threshold_percent: 80,
      token_conservation_mode: true,
      hard_stop_on_limit: false,
      max_tokens_per_run: 15000,
      per_website_token_cap: 1000000,
      updated_at: new Date().toISOString(),
    };

    // Fetch Usage Events via Security Definer RPC (bypasses tenant RLS safely for verified admin)
    const limit = period === "all_time" || period === "last_3_months" ? 10000 : 2000;
    let allEvents: any[] = [];

    const { data: rpcEvents, error: rpcErr } = await authClient.rpc(
      "get_platform_admin_usage_events",
      {
        p_start_date: startDate,
        p_limit: limit,
      }
    );

    if (!rpcErr && Array.isArray(rpcEvents)) {
      allEvents = rpcEvents;
    } else {
      console.warn("[Admin Usage API] RPC notice, using direct query fallback:", rpcErr?.message);
      let query = supabase
        .from("usage_events")
        .select("id, provider, model, api_type, agent_type, input_tokens, output_tokens, total_tokens, estimated_cost, created_at")
        .order("created_at", { ascending: false });
        
      if (startDate) {
        query = query.gte("created_at", startDate);
      }
      query = query.limit(limit);

      const { data: directEvents } = await query;
      allEvents = directEvents || [];
    }

    // If current_month has 0 events, fetch all-time events so the dashboard isn't completely blank
    if (allEvents.length === 0 && period === "current_month") {
      const { data: fallbackEvents } = await authClient.rpc(
        "get_platform_admin_usage_events",
        {
          p_start_date: null,
          p_limit: limit,
        }
      );
      if (Array.isArray(fallbackEvents) && fallbackEvents.length > 0) {
        allEvents = fallbackEvents;
      }
    }

    // Fetch Total Posts Written
    let postsQuery = supabase
      .from('content_drafts')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'failed');
      
    if (startDate) {
      postsQuery = postsQuery.gte('created_at', startDate);
    }
    
    const { count: postsCount } = await postsQuery;

    const totalPostsWritten = postsCount || 0;

    // Aggregations
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalCalls = allEvents.length;
    let totalImages = 0;
    let totalImageCost = 0;
    let totalLlmCost = 0;

    const agentMap = new Map<string, { calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();
    const modelMap = new Map<string, { provider: string; apiType: string; calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();
    const dailyMap = new Map<string, { date: string; calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();

    for (const ev of allEvents) {
      const inTok = Number(ev.input_tokens) || 0;
      const outTok = Number(ev.output_tokens) || 0;
      const totTok = Number(ev.total_tokens) || inTok + outTok;
      const cost = Number(ev.estimated_cost) || 0;
      const agent = ev.agent_type || "Unknown Agent";
      const model = ev.model || "Unknown Model";
      const provider = ev.provider || "openai";
      const apiType = ev.api_type || "llm";
      const date = ev.created_at ? ev.created_at.split("T")[0] : "Recent";

      totalInputTokens += inTok;
      totalOutputTokens += outTok;
      totalTokens += totTok;
      totalCost += cost;

      if (apiType === 'image') {
        totalImages += 1;
        totalImageCost += cost;
      } else {
        totalLlmCost += cost;
      }

      // Group by Agent
      const existingAgent = agentMap.get(agent) || { calls: 0, inTokens: 0, outTokens: 0, totalTokens: 0, cost: 0 };
      existingAgent.calls += 1;
      existingAgent.inTokens += inTok;
      existingAgent.outTokens += outTok;
      existingAgent.totalTokens += totTok;
      existingAgent.cost += cost;
      agentMap.set(agent, existingAgent);

      // Group by Model
      const existingModel = modelMap.get(model) || { provider, apiType, calls: 0, inTokens: 0, outTokens: 0, totalTokens: 0, cost: 0 };
      existingModel.calls += 1;
      existingModel.inTokens += inTok;
      existingModel.outTokens += outTok;
      existingModel.totalTokens += totTok;
      existingModel.cost += cost;
      modelMap.set(model, existingModel);

      // Group by Date
      const existingDate = dailyMap.get(date) || { date, calls: 0, inTokens: 0, outTokens: 0, totalTokens: 0, cost: 0 };
      existingDate.calls += 1;
      existingDate.inTokens += inTok;
      existingDate.outTokens += outTok;
      existingDate.totalTokens += totTok;
      existingDate.cost += cost;
      dailyMap.set(date, existingDate);
    }

    const byAgent = Array.from(agentMap.entries())
      .map(([agent, data]) => ({
        agent,
        calls: data.calls,
        inTokens: data.inTokens,
        outTokens: data.outTokens,
        totalTokens: data.totalTokens,
        cost: Number(data.cost.toFixed(4)),
        tokenShare: totalTokens > 0 ? Number(((data.totalTokens / totalTokens) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    const byModel = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        provider: data.provider,
        apiType: data.apiType,
        calls: data.calls,
        inTokens: data.inTokens,
        outTokens: data.outTokens,
        totalTokens: data.totalTokens,
        cost: Number(data.cost.toFixed(4)),
      }))
      .sort((a, b) => b.cost - a.cost);

    const timeline = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date.replace(/^\d{4}-/, ""),
        fullDate: d.date,
        calls: d.calls,
        inTokens: d.inTokens,
        outTokens: d.outTokens,
        totalTokens: d.totalTokens,
        cost: Number(d.cost.toFixed(4)),
      }));

    const recentEvents = allEvents.slice(0, 50).map((ev: any) => ({
      id: ev.id,
      agent: ev.agent_type || "System",
      model: ev.model,
      provider: ev.provider,
      apiType: ev.api_type || "llm",
      inputTokens: ev.input_tokens || 0,
      outputTokens: ev.output_tokens || 0,
      totalTokens: ev.total_tokens || (ev.input_tokens || 0) + (ev.output_tokens || 0),
      cost: Number((Number(ev.estimated_cost) || 0).toFixed(5)),
      createdAt: ev.created_at,
    }));

    return NextResponse.json({
      summary: {
        totalTokens,
        totalInputTokens,
        totalOutputTokens,
        totalCost: Number(totalCost.toFixed(4)),
        totalCalls,
        totalImages,
        totalImageCost: Number(totalImageCost.toFixed(4)),
        totalLlmCost: Number(totalLlmCost.toFixed(4)),
        activeAgents: agentMap.size,
        modelsUsed: modelMap.size,
        totalPostsWritten,
      },
      controls,
      byAgent,
      byModel,
      timeline,
      recentEvents,
      isAdmin: true,
    });
  } catch (error: any) {
    console.error("[Admin Usage API] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
