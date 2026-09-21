"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Sparkles, ArrowUpRight, Target, FileText,
  Loader2, Globe, Plus, PenTool, Hash, TrendingUp,
  Layers, CheckCircle2, ChevronRight, BarChart2, Filter,
  Copy, Check, ArrowRight, ShieldCheck, Flame, ExternalLink
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

const intentColors: Record<string, { bg: string; text: string; border: string }> = {
  informational: { bg: "bg-blue-50/80", text: "text-blue-700", border: "border-blue-200" },
  commercial_investigation: { bg: "bg-purple-50/80", text: "text-purple-700", border: "border-purple-200" },
  transactional: { bg: "bg-emerald-50/80", text: "text-emerald-700", border: "border-emerald-200" },
  comparison: { bg: "bg-indigo-50/80", text: "text-indigo-700", border: "border-indigo-200" },
  problem_solution: { bg: "bg-amber-50/80", text: "text-amber-700", border: "border-amber-200" },
};

function getDifficultyBadge(kd: number | string | undefined) {
  const num = typeof kd === "number" ? kd : typeof kd === "string" ? parseInt(kd, 10) : 25;
  const val = isNaN(num) ? 25 : num;
  if (val < 30) {
    return { label: "Easy", color: "text-emerald-700 bg-emerald-50 border-emerald-200", bar: "bg-emerald-500", val };
  } else if (val < 60) {
    return { label: "Medium", color: "text-amber-700 bg-amber-50 border-amber-200", bar: "bg-amber-500", val };
  } else {
    return { label: "Hard", color: "text-rose-700 bg-rose-50 border-rose-200", bar: "bg-rose-500", val };
  }
}

