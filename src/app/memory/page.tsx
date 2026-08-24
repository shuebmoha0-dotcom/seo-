"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Brain, Plus, Edit2, Trash2, Star, StarOff, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Search, Filter, Clock, Cpu, User,
  Building2, Package, Users, Megaphone, FileText, Target, Trophy,
  Link2, Lightbulb, FlaskConical, Wrench, Workflow, Info, Save,
  X, RefreshCw, BookOpen, FileCode, Sparkles, HelpCircle, Layers
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

interface ActivityItem {
  id: string;
  action: 'learned' | 'updated' | 'deleted' | 'marked_important' | 'user_added' | 'user_edited' | 'outdated';
  summary: string;
  triggered_by: 'agent' | 'user';
  created_at: string;
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
  content:          { label: "Content",           icon: BookOpen,    color: "text-teal-600 bg-teal-50 border-teal-200" },
  preferences:      { label: "Preferences",       icon: Star,        color: "text-amber-600 bg-amber-50 border-amber-200" },
  decisions:        { label: "Decisions",         icon: Lightbulb,   color: "text-lime-600 bg-lime-50 border-lime-200" },
  experiments:      { label: "Experiments",       icon: FlaskConical,color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  technical:        { label: "Technical",         icon: Wrench,      color: "text-slate-600 bg-slate-50 border-slate-200" },
  workflow:         { label: "Workflow",          icon: Workflow,    color: "text-violet-600 bg-violet-50 border-violet-200" },
};

export default function ProjectMemoryPage() {
  const { currentWebsite } = useWebsite();

  const [activeTab, setActiveTab] = useState<"instructions" | "knowledge" | "vault" | "activity">("instructions");
  const [instructions, setInstructions] = useState("");
  const [knowledgeBank, setKnowledgeBank] = useState("");
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // New Memory Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>("brand");
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryImportant, setNewMemoryImportant] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = currentWebsite
        ? `/api/memory?website_id=${currentWebsite.id}`
        : `/api/memory`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInstructions(data.instructions || "");
        setKnowledgeBank(data.knowledge_bank || "");
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error("Error fetching project memory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentWebsite?.id]);

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          type: "instructions",
          instructions,
        }),
      });
      setSavedSuccess("Instructions saved successfully!");
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err) {
      console.error("Save instructions error:", err);
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleSaveKnowledge = async () => {
    setSavingKnowledge(true);
    try {
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          type: "knowledge_bank",
          knowledge_bank: knowledgeBank,
        }),
      });
      setSavedSuccess("Knowledge Bank saved successfully!");
      setTimeout(() => setSavedSuccess(null), 3000);
    } catch (err) {
      console.error("Save knowledge error:", err);
    } finally {
      setSavingKnowledge(false);
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

  const filteredMemories = memories.filter(m => {
    const matchesCategory = selectedCategoryFilter === "all" || m.category === selectedCategoryFilter;
    const matchesSearch = !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Instruction Template Appenders
  const appendInstructionTemplate = (template: string) => {
    setInstructions(prev => prev ? `${prev}\n\n${template}` : template);
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>Settings</span><span>&gt;</span>
              <span className="text-neutral-700">Project Context</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2.5">
              <Brain className="w-6 h-6 text-indigo-600" />
              <span>Project Memory &amp; Custom Instructions</span>
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Claude-Projects style memory space, persona guidelines, and reference knowledge automatically injected into all AI agent workflows for {currentWebsite?.domain || "your website"}.
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

        {/* Status Notification */}
        {savedSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{savedSuccess}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 mb-6 text-xs font-bold">
          {[
            { id: "instructions", label: "📝 Custom Project Instructions", desc: "Claude Project Style Prompt" },
            { id: "knowledge", label: "📚 Knowledge Bank & Reference Context", desc: "Large Document Memory" },
            { id: "vault", label: `🧠 Structured Memory Vault (${memories.length})`, desc: "Categorized Knowledge" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: CLAUDE-PROJECT STYLE CUSTOM INSTRUCTIONS ── */}
        {activeTab === "instructions" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Custom Project Instructions (Claude Project Prompt)
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Define the writing persona, brand rules, forbidden competitors, and tone. These instructions are injected directly into Claude Sonnet &amp; Luna every time an article is written.
                  </p>
                </div>

                <button
                  onClick={handleSaveInstructions}
                  disabled={savingInstructions}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingInstructions ? "Saving..." : "Save Project Instructions"}</span>
                </button>
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
                  placeholder="Enter your comprehensive project instructions here (e.g. detailed writing guidelines, target persona, brand voice, forbidden topics, formatting standards)..."
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-2xl p-5 text-xs text-neutral-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  rows={16}
                />

                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span>Capacity: Up to 50,000+ characters</span>
                  <span>{instructions.length} characters • ~{Math.ceil(instructions.split(/\s+/).filter(Boolean).length)} words</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: KNOWLEDGE BANK & REFERENCE CONTEXT ── */}
        {activeTab === "knowledge" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Project Knowledge Bank &amp; Context Documents
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Paste company whitepapers, product specs, pricing tables, competitor comparison matrices, and case study data. The AI agent references these facts when writing long-form content.
                  </p>
                </div>

                <button
                  onClick={handleSaveKnowledge}
                  disabled={savingKnowledge}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingKnowledge ? "Saving..." : "Save Knowledge Bank"}</span>
                </button>
              </div>

              {/* Large Textarea Knowledge Workspace */}
              <div className="space-y-2">
                <textarea
                  value={knowledgeBank}
                  onChange={e => setKnowledgeBank(e.target.value)}
                  placeholder="Paste multi-thousand word company information, product documentation, feature lists, pricing tiers, FAQs, case studies, or reference research..."
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-2xl p-5 text-xs text-neutral-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  rows={18}
                />

                <div className="flex items-center justify-between text-[11px] text-neutral-400 px-1">
                  <span>Context window utilization: Multi-document repository</span>
                  <span>{knowledgeBank.length} characters • ~{Math.ceil(knowledgeBank.split(/\s+/).filter(Boolean).length)} words</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: STRUCTURED MEMORY VAULT ── */}
        {activeTab === "vault" && (
          <div className="space-y-6">
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

            {/* Memories Grid */}
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

                      {m.is_important && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>Important</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-800 leading-relaxed font-sans font-medium">
                      {m.content}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-2 border-t border-neutral-100">
                      <span>Source: {m.source}</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
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
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900 focus:outline-none focus:border-indigo-500"
                  >
                    {Object.entries(CATEGORIES).map(([key, info]) => (
                      <option key={key} value={key}>{info.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-neutral-700 mb-1">Memory Content</label>
                  <textarea
                    value={newMemoryContent}
                    onChange={e => setNewMemoryContent(e.target.value)}
                    placeholder="Enter the specific fact, preference, rule, or guideline the AI agent should always remember..."
                    rows={4}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="important_check"
                    checked={newMemoryImportant}
                    onChange={e => setNewMemoryImportant(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="important_check" className="font-medium text-neutral-700 cursor-pointer">
                    Mark as High-Priority / Important (Always inject first)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateMemory}
                  disabled={!newMemoryContent.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors shadow-sm"
                >
                  Add Memory
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
