"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Settings, Globe, GitBranch, Search, Key, Save, CheckCircle2,
  Shield, Bell, Smartphone, Copy, Check, Eye, EyeOff, Sparkles,
  ExternalLink, Layers, RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function SettingsPage() {
  const { currentWebsite } = useWebsite();
  const [saved, setSaved] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");
  const [autoPr, setAutoPr] = useState(true);
  const [crawlFreq, setCrawlFreq] = useState("daily");
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (currentWebsite) {
      const url = currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : "");
      setWebsiteUrl(url);
      setSitemapUrl(url ? `${url}/sitemap.xml` : "");
      const githubIntegration = currentWebsite.integrations?.find((i) => i.provider === "github");
      const repo = githubIntegration?.config?.repo || (currentWebsite as any).github_repo;
      if (repo && typeof repo === "string") {
        const parts = repo.split("/");
        if (parts.length === 2) {
          setRepoOwner(parts[0]);
          setRepoName(parts[1]);
        }
      }
    }
  }, [currentWebsite]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">System</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Settings</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Workspace &amp; Engine Settings
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Configure target website properties, GitOps execution pipelines, and notification webhooks.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-xs active:scale-[0.98] self-start md:self-auto"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save All Settings</span>
          </button>
        </div>

        {saved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-medium">Settings updated and synchronized across all autonomous agents.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Target Website Configuration */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-900">Target Website Configuration</h3>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Active Website Scope
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Production Website URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  XML Sitemap Endpoint
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/sitemap.xml"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-900 block">Autonomous Crawl Frequency</span>
                <span className="text-[11px] text-slate-500">How often the agent audits indexability and technical health</span>
              </div>
              <div className="inline-flex p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium">
                {["daily", "weekly", "manual"].map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setCrawlFreq(freq)}
                    className={`px-3 py-1 rounded-md capitalize transition-all ${
                      crawlFreq === freq ? "bg-white text-slate-900 shadow-2xs font-semibold" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* GitHub Repository Binding (GitOps Engine) */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-900">GitHub GitOps Execution Engine</h3>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Code Deployment Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  GitHub Organization / Owner
                </label>
                <input
                  type="text"
                  placeholder="acme-org"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Repository Name
                </label>
                <input
                  type="text"
                  placeholder="website"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Production Branch
                </label>
                <input
                  type="text"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-slate-900 block">Autonomous Pull Request Workflow</span>
                <span className="text-[11px] text-slate-500">Generate review-ready PRs for schema updates and metadata fixes</span>
              </div>
              <input
                type="checkbox"
                checked={autoPr}
                onChange={(e) => setAutoPr(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Telegram Mobile Controller Link */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-900">Telegram Bot Controller</h3>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Webhook Active
              </span>
            </div>

            <div className="p-4 bg-slate-50/75 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">@Autonomous_seo_agent_bot</span>
                  <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono font-semibold">
                    v2.4 Live
                  </span>
                </div>
                <p className="text-slate-500 text-[11px]">
                  Send SEO tasks, request instant articles, and approve 1-click publishing directly from Telegram.
                </p>
              </div>

              <a
                href="https://t.me/Autonomous_seo_agent_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 shadow-2xs self-start sm:self-auto transition-colors"
              >
                <span>Open in Telegram</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* API Keys & Webhook Endpoints */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-600" />
                <h3 className="font-semibold text-sm text-slate-900">API Credentials &amp; Webhook URL</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">REST v1</span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Agent Webhook Delivery Endpoint
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value="https://seo-hazel-eight.vercel.app/api/telegram/webhook"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs text-slate-700 font-mono select-all"
                  />
                  <button
                    type="button"
                    onClick={() => copyText("https://seo-hazel-eight.vercel.app/api/telegram/webhook", "webhook")}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  >
                    {copiedKey === "webhook" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