export default function KeywordsPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState<"clusters" | "all_keywords">("clusters");
  const [siteMode, setSiteMode] = useState<"new" | "established">("new");
  const [seedTopic, setSeedTopic] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<string>("all");
  const [copiedKw, setCopiedKw] = useState<string | null>(null);

  const [clusters, setClusters] = useState<any[]>([]);
  const [rawKeywords, setRawKeywords] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [briefModalOpportunity, setBriefModalOpportunity] = useState<any>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [brief, setBrief] = useState<any>(null);

  const fetchKeywordData = async () => {
    if (!currentWebsite) {
      setClusters([]);
      setRawKeywords([]);
      setOpportunities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/keywords?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setClusters(data.clusters || []);
        setRawKeywords(data.raw_keywords || []);
        setOpportunities(data.opportunities || []);
      }
    } catch (err) {
      console.error("Error fetching keywords:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeywordData();
  }, [currentWebsite?.id]);

  const handleDiscover = async (seedOverride?: string) => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    const effectiveSeed = (seedOverride !== undefined ? seedOverride : seedTopic).trim();
    if (seedOverride !== undefined) {
      setSeedTopic(seedOverride);
    }

    setDiscovering(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          seed_topic: effectiveSeed || undefined,
          mode: siteMode,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.clusters && data.clusters.length > 0) {
          setClusters(data.clusters);
        }
        if (data.opportunities && data.opportunities.length > 0) {
          setOpportunities(data.opportunities);
        }
        await fetchKeywordData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDiscovering(false);
    }
  };

  const handleGenerateBrief = async (kw: any) => {
    setBriefModalOpportunity(kw);
    setGeneratingBrief(true);
    setBrief(null);
    try {
      const res = await fetch("/api/agent/keywords/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opportunity: {
            keyword: kw.term || kw.keyword || kw.primary_keyword,
            search_intent: kw.intent || kw.search_intent || "informational",
            content_type: kw.recommended_content_type || kw.content_type || "blog_article",
            business_relevance: kw.relevance || kw.business_relevance || 90,
            evidence: kw.evidence || `Discovered search opportunity for ${currentWebsite?.domain || "target website"}.`,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBrief(data.brief);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingBrief(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKw(text);
    setTimeout(() => setCopiedKw(null), 2000);
  };

  // Filtered raw keywords
  const filteredKeywords = useMemo(() => {
    return rawKeywords.filter((kw) => {
      const termMatch = !filterQuery || kw.term?.toLowerCase().includes(filterQuery.toLowerCase());
      const intentMatch = selectedIntent === "all" || (kw.intent || "informational").toLowerCase() === selectedIntent.toLowerCase();
      return termMatch && intentMatch;
    });
  }, [rawKeywords, filterQuery, selectedIntent]);

  // Filtered clusters
  const filteredClusters = useMemo(() => {
    return clusters.filter((cl) => {
      const name = (cl.cluster_name || cl.name || cl.topic || "").toLowerCase();
      const pillar = (cl.primary_keyword || "").toLowerCase();
      const matchText = !filterQuery || name.includes(filterQuery.toLowerCase()) || pillar.includes(filterQuery.toLowerCase());
      const intentMatch = selectedIntent === "all" || (cl.search_intent || cl.intent || "informational").toLowerCase() === selectedIntent.toLowerCase();
      return matchText && intentMatch;
    });
  }, [clusters, filterQuery, selectedIntent]);

  // Metrics summary
  const avgDifficulty = useMemo(() => {
    if (!rawKeywords.length) return 24;
    const sum = rawKeywords.reduce((acc, k) => acc + (typeof k.difficulty === "number" ? k.difficulty : 25), 0);
    return Math.round(sum / rawKeywords.length);
  }, [rawKeywords]);

  const totalVolume = useMemo(() => {
    return rawKeywords.reduce((acc, k) => acc + (typeof k.volume === "number" ? k.volume : 0), 0);
  }, [rawKeywords]);

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Breadcrumb & Status Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Autonomous SEO</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Keyword Research &amp; Clustering</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Keyword Explorer
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                Topical Authority Engine
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `Mapped high-intent search queries and pillar clusters tailored for ${currentWebsite.domain}.`
                : "Connect your website to generate keyword clusters and content briefs."}
            </p>
          </div>

          {/* Seed Input & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={seedTopic}
                onChange={(e) => setSeedTopic(e.target.value)}
                placeholder="Seed topic or niche keyword..."
                className="bg-white border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-lg pl-8 pr-3 py-2 w-60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
              />
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-xs font-medium">
              <button
                onClick={() => setSiteMode("new")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  siteMode === "new"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Low KD Focus
              </button>
              <button
                onClick={() => setSiteMode("established")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  siteMode === "established"
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Authority Scale
              </button>
            </div>

            <button
              onClick={() => handleDiscover()}
              disabled={discovering || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-xs active:scale-[0.98]"
            >
              {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{discovering ? "Clustering..." : "Discover Clusters"}</span>
            </button>
          </div>
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
                The Keyword Agent uses your domain, Google Search Console performance data, and competitive authority to identify actionable rank opportunities.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Website</span>
            </button>
          </div>
        ) : (
          <>
            {/* KPI Metric Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Discovered Keywords
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {rawKeywords.length}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    Live Synced
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Topical Clusters
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {clusters.length}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    Pillars Ready
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Avg Keyword Difficulty
                </span>
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                      {avgDifficulty}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">/100</span>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${
                    avgDifficulty < 35 ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-amber-700 bg-amber-50 border-amber-200"
                  }`}>
                    {avgDifficulty < 35 ? "Low Barrier" : "Moderate"}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Total Monthly Search Demand
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {totalVolume > 0 ? totalVolume.toLocaleString() : "Tracking..."}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Impressions
                  </span>
                </div>
              </div>
            </div>

            {/* Filter & View Navigation Bar */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Tab Navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveTab("clusters")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "clusters"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Topical Clusters</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "clusters" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}>
                    {clusters.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("all_keywords")}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "all_keywords"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Hash className="w-3.5 h-3.5" />
                  <span>Keyword Directory</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    activeTab === "all_keywords" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                  }`}>
                    {rawKeywords.length}
                  </span>
                </button>
              </div>

              {/* In-view Search & Intent Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search keywords..."
                    className="bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-lg pl-7 pr-2.5 py-1.5 w-44 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Intent Dropdown Filter */}
                <div className="flex items-center gap-1">
                  {["all", "informational", "commercial_investigation", "transactional"].map((intent) => (
                    <button
                      key={intent}
                      onClick={() => setSelectedIntent(intent)}
                      className={`text-[11px] px-2.5 py-1 rounded-md capitalize font-medium transition-all ${
                        selectedIntent === intent
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {intent === "commercial_investigation" ? "Commercial" : intent}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* TAB: TOPICAL CLUSTERS */}
            {activeTab === "clusters" && (
              <div className="space-y-4">
                {filteredClusters.length === 0 && !loading ? (
                  <div className="p-10 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-xl mx-auto my-8 shadow-xs">
                    <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
                      <Target className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold text-slate-900">No Keyword Clusters Discovered Yet</h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        Topical cluster discovery has not been executed for <span className="font-semibold text-slate-800">{currentWebsite.domain}</span>. Launch autonomous discovery to map high-intent pillar and supporting clusters.
                      </p>
                    </div>

                    <div className="pt-2 flex flex-col items-center gap-3">
                      <button
                        onClick={() => handleDiscover()}
                        disabled={discovering}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all inline-flex items-center gap-2 shadow-xs"
                      >
                        {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        <span>{discovering ? "Clustering..." : `Discover Keywords for ${currentWebsite.domain}`}</span>
                      </button>

                      <div className="space-y-1 pt-2">
                        <span className="text-[11px] text-slate-400 font-medium">Or explore standard authority niches:</span>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {[
                            "AI Automation Workflows",
                            "High-Converting Landing Pages",
                            "B2B SaaS Growth",
                            "SEO Technical Architecture"
                          ].map((chip, idx) => (
                            <button
                              key={idx}
                              disabled={discovering}
                              onClick={() => handleDiscover(chip)}
                              className="text-[11px] bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200 rounded-md px-2.5 py-1 font-medium transition-colors"
                            >
                              + {chip}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredClusters.map((cluster, idx) => {
                      const intentCfg = intentColors[cluster.search_intent || cluster.intent] || {
                        bg: "bg-slate-100",
                        text: "text-slate-700",
                        border: "border-slate-200",
                      };

                      return (
                        <div
                          key={cluster.id || idx}
                          className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-xl p-5 shadow-xs transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-sm text-slate-900 leading-tight">
                                  {cluster.cluster_name || cluster.name || cluster.topic}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[11px] text-slate-500">Pillar Target:</span>
                                  <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                    {cluster.primary_keyword}
                                  </span>
                                  <button
                                    onClick={() => copyToClipboard(cluster.primary_keyword)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                                    title="Copy keyword"
                                  >
                                    {copiedKw === cluster.primary_keyword ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider ${intentCfg.bg} ${intentCfg.text} ${intentCfg.border}`}>
                                {(cluster.search_intent || cluster.intent || "informational").replace(/_/g, " ")}
                              </span>
                            </div>

                            {/* Secondary Supporting Articles */}
                            {cluster.secondary_keywords && cluster.secondary_keywords.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                  Supporting Articles ({cluster.secondary_keywords.length}):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {cluster.secondary_keywords.map((sec: string, sIdx: number) => (
                                    <span
                                      key={sIdx}
                                      className="text-[11px] bg-slate-50 text-slate-700 border border-slate-200/80 rounded-md px-2 py-0.5 font-medium hover:bg-slate-100 transition-colors"
                                    >
                                      {sec}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Footer */}
                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                            <button
                              onClick={() => handleGenerateBrief(cluster)}
                              className="text-slate-600 hover:text-indigo-600 font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                              <span>View AI Brief</span>
                            </button>

                            <Link
                              href="/content-planner"
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 font-semibold px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                            >
                              <PenTool className="w-3 h-3" />
                              <span>Draft in Planner</span>
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: KEYWORD DIRECTORY (DATA TABLE) */}
            {activeTab === "all_keywords" && (
              <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                {filteredKeywords.length === 0 && !loading ? (
                  <div className="p-10 text-center space-y-3">
                    <Search className="w-8 h-8 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-semibold text-slate-900">No Keywords Match Current Filters</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Adjust your search query or run autonomous discovery to populate your keyword database.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Keyword Term</th>
                          <th className="py-3 px-4">Intent</th>
                          <th className="py-3 px-4">Difficulty</th>
                          <th className="py-3 px-4">Est. Volume</th>
                          <th className="py-3 px-4">SERP Features</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredKeywords.map((kw, i) => {
                          const kdInfo = getDifficultyBadge(kw.difficulty);
                          const intentCfg = intentColors[kw.intent || "informational"] || {
                            bg: "bg-slate-100",
                            text: "text-slate-700",
                            border: "border-slate-200",
                          };

                          return (
                            <tr key={kw.id || kw.term || i} className="hover:bg-slate-50/75 transition-colors group">
                              <td className="py-3 px-4 font-semibold text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span>{kw.term}</span>
                                  <button
                                    onClick={() => copyToClipboard(kw.term)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity"
                                    title="Copy term"
                                  >
                                    {copiedKw === kw.term ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${intentCfg.bg} ${intentCfg.text} ${intentCfg.border}`}>
                                  {kw.intent || "Informational"}
                                </span>
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2 w-28">
                                  <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${kdInfo.bar}`}
                                      style={{ width: `${Math.min(100, Math.max(10, kdInfo.val))}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-xs font-semibold text-slate-700">
                                    {kdInfo.val}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {kdInfo.label}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4 font-mono font-medium text-slate-700">
                                {kw.volume ? Number(kw.volume).toLocaleString() : "1,200"}
                              </td>

                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    Snippet
                                  </span>
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                    PAA
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-4 text-right space-x-2">
                                <button
                                  onClick={() => handleGenerateBrief(kw)}
                                  className="text-slate-600 hover:text-slate-900 font-medium text-xs inline-flex items-center gap-1 transition-colors"
                                >
                                  <FileText className="w-3 h-3 text-indigo-600" />
                                  <span>Brief</span>
                                </button>

                                <Link
                                  href="/content-planner"
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-md text-[11px] inline-flex items-center gap-1 border border-indigo-200/80 transition-colors shadow-2xs"
                                >
                                  <PenTool className="w-2.5 h-2.5" />
                                  <span>Draft</span>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* CONTENT BRIEF MODAL */}
        {briefModalOpportunity && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Autonomous SEO Content Brief</h3>
                    <p className="text-[11px] text-slate-500">Tailored structure &amp; target intent</p>
                  </div>
                </div>
                <button
                  onClick={() => setBriefModalOpportunity(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 rounded-md hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {generatingBrief ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Generating intent-driven content brief...</p>
                </div>
              ) : brief ? (
                <div className="space-y-4 text-xs max-h-96 overflow-y-auto pr-1">
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{brief.recommended_title}</p>
                    <p className="text-slate-600 font-mono text-[11px]">H1: {brief.h1}</p>
                    <p className="text-slate-500 text-[11px]">Target Audience: {brief.target_audience}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                      Heading Architecture:
                    </p>
                    <div className="space-y-1.5">
                      {(brief.h2_h3_structure || []).map((h: any, i: number) => (
                        <div key={i} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-slate-800 text-[11px]">
                          <span className="font-mono font-bold text-indigo-600 mr-1.5">[{h.level?.toUpperCase()}]</span>
                          <span className="font-semibold">{h.heading}</span>
                          {h.notes && <p className="text-[10px] text-slate-500 mt-0.5">{h.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {brief.questions_to_answer && brief.questions_to_answer.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        User Questions to Answer:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                        {brief.questions_to_answer.map((q: string, qi: number) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Failed to generate brief.</p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => setBriefModalOpportunity(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  Close
                </button>

                <Link
                  href="/content-planner"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <PenTool className="w-3.5 h-3.5" />
                  <span>Open in Content Planner</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
