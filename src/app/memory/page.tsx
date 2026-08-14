"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Brain, Plus, Edit2, Trash2, Star, StarOff, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Search, Filter, Clock, Cpu, User,
  Building2, Package, Users, Megaphone, FileText, Target, Trophy,
  Link2, Lightbulb, FlaskConical, Wrench, Workflow, Info, Save,
  X, RefreshCw, BookOpen
} from "lucide-react";
import { useState } from "react";

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

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_MEMORIES: MemoryItem[] = [
  {
    id: "m1", category: "company", content: "SaaS company offering an autonomous AI SEO agent platform for SaaS companies and marketing teams.",
    source: "user_instruction", confidence: "high", is_important: true, is_outdated: false, tags: ["saas", "platform"],
    created_at: "2026-08-01T10:00:00Z", updated_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "m2", category: "audience", content: "Primary audience: SaaS founders and marketing teams at B2B SaaS companies with 10–200 employees.",
    source: "user_instruction", confidence: "high", is_important: true, is_outdated: false, tags: ["b2b", "saas"],
    created_at: "2026-08-01T10:05:00Z", updated_at: "2026-08-01T10:05:00Z",
  },
  {
    id: "m3", category: "audience", content: "Target audience excludes enterprise customers (1000+ employees). Focus on self-serve and low-touch sales.",
    source: "user_instruction", confidence: "high", is_important: false, is_outdated: false, tags: ["exclusion"],
    created_at: "2026-08-02T09:00:00Z", updated_at: "2026-08-02T09:00:00Z",
  },
  {
    id: "m4", category: "brand", content: "Brand voice: Professional, practical, and technical. Avoid jargon. Write like an experienced SEO practitioner, not a marketer.",
    source: "user_instruction", confidence: "high", is_important: true, is_outdated: false, tags: ["voice", "writing"],
    created_at: "2026-08-01T10:10:00Z", updated_at: "2026-08-01T10:10:00Z",
  },
  {
    id: "m5", category: "preferences", content: "Preferred CTA: 'Start your free trial'. Do not use 'Get started' or 'Sign up' as primary CTAs.",
    source: "user_instruction", confidence: "high", is_important: true, is_outdated: false, tags: ["cta"],
    created_at: "2026-08-03T14:00:00Z", updated_at: "2026-08-03T14:00:00Z",
  },
  {
    id: "m6", category: "content_strategy", content: "Main content pillars: SEO automation, content marketing for SaaS, AI in SEO. Avoid generic AI topics not related to SEO.",
    source: "agent_discovery", confidence: "high", is_important: true, is_outdated: false, tags: ["pillars"],
    created_at: "2026-08-05T11:00:00Z", updated_at: "2026-08-05T11:00:00Z",
  },
  {
    id: "m7", category: "seo_strategy", content: "Current SEO focus: Position 5–20 quick wins via title tag CTR improvements before creating new content.",
    source: "strategy_agent", confidence: "high", is_important: false, is_outdated: false, tags: ["quick-wins"],
    created_at: "2026-08-08T09:30:00Z", updated_at: "2026-08-08T09:30:00Z",
  },
  {
    id: "m8", category: "competitors", content: "Main competitors: Surfer SEO, Clearscope, MarketMuse, Semrush. Key differentiator: fully autonomous execution vs. analysis-only tools.",
    source: "agent_discovery", confidence: "medium", is_important: false, is_outdated: false, tags: ["competitors"],
    created_at: "2026-08-06T15:00:00Z", updated_at: "2026-08-06T15:00:00Z",
  },
  {
    id: "m9", category: "experiments", content: "PROVEN WIN: Homepage title refresh (1.4% → 3.1% CTR) drove +340 extra monthly visitors. Title changes show fast measurable impact.",
    source: "strategy_agent", confidence: "high", is_important: true, is_outdated: false, tags: ["ctr", "title"],
    created_at: "2026-08-09T10:00:00Z", updated_at: "2026-08-09T10:00:00Z",
  },
  {
    id: "m10", category: "decisions", content: "Rejected standalone article targeting 'project management software' — too competitive. Adapted to long-tail FAQ cluster instead.",
    source: "strategy_agent", confidence: "high", is_important: false, is_outdated: false, tags: ["keyword-decision"],
    created_at: "2026-08-10T11:00:00Z", updated_at: "2026-08-10T11:00:00Z",
  },
  {
    id: "m11", category: "keywords", content: "Core keyword clusters: 'AI SEO agent', 'autonomous SEO tool', 'SEO automation for SaaS'. Target informational + commercial investigation intent.",
    source: "keyword_agent", confidence: "high", is_important: false, is_outdated: false, tags: ["clusters"],
    created_at: "2026-08-07T14:00:00Z", updated_at: "2026-08-07T14:00:00Z",
  },
  {
    id: "m12", category: "technical", content: "Website uses Next.js. Content deployed via GitHub pull requests. No WordPress. Platform-agnostic approach required.",
    source: "user_instruction", confidence: "high", is_important: false, is_outdated: false, tags: ["nextjs", "github"],
    created_at: "2026-08-01T10:15:00Z", updated_at: "2026-08-01T10:15:00Z",
  },
];

