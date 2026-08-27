"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Brain, Plus, Trash2, Star, AlertTriangle,
  Search, Building2, Package, Users, Megaphone, FileText, Target, Trophy,
  BookOpen, Lightbulb, FlaskConical, Wrench, Workflow, Save,
  X, RefreshCw, Sparkles, ShieldCheck, Zap, Download, Upload, Copy, Check,
  FileJson, UploadCloud, CheckCircle2
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

  // Tabs: Instructions & Autonomous Memory
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

  // Export & Import Modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState<string | null>(null);

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
        ? `/api/memory?website_id=${currentWebsite.id}&_t=${Date.now()}`
        : `/api/memory?_t=${Date.now()}`;

      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
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
          source: "user_added",
          source_detail: "Direct User Entry",
          confidence: "high",
          triggered_by: "user",
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
    } catch (err: any) {
      console.error("Create memory item error:", err);
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

  // ─── Export & Import Logic ─────────────────────────────────────────────────
  const getExportData = () => {
    return {
      version: "1.0",
      app: "SEO Autopilot",
      website_domain: currentWebsite?.domain || "default",
      exported_at: new Date().toISOString(),
      custom_instructions: instructions,
      memories: memories.map(m => ({
        category: m.category,
        content: m.content,
        source: m.source,
        confidence: m.confidence,
        is_important: m.is_important,
        tags: m.tags,
      })),
    };
  };

  const handleDownloadJSON = () => {
    const data = getExportData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentWebsite?.domain || "project"}_memory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJSON = () => {
    const data = getExportData();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
        setImportErrorMessage(null);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    if (!importText.trim()) {
      setImportErrorMessage("Please paste JSON data or select a file to import.");
      return;
    }

    setImporting(true);
    setImportErrorMessage(null);
    setImportSuccessMessage(null);

    try {
      let parsedData: any;
      try {
        parsedData = JSON.parse(importText);
      } catch {
        // If not valid JSON, treat as raw custom instructions text
        parsedData = {
          custom_instructions: importText.trim(),
          memories: [],
        };
      }

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          type: "import",
          import_data: parsedData,
          mode: importMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import memory.");
      }

      setImportSuccessMessage(data.message || "Memory imported successfully!");
      setTimeout(() => {
        setShowImportModal(false);
        setImportText("");
        setImportSuccessMessage(null);
        fetchData();
      }, 1500);
    } catch (err: any) {
      console.error("Import error:", err);
      setImportErrorMessage(err.message || "Failed to parse and import memory data.");
    } finally {
      setImporting(false);
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
              title="Reload memory from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
              title="Export memory and instructions to JSON"
            >
              <Download className="w-3.5 h-3.5 text-neutral-600" />
              <span>Export</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
              title="Import memory and instructions from JSON or file"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-600" />
              <span>Import</span>
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center justify-between text-xs animate-shake">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-red-500 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── TABS NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab("instructions")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "instructions"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Custom Instructions</span>
            {instructions.trim() && (
              <span className={`w-2 h-2 rounded-full ${activeTab === 'instructions' ? 'bg-white' : 'bg-indigo-600'}`}></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("vault")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "vault"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Autonomous Project Memory ({memories.length})</span>
          </button>
        </div>

        {/* ── TAB 1: CUSTOM INSTRUCTIONS ── */}
        {activeTab === "instructions" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Custom Brand Instructions &amp; Editorial Persona</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ Set Exclusively by You
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Define your brand persona, tone of voice, editorial standards, and forbidden topics. The AI agent will strictly follow these rules for every article.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instructions);
                      alert("Instructions copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>

                  <button
                    onClick={handleDeleteInstructions}
                    disabled={!instructions.trim() || savingInstructions}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={handleSaveInstructions}
                    disabled={savingInstructions}
                    className={`flex items-center gap-1.5 px-5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                      hasUnsavedInstructions
                        ? "bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-300"
                        : "bg-neutral-800 hover:bg-neutral-900"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingInstructions ? "Saving..." : hasUnsavedInstructions ? "Save Changes *" : "Saved"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Inserters */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-600 pt-1">
                <span className="font-semibold text-neutral-400 text-[11px]">Quick Insert Templates:</span>
                <button
                  onClick={() => appendInstructionTemplate("Persona & Tone:\n- Write as a battle-tested industry practitioner with deep domain expertise.\n- Maintain an authoritative, direct, and pragmatic tone with zero fluff.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Persona &amp; Tone
                </button>
                <button
                  onClick={() => appendInstructionTemplate("Brand Guidelines:\n- Every article must include concrete, copyable templates and step-by-step frameworks.\n- Emphasize business revenue, conversion rates, and workflow speed.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Brand Guidelines
                </button>
                <button
                  onClick={() => appendInstructionTemplate("Forbidden Rules:\n- NEVER use generic filler phrases like 'in today's digital world', 'it goes without saying', or 'in conclusion'.\n- NEVER use superficial keyword stuffing.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Forbidden Rules
                </button>
                <button
                  onClick={() => appendInstructionTemplate("CTA Format:\n- Close with a clear, high-value B2B call to action that offers an actionable next step or resource.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + CTA Format
                </button>
              </div>

              {/* Main Instruction Textarea */}
              <div className="relative">
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Type your custom brand guidelines, writing style, tone, forbidden words, and target audience directives here...

Example:
1. Always write from the perspective of an experienced B2B growth and AI automation strategist.
2. Tone must be direct, highly practical, authoritative, and actionable with zero fluff.
3. Every article must include concrete, real-world examples and step-by-step frameworks.
4. Emphasize practical conversion and customer acquisition rather than vanity metrics."
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-2xl p-4 text-xs md:text-sm text-neutral-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  rows={16}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>Capacity: Up to 50,000+ characters</span>
                <span>{instructions.length} characters</span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: AUTONOMOUS MEMORY VAULT ── */}
        {activeTab === "vault" && (
          <div className="space-y-6">
            {/* Search & Category Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
              <div className="flex items-center gap-2 flex-1 max-w-md bg-white border border-neutral-200 rounded-xl px-3 py-1.5 shadow-xs">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search autonomous memory insights..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-xs text-neutral-800 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="bg-white border border-neutral-200 text-xs font-semibold text-neutral-700 rounded-xl px-3 py-1.5 focus:outline-none shadow-xs"
                >
                  <option value="all">All Categories ({memories.length})</option>
                  {Object.entries(CATEGORIES).map(([key, cat]) => (
                    <option key={key} value={key}>
                      {cat.label} ({memories.filter(m => m.category === key).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Memory Items Grid */}
            {filteredMemories.length === 0 ? (
              <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                <Brain className="w-8 h-8 text-neutral-400 mx-auto" />
                <h3 className="text-base font-bold text-neutral-900">No Autonomous Memory Logged Yet</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  As the AI agent generates articles, reviews ranking changes, and analyzes search performance over time, it will automatically log learned insights here.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Manual Insight</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMemories.map(m => {
                  const cat = CATEGORIES[m.category] || CATEGORIES.company;
                  const Icon = cat.icon;
                  return (
                    <div
                      key={m.id}
                      className={`p-4 bg-white border rounded-2xl shadow-xs space-y-3 transition-all ${
                        m.is_important ? "border-amber-300 ring-1 ring-amber-200" : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${cat.color}`}>
                            <Icon className="w-3 h-3" />
                            <span>{cat.label}</span>
                          </span>
                          {m.is_important && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                              <span>Important</span>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteMemory(m.id)}
                          className="text-neutral-400 hover:text-red-600 transition-colors p-1"
                          title="Delete memory item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs text-neutral-800 font-normal leading-relaxed">
                        {m.content}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
                        <span className="font-mono">{m.source}</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MODAL: EXPORT MEMORY ── */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Export Project Memory &amp; Instructions</span>
                </h3>
                <button onClick={() => setShowExportModal(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-neutral-600 leading-relaxed">
                  Export all custom brand instructions, editorial directives, and autonomous memories as a clean JSON backup file.
                </p>

                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-1.5 font-mono text-[11px] text-neutral-700 max-h-48 overflow-y-auto">
                  <div className="text-neutral-400">// Preview of export data</div>
                  <div>Website: {currentWebsite?.domain || "default"}</div>
                  <div>Custom Instructions: {instructions ? `${instructions.slice(0, 80)}...` : "(none)"}</div>
                  <div>Autonomous Memory Items: {memories.length} item(s)</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                <button
                  onClick={handleCopyJSON}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
                >
                  {copiedExport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied JSON!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleDownloadJSON}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON File</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: IMPORT MEMORY ── */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Import Project Memory &amp; Instructions</span>
                </h3>
                <button onClick={() => setShowImportModal(false)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {importSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{importSuccessMessage}</span>
                </div>
              )}

              {importErrorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{importErrorMessage}</span>
                </div>
              )}

              <div className="space-y-4 text-xs">
                {/* File Upload Box */}
                <div>
                  <label className="block font-bold text-neutral-700 mb-1.5">Upload JSON Backup File</label>
                  <label className="border-2 border-dashed border-neutral-200 hover:border-indigo-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50/50 hover:bg-indigo-50/30 transition-all text-center">
                    <UploadCloud className="w-6 h-6 text-neutral-400" />
                    <span className="font-semibold text-neutral-700">Click to select .json file or drag &amp; drop</span>
                    <span className="text-[10px] text-neutral-400">JSON export files from SEO Autopilot or custom instructions</span>
                    <input
                      type="file"
                      accept=".json,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Paste Area */}
                <div>
                  <label className="block font-bold text-neutral-700 mb-1.5">Or Paste Raw JSON / Instructions</label>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    placeholder='{"custom_instructions": "...", "memories": [...]}'
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-3 text-xs text-neutral-800 font-mono focus:outline-none focus:border-indigo-500"
                    rows={5}
                  />
                </div>

                {/* Mode Selector */}
                <div>
                  <label className="block font-bold text-neutral-700 mb-1.5">Import Strategy</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode("merge")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        importMode === "merge"
                          ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200"
                          : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100/70"
                      }`}
                    >
                      <div className="font-bold text-xs text-neutral-900">Merge (Recommended)</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Keep existing memory items and add new imported items.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode("replace")}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        importMode === "replace"
                          ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-200"
                          : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100/70"
                      }`}
                    >
                      <div className="font-bold text-xs text-neutral-900">Replace All</div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">Overwrite existing memory items with imported data.</div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={!importText.trim() || importing}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{importing ? "Importing..." : "Execute Import"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: ADD MEMORY ITEM ── */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  <span>Add Project Memory Fact</span>
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
