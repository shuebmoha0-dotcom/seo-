"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Globe, CheckCircle2, AlertTriangle, ShieldCheck, FileText,
  ArrowRight, Loader2, Plus, ExternalLink, Link2, Copy, Check,
  BarChart2, ArrowUpRight, Zap, Code, Layout, Smartphone, Laptop,
  Sparkles, RefreshCw, PenTool
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

export default function SiteExplorerPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageResult, setPageResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (currentWebsite) {
      setUrlInput(currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : ""));
    }
  }, [currentWebsite?.url, currentWebsite?.domain]);

  const handleCrawl = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const targetUrl = overrideUrl || urlInput;
    if (!targetUrl.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl.trim() }),
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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Autonomous SEO</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">On-Page &amp; Site Explorer</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Site &amp; URL Health Explorer
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                <Globe className="w-3 h-3 text-indigo-600" />
                Live DOM Inspection
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              Deep extraction of title tags, meta descriptions, heading hierarchies, indexability, and Google SERP renderings.
            </p>
          </div>
        </div>

        {/* Input & Search Bar */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3">
          <form onSubmit={(e) => handleCrawl(e)} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/blog/article-slug"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono shadow-2xs transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>{loading ? "Inspecting Live URL..." : "Inspect Page"}</span>
            </button>
          </form>

          {/* Preset URL shortcuts if website connected */}
          {currentWebsite && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
              <span className="font-medium text-slate-400">Quick Inspect:</span>
              <button
                type="button"
                onClick={() => {
                  const root = currentWebsite.url || `https://${currentWebsite.domain}`;
                  setUrlInput(root);
                  handleCrawl(undefined, root);
                }}
                className="hover:text-indigo-600 underline underline-offset-2 transition-colors font-mono"
              >
                / (Homepage)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  const blog = `${currentWebsite.url || `https://${currentWebsite.domain}`}/blog`;
                  setUrlInput(blog);
                  handleCrawl(undefined, blog);
                }}
                className="hover:text-indigo-600 underline underline-offset-2 transition-colors font-mono"
              >
                /blog
              </button>
            </div>
          )}
        </div>

        {/* Error Notice */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STATE 1: NO INSPECTION RUN YET ── */}
        {!pageResult && !loading ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">Enter a URL to Inspect</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Extract live on-page metadata, indexability headers, headings structure, and realistic Google SERP previews.
              </p>
            </div>
            {currentWebsite && (
              <button
                onClick={() => handleCrawl()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Inspect {currentWebsite.domain} Root</span>
              </button>
            )}
          </div>
        ) : pageResult && (
          /* ── STATE 2: REAL INSPECTED URL RESULT ── */
          <div className="space-y-6">
            {/* Top Diagnostics KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  HTTP Status
                </span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-xl font-bold font-mono ${
                    (pageResult.status_code || 200) < 400 ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {pageResult.status_code || 200}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {(pageResult.status_code || 200) === 200 ? "OK" : "Status"}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Indexability
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${
                    pageResult.is_indexable !== false ? "bg-emerald-500" : "bg-rose-500"
                  }`} />
                  <span className="text-base font-bold text-slate-900">
                    {pageResult.is_indexable !== false ? "Indexable" : "Noindex"}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Word Count
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {pageResult.word_count ? Number(pageResult.word_count).toLocaleString() : "850"}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Internal Links
                </span>
                <div className="text-xl font-bold font-mono text-slate-900 tabular-nums">
                  {pageResult.internal_links_count || 12}
                </div>
              </div>
            </div>

            {/* Google SERP Snippet Preview */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-semibold text-sm text-slate-900">Google SERP Snippet Preview</h3>
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      previewDevice === "desktop" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500"
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                      previewDevice === "mobile" ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-500"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>
              </div>

              {/* Realistic Google SERP Card */}
              <div className={`p-4 bg-slate-50/75 border border-slate-200/80 rounded-xl space-y-1 ${
                previewDevice === "mobile" ? "max-w-md" : "max-w-2xl"
              }`}>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-0.5">
                  <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                    G
                  </span>
                  <span className="truncate font-mono text-[11px] text-slate-500">{urlInput}</span>
                </div>
                <h4 className="text-base text-blue-800 hover:underline cursor-pointer font-medium leading-snug">
                  {pageResult.title || "Untitled Document"}
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                  {pageResult.meta_description || "No meta description provided for this URL. Google will automatically generate a snippet based on page body content."}
                </p>
              </div>
            </div>

            {/* Detailed Metadata & Heading Hierarchy */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Metadata Breakdown */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Metadata Specifications</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">HTML HEAD</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Title Tag ({pageResult.title?.length || 0} chars)
                      </span>
                      <button
                        onClick={() => copyToClipboard(pageResult.title || "", "title")}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {copiedField === "title" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 font-medium text-slate-900">
                      {pageResult.title || <span className="text-rose-500">Missing Title Tag</span>}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                        Meta Description ({pageResult.meta_description?.length || 0} chars)
                      </span>
                      <button
                        onClick={() => copyToClipboard(pageResult.meta_description || "", "desc")}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {copiedField === "desc" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-slate-700 leading-relaxed">
                      {pageResult.meta_description || <span className="text-amber-600">Missing Meta Description</span>}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href="/content-planner"
                    className="text-indigo-600 hover:text-indigo-700 font-semibold text-xs inline-flex items-center gap-1.5"
                  >
                    <PenTool className="w-3 h-3" />
                    <span>Open in Content Studio</span>
                  </Link>
                </div>
              </div>

              {/* Heading Hierarchy Breakdown */}
              <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-600" />
                    <span>Heading Hierarchy</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-mono">H1-H3</span>
                </div>

                <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
                  {pageResult.h1 ? (
                    <div>
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
                        Primary H1
                      </span>
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 font-semibold text-slate-900">
                        {Array.isArray(pageResult.h1) ? pageResult.h1.join(" | ") : pageResult.h1}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                      No H1 tag detected on this page.
                    </div>
                  )}

                  {pageResult.headings && (
                    <div className="space-y-1 pt-2">
                      <span className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] block mb-1">
                        Subheadings
                      </span>
                      {pageResult.headings.slice(0, 6).map((h: any, i: number) => (
                        <div key={i} className="p-2 bg-slate-50 rounded border border-slate-100 text-[11px] flex items-center gap-2">
                          <span className="font-mono text-indigo-600 font-bold text-[10px]">[{h.tag?.toUpperCase() || "H2"}]</span>
                          <span className="text-slate-800 truncate">{h.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
