"use client";

import { Sidebar } from "@/components/Sidebar";
import { Search, Globe, CheckCircle2, AlertTriangle, ShieldCheck, FileText, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

export default function SiteExplorerPage() {
  const [urlInput, setUrlInput] = useState("https://my-saas-company.com");
  const [loading, setLoading] = useState(false);
  const [pageResult, setPageResult] = useState<any>({
    url: "https://my-saas-company.com",
    title: "Project Management Software for Modern Teams | Acme Corp",
    meta_description: "Streamline team workflows with automated project tracking, sprint planning, and real-time collaboration.",
    status_code: 200,
    is_indexable: true,
    h1: ["Project Management Software for Modern Teams"],
    h2: ["Key Features", "Why Teams Choose Acme", "Customer Case Studies", "Pricing Plans"],
    canonical: "https://my-saas-company.com",
    internal_links_count: 42,
    external_links_count: 8,
    word_count: 1420,
    load_time: "0.8s"
  });

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/agent/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput })
      });
      if (res.ok) {
        const data = await res.json();
        setPageResult(data.page);
      }
    } catch (err) {
      console.error("Crawl failed:", err);
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
            Crawl any URL to extract on-page signals, heading hierarchy, meta tags, and indexability.
          </p>
        </header>

        {/* URL Input Form */}
        <form onSubmit={handleCrawl} className="bg-white border border-neutral-200 rounded-2xl p-4 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Globe className="w-5 h-5 text-neutral-500 absolute left-3.5 top-3" />
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://my-saas-company.com/blog/article"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-11 pr-4 text-sm text-neutral-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Crawling Page..." : "Analyze URL"}
            </button>
          </div>
        </form>

        {/* Page Analysis Results */}
        {pageResult && (
          <div className="space-y-6">
            {/* Overview Banner */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold block mb-1">HTTP Status</span>
                <span className="text-emerald-600 font-bold text-lg flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {pageResult.status_code || 200} OK
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold block mb-1">Indexability</span>
                <span className="text-emerald-600 font-bold text-lg flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Indexable
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold block mb-1">Word Count</span>
                <span className="text-neutral-900 font-bold text-lg">{pageResult.word_count || 1420} words</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-semibold block mb-1">Internal Links</span>
                <span className="text-indigo-600 font-bold text-lg">{pageResult.internal_links_count || 42} links</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Metadata */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold text-neutral-900 text-sm">On-Page Meta Tags</h3>
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Title Tag</span>
                    <p className="text-sm font-medium text-neutral-900 bg-neutral-50 p-3 rounded-xl border border-neutral-200">{pageResult.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Meta Description</span>
                    <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-xl border border-neutral-200">{pageResult.meta_description}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Canonical Tag</span>
                    <p className="text-xs font-mono text-neutral-500 bg-neutral-50 p-3 rounded-xl border border-neutral-200">{pageResult.canonical}</p>
                  </div>
                </div>
              </div>

              {/* Right Column: Heading Structure */}
              <div className="lg:col-span-5">
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold text-neutral-900 text-sm">Heading Structure</h3>
                  <div>
                    <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block mb-2">H1 Tag</span>
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-600 p-3 rounded-xl text-xs font-medium">
                      {pageResult.h1?.[0] || "None found"}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-2">H2 Tags ({pageResult.h2?.length || 4})</span>
                    <div className="space-y-2">
                      {(pageResult.h2 || []).map((h2: string, i: number) => (
                        <div key={i} className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                          {h2}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
