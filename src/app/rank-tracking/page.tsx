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
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [growthOpps, setGrowthOpps] = useState<StrikingDistanceItem[]>([]);
  const [rankDrops, setRankDrops] = useState<RankDropItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [executingKeyword, setExecutingKeyword] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});

  // 1. Fetch live rank tracking data & recovery report
  useEffect(() => {
    async function fetchAllData() {
      if (!currentWebsite) {
        setHistoryData([]);
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

  // 2. Trigger on-demand Growth & Recovery Audit scan
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

  // 3. Execute 1-Click Action
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
          [params.keyword]: data.summary || "Deployed successfully! Priority re-crawl requested.",
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
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* ── HEADER ── */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>Autonomous Growth</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Rank Tracking &amp; Recovery</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
              Rankings, Click Accelerator &amp; Drop Recovery
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Autonomous SERP performance monitor & recovery engine for ${currentWebsite.domain}.`
                : "Connect your website to track rankings and recover dropped positions."}
            </p>
          </div>

          {currentWebsite && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunAudit}
                disabled={scanning}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Multi-Agent Scan...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Run Growth &amp; Recovery Audit</span>
                  </>
                )}
              </button>
            </div>
          )}
        </header>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Rank tracking monitors positions, identifies low-hanging fruit to rank faster, and recovers rankings when positions drop.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Website</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── METRIC STAT CARDS ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Striking Distance */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Striking-Distance Queries</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-extrabold text-neutral-900">{growthOpps.length}</div>
                  <div className="text-[11px] text-neutral-500 mt-1 flex items-center gap-1">
                    <span className="text-indigo-600 font-bold">Positions 4–20</span>
                    <span>ready to jump to Top 3</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Click Potential Unlock */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:border-emerald-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Click Growth Potential</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <MousePointerClick className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-extrabold text-emerald-600">
                    +{totalPotentialClicks.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    Est. new monthly clicks on Top 3 jump
                  </div>
                </div>
              </div>

              {/* Card 3: Ranking Drops / At Risk */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:border-amber-200 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Rank Drop Alerts</span>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    rankDrops.length > 0 ? "bg-amber-50 border border-amber-200 text-amber-600" : "bg-neutral-50 border border-neutral-200 text-neutral-400"
                  }`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-extrabold text-neutral-900">{rankDrops.length}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    {rankDrops.length > 0 ? (
                      <span className="text-amber-600 font-bold">Requires recovery action</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">No active rank drops</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Total Tracked Keywords */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:border-neutral-300 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Tracked Search Queries</span>
                  <div className="w-8 h-8 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-extrabold text-neutral-900">{keywords.length}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    Monitored across search engines
                  </div>
                </div>
              </div>
            </div>

            {/* ── NAVIGATION TABS ── */}
            <div className="flex border-b border-neutral-200 gap-6 text-sm font-semibold">
              <button
                onClick={() => setActiveTab("growth")}
                className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === "growth"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <Zap className="w-4 h-4" />
                <span>⚡ Fast-Rank Growth (Positions 4–20)</span>
                {growthOpps.length > 0 && (
                  <span className="bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 font-bold">
                    {growthOpps.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("recovery")}
                className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === "recovery"
                    ? "border-red-600 text-red-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>🚨 Rank Drop Recovery Center</span>
                {rankDrops.length > 0 && (
                  <span className="bg-red-50 text-red-600 text-[10px] px-2 py-0.5 rounded-full border border-red-200 font-bold">
                    {rankDrops.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("all")}
                className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
                  activeTab === "all"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                }`}
              >
                <BarChart2 className="w-4 h-4" />
                <span>📊 Tracked Keywords &amp; Trends</span>
              </button>
            </div>

            {/* ── TAB CONTENT 1: STRIKING-DISTANCE GROWTH (RANK FASTER & GET MORE CLICKS) ── */}
            {activeTab === "growth" && (
              <div className="space-y-4">
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-indigo-900">How Striking-Distance Mining Works:</span>
                    <p className="text-indigo-700 text-[11px] mt-0.5">
                      Keywords ranking in positions 4–20 already have Google trust. Moving from position 8 to position 2 yields up to 8x more clicks with 10% of the effort of starting from scratch.
                    </p>
                  </div>
                </div>

                {growthOpps.length === 0 ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-neutral-900 text-sm">No Striking-Distance Keywords Detected</h4>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      Click &ldquo;Run Growth &amp; Recovery Audit&rdquo; or connect Google Search Console to pull your live keyword impressions and positions.
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
                          className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm hover:shadow transition-all space-y-4"
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Position #{opp.current_position}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Target #{opp.potential_target_position} ({opp.estimated_click_multiplier})
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-neutral-900 mt-2">
                                {opp.keyword}
                              </h3>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                Current: {opp.impressions.toLocaleString()} impressions · {opp.clicks} clicks · {opp.ctr}% CTR
                              </p>
                            </div>

                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-600">
                                +{opp.estimated_monthly_clicks_gain} Clicks/Month
                              </div>
                              <div className="text-[10px] text-neutral-400">Potential gain</div>
                            </div>
                          </div>

                          {/* Prescriptive Optimization Proposal */}
                          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2 text-xs">
                            <div className="font-bold text-neutral-700 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>1-Click Prescriptive Optimization Formula:</span>
                            </div>
                            {opp.prescriptive_actions.title_hook_suggestion && (
                              <div className="text-neutral-600">
                                <span className="font-semibold text-neutral-800">High-CTR Title:</span> &ldquo;{opp.prescriptive_actions.title_hook_suggestion}&rdquo;
                              </div>
                            )}
                            {opp.prescriptive_actions.meta_description_suggestion && (
                              <div className="text-neutral-600">
                                <span className="font-semibold text-neutral-800">Meta Hook:</span> {opp.prescriptive_actions.meta_description_suggestion}
                              </div>
                            )}
                            {opp.prescriptive_actions.recommended_h2_subtopics && (
                              <div className="text-neutral-600">
                                <span className="font-semibold text-neutral-800">New H2 Subtopics:</span> {opp.prescriptive_actions.recommended_h2_subtopics.join(" · ")}
                              </div>
                            )}
                          </div>

                          {/* Execution Action Footer */}
                          {isExecuted ? (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 rounded-xl font-semibold">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>{actionSuccess[opp.keyword]}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                              <span className="text-[11px] text-neutral-500">
                                Updates metadata, injects rich snippet schema, and requests priority Google re-indexing.
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
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
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

            {/* ── TAB CONTENT 2: RANK DROP RECOVERY CENTER ── */}
            {activeTab === "recovery" && (
              <div className="space-y-4">
                <div className="bg-red-50/70 border border-red-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-bold text-red-900">Automated Forensic Diagnosis &amp; Recovery:</span>
                    <p className="text-red-700 text-[11px] mt-0.5">
                      Whenever a rank slips $\ge 3$ positions, our diagnostic engine isolates the root cause (freshness decay, keyword cannibalization, or technical roadblocks) and prepares a prescriptive recovery playbook.
                    </p>
                  </div>
                </div>

                {rankDrops.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-2xl space-y-3">
                    <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h4 className="font-bold text-neutral-900 text-sm">All Monitored Keywords Are Stable</h4>
                    <p className="text-xs text-neutral-500 max-w-md mx-auto">
                      Zero critical position drops detected across {currentWebsite.domain}. The monitoring agent is continuously watching SERP shifts.
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
                          className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4"
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  drop.severity === "critical"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  {drop.severity.toUpperCase()} DROP: #{drop.previous_position} &rarr; #{drop.current_position}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                                  Cause: {drop.primary_root_cause.replace(/_/g, " ")}
                                </span>
                              </div>
                              <h3 className="text-base font-bold text-neutral-900 mt-2">
                                {drop.keyword}
                              </h3>
                              <p className="text-xs text-neutral-500 mt-0.5">
                                Dropped {drop.position_drop} positions · Lost {drop.traffic_loss_pct}% traffic
                              </p>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-red-600">
                                -{drop.position_drop} Positions
                              </span>
                            </div>
                          </div>

                          {/* Forensic Root Cause Explanation */}
                          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2 text-xs">
                            <div className="font-bold text-neutral-800 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Forensic Investigation Findings:</span>
                            </div>
                            <p className="text-neutral-700">{drop.root_cause_explanation}</p>
                            <p className="text-[11px] text-neutral-500 italic">Evidence: {drop.evidence}</p>

                            <div className="pt-2 border-t border-neutral-200/80">
                              <div className="font-bold text-neutral-800 mb-1">Prescriptive Recovery Plan:</div>
                              <div className="space-y-1">
                                {drop.recovery_plan.map((step) => (
                                  <div key={step.step} className="flex items-start gap-1.5 text-neutral-600">
                                    <span className="font-bold text-indigo-600">{step.step}.</span>
                                    <span>
                                      {step.description} <strong className="text-emerald-600">({step.impact})</strong>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Execution Action Footer */}
                          {isExecuted ? (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 rounded-xl font-semibold">
                              <ShieldCheck className="w-4 h-4 text-emerald-600" />
                              <span>{actionSuccess[drop.keyword]}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                              <span className="text-[11px] text-neutral-500">
                                Deploys content refresh, fixes internal linking equity, and triggers priority re-crawl.
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
                                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all inline-flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
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

            {/* ── TAB CONTENT 3: TRACKED KEYWORDS & SERP TRENDS ── */}
            {activeTab === "all" && (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search tracked keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <span className="text-xs text-neutral-500">
                    Showing {filteredKeywords.length} of {keywords.length} keywords
                  </span>
                </div>

                {filteredKeywords.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 border border-neutral-200 rounded-2xl">
                    <p className="text-xs text-neutral-500">No keywords match your search query.</p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Tracked Keyword</th>
                          <th className="py-3 px-4">Search Volume</th>
                          <th className="py-3 px-4">Difficulty</th>
                          <th className="py-3 px-4">Intent</th>
                          <th className="py-3 px-4 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {filteredKeywords.map((kw) => (
                          <tr key={kw.id || kw.term} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-3 px-4 font-bold text-neutral-900">{kw.term}</td>
                            <td className="py-3 px-4 font-mono text-neutral-700">
                              {kw.volume?.toLocaleString() || "N/A"}
                            </td>
                            <td className="py-3 px-4 font-mono text-neutral-700">
                              {kw.difficulty || "Low"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                {kw.intent || "Informational"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/content-planner?keyword=${encodeURIComponent(kw.term)}`}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                              >
                                <span>Draft Article</span>
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
      </div>
    </div>
  );
}
