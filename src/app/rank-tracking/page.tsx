"use client";

import { Sidebar } from "@/components/Sidebar";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Search } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const historyData = [
  { date: "May 12", rank: 18 },
  { date: "May 19", rank: 16 },
  { date: "May 26", rank: 15 },
  { date: "Jun 2", rank: 14 },
  { date: "Jun 9", rank: 13 },
  { date: "Jun 12", rank: 12.4 },
];

export default function RankTrackingPage() {
  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>SEO Analytics</span>
            <span>&gt;</span>
            <span className="text-neutral-700">Rank Tracking</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Keyword Rank Tracker</h1>
          <p className="text-neutral-500 text-xs mt-0.5">
            Monitor real-time position movements and rank fluctuations across target search queries.
          </p>
        </header>

        {/* Chart */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 mb-8">
          <h3 className="font-semibold text-neutral-900 text-sm mb-4">Average Rank Position Over Time</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} domain={[1, 30]} reversed />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "12px", color: "#111827" }} />
                <Area type="monotone" dataKey="rank" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#emeraldGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
