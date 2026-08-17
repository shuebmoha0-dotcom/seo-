"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Download, Sparkles, ArrowUpRight, ArrowDownRight, Minus,
  Star, ChevronDown, ChevronUp, Filter, Loader2, AlertTriangle,
  Check, X, Edit2, FileText, Send, Brain, BarChart2, Target,
  Tag, Layers, RefreshCw, Info, Globe, Plus
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

const intentColors: Record<string, string> = {
  informational: "bg-blue-50 text-blue-700 border-blue-200",
  commercial_investigation: "bg-purple-50 text-purple-700 border-purple-200",
  transactional: "bg-emerald-50 text-emerald-700 border-emerald-200",
  comparison: "bg-indigo-50 text-indigo-700 border-indigo-200",
  problem_solution: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function KeywordsPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState<"clusters" | "all_keywords" | "roadmap">("clusters");
  const [siteMode, setSiteMode] = useState<"new" | "established">("new");
  const [discovering, setDiscovering] = useState(false);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

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
        if (data.clusters && data.clusters.length > 0) {
          setExpandedCluster(data.clusters[0].id || data.clusters[0].name);
        }
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

  const handleDiscover = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    setDiscovering(true);
    try {
      const res = await fetch("/api/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          mode: siteMode,
        }),
      });
      if (res.ok) {
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
            keyword: kw.term || kw.keyword,
            search_intent: kw.intent || "informational",
            content_type: "blog_article",
            business_relevance: kw.relevance || 90,
            evidence: `Discovered search opportunity for ${currentWebsite?.domain || "target website"}.`,
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

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Keyword Research Agent</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Keyword Research &amp; Clustering Engine
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Discovers intent-driven keyword opportunities tailored for ${currentWebsite.domain}.`
                : "Connect your website to research target search queries."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setSiteMode("new")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  siteMode === "new" ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                New Site Mode
              </button>
              <button
                onClick={() => setSiteMode("established")}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  siteMode === "established" ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                Established Mode
              </button>
            </div>

            <button
              onClick={handleDiscover}
              disabled={discovering || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {discovering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{discovering ? "Discovering..." : "Discover Keywords"}</span>
            </button>
          </div>
        </div>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                The Keyword Agent uses your domain, market niche, and competitor gap data to discover high-value search queries.
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
          <>
            {/* View Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 mb-6">
              {[
                { id: "clusters", label: "Intent Clusters", count: clusters.length },
                { id: "all_keywords", label: "All Tracked Keywords", count: rawKeywords.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    activeTab === tab.id ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-700"
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* TAB: CLUSTERS */}
            {activeTab === "clusters" && (
              <div className="space-y-4">
                {clusters.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                    <Target className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h3 className="text-base font-bold text-neutral-900">No Keyword Clusters Discovered Yet</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Click &ldquo;Discover Keywords&rdquo; above to run topical clustering and find target search intents for {currentWebsite.domain}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clusters.map((cluster, idx) => (
                      <div key={cluster.id || idx} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-sm text-neutral-900">{cluster.name || cluster.topic}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              intentColors[cluster.search_intent || cluster.intent] || "bg-neutral-100 text-neutral-700 border-neutral-200"
                            }`}>
                              {cluster.search_intent || cluster.intent || "Informational"}
                            </span>
                          </div>
                          <button
                            onClick={() => handleGenerateBrief({ term: cluster.primary_keyword || cluster.name, intent: cluster.search_intent })}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <FileText className="w-3 h-3" />
                            Create Brief
                          </button>
                        </div>
                        <p className="text-xs text-neutral-600">
                          Primary Target: <span className="font-semibold text-neutral-800 font-mono">{cluster.primary_keyword || cluster.name}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ALL KEYWORDS */}
            {activeTab === "all_keywords" && (
              <div className="space-y-4">
                {rawKeywords.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                    <Search className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h3 className="text-base font-bold text-neutral-900">No Tracked Keywords</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Run keyword discovery to populate your database with high-intent target queries for {currentWebsite.domain}.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Keyword Term</th>
                          <th className="py-3 px-4">Search Intent</th>
                          <th className="py-3 px-4">Difficulty</th>
                          <th className="py-3 px-4">Search Volume</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {rawKeywords.map((kw) => (
                          <tr key={kw.id || kw.term} className="hover:bg-neutral-50">
                            <td className="py-3 px-4 font-bold text-neutral-900">{kw.term}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                                {kw.intent || "Informational"}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-neutral-700 capitalize">{kw.difficulty || "Low"}</td>
                            <td className="py-3 px-4 font-mono text-neutral-700">{kw.volume ? kw.volume.toLocaleString() : "N/A"}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleGenerateBrief(kw)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold text-xs inline-flex items-center gap-1"
                              >
                                <FileText className="w-3 h-3" />
                                <span>Generate Brief</span>
                              </button>
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

      {/* CONTENT BRIEF MODAL */}
      {briefModalOpportunity && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Content Brief: {briefModalOpportunity.term || briefModalOpportunity.keyword}
              </h3>
              <button onClick={() => setBriefModalOpportunity(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>

            {generatingBrief ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-neutral-500">Generating intent-driven content brief...</p>
              </div>
            ) : brief ? (
              <div className="space-y-3 text-xs max-h-96 overflow-y-auto pr-1">
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                  <p className="font-bold text-neutral-900">Recommended Title: {brief.recommended_title}</p>
                  <p className="text-neutral-600">H1: {brief.h1}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-bold text-neutral-900">Heading Outline:</p>
                  {(brief.h2_h3_structure || []).map((h: any, i: number) => (
                    <div key={i} className="p-2 bg-neutral-50 rounded-lg text-neutral-700 font-mono text-[11px]">
                      <strong>[{h.level?.toUpperCase()}]</strong> {h.heading}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">Failed to generate brief.</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setBriefModalOpportunity(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
