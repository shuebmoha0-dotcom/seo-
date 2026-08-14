"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Globe, Search, BarChart2, Layers, GitBranch, FileCode, CheckCircle2,
  AlertCircle, ShieldAlert, RefreshCw, Loader2, ArrowRight, Shield, Zap,
  DollarSign, CheckSquare, XCircle, Info, ExternalLink, Cpu
} from "lucide-react";
import { useState } from "react";

type Tab = "overview" | "actions";

interface IntegrationItem {
  id: string;
  provider: string;
  display_name: string;
  icon: string;
  description: string;
  status: "connected" | "action_required" | "error" | "disconnected" | "testing";
  status_message?: string;
  capabilities: string[];
  config: Record<string, any>;
  last_tested?: string;
  last_synced?: string;
  is_testing?: boolean;
}

const INITIAL_INTEGRATIONS: IntegrationItem[] = [
  {
    id: "int-1",
    provider: "crawler",
    display_name: "Universal Website Crawler",
    icon: "🌐",
    description: "Read-only website crawler. Works with any platform (Next.js, Webflow, WordPress, Shopify, Custom).",
    status: "connected",
    status_message: "Active and monitoring",
    capabilities: ["CRAWL_URLS", "CRAWL_SITEMAP", "DETECT_TECHNOLOGY"],
    config: { crawl_depth: 3, user_agent: "SEOAutopilotBot/1.0" },
    last_tested: "2 hours ago",
    last_synced: "2 hours ago",
  },
  {
    id: "int-2",
    provider: "google_search_console",
    display_name: "Google Search Console",
    icon: "🔍",
    description: "Search performance metrics: queries, pages, CTR, impressions, and average position.",
    status: "connected",
    status_message: "Synced 28-day analytics",
    capabilities: ["GET_SEARCH_ANALYTICS", "READ_ANALYTICS"],
    config: { property_url: "https://seautopilot.io/", account: "user@example.com" },
    last_tested: "15 minutes ago",
    last_synced: "15 minutes ago",
  },
  {
    id: "int-3",
    provider: "google_analytics",
    display_name: "Google Analytics 4",
    icon: "📊",
    description: "Organic sessions, landing page performance, conversions, and user engagement.",
    status: "action_required",
    status_message: "OAuth token expired — click Reconnect",
    capabilities: ["GET_GA_DATA", "READ_ANALYTICS"],
    config: { property_id: "349102941", measurement_id: "G-SEOAUTO123" },
    last_tested: "1 day ago",
  },
  {
    id: "int-5",
    provider: "github",
    display_name: "GitHub (SaaS / Code Execution)",
    icon: "🐙",
    description: "Primary execution layer for Next.js/React/Astro codebases. Creates branches & Pull Requests.",
    status: "connected",
    status_message: "Connected to acme/website (Next.js)",
    capabilities: ["READ_REPOSITORY", "CREATE_BRANCH", "MODIFY_FILES", "CREATE_PULL_REQUEST"],
    config: { owner: "acme-corp", repo: "website", branch: "main", framework: "Next.js" },
    last_tested: "3 hours ago",
    last_synced: "1 day ago",
  },
  {
    id: "int-6",
    provider: "wordpress",
    display_name: "WordPress",
    icon: "🟦",
    description: "Primary execution layer for WordPress sites. Uses Application Passwords (no admin pass stored).",
    status: "disconnected",
    status_message: "Not connected",
    capabilities: ["CREATE_DRAFT", "UPDATE_CONTENT", "UPDATE_METADATA", "PUBLISH_CONTENT"],
    config: {},
  },
];

interface ExecutionAction {
  id: string;
  type: string;
  page: string;
  proposed_by: string;
  risk: "low" | "medium" | "high";
  time: string;
  status: "pending" | "approved" | "rejected" | "executed";
  pr_url?: string;
  details: string;
}

