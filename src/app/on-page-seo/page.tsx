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
type Tab = "overview" | "recommendations" | "metadata" | "schema" | "qa" | "agent-tasks";

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
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  useEffect(() => {
    if (currentWebsite) {
      setForm(f => ({
        ...f,
        url: currentWebsite.url,
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
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>AI Agents</span><span>/</span>
            <span className="text-neutral-700 font-medium">On-Page SEO Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">On-Page SEO Agent</h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                {currentWebsite
                  ? `Analyzes live pages on ${currentWebsite.domain} for search intent, content quality, and metadata.`
                  : "Connect your website to analyze on-page SEO signals."}
              </p>
            </div>
            {result && (
              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
                result.status === "pass"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  result.status === "pass" ? "bg-emerald-500" : "bg-amber-500"
                }`} />
                {result.status === "pass" ? "PASS — Ready for Approval" : "NEEDS REVISION"}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {([
              ["overview", "Overview", Layers],
              ["recommendations", `Recommendations${recs.length ? ` (${recs.length})` : ""}`, Sparkles],
              ["metadata", "SEO Metadata", Tag],
              ["schema", "Schema", Code2],
              ["qa", `QA Checklist (${qaPassed}/${qaItems.length || 16})`, CheckCircle2],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setActiveTab(id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  On-Page SEO analysis evaluates live HTML against target search intents and ranking keywords.
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
          ) : (
            <>
              {/* Input Form */}
              <form onSubmit={handleAnalyze} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Page URL *</label>
                    <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required
                      placeholder="https://yoursite.com/blog/page"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 font-mono shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Target Keyword *</label>
                    <input value={form.target_keyword} onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))} required
                      placeholder="e.g. AI SEO agent"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500 shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Search Intent</label>
                    <select value={form.search_intent} onChange={e => setForm(f => ({ ...f, search_intent: e.target.value }))}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-700 focus:outline-none focus:border-indigo-500 shadow-sm">
                      <option value="informational">Informational</option>
                      <option value="commercial_investigation">Commercial Investigation</option>
                      <option value="transactional">Transactional</option>
                      <option value="comparison">Comparison</option>
                      <option value="problem_solution">Problem / Solution</option>
                    </select>
                  </div>
                  <div>
                    <button type="submit" disabled={analyzing || !form.url.trim()}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                      {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Search className="w-4 h-4" /> Analyze Page</>}
                    </button>
                  </div>
                </div>
              </form>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-800 text-xs">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!result && !analyzing && (
                <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                  <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
                  <h3 className="text-base font-bold text-neutral-900">No Page Analyzed Yet</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Enter any page URL on {currentWebsite.domain} and click &ldquo;Analyze Page&rdquo; to evaluate search intent, heading hierarchy, and meta optimization.
                  </p>
                </div>
              )}

              {result && (
                <>
                  {/* ── OVERVIEW TAB ── */}
                  {activeTab === "overview" && (
                    <div className="space-y-5">
                      {/* Diagnostic Scores */}
                      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-5">
                          <div>
                            <h3 className="font-bold text-neutral-900 text-sm">Diagnostic Quality Scores</h3>
                            <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                              <Info className="w-3 h-3" /> {result.diagnostic_scores.note}
                            </p>
                          </div>
                          <div className="text-center">
                            <ScoreRing score={result.diagnostic_scores.overall} label="Overall" size={72} />
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-4">
                          <ScoreRing score={result.diagnostic_scores.intent_alignment} label="Intent Alignment" />
                          <ScoreRing score={result.diagnostic_scores.content_coverage} label="Content Depth" />
                          <ScoreRing score={result.diagnostic_scores.technical} label="Technical" />
                          <ScoreRing score={result.diagnostic_scores.metadata} label="Metadata" />
                          <ScoreRing score={result.diagnostic_scores.linking} label="Internal Links" />
                        </div>
                      </div>

                      {/* Summary Stats */}
                      <div className="grid grid-cols-4 gap-4">
                        {[
                          { label: "Total Recommendations", value: recs.length, color: "text-neutral-900" },
                          { label: "High Priority", value: criticalCount, color: "text-amber-600" },
                          { label: "Auto-Applicable", value: recs.filter(r => r.auto_applicable).length, color: "text-emerald-600" },
                          { label: "Require Approval", value: recs.filter(r => r.requires_approval).length, color: "text-indigo-600" },
                        ].map((s, i) => (
                          <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                            <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── RECOMMENDATIONS TAB ── */}
                  {activeTab === "recommendations" && (
                    <div className="space-y-3">
                      {recs.map((rec, i) => (
                        <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {rec.category}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              {rec.priority} Priority
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-neutral-900">{rec.issue}</h4>
                          <p className="text-xs text-neutral-600">{rec.recommendation}</p>
                          {rec.suggested_value && (
                            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-mono text-neutral-800">
                              <strong>Suggested:</strong> {rec.suggested_value}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── METADATA TAB ── */}
                  {activeTab === "metadata" && (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Optimized Title</span>
                        <p className="font-bold text-neutral-900 text-sm">{result.seo_metadata?.optimized_title}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Optimized Meta Description</span>
                        <p className="text-neutral-700">{result.seo_metadata?.optimized_meta_description}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Optimized H1</span>
                        <p className="font-semibold text-neutral-900">{result.seo_metadata?.optimized_h1}</p>
                      </div>
                    </div>
                  )}

                  {/* ── SCHEMA TAB ── */}
                  {activeTab === "schema" && (
                    <div className="space-y-4">
                      {result.schema_recommendations?.map((s, i) => (
                        <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-2 text-xs">
                          <span className="font-bold text-neutral-900">{s.schema_type} Structured Data</span>
                          <p className="text-neutral-600">{s.justification}</p>
                          <pre className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 overflow-x-auto text-[11px] font-mono text-neutral-800">
                            {typeof s.schema_json === "string" ? s.schema_json : JSON.stringify(s.schema_json, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── QA CHECKLIST TAB ── */}
                  {activeTab === "qa" && (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {Object.entries(QA_LABELS).map(([k, label]) => {
                          const pass = result.qa ? result.qa[k] === true : true;
                          return (
                            <div key={k} className={`p-3 rounded-xl border flex items-center justify-between ${
                              pass ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}>
                              <span className="font-semibold">{label}</span>
                              <span className="text-[10px] font-bold uppercase">{pass ? "Pass ✓" : "Needs Review"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
