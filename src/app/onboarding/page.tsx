"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  GitBranch,
  Search,
  ArrowRight,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  BookOpen,
  Code,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";

type PlatformType = "wordpress" | "github" | "custom_api" | "none";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteName, setWebsiteName] = useState("");
  
  // Platform selection
  const [platform, setPlatform] = useState<PlatformType>("wordpress");
  
  // WordPress credentials
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpSeoPlugin, setWpSeoPlugin] = useState("yoast");

  // GitHub credentials
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");

  // Custom API
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const [gscConnected, setGscConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleFinishOnboarding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        url: websiteUrl,
        name: websiteName || undefined,
        connection_type: platform,
      };

      if (platform === "wordpress") {
        payload.wordpress_config = {
          username: wpUsername || "admin",
          app_password: wpPassword,
          auth_method: "application_password",
          seo_plugin: wpSeoPlugin,
        };
      } else if (platform === "github") {
        payload.github_config = {
          owner: repoOwner,
          repo: repoName,
          branch: repoBranch || "main",
        };
      } else if (platform === "custom_api") {
        payload.custom_api_config = {
          api_base_url: apiBaseUrl || websiteUrl,
          auth_type: "bearer_token",
          api_key: apiKey,
        };
      }

      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.website)) {
        // Trigger initial autonomous crawl in background
        fetch("/api/agent/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: websiteUrl }),
        }).catch(() => {});

        router.push("/dashboard?onboarding=complete");
      } else {
        setError(data.error || "Failed to initialize website workspace.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect website.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-indigo-500/20">
      <div className="w-full max-w-xl bg-white border border-neutral-200/80 rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
        
        {/* Brand header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">
              O
            </div>
            <div>
              <span className="font-extrabold text-neutral-900 tracking-tight text-base">Outdart</span>
              <span className="text-[10px] ml-1.5 uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                Setup Wizard
              </span>
            </div>
          </div>
          <span className="text-xs font-semibold text-neutral-400">Step {step} of 3</span>
        </div>

        {/* Step Indicator Progress */}
        <div className="flex items-center justify-between mb-8 pb-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-indigo-600 font-bold" : "text-neutral-400"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 1 ? "bg-indigo-600 text-white shadow" : "bg-neutral-100 text-neutral-400"
            }`}>
              1
            </div>
            <span className="text-xs">Website</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 rounded-full transition-all ${step >= 2 ? "bg-indigo-600" : "bg-neutral-200"}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-indigo-600 font-bold" : "text-neutral-400"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 2 ? "bg-indigo-600 text-white shadow" : "bg-neutral-100 text-neutral-400"
            }`}>
              2
            </div>
            <span className="text-xs">Platform</span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 rounded-full transition-all ${step >= 3 ? "bg-indigo-600" : "bg-neutral-200"}`} />
          <div className={`flex items-center gap-2 ${step >= 3 ? "text-indigo-600 font-bold" : "text-neutral-400"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              step >= 3 ? "bg-indigo-600 text-white shadow" : "bg-neutral-100 text-neutral-400"
            }`}>
              3
            </div>
            <span className="text-xs">Credentials</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* STEP 1: Website URL & Name */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mb-1">
                Enter your website URL
              </h2>
              <p className="text-neutral-500 text-xs sm:text-sm">
                Enter the domain you want your autonomous AI SEO agent to monitor, audit, and rank.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                  Target Website URL
                </label>
                <div className="relative">
                  <Globe className="w-5 h-5 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="url"
                    required
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 pl-11 pr-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                  Workspace Name (Optional)
                </label>
                <input
                  type="text"
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  placeholder="Acme Growth"
                  className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                />
              </div>

              {/* GSC quick toggle */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl border border-neutral-200">
                    <Search className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-neutral-900">Google Search Console</h4>
                    <p className="text-[11px] text-neutral-500">Auto-sync search impressions and rankings</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGscConnected(!gscConnected)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    gscConnected
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
                  }`}
                >
                  {gscConnected ? "✓ Connected" : "Connect"}
                </button>
              </div>
            </div>

            <button
              disabled={!websiteUrl || !websiteUrl.startsWith("http")}
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2 cursor-pointer"
            >
              Choose Publishing Platform <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Choose Platform */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mb-1">
                How should Outdart publish?
              </h2>
              <p className="text-neutral-500 text-xs sm:text-sm">
                Choose how your autonomous agent should dispatch approved articles, meta tags, and fixes.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* WordPress Option */}
              <button
                type="button"
                onClick={() => setPlatform("wordpress")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                  platform === "wordpress"
                    ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                    : "bg-white border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${platform === "wordpress" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-neutral-900">WordPress</h4>
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Recommended · 1-Click
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Direct publishing via Application Passwords or connector. Yoast &amp; Rank Math supported.
                  </p>
                </div>
              </button>

              {/* GitHub Option */}
              <button
                type="button"
                onClick={() => setPlatform("github")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                  platform === "github"
                    ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                    : "bg-white border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${platform === "github" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-neutral-900">GitHub (Next.js / Astro)</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Agent opens Pull Requests with code diffs, markdown articles, and technical fixes.
                  </p>
                </div>
              </button>

              {/* Custom API Option */}
              <button
                type="button"
                onClick={() => setPlatform("custom_api")}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${
                  platform === "custom_api"
                    ? "bg-indigo-50/50 border-indigo-600 shadow-sm"
                    : "bg-white border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className={`p-2.5 rounded-xl ${platform === "custom_api" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>
                  <Code className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-neutral-900">Custom Webhook / REST API</h4>
                  <p className="text-xs text-neutral-500 mt-1">
                    Post articles to Webflow, Shopify, Framer, Ghost, or your proprietary CMS via webhook.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl text-xs font-bold transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2 cursor-pointer"
              >
                Continue to Configuration <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Platform Credentials & Finish */}
        {step === 3 && (
          <form onSubmit={handleFinishOnboarding} className="space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight mb-1">
                {platform === "wordpress"
                  ? "Connect WordPress"
                  : platform === "github"
                  ? "Connect GitHub Repository"
                  : "Connect Webhook API"}
              </h2>
              <p className="text-neutral-500 text-xs sm:text-sm">
                {platform === "wordpress"
                  ? "Uses WordPress Application Passwords — your admin password is never required or stored."
                  : platform === "github"
                  ? "Agent will submit changes as Pull Requests for your approval."
                  : "Configure your destination webhook endpoint and secret token."}
              </p>
            </div>

            {platform === "wordpress" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    WordPress Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="editor_user"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Application Password
                  </label>
                  <input
                    type="password"
                    required
                    value={wpPassword}
                    onChange={(e) => setWpPassword(e.target.value)}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Generate in WordPress Admin → Users → Profile → Application Passwords.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Installed SEO Plugin
                  </label>
                  <select
                    value={wpSeoPlugin}
                    onChange={(e) => setWpSeoPlugin(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    <option value="yoast">Yoast SEO</option>
                    <option value="rankmath">Rank Math SEO</option>
                    <option value="aioseo">All in One SEO</option>
                    <option value="none">None / Native Gutenberg</option>
                  </select>
                </div>
              </div>
            )}

            {platform === "github" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                      Repository Owner
                    </label>
                    <input
                      type="text"
                      required
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="acme-corp"
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      required
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="marketing-website"
                      className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Target Branch
                  </label>
                  <input
                    type="text"
                    value={repoBranch}
                    onChange={(e) => setRepoBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {platform === "custom_api" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    API Base URL / Webhook
                  </label>
                  <input
                    type="url"
                    required
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/content"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Bearer Token / API Key
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sec_••••••••••••••••"
                    className="w-full bg-neutral-50 border border-neutral-300 rounded-2xl py-2.5 px-4 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Safety guarantee */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-600 leading-relaxed">
                <strong>Human-in-the-loop guarantee:</strong> Connecting your website does NOT grant direct publishing rights. Every article, code change, or meta tag update requires your explicit approval.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-2xl text-xs font-bold transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Initializing Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Finish Setup &amp; Launch Agent</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
