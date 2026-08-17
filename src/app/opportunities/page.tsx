"use client";

import { Sidebar } from "@/components/Sidebar";
import { OpportunityCard } from "@/components/OpportunityCard";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";
import { Zap, Globe, Plus, Sparkles, Loader2, CheckCircle2 } from "lucide-react";

export default function OpportunitiesPage() {
  const { currentWebsite, openAddModal } = useWebsite();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOpportunities() {
      if (!currentWebsite) {
        setOpportunities([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`/api/opportunities?website_id=${currentWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          setOpportunities(data.opportunities || []);
        }
      } catch (err) {
        console.error("Error fetching opportunities:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOpportunities();
  }, [currentWebsite?.id]);

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>Agent &amp; Automation</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Opportunities</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              High-Impact SEO Opportunities
            </h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              {currentWebsite
                ? `Prioritized action items autonomously discovered for ${currentWebsite.domain}.`
                : "Connect your website to generate SEO opportunities."}
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
              <h3 className="text-base font-bold text-neutral-900">Connect your website to discover opportunities</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Autonomous agents analyze your crawl data, search positions, and competitors to generate real recommendations.
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
        ) : opportunities.length === 0 && !loading ? (
          /* ── STATE 2: WEBSITE CONNECTED BUT NO OPPORTUNITIES GENERATED YET ── */
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">No active opportunities queued</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                No high-priority issues detected for <span className="font-semibold text-neutral-800">{currentWebsite.domain}</span>. Run an SEO audit from the dashboard to discover new items.
              </p>
            </div>
          </div>
        ) : (
          /* ── STATE 3: REAL OPPORTUNITIES ── */
          <div className="grid grid-cols-1 gap-6">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
