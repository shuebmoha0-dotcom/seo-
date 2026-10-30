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
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();

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
  const [telemetry, setTelemetry] = useState<any>(null);
  const [latestDecision, setLatestDecision] = useState<any>(null);
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
      setTelemetry(null);
      setLatestDecision(null);
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
        setTelemetry(data.telemetry || null);
        setLatestDecision(data.latest_decision || null);

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
    if (!currentWebsite?.id) {
      setRoadmapPhases([]);
      setProjectMemory([]);
      setTelemetry(null);
      setLatestDecision(null);
      setLoading(false);
      return;
    }
    const cachedPhases = sessionStorage.getItem(`seo_cached_strategy_phases_${currentWebsite.id}`);
    const cachedMem = sessionStorage.getItem(`seo_cached_strategy_mem_${currentWebsite.id}`);
    if (cachedPhases && cachedMem) {
      setRoadmapPhases(JSON.parse(cachedPhases));
      setProjectMemory(JSON.parse(cachedMem));
      setLoading(false);
    } else {
      setLoading(true);
    }
    fetchStrategy();
  }, [currentWebsite?.id]);

  const handleEvaluate = async () => {
    if (!currentWebsite) return;
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

  const statCells = [
    {
      label: "Active focus",
      value: primaryGoal === "increase_organic_traffic"
        ? "Organic Traffic"
        : primaryGoal === "generate_qualified_leads"
        ? "Lead Generation"
        : primaryGoal === "recover_lost_rankings"
        ? "Rank Recovery"
        : "Domain Authority",
      caption: "Current strategic optimization target",
    },
    {
      label: "Roadmap phases",
      value: roadmapPhases.length.toLocaleString(),
      caption: "Sequenced execution phases",
    },
    {
      label: "Project memory",
      value: projectMemory.length.toLocaleString(),
      caption: "Learned domain insights & rules",
    },
    {
      label: "Engine state",
      value: "Ready",
      caption: "Autonomous execution pipeline active",
    },
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Strategy</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Roadmap</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Strategic Roadmap
              </h1>
              <p className="text-neutral-500 text-sm mt-1">
                {currentWebsite
                  ? `Prioritizes highest-ROI actions and delegates execution phases for ${currentWebsite.domain}`
                  : "Connect a website to generate an empirical AI execution roadmap."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <select
                value={primaryGoal}
                onChange={(e) => setPrimaryGoal(e.target.value)}
                className="h-8 rounded-lg border border-neutral-300 bg-white px-2.5 text-xs font-medium text-neutral-700 shadow-2xs focus:outline-none focus:border-indigo-500"
              >
                <option value="increase_organic_traffic">Goal: Grow Organic Traffic</option>
                <option value="generate_qualified_leads">Goal: High-Intent Leads</option>
                <option value="recover_lost_rankings">Goal: Recover Lost Rankings</option>
                <option value="build_domain_authority">Goal: Domain Authority &amp; PR</option>
              </select>

              {currentWebsite && (
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                >
                  {evaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{evaluating ? "Evaluating…" : "Generate roadmap"}</span>
                </button>
              )}
            </div>
          </header>

          {/* ── STATE 1: LOADING SKELETON OR NO WEBSITE CONNECTED ── */}
          {websiteLoading && !currentWebsite ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-24 bg-white border border-neutral-200 rounded-xl" />
              <div className="h-96 bg-white border border-neutral-200 rounded-xl" />
            </div>
          ) : !currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect a website to begin</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Strategy agents synthesize crawl health, search positions, and competitor gaps to build prioritized execution roadmaps.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : (
            <>
              {/* Stat strip */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                {statCells.map((cell, i) => (
                  <div
                    key={cell.label}
                    className={`p-5 ${i % 2 === 1 ? "border-l border-neutral-200" : ""} ${i > 1 ? "border-t border-neutral-200 lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-neutral-200" : ""}`}
                  >
                    <div className="text-[13px] text-neutral-500">{cell.label}</div>
                    <div className="mt-1.5 text-[22px] font-semibold leading-8 text-neutral-900 truncate">{cell.value}</div>
                    <div className="mt-1.5 text-xs text-neutral-500">{cell.caption}</div>
                  </div>
                ))}
              </section>

              {/* Autonomous Strategic Brain Diagnosis Card */}
              {(telemetry || latestDecision) && (
                <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 space-y-3 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                        <Brain className="w-3 h-3" />
                        Autonomous Strategy Brain
                      </span>
                      <span className="text-xs font-semibold text-neutral-900">
                        Live Empirical Diagnosis for {currentWebsite.domain}
                      </span>
                    </div>
                    {telemetry && (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-600 font-medium">
                        <span>Published: <strong className="text-neutral-900">{telemetry.total_published_articles}</strong></span>
                        <span>·</span>
                        <span>Indexed: <strong className="text-emerald-700">{telemetry.indexation_rate_pct}%</strong></span>
                        <span>·</span>
                        <span>
                          28d Impressions:{" "}
                          <strong className="text-neutral-900">
                            {telemetry.gsc_synced ? telemetry.gsc_total_impressions_28d.toLocaleString() : "Syncing GSC"}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {latestDecision?.content && (
                    <p className="text-xs text-neutral-800 leading-relaxed bg-white/90 border border-indigo-100 rounded-lg p-3 font-medium">
                      {latestDecision.content}
                    </p>
                  )}

                  {telemetry && (telemetry.saturated_categories?.length > 0 || telemetry.thin_categories?.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {telemetry.saturated_categories?.length > 0 && (
                        <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-medium">
                          🔒 Saturated Pillars Locked: {telemetry.saturated_categories.slice(0, 3).join(", ")}
                        </span>
                      )}
                      {telemetry.thin_categories?.length > 0 && (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                          🎯 Priority Growth Pillars: {telemetry.thin_categories.slice(0, 4).join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Grid content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Cols: Roadmap Phases */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>Execution Phases</span>
                    </h2>
                    <span className="text-xs text-neutral-500">
                      {roadmapPhases.length} {roadmapPhases.length === 1 ? "phase" : "phases"} planned
                    </span>
                  </div>

                  {roadmapPhases.length === 0 && !loading ? (
                    <div className="p-10 text-center bg-white border border-neutral-200 rounded-xl space-y-3 shadow-2xs">
                      <Compass className="w-6 h-6 text-neutral-400 mx-auto" />
                      <h3 className="text-sm font-semibold text-neutral-900">No active roadmap generated</h3>
                      <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                        Click &ldquo;Generate roadmap&rdquo; above to evaluate growth opportunities for {currentWebsite.domain}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {roadmapPhases.map((phase, idx) => {
                        const phaseStatus = phase.status || "Planned";
                        const phaseItems = Array.isArray(phase.actions) && phase.actions.length > 0
                          ? phase.actions
                          : Array.isArray(phase.tasks)
                          ? phase.tasks
                          : [];
                        return (
                          <div
                            key={idx}
                            className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs space-y-3 hover:border-neutral-300 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <h3 className="font-semibold text-neutral-900 text-sm">
                                  {phase.phase_title || phase.phase || `Phase ${idx + 1}`}
                                </h3>
                              </div>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 shrink-0">
                                {phaseStatus}
                              </span>
                            </div>

                            <p className="text-xs text-neutral-600 leading-relaxed pl-8">
                              {phase.focus_description || phase.description}
                            </p>

                            {phaseItems.length > 0 && (
                              <div className="pl-8 pt-3 space-y-2 border-t border-neutral-100 mt-2">
                                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                                  Action Items ({phaseItems.length})
                                </span>
                                <div className="space-y-2">
                                  {phaseItems.map((task: any, tIdx: number) => {
                                    const taskTitle = task.action_title || task.title || task;
                                    const taskId = task.id || taskTitle;
                                    const isDelegated = delegatedList.includes(taskId);
                                    const isDelegating = delegatingId === taskId;
                                    return (
                                      <div
                                        key={tIdx}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-neutral-50/70 px-3.5 py-2.5 rounded-lg border border-neutral-200/80"
                                      >
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-neutral-900">
                                              {taskTitle}
                                            </span>
                                            {task.target_agent && (
                                              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
                                                {task.target_agent}
                                              </span>
                                            )}
                                            {task.priority_score && (
                                              <span className="text-[10px] text-neutral-500 font-mono">
                                                ROI Score: {task.priority_score}/100
                                              </span>
                                            )}
                                          </div>
                                          {task.rationale && (
                                            <p className="text-[11px] text-neutral-600 leading-relaxed">
                                              {task.rationale}
                                            </p>
                                          )}
                                        </div>
                                        <button
                                          onClick={() => handleDelegate(task)}
                                          disabled={isDelegated || isDelegating}
                                          className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors shrink-0 self-start sm:self-center ${
                                            isDelegated
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : "bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 shadow-2xs"
                                          }`}
                                        >
                                          {isDelegated
                                            ? "Delegated"
                                            : isDelegating
                                            ? "Queuing…"
                                            : "Delegate"}
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

                {/* Right Col: Project Memory */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-600" />
                      <span>Project Memory</span>
                    </h2>
                    <span className="text-xs text-neutral-500">
                      {projectMemory.length} insights
                    </span>
                  </div>

                  {projectMemory.length === 0 ? (
                    <div className="p-8 text-center bg-white border border-neutral-200 rounded-xl space-y-2 text-xs shadow-2xs">
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
                          className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs space-y-2 hover:border-neutral-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase tracking-wider">
                              {mem.category}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                              {mem.confidence || "High"} confidence
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
        </div>
      </main>
    </div>
  );
}
