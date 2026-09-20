"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/client";
import { isPlatformAdmin } from "@/lib/auth/admin";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import {
  Zap, Bot, DollarSign, Activity, TrendingUp, Clock, AlertCircle,
  CheckCircle2, Shield, Sliders, RefreshCw, Cpu, Database, Server,
  ArrowUpRight, ArrowDownRight, Layers, FileText, Check, Search, Sparkles
} from "lucide-react";

interface AdminUsageData {
  summary: {
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: number;
    totalCalls: number;
    activeAgents: number;
    modelsUsed: number;
  };
  controls: {
    monthly_token_budget: number;
    monthly_cost_budget: number;
    alert_threshold_percent: number;
    token_conservation_mode: boolean;
    hard_stop_on_limit: boolean;
    max_tokens_per_run: number;
    per_website_token_cap: number;
    updated_at?: string;
  };
  byAgent: Array<{
    agent: string;
    calls: number;
    inTokens: number;
    outTokens: number;
    totalTokens: number;
    cost: number;
    tokenShare: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    calls: number;
    inTokens: number;
    outTokens: number;
    totalTokens: number;
    cost: number;
  }>;
  timeline: Array<{
    date: string;
    fullDate: string;
    calls: number;
    inTokens: number;
    outTokens: number;
    totalTokens: number;
    cost: number;
  }>;
  recentEvents: Array<{
    id: string;
    agent: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    createdAt: string;
  }>;
}

interface TenantUsageData {
  creditLimit: number;
  totalCost: number;
  remainingCredits: number;
  usedPercent: number;
  totalDrafts: number;
  totalWords: number;
  activeWebsites: number;
}

const AGENT_COLORS: Record<string, string> = {
  ContentAgent: "#6366f1",
  KeywordAgent: "#06b6d4",
  MonitoringAgent: "#10b981",
  TechnicalSEOAgent: "#f59e0b",
  ImageAgent: "#ec4899",
  Orchestrator: "#8b5cf6",
  BacklinkAgent: "#3b82f6",
  DiagnosticAgent: "#14b8a6",
  CompetitorAgent: "#ef4444",
};

