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
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function BacklinksPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [pipelineStage, setPipelineStage] = useState("QUALIFIED");
  const [researching, setResearching] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any | null>(null);
  const [outreachDraft, setOutreachDraft] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [approvedList, setApprovedList] = useState<string[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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
          linkTargetUrl: currentWebsite?.url || "https://example.com",
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

  const handleVerify = async (linkId: string, linkingUrl: string, targetUrl: string) => {
    setVerifyingId(linkId);
    try {
      await fetch("/api/agent/backlink/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linking_url: linkingUrl, target_url: targetUrl }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
              <span>AI Agents</span>
              <span>&gt;</span>
              <span className="text-neutral-700">Backlink &amp; Authority Agent</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Backlink &amp; Digital PR Agent
            </h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {currentWebsite
                ? `Discovers high-quality, relevant link prospects and drafts personalized outreach for ${currentWebsite.domain}.`
                : "Connect your website to start discovering link opportunities."}
            </p>
          </div>

          <button
            onClick={handleResearch}
            disabled={researching || !currentWebsite}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-2 transition-colors self-start md:self-auto"
          >
            {researching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>{researching ? "Discovering Prospects..." : "Find Link Prospects"}</span>
          </button>
        </div>

        {/* ── STATE 1: NO WEBSITE CONNECTED ── */}
        {!currentWebsite ? (
          <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto mt-8">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Connect your website to get started</h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                Backlink intelligence requires a target website to analyze competitor gaps and unlinked mentions.
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
        ) : (
          <>
            {/* Safety Banner */}
            <div className="flex items-center gap-3 p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl mb-8">
              <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
              <div className="text-xs text-neutral-700">
                <span className="font-semibold text-neutral-900">100% White-Hat Protocol: </span>
                Every outreach email requires your explicit review and approval before sending. No automated spam.
              </div>
            </div>

            {/* Pipeline Stage Filter */}
            <div className="flex items-center gap-2 mb-6 border-b border-neutral-200 pb-3 overflow-x-auto">
              {[
                { id: "QUALIFIED", label: "Qualified Prospects", count: prospects.length },
                { id: "COMPETITOR_SPY", label: "Competitor Link Spy", count: competitorIntel.length },
                { id: "ACQUIRED", label: "Acquired Backlinks", count: acquiredLinks.length },
                { id: "ASSETS", label: "Linkable Assets", count: linkableAssets.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPipelineStage(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    pipelineStage === tab.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      pipelineStage === tab.id ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-700"
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
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto">
                    <div className="w-12 h-12 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                      <LinkIcon className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">No link prospects discovered yet</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Click &ldquo;Find Link Prospects&rdquo; to scan competitor link profiles and discover relevant resource pages.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {prospects.map((p) => {
                      const targetLink = p.url || p.prospect_url || `https://${p.domain}`;
                      const oppTitle = p.opportunity_title || (
                        p.category === 'resource_page' ? 'Curated Resource & Directory Listing'
                        : p.category === 'guest_contribution' ? 'Guest Thought Leadership Feature'
                        : p.category === 'unlinked_mention' ? 'Brand Citation & Mention Claim'
                        : p.category === 'broken_link' ? 'Broken Link Replacement Opportunity'
                        : 'Competitor Alternative & Directory Listing'
                      );
                      const catLabel = p.category ? String(p.category).replace(/_/g, ' ') : 'Directory';

                      return (
                        <div key={p.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3.5 hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                                {catLabel}
                              </span>
                              <span className="text-xs font-mono font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-lg">
                                Score: {p.opportunity_score || p.relevance_score || 85}/100
                              </span>
                            </div>

                            <div>
                              <h4 className="font-bold text-sm text-neutral-900 leading-snug">{oppTitle}</h4>
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
                              <div className="text-[11px] text-neutral-600 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-100">
                                <span className="font-bold text-[10px] uppercase text-neutral-400 block mb-0.5">📍 Where on Site</span>
                                <span className="text-neutral-800 font-medium">{p.target_location}</span>
                              </div>
                            )}

                            {p.how_to_acquire && Array.isArray(p.how_to_acquire) && p.how_to_acquire.length > 0 && (
                              <div className="text-[11px] bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 space-y-1 text-neutral-700">
                                <span className="font-bold text-[10px] uppercase text-indigo-900 tracking-wider block mb-1">🛠️ How to Acquire (Step-by-Step)</span>
                                {p.how_to_acquire.map((step: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-indigo-600 font-semibold">•</span>
                                    <span>{step.replace(/^\d+\.\s*/, '')}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {p.opportunity_angle && !p.how_to_acquire && (
                              <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                                {p.opportunity_angle}
                              </p>
                            )}

                            {p.target_anchor && (
                              <div className="text-[11px] text-neutral-500">
                                <span className="font-semibold text-neutral-700">Anchor: </span>
                                <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-[10px] text-neutral-800">{p.target_anchor}</code>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs mt-3">
                            <a
                              href={p.contact_page || targetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-neutral-500 hover:text-neutral-800 text-[11px] font-medium flex items-center gap-1"
                            >
                              <span>Visit Endpoint</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleDraftOutreach(p)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50 border border-neutral-200 rounded-2xl p-4">
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-indigo-600" />
                      Competitor Link Reverse-Engineering &amp; Spy Engine
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Analyzes how market competitors earned their backlinks and delivers blueprints to steal or replicate them.
                    </p>
                  </div>
                  <button
                    onClick={fetchCompetitorIntel}
                    disabled={spyingCompetitors}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm self-start sm:self-auto disabled:opacity-50"
                  >
                    {spyingCompetitors ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>{spyingCompetitors ? "Spying..." : "Scan Competitor Links"}</span>
                  </button>
                </div>

                {spyingCompetitors && competitorIntel.length === 0 ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-neutral-900">Reverse-Engineering Competitor Backlinks...</p>
                    <p className="text-[11px] text-neutral-500">Scanning referring domains, guest columns, and directory profiles across your niche.</p>
                  </div>
                ) : competitorIntel.length === 0 ? (
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-4 max-w-lg mx-auto">
                    <div className="w-12 h-12 bg-white border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
                      <Crosshair className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900">No competitor backlinks spied yet</h3>
                      <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
                        Click &ldquo;Scan Competitor Links&rdquo; to uncover how competitors got their links and get actionable steal playbooks.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitorIntel.map((c, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3.5 hover:border-indigo-200 transition-all flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                              <span>Competitor:</span>
                              <span className="font-mono">{c.competitor_domain}</span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded-lg">
                              Source DA: {c.source_authority}/100
                            </span>
                          </div>

                          <div>
                            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">Referring Platform</div>
                            <div className="flex items-center justify-between mt-0.5">
                              <h4 className="font-bold text-sm text-neutral-900">{c.referring_site}</h4>
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

                          <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-3 text-xs space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block">💡 How Competitor Earned It</span>
                            <p className="text-neutral-700 leading-relaxed">{c.how_competitor_got_it}</p>
                          </div>

                          <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 text-xs space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-900 block">⚔️ How YOU Can Steal / Replicate It</span>
                            <div className="text-neutral-700 text-[11px]">
                              <strong className="text-neutral-900">📍 Placement: </strong>
                              {c.how_you_can_steal_it.exact_placement}
                            </div>
                            {c.how_you_can_steal_it.step_by_step_guide && (
                              <div className="space-y-1 pt-1">
                                {c.how_you_can_steal_it.step_by_step_guide.map((step: string, sIdx: number) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 text-neutral-700 leading-relaxed text-[11px]">
                                    <span className="text-indigo-600 font-bold">•</span>
                                    <span>{step.replace(/^\d+\.\s*/, '')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="text-[11px] text-neutral-600 bg-white/80 p-2 rounded-lg border border-indigo-100/60 mt-1">
                              <strong className="text-neutral-800">✉️ Pitch Angle: </strong>
                              {c.how_you_can_steal_it.angle_to_pitch}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-neutral-100 text-xs mt-3">
                          <a
                            href={c.replicate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-600 hover:text-neutral-900 text-[11px] font-medium flex items-center gap-1"
                          >
                            <span>Open Submission Endpoint</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                          <button
                            onClick={() => handleDraftOutreach({
                              domain: c.referring_site,
                              url: c.referring_url,
                              category: 'competitor_gap',
                              opportunity_title: `Replicate ${c.competitor_domain} Backlink on ${c.referring_site}`,
                              opportunity_angle: c.how_you_can_steal_it.angle_to_pitch,
                              pitch_hook: c.how_you_can_steal_it.pitch_template,
                              linkable_asset: 'Product Comparison & Feature Matrix',
                            })}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
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
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-2 max-w-lg mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="text-xs font-bold text-neutral-900">No Acquired Backlinks Logged</p>
                    <p className="text-[11px] text-neutral-500">
                      As outreach campaigns succeed and links are discovered, they will be tracked and verified here.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          <th className="py-3 px-4">Referring Domain</th>
                          <th className="py-3 px-4">Target URL</th>
                          <th className="py-3 px-4">Anchor Text</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {acquiredLinks.map((l) => (
                          <tr key={l.id} className="hover:bg-neutral-50">
                            <td className="py-3 px-4 font-bold text-neutral-900">{l.domain || l.linking_url}</td>
                            <td className="py-3 px-4 text-neutral-600 truncate max-w-xs">{l.target_url}</td>
                            <td className="py-3 px-4 font-mono text-neutral-700">{l.anchor_text || "Brand Mention"}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                  <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-2 max-w-lg mx-auto">
                    <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="text-xs font-bold text-neutral-900">No Linkable Asset Recommendations</p>
                    <p className="text-[11px] text-neutral-500">
                      The Content and Backlink Agents will recommend data-driven assets based on competitor citation analysis.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {linkableAssets.map((asset, i) => (
                      <div key={asset.id || i} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                          {asset.asset_type || asset.type}
                        </span>
                        <h4 className="font-bold text-sm text-neutral-900">{asset.title}</h4>
                        <p className="text-xs text-neutral-600">{asset.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* OUTREACH DRAFT MODAL */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <Mail className="w-5 h-5 text-indigo-600" />
                Personalized Outreach Draft
              </h3>
              <button onClick={() => setSelectedProspect(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            {drafting ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-neutral-500">Generating contextual outreach email...</p>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Subject</label>
                  <input
                    type="text"
                    defaultValue={outreachDraft?.subject || `Resource Suggestion for ${selectedProspect.domain}`}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-900 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-400 mb-1">Body</label>
                  <textarea
                    rows={6}
                    defaultValue={outreachDraft?.body || `Hi there,\n\nI was reading your guide on ${selectedProspect.domain} and noticed an opportunity to reference our actionable research...\n\nBest regards,\nAlex`}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-900 leading-relaxed font-sans"
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  handleApprove(selectedProspect.id);
                  setSelectedProspect(null);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Check className="w-3.5 h-3.5" />
                Approve for Sending
              </button>
              <button
                onClick={() => setSelectedProspect(null)}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
