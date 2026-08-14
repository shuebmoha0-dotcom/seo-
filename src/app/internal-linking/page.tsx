"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Link as LinkIcon, AlertCircle, CheckCircle2, TrendingUp, GitPullRequest, Search, FileText, ChevronRight
} from "lucide-react";
import { useState } from "react";

export default function InternalLinkingPage() {
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);

  const opportunities = [
    {
      id: "il_1",
      source: "/blog/saas-seo-guide",
      target: "/product/seo-software",
      anchor: "SaaS SEO platform",
      reason: "Commercial next step for readers of the top-of-funnel guide.",
      impact: "High",
      confidence: "94%",
      evidence: "Source page receives 1,200 visits/mo. Context perfectly matches product intent.",
      placement: "Under 'Choosing the Right Tools' section",
      before: "...using a reliable tool can save time.",
      after: "...using a reliable SaaS SEO platform can save time."
    },
    {
      id: "il_2",
      source: "/features/keyword-research",
      target: "/blog/keyword-research-guide",
      anchor: "keyword research guide",
      reason: "Connects feature page to supporting educational content.",
      impact: "Medium",
      confidence: "91%",
      evidence: "Feature page has high authority; passing equity to the guide will boost its rank.",
      placement: "FAQ section",
      before: "Learn more in our guide.",
      after: "Learn more in our keyword research guide."
    }
  ];

  const orphans = [
    { url: "/blog/old-company-update-2022", incomingLinks: 0, recommendation: "Leave as orphan (Archived content)" },
    { url: "/glossary/canonical-tags", incomingLinks: 1, recommendation: "Link from /blog/technical-seo-checklist" }
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
              <span className="text-neutral-900 font-medium">Internal Linking Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Internal Link Control Hub</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Build topical authority and distribute link equity with contextually relevant internal links.
            </p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Run Link Analysis
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* KPI STATS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Total Internal Links</span>
              <div className="text-3xl font-black text-neutral-900 mb-1">4,281</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Pages Analyzed</span>
              <div className="text-3xl font-black text-neutral-900 mb-1">142</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Orphan Pages</span>
              <div className="text-3xl font-black text-amber-600 mb-1 flex items-center gap-2">
                2 <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 block">New Opportunities</span>
              <div className="text-3xl font-black text-indigo-700 mb-1">{opportunities.length}</div>
            </div>
          </div>

          {/* ORPHAN PAGES */}
          <section className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Orphan Page Detection
            </h2>
            <div className="space-y-3">
              {orphans.map((orphan, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-neutral-700 bg-white px-2 py-1 rounded border border-neutral-200">{orphan.url}</span>
                    <span className="text-neutral-500">Links: <strong className="text-neutral-900">{orphan.incomingLinks}</strong></span>
                  </div>
                  <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                    {orphan.recommendation}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* NEW OPPORTUNITIES */}
          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-indigo-500" /> Contextual Link Opportunities
            </h2>
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <div key={opp.id} className="bg-white border border-neutral-200 hover:border-indigo-300 rounded-2xl p-6 shadow-sm transition-all flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${
                        opp.impact === 'High' ? 'text-red-700 bg-red-50 border-red-100' : 'text-amber-700 bg-amber-50 border-amber-100'
                      }`}>
                        Priority: {opp.impact}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                        Confidence: {opp.confidence}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-100">
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Source Page</span>
                        <div className="font-mono text-xs text-neutral-700 break-all">{opp.source}</div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Target Page</span>
                        <div className="font-mono text-xs text-indigo-700 font-semibold break-all">{opp.target}</div>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Suggested Anchor</span>
                      <div className="text-sm font-bold text-neutral-900 bg-neutral-100 px-3 py-1.5 rounded-lg inline-block">
                        "{opp.anchor}"
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-bold text-neutral-400 uppercase block mb-1">Reason & Impact</span>
                      <p className="text-sm text-neutral-700">{opp.reason}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 shrink-0 md:w-48">
                    <button 
                      onClick={() => setSelectedOpp(opp)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <GitPullRequest className="w-4 h-4" /> Review & PR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
      
      {/* APPROVAL MODAL */}
      {selectedOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-neutral-100 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 mb-1">Approve Internal Link</h2>
                <p className="text-sm text-neutral-500 font-mono text-xs">{selectedOpp.source} → {selectedOpp.target}</p>
              </div>
              <button onClick={() => setSelectedOpp(null)} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500 transition-colors">
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 bg-[#FAFAFA]">
               <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Evidence</h4>
                  <p className="text-sm text-neutral-800">{selectedOpp.evidence}</p>
               </div>
               <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Placement Context</h4>
                  <p className="text-sm text-neutral-800 mb-3">{selectedOpp.placement}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-red-100 rounded-xl overflow-hidden">
                      <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-[10px] font-bold text-red-700 uppercase tracking-wider">Before</div>
                      <div className="p-3 bg-white text-xs font-mono text-neutral-600">{selectedOpp.before}</div>
                    </div>
                    <div className="border border-emerald-100 rounded-xl overflow-hidden">
                      <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">After</div>
                      <div className="p-3 bg-white text-xs font-mono text-emerald-700 font-bold">{selectedOpp.after}</div>
                    </div>
                  </div>
               </div>
            </div>
            
            <div className="p-6 border-t border-neutral-200 bg-white rounded-b-2xl flex items-center justify-between">
              <button className="px-5 py-2.5 text-xs font-bold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors">
                Reject
              </button>
              <button 
                onClick={() => setSelectedOpp(null)}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                Approve & Execute <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
