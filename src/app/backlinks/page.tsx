"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Link as LinkIcon,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Mail,
  RefreshCw,
  Plus,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";

export default function BacklinksPage() {
  const [pipelineStage, setPipelineStage] = useState("QUALIFIED");
  const [researching, setResearching] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [outreachDraft, setOutreachDraft] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [approvedList, setApprovedList] = useState<string[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const prospects = [
    {
      id: "p_1",
      domain: "techradar.com",
      url: "https://techradar.com/best-saas-tools-2026",
      category: "Resource Page",
      relevance_score: 92,
      quality_score: 88,
      opportunity_score: 95,
      risk_score: 8, // Low risk
      priority: "high",
      editor: "Sarah Jenkins (Editor)",
    },
    {
      id: "p_2",
      domain: "capterra.com",
      url: "https://capterra.com/project-management-software",
      category: "Competitor Gap",
      relevance_score: 95,
      quality_score: 94,
      opportunity_score: 90,
      risk_score: 5,
      priority: "high",
      editor: "Capterra Review Team",
    },
    {
      id: "p_3",
      domain: "dev.to",
      url: "https://dev.to/top-engineering-tools-2026",
      category: "Unlinked Mention",
      relevance_score: 84,
      quality_score: 79,
      opportunity_score: 88,
      risk_score: 12,
      priority: "medium",
      editor: "Community Author",
    },
  ];

  const acquiredLinks = [
    {
      id: "l_1",
      domain: "github.com",
      linking_url: "https://github.com/awesome-saas/tools",
      target_url: "https://my-saas-company.com",
      anchor_text: "Acme SEO Agent",
      is_dofollow: true,
      status: "verified",
      discovered_at: "May 14, 2025",
    },
    {
      id: "l_2",
      domain: "producthunt.com",
      linking_url: "https://producthunt.com/posts/acme-seo",
      target_url: "https://my-saas-company.com",
      anchor_text: "Autonomous SEO Agent",
      is_dofollow: true,
      status: "verified",
      discovered_at: "May 20, 2025",
    },
  ];

  const linkableAssets = [
    {
      title: "2026 SaaS Productivity & SEO Benchmark Report",
      type: "Industry Statistics",
      rationale: "Competitors have 34 backlinks from tech sites pointing to statistics pages. Creating this asset will attract high-authority citations.",
      competitorLinks: 34,
    },
    {
      title: "Free Interactive Velocity & Sprint Calculator",
      type: "Free Tool",
      rationale: "18 resource directories link to free calculators. Building this tool earns recurring passive backlinks.",
      competitorLinks: 18,
    },
  ];

  const handleResearch = async () => {
    setResearching(true);
    try {
      await fetch("/api/agent/backlink/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: "demo-id" }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setResearching(false);
    }
  };

  const handleOpenDraftModal = async (prospect: any) => {
    setSelectedProspect(prospect);
    setDrafting(true);
    try {
      const res = await fetch("/api/agent/backlink/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospect }),
      });
      if (res.ok) {
        const data = await res.json();
        setOutreachDraft(data.draft);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDrafting(false);
    }
  };

  const handleApproveOutreach = () => {
    if (selectedProspect) {
      setApprovedList([...approvedList, selectedProspect.id]);
      setSelectedProspect(null);
      setOutreachDraft(null);
    }
  };

  const handleReverify = async (id: string) => {
    setVerifyingId(id);
    setTimeout(() => {
      setVerifyingId(null);
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/30">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <span>&gt;</span>
              <span className="text-neutral-200">Backlink Agent</span>
            </div>
            <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
              Backlink Agent Control Hub
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              High-integrity, relevance-first link building. Strictly zero spam, zero PBNs. Human approval required.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Spam Protection Active
            </div>
            <button
              onClick={handleResearch}
              disabled={researching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center gap-2"
            >
              {researching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Run Backlink Gap Research
            </button>
          </div>
        </div>

        {/* 10-Stage Pipeline Tabs */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4 mb-8">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-widest block mb-3">Backlink Pipeline Lifecycle</span>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {[
              "IDENTIFIED", "QUALIFIED", "OUTREACH_DRAFTED", "APPROVED",
              "CONTACTED", "REPLIED", "NEGOTIATING", "LINK_ACQUIRED",
              "LINK_VERIFIED"
            ].map((stage) => (
              <button
                key={stage}
                onClick={() => setPipelineStage(stage)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  pipelineStage === stage
                    ? "bg-indigo-600 text-white font-semibold shadow-md"
                    : "bg-white text-neutral-500 hover:text-neutral-200 border border-neutral-200"
                }`}
              >
                {stage.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          {/* Prospects List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900 text-base">Qualified High-Value Prospects</h3>
              <span className="text-xs text-neutral-500">{prospects.length} Opportunities Evaluated</span>
            </div>

            <div className="space-y-4">
              {prospects.map((prospect) => {
                const isApproved = approvedList.includes(prospect.id);
                return (
                  <div key={prospect.id} className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4 hover:border-neutral-200 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-neutral-900 text-sm">{prospect.domain}</h4>
                          <span className="text-[10px] bg-indigo-50 text-indigo-300 border border-indigo-200 px-2 py-0.5 rounded font-medium">
                            {prospect.category}
                          </span>
                        </div>
                        <a href={prospect.url} target="_blank" rel="noreferrer" className="text-xs text-neutral-500 hover:text-indigo-600 underline mt-0.5 block">
                          {prospect.url}
                        </a>
                      </div>

                      <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded bg-red-50 text-red-600 border border-red-200">
                        Priority: {prospect.priority}
                      </span>
                    </div>

                    {/* Multi-Dimensional Score Cards */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="bg-white p-2 rounded-xl border border-neutral-200">
                        <span className="text-[9px] text-neutral-500 block uppercase font-medium">Relevance</span>
                        <span className="font-bold text-emerald-600">{prospect.relevance_score}%</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-neutral-200">
                        <span className="text-[9px] text-neutral-500 block uppercase font-medium">Quality</span>
                        <span className="font-bold text-indigo-600">{prospect.quality_score}%</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-neutral-200">
                        <span className="text-[9px] text-neutral-500 block uppercase font-medium">Opportunity</span>
                        <span className="font-bold text-purple-600">{prospect.opportunity_score}%</span>
                      </div>
                      <div className="bg-white p-2 rounded-xl border border-neutral-200">
                        <span className="text-[9px] text-neutral-500 block uppercase font-medium">Risk Score</span>
                        <span className="font-bold text-emerald-600">{prospect.risk_score}% (Low)</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                      <span className="text-xs text-neutral-500">Contact: <strong className="text-neutral-200">{prospect.editor}</strong></span>

                      {isApproved ? (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Outreach Approved &amp; Queued
                        </span>
                      ) : (
                        <button
                          onClick={() => handleOpenDraftModal(prospect)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                        >
                          <Mail className="w-3.5 h-3.5" /> Review Personalized Outreach
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Linkable Assets Recommendations Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Linkable Asset Recommendations
                </h3>
              </div>
              <p className="text-xs text-neutral-500">
                The Backlink Agent analyzes competitor link clusters and suggests assets for the Strategy &amp; Content Agents to create.
              </p>

              <div className="space-y-3">
                {linkableAssets.map((asset, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-semibold text-neutral-900 text-xs">{asset.title}</h4>
                      <span className="text-[10px] bg-purple-50 text-purple-300 border border-purple-200 px-2 py-0.5 rounded font-medium shrink-0">
                        {asset.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500">{asset.rationale}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200 text-[10px]">
                      <span className="text-indigo-600 font-medium">🎯 {asset.competitorLinks} Competitor Links Targetable</span>
                      <button className="text-indigo-600 hover:underline font-semibold">Request Content Agent →</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backlink Verification Monitor */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
              <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Acquired Backlink Health Monitor
              </h3>
              <div className="space-y-3">
                {acquiredLinks.map((link) => (
                  <div key={link.id} className="bg-white p-3 rounded-xl border border-neutral-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-indigo-600" /> {link.domain}
                      </span>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[10px] px-2 py-0.5 rounded font-bold">
                        VERIFIED DOFOLOOW
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500">Anchor: <span className="text-neutral-200">"{link.anchor_text}"</span></p>
                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200 text-[10px] text-neutral-500">
                      <span>Discovered: {link.discovered_at}</span>
                      <button
                        onClick={() => handleReverify(link.id)}
                        className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                      >
                        {verifyingId === link.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {verifyingId === link.id ? "Crawling Link..." : "Re-verify Link"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Human Approval & Outreach Modal */}
        {selectedProspect && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-6 max-w-lg w-full space-y-6 shadow-2xl relative">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Review Outreach Draft</h3>
                  <p className="text-xs text-neutral-500">Target: {selectedProspect.domain}</p>
                </div>
                <button onClick={() => setSelectedProspect(null)} className="p-1 text-neutral-500 hover:text-neutral-900">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {drafting ? (
                <div className="py-12 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                  <p className="text-xs text-neutral-500">Agent researching prospect context &amp; drafting personalized outreach...</p>
                </div>
              ) : outreachDraft ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Subject</label>
                    <input
                      type="text"
                      value={outreachDraft.subject}
                      onChange={(e) => setOutreachDraft({ ...outreachDraft, subject: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-xl py-2 px-3 text-xs text-neutral-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Message Body</label>
                    <textarea
                      rows={6}
                      value={outreachDraft.body}
                      onChange={(e) => setOutreachDraft({ ...outreachDraft, body: e.target.value })}
                      className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs text-neutral-200 focus:outline-none font-sans leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-4 border-t border-neutral-200">
                    <button
                      onClick={() => setSelectedProspect(null)}
                      className="px-4 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApproveOutreach}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Approve &amp; Queue Outreach
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
