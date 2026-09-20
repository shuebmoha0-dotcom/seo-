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

    // Get user's websites
    const { data: websites } = await supabase
      .from("websites")
      .select("id, domain")
      .eq("user_id", user.id);

    const websiteIds = (websites || []).map((w: { id: string }) => w.id);

    // Get user's drafts count & words
    let totalDrafts = 0;
    let totalWords = 0;
    if (websiteIds.length > 0) {
      const { data: drafts } = await supabase
        .from("content_drafts")
        .select("id, word_count")
        .in("website_id", websiteIds);

      totalDrafts = drafts?.length || 0;
      totalWords = (drafts || []).reduce((acc: number, d: { word_count?: number | null }) => acc + (d.word_count || 0), 0);
    }

    // Default tenant credits
    const monthlyCreditLimit = 50.0;
    // Estimate tenant spend based on drafts/tasks
    const estimatedCost = Math.min(
      monthlyCreditLimit,
      Number((totalDrafts * 0.45 + (totalWords / 1500) * 0.15).toFixed(2))
    );

    return NextResponse.json({
      creditLimit: monthlyCreditLimit,
      totalCost: estimatedCost,
      remainingCredits: Number((monthlyCreditLimit - estimatedCost).toFixed(2)),
      usedPercent: Math.min(100, Math.round((estimatedCost / monthlyCreditLimit) * 100)),
      totalDrafts,
      totalWords,
      activeWebsites: websiteIds.length,
    });
  } catch (err: any) {
    console.error("[Usage API] Error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
