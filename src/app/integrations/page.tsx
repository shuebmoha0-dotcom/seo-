"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Globe, Search, BarChart2, Layers, GitBranch, FileCode, CheckCircle2,
  AlertCircle, ShieldAlert, RefreshCw, Loader2, ArrowRight, Shield, Zap,
  DollarSign, CheckSquare, XCircle, Info, ExternalLink, Cpu, Key, HelpCircle
} from "lucide-react";
import { useState, useEffect } from "react";

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
  {
    id: "int-7",
    provider: "custom_api",
    display_name: "Custom Website API",
    icon: "⚡",
    description: "Webhook & REST API execution layer for custom web frameworks and headless CMS platforms.",
    status: "disconnected",
    status_message: "Not configured",
    capabilities: ["CREATE_DRAFT", "UPDATE_CONTENT", "WEBHOOK_EVENTS"],
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
  const [wpForm, setWpForm] = useState({ site_url: "", username: "", app_password: "", seo_plugin: "none" });
  const [wpTesting, setWpTesting] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpFeedback, setWpFeedback] = useState<{ ok?: boolean; message?: string } | null>(null);
  const [crawlStarted, setCrawlStarted] = useState(false);

  // Fetch live WordPress status on mount
  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/integrations/wordpress/status");
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setIntegrations(prev => prev.map(i => i.provider === "wordpress" ? {
              ...i,
              status: "connected",
              status_message: `Connected to ${data.site_name || data.site_url} as ${data.username}`,
              config: { site_url: data.site_url, username: data.username, seo_plugin: data.seo_plugin },
              last_tested: data.last_tested_at ? new Date(data.last_tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recently",
            } : i));
          }
        }
      } catch (err) {
        console.error("Failed to load WordPress status:", err);
      }
    }
    loadStatus();
  }, []);

  const handleTestConnection = async (id: string) => {
    const item = integrations.find(i => i.id === id);
    if (!item) return;

    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: true } : i));

    if (item.provider === "wordpress") {
      try {
        const res = await fetch("/api/integrations/wordpress/verify", { method: "POST" });
        const data = await res.json();
        setIntegrations(prev => prev.map(i => i.id === id ? {
          ...i,
          is_testing: false,
          status: data.ok ? "connected" : "error",
          status_message: data.message || (data.ok ? "Connection verified" : "Verification failed"),
          last_tested: "Just now",
        } : i));
      } catch {
        setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: false, status: "error", status_message: "Failed to reach server" } : i));
      }
    } else {
      setTimeout(() => {
        setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: false, status: "connected", status_message: "Connection verified", last_tested: "Just now" } : i));
      }, 600);
    }
  };

  const handleDisconnect = async (id: string) => {
    const item = integrations.find(i => i.id === id);
    if (!item) return;

    if (item.provider === "wordpress") {
      try {
        await fetch("/api/integrations/wordpress/disconnect", { method: "POST" });
      } catch (e) {
        console.error(e);
      }
    }

    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "disconnected", status_message: "Disconnected" } : i));
  };

  const handleApproveAction = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: "approved", pr_url: "https://github.com/acme-corp/website/pull/42" } : a));
  };

  const handleRejectAction = (id: string) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" } : a));
  };

  // Test credentials inside modal
  const handleTestWpCredentials = async () => {
    if (!wpForm.site_url || !wpForm.username || !wpForm.app_password) {
      setWpFeedback({ ok: false, message: "Please fill in all fields before testing." });
      return;
    }

    setWpTesting(true);
    setWpFeedback(null);

    try {
      const res = await fetch("/api/integrations/wordpress/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: wpForm.site_url,
          username: wpForm.username,
          application_password: wpForm.app_password,
          seo_plugin: wpForm.seo_plugin,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setWpFeedback({
          ok: true,
          message: `✓ Connected to ${data.site_name} as ${data.username} (REST API available).`,
        });
      } else {
        setWpFeedback({ ok: false, message: data.error || "Connection failed." });
      }
    } catch (err: any) {
      setWpFeedback({ ok: false, message: err.message || "Failed to reach server." });
    } finally {
      setWpTesting(false);
    }
  };

  // Save connection
  const handleConnectWp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWpSaving(true);
    setWpFeedback(null);

    try {
      const res = await fetch("/api/integrations/wordpress/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          site_url: wpForm.site_url,
          username: wpForm.username,
          application_password: wpForm.app_password,
          seo_plugin: wpForm.seo_plugin,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setIntegrations(prev => prev.map(i => i.provider === "wordpress" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${data.site_name || wpForm.site_url}`,
          config: { site_url: wpForm.site_url, username: data.username || wpForm.username, seo_plugin: data.seo_plugin || wpForm.seo_plugin },
          last_tested: "Just now",
        } : i));
        setShowWpModal(false);
        setWpFeedback(null);
      } else {
        setWpFeedback({ ok: false, message: data.error || "Failed to save WordPress connection." });
      }
    } catch (err: any) {
      setWpFeedback({ ok: false, message: err.message || "Failed to connect." });
    } finally {
      setWpSaving(false);
    }
  };

  const handleStartInitialCrawl = () => {
    setCrawlStarted(true);
    setTimeout(() => setCrawlStarted(false), 3000);
  };

  const isWpConnected = integrations.some(i => i.provider === "wordpress" && i.status === "connected");

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
                {integrations.filter(i => i.status === "connected").length} Active Connectors
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

              {/* Initial Analysis Notification Banner after connecting */}
              {isWpConnected && (
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>WordPress Connected:</strong> Your site is ready for autonomous SEO analysis and draft creation.
                    </div>
                  </div>
                  <button
                    onClick={handleStartInitialCrawl}
                    disabled={crawlStarted}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-xl transition-colors shrink-0 flex items-center gap-1"
                  >
                    {crawlStarted ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {crawlStarted ? "Analyzing Site..." : "Analyze Website"}
                  </button>
                </div>
              )}

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
                              Verify
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
                            onClick={() => { setShowWpModal(true); setWpFeedback(null); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                            <Key className="w-3 h-3" /> Connect WordPress
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── EXECUTION ACTIONS TAB ── */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">Pending Execution Actions</h3>
                    <p className="text-neutral-500 text-xs mt-0.5">Every action below requires human approval before execution.</p>
                  </div>
                  <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                    {actions.filter(a => a.status === "pending").length} Pending Review
                  </span>
                </div>

                <div className="divide-y divide-neutral-100 text-xs">
                  {actions.map(act => (
                    <div key={act.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-900">{act.type}</span>
                          <span className="font-mono text-neutral-500 text-[11px]">{act.page}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            act.risk === "low" ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : act.risk === "medium" ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            {act.risk.toUpperCase()} RISK
                          </span>
                        </div>
                        <p className="text-neutral-600 text-[11px]">{act.details}</p>
                        <p className="text-[10px] text-neutral-400">Proposed by {act.proposed_by} · {act.time}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {act.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleRejectAction(act.id)}
                              className="text-neutral-400 hover:text-red-600 text-[11px] font-medium px-2 py-1 transition-colors">
                              Reject
                            </button>
                            <button onClick={() => handleApproveAction(act.id)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-colors">
                              Approve & Execute
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
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>🟦</span> Connect WordPress Site
              </h3>
              <button
                type="button"
                onClick={() => setShowWpModal(false)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Connect your WordPress site via official REST API. Uses WordPress Application Passwords so your administrator password is <strong>never required or stored</strong>.
            </p>

            {/* How-To Guide Box */}
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1.5 text-[11px] text-neutral-600">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                How to generate a WordPress Application Password:
              </div>
              <ol className="list-decimal list-inside space-y-0.5 text-neutral-600 pl-1 text-[10.5px]">
                <li>Log in to your WordPress admin panel (<code className="bg-neutral-200 px-1 py-0.5 rounded">/wp-admin</code>).</li>
                <li>Go to <strong>Users → Profile</strong> (or Edit User).</li>
                <li>Scroll down to the <strong>Application Passwords</strong> section.</li>
                <li>Enter a name (e.g. <em>SEO Autopilot</em>) and click <strong>Add New Application Password</strong>.</li>
                <li>Copy the generated 16-character password and paste it below.</li>
              </ol>
            </div>

            {/* Feedback Alert */}
            {wpFeedback && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                wpFeedback.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {wpFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
                <span>{wpFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleConnectWp} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">WordPress Site URL</label>
                <input
                  type="url"
                  value={wpForm.site_url}
                  onChange={e => setWpForm(f => ({ ...f, site_url: e.target.value }))}
                  required
                  placeholder="https://example.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">WordPress Username</label>
                  <input
                    type="text"
                    value={wpForm.username}
                    onChange={e => setWpForm(f => ({ ...f, username: e.target.value }))}
                    required
                    placeholder="editor_user"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">SEO Plugin (Optional)</label>
                  <select
                    value={wpForm.seo_plugin}
                    onChange={e => setWpForm(f => ({ ...f, seo_plugin: e.target.value }))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="none">Auto-Detect / Native</option>
                    <option value="yoast">Yoast SEO</option>
                    <option value="rankmath">Rank Math</option>
                    <option value="aioseo">All-in-One SEO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Application Password</label>
                <input
                  type="password"
                  value={wpForm.app_password}
                  onChange={e => setWpForm(f => ({ ...f, app_password: e.target.value }))}
                  required
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-mono tracking-wider focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestWpCredentials}
                  disabled={wpTesting || wpSaving}
                  className="bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  {wpTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Test Connection
                </button>

                <button
                  type="submit"
                  disabled={wpSaving || wpTesting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {wpSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Connect & Save Site
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
