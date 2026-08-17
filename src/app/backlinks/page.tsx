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
  const [loading, setLoading] = useState(true);

  const fetchBacklinkData = async () => {
    if (!currentWebsite) {
      setProspects([]);
      setAcquiredLinks([]);
      setLinkableAssets([]);
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
  }, [currentWebsite?.id]);

  const handleResearch = async () => {
    if (!currentWebsite) {
      openAddModal();
      return;
    }
    setResearching(true);
    try {
      const res = await fetch("/api/agent/backlinks/research", {
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
      const res = await fetch("/api/agent/backlinks/draft-outreach", {
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
      await fetch("/api/agent/backlinks/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkingUrl, targetUrl }),
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
            <div className="flex items-center gap-2 mb-6 border-b border-neutral-200 pb-3">
              {[
                { id: "QUALIFIED", label: "Qualified Prospects", count: prospects.length },
                { id: "ACQUIRED", label: "Acquired Backlinks", count: acquiredLinks.length },
                { id: "ASSETS", label: "Linkable Assets", count: linkableAssets.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPipelineStage(tab.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
                    {prospects.map((p) => (
                      <div key={p.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            {p.category}
                          </span>
                          <span className="text-xs font-mono font-semibold text-neutral-700">
                            Score: {p.opportunity_score || 80}/100
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-neutral-900 truncate">{p.domain}</h4>
                        <p className="text-xs text-neutral-500 truncate">{p.url || p.prospect_url}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs">
                          <button
                            onClick={() => handleDraftOutreach(p)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                          >
                            <Mail className="w-3 h-3" />
                            Draft Outreach
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
