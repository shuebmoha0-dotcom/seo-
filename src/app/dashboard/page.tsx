"use client";

import { Sidebar } from "@/components/Sidebar";
import { Play, FileText, Globe, Key, Activity, Plus, Loader2, Check, ArrowUpRight, X } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { DashboardHeader } from "@/components/DashboardHeader";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityEvent {
  id: string;
  type: "crawl" | "keyword" | "draft" | "indexing" | "audit";
  title: string;
  detail: string;
  timestamp: string;
  status: "completed" | "active" | "queued";
}

export default function DashboardPage() {
  const { currentWebsite, openAddModal, loading: websiteLoading } = useWebsite();

  const [stats, setStats] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_dashboard_stats_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return {
      tracked_keywords: 0,
      crawled_pages: 0,
      technical_issues: 0,
      pending_approvals: 0,
      tracked_competitors: 0,
      health_score: null as number | null,
    };
  });

  const [recentApprovals, setRecentApprovals] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_dashboard_approvals_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });

  const [chartData, setChartData] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_dashboard_chart_${storedSiteId}`);
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
          const cached = sessionStorage.getItem(`seo_dashboard_stats_${storedSiteId}`);
          if (cached) return false;
        }
      } catch {}
    }
    return true;
  });

  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [runState, setRunState] = useState("");
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<"impressions" | "clicks">("impressions");

  const [activityStream, setActivityStream] = useState<ActivityEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedSiteId = localStorage.getItem("seo_active_website_id");
        if (storedSiteId) {
          const cached = sessionStorage.getItem(`seo_dashboard_activity_${storedSiteId}`);
          if (cached) return JSON.parse(cached);
        }
      } catch {}
    }
    return [];
  });

  const fetchDashboardStats = async () => {
    if (!currentWebsite) {
      if (!websiteLoading) {
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
        setActivityStream([]);
        setLoading(false);
      }
      return;
    }

    try {
      if (!stats.tracked_keywords && chartData.length === 0) {
        setLoading(true);
      }
      const res = await fetch(`/api/dashboard/stats?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecentApprovals(data.recent_approvals || []);
        setChartData(data.chart_data || []);

        if (data.recent_activity && data.recent_activity.length > 0) {
          setActivityStream(data.recent_activity);
          if (typeof window !== "undefined") {
            sessionStorage.setItem(`seo_dashboard_activity_${currentWebsite.id}`, JSON.stringify(data.recent_activity));
          }
        } else {
          setActivityStream([]);
        }

        if (typeof window !== "undefined") {
          sessionStorage.setItem(`seo_dashboard_stats_${currentWebsite.id}`, JSON.stringify(data.stats));
          sessionStorage.setItem(`seo_dashboard_approvals_${currentWebsite.id}`, JSON.stringify(data.recent_approvals || []));
          sessionStorage.setItem(`seo_dashboard_chart_${currentWebsite.id}`, JSON.stringify(data.chart_data || []));
        }
      }
    } catch (err) {
      console.error("Failed to load dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [currentWebsite?.id, websiteLoading]);

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
      setActivityStream((prev) => [
        res.ok
          ? {
              id: `ev-${Date.now()}`,
              type: "audit",
              title: "Audit requested",
              detail: `Audit task submitted for ${currentWebsite.domain}. Results appear here once the agent finishes.`,
              timestamp: "Just now",
              status: "queued",
            }
          : {
              id: `ev-${Date.now()}`,
              type: "audit",
              title: "Audit could not be started",
              detail: `The request for ${currentWebsite.domain} failed (HTTP ${res.status}). Try again in a moment.`,
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

  // Health score is derived from real open issues by the stats API. If it is
  // not available yet, show a dash instead of inventing a number.
  const healthScoreDisplay: number | null = stats.health_score ?? null;
  const openItems = (stats.technical_issues || 0) + recentApprovals.length;
  const chartKey = activeChartTab === "impressions" ? "impressions" : "traffic";

  const statCells: { label: string; value: string; caption: string }[] = [
    {
      label: "Health score",
      value: healthScoreDisplay === null ? "—" : String(healthScoreDisplay),
      caption: healthScoreDisplay === null ? "Run a crawl to calculate" : "Out of 100, from open technical issues",
    },
    {
      label: "Tracked keywords",
      value: Number(stats.tracked_keywords || 0).toLocaleString(),
      caption: "Keywords being monitored",
    },
    {
      label: "Crawled pages",
      value: Number(stats.crawled_pages || 0).toLocaleString(),
      caption: "Pages in the latest crawl",
    },
    {
      label: "Open items",
      value: openItems.toLocaleString(),
      caption: "Technical issues and pending approvals",
    },
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10">
          <DashboardHeader />

          {/* ── STATE 1: LOADING SKELETON OR NO WEBSITE CONNECTED ── */}
          {websiteLoading && !currentWebsite ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-24 bg-white border border-neutral-200 rounded-xl" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 h-80 bg-white border border-neutral-200 rounded-xl" />
                <div className="h-80 bg-white border border-neutral-200 rounded-xl" />
              </div>
            </div>
          ) : !currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect your first website</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Add a site to crawl it, track keyword rankings, and generate content from real search data.
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
            <div className="space-y-6">
              {/* Actions */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-500 min-h-5" aria-live="polite">
                  {isAgentRunning ? runState : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/content-planner"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50"
                  >
                    <FileText className="h-3.5 w-3.5 text-neutral-500" />
                    <span>New article</span>
                  </Link>
                  <button
                    onClick={handleRunNow}
                    disabled={isAgentRunning}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {isAgentRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                    <span>{isAgentRunning ? "Running…" : "Run audit"}</span>
                  </button>
                </div>
              </div>

              {/* Stat strip: one surface, four cells (no per-card colour chips, no invented deltas) */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4">
                {statCells.map((cell, i) => (
                  <div
                    key={cell.label}
                    className={`p-5 ${i % 2 === 1 ? "border-l border-neutral-200" : ""} ${i > 1 ? "border-t border-neutral-200 lg:border-t-0" : ""} ${i > 0 ? "lg:border-l lg:border-neutral-200" : ""}`}
                  >
                    <div className="text-[13px] text-neutral-500">{cell.label}</div>
                    <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{cell.value}</div>
                    <div className="mt-1.5 text-xs text-neutral-500">{cell.caption}</div>
                  </div>
                ))}
              </section>

              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
                {/* LEFT COLUMN */}
                <div className="space-y-6 lg:col-span-2">
                  {/* Performance chart */}
                  <section className="rounded-xl border border-neutral-200 bg-white">
                    <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Search performance</h2>
                        <p className="text-xs text-neutral-500">From Google Search Console, last 30 days</p>
                      </div>
                      <div role="tablist" aria-label="Metric" className="inline-flex rounded-lg bg-neutral-100 p-0.5">
                        {(["impressions", "clicks"] as const).map((tab) => (
                          <button
                            key={tab}
                            role="tab"
                            aria-selected={activeChartTab === tab}
                            onClick={() => setActiveChartTab(tab)}
                            className={`h-7 rounded-md px-3 text-xs font-medium capitalize transition-colors ${
                              activeChartTab === tab ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500 hover:text-neutral-800"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {chartData.length > 0 ? (
                      <div className="h-72 w-full px-2 pb-3 pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                            <defs>
                              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2f4db5" stopOpacity={0.14} />
                                <stop offset="100%" stopColor="#2f4db5" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
                            <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickMargin={4} />
                            <Tooltip
                              cursor={{ stroke: "#d4d4d8", strokeDasharray: "3 3" }}
                              contentStyle={{
                                backgroundColor: "#ffffff",
                                border: "1px solid #e5e5e5",
                                borderRadius: "8px",
                                fontSize: "12px",
                                boxShadow: "0 4px 12px rgba(16,24,40,0.08)",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey={chartKey}
                              name={activeChartTab === "impressions" ? "Impressions" : "Clicks"}
                              stroke="#2f4db5"
                              strokeWidth={1.75}
                              fill="url(#chartFill)"
                              activeDot={{ r: 3.5, strokeWidth: 0 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-60 flex-col items-center justify-center px-6 text-center">
                        <p className="text-sm font-medium text-neutral-900">No Search Console data yet</p>
                        <p className="mt-1 max-w-sm text-sm text-neutral-500">
                          Connect Google Search Console to see queries, impressions, clicks and average position for this site.
                        </p>
                        <Link
                          href="/integrations"
                          className="mt-4 inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50"
                        >
                          Connect Search Console
                        </Link>
                      </div>
                    )}
                  </section>

                  {/* Review queue */}
                  <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
                      <div>
                        <h2 className="text-sm font-semibold text-neutral-900">Needs your review</h2>
                        <p className="text-xs text-neutral-500">Proposed changes waiting for approval</p>
                      </div>
                      {recentApprovals.length > 0 && (
                        <span className="text-xs font-medium tabular-nums text-neutral-500">{recentApprovals.length} pending</span>
                      )}
                    </div>

                    {recentApprovals.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <p className="text-sm font-medium text-neutral-900">Nothing to review</p>
                        <p className="mt-1 text-sm text-neutral-500">New proposals will show up here for approval before anything is changed on your site.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-neutral-200 bg-neutral-50/60 text-xs font-medium text-neutral-500">
                              <th className="px-5 py-2.5 font-medium">Issue</th>
                              <th className="px-3 py-2.5 font-medium">Priority</th>
                              <th className="px-3 py-2.5 font-medium">Recommended action</th>
                              <th className="px-5 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-[13px] text-neutral-700">
                            {recentApprovals.map((app) => (
                              <tr key={app.id} className="transition-colors hover:bg-neutral-50">
                                <td className="max-w-xs truncate px-5 py-3 font-medium text-neutral-900">{app.problem}</td>
                                <td className="px-3 py-3">
                                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
                                    <span className={`h-1.5 w-1.5 rounded-full ${app.priority === "High" ? "bg-red-500" : "bg-amber-500"}`} />
                                    {app.priority || "Medium"}
                                  </span>
                                </td>
                                <td className="max-w-md truncate px-3 py-3 text-neutral-500">{app.recommended_action}</td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    onClick={() => setSelectedApproval(app)}
                                    className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50"
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
                  </section>
                </div>

                {/* RIGHT COLUMN: activity */}
                <section className="rounded-xl border border-neutral-200 bg-white">
                  <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
                    <h2 className="text-sm font-semibold text-neutral-900">Recent activity</h2>
                    <Link href="/autopilot" className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900">
                      Autopilot <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>

                  {activityStream.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm font-medium text-neutral-900">No activity yet</p>
                      <p className="mt-1 text-sm text-neutral-500">Crawls, drafts and audits will be logged here.</p>
                    </div>
                  ) : (
                    <ol className="divide-y divide-neutral-100">
                      {activityStream.map((item) => {
                        const Icon =
                          item.type === "crawl" ? Globe :
                          item.type === "indexing" ? Check :
                          item.type === "draft" ? FileText :
                          item.type === "keyword" ? Key : Activity;
                        return (
                          <li key={item.id} className="flex gap-3 px-5 py-3.5">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50 text-neutral-500">
                              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-3">
                                <span className="truncate text-[13px] font-medium text-neutral-900">{item.title}</span>
                                <span className="shrink-0 text-xs text-neutral-400">{item.timestamp}</span>
                              </div>
                              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{item.detail}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Approval detail dialog */}
      <AnimatePresence>
        {selectedApproval && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 p-4"
            onClick={() => setSelectedApproval(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Proposed change"
              initial={{ opacity: 0, scale: 0.98, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 6 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-neutral-900">Proposed change</h3>
                <button
                  onClick={() => setSelectedApproval(null)}
                  aria-label="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="space-y-4 px-5 py-4 text-[13px]">
                {[
                  ["Issue", selectedApproval.problem],
                  ["Evidence", selectedApproval.evidence],
                  ["Recommended action", selectedApproval.recommended_action],
                  ["Expected impact", selectedApproval.expected_impact],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-neutral-500">{label}</dt>
                    <dd className="mt-1 leading-relaxed text-neutral-900">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="inline-flex h-8 items-center rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}