"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Brain, FileText, Save, Trash2, Copy, Check, Download, Upload,
  RefreshCw, Sparkles, ShieldCheck, AlertTriangle, X, CheckCircle2,
  UploadCloud, ArrowRight, Zap, BookOpen, Layers
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function ProjectMemoryPage() {
  const { currentWebsite } = useWebsite();

  // 2 Clean Large Spaces: Custom Instructions & Autonomous Memory
  const [activeTab, setActiveTab] = useState<"instructions" | "memory">("instructions");

  // Tab 1: Custom Instructions (Set by human user)
  const [instructions, setInstructions] = useState("");
  const [savedInstructionsSnapshot, setSavedInstructionsSnapshot] = useState("");
  const [savingInstructions, setSavingInstructions] = useState(false);

  // Tab 2: Autonomous Project Memory (Decided & learned by agent over time)
  const [memory, setMemory] = useState("");
  const [savedMemorySnapshot, setSavedMemorySnapshot] = useState("");
  const [savingMemory, setSavingMemory] = useState(false);

  const [loading, setLoading] = useState(true);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
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
        const localMem = localStorage.getItem("seo_autonomous_memory");
        if (localMem) {
          setMemory(localMem);
          setSavedMemorySnapshot(localMem);
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
        if (data.instructions !== undefined) {
          setInstructions(data.instructions);
          setSavedInstructionsSnapshot(data.instructions);
          if (typeof window !== "undefined") localStorage.setItem("seo_project_instructions", data.instructions);
        }
        if (data.memory !== undefined) {
          setMemory(data.memory);
          setSavedMemorySnapshot(data.memory);
          if (typeof window !== "undefined") localStorage.setItem("seo_autonomous_memory", data.memory);
        }
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
  const hasUnsavedMemory = memory !== savedMemorySnapshot;

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
      if (!res.ok) throw new Error(data.error || "Failed to save instructions");

      setSavedInstructionsSnapshot(instructions);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error("Save instructions error:", err);
      setSaveError(err.message || "Failed to save instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleSaveMemory = async () => {
    setSavingMemory(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("seo_autonomous_memory", memory);
      }

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite?.id,
          type: "memory",
          memory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save memory");

      setSavedMemorySnapshot(memory);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      console.error("Save memory error:", err);
      setSaveError(err.message || "Failed to save memory");
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteInstructions = async () => {
    if (!confirm("Are you sure you want to clear Custom Instructions?")) return;
    setSavingInstructions(true);
    try {
      setInstructions("");
      setSavedInstructionsSnapshot("");
      if (typeof window !== "undefined") localStorage.removeItem("seo_project_instructions");
      await fetch(`/api/memory?type=instructions${currentWebsite?.id ? `&website_id=${currentWebsite.id}` : ""}`, { method: "DELETE" });
    } catch (err: any) {
      setSaveError(err.message || "Failed to clear instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!confirm("Are you sure you want to clear the Autonomous Project Memory space?")) return;
    setSavingMemory(true);
    try {
      setMemory("");
      setSavedMemorySnapshot("");
      if (typeof window !== "undefined") localStorage.removeItem("seo_autonomous_memory");
      await fetch(`/api/memory?type=memory${currentWebsite?.id ? `&website_id=${currentWebsite.id}` : ""}`, { method: "DELETE" });
    } catch (err: any) {
      setSaveError(err.message || "Failed to clear memory");
    } finally {
      setSavingMemory(false);
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
      autonomous_memory: memory,
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
        // If not valid JSON, treat as text based on active tab
        parsedData = activeTab === "instructions"
          ? { custom_instructions: importText.trim() }
          : { autonomous_memory: importText.trim() };
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
      if (!res.ok) throw new Error(data.error || "Failed to import memory.");

      setImportSuccessMessage(data.message || "Import completed successfully!");
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

  const appendInstructionTemplate = (templateText: string) => {
    setInstructions(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n\n${templateText}` : templateText;
    });
  };

  const appendMemoryTemplate = (templateText: string) => {
    setMemory(prev => {
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
              Spacious memory banks for human brand rules and agent-learned insights for {currentWebsite?.domain || "your website"}.
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
                <span className="text-xs font-bold">Memory &amp; Instructions Active</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Both large spaces are automatically combined and applied across all article drafting, keyword analysis, and SEO optimization.
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
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "instructions"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Custom Instructions (Set by You)</span>
            {instructions.trim() && (
              <span className={`w-2 h-2 rounded-full ${activeTab === 'instructions' ? 'bg-white' : 'bg-indigo-600'}`}></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("memory")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "memory"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-neutral-100/80 text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>2. Autonomous Project Memory &amp; Knowledge Space</span>
            {memory.trim() && (
              <span className={`w-2 h-2 rounded-full ${activeTab === 'memory' ? 'bg-white' : 'bg-indigo-600'}`}></span>
            )}
          </button>
        </div>

        {/* ── TAB 1: CUSTOM INSTRUCTIONS (LARGE SPACE) ── */}
        {activeTab === "instructions" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Custom Brand Instructions &amp; Editorial Persona</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ Set Exclusively by You
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Your authoritative human rules: tone of voice, formatting directives, forbidden terms, and target audience standards.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instructions);
                      alert("Custom instructions copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
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

        {/* ── TAB 2: AUTONOMOUS PROJECT MEMORY & KNOWLEDGE SPACE (LARGE SPACE) ── */}
        {activeTab === "memory" && (
          <div className="space-y-6">
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    <span>Autonomous Project Memory &amp; Learned Knowledge</span>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      ⚡ Learned by Agent Over Time
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Large open memory space where the AI agent accumulates domain facts, successful ranking patterns, competitor insights, and historical performance takeaways.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(memory);
                      alert("Autonomous memory copied to clipboard!");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition-all shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>

                  <button
                    onClick={handleDeleteMemory}
                    disabled={!memory.trim() || savingMemory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={handleSaveMemory}
                    disabled={savingMemory}
                    className={`flex items-center gap-1.5 px-5 py-1.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                      hasUnsavedMemory
                        ? "bg-indigo-600 hover:bg-indigo-700 ring-2 ring-indigo-300"
                        : "bg-neutral-800 hover:bg-neutral-900"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingMemory ? "Saving..." : hasUnsavedMemory ? "Save Changes *" : "Saved"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Inserters for Memory */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-600 pt-1">
                <span className="font-semibold text-neutral-400 text-[11px]">Quick Insert Memory Facts:</span>
                <button
                  onClick={() => appendMemoryTemplate("Target Audience & Buyer Persona:\n- Core Audience: B2B SaaS founders, SDRs, Demand Generation leaders, and RevOps managers.\n- Primary Pain Points: Slow outbound response times, manual lead qualification, and low meeting conversion rates.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Audience Insights
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Product & Company Knowledge Bank:\n- BizAiGenius is a premier B2B SaaS platform and AI tools directory.\n- Core Solutions: AI-powered automated lead enrichment, outbound sales playbooks, and modern conversion workflows.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Company Facts
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Learned SEO & Content Patterns:\n- In-depth teardowns with step-by-step copyable email templates rank 3x higher in organic search.\n- Including visual workflow illustrations increases average dwell time above 4.5 minutes.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Winning Patterns
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Competitor & Market Dynamics:\n- Key category competitors focus heavily on high-level theory rather than tactical copyable templates.\n- Opportunity: Differentiate by providing immediately usable outreach scripts and concrete workflows.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-lg transition-colors text-[11px] font-medium"
                >
                  + Competitor Insights
                </button>
              </div>

              {/* Main Memory Textarea */}
              <div className="relative">
                <textarea
                  value={memory}
                  onChange={e => setMemory(e.target.value)}
                  placeholder="Large open memory space for learned insights, product facts, audience research, and historical SEO performance...

The AI agent will continuously read and reference this memory space when drafting articles, generating outlines, and formulating keywords."
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-2xl p-4 text-xs md:text-sm text-neutral-900 font-mono leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                  rows={16}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>Capacity: Up to 100,000+ characters</span>
                <span>{memory.length} characters</span>
              </div>
            </div>
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
                  Export both your Custom Instructions and Autonomous Project Memory as a clean JSON backup file.
                </p>

                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-1.5 font-mono text-[11px] text-neutral-700 max-h-48 overflow-y-auto">
                  <div className="text-neutral-400">// Preview of export backup</div>
                  <div>Website: {currentWebsite?.domain || "default"}</div>
                  <div>Custom Instructions: {instructions ? `${instructions.length} characters` : "(empty)"}</div>
                  <div>Autonomous Memory: {memory ? `${memory.length} characters` : "(empty)"}</div>
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
                    <span className="text-[10px] text-neutral-400">JSON export backup files from SEO Autopilot or raw text</span>
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
                    placeholder='{"custom_instructions": "...", "autonomous_memory": "..."}'
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
                      <div className="text-[10px] text-neutral-500 mt-0.5">Append new memories to your existing memory space.</div>
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
                      <div className="text-[10px] text-neutral-500 mt-0.5">Overwrite existing memory spaces with imported data.</div>
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
      </div>
    </div>
  );
}
