"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Globe, Search, BarChart2, Layers, GitBranch, FileCode, CheckCircle2,
  AlertCircle, ShieldAlert, RefreshCw, Loader2, ArrowRight, Shield, Zap,
  DollarSign, CheckSquare, XCircle, Info, ExternalLink, Cpu, Key, HelpCircle,
  Code2, Check, Settings2
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

const DEFAULT_INTEGRATIONS: IntegrationItem[] = [
  {
    id: "int-gsc",
    provider: "google_search_console",
    display_name: "Google Search Console",
    icon: "🔍",
    description: "Search performance metrics: queries, pages, CTR, impressions, and average position.",
    status: "disconnected",
    status_message: "Not connected",
    capabilities: ["GET_SEARCH_ANALYTICS", "READ_ANALYTICS"],
    config: {},
  },
  {
    id: "int-ga4",
    provider: "google_analytics",
    display_name: "Google Analytics 4",
    icon: "📊",
    description: "Organic sessions, landing page performance, conversions, and user engagement.",
    status: "disconnected",
    status_message: "Not connected",
    capabilities: ["GET_GA_DATA", "READ_ANALYTICS"],
    config: {},
  },
  {
    id: "int-github",
    provider: "github",
    display_name: "GitHub (Code Execution)",
    icon: "🐙",
    description: "Codebase execution layer for Next.js, React, Astro, or static sites. Creates branches & Pull Requests.",
    status: "disconnected",
    status_message: "Not connected",
    capabilities: ["READ_REPOSITORY", "CREATE_BRANCH", "MODIFY_FILES", "CREATE_PULL_REQUEST"],
    config: {},
  },
  {
    id: "int-wp",
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
    id: "int-custom",
    provider: "custom_api",
    display_name: "Custom Website API",
    icon: "⚡",
    description: "Webhook & REST API execution layer for custom web frameworks and headless CMS platforms.",
    status: "disconnected",
    status_message: "Not configured",
    capabilities: ["READ_CONTENT", "CREATE_DRAFT", "UPDATE_CONTENT", "UPLOAD_MEDIA", "PUBLISH_CONTENT"],
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
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(DEFAULT_INTEGRATIONS);
  const [actions, setActions] = useState<ExecutionAction[]>(DEMO_ACTIONS);

  // WordPress Modal State
  const [showWpModal, setShowWpModal] = useState(false);
  const [wpForm, setWpForm] = useState<{
    site_url: string;
    username: string;
    app_password: string;
    auth_method: 'application_password' | 'botcreds';
    seo_plugin: string;
  }>({
    site_url: "",
    username: "",
    app_password: "",
    auth_method: "application_password",
    seo_plugin: "none",
  });
  const [wpTesting, setWpTesting] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpFeedback, setWpFeedback] = useState<{ ok?: boolean; message?: string } | null>(null);

  // Google Search Console Modal State
  const [showGscModal, setShowGscModal] = useState(false);
  const [gscProperties, setGscProperties] = useState<Array<{ siteUrl: string; permissionLevel: string }>>([]);
  const [selectedGscProp, setSelectedGscProp] = useState("");
  const [gscLoading, setGscLoading] = useState(false);
  const [gscIntegrationId, setGscIntegrationId] = useState("");

  // Google Analytics 4 Modal State
  const [showGa4Modal, setShowGa4Modal] = useState(false);
  const [ga4Properties, setGa4Properties] = useState<Array<{ propertyId: string; displayName: string; account: string }>>([]);
  const [selectedGa4Prop, setSelectedGa4Prop] = useState("");
  const [ga4Loading, setGa4Loading] = useState(false);
  const [ga4IntegrationId, setGa4IntegrationId] = useState("");

  // GitHub Modal State
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [githubRepos, setGithubRepos] = useState<Array<{ full_name: string; name: string; owner: string; default_branch: string; private?: boolean }>>([]);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState("");
  const [githubBranches, setGithubBranches] = useState<string[]>(["main"]);
  const [selectedGithubBranch, setSelectedGithubBranch] = useState("main");
  const [githubToken, setGithubToken] = useState("");
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubIntegrationId, setGithubIntegrationId] = useState("");

  // Custom Website API Modal State
  const [showCustomApiModal, setShowCustomApiModal] = useState(false);
  const [customForm, setCustomForm] = useState({
    site_url: "",
    api_base_url: "",
    auth_type: "bearer_token" as "bearer_token" | "api_key",
    api_key: "",
    header_name: "X-API-Key",
    content_endpoint: "/api/content",
    media_endpoint: "/api/media",
    publish_endpoint: "/api/publish",
  });
  const [customTesting, setCustomTesting] = useState(false);
  const [customSaving, setCustomSaving] = useState(false);
  const [customFeedback, setCustomFeedback] = useState<{ ok?: boolean; message?: string; capabilities?: string[] } | null>(null);

  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const initiateOAuth = async (provider: string) => {
    setOauthError(null);
    let authUrl = `/api/integrations/${provider}/auth`;
    if (provider === "google_search_console") authUrl = "/api/integrations/gsc/auth";
    else if (provider === "google_analytics") authUrl = "/api/integrations/ga4/auth";
    else if (provider === "github") authUrl = "/api/integrations/github/auth";

    try {
      const res = await fetch(authUrl);
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const data = await res.json().catch(() => null);
      if (data && data.configured === false) {
        setOauthError(data.error);
        return;
      }
      if (res.ok && res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setOauthError(err.message || "Failed to initiate authorization.");
    }
  };

  // 1. Fetch live database integrations & check URL query params on mount
  useEffect(() => {
    async function loadIntegrations() {
      try {
        const res = await fetch("/api/integrations");
        if (res.ok) {
          const data = await res.json();
          const dbIntegrations: any[] = data.integrations || [];

          setIntegrations(prev => prev.map(item => {
            const match = dbIntegrations.find(d => d.provider === item.provider);
            if (match) {
              return {
                ...item,
                id: match.id || item.id,
                status: match.status || "disconnected",
                status_message: match.status_message || (match.status === "connected" ? "Connected and active" : "Not connected"),
                capabilities: match.capabilities || item.capabilities,
                config: match.config || {},
                last_tested: match.last_tested_at ? new Date(match.last_tested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
              };
            }
            return item;
          }));
        }
      } catch (err) {
        console.error("Failed to load integrations:", err);
      }
    }
    loadIntegrations();

    // Check query params for OAuth callbacks
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const gscSelect = urlParams.get("gsc_select");
      const ga4Select = urlParams.get("ga4_select");
      const githubSelect = urlParams.get("github_select");
      const intId = urlParams.get("integration_id") || "";

      if (gscSelect) {
        setGscIntegrationId(intId);
        openGscPropertySelector(intId);
      } else if (ga4Select) {
        setGa4IntegrationId(intId);
        openGa4PropertySelector(intId);
      } else if (githubSelect) {
        setGithubIntegrationId(intId);
        openGithubRepoSelector(intId);
      }
    }
  }, []);

  // 2. Open GSC Property Selector
  const openGscPropertySelector = async (intId: string) => {
    setShowGscModal(true);
    setGscLoading(true);
    try {
      const res = await fetch(`/api/integrations/gsc/properties?integration_id=${intId}`);
      if (res.ok) {
        const data = await res.json();
        setGscProperties(data.properties || []);
        if (data.properties?.length > 0) {
          setSelectedGscProp(data.properties[0].siteUrl);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGscLoading(false);
    }
  };

  // 3. Open GA4 Property Selector
  const openGa4PropertySelector = async (intId: string) => {
    setShowGa4Modal(true);
    setGa4Loading(true);
    try {
      const res = await fetch(`/api/integrations/ga4/properties?integration_id=${intId}`);
      if (res.ok) {
        const data = await res.json();
        setGa4Properties(data.properties || []);
        if (data.properties?.length > 0) {
          setSelectedGa4Prop(data.properties[0].propertyId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGa4Loading(false);
    }
  };

  // 4. Open GitHub Repo Selector
  const openGithubRepoSelector = async (intId: string) => {
    setShowGithubModal(true);
    setGithubLoading(true);
    try {
      const res = await fetch(`/api/integrations/github/repos?integration_id=${intId}`);
      if (res.ok) {
        const data = await res.json();
        setGithubRepos(data.repos || []);
        if (data.repos?.length > 0) {
          setSelectedGithubRepo(data.repos[0].full_name);
          loadGithubBranches(data.repos[0].owner, data.repos[0].name, intId);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGithubLoading(false);
    }
  };

  const loadGithubBranches = async (owner: string, repo: string, intId: string) => {
    try {
      const res = await fetch(`/api/integrations/github/branches?owner=${owner}&repo=${repo}&integration_id=${intId}`);
      if (res.ok) {
        const data = await res.json();
        setGithubBranches(data.branches || ["main"]);
        setSelectedGithubBranch(data.branches?.[0] || "main");
      }
    } catch {}
  };

  // 5. Action Handlers: Verify & Disconnect
  const handleVerify = async (id: string) => {
    const item = integrations.find(i => i.id === id);
    if (!item) return;

    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, is_testing: true } : i));

    let verifyUrl = `/api/integrations/${item.provider}/verify`;
    if (item.provider === "google_search_console") verifyUrl = "/api/integrations/gsc/verify";
    else if (item.provider === "google_analytics") verifyUrl = "/api/integrations/ga4/verify";
    else if (item.provider === "custom_api") verifyUrl = "/api/integrations/custom-api/verify";

    try {
      const res = await fetch(verifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: item.id }),
      });
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
  };

  const handleDisconnect = async (id: string) => {
    const item = integrations.find(i => i.id === id);
    if (!item) return;

    let disconnectUrl = `/api/integrations/${item.provider}/disconnect`;
    if (item.provider === "google_search_console") disconnectUrl = "/api/integrations/gsc/disconnect";
    else if (item.provider === "google_analytics") disconnectUrl = "/api/integrations/ga4/disconnect";
    else if (item.provider === "custom_api") disconnectUrl = "/api/integrations/custom-api/disconnect";

    try {
      await fetch(disconnectUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: item.id }),
      });
    } catch (e) {
      console.error(e);
    }

    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "disconnected", status_message: "Disconnected" } : i));
  };

  // Connect Finalizers
  const handleFinalizeGsc = async () => {
    if (!selectedGscProp) return;
    setGscLoading(true);
    try {
      const res = await fetch("/api/integrations/gsc/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integration_id: gscIntegrationId, property_url: selectedGscProp }),
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(prev => prev.map(i => i.provider === "google_search_console" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${selectedGscProp}`,
          config: { property_url: selectedGscProp },
          last_tested: "Just now",
        } : i));
        setShowGscModal(false);
      }
    } finally {
      setGscLoading(false);
    }
  };

  const handleFinalizeGa4 = async () => {
    if (!selectedGa4Prop) return;
    setGa4Loading(true);
    const propObj = ga4Properties.find(p => p.propertyId === selectedGa4Prop);
    try {
      const res = await fetch("/api/integrations/ga4/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: ga4IntegrationId,
          property_id: selectedGa4Prop,
          property_name: propObj?.displayName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(prev => prev.map(i => i.provider === "google_analytics" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${propObj?.displayName || selectedGa4Prop}`,
          config: { property_id: selectedGa4Prop, property_name: propObj?.displayName },
          last_tested: "Just now",
        } : i));
        setShowGa4Modal(false);
      }
    } finally {
      setGa4Loading(false);
    }
  };

  const handleFinalizeGithub = async () => {
    if (!selectedGithubRepo) return;
    setGithubLoading(true);
    const [owner, repo] = selectedGithubRepo.split("/");
    try {
      const res = await fetch("/api/integrations/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: githubIntegrationId,
          owner,
          repo,
          branch: selectedGithubBranch,
          access_token: githubToken || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(prev => prev.map(i => i.provider === "github" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${selectedGithubRepo} (${selectedGithubBranch})`,
          config: { owner, repo, branch: selectedGithubBranch },
          last_tested: "Just now",
        } : i));
        setShowGithubModal(false);
      }
    } finally {
      setGithubLoading(false);
    }
  };

  // Custom API Test & Connect
  const handleTestCustomApi = async () => {
    setCustomTesting(true);
    setCustomFeedback(null);
    try {
      const res = await fetch("/api/integrations/custom-api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customForm),
      });
      const data = await res.json();
      if (data.ok) {
        setCustomFeedback({ ok: true, message: data.message, capabilities: data.capabilities });
      } else {
        setCustomFeedback({ ok: false, message: data.error || "Connection test failed." });
      }
    } catch (err: any) {
      setCustomFeedback({ ok: false, message: err.message || "Failed to reach server." });
    } finally {
      setCustomTesting(false);
    }
  };

  const handleConnectCustomApi = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSaving(true);
    setCustomFeedback(null);
    try {
      const res = await fetch("/api/integrations/custom-api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customForm),
      });
      const data = await res.json();
      if (data.success) {
        setIntegrations(prev => prev.map(i => i.provider === "custom_api" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${customForm.api_base_url}`,
          capabilities: data.capabilities || i.capabilities,
          config: customForm,
          last_tested: "Just now",
        } : i));
        setShowCustomApiModal(false);
      } else {
        setCustomFeedback({ ok: false, message: data.error || "Failed to save Custom API connection." });
      }
    } catch (err: any) {
      setCustomFeedback({ ok: false, message: err.message || "Failed to connect." });
    } finally {
      setCustomSaving(false);
    }
  };

  // WordPress Connect Handler
  const handleConnectWp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWpSaving(true);
    setWpFeedback(null);

    try {
      const res = await fetch("/api/integrations/wordpress/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wpForm),
      });

      const data = await res.json();
      if (data.success) {
        setWpFeedback({ ok: true, message: data.message });
        setIntegrations(prev => prev.map(i => i.provider === "wordpress" ? {
          ...i,
          status: "connected",
          status_message: `Connected to ${data.site_name || wpForm.site_url} as @${data.username || wpForm.username}`,
          config: {
            site_url: data.canonical_url || wpForm.site_url,
            username: data.username || wpForm.username,
            seo_plugin: data.seo_plugin || wpForm.seo_plugin,
            rank_math_detected: data.rank_math_detected,
          },
          last_tested: "Just now",
        } : i));
        setTimeout(() => {
          setShowWpModal(false);
          setWpFeedback(null);
        }, 2000);
      } else {
        setWpFeedback({ ok: false, message: data.error || "Failed to save WordPress connection." });
      }
    } catch (err: any) {
      setWpFeedback({ ok: false, message: err.message || "Failed to connect." });
    } finally {
      setWpSaving(false);
    }
  };

  const handleStartAnalysis = () => {
    setAnalysisStarted(true);
    setTimeout(() => setAnalysisStarted(false), 3000);
  };

  const isAnyExecutionConnected = integrations.some(i => (i.provider === "wordpress" || i.provider === "github" || i.provider === "custom_api") && i.status === "connected");

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
                Connect your search performance platforms and execution layers (WordPress, GitHub, or Custom Website API).
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
              {["1. Search Console", "2. Google Analytics", "3. Execution Layer (WordPress/GitHub/Custom API)", "4. Ready"].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${i < 2 ? "bg-emerald-100 text-emerald-700" : i === 2 ? "bg-indigo-100 text-indigo-700" : "bg-neutral-200 text-neutral-500"}`}>
                    {step}
                  </span>
                  {i < 3 && <span className="text-neutral-300">→</span>}
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
                  <strong>Human Approval Protocol:</strong> Connecting an execution platform does NOT grant permission to modify your live site directly. Every single pull request, draft publish, or metadata change proposed by any agent requires explicit human review and approval.
                </div>
              </div>

              {/* Website Analysis Notification Banner */}
              {isAnyExecutionConnected && (
                <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <strong>Execution Layer Active:</strong> Your website is configured for autonomous SEO auditing, draft generation, and controlled updates.
                    </div>
                  </div>
                  <button
                    onClick={handleStartAnalysis}
                    disabled={analysisStarted}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-xl transition-colors shrink-0 flex items-center gap-1"
                  >
                    {analysisStarted ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    {analysisStarted ? "Analyzing Site..." : "Analyze Website"}
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
                              onClick={() => {
                                if (item.provider === "google_search_console") openGscPropertySelector(item.id);
                                else if (item.provider === "google_analytics") openGa4PropertySelector(item.id);
                                else if (item.provider === "github") openGithubRepoSelector(item.id);
                                else if (item.provider === "wordpress") setShowWpModal(true);
                                else if (item.provider === "custom_api") setShowCustomApiModal(true);
                              }}
                              className="text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                              <Settings2 className="w-3 h-3" /> Configure
                            </button>
                            <button
                              onClick={() => handleVerify(item.id)}
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
                            onClick={() => {
                              if (item.provider === "google_search_console") initiateOAuth("google_search_console");
                              else if (item.provider === "google_analytics") initiateOAuth("google_analytics");
                              else if (item.provider === "github") setShowGithubModal(true);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors shadow-sm">
                            <RefreshCw className="w-3 h-3" /> Reconnect Now
                          </button>
                        )}

                        {item.status === "disconnected" && (
                          <button
                            onClick={() => {
                              if (item.provider === "google_search_console") initiateOAuth("google_search_console");
                              else if (item.provider === "google_analytics") initiateOAuth("google_analytics");
                              else if (item.provider === "github") setShowGithubModal(true);
                              else if (item.provider === "wordpress") { setShowWpModal(true); setWpFeedback(null); }
                              else if (item.provider === "custom_api") { setShowCustomApiModal(true); setCustomFeedback(null); }
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                            <Key className="w-3 h-3" /> Connect {item.display_name.split(" ")[0]}
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
                            <button onClick={() => setActions(prev => prev.map(a => a.id === act.id ? { ...a, status: "rejected" } : a))}
                              className="text-neutral-400 hover:text-red-600 text-[11px] font-medium px-2 py-1 transition-colors">
                              Reject
                            </button>
                            <button onClick={() => setActions(prev => prev.map(a => a.id === act.id ? { ...a, status: "approved", pr_url: "https://github.com/acme-corp/website/pull/42" } : a))}
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

      {/* ── 1. Google Search Console Modal ── */}
      {showGscModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>🔍</span> Select Google Search Console Property
              </h3>
              <button type="button" onClick={() => setShowGscModal(false)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-neutral-500">Select the Search Console property you want to connect to this project:</p>

            {gscLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Loading accessible Search Console properties...</span>
              </div>
            ) : gscProperties.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-500 space-y-3">
                <p>No verified properties found or authorization pending.</p>
                <button onClick={() => window.location.href = "/api/integrations/gsc/auth"} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs">
                  Authorize with Google
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {gscProperties.map(p => (
                    <label key={p.siteUrl} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-colors ${
                      selectedGscProp === p.siteUrl ? "border-indigo-600 bg-indigo-50/50" : "border-neutral-200 hover:bg-neutral-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="gsc_prop" checked={selectedGscProp === p.siteUrl} onChange={() => setSelectedGscProp(p.siteUrl)} className="accent-indigo-600" />
                        <span className="font-mono font-medium text-neutral-900">{p.siteUrl}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">{p.permissionLevel}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleFinalizeGsc} disabled={!selectedGscProp || gscLoading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors">
                    Connect Selected Property
                  </button>
                  <button type="button" onClick={() => setShowGscModal(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2.5 rounded-xl font-medium text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Google Analytics 4 Modal ── */}
      {showGa4Modal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>📊</span> Select Google Analytics 4 Property
              </h3>
              <button type="button" onClick={() => setShowGa4Modal(false)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-neutral-500">Select the GA4 property to link organic traffic and user engagement:</p>

            {ga4Loading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span>Loading GA4 properties...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {ga4Properties.map(p => (
                    <label key={p.propertyId} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer text-xs transition-colors ${
                      selectedGa4Prop === p.propertyId ? "border-indigo-600 bg-indigo-50/50" : "border-neutral-200 hover:bg-neutral-50"
                    }`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="ga4_prop" checked={selectedGa4Prop === p.propertyId} onChange={() => setSelectedGa4Prop(p.propertyId)} className="accent-indigo-600" />
                        <div>
                          <p className="font-semibold text-neutral-900">{p.displayName}</p>
                          <p className="text-[10px] text-neutral-400">Account: {p.account} · ID: {p.propertyId}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleFinalizeGa4} disabled={!selectedGa4Prop || ga4Loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors">
                    Connect Selected GA4 Property
                  </button>
                  <button type="button" onClick={() => setShowGa4Modal(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2.5 rounded-xl font-medium text-xs">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 3. GitHub Modal ── */}
      {showGithubModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>🐙</span> Connect GitHub Repository
              </h3>
              <button type="button" onClick={() => setShowGithubModal(false)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-neutral-500">Connect your repository for automated technical SEO Pull Requests.</p>

            <div className="flex gap-2 border-b border-neutral-200 pb-2">
              <button type="button" onClick={() => window.location.href = "/api/integrations/github/auth"} className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1.5">
                <span>🐙</span> Authorize with GitHub OAuth
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Or Personal Access Token / GitHub Token</label>
                <div className="flex gap-2">
                  <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)} placeholder="ghp_xxxxxxxxxxxx"
                    className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-500 font-mono" />
                  <button type="button" onClick={() => openGithubRepoSelector(githubIntegrationId)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-3 py-2 rounded-xl font-medium">
                    Load Repos
                  </button>
                </div>
              </div>

              {githubRepos.length > 0 && (
                <>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Select Repository</label>
                    <select value={selectedGithubRepo} onChange={e => {
                      setSelectedGithubRepo(e.target.value);
                      const [o, r] = e.target.value.split("/");
                      loadGithubBranches(o, r, githubIntegrationId);
                    }} className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-500">
                      {githubRepos.map(r => (
                        <option key={r.full_name} value={r.full_name}>{r.full_name} {r.private ? "(Private)" : ""}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Base Branch</label>
                    <select value={selectedGithubBranch} onChange={e => setSelectedGithubBranch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 focus:outline-none focus:border-indigo-500">
                      {githubBranches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={handleFinalizeGithub} disabled={!selectedGithubRepo || githubLoading}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {githubLoading ? "Connecting..." : "Save & Connect Repository"}
                </button>
                <button type="button" onClick={() => setShowGithubModal(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2.5 rounded-xl font-medium">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. WordPress Modal ── */}
      {showWpModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>🟦</span> Connect WordPress Site
              </h3>
              <button type="button" onClick={() => setShowWpModal(false)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed">
              Connect your WordPress site via official REST API using Application Passwords or BotCreds Agent Access.
            </p>

            {wpFeedback && (
              <div className={`p-3.5 rounded-xl text-xs border ${
                wpFeedback.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
              }`}>
                <div className="flex items-start gap-2">
                  {wpFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
                  <div className="flex-1">
                    <span className="whitespace-pre-line leading-relaxed font-medium block">{wpFeedback.message}</span>
                    {!wpFeedback.ok && (
                      <button
                        type="button"
                        onClick={e => handleConnectWp(e as any)}
                        disabled={wpSaving}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-semibold text-[11px] transition-colors"
                      >
                        {wpSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Retry Connection
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleConnectWp} className="space-y-3.5 text-xs">
              {/* Authentication Method Selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1.5">Authentication Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWpForm(f => ({ ...f, auth_method: 'application_password' }))}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      wpForm.auth_method === 'application_password'
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold shadow-xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      wpForm.auth_method === 'application_password' ? 'border-indigo-600' : 'border-neutral-400'
                    }`}>
                      {wpForm.auth_method === 'application_password' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                    </div>
                    <div>
                      <div className="text-xs leading-tight">Application Password</div>
                      <div className="text-[10px] text-neutral-500 font-normal mt-0.5">Native WordPress</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWpForm(f => ({ ...f, auth_method: 'botcreds' }))}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                      wpForm.auth_method === 'botcreds'
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-semibold shadow-xs'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                      wpForm.auth_method === 'botcreds' ? 'border-indigo-600' : 'border-neutral-400'
                    }`}>
                      {wpForm.auth_method === 'botcreds' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                    </div>
                    <div>
                      <div className="text-xs leading-tight">BotCreds</div>
                      <div className="text-[10px] text-neutral-500 font-normal mt-0.5">Scoped Agent Access</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">WordPress Site URL</label>
                <input type="url" value={wpForm.site_url} onChange={e => setWpForm(f => ({ ...f, site_url: e.target.value }))} required placeholder="https://example.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                    {wpForm.auth_method === 'botcreds' ? 'BotCreds Agent / Username' : 'WordPress Username'}
                  </label>
                  <input type="text" value={wpForm.username} onChange={e => setWpForm(f => ({ ...f, username: e.target.value }))} required placeholder={wpForm.auth_method === 'botcreds' ? 'agent_seo' : 'editor_user'}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">SEO Plugin (Optional)</label>
                  <select value={wpForm.seo_plugin} onChange={e => setWpForm(f => ({ ...f, seo_plugin: e.target.value }))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-700 focus:outline-none focus:border-indigo-500">
                    <option value="none">Auto-Detect / Native</option>
                    <option value="yoast">Yoast SEO</option>
                    <option value="rankmath">Rank Math</option>
                    <option value="aioseo">All-in-One SEO</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">
                  {wpForm.auth_method === 'botcreds' ? 'BotCreds Agent Key' : 'Application Password'}
                </label>
                <input type="password" value={wpForm.app_password} onChange={e => setWpForm(f => ({ ...f, app_password: e.target.value }))} required placeholder={wpForm.auth_method === 'botcreds' ? 'Generated in WP Admin → Settings → BotCreds' : 'xxxx xxxx xxxx xxxx'}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-mono focus:outline-none focus:border-indigo-500" />
                <p className="text-[10px] text-neutral-400 mt-1">
                  {wpForm.auth_method === 'botcreds'
                    ? 'Generated via the BotCreds Agent Access plugin (WordPress Admin → Settings → BotCreds or Tools → Agent Access).'
                    : 'Generated in WordPress Admin → Users → Profile → Application Passwords.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="submit" disabled={wpSaving || wpTesting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                  {wpSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Connect & Save WordPress
                </button>
                <button type="button" onClick={() => setShowWpModal(false)} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-4 py-2.5 rounded-xl font-medium">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Custom Website API Modal ── */}
      {showCustomApiModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2">
                <span>⚡</span> Connect Custom Website API
              </h3>
              <button type="button" onClick={() => setShowCustomApiModal(false)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>

            <p className="text-xs text-neutral-500">
              Integrate custom SaaS webhooks or headless CMS endpoints. Credentials are encrypted server-side.
            </p>

            {customFeedback && (
              <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                customFeedback.ok ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {customFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />}
                <div>
                  <p>{customFeedback.message}</p>
                  {customFeedback.capabilities && (
                    <p className="text-[10px] mt-1 text-emerald-700 font-mono">
                      Detected: {customFeedback.capabilities.join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleConnectCustomApi} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Website URL *</label>
                <input type="url" value={customForm.site_url} onChange={e => setCustomForm(f => ({ ...f, site_url: e.target.value }))} required placeholder="https://example.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">API Base URL *</label>
                <input type="url" value={customForm.api_base_url} onChange={e => setCustomForm(f => ({ ...f, api_base_url: e.target.value }))} required placeholder="https://api.example.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Authentication Type</label>
                  <select value={customForm.auth_type} onChange={e => setCustomForm(f => ({ ...f, auth_type: e.target.value as any }))}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-700 focus:outline-none focus:border-indigo-500">
                    <option value="bearer_token">Bearer Token (Authorization)</option>
                    <option value="api_key">API Key (Custom Header)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Header Name (for API Key)</label>
                  <input type="text" value={customForm.header_name} onChange={e => setCustomForm(f => ({ ...f, header_name: e.target.value }))} placeholder="X-API-Key"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 focus:outline-none focus:border-indigo-500 font-mono" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase text-neutral-500 mb-1">Secret Key / Token *</label>
                <input type="password" value={customForm.api_key} onChange={e => setCustomForm(f => ({ ...f, api_key: e.target.value }))} required placeholder="Bearer token or API secret"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-mono focus:outline-none focus:border-indigo-500" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={handleTestCustomApi} disabled={customTesting || customSaving}
                  className="bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5">
                  {customTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Test Connection
                </button>
                <button type="submit" disabled={customSaving || customTesting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm">
                  {customSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Connect Custom API
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. Administrator Configuration Required Modal ── */}
      {oauthError && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-neutral-900 text-base flex items-center gap-2 text-amber-700">
                <ShieldAlert className="w-5 h-5 text-amber-600" /> Administrator Configuration Required
              </h3>
              <button type="button" onClick={() => setOauthError(null)} className="text-neutral-400 hover:text-neutral-600 text-sm font-bold">✕</button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <p className="font-semibold">{oauthError}</p>
              <p className="text-[11px] text-amber-700">
                To enable official OAuth login in your local or production deployment, configure the credentials in your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code> file.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={() => setOauthError(null)} className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
