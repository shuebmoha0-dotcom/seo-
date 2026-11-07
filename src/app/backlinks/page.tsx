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
  const [executionPayload, setExecutionPayload] = useState<any | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [executingAcquisition, setExecutingAcquisition] = useState(false);
  const [buildingAssetFor, setBuildingAssetFor] = useState<string | null>(null);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);
  const [approvedList, setApprovedList] = useState<string[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const [prospects, setProspects] = useState<any[]>([]);
  const [acquiredLinks, setAcquiredLinks] = useState<any[]>([]);
  const [linkableAssets, setLinkableAssets] = useState<any[]>([]);
  const [competitorIntel, setCompetitorIntel] = useState<any[]>([]);
  const [targetCompetitor, setTargetCompetitor] = useState<string>("");
  const [replicationPlaybooks, setReplicationPlaybooks] = useState<any[]>([]);
  const [copiedPitchIndex, setCopiedPitchIndex] = useState<number | null>(null);
  const [spyingCompetitors, setSpyingCompetitors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [siteType, setSiteType] = useState<string>("blog");
  const [primaryNiche, setPrimaryNiche] = useState<string>("");

  const fetchCompetitorIntel = async (competitorOverride?: string) => {
    if (!currentWebsite) return;
    const compDomain = competitorOverride !== undefined ? competitorOverride : targetCompetitor.trim();
    if (competitorOverride !== undefined) {
      setTargetCompetitor(competitorOverride);
    }
    try {
      setSpyingCompetitors(true);
      const res = await fetch("/api/agent/backlink/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          competitor_domain: compDomain || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompetitorIntel(data.intel || []);
        if (data.replication?.playbooks) {
          setReplicationPlaybooks(data.replication.playbooks);
        }
        if (data.site_type) setSiteType(data.site_type);
        if (data.niche) setPrimaryNiche(data.niche);
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
        if (data.site_type) setSiteType(data.site_type);
        if (data.primary_niche) setPrimaryNiche(data.primary_niche);
      }
    } catch (err) {
      console.error("Error fetching backlink data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setProspects([]);
    setAcquiredLinks([]);
    setLinkableAssets([]);
    setCompetitorIntel([]);
    setSelectedProspect(null);
    setOutreachDraft(null);
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
          batch_size: 15,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          setExecutionNotice(data.summary);
          setTimeout(() => setExecutionNotice(null), 6000);
        }
      }
      await fetchBacklinkData();
    } catch (e) {
      console.error(e);
    } finally {
      setResearching(false);
    }
  };

  const handleMonitorAndVerifyAll = async () => {
    if (!currentWebsite) return;
    setVerifyingId("all");
    try {
      const res = await fetch("/api/agent/backlink/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExecutionNotice(
          data.monitor_result?.summary ||
            "Monitored all acquired backlinks and scanned for new link opportunities."
        );
        setTimeout(() => setExecutionNotice(null), 6000);
      }
      await fetchBacklinkData();
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteProspect = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/backlinks?id=${id}`, { method: "DELETE" });
      setProspects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete prospect:", err);
    }
  };

  const handleClearAll = async () => {
    if (!currentWebsite) return;
    try {
      setResearching(true);
      await fetch(`/api/backlinks?website_id=${currentWebsite.id}`, { method: "DELETE" });
      setProspects([]);
      await handleResearch();
    } catch (err) {
      console.error(err);
      setResearching(false);
    }
  };

  const isDirectoryDomain = (domain?: string) => {
    const clean = (domain || "").toLowerCase().replace(/^www\./, "");
    return /producthunt\.com|saashub\.com|betalist\.com|alternativeto\.net|g2\.com|capterra\.com|theresanaiforthat\.com|futurepedia\.io|toolify\.ai|indiehackers\.com|crunchbase\.com|f6s\.com|sourceforge\.net/i.test(clean);
  };

  const handleDraftOutreach = async (prospect: any) => {
    setSelectedProspect(prospect);
    setDrafting(true);
    setOutreachDraft(null);
    setExecutionPayload(null);

    try {
      const res = await fetch("/api/agent/backlink/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect,
          website_id: currentWebsite?.id,
          action_mode: "prepare",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExecutionPayload(data);
        if (data.draft) {
          setOutreachDraft(data.draft);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDrafting(false);
    }
  };

  const handleCompleteAcquisition = async (prospect: any) => {
    if (!currentWebsite) return;
    setExecutingAcquisition(true);
    try {
      const res = await fetch("/api/agent/backlink/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect,
          website_id: currentWebsite.id,
          action_mode: "complete_acquisition",
          submission_data: executionPayload?.directory_kit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.acquired) {
          setAcquiredLinks((prev) => [data.acquired, ...prev]);
        }
        if (prospect.id) {
          setProspects((prev) => prev.filter((p) => p.id !== prospect.id));
        }
        setExecutionNotice(data.message || `Backlink on ${prospect.domain} executed and logged to Acquired Backlinks!`);
        setTimeout(() => setExecutionNotice(null), 6000);
        setSelectedProspect(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExecutingAcquisition(false);
    }
  };

  const handleBuildCitationMagnet = async (prospect: any) => {
    if (!currentWebsite) return;
    const key = prospect.id || prospect.domain;
    setBuildingAssetFor(key);
    try {
      const res = await fetch("/api/agent/backlink/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospect,
          website_id: currentWebsite.id,
          action_mode: "build_citation_magnet",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setExecutionNotice(`Citation Magnet Asset Created for ${prospect.domain}! Check Content Planner to review & publish.`);
        setTimeout(() => setExecutionNotice(null), 7000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBuildingAssetFor(null);
    }
  };

  const handleApprove = async (prospectId: string) => {
    if (selectedProspect) {
      await handleCompleteAcquisition(selectedProspect);
    }
    setApprovedList((prev) => [...prev, prospectId]);
  };

  // Empirical calculation: only count if opportunity_score or relevance_score exists and >= 80
  const highAuthCount = useMemo(() => {
    return prospects.filter((p) => {
      const score = p.opportunity_score ?? p.relevance_score;
      return typeof score === "number" && score >= 80;
    }).length;
  }, [prospects]);

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0">
        <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 space-y-6">
          {/* Header */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Research</span>
                <span className="text-neutral-300">/</span>
                <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Backlinks</span>
              </div>
              <h1 className="text-[22px] leading-7 font-semibold text-neutral-900">
                Backlinks &amp; Digital PR
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className="text-neutral-500 text-sm">
                  {currentWebsite
                    ? `High-authority domain prospecting and personalized editorial outreach for ${currentWebsite.domain}`
                    : "Connect a website to discover relevant link opportunities."}
                </p>
                {currentWebsite && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    siteType === 'blog'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {siteType === 'blog' ? 'Editorial Blog / Publisher' : 'SaaS Software Platform'}
                    {primaryNiche ? ` · ${primaryNiche}` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentWebsite && (
                <>
                  <button
                    onClick={handleMonitorAndVerifyAll}
                    disabled={verifyingId === "all"}
                    title="Crawl and verify all acquired backlinks & scan new opportunities"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 text-[13px] font-medium text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:text-neutral-900 transition-colors disabled:opacity-60"
                  >
                    <ShieldCheck className={`w-3.5 h-3.5 text-emerald-600 ${verifyingId === 'all' ? 'animate-pulse' : ''}`} />
                    <span>{verifyingId === "all" ? "Monitoring links…" : "Monitor & Verify Links"}</span>
                  </button>

                  <button
                    onClick={handleResearch}
                    disabled={researching}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-3 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-60"
                  >
                    {researching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{researching ? "Discovering new batch…" : "Discover +15 New Backlinks"}</span>
                  </button>
                </>
              )}
            </div>
          </header>

          {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
          {!currentWebsite ? (
            <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-200 bg-white p-10 text-center shadow-2xs">
              <Globe className="mx-auto h-6 w-6 text-neutral-400" strokeWidth={1.5} />
              <h3 className="mt-4 text-base font-semibold text-neutral-900">Connect a website to begin</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">
                Backlink intelligence analyzes your live competitors and unlinked brand mentions to generate high-conversion outreach angles.
              </p>
              <button
                onClick={openAddModal}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-indigo-700 bg-indigo-600 px-4 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                <span>Add website</span>
              </button>
            </div>
          ) : (
            <>
              {/* 100-Backlink Growth Goal & Daily Autonomous Monitor Banner */}
              <section className="rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/70 via-white to-emerald-50/50 p-4 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white">
                        <Target className="w-3 h-3" />
                        100-Backlink Growth Roadmap
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Autonomous Daily Discovery &amp; Link Monitor Active
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600">
                      A growing domain requires <strong>100+ authoritative backlinks</strong> to dominate organic rankings. The agent automatically discovers new unique referring domains every 24 hours and whenever a new article is published, while continuously monitoring your acquired links.
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end shrink-0 min-w-[220px]">
                    <div className="flex items-center justify-between w-full text-xs font-semibold text-neutral-800 mb-1.5">
                      <span>Pipeline Progress</span>
                      <span className="font-mono text-indigo-700">
                        {prospects.length + acquiredLinks.length} / 100 Backlinks
                      </span>
                    </div>
                    <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(4, prospects.length + acquiredLinks.length))}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-neutral-500 mt-1">
                      {prospects.length} ready to execute · {acquiredLinks.length} acquired &amp; monitored
                    </span>
                  </div>
                </div>
              </section>
              {/* Stat strip */}
              <section aria-label="Key metrics" className="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-white lg:grid-cols-4 shadow-2xs">
                <div className="p-5">
                  <div className="text-[13px] text-neutral-500">Active prospects</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{prospects.length}</div>
                  <div className="mt-1.5 text-xs text-neutral-500">Qualified targets</div>
                </div>

                <div className="p-5 border-l border-neutral-200">
                  <div className="text-[13px] text-neutral-500">High relevance (80+)</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{highAuthCount}</div>
                  <div className="mt-1.5 text-xs text-neutral-500">High-yield authority domains</div>
                </div>

                <div className="p-5 border-t border-neutral-200 lg:border-t-0 lg:border-l">
                  <div className="text-[13px] text-neutral-500">Competitor link gaps</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{competitorIntel.length}</div>
                  <div className="mt-1.5 text-xs text-neutral-500">Replicable backlink targets</div>
                </div>

                <div className="p-5 border-l border-t border-neutral-200 lg:border-t-0">
                  <div className="text-[13px] text-neutral-500">Acquired &amp; verified</div>
                  <div className="mt-1.5 text-[28px] font-semibold leading-8 tabular-nums text-neutral-900">{acquiredLinks.length}</div>
                  <div className="mt-1.5 text-xs text-neutral-500">Live indexed backlinks</div>
                </div>
              </section>

              {/* Segmented Control Tabs */}
              <div className="flex items-center overflow-hidden rounded-md border border-neutral-300 bg-white shadow-2xs self-start">
                {[
                  { id: "QUALIFIED", label: `Qualified Prospects (${prospects.length})` },
                  { id: "COMPETITOR_SPY", label: `Competitor Link Spy (${competitorIntel.length})` },
                  { id: "ACQUIRED", label: `Acquired Backlinks (${acquiredLinks.length})` },
                  { id: "ASSETS", label: `Linkable Assets (${linkableAssets.length})` },
                ].map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPipelineStage(tab.id as any)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                      i > 0 ? "border-l border-neutral-300" : ""
                    } ${
                      pipelineStage === tab.id
                        ? "bg-[#e8f0fe] text-[#1967d2] font-semibold"
                        : "text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {pipelineStage === tab.id && <Check className="h-3 w-3 text-[#1967d2] stroke-[3]" />}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

            {/* TAB: QUALIFIED PROSPECTS */}
            {pipelineStage === "QUALIFIED" && (
              <div className="space-y-4">
                {prospects.length === 0 && !loading ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-4 max-w-lg mx-auto shadow-xs">
                    <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 rounded-lg flex items-center justify-center mx-auto text-neutral-500">
                      <LinkIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">No Link Prospects Discovered Yet</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
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
                      const score = p.opportunity_score ?? p.relevance_score ?? "—";

                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3.5 hover:border-neutral-300 transition-all flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                {catLabel}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-mono font-semibold text-neutral-700 bg-neutral-50 px-2 py-0.5 rounded border border-neutral-200">
                                  Score: {score}
                                </span>
                                {p.id && (
                                  <button
                                    onClick={(e) => handleDeleteProspect(p.id, e)}
                                    title="Dismiss prospect"
                                    className="text-neutral-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-neutral-100"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-semibold text-sm text-neutral-900 leading-snug">{oppTitle}</h4>
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
                              <div className="text-[11px] text-neutral-600 bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200">
                                <span className="font-semibold text-[10px] uppercase text-neutral-400 block mb-0.5">Where on Site</span>
                                <span className="text-neutral-800 font-medium">{p.target_location}</span>
                              </div>
                            )}

                            {p.how_to_acquire && Array.isArray(p.how_to_acquire) && p.how_to_acquire.length > 0 && (
                              <div className="text-[11px] bg-indigo-50/40 p-3 rounded-lg border border-indigo-100 space-y-1 text-neutral-700">
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
                              <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200">
                                {p.opportunity_angle}
                              </p>
                            )}

                            {p.target_anchor && (
                              <div className="text-[11px] text-neutral-500">
                                <span className="font-medium text-neutral-700">Anchor: </span>
                                <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-[10px] text-neutral-800 font-mono">
                                  {p.target_anchor}
                                </code>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs mt-3 gap-2">
                            <a
                              href={p.contact_page || targetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-500 hover:text-neutral-800 text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0"
                            >
                              <span>{isDirectoryDomain(p.domain) ? "Submission Portal" : "Visit Target"}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                            <div className="flex items-center gap-1.5">
                              {!isDirectoryDomain(p.domain) && (
                                <button
                                  onClick={() => handleBuildCitationMagnet(p)}
                                  disabled={buildingAssetFor === (p.id || p.domain)}
                                  title="Autonomously draft a Citation Magnet Benchmark Report tailored to win this link"
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold px-2.5 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                                >
                                  {buildingAssetFor === (p.id || p.domain) ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3 h-3" />
                                  )}
                                  <span>Build Asset</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDraftOutreach(p)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                              >
                                {isDirectoryDomain(p.domain) ? (
                                  <>
                                    <Sparkles className="w-3 h-3" />
                                    <span>Submit &amp; Claim Profile</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3 h-3" />
                                    <span>Execute Acquisition</span>
                                  </>
                                )}
                              </button>
                            </div>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-indigo-600" />
                      Competitor Link Replicator &amp; Reverse-Engineering Engine
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Enter any competitor domain to extract their exact backlink profile, step-by-step acquisition plans, and ready-to-send pitch emails.
                    </p>
                  </div>
                </div>

                {/* Competitor Domain Search Bar & Quick Chips */}
                <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={targetCompetitor}
                        onChange={(e) => setTargetCompetitor(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") fetchCompetitorIntel();
                        }}
                        placeholder="Enter competitor domain (e.g. lemlist.com, ahrefs.com, zapier.com)..."
                        className="w-full bg-neutral-50 border border-neutral-300 rounded-lg pl-10 pr-3 py-2 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-indigo-600 transition-colors"
                      />
                    </div>
                    <button
                      onClick={() => fetchCompetitorIntel()}
                      disabled={spyingCompetitors}
                      className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-lg transition-all shadow-xs shrink-0"
                    >
                      {spyingCompetitors ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                      <span>{spyingCompetitors ? "Replicating..." : "Spy & Replicate Backlinks"}</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-neutral-500">
                    <span className="font-semibold text-neutral-700">Quick Competitor Suggestions:</span>
                    {[
                      "lemlist.com",
                      "woodpecker.co",
                      "ahrefs.com",
                      "surferseo.com",
                      "zapier.com"
                    ].map((comp) => (
                      <button
                        key={comp}
                        disabled={spyingCompetitors}
                        onClick={() => fetchCompetitorIntel(comp)}
                        className="bg-neutral-100 hover:bg-indigo-50 hover:text-indigo-700 text-neutral-700 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                      >
                        + {comp}
                      </button>
                    ))}
                  </div>
                </div>

                {spyingCompetitors ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-3 max-w-lg mx-auto shadow-xs">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-neutral-900">Reverse-Engineering Competitor Backlinks...</p>
                    <p className="text-[11px] text-neutral-500">
                      Analyzing competitor placement patterns, authority tiers, and generating personalized pitch blueprints.
                    </p>
                  </div>
                ) : replicationPlaybooks.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-700">
                        Showing {replicationPlaybooks.length} Replicable Competitor Playbooks
                      </span>
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium">
                        Verified Live URLs &amp; Pitch Templates
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {replicationPlaybooks.map((p, i) => {
                        const isCopied = copiedPitchIndex === i;
                        const fullPitchText = `Subject: ${p.replication_strategy?.outreach_subject_line || ""}\n\n${p.replication_strategy?.outreach_pitch_body || ""}\n\nFollow-Up (3 days):\n${p.replication_strategy?.follow_up_sequence || ""}`;

                        return (
                          <div
                            key={i}
                            className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4 hover:border-neutral-300 transition-all flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                  <span>Competitor:</span>
                                  <span className="font-mono">{p.competitor_domain}</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${
                                    p.difficulty_to_acquire === 'easy'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : p.difficulty_to_acquire === 'moderate'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}>
                                    {p.difficulty_to_acquire}
                                  </span>
                                  <span className="text-xs font-mono font-semibold text-neutral-700 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded">
                                    DA: {p.source_authority}/100
                                  </span>
                                </div>
                              </div>

                              <div>
                                <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                  Referring Site &amp; Format
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <h4 className="font-semibold text-sm text-neutral-900">{p.referring_site}</h4>
                                  <a
                                    href={p.referring_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                                  >
                                    <span>Visit Site</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                                <span className="text-[11px] font-medium text-neutral-500 mt-0.5 block">
                                  Format: <strong className="text-neutral-700">{p.link_type}</strong> · Turnaround: <strong className="text-neutral-700">{p.estimated_turnaround}</strong>
                                </span>
                              </div>

                              <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 block">
                                  Why Competitor Got This Link
                                </span>
                                <p className="text-neutral-700 leading-relaxed text-[11px]">{p.how_competitor_got_it}</p>
                              </div>

                              {/* 3-Step Acquisition Plan */}
                              {p.replication_strategy?.step_by_step_acquisition && (
                                <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 text-xs space-y-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-900 block">
                                    3-Step Replication Blueprint
                                  </span>
                                  <div className="space-y-1">
                                    {p.replication_strategy.step_by_step_acquisition.map((step: string, sIdx: number) => (
                                      <div key={sIdx} className="flex items-start gap-1.5 text-neutral-700 leading-relaxed text-[11px]">
                                        <span className="text-indigo-600 font-bold shrink-0">{sIdx + 1}.</span>
                                        <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Ready-to-Send Email Pitch */}
                              {p.replication_strategy?.outreach_pitch_body && (
                                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs space-y-2">
                                  <div className="flex items-center justify-between border-b border-neutral-200 pb-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-700">
                                      Ready-to-Send Outreach Pitch
                                    </span>
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(fullPitchText);
                                        setCopiedPitchIndex(i);
                                        setTimeout(() => setCopiedPitchIndex(null), 2500);
                                      }}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 transition-colors"
                                    >
                                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                      <span>{isCopied ? "Copied!" : "Copy Pitch"}</span>
                                    </button>
                                  </div>

                                  <div className="text-[11px] text-neutral-600">
                                    <strong className="text-neutral-800">Subject: </strong>
                                    {p.replication_strategy.outreach_subject_line}
                                  </div>
                                  <p className="text-[11px] text-neutral-700 leading-relaxed whitespace-pre-wrap font-sans bg-white p-2.5 rounded border border-neutral-200/80">
                                    {p.replication_strategy.outreach_pitch_body}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs mt-3">
                              <a
                                href={p.contact_submission_url || p.referring_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-neutral-600 hover:text-neutral-900 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              >
                                <span>Open Pitch Endpoint</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                              <button
                                onClick={() => handleDraftOutreach({
                                  domain: p.referring_site,
                                  url: p.referring_url,
                                  category: "competitor_gap",
                                  opportunity_title: `Replicate ${p.competitor_domain} Backlink on ${p.referring_site}`,
                                  opportunity_angle: p.replication_strategy?.value_proposition,
                                  pitch_hook: p.replication_strategy?.outreach_pitch_body,
                                  linkable_asset: p.replication_strategy?.exact_page_section,
                                })}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                              >
                                <Mail className="w-3 h-3" />
                                <span>Personalize in Modal</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : competitorIntel.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-4 max-w-lg mx-auto shadow-xs">
                    <div className="w-12 h-12 bg-neutral-100 border border-neutral-200 rounded-lg flex items-center justify-center mx-auto text-indigo-600">
                      <Crosshair className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900">No Competitor Backlinks Spied Yet</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Enter any competitor domain above to reverse-engineer their backlink strategy and acquire identical placements.
                      </p>
                    </div>
                    <button
                      onClick={() => fetchCompetitorIntel()}
                      disabled={spyingCompetitors}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Scan Competitor Backlinks</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitorIntel.map((c, i) => (
                      <div
                        key={i}
                        className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-3.5 hover:border-neutral-300 transition-all flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>Competitor:</span>
                              <span className="font-mono">{c.competitor_domain}</span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-neutral-700 bg-neutral-50 border border-neutral-200 px-2 py-0.5 rounded">
                              Source DA: {c.source_authority}/100
                            </span>
                          </div>

                          <div>
                            <div className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                              Referring Platform
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <h4 className="font-semibold text-sm text-neutral-900">{c.referring_site}</h4>
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
                            <span className="text-[11px] font-medium text-neutral-500 mt-0.5 block">
                              Format: <strong className="text-neutral-700">{c.link_type}</strong>
                            </span>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-900 block">
                              How Competitor Earned It
                            </span>
                            <p className="text-neutral-700 leading-relaxed">{c.how_competitor_got_it}</p>
                          </div>

                          <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 text-xs space-y-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-900 block">
                              How to Replicate &amp; Placement Strategy
                            </span>
                            <div className="text-neutral-700 text-[11px]">
                              <strong className="text-neutral-900">Placement: </strong>
                              {c.how_you_can_steal_it.exact_placement}
                            </div>
                            {c.how_you_can_steal_it.step_by_step_guide && (
                              <div className="space-y-1 pt-1">
                                {c.how_you_can_steal_it.step_by_step_guide.map((step: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 text-neutral-700 leading-relaxed text-[11px]">
                                    <span className="text-indigo-600 font-bold">•</span>
                                    <span>{step.replace(/^\d+\.\s*/, "")}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-[11px] text-neutral-600 bg-white p-2 rounded border border-neutral-200 mt-1">
                              <strong className="text-neutral-800">Pitch Angle: </strong>
                              {c.how_you_can_steal_it.angle_to_pitch}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs mt-3">
                          <a
                            href={c.replicate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-600 hover:text-neutral-900 text-[11px] font-medium flex items-center gap-1 transition-colors"
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
                            <span>Prepare Outreach</span>
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
                <div className="flex items-center justify-between bg-white border border-neutral-200 rounded-xl p-4 shadow-xs">
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Live Backlink Health &amp; Indexation Monitor
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      The agent continuously monitors your acquired backlinks to verify HTTP status, dofollow attributes, and live page presence.
                    </p>
                  </div>
                  <button
                    onClick={handleMonitorAndVerifyAll}
                    disabled={verifyingId === "all"}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${verifyingId === "all" ? "animate-spin" : ""}`} />
                    <span>{verifyingId === "all" ? "Verifying Live Links..." : "Verify All Backlinks Now"}</span>
                  </button>
                </div>

                {acquiredLinks.length === 0 ? (
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-2 max-w-lg mx-auto shadow-xs">
                    <CheckCircle2 className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-900">No Acquired Backlinks Logged</p>
                    <p className="text-[11px] text-neutral-500">
                      As outreach campaigns succeed and links are discovered, they will be tracked and verified here.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                          <th className="py-3 px-4">Referring Domain</th>
                          <th className="py-3 px-4">Target URL</th>
                          <th className="py-3 px-4">Anchor Text</th>
                          <th className="py-3 px-4">HTTP / Type</th>
                          <th className="py-3 px-4">Monitor Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {acquiredLinks.map((l) => (
                          <tr key={l.id} className="hover:bg-neutral-50 transition-colors">
                            <td className="py-3 px-4 font-semibold text-neutral-900">
                              <a
                                href={l.linking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline inline-flex items-center gap-1"
                              >
                                <span>{l.domain || l.linking_url}</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-3 px-4 text-neutral-600 truncate max-w-xs">{l.target_url}</td>
                            <td className="py-3 px-4 font-mono text-neutral-700">{l.anchor_text || "Brand Mention"}</td>
                            <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">
                              HTTP {l.http_status || 200} · {l.is_dofollow !== false ? "Dofollow" : "Citation"}
                            </td>
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
                  <div className="p-12 text-center bg-white border border-neutral-200 rounded-xl space-y-2 max-w-lg mx-auto shadow-xs">
                    <FileText className="w-8 h-8 text-neutral-300 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-900">No Linkable Asset Recommendations</p>
                    <p className="text-[11px] text-neutral-500">
                      The Content and Backlink Agents will recommend data-driven assets based on competitor citation analysis.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {linkableAssets.map((asset, i) => (
                      <div key={asset.id || i} className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {asset.asset_type || asset.type}
                        </span>
                        <h4 className="font-semibold text-sm text-neutral-900">{asset.title}</h4>
                        <p className="text-xs text-neutral-600">{asset.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* EXECUTION NOTICE BANNER */}
        {executionNotice && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-4">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{executionNotice}</span>
          </div>
        )}

        {/* BACKLINK EXECUTION MODAL (DIRECTORY CLAIM KIT OR EDITORIAL OUTREACH DISPATCH) */}
        {selectedProspect && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-6 max-w-xl w-full space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                    {executionPayload?.execution_type === "directory_submission" || isDirectoryDomain(selectedProspect.domain) ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">
                      {executionPayload?.execution_type === "directory_submission" || isDirectoryDomain(selectedProspect.domain)
                        ? `Direct Platform Listing & Auto-Fill Kit — ${selectedProspect.domain}`
                        : `Backlink Acquisition Execution — ${selectedProspect.domain}`}
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      {executionPayload?.execution_type === "directory_submission" || isDirectoryDomain(selectedProspect.domain)
                        ? "Self-serve directory & startup profile registration"
                        : `Linked Asset: ${executionPayload?.linked_asset?.title || currentWebsite?.domain}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProspect(null)}
                  className="text-neutral-400 hover:text-neutral-600 p-1 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {drafting ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-neutral-500 font-medium">
                    Preparing live execution kit for {selectedProspect.domain}...
                  </p>
                </div>
              ) : executionPayload?.execution_type === "directory_submission" && executionPayload?.directory_kit ? (
                <div className="space-y-3.5 text-xs">
                  <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-3 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">
                      Direct Portal Submission Steps
                    </span>
                    {executionPayload.directory_kit.steps.map((st: string, i: number) => (
                      <div key={i} className="text-[11px] text-neutral-700 flex items-start gap-1.5">
                        <span className="font-bold text-indigo-600">{i + 1}.</span>
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase text-neutral-400">Product / Site Name</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(executionPayload.directory_kit.product_name)}
                          className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="font-semibold text-neutral-900 truncate">{executionPayload.directory_kit.product_name}</p>
                    </div>

                    <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold uppercase text-neutral-400">Target Website URL</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(executionPayload.directory_kit.website_url)}
                          className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        >
                          Copy
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-indigo-600 truncate">{executionPayload.directory_kit.website_url}</p>
                    </div>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase text-neutral-400">Ready-to-Paste Tagline</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(executionPayload.directory_kit.tagline)}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                      >
                        Copy Tagline
                      </button>
                    </div>
                    <p className="text-neutral-900 font-medium">{executionPayload.directory_kit.tagline}</p>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase text-neutral-400">Product / Publication Description</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(executionPayload.directory_kit.short_description)}
                        className="text-[10px] text-indigo-600 hover:underline font-semibold"
                      >
                        Copy Description
                      </button>
                    </div>
                    <p className="text-neutral-700 leading-relaxed">{executionPayload.directory_kit.short_description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <a
                      href={executionPayload.portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-3.5 py-2 rounded-lg text-xs transition-colors"
                    >
                      <span>1. Open {selectedProspect.domain} Submission Portal</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleCompleteAcquisition(selectedProspect)}
                      disabled={executingAcquisition}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {executingAcquisition ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>2. Confirm &amp; Log Acquired Backlink</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  {executionPayload?.linked_asset && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 block">Live Citation Asset Selected by Agent</span>
                        <a
                          href={executionPayload.linked_asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-emerald-700 hover:underline truncate block"
                        >
                          {executionPayload.linked_asset.title} ({executionPayload.linked_asset.url})
                        </a>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      defaultValue={outreachDraft?.subject || `Resource Suggestion for ${selectedProspect.domain}`}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-neutral-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                      Pitch &amp; Citation Body
                    </label>
                    <textarea
                      rows={7}
                      defaultValue={outreachDraft?.body || `Hi there,\n\nI was reading your guide on ${selectedProspect.domain} and noticed an opportunity to reference our actionable research...\n\nBest regards,\nContent Team`}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-neutral-900 leading-relaxed font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-neutral-100">
                    <div className="flex items-center gap-2">
                      {executionPayload?.mailto_url && (
                        <a
                          href={executionPayload.mailto_url}
                          className="bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Launch Email Client</span>
                        </a>
                      )}
                      {executionPayload?.contact_url && (
                        <a
                          href={executionPayload.contact_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>Open Contact / Pitch Form</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <button
                      onClick={() => handleCompleteAcquisition(selectedProspect)}
                      disabled={executingAcquisition}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      {executingAcquisition ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Mark Executed &amp; Track Backlink</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
