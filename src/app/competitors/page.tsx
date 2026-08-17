"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Users, AlertTriangle, Crosshair, ChevronRight, Search, TrendingDown, TrendingUp, Target, FileText, Zap, Globe, Plus, Loader2, Sparkles, CheckCircle2, AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

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

  // Fetch real competitor data whenever active website changes
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
    setScanStep(`Initializing real SERP scan for ${currentWebsite.domain}...`);

    try {
      setTimeout(() => setScanStep(`Querying live search results for ${currentWebsite.domain} keywords...`), 800);
      setTimeout(() => setScanStep("Identifying ranking domains and filtering aggregators..."), 1800);
      setTimeout(() => setScanStep("Running CompetitorAgent classification and overlap calculations..."), 2800);

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

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-neutral-200 px-8 py-6 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-neutral-900 font-medium">Competitor Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Competitor Intelligence Hub</h1>
            <p className="text-sm text-neutral-500 mt-1">
              {currentWebsite
                ? `Real-time SERP competition, keyword overlap, and content gaps for ${currentWebsite.domain}.`
                : "Connect your website to discover real competitor insights."}
            </p>
          </div>
          <button
            onClick={handleRunScan}
            disabled={scanning || loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{scanning ? "Scanning SERPs..." : "Run Competitor Scan"}</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* Scanning In-Progress Feedback Banner */}
          {scanning && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl text-white">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Competitor Agent In Progress</h4>
                  <p className="text-xs text-indigo-700">{scanStep}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Notice */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="font-bold">Error Collecting Competitor Data</p>
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-12">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Competitor intelligence is powered by live SERP data tailored specifically to your target website.
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
          ) : competitors.length === 0 && !loading && !scanning ? (
            /* ── STATE 2: WEBSITE CONNECTED BUT NO COMPETITORS COLLECTED YET ── */
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-12">
              <div className="w-12 h-12 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                <Crosshair className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">No competitor data collected yet</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  Run a live SERP scan for <span className="font-semibold text-neutral-800">{currentWebsite.domain}</span> to discover ranking competitors, keyword overlap, and content gaps.
                </p>
              </div>
              <button
                onClick={handleRunScan}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>Run Competitor Scan</span>
              </button>
            </div>
          ) : (
            /* ── STATE 3: REAL DATA AVAILABLE ── */
            <>
              {/* KPI STATS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Tracked Competitors</span>
                  <div className="text-3xl font-black text-neutral-900 mb-1">{kpis.tracked_competitors}</div>
                  <span className="text-xs text-neutral-500">Discovered from live SERPs</span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Keyword Overlap</span>
                  <div className="text-3xl font-black text-neutral-900 mb-1">{kpis.keyword_overlap.toLocaleString()}</div>
                  <span className="text-xs text-neutral-500">Shared search queries</span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Content Gaps Identified</span>
                  <div className="text-3xl font-black text-indigo-700 mb-1 flex items-center gap-2">
                    {kpis.content_gaps} <Target className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-neutral-500">Opportunities to target</span>
                </div>
                <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-red-50 to-white">
                  <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1 block">Active SERP Threats</span>
                  <div className="text-3xl font-black text-red-700 mb-1">{kpis.serp_threats}</div>
                  <span className="text-xs text-red-600">Requiring optimization</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COMPETITORS LIST */}
                <section className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Discovered SERP Competitors
                    </h2>
                    <span className="text-xs text-neutral-500">
                      Domain: <span className="font-semibold text-neutral-800">{currentWebsite.domain}</span>
                    </span>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Competitor Domain</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">SERP Overlap</th>
                          <th className="py-3 px-4">Shared KWs</th>
                          <th className="py-3 px-4 text-right">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {competitors.map((comp) => (
                          <tr key={comp.id || comp.domain} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-neutral-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-indigo-500" />
                              {comp.domain}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                {comp.type || "Direct"}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-neutral-100 h-1.5 rounded-full overflow-hidden w-20">
                                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${comp.overlap_score || 50}%` }} />
                                </div>
                                <span className="font-mono text-neutral-700 text-[11px]">{comp.overlap_score || 0}%</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-neutral-700">
                              {comp.overlap_keywords || 0}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-semibold">
                              {comp.trend >= 0 ? (
                                <span className="text-emerald-600 flex items-center justify-end gap-0.5">
                                  <TrendingUp className="w-3.5 h-3.5" /> +{comp.trend}%
                                </span>
                              ) : (
                                <span className="text-red-600 flex items-center justify-end gap-0.5">
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
                  <div className="space-y-4 pt-4">
                    <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      Content Gaps & Opportunities
                    </h2>

                    {gaps.length === 0 ? (
                      <div className="p-6 bg-neutral-50 border border-neutral-200 rounded-2xl text-center text-xs text-neutral-500">
                        No content gaps discovered yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {gaps.map((gap, i) => (
                          <div key={gap.id || i} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                {gap.gap_type}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                vs {gap.competitor_domain}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-neutral-900 leading-snug">
                              {gap.keyword}
                            </h4>
                            {gap.note && (
                              <p className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                                {gap.note}
                              </p>
                            )}
                            <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 border-t border-neutral-100">
                              <span>Volume: <strong className="text-neutral-800 font-mono">{gap.search_volume?.toLocaleString() || "N/A"}</strong></span>
                              <span>Difficulty: <strong className="text-neutral-800">{gap.difficulty || "Low"}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* SERP THREATS PANEL */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      SERP Threats
                    </h2>
                    <span className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      {threats.length} Active
                    </span>
                  </div>

                  {threats.length === 0 ? (
                    <div className="p-6 bg-neutral-50 border border-neutral-200 rounded-2xl text-center text-xs text-neutral-500">
                      No active SERP threats detected.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {threats.map((threat) => (
                        <div
                          key={threat.id}
                          onClick={() => setSelectedThreat(threat)}
                          className="bg-white border border-neutral-200 hover:border-red-300 rounded-2xl p-4 shadow-sm transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-neutral-900 truncate">
                              {threat.keyword}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              threat.level === 'Critical'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {threat.level}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center justify-between font-mono">
                            <span>Competitor: <strong>{threat.competitor_domain}</strong></span>
                            <span className="text-red-600 font-semibold">{threat.competitor_movement}</span>
                          </div>
                          <p className="text-xs text-neutral-600 line-clamp-2">
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

        </div>
      </div>

      {/* THREAT DETAIL MODAL */}
      {selectedThreat && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                SERP Threat: {selectedThreat.keyword}
              </h3>
              <button onClick={() => setSelectedThreat(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5 text-xs text-red-900">
              <p className="font-semibold">Competitor: {selectedThreat.competitor_domain}</p>
              <p>{selectedThreat.analysis}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recommended Response</span>
              <p className="text-xs text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                {selectedThreat.recommended_response}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedThreat(null)}
                className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors"
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
