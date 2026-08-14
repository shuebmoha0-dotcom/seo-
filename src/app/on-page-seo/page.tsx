"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Search, Loader2, CheckCircle2, XCircle, AlertTriangle, Info, ArrowRight,
  Sparkles, Tag, Link2, Image, Code2, FileText, Cpu, RotateCcw, ExternalLink,
  Target, Layers, ChevronRight, Shield, ShieldAlert, AlertCircle, Eye,
  BookOpen, Zap, List, Hash, Globe, Plus
} from "lucide-react";
import { useState } from "react";

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
  status: QAStatus;
}

// ─── Demo result ──────────────────────────────────────────────────────────────
const DEMO_RESULT: AnalysisResult = {
  url: "https://seautopilot.io/blog/ai-seo-agent-for-saas",
  target_keyword: "AI SEO agent for SaaS",
  search_intent: "commercial_investigation",
  recommendations: [
    {
      category: "title", priority: "high", risk_level: "low",
      issue: "Title is 74 characters — exceeds the ~60 character display limit in SERPs.",
      recommendation: "Shorten to under 60 characters while keeping the primary keyword.",
      current_value: "The Complete Guide to AI SEO Agents for SaaS Companies in 2026",
      suggested_value: "AI SEO Agent for SaaS — Complete 2026 Guide",
      reasoning: "Titles over 60 chars are truncated in Google SERPs, reducing click-through rate.",
      requires_approval: false, auto_applicable: true,
    },
    {
      category: "meta_description", priority: "high", risk_level: "low",
      issue: "Meta description is 178 characters — will be truncated.",
      recommendation: "Rewrite to 130–155 characters. Match commercial investigation intent.",
      current_value: "Learn how AI SEO agents work for SaaS companies, what they can automate, how to choose the right one, and what results to expect from autonomous SEO in 2026.",
      suggested_value: "Discover how an AI SEO agent can automate organic growth for your SaaS. Compare features, see results, and learn how to get started.",
      reasoning: "Truncated descriptions reduce qualified CTR and waste the meta tag entirely.",
      requires_approval: false, auto_applicable: true,
    },
    {
      category: "headings", priority: "medium", risk_level: "low",
      issue: "H2 'What AI Can Do For Your SEO Needs' is vague and doesn't address a clear searcher question.",
      recommendation: "Rename to 'What Can an AI SEO Agent Actually Do?' — more direct, intent-matched.",
      current_value: "What AI Can Do For Your SEO Needs",
      suggested_value: "What Can an AI SEO Agent Actually Do?",
      reasoning: "Clearer headings improve structure and may increase featured snippet eligibility.",
      requires_approval: false, auto_applicable: false,
    },
    {
      category: "internal_links", priority: "medium", risk_level: "low",
      issue: "The article discusses keyword research but doesn't link to the Keywords page.",
      recommendation: "Add internal link to /keywords with anchor 'keyword research tools'.",
      current_value: "No link to /keywords",
      suggested_value: "<a href='/keywords'>keyword research tools</a>",
      reasoning: "Internal linking supports topical authority and improves user journey.",
      requires_approval: false, auto_applicable: false,
    },
    {
      category: "images", priority: "medium", risk_level: "low",
      issue: "Hero image has empty alt text.",
      recommendation: "Add descriptive alt text: 'AI SEO agent workflow diagram for SaaS companies'.",
      current_value: 'alt=""',
      suggested_value: 'alt="AI SEO agent workflow diagram for SaaS companies"',
      reasoning: "Alt text improves image search visibility and accessibility compliance.",
      requires_approval: false, auto_applicable: true,
    },
    {
      category: "url", priority: "low", risk_level: "high",
      issue: "URL path uses underscores instead of hyphens.",
      recommendation: "Migrate to /blog/ai-seo-agent-for-saas if feasible. Requires 301 redirect and careful backlink review.",
      current_value: "/blog/ai_seo_agent_for_saas",
      suggested_value: "/blog/ai-seo-agent-for-saas",
      reasoning: "Google treats hyphens as word separators. Underscores join words. This is LOW severity.",
      requires_approval: true, auto_applicable: false,
    },
    {
      category: "featured_snippet", priority: "low", risk_level: "low",
      issue: "The article defines 'AI SEO agent' but buries the definition in paragraph 3.",
      recommendation: "Move a clear 2-3 sentence definition to the top of the page, immediately below the H1.",
      reasoning: "Google often pulls featured snippets from prominent definitions near the top of the page.",
      requires_approval: false, auto_applicable: false,
    },
  ],
  seo_metadata: {
    optimized_title: "AI SEO Agent for SaaS — Complete 2026 Guide",
    optimized_meta_description: "Discover how an AI SEO agent can automate organic growth for your SaaS. Compare features, see results, and learn how to get started.",
    optimized_h1: "AI SEO Agent for SaaS Companies: What It Is and How It Works",
    optimized_url_slug: "ai-seo-agent-for-saas",
  },
  schema_recommendations: [{
    schema_type: "Article",
    justification: "This is a long-form guide. Article schema helps Google understand publication date, author, and headline.",
    schema_json: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "AI SEO Agent for SaaS — Complete 2026 Guide",
      "author": { "@type": "Organization", "name": "SEO Autopilot" },
      "publisher": { "@type": "Organization", "name": "SEO Autopilot" },
      "datePublished": "2026-01-01",
      "dateModified": "2026-08-12",
    }, null, 2),
    requires_approval: true,
  }],
  diagnostic_scores: {
    intent_alignment: 78,
    content_coverage: 65,
    technical: 82,
    metadata: 55,
    linking: 70,
    overall: 70,
    note: "Diagnostic scores are internal indicators only. They do not guarantee search rankings.",
  },
  qa: {
    target_keyword_in_title: true,
    target_keyword_in_h1: true,
    target_keyword_in_intro: false,
    meta_description_exists: true,
    meta_description_length_ok: false,
    single_h1: true,
    logical_heading_structure: true,
    no_keyword_stuffing: true,
    internal_links_present: true,
    images_have_alt_text: false,
    canonical_correct: true,
    schema_present: false,
    content_covers_intent: true,
    readability_ok: true,
    url_clean: false,
    flagged_issues: ["Meta description too long (178 chars)", "Hero image missing alt text", "URL uses underscores not hyphens"],
    overall_status: "needs_revision",
    qa_notes: "3 issues found. Fix metadata and image alt text before approval.",
  },
  content_agent_task: {
    triggered: false,
    reason: "",
    specific_gaps: [],
  },
  image_agent_task: {
    triggered: true,
    visuals_needed: [{
      placement: "After 'How It Works' section",
      image_type: "diagram",
      purpose: "Illustrate the Observe → Reason → Plan → Execute → Verify loop visually.",
      suggested_alt: "AI SEO agent workflow — Observe, Reason, Plan, Execute, Verify cycle",
      suggested_filename: "ai-seo-agent-workflow-diagram.png",
    }],
  },
  status: "needs_revision",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  high: { label: "High", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  medium: { label: "Medium", color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500" },
  low: { label: "Low", color: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; icon: any }> = {
  low: { label: "Low Risk", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: Shield },
  medium: { label: "Med Risk", color: "text-amber-600 bg-amber-50 border-amber-200", icon: AlertCircle },
  high: { label: "High Risk — Approval Required", color: "text-red-600 bg-red-50 border-red-200", icon: ShieldAlert },
};

const CATEGORY_ICONS: Record<string, any> = {
  title: Tag, meta_description: FileText, h1: Hash, headings: List,
  content_gap: BookOpen, keyword_optimization: Target, internal_links: Link2,
  external_links: ExternalLink, images: Image, url: Globe, schema: Code2,
  canonical: Shield, search_intent: Zap, readability: Eye,
  featured_snippet: Sparkles, faq: Info,
};

const QA_LABELS: Record<string, string> = {
  target_keyword_in_title: "Primary Keyword in Title",
  target_keyword_in_h1: "Primary Keyword in H1",
  target_keyword_in_intro: "Keyword in Introduction",
  meta_description_exists: "Meta Description Present",
  meta_description_length_ok: "Meta Description Length (70–155)",
  single_h1: "Single H1 Tag",
  logical_heading_structure: "Logical Heading Structure",
  no_keyword_stuffing: "No Keyword Stuffing",
  internal_links_present: "Internal Links Present",
  images_have_alt_text: "All Images Have Alt Text",
  canonical_correct: "Canonical Tag Correct",
  schema_present: "Structured Data Present",
  content_covers_intent: "Content Satisfies Search Intent",
  readability_ok: "Readability OK",
  url_clean: "URL is Clean",
};

function ScoreRing({ score, label, size = 60 }: { score: number; label: string; size?: number }) {
  const r = size * 0.4;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={size * 0.1} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        <text x={size / 2} y={size / 2} dominantBaseline="middle" textAnchor="middle"
          fill="#111827" fontSize={size * 0.22} fontWeight="700" className="rotate-90" transform={`rotate(90, ${size / 2}, ${size / 2})`}>
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-neutral-500 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OnPageSEOPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [result, setResult] = useState<AnalysisResult | null>(DEMO_RESULT);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({
    url: "https://seonautopilot.io/blog/ai-seo-agent-for-saas",
    target_keyword: "AI SEO agent for SaaS",
    secondary_keywords: "autonomous seo tool, ai seo automation",
    search_intent: "commercial_investigation",
    content_type: "blog_article",
  });
  const [approvedRecs, setApprovedRecs] = useState<Set<number>>(new Set());
  const [rejectedRecs, setRejectedRecs] = useState<Set<number>>(new Set());
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const res = await fetch("/api/agent/on-page/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: form.url,
          target_keyword: form.target_keyword,
          secondary_keywords: form.secondary_keywords.split(",").map(k => k.trim()),
          search_intent: form.search_intent,
          content_type: form.content_type,
        }),
      });
      const data = await res.json();
      if (data.result) setResult(data.result);
      else setResult(DEMO_RESULT);
    } catch { setResult(DEMO_RESULT); }
    finally { setAnalyzing(false); setActiveTab("overview"); }
  };

  const recs = result?.recommendations || [];
  const criticalCount = recs.filter(r => r.priority === "critical" || r.priority === "high").length;
  const qaItems = result?.qa
    ? Object.entries(result.qa).filter(([k]) => k in QA_LABELS)
    : [];
  const qaPassed = qaItems.filter(([, v]) => v === true).length;

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
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
                Analyzes pages for search intent, content quality, metadata, and technical accessibility. Optimizes for searchers — not checklist scores.
              </p>
            </div>
            {result && (
              <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
                result.status === "pass"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : result.status === "needs_content_agent"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  result.status === "pass" ? "bg-emerald-500" : result.status === "needs_content_agent" ? "bg-purple-500 animate-pulse" : "bg-amber-500"
                }`} />
                {result.status === "pass" ? "PASS — Ready for Approval" : result.status === "needs_content_agent" ? "Sent to Content Agent" : "NEEDS REVISION"}
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
              ["qa", `QA Checklist (${qaPassed}/${qaItems.length})`, CheckCircle2],
              ["agent-tasks", "Agent Tasks", Cpu],
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

          {/* Input Form — always visible at top */}
          <form onSubmit={handleAnalyze} className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Page URL *</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} required
                  placeholder="https://yoursite.com/blog/page"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Target Keyword *</label>
                <input value={form.target_keyword} onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))} required
                  placeholder="ai seo agent for saas"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Search Intent</label>
                <select value={form.search_intent} onChange={e => setForm(f => ({ ...f, search_intent: e.target.value }))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                  <option value="informational">Informational</option>
                  <option value="commercial_investigation">Commercial Investigation</option>
                  <option value="transactional">Transactional</option>
                  <option value="comparison">Comparison</option>
                  <option value="problem_solution">Problem / Solution</option>
                  <option value="navigational">Navigational</option>
                  <option value="local">Local</option>
                </select>
              </div>
              <div>
                <button type="submit" disabled={analyzing}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-neutral-900 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                  {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Search className="w-4 h-4" /> Analyze Page</>}
                </button>
              </div>
            </div>
          </form>

          {result && (
            <>
              {/* ── OVERVIEW TAB ── */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Diagnostic Scores */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-sm">Diagnostic Scores</h3>
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
                      <ScoreRing score={result.diagnostic_scores.content_coverage} label="Content Coverage" />
                      <ScoreRing score={result.diagnostic_scores.technical} label="Technical" />
                      <ScoreRing score={result.diagnostic_scores.metadata} label="Metadata" />
                      <ScoreRing score={result.diagnostic_scores.linking} label="Internal Links" />
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Total Issues", value: recs.length, color: "text-neutral-900" },
                      { label: "High Priority", value: criticalCount, color: "text-amber-600" },
                      { label: "Auto-Applicable", value: recs.filter(r => r.auto_applicable).length, color: "text-emerald-600" },
                      { label: "Require Approval", value: recs.filter(r => r.requires_approval).length, color: "text-red-500" },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                        <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Page Info */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                    <h3 className="font-semibold text-neutral-900 text-sm mb-3">Analyzed Page</h3>
                    {[
                      ["URL", result.url],
                      ["Target Keyword", result.target_keyword],
                      ["Search Intent", result.search_intent?.replace(/_/g, " ")],
                    ].map(([label, value], i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 last:border-0">
                        <span className="text-xs text-neutral-500 font-medium">{label}</span>
                        <span className="text-xs font-semibold text-neutral-800 font-mono max-w-xs truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Quick wins */}
                  {recs.filter(r => r.auto_applicable).length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                      <h3 className="font-semibold text-emerald-800 text-sm mb-3 flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Quick Wins — Auto-Applicable Changes
                      </h3>
                      <div className="space-y-2">
                        {recs.filter(r => r.auto_applicable).map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><strong>{r.category.replace(/_/g, " ")}:</strong> {r.recommendation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* High risk warnings */}
                  {recs.filter(r => r.risk_level === "high").length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                      <h3 className="font-semibold text-red-700 text-sm mb-3 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4" /> High-Risk Changes — Require Human Approval
                      </h3>
                      <div className="space-y-2">
                        {recs.filter(r => r.risk_level === "high").map((r, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><strong>{r.category.replace(/_/g, " ")}:</strong> {r.issue}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── RECOMMENDATIONS TAB ── */}
              {activeTab === "recommendations" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-neutral-500 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    All high-risk changes are flagged and require your approval. Low-risk changes can be applied automatically within your permission settings.
                  </div>

                  {recs.map((rec, i) => {
                    const pc = PRIORITY_CONFIG[rec.priority];
                    const rc = RISK_CONFIG[rec.risk_level];
                    const CatIcon = CATEGORY_ICONS[rec.category] || Info;
                    const isApproved = approvedRecs.has(i);
                    const isRejected = rejectedRecs.has(i);
                    const isExpanded = expandedRec === i;

                    return (
                      <div key={i} className={`bg-white border rounded-2xl transition-all ${
                        isApproved ? "border-emerald-200 bg-emerald-50/30"
                          : isRejected ? "border-neutral-200 opacity-50"
                            : rec.risk_level === "high" ? "border-red-200" : "border-neutral-200"
                      }`}>
                        <div
                          className="p-5 cursor-pointer"
                          onClick={() => setExpandedRec(isExpanded ? null : i)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-xl border ${
                                rec.risk_level === "high" ? "bg-red-50 border-red-200 text-red-500"
                                  : "bg-indigo-50 border-indigo-100 text-indigo-500"
                              }`}>
                                <CatIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pc.color}`}>
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${pc.dot}`} />
                                    {pc.label}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rc.color}`}>
                                    {rec.risk_level === "high" ? "⚠ " : ""}{rc.label}
                                  </span>
                                  <span className="text-[10px] text-neutral-500 capitalize">{rec.category.replace(/_/g, " ")}</span>
                                  {rec.auto_applicable && (
                                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">Auto-applicable</span>
                                  )}
                                  {rec.requires_approval && (
                                    <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full font-semibold">Approval Required</span>
                                  )}
                                </div>
                                <p className="text-sm font-semibold text-neutral-900">{rec.issue}</p>
                                <p className="text-xs text-neutral-500 mt-0.5">{rec.recommendation}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!isRejected && !isApproved && (
                                <>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setApprovedRecs(s => new Set([...s, i])); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                                  >Approve</button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setRejectedRecs(s => new Set([...s, i])); }}
                                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                                  >Reject</button>
                                </>
                              )}
                              {isApproved && <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Approved</span>}
                              {isRejected && <span className="text-neutral-500 text-xs font-bold flex items-center gap-1"><XCircle className="w-4 h-4" /> Rejected</span>}
                              <ChevronRight className={`w-4 h-4 text-neutral-700 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-neutral-100 p-5 space-y-3 text-xs">
                            <p className="text-neutral-600"><strong className="text-neutral-800">Reasoning:</strong> {rec.reasoning}</p>
                            {rec.current_value && (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <p className="text-neutral-500 font-semibold mb-1">Current</p>
                                <p className="font-mono text-neutral-800">{rec.current_value}</p>
                              </div>
                            )}
                            {rec.suggested_value && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <p className="text-neutral-500 font-semibold mb-1">Suggested</p>
                                <p className="font-mono text-neutral-800">{rec.suggested_value}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── METADATA TAB ── */}
              {activeTab === "metadata" && (
                <div className="space-y-5">
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                    <h3 className="font-semibold text-neutral-900">Optimized SEO Metadata</h3>
                    {[
                      {
                        label: "SEO Title",
                        value: result.seo_metadata.optimized_title,
                        hint: `${result.seo_metadata.optimized_title.length}/60 chars`,
                        good: result.seo_metadata.optimized_title.length <= 60,
                      },
                      {
                        label: "Meta Description",
                        value: result.seo_metadata.optimized_meta_description,
                        hint: `${result.seo_metadata.optimized_meta_description.length}/155 chars`,
                        good: result.seo_metadata.optimized_meta_description.length <= 155,
                      },
                      {
                        label: "H1",
                        value: result.seo_metadata.optimized_h1,
                        hint: "Primary heading",
                        good: true,
                      },
                      {
                        label: "URL Slug",
                        value: `/${result.seo_metadata.optimized_url_slug}`,
                        hint: "Canonical path",
                        good: true,
                      },
                    ].map((f, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{f.label}</label>
                          <span className={`text-[10px] font-medium ${f.good ? "text-emerald-600" : "text-red-500"}`}>{f.hint}</span>
                        </div>
                        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-800 font-mono">
                          {f.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* SERP Preview */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-3">SERP Preview</p>
                    <div className="text-blue-700 text-base font-medium hover:underline cursor-pointer">{result.seo_metadata.optimized_title}</div>
                    <div className="text-emerald-700 text-xs mt-0.5">https://yoursite.com/{result.seo_metadata.optimized_url_slug}</div>
                    <div className="text-neutral-600 text-sm mt-1 leading-relaxed">{result.seo_metadata.optimized_meta_description}</div>
                  </div>
                </div>
              )}

              {/* ── SCHEMA TAB ── */}
              {activeTab === "schema" && (
                <div className="space-y-4">
                  {result.schema_recommendations.length > 0 ? result.schema_recommendations.map((s, i) => (
                    <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-neutral-900">{s.schema_type} Schema</h3>
                          <p className="text-xs text-neutral-500 mt-1">{s.justification}</p>
                        </div>
                        {s.requires_approval && (
                          <span className="text-[10px] text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full font-semibold">Approval Required</span>
                        )}
                      </div>
                      <div className="bg-white text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto">
                        <pre>{s.schema_json}</pre>
                      </div>
                      <div className="flex gap-2">
                        <button className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-xs font-bold px-4 py-2 rounded-xl transition-colors">Approve Schema</button>
                        <button className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-bold px-4 py-2 rounded-xl transition-colors">Reject</button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-16 text-neutral-500 border border-dashed border-neutral-200 rounded-2xl">
                      <Code2 className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No schema changes recommended for this page.</p>
                      <p className="text-xs mt-1">Schema is only added when it accurately represents visible page content.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── QA TAB ── */}
              {activeTab === "qa" && (
                <div className="space-y-4">
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="font-semibold text-neutral-900">On-Page QA Checklist</h3>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                        result.qa.overall_status === "pass"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}>
                        {qaPassed}/{qaItems.length} Passed
                      </span>
                    </div>

                    <div className="mb-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(qaPassed / qaItems.length) * 100}%` }}
                      />
                    </div>

                    <div className="space-y-2">
                      {qaItems.map(([key, value]) => (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${
                          value === true ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                        }`}>
                          <span className={value === true ? "text-emerald-800" : "text-red-700"}>{QA_LABELS[key]}</span>
                          {value === true
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : <XCircle className="w-4 h-4 text-red-500" />
                          }
                        </div>
                      ))}
                    </div>

                    {Array.isArray(result.qa.flagged_issues) && (result.qa.flagged_issues as string[]).length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" /> Flagged Issues
                        </p>
                        {(result.qa.flagged_issues as string[]).map((issue, i) => (
                          <p key={i} className="text-xs text-amber-700 ml-5 mb-1">• {issue}</p>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600">
                      {result.qa.qa_notes as string}
                    </div>
                  </div>
                </div>
              )}

              {/* ── AGENT TASKS TAB ── */}
              {activeTab === "agent-tasks" && (
                <div className="space-y-4">
                  {/* Content Agent Task */}
                  <div className={`bg-white border rounded-2xl p-6 ${
                    result.content_agent_task.triggered ? "border-purple-200" : "border-neutral-200"
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2.5 rounded-xl border ${
                        result.content_agent_task.triggered
                          ? "bg-purple-50 border-purple-200 text-purple-600"
                          : "bg-neutral-100 border-neutral-200 text-neutral-500"
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-sm">Content Agent Task</h3>
                        <p className="text-xs text-neutral-500">
                          {result.content_agent_task.triggered ? "Task generated — content revision required" : "No content agent task needed"}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          result.content_agent_task.triggered
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-neutral-100 text-neutral-500 border-neutral-200"
                        }`}>
                          {result.content_agent_task.triggered ? "TRIGGERED" : "NOT TRIGGERED"}
                        </span>
                      </div>
                    </div>

                    {result.content_agent_task.triggered ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700">
                          <strong>Reason:</strong> {result.content_agent_task.reason}
                        </div>
                        {result.content_agent_task.specific_gaps.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-neutral-700">Content Gaps to Address:</p>
                            {result.content_agent_task.specific_gaps.map((gap, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs text-neutral-600">
                                <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-purple-500" />
                                {gap}
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="bg-purple-600 hover:bg-purple-700 text-neutral-900 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2">
                          <ArrowRight className="w-3.5 h-3.5" /> Send to Content Agent
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">The page content is sufficient for the target search intent. No content agent intervention needed.</p>
                    )}
                  </div>

                  {/* Image Agent Task */}
                  <div className={`bg-white border rounded-2xl p-6 ${
                    result.image_agent_task.triggered ? "border-indigo-200" : "border-neutral-200"
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-2.5 rounded-xl border ${
                        result.image_agent_task.triggered
                          ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                          : "bg-neutral-100 border-neutral-200 text-neutral-500"
                      }`}>
                        <Image className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-sm">Image Agent Task</h3>
                        <p className="text-xs text-neutral-500">
                          {result.image_agent_task.triggered
                            ? `${result.image_agent_task.visuals_needed.length} visual(s) requested`
                            : "No image agent task needed"}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                          result.image_agent_task.triggered
                            ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                            : "bg-neutral-100 text-neutral-500 border-neutral-200"
                        }`}>
                          {result.image_agent_task.triggered ? "TRIGGERED" : "NOT TRIGGERED"}
                        </span>
                      </div>
                    </div>

                    {result.image_agent_task.triggered && result.image_agent_task.visuals_needed.map((v, i) => (
                      <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2 text-xs mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{v.image_type}</span>
                          <span className="text-neutral-500">{v.placement}</span>
                        </div>
                        <p className="text-neutral-700 font-medium">{v.purpose}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white border border-neutral-200 rounded-lg p-2">
                            <span className="text-neutral-500 block mb-0.5">Alt Text</span>
                            <span className="font-mono text-neutral-700">{v.suggested_alt}</span>
                          </div>
                          <div className="bg-white border border-neutral-200 rounded-lg p-2">
                            <span className="text-neutral-500 block mb-0.5">Filename</span>
                            <span className="font-mono text-neutral-700">{v.suggested_filename}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
