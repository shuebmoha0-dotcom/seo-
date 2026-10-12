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
    if (!currentWebsite?.id) {
      setInstructions("");
      setSavedInstructionsSnapshot("");
      setMemory("");
      setSavedMemorySnapshot("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        const localInstr = localStorage.getItem(`seo_project_instructions_${currentWebsite.id}`);
        if (localInstr) {
          setInstructions(localInstr);
          setSavedInstructionsSnapshot(localInstr);
        } else {
          setInstructions("");
          setSavedInstructionsSnapshot("");
        }
        const localMem = localStorage.getItem(`seo_autonomous_memory_${currentWebsite.id}`);
        if (localMem) {
          setMemory(localMem);
          setSavedMemorySnapshot(localMem);
        } else {
          setMemory("");
          setSavedMemorySnapshot("");
        }
      }

      const url = `/api/memory?website_id=${currentWebsite.id}&_t=${Date.now()}`;

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
          if (typeof window !== "undefined") localStorage.setItem(`seo_project_instructions_${currentWebsite.id}`, data.instructions);
        }
        if (data.memory !== undefined) {
          setMemory(data.memory);
          setSavedMemorySnapshot(data.memory);
          if (typeof window !== "undefined") localStorage.setItem(`seo_autonomous_memory_${currentWebsite.id}`, data.memory);
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
    if (!currentWebsite?.id) return;
    setSavingInstructions(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`seo_project_instructions_${currentWebsite.id}`, instructions);
      }

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          type: "instructions",
          content: instructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save custom instructions");

      setSavedInstructionsSnapshot(instructions);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setSaveError(err.message || "Failed to save instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleSaveMemory = async () => {
    if (!currentWebsite?.id) return;
    setSavingMemory(true);
    setSaveError(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(`seo_autonomous_memory_${currentWebsite.id}`, memory);
      }

      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          type: "memory",
          content: memory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save project memory");

      setSavedMemorySnapshot(memory);
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err: any) {
      setSaveError(err.message || "Failed to save memory");
    } finally {
      setSavingMemory(false);
    }
  };

  const handleDeleteInstructions = async () => {
    if (!currentWebsite?.id) return;
    if (!confirm("Are you sure you want to clear your Custom Instructions space?")) return;
    setSavingInstructions(true);
    try {
      setInstructions("");
      setSavedInstructionsSnapshot("");
      if (typeof window !== "undefined") localStorage.removeItem(`seo_project_instructions_${currentWebsite.id}`);
      await fetch(`/api/memory?type=instructions&website_id=${currentWebsite.id}`, { method: "DELETE" });
    } catch (err: any) {
      setSaveError(err.message || "Failed to clear instructions");
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!currentWebsite?.id) return;
    if (!confirm("Are you sure you want to clear the Autonomous Project Memory space?")) return;
    setSavingMemory(true);
    try {
      setMemory("");
      setSavedMemorySnapshot("");
      if (typeof window !== "undefined") localStorage.removeItem(`seo_autonomous_memory_${currentWebsite.id}`);
      await fetch(`/api/memory?type=memory&website_id=${currentWebsite.id}`, { method: "DELETE" });
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
      app: "Outdart",
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

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                <span>Settings</span>
                <span>/</span>
                <span className="text-neutral-600">Project Context</span>
              </div>
              <div className="flex items-center gap-2.5 mt-1">
                <h1 className="text-[22px] font-semibold leading-7 text-neutral-900">
                  Project Memory & Custom Instructions
                </h1>
                {currentWebsite?.domain && (
                  <span className="inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-mono font-medium text-neutral-700">
                    {currentWebsite.domain}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500 mt-1">
                Spacious memory banks for human brand guidelines and agent-learned SEO context.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={fetchData}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                title="Reload memory from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-neutral-500'}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                title="Export memory and instructions to JSON"
              >
                <Download className="w-3.5 h-3.5 text-neutral-500" />
                <span>Export</span>
              </button>

              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                title="Import memory and instructions from JSON or file"
              >
                <Upload className="w-3.5 h-3.5 text-neutral-500" />
                <span>Import</span>
              </button>
            </div>
          </div>

          {/* 4-cell stat strip */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
            <div className="p-5">
              <span className="text-[13px] text-neutral-500">Custom Instructions</span>
              <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                {instructions ? `${instructions.length}` : "0"}
              </div>
              <div className="mt-1.5 text-xs text-neutral-500">characters stored</div>
            </div>

            <div className="border-l border-neutral-200 p-5">
              <span className="text-[13px] text-neutral-500">Autonomous Memory</span>
              <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">
                {memory ? `${memory.length}` : "0"}
              </div>
              <div className="mt-1.5 text-xs text-neutral-500">facts & takeaways</div>
            </div>

            <div className="border-t border-neutral-200 p-5 lg:border-t-0 lg:border-l">
              <span className="text-[13px] text-neutral-500">Sync Status</span>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[28px] font-semibold leading-8 text-neutral-900">Active</span>
              </div>
              <div className="mt-1.5 text-xs text-neutral-500">
                {lastSavedTime ? `Last saved ${lastSavedTime}` : "Auto-synced with agent"}
              </div>
            </div>

            <div className="border-t border-l border-neutral-200 p-5 lg:border-t-0">
              <span className="text-[13px] text-neutral-500">Context Scope</span>
              <div className="mt-1.5 truncate text-[22px] font-semibold leading-8 text-neutral-900 font-mono">
                {currentWebsite?.domain || "Universal"}
              </div>
              <div className="mt-1.5 text-xs text-neutral-500">Isolated project workspace</div>
            </div>
          </div>

          {/* Error Notification */}
          {saveError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{saveError}</span>
              </div>
              <button onClick={() => setSaveError(null)} className="text-rose-500 hover:text-rose-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Segmented Control Filter Tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-center overflow-hidden rounded-md border border-neutral-300 bg-white shadow-2xs">
              <button
                onClick={() => setActiveTab("instructions")}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "instructions"
                    ? "bg-[#e8f0fe] text-[#1967d2] font-semibold"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {activeTab === "instructions" && <Check className="h-3 w-3 text-[#1967d2] stroke-[3]" />}
                <FileText className="h-3.5 w-3.5" />
                <span>1. Custom Instructions (Set by You)</span>
                {instructions.trim() && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("memory")}
                className={`flex items-center gap-1 border-l border-neutral-200 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === "memory"
                    ? "bg-[#e8f0fe] text-[#1967d2] font-semibold"
                    : "text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {activeTab === "memory" && <Check className="h-3 w-3 text-[#1967d2] stroke-[3]" />}
                <Brain className="h-3.5 w-3.5" />
                <span>2. Autonomous Project Memory (Agent Learned)</span>
                {memory.trim() && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: CUSTOM INSTRUCTIONS */}
          {activeTab === "instructions" && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Custom Brand Instructions & Editorial Persona</span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Authoritative Human Rules
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Your guidelines for tone of voice, formatting directives, forbidden terms, and audience standards.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(instructions);
                      alert("Custom instructions copied to clipboard!");
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>

                  <button
                    onClick={handleDeleteInstructions}
                    disabled={!instructions.trim() || savingInstructions}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[13px] font-medium text-red-600 shadow-2xs hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={handleSaveInstructions}
                    disabled={savingInstructions}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-colors shadow-2xs ${
                      hasUnsavedInstructions
                        ? "border border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingInstructions ? "Saving..." : hasUnsavedInstructions ? "Save Changes *" : "Saved"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Inserters */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-600 pt-1">
                <span className="font-semibold text-neutral-400 text-[11px]">Quick Templates:</span>
                <button
                  onClick={() => appendInstructionTemplate("Persona & Tone:\n- Write as a battle-tested industry practitioner with deep domain expertise.\n- Maintain an authoritative, direct, and pragmatic tone with zero fluff.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Persona & Tone
                </button>
                <button
                  onClick={() => appendInstructionTemplate("Brand Guidelines:\n- Every article must include concrete, copyable templates and step-by-step frameworks.\n- Emphasize business revenue, conversion rates, and workflow speed.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Brand Guidelines
                </button>
                <button
                  onClick={() => appendInstructionTemplate("Forbidden Rules:\n- NEVER use generic filler phrases like 'in today's digital world', 'it goes without saying', or 'in conclusion'.\n- NEVER use superficial keyword stuffing.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Forbidden Rules
                </button>
                <button
                  onClick={() => appendInstructionTemplate("CTA Format:\n- Close with a clear, high-value B2B call to action that offers an actionable next step or resource.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + CTA Format
                </button>
              </div>

              {/* Main Instruction Textarea */}
              <div className="relative">
                <textarea
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder={`Type your custom brand guidelines, writing style, tone, forbidden words, and target audience directives here...

Example:
1. Always write from the perspective of an experienced B2B growth and AI automation strategist.
2. Tone must be direct, highly practical, authoritative, and actionable with zero fluff.
3. Every article must include concrete, real-world examples and step-by-step frameworks.`}
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-lg p-4 text-xs md:text-sm text-neutral-900 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  rows={15}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>Capacity: Up to 50,000+ characters</span>
                <span className="font-mono">{instructions.length} characters</span>
              </div>
            </div>
          )}

          {/* TAB 2: AUTONOMOUS PROJECT MEMORY */}
          {activeTab === "memory" && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    <span>Autonomous Project Memory & Learned Knowledge</span>
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                      Agent Knowledge Bank
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Continuous memory bank where the AI agent accumulates domain facts, competitor gaps, and successful SEO patterns.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(memory);
                      alert("Autonomous memory copied to clipboard!");
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>

                  <button
                    onClick={handleDeleteMemory}
                    disabled={!memory.trim() || savingMemory}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[13px] font-medium text-red-600 shadow-2xs hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>

                  <button
                    onClick={handleSaveMemory}
                    disabled={savingMemory}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium transition-colors shadow-2xs ${
                      hasUnsavedMemory
                        ? "border border-indigo-700 bg-indigo-600 text-white hover:bg-indigo-700"
                        : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingMemory ? "Saving..." : hasUnsavedMemory ? "Save Changes *" : "Saved"}</span>
                  </button>
                </div>
              </div>

              {/* Quick Template Inserters for Memory */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-neutral-600 pt-1">
                <span className="font-semibold text-neutral-400 text-[11px]">Quick Memory Facts:</span>
                <button
                  onClick={() => appendMemoryTemplate("Target Audience & Buyer Persona:\n- Core Audience: B2B SaaS founders, SDRs, Demand Generation leaders, and RevOps managers.\n- Primary Pain Points: Slow outbound response times, manual lead qualification, and low meeting conversion rates.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Audience Insights
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Product & Company Knowledge Bank:\n- [Company/Brand Name] is a leading [industry/niche] platform.\n- Core Solutions: [Detail your product features, services, and core value propositions here].")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Company Facts
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Learned SEO & Content Patterns:\n- In-depth teardowns with step-by-step copyable email templates rank 3x higher in organic search.\n- Including visual workflow illustrations increases average dwell time above 4.5 minutes.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Winning Patterns
                </button>
                <button
                  onClick={() => appendMemoryTemplate("Competitor & Market Dynamics:\n- Key category competitors focus heavily on high-level theory rather than tactical copyable templates.\n- Opportunity: Differentiate by providing immediately usable outreach scripts and concrete workflows.")}
                  className="px-2.5 py-1 bg-neutral-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-neutral-200 rounded-md transition-colors text-[11px] font-medium text-neutral-700"
                >
                  + Competitor Insights
                </button>
              </div>

              {/* Main Memory Textarea */}
              <div className="relative">
                <textarea
                  value={memory}
                  onChange={e => setMemory(e.target.value)}
                  placeholder={`Large open memory space for learned insights, product facts, audience research, and historical SEO performance...

The AI agent will continuously read and reference this memory space when drafting articles, generating outlines, and formulating keywords.`}
                  className="w-full bg-neutral-50/70 border border-neutral-200 rounded-lg p-4 text-xs md:text-sm text-neutral-900 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all shadow-2xs"
                  rows={15}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                <span>Capacity: Up to 100,000+ characters</span>
                <span className="font-mono">{memory.length} characters</span>
              </div>
            </div>
          )}

          {/* MODAL: EXPORT MEMORY */}
          {showExportModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-xl w-full shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>Export Project Memory & Instructions</span>
                  </h3>
                  <button onClick={() => setShowExportModal(false)} className="text-neutral-400 hover:text-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <p className="text-neutral-600 leading-relaxed">
                    Export both your Custom Instructions and Autonomous Project Memory as a clean JSON backup file.
                  </p>

                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5 font-mono text-[11px] text-neutral-700 max-h-48 overflow-y-auto">
                    <div className="text-neutral-400">// Preview of export backup</div>
                    <div>Website: {currentWebsite?.domain || "default"}</div>
                    <div>Custom Instructions: {instructions ? `${instructions.length} characters` : "(empty)"}</div>
                    <div>Autonomous Memory: {memory ? `${memory.length} characters` : "(empty)"}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100">
                  <button
                    onClick={handleCopyJSON}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 transition-colors"
                  >
                    {copiedExport ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">Copied JSON!</span>
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
                      className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100"
                    >
                      Close
                    </button>
                    <button
                      onClick={handleDownloadJSON}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODAL: IMPORT MEMORY */}
          {showImportModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-xl w-full shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                  <h3 className="font-semibold text-sm text-neutral-900 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Import Project Memory & Instructions</span>
                  </h3>
                  <button onClick={() => setShowExportModal(false)} className="text-neutral-400 hover:text-neutral-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {importSuccessMessage && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{importSuccessMessage}</span>
                  </div>
                )}

                {importErrorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{importErrorMessage}</span>
                  </div>
                )}

                <div className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1.5">Upload JSON Backup File</label>
                    <label className="border-2 border-dashed border-neutral-200 hover:border-indigo-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-neutral-50/50 hover:bg-indigo-50/30 transition-all text-center">
                      <UploadCloud className="w-6 h-6 text-neutral-400" />
                      <span className="font-medium text-neutral-700">Click to select .json file or drag & drop</span>
                      <span className="text-[10px] text-neutral-400">JSON export backup files from Outdart or raw text</span>
                      <input
                        type="file"
                        accept=".json,.txt"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1.5">Or Paste Raw JSON / Instructions</label>
                    <textarea
                      value={importText}
                      onChange={e => setImportText(e.target.value)}
                      placeholder='{"custom_instructions": "...", "autonomous_memory": "..."}'
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-800 font-mono focus:outline-none focus:border-indigo-500 shadow-2xs"
                      rows={5}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-700 mb-1.5">Import Strategy</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode("merge")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          importMode === "merge"
                            ? "bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-200"
                            : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100/70"
                        }`}
                      >
                        <div className="font-semibold text-xs text-neutral-900">Merge (Recommended)</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Append new memories to your existing space.</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode("replace")}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          importMode === "replace"
                            ? "bg-amber-50/80 border-amber-300 ring-1 ring-amber-200"
                            : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100/70"
                        }`}
                      >
                        <div className="font-semibold text-xs text-neutral-900">Replace All</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">Overwrite existing memory spaces completely.</div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="inline-flex h-8 items-center rounded-lg px-3 text-[13px] font-medium text-neutral-600 hover:bg-neutral-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExecuteImport}
                    disabled={!importText.trim() || importing}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{importing ? "Importing..." : "Execute Import"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
