"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Clock, Play, Pause, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert,
  Calendar, Globe, Search, BarChart2, TrendingUp, Cpu, Info, ChevronRight,
  DollarSign, Sparkles, Sliders, CheckSquare, Layers, Eye, ArrowRight,
  FileText, Shield, Zap, XCircle
} from "lucide-react";
import { useState } from "react";

type Tab = "intelligence" | "history" | "settings" | "pipeline";
type ScheduleStatus = "active" | "paused";

interface RunItem {
  id: string;
  date: string;
  time: string;
  trigger_type: "schedule" | "manual_run_now";
  status: "completed" | "no_action_needed" | "waiting_approval" | "failed" | "budget_exceeded";
  duration: string;
  pages_analyzed: number;
  queries_checked: number;
  ranking_changes: number;
  opportunities_found: number;
  actions_prepared: number;
  actions_approved: number;
  actions_executed: number;
  actions_verified: number;
  cost: string;
  summary: string;
}

const DEMO_RUNS: RunItem[] = [
  {
    id: "run-101",
    date: "Aug 12, 2026",
    time: "09:00 AM",
    trigger_type: "schedule",
    status: "waiting_approval",
    duration: "42s",
    pages_analyzed: 84,
    queries_checked: 2400,
    ranking_changes: 6,
    opportunities_found: 4,
    actions_prepared: 2,
    actions_approved: 0,
    actions_executed: 0,
    actions_verified: 0,
    cost: "$0.045",
    summary: "Crawled 84 pages & checked 2,400 queries. Detected 6 ranking shifts. Prepared 2 high-impact content actions. Waiting for human approval.",
  },
  {
    id: "run-100",
    date: "Aug 11, 2026",
    time: "09:00 AM",
    trigger_type: "schedule",
    status: "completed",
    duration: "38s",
    pages_analyzed: 84,
    queries_checked: 2380,
    ranking_changes: 2,
    opportunities_found: 1,
    actions_prepared: 1,
    actions_approved: 1,
    actions_executed: 1,
    actions_verified: 1,
    cost: "$0.038",
    summary: "Executed approved homepage title refresh. Verified live deployment (+1.4% → 3.1% CTR improvement).",
  },
  {
    id: "run-99",
    date: "Aug 10, 2026",
    time: "09:00 AM",
    trigger_type: "schedule",
    status: "no_action_needed",
    duration: "18s",
    pages_analyzed: 82,
    queries_checked: 2350,
    ranking_changes: 0,
    opportunities_found: 0,
    actions_prepared: 0,
    actions_approved: 0,
    actions_executed: 0,
    actions_verified: 0,
    cost: "$0.012",
    summary: "Daily SEO check complete. No high-impact action recommended today. (No-Busywork Rule enforced).",
  },
  {
    id: "run-98",
    date: "Aug 9, 2026",
    time: "09:00 AM",
    trigger_type: "schedule",
    status: "completed",
    duration: "55s",
    pages_analyzed: 80,
    queries_checked: 2300,
    ranking_changes: 8,
    opportunities_found: 3,
    actions_prepared: 2,
    actions_approved: 2,
    actions_executed: 2,
    actions_verified: 2,
    cost: "$0.052",
    summary: "Fixed broken internal link on /api/legacy & published blog post on AI SEO agents.",
  },
];

