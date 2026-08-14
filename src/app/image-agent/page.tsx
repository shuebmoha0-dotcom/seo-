"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Image as ImageIcon, Plus, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, FileText, Zap, RotateCcw, Eye, Download, Info, ChevronRight,
  ChevronDown, Camera, BarChart2, GitBranch, Layers, Layout, List,
  Lightbulb, Cpu, ArrowRight, Star, Shield, ShieldAlert, Search,
  ClipboardList, Package
} from "lucide-react";
import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ImageType =
  | "featured" | "illustration" | "diagram" | "workflow" | "infographic"
  | "comparison" | "chart" | "screenshot" | "product_screenshot"
  | "step_by_step" | "conceptual" | "data_visualization";

type GenerationMethod =
  | "ai_generated" | "media_library" | "licensed_source"
  | "programmatic" | "existing_asset" | "screenshot_required";

type ImageStatus =
  | "planning" | "prompt_ready" | "generating" | "generated"
  | "qa_passed" | "qa_failed" | "pending_approval"
  | "approved" | "rejected" | "needs_regeneration" | "published";

interface ImagePlanItem {
  id: string;
  image_type: ImageType;
  purpose: string;
  placement: string;
  placement_order: number;
  visual_description: string;
  aspect_ratio: string;
  dimensions: string;
  generation_method: GenerationMethod;
  generation_prompt?: string;
  filename: string;
  alt_text: string;
  caption?: string;
  status: ImageStatus;
  screenshot_required_note?: string;
  stored_path?: string;
}

interface QACheck {
  relevant_to_article: boolean;
  correct_visual_type: boolean;
  correct_placement: boolean;
  no_misleading_elements: boolean;
  no_fabricated_data: boolean;
  no_fake_product_ui: boolean;
  filename_descriptive: boolean;
  alt_text_accurate: boolean;
  follows_project_instructions: boolean;
}

interface ImageQAResult {
  image_id: string;
  checks: QACheck;
  passed: boolean;
  qa_notes: string;
  needs_regeneration: boolean;
}

interface ManifestItem {
  image_id: string;
  type: ImageType;
  purpose: string;
  placement: string;
  filename: string;
  alt_text: string;
  caption?: string;
  source: GenerationMethod;
  dimensions: string;
  aspect_ratio: string;
  status: string;
}

type Tab = "planner" | "images" | "manifest" | "qa";

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_IMAGES: ImagePlanItem[] = [
  {
    id: "img-1",
    image_type: "featured",
    purpose: "Visually represent the article topic and attract clicks from social and search results.",
    placement: "Article header — above the H1",
    placement_order: 0,
    visual_description: "Clean, modern featured image showing an AI robot assistant analyzing SEO data on a futuristic dashboard. Indigo and white palette. Professional, minimal composition.",
    aspect_ratio: "16:9",
    dimensions: "1200x630",
    generation_method: "ai_generated",
    generation_prompt: "Professional hero image for an article about AI SEO agents for SaaS companies. Shows a sleek AI interface with analytics dashboard. Indigo and white color scheme. Clean, modern, no text. Suitable as blog header.",
    filename: "ai-seo-agent-saas-featured.webp",
    alt_text: "AI SEO agent dashboard interface showing automated keyword analysis for a SaaS company",
    status: "pending_approval",
  },
  {
    id: "img-2",
    image_type: "workflow",
    purpose: "Explain the Observe → Reason → Plan → Execute → Verify agent loop referenced in Section 2.",
    placement: "After H2: How the AI SEO Agent Works",
    placement_order: 1,
    visual_description: "Circular flowchart with 5 steps: Observe → Reason → Plan → Execute → Verify. Each step in an indigo rounded box with white text. Arrows connecting them in a loop. Clean, minimal, professional.",
    aspect_ratio: "16:9",
    dimensions: "1200x675",
    generation_method: "ai_generated",
    generation_prompt: "Educational workflow diagram showing 5-step AI agent loop: Observe, Reason, Plan, Execute, Verify. Each step in a clean rounded rectangle with arrows forming a cycle. Indigo and white color palette. Minimal text labels only. Professional diagram style.",
    filename: "ai-seo-agent-workflow-observe-reason-plan-execute-verify.webp",
    alt_text: "AI SEO agent workflow showing Observe, Reason, Plan, Execute, Verify cycle",
    status: "pending_approval",
  },
  {
    id: "img-3",
    image_type: "comparison",
    purpose: "Compare autonomous SEO agents vs traditional SEO tools — reinforces the article's main argument.",
    placement: "After H2: AI SEO Agent vs Traditional SEO Tools",
    placement_order: 2,
    visual_description: "Side-by-side comparison graphic. Left: Traditional SEO (grey tone, manual icons, slow clock). Right: AI SEO Agent (indigo tone, automation icons, fast lightning bolt). Clean rows comparing: Execution, Speed, Coverage, Reporting, Learning.",
    aspect_ratio: "16:9",
    dimensions: "1200x675",
    generation_method: "ai_generated",
    generation_prompt: "Side-by-side comparison infographic: Traditional SEO Tools vs AI SEO Agent. Left column grey tones, manual work icons. Right column indigo tones, automation icons. Rows compare: execution speed, coverage, reporting, adaptability. Clean and minimal design.",
    filename: "ai-seo-agent-vs-traditional-seo-comparison.webp",
    alt_text: "Comparison of traditional SEO tools vs AI SEO agent across execution, speed, coverage, and reporting",
    status: "qa_failed",
  },
];

