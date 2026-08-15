"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import {
  Zap, Bot, DollarSign, Activity, TrendingUp, Clock, AlertCircle, CheckCircle2
} from "lucide-react";

// Mock data for dev preview (replaced by real Supabase data when connected)
const monthlyTrend = [
  { date: "Aug 1", cost: 0.42, events: 8 },
  { date: "Aug 3", cost: 1.10, events: 22 },
  { date: "Aug 5", cost: 0.80, events: 15 },
  { date: "Aug 7", cost: 2.30, events: 46 },
  { date: "Aug 9", cost: 1.60, events: 31 },
  { date: "Aug 11", cost: 3.10, events: 62 },
  { date: "Aug 13", cost: 2.80, events: 57 },
  { date: "Aug 15", cost: 4.20, events: 88 },
];

const byAgent = [
  { agent: "Content Agent", cost: 5.80, calls: 22 },
  { agent: "Orchestrator", cost: 3.20, calls: 48 },
  { agent: "Keyword Agent", cost: 1.10, calls: 87 },
  { agent: "Competitor Agent", cost: 2.40, calls: 31 },
  { agent: "On-Page Agent", cost: 1.60, calls: 44 },
  { agent: "Image Agent", cost: 0.90, calls: 18 },
];

const recentEvents = [
  { id: 1, agent: "Content Agent", model: "claude-3-5-sonnet", tokens: 3200, cost: 0.078, time: "2m ago" },
  { id: 2, agent: "Keyword Agent", model: "gpt-4o-mini", tokens: 820, cost: 0.001, time: "14m ago" },
  { id: 3, agent: "Orchestrator", model: "gpt-4o", tokens: 1100, cost: 0.022, time: "1h ago" },
  { id: 4, agent: "Content Agent", model: "claude-3-5-sonnet", tokens: 4400, cost: 0.102, time: "3h ago" },
  { id: 5, agent: "Competitor Agent", model: "gpt-4o", tokens: 1800, cost: 0.036, time: "5h ago" },
];

const AGENT_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"
];

export default function UsagePage() {
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "history">("overview");

  const totalCost = 16.00;
  const creditLimit = 50.00;
  const usedPercent = Math.round((totalCost / creditLimit) * 100);
  const totalTokens = 284440;
  const totalCalls = 250;
  const tasksRun = 42;

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8 space-y-8">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-indigo-600" />
              Usage & Credits
            </h1>
            <p className="text-neutral-500 text-sm mt-1">
              Your AI usage this month — August 2026
            </p>
          </div>

          {/* Credit Meter */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-neutral-900 text-lg">Monthly Credit Usage</h2>
                <p className="text-sm text-neutral-500 mt-0.5">Resets on 1st of each month</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-neutral-900">${totalCost.toFixed(2)}</div>
                <div className="text-sm text-neutral-500">of ${creditLimit.toFixed(2)} limit</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-neutral-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${usedPercent > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                style={{ width: `${Math.min(usedPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{usedPercent}% used</span>
              <span>${(creditLimit - totalCost).toFixed(2)} remaining</span>
            </div>

            {usedPercent > 80 && (
              <div className="mt-4 flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>You've used {usedPercent}% of your monthly limit. Scheduled tasks may pause if limit is exceeded.</span>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total API Cost", value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: "indigo" },
              { label: "AI Tokens Used", value: `${(totalTokens / 1000).toFixed(0)}K`, icon: Bot, color: "purple" },
              { label: "API Calls Made", value: totalCalls.toLocaleString(), icon: Activity, color: "cyan" },
              { label: "Tasks Executed", value: tasksRun.toString(), icon: Clock, color: "emerald" },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                <div className={`p-2 bg-${card.color}-50 border border-${card.color}-100 rounded-xl w-fit mb-3`}>
                  <card.icon className={`w-4 h-4 text-${card.color}-600`} />
                </div>
                <div className="text-2xl font-black text-neutral-900">{card.value}</div>
                <div className="text-xs text-neutral-500 font-medium mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
            {(["overview", "agents", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                  activeTab === tab
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-neutral-900 mb-5">Daily Cost Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e7eb", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Cost"]}
                  />
                  <Area type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} fill="url(#costGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === "agents" && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-neutral-900 mb-5">Cost by Agent</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byAgent} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="agent" tick={{ fontSize: 12, fill: "#374151" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", borderColor: "#e5e7eb", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Est. Cost"]}
                  />
                  <Bar dataKey="cost" radius={[0, 8, 8, 0]}>
                    {byAgent.map((_, idx) => (
                      <Cell key={idx} fill={AGENT_COLORS[idx % AGENT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Agent breakdown table */}
              <div className="mt-6 space-y-2">
                {byAgent.map((a, idx) => (
                  <div key={a.agent} className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AGENT_COLORS[idx % AGENT_COLORS.length] }} />
                      <span className="text-sm font-medium text-neutral-800">{a.agent}</span>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-neutral-500">{a.calls} calls</span>
                      <span className="font-semibold text-neutral-900">${a.cost.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History Tab */}
          {activeTab === "history" && (
            <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-neutral-100">
                <h3 className="font-bold text-neutral-900">Recent API Events</h3>
              </div>
              <div className="divide-y divide-neutral-100">
                {recentEvents.map((ev) => (
                  <div key={ev.id} className="px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-neutral-800">{ev.agent}</div>
                        <div className="text-xs text-neutral-500 font-mono">{ev.model}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="text-neutral-500">{ev.tokens.toLocaleString()} tokens</span>
                      <span className="font-mono font-semibold text-neutral-900">${ev.cost.toFixed(3)}</span>
                      <span className="text-neutral-400 text-xs">{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="flex items-start gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-5 text-sm text-neutral-600">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p>
              You can only see your own usage. API keys, provider credentials, and platform-wide costs are never exposed to users.
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}
