"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Download, Sparkles, ArrowUpRight, ArrowDownRight, Minus,
  Star, ChevronDown, ChevronUp, Filter, Loader2, AlertTriangle,
  Check, X, Edit2, FileText, Send, Brain, BarChart2, Target,
  Tag, Layers, RefreshCw, Info
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell,
} from "recharts";
import { useState } from "react";

const performanceData = [
  { date: "May 12", impressions: 450000, clicks: 12000 },
  { date: "May 26", impressions: 680000, clicks: 18200 },
  { date: "Jun 2", impressions: 890000, clicks: 22000 },
  { date: "Jun 9", impressions: 1100000, clicks: 27500 },
  { date: "Jun 12", impressions: 1200000, clicks: 31000 },
];

const distributionData = [
  { name: "Top 3", value: 2418, color: "#10b981", percent: "9.7%" },
  { name: "4-10", value: 4628, color: "#3b82f6", percent: "18.6%" },
  { name: "11-20", value: 6912, color: "#8b5cf6", percent: "27.8%" },
  { name: "21-50", value: 7845, color: "#f59e0b", percent: "31.6%" },
  { name: "51-100", value: 3039, color: "#ef4444", percent: "12.3%" },
];

const intentColors: Record<string, string> = {
  informational: "bg-blue-50 text-blue-600 border-blue-200",
  commercial_investigation: "bg-purple-50 text-purple-600 border-purple-200",
  transactional: "bg-emerald-50 text-emerald-600 border-emerald-200",
  comparison: "bg-indigo-50 text-indigo-600 border-indigo-200",
  problem_solution: "bg-amber-50 text-amber-600 border-amber-200",
};

const CLUSTERS = [
  {
    name: "AI SEO Agent",
    primary: "AI SEO agent for SaaS companies",
    intent: "commercial_investigation",
    content_type: "landing_page",
    keywords: [
      { keyword: "AI SEO agent for SaaS companies", priority: "high", volume: null, difficulty: null, competition: "low", relevance: 100, position: null, action: "create_new_page", evidence: "Emerging category. Low competition. Core product keyword." },
      { keyword: "autonomous SEO tool", priority: "high", volume: null, difficulty: null, competition: "low", relevance: 98, position: null, action: "create_new_page", evidence: "Highly differentiated. No direct competitors yet." },
      { keyword: "AI SEO automation platform", priority: "medium", volume: null, difficulty: null, competition: "low", relevance: 95, position: null, action: "create_new_page", evidence: "Supporting cluster keyword." },
    ],
  },
  {
    name: "SaaS SEO Education",
    primary: "how to improve SEO for a new SaaS website",
    intent: "informational",
    content_type: "blog_article",
    keywords: [
      { keyword: "how to improve SEO for a new SaaS website", priority: "high", volume: null, difficulty: null, competition: "low", relevance: 95, position: null, action: "create_new_page", evidence: "Strong audience relevance. Low-competition long-tail. Ideal Phase 1 target." },
      { keyword: "how to get backlinks for a new SaaS website with no traffic", priority: "medium", volume: null, difficulty: null, competition: "low", relevance: 85, position: null, action: "create_new_page", evidence: "Very specific long-tail. Directly addresses audience pain point." },
      { keyword: "SaaS SEO strategy for startups", priority: "medium", volume: null, difficulty: null, competition: "medium", relevance: 90, position: null, action: "create_new_page", evidence: "Supporting informational content for topical authority." },
    ],
  },
  {
    name: "Quick Win Opportunities (GSC)",
    primary: "project management software",
    intent: "commercial_investigation",
    content_type: "landing_page",
    cannibalizationWarning: true,
    keywords: [
      { keyword: "project management software", priority: "high", volume: 18400, difficulty: null, competition: "high", relevance: 100, position: 6.2, action: "optimize_existing", evidence: "18,400 impressions / 1.4% CTR. Title/meta refresh = immediate traffic lift." },
      { keyword: "best project management tools", priority: "high", volume: 12600, difficulty: null, competition: "high", relevance: 95, position: 8.4, action: "optimize_existing", evidence: "12,600 impressions / 1.4% CTR. Position 8.4. High quick-win value." },
      { keyword: "ai seo agent", priority: "high", volume: 4200, difficulty: null, competition: "low", relevance: 100, position: 7.1, action: "optimize_existing", evidence: "4,200 impressions / 1.1% CTR. Position 7.1. Strong lift potential." },
    ],
  },
];

