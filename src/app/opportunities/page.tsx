"use client";

import { Sidebar } from "@/components/Sidebar";
import { OpportunityCard } from "@/components/OpportunityCard";

export default function OpportunitiesPage() {
  const allOpportunities = [
    {
      id: "opt_1",
      problem: 'Homepage ranks for "project management software" but has poor CTR.',
      evidence: "Average position 6.2 | Impressions 18,400 | CTR 1.4%",
      recommended_action: "Test a stronger title and meta description aligned with search intent.",
      expected_impact: "Increase CTR to ~3%, driving ~300 extra visitors/month.",
      confidence: "high" as const,
      effort: "low" as const,
      risk: "low" as const,
      priority: "high" as const,
      diff_before: "Project Management Software | Company",
      diff_after: "Project Management Software for Modern Teams | Company",
    },
    {
      id: "opt_2",
      problem: "Pricing page lacks product feature schema.",
      evidence: "0 rich snippets shown in SERPs for pricing queries.",
      recommended_action: "Add structured data JSON-LD for Product and Offer.",
      expected_impact: "Eligible for rich snippets, improving visual SERP presence.",
      confidence: "high" as const,
      effort: "medium" as const,
      risk: "low" as const,
      priority: "medium" as const,
      diff_before: "<script></script>",
      diff_after: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product"}</script>`,
    },
    {
      id: "opt_3",
      problem: "Blog posts missing internal links to high-intent product pages.",
      evidence: "12 blog posts rank in top 10 but have 0 internal links to /pricing.",
      recommended_action: "Add contextual anchor links to /pricing in key article sections.",
      expected_impact: "Pass PageRank authority and increase free trial conversions.",
      confidence: "high" as const,
      effort: "low" as const,
      risk: "low" as const,
      priority: "high" as const,
      diff_before: "Learn more about our tools.",
      diff_after: "Learn more about our tools on our <a href='/pricing'>pricing page</a>.",
    }
  ];

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
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Prioritized SEO Opportunities</h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              Review and approve agent recommendations to open Pull Requests on your GitHub repository.
            </p>
          </div>

          <div className="bg-indigo-50 border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-semibold">
            {allOpportunities.length} Pending Approval
          </div>
        </header>

        <div className="space-y-6">
          {allOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} />
          ))}
        </div>
      </div>
    </div>
  );
}
