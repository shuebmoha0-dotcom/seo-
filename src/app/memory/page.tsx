"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Brain, Plus, Trash2, Star, AlertTriangle,
  Search, Building2, Package, Users, Megaphone, FileText, Target, Trophy,
  BookOpen, Lightbulb, FlaskConical, Wrench, Workflow, Save,
  X, RefreshCw, Sparkles, ShieldCheck, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type MemoryCategory =
  | 'company' | 'product' | 'audience' | 'brand' | 'content_strategy'
  | 'seo_strategy' | 'competitors' | 'keywords' | 'content'
  | 'preferences' | 'decisions' | 'experiments' | 'technical' | 'workflow';

type MemoryConfidence = 'high' | 'medium' | 'low';

interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  source: string;
  source_detail?: string;
  confidence: MemoryConfidence;
  is_important: boolean;
  is_outdated: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES: Record<MemoryCategory, { label: string; icon: any; color: string }> = {
  company:          { label: "Company",           icon: Building2,   color: "text-neutral-600 bg-neutral-100 border-neutral-200" },
  product:          { label: "Product",           icon: Package,     color: "text-blue-600 bg-blue-50 border-blue-200" },
  audience:         { label: "Audience",          icon: Users,       color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  brand:            { label: "Brand",             icon: Megaphone,   color: "text-purple-600 bg-purple-50 border-purple-200" },
  content_strategy: { label: "Content Strategy",  icon: FileText,    color: "text-pink-600 bg-pink-50 border-pink-200" },
  seo_strategy:     { label: "SEO Strategy",      icon: Target,      color: "text-orange-600 bg-orange-50 border-orange-200" },
  competitors:      { label: "Competitors",       icon: Trophy,      color: "text-red-600 bg-red-50 border-red-200" },
  keywords:         { label: "Keywords",          icon: Search,      color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  content:          { label: "Content & Topics",  icon: BookOpen,    color: "text-teal-600 bg-teal-50 border-teal-200" },
  preferences:      { label: "Preferences",       icon: Star,        color: "text-amber-600 bg-amber-50 border-amber-200" },
  decisions:        { label: "Decisions",         icon: Lightbulb,   color: "text-lime-600 bg-lime-50 border-lime-200" },
  experiments:      { label: "Experiments",       icon: FlaskConical,color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  technical:        { label: "Technical",         icon: Wrench,      color: "text-slate-600 bg-slate-50 border-slate-200" },
  workflow:         { label: "Workflow",          icon: Workflow,    color: "text-violet-600 bg-violet-50 border-violet-200" },
};

export default function ProjectMemoryPage() {
  const { currentWebsite } = useWebsite();

  // 2 Clean Tabs: Instructions & Autonomous Memory
  const [activeTab, setActiveTab] = useState<"instructions" | "vault">("instructions");
  const [instructions, setInstructions] = useState("");
  const [savedInstructionsSnapshot, setSavedInstructionsSnapshot] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Add Memory Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>("brand");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryImportant, setNewMemoryImportant] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        const localInstr = localStorage.getItem("seo_project_instructions");
        if (localInstr) {
          setInstructions(localInstr);
          setSavedInstructionsSnapshot(localInstr);
        }
      }

      const url = currentWebsite
        ? `/api/memory?website_id=${currentWebsite.id}`
        : `/api/memory`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.instructions) {
          setInstructions(data.instructions);
          setSavedInstructionsSnapshot(data.instructions);
          if (typeof window !== "undefined") localStorage.setItem("seo_project_instructions", data.instructions);
        }
        // Filter out internal instruction markers from the memories vault view
        const cleanMemories = (data.memories || []).filter(
          (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
        );
        setMemories(cleanMemories);
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: any) {
      console.error("Error fetching project memory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWebsite?.id]);

  const hasUnsavedInstructions = instructions !== savedInstructionsSnapshot;

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("seo_project_instructions", instructions);
      }

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          type: "instructions",
          instructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save instructions to database");
      }

      setSavedInstructionsSnapshot(instructions);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error("Save instructions error:", err);
      setSaveError(err.message || "Failed to save instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleDeleteInstructions = async () => {
    if (!confirm("Are you sure you want to delete all Custom Instructions?")) return;
    setSavingInstructions(true);
    setSaveError(null);
    try {
      setInstructions("");
      setSavedInstructionsSnapshot("");
      if (typeof window !== "undefined") {
        localStorage.removeItem("seo_project_instructions");
      }

      await fetch(`/api/memory?type=instructions${currentWebsite?.id ? `&website_id=${currentWebsite.id}` : ""}`, {
        method: "DELETE",
      });
    } catch (err: any) {
      console.error("Delete instructions error:", err);
      setSaveError(err.message || "Failed to delete instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleCreateMemory = async () => {
    if (!newMemoryContent.trim()) return;
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          category: newMemoryCategory,
          content: newMemoryContent.trim(),
          is_important: newMemoryImportant,
          triggered_by: "user",
          source: "user_instruction",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.memory) {
          setMemories(prev => [data.memory, ...prev]);
        }
        setShowAddModal(false);
        setNewMemoryContent("");
        setNewMemoryImportant(false);
      }
    } catch (err) {
      console.error("Create memory error:", err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this memory fact?")) return;
    try {
      setMemories(prev => prev.filter(m => m.id !== id));
      await fetch(`/api/memory/${id}`, {
        method: "DELETE",
      });
    } catch (err: any) {
      console.error("Delete memory item error:", err);
    }
  };

  const filteredMemories = memories.filter(m => {
    const matchesCategory = selectedCategoryFilter === "all" || m.category === selectedCategoryFilter;
    const matchesSearch = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const appendInstructionTemplate = (templateText: string) => {
    setInstructions(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${templateText}` : templateText;
    });
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>Settings</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Project Context</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
              <Brain className="w-6 h-6 text-indigo-600" />
              <span>Project Memory &amp; Custom Instructions</span>
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Brand persona guidelines and self-learning autonomous memory automatically applied across all SEO workflows for {currentWebsite?.domain || "your website"}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          </div>
        </div>

        {/* ── PERSISTENT ACTIVE STATUS BANNER ── */}
        <div className="mb-6 p-4 bg-emerald-50/90 border border-emerald-200 text-emerald-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Project Memory &amp; Instructions Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Automatically synchronized and applied across all article generation, keyword planning, and optimization workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0 font-medium text-emerald-800 bg-white/80 px-3.5 py-1.5 rounded-xl border border-emerald-200">
            <span>💾 Status: <strong className="text-emerald-900">Synchronized</strong></span>
            {lastSavedTime && <span>• Last saved: {lastSavedTime}</span>}
          </div>
        </div>

        {/* Error Notification */}
        {saveError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-2xl flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-semibold">{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── 2 CLEAN TAB NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 mb-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab("instructions")}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "instructions"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            }`}
          >
            <span>📝 Custom Instructions</span>
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            className={`px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "vault"
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
            }`}
          >
            <span>🧠 Autonomous Project Memory ({memories.length})</span>
          </button>
        </div>

        {/* ── TAB 1: CUSTOM BRAND INSTRUCTIONS ── */}
        {activeTab === "instructions" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Custom Brand Instructions &amp; Editorial Persona
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      hasUnsavedInstructions
                        ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}>
                      {hasUnsavedInstructions ? "● Unsaved Changes" : "✓ Saved & Active in Memory"}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Define your brand persona, tone of voice, editorial standards, and forbidden topics. Automatically applied whenever new articles and content are produced.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (instructions) {
                        navigator.clipboard.writeText(instructions);
                        alert("Instructions copied to clipboard!");
                      }
                    }}
                    disabled={!instructions}
                    className="bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-700 font-semibold text-xs px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
                    title="Copy to clipboard"
                  >
                    <span>📋 Copy</span>
                  </button>
                  <button
                    onClick={handleDeleteInstructions}
                    disabled={savingInstructions || !instructions}
                    className="bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-600 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 border border-red-200"
                    title="Delete Custom Instructions"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                  <button
                    onClick={handleSaveInstructions}
                    disabled={savingInstructions}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingInstructions ? "Saving..." : "Save Instructions"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-neutral-400">Quick Insert Templates:</span>
                <button
                  onClick={() => appendInstructionTemplate("## WRITING PERSONA & TONE\n- Write like a senior technical SEO practitioner with 10+ years of deep industry experience.\n- Tone: Authoritative, pragmatic, no corporate fluff, high-signal.")}
                  className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors border border-neutral-200"
                >
                  + Persona &amp; Tone
                </button>
                <button
                  onClick={() => appendInstructionTemplate("## BRAND POSITIONING & VALUE PROPOSITION\n- Emphasize fully autonomous execution over manual dashboards.\n- Highlight 1-click publishing directly to WordPress with verified SSL & reverse-outbound protection.")}
                  className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors border border-neutral-200"
                >
                  + Brand Guidelines
                </button>
                <button
                  onClick={() => appendInstructionTemplate("## PROHIBITIONS & FORBIDDEN TOPICS\n- Never fabricate statistics, fake testimonials, or unverified claims.\n- Do not mention low-tier blackhat techniques.")}
                  className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors border border-neutral-200"
                >
                  + Forbidden Rules
                </button>
                <button
                  onClick={() => appendInstructionTemplate("## CTA & CONVERSION RULES\n- Primary CTA: 'Connect your website to SEO Autopilot for autonomous keyword ranking'.\n- Position the CTA naturally after the primary solution section.")}
                  className="text-[11px] bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-2.5 py-1 rounded-lg transition-colors border border-neutral-200"
                >
                  + CTA Format
                </button>
              </div>

              {/* Large Textarea Workspace */}
              <div className="space-y-2">
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Enter your comprehensive brand instructions here (e.g. detailed writing guidelines, target persona, brand voice, forbidden topics, formatting standards)..."
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-2xl p-5 text-xs text-neutral-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  rows={18}
                />

                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span>Capacity: Up to 50,000+ characters</span>
                  <span>{instructions.length} characters • ~{Math.ceil(instructions.split(/\s+/).filter(Boolean).length)} words</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AUTONOMOUS SELF-LEARNING PROJECT MEMORY ── */}
        {activeTab === "vault" && (
          <div className="space-y-6">
            {/* Auto-learning Info Banner */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-900 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold">Autonomous Self-Learning Memory: </span>
                  <span>The agent automatically indexes and remembers key topics, target audience insights, entity decisions, and technical facts from every written article and website audit.</span>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-colors shrink-0 shadow-xs"
              >
                + Add Fact
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-neutral-200 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedCategoryFilter("all")}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-colors ${
                    selectedCategoryFilter === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  All ({memories.length})
                </button>
                {Object.keys(CATEGORIES).slice(0, 6).map(catKey => (
                  <button
                    key={catKey}
                    onClick={() => setSelectedCategoryFilter(catKey)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-colors shrink-0 ${
                      selectedCategoryFilter === catKey
                        ? "bg-indigo-600 text-white font-bold"
                        : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                    }`}
                  >
                    {CATEGORIES[catKey as MemoryCategory]?.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search memories..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-2 text-xs text-neutral-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Memories Grid or Empty State */}
            {filteredMemories.length === 0 ? (
              <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-md mx-auto">
                <Brain className="w-8 h-8 text-neutral-400 mx-auto" />
                <h3 className="text-sm font-bold text-neutral-900">No Memory Facts Stored Yet</h3>
                <p className="text-xs text-neutral-500">
                  As articles are generated and audits run, key facts and topic decisions will automatically appear here.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors inline-block"
                >
                  + Add Custom Fact
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMemories.map(m => {
                  const CatInfo = CATEGORIES[m.category] || CATEGORIES.brand;
                  const CatIcon = CatInfo.icon;
                  return (
                    <div
                      key={m.id}
                      className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-3 hover:border-indigo-200 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${CatInfo.color}`}>
                          <CatIcon className="w-3 h-3" />
                          <span>{CatInfo.label}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          {m.is_important && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>Important</span>
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteMemory(m.id)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete memory"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-neutral-800 leading-relaxed font-sans font-medium">
                        {m.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
                        <span>Source: {m.source_detail || m.source}</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MODAL: ADD MEMORY ITEM ── */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  Add Project Memory Fact
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Category</label>
                  <select
                    value={newMemoryCategory}
                    onChange={e => setNewMemoryCategory(e.target.value as any)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(CATEGORIES).map(([key, cat]) => (
                      <option key={key} value={key}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Memory Content</label>
                  <textarea
                    value={newMemoryContent}
                    onChange={e => setNewMemoryContent(e.target.value)}
                    placeholder="e.g. Target audience is B2B SaaS marketing managers looking for organic growth solutions..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 focus:outline-none focus:border-indigo-500"
                    rows={4}
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="modalImportant"
                    checked={newMemoryImportant}
                    onChange={e => setNewMemoryImportant(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="modalImportant" className="text-xs font-semibold text-neutral-700">
                    Mark as Important (High priority context)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMemory}
                  disabled={!newMemoryContent.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs"
                >
                  Save Fact
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