const DEMO_ACTIVITY: ActivityItem[] = [
  { id: "a1", action: "learned", summary: "🧠 Agent learned: \"Main competitors identified: Surfer SEO, Clearscope, MarketMuse\"", triggered_by: "agent", created_at: "2026-08-11T14:30:00Z" },
  { id: "a2", action: "learned", summary: "🧠 Agent learned: \"PROVEN WIN: Homepage title refresh drove +340 visitors/month\"", triggered_by: "agent", created_at: "2026-08-11T10:00:00Z" },
  { id: "a3", action: "user_added", summary: "✍️ User added: \"Preferred CTA: 'Start your free trial'\"", triggered_by: "user", created_at: "2026-08-10T15:00:00Z" },
  { id: "a4", action: "updated", summary: "🧠 Agent updated: \"SEO focus shifted to Position 5–20 quick wins\"", triggered_by: "agent", created_at: "2026-08-10T11:30:00Z" },
  { id: "a5", action: "learned", summary: "🧠 Agent learned: \"Rejected 'project management software' — extreme competition\"", triggered_by: "agent", created_at: "2026-08-10T09:00:00Z" },
  { id: "a6", action: "user_edited", summary: "✏️ User edited: \"Brand voice: Professional, practical, and technical\"", triggered_by: "user", created_at: "2026-08-09T16:00:00Z" },
];

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