const DEMO_QA: ImageQAResult[] = [
  {
    image_id: "img-1",
    checks: {
      relevant_to_article: true, correct_visual_type: true, correct_placement: true,
      no_misleading_elements: true, no_fabricated_data: true, no_fake_product_ui: true,
      filename_descriptive: true, alt_text_accurate: true, follows_project_instructions: true,
    },
    passed: true,
    qa_notes: "All checks passed. Image is relevant, clean, and correctly specified.",
    needs_regeneration: false,
  },
  {
    image_id: "img-2",
    checks: {
      relevant_to_article: true, correct_visual_type: true, correct_placement: true,
      no_misleading_elements: true, no_fabricated_data: true, no_fake_product_ui: true,
      filename_descriptive: true, alt_text_accurate: true, follows_project_instructions: true,
    },
    passed: true,
    qa_notes: "All checks passed. Workflow diagram is well-specified and correctly placed.",
    needs_regeneration: false,
  },
  {
    image_id: "img-3",
    checks: {
      relevant_to_article: true, correct_visual_type: true, correct_placement: true,
      no_misleading_elements: true, no_fabricated_data: false, no_fake_product_ui: true,
      filename_descriptive: true, alt_text_accurate: true, follows_project_instructions: true,
    },
    passed: false,
    qa_notes: "Failed: no_fabricated_data. Comparison rows include invented performance metrics. Revise prompt to remove specific numbers.",
    needs_regeneration: true,
  },
];

