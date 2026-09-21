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
  Target
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
  const { currentWebsite, openAddModal } = useWebsite();
  const [activeTab, setActiveTab] = useState<"growth" | "recovery" | "all">("growth");
  const [keywords, setKeywords] = useState<any[]>([]);
  const [growthOpps, setGrowthOpps] = useState<StrikingDistanceItem[]>([]);
  const [rankDrops, setRankDrops] = useState<RankDropItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [executingKeyword, setExecutingKeyword] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchAllData() {
      if (!currentWebsite) {
        setKeywords([]);
        setGrowthOpps([]);
        setRankDrops([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [kwRes, recRes] = await Promise.all([
          fetch(`/api/keywords?website_id=${currentWebsite.id}`),
          fetch(`/api/rank-tracking/recovery?website_id=${currentWebsite.id}`),
        ]);

        if (kwRes.ok) {
          const kwData = await kwRes.json();
          setKeywords(kwData.raw_keywords || []);
        }

        if (recRes.ok) {
          const recData = await recRes.json();
          if (recData.report) {
            setGrowthOpps(recData.report.striking_distance_opportunities || []);
            setRankDrops(recData.report.detected_rank_drops || []);
          }
        }
      } catch (err) {
        console.error("Failed to load rank data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAllData();
  }, [currentWebsite?.id]);

  const handleRunAudit = async () => {
    if (!currentWebsite || scanning) return;
    setScanning(true);
    try {
      const res = await fetch("/api/rank-tracking/recovery", {
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

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Autonomous Growth</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Rank Tracking &amp; Recovery</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Rankings &amp; Click Accelerator
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Activity className="w-3 h-3 text-indigo-600" />
                Live SERP Radar
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `Autonomous SERP radar identifying striking-distance jumps and recovering dropped rankings for ${currentWebsite.domain}.`
                : "Connect your website to track rankings and recover dropped positions."}
            </p>
          </div>

          {currentWebsite && (
            <button
              onClick={handleRunAudit}
              disabled={scanning}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-2 shadow-xs disabled:opacity-50 self-start md:self-auto active:scale-[0.98]"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning SERP Positions...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Run SERP Recovery Audit</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Connect a Website to Begin</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Rank tracking monitors positions, identifies low-hanging fruit to rank faster, and recovers rankings when positions drop.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Website</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metric KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Striking-Distance Queries
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {growthOpps.length}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    Pos 4–20
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Monthly Click Growth
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
                    +{totalPotentialClicks.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Top 3 Unlock
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Rank Drop Alerts
                </span>
                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-bold font-mono tabular-nums ${
                    rankDrops.length > 0 ? "text-amber-600" : "text-slate-900"
                  }`}>
                    {rankDrops.length}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                    rankDrops.length > 0
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-emerald-700 bg-emerald-50 border-emerald-200"
                  }`}>
                    {rankDrops.length > 0 ? "Attention" : "Stable"}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Tracked Queries
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {keywords.length}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Monitored
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveTab("growth")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === "growth"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Fast-Rank Accelerators (Pos 4–20)</span>
                {growthOpps.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "growth" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}>
                    {growthOpps.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("recovery")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === "recovery"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rank Drop Recovery</span>
                {rankDrops.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "recovery" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
                  }`}>
                    {rankDrops.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("all")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === "all"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Tracked Queries &amp; SERP Trends</span>
              </button>
            </div>

            {/* TAB 1: STRIKING-DISTANCE GROWTH */}
            {activeTab === "growth" && (
              <div className="space-y-4">
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800">
                  <span className="font-bold">Striking-Distance Acceleration Principle:</span>
                  <p className="text-indigo-700 text-[11px] mt-0.5">
                    Keywords ranking between positions 4 and 20 already possess domain authority and index approval. Moving from position 7 to position 2 generates up to an 8x click surge with a fraction of fresh writing effort.
                  </p>
                </div>

                {growthOpps.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="font-semibold text-slate-900 text-sm">No Striking-Distance Queries Identified Yet</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Click &ldquo;Run SERP Recovery Audit&rdquo; to pull fresh performance data from Google Search Console.
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
                          className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-5 shadow-xs transition-all space-y-4"
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono">
                                  Current Pos: #{opp.current_position}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono">
                                  Target: #{opp.potential_target_position} ({opp.estimated_click_multiplier})
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-2">
                                {opp.keyword}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                {opp.impressions.toLocaleString()} impressions · {opp.clicks} clicks · {opp.ctr}% CTR
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-sm font-bold font-mono text-emerald-600">
                                +{opp.estimated_monthly_clicks_gain} Clicks/Mo
                              </div>
                              <div className="text-[10px] text-slate-400 font-medium">Estimated Gain</div>
                            </div>
                          </div>

                          {/* Prescriptive Formula */}
                          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-2 text-xs">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>1-Click Optimization Blueprint:</span>
                            </div>
                            {opp.prescriptive_actions.title_hook_suggestion && (
                              <div className="text-slate-600">
                                <span className="font-semibold text-slate-900">High-CTR Title:</span> &ldquo;{opp.prescriptive_actions.title_hook_suggestion}&rdquo;
                              </div>
                            )}
                            {opp.prescriptive_actions.meta_description_suggestion && (
                              <div className="text-slate-600">
                                <span className="font-semibold text-slate-900">Meta Hook:</span> {opp.prescriptive_actions.meta_description_suggestion}
                              </div>
                            )}
                            {opp.prescriptive_actions.recommended_h2_subtopics && (
                              <div className="text-slate-600">
                                <span className="font-semibold text-slate-900">H2 Additions:</span> {opp.prescriptive_actions.recommended_h2_subtopics.join(" · ")}
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                              <span className="text-[11px] text-slate-500">
                                Updates on-page metadata, injects schema, and triggers priority Google re-indexing.
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
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 active:scale-[0.98]"
                              >
                                {isExecuting ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Deploying Booster...</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-3.5 h-3.5" />
                                    <span>Deploy Fast-Rank Booster</span>
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
                <div className="bg-rose-50/70 border border-rose-100 rounded-xl p-4 text-xs text-rose-800">
                  <span className="font-bold">Automated Forensic Diagnosis:</span>
                  <p className="text-rose-700 text-[11px] mt-0.5">
                    When positions drop $\ge 3$ spots, the diagnostic engine isolates root causes (freshness decay, competitor content updates, internal link cannibalization) and generates recovery plans.
                  </p>
                </div>

                {rankDrops.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-3 shadow-xs">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="font-semibold text-slate-900 text-sm">All Monitored Keywords Are Stable</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
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
                          className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4"
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border font-mono ${
                                  drop.severity === "critical"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {drop.severity.toUpperCase()} DROP: #{drop.previous_position} &rarr; #{drop.current_position}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                                  Cause: {drop.primary_root_cause.replace(/_/g, " ")}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-slate-900 mt-2">
                                {drop.keyword}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                Dropped {drop.position_drop} positions · Lost {drop.traffic_loss_pct}% traffic
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold font-mono text-rose-600">
                                -{drop.position_drop} Positions
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 space-y-2 text-xs">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Forensic Root Cause:</span>
                            </div>
                            <p className="text-slate-700">{drop.root_cause_explanation}</p>
                            <p className="text-[11px] text-slate-500 italic">Evidence: {drop.evidence}</p>

                            <div className="pt-2 border-t border-slate-200/80">
                              <div className="font-semibold text-slate-800 mb-1">Prescriptive Recovery Plan:</div>
                              <div className="space-y-1">
                                {drop.recovery_plan.map((step) => (
                                  <div key={step.step} className="flex items-start gap-1.5 text-slate-600">
                                    <span className="font-bold text-indigo-600 font-mono">{step.step}.</span>
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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100">
                              <span className="text-[11px] text-slate-500">
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
                                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 active:scale-[0.98]"
                              >
                                {isExecuting ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Executing Recovery...</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Execute 1-Click Recovery Plan</span>
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
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter tracked queries..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Showing {filteredKeywords.length} of {keywords.length} keywords
                  </span>
                </div>

                {filteredKeywords.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-slate-200/80 rounded-xl">
                    <p className="text-xs text-slate-500">No keywords match your search query.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Tracked Search Query</th>
                          <th className="py-3 px-4">Search Volume</th>
                          <th className="py-3 px-4">Difficulty</th>
                          <th className="py-3 px-4">Search Intent</th>
                          <th className="py-3 px-4 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredKeywords.map((kw) => (
                          <tr key={kw.id || kw.term} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">{kw.term}</td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {kw.volume ? Number(kw.volume).toLocaleString() : "1,200"}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {kw.difficulty || 25}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                                {kw.intent || "Informational"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/content-planner?keyword=${encodeURIComponent(kw.term)}`}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
                              >
                                <span>Draft in Planner</span>
                                <ArrowRight className="w-3 h-3" />
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
          </div>
        )}
      </main>
    </div>
  );
}
