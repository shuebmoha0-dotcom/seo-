"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle,
  Globe,
  Plus,
  Loader2,
  ExternalLink,
  FileText,
  X,
  Bot,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function AeoMentionsPage() {
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();

  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attackingKeyword, setAttackingKeyword] = useState<string | null>(null);
  const [attackBanner, setAttackBanner] = useState<string | null>(null);
  const [optimizingDraftId, setOptimizingDraftId] = useState<string | null>(null);
  const [optimizingAll, setOptimizingAll] = useState(false);

  const handleOptimizeArticle = async (draftId: string) => {
    if (!currentWebsite || optimizingDraftId || optimizingAll) return;
    setOptimizingDraftId(draftId);
    setAttackBanner(null);
    setError(null);
    try {
      const res = await fetch("/api/aeo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          action: "optimize_article",
          draft_id: draftId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to optimize article for LLM mentions.");
      } else {
        setReport(data);
        setAttackBanner(data.message || "Article optimized for LLM Mentions & pushed live!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to optimize article for LLM mentions.");
    } finally {
      setOptimizingDraftId(null);
    }
  };

  const handleOptimizeAllArticles = async () => {
    if (!currentWebsite || optimizingAll || optimizingDraftId) return;
    setOptimizingAll(true);
    setAttackBanner(null);
    setError(null);
    try {
      const res = await fetch("/api/aeo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          action: "optimize_all",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to batch-optimize articles for LLM mentions.");
      } else {
        setReport(data);
        setAttackBanner(
          data.message || "All published articles upgraded with LLM Brand Entity Co-Occurrence, Comparison Tables, FAQ H3s, and Organization + FAQPage JSON-LD Schema!"
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to batch-optimize articles for LLM mentions.");
    } finally {
      setOptimizingAll(false);
    }
  };

  const fetchAeoReport = async () => {
    if (!currentWebsite) {
      setReport(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/aeo?website_id=${currentWebsite.id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to load AEO & AI Mentions report.");
      } else {
        setReport(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load AEO & AI Mentions report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAeoReport();
  }, [currentWebsite?.id]);

  const handleRunLiveScan = async (promptToTest?: string) => {
    if (!currentWebsite || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/aeo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          ...(promptToTest ? { custom_prompt: promptToTest } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Live AI mention scan failed.");
      } else {
        setReport(data);
        if (promptToTest) setCustomPrompt("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to run live AI mention scan.");
    } finally {
      setScanning(false);
    }
  };

  const handleWinAiCitation = async (keyword: string, rivals: string[]) => {
    if (!currentWebsite || attackingKeyword) return;
    setAttackingKeyword(keyword);
    setAttackBanner(null);
    setError(null);
    try {
      const rivalList = rivals?.length > 0 ? rivals.slice(0, 2).join(" and ") : "competitors";
      const res = await fetch("/api/autopilot/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          instruction: `Write and publish an AEO-engineered guide on "${keyword}" with a 45-word direct answer lead, comparison table, and FAQPage JSON-LD schema so ChatGPT, Perplexity, and Google AI Overviews cite ${currentWebsite.domain} over ${rivalList}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to launch AEO citation counter-article.");
      } else {
        setAttackBanner(
          data.message ||
            `AEO Counter-Article launched for "${keyword}": engineered with 45-word Direct Answer Lead, Comparison Table, and FAQPage JSON-LD Schema to win ChatGPT & Perplexity citations!`
        );
        await fetchAeoReport();
      }
    } catch (err: any) {
      setError(err.message || "Failed to launch AEO citation counter-article.");
    } finally {
      setAttackingKeyword(null);
    }
  };

  const kpis = report?.kpis || {
    ai_share_of_voice_pct: 0,
    prompts_with_brand_mention: 0,
    total_prompts_tracked: 0,
    avg_article_aeo_score: 0,
    aeo_ready_articles_count: 0,
    total_published_articles: 0,
    top_competitor_in_ai: "—",
  };

  const statCells = [
    {
      label: "AI Share of Voice",
      value: `${kpis.ai_share_of_voice_pct}%`,
      caption: "Brand citation rate across 4 AI engines",
    },
    {
      label: "Prompts Citing Brand",
      value: `${kpis.prompts_with_brand_mention} / ${kpis.total_prompts_tracked}`,
      caption: "Buyer queries mentioning your domain",
    },
    {
      label: "AEO Readiness Score",
      value: `${kpis.avg_article_aeo_score}%`,
      caption: `${kpis.aeo_ready_articles_count} of ${kpis.total_published_articles} posts fully AEO-structured`,
    },
    {
      label: "Top AI Competitor",
      value: kpis.top_competitor_in_ai || "—",
      caption: "Most cited rival in AI answers",
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
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">AEO &amp; AI Mentions</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900 flex items-center gap-2">
                <span>AEO &amp; AI Mentions Radar</span>
                <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-medium text-indigo-700">
                  ChatGPT · Perplexity · Google AI · Claude
                </span>
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Monitoring brand mentions, AI citations, and Answer Engine Optimization (AEO) readiness for ${currentWebsite.domain}`
                  : "Connect a website to track your visibility in ChatGPT, Perplexity, Claude, and Google AI Overviews."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <>
                  <a
                    href={`/llms.txt?domain=${encodeURIComponent(currentWebsite.domain)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[12px] font-medium text-neutral-700 shadow-2xs transition-colors hover:bg-neutral-50"
                  >
                    <FileText className="h-3.5 w-3.5 text-indigo-600" />
                    <span>View /llms.txt</span>
                    <ExternalLink className="h-3 w-3 text-neutral-400" />
                  </a>
                  <button
                    onClick={handleOptimizeAllArticles}
                    disabled={optimizingAll || scanning}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-3 text-[12px] font-medium text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {optimizingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    <span>{optimizingAll ? "Optimizing All Posts for LLMs…" : "Optimize All Posts for LLM Mentions"}</span>
                  </button>
                  <button
                    onClick={() => handleRunLiveScan()}
                    disabled={scanning}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>{scanning ? "Probing AI Engines…" : "Run live AI mention scan"}</span>
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Custom AI Prompt Tester Bar */}
          {currentWebsite && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customPrompt.trim()) handleRunLiveScan(customPrompt.trim());
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3 shadow-2xs"
            >
              <div className="flex items-center gap-2 flex-1 bg-white border border-neutral-200 rounded-lg px-3 py-1.5">
                <Bot className="w-4 h-4 text-indigo-600 shrink-0" />
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder={`Ask a buyer question to test ${currentWebsite.domain} on ChatGPT, Perplexity & Claude (e.g. "What are the best tools for...")`}
                  className="w-full text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none bg-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={scanning || !customPrompt.trim()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-50 transition-colors shrink-0"
              >
                <Search className="w-3.5 h-3.5 text-indigo-600" />
                <span>Test Prompt Across AI Engines</span>
              </button>
            </form>
          )}

          {/* Active Scan / Counter-Attack Banners */}
          {scanning && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-3 shadow-2xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-indigo-950">Probing ChatGPT, Claude, Perplexity &amp; Google AI Overviews…</h4>
                <p className="text-xs text-indigo-700">
                  Checking live brand mentions, competitor recommendations, and auditing published articles for AEO schema triggers…
                </p>
              </div>
            </div>
          )}

          {attackingKeyword && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3 shadow-2xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
              <div>
                <h4 className="text-xs font-semibold text-indigo-950">
                  Engineering AEO Citation Page for &ldquo;{attackingKeyword}&rdquo;…
                </h4>
                <p className="text-xs text-indigo-700">
                  Writing 45-word Direct Answer Lead + Comparison Table + Question FAQ H3s + FAQPage JSON-LD Schema and publishing live…
                </p>
              </div>
            </div>
          )}

          {attackBanner && !attackingKeyword && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-900 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold">AEO Citation Counter-Attack Deployed</p>
                  <p className="text-emerald-800 mt-0.5">{attackBanner}</p>
                </div>
              </div>
              <button onClick={() => setAttackBanner(null)} className="text-emerald-700 hover:text-emerald-950 p-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs shadow-2xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="font-semibold">AEO Radar Notice</p>
                <p className="text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Loading or Empty State */}
          {(websiteLoading || loading) && !report ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-24 bg-white border border-neutral-200 rounded-xl" />
              <div className="h-32 bg-white border border-neutral-200 rounded-xl" />
              <div className="h-96 bg-white border border-neutral-200 rounded-xl" />
            </div>
          ) : !currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect a website to track AI Mentions</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Monitor whether ChatGPT, Perplexity, Claude, and Google AI Overviews recommend your brand or your competitors.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : (
            <>
              {/* KPI Strip */}
              <section aria-label="AEO Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                {statCells.map((cell, i) => (
                  <div
                    key={cell.label}
                    className={`p-5 ${i % 2 === 1 ? "border-l border-neutral-200" : ""} ${i > 1 ? "border-t border-neutral-200 lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-neutral-200" : ""}`}
                  >
                    <div className="text-[13px] text-neutral-500">{cell.label}</div>
                    <div className="mt-1.5 text-[24px] font-semibold leading-8 tabular-nums text-neutral-900 truncate">{cell.value}</div>
                    <div className="mt-1.5 text-xs text-neutral-500">{cell.caption}</div>
                  </div>
                ))}
              </section>

              {/* 4 AI Engine Visibility Cards */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(report?.engine_summary || []).map((eng: any) => (
                  <div key={eng.engine} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-900">{eng.label}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          eng.visibility_pct >= 50
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : eng.visibility_pct > 0
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {eng.visibility_pct}% Cited
                      </span>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          eng.visibility_pct >= 50
                            ? "bg-emerald-600"
                            : eng.visibility_pct > 0
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${Math.max(6, eng.visibility_pct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>
                        Mentioned in <strong className="text-neutral-800">{eng.prompts_cited}/{eng.total_prompts}</strong> prompts
                      </span>
                      <span className="truncate max-w-[130px]">{eng.status}</span>
                    </div>
                  </div>
                ))}
              </section>

              {/* Live AI Prompt & Brand Mention Tracker */}
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      <span>Live AI Buyer Prompts &amp; Brand Mentions ({report?.brand_name || currentWebsite.domain})</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Real-time check of whether ChatGPT, Perplexity, Google AI Overviews, and Claude recommend your brand or your competitors
                    </p>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    Last checked: {report?.last_scanned_at ? new Date(report.last_scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                  </span>
                </div>

                <div className="divide-y divide-neutral-200">
                  {(report?.prompts || []).map((item: any) => {
                    const chatgpt = item.engines?.find((e: any) => e.engine === "chatgpt");
                    return (
                      <div key={item.id} className="p-5 space-y-3 hover:bg-neutral-50/50 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200">
                                {item.intent} prompt
                              </span>
                              <span className="text-xs font-semibold text-neutral-900">
                                &ldquo;{item.prompt}&rdquo;
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-500 flex items-center gap-3 flex-wrap">
                              <span>
                                Target Topic: <strong className="text-neutral-800">{item.target_keyword}</strong>
                              </span>
                              {item.competitors_cited?.length > 0 && (
                                <span>
                                  Competitors Cited in AI:{" "}
                                  <strong className="text-rose-700">{item.competitors_cited.join(", ")}</strong>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 4 Engine Status Pills + Counter-Attack Button */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {(item.engines || []).map((eng: any) => (
                              <span
                                key={eng.engine}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                                  eng.cited
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : "bg-neutral-100 text-neutral-600 border-neutral-200"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    eng.cited ? "bg-emerald-500" : "bg-neutral-400"
                                  }`}
                                />
                                <span>{eng.label}:</span>
                                <strong>{eng.cited ? "Cited" : "Not Cited"}</strong>
                              </span>
                            ))}

                            <button
                              type="button"
                              onClick={() => handleWinAiCitation(item.target_keyword, item.competitors_cited || [])}
                              disabled={!!attackingKeyword}
                              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                              {attackingKeyword === item.target_keyword ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              <span>
                                {item.brand_mentioned ? "Reinforce AI Citation" : "Win AI Citation"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* AI Response Excerpt Box */}
                        {chatgpt?.snippet && (
                          <div className="rounded-lg bg-neutral-50 border border-neutral-200/80 p-3 text-xs text-neutral-700 space-y-1">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                              Live AI Answer &amp; Citation Analysis
                            </div>
                            <p className="leading-relaxed">{chatgpt.snippet}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Published Articles AEO Citation Readiness Audit */}
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Published Articles — AEO Citation Readiness Audit</span>
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Empirical check of the 5 structural signals required for ChatGPT, Perplexity, and Google AI Overviews to cite your pages
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {(report?.articles || []).length} published articles
                  </span>
                </div>

                {(report?.articles || []).length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No published articles found yet. Use &ldquo;Win AI Citation&rdquo; above or run Autopilot to publish your first AEO-structured article.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                          <th className="py-2.5 px-5">Published Article</th>
                          <th className="py-2.5 px-3 text-center">AEO Score</th>
                          <th className="py-2.5 px-3 text-center">45w Lead</th>
                          <th className="py-2.5 px-3 text-center">Table</th>
                          <th className="py-2.5 px-3 text-center">FAQ H3s</th>
                          <th className="py-2.5 px-3 text-center">JSON-LD</th>
                          <th className="py-2.5 px-3 text-center">Brand Entity</th>
                          <th className="py-2.5 px-4 text-right">LLM Optimization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {(report?.articles || []).map((art: any) => (
                          <tr key={art.draft_id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-3 px-5">
                              <div className="font-semibold text-neutral-900 truncate max-w-xs">{art.title}</div>
                              <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                                <span>{art.word_count} words</span>
                                {art.live_url && (
                                  <a
                                    href={art.live_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                                  >
                                    <span>Live URL</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  art.aeo_score >= 80
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : art.aeo_score >= 60
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {art.aeo_score}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              {art.triggers?.direct_answer_lead ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {art.triggers?.comparison_table ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {art.triggers?.faq_headings ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {art.triggers?.faq_json_ld_schema ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {art.triggers?.brand_entity_cooccurrence ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                              ) : (
                                <span className="text-neutral-300">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {art.aeo_score === 100 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>LLM Ready</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOptimizeArticle(art.draft_id)}
                                  disabled={!!optimizingDraftId || optimizingAll}
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors disabled:opacity-50"
                                >
                                  {optimizingDraftId === art.draft_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Zap className="w-3 h-3" />
                                  )}
                                  <span>
                                    {optimizingDraftId === art.draft_id ? "Upgrading…" : "Optimize for LLM"}
                                  </span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
