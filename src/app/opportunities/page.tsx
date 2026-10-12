"use client";

import { Sidebar } from "@/components/Sidebar";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useState, useEffect, useMemo } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { Zap, Globe, Plus, Sparkles, Loader2, CheckCircle2, Search, Play, RefreshCw, Check } from "lucide-react";

export default function OpportunitiesPage() {
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();
  const [opportunities, setOpportunities] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_opps_${storedSiteId}`);
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
          const cached = sessionStorage.getItem(`seo_cached_opps_${storedSiteId}`);
          if (cached) return false;
        }
      } catch {}
    }
    return true;
  });

  const [activeFilter, setActiveFilter] = useState<"all" | "high_priority" | "high_confidence" | "quick_wins">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);

  const fetchOpportunities = async () => {
    if (!currentWebsite?.id) {
      setOpportunities([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/opportunities?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        const oppList = data.opportunities || [];
        setOpportunities(oppList);
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`seo_cached_opps_${currentWebsite.id}`, JSON.stringify(oppList));
        }
      }
    } catch (err) {
      console.error("Error fetching opportunities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentWebsite?.id) {
      setOpportunities([]);
      setLoading(false);
      return;
    }
    const cached = sessionStorage.getItem(`seo_cached_opps_${currentWebsite.id}`);
    if (cached) {
      setOpportunities(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchOpportunities();
  }, [currentWebsite?.id]);

  const handleRunAudit = async () => {
    if (!currentWebsite?.id || isAuditing) return;
    setIsAuditing(true);
    try {
      await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: currentWebsite.id, mode: "audit" }),
      });
      await fetchOpportunities();
    } catch (err) {
      console.error("Failed to run audit:", err);
    } finally {
      setIsAuditing(false);
    }
  };

  const highPriorityCount = useMemo(() => {
    return opportunities.filter((o) => o.priority === "high").length;
  }, [opportunities]);

  const highConfidenceCount = useMemo(() => {
    return opportunities.filter((o) => o.confidence === "high").length;
  }, [opportunities]);

  const quickWinsCount = useMemo(() => {
    return opportunities.filter((o) => o.effort === "low").length;
  }, [opportunities]);

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesProblem = opp.problem?.toLowerCase().includes(q);
        const matchesAction = opp.recommended_action?.toLowerCase().includes(q);
        if (!matchesProblem && !matchesAction) return false;
      }

      // Tab filter
      if (activeFilter === "high_priority") return opp.priority === "high";
      if (activeFilter === "high_confidence") return opp.confidence === "high";
      if (activeFilter === "quick_wins") return opp.effort === "low";
      return true;
    });
  }, [opportunities, activeFilter, searchQuery]);

  const statCells = [
    {
      label: "Active opportunities",
      value: opportunities.length.toLocaleString(),
      caption: "Identified by autonomous audit",
    },
    {
      label: "High priority",
      value: highPriorityCount.toLocaleString(),
      caption: "Critical for immediate SERP gain",
    },
    {
      label: "High confidence",
      value: highConfidenceCount.toLocaleString(),
      caption: "Backed by direct search evidence",
    },
    {
      label: "Quick wins",
      value: quickWinsCount.toLocaleString(),
      caption: "Low effort, high leverage items",
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
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Strategy</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Opportunities</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                SEO Opportunities
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Prioritized action items autonomously discovered for ${currentWebsite.domain}`
                  : "Connect a website to discover high-leverage search opportunities."}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <button
                  onClick={handleRunAudit}
                  disabled={isAuditing}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  <span>{isAuditing ? "Scanning…" : "Run audit"}</span>
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
                Autonomous agents analyze your crawl data, search positions, and competitors to generate real recommendations.
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

              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Segmented Controls */}
                <div className="inline-flex items-center overflow-hidden rounded-md border border-neutral-300 bg-white shadow-2xs">
                  {[
                    { id: "all", label: `All (${opportunities.length})` },
                    { id: "high_priority", label: `High Priority (${highPriorityCount})` },
                    { id: "high_confidence", label: `High Confidence (${highConfidenceCount})` },
                    { id: "quick_wins", label: `Quick Wins (${quickWinsCount})` },
                  ].map((tab, i) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveFilter(tab.id as any)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                        i > 0 ? "border-l border-neutral-300" : ""
                      } ${
                        activeFilter === tab.id
                          ? "bg-[#e8f0fe] text-[#1967d2] font-semibold"
                          : "text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      {activeFilter === tab.id && <Check className="h-3 w-3 text-[#1967d2] stroke-[3]" />}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Search input */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter opportunities…"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-neutral-300 bg-white placeholder-neutral-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Content */}
              {opportunities.length === 0 && !loading ? (
                <div className="mx-auto mt-6 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-2xs">
                  <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center mx-auto text-emerald-600 mb-3">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-neutral-900">No active opportunities queued</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                    No critical issues detected for <span className="font-semibold text-neutral-800">{currentWebsite.domain}</span>. Run an SEO audit to discover fresh opportunities.
                  </p>
                  <button
                    onClick={handleRunAudit}
                    disabled={isAuditing}
                    className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
                  >
                    {isAuditing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{isAuditing ? "Scanning…" : "Run audit"}</span>
                  </button>
                </div>
              ) : filteredOpportunities.length === 0 ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 shadow-2xs">
                  No opportunities match your current filter.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredOpportunities.map((opp) => (
                    <OpportunityCard key={opp.id} opportunity={opp} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
