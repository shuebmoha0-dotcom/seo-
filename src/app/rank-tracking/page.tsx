"use client";

import { Sidebar } from "@/components/Sidebar";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Minus, Search, Globe, Plus, BarChart2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import Link from "next/link";

export default function RankTrackingPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRankData() {
      if (!currentWebsite) {
        setHistoryData([]);
        setKeywords([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/keywords?website_id=${currentWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          setKeywords(data.raw_keywords || []);
        }
      } catch (err) {
        console.error("Failed to load rank data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRankData();
  }, [currentWebsite?.id]);

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>SEO Analytics</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Rank Tracking</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Keyword Rank Tracker</h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Monitoring real position movements and search queries for ${currentWebsite.domain}.`
                : "Connect your website to track keyword rankings."}
            </p>
          </div>
        </header>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Rank tracking monitors daily position shifts for your target search queries.
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
        ) : historyData.length === 0 && keywords.length === 0 && !loading ? (
          /* ── STATE 2: NO RANK DATA YET ── */
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto mt-8">
            <BarChart2 className="w-8 h-8 text-neutral-400 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">No Rank Tracking History Yet</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Connect Google Search Console in Integrations or discover keywords to track position fluctuations over time for {currentWebsite.domain}.
            </p>
            <div className="pt-2">
              <Link
                href="/integrations"
                className="bg-white border border-neutral-200 text-neutral-700 font-semibold px-4 py-2 rounded-xl text-xs hover:bg-neutral-100 transition-colors inline-block shadow-sm"
              >
                Connect Google Search Console
              </Link>
            </div>
          </div>
        ) : (
          /* ── STATE 3: REAL DATA ── */
          <div className="space-y-6">
            {historyData.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                <h3 className="font-semibold text-neutral-900 text-sm mb-4">Average Rank Position Over Time</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                      <defs>
                        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                      <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} domain={[1, 30]} reversed />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e5e7eb", borderRadius: "12px", color: "#111827", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="rank" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#emeraldGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {keywords.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Tracked Keyword</th>
                      <th className="py-3 px-4">Search Volume</th>
                      <th className="py-3 px-4">Difficulty</th>
                      <th className="py-3 px-4">Intent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {keywords.map((kw) => (
                      <tr key={kw.id || kw.term} className="hover:bg-neutral-50">
                        <td className="py-3 px-4 font-bold text-neutral-900">{kw.term}</td>
                        <td className="py-3 px-4 font-mono text-neutral-700">{kw.volume?.toLocaleString() || "N/A"}</td>
                        <td className="py-3 px-4 font-mono text-neutral-700">{kw.difficulty || "Low"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {kw.intent || "Informational"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
