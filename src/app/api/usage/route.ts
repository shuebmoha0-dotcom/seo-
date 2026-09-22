import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 1. Get user's websites
    const { data: websites } = await adminSupabase
      .from("websites")
      .select("id, domain, project_id")
      .eq("user_id", user.id);

    const websiteList = websites || [];
    const websiteIds = websiteList.map((w: { id: string }) => w.id);
    const projectIds = Array.from(
      new Set(websiteList.map((w: any) => w.project_id).filter(Boolean))
    ) as string[];

    // 2. Get user's projects
    const { data: userProjects } = await adminSupabase
      .from("projects")
      .select("id")
      .eq("user_id", user.id);

    (userProjects || []).forEach((p: any) => {
      if (p.id && !projectIds.includes(p.id)) projectIds.push(p.id);
    });

    // 3. Get user's drafts count & words
    let totalDrafts = 0;
    let totalWords = 0;
    if (websiteIds.length > 0) {
      const { data: drafts } = await adminSupabase
        .from("content_drafts")
        .select("id, word_count")
        .in("website_id", websiteIds);

      totalDrafts = drafts?.length || 0;
      totalWords = (drafts || []).reduce(
        (acc: number, d: { word_count?: number | null }) => acc + (d.word_count || 0),
        0
      );
    }

    // 4. Fetch custom tenant limit from usage_limits (if configured)
    const { data: limitRecord } = await adminSupabase
      .from("usage_limits")
      .select("monthly_credit_limit, monthly_api_call_limit")
      .eq("user_id", user.id)
      .maybeSingle();

    const monthlyCreditLimit = Number(limitRecord?.monthly_credit_limit) || 50.0;

    // 5. Query REAL usage_events for this user/tenant for the current month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    let query = adminSupabase
      .from("usage_events")
      .select("id, provider, model, api_type, agent_type, input_tokens, output_tokens, total_tokens, estimated_cost, created_at")
      .gte("created_at", startOfMonth);

    if (projectIds.length > 0) {
      query = query.or(`user_id.eq.${user.id},project_id.in.(${projectIds.join(",")})`);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data: events, error: eventsErr } = await query.order("created_at", { ascending: false });

    if (eventsErr) {
      console.warn("[Usage API] Error loading usage events:", eventsErr.message);
    }

    const eventList = events || [];

    // Empirical metrics
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalImages = 0;
    let totalImageCost = 0;
    let totalLlmCost = 0;

    const modelMap = new Map<string, { model: string; provider: string; apiType: string; calls: number; cost: number; tokens: number }>();
    const agentMap = new Map<string, { agent: string; calls: number; cost: number; tokens: number }>();

    for (const ev of eventList) {
      const inTok = Number(ev.input_tokens) || 0;
      const outTok = Number(ev.output_tokens) || 0;
      const totTok = Number(ev.total_tokens) || inTok + outTok;
      const cost = Number(ev.estimated_cost) || 0;
      const isImg = ev.api_type === "image";

      totalCost += cost;
      totalInputTokens += inTok;
      totalOutputTokens += outTok;
      totalTokens += totTok;

      if (isImg) {
        totalImages += 1;
        totalImageCost += cost;
      } else {
        totalLlmCost += cost;
      }

      const mKey = ev.model || "Unknown";
      const mExisting = modelMap.get(mKey) || {
        model: mKey,
        provider: ev.provider || "openai",
        apiType: ev.api_type || "llm",
        calls: 0,
        cost: 0,
        tokens: 0,
      };
      mExisting.calls += 1;
      mExisting.cost += cost;
      mExisting.tokens += totTok;
      modelMap.set(mKey, mExisting);

      const aKey = ev.agent_type || "System";
      const aExisting = agentMap.get(aKey) || { agent: aKey, calls: 0, cost: 0, tokens: 0 };
      aExisting.calls += 1;
      aExisting.cost += cost;
      aExisting.tokens += totTok;
      agentMap.set(aKey, aExisting);
    }

    const roundedCost = Number(totalCost.toFixed(4));
    const remainingCredits = Math.max(0, Number((monthlyCreditLimit - totalCost).toFixed(2)));
    const usedPercent = Math.min(100, Math.round((totalCost / monthlyCreditLimit) * 100));

    return NextResponse.json({
      creditLimit: monthlyCreditLimit,
      totalCost: roundedCost,
      remainingCredits,
      usedPercent,
      totalTokens,
      totalInputTokens,
      totalOutputTokens,
      totalCalls: eventList.length,
      totalImages,
      totalImageCost: Number(totalImageCost.toFixed(4)),
      totalLlmCost: Number(totalLlmCost.toFixed(4)),
      totalDrafts,
      totalWords,
      activeWebsites: websiteIds.length,
      byModel: Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost),
      byAgent: Array.from(agentMap.values()).sort((a, b) => b.cost - a.cost),
      recentEvents: eventList.slice(0, 25).map((ev: any) => ({
        id: ev.id,
        agent: ev.agent_type || "System",
        model: ev.model,
        provider: ev.provider,
        apiType: ev.api_type || "llm",
        totalTokens: ev.total_tokens || (ev.input_tokens || 0) + (ev.output_tokens || 0),
        cost: Number((Number(ev.estimated_cost) || 0).toFixed(5)),
        createdAt: ev.created_at,
      })),
    });
  } catch (err: any) {
    console.error("[Usage API] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
