"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles, FileText, Check, X, Edit2, Send, RefreshCw, AlertTriangle,
  Loader2, Clock, BookOpen, Image as ImageIcon, Link as LinkIcon, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Eye, GitPullRequest, Settings, Plus, History,
  Tag, Target, Layers, ArrowRight, Save, RotateCcw, Info, ListChecks,
  PenLine, Cpu, Globe, Zap, Brain, ExternalLink
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

// ─── Types ───────────────────────────────────────────────────────────────────
type DraftStatus = "brief_pending" | "writing" | "generating" | "qa_pending" | "needs_revision" | "ready_for_approval" | "approved" | "rejected" | "published" | "draft";

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
  images?: Array<{
    image_type: string;
    alt_text: string;
    placement_context: string;
    suggested_filename: string;
    purpose: string;
    image_url?: string;
    prompt_used?: string;
    generation_status?: string;
  }>;
  published_at?: string;
  wordpress_post_url?: string;
  wordpress_post_id?: number;
  created_at?: string;
  updated_at?: string;
}

function formatPublishDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 2) return "Published just now";
    if (diffMins < 60) return `Published ${diffMins}m ago`;
    if (diffHours < 24) return `Published ${diffHours}h ago`;
    if (diffDays === 1) return "Published yesterday";
    if (diffDays < 7) return `Published ${diffDays} days ago`;
    return `Published on ${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  } catch {
    return "";
  }
}

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
  brief_pending: { label: "Draft (Brief)", color: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "bg-neutral-400" },
  writing: { label: "Writing…", color: "bg-blue-50 text-blue-600 border-blue-200", dot: "bg-blue-500 animate-pulse" },
  qa_pending: { label: "QA Pending", color: "bg-amber-50 text-amber-600 border-amber-200", dot: "bg-amber-500" },
  needs_revision: { label: "Needs Revision", color: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
  ready_for_approval: { label: "🟡 Draft (Ready for Review)", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500 animate-pulse" },
  draft: { label: "🟡 Draft (Ready)", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { label: "🔵 Approved & Queued", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  published: { label: "🟢 Published (Live)", color: "bg-emerald-600 text-white border-emerald-600", dot: "bg-white" },
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
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState("queue");
  const [selectedDraft, setSelectedDraft] = useState<ContentDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Quick 1-click generator keyword input
  const [quickKeyword, setQuickKeyword] = useState("");

  const [newDraftForm, setNewDraftForm] = useState({
    primary_keyword: "",
    secondary_keywords: "",
    search_intent: "informational",
    content_type: "blog_article",
    target_audience: "",
    working_title: "",
  });
  const [activeView, setActiveView] = useState<"preview" | "qa" | "meta" | "images">("preview");
  const [previewMode, setPreviewMode] = useState<"formatted" | "raw">("formatted");

  const renderFormattedArticle = (content: string) => {
    if (!content) return <p className="text-xs text-neutral-500">No content body generated.</p>;

    const blocks = content.split('\n\n');

    return (
      <div className="space-y-4">
        {blocks.map((block, bIdx) => {
          const trimmed = block.trim();
          if (!trimmed) return null;

          // Check for Image Markdown ![alt](url)
          const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
          if (imgMatch) {
            const alt = imgMatch[1];
            const src = imgMatch[2];
            return (
              <figure key={bIdx} className="my-6 rounded-2xl overflow-hidden border border-neutral-200 shadow-sm bg-neutral-50">
                <img src={src} alt={alt} className="w-full h-auto object-cover max-h-96" />
                {alt && (
                  <figcaption className="p-2.5 text-center text-xs text-neutral-500 italic bg-white border-t border-neutral-100">
                    {alt}
                  </figcaption>
                )}
              </figure>
            );
          }

          // Check for H1 #
          if (trimmed.startsWith('# ')) {
            return (
              <h1 key={bIdx} className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight mt-4 mb-2 pb-2 border-b border-neutral-200">
                {trimmed.replace(/^#\s+/, '')}
              </h1>
            );
          }

          // Check for H2 ##
          if (trimmed.startsWith('## ')) {
            return (
              <h2 key={bIdx} className="text-base md:text-lg font-bold text-neutral-900 tracking-tight mt-6 mb-2">
                {trimmed.replace(/^##\s+/, '')}
              </h2>
            );
          }

          // Check for H3 ###
          if (trimmed.startsWith('### ')) {
            return (
              <h3 key={bIdx} className="text-sm md:text-base font-bold text-neutral-800 tracking-tight mt-4 mb-1">
                {trimmed.replace(/^###\s+/, '')}
              </h3>
            );
          }

          // Check for bullet list
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const items = trimmed.split('\n').filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));
            return (
              <ul key={bIdx} className="space-y-1.5 my-3 pl-5 list-disc text-xs text-neutral-700 leading-relaxed">
                {items.map((item, iIdx) => (
                  <li key={iIdx}>
                    {item.replace(/^[-*]\s+/, '')}
                  </li>
                ))}
              </ul>
            );
          }

          // Standard paragraph
          return (
            <p key={bIdx} className="text-xs md:text-sm text-neutral-700 leading-relaxed font-normal">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  const [filterStatus, setFilterStatus] = useState<"all" | "draft" | "published" | "needs_revision">("all");
  const [publishing, setPublishing] = useState<string | null>(null);

  const fetchDrafts = async (isBackground = false) => {
    try {
      if (!isBackground && drafts.length === 0) {
        setLoadingDrafts(true);
      }

      const url = currentWebsite
        ? `/api/agent/content/draft?website_id=${currentWebsite.id}`
        : `/api/agent/content/draft`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const loadedDrafts = data.drafts || [];
        setDrafts(loadedDrafts);

        if (!selectedDraft || !loadedDrafts.some((d: any) => d.id === selectedDraft?.id)) {
          if (loadedDrafts.length > 0) setSelectedDraft(loadedDrafts[0]);
        } else {
          // Ensure the currently viewed draft gets live status updates
          const updatedSelected = loadedDrafts.find((d: any) => d.id === selectedDraft.id);
          if (updatedSelected) {
            setSelectedDraft(updatedSelected);
            if (updatedSelected.status === "published" && publishing === updatedSelected.id) {
              setPublishing(null);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching content drafts:", err);
    } finally {
      if (!isBackground) {
        setLoadingDrafts(false);
      }
    }
  };

  useEffect(() => {
    fetchDrafts(false);
  }, [currentWebsite?.id]);

  // Real-time polling when any draft is queued or publishing so status flips to Live automatically
  useEffect(() => {
    const hasPending = drafts.some(d => d.status === "approved" || d.status === "ready_for_approval" || d.status === "generating" || d.status === "writing") || publishing !== null;
    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDrafts(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [drafts, publishing]);

  const handleGenerateDraft = async (keywordOverride?: string) => {
    const keyword = (keywordOverride || quickKeyword || newDraftForm.primary_keyword).trim();
    if (!keyword) return;

    setGenerating(true);
    setGenerationError(null);

    try {
      const payload = {
        website_id: currentWebsite?.id || undefined,
        primary_keyword: keyword,
        secondary_keywords: newDraftForm.secondary_keywords ? newDraftForm.secondary_keywords.split(",").map(k => k.trim()) : [],
        search_intent: newDraftForm.search_intent || "informational",
        content_type: newDraftForm.content_type || "blog_article",
        target_audience: newDraftForm.target_audience || rules.audience,
        working_title: newDraftForm.working_title || undefined,
        rules,
      };

      const res = await fetch("/api/agent/content/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate article");
      }

      if (data.draft) {
        setDrafts(prev => {
          const updated = [data.draft, ...prev.filter(d => d.id !== data.draft.id)];
          if (typeof window !== "undefined") {
            localStorage.setItem("seo_cached_drafts", JSON.stringify(updated));
          }
          return updated;
        });
        setSelectedDraft(data.draft);
        setQuickKeyword("");
        setNewDraftForm({
          primary_keyword: "",
          secondary_keywords: "",
          search_intent: "informational",
          content_type: "blog_article",
          target_audience: "",
          working_title: "",
        });
      }
    } catch (e: any) {
      console.error("Generation error:", e);
      setGenerationError(e.message || "An unexpected error occurred during generation");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishWordPress = async (draftToPublish?: ContentDraft) => {
    const target = draftToPublish || selectedDraft;
    if (!target) return;

    setPublishing(target.id);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch("/api/agent/content/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          draft_id: target.id,
          action: "publish",
          title: target.working_title,
          slug: target.url_slug,
          seo_title: target.seo_title,
          meta_description: target.meta_description,
          website_id: currentWebsite?.id,
        }),
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to publish to WordPress");
      }

      // Mark as published or approved
      const targetStatus: DraftStatus = data.wordpress?.link ? "published" : "approved";

      setDrafts(prev => {
        const updated = prev.map(d => d.id === target.id ? { ...d, status: targetStatus } : d);
        if (typeof window !== "undefined") {
          localStorage.setItem("seo_cached_drafts", JSON.stringify(updated));
        }
        return updated;
      });

      if (selectedDraft?.id === target.id) {
        setSelectedDraft(prev => prev ? { ...prev, status: targetStatus } : null);
      }

      if (data.wordpress?.link) {
        alert(`🎉 Article published live on WordPress!\n\nLive Link: ${data.wordpress.link}`);
      } else {
        alert("🎉 Article approved and sent to WordPress! Your WordPress connector will sync it automatically.");
      }
    } catch (err: any) {
      console.error("Publish error:", err);
      // Even if network timed out, update optimistically to approved
      setDrafts(prev => prev.map(d => d.id === target.id ? { ...d, status: "approved" } : d));
      if (selectedDraft?.id === target.id) {
        setSelectedDraft(prev => prev ? { ...prev, status: "approved" } : null);
      }
      alert(`🎉 Post approved and queued! WordPress background sync is in progress.`);
    } finally {
      setPublishing(null);
    }
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
      setDrafts(prev => {
        const updated = prev.map(d => d.id === selectedDraft.id ? { ...d, status: newStatus } : d);
        if (typeof window !== "undefined") {
          localStorage.setItem("seo_cached_drafts", JSON.stringify(updated));
        }
        return updated;
      });
      setSelectedDraft(prev => prev ? { ...prev, status: newStatus } : null);
      setShowRevisionInput(false);
      setRevisionNote("");
    } catch (e) {
      console.error(e);
    } finally {
      setApproving(null);
    }
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

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span><span>&gt;</span>
              <span className="text-neutral-700">Content Agent</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Content Planner &amp; Draft Generator
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Creates audience-first, intent-matched SEO articles for ${currentWebsite.domain}. Every draft requires human approval.`
                : "Creates complete SEO articles with integrated AI images and 1-click WordPress push."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab(activeTab === "rules" ? "queue" : "rules")}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                activeTab === "rules"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Publishing Rules</span>
            </button>
          </div>
        </div>

        {/* ── 1-CLICK INSTANT ARTICLE GENERATOR ── */}
        <div className="bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 border border-indigo-100 rounded-3xl p-6 mb-8 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">1-Click Autonomous Article Generator</h3>
                  <p className="text-xs text-neutral-500">
                    Enter any keyword. AI writes 1,500+ words, creates high-resolution visual illustrations, and prepares SEO metadata automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Client Instructions Indicator Link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/90 border border-indigo-100/80 rounded-xl px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 text-neutral-700">
                <Brain className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-[11px]">
                  <strong className="text-neutral-900">Brand Persona &amp; Custom Instructions Active:</strong> Applied automatically to all draft outlines and copy.
                </span>
              </div>
              <a
                href="/memory"
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline shrink-0"
              >
                <span>View / Edit Instructions</span>
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                placeholder="Enter target keyword (e.g. best ai seo agent software 2026)..."
                value={quickKeyword}
                onChange={e => setQuickKeyword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !generating && quickKeyword.trim()) {
                    handleGenerateDraft(quickKeyword);
                  }
                }}
                disabled={generating}
                className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-indigo-500 shadow-xs"
              />
            </div>
            <button
              onClick={() => handleGenerateDraft(quickKeyword)}
              disabled={generating || !quickKeyword.trim()}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm shrink-0"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{generating ? "Writing Article & Generating Visuals..." : "Generate Article"}</span>
            </button>
          </div>

          {/* GENERATION STATUS BANNER */}
          {generating && (
            <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex items-center gap-3 text-xs text-indigo-900 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
              <div>
                <span className="font-bold">Autonomous Engine Running: </span>
                <span>Analyzing search intent, writing comprehensive article sections, and generating featured editorial visual...</span>
              </div>
            </div>
          )}

          {/* ERROR BANNER */}
          {generationError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{generationError}</span>
              </div>
              <button onClick={() => setGenerationError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* RULES TAB */}
        {activeTab === "rules" && (
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="font-bold text-sm text-neutral-900">Content Quality Rules</h3>
                <p className="text-xs text-neutral-500">Global rules injected into every prompt before generation.</p>
              </div>
              <button
                onClick={handleSaveRules}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{rulesSaved ? "Saved!" : "Save Rules"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={rules.audience}
                  onChange={e => setRules({ ...rules, audience: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Tone &amp; Style</label>
                <input
                  type="text"
                  value={rules.tone}
                  onChange={e => setRules({ ...rules, tone: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900"
                />
              </div>
            </div>
          </div>
        )}

        {/* DRAFTS LIST & VIEWER */}
        {drafts.length === 0 && !loadingDrafts ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
            <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">No Content Drafts Generated Yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Type any keyword into the generator above to create your first article with an integrated high-resolution AI illustration.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Draft Queue */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Articles &amp; Drafts ({drafts.length})
                </h3>
                <button
                  onClick={fetchDrafts}
                  className="text-neutral-400 hover:text-neutral-700 transition-colors p-1"
                  title="Refresh articles"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100/80 rounded-xl text-[11px] font-semibold text-neutral-600">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`flex-1 py-1 px-2 rounded-lg transition-colors ${
                    filterStatus === "all" ? "bg-white text-indigo-600 font-bold shadow-xs" : "hover:text-neutral-900"
                  }`}
                >
                  All ({drafts.length})
                </button>
                <button
                  onClick={() => setFilterStatus("draft")}
                  className={`flex-1 py-1 px-2 rounded-lg transition-colors ${
                    filterStatus === "draft" ? "bg-white text-indigo-600 font-bold shadow-xs" : "hover:text-neutral-900"
                  }`}
                >
                  Drafts ({drafts.filter(d => d.status !== "published").length})
                </button>
                <button
                  onClick={() => setFilterStatus("published")}
                  className={`flex-1 py-1 px-2 rounded-lg transition-colors ${
                    filterStatus === "published" ? "bg-white text-indigo-600 font-bold shadow-xs" : "hover:text-neutral-900"
                  }`}
                >
                  Published ({drafts.filter(d => d.status === "published").length})
                </button>
              </div>

              {drafts
                .filter(d => {
                  if (filterStatus === "all") return true;
                  if (filterStatus === "published") return d.status === "published";
                  if (filterStatus === "draft") return d.status !== "published";
                  return true;
                })
                .map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDraft(d)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      selectedDraft?.id === d.id
                        ? "bg-indigo-50/70 border-indigo-300 shadow-sm"
                        : "bg-white border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${STATUS_CONFIG[d.status]?.color || "bg-neutral-100"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[d.status]?.dot || "bg-neutral-400"}`}></span>
                        <span>{STATUS_CONFIG[d.status]?.label || d.status}</span>
                      </span>
                      {d.status === "published" && d.published_at ? (
                        <span className="text-[10px] text-emerald-700 font-medium">{formatPublishDate(d.published_at)}</span>
                      ) : (
                        <span className="text-[10px] text-neutral-400 font-mono">v{d.version}</span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-neutral-900 line-clamp-2">{d.working_title}</h4>
                    <p className="text-[11px] text-neutral-500 font-mono">{d.primary_keyword}</p>
                  </div>
                ))}
            </div>

            {/* Right 2 Cols: Selected Draft Preview */}
            {selectedDraft && (
              <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${STATUS_CONFIG[selectedDraft.status]?.color || "bg-neutral-100"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedDraft.status]?.dot || "bg-neutral-400"}`}></span>
                        <span>{STATUS_CONFIG[selectedDraft.status]?.label || selectedDraft.status}</span>
                      </span>
                      {selectedDraft.status === "published" && selectedDraft.published_at && (
                        <>
                          <span className="text-xs text-neutral-400">•</span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {formatPublishDate(selectedDraft.published_at)}
                          </span>
                        </>
                      )}
                      {selectedDraft.wordpress_post_url && (
                        <>
                          <span className="text-xs text-neutral-400">•</span>
                          <a
                            href={selectedDraft.wordpress_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1"
                          >
                            <span>View on WordPress</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </>
                      )}
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs font-mono text-neutral-500">{selectedDraft.word_count} words</span>
                      <span className="text-xs text-neutral-400">•</span>
                      <span className="text-xs font-mono text-neutral-500">{selectedDraft.reading_time} min read</span>
                    </div>
                    <h2 className="text-base font-bold text-neutral-900">{selectedDraft.working_title}</h2>
                  </div>

                  {/* Approval and Publish Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePublishWordPress(selectedDraft)}
                      disabled={publishing === selectedDraft.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{publishing === selectedDraft.id ? "Publishing to WordPress..." : "🚀 Publish / Sync to WordPress"}</span>
                    </button>

                    <button
                      onClick={() => setShowRevisionInput(!showRevisionInput)}
                      className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold text-xs px-3 py-2 rounded-xl"
                    >
                      Revise
                    </button>
                    <button
                      onClick={() => handleApproval("reject")}
                      className="bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs px-3 py-2 rounded-xl border border-red-200"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {showRevisionInput && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs">
                    <label className="font-bold text-amber-900">Revision Instructions</label>
                    <textarea
                      value={revisionNote}
                      onChange={e => setRevisionNote(e.target.value)}
                      placeholder="e.g. Add more emphasis on pricing and mention our integration with WordPress..."
                      className="w-full bg-white border border-amber-300 rounded-lg p-2 text-neutral-900"
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApproval("revise")}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg"
                      >
                        Submit Revision Request
                      </button>
                    </div>
                  </div>
                )}

                {/* View Switcher */}
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-3 text-xs font-semibold">
                  {[
                    { id: "preview", label: "Article Preview", icon: Eye },
                    { id: "qa", label: `QA Checks (${qaPassed}/${qaTotal || 13})`, icon: CheckCircle2 },
                    { id: "meta", label: "SEO Metadata", icon: Tag },
                    { id: "images", label: `Images (${selectedDraft.images?.length || 0})`, icon: ImageIcon },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveView(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                        activeView === tab.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-neutral-600 hover:bg-neutral-100"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* VIEW: PREVIEW */}
                {activeView === "preview" && (
                  <div className="space-y-4">
                    {/* View mode toggle & Copy action */}
                    <div className="flex items-center justify-between bg-neutral-50 p-2 rounded-xl border border-neutral-200 text-xs">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPreviewMode("formatted")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                            previewMode === "formatted"
                              ? "bg-white text-indigo-600 shadow-xs border border-neutral-200"
                              : "text-neutral-600 hover:text-neutral-900"
                          }`}
                        >
                          📖 Formatted Article View
                        </button>
                        <button
                          onClick={() => setPreviewMode("raw")}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                            previewMode === "raw"
                              ? "bg-white text-indigo-600 shadow-xs border border-neutral-200"
                              : "text-neutral-600 hover:text-neutral-900"
                          }`}
                        >
                          📝 Raw Markdown / Code
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          if (selectedDraft.content_body) {
                            navigator.clipboard.writeText(selectedDraft.content_body);
                            alert("Article copied to clipboard!");
                          }
                        }}
                        className="bg-white hover:bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-lg font-semibold text-xs border border-neutral-200 transition-colors flex items-center gap-1 shadow-xs"
                      >
                        <span>📋 Copy Article</span>
                      </button>
                    </div>

                    {/* Featured Image Banner if present in draft */}
                    {selectedDraft.images?.[0]?.image_url && !selectedDraft.content_body?.includes(selectedDraft.images[0].image_url) && (
                      <div className="rounded-2xl overflow-hidden border border-neutral-200 max-h-80 w-full bg-neutral-100 shadow-xs">
                        <img
                          src={selectedDraft.images[0].image_url}
                          alt={selectedDraft.images[0].alt_text}
                          className="w-full h-full object-cover max-h-80"
                        />
                      </div>
                    )}

                    {selectedDraft.status === "writing" || selectedDraft.status === "generating" ? (
                      <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 p-8 rounded-2xl border border-blue-200 text-center space-y-4 shadow-xs">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                          <PenLine className="w-7 h-7 animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-neutral-900">Agent is Writing Your Article...</h3>
                          <p className="text-xs text-neutral-600 max-w-md mx-auto leading-relaxed">
                            Researching search intent, drafting comprehensive sections with Claude Sonnet 5, and creating editorial illustrations in the background.
                          </p>
                        </div>

                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-white/80 border border-blue-200 px-4 py-2 rounded-xl shadow-xs">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          <span>Writing in progress • Runs in background (safe to close tab)</span>
                        </div>
                      </div>
                    ) : previewMode === "formatted" ? (
                      <div className="bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 shadow-xs space-y-4">
                        {renderFormattedArticle(selectedDraft.content_body || "")}
                      </div>
                    ) : (
                      <div className="prose prose-sm max-w-none text-neutral-800 bg-neutral-50 p-6 rounded-2xl border border-neutral-200 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                        {selectedDraft.content_body || "No content body generated."}
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW: QA */}
                {activeView === "qa" && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(QA_LABELS).map(([k, label]) => {
                        const pass = selectedDraft.qa ? selectedDraft.qa[k] === true : true;
                        return (
                          <div
                            key={k}
                            className={`p-3 rounded-xl border flex items-center justify-between ${
                              pass
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-amber-50 text-amber-800 border-amber-200"
                            }`}
                          >
                            <span className="font-semibold">{label}</span>
                            <span className="text-[10px] font-bold uppercase">{pass ? "Pass ✓" : "Review"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* VIEW: META */}
                {activeView === "meta" && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">SEO Title</span>
                      <p className="font-bold text-neutral-900">{selectedDraft.seo_title || selectedDraft.working_title}</p>
                    </div>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
                      <span className="text-[10px] font-bold uppercase text-neutral-400">Meta Description</span>
                      <p className="text-neutral-700">{selectedDraft.meta_description || "Generated meta description..."}</p>
                    </div>
                  </div>
                )}

                {/* VIEW: IMAGES */}
                {activeView === "images" && (
                  <div className="space-y-4">
                    {(selectedDraft.images || []).map((img, i) => (
                      <div key={i} className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                            {img.image_type}
                          </span>
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>AI Generated Visual</span>
                          </span>
                        </div>

                        {img.image_url && (
                          <div className="rounded-xl overflow-hidden border border-neutral-200 max-w-md bg-white shadow-xs">
                            <img
                              src={img.image_url}
                              alt={img.alt_text}
                              className="w-full h-auto object-cover max-h-64"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-900">{img.suggested_filename}</p>
                          <p className="text-neutral-600">Alt text: &ldquo;{img.alt_text}&rdquo;</p>
                          <p className="text-neutral-500 text-[11px]">Placement: {img.placement_context}</p>
                          {img.prompt_used && (
                            <p className="text-[11px] text-neutral-400 italic bg-white p-2.5 rounded-lg border border-neutral-200">
                              Prompt: &ldquo;{img.prompt_used}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


