"use client";

import { Sidebar } from "@/components/Sidebar";
import { 
  Bot, Clock, Play, Pause, Settings, Eye, MousePointerClick, Search,
  BarChart3, CheckCircle2, AlertCircle, FileText, Globe, Key, Database,
  TrendingUp, Activity, Link as LinkIcon, Lightbulb, ChevronRight, X, ArrowRight,
  Sparkles, ListChecks, Calendar, ShieldCheck, Zap, Plus, Loader2, Target, Wrench, Users
} from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { DashboardHeader } from "@/components/DashboardHeader";

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

      // Trigger backend workflow
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          goal: `Audit ${currentWebsite.domain} and find high-priority SEO improvements.`,
        })
      });

      await fetchDashboardStats();
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsAgentRunning(false);
        setRunState("");
      }, 1000);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-[1600px] w-full mx-auto p-8 space-y-8">
          <DashboardHeader />

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8 shadow-sm">
              <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Connect your website to get started</h3>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                  SEO Autopilot operates autonomously against your connected website to audit technical issues, discover keywords, and publish content.
                </p>
              </div>
              <button
                onClick={openAddModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Website</span>
              </button>
            </div>
          ) : (
            <>
              {/* Agent Active / Running Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-gradient-to-r from-indigo-50/70 via-white to-neutral-50 border border-neutral-200 rounded-2xl gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 leading-tight flex items-center gap-2">
                      <span>Autonomous Agent Mode Active</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Optimizing {currentWebsite.domain}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {isAgentRunning ? runState : "Autopilot is monitoring your search presence and queuing high-impact optimizations."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleRunNow}
                    disabled={isAgentRunning}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    {isAgentRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isAgentRunning ? "Running Audit..." : "Run SEO Audit Now"}</span>
                  </button>
                  <Link
                    href="/autopilot"
                    className="bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                  >
                    Manage Schedule
                  </Link>
                </div>
              </div>

              {/* Real Database KPI Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Crawled Pages</span>
                    <Globe className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-3xl font-black text-neutral-900">{stats.crawled_pages}</div>
                  <p className="text-xs text-neutral-500">Indexed for technical audit</p>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Tracked Keywords</span>
                    <Key className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-3xl font-black text-neutral-900">{stats.tracked_keywords}</div>
                  <p className="text-xs text-neutral-500">In keyword cluster database</p>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">Technical Issues</span>
                    <Wrench className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-3xl font-black text-neutral-900">{stats.technical_issues}</div>
                  <p className="text-xs text-neutral-500">Requiring code / on-page fixes</p>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider">SERP Competitors</span>
                    <Users className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-3xl font-black text-neutral-900">{stats.tracked_competitors}</div>
                  <p className="text-xs text-neutral-500">Tracked in intelligence hub</p>
                </div>
              </div>

              {/* Chart & Approvals Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Search Performance Chart */}
                <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-neutral-900 text-base leading-tight">Search Performance</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">Organic impressions and clicks from Google Search Console.</p>
                    </div>
                    <Link href="/integrations" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                      Integrations →
                    </Link>
                  </div>

                  {chartData.length > 0 ? (
                    <div className="h-64 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                          <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "12px", fontSize: "12px" }} />
                          <Area type="monotone" dataKey="traffic" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorTraffic)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-56 bg-neutral-50 border border-neutral-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-xs space-y-2">
                      <BarChart3 className="w-8 h-8 text-neutral-400" />
                      <p className="font-semibold text-neutral-800">No Search Console Performance Data Yet</p>
                      <p className="text-neutral-500 max-w-sm">
                        Connect Google Search Console in Integrations to sync real queries, impressions, CTR, and average search positions.
                      </p>
                      <Link
                        href="/integrations"
                        className="bg-white border border-neutral-200 text-neutral-700 px-3.5 py-1.5 rounded-lg font-semibold hover:bg-neutral-100 transition-colors shadow-sm"
                      >
                        Connect Google Search Console
                      </Link>
                    </div>
                  )}
                </div>

                {/* Pending Actions Requiring Human Approval */}
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-neutral-900 text-base leading-tight flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Pending Approvals
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {recentApprovals.length}
                    </span>
                  </div>

                  {recentApprovals.length === 0 ? (
                    <div className="p-8 text-center bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <p className="text-xs font-semibold text-neutral-800">All Changes Approved</p>
                      <p className="text-[11px] text-neutral-500">
                        No pending SEO mutations currently waiting for review.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {recentApprovals.map((app) => (
                        <div
                          key={app.id}
                          onClick={() => setSelectedApproval(app)}
                          className="p-3.5 bg-neutral-50 hover:bg-indigo-50/50 border border-neutral-200 rounded-xl transition-all cursor-pointer space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-neutral-900 truncate">{app.problem}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                              {app.priority || "Medium"}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-600 line-clamp-2">
                            {app.recommended_action}
                          </p>
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

      {/* APPROVAL DETAIL MODAL */}
      {selectedApproval && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base">Proposed SEO Action</h3>
              <button onClick={() => setSelectedApproval(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs text-neutral-700">
              <p><strong>Issue:</strong> {selectedApproval.problem}</p>
              <p><strong>Evidence:</strong> {selectedApproval.evidence}</p>
              <p><strong>Recommended Action:</strong> {selectedApproval.recommended_action}</p>
              <p><strong>Expected Impact:</strong> {selectedApproval.expected_impact}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedApproval(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-xs font-semibold"
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