const ROADMAP_PHASES = [
  { phase: 1, title: "Easy Long-Tail Opportunities", desc: "Low-competition, high-relevance long-tail keywords targeting audience pain points and questions.", keywords: ["how to improve SEO for a new SaaS website", "how to get backlinks with no traffic"], color: "indigo" },
  { phase: 2, title: "Topical Authority & Informational Cluster", desc: "Supporting blog content building topical depth around AI SEO and SaaS marketing.", keywords: ["SaaS SEO strategy for startups", "what is AI SEO automation"], color: "blue" },
  { phase: 3, title: "Commercial & Comparison Pages", desc: "Use-case and comparison pages targeting buyers in research mode.", keywords: ["AI SEO agent vs Semrush", "autonomous SEO tool comparison"], color: "purple" },
  { phase: 4, title: "More Competitive Keywords", desc: "Broader commercial keywords after domain authority is established.", keywords: ["SEO software for SaaS", "best AI SEO tools"], color: "amber" },
  { phase: 5, title: "Head Terms", desc: "High-competition head terms once strong topical authority is demonstrated.", keywords: ["SEO software", "AI SEO"], color: "emerald" },
];

export default function KeywordsPage() {
  const [activeTab, setActiveTab] = useState("clusters");
  const [siteMode, setSiteMode] = useState<"new" | "established">("established");
  const [expandedCluster, setExpandedCluster] = useState<number | null>(0);
  const [discovering, setDiscovering] = useState(false);
  const [briefModalOpportunity, setBriefModalOpportunity] = useState<any>(null);
  const [generatingBrief, setGeneratingBrief] = useState(false);
  const [brief, setBrief] = useState<any>(null);
  const [approvedKeywords, setApprovedKeywords] = useState<string[]>([]);
  const [rejectedKeywords, setRejectedKeywords] = useState<string[]>([]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      await fetch("/api/agent/keywords/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: siteMode, site_description: "SaaS project management software" }),
      });
    } catch (e) { console.error(e); }
    finally { setDiscovering(false); }
  };

  const handleGenerateBrief = async (kw: any) => {
    setBriefModalOpportunity(kw);
    setGeneratingBrief(true);
    setBrief(null);
    try {
      const res = await fetch("/api/agent/keywords/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunity: { ...kw, search_intent: "informational", content_type: "blog_article" } }),
      });
      if (res.ok) {
        const data = await res.json();
        setBrief(data.brief);
      }
    } catch (e) { console.error(e); }
    finally { setGeneratingBrief(false); }
  };

  const priorityBadge = (p: string) => {
    if (p === "high") return "bg-red-50 text-red-600 border-red-200";
    if (p === "medium") return "bg-amber-50 text-amber-600 border-amber-200";
    return "bg-neutral-800 text-neutral-500 border-neutral-700";
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span><span>&gt;</span>
              <span className="text-neutral-200">Keyword Research Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Keyword Research Agent</h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Discovers the best opportunities for THIS website, THIS audience, and THIS stage of growth.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* New vs Established Toggle */}
            <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-xl p-1 text-xs font-medium">
              <button onClick={() => setSiteMode("new")} className={`px-3 py-1.5 rounded-lg transition-colors ${siteMode === "new" ? "bg-indigo-600 text-neutral-900" : "text-neutral-500"}`}>New Website</button>
              <button onClick={() => setSiteMode("established")} className={`px-3 py-1.5 rounded-lg transition-colors ${siteMode === "established" ? "bg-indigo-600 text-neutral-900" : "text-neutral-500"}`}>Established</button>
            </div>

            <button
              onClick={handleDiscover}
              disabled={discovering}
              className="bg-indigo-600 hover:bg-indigo-500 text-neutral-900 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2"
            >
              {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {discovering ? "Discovering..." : "Run Keyword Discovery"}
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: "Total Keywords", value: "24,842", change: "+18.7%" },
            { label: "Top 3 Rankings", value: "2,418", change: "+22.1%" },
            { label: "Opportunities", value: "31", change: "+8" },
            { label: "Avg. CTR", value: "4.62%", change: "+8.9%" },
            { label: "Organic Traffic", value: "18,247", change: "+23.6%" },
          ].map((m, i) => (
            <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4">
              <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-2">{m.label}</span>
              <div className="text-2xl font-bold text-neutral-900 mb-1">{m.value}</div>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" /> {m.change}
              </span>
            </div>
          ))}
        </div>

        {/* Mode Notice */}
        <div className={`flex items-start gap-3 p-4 rounded-xl border mb-6 text-xs ${siteMode === "new" ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-300" : "bg-emerald-500/5 border-emerald-500/20 text-emerald-300"}`}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          {siteMode === "new"
            ? "New Website Mode: Prioritising long-tail, low-competition opportunities, topical clusters, and a staged 5-phase roadmap. NOT selecting keywords by volume alone."
            : "Established Mode: Using Search Console data to find Position 4-20 quick wins, CTR gaps, and cannibalization conflicts on existing pages."}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-neutral-200 mb-8 text-xs font-medium">
          {["Topical Clusters", "Quick Wins", "Roadmap", "Cannibalization", "Performance"].map((tab) => {
            const slug = tab.toLowerCase().replace(/ /g, "-");
            return (
              <button key={tab} onClick={() => setActiveTab(slug === "topical-clusters" ? "clusters" : slug)}
                className={`pb-3 transition-colors relative ${activeTab === (slug === "topical-clusters" ? "clusters" : slug) ? "text-indigo-600 font-semibold" : "text-neutral-500 hover:text-neutral-200"}`}>
                {tab}
                {activeTab === (slug === "topical-clusters" ? "clusters" : slug) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── TOPICAL CLUSTERS TAB ── */}
        {activeTab === "clusters" && (
          <div className="space-y-4">
            {CLUSTERS.map((cluster, cIdx) => (
              <div key={cIdx} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedCluster(expandedCluster === cIdx ? null : cIdx)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-neutral-900 text-sm">{cluster.name}</h3>
                        {cluster.cannibalizationWarning && (
                          <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                            <AlertTriangle className="w-3 h-3" /> Cannibalization Risk
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${intentColors[cluster.intent] || "bg-neutral-800 text-neutral-500 border-neutral-700"}`}>
                          {cluster.intent.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-neutral-500">{cluster.content_type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-neutral-500">{cluster.keywords.length} keywords</span>
                      </div>
                    </div>
                  </div>
                  {expandedCluster === cIdx ? <ChevronUp className="w-4 h-4 text-neutral-500" /> : <ChevronDown className="w-4 h-4 text-neutral-500" />}
                </button>

                {expandedCluster === cIdx && (
                  <div className="border-t border-neutral-200">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-neutral-700">
                        <thead className="bg-white text-neutral-500 uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="p-3 text-left">Keyword</th>
                            <th className="p-3 text-left">Priority</th>
                            <th className="p-3 text-left">Volume</th>
                            <th className="p-3 text-left">Competition</th>
                            <th className="p-3 text-left">Relevance</th>
                            <th className="p-3 text-left">Position</th>
                            <th className="p-3 text-left">Action</th>
                            <th className="p-3 text-right">Approve</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900">
                          {cluster.keywords.map((kw, kwIdx) => {
                            const approved = approvedKeywords.includes(kw.keyword);
                            const rejected = rejectedKeywords.includes(kw.keyword);
                            return (
                              <tr key={kwIdx} className={`hover:bg-neutral-50 transition-colors ${rejected ? "opacity-40" : ""}`}>
                                <td className="p-3">
                                  <div className="font-semibold text-neutral-900">{kw.keyword}</div>
                                  <div className="text-[10px] text-neutral-500 mt-0.5">{kw.evidence}</div>
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${priorityBadge(kw.priority)}`}>
                                    {kw.priority}
                                  </span>
                                </td>
                                <td className="p-3 text-neutral-500 font-mono text-[11px]">
                                  {kw.volume ? kw.volume.toLocaleString() : <span className="italic text-neutral-600">Data unavailable</span>}
                                </td>
                                <td className="p-3">
                                  <span className={`capitalize ${kw.competition === "low" ? "text-emerald-400" : kw.competition === "medium" ? "text-amber-400" : "text-red-400"}`}>
                                    {kw.competition}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden w-16">
                                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${kw.relevance}%` }} />
                                    </div>
                                    <span className="text-indigo-600 font-bold">{kw.relevance}</span>
                                  </div>
                                </td>
                                <td className="p-3 text-neutral-500">
                                  {kw.position ? <span className="font-semibold text-neutral-900">{kw.position}</span> : <span className="italic text-neutral-600">Not ranking</span>}
                                </td>
                                <td className="p-3">
                                  <span className="text-[10px] bg-white border border-neutral-200 px-2 py-0.5 rounded font-medium">
                                    {kw.action.replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  {approved ? (
                                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 justify-end">
                                      <Check className="w-3.5 h-3.5" /> Approved
                                    </span>
                                  ) : rejected ? (
                                    <span className="text-neutral-500 text-xs">Rejected</span>
                                  ) : (
                                    <div className="flex items-center gap-1.5 justify-end">
                                      <button
                                        onClick={() => handleGenerateBrief(kw)}
                                        className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-600 border border-indigo-500/30 rounded-lg text-[10px] font-medium flex items-center gap-1"
                                      >
                                        <FileText className="w-3 h-3" /> Brief
                                      </button>
                                      <button onClick={() => setApprovedKeywords([...approvedKeywords, kw.keyword])}
                                        className="p-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg">
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setRejectedKeywords([...rejectedKeywords, kw.keyword])}
                                        className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ROADMAP TAB ── */}
        {activeTab === "roadmap" && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 mb-6">
              Staged keyword roadmap built from site analysis. Strategy Agent determines final execution order.
            </p>
            {ROADMAP_PHASES.map((phase) => (
              <div key={phase.phase} className="bg-white border border-neutral-200 rounded-2xl p-5 flex gap-5">
                <div className="shrink-0">
                  <span className="w-10 h-10 rounded-full bg-indigo-600 text-neutral-900 font-bold flex items-center justify-center text-sm">
                    {phase.phase}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 text-sm mb-1">{phase.title}</h3>
                  <p className="text-xs text-neutral-500 mb-3">{phase.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {phase.keywords.map((kw, i) => (
                      <span key={i} className="text-[11px] bg-white border border-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── QUICK WINS TAB ── */}
        {activeTab === "quick-wins" && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 mb-4">
              Keywords ranking position 4–20 with high impressions but low CTR. Title and meta description optimisation can deliver immediate traffic lifts.
            </p>
            {CLUSTERS[2].keywords.map((kw, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-neutral-900 text-sm">{kw.keyword}</h4>
                  <p className="text-xs text-neutral-500 mt-1">{kw.evidence}</p>
                </div>
                <div className="flex gap-4 text-center shrink-0">
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Impressions</span>
                    <span className="font-bold text-neutral-900 text-sm">{kw.volume?.toLocaleString() ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 block">Position</span>
                    <span className="font-bold text-amber-400 text-sm">{kw.position ?? "—"}</span>
                  </div>
                  <button
                    onClick={() => setApprovedKeywords([...approvedKeywords, kw.keyword])}
                    className="bg-indigo-600 hover:bg-indigo-500 text-neutral-900 text-xs font-semibold px-3.5 py-2 rounded-xl flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Approve Optimisation
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CANNIBALIZATION TAB ── */}
        {activeTab === "cannibalization" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl border bg-amber-500/5 border-amber-500/20 text-amber-300 text-xs mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Cannibalization Detected:</strong> Multiple pages may be competing for the same search intent.
                High-risk changes (merge, redirect) require human approval and are never automatically executed.
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
              <h4 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Competing Pages Detected
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200">
                    <tr>
                      <th className="p-3 text-left">Keyword</th>
                      <th className="p-3 text-left">Page 1</th>
                      <th className="p-3 text-left">Page 2 (Competing)</th>
                      <th className="p-3 text-left">Recommendation</th>
                      <th className="p-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-neutral-50">
                      <td className="p-3 font-medium text-neutral-900">ai seo agent</td>
                      <td className="p-3 text-neutral-700">/</td>
                      <td className="p-3 text-neutral-700">/features</td>
                      <td className="p-3"><span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-medium">Differentiate</span></td>
                      <td className="p-3">
                        <button className="text-indigo-600 text-xs hover:underline font-medium">Review →</button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PERFORMANCE TAB ── */}
        {activeTab === "performance" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-2xl p-5">
              <h3 className="font-semibold text-neutral-900 text-sm mb-6">Keyword Performance Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="purpleGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "12px", color: "#111827" }} />
                    <Area type="monotone" dataKey="impressions" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#purpleGrad2)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="lg:col-span-4 bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col justify-between">
              <h3 className="font-semibold text-neutral-900 text-sm mb-4">Keyword Distribution</h3>
              <div className="relative h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={distributionData} innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                      {distributionData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                  </RePieChart>
                </ResponsiveContainer>
                <div className="absolute text-center">
                  <div className="text-lg font-bold text-neutral-900">24,842</div>
                  <div className="text-[10px] text-neutral-500">Total</div>
                </div>
              </div>
              <div className="space-y-2 mt-4 text-xs">
                {distributionData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-neutral-700 font-medium">{d.name}</span>
                    </div>
                    <span className="text-neutral-900 font-semibold">{d.value.toLocaleString()} <span className="text-neutral-500 font-normal">({d.percent})</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content Brief Modal */}
      {briefModalOpportunity && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Content Brief</h3>
                <p className="text-xs text-neutral-500 mt-0.5">"{briefModalOpportunity.keyword}"</p>
              </div>
              <button onClick={() => { setBriefModalOpportunity(null); setBrief(null); }} className="p-1 text-neutral-500 hover:text-neutral-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatingBrief ? (
              <div className="py-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                <p className="text-xs text-neutral-500">Keyword Agent researching SERP context and generating structured brief...</p>
              </div>
            ) : brief ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-neutral-200">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Intent</span>
                    <span className="text-indigo-600 font-medium capitalize">{brief.search_intent?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-neutral-200">
                    <span className="text-[10px] text-neutral-500 uppercase block mb-1">Word Count Range</span>
                    <span className="text-neutral-900 font-medium">{brief.recommended_word_count_min}–{brief.recommended_word_count_max} words</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase block mb-1">Recommended Title</span>
                  <span className="text-neutral-900 font-semibold">{brief.recommended_title}</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase block mb-2">H2/H3 Structure</span>
                  <div className="space-y-1.5">
                    {brief.h2_h3_structure?.map((h: any, i: number) => (
                      <div key={i} className={`text-xs ${h.level === "h2" ? "text-neutral-900 font-semibold" : "text-neutral-500 pl-4"}`}>
                        {h.level === "h2" ? "## " : "### "}{h.heading}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase block mb-2">Questions to Answer</span>
                  <ul className="space-y-1">
                    {brief.questions_to_answer?.map((q: string, i: number) => (
                      <li key={i} className="text-neutral-700 text-xs flex gap-2"><span className="text-indigo-600">?</span>{q}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-3 rounded-xl border border-neutral-200">
                  <span className="text-[10px] text-neutral-500 uppercase block mb-1">CTA Recommendation</span>
                  <span className="text-neutral-900 text-xs">{brief.cta_recommendation}</span>
                </div>

                <div className="flex gap-3 pt-2 border-t border-neutral-200">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-neutral-900 text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> Send to Content Agent
                  </button>
                  <button onClick={() => { setBriefModalOpportunity(null); setBrief(null); }}
                    className="px-4 py-3 bg-white border border-neutral-200 text-neutral-700 text-xs font-medium rounded-xl">
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
