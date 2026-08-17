"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Image as ImageIcon, Plus, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, FileText, Zap, RotateCcw, Eye, Download, Info, ChevronRight,
  ChevronDown, Camera, BarChart2, GitBranch, Layers, Layout, List,
  Lightbulb, Cpu, ArrowRight, Star, Shield, ShieldAlert, Search,
  ClipboardList, Package, Globe
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

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

const IMAGE_TYPE_CONFIG: Record<ImageType, { label: string; icon: any; color: string }> = {
  featured:          { label: "Featured Hero",   icon: ImageIcon,   color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  illustration:      { label: "Illustration",    icon: Sparkles,    color: "text-purple-600 bg-purple-50 border-purple-200" },
  diagram:           { label: "Diagram",         icon: GitBranch,   color: "text-blue-600 bg-blue-50 border-blue-200" },
  workflow:          { label: "Workflow / Loop", icon: RotateCcw,   color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
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
  const tc = IMAGE_TYPE_CONFIG[image.image_type] || IMAGE_TYPE_CONFIG.featured;
  const sc = STATUS_CONFIG[image.status] || STATUS_CONFIG.pending_approval;
  const mc = METHOD_CONFIG[image.generation_method] || METHOD_CONFIG.ai_generated;
  const TypeIcon = tc.icon;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all shadow-sm ${
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
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${mc.color}`}>{mc.label}</span>
                <span className="text-[10px] text-neutral-400 font-mono">{image.dimensions}</span>
                <span className="text-[10px] text-neutral-400">{image.placement}</span>
              </div>
              <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{image.filename}</p>
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{image.purpose}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${sc.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
            </span>
            {image.status !== "approved" && (
              <button
                onClick={e => { e.stopPropagation(); onApprove(); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm">
                <CheckCircle2 className="w-3 h-3" /> Approve
              </button>
            )}
            <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>
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
              <div className="bg-neutral-50 text-neutral-800 border border-neutral-200 font-mono p-3 rounded-xl leading-relaxed text-[11px]">
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
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-indigo-700 italic">&ldquo;{image.alt_text}&rdquo;</div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              onClick={onReject}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-semibold text-xs border border-red-200"
            >
              Reject
            </button>
            <button
              onClick={onRegenerate}
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg font-semibold text-xs"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImageAgentPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState<Tab>("images");
  const [images, setImages] = useState<ImagePlanItem[]>([]);
  const [qaResults, setQaResults] = useState<ImageQAResult[]>([]);
  const [manifest, setManifest] = useState<ManifestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    article_title: "",
    target_keyword: "",
    content_type: "blog_article",
    max_images: "3",
    discusses_product: false,
    project_instructions: "",
  });

  const fetchImageData = async () => {
    if (!currentWebsite) {
      setImages([]);
      setQaResults([]);
      setManifest([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/agent/image/plan?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
        setQaResults(data.qa_results || []);
        setManifest(data.manifest || []);
      }
    } catch (err) {
      console.error("Error fetching image assets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImageData();
  }, [currentWebsite?.id]);

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    setPlanning(true);
    try {
      const res = await fetch("/api/agent/image/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          article_title: form.article_title,
          target_keyword: form.target_keyword,
          content_type: form.content_type,
          max_images: parseInt(form.max_images),
          discusses_product: form.discusses_product,
          project_instructions: form.project_instructions,
        }),
      });
      if (res.ok) {
        await fetchImageData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPlanning(false);
      setActiveTab("images");
    }
  };

  const handleUpdateStatus = async (id: string, action: "approve" | "reject" | "regenerate") => {
    try {
      await fetch(`/api/agent/image/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await fetchImageData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>AI Agents</span><ChevronRight className="w-3 h-3" />
            <span className="text-neutral-700 font-medium">Image &amp; Visual SEO Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <ImageIcon className="w-6 h-6 text-indigo-500" /> Image Agent
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                {currentWebsite
                  ? `Plans and generates SEO-optimized visual assets for ${currentWebsite.domain}.`
                  : "Connect your website to plan and generate visual assets."}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {([
              ["images", `Image Assets (${images.length})`, Layout],
              ["manifest", "Asset Manifest", ClipboardList],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
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
                  Image planning and generation operates against your target domain and publishing pipeline.
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
              {/* Plan Form */}
              <form onSubmit={handlePlan} className="bg-neutral-50 border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Plan &amp; Generate Visual Assets
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-neutral-600 mb-1">Article Title *</label>
                    <input
                      value={form.article_title}
                      onChange={e => setForm(f => ({ ...f, article_title: e.target.value }))}
                      required
                      placeholder="e.g. AI SEO Agent Guide for SaaS"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-600 mb-1">Target Keyword</label>
                    <input
                      value={form.target_keyword}
                      onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))}
                      placeholder="e.g. AI SEO agent"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-neutral-600 mb-1">Number of Images</label>
                    <select
                      value={form.max_images}
                      onChange={e => setForm(f => ({ ...f, max_images: e.target.value }))}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1">1 Hero Image</option>
                      <option value="2">2 Images (Hero + Diagram)</option>
                      <option value="3">3 Images (Full Visual Package)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={planning || !form.article_title.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{planning ? "Planning Images..." : "Plan Visual Assets"}</span>
                  </button>
                </div>
              </form>

              {/* IMAGES TAB */}
              {activeTab === "images" && (
                <div className="space-y-4">
                  {images.length === 0 && !loading ? (
                    <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                      <ImageIcon className="w-8 h-8 text-neutral-400 mx-auto" />
                      <h3 className="text-base font-bold text-neutral-900">No Image Assets Planned Yet</h3>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        Use the planner above to generate visual descriptions and prompts for {currentWebsite.domain}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {images.map(image => (
                        <ImageCard
                          key={image.id}
                          image={image}
                          qa={qaResults.find(q => q.image_id === image.id)}
                          onApprove={() => handleUpdateStatus(image.id, "approve")}
                          onReject={() => handleUpdateStatus(image.id, "reject")}
                          onRegenerate={() => handleUpdateStatus(image.id, "regenerate")}
                          isExpanded={expandedId === image.id}
                          onToggle={() => setExpandedId(expandedId === image.id ? null : image.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MANIFEST TAB */}
              {activeTab === "manifest" && (
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Filename</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Placement</th>
                        <th className="py-3 px-4">Dimensions</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {manifest.map(item => (
                        <tr key={item.image_id} className="hover:bg-neutral-50">
                          <td className="py-3 px-4 font-bold text-neutral-900 font-mono">{item.filename}</td>
                          <td className="py-3 px-4 capitalize">{item.type}</td>
                          <td className="py-3 px-4 text-neutral-600">{item.placement}</td>
                          <td className="py-3 px-4 font-mono text-neutral-700">{item.dimensions}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
