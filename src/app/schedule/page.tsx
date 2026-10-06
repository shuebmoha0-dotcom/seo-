"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Clock, Play, Pause, RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert,
  Calendar, Globe, Search, BarChart2, TrendingUp, Cpu, Info, ChevronRight,
  DollarSign, Sparkles, Sliders, CheckSquare, Layers, Eye, ArrowRight,
  FileText, Shield, Zap, XCircle, Plus, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

type Tab = "intelligence" | "history" | "pipeline" | "settings";
type ScheduleStatus = "active" | "paused";

interface RunItem {
  id: string;
  date: string;
  time: string;
  trigger_type: string;
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

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  waiting_approval: { label: "Waiting Approval", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  completed:        { label: "Completed",        color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  no_action_needed: { label: "No Action Needed", color: "bg-neutral-100 text-neutral-600 border-neutral-200", icon: Info },
  failed:           { label: "Failed",           color: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  budget_exceeded:  { label: "Budget Exceeded",  color: "bg-orange-50 text-orange-700 border-orange-200", icon: ShieldAlert },
};

export default function SchedulePage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [status, setStatus] = useState<ScheduleStatus>("active");
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [config, setConfig] = useState({
    frequency: "daily",
    schedule_time: "09:00",
    timezone: "America/New_York",
    daily_budget_usd: 10.0,
    monthly_budget_usd: 100.0,
    current_daily_spend: 0,
    current_monthly_spend: 0,
  });

  const fetchScheduleData = async () => {
    if (!currentWebsite) {
      setRuns([]);
      return;
    }

    try {
      setLoading(true);
      const [configRes, historyRes] = await Promise.all([
        fetch(`/api/agent/schedule/config?website_id=${currentWebsite.id}`),
        fetch(`/api/agent/schedule/history?website_id=${currentWebsite.id}`),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.config) {
          setConfig((prev) => ({
            ...prev,
            frequency: configData.config.frequency || "daily",
            schedule_time: configData.config.schedule_time || "09:00",
            timezone: configData.config.timezone || "America/New_York",
            daily_budget_usd: configData.config.daily_budget_usd || 10.0,
            monthly_budget_usd: configData.config.monthly_budget_usd || 100.0,
          }));
          setStatus(configData.config.status === "paused" ? "paused" : "active");
        }
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json();
        const mappedRuns: RunItem[] = (historyData.runs || []).map((r: any) => {
          const startTime = r.start_time ? new Date(r.start_time) : new Date();
          return {
            id: r.id,
            date: startTime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            time: startTime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
            trigger_type: r.trigger_type || "schedule",
            status: r.status || "completed",
            duration: `${r.duration_seconds || 0}s`,
            pages_analyzed: r.pages_analyzed || 0,
            queries_checked: r.queries_checked || 0,
            ranking_changes: r.ranking_changes_detected || 0,
            opportunities_found: r.opportunities_found || 0,
            actions_prepared: r.actions_prepared || 0,
            actions_approved: r.actions_approved || 0,
            actions_executed: r.actions_executed || 0,
            actions_verified: r.actions_verified || 0,
            cost: `$${(r.estimated_cost_usd || 0).toFixed(3)}`,
            summary: r.summary || "Background SEO execution run completed.",
          };
        });
        setRuns(mappedRuns);
      }
    } catch (err) {
      console.error("Error fetching schedule data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [currentWebsite?.id]);

  const handleRunNow = async () => {
    if (!currentWebsite) return;
    setRunningNow(true);
    try {
      const res = await fetch("/api/agent/schedule/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          trigger_type: "manual_run_now",
        }),
      });
      if (res.ok) {
        await fetchScheduleData();
      }
    } catch (err) {
      console.error("Failed to run schedule on demand:", err);
    } finally {
      setRunningNow(false);
      setActiveTab("history");
    }
  };

  const togglePauseResume = async () => {
    if (!currentWebsite) return;
    const newStatus: ScheduleStatus = status === "active" ? "paused" : "active";
    setStatus(newStatus);
    try {
      await fetch("/api/agent/schedule/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          status: newStatus,
          frequency: config.frequency,
          schedule_time: config.schedule_time,
          timezone: config.timezone,
          daily_budget_usd: config.daily_budget_usd,
          monthly_budget_usd: config.monthly_budget_usd,
        }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentWebsite) return;
    setSavingSettings(true);
    try {
      await fetch("/api/agent/schedule/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          status,
          frequency: config.frequency,
          schedule_time: config.schedule_time,
          timezone: config.timezone,
          daily_budget_usd: config.daily_budget_usd,
          monthly_budget_usd: config.monthly_budget_usd,
        }),
      });
    } catch (err) {
      console.error("Failed to save schedule settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span className="font-medium text-neutral-400">Autonomous Operations</span>
              <span className="text-neutral-300">/</span>
              <span className="font-semibold text-neutral-700">Scheduled Agent Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                Scheduled Autonomous Agent
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Clock className="w-3 h-3 text-indigo-600" />
                Background Engine
              </span>
            </div>
            <p className="text-neutral-500 text-xs mt-1">
              {currentWebsite
                ? `Runs continuous background checks for ${currentWebsite.domain}, prioritizing opportunities and preparing actions.`
                : "Connect your website to configure autonomous background execution schedules."}
            </p>
          </div>

          {currentWebsite && (
            <div className="flex items-center gap-2.5 self-start md:self-auto">
              <button
                onClick={togglePauseResume}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-1.5 transition-all shadow-2xs ${
                  status === "active"
                    ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                {status === "active" ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause Schedule</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume Schedule</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRunNow}
                disabled={runningNow}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-xs active:scale-[0.98]"
              >
                {runningNow ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running Cycle...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Immediate Cycle</span>
                  </>
                )}
              </button>
            </div>
          )}
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
                Background execution agents require a verified website domain to coordinate daily audits and content cycles.
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
          <div className="space-y-6">
            {/* Status Strip */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${status === "active" ? "bg-emerald-500" : "bg-neutral-400"}`} />
                <span className="font-semibold text-neutral-800">
                  {status === "active" ? "Continuous Engine Active (Daily Schedule)" : "Agent Schedule Paused"}
                </span>
                <span className="text-neutral-400">·</span>
                <span className="text-neutral-500">Scheduled: {config.frequency} at {config.schedule_time} ({config.timezone})</span>
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-md">
                Next run: {status === "active" ? `Daily at ${config.schedule_time}` : "Paused"}
              </span>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "history", label: `Execution History (${runs.length})`, icon: Clock },
                { id: "intelligence", label: "Cycle Overview", icon: TrendingUp },
                { id: "pipeline", label: "Multi-Phase Pipeline", icon: Layers },
                { id: "settings", label: "Schedule & Budget Controls", icon: Sliders },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as Tab)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                    activeTab === id
                      ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/60"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* ── TAB 1: RUN HISTORY ── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-900 text-sm">Background Execution Log</h3>
                    <span className="text-xs text-neutral-500 font-mono">
                      {runs.length} Recorded Cycles
                    </span>
                  </div>

                  {runs.length === 0 ? (
                    <div className="p-12 text-center text-xs text-neutral-500 space-y-2">
                      <Clock className="w-6 h-6 text-neutral-400 mx-auto" />
                      <p className="font-semibold text-neutral-800">No Scheduled Runs Recorded Yet</p>
                      <p className="text-[11px] text-neutral-400">
                        Click &ldquo;Run Immediate Cycle&rdquo; above to execute the first scheduled assessment.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-neutral-100">
                      {runs.map((run) => {
                        const st = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.completed;
                        const StatusIcon = st.icon;
                        return (
                          <div key={run.id} className="p-4 hover:bg-neutral-50 transition-colors space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-neutral-900 text-xs font-mono">
                                    {run.date} · {run.time}
                                  </span>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${st.color}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    <span>{st.label}</span>
                                  </span>
                                  <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded capitalize">
                                    {run.trigger_type.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-700 leading-relaxed">{run.summary}</p>
                              </div>
                              <div className="text-right shrink-0 text-xs font-mono">
                                <span className="font-semibold text-neutral-700 block">{run.cost}</span>
                                <span className="text-neutral-400 text-[10px]">Duration: {run.duration}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-500 border-t border-neutral-100">
                              <span>{run.pages_analyzed} pages crawled</span>
                              <span>·</span>
                              <span>{run.queries_checked} queries checked</span>
                              <span>·</span>
                              <span>{run.ranking_changes} rank shifts</span>
                              <span>·</span>
                              <span className="font-semibold text-indigo-600">{run.actions_prepared} action(s) prepared</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: CYCLE OVERVIEW ── */}
            {activeTab === "intelligence" && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                  <p className="leading-relaxed">
                    Continuous monitoring compares today&apos;s live signals against the previous snapshot for {currentWebsite.domain}.
                    Action cards are surfaced strictly when actionable ROI thresholds are met.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4 text-indigo-600" />
                        <span>Website Architecture</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">Daily Crawl</span>
                    </div>
                    <div className="space-y-2 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span>Monitoring Scope:</span>
                        <strong className="text-neutral-900 font-mono">Active Domain</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Crawl Frequency:</span>
                        <strong className="text-neutral-900 font-mono">24 Hours</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Broken Link Defense:</span>
                        <strong className="text-emerald-700 font-semibold">Enabled</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                        <Search className="w-4 h-4 text-emerald-600" />
                        <span>SERP Positions</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">Search Console</span>
                    </div>
                    <div className="space-y-2 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span>Striking-Distance Scans:</span>
                        <strong className="text-indigo-600 font-semibold">Automated</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Rank Drop Forensics:</span>
                        <strong className="text-emerald-700 font-semibold">Active</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>CTR Optimization:</span>
                        <strong className="text-neutral-900 font-mono">Continuous</strong>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Market Rivals</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">SERP Intelligence</span>
                    </div>
                    <div className="space-y-2 text-xs text-neutral-600">
                      <div className="flex justify-between">
                        <span>Content Gaps:</span>
                        <strong className="text-neutral-900 font-mono">Tracked</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Backlink Spy:</span>
                        <strong className="text-emerald-700 font-semibold">Verified</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>SERP Radar:</span>
                        <strong className="text-purple-700 font-semibold">Operational</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 3: PIPELINE ── */}
            {activeTab === "pipeline" && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                  <p className="leading-relaxed">
                    Multi-phase workflows span across consecutive agent runs. State is persisted reliably in the database and project memory records between execution cycles.
                  </p>
                </div>

                <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 shadow-xs">
                  <h3 className="font-bold text-neutral-900 text-sm">Execution Protocol Pipeline</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { step: "Phase 1", title: "Crawl & Telemetry", status: "completed", desc: "Verifies page health and extracts live DOM metadata" },
                      { step: "Phase 2", title: "Gap Analysis", status: "completed", desc: "Identifies striking-distance jumps and competitor overlap" },
                      { step: "Phase 3", title: "Action Synthesis", status: "completed", desc: "Prepares optimized titles, descriptions, and internal links" },
                      { step: "Phase 4", title: "Human Review", status: "current", desc: "Queues draft cards for human approval before CMS execution" },
                    ].map((s, i) => (
                      <div key={i} className={`p-4 rounded-lg border text-xs space-y-1.5 ${
                        s.status === "completed"
                          ? "bg-emerald-50/60 border-emerald-200"
                          : "bg-indigo-50/60 border-indigo-200"
                      }`}>
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                          <span className={s.status === "completed" ? "text-emerald-700" : "text-indigo-700"}>
                            {s.step}
                          </span>
                          {s.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                        </div>
                        <p className="font-semibold text-neutral-900 text-xs">{s.title}</p>
                        <p className="text-[11px] text-neutral-600 leading-relaxed">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 4: SETTINGS & BUDGET CONTROLS ── */}
            {activeTab === "settings" && (
              <div className="space-y-4">
                <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-5 shadow-xs">
                  <h3 className="font-bold text-neutral-900 text-sm">Schedule Cadence &amp; Execution Time</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">
                        Execution Frequency
                      </label>
                      <select
                        value={config.frequency}
                        onChange={(e) => setConfig((c) => ({ ...c, frequency: e.target.value }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="daily">Daily (Every 24 hours)</option>
                        <option value="every_12_hours">Every 12 Hours</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">
                        Scheduled Time
                      </label>
                      <input
                        type="time"
                        value={config.schedule_time}
                        onChange={(e) => setConfig((c) => ({ ...c, schedule_time: e.target.value }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">
                        Timezone
                      </label>
                      <select
                        value={config.timezone}
                        onChange={(e) => setConfig((c) => ({ ...c, timezone: e.target.value }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="America/New_York">Eastern Time (US &amp; Canada)</option>
                        <option value="America/Los_Angeles">Pacific Time (US &amp; Canada)</option>
                        <option value="Europe/London">London (GMT/BST)</option>
                        <option value="Europe/Berlin">Berlin (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4 shadow-xs">
                  <h3 className="font-bold text-neutral-900 text-sm">Budget Hard Caps &amp; Safety Controls</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                        Daily Spend Cap ($ USD)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={config.daily_budget_usd}
                        onChange={(e) => setConfig((c) => ({ ...c, daily_budget_usd: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                        Monthly Spend Cap ($ USD)
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={config.monthly_budget_usd}
                        onChange={(e) => setConfig((c) => ({ ...c, monthly_budget_usd: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all shadow-xs flex items-center gap-1.5"
                    >
                      {savingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sliders className="w-3.5 h-3.5" />}
                      <span>{savingSettings ? "Saving..." : "Save Schedule Settings"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
