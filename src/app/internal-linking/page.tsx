"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Link as LinkIcon, AlertCircle, CheckCircle2, TrendingUp, GitPullRequest,
  Search, FileText, ChevronRight, Loader2, RefreshCw, ExternalLink, Globe, Plus,
  ArrowRight, ShieldCheck, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { WebsiteFavicon } from "@/components/WebsiteFavicon";

export default function InternalLinkingPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);
  const [approvedOpps, setApprovedOpps] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; ok: boolean } | null>(null);

  const fetchInternalLinks = async () => {
    if (!currentWebsite) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/internal-linking?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load internal link data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInternalLinks();
  }, [currentWebsite?.id]);

  const handleRunAnalysis = async () => {
    if (!currentWebsite) return;
    setAnalyzing(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/internal-linking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: currentWebsite.id }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setFeedback({
          message: `Live crawl completed for ${currentWebsite.domain}. Discovered ${json.stats?.totalPages || 0} pages and ${json.stats?.totalInternalLinks || 0} internal links.`,
          ok: true,
        });
      } else {
        setFeedback({ message: json.error || "Link analysis failed.", ok: false });
      }
    } catch (err: any) {
      setFeedback({ message: "Live analysis request failed.", ok: false });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = (id: string) => {
    setApprovedOpps((prev) => [...prev, id]);
    setSelectedOpp(null);
    setFeedback({
      message: "Internal link injection approved! Queued for execution on CMS.",
      ok: true,
    });
  };

  const stats = data?.stats || {
    totalInternalLinks: 0,
    totalPages: 0,
    avgLinksPerPage: "0",
    orphanCount: 0,
    opportunityCount: 0,
  };

  const opportunities = data?.opportunities || [];
  const orphans = data?.orphans || [];
  const pages = data?.pages || [];

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">On-Page Architecture</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Internal Link Control Hub</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Internal Link Control Hub
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <LinkIcon className="w-3 h-3 text-indigo-600" />
                PageRank Equity Router
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `Live link architecture, crawl depth analysis, and contextual link bridges for ${currentWebsite.domain}.`
                : "Connect your website to map internal link equity."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {currentWebsite && (
              <div className="hidden lg:flex items-center gap-2 bg-white border border-slate-200/80 pl-2 pr-3 py-1.5 rounded-lg shadow-2xs">
                <WebsiteFavicon domain={currentWebsite.domain} className="w-4 h-4 rounded" size={24} />
                <span className="text-xs font-semibold text-slate-800">{currentWebsite.domain}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
              </div>
            )}

            <button
              onClick={handleRunAnalysis}
              disabled={analyzing || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-all shadow-xs flex items-center gap-2 active:scale-[0.98]"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Crawling Link Graph...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Run Link Analysis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center justify-between border transition-all animate-in fade-in duration-200 shadow-2xs ${
              feedback.ok
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-4"
            >
              ✕
            </button>
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
                The Internal Linking Agent scans your live website to detect crawl depth, internal link counts, and orphan pages.
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
        ) : loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-medium">Scanning live internal link graph for {currentWebsite.domain}...</p>
          </div>
        ) : (
          <>
            {/* KPI STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Total Internal Links
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {stats.totalInternalLinks.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                    Live Crawled
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Analyzed Pages
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {stats.totalPages}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    Reachable
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Avg Links / Page
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {stats.avgLinksPerPage}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                    Link Density
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Orphan Pages
                </span>
                <div className="flex items-baseline justify-between">
                  <span className={`text-2xl font-bold font-mono tabular-nums ${
                    stats.orphanCount > 0 ? "text-amber-600" : "text-slate-900"
                  }`}>
                    {stats.orphanCount}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                    stats.orphanCount > 0
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-emerald-700 bg-emerald-50 border-emerald-200"
                  }`}>
                    {stats.orphanCount === 0 ? "All Linked" : "Need Links"}
                  </span>
                </div>
              </div>
            </div>

            {/* ORPHAN PAGES DETECTION */}
            {orphans.length > 0 && (
              <section className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span>Orphan &amp; Under-Linked Pages ({orphans.length})</span>
                  </h2>
                  <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Attention Needed
                  </span>
                </div>
                <div className="space-y-2">
                  {orphans.map((orphan: any, i: number) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200/80 gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">{orphan.title || "Page"}</span>
                          <span className="font-mono text-slate-400 text-[11px] truncate max-w-xs">{orphan.url}</span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{orphan.recommendation}</p>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 whitespace-nowrap self-start sm:self-center">
                        {orphan.incomingLinks} incoming link{orphan.incomingLinks === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* CONTEXTUAL LINK OPPORTUNITIES */}
            <section className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Recommended Contextual Link Bridges ({opportunities.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-converting contextual anchor bridges between existing articles to funnel equity to high-intent targets.
                </p>
              </div>

              {opportunities.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg text-slate-500 text-xs border border-slate-200/80">
                  No contextual link gaps detected. All existing articles have balanced outbound connections.
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.map((opp: any) => {
                    const isApproved = approvedOpps.includes(opp.id);
                    return (
                      <div
                        key={opp.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${
                          isApproved
                            ? "bg-emerald-50/50 border-emerald-200"
                            : "bg-white border-slate-200/80 hover:border-slate-300"
                        }`}
                      >
                        <div className="space-y-2 flex-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200/80">
                              {opp.impact} Impact
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/80">
                              {opp.confidence} Confidence
                            </span>
                            <span className="text-[11px] font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded font-medium">
                              Anchor: &quot;{opp.anchor}&quot;
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-slate-700 flex-wrap">
                            <span className="font-semibold text-slate-900">{opp.sourceTitle || opp.source}</span>
                            <span className="text-slate-400">→</span>
                            <span className="text-indigo-600 font-semibold">{opp.targetTitle || opp.target}</span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">{opp.reason}</p>
                        </div>

                        <div className="shrink-0 w-full md:w-auto">
                          {isApproved ? (
                            <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedOpp(opp)}
                              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-[0.98]"
                            >
                              <GitPullRequest className="w-3.5 h-3.5" />
                              <span>Review &amp; Approve</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* CRAWLED PAGES & LINK MATRIX */}
            <section className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                  <span>Crawled Pages &amp; Inbound/Outbound Link Matrix ({pages.length})</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/75 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                      <th className="py-2.5 px-4">Page Title &amp; URL</th>
                      <th className="py-2.5 px-4 text-right">Inbound Links</th>
                      <th className="py-2.5 px-4 text-right">Outbound Links</th>
                      <th className="py-2.5 px-4 text-right">Word Count</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pages.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-slate-900 truncate max-w-md">{p.title || "Untitled Document"}</p>
                          <p className="font-mono text-[11px] text-slate-400 truncate max-w-md">{p.url}</p>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {p.internalLinksIn ?? 0}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-600">
                          {p.internalLinksOut ?? 0}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-600 font-mono">
                          {p.wordCount ? p.wordCount.toLocaleString() : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {(p.internalLinksIn ?? 0) <= 1 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              Low Equity
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Connected
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* APPROVAL MODAL */}
        {selectedOpp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 mb-0.5 flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-indigo-600" />
                    <span>Approve Contextual Internal Link</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 font-mono truncate max-w-md">
                    {selectedOpp.sourceTitle || selectedOpp.source} → {selectedOpp.targetTitle || selectedOpp.target}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOpp(null)}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 text-sm font-semibold"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 bg-slate-50/50 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Contextual Justification
                  </span>
                  <p className="text-slate-800 leading-relaxed">{selectedOpp.reason}</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Diff Preview
                    </span>
                    <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/80">
                      Anchor: &quot;{selectedOpp.anchor}&quot;
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="border border-rose-200 bg-rose-50/50 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider block">
                        Original Text
                      </span>
                      <p className="font-mono text-slate-700 text-[11px] leading-relaxed">{selectedOpp.before}</p>
                    </div>
                    <div className="border border-emerald-200 bg-emerald-50/50 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider block">
                        Injected Bridge
                      </span>
                      <p className="font-mono text-emerald-900 font-semibold text-[11px] leading-relaxed">{selectedOpp.after}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white rounded-b-2xl flex items-center justify-between">
                <button
                  onClick={() => setSelectedOpp(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleApprove(selectedOpp.id)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors flex items-center gap-2"
                >
                  <span>Approve &amp; Inject Link</span>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
