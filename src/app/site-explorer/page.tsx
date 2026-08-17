"use client";

import { Sidebar } from "@/components/Sidebar";
import { Search, Globe, CheckCircle2, AlertTriangle, ShieldCheck, FileText, ArrowRight, Loader2, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function SiteExplorerPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageResult, setPageResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentWebsite) {
      setUrlInput(currentWebsite.url);
    }
  }, [currentWebsite?.url]);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setPageResult(data.page || data.result);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to inspect URL");
      }
    } catch (err: any) {
      setError(err.message || "Failed to inspect URL");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>SEO Analytics</span>
            <span>&gt;</span>
            <span className="text-neutral-700">Site Explorer</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Site &amp; URL Health Explorer</h1>
          <p className="text-neutral-500 text-xs mt-0.5">
            Extract on-page SEO signals, heading hierarchy, meta tags, and indexability for any URL on your site.
          </p>
        </header>

        {/* Input Bar */}
        <form onSubmit={handleCrawl} className="flex gap-2 max-w-2xl mb-8">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/blog/article"
            required
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
          />
          <button
            type="submit"
            disabled={loading || !urlInput.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Inspect URL
          </button>
        </form>

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs mb-8">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STATE 1: NO INSPECTION RUN YET ── */}
        {!pageResult && !loading ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
            <Globe className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">Enter a URL to Inspect</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Enter any page URL above to analyze its live title, meta description, heading structure, and status code.
            </p>
          </div>
        ) : pageResult && (
          /* ── STATE 2: REAL INSPECTED URL RESULT ── */
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">HTTP Status</span>
                <div className="text-2xl font-black text-emerald-600">{pageResult.status_code || 200} OK</div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Indexability</span>
                <div className="text-2xl font-black text-neutral-900">{pageResult.is_indexable ? "Indexable" : "Noindex"}</div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Internal Links</span>
                <div className="text-2xl font-black text-neutral-900">{pageResult.internal_links_count || 0}</div>
              </div>
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Word Count</span>
                <div className="text-2xl font-black text-neutral-900">{pageResult.word_count || "N/A"}</div>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Title Tag</span>
                <p className="font-semibold text-neutral-900 text-sm">{pageResult.title || "No Title Tag Detected"}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Meta Description</span>
                <p className="text-neutral-700">{pageResult.meta_description || "No Meta Description Detected"}</p>
              </div>
              {pageResult.h1 && (
                <div>
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">H1 Headings</span>
                  <ul className="list-disc list-inside text-neutral-700">
                    {Array.isArray(pageResult.h1) ? pageResult.h1.map((h: string, i: number) => <li key={i}>{h}</li>) : <li>{pageResult.h1}</li>}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
