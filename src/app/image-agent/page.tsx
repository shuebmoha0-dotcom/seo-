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

type Tab = "images" | "manifest";

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
  generating:        { label: "Generating",        color: "text-indigo-600 bg-indigo-50 border-indigo-200",        dot: "bg-indigo-500" },
  generated:         { label: "Generated",         color: "text-teal-600 bg-teal-50 border-teal-200",             dot: "bg-teal-500" },
  qa_passed:         { label: "QA Passed",         color: "text-emerald-600 bg-emerald-50 border-emerald-200",    dot: "bg-emerald-500" },
  qa_failed:         { label: "QA Failed",         color: "text-rose-600 bg-rose-50 border-rose-200",             dot: "bg-rose-500" },
  pending_approval:  { label: "Awaiting Approval", color: "text-amber-600 bg-amber-50 border-amber-200",          dot: "bg-amber-500" },
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
  screenshot_required:{ label: "Screenshot Needed", color: "text-rose-600 bg-rose-50 border-rose-200" },
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
    <div className={`bg-white border rounded-xl overflow-hidden transition-all shadow-xs ${
      image.status === "approved" ? "border-emerald-200"
        : image.status === "qa_failed" || image.status === "needs_regeneration" ? "border-amber-200"
          : image.status === "rejected" ? "border-neutral-200 opacity-60"
            : "border-neutral-200 hover:border-neutral-300"
    }`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg border ${tc.color} shrink-0`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tc.color}`}>{tc.label}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${mc.color}`}>{mc.label}</span>
                <span className="text-[10px] text-neutral-400 font-mono">{image.dimensions}</span>
                <span className="text-[10px] text-neutral-400">{image.placement}</span>
              </div>
              <p className="text-sm font-semibold text-neutral-900 line-clamp-1">{image.filename}</p>
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{image.purpose}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${sc.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{sc.label}
            </span>
            {image.status !== "approved" && (
              <button
                onClick={e => { e.stopPropagation(); onApprove(); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-neutral-100 p-4 space-y-3.5 text-xs bg-neutral-50/50">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Visual Description</p>
            <p className="text-neutral-700 leading-relaxed bg-white p-3 rounded-lg border border-neutral-200">{image.visual_description}</p>
          </div>

          {image.generation_prompt && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Generation Prompt</p>
              <div className="bg-white text-neutral-800 border border-neutral-200 font-mono p-3 rounded-lg leading-relaxed text-[11px]">
                {image.generation_prompt}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ["Filename", image.filename],
              ["Dimensions", image.dimensions],
              ["Aspect Ratio", image.aspect_ratio],
            ].map(([label, value]) => (
              <div key={label} className="bg-white border border-neutral-200 rounded-lg p-3">
                <p className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{label}</p>
                <p className="font-mono text-neutral-900 text-xs font-medium">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Alt Text</p>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-indigo-800 italic">&ldquo;{image.alt_text}&rdquo;</div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-200">
            <button
              onClick={onReject}
              className="bg-white hover:bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg font-semibold text-xs border border-neutral-200 hover:border-rose-200 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={onRegenerate}
              className="bg-white hover:bg-neutral-100 text-neutral-700 px-3 py-1.5 rounded-lg font-semibold text-xs border border-neutral-200 transition-colors"
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
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span className="font-medium text-neutral-400">Content Studio</span>
              <span className="text-neutral-300">/</span>
              <span className="font-semibold text-neutral-700">Visual SEO &amp; Diagram Agent</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Visual SEO &amp; Diagram Studio
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <ImageIcon className="w-3 h-3 text-indigo-600" />
                Featured Visuals Engine
              </span>
            </div>
            <p className="text-neutral-500 text-xs mt-1">
              {currentWebsite
                ? `Plans, scripts, and generates empirical diagram and hero visual assets for ${currentWebsite.domain}.`
                : "Connect your website to plan and generate visual assets."}
            </p>
          </div>
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
                Image planning and asset generation operates strictly against your connected website and publishing target.
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
            {/* Plan Form */}
            <form onSubmit={handlePlan} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Plan Visual Assets for Article</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Article Title *</label>
                  <input
                    value={form.article_title}
                    onChange={e => setForm(f => ({ ...f, article_title: e.target.value }))}
                    required
                    placeholder="e.g. AI SEO Agent Guide for SaaS"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Target Keyword</label>
                  <input
                    value={form.target_keyword}
                    onChange={e => setForm(f => ({ ...f, target_keyword: e.target.value }))}
                    placeholder="e.g. AI SEO agent"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Number of Images</label>
                  <select
                    value={form.max_images}
                    onChange={e => setForm(f => ({ ...f, max_images: e.target.value }))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="1">1 Hero Image</option>
                    <option value="2">2 Images (Hero + Diagram)</option>
                    <option value="3">3 Images (Full Visual Package)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={planning || !form.article_title.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  {planning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{planning ? "Planning Images..." : "Plan Visual Assets"}</span>
                </button>
              </div>
            </form>

            {/* Navigation Tabs */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 shadow-2xs flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab("images")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "images"
                    ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
                }`}
              >
                <Layout className="w-3.5 h-3.5 text-indigo-600" />
                <span>Image Assets ({images.length})</span>
              </button>

              <button
                onClick={() => setActiveTab("manifest")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === "manifest"
                    ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-neutral-600" />
                <span>Asset Manifest</span>
              </button>
            </div>

            {/* IMAGES TAB */}
            {activeTab === "images" && (
              <div className="space-y-4">
                {images.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3 max-w-lg mx-auto shadow-xs">
                    <ImageIcon className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h3 className="text-base font-semibold text-neutral-900">No Image Assets Planned Yet</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Use the planner above to generate visual descriptions and prompts for {currentWebsite.domain}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
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
              <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Placement</th>
                      <th className="py-3 px-4">Dimensions</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {manifest.map(item => (
                      <tr key={item.image_id} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-neutral-900 font-mono">{item.filename}</td>
                        <td className="py-3 px-4 capitalize">{item.type}</td>
                        <td className="py-3 px-4 text-neutral-600">{item.placement}</td>
                        <td className="py-3 px-4 font-mono text-neutral-700">{item.dimensions}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200 capitalize">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
