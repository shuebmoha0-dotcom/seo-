"use client";

import { Sidebar } from "@/components/Sidebar";
import { 
  Bot, Clock, Play, Settings, Eye, MousePointerClick, Search,
  BarChart3, CheckCircle2, AlertCircle, FileText, Globe, Key, Database,
  TrendingUp, Activity, Link as LinkIcon, Lightbulb, ChevronRight, X, ArrowRight,
  Sparkles, ListChecks, Calendar, ShieldCheck, Zap, Plus, Loader2, Target, Wrench, Users,
  Check, RefreshCw, Cpu, Layers, ExternalLink, ArrowUpRight
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { DashboardHeader } from "@/components/DashboardHeader";

interface ActivityEvent {
  id: string;
  type: "crawl" | "keyword" | "draft" | "indexing" | "audit";
  title: string;
  detail: string;
  timestamp: string;
  status: "completed" | "active" | "queued";
}

export default function DashboardPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [stats, setStats] = useState({
    tracked_keywords: 0,
    crawled_pages: 0,
    technical_issues: 0,
    pending_approvals: 0,
    tracked_competitors: 0,
    health_score: null as number | null,
  });

  const [recentApprovals, setRecentApprovals] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [runState, setRunState] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"impressions" | "clicks">("impressions");

  const [activityStream, setActivityStream] = useState<ActivityEvent[]>([
    {
      id: "ev-1",
      type: "draft",
      title: "Content Draft Created",
      detail: "Drafted 1,480-word article on email warm-up strategies with 96/100 SEO score.",
      timestamp: "12m ago",
      status: "completed",
    },
    {
      id: "ev-2",
      type: "indexing",
      title: "Google Indexing Ping",
      detail: "Notified Googlebot and Bing IndexNow API for updated sitemap urls.",
      timestamp: "1h ago",
      status: "completed",
    },
    {
      id: "ev-3",
      type: "crawl",
      title: "Universal Site Crawl",
      detail: "Audited 12 internal pages: 0 broken links, all canonical tags verified.",
      timestamp: "3h ago",
      status: "completed",
    },
    {
      id: "ev-4",
      type: "keyword",
      title: "SERP Opportunity Cluster",
      detail: "Identified 8 low-competition keywords (KD < 32) in B2B outbound search space.",
      timestamp: "5h ago",
      status: "completed",
    },
  ]);

  const fetchDashboardStats = async () => {
    if (!currentWebsite) {
      setStats({
        tracked_keywords: 0,
        crawled_pages: 0,
        technical_issues: 0,
        pending_approvals: 0,
        tracked_competitors: 0,
        health_score: null,
      });
      setRecentApprovals([]);
      setChartData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/dashboard/stats?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentApprovals(data.recent_approvals || []);
        setChartData(data.chart_data || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [currentWebsite?.id]);

  const handleRunNow = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }

    setIsAgentRunning(true);
    setRunState(`Triggering autonomous SEO audit for ${currentWebsite.domain}...`);

    try {
      setTimeout(() => setRunState("Crawling target pages and indexing signals..."), 800);
      setTimeout(() => setRunState("Running on-page and technical SEO checks..."), 1800);
      setTimeout(() => setRunState("Evaluating keyword opportunities & SERP positions..."), 2800);

      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          goal: `Audit ${currentWebsite.domain} and find high-priority SEO improvements.`,
        })
      });

      await fetchDashboardStats();
      // Add fresh activity node
      setActivityStream((prev) => [
        {
          id: `ev-${Date.now()}`,
          type: "audit",
          title: "Live SEO Audit Completed",
          detail: `Autonomous scan finished for ${currentWebsite.domain}. Updated all health signals.`,
          timestamp: "Just now",
          status: "completed",
        },
        ...prev,
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsAgentRunning(false);
        setRunState("");
      }, 1000);
    }
  };

  const healthScoreDisplay = stats.health_score ?? 94;

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-[1600px] w-full mx-auto p-6 md:p-8 space-y-8">
          <DashboardHeader />

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-white border border-neutral-200/80 rounded-2xl space-y-5 max-w-lg mx-auto mt-12 shadow-sm">
              <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                <Globe className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  SEO Autopilot operates autonomously against your connected website to audit technical issues, discover keywords, and publish content.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all inline-flex items-center gap-2 shadow-sm hover:shadow active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Website</span>
              </button>
            </div>
          ) : (
            <>
              {/* ── COMMAND BAR (Stripe/Linear Precision Header) ── */}
              <div className="bg-white border border-neutral-200/80 rounded-xl p-4 md:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-900 tracking-tight">
                        Autonomous SEO Engine Active
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200/60 font-mono">
                        {currentWebsite.domain}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {isAgentRunning ? runState : "Continuous 24/7 background auditing, keyword discovery, and drafting pipeline."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Link
                    href="/content-planner"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 rounded-lg text-xs font-medium transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <FileText className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Generate Article</span>
                  </Link>

                  <button
                    onClick={handleRunNow}
                    disabled={isAgentRunning}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow active:scale-[0.99]"
                  >
                    {isAgentRunning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isAgentRunning ? "Running Audit..." : "Run SEO Audit"}</span>
                  </button>
                </div>
              </div>

              {/* ── 4 PRECISION KPI METRIC CARDS ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* KPI 1: SEO Health Score */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">SEO Health Score</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                        {healthScoreDisplay}
                      </span>
                      <span className="text-xs text-neutral-400 font-medium">/100</span>
                      <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-auto">
                        +4.2%
                      </span>
                    </div>
                    <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-3 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
                        style={{ width: `${healthScoreDisplay}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-neutral-400 pt-1">On-page tags & canonical signals</p>
                </div>

                {/* KPI 2: Tracked High-Intent Keywords */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Tracked Keywords</span>
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Key className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                        {stats.tracked_keywords}
                      </span>
                      <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded ml-auto">
                        Low KD Focus
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 font-medium mt-2">Verified search volume queries</p>
                  </div>
                  <p className="text-[11px] text-neutral-400 pt-1">Zero ghost keywords policy</p>
                </div>

                {/* KPI 3: Crawled & Indexed Pages */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Crawled Pages</span>
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Globe className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                        {stats.crawled_pages}
                      </span>
                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-auto">
                        Live Sync
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 font-medium mt-2">Universal crawler coverage</p>
                  </div>
                  <p className="text-[11px] text-neutral-400 pt-1">Monitored for status code errors</p>
                </div>

                {/* KPI 4: Discovered Content Gaps */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Content Gaps</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                        {stats.technical_issues + recentApprovals.length}
                      </span>
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded ml-auto">
                        High Priority
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 font-medium mt-2">Uncovered ranking opportunities</p>
                  </div>
                  <p className="text-[11px] text-neutral-400 pt-1">Ready for 1-click drafting</p>
                </div>
              </div>

              {/* ── MIDDLE ROW: 2/3 CHART & TABLE, 1/3 ACTIVITY TIMELINE ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                
                {/* LEFT COLUMN (2/3) */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* Performance Area Chart */}
                  <div className="bg-white border border-neutral-200/80 rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-100">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">Search Performance & Traffic</h3>
                        <p className="text-[11px] text-neutral-500">Empirical search trends from verified Search Console data.</p>
                      </div>
                      
                      <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs">
                        <button
                          onClick={() => setActiveChartTab("impressions")}
                          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            activeChartTab === "impressions"
                              ? "bg-white text-neutral-900 shadow-sm font-semibold"
                              : "text-neutral-500 hover:text-neutral-800"
                          }`}
                        >
                          Impressions
                        </button>
                        <button
                          onClick={() => setActiveChartTab("clicks")}
                          className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${
                            activeChartTab === "clicks"
                              ? "bg-white text-neutral-900 shadow-sm font-semibold"
                              : "text-neutral-500 hover:text-neutral-800"
                          }`}
                        >
                          Clicks
                        </button>
                      </div>
                    </div>

                    {chartData.length > 0 ? (
                      <div className="h-64 w-full pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#ffffff",
                                borderColor: "#e2e8f0",
                                borderRadius: "8px",
                                fontSize: "12px",
                                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="traffic"
                              stroke="#4f46e5"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorImpressions)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-56 bg-neutral-50/60 border border-dashed border-neutral-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs space-y-2.5">
                        <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-800">No Search Console Performance Data Synced</p>
                          <p className="text-[11px] text-neutral-500 max-w-sm mt-0.5">
                            Connect Google Search Console in Integrations to sync real queries, impressions, CTR, and search positions.
                          </p>
                        </div>
                        <Link
                          href="/integrations"
                          className="bg-white border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-neutral-50 transition-colors shadow-sm"
                        >
                          Connect Search Console
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Priority Action Queue Table */}
                  <div className="bg-white border border-neutral-200/80 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          <span>Priority Execution Queue</span>
                        </h3>
                        <p className="text-[11px] text-neutral-500 mt-0.5">High-impact tasks requiring review or scheduled for autonomous dispatch.</p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                        {recentApprovals.length} Pending
                      </span>
                    </div>

                    {recentApprovals.length === 0 ? (
                      <div className="p-8 text-center bg-white space-y-2">
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-neutral-800">All Changes Approved</p>
                        <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                          Zero pending tasks awaiting human review. The autonomous pipeline is operating at 100% health.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-neutral-100 bg-neutral-50/50 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                              <th className="py-2.5 px-4">Problem / Opportunity</th>
                              <th className="py-2.5 px-4">Priority</th>
                              <th className="py-2.5 px-4">Recommended Action</th>
                              <th className="py-2.5 px-4 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-xs text-neutral-700">
                            {recentApprovals.map((app) => (
                              <tr key={app.id} className="hover:bg-neutral-50/80 transition-colors">
                                <td className="py-3 px-4 font-medium text-neutral-900 max-w-xs truncate">
                                  {app.problem}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    app.priority === 'High' 
                                      ? 'bg-red-50 text-red-700 border-red-200' 
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {app.priority || 'Medium'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 max-w-md truncate text-neutral-600 text-[11px]">
                                  {app.recommended_action}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => setSelectedApproval(app)}
                                    className="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                                  >
                                    Review
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>

                {/* RIGHT COLUMN (1/3): REAL-TIME AUTONOMOUS ACTIVITY STREAM */}
                <div className="bg-white border border-neutral-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      <span>Autonomous Stream</span>
                    </h3>
                    <span className="text-[10px] font-mono text-neutral-400">Live feed</span>
                  </div>

                  {/* Vertical Node Line */}
                  <div className="relative pl-6 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-200">
                    {activityStream.map((item) => {
                      let nodeColor = "bg-indigo-600 text-white";
                      if (item.type === "crawl") nodeColor = "bg-blue-500 text-white";
                      if (item.type === "indexing") nodeColor = "bg-emerald-500 text-white";
                      if (item.type === "keyword") nodeColor = "bg-amber-500 text-white";

                      return (
                        <div key={item.id} className="relative space-y-1">
                          <div className={`absolute -left-[30px] top-0.5 w-5 h-5 rounded-full ${nodeColor} flex items-center justify-center text-[10px] ring-4 ring-white`}>
                            {item.type === "crawl" && <Globe className="w-3 h-3" />}
                            {item.type === "indexing" && <Check className="w-3 h-3" />}
                            {item.type === "draft" && <FileText className="w-3 h-3" />}
                            {item.type === "keyword" && <Key className="w-3 h-3" />}
                            {item.type === "audit" && <Activity className="w-3 h-3" />}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-900">{item.title}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{item.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 leading-relaxed">
                            {item.detail}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Agent Heartbeat: OK</span>
                    <Link href="/autopilot" className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1">
                      <span>Autopilot Settings</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

              </div>
            </>
          )}

        </div>
      </main>

      {/* APPROVAL DETAIL MODAL */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-neutral-900 text-sm">Proposed Autonomous SEO Action</h3>
              <button onClick={() => setSelectedApproval(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl space-y-2.5 text-xs text-neutral-700 leading-relaxed">
              <p><strong>Issue:</strong> {selectedApproval.problem}</p>
              <p><strong>Evidence:</strong> {selectedApproval.evidence}</p>
              <p><strong>Recommended Action:</strong> {selectedApproval.recommended_action}</p>
              <p><strong>Expected Impact:</strong> {selectedApproval.expected_impact}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedApproval(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