const DEMO_INTELLIGENCE = {
  website: { new_pages: 1, deleted_pages: 0, technical_issues: 2 },
  seo: { ranking_shifts: 6, new_queries: 14, ctr_changes: "+0.4%", impression_changes: "+1,240/day" },
  competitors: { new_competitor_content: 2, rank_threats: 1 },
  backlinks: { new_backlinks: 3, lost_backlinks: 0 },
  aeo: { ai_citations_detected: 4 },
};

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  waiting_approval: { label: "Waiting Approval ⏳", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  completed:        { label: "Completed ✓",          color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  no_action_needed: { label: "No Action Needed",     color: "bg-neutral-100 text-neutral-600 border-neutral-200", icon: Info },
  failed:           { label: "Failed ✗",             color: "bg-red-50 text-red-700 border-red-200", icon: XCircle },
  budget_exceeded:  { label: "Budget Exceeded",      color: "bg-orange-50 text-orange-700 border-orange-200", icon: ShieldAlert },
};

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<Tab>("intelligence");
  const [status, setStatus] = useState<ScheduleStatus>("active");
  const [runs, setRuns] = useState<RunItem[]>(DEMO_RUNS);
  const [runningNow, setRunningNow] = useState(false);
  const [config, setConfig] = useState({
    frequency: "daily",
    schedule_time: "09:00",
    timezone: "America/New_York",
    daily_budget_usd: 10.0,
    monthly_budget_usd: 100.0,
    current_daily_spend: 1.45,
    current_monthly_spend: 18.20,
    notify_run: true,
    notify_opp: true,
    notify_approval: true,
  });

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      const res = await fetch("/api/agent/schedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: "demo-site", trigger_type: "manual_run_now" }),
      });
      const data = await res.json();
      if (data.run) {
        const newRunItem: RunItem = {
          id: data.run.id,
          date: "Just now",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          trigger_type: "manual_run_now",
          status: data.run.status,
          duration: `${data.run.duration_seconds}s`,
          pages_analyzed: data.run.pages_analyzed,
          queries_checked: data.run.queries_checked,
          ranking_changes: data.run.ranking_changes_detected,
          opportunities_found: data.run.opportunities_found,
          actions_prepared: data.run.actions_prepared,
          actions_approved: 0,
          actions_executed: 0,
          actions_verified: 0,
          cost: `$${data.run.estimated_cost_usd.toFixed(3)}`,
          summary: data.run.summary,
        };
        setRuns(prev => [newRunItem, ...prev]);
      }
    } catch {
      // Fallback update
    } finally {
      setRunningNow(false);
      setActiveTab("history");
    }
  };

  const togglePauseResume = () => {
    setStatus(prev => (prev === "active" ? "paused" : "active"));
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <span>Automation</span><span className="text-neutral-300">/</span>
            <span className="text-neutral-700 font-medium">Scheduled Autonomous Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Clock className="w-6 h-6 text-indigo-500" /> Scheduled Autonomous Agent
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                Runs background daily checks for active projects. Observes changes, prioritizes opportunities, and requests approval.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePauseResume}
                className={`text-xs font-bold px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-colors ${
                  status === "active"
                    ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {status === "active" ? <><Pause className="w-3.5 h-3.5" /> Pause Schedule</> : <><Play className="w-3.5 h-3.5" /> Resume Schedule</>}
              </button>

              <button
                onClick={handleRunNow}
                disabled={runningNow}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-sm"
              >
                {runningNow ? <><Loader2Icon /> Running Now…</> : <><Play className="w-3.5 h-3.5" /> Run Now</>}
              </button>
            </div>
          </div>

          {/* Status banner */}
          <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl mb-4 text-xs">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${status === "active" ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
              <span className="font-semibold text-neutral-800">
                {status === "active" ? "Agent Active 24/7 (Daily Schedule)" : "Agent Schedule Paused"}
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-500">Default schedule: Daily at {config.schedule_time} ({config.timezone})</span>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
              Next run: Tomorrow at 09:00 AM
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {[
              ["intelligence", "Daily Intelligence", TrendingUp],
              ["history", `Run History (${runs.length})`, Clock],
              ["pipeline", "Multi-Phase Pipeline", Layers],
              ["settings", "Schedule & Budget", Sliders],
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

        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* ── DAILY INTELLIGENCE TAB ── */}
          {activeTab === "intelligence" && (
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Every daily run compares today's live signals against yesterday's state. It identifies what changed across website, rankings, competitors, backlinks, and AI search visibility.</span>
              </div>

              {/* Grid of changes */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-500" /> Website State
                    </span>
                    <span className="text-[10px] text-neutral-400">Daily Crawl</span>
                  </div>
                  <div className="space-y-2 text-xs text-neutral-600">
                    <div className="flex justify-between"><span>New Pages:</span> <span className="font-bold text-neutral-900">+{DEMO_INTELLIGENCE.website.new_pages}</span></div>
                    <div className="flex justify-between"><span>Technical Alerts:</span> <span className="font-bold text-amber-600">{DEMO_INTELLIGENCE.website.technical_issues} issues</span></div>
                    <div className="flex justify-between"><span>Broken Links:</span> <span className="font-bold text-emerald-600">0 new</span></div>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                      <Search className="w-4 h-4 text-emerald-500" /> SEO Signals
                    </span>
                    <span className="text-[10px] text-neutral-400">Search Console</span>
                  </div>
                  <div className="space-y-2 text-xs text-neutral-600">
                    <div className="flex justify-between"><span>Ranking Shifts:</span> <span className="font-bold text-indigo-600">{DEMO_INTELLIGENCE.seo.ranking_shifts} queries</span></div>
                    <div className="flex justify-between"><span>New Queries:</span> <span className="font-bold text-emerald-600">+{DEMO_INTELLIGENCE.seo.new_queries}</span></div>
                    <div className="flex justify-between"><span>Avg CTR Shift:</span> <span className="font-bold text-emerald-600">{DEMO_INTELLIGENCE.seo.ctr_changes}</span></div>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" /> AI & Competitors
                    </span>
                    <span className="text-[10px] text-neutral-400">SERP & AEO</span>
                  </div>
                  <div className="space-y-2 text-xs text-neutral-600">
                    <div className="flex justify-between"><span>Competitor New Posts:</span> <span className="font-bold text-neutral-900">{DEMO_INTELLIGENCE.competitors.new_competitor_content}</span></div>
                    <div className="flex justify-between"><span>New Backlinks:</span> <span className="font-bold text-emerald-600">+{DEMO_INTELLIGENCE.backlinks.new_backlinks}</span></div>
                    <div className="flex justify-between"><span>AI Citations:</span> <span className="font-bold text-purple-600">{DEMO_INTELLIGENCE.aeo.ai_citations_detected} active</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── RUN HISTORY TAB ── */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
                  <h3 className="font-semibold text-neutral-900 text-sm">Scheduled Agent Run History</h3>
                  <span className="text-xs text-neutral-400">Showing last {runs.length} runs</span>
                </div>

                <div className="divide-y divide-neutral-100">
                  {runs.map(run => {
                    const st = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.completed;
                    const StatusIcon = st.icon;
                    return (
                      <div key={run.id} className="p-5 hover:bg-neutral-50 transition-colors">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-bold text-neutral-900 text-sm">{run.date} · {run.time}</span>
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${st.color}`}>
                                <StatusIcon className="w-3 h-3" /> {st.label}
                              </span>
                              <span className="text-[10px] text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-md capitalize">
                                {run.trigger_type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-700 leading-relaxed">{run.summary}</p>
                          </div>
                          <div className="text-right shrink-0 text-xs">
                            <span className="font-mono text-neutral-500 block">{run.cost}</span>
                            <span className="text-neutral-400 text-[10px]">Duration: {run.duration}</span>
                          </div>
                        </div>

                        {/* Metric pills */}
                        <div className="flex items-center gap-3 pt-2 text-[11px] text-neutral-500">
                          <span>🔍 {run.pages_analyzed} pages crawled</span>
                          <span>·</span>
                          <span>📊 {run.queries_checked} queries checked</span>
                          <span>·</span>
                          <span>📈 {run.ranking_changes} rank shifts</span>
                          <span>·</span>
                          <span>💡 {run.opportunities_found} opportunities</span>
                          <span>·</span>
                          <span className="font-semibold text-indigo-600">✍️ {run.actions_prepared} action(s) prepared</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── MULTI-PHASE PIPELINE TAB ── */}
          {activeTab === "pipeline" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Multi-phase workflows span across consecutive daily agent runs. State is persisted in Project Memory and database records between runs.</span>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6">
                <h3 className="font-bold text-neutral-900 text-sm">Active Content Pipeline Workflow</h3>

                <div className="grid grid-cols-4 gap-3 relative">
                  {[
                    { step: "Day 1", title: "Keyword Research", status: "completed", desc: "Found 'AI SEO Agent for SaaS' opportunity" },
                    { step: "Day 1", title: "Content Brief", status: "completed", desc: "Brief & outline generated" },
                    { step: "Day 2", title: "Draft & Images", status: "completed", desc: "Drafted 1,800w + 2 diagrams planned" },
                    { step: "Day 2", title: "Human Approval", status: "current", desc: "Waiting for user review on /on-page-seo" },
                  ].map((s, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${
                      s.status === "completed" ? "bg-emerald-50 border-emerald-200"
                        : s.status === "current" ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/20"
                          : "bg-neutral-50 border-neutral-200"
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                        <span className={s.status === "completed" ? "text-emerald-700" : s.status === "current" ? "text-amber-700" : "text-neutral-400"}>
                          {s.step}
                        </span>
                        {s.status === "completed" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {s.status === "current" && <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />}
                      </div>
                      <p className="font-semibold text-neutral-900 text-xs">{s.title}</p>
                      <p className="text-[11px] text-neutral-500 mt-1">{s.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
                <h3 className="font-bold text-neutral-900 text-sm">Schedule Configuration</h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">Frequency</label>
                    <select value={config.frequency} onChange={e => setConfig(c => ({ ...c, frequency: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none">
                      <option value="daily">Daily (Default - Every 24 hours)</option>
                      <option value="every_12_hours">Every 12 Hours</option>
                      <option value="weekly">Weekly (Every Monday)</option>
                      <option value="custom">Custom Cron Expression</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">Schedule Time</label>
                    <input type="time" value={config.schedule_time} onChange={e => setConfig(c => ({ ...c, schedule_time: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">Timezone</label>
                    <select value={config.timezone} onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none">
                      <option value="America/New_York">Eastern Time (US & Canada)</option>
                      <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Berlin (CET)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* API Budget Limits */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-neutral-900 text-sm">Cost Controls & API Budgets</h3>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Daily API Spend Limit ($)</label>
                    <input type="number" value={config.daily_budget_usd} onChange={e => setConfig(c => ({ ...c, daily_budget_usd: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Monthly API Spend Limit ($)</label>
                    <input type="number" value={config.monthly_budget_usd} onChange={e => setConfig(c => ({ ...c, monthly_budget_usd: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none" />
                  </div>
                </div>

                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-600">
                  Current daily spend: <strong>${config.current_daily_spend.toFixed(2)}</strong> / ${config.daily_budget_usd.toFixed(2)} limit. If budget is reached, background agent stops non-critical work safely.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function Loader2Icon() {
  return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
}
