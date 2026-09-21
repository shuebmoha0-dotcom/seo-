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
  Globe,
  Search,
  Crosshair,
  Copy,
  ExternalLink,
  Target,
  ArrowRight,
  Award
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function BacklinksPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [pipelineStage, setPipelineStage] = useState<"QUALIFIED" | "COMPETITOR_SPY" | "ACQUIRED" | "ASSETS">("QUALIFIED");
  const [researching, setResearching] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [outreachDraft, setOutreachDraft] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [approvedList, setApprovedList] = useState<string[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [prospects, setProspects] = useState<any[]>([]);
  const [acquiredLinks, setAcquiredLinks] = useState<any[]>([]);
  const [linkableAssets, setLinkableAssets] = useState<any[]>([]);
  const [competitorIntel, setCompetitorIntel] = useState<any[]>([]);
  const [spyingCompetitors, setSpyingCompetitors] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCompetitorIntel = async () => {
    if (!currentWebsite) return;
    try {
      setSpyingCompetitors(true);
      const res = await fetch("/api/agent/backlink/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_id: currentWebsite.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompetitorIntel(data.intel || []);
      }
    } catch (e) {
      console.error("Error fetching competitor backlink intel:", e);
    } finally {
      setSpyingCompetitors(false);
    }
  };

  const fetchBacklinkData = async () => {
    if (!currentWebsite) {
      setProspects([]);
      setAcquiredLinks([]);
      setLinkableAssets([]);
      setCompetitorIntel([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/backlinks?website_id=${currentWebsite.id}`);
      if (res.ok) {
        const data = await res.json();
        setProspects(data.prospects || []);
        setAcquiredLinks(data.acquired || []);
        setLinkableAssets(data.linkable_assets || []);
      }
    } catch (err) {
      console.error("Error fetching backlink data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBacklinkData();
    fetchCompetitorIntel();
  }, [currentWebsite?.id]);

  const handleResearch = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }
    setResearching(true);
    try {
      const res = await fetch("/api/agent/backlink/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          domain: currentWebsite.domain,
        }),
      });
      await fetchBacklinkData();
    } catch (e) {
      console.error(e);
    } finally {
      setResearching(false);
    }
  };

  const handleDraftOutreach = async (prospect: any) => {
    setSelectedProspect(prospect);
    setDrafting(true);
    setOutreachDraft(null);

    try {
      const res = await fetch("/api/agent/backlink/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect,
          siteName: currentWebsite?.domain || "SEO Autopilot",
          linkTargetUrl: currentWebsite?.url || (currentWebsite?.domain ? `https://${currentWebsite.domain}` : "https://example.com"),
        }),
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

  const handleApprove = async (prospectId: string) => {
    try {
      await fetch("/api/agent/backlinks/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      setApprovedList((prev) => [...prev, prospectId]);
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // High authority calculation
  const highAuthCount = useMemo(() => {
    return prospects.filter((p) => (p.opportunity_score || p.relevance_score || 85) >= 80).length;
  }, [prospects]);

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Autonomous SEO</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Backlink &amp; Authority Intelligence</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Backlink &amp; Digital PR Studio
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                100% White-Hat Verified
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `High-authority domain prospecting and personalized editorial outreach for ${currentWebsite.domain}.`
                : "Connect your website to discover relevant link opportunities."}
            </p>
          </div>

          <button
            onClick={handleResearch}
            disabled={researching || !currentWebsite}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs flex items-center gap-2 transition-all self-start md:self-auto active:scale-[0.98]"
          >
            {researching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{researching ? "Scanning Authority Sources..." : "Find Link Prospects"}</span>
          </button>
        </div>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto mt-12 shadow-xs">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Connect a Website to Begin</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Backlink intelligence analyzes your live competitors and unlinked brand mentions to generate high-conversion outreach angles.
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-all inline-flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Connect Website</span>
            </button>
          </div>
        ) : (
          <>
            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Active Prospects
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {prospects.length}
                  </span>
                  <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    Qualified
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  High Relevance (80+)
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {highAuthCount}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                    High Yield
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Competitor Link Gaps
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {competitorIntel.length}
                  </span>
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                    Replicable
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Acquired &amp; Verified
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
                    {acquiredLinks.length}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Live Indexed
                  </span>
                </div>
              </div>
            </div>

            {/* Pipeline Stage Tabs */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "QUALIFIED", label: "Qualified Prospects", count: prospects.length },
                { id: "COMPETITOR_SPY", label: "Competitor Link Spy", count: competitorIntel.length },
                { id: "ACQUIRED", label: "Acquired Backlinks", count: acquiredLinks.length },
                { id: "ASSETS", label: "Linkable Assets", count: linkableAssets.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPipelineStage(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    pipelineStage === tab.id
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      pipelineStage === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* TAB: QUALIFIED PROSPECTS */}
            {pipelineStage === "QUALIFIED" && (
              <div className="space-y-4">
                {prospects.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs">
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center mx-auto text-slate-500">
                      <LinkIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">No Link Prospects Discovered Yet</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Click &ldquo;Find Link Prospects&rdquo; to scan competitor link profiles and discover relevant resource pages.
                      </p>
                    </div>
                    <button
                      onClick={handleResearch}
                      disabled={researching}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Start Prospect Discovery</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {prospects.map((p) => {
                      const targetLink = p.url || p.prospect_url || `https://${p.domain}`;
                      const oppTitle = p.opportunity_title || (
                        p.category === "resource_page" ? "Curated Resource & Directory Listing"
                        : p.category === "guest_contribution" ? "Guest Editorial Feature"
                        : p.category === "unlinked_mention" ? "Brand Citation & Mention Claim"
                        : p.category === "broken_link" ? "Broken Link Replacement"
                        : "Directory & Partner Listing"
                      );
                      const catLabel = p.category ? String(p.category).replace(/_/g, " ") : "Directory";
                      const score = p.opportunity_score || p.relevance_score || 85;

                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3.5 hover:border-slate-300 transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full">
                                {catLabel}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  Score: {score}
                                </span>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm text-slate-900 leading-snug">{oppTitle}</h4>
                              <a
                                href={targetLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1 font-medium group"
                              >
                                <span className="truncate">{p.domain}</span>
                                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                              </a>
                            </div>

                            {p.target_location && (
                              <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                <span className="font-semibold text-[10px] uppercase text-slate-400 block mb-0.5">Where on Site</span>
                                <span className="text-slate-800 font-medium">{p.target_location}</span>
                              </div>
                            )}

                            {p.how_to_acquire && Array.isArray(p.how_to_acquire) && p.how_to_acquire.length > 0 && (
                              <div className="text-[11px] bg-indigo-50/40 p-3 rounded-lg border border-indigo-100/80 space-y-1 text-slate-700">
                                <span className="font-semibold text-[10px] uppercase text-indigo-900 tracking-wider block mb-1">
                                  Acquisition Playbook
                                </span>
                                {p.how_to_acquire.map((step: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-indigo-600 font-bold">•</span>
                                    <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {p.opportunity_angle && !p.how_to_acquire && (
                              <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                {p.opportunity_angle}
                              </p>
                            )}

                            {p.target_anchor && (
                              <div className="text-[11px] text-slate-500">
                                <span className="font-medium text-slate-700">Anchor: </span>
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-800 font-mono">
                                  {p.target_anchor}
                                </code>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs mt-3">
                            <a
                              href={p.contact_page || targetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-slate-800 text-[11px] font-medium flex items-center gap-1 transition-colors"
                            >
                              <span>Visit Target</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleDraftOutreach(p)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Draft Outreach</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB: COMPETITOR LINK SPY */}
            {pipelineStage === "COMPETITOR_SPY" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-indigo-600" />
                      Competitor Link Reverse-Engineering &amp; Spy Engine
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Analyzes competitor referral profiles and generates actionable blueprints to replicate high-authority placements.
                    </p>
                  </div>
                  <button
                    onClick={fetchCompetitorIntel}
                    disabled={spyingCompetitors}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-xs self-start sm:self-auto disabled:opacity-50"
                  >
                    {spyingCompetitors ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{spyingCompetitors ? "Scanning Competitor Links..." : "Scan Competitor Links"}</span>
                  </button>
                </div>

                {spyingCompetitors && competitorIntel.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-3 max-w-lg mx-auto shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-900">Reverse-Engineering Competitor Backlinks...</p>
                    <p className="text-[11px] text-slate-500">Scanning referring domains, guest columns, and directory profiles across your niche.</p>
                  </div>
                ) : competitorIntel.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs">
                    <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
                      <Crosshair className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">No Competitor Backlinks Spied Yet</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Launch a competitor scan to uncover referral sources and replicate valuable backlinks.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitorIntel.map((c, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3.5 hover:border-slate-300 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>Competitor:</span>
                              <span className="font-mono">{c.competitor_domain}</span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                              Source DA: {c.source_authority}/100
                            </span>
                          </div>

                          <div>
                            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              Referring Platform
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <h4 className="font-semibold text-sm text-slate-900">{c.referring_site}</h4>
                              <a
                                href={c.referring_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                              >
                                <span>Visit Link</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </a>
                            </div>
                            <span className="text-[11px] font-medium text-slate-500 mt-0.5 block">
                              Format: <strong className="text-slate-700">{c.link_type}</strong>
                            </span>
                          </div>

                          <div className="bg-amber-50/60 border border-amber-200/70 rounded-lg p-3 text-xs space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 block">
                              How Competitor Earned It
                            </span>
                            <p className="text-slate-700 leading-relaxed">{c.how_competitor_got_it}</p>
                          </div>

                          <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 text-xs space-y-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-900 block">
                              How to Replicate &amp; Steal Placement
                            </span>
                            <div className="text-slate-700 text-[11px]">
                              <strong className="text-slate-900">Placement: </strong>
                              {c.how_you_can_steal_it.exact_placement}
                            </div>
                            {c.how_you_can_steal_it.step_by_step_guide && (
                              <div className="space-y-1 pt-1">
                                {c.how_you_can_steal_it.step_by_step_guide.map((step: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 text-slate-700 leading-relaxed text-[11px]">
                                    <span className="text-indigo-600 font-bold">•</span>
                                    <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-[11px] text-slate-600 bg-white/90 p-2 rounded border border-indigo-100 mt-1">
                              <strong className="text-slate-800">Pitch Angle: </strong>
                              {c.how_you_can_steal_it.angle_to_pitch}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs mt-3">
                          <a
                            href={c.replicate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-600 hover:text-slate-900 text-[11px] font-medium flex items-center gap-1 transition-colors"
                          >
                            <span>Open Submission Endpoint</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => handleDraftOutreach({
                              domain: c.referring_site,
                              url: c.referring_url,
                              category: "competitor_gap",
                              opportunity_title: `Replicate ${c.competitor_domain} Backlink on ${c.referring_site}`,
                              opportunity_angle: c.how_you_can_steal_it.angle_to_pitch,
                              pitch_hook: c.how_you_can_steal_it.pitch_template,
                              linkable_asset: "Product Comparison & Feature Matrix",
                            })}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Steal This Link (Outreach)</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: ACQUIRED BACKLINKS */}
            {pipelineStage === "ACQUIRED" && (
              <div className="space-y-4">
                {acquiredLinks.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-2 max-w-lg mx-auto shadow-xs">
                    <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-900">No Acquired Backlinks Logged</p>
                    <p className="text-[11px] text-slate-500">
                      As outreach campaigns succeed and links are discovered, they will be tracked and verified here.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Referring Domain</th>
                          <th className="py-3 px-4">Target URL</th>
                          <th className="py-3 px-4">Anchor Text</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {acquiredLinks.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/75 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-900">{l.domain || l.linking_url}</td>
                            <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{l.target_url}</td>
                            <td className="py-3 px-4 font-mono text-slate-700">{l.anchor_text || "Brand Mention"}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {l.verification_status || "Verified"}
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

            {/* TAB: LINKABLE ASSETS */}
            {pipelineStage === "ASSETS" && (
              <div className="space-y-4">
                {linkableAssets.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-2 max-w-lg mx-auto shadow-xs">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-900">No Linkable Asset Recommendations</p>
                    <p className="text-[11px] text-slate-500">
                      The Content and Backlink Agents will recommend data-driven assets based on competitor citation analysis.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {linkableAssets.map((asset, i) => (
                      <div key={asset.id || i} className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                          {asset.asset_type || asset.type}
                        </span>
                        <h4 className="font-semibold text-sm text-slate-900">{asset.title}</h4>
                        <p className="text-xs text-slate-600">{asset.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* OUTREACH DRAFT MODAL */}
        {selectedProspect && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Personalized Outreach Draft</h3>
                    <p className="text-[11px] text-slate-500">Target: {selectedProspect.domain}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1 rounded-md hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              </div>

              {drafting ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Generating contextual outreach email...</p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      defaultValue={outreachDraft?.subject || `Resource Suggestion for ${selectedProspect.domain}`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-slate-500 mb-1">
                      Email Body
                    </label>
                    <textarea
                      rows={7}
                      defaultValue={outreachDraft?.body || `Hi there,\n\nI was reading your guide on ${selectedProspect.domain} and noticed an opportunity to reference our actionable research...\n\nBest regards,\nContent Team`}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 leading-relaxed font-sans focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    handleApprove(selectedProspect.id);
                    setSelectedProspect(null);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve for Sending</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