const CONFIDENCE_CONFIG: Record<MemoryConfidence, { label: string; color: string }> = {
  high:   { label: "Verified",    color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  medium: { label: "Likely",      color: "text-amber-600 bg-amber-50 border-amber-200" },
  low:    { label: "Unverified",  color: "text-red-500 bg-red-50 border-red-200" },
};

function timeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>(DEMO_MEMORIES);
  const [activity, ] = useState<ActivityItem[]>(DEMO_ACTIVITY);
  const [activeTab, setActiveTab] = useState<"memory" | "activity">("memory");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<MemoryCategory | "all">("all");
  const [showOutdated, setShowOutdated] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ category: "company" as MemoryCategory, content: "", confidence: "high" as MemoryConfidence });
  const [saving, setSaving] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const filtered = memories.filter(m => {
    if (!showOutdated && m.is_outdated) return false;
    if (filterCategory !== "all" && m.category !== filterCategory) return false;
    if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Group by category
  const grouped = Object.keys(CATEGORIES).reduce<Record<string, MemoryItem[]>>((acc, cat) => {
    const items = filtered.filter(m => m.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const importantCount = memories.filter(m => m.is_important && !m.is_outdated).length;
  const outdatedCount = memories.filter(m => m.is_outdated).length;

  const handleToggleImportant = (id: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, is_important: !m.is_important } : m));
  };

  const handleMarkOutdated = (id: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, is_outdated: true } : m));
  };

  const handleDelete = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleEdit = (m: MemoryItem) => {
    setEditingId(m.id);
    setEditContent(m.content);
  };

  const handleSaveEdit = (id: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, content: editContent, updated_at: new Date().toISOString() } : m));
    setEditingId(null);
  };

  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) return;
    setSaving(true);
    const item: MemoryItem = {
      id: `m${Date.now()}`,
      category: newMemory.category,
      content: newMemory.content,
      source: "user_added",
      confidence: newMemory.confidence,
      is_important: false,
      is_outdated: false,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTimeout(() => {
      setMemories(prev => [item, ...prev]);
      setNewMemory({ category: "company", content: "", confidence: "high" });
      setShowAddForm(false);
      setSaving(false);
    }, 400);
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <span>Project</span><span>/</span>
            <span className="text-neutral-700 font-medium">Project Memory</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Brain className="w-6 h-6 text-indigo-500" /> Project Memory
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                Persistent knowledge the agent accumulates over time. Used to make every task more relevant to your project.
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Memory
            </button>
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {[
              ["memory", "Memory Bank", Brain],
              ["activity", "Agent Activity", Cpu],
            ].map(([id, label, Icon]: any) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">

          {/* ── MEMORY BANK TAB ── */}
          {activeTab === "memory" && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Total Memories", value: memories.filter(m => !m.is_outdated).length, color: "text-neutral-900" },
                  { label: "Important", value: importantCount, color: "text-amber-600" },
                  { label: "Categories", value: Object.keys(grouped).length, color: "text-indigo-600" },
                  { label: "Outdated", value: outdatedCount, color: "text-neutral-400" },
                ].map((s, i) => (
                  <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                    <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>

              {/* Info banner */}
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>How memory works:</strong> The agent retrieves only relevant memories for each task — not the entire bank. For example, a content task retrieves brand voice, audience, and CTA preferences. A keyword task retrieves audience, competitors, and past keyword decisions.
                </div>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search memories…"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400" />
                </div>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                  <option value="all">All Categories</option>
                  {Object.entries(CATEGORIES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowOutdated(!showOutdated)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                    showOutdated ? "bg-neutral-200 text-neutral-700 border-neutral-300" : "bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50"
                  }`}>
                  <RefreshCw className="w-3.5 h-3.5" /> {showOutdated ? "Hide" : "Show"} Outdated
                </button>
              </div>

              {/* Add Memory Form */}
              {showAddForm && (
                <div className="bg-white border border-indigo-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2"><Plus className="w-4 h-4 text-indigo-500" /> Add Memory</h3>
                    <button onClick={() => setShowAddForm(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Category</label>
                      <select value={newMemory.category} onChange={e => setNewMemory(n => ({ ...n, category: e.target.value as MemoryCategory }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                        {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Confidence</label>
                      <select value={newMemory.confidence} onChange={e => setNewMemory(n => ({ ...n, confidence: e.target.value as MemoryConfidence }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                        <option value="high">Verified</option>
                        <option value="medium">Likely</option>
                        <option value="low">Unverified</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Memory Content</label>
                    <textarea
                      value={newMemory.content}
                      onChange={e => setNewMemory(n => ({ ...n, content: e.target.value }))}
                      rows={3}
                      placeholder="Describe what the agent should remember about this project…"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400 resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddMemory} disabled={!newMemory.content.trim() || saving}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors">
                      {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save Memory</>}
                    </button>
                    <button onClick={() => setShowAddForm(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-xs font-medium px-4 py-2.5 rounded-xl">Cancel</button>
                  </div>
                </div>
              )}

              {/* Memory Groups */}
              {Object.entries(grouped).map(([cat, items]) => {
                const cfg = CATEGORIES[cat as MemoryCategory];
                const Icon = cfg.icon;
                const isCollapsed = collapsedCategories.has(cat);

                return (
                  <div key={cat} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    {/* Category Header */}
                    <button
                      onClick={() => toggleCategory(cat)}
                      className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl border text-sm ${cfg.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="font-semibold text-neutral-900 text-sm">{cfg.label}</span>
                          <span className="ml-2 text-[10px] text-neutral-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                        </div>
                        {items.some(m => m.is_important) && (
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        )}
                      </div>
                      {isCollapsed
                        ? <ChevronRight className="w-4 h-4 text-neutral-300" />
                        : <ChevronDown className="w-4 h-4 text-neutral-300" />
                      }
                    </button>

                    {/* Memory Items */}
                    {!isCollapsed && (
                      <div className="border-t border-neutral-100 divide-y divide-neutral-100">
                        {items.map(m => (
                          <div key={m.id} className={`p-4 ${m.is_outdated ? "opacity-50 bg-neutral-50" : m.is_important ? "bg-amber-50/30" : ""}`}>
                            {editingId === m.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  rows={3}
                                  className="w-full bg-white border border-indigo-300 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none resize-none"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => handleSaveEdit(m.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <Save className="w-3.5 h-3.5" /> Save
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="bg-neutral-100 text-neutral-600 text-xs font-medium px-3 py-1.5 rounded-lg">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    {m.is_important && (
                                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                        <Star className="w-2.5 h-2.5 fill-amber-500" /> Important
                                      </span>
                                    )}
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_CONFIG[m.confidence].color}`}>
                                      {CONFIDENCE_CONFIG[m.confidence].label}
                                    </span>
                                    {m.is_outdated && (
                                      <span className="text-[10px] font-semibold text-neutral-400 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full">Outdated</span>
                                    )}
                                    <span className="text-[10px] text-neutral-400">
                                      {m.source === "user_instruction" || m.source === "user_added"
                                        ? "👤 User" : "🤖 Agent"} · {timeAgo(m.updated_at)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-neutral-800 leading-relaxed">{m.content}</p>
                                  {m.tags.length > 0 && (
                                    <div className="flex gap-1 mt-2 flex-wrap">
                                      {m.tags.map(tag => (
                                        <span key={tag} className="text-[10px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md">#{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleToggleImportant(m.id)}
                                    title={m.is_important ? "Unmark important" : "Mark important"}
                                    className={`p-1.5 rounded-lg transition-colors ${m.is_important ? "text-amber-500 bg-amber-50 hover:bg-amber-100" : "text-neutral-300 hover:text-amber-400 hover:bg-amber-50"}`}>
                                    <Star className={`w-3.5 h-3.5 ${m.is_important ? "fill-amber-400" : ""}`} />
                                  </button>
                                  <button
                                    onClick={() => handleEdit(m)}
                                    title="Edit"
                                    className="p-1.5 rounded-lg text-neutral-300 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {!m.is_outdated && (
                                    <button
                                      onClick={() => handleMarkOutdated(m.id)}
                                      title="Mark as outdated"
                                      className="p-1.5 rounded-lg text-neutral-300 hover:text-amber-500 hover:bg-amber-50 transition-colors">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDelete(m.id)}
                                    title="Delete"
                                    className="p-1.5 rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-16 border border-dashed border-neutral-200 rounded-2xl text-neutral-400">
                  <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No memories match your filters.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ACTIVITY TAB ── */}
          {activeTab === "activity" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>This log shows every time the agent learned something new, updated existing knowledge, or when you manually edited the memory bank.</span>
              </div>

              <div className="space-y-2">
                {activity.map(item => (
                  <div key={item.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex items-start justify-between gap-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-xl border mt-0.5 ${
                        item.triggered_by === "agent"
                          ? "bg-indigo-50 border-indigo-200 text-indigo-500"
                          : "bg-neutral-100 border-neutral-200 text-neutral-500"
                      }`}>
                        {item.triggered_by === "agent" ? <Cpu className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <p className="text-sm text-neutral-800">{item.summary}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400">
                          <span className={`font-semibold ${item.triggered_by === "agent" ? "text-indigo-500" : "text-neutral-500"}`}>
                            {item.triggered_by === "agent" ? "🤖 AI Agent" : "👤 User"}
                          </span>
                          <span>·</span>
                          <Clock className="w-3 h-3" />
                          <span>{timeAgo(item.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                      item.action === "learned" || item.action === "updated"
                        ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                        : item.action === "user_added" || item.action === "user_edited"
                          ? "bg-neutral-100 text-neutral-600 border-neutral-200"
                          : item.action === "marked_important"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-red-50 text-red-500 border-red-200"
                    }`}>
                      {item.action.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
