"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles, FileText, Check, X, Edit2, Send, RefreshCw, AlertTriangle,
  Loader2, Clock, BookOpen, Image, Link, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Eye, GitPullRequest, Settings, Plus, History,
  Tag, Target, Layers, ArrowRight, Save, RotateCcw, Info, ListChecks,
  PenLine, Cpu
} from "lucide-react";
import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type DraftStatus = "brief_pending" | "writing" | "qa_pending" | "needs_revision" | "ready_for_approval" | "approved" | "rejected";

interface ContentDraft {
  id: string;
  working_title: string;
  primary_keyword: string;
  search_intent: string;
  content_type: string;
  word_count: number;
  reading_time: number;
  status: DraftStatus;
  version: number;
  seo_title?: string;
  meta_description?: string;
  url_slug?: string;
  content_body?: string;
  qa?: Record<string, boolean | string | string[]>;
  images?: Array<{ image_type: string; alt_text: string; placement_context: string; suggested_filename: string; purpose: string }>;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
const DEMO_DRAFTS: ContentDraft[] = [
  {
    id: "d1",
    working_title: "AI SEO Agent for SaaS Companies: The Complete Guide",
    primary_keyword: "AI SEO agent for SaaS companies",
    search_intent: "commercial_investigation",
    content_type: "landing_page",
    word_count: 1247,
    reading_time: 7,
    status: "ready_for_approval",
    version: 2,
    seo_title: "AI SEO Agent for SaaS Companies — Complete Guide",
    meta_description: "Discover how an AI SEO agent can automate your SaaS company's organic growth — from keyword research to autonomous execution.",
    url_slug: "ai-seo-agent-for-saas-companies",
    content_body: `# AI SEO Agent for SaaS Companies: The Complete Guide

If you're running a SaaS company, you already know that organic search is one of the most scalable growth channels available. But SEO is slow, resource-intensive, and requires constant attention.

[IMAGE: featured — "AI SEO agent for SaaS companies illustration" — place: After introduction]

That's exactly what an AI SEO agent solves.

## What Is an AI SEO Agent?

An AI SEO agent is an autonomous software system that continuously monitors your website, identifies SEO opportunities, creates a prioritised action plan, and executes approved changes — without requiring a full-time SEO team to manage it.

Unlike traditional SEO tools that show you data, an AI SEO agent acts on it.

## How It Works

The agent operates in a continuous loop:

**Observe → Reason → Plan → Execute → Verify → Record**

[IMAGE: diagram — "AI SEO agent workflow diagram" — place: After How It Works section]

Each cycle, the agent crawls your site, checks Search Console data, analyses competitors, and determines the highest-value next action based on your business goals.

### Permission-Based Execution

Not every action is created equal. A well-designed AI SEO agent uses a permission system:

- **Level 0:** Read-only analysis
- **Level 1:** Low-risk changes (meta descriptions, alt text, title tags)
- **Level 2:** Content modifications
- **Level 3:** Publishing new content
- **Level 4:** High-risk changes — always requires human approval

This means you stay in control. The agent handles the repetitive, low-risk work automatically, while flagging anything significant for your review.

## Why SaaS Companies Benefit Most

SaaS companies have unique SEO needs:

- **Long sales cycles** mean informational and educational content matters enormously
- **Topical authority** compounds over time — an agent can maintain it systematically
- **Competitor landscapes** shift frequently — continuous monitoring keeps you ahead
- **Resource constraints** make an autonomous agent especially valuable for lean teams

## Getting Started

You don't need to hand over the keys. Start with the agent on read-only mode, review its recommendations, and gradually increase autonomy as trust is established.

Ready to see what an AI SEO agent can do for your SaaS?

[Start your free trial of SEO Autopilot →](/pricing)`,
    qa: {
      intent_match: true,
      primary_keyword_present: true,
      secondary_keywords_present: true,
      word_count_pass: true,
      style_pass: true,
      heading_structure_pass: true,
      no_keyword_stuffing: true,
      no_filler: true,
      cta_present: true,
      internal_links_present: true,
      images_specified: true,
      alt_text_present: true,
      product_accuracy_pass: true,
      overall_status: "pass",
      facts_flagged: [],
      qa_notes: "All QA checks passed. Ready for human approval.",
    },
    images: [
      { image_type: "featured", alt_text: "AI SEO agent for SaaS companies illustration", placement_context: "After introduction", suggested_filename: "ai-seo-agent-saas-featured.png", purpose: "Hero image for the guide." },
      { image_type: "diagram", alt_text: "AI SEO agent workflow diagram", placement_context: "After How It Works section", suggested_filename: "ai-seo-agent-workflow.png", purpose: "Visual explanation of the Observe→Verify loop." },
    ],
  },
  {
    id: "d2",
    working_title: "How to Improve SEO for a New SaaS Website",
    primary_keyword: "how to improve SEO for a new SaaS website",
    search_intent: "informational",
    content_type: "blog_article",
    word_count: 0,
    reading_time: 0,
    status: "brief_pending",
    version: 1,
  },
  {
    id: "d3",
    working_title: "Autonomous SEO Tool — Feature Overview",
    primary_keyword: "autonomous SEO tool",
    search_intent: "commercial_investigation",
    content_type: "feature_page",
    word_count: 892,
    reading_time: 5,
    status: "needs_revision",
    version: 1,
  },
];

const DEFAULT_RULES = {
  word_count_min: 900,
  word_count_max: 1500,
  language: "U.S. English",
  tone: "Professional, natural, helpful",
  audience: "SaaS founders and marketing teams",
  author_style: "Experienced SEO content writer. Clear, direct, no fluff.",
  structure_rules: "Use H2 and H3 headings. One idea per section.",
  paragraph_style: "Short paragraphs, max 3 sentences. Easy to scan.",
  image_rules: "Include relevant images for key concepts. No stock filler.",
  source_rules: "Use reliable sources. Verify factual claims before including.",
  brand_rules: "Do not make unsupported claims about the product.",
  cta_rules: "Include one relevant CTA per article. Match reader intent.",
  avoid_rules: "No keyword stuffing. No filler. No robotic language. No fake statistics. No generic intros.",
  custom_rules: "",
};

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; dot: string }> = {
  brief_pending: { label: "Brief Pending", color: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
  writing: { label: "Writing…", color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500 animate-pulse" },
  qa_pending: { label: "QA Pending", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
  needs_revision: { label: "Needs Revision", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  ready_for_approval: { label: "Awaiting Approval", color: "bg-indigo-50 text-indigo-600 border-indigo-200", dot: "bg-indigo-500 animate-pulse" },
  approved: { label: "Approved", color: "bg-emerald-50 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
  rejected: { label: "Rejected", color: "bg-neutral-100 text-neutral-500 border-neutral-200", dot: "bg-neutral-300" },
};

const QA_LABELS: Record<string, string> = {
  intent_match: "Search Intent Match",
  primary_keyword_present: "Primary Keyword Present",
  secondary_keywords_present: "Secondary Keywords Present",
  word_count_pass: "Word Count Target",
  style_pass: "Style Rules",
  heading_structure_pass: "Heading Structure",
  no_keyword_stuffing: "No Keyword Stuffing",
  no_filler: "No Filler Content",
  cta_present: "CTA Present",
  internal_links_present: "Internal Links",
  images_specified: "Images Specified",
  alt_text_present: "Alt Text Present",
  product_accuracy_pass: "Product Accuracy",
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ContentPlannerPage() {
  const [activeTab, setActiveTab] = useState("queue");
  const [selectedDraft, setSelectedDraft] = useState<ContentDraft | null>(DEMO_DRAFTS[0]);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [drafts, setDrafts] = useState<ContentDraft[]>(DEMO_DRAFTS);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [newDraftForm, setNewDraftForm] = useState({
    primary_keyword: "",
    secondary_keywords: "",
    search_intent: "informational",
    content_type: "blog_article",
    target_audience: "",
    working_title: "",
  });
  const [activeView, setActiveView] = useState<"preview" | "qa" | "meta" | "images">("preview");

  const handleGenerateDraft = async (draftId?: string) => {
    setGenerating(true);
    try {
      const payload = draftId
        ? drafts.find(d => d.id === draftId)
        : {
            primary_keyword: newDraftForm.primary_keyword,
            secondary_keywords: newDraftForm.secondary_keywords.split(",").map(k => k.trim()),
            search_intent: newDraftForm.search_intent,
            content_type: newDraftForm.content_type,
            target_audience: newDraftForm.target_audience || rules.audience,
            working_title: newDraftForm.working_title,
            rules,
          };

      await fetch("/api/agent/content/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Simulate update for demo
      if (draftId) {
        setDrafts(prev => prev.map(d => d.id === draftId ? { ...d, status: "ready_for_approval" as DraftStatus } : d));
      }
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  };

  const handleApproval = async (action: "approve" | "reject" | "revise") => {
    if (!selectedDraft) return;
    setApproving(action);
    try {
      await fetch("/api/agent/content/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_id: selectedDraft.id, action, notes: revisionNote }),
      });

      const statusMap: Record<string, DraftStatus> = { approve: "approved", reject: "rejected", revise: "needs_revision" };
      const newStatus = statusMap[action];
      setDrafts(prev => prev.map(d => d.id === selectedDraft.id ? { ...d, status: newStatus } : d));
      setSelectedDraft(prev => prev ? { ...prev, status: newStatus } : null);
      setShowRevisionInput(false);
      setRevisionNote("");
    } catch (e) { console.error(e); }
    finally { setApproving(null); }
  };

  const handleSaveRules = async () => {
    await fetch("/api/agent/content/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 2500);
  };

  const qaItems = selectedDraft?.qa
    ? Object.entries(selectedDraft.qa).filter(([k]) => k in QA_LABELS)
    : [];

  const qaPassed = qaItems.filter(([, v]) => v === true).length;
  const qaTotal = qaItems.length;

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>AI Agents</span><span>/</span>
            <span className="text-neutral-700 font-medium">Content Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Content Agent</h1>
              <p className="text-neutral-500 text-xs mt-0.5">Plans, drafts, QA-checks, and prepares content for human approval. Never publishes autonomously.</p>
            </div>
            <button
              onClick={() => { setActiveTab("new"); }}
              className="bg-indigo-600 hover:bg-indigo-700 text-neutral-900 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Content Draft
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0">
            {[
              { id: "queue", label: "Content Queue", icon: Layers },
              { id: "studio", label: "Draft Studio", icon: PenLine },
              { id: "rules", label: "Content Rules", icon: Settings },
              { id: "new", label: "New Draft", icon: Plus },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors relative ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {label}
                {id === "queue" && (
                  <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {drafts.filter(d => d.status === "ready_for_approval").length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">

          {/* ── QUEUE TAB ── */}
          {activeTab === "queue" && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Drafts", value: drafts.length, color: "text-neutral-900" },
                  { label: "Awaiting Approval", value: drafts.filter(d => d.status === "ready_for_approval").length, color: "text-indigo-600" },
                  { label: "Approved", value: drafts.filter(d => d.status === "approved").length, color: "text-emerald-600" },
                  { label: "Needs Revision", value: drafts.filter(d => d.status === "needs_revision").length, color: "text-red-500" },
                ].map((m, i) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{m.label}</span>
                    <span className={`text-3xl font-bold ${m.color}`}>{m.value}</span>
                  </div>
                ))}
              </div>

              {drafts.map(draft => {
                const sc = STATUS_CONFIG[draft.status];
                return (
                  <div
                    key={draft.id}
                    onClick={() => { setSelectedDraft(draft); setActiveTab("studio"); }}
                    className="bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-sm rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-sm">{draft.working_title}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-neutral-500 font-mono">{draft.primary_keyword}</span>
                          <span className="text-[10px] text-neutral-500 capitalize">{draft.search_intent.replace(/_/g, " ")}</span>
                          <span className="text-[10px] text-neutral-500 capitalize">{draft.content_type.replace(/_/g, " ")}</span>
                          {draft.word_count > 0 && (
                            <span className="text-[10px] text-neutral-500">{draft.word_count.toLocaleString()} words · {draft.reading_time} min read</span>
                          )}
                          <span className="text-[10px] text-neutral-500">v{draft.version}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      {draft.status === "brief_pending" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleGenerateDraft(draft.id); }}
                          disabled={generating}
                          className="bg-indigo-600 hover:bg-indigo-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          Generate
                        </button>
                      )}
                      {draft.status === "ready_for_approval" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedDraft(draft); setActiveTab("studio"); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Review
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-neutral-700" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── DRAFT STUDIO TAB ── */}
          {activeTab === "studio" && selectedDraft && (
            <div className="grid grid-cols-12 gap-6">
              {/* Left: Draft Content */}
              <div className="col-span-8 space-y-4">
                {/* Header */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-neutral-900">{selectedDraft.working_title}</h2>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                        <span className="font-mono text-indigo-600">{selectedDraft.primary_keyword}</span>
                        <span>·</span>
                        <span className="capitalize">{selectedDraft.search_intent.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span className="capitalize">{selectedDraft.content_type.replace(/_/g, " ")}</span>
                        {selectedDraft.word_count > 0 && <><span>·</span><span>{selectedDraft.word_count.toLocaleString()} words · {selectedDraft.reading_time} min read</span></>}
                        <span>·</span>
                        <span className="flex items-center gap-1"><History className="w-3 h-3" /> v{selectedDraft.version}</span>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${STATUS_CONFIG[selectedDraft.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedDraft.status].dot}`} />
                      {STATUS_CONFIG[selectedDraft.status].label}
                    </span>
                  </div>

                  {/* View Selector */}
                  <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 text-[11px] font-medium">
                    {([["preview", "Article Preview", BookOpen], ["qa", "QA Results", ListChecks], ["meta", "SEO Metadata", Tag], ["images", "Image Requirements", Image]] as const).map(([id, label, Icon]) => (
                      <button key={id} onClick={() => setActiveView(id as any)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors ${activeView === id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}>
                        <Icon className="w-3.5 h-3.5" />{label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content Views */}
                {activeView === "preview" && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    {selectedDraft.content_body ? (
                      <div className="prose prose-sm prose-neutral max-w-none">
                        {selectedDraft.content_body.split('\n').map((line, i) => {
                          if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold text-neutral-900 mt-0 mb-4">{line.slice(2)}</h1>;
                          if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-neutral-800 mt-6 mb-2 border-b border-neutral-100 pb-1">{line.slice(3)}</h2>;
                          if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-neutral-800 mt-4 mb-1">{line.slice(4)}</h3>;
                          if (line.startsWith('[IMAGE:')) return (
                            <div key={i} className="my-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-600 font-medium flex items-center gap-2">
                              <Image className="w-4 h-4 shrink-0" />
                              <span className="font-mono">{line}</span>
                            </div>
                          );
                          if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 text-neutral-700 text-sm mb-1">{line.slice(2)}</li>;
                          if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-neutral-900 text-sm mt-3">{line.replace(/\*\*/g, '')}</p>;
                          if (line.trim() === '') return <div key={i} className="h-3" />;
                          return <p key={i} className="text-neutral-700 text-sm leading-relaxed mb-2">{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-neutral-500">
                        <PenLine className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No draft content yet. Generate the draft first.</p>
                      </div>
                    )}
                  </div>
                )}

                {activeView === "qa" && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-neutral-900">QA Checklist</h3>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${selectedDraft.qa?.overall_status === 'pass' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {qaPassed}/{qaTotal} Passed — {selectedDraft.qa?.overall_status === 'pass' ? 'READY FOR APPROVAL' : 'NEEDS REVISION'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {qaItems.map(([key, value]) => (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${value === true ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                          <span className={value === true ? 'text-emerald-800' : 'text-red-700'}>{QA_LABELS[key]}</span>
                          {value === true
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : <XCircle className="w-4 h-4 text-red-500" />
                          }
                        </div>
                      ))}
                    </div>
                    {selectedDraft.qa?.facts_flagged && (selectedDraft.qa.facts_flagged as string[]).length > 0 && (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Claims to Verify</p>
                        {(selectedDraft.qa.facts_flagged as string[]).map((f, i) => (
                          <p key={i} className="text-xs text-amber-700 ml-5">{f}</p>
                        ))}
                      </div>
                    )}
                    {selectedDraft.qa?.qa_notes && (
                      <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600">
                        {selectedDraft.qa.qa_notes as string}
                      </div>
                    )}
                  </div>
                )}

                {activeView === "meta" && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 className="font-semibold text-neutral-900 mb-4">SEO Metadata</h3>
                    <div className="space-y-4">
                      {[
                        { label: "SEO Title", value: selectedDraft.seo_title, hint: `${selectedDraft.seo_title?.length || 0}/60 chars`, good: (selectedDraft.seo_title?.length || 0) <= 60 },
                        { label: "Meta Description", value: selectedDraft.meta_description, hint: `${selectedDraft.meta_description?.length || 0}/155 chars`, good: (selectedDraft.meta_description?.length || 0) <= 155 },
                        { label: "URL Slug", value: `/${selectedDraft.url_slug}`, hint: "Canonical URL path", good: true },
                      ].map((f, i) => (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{f.label}</label>
                            <span className={`text-[10px] font-medium ${f.good ? 'text-emerald-600' : 'text-red-500'}`}>{f.hint}</span>
                          </div>
                          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-sm text-neutral-800 font-mono">
                            {f.value || <span className="text-neutral-500 italic">Not generated</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* SERP Preview */}
                    <div className="mt-4 p-4 bg-white border border-neutral-200 rounded-xl">
                      <p className="text-[10px] text-neutral-500 uppercase font-semibold mb-3">SERP Preview</p>
                      <div className="text-blue-700 text-base font-medium hover:underline cursor-pointer">{selectedDraft.seo_title}</div>
                      <div className="text-emerald-700 text-xs mt-0.5">https://yoursite.com/{selectedDraft.url_slug}</div>
                      <div className="text-neutral-600 text-sm mt-1 leading-relaxed">{selectedDraft.meta_description}</div>
                    </div>
                  </div>
                )}

                {activeView === "images" && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                    <h3 className="font-semibold text-neutral-900 mb-4">Image Requirements</h3>
                    <div className="text-xs text-neutral-500 flex items-start gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl mb-4">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      These image requirements are passed to the Image Agent for creation. Each image has a defined purpose, placement, alt text, and filename.
                    </div>
                    {selectedDraft.images?.map((img, i) => (
                      <div key={i} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full capitalize">{img.image_type}</span>
                          <span className="text-xs text-neutral-500">{img.placement_context}</span>
                        </div>
                        <p className="text-sm font-medium text-neutral-800">{img.purpose}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white border border-neutral-200 rounded-lg p-2">
                            <span className="text-neutral-500 block mb-0.5">Alt Text</span>
                            <span className="font-mono text-neutral-700">{img.alt_text}</span>
                          </div>
                          <div className="bg-white border border-neutral-200 rounded-lg p-2">
                            <span className="text-neutral-500 block mb-0.5">Filename</span>
                            <span className="font-mono text-neutral-700">{img.suggested_filename}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right: Approval Panel */}
              <div className="col-span-4 space-y-4">
                {/* Approval Action Card */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 sticky top-0">
                  <h4 className="font-semibold text-neutral-900 text-sm mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-500" /> Human Approval Required
                  </h4>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 mb-4 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    The Content Agent will never publish without your explicit approval. Review the draft, QA results, and metadata before deciding.
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={() => handleApproval("approve")}
                      disabled={!!approving || selectedDraft.status !== "ready_for_approval"}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-neutral-900 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {approving === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve — Send to Publisher
                    </button>

                    <button
                      onClick={() => setShowRevisionInput(v => !v)}
                      disabled={!!approving}
                      className="w-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Request Revision
                    </button>

                    {showRevisionInput && (
                      <div className="space-y-2">
                        <textarea
                          value={revisionNote}
                          onChange={e => setRevisionNote(e.target.value)}
                          placeholder="Describe what needs to be revised…"
                          rows={3}
                          className="w-full border border-neutral-200 bg-neutral-50 rounded-xl p-3 text-xs focus:outline-none focus:border-indigo-400 resize-none text-neutral-800"
                        />
                        <button
                          onClick={() => handleApproval("revise")}
                          disabled={!revisionNote.trim() || !!approving}
                          className="w-full bg-neutral-50 hover:bg-neutral-100 disabled:opacity-40 text-neutral-900 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"
                        >
                          {approving === "revise" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send Revision Notes
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => handleApproval("reject")}
                      disabled={!!approving}
                      className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" /> Reject Draft
                    </button>
                  </div>
                </div>

                {/* QA Summary */}
                {selectedDraft.qa && (
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                    <h4 className="font-semibold text-neutral-900 text-sm mb-3">QA Summary</h4>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(qaPassed / qaTotal) * 100}%` }} />
                      </div>
                      <span className="text-xs font-bold text-neutral-700">{qaPassed}/{qaTotal}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${selectedDraft.qa.overall_status === 'pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {selectedDraft.qa.overall_status === 'pass' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {selectedDraft.qa.overall_status === 'pass' ? 'All checks passed' : 'Revision needed'}
                    </span>
                  </div>
                )}

                {/* Content Info */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <h4 className="font-semibold text-neutral-900 text-sm">Content Info</h4>
                  {[
                    ["Primary Keyword", selectedDraft.primary_keyword],
                    ["Search Intent", selectedDraft.search_intent?.replace(/_/g, " ")],
                    ["Content Type", selectedDraft.content_type?.replace(/_/g, " ")],
                    ["Word Count", selectedDraft.word_count > 0 ? `${selectedDraft.word_count.toLocaleString()} words` : "—"],
                    ["Reading Time", selectedDraft.reading_time > 0 ? `${selectedDraft.reading_time} min` : "—"],
                    ["Version", `v${selectedDraft.version}`],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-neutral-500 font-medium">{label}</span>
                      <span className="text-neutral-800 font-semibold capitalize">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── CONTENT RULES TAB ── */}
          {activeTab === "rules" && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Project-wide content rules.</strong> The Content Agent follows these rules for every article on this project. Changes apply to future drafts only. You can modify these at any time.
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-semibold text-neutral-900">Writing Rules</h3>
                {[
                  { key: "language", label: "Language", placeholder: "U.S. English" },
                  { key: "tone", label: "Tone", placeholder: "Professional, natural, helpful" },
                  { key: "audience", label: "Target Audience", placeholder: "SaaS founders and marketing teams" },
                  { key: "author_style", label: "Author Style", placeholder: "Experienced SEO content writer" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">{label}</label>
                    <input type="text" value={(rules as any)[key]} onChange={e => setRules(r => ({ ...r, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
                  </div>
                ))}
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-semibold text-neutral-900">Word Count</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: "word_count_min", label: "Minimum Words" },
                    { key: "word_count_max", label: "Maximum Words" },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">{label}</label>
                      <input type="number" value={(rules as any)[key]} onChange={e => setRules(r => ({ ...r, [key]: parseInt(e.target.value) }))}
                        className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-semibold text-neutral-900">Content Standards</h3>
                {[
                  { key: "structure_rules", label: "Structure Rules", rows: 2 },
                  { key: "paragraph_style", label: "Paragraph Style", rows: 2 },
                  { key: "brand_rules", label: "Brand Rules", rows: 2 },
                  { key: "cta_rules", label: "CTA Rules", rows: 2 },
                  { key: "avoid_rules", label: "Avoid", rows: 3 },
                  { key: "source_rules", label: "Sources & Fact-Checking", rows: 2 },
                  { key: "image_rules", label: "Image Rules", rows: 2 },
                  { key: "custom_rules", label: "Custom Rules (optional)", rows: 3 },
                ].map(({ key, label, rows }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">{label}</label>
                    <textarea value={(rules as any)[key] || ''} onChange={e => setRules(r => ({ ...r, [key]: e.target.value }))}
                      rows={rows} placeholder={`Define ${label.toLowerCase()}…`}
                      className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400 resize-none" />
                  </div>
                ))}
              </div>

              <button onClick={handleSaveRules}
                className="bg-indigo-600 hover:bg-indigo-700 text-neutral-900 font-bold text-sm px-6 py-3 rounded-xl flex items-center gap-2 transition-colors shadow-sm">
                {rulesSaved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Content Rules</>}
              </button>
            </div>
          )}

          {/* ── NEW DRAFT TAB ── */}
          {activeTab === "new" && (
            <div className="max-w-2xl space-y-6">
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-semibold text-neutral-900 text-base">Create New Content Draft</h3>
                <div className="text-xs text-neutral-500 flex items-start gap-2 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  The Content Agent will generate a brief, then write the draft following your content rules. The draft will go through QA before it reaches you for approval.
                </div>

                {[
                  { key: "primary_keyword", label: "Primary Keyword *", placeholder: "ai seo agent for saas companies", required: true },
                  { key: "working_title", label: "Working Title", placeholder: "AI SEO Agent for SaaS Companies: Complete Guide" },
                  { key: "secondary_keywords", label: "Secondary Keywords (comma separated)", placeholder: "autonomous seo tool, ai seo automation" },
                  { key: "target_audience", label: "Target Audience", placeholder: `Default: ${rules.audience}` },
                ].map(({ key, label, placeholder, required }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">{label}</label>
                    <input type="text" value={(newDraftForm as any)[key]} onChange={e => setNewDraftForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Search Intent</label>
                    <select value={newDraftForm.search_intent} onChange={e => setNewDraftForm(f => ({ ...f, search_intent: e.target.value }))}
                      className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400">
                      <option value="informational">Informational</option>
                      <option value="commercial_investigation">Commercial Investigation</option>
                      <option value="transactional">Transactional</option>
                      <option value="comparison">Comparison</option>
                      <option value="problem_solution">Problem / Solution</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Content Type</label>
                    <select value={newDraftForm.content_type} onChange={e => setNewDraftForm(f => ({ ...f, content_type: e.target.value }))}
                      className="w-full border border-neutral-200 bg-neutral-50 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400">
                      <option value="blog_article">Blog Article</option>
                      <option value="landing_page">Landing Page</option>
                      <option value="feature_page">Feature Page</option>
                      <option value="comparison_page">Comparison Page</option>
                      <option value="guide">Guide</option>
                      <option value="use_case_page">Use Case Page</option>
                      <option value="faq">FAQ</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1 text-xs text-neutral-600">
                  <p className="font-semibold text-neutral-700 mb-2">Applied Content Rules</p>
                  <p><span className="text-neutral-500">Word count:</span> {rules.word_count_min}–{rules.word_count_max} words</p>
                  <p><span className="text-neutral-500">Tone:</span> {rules.tone}</p>
                  <p><span className="text-neutral-500">Audience:</span> {rules.audience}</p>
                  <p className="mt-1">
                    <button onClick={() => setActiveTab("rules")} className="text-indigo-600 hover:underline font-medium">Edit content rules →</button>
                  </p>
                </div>

                <button
                  onClick={() => handleGenerateDraft()}
                  disabled={!newDraftForm.primary_keyword || generating}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-neutral-900 font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching → Briefing → Writing → QA…</>
                    : <><Sparkles className="w-4 h-4" /> Generate Draft (Brief → Write → QA)</>
                  }
                </button>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5">
                <h4 className="font-semibold text-neutral-700 text-sm mb-3 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-indigo-500" /> What Happens Next
                </h4>
                <div className="space-y-2 text-xs text-neutral-600">
                  {[
                    ["1", "Validate inputs — check all required fields are present"],
                    ["2", "Generate content brief — structure, questions, image requirements"],
                    ["3", "Write draft — following your content rules"],
                    ["4", "Run QA — automated checklist (intent, keyword, style, facts, images)"],
                    ["5", "Generate SEO metadata — title, meta description, URL slug"],
                    ["6", "STATUS: WAITING FOR HUMAN APPROVAL"],
                  ].map(([step, desc]) => (
                    <div key={step} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