const DEMO_MANIFEST: ManifestItem[] = [
  { image_id: "img-1", type: "featured", purpose: "Article hero visual", placement: "Article header", filename: "ai-seo-agent-saas-featured.webp", alt_text: "AI SEO agent dashboard interface showing automated keyword analysis for a SaaS company", source: "ai_generated", dimensions: "1200x630", aspect_ratio: "16:9", status: "pending_approval" },
  { image_id: "img-2", type: "workflow", purpose: "Agent loop explanation", placement: "After H2: How It Works", filename: "ai-seo-agent-workflow-observe-reason-plan-execute-verify.webp", alt_text: "AI SEO agent workflow showing Observe, Reason, Plan, Execute, Verify cycle", source: "ai_generated", dimensions: "1200x675", aspect_ratio: "16:9", status: "pending_approval" },
  { image_id: "img-3", type: "comparison", purpose: "AI vs traditional SEO", placement: "After H2: Comparison", filename: "ai-seo-agent-vs-traditional-seo-comparison.webp", alt_text: "Comparison of traditional SEO tools vs AI SEO agent", source: "ai_generated", dimensions: "1200x675", aspect_ratio: "16:9", status: "needs_regeneration" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const IMAGE_TYPE_CONFIG: Record<ImageType, { label: string; icon: any; color: string }> = {
  featured:          { label: "Featured",        icon: Star,        color: "text-amber-600 bg-amber-50 border-amber-200" },
  illustration:      { label: "Illustration",    icon: Sparkles,    color: "text-purple-600 bg-purple-50 border-purple-200" },
  diagram:           { label: "Diagram",         icon: GitBranch,   color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  workflow:          { label: "Workflow",         icon: Zap,         color: "text-blue-600 bg-blue-50 border-blue-200" },
  infographic:       { label: "Infographic",     icon: Layers,      color: "text-teal-600 bg-teal-50 border-teal-200" },
  comparison:        { label: "Comparison",      icon: Layers,      color: "text-orange-600 bg-orange-50 border-orange-200" },
  chart:             { label: "Chart",           icon: BarChart2,   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  screenshot:        { label: "Screenshot",      icon: Camera,      color: "text-neutral-600 bg-neutral-100 border-neutral-200" },
  product_screenshot:{ label: "Product UI",      icon: Package,     color: "text-red-600 bg-red-50 border-red-200" },
  step_by_step:      { label: "Step-by-Step",    icon: List,        color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  conceptual:        { label: "Conceptual",      icon: Lightbulb,   color: "text-violet-600 bg-violet-50 border-violet-200" },
  data_visualization:{ label: "Data Visual",     icon: BarChart2,   color: "text-rose-600 bg-rose-50 border-rose-200" },
};

const STATUS_CONFIG: Record<ImageStatus, { label: string; color: string; dot: string }> = {
  planning:          { label: "Planning",          color: "text-neutral-500 bg-neutral-100 border-neutral-200",   dot: "bg-neutral-400" },
  prompt_ready:      { label: "Prompt Ready",      color: "text-blue-600 bg-blue-50 border-blue-200",             dot: "bg-blue-500" },
  generating:        { label: "Generating",        color: "text-indigo-600 bg-indigo-50 border-indigo-200",        dot: "bg-indigo-500 animate-pulse" },
  generated:         { label: "Generated",         color: "text-teal-600 bg-teal-50 border-teal-200",             dot: "bg-teal-500" },
  qa_passed:         { label: "QA Passed",         color: "text-emerald-600 bg-emerald-50 border-emerald-200",    dot: "bg-emerald-500" },
  qa_failed:         { label: "QA Failed",         color: "text-red-600 bg-red-50 border-red-200",                dot: "bg-red-500" },
  pending_approval:  { label: "Awaiting Approval", color: "text-amber-600 bg-amber-50 border-amber-200",          dot: "bg-amber-500 animate-pulse" },
  approved:          { label: "Approved",          color: "text-emerald-700 bg-emerald-50 border-emerald-300",    dot: "bg-emerald-600" },
  rejected:          { label: "Rejected",          color: "text-neutral-500 bg-neutral-100 border-neutral-200",   dot: "bg-neutral-400" },
  needs_regeneration:{ label: "Needs Regeneration",color: "text-orange-600 bg-orange-50 border-orange-200",      dot: "bg-orange-500" },
  published:         { label: "Published",         color: "text-emerald-800 bg-emerald-100 border-emerald-300",   dot: "bg-emerald-700" },
};

const METHOD_CONFIG: Record<GenerationMethod, { label: string; color: string }> = {
  ai_generated:       { label: "AI Generated",     color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  media_library:      { label: "Media Library",    color: "text-teal-600 bg-teal-50 border-teal-200" },
  licensed_source:    { label: "Licensed",         color: "text-blue-600 bg-blue-50 border-blue-200" },
  programmatic:       { label: "Programmatic",     color: "text-violet-600 bg-violet-50 border-violet-200" },
  existing_asset:     { label: "Existing Asset",   color: "text-neutral-600 bg-neutral-100 border-neutral-200" },
  screenshot_required:{ label: "⚠ Screenshot Needed", color: "text-red-600 bg-red-50 border-red-200" },
};

const QA_CHECK_LABELS: Record<keyof QACheck, string> = {
  relevant_to_article: "Relevant to article",
  correct_visual_type: "Correct visual type",
  correct_placement: "Placement specified",
  no_misleading_elements: "No misleading elements",
  no_fabricated_data: "No fabricated data/statistics",
  no_fake_product_ui: "No fabricated product UI",
  filename_descriptive: "Filename is descriptive",
  alt_text_accurate: "Alt text accurate (10–125 chars)",
  follows_project_instructions: "Follows project instructions",
};

// ─── Image Card ───────────────────────────────────────────────────────────────
function ImageCard({
  image, qa, onApprove, onReject, onRegenerate, isExpanded, onToggle,
}: {
  image: ImagePlanItem;
  qa?: ImageQAResult;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const tc = IMAGE_TYPE_CONFIG[image.image_type];
  const sc = STATUS_CONFIG[image.status];
  const mc = METHOD_CONFIG[image.generation_method];
  const TypeIcon = tc.icon;
  const [regenPrompt, setRegenPrompt] = useState("");
  const [showRegenInput, setShowRegenInput] = useState(false);

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
      image.status === "approved" ? "border-emerald-200"
        : image.status === "qa_failed" || image.status === "needs_regeneration" ? "border-orange-200"
          : image.status === "rejected" ? "border-neutral-200 opacity-60"
            : "border-neutral-200"
    }`}>
      {/* Header */}
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl border ${tc.color} shrink-0`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc.color}`}>{tc.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sc.dot}`} />
                  {sc.label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mc.color}`}>{mc.label}</span>
              </div>
              <p className="text-sm font-semibold text-neutral-900">{image.purpose}</p>
              <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                <Layout className="w-3 h-3" /> {image.placement}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {image.status === "pending_approval" && (
              <>
                <button onClick={e => { e.stopPropagation(); onApprove(); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                  Approve
                </button>
                <button onClick={e => { e.stopPropagation(); setShowRegenInput(!showRegenInput); }}
                  className="bg-orange-100 hover:bg-orange-200 text-orange-600 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                  Regenerate
                </button>
                <button onClick={e => { e.stopPropagation(); onReject(); }}
                  className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                  Reject
                </button>
              </>
            )}
            {image.status === "approved" && (
              <span className="text-emerald-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Approved</span>
            )}
            {image.status === "rejected" && (
              <span className="text-neutral-500 text-xs font-bold flex items-center gap-1"><XCircle className="w-4 h-4" /> Rejected</span>
            )}
            {(image.status === "qa_failed" || image.status === "needs_regeneration") && (
              <button onClick={e => { e.stopPropagation(); setShowRegenInput(!showRegenInput); }}
                className="bg-orange-600 hover:bg-orange-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
                <RotateCcw className="w-3 h-3" /> Fix & Regenerate
              </button>
            )}
            <ChevronRight className={`w-4 h-4 text-neutral-700 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>

        {/* Regeneration prompt */}
        {showRegenInput && (
          <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
            <textarea
              value={regenPrompt}
              onChange={e => setRegenPrompt(e.target.value)}
              rows={2}
              placeholder="Describe what to change in the regenerated image (optional)…"
              className="w-full bg-neutral-50 border border-orange-300 rounded-xl px-3 py-2 text-xs text-neutral-700 focus:outline-none resize-none"
            />
            <button onClick={() => { onRegenerate(); setShowRegenInput(false); }}
              className="bg-orange-600 hover:bg-orange-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors">
              <RotateCcw className="w-3 h-3" /> Regenerate
            </button>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-neutral-100 p-5 space-y-4 text-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Visual Description</p>
            <p className="text-neutral-700 leading-relaxed">{image.visual_description}</p>
          </div>

          {image.generation_prompt && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Generation Prompt</p>
              <div className="bg-white text-emerald-400 font-mono p-3 rounded-xl leading-relaxed">
                {image.generation_prompt}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              ["Filename", image.filename],
              ["Dimensions", image.dimensions],
              ["Aspect Ratio", image.aspect_ratio],
            ].map(([label, value]) => (
              <div key={label} className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                <p className="text-neutral-500 font-semibold mb-0.5">{label}</p>
                <p className="font-mono text-neutral-800">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Alt Text</p>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-indigo-700 italic">"{image.alt_text}"</div>
          </div>

          {image.caption && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Caption</p>
              <p className="text-neutral-600 italic">{image.caption}</p>
            </div>
          )}

          {image.generation_method === "screenshot_required" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-700">Screenshot Required</p>
                <p className="text-red-600 mt-0.5">This image requires a real product screenshot. The agent cannot fabricate product UI. Please provide the screenshot manually.</p>
              </div>
            </div>
          )}

          {/* QA results */}
          {qa && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">QA Results</p>
              <div className="grid grid-cols-3 gap-1.5">
                {Object.entries(qa.checks).map(([key, passed]) => (
                  <div key={key} className={`flex items-center gap-1.5 p-2 rounded-lg text-[10px] font-medium ${passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {passed ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                    {QA_CHECK_LABELS[key as keyof QACheck]}
                  </div>
                ))}
              </div>
              {!qa.passed && (
                <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                  <p className="text-orange-700 font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {qa.qa_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImageAgentPage() {
  const [activeTab, setActiveTab] = useState<Tab>("planner");
  const [images, setImages] = useState<ImagePlanItem[]>(DEMO_IMAGES);
  const [qaResults] = useState<ImageQAResult[]>(DEMO_QA);
  const [manifest] = useState<ManifestItem[]>(DEMO_MANIFEST);
  const [planning, setPlanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    article_title: "AI SEO Agent for SaaS Companies: The Complete Guide",
    target_keyword: "AI SEO agent for SaaS",
    content_type: "blog_article",
    max_images: "3",
    discusses_product: false,
    project_instructions: "",
  });

  const approved = images.filter(i => i.status === "approved").length;
  const qaFailed = images.filter(i => i.status === "qa_failed" || i.status === "needs_regeneration").length;
  const pending = images.filter(i => i.status === "pending_approval").length;

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanning(true);
    try {
      const res = await fetch("/api/agent/image/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article_title: form.article_title,
          target_keyword: form.target_keyword,
          content_type: form.content_type,
          max_images: parseInt(form.max_images),
          discusses_product: form.discusses_product,
          project_instructions: form.project_instructions,
        }),
      });
      const data = await res.json();
      if (data.plan?.images) setImages(data.plan.images);
      else setImages(DEMO_IMAGES);
    } catch { setImages(DEMO_IMAGES); }
    finally { setPlanning(false); setActiveTab("images"); }
  };

  const handleApprove = (id: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, status: "approved" } : i));
  };
  const handleReject = (id: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, status: "rejected" } : i));
  };
  const handleRegenerate = (id: string) => {
    setImages(prev => prev.map(i => i.id === id ? { ...i, status: "needs_regeneration" } : i));
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>AI Agents</span><ChevronRight className="w-3 h-3" />
            <span className="text-neutral-700 font-medium">Image Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <ImageIcon className="w-6 h-6 text-indigo-500" /> Image Agent
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                Plans, generates, and manages visual assets for content. Every image requires your approval before publishing.
              </p>
            </div>
            {images.length > 0 && (
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-2 ${
                approved === images.length ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : qaFailed > 0 ? "bg-orange-50 text-orange-700 border-orange-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                <span className={`w-2 h-2 rounded-full ${approved === images.length ? "bg-emerald-500" : qaFailed > 0 ? "bg-orange-500" : "bg-amber-500 animate-pulse"}`} />
                {approved}/{images.length} Approved
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {([
              ["planner", "Image Planner", FileText],
              ["images", `Images (${images.length})`, ImageIcon],
              ["qa", `QA (${qaResults.filter(q => q.passed).length}/${qaResults.length})`, Shield],
              ["manifest", "Manifest", ClipboardList],
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

          {/* ── PLANNER TAB ── */}
          {activeTab === "planner" && (
            <div className="space-y-5">
              {/* Philosophy */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: Lightbulb, title: "Visual Strategist", desc: "Plans images based on what will genuinely help readers — not to hit a count.", color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { icon: Shield, title: "No Fabrication", desc: "Never generates fake product UI, invented statistics, or fabricated screenshots.", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                  { icon: Eye, title: "Human Approval", desc: "Every image requires your approval before it reaches the published page.", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
                ].map(({ icon: Icon, title, desc, color }) => (
                  <div key={title} className="bg-white border border-neutral-200 rounded-2xl p-4 flex gap-3">
                    <div className={`p-2.5 rounded-xl border ${color} shrink-0 h-fit`}><Icon className="w-4 h-4" /></div>
                    <div>
                      <p className="font-semibold text-neutral-900 text-sm">{title}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Plan Form */}
              <form onSubmit={handlePlan} className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-semibold text-neutral-900">Create Image Plan</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Article Title *</label>
                    <input value={form.article_title} onChange={e => setForm(f => ({ ...f, article_title: e.target.value }))} required
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Target Keyword</label>
                    <input value={form.target_keyword} onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Content Type</label>
                    <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                      {[
                        ["blog_article", "Blog Article"],
                        ["how_to", "How-To Guide"],
                        ["comparison", "Comparison"],
                        ["data", "Data / Research"],
                        ["product", "Product / Feature"],
                        ["conceptual", "Conceptual"],
                        ["case_study", "Case Study"],
                        ["landing_page", "Landing Page"],
                        ["guide", "Long-form Guide"],
                      ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Max Images</label>
                    <select value={form.max_images} onChange={e => setForm(f => ({ ...f, max_images: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                      {["1", "2", "3", "4", "5", "6"].map(n => <option key={n} value={n}>{n} image{n !== "1" ? "s" : ""}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="discusses_product" checked={form.discusses_product}
                      onChange={e => setForm(f => ({ ...f, discusses_product: e.target.checked }))}
                      className="w-4 h-4 accent-indigo-600" />
                    <label htmlFor="discusses_product" className="text-sm text-neutral-700">
                      Article discusses our product
                      <span className="block text-[10px] text-neutral-500">Agent will flag product UI as requiring real screenshots</span>
                    </label>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Project Instructions (optional)</label>
                    <textarea value={form.project_instructions} onChange={e => setForm(f => ({ ...f, project_instructions: e.target.value }))}
                      rows={2} placeholder="e.g. Use indigo/white brand colors. Include 1 workflow diagram per article."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400 resize-none" />
                  </div>
                </div>

                <button type="submit" disabled={planning}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-neutral-900 text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                  {planning ? <><Loader2 className="w-4 h-4 animate-spin" /> Planning images…</> : <><Sparkles className="w-4 h-4" /> Create Image Plan</>}
                </button>
              </form>

              {/* Content type strategy guide */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5">
                <h3 className="font-semibold text-neutral-900 text-sm mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-neutral-500" /> Visual Strategy by Content Type</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { type: "How-To", visuals: "Step-by-step, screenshots, process diagrams" },
                    { type: "Comparison", visuals: "Comparison graphics, side-by-side charts" },
                    { type: "Data / Research", visuals: "Charts, data visualizations (no invented data)" },
                    { type: "Product", visuals: "Verified screenshots only — never fabricated" },
                    { type: "Conceptual", visuals: "Diagrams, illustrations explaining abstract ideas" },
                    { type: "Case Study", visuals: "Results charts, process visuals, verified data" },
                  ].map(({ type, visuals }) => (
                    <div key={type} className="flex gap-2">
                      <span className="font-semibold text-neutral-700 shrink-0">{type}:</span>
                      <span className="text-neutral-500">{visuals}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── IMAGES TAB ── */}
          {activeTab === "images" && (
            <div className="space-y-4">
              {/* Status bar */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total", value: images.length, color: "text-neutral-900" },
                  { label: "Pending Approval", value: pending, color: "text-amber-600" },
                  { label: "Approved", value: approved, color: "text-emerald-600" },
                  { label: "Needs Fix", value: qaFailed, color: "text-orange-500" },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                    <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Approve all CTA */}
              {pending > 0 && (
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs text-amber-700">
                    <AlertTriangle className="w-4 h-4" />
                    <span><strong>{pending}</strong> image{pending !== 1 ? "s" : ""} awaiting your approval. Review each one below before approving.</span>
                  </div>
                  <button
                    onClick={() => setImages(prev => prev.map(i => i.status === "pending_approval" ? { ...i, status: "approved" } : i))}
                    className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-xs font-bold px-4 py-2 rounded-xl transition-colors shrink-0">
                    Approve All Passing
                  </button>
                </div>
              )}

              {/* Image cards */}
              {images.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-neutral-200 rounded-2xl text-neutral-500">
                  <ImageIcon className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No image plan yet. Use the Planner tab to create one.</p>
                </div>
              ) : (
                images.map(img => (
                  <ImageCard key={img.id} image={img}
                    qa={qaResults.find(q => q.image_id === img.id)}
                    onApprove={() => handleApprove(img.id)}
                    onReject={() => handleReject(img.id)}
                    onRegenerate={() => handleRegenerate(img.id)}
                    isExpanded={expandedId === img.id}
                    onToggle={() => setExpandedId(expandedId === img.id ? null : img.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* ── QA TAB ── */}
          {activeTab === "qa" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                The Image Agent runs a 9-point QA check on every planned image before it reaches the approval stage. Images that fail QA are flagged for regeneration — not silently passed.
              </div>

              {qaResults.map(qa => {
                const img = images.find(i => i.id === qa.image_id);
                if (!img) return null;
                return (
                  <div key={qa.image_id} className={`bg-white border rounded-2xl p-5 space-y-4 ${qa.passed ? "border-emerald-200" : "border-orange-200"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-neutral-900 text-sm">{img.purpose}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{img.filename}</p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${qa.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                        {qa.passed ? "✓ QA PASSED" : "✗ QA FAILED"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(qa.checks).map(([key, passed]) => (
                        <div key={key} className={`flex items-center gap-1.5 p-2.5 rounded-xl text-xs font-medium border ${passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                          {passed ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 shrink-0" />}
                          {QA_CHECK_LABELS[key as keyof QACheck]}
                        </div>
                      ))}
                    </div>

                    {!qa.passed && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <p className="text-xs text-orange-700 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {qa.qa_notes}
                          {qa.needs_regeneration && <strong className="ml-1">→ Regeneration required.</strong>}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── MANIFEST TAB ── */}
          {activeTab === "manifest" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                The Image Manifest is the final handoff document sent to the Publishing Agent. It includes placement instructions, filenames, alt text, and approval status for every image.
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-100 bg-neutral-50 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900 text-sm">Image Manifest — {images.filter(i => i.status === "approved").length} Approved</h3>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-neutral-900 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Export Manifest
                  </button>
                </div>

                <div className="divide-y divide-neutral-100">
                  {manifest.map((item, i) => {
                    const tc = IMAGE_TYPE_CONFIG[item.type];
                    const TypeIcon = tc.icon;
                    const approvedItem = images.find(img => img.id === item.image_id);
                    const actualStatus = approvedItem?.status || item.status;
                    const sc = STATUS_CONFIG[actualStatus as ImageStatus] || STATUS_CONFIG.planning;

                    return (
                      <div key={item.image_id} className="p-4 hover:bg-neutral-50 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-neutral-100 text-neutral-500 shrink-0 font-bold text-sm">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc.color}`}>
                                <TypeIcon className="w-3 h-3 inline mr-1" />{tc.label}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sc.dot}`} />{sc.label}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-neutral-900">{item.purpose}</p>
                            <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1"><Layout className="w-3 h-3" /> {item.placement}</p>
                          </div>
                        </div>

                        <div className="mt-3 ml-12 grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 space-y-1.5">
                            <p><span className="text-neutral-500 font-medium">Filename:</span> <span className="font-mono text-neutral-700">{item.filename}</span></p>
                            <p><span className="text-neutral-500 font-medium">Dimensions:</span> <span className="text-neutral-700">{item.dimensions}</span></p>
                            <p><span className="text-neutral-500 font-medium">Source:</span> <span className="text-neutral-700">{item.source.replace(/_/g, " ")}</span></p>
                          </div>
                          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                            <p className="text-neutral-500 font-medium mb-1">Alt text:</p>
                            <p className="text-indigo-700 italic">"{item.alt_text}"</p>
                            {item.caption && <p className="text-neutral-500 mt-1">Caption: {item.caption}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
