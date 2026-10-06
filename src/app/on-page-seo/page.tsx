"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle, Info, ArrowRight,
  Sparkles, Tag, Link2, ImageIcon, Code2, FileText, Cpu, RotateCcw, ExternalLink,
  Target, Layers, ChevronRight, Shield, ShieldAlert, AlertCircle, Eye,
  BookOpen, Zap, List, Hash, Globe, Plus
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = "low" | "medium" | "high";
type Priority = "critical" | "high" | "medium" | "low";
type QAStatus = "pass" | "needs_revision" | "needs_content_agent";
type Tab = "overview" | "recommendations" | "metadata" | "schema" | "qa";

interface Recommendation {
  category: string;
  priority: Priority;
  risk_level: RiskLevel;
  issue: string;
  recommendation: string;
  current_value?: string;
  suggested_value?: string;
  reasoning: string;
  requires_approval: boolean;
  auto_applicable: boolean;
}

interface AnalysisResult {
  url: string;
  target_keyword: string;
  search_intent: string;
  status: QAStatus;
  recommendations: Recommendation[];
  seo_metadata: {
    optimized_title: string;
    optimized_meta_description: string;
    optimized_h1: string;
    optimized_url_slug: string;
  };
  schema_recommendations: Array<{
    schema_type: string;
    justification: string;
    schema_json: string;
    requires_approval: boolean;
  }>;
  diagnostic_scores: {
    intent_alignment: number;
    content_coverage: number;
    technical: number;
    metadata: number;
    linking: number;
    overall: number;
    note: string;
  };
  qa: Record<string, boolean | string | string[]>;
  content_agent_task: {
    triggered: boolean;
    reason: string;
    specific_gaps: string[];
  };
  image_agent_task: {
    triggered: boolean;
    visuals_needed: Array<{
      placement: string;
      image_type: string;
      purpose: string;
      suggested_alt: string;
      suggested_filename: string;
    }>;
  };
}

const QA_LABELS: Record<string, string> = {
  intent_match: "Search Intent Alignment",
  primary_keyword_optimized: "Primary Keyword Integration",
  secondary_keywords_natural: "Secondary Keywords Natural",
  content_depth_appropriate: "Content Depth & Quality",
  reading_level_appropriate: "Readable & Scannable",
  title_optimized: "Title Tag Length & Impact",
  meta_description_optimized: "Meta Description",
  heading_structure_logical: "Heading Structure (H1, H2, H3)",
  images_relevant: "Image Optimization",
  alt_text_descriptive: "Alt Text Coverage",
  internal_links_contextual: "Contextual Internal Links",
  external_links_authoritative: "External Citation Quality",
  no_keyword_stuffing: "No Keyword Stuffing",
  no_filler_content: "No Thin / Filler Content",
  no_hallucinated_facts: "Factually Accurate Claims",
  cta_intent_matched: "Intent-Matched Call to Action",
};

