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
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageResult, setPageResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (currentWebsite) {
      setUrlInput(currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : ""));
      setPageResult(null);
      setError(null);
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
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Research</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Site Explorer</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Site &amp; URL Explorer
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Live DOM inspection, metadata specifications, and Google SERP renderings for ${currentWebsite.domain}`
                  : "Inspect on-page metadata, headings hierarchy, and Google SERP snippets."}
              </p>
            </div>
          </header>

          {/* Search / URL Inspector Bar */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs space-y-3">
            <form onSubmit={(e) => handleCrawl(e)} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/blog/article-slug"
                  required
                  className="w-full bg-neutral-50/70 border border-neutral-300 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 shadow-2xs transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !urlInput.trim()}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span>{loading ? "Inspecting…" : "Inspect page"}</span>
              </button>
            </form>

            {/* Quick Inspect shortcuts */}
            {currentWebsite && (
              <div className="flex items-center gap-2 text-[11px] text-neutral-500 pt-1">
                <span className="font-medium text-neutral-400">Quick inspect:</span>
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
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ── STATE 1: NO INSPECTION RUN YET ── */}
          {!pageResult && !loading ? (
            <div className="mx-auto mt-6 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-2xs">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Enter a URL to inspect</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Extract live on-page metadata, indexability headers, headings structure, and realistic Google SERP previews.
              </p>
              {currentWebsite && (
                <button
                  onClick={() => handleCrawl()}
                  className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Inspect {currentWebsite.domain}</span>
                </button>
              )}
            </div>
          ) : pageResult && (
            /* ── STATE 2: REAL INSPECTED URL RESULT ── */
            <div className="space-y-6">
              {/* Stat strip */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                <div className="p-5">
                  <div className="text-[13px] text-neutral-500">HTTP Status</div>
                  <div className={`mt-1.5 text-[28px] font-semibold leading-8 tabular-nums ${
                    (pageResult.status_code || 200) < 400 ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    {pageResult.status_code || 200}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">
                    {(pageResult.status_code || 200) === 200 ? "HTTP 200 OK" : "Response Code"}
                  </div>
                </div>

                <div className="p-5 border-l border-neutral-200">
                  <div className="text-[13px] text-neutral-500">Indexability</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${pageResult.is_indexable !== false ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <span className="text-[22px] font-semibold leading-8 text-neutral-900">
                      {pageResult.is_indexable !== false ? "Indexable" : "Noindex"}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Robots &amp; Canonical verified</div>
                </div>

                <div className="p-5 border-t border-neutral-200 lg:border-t-0 lg:border-l">
                  <div className="text-[13px] text-neutral-500">Word count</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                    {pageResult.word_count ? Number(pageResult.word_count).toLocaleString() : "—"}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Body copy length</div>
                </div>

                <div className="p-5 border-l border-t border-neutral-200 lg:border-t-0">
                  <div className="text-[13px] text-neutral-500">Internal links</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                    {pageResult.internal_links_count ?? "—"}
                  </div>
                  <div className="mt-1.5 text-xs text-neutral-500">Links discovered in DOM</div>
                </div>
              </section>

              {/* Google SERP Snippet Preview */}
              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-semibold text-sm text-neutral-900">Google SERP Snippet Preview</h3>
                  </div>

                  <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs">
                    <button
                      onClick={() => setPreviewDevice("desktop")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                        previewDevice === "desktop" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "text-neutral-500"
                      }`}
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      onClick={() => setPreviewDevice("mobile")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
                        previewDevice === "mobile" ? "bg-white text-neutral-900 shadow-2xs font-semibold" : "text-neutral-500"
                      }`}
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                {/* Realistic Google SERP Card */}
                <div className={`p-4 bg-neutral-50/70 border border-neutral-200/80 rounded-xl space-y-1 ${
                  previewDevice === "mobile" ? "max-w-md" : "max-w-2xl"
                }`}>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 mb-0.5">
                    <span className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-700">
                      G
                    </span>
                    <span className="truncate font-mono text-[11px] text-neutral-500">{urlInput}</span>
                  </div>
                  <h4 className="text-base text-blue-800 hover:underline cursor-pointer font-medium leading-snug">
                    {pageResult.title || "Untitled Document"}
                  </h4>
                  <p className="text-xs text-neutral-600 leading-relaxed pt-0.5">
                    {pageResult.meta_description || "No meta description provided for this URL. Google will automatically generate a snippet based on page body content."}
                  </p>
                </div>
              </div>

              {/* Detailed Metadata & Heading Hierarchy */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Metadata Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <h4 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Metadata Specifications</span>
                    </h4>
                    <span className="text-[11px] text-neutral-400 font-mono">HTML HEAD</span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
                          Title Tag ({pageResult.title?.length || 0} chars)
                        </span>
                        <button
                          onClick={() => copyToClipboard(pageResult.title || "", "title")}
                          className="text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          {copiedField === "title" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="p-2.5 bg-neutral-50/70 rounded-lg border border-neutral-200 font-medium text-neutral-900">
                        {pageResult.title || <span className="text-rose-500">Missing Title Tag</span>}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
                          Meta Description ({pageResult.meta_description?.length || 0} chars)
                        </span>
                        <button
                          onClick={() => copyToClipboard(pageResult.meta_description || "", "desc")}
                          className="text-neutral-400 hover:text-neutral-600 transition-colors"
                        >
                          {copiedField === "desc" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="p-2.5 bg-neutral-50/70 rounded-lg border border-neutral-200 text-neutral-700 leading-relaxed">
                        {pageResult.meta_description || <span className="text-amber-600">Missing Meta Description</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                    <Link
                      href="/content-planner"
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                    >
                      <PenTool className="w-3 h-3 text-neutral-400" />
                      <span>Open in Planner</span>
                    </Link>
                  </div>
                </div>

                {/* Heading Hierarchy Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                    <h4 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-600" />
                      <span>Heading Hierarchy</span>
                    </h4>
                    <span className="text-[11px] text-neutral-400 font-mono">H1–H3</span>
                  </div>

                  <div className="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
                    {pageResult.h1 ? (
                      <div>
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px] block mb-1">
                          Primary H1
                        </span>
                        <div className="p-2.5 bg-neutral-50/70 rounded-lg border border-neutral-200 font-semibold text-neutral-900">
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
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px] block mb-1">
                          Subheadings
                        </span>
                        {pageResult.headings.slice(0, 6).map((h: any, i: number) => (
                          <div key={i} className="p-2 bg-neutral-50/70 rounded border border-neutral-200 text-[11px] flex items-center gap-2">
                            <span className="font-mono text-indigo-600 font-bold text-[10px]">[{h.tag?.toUpperCase() || "H2"}]</span>
                            <span className="text-neutral-800 truncate">{h.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
