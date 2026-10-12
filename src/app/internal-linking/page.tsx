"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Link as LinkIcon, AlertCircle, CheckCircle2, TrendingUp, GitPullRequest,
  Search, FileText, ChevronRight, Loader2, RefreshCw, ExternalLink, Globe, Plus,
  ArrowRight, ShieldCheck, Zap, X
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
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Content</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Internal Links</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Internal Link Control Hub
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Live link architecture, crawl depth analysis, and contextual link bridges for ${currentWebsite.domain}`
                  : "Connect a website to map internal link equity and orphan pages."}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <button
                  onClick={handleRunAnalysis}
                  disabled={analyzing}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Crawling Link Graph…</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Run link analysis</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </header>

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
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded transition-colors ml-4"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-2xs">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect a website to begin</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                The Internal Linking Agent scans your live website to detect crawl depth, internal link counts, and orphan pages.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-xs font-medium">Scanning live internal link graph for {currentWebsite.domain}…</p>
            </div>
          ) : (
            <>
              {/* Stat strip */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                <div className="p-5">
                  <div className="text-[13px] text-neutral-500">Total internal links</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                    {stats.totalInternalLinks.toLocaleString()}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Discovered across DOM</div>
                </div>

                <div className="p-5 border-l border-neutral-200">
                  <div className="text-[13px] text-neutral-500">Analyzed pages</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                    {stats.totalPages}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Reachable indexed URLs</div>
                </div>

                <div className="p-5 border-t border-neutral-200 lg:border-t-0 lg:border-l">
                  <div className="text-[13px] text-neutral-500">Avg links / page</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                    {stats.avgLinksPerPage}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Internal link density</div>
                </div>

                <div className="p-5 border-l border-t border-neutral-200 lg:border-t-0">
                  <div className="text-[13px] text-neutral-500">Orphan pages</div>
                  <div className={`mt-1.5 text-[28px] font-semibold leading-8 tabular-nums ${
                    stats.orphanCount > 0 ? "text-amber-600" : "text-neutral-900"
                  }`}>
                    {stats.orphanCount}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">
                    {stats.orphanCount === 0 ? "All pages linked" : "Pages lacking internal links"}
                  </div>
                </div>
              </section>

            {/* ORPHAN PAGES DETECTION */}
            {orphans.length > 0 && (
              <section className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
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
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200 gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">{orphan.title || "Page"}</span>
                          <span className="font-mono text-neutral-400 text-[11px] truncate max-w-xs">{orphan.url}</span>
                        </div>
                        <p className="text-neutral-600 text-[11px]">{orphan.recommendation}</p>
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
            <section className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  <span>Recommended Contextual Link Bridges ({opportunities.length})</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  High-converting contextual anchor bridges between existing articles to funnel equity to high-intent targets.
                </p>
              </div>

              {opportunities.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 rounded-lg text-neutral-500 text-xs border border-neutral-200">
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
                            : "bg-white border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        <div className="space-y-2 flex-1 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                              {opp.impact} Impact
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                              {opp.confidence} Confidence
                            </span>
                            <span className="text-[11px] font-mono text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded font-medium">
                              Anchor: &quot;{opp.anchor}&quot;
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-neutral-700 flex-wrap">
                            <span className="font-semibold text-neutral-900">{opp.sourceTitle || opp.source}</span>
                            <span className="text-neutral-400">→</span>
                            <span className="text-indigo-600 font-semibold">{opp.targetTitle || opp.target}</span>
                          </div>

                          <p className="text-[11px] text-neutral-600 leading-relaxed">{opp.reason}</p>
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
            <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                  <span>Crawled Pages &amp; Inbound/Outbound Link Matrix ({pages.length})</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-500 uppercase text-[10px] font-semibold tracking-wider">
                      <th className="py-2.5 px-4">Page Title &amp; URL</th>
                      <th className="py-2.5 px-4 text-right">Inbound Links</th>
                      <th className="py-2.5 px-4 text-right">Outbound Links</th>
                      <th className="py-2.5 px-4 text-right">Word Count</th>
                      <th className="py-2.5 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {pages.map((p: any, idx: number) => (
                      <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <p className="font-semibold text-neutral-900 truncate max-w-md">{p.title || "Untitled Document"}</p>
                          <p className="font-mono text-[11px] text-neutral-400 truncate max-w-md">{p.url}</p>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-neutral-900">
                          {p.internalLinksIn ?? 0}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-600">
                          {p.internalLinksOut ?? 0}
                        </td>
                        <td className="py-2.5 px-4 text-right text-neutral-600 font-mono">
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs">
            <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-xl shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
              <div className="p-5 border-b border-neutral-100 flex justify-between items-start">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 mb-0.5 flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-indigo-600" />
                    <span>Approve Contextual Internal Link</span>
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-mono truncate max-w-md">
                    {selectedOpp.sourceTitle || selectedOpp.source} → {selectedOpp.targetTitle || selectedOpp.target}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOpp(null)}
                  className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 bg-neutral-50 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Contextual Justification
                  </span>
                  <p className="text-neutral-800 leading-relaxed">{selectedOpp.reason}</p>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                      Diff Preview
                    </span>
                    <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      Anchor: &quot;{selectedOpp.anchor}&quot;
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="border border-rose-200 bg-rose-50/50 rounded-lg p-3 space-y-1">
                      <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wider block">
                        Original Text
                      </span>
                      <p className="font-mono text-neutral-700 text-[11px] leading-relaxed">{selectedOpp.before}</p>
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

              <div className="p-4 border-t border-neutral-100 bg-white rounded-b-xl flex items-center justify-between">
                <button
                  onClick={() => setSelectedOpp(null)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
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
        </div>
      </main>
    </div>
  );
}
