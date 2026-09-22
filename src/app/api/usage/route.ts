import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Parse query parameters
    const requestedWebsiteId = req.nextUrl.searchParams.get("website_id");
    const period = req.nextUrl.searchParams.get("period") || "current_month";

    // 1. Get user's connected websites (strictly scoped to user.id - Rule 10)
    const { data: websites, error: websitesErr } = await supabase
      .from("websites")
      .select("id, domain, project_id")
      .eq("user_id", user.id);

    if (websitesErr) {
      console.error("[Usage API] Error loading websites:", websitesErr.message);
    }

    const websiteList = websites || [];
    const allWebsiteIds = websiteList.map((w: { id: string }) => w.id);
    const websiteMap = new Map(websiteList.map((w: any) => [w.id, w.domain]));

    // If specific website requested, ensure tenant owns it
    let targetWebsiteIds = allWebsiteIds;
    let selectedWebsiteDomain: string | null = null;

    if (requestedWebsiteId && requestedWebsiteId !== "all") {
      const owned = websiteList.find((w: any) => w.id === requestedWebsiteId);
      if (!owned) {
        return NextResponse.json(
          { error: "Website not found or access denied" },
          { status: 404 }
        );
      }
      targetWebsiteIds = [requestedWebsiteId];
      selectedWebsiteDomain = owned.domain;
    }

    // 2. Fetch drafts count & words for target websites
    let totalDrafts = 0;
    let totalWords = 0;
    const draftsByWebsite = new Map<string, { drafts: number; words: number }>();

    if (targetWebsiteIds.length > 0) {
      const { data: drafts } = await supabase
        .from("content_drafts")
        .select("id, website_id, word_count")
        .in("website_id", targetWebsiteIds);

      totalDrafts = drafts?.length || 0;
      for (const d of drafts || []) {
        const wc = d.word_count || 0;
        totalWords += wc;
        if (d.website_id) {
          const prev = draftsByWebsite.get(d.website_id) || { drafts: 0, words: 0 };
          prev.drafts += 1;
          prev.words += wc;
          draftsByWebsite.set(d.website_id, prev);
        }
      }
    }

    // 3. Fetch custom tenant limit from usage_limits
    const { data: limitRecord } = await supabase
      .from("usage_limits")
      .select("monthly_credit_limit, monthly_api_call_limit")
      .eq("user_id", user.id)
      .maybeSingle();

    const monthlyCreditLimit = Number(limitRecord?.monthly_credit_limit) || 50.0;

    // 4. Query usage_events with date filter
    let query = supabase
      .from("usage_events")
      .select("id, provider, model, api_type, agent_type, input_tokens, output_tokens, total_tokens, estimated_cost, created_at, website_id");

    if (period !== "all_time") {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      query = query.gte("created_at", startOfMonth);
    }

    if (requestedWebsiteId && requestedWebsiteId !== "all") {
      query = query.eq("website_id", requestedWebsiteId);
    } else if (allWebsiteIds.length > 0) {
      query = query.or(`user_id.eq.${user.id},website_id.in.(${allWebsiteIds.join(",")})`);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data: events, error: eventsErr } = await query.order("created_at", { ascending: false });

    if (eventsErr) {
      console.warn("[Usage API] Error loading usage events:", eventsErr.message);
    }

    const eventList = events || [];

    // 5. Aggregate metrics
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalImages = 0;
    let totalImageCost = 0;
    let totalLlmCost = 0;

    // Category aggregations
    const categories = {
      writing: { name: "AI Articles & Content", cost: 0, calls: 0, tokens: 0, words: totalWords, drafts: totalDrafts },
      visuals: { name: "AI Featured Visuals", cost: 0, calls: 0, images: 0 },
      research: { name: "SEO Research & Intelligence", cost: 0, calls: 0, tokens: 0 },
      automation: { name: "Autonomous Workflows & Sync", cost: 0, calls: 0, tokens: 0 },
    };

    const modelMap = new Map<string, { model: string; provider: string; apiType: string; calls: number; cost: number; tokens: number }>();
    const agentMap = new Map<string, { agent: string; calls: number; cost: number; tokens: number }>();
    const siteMap = new Map<string, { websiteId: string; domain: string; cost: number; calls: number; tokens: number; images: number; drafts: number; words: number }>();

    for (const site of websiteList) {
      const siteDraftData = draftsByWebsite.get(site.id) || { drafts: 0, words: 0 };
      siteMap.set(site.id, {
        websiteId: site.id,
        domain: site.domain,
        cost: 0,
        calls: 0,
        tokens: 0,
        images: 0,
        drafts: siteDraftData.drafts,
        words: siteDraftData.words,
      });
    }

    for (const ev of eventList) {
      const inTok = Number(ev.input_tokens) || 0;
      const outTok = Number(ev.output_tokens) || 0;
      const totTok = Number(ev.total_tokens) || inTok + outTok;
      const cost = Number(ev.estimated_cost) || 0;
      const isImg = ev.api_type === "image";
      const agent = ev.agent_type || "System";

      totalCost += cost;
      totalInputTokens += inTok;
      totalOutputTokens += outTok;
      totalTokens += totTok;

      if (isImg) {
        totalImages += 1;
        totalImageCost += cost;
        categories.visuals.cost += cost;
        categories.visuals.calls += 1;
        categories.visuals.images += 1;
      } else {
        totalLlmCost += cost;
        if (agent === "ContentAgent" || ev.model?.includes("sonnet") || ev.model?.includes("claude")) {
          categories.writing.cost += cost;
          categories.writing.calls += 1;
          categories.writing.tokens += totTok;
        } else if (["KeywordAgent", "CompetitorAgent", "MonitoringAgent", "DiagnosticAgent"].includes(agent) || ev.api_type === "crawl") {
          categories.research.cost += cost;
          categories.research.calls += 1;
          categories.research.tokens += totTok;
        } else {
          categories.automation.cost += cost;
          categories.automation.calls += 1;
          categories.automation.tokens += totTok;
        }
      }

      // Per-model aggregation
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

      // Per-agent aggregation
      const aKey = agent;
      const aExisting = agentMap.get(aKey) || { agent: aKey, calls: 0, cost: 0, tokens: 0 };
      aExisting.calls += 1;
      aExisting.cost += cost;
      aExisting.tokens += totTok;
      agentMap.set(aKey, aExisting);

      // Per-website aggregation
      if (ev.website_id && siteMap.has(ev.website_id)) {
        const sRecord = siteMap.get(ev.website_id)!;
        sRecord.cost += cost;
        sRecord.calls += 1;
        sRecord.tokens += totTok;
        if (isImg) sRecord.images += 1;
      }
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
      activeWebsites: targetWebsiteIds.length,
      selectedWebsiteId: requestedWebsiteId || null,
      selectedWebsiteDomain,
      period,
      websites: websiteList.map((w: any) => ({ id: w.id, domain: w.domain })),
      categories: {
        writing: { ...categories.writing, cost: Number(categories.writing.cost.toFixed(4)) },
        visuals: { ...categories.visuals, cost: Number(categories.visuals.cost.toFixed(4)) },
        research: { ...categories.research, cost: Number(categories.research.cost.toFixed(4)) },
        automation: { ...categories.automation, cost: Number(categories.automation.cost.toFixed(4)) },
      },
      byWebsite: Array.from(siteMap.values())
        .map((s) => ({ ...s, cost: Number(s.cost.toFixed(4)) }))
        .sort((a, b) => b.cost - a.cost),
      byModel: Array.from(modelMap.values())
        .map((m) => ({ ...m, cost: Number(m.cost.toFixed(4)) }))
        .sort((a, b) => b.cost - a.cost),
      byAgent: Array.from(agentMap.values())
        .map((a) => ({ ...a, cost: Number(a.cost.toFixed(4)) }))
        .sort((a, b) => b.cost - a.cost),
      recentEvents: eventList.slice(0, 50).map((ev: any) => ({
        id: ev.id,
        websiteId: ev.website_id || null,
        domain: ev.website_id ? (websiteMap.get(ev.website_id) || null) : null,
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
