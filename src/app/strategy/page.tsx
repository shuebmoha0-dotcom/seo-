"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Compass,
  Sparkles,
  Target,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Brain,
  ShieldCheck,
  RotateCcw,
  Zap,
  Loader2,
  Globe,
  Plus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function StrategyPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [primaryGoal, setPrimaryGoal] = useState("increase_organic_traffic");
  const [evaluating, setEvaluating] = useState(false);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);
  const [delegatedList, setDelegatedList] = useState<string[]>([]);
  const [roadmapPhases, setRoadmapPhases] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_strategy_phases_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });
  const [projectMemory, setProjectMemory] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_strategy_mem_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_cached_strategy_phases_${storedSiteId}`);
          if (cached) return false;
        }
      } catch {}
    }
    return true;
  });

  const fetchStrategy = async () => {
    if (!currentWebsite) {
      setRoadmapPhases([]);
      setProjectMemory([]);
      setLoading(false);
      return;
    }

    try {
      if (roadmapPhases.length === 0) {
        setLoading(true);
      }
      const res = await fetch(`/api/strategy?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        const phases = (data.strategic_plans && data.strategic_plans.length > 0)
          ? (data.strategic_plans[0].phases || [])
          : [];
        const mem = data.project_memory || [];
        setRoadmapPhases(phases);
        setProjectMemory(mem);

        if (typeof window !== "undefined") {
          sessionStorage.setItem(`seo_cached_strategy_phases_${currentWebsite.id}`, JSON.stringify(phases));
          sessionStorage.setItem(`seo_cached_strategy_mem_${currentWebsite.id}`, JSON.stringify(mem));
        }
      }
    } catch (err) {
      console.error("Error fetching strategy:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStrategy();
  }, [currentWebsite?.id]);

  const handleEvaluate = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }
    setEvaluating(true);
    try {
      const res = await fetch("/api/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          primary_goal: primaryGoal,
        }),
      });
      if (res.ok) {
        await fetchStrategy();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleDelegate = async (task: any) => {
    setDelegatingId(task.id || task.title);
    try {
      await fetch("/api/agent/strategy/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });
      setDelegatedList((prev) => [...prev, task.id || task.title]);
    } catch (e) {
      console.error(e);
    } finally {
      setDelegatingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20 font-sans">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span className="font-medium text-neutral-400">Autonomous SEO</span>
              <span className="text-neutral-300">/</span>
              <span className="font-semibold text-neutral-700">Strategy Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Strategic Roadmap &amp; Orchestration
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Target className="w-3 h-3 text-indigo-600" />
                Autonomous Engine
              </span>
            </div>
            <p className="text-neutral-500 text-xs mt-1">
              {currentWebsite
                ? `Prioritizes highest-ROI actions and delegates execution phases for ${currentWebsite.domain}.`
                : "Connect your website to generate an empirical AI execution roadmap."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs"
            >
              <option value="increase_organic_traffic">Goal: Grow Organic Traffic</option>
              <option value="generate_qualified_leads">Goal: High-Intent Conversions</option>
              <option value="recover_lost_rankings">Goal: Recover Lost Rankings</option>
              <option value="build_domain_authority">Goal: Domain Authority &amp; PR</option>
            </select>

            <button
              onClick={handleEvaluate}
              disabled={evaluating || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs active:scale-[0.98]"
            >
              {evaluating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{evaluating ? "Evaluating..." : "Generate Roadmap"}</span>
            </button>
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
                Strategy agents synthesize crawl health, search positions, and competitor gaps to build prioritized execution roadmaps.
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
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Active Goal
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-neutral-900 truncate pr-2">
                    {primaryGoal === "increase_organic_traffic"
                      ? "Organic Traffic"
                      : primaryGoal === "generate_qualified_leads"
                      ? "Leads & Revenue"
                      : primaryGoal === "recover_lost_rankings"
                      ? "Rank Recovery"
                      : "Domain Authority"}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                    Primary
                  </span>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Roadmap Phases
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                    {roadmapPhases.length}
                  </span>
                  <span className="text-[11px] font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">
                    Structured
                  </span>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Learned Insights
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-neutral-900 tabular-nums">
                    {projectMemory.length}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Active Memory
                  </span>
                </div>
              </div>

              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                  Orchestration Status
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-emerald-700">
                    Ready to Execute
                  </span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Roadmap Phases */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    Strategic Execution Roadmap
                  </h2>
                  <span className="text-xs text-neutral-500 font-mono">
                    {roadmapPhases.length} Phases Planned
                  </span>
                </div>

                {roadmapPhases.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3 shadow-xs">
                    <Compass className="w-8 h-8 text-neutral-400 mx-auto" />
                    <h3 className="text-sm font-semibold text-neutral-900">No Active Roadmap Generated</h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                      Click &ldquo;Generate Roadmap&rdquo; above to evaluate growth opportunities for {currentWebsite.domain}.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {roadmapPhases.map((phase, idx) => {
                      const phaseStatus = phase.status || "Planned";
                      return (
                        <div
                          key={idx}
                          className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3 hover:border-neutral-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <h3 className="font-bold text-neutral-900 text-sm">
                                {phase.phase_title || phase.phase || `Phase ${idx + 1}`}
                              </h3>
                            </div>
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                              {phaseStatus}
                            </span>
                          </div>

                          <p className="text-xs text-neutral-600 leading-relaxed pl-8">
                            {phase.focus_description || phase.description}
                          </p>

                          {phase.tasks && Array.isArray(phase.tasks) && phase.tasks.length > 0 && (
                            <div className="pl-8 pt-2 space-y-2 border-t border-neutral-100 mt-2">
                              <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                Action Items ({phase.tasks.length})
                              </span>
                              <div className="space-y-1.5">
                                {phase.tasks.map((task: any, tIdx: number) => {
                                  const taskId = task.id || task.title;
                                  const isDelegated = delegatedList.includes(taskId);
                                  const isDelegating = delegatingId === taskId;
                                  return (
                                    <div
                                      key={tIdx}
                                      className="flex items-center justify-between text-xs bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200"
                                    >
                                      <span className="font-medium text-neutral-800">
                                        {task.title || task}
                                      </span>
                                      <button
                                        onClick={() => handleDelegate(task)}
                                        disabled={isDelegated || isDelegating}
                                        className={`text-[11px] font-semibold px-2.5 py-1 rounded transition-colors ${
                                          isDelegated
                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                        }`}
                                      >
                                        {isDelegated
                                          ? "Delegated"
                                          : isDelegating
                                          ? "Queuing..."
                                          : "Delegate Task"}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Col: Project Memory & Continuous Learning */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-indigo-600" />
                    Project Memory &amp; Insights
                  </h2>
                  <span className="text-xs text-neutral-500 font-mono">
                    {projectMemory.length} Learned
                  </span>
                </div>

                {projectMemory.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-neutral-200 rounded-xl space-y-2 text-xs shadow-xs">
                    <Brain className="w-6 h-6 text-neutral-400 mx-auto" />
                    <p className="font-semibold text-neutral-800">No Learned Insights Yet</p>
                    <p className="text-neutral-500 text-[11px]">
                      As agents observe search rank shifts and experiment results for {currentWebsite.domain}, empirical insights are stored here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {projectMemory.map((mem) => (
                      <div
                        key={mem.id}
                        className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-2 hover:border-neutral-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase tracking-wider">
                            {mem.category}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-medium">
                            {mem.confidence || "High"} Confidence
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 leading-relaxed">{mem.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