function ScoreRing({ score, label, size = 56 }: { score: number; label: string; size?: number }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
        <text x={size / 2} y={size / 2} dominantBaseline="middle" textAnchor="middle"
          fill="#111827" fontSize={11} fontWeight="700" className="rotate-90"
          transform={`rotate(90, ${size / 2}, ${size / 2})`}>{score}</text>
      </svg>
      <span className="text-[10px] text-neutral-500 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

export default function OnPageSEOPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: "",
    target_keyword: "",
    secondary_keywords: "",
    search_intent: "informational",
    content_type: "blog_article",
  });

  useEffect(() => {
    if (currentWebsite) {
      setForm(f => ({
        ...f,
        url: currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : ""),
        target_keyword: currentWebsite.domain.split('.')[0],
      }));
    }
  }, [currentWebsite?.id]);

  const fetchLatestAnalysis = async () => {
    if (!currentWebsite) {
      setResult(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/agent/on-page/analyze?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setResult(data.result);
      }
    } catch (err) {
      console.error("Error fetching on-page analysis:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestAnalysis();
  }, [currentWebsite?.id]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/on-page/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          url: form.url,
          target_keyword: form.target_keyword,
          secondary_keywords: form.secondary_keywords ? form.secondary_keywords.split(",").map(k => k.trim()) : [],
          search_intent: form.search_intent,
          content_type: form.content_type,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setResult(data.result);
      } else {
        setError(data.error || "Analysis failed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze page.");
    } finally {
      setAnalyzing(false);
      setActiveTab("overview");
    }
  };

  const recs = result?.recommendations || [];
  const criticalCount = recs.filter(r => r.priority === "critical" || r.priority === "high").length;
  const qaItems = result?.qa
    ? Object.entries(result.qa).filter(([k]) => k in QA_LABELS)
    : [];
  const qaPassed = qaItems.filter(([, v]) => v === true).length;

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20 font-sans">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span className="font-medium text-neutral-400">Content Studio</span>
              <span className="text-neutral-300">/</span>
              <span className="font-semibold text-neutral-700">On-Page Diagnostics</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                On-Page SEO Diagnostics &amp; Audit
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Target className="w-3 h-3 text-indigo-600" />
                SERP Intent Engine
              </span>
            </div>
            <p className="text-neutral-500 text-xs mt-1">
              {currentWebsite
                ? `Analyzes live pages on ${currentWebsite.domain} for search intent, content depth, and heading hierarchy.`
                : "Connect your website to analyze on-page SEO signals."}
            </p>
          </div>

          {result && (
            <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
              result.status === "pass"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                result.status === "pass" ? "bg-emerald-500" : "bg-amber-500"
              }`} />
              <span>{result.status === "pass" ? "PASS — Ready for Approval" : "NEEDS REVISION"}</span>
            </div>
          )}
        </div>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900">Connect a Website to Begin</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                On-Page SEO analysis evaluates live HTML against target search intents and ranking keywords.
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
        ) : (
          <div className="space-y-6">
            {/* Input Form */}
            <form onSubmit={handleAnalyze} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Page URL *</label>
                  <input
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    required
                    placeholder="https://example.com/blog/page"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Target Keyword *</label>
                  <input
                    value={form.target_keyword}
                    onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))}
                    required
                    placeholder="e.g. AI SEO agent"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Search Intent</label>
                  <select
                    value={form.search_intent}
                    onChange={e => setForm(f => ({ ...f, search_intent: e.target.value }))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="informational">Informational</option>
                    <option value="commercial_investigation">Commercial Investigation</option>
                    <option value="transactional">Transactional</option>
                    <option value="comparison">Comparison</option>
                    <option value="problem_solution">Problem / Solution</option>
                  </select>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={analyzing || !form.url.trim()}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-all shadow-xs"
                  >
                    {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>{analyzing ? "Analyzing..." : "Analyze Page"}</span>
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {!result && !analyzing && (
              <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3 max-w-lg mx-auto shadow-xs">
                <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
                <h3 className="text-base font-semibold text-neutral-900">No Page Analyzed Yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Enter any page URL on {currentWebsite.domain} and click &ldquo;Analyze Page&rdquo; to evaluate search intent, heading hierarchy, and meta optimization.
                </p>
              </div>
            )}

            {result && (
              <>
                {/* Navigation Tabs */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
                  {([
                    ["overview", "Overview", Layers],
                    ["recommendations", `Recommendations${recs.length ? ` (${recs.length})` : ""}`, Sparkles],
                    ["metadata", "SEO Metadata", Tag],
                    ["schema", "Schema", Code2],
                    ["qa", `QA Checklist (${qaPassed}/${qaItems.length || 16})`, CheckCircle2],
                  ] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id as Tab)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                        activeTab === id
                          ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                          : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* ── OVERVIEW TAB ── */}
                {activeTab === "overview" && (
                  <div className="space-y-4">
                    {/* Diagnostic Scores */}
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-neutral-900 text-sm">Diagnostic Quality Scores</h3>
                          <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                            <Info className="w-3 h-3 text-neutral-400" /> {result.diagnostic_scores.note}
                          </p>
                        </div>
                        <div className="text-center">
                          <ScoreRing score={result.diagnostic_scores.overall} label="Overall" size={68} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-neutral-100">
                        <ScoreRing score={result.diagnostic_scores.intent_alignment} label="Intent" />
                        <ScoreRing score={result.diagnostic_scores.content_coverage} label="Depth" />
                        <ScoreRing score={result.diagnostic_scores.technical} label="Technical" />
                        <ScoreRing score={result.diagnostic_scores.metadata} label="Metadata" />
                        <ScoreRing score={result.diagnostic_scores.linking} label="Internal Links" />
                      </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Total Recommendations", value: recs.length, color: "text-neutral-900" },
                        { label: "High Priority", value: criticalCount, color: "text-amber-600" },
                        { label: "Auto-Applicable", value: recs.filter(r => r.auto_applicable).length, color: "text-emerald-600" },
                        { label: "Require Approval", value: recs.filter(r => r.requires_approval).length, color: "text-indigo-600" },
                      ].map((s, i) => (
                        <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                          <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── RECOMMENDATIONS TAB ── */}
                {activeTab === "recommendations" && (
                  <div className="space-y-3">
                    {recs.map((rec, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {rec.category}
                          </span>
                          <span className="text-[10px] font-semibold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            {rec.priority} Priority
                          </span>
                        </div>
                        <h4 className="font-semibold text-xs text-neutral-900">{rec.issue}</h4>
                        <p className="text-xs text-neutral-600 leading-relaxed">{rec.recommendation}</p>
                        {rec.suggested_value && (
                          <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-xs font-mono text-neutral-800">
                            <strong>Suggested:</strong> {rec.suggested_value}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── METADATA TAB ── */}
                {activeTab === "metadata" && (
                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4 text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Optimized Title</span>
                      <p className="font-semibold text-neutral-900 text-sm bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">{result.seo_metadata?.optimized_title}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Optimized Meta Description</span>
                      <p className="text-neutral-700 leading-relaxed bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">{result.seo_metadata?.optimized_meta_description}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">Optimized H1</span>
                      <p className="font-semibold text-neutral-900 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">{result.seo_metadata?.optimized_h1}</p>
                    </div>
                  </div>
                )}

                {/* ── SCHEMA TAB ── */}
                {activeTab === "schema" && (
                  <div className="space-y-3">
                    {result.schema_recommendations?.map((s, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-2 text-xs">
                        <span className="font-semibold text-neutral-900">{s.schema_type} Structured Data</span>
                        <p className="text-neutral-600">{s.justification}</p>
                        <pre className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 overflow-x-auto text-[11px] font-mono text-neutral-800">
                          {typeof s.schema_json === "string" ? s.schema_json : JSON.stringify(s.schema_json, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── QA CHECKLIST TAB ── */}
                {activeTab === "qa" && (
                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      {Object.entries(QA_LABELS).map(([k, label]) => {
                        const pass = result.qa ? result.qa[k] === true : true;
                        return (
                          <div key={k} className={`p-2.5 rounded-lg border flex items-center justify-between ${
                            pass ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}>
                            <span className="font-medium">{label}</span>
                            <span className="text-[10px] font-semibold uppercase">{pass ? "Pass" : "Needs Review"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
