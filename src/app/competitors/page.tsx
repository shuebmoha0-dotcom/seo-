"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Users, AlertTriangle, Crosshair, ChevronRight, Search, TrendingDown, TrendingUp,
  Target, FileText, Zap, Globe, Plus, Loader2, Sparkles, CheckCircle2, AlertCircle,
  ExternalLink, ArrowUpRight, ArrowRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

export default function CompetitorsPage() {
  const { currentWebsite, openAddModal } = useWebsite();

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
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Market Intelligence</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Competitors &amp; Content Gaps</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Competitor Intelligence &amp; Gap Matrix
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Crosshair className="w-3 h-3 text-indigo-600" />
                SERP Disruption Engine
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `Reverse-engineering organic competitor share, unranked content gaps, and SERP threats for ${currentWebsite.domain}.`
                : "Connect your website to analyze market rivals."}
            </p>
          </div>

          <button
            onClick={handleRunScan}
            disabled={scanning || !currentWebsite}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-xs active:scale-[0.98] self-start md:self-auto"
          >
            {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>{scanning ? "Scanning SERPs..." : "Run Competitor Scan"}</span>
          </button>
        </div>

        {/* In-Progress Banner */}
        {scanning && (
          <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center gap-3 shadow-2xs">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-indigo-950">Autonomous Competitor Analysis Active</h4>
              <p className="text-xs text-indigo-700">{scanStep}</p>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold">Competitor Audit Error</p>
              <p className="text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Connect a Website to Begin</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Competitor intelligence is powered by live SERP queries tailored specifically to your target website domain.
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
        ) : competitors.length === 0 && !loading && !scanning ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
            <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Crosshair className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">No Competitor Data Collected Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Run a live SERP scan for <span className="font-semibold text-slate-800">{currentWebsite.domain}</span> to identify ranking rivals and unlock content gaps.
              </p>
            </div>
            <button
              onClick={handleRunScan}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-2 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Run First Competitor Scan</span>
            </button>
          </div>
        ) : (
          <>
            {/* KPI Stats Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Tracked Rivals
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {kpis.tracked_competitors}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    SERP Verified
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Shared Queries
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {kpis.keyword_overlap.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                    Overlap
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Content Gaps
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-indigo-600 tabular-nums">
                    {kpis.content_gaps}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                    Actionable
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  SERP Threats
                </span>
                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-bold font-mono tabular-nums ${
                    kpis.serp_threats > 0 ? "text-rose-600" : "text-slate-900"
                  }`}>
                    {kpis.serp_threats}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                    kpis.serp_threats > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "text-emerald-700 bg-emerald-50 border-emerald-200"
                  }`}>
                    {kpis.serp_threats > 0 ? "Require Review" : "Secure"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* COMPETITORS TABLE */}
              <section className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>Discovered Search Rivals</span>
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">
                      {competitors.length} domains
                    </span>
                  </div>

                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Competitor Domain</th>
                        <th className="py-3 px-4">Classification</th>
                        <th className="py-3 px-4">SERP Overlap</th>
                        <th className="py-3 px-4">Shared KWs</th>
                        <th className="py-3 px-4 text-right">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {competitors.map((comp) => (
                        <tr key={comp.id || comp.domain} className="hover:bg-slate-50/75 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                              <span>{comp.domain}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {comp.type || "Direct Rival"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden w-20">
                                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${comp.overlap_score || 50}%` }} />
                              </div>
                              <span className="font-mono text-slate-700 text-[11px]">{comp.overlap_score || 0}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-700">
                            {comp.overlap_keywords || 0}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">
                            {comp.trend >= 0 ? (
                              <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                                <TrendingUp className="w-3.5 h-3.5" /> +{comp.trend}%
                              </span>
                            ) : (
                              <span className="text-rose-600 flex items-center justify-end gap-0.5">
                                <TrendingDown className="w-3.5 h-3.5" /> {comp.trend}%
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* CONTENT GAPS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Content Gaps &amp; Keyword Opportunities</span>
                    </h3>
                    <Link
                      href="/content-planner"
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold inline-flex items-center gap-1"
                    >
                      <span>Draft in Planner</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {gaps.length === 0 ? (
                    <div className="p-6 bg-white border border-slate-200/80 rounded-xl text-center text-xs text-slate-500 shadow-xs">
                      No content gaps detected. Run a fresh scan to surface competitor search targets.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {gaps.map((gap, i) => (
                        <div
                          key={gap.id || i}
                          className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                              {gap.gap_type || "Keyword Gap"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              vs {gap.competitor_domain}
                            </span>
                          </div>
                          <h4 className="font-semibold text-xs text-slate-900 leading-snug">
                            {gap.keyword}
                          </h4>
                          {gap.note && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                              {gap.note}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                            <span>Vol: <strong className="text-slate-800 font-mono">{gap.search_volume?.toLocaleString() || "1,200"}</strong></span>
                            <span>KD: <strong className="text-slate-800 font-mono">{gap.difficulty || "Low"}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* SERP THREATS PANEL */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>SERP Threat Radar</span>
                  </h3>
                  <span className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    {threats.length} Active
                  </span>
                </div>

                {threats.length === 0 ? (
                  <div className="p-6 bg-white border border-slate-200/80 rounded-xl text-center text-xs text-slate-500 shadow-xs">
                    No critical SERP ranking threats detected.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {threats.map((threat) => (
                      <div
                        key={threat.id}
                        onClick={() => setSelectedThreat(threat)}
                        className="bg-white border border-slate-200/80 hover:border-rose-300 rounded-xl p-3.5 shadow-xs transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-slate-900 truncate">
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
                        <div className="text-[11px] text-slate-500 flex items-center justify-between font-mono">
                          <span>Rival: <strong>{threat.competitor_domain}</strong></span>
                          <span className="text-rose-600 font-semibold">{threat.competitor_movement}</span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {threat.analysis}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {/* THREAT DETAIL MODAL */}
        {selectedThreat && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>SERP Threat: {selectedThreat.keyword}</span>
                </h3>
                <button
                  onClick={() => setSelectedThreat(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
                >
                  ✕
                </button>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1 text-xs text-rose-900">
                <p className="font-semibold">Competitor: {selectedThreat.competitor_domain}</p>
                <p>{selectedThreat.analysis}</p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Recommended Response
                </span>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  {selectedThreat.recommended_response}
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedThreat(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
