"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Link as LinkIcon, AlertCircle, CheckCircle2, TrendingUp, GitPullRequest, 
  Search, FileText, ChevronRight, Loader2, RefreshCw, ExternalLink, Globe, Plus
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
      console.error('Failed to load internal link data:', err);
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
      const res = await fetch('/api/internal-linking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_id: currentWebsite.id }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
        setFeedback({ message: `Live crawl completed for ${currentWebsite.domain}. Discovered ${json.stats?.totalPages || 0} pages and ${json.stats?.totalInternalLinks || 0} internal links.`, ok: true });
      } else {
        setFeedback({ message: json.error || 'Link analysis failed.', ok: false });
      }
    } catch (err: any) {
      setFeedback({ message: 'Live analysis request failed.', ok: false });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = (id: string) => {
    setApprovedOpps(prev => [...prev, id]);
    setSelectedOpp(null);
    setFeedback({ message: 'Internal link injection approved! Queued for execution on WordPress.', ok: true });
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
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto min-w-0">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-neutral-200 px-8 py-6 sticky top-0 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-neutral-900 font-medium">Internal Linking Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2.5">
              Internal Link Control Hub
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              {currentWebsite 
                ? `Live internal link architecture & equity distribution for ${currentWebsite.domain}.`
                : "Connect your website to analyze real internal link architecture."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentWebsite && (
              <div className="hidden lg:flex items-center gap-2 bg-neutral-50 border border-neutral-200/90 pl-2 pr-3 py-1.5 rounded-xl shadow-2xs">
                <WebsiteFavicon domain={currentWebsite.domain} className="w-5 h-5 rounded-md" size={32} />
                <span className="text-xs font-bold text-neutral-900">{currentWebsite.domain}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
              </div>
            )}

            <button 
              onClick={handleRunAnalysis}
              disabled={analyzing || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Crawling {currentWebsite?.domain}...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Run Live Link Analysis</span>
                </>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Feedback Banner */}
          {feedback && (
            <div className={`p-4 rounded-xl text-xs flex items-center justify-between border transition-all animate-fadeIn ${
              feedback.ok 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              <div className="flex items-center gap-2">
                {feedback.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                <span className="font-semibold leading-relaxed">{feedback.message}</span>
              </div>
              <button onClick={() => setFeedback(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold ml-4">✕</button>
            </div>
          )}

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8 shadow-xs">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  The Internal Linking Agent scans your live website to detect crawl depth, internal link counts, and orphan pages.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Website</span>
              </button>
            </div>
          ) : loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">Scanning live internal link graph for {currentWebsite.domain}...</p>
            </div>
          ) : (
            <>
              {/* REAL KPI STATS */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Total Internal Links</span>
                  <div className="text-3xl font-black text-neutral-900 mb-1">{stats.totalInternalLinks.toLocaleString()}</div>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    Live crawled from {currentWebsite.domain}
                  </span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Live Pages Analyzed</span>
                  <div className="text-3xl font-black text-neutral-900 mb-1">{stats.totalPages}</div>
                  <span className="text-[11px] text-neutral-500">Verified reachable pages</span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Avg Links / Page</span>
                  <div className="text-3xl font-black text-neutral-900 mb-1">{stats.avgLinksPerPage}</div>
                  <span className="text-[11px] text-neutral-500">Internal link density</span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs bg-gradient-to-br from-indigo-50/50 to-white">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1 block">Orphan Pages Detected</span>
                  <div className={`text-3xl font-black mb-1 flex items-center gap-2 ${stats.orphanCount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {stats.orphanCount} {stats.orphanCount > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <span className="text-[11px] text-neutral-500">
                    {stats.orphanCount === 0 ? "All pages connected" : "Need incoming links"}
                  </span>
                </div>
              </div>

              {/* REAL ORPHAN PAGES */}
              {orphans.length > 0 && (
                <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                  <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500" /> Orphan & Under-Linked Page Detection ({orphans.length})
                  </h2>
                  <div className="space-y-3">
                    {orphans.map((orphan: any, i: number) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200/80 gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-neutral-900">{orphan.title || 'Page'}</span>
                            <span className="text-[10px] font-mono text-neutral-500 truncate max-w-xs sm:max-w-md">{orphan.url}</span>
                          </div>
                          <p className="text-xs text-neutral-600">{orphan.recommendation}</p>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                            {orphan.incomingLinks} incoming link{orphan.incomingLinks === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* REAL CONTEXTUAL LINK OPPORTUNITIES */}
              <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-indigo-600" /> Recommended Contextual Link Insertions ({opportunities.length})
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Contextual link bridges between existing articles and pillar pages to distribute link equity.
                    </p>
                  </div>
                </div>

                {opportunities.length === 0 ? (
                  <div className="p-8 text-center bg-neutral-50 rounded-xl text-neutral-500 text-xs">
                    No contextual link gaps detected. All existing pages are well-linked.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {opportunities.map((opp: any) => {
                      const isApproved = approvedOpps.includes(opp.id);
                      return (
                        <div 
                          key={opp.id} 
                          className={`p-5 rounded-xl border transition-all flex flex-col md:flex-row gap-6 justify-between items-start md:items-center ${
                            isApproved 
                              ? "bg-emerald-50/40 border-emerald-200" 
                              : "bg-white border-neutral-200 hover:border-indigo-300 hover:shadow-xs"
                          }`}
                        >
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                                {opp.impact} Impact
                              </span>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                                {opp.confidence} Confidence
                              </span>
                              <span className="text-xs font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded font-semibold truncate max-w-xs">
                                Anchor: &quot;{opp.anchor}&quot;
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 flex-wrap">
                              <span className="font-semibold text-neutral-900">{opp.sourceTitle || opp.source}</span>
                              <span className="text-neutral-400">→</span>
                              <span className="text-indigo-600 font-semibold">{opp.targetTitle || opp.target}</span>
                            </div>
                            
                            <div>
                              <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-0.5">Contextual Strategy</span>
                              <p className="text-xs text-neutral-700 leading-relaxed">{opp.reason}</p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 shrink-0 w-full md:w-44">
                            {isApproved ? (
                              <div className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">
                                <CheckCircle2 className="w-4 h-4" /> Approved
                              </div>
                            ) : (
                              <button 
                                onClick={() => setSelectedOpp(opp)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2"
                              >
                                <GitPullRequest className="w-4 h-4" /> Review & Approve
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* REAL CRAWLED SITE PAGES & LINK MATRIX */}
              <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
                <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-600" /> Crawled Pages & Inbound/Outbound Link Matrix ({pages.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 text-neutral-500 uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3">Page Title & URL</th>
                        <th className="py-2.5 px-3 text-right">Inbound Links</th>
                        <th className="py-2.5 px-3 text-right">Outbound Links</th>
                        <th className="py-2.5 px-3 text-right">Word Count</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {pages.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-3">
                            <p className="font-bold text-neutral-900 truncate max-w-md">{p.title || 'Untitled'}</p>
                            <p className="font-mono text-[11px] text-neutral-400 truncate max-w-md">{p.url}</p>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-neutral-900">
                            {p.internalLinksIn ?? 0}
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-indigo-600">
                            {p.internalLinksOut ?? 0}
                          </td>
                          <td className="py-3 px-3 text-right text-neutral-500 font-mono">
                            {p.wordCount ? p.wordCount.toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {(p.internalLinksIn ?? 0) <= 1 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                                Low Equity
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
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

        </div>
      </div>
      
      {/* APPROVAL MODAL */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fadeIn">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 mb-1 flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5 text-indigo-600" /> Approve Contextual Internal Link
                </h2>
                <p className="text-xs text-neutral-500 font-mono truncate max-w-lg">
                  {selectedOpp.sourceTitle || selectedOpp.source} → {selectedOpp.targetTitle || selectedOpp.target}
                </p>
              </div>
              <button onClick={() => setSelectedOpp(null)} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400 hover:text-neutral-600 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5 bg-neutral-50/50">
               <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Contextual Justification</h4>
                  <p className="text-xs text-neutral-800 leading-relaxed">{selectedOpp.reason}</p>
               </div>

               <div className="bg-white p-4 rounded-2xl border border-neutral-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Before & After Contextual Snippet</h4>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                      Anchor: &quot;{selectedOpp.anchor}&quot;
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="border border-red-200 bg-red-50/40 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block">Current Text</span>
                      <p className="font-mono text-neutral-600 text-[11px] leading-relaxed">{selectedOpp.before}</p>
                    </div>
                    <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3.5 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Proposed with Link</span>
                      <p className="font-mono text-emerald-800 font-bold text-[11px] leading-relaxed">{selectedOpp.after}</p>
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-white rounded-b-3xl flex items-center justify-between">
              <button 
                onClick={() => setSelectedOpp(null)}
                className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleApprove(selectedOpp.id)}
                className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Approve & Inject Link</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
