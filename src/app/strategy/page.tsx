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
} from "lucide-react";
import { useState } from "react";

export default function StrategyPage() {
  const [primaryGoal, setPrimaryGoal] = useState("generate_qualified_leads");
  const [evaluating, setEvaluating] = useState(false);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);
  const [delegatedList, setDelegatedList] = useState<string[]>([]);

  const roadmapPhases = [
    {
      phase: "Phase 1: Position 5–20 Quick Wins & CTR Refreshes",
      status: "Active Strategy",
      description: "Optimize title tags and meta descriptions for high-impression pages to gain immediate organic traffic.",
      tasks: [
        {
          id: "t_1",
          agent: "On-Page SEO Agent",
          title: "Optimize Homepage Title Tag & Meta Description",
          rationale: "Page ranks position 6.2 with 18.4K impressions but 1.4% CTR. High ROI opportunity.",
          score: 93,
          relevance: 100,
          effort: "Low (15 min)",
        },
      ],
    },
    {
      phase: "Phase 2: Internal Link PageRank Transfer",
      status: "Queued",
      description: "Pass authority from high-traffic blog articles to conversion-focused pricing pages.",
      tasks: [
        {
          id: "t_2",
          agent: "Internal Linking Agent",
          title: "Inject contextual internal links to /pricing on top 12 blog posts",
          rationale: "Increases PageRank transfer to high-converting product pages.",
          score: 89,
          relevance: 95,
          effort: "Low (20 min)",
        },
      ],
    },
    {
      phase: "Phase 3: High-Value Backlink Acquisition & Digital PR",
      status: "Queued",
      description: "Acquire relevant links from industry publications using benchmark statistics.",
      tasks: [
        {
          id: "t_3",
          agent: "Backlink Agent",
          title: "Execute competitor link gap outreach for SaaS benchmark report",
          rationale: "Competitors have 34 links pointing to similar statistics pages.",
          score: 82,
          relevance: 90,
          effort: "Medium (2 hrs)",
        },
      ],
    },
  ];

  const projectMemory = [
    {
      type: "win",
      title: "Title Refresh Experiment",
      detail: "Homepage title update boosted CTR from 1.4% to 3.1%, driving +340 visitors/month.",
      tag: "Proven Win",
      tagColor: "bg-emerald-50 text-emerald-600 border-emerald-200",
    },
    {
      type: "conflict_resolution",
      title: "Conflict Resolved: Keyword Agent vs Competitor Agent",
      detail: "Rejected standalone article creation for 'project management software' due to extreme competition. Adapted strategy to target long-tail FAQ cluster instead.",
      tag: "Strategy Adapted",
      tagColor: "bg-amber-50 text-amber-600 border-amber-200",
    },
    {
      type: "aeo",
      title: "AEO & AI-Search Visibility Shift",
      detail: "Competitors detected in ChatGPT / Perplexity AI answers for 'best project management software'. Structured FAQ JSON-LD task delegated to AEO Agent.",
      tag: "AI Search Opportunity",
      tagColor: "bg-purple-50 text-purple-600 border-purple-200",
    },
  ];

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      await fetch("/api/agent/strategy/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary_goal: primaryGoal }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setEvaluating(false);
    }
  };

  const handleDelegate = async (task: any) => {
    setDelegatingId(task.id);
    try {
      await fetch("/api/agent/strategy/delegate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_agent: task.agent,
          task_title: task.title,
          rationale: task.rationale,
          priority_score: task.score,
        }),
      });
      setDelegatedList([...delegatedList, task.id]);
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
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>System Orchestrator</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Central Strategy Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Central Strategy Orchestrator
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Continuously converts SEO data, site maturity, and business goals into prioritized multi-agent tasks.
            </p>
          </div>

          <button
            onClick={handleEvaluate}
            disabled={evaluating}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2"
          >
            {evaluating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {evaluating ? "Evaluating Strategy..." : "Re-Evaluate Strategy Roadmap"}
          </button>
        </div>

        {/* Business Goal & Maturity Diagnostic Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
          {/* Business Goal Selector */}
          <div className="md:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" /> Primary Business Goal
              </h3>
              <span className="text-[10px] text-neutral-500">100 High-Intent Visitors &gt; 10K Irrelevant Visitors</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "generate_qualified_leads", label: "Generate Qualified Leads" },
                { id: "increase_organic_signups", label: "Increase Organic Signups" },
                { id: "build_topical_authority", label: "Build Topical Authority" },
                { id: "aeo_ai_search_visibility", label: "AI-Search (AEO) Visibility" },
              ].map((g) => (
                <button
                  key={g.id}
                  onClick={() => setPrimaryGoal(g.id)}
                  className={`p-3 rounded-xl text-xs text-left font-medium border transition-all ${
                    primaryGoal === g.id
                      ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg"
                      : "bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Maturity & Diagnostic Card */}
          <div className="md:col-span-5 bg-white border border-neutral-200 rounded-2xl p-6 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Website Maturity</span>
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  ESTABLISHED SAAS DOMAIN
                </span>
              </div>
              <h4 className="font-bold text-neutral-900 text-sm">Strategic Focus</h4>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Prioritizing Position 5–20 quick wins, title tag CTR refreshes, and internal link PageRank transfer.
              </p>
            </div>

            <div className="pt-3 border-t border-neutral-200 flex items-center justify-between text-xs text-neutral-500">
              <span>84 Pages Crawled</span>
              <span>18,247 Monthly Visitors</span>
            </div>
          </div>
        </div>

        {/* Multi-Phase Execution Roadmap */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 text-base flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" /> Multi-Phase Execution Roadmap
            </h3>
            <span className="text-xs text-neutral-500">Determined from live website data</span>
          </div>

          <div className="space-y-6">
            {roadmapPhases.map((phase, pIdx) => (
              <div key={pIdx} className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                      {pIdx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-neutral-900 text-sm">{phase.phase}</h4>
                      <p className="text-xs text-neutral-500">{phase.description}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                    phase.status === "Active Strategy" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-neutral-50 text-neutral-500 border-neutral-200"
                  }`}>
                    {phase.status}
                  </span>
                </div>

                {/* Tasks in Phase */}
                <div className="space-y-3 pt-2">
                  {phase.tasks.map((task) => {
                    const isDelegated = delegatedList.includes(task.id);
                    return (
                      <div key={task.id} className="bg-white p-4 rounded-xl border border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-900">{task.title}</span>
                            <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded font-medium">
                              Delegated to: {task.agent}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500">{task.rationale}</p>
                        </div>

                        <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] text-neutral-500 block uppercase font-medium">Internal Priority Score</span>
                            <span className="text-xs font-bold text-indigo-600">{task.score} / 100</span>
                          </div>

                          {isDelegated ? (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Delegated to {task.agent}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleDelegate(task)}
                              disabled={delegatingId === task.id}
                              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center gap-1.5"
                            >
                              {delegatingId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                              Delegate &amp; Execute
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategic Project Memory & Feedback Log */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-neutral-900 text-base flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-600" /> Strategic Project Memory &amp; Feedback Loop
            </h3>
            <span className="text-xs text-neutral-500">Agent learns from past experiment results</span>
          </div>

          <div className="space-y-3">
            {projectMemory.map((mem, idx) => (
              <div key={idx} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-900 text-xs">{mem.title}</h4>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-semibold ${mem.tagColor}`}>
                    {mem.tag}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">{mem.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
