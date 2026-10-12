"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Search,
  Globe,
  Plus,
  BarChart2,
  Sparkles,
  Zap,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Loader2,
  Layers,
  FileText,
  MousePointerClick,
  Activity,
  ArrowRight,
  Target,
  Check
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

interface StrikingDistanceItem {
  keyword: string;
  current_position: number;
  impressions: number;
  clicks: number;
  ctr: number;
  page_url: string;
  potential_target_position: number;
  estimated_click_multiplier: string;
  estimated_monthly_clicks_gain: number;
  root_opportunity: string;
  headline: string;
  prescriptive_actions: {
    title_hook_suggestion?: string;
    meta_description_suggestion?: string;
    recommended_h2_subtopics?: string[];
    schema_type?: string;
  };
}

interface RankDropItem {
  keyword: string;
  page_url: string;
  previous_position: number;
  current_position: number;
  position_drop: number;
  traffic_loss_pct: number;
  severity: "critical" | "high" | "medium";
  primary_root_cause: string;
  root_cause_explanation: string;
  evidence: string;
  recovery_plan: Array<{
    step: number;
    action_type: string;
    description: string;
    impact: string;
  }>;
}

export default function RankTrackingPage() {
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();
  const [activeTab, setActiveTab] = useState<"growth" | "recovery" | "all">("growth");
  const [keywords, setKeywords] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_keywords_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });
  const [growthOpps, setGrowthOpps] = useState<StrikingDistanceItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_growth_opps_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });
  const [rankDrops, setRankDrops] = useState<RankDropItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_rank_drops_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_keywords_${storedSiteId}`);
          if (cached) return false;
        }
      } catch {}
    }
    return true;
  });
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [executingKeyword, setExecutingKeyword] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchData() {
      if (!currentWebsite?.id) {
        setKeywords([]);
        setGrowthOpps([]);
        setRankDrops([]);
        setLoading(false);
        return;
      }
      try {
        const cachedKws = sessionStorage.getItem(`seo_cached_keywords_${currentWebsite.id}`);
        const cachedGrowth = sessionStorage.getItem(`seo_cached_growth_opps_${currentWebsite.id}`);
        const cachedDrops = sessionStorage.getItem(`seo_cached_rank_drops_${currentWebsite.id}`);

        if (cachedKws && cachedGrowth && cachedDrops) {
          setKeywords(JSON.parse(cachedKws));
          setGrowthOpps(JSON.parse(cachedGrowth));
          setRankDrops(JSON.parse(cachedDrops));
          setLoading(false);
        } else {
          setLoading(true);
        }

        const res = await fetch(`/api/rank-tracking?website_id=${currentWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          const kws = data.keywords || [];
          const growth = data.striking_distance || [];
          const drops = data.rank_drops || [];

          setKeywords(kws);
          setGrowthOpps(growth);
          setRankDrops(drops);

          if (typeof window !== "undefined") {
            sessionStorage.setItem(`seo_cached_keywords_${currentWebsite.id}`, JSON.stringify(kws));
            sessionStorage.setItem(`seo_cached_growth_opps_${currentWebsite.id}`, JSON.stringify(growth));
            sessionStorage.setItem(`seo_cached_rank_drops_${currentWebsite.id}`, JSON.stringify(drops));
          }
        }
      } catch (err) {
        console.error("Error fetching rank data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentWebsite?.id]);

  const handleRunAudit = async () => {
    if (!currentWebsite) return;
    setScanning(true);
    try {
      const res = await fetch("/api/rank-tracking/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: currentWebsite.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setGrowthOpps(data.report.striking_distance_opportunities || []);
          setRankDrops(data.report.detected_rank_drops || []);
        }
      }
    } catch (err) {
      console.error("Audit error:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleExecuteAction = async (params: {
    keyword: string;
    actionType: string;
    proposedTitle?: string;
    proposedMeta?: string;
    targetUrl?: string;
  }) => {
    if (!currentWebsite) return;
    setExecutingKeyword(params.keyword);
    try {
      const res = await fetch("/api/rank-tracking/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          action_type: params.actionType,
          target_keyword: params.keyword,
          proposed_title: params.proposedTitle,
          proposed_meta: params.proposedMeta,
          target_url: params.targetUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccess((prev) => ({
          ...prev,
          [params.keyword]: data.summary || "Booster deployed! Priority re-crawl requested.",
        }));
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setExecutingKeyword(null);
    }
  };

  const filteredKeywords = keywords.filter((kw) =>
    (kw.term || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPotentialClicks = growthOpps.reduce((acc, curr) => acc + (curr.estimated_monthly_clicks_gain || 0), 0);

  const statCells = [
    {
      label: "Striking-distance queries",
      value: growthOpps.length.toLocaleString(),
      caption: "Positions 4–20 ready to jump",
    },
    {
      label: "Monthly click growth",
      value: `+${totalPotentialClicks.toLocaleString()}`,
      caption: "Estimated unlock to Top 3",
    },
    {
      label: "Rank drop alerts",
      value: rankDrops.length.toLocaleString(),
      caption: rankDrops.length > 0 ? "Requires forensic attention" : "All positions stable",
    },
    {
      label: "Tracked queries",
      value: keywords.length.toLocaleString(),
      caption: "Monitored search keywords",
    },
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Research</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Rank Tracking</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Rank Tracking &amp; Recovery
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Autonomous SERP radar identifying striking-distance jumps and recovering dropped positions for ${currentWebsite.domain}`
                  : "Connect a website to track rankings and recover dropped positions."}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <button
                  onClick={handleRunAudit}
                  disabled={scanning}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{scanning ? "Scanning SERP…" : "Run recovery audit"}</span>
                </button>
              )}
            </div>
          </header>

          {/* ── STATE 1: LOADING SKELETON OR NO WEBSITE CONNECTED ── */}
          {websiteLoading && !currentWebsite ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-24 bg-white border border-neutral-200 rounded-xl" />
              <div className="h-96 bg-white border border-neutral-200 rounded-xl" />
            </div>
          ) : !currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect a website to begin</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Rank tracking monitors positions, identifies low-hanging fruit to rank faster, and recovers rankings when positions drop.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : (
            <>
              {/* Stat strip */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                {statCells.map((cell, i) => (
                  <div
                    key={cell.label}
                    className={`p-5 ${i % 2 === 1 ? "border-l border-neutral-200" : ""} ${i > 1 ? "border-t border-neutral-200 lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-neutral-200" : ""}`}
                  >
                    <div className="text-[13px] text-neutral-500">{cell.label}</div>
                    <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{cell.value}</div>
                    <div className="mt-1.5 text-xs text-neutral-500">{cell.caption}</div>
                  </div>
                ))}
              </section>

              {/* Segmented Control Tabs */}
              <div className="flex items-center overflow-hidden rounded-md border border-neutral-300 bg-white shadow-2xs self-start">
                {[
                  { id: "growth", label: `Fast-Rank Accelerators (${growthOpps.length})` },
                  { id: "recovery", label: `Rank Drop Recovery (${rankDrops.length})` },
                  { id: "all", label: `Tracked Queries (${keywords.length})` },
                ].map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      i > 0 ? "border-l border-neutral-300" : ""
                    } ${
                      activeTab === tab.id
                        ? "bg-[#e8f0fe] text-[#1967d2] font-semibold"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {activeTab === tab.id && <Check className="h-3 w-3 text-[#1967d2] stroke-[3]" />}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* TAB 1: STRIKING-DISTANCE GROWTH */}
              {activeTab === "growth" && (
                <div className="space-y-4">
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-900 shadow-2xs">
                    <span className="font-semibold text-indigo-950">Striking-Distance Acceleration Principle:</span>
                    <p className="text-indigo-700 text-xs mt-1 leading-relaxed">
                      Keywords ranking between positions 4 and 20 already possess domain authority and index approval. Moving from position 7 to position 2 generates up to an 8x click surge with a fraction of fresh writing effort.
                    </p>
                  </div>

                  {growthOpps.length === 0 ? (
                    <div className="p-10 text-center bg-white border border-neutral-200 rounded-xl space-y-3 shadow-2xs">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <h4 className="font-semibold text-neutral-900 text-sm">No Striking-Distance Queries Identified Yet</h4>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        Click &ldquo;Run recovery audit&rdquo; to pull fresh performance data from Google Search Console.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {growthOpps.map((opp) => {
                        const isExecuted = !!actionSuccess[opp.keyword];
                        const isExecuting = executingKeyword === opp.keyword;

                        return (
                          <div
                            key={opp.keyword}
                            className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl p-5 shadow-2xs transition-colors space-y-4"
                          >
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Current Pos: #{opp.current_position}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    Target: #{opp.potential_target_position} ({opp.estimated_click_multiplier})
                                  </span>
                                </div>
                                <h3 className="text-base font-semibold text-neutral-900 mt-2">
                                  {opp.keyword}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  {opp.impressions.toLocaleString()} impressions · {opp.clicks} clicks · {opp.ctr}% CTR
                                </p>
                              </div>

                              <div className="text-right">
                                <div className="text-base font-semibold text-emerald-600">
                                  +{opp.estimated_monthly_clicks_gain} Clicks/Mo
                                </div>
                                <div className="text-[11px] text-neutral-500">Estimated Gain</div>
                              </div>
                            </div>

                            {/* Prescriptive Formula */}
                            <div className="bg-neutral-50/70 border border-neutral-200 rounded-lg p-3.5 space-y-2 text-xs">
                              <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Optimization Blueprint:</span>
                              </div>
                              {opp.prescriptive_actions.title_hook_suggestion && (
                                <div className="text-neutral-600">
                                  <span className="font-semibold text-neutral-900">High-CTR Title:</span> &ldquo;{opp.prescriptive_actions.title_hook_suggestion}&rdquo;
                                </div>
                              )}
                              {opp.prescriptive_actions.meta_description_suggestion && (
                                <div className="text-neutral-600">
                                  <span className="font-semibold text-neutral-900">Meta Hook:</span> {opp.prescriptive_actions.meta_description_suggestion}
                                </div>
                              )}
                              {opp.prescriptive_actions.recommended_h2_subtopics && (
                                <div className="text-neutral-600">
                                  <span className="font-semibold text-neutral-900">H2 Additions:</span> {opp.prescriptive_actions.recommended_h2_subtopics.join(" · ")}
                                </div>
                              )}
                            </div>

                            {/* Footer Action */}
                            {isExecuted ? (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2 rounded-lg font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>{actionSuccess[opp.keyword]}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                                <span className="text-xs text-neutral-500">
                                  Updates metadata, injects schema, and triggers priority Google re-indexing.
                                </span>
                                <button
                                  onClick={() =>
                                    handleExecuteAction({
                                      keyword: opp.keyword,
                                      actionType: "growth_acceleration",
                                      proposedTitle: opp.prescriptive_actions.title_hook_suggestion,
                                      proposedMeta: opp.prescriptive_actions.meta_description_suggestion,
                                      targetUrl: opp.page_url,
                                    })
                                  }
                                  disabled={isExecuting}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                                >
                                  {isExecuting ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Deploying Booster…</span>
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-3.5 h-3.5" />
                                      <span>Deploy Booster</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RANK DROP RECOVERY */}
              {activeTab === "recovery" && (
                <div className="space-y-4">
                  <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 shadow-2xs">
                    <span className="font-semibold text-rose-950">Automated Forensic Diagnosis:</span>
                    <p className="text-rose-700 text-xs mt-1 leading-relaxed">
                      When positions drop by 3 or more spots, the diagnostic engine isolates root causes (freshness decay, competitor updates, internal link cannibalization) and generates recovery plans.
                    </p>
                  </div>

                  {rankDrops.length === 0 ? (
                    <div className="p-10 text-center bg-white border border-neutral-200 rounded-xl space-y-3 shadow-2xs">
                      <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                      <h4 className="font-semibold text-neutral-900 text-sm">All Monitored Keywords Are Stable</h4>
                      <p className="text-xs text-neutral-500 max-w-md mx-auto">
                        Zero critical position drops detected across {currentWebsite.domain}. The monitoring engine is actively watching SERP shifts.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {rankDrops.map((drop) => {
                        const isExecuted = !!actionSuccess[drop.keyword];
                        const isExecuting = executingKeyword === drop.keyword;

                        return (
                          <div
                            key={drop.keyword}
                            className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4"
                          >
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                    drop.severity === "critical"
                                      ? "bg-rose-50 text-rose-700 border-rose-200"
                                      : "bg-amber-50 text-amber-700 border-amber-200"
                                  }`}>
                                    {drop.severity.toUpperCase()} DROP: #{drop.previous_position} &rarr; #{drop.current_position}
                                  </span>
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                                    Cause: {drop.primary_root_cause.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <h3 className="text-base font-semibold text-neutral-900 mt-2">
                                  {drop.keyword}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  Dropped {drop.position_drop} positions · Lost {drop.traffic_loss_pct}% traffic
                                </p>
                              </div>

                              <div className="text-right">
                                <span className="text-sm font-semibold text-rose-600">
                                  -{drop.position_drop} Positions
                                </span>
                              </div>
                            </div>

                            <div className="bg-neutral-50/70 border border-neutral-200 rounded-lg p-3.5 space-y-2 text-xs">
                              <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Forensic Root Cause:</span>
                              </div>
                              <p className="text-neutral-700 leading-relaxed">{drop.root_cause_explanation}</p>
                              <p className="text-[11px] text-neutral-500 italic">Evidence: {drop.evidence}</p>

                              <div className="pt-2 border-t border-neutral-200">
                                <div className="font-semibold text-neutral-800 mb-1">Prescriptive Recovery Plan:</div>
                                <div className="space-y-1">
                                  {drop.recovery_plan.map((step) => (
                                    <div key={step.step} className="flex items-start gap-1.5 text-neutral-600">
                                      <span className="font-semibold text-indigo-600">{step.step}.</span>
                                      <span>
                                        {step.description} <strong className="text-emerald-700 font-medium">({step.impact})</strong>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {isExecuted ? (
                              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2 rounded-lg font-medium">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>{actionSuccess[drop.keyword]}</span>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-neutral-100">
                                <span className="text-xs text-neutral-500">
                                  Applies content freshness injection, fixes internal links, and triggers Google index refresh.
                                </span>
                                <button
                                  onClick={() =>
                                    handleExecuteAction({
                                      keyword: drop.keyword,
                                      actionType: "rank_recovery",
                                      targetUrl: drop.page_url,
                                    })
                                  }
                                  disabled={isExecuting}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-rose-700 disabled:pointer-events-none disabled:opacity-60"
                                >
                                  {isExecuting ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Executing Recovery…</span>
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Execute Recovery Plan</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ALL KEYWORDS & SERP TRENDS */}
              {activeTab === "all" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Filter tracked queries…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-neutral-300 rounded-md text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-indigo-500 shadow-2xs font-sans"
                      />
                    </div>
                    <span className="text-xs text-neutral-500">
                      Showing {filteredKeywords.length} of {keywords.length} keywords
                    </span>
                  </div>

                  {filteredKeywords.length === 0 ? (
                    <div className="p-8 text-center bg-white border border-neutral-200 rounded-xl text-xs text-neutral-500 shadow-2xs">
                      No keywords match your search query.
                    </div>
                  ) : (
                    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            <th className="py-2.5 px-5">Tracked Search Query</th>
                            <th className="py-2.5 px-4">Search Volume</th>
                            <th className="py-2.5 px-4">Difficulty</th>
                            <th className="py-2.5 px-4">Search Intent</th>
                            <th className="py-2.5 px-5 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {filteredKeywords.map((kw) => (
                            <tr key={kw.id || kw.term} className="hover:bg-neutral-50/80 transition-colors">
                              <td className="py-3 px-5 font-semibold text-neutral-900">{kw.term}</td>
                              <td className="py-3 px-4 tabular-nums text-neutral-700">
                                {kw.volume ? Number(kw.volume).toLocaleString() : "—"}
                              </td>
                              <td className="py-3 px-4 tabular-nums text-neutral-700">
                                {kw.difficulty ?? "—"}
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                                  {kw.intent || "Informational"}
                                </span>
                              </td>
                              <td className="py-3 px-5 text-right">
                                <Link
                                  href={`/content-planner?keyword=${encodeURIComponent(kw.term)}`}
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                                >
                                  <span>Draft in Planner</span>
                                  <ArrowRight className="w-3 h-3 text-neutral-400" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
