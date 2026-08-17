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
  const [roadmapPhases, setRoadmapPhases] = useState<any[]>([]);
  const [projectMemory, setProjectMemory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStrategy = async () => {
    if (!currentWebsite) {
      setRoadmapPhases([]);
      setProjectMemory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/strategy?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.strategic_plans && data.strategic_plans.length > 0) {
          const latestPlan = data.strategic_plans[0];
          setRoadmapPhases(latestPlan.phases || []);
        } else {
          setRoadmapPhases([]);
        }
        setProjectMemory(data.project_memory || []);
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
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Strategy &amp; Orchestration Agent</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Autonomous Strategy Engine
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Prioritizes highest-ROI actions and delegates tasks for ${currentWebsite.domain}.`
                : "Connect your website to generate an AI strategy roadmap."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="increase_organic_traffic">Goal: Grow Organic Traffic</option>
              <option value="generate_qualified_leads">Goal: Generate High-Intent Leads</option>
              <option value="recover_lost_rankings">Goal: Recover Lost Rankings</option>
              <option value="build_domain_authority">Goal: Build Domain Authority</option>
            </select>

            <button
              onClick={handleEvaluate}
              disabled={evaluating || !currentWebsite}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
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
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Strategy agents synthesize crawl health, rankings, and competitor data to plan execution roadmaps.
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Roadmap Phases */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                Strategic Execution Roadmap
              </h2>

              {roadmapPhases.length === 0 && !loading ? (
                <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3">
                  <Compass className="w-8 h-8 text-neutral-400 mx-auto" />
                  <h3 className="text-base font-bold text-neutral-900">No Active Roadmap Generated</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    Click &ldquo;Generate Roadmap&rdquo; above to evaluate growth opportunities for {currentWebsite.domain}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {roadmapPhases.map((phase, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-neutral-900 text-sm">{phase.phase_title || phase.phase}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {phase.status || "Planned"}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600">{phase.focus_description || phase.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Col: Project Memory & Continuous Learning */}
            <div className="space-y-6">
              <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-600" />
                Project Memory &amp; Insights
              </h2>

              {projectMemory.length === 0 ? (
                <div className="p-8 text-center bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2 text-xs">
                  <Brain className="w-6 h-6 text-neutral-400 mx-auto" />
                  <p className="font-semibold text-neutral-800">No Learned Insights Yet</p>
                  <p className="text-neutral-500">
                    As agents observe experiment results and ranking shifts for {currentWebsite.domain}, strategic insights will be stored here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projectMemory.map((mem) => (
                    <div
                      key={mem.id}
                      className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase">
                          {mem.category}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {mem.confidence || "Medium"} Confidence
                        </span>
                      </div>
                      <p className="text-xs text-neutral-800 leading-relaxed">{mem.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