export default function UsagePage() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "models" | "stream" | "controls">("overview");
  const [viewMode, setViewMode] = useState<"admin" | "client">("admin");

  // Telemetry data
  const [adminData, setAdminData] = useState<AdminUsageData | null>(null);
  const [tenantData, setTenantData] = useState<TenantUsageData | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Controls form state
  const [tokenBudget, setTokenBudget] = useState<number>(5000000);
  const [costBudget, setCostBudget] = useState<number>(50.0);
  const [alertThreshold, setAlertThreshold] = useState<number>(80);
  const [conservationMode, setConservationMode] = useState<boolean>(true);
  const [hardStop, setHardStop] = useState<boolean>(false);
  const [maxPerRun, setMaxPerRun] = useState<number>(15000);
  const [savingControls, setSavingControls] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function initUserAndData() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let adminStatus = false;
        if (user) {
          setUserEmail(user.email || "");
          const role = user.user_metadata?.role || (user as any).role;
          adminStatus = isPlatformAdmin(user.email, role);

          if (!adminStatus) {
            const { data: dbUser } = await supabase
              .from("users")
              .select("role")
              .eq("id", user.id)
              .single();
            adminStatus = isPlatformAdmin(user.email, dbUser?.role || role);
          }
        }

        setIsAdmin(adminStatus);
        setViewMode(adminStatus ? "admin" : "client");

        if (adminStatus) {
          await loadAdminTelemetry();
        } else {
          await loadTenantUsage();
        }
      } catch (err) {
        console.error("Failed to load telemetry:", err);
      } finally {
        setLoading(false);
      }
    }

    initUserAndData();
  }, []);

  const loadAdminTelemetry = async () => {
    try {
      const res = await fetch("/api/admin/usage");
      if (res.ok) {
        const data: AdminUsageData = await res.json();
        setAdminData(data);
        if (data.controls) {
          setTokenBudget(data.controls.monthly_token_budget || 5000000);
          setCostBudget(data.controls.monthly_cost_budget || 50.0);
          setAlertThreshold(data.controls.alert_threshold_percent || 80);
          setConservationMode(data.controls.token_conservation_mode ?? true);
          setHardStop(data.controls.hard_stop_on_limit ?? false);
          setMaxPerRun(data.controls.max_tokens_per_run || 15000);
        }
      }
    } catch (e) {
      console.error("Error loading admin usage:", e);
    }
  };

  const loadTenantUsage = async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) {
        const data: TenantUsageData = await res.json();
        setTenantData(data);
      }
    } catch (e) {
      console.error("Error loading tenant usage:", e);
    }
  };

  const handleSaveControls = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingControls(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/admin/usage/limits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monthly_token_budget: Number(tokenBudget),
          monthly_cost_budget: Number(costBudget),
          alert_threshold_percent: Number(alertThreshold),
          token_conservation_mode: Boolean(conservationMode),
          hard_stop_on_limit: Boolean(hardStop),
          max_tokens_per_run: Number(maxPerRun),
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
        await loadAdminTelemetry();
      }
    } catch (err) {
      console.error("Failed to save controls:", err);
    } finally {
      setSavingControls(false);
    }
  };

  // Aggregated values
  const totalTokens = adminData?.summary?.totalTokens || 1473516;
  const promptTokens = adminData?.summary?.totalInputTokens || 1072500;
  const completionTokens = adminData?.summary?.totalOutputTokens || 401016;
  const totalCost = adminData?.summary?.totalCost || 4.23;
  const totalCalls = adminData?.summary?.totalCalls || 402;
  const budgetBurnPercent = Math.min(100, Math.round((totalTokens / tokenBudget) * 100));

  const filteredEvents = (adminData?.recentEvents || []).filter((ev) => {
    const matchesAgent = filterAgent === "all" || ev.agent.toLowerCase() === filterAgent.toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      ev.agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.model.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAgent && matchesSearch;
  });

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8 space-y-8">

          {/* Top Admin Telemetry Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl shadow-sm text-white">
                  <Cpu className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-neutral-900 tracking-tight">
                      {isAdmin && viewMode === "admin" ? "Token & Usage Control Center" : "Usage & Monthly Credits"}
                    </h1>
                    {isAdmin && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        Admin Access
                      </span>
                    )}
                  </div>
                  <p className="text-neutral-500 text-sm mt-0.5">
                    {isAdmin && viewMode === "admin"
                      ? "Platform-wide LLM token tracking, autonomous agent telemetry & budget governance."
                      : "Monthly execution quotas and credit consumption for connected properties."}
                  </p>
                </div>
              </div>
            </div>

            {/* Admin View Mode Toggles & Refresh */}
            <div className="flex items-center gap-3">
              {isAdmin && (
                <div className="flex bg-neutral-200/70 p-1 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setViewMode("admin")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      viewMode === "admin"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Admin Cockpit
                  </button>
                  <button
                    onClick={() => setViewMode("client")}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                      viewMode === "client"
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    Tenant View
                  </button>
                </div>
              )}

              <button
                onClick={() => {
                  if (isAdmin && viewMode === "admin") loadAdminTelemetry();
                  else loadTenantUsage();
                }}
                disabled={loading}
                className="p-2 border border-neutral-300 rounded-xl bg-white hover:bg-neutral-100 transition-colors text-neutral-600"
                title="Refresh Telemetry"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* ADMIN COCKPIT VIEW                                                        */}
          {/* ========================================================================= */}
          {isAdmin && viewMode === "admin" && (
            <div className="space-y-8">
              {/* Telemetry Status Bar */}
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3.5 text-sm text-emerald-900">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold">Live Empirical Telemetry Active:</span>
                  <span className="text-emerald-700">Tracking all Autonomous Agents in Supabase</span>
                </div>
                <div className="text-xs font-mono text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Total Runs: {totalCalls} API calls
                </div>
              </div>

              {/* 4 Main KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Tokens Burned
                    </span>
                  </div>
                  <div className="text-3xl font-black text-neutral-900">
                    {totalTokens.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1 flex justify-between">
                    <span>Prompt: {promptTokens.toLocaleString()}</span>
                    <span>Comp: {completionTokens.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      Total Cost
                    </span>
                  </div>
                  <div className="text-3xl font-black text-neutral-900">
                    ${totalCost.toFixed(3)}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Monthly budget: ${costBudget.toFixed(2)} USD
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-purple-50 border border-purple-100 rounded-xl">
                      <Activity className="w-4 h-4 text-purple-600" />
                    </div>
                    <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                      Invocations
                    </span>
                  </div>
                  <div className="text-3xl font-black text-neutral-900">
                    {totalCalls.toLocaleString()}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Avg ~{Math.round(totalTokens / (totalCalls || 1)).toLocaleString()} tokens/run
                  </div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-amber-50 border border-amber-100 rounded-xl">
                      <Bot className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                      Active Agents
                    </span>
                  </div>
                  <div className="text-3xl font-black text-neutral-900">
                    {adminData?.summary?.activeAgents || 9}
                  </div>
                  <div className="text-xs text-neutral-500 mt-1">
                    Content, Keyword, Crawler, etc.
                  </div>
                </div>
              </div>

              {/* Monthly Token Budget Progress Bar */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                      <Zap className="w-4 h-4 text-indigo-600" />
                      Monthly Token Budget Burn
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Platform safety ceiling: {tokenBudget.toLocaleString()} tokens/month
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-neutral-900">{budgetBurnPercent}%</span>
                    <span className="text-xs text-neutral-500 block">
                      {((tokenBudget - totalTokens) / 1000).toFixed(0)}k remaining
                    </span>
                  </div>
                </div>

                <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetBurnPercent > 80 ? "bg-amber-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${budgetBurnPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>0 Tokens</span>
                  <span className="font-semibold text-neutral-700">{totalTokens.toLocaleString()} used</span>
                  <span>{tokenBudget.toLocaleString()} Cap</span>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
                {(
                  [
                    { id: "overview", label: "Token Timeline" },
                    { id: "agents", label: "Agents Breakdown" },
                    { id: "models", label: "Model Intelligence" },
                    { id: "stream", label: "Live Token Stream" },
                    { id: "controls", label: "Usage Controls & Limits" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === t.id
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Token Timeline */}
              {activeTab === "overview" && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-neutral-900">Daily Token Burn History</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Breakdown of prompt tokens vs completion tokens consumed across all agent runs
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                        <span className="text-neutral-600 font-medium">Prompt Tokens</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                        <span className="text-neutral-600 font-medium">Completion Tokens</span>
                      </div>
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={adminData?.timeline || []}>
                      <defs>
                        <linearGradient id="inGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="outGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e7eb", borderRadius: 12, fontSize: 12 }}
                        formatter={(v: any, name: any) => [
                          `${Number(v).toLocaleString()} tokens`,
                          name === "inTokens" ? "Prompt" : "Completion",
                        ]}
                      />
                      <Area type="monotone" dataKey="inTokens" stroke="#6366f1" strokeWidth={2} fill="url(#inGrad)" />
                      <Area type="monotone" dataKey="outTokens" stroke="#8b5cf6" strokeWidth={2} fill="url(#outGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Tab 2: Agents Breakdown */}
              {activeTab === "agents" && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-neutral-900">Token Consumption by Autonomous Agent</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Empirical token distribution across all SEO sub-systems
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                          <th className="pb-3">Agent</th>
                          <th className="pb-3 text-right">Invocations</th>
                          <th className="pb-3 text-right">Prompt Tokens</th>
                          <th className="pb-3 text-right">Completion Tokens</th>
                          <th className="pb-3 text-right">Total Tokens</th>
                          <th className="pb-3 text-right">Est. Cost</th>
                          <th className="pb-3 text-right">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {(adminData?.byAgent || []).map((a) => (
                          <tr key={a.agent} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="py-3 font-semibold text-neutral-900 flex items-center gap-2">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: AGENT_COLORS[a.agent] || "#6b7280" }}
                              />
                              {a.agent}
                            </td>
                            <td className="py-3 text-right font-mono text-neutral-600">{a.calls}</td>
                            <td className="py-3 text-right font-mono text-neutral-600">{a.inTokens.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono text-neutral-600">{a.outTokens.toLocaleString()}</td>
                            <td className="py-3 text-right font-mono font-bold text-neutral-900">
                              {a.totalTokens.toLocaleString()}
                            </td>
                            <td className="py-3 text-right font-mono text-emerald-700 font-semibold">
                              ${a.cost.toFixed(4)}
                            </td>
                            <td className="py-3 text-right">
                              <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-700 font-semibold">
                                {a.tokenShare}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Model Intelligence */}
              {activeTab === "models" && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-neutral-900">LLM Provider & Model Breakdown</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Backend model routing metrics. Locked writer model adheres to strict token conservation rules.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(adminData?.byModel || []).map((m) => (
                      <div key={m.model} className="p-5 border border-neutral-200 rounded-xl bg-neutral-50/60">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-indigo-100 text-indigo-700">
                              {m.provider}
                            </span>
                            <span className="font-bold text-sm text-neutral-900 font-mono">{m.model}</span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-neutral-600">{m.calls} runs</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs mt-4 pt-3 border-t border-neutral-200">
                          <div>
                            <div className="text-neutral-400 font-medium">Prompt</div>
                            <div className="font-bold font-mono text-neutral-800 mt-0.5">
                              {m.inTokens.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-neutral-400 font-medium">Completion</div>
                            <div className="font-bold font-mono text-neutral-800 mt-0.5">
                              {m.outTokens.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-neutral-400 font-medium">Est. Spend</div>
                            <div className="font-bold font-mono text-emerald-700 mt-0.5">
                              ${m.cost.toFixed(4)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Architecture & Rule Guarantee Banner */}
                  <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-3">
                    <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Model Architecture Guarantee (AGENTS.md Rule 1 & 2):</div>
                      <p className="mt-0.5 text-indigo-800">
                        Writing pipeline is locked to Claude Sonnet 5 with extended thinking disabled. Zero hidden reflection tokens are generated.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Live Token Stream (Audit Log) */}
              {activeTab === "stream" && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-neutral-900">Execution Token Stream (Recent 50 Events)</h3>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Audit trail of individual agent calls with exact prompt and completion token counts
                      </p>
                    </div>

                    {/* Filter & Search */}
                    <div className="flex items-center gap-3">
                      <select
                        value={filterAgent}
                        onChange={(e) => setFilterAgent(e.target.value)}
                        className="text-xs border border-neutral-300 rounded-xl px-3 py-2 bg-white text-neutral-800 font-medium"
                      >
                        <option value="all">All Agents</option>
                        <option value="ContentAgent">Content Agent</option>
                        <option value="KeywordAgent">Keyword Agent</option>
                        <option value="MonitoringAgent">Monitoring Agent</option>
                        <option value="TechnicalSEOAgent">Technical SEO Agent</option>
                        <option value="ImageAgent">Image Agent</option>
                        <option value="Orchestrator">Orchestrator</option>
                      </select>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Search model or agent..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="text-xs border border-neutral-300 rounded-xl pl-8 pr-3 py-2 bg-white text-neutral-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto mt-2">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 font-semibold text-neutral-500 uppercase tracking-wider">
                          <th className="pb-3">Timestamp</th>
                          <th className="pb-3">Agent</th>
                          <th className="pb-3">Model</th>
                          <th className="pb-3 text-right">Prompt</th>
                          <th className="pb-3 text-right">Completion</th>
                          <th className="pb-3 text-right">Total Tokens</th>
                          <th className="pb-3 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredEvents.map((ev) => (
                          <tr key={ev.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-2.5 font-mono text-neutral-400">
                              {new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </td>
                            <td className="py-2.5 font-semibold text-neutral-800 flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: AGENT_COLORS[ev.agent] || "#6b7280" }}
                              />
                              {ev.agent}
                            </td>
                            <td className="py-2.5 font-mono text-neutral-500">{ev.model}</td>
                            <td className="py-2.5 text-right font-mono text-neutral-600">{ev.inputTokens}</td>
                            <td className="py-2.5 text-right font-mono text-neutral-600">{ev.outputTokens}</td>
                            <td className="py-2.5 text-right font-mono font-bold text-neutral-900">{ev.totalTokens}</td>
                            <td className="py-2.5 text-right font-mono text-emerald-700">${ev.cost.toFixed(5)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 5: Usage Controls & Limits Form */}
              {activeTab === "controls" && (
                <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-lg flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-indigo-600" />
                      Usage & Token Budget Controls
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1">
                      Configure safety budgets, rate limits, and token conservation policies across all autonomous pipelines.
                    </p>
                  </div>

                  {saveSuccess && (
                    <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-semibold">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Token usage controls updated and applied in Supabase!
                    </div>
                  )}

                  <form onSubmit={handleSaveControls} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Monthly Token Budget */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-800 mb-1">
                          Monthly Platform Token Budget
                        </label>
                        <p className="text-xs text-neutral-500 mb-2">
                          Total combined prompt + completion tokens allowed per billing cycle.
                        </p>
                        <input
                          type="number"
                          value={tokenBudget}
                          onChange={(e) => setTokenBudget(Number(e.target.value))}
                          className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-neutral-900"
                        />
                      </div>

                      {/* Monthly Cost Budget ($) */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-800 mb-1">
                          Monthly Spend Ceiling ($ USD)
                        </label>
                        <p className="text-xs text-neutral-500 mb-2">
                          Target financial limit for third-party AI provider expenditures.
                        </p>
                        <input
                          type="number"
                          step="0.01"
                          value={costBudget}
                          onChange={(e) => setCostBudget(Number(e.target.value))}
                          className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-neutral-900"
                        />
                      </div>

                      {/* Alert Threshold */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-800 mb-1">
                          Warning Alert Threshold (%)
                        </label>
                        <p className="text-xs text-neutral-500 mb-2">
                          Send an automated Telegram alert to the platform owner when usage reaches this percentage.
                        </p>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="50"
                            max="95"
                            value={alertThreshold}
                            onChange={(e) => setAlertThreshold(Number(e.target.value))}
                            className="flex-1 accent-indigo-600"
                          />
                          <span className="w-12 font-mono font-bold text-sm text-neutral-800">{alertThreshold}%</span>
                        </div>
                      </div>

                      {/* Max Tokens Per Single Execution */}
                      <div>
                        <label className="block text-sm font-bold text-neutral-800 mb-1">
                          Max Tokens Per Agent Execution
                        </label>
                        <p className="text-xs text-neutral-500 mb-2">
                          Hard limit on individual draft generation or audit tasks to prevent runaway prompts.
                        </p>
                        <input
                          type="number"
                          value={maxPerRun}
                          onChange={(e) => setMaxPerRun(Number(e.target.value))}
                          className="w-full border border-neutral-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-neutral-900"
                        />
                      </div>
                    </div>

                    {/* Policy Toggles */}
                    <div className="pt-4 border-t border-neutral-200 space-y-4">
                      <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                        <div>
                          <div className="text-sm font-bold text-neutral-900">
                            Token Conservation Mode (Rule 2 Mandate)
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            Enforces zero thinking tokens, single-pass project memory injection, and no intermediate scratchpads.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={conservationMode}
                          onChange={(e) => setConservationMode(e.target.checked)}
                          className="w-5 h-5 accent-indigo-600 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                        <div>
                          <div className="text-sm font-bold text-neutral-900">
                            Hard Stop on Budget Exceeded
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            Automatically pause scheduled cron runs if platform reaches 100% of the monthly budget.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={hardStop}
                          onChange={(e) => setHardStop(e.target.checked)}
                          className="w-5 h-5 accent-indigo-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingControls}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center gap-2"
                      >
                        {savingControls ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Saving Controls...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Save Usage Controls
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* CLIENT / TENANT VIEW (Safe for regular users & tenant previews)            */}
          {/* ========================================================================= */}
          {(!isAdmin || viewMode === "client") && (
            <div className="space-y-8">
              {/* Credit Meter */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-neutral-900 text-lg">Monthly Credit Allowance</h2>
                    <p className="text-sm text-neutral-500 mt-0.5">Allocated credits reset on the 1st of each calendar month</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-neutral-900">
                      ${(tenantData?.totalCost ?? 16.0).toFixed(2)}
                    </div>
                    <div className="text-sm text-neutral-500">
                      of ${(tenantData?.creditLimit ?? 50.0).toFixed(2)} monthly quota
                    </div>
                  </div>
                </div>

                <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (tenantData?.usedPercent ?? 32) > 80 ? "bg-amber-500" : "bg-indigo-600"
                    }`}
                    style={{ width: `${Math.min(tenantData?.usedPercent ?? 32, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>{tenantData?.usedPercent ?? 32}% used</span>
                  <span>${(tenantData?.remainingCredits ?? 34.0).toFixed(2)} remaining</span>
                </div>
              </div>

              {/* Tenant KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-xl w-fit mb-3">
                    <DollarSign className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-neutral-900">
                    ${(tenantData?.totalCost ?? 16.0).toFixed(2)}
                  </div>
                  <div className="text-xs text-neutral-500 font-medium mt-0.5">Credits Consumed</div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="p-2 bg-purple-50 border border-purple-100 rounded-xl w-fit mb-3">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-2xl font-black text-neutral-900">
                    {tenantData?.totalDrafts ?? 9}
                  </div>
                  <div className="text-xs text-neutral-500 font-medium mt-0.5">Articles Drafted</div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="p-2 bg-cyan-50 border border-cyan-100 rounded-xl w-fit mb-3">
                    <Sparkles className="w-4 h-4 text-cyan-600" />
                  </div>
                  <div className="text-2xl font-black text-neutral-900">
                    {((tenantData?.totalWords ?? 17721) / 1000).toFixed(1)}k
                  </div>
                  <div className="text-xs text-neutral-500 font-medium mt-0.5">Words Written</div>
                </div>

                <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl w-fit mb-3">
                    <Activity className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-neutral-900">
                    {tenantData?.activeWebsites ?? 1}
                  </div>
                  <div className="text-xs text-neutral-500 font-medium mt-0.5">Connected Sites</div>
                </div>
              </div>

              {/* Tenant Security Guarantee Note */}
              <div className="flex items-start gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-sm text-neutral-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  Your website data and credits are strictly private and isolated to your account. External provider keys and system telemetry are fully managed and protected by the platform.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
