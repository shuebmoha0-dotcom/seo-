"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Users, AlertTriangle, Crosshair, ChevronRight, Search, TrendingDown, TrendingUp,
  Target, FileText, Zap, Globe, Plus, Loader2, Sparkles, CheckCircle2, AlertCircle,
  ExternalLink, ArrowUpRight, ArrowRight, X
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

export default function CompetitorsPage() {
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();

  const [competitors, setCompetitors] = useState<any[]>([]);
  const [threats, setThreats] = useState<any[]>([]);
  const [gaps, setGaps] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    tracked_competitors: 0,
    keyword_overlap: 0,
    content_gaps: 0,
    serp_threats: 0,
  });

  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>("");
  const [selectedThreat, setSelectedThreat] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitorData = async () => {
    if (!currentWebsite) {
      setCompetitors([]);
      setThreats([]);
      setGaps([]);
      setKpis({ tracked_competitors: 0, keyword_overlap: 0, content_gaps: 0, serp_threats: 0 });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/competitors?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.competitors || []);
        setThreats(data.threats || []);
        setGaps(data.gaps || []);
        setKpis(data.kpis || {
          tracked_competitors: 0,
          keyword_overlap: 0,
          content_gaps: 0,
          serp_threats: 0,
        });
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load competitor data.");
      }
    } catch (err: any) {
      console.error("Error fetching competitor data:", err);
      setError(err.message || "Failed to load competitor data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompetitorData();
  }, [currentWebsite?.id]);

  const handleRunScan = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    setScanning(true);
    setError(null);
    setScanStep(`Initializing SERP intelligence for ${currentWebsite.domain}...`);

    try {
      setTimeout(() => setScanStep(`Extracting ranking domains from Google SERP index...`), 800);
      setTimeout(() => setScanStep("Computing keyword overlap and content gap vectors..."), 1800);

      const res = await fetch("/api/competitors/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: currentWebsite.id }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Competitor scan failed.");
      } else {
        await fetchCompetitorData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to run competitor scan.");
    } finally {
      setScanning(false);
      setScanStep("");
    }
  };

  const statCells = [
    {
      label: "Tracked rivals",
      value: kpis.tracked_competitors.toLocaleString(),
      caption: "Active domains in SERP index",
    },
    {
      label: "Shared queries",
      value: kpis.keyword_overlap.toLocaleString(),
      caption: "Direct organic ranking overlap",
    },
    {
      label: "Content gaps",
      value: kpis.content_gaps.toLocaleString(),
      caption: "High-value unranked topics",
    },
    {
      label: "SERP threats",
      value: kpis.serp_threats.toLocaleString(),
      caption: kpis.serp_threats > 0 ? "Keywords under competitive pressure" : "All positions stable",
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
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Competitors</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Competitor Intelligence
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Reverse-engineering organic competitor share, content gaps, and SERP threats for ${currentWebsite.domain}`
                  : "Connect a website to analyze market rivals."}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <button
                  onClick={handleRunScan}
                  disabled={scanning}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  <span>{scanning ? "Scanning SERPs…" : "Run competitor scan"}</span>
                </button>
              )}
            </div>
          </header>

          {/* In-Progress Banner */}
          {scanning && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-3 shadow-2xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-indigo-950">Autonomous Competitor Analysis Active</h4>
                <p className="text-xs text-indigo-700">{scanStep}</p>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold">Competitor Audit Error</p>
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

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
                Competitor intelligence is powered by live SERP queries tailored specifically to your target website domain.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : competitors.length === 0 && !loading && !scanning ? (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-2xs">
              <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center mx-auto text-neutral-600 mb-3">
                <Crosshair className="w-5 h-5 text-neutral-500" />
              </div>
              <h3 className="text-base font-semibold text-neutral-900">No competitor data collected yet</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Run a live SERP scan for <span className="font-semibold text-neutral-800">{currentWebsite.domain}</span> to identify ranking rivals and unlock content gaps.
              </p>
              <button
                onClick={handleRunScan}
                className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Run first competitor scan</span>
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Competitors Table & Content Gaps */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Table Card */}
                  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-600" />
                          <span>Discovered Search Rivals</span>
                        </h2>
                        <p className="text-xs text-neutral-500 mt-0.5">Domains ranking against your target keywords</p>
                      </div>
                      <span className="text-xs text-neutral-500">
                        {competitors.length} {competitors.length === 1 ? "domain" : "domains"}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                            <th className="py-2.5 px-5">Competitor Domain</th>
                            <th className="py-2.5 px-4">Classification</th>
                            <th className="py-2.5 px-4">SERP Overlap</th>
                            <th className="py-2.5 px-4">Shared KWs</th>
                            <th className="py-2.5 px-5 text-right">Trend</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {competitors.map((comp) => (
                            <tr key={comp.id || comp.domain} className="hover:bg-neutral-50/80 transition-colors">
                              <td className="py-3 px-5 font-semibold text-neutral-900">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
                                  <span>{comp.domain}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-200">
                                  {comp.type || "Direct Rival"}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-neutral-100 h-1.5 rounded-full overflow-hidden w-20">
                                    <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${comp.overlap_score || 50}%` }} />
                                  </div>
                                  <span className="tabular-nums text-neutral-700 text-[11px]">{comp.overlap_score || 0}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 tabular-nums text-neutral-700">
                                {comp.overlap_keywords || 0}
                              </td>
                              <td className="py-3 px-5 text-right tabular-nums font-semibold">
                                {comp.trend >= 0 ? (
                                  <span className="text-emerald-600 inline-flex items-center justify-end gap-0.5">
                                    <TrendingUp className="w-3.5 h-3.5" /> +{comp.trend}%
                                  </span>
                                ) : (
                                  <span className="text-rose-600 inline-flex items-center justify-end gap-0.5">
                                    <TrendingDown className="w-3.5 h-3.5" /> {comp.trend}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Content Gaps */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>Content Gaps &amp; Keyword Opportunities</span>
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Keywords competitors rank for that you don't</p>
                      </div>
                      <Link
                        href="/content-planner"
                        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                      >
                        <span>Draft in Planner</span>
                        <ArrowRight className="w-3 h-3 text-neutral-400" />
                      </Link>
                    </div>

                    {gaps.length === 0 ? (
                      <div className="p-6 bg-white border border-neutral-200 rounded-xl text-center text-xs text-neutral-500 shadow-2xs">
                        No content gaps detected. Run a fresh scan to surface competitor search targets.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {gaps.map((gap, i) => (
                          <div
                            key={gap.id || i}
                            className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-2 hover:border-neutral-300 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {gap.gap_type || "Keyword Gap"}
                              </span>
                              <span className="text-[11px] text-neutral-400">
                                vs {gap.competitor_domain}
                              </span>
                            </div>
                            <h4 className="font-semibold text-xs text-neutral-900 leading-snug">
                              {gap.keyword}
                            </h4>
                            {gap.note && (
                              <p className="text-[11px] text-neutral-600 bg-neutral-50/70 p-2 rounded border border-neutral-200/80">
                                {gap.note}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1.5 border-t border-neutral-100">
                              <span>Volume: <strong className="text-neutral-800 font-mono">{gap.search_volume ? gap.search_volume.toLocaleString() : "—"}</strong></span>
                              <span>Difficulty: <strong className="text-neutral-800 font-mono">{gap.difficulty ?? "—"}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Col: SERP Threats Radar */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>SERP Threat Radar</span>
                      </h3>
                      <p className="text-xs text-neutral-500 mt-0.5">Shifts threatening current positions</p>
                    </div>
                    <span className="text-xs text-neutral-500">
                      {threats.length} active
                    </span>
                  </div>

                  {threats.length === 0 ? (
                    <div className="p-6 bg-white border border-neutral-200 rounded-xl text-center text-xs text-neutral-500 shadow-2xs">
                      No critical SERP ranking threats detected.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {threats.map((threat) => (
                        <div
                          key={threat.id}
                          onClick={() => setSelectedThreat(threat)}
                          className="bg-white border border-neutral-200 hover:border-rose-300 rounded-xl p-4 shadow-2xs transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-neutral-900 truncate">
                              {threat.keyword}
                            </span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                              threat.level === "Critical"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}>
                              {threat.level}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center justify-between">
                            <span>Rival: <strong className="text-neutral-700">{threat.competitor_domain}</strong></span>
                            <span className="text-rose-600 font-semibold">{threat.competitor_movement}</span>
                          </div>
                          <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                            {threat.analysis}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Threat Detail Modal */}
          {selectedThreat && (
            <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
              <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>SERP Threat: {selectedThreat.keyword}</span>
                  </h3>
                  <button
                    onClick={() => setSelectedThreat(null)}
                    className="text-neutral-400 hover:text-neutral-600 p-1 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1 text-xs text-rose-900">
                  <p className="font-semibold">Competitor: {selectedThreat.competitor_domain}</p>
                  <p>{selectedThreat.analysis}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Recommended Response
                  </span>
                  <p className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-lg border border-neutral-200">
                    {selectedThreat.recommended_response}
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedThreat(null)}
                    className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 hover:bg-neutral-50 shadow-2xs transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