const DEMO_ACTIONS: ExecutionAction[] = [
  { id: "act-1", type: "update_title", page: "/blog/ai-seo-agent", proposed_by: "On-Page SEO Agent", risk: "low", time: "2h ago", status: "pending", details: "Optimize title for CTR: 'AI SEO Agent for SaaS (2026 Guide)'" },
  { id: "act-2", type: "update_meta_description", page: "/pricing", proposed_by: "On-Page SEO Agent", risk: "low", time: "2h ago", status: "pending", details: "Add compelling CTA to meta description" },
  { id: "act-3", type: "add_internal_link", page: "/blog/ai-seo-agent", proposed_by: "Internal Linking Agent", risk: "low", time: "1h ago", status: "pending", details: "Add contextual link to /features with anchor 'autonomous SEO software'" },
  { id: "act-4", type: "create_article", page: "/blog/saas-keyword-research", proposed_by: "Content Agent", risk: "medium", time: "30m ago", status: "pending", details: "New 1,800-word article on SaaS keyword clustering" },
  { id: "act-5", type: "update_canonical", page: "/features", proposed_by: "Technical SEO Agent", risk: "high", time: "15m ago", status: "pending", details: "Set self-referencing canonical URL" },
];

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(INITIAL_INTEGRATIONS);
  const [actions, setActions] = useState<ExecutionAction[]>(DEMO_ACTIONS);
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpForm, setWpForm] = useState({ site_url: "", username: "", app_password: "", seo_plugin: "yoast" });

  const handleTestConnection = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: true } : i));
    setTimeout(() => {
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: false, status: "connected", status_message: "Connection verified", last_tested: "Just now" } : i));
    }, 800);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "disconnected", status_message: "Disconnected" } : i));
  };

  const handleApproveAction = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: "approved", pr_url: "https://github.com/acme-corp/website/pull/42" } : a));
  };

  const handleRejectAction = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" } : a));
  };

  const handleConnectWp = (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrations(prev => prev.map(i => i.provider === "wordpress" ? {
      ...i,
      status: "connected",
      status_message: `Connected to ${wpForm.site_url} (${wpForm.seo_plugin})`,
      config: { site_url: wpForm.site_url, username: wpForm.username, seo_plugin: wpForm.seo_plugin },
      last_tested: "Just now",
    } : i));
    setShowWpModal(false);
  };

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1">
            <span>Settings</span><span className="text-neutral-300">/</span>
            <span className="text-neutral-700 font-medium">Integrations & Connectors</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                Integrations & Platform Connectors
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                Platform-agnostic execution layer. SEO intelligence runs identically whether you use WordPress or a GitHub/code codebase.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                4 Active Connectors
              </span>
            </div>
          </div>

          {/* Stepper overview */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-700">Setup Flow:</span>
            <div className="flex items-center gap-2">
              {["1. URL", "2. Platform", "3. Search Console", "4. Analytics", "5. Execution", "6. Ready"].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${i < 4 ? "bg-emerald-100 text-emerald-700" : i === 4 ? "bg-amber-100 text-amber-700" : "bg-neutral-200 text-neutral-500"}`}>
                    {step}
                  </span>
                  {i < 5 && <span className="text-neutral-300">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {[
              ["overview", "Integrations", Globe],
              ["actions", `Execution Queue (${actions.filter(a => a.status === "pending").length})`, CheckSquare],
            ].map(([id, label, Icon]: any) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Protocol Banner */}
              <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Human Approval Protocol:</strong> Connecting an integration does NOT grant blanket permission to modify your site. Every single execution proposed by any agent requires explicit human review and approval before being pushed.
                </div>
              </div>

              {/* Integrations Grid */}
              <div className="grid grid-cols-2 gap-4">
                {integrations.map(item => (
                  <div key={item.id} className="bg-white border border-neutral-200 rounded-2xl p-6 hover:shadow-sm transition-shadow flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <h3 className="font-bold text-neutral-900 text-sm">{item.display_name}</h3>
                            <p className="text-[11px] text-neutral-500">{item.status_message}</p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1.5 ${
                          item.status === "connected" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.status === "action_required" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : item.status === "error" ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-neutral-100 text-neutral-500 border-neutral-200"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            item.status === "connected" ? "bg-emerald-500"
                              : item.status === "action_required" ? "bg-amber-500 animate-pulse"
                                : item.status === "error" ? "bg-red-500"
                                  : "bg-neutral-400"
                          }`} />
                          {item.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-600 leading-relaxed mb-3">{item.description}</p>

                      {/* Capabilities */}
                      <div className="flex items-center gap-1 flex-wrap">
                        {item.capabilities.map(cap => (
                          <span key={cap} className="text-[9px] font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-md">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
                      <span className="text-neutral-400 text-[10px]">
                        {item.last_tested ? `Tested ${item.last_tested}` : "Not tested"}
                      </span>

                      <div className="flex items-center gap-2">
                        {item.status === "connected" && (
                          <>
                            <button
                              onClick={() => handleTestConnection(item.id)}
                              disabled={item.is_testing}
                              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                              {item.is_testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              Test
                            </button>
                            <button
                              onClick={() => handleDisconnect(item.id)}
                              className="text-neutral-400 hover:text-red-600 text-[11px] font-medium px-2 py-1 transition-colors">
                              Disconnect
                            </button>
                          </>
                        )}

                        {item.status === "action_required" && (
                          <button
                            onClick={() => handleTestConnection(item.id)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm">
                            <RefreshCw className="w-3 h-3" /> Reconnect Now
                          </button>
                        )}

                        {item.status === "disconnected" && item.provider === "wordpress" && (
                          <button
                            onClick={() => setShowWpModal(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm">
                            Connect WordPress
                          </button>
                        )}

                        {item.status === "disconnected" && item.provider !== "wordpress" && (
                          <button
                            onClick={() => handleTestConnection(item.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm">
                            Connect Platform
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EXECUTION QUEUE TAB ── */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs text-neutral-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Pending execution actions created by specialized agents. Approving an action invokes the execution connector (WordPress or GitHub) to perform the change safely.</span>
              </div>

              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-12 gap-0 px-4 py-3 bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  <span className="col-span-3">Action & Agent</span>
                  <span className="col-span-2">Target Page</span>
                  <span className="col-span-3">Details</span>
                  <span className="col-span-1 text-center">Risk</span>
                  <span className="col-span-3 text-right">Approval</span>
                </div>

                <div className="divide-y divide-neutral-100">
                  {actions.map(act => (
                    <div key={act.id} className="grid grid-cols-12 gap-0 px-4 py-3 text-xs items-center hover:bg-neutral-50 transition-colors">
                      <div className="col-span-3">
                        <span className="font-bold text-neutral-900 block">{act.type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-neutral-400">by {act.proposed_by} · {act.time}</span>
                      </div>

                      <div className="col-span-2 font-mono text-indigo-600 truncate pr-2">
                        {act.page}
                      </div>

                      <div className="col-span-3 text-neutral-600 text-[11px] pr-2">
                        {act.details}
                      </div>

                      <div className="col-span-1 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          act.risk === "high" ? "bg-red-50 text-red-700 border-red-200"
                            : act.risk === "medium" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}>
                          {act.risk.toUpperCase()}
                        </span>
                      </div>

                      <div className="col-span-3 flex items-center justify-end gap-2">
                        {act.status === "pending" && act.risk !== "high" && (
                          <>
                            <button onClick={() => handleApproveAction(act.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                              Approve
                            </button>
                            <button onClick={() => handleRejectAction(act.id)}
                              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors">
                              Reject
                            </button>
                          </>
                        )}
                        {act.status === "pending" && act.risk === "high" && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg">High Risk Review</span>
                            <button onClick={() => handleApproveAction(act.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                              Approve PR
                            </button>
                          </div>
                        )}
                        {act.status === "approved" && (
                          <div className="flex items-center gap-1 text-emerald-600 font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                            {act.pr_url && (
                              <a href={act.pr_url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-0.5 ml-1">
                                PR #42 <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        )}
                        {act.status === "rejected" && (
                          <span className="text-neutral-400 font-bold text-[11px] flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}



        </div>
      </div>

      {/* WordPress Connect Modal */}
      {showWpModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
              <span>🟦</span> Connect WordPress Site
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Uses WordPress Application Passwords. Your main administrator password is <strong>never required or stored</strong>.
            </p>

            <form onSubmit={handleConnectWp} className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">WordPress Site URL</label>
                <input value={wpForm.site_url} onChange={e => setWpForm(f => ({ ...f, site_url: e.target.value }))} required placeholder="https://myblog.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">WordPress Username</label>
                <input value={wpForm.username} onChange={e => setWpForm(f => ({ ...f, username: e.target.value }))} required placeholder="editor_user"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Application Password</label>
                <input type="password" value={wpForm.app_password} onChange={e => setWpForm(f => ({ ...f, app_password: e.target.value }))} required placeholder="abcd 1234 efgh 5678"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">SEO Plugin Installed</label>
                <select value={wpForm.seo_plugin} onChange={e => setWpForm(f => ({ ...f, seo_plugin: e.target.value }))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-700 focus:outline-none focus:border-indigo-400">
                  <option value="yoast">Yoast SEO</option>
                  <option value="rankmath">Rank Math</option>
                  <option value="aioseo">All-in-One SEO</option>
                  <option value="none">None / Native</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition-colors">
                  Verify & Save WordPress Connection
                </button>
                <button type="button" onClick={() => setShowWpModal(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2 rounded-xl font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
