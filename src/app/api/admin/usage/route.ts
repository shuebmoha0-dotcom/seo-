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

    // Check platform admin status
    let isAdmin = false;
    const userRole = user.user_metadata?.role || (user as any).role;
    if (isPlatformAdmin(user.email, userRole)) {
      isAdmin = true;
    } else {
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

    // Fetch Admin Usage Controls
    const { data: controlsData } = await supabase
      .from("admin_usage_controls")
      .select("*")
      .eq("id", "global")
      .single();

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

    // Fetch Usage Events
    const { data: events, error: eventsError } = await supabase
      .from("usage_events")
      .select("id, provider, model, api_type, agent_type, input_tokens, output_tokens, total_tokens, estimated_cost, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (eventsError) {
      console.error("[Admin Usage API] Error fetching usage events:", eventsError);
      return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 });
    }

    const allEvents = events || [];

    // Aggregations
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let totalCalls = allEvents.length;

    const agentMap = new Map<string, { calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();
    const modelMap = new Map<string, { provider: string; calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();
    const dailyMap = new Map<string, { date: string; calls: number; inTokens: number; outTokens: number; totalTokens: number; cost: number }>();

    for (const ev of allEvents) {
      const inTok = Number(ev.input_tokens) || 0;
      const outTok = Number(ev.output_tokens) || 0;
      const totTok = Number(ev.total_tokens) || inTok + outTok;
      const cost = Number(ev.estimated_cost) || 0;
      const agent = ev.agent_type || "Unknown Agent";
      const model = ev.model || "Unknown Model";
      const provider = ev.provider || "openai";
      const date = ev.created_at ? ev.created_at.split("T")[0] : "Recent";

      totalInputTokens += inTok;
      totalOutputTokens += outTok;
      totalTokens += totTok;
      totalCost += cost;

      // Group by Agent
      const existingAgent = agentMap.get(agent) || { calls: 0, inTokens: 0, outTokens: 0, totalTokens: 0, cost: 0 };
      existingAgent.calls += 1;
      existingAgent.inTokens += inTok;
      existingAgent.outTokens += outTok;
      existingAgent.totalTokens += totTok;
      existingAgent.cost += cost;
      agentMap.set(agent, existingAgent);

      // Group by Model
      const existingModel = modelMap.get(model) || { provider, calls: 0, inTokens: 0, outTokens: 0, totalTokens: 0, cost: 0 };
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
      .sort((a, b) => b.totalTokens - a.totalTokens);

    const byModel = Array.from(modelMap.entries())
      .map(([model, data]) => ({
        model,
        provider: data.provider,
        calls: data.calls,
        inTokens: data.inTokens,
        outTokens: data.outTokens,
        totalTokens: data.totalTokens,
        cost: Number(data.cost.toFixed(4)),
      }))
      .sort((a, b) => b.totalTokens - a.totalTokens);

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

    const recentEvents = allEvents.slice(0, 50).map((ev) => ({
      id: ev.id,
      agent: ev.agent_type || "System",
      model: ev.model,
      provider: ev.provider,
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
        activeAgents: agentMap.size,
        modelsUsed: modelMap.size,
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
