"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Users, AlertTriangle, Crosshair, ChevronRight, Search, TrendingDown, TrendingUp, Target, FileText, Zap
} from "lucide-react";
import { useState } from "react";

export default function CompetitorsPage() {
  const [selectedThreat, setSelectedThreat] = useState<any | null>(null);

  const competitors = [
    { domain: "ahrefs.com", type: "Direct", overlap: "84%", keywords: "142k", trend: "+2.4%" },
    { domain: "backlinko.com", type: "Content", overlap: "62%", keywords: "89k", trend: "+1.1%" },
    { domain: "semrush.com", type: "Direct", overlap: "79%", keywords: "210k", trend: "-0.5%" },
    { domain: "moz.com", type: "Direct", overlap: "65%", keywords: "115k", trend: "-1.2%" },
  ];

  const threats = [
    {
      id: "t_1",
      keyword: "saas seo guide",
      competitor: "backlinko.com",
      movement: "Pos 4 → Pos 1",
      customerMovement: "Pos 1 → Pos 3",
      level: "Critical",
      analysis: "Competitor completely rewrote their guide and aligned it better with transactional search intent. They added a custom tool template.",
      response: "Update our guide to match intent. Send to Strategy Agent for approval."
    },
    {
      id: "t_2",
      keyword: "enterprise seo software",
      competitor: "ahrefs.com",
      movement: "Pos 8 → Pos 4",
      customerMovement: "Pos 5 → Pos 6",
      level: "Moderate",
      analysis: "Competitor gained 14 high-authority backlinks in the last 2 weeks to their product page.",
      response: "Send linkable asset recommendation to Backlink Agent."
    }
  ];

  const gaps = [
    { type: "Missing Topic", keyword: "programmatic seo for saas", volume: "1,200", difficulty: "Low", competitor: "backlinko.com" },
    { type: "Long-Tail", keyword: "how to scale saas content production", volume: "450", difficulty: "Very Low", competitor: "ahrefs.com" },
    { type: "Content Depth", keyword: "technical seo checklist", volume: "8,100", difficulty: "High", competitor: "moz.com", note: "Our page is missing the Core Web Vitals section." }
  ];

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-neutral-200 px-8 py-6 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-neutral-900 font-medium">Competitor Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Competitor Intelligence Hub</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Discover gaps, monitor SERP threats, and maintain strategic dominance.
            </p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Run Competitor Scan
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* KPI STATS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Tracked Competitors</span>
              <div className="text-3xl font-black text-neutral-900 mb-1">{competitors.length}</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Keyword Overlap</span>
              <div className="text-3xl font-black text-neutral-900 mb-1">34.2k</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Content Gaps Identified</span>
              <div className="text-3xl font-black text-indigo-700 mb-1 flex items-center gap-2">
                12 <Target className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-red-50 to-white">
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1 block">Active SERP Threats</span>
              <div className="text-3xl font-black text-red-700 mb-1">{threats.length}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COMPETITORS LIST */}
            <section className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" /> Tracked Competitors
                </h2>
              </div>
              
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-500 font-semibold">
                    <tr>
                      <th className="px-6 py-4">Domain</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Overlap</th>
                      <th className="px-6 py-4">Ranking Keywords</th>
                      <th className="px-6 py-4">30d Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {competitors.map((comp, i) => (
                      <tr key={i} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-neutral-900">{comp.domain}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
                            {comp.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-indigo-600">{comp.overlap}</td>
                        <td className="px-6 py-4 text-neutral-600">{comp.keywords}</td>
                        <td className={`px-6 py-4 font-bold flex items-center gap-1 ${comp.trend.startsWith('+') ? 'text-emerald-600' : 'text-red-500'}`}>
                          {comp.trend.startsWith('+') ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {comp.trend}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* GAPS */}
              <h2 className="text-lg font-bold text-neutral-900 pt-4 flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-indigo-500" /> High-Value Gaps
              </h2>
              <div className="space-y-3">
                {gaps.map((gap, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">{gap.type}</span>
                        <span className="text-neutral-500 font-mono">Found via {gap.competitor}</span>
                      </div>
                      <div className="font-semibold text-neutral-900">{gap.keyword}</div>
                      {gap.note && <div className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {gap.note}</div>}
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-sm font-bold text-neutral-700">{gap.volume} <span className="text-xs font-normal text-neutral-400">Vol</span></div>
                      <div className={`text-[10px] font-bold uppercase ${gap.difficulty.includes('Low') ? 'text-emerald-600' : 'text-red-500'}`}>{gap.difficulty} Diff</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* THREATS SIDEBAR */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> Active SERP Threats
              </h2>
              
              {threats.map((threat) => (
                <div key={threat.id} className="bg-white border border-red-200 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-red-700 bg-red-50 px-2 py-1 rounded border border-red-100">
                      {threat.level} Threat
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">{threat.competitor}</span>
                  </div>

                  <h3 className="font-bold text-neutral-900 mb-4">{threat.keyword}</h3>

                  <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                      <span className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Competitor</span>
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3"/> {threat.movement}</span>
                    </div>
                    <div className="bg-neutral-50 p-2 rounded-lg border border-neutral-200">
                      <span className="block text-[10px] text-neutral-400 uppercase font-bold mb-1">Customer</span>
                      <span className="text-red-500 font-bold flex items-center gap-1"><TrendingDown className="w-3 h-3"/> {threat.customerMovement}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedThreat(threat)}
                    className="w-full bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" /> View Agent Analysis
                  </button>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
      
      {/* THREAT MODAL */}
      {selectedThreat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 mb-1">Threat Analysis</h2>
                <p className="text-sm text-neutral-500 font-mono text-xs">{selectedThreat.keyword}</p>
              </div>
              <button onClick={() => setSelectedThreat(null)} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6 bg-[#FAFAFA]">
               <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Agent Observation</h4>
                  <p className="text-sm text-neutral-800 leading-relaxed">{selectedThreat.analysis}</p>
               </div>
               
               <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-sm">
                  <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Zap className="w-3 h-3"/> Recommended Response</h4>
                  <p className="text-sm text-indigo-900 font-medium">{selectedThreat.response}</p>
               </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-white rounded-b-2xl flex items-center justify-between">
              <button onClick={() => setSelectedThreat(null)} className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors">
                Dismiss
              </button>
              <button 
                onClick={() => setSelectedThreat(null)}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                Send to Strategy Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
