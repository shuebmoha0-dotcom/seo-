"use client";

import { Sidebar } from "@/components/Sidebar";
import { Settings, Globe, GitBranch, Search, Key, Save, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

export default function SettingsPage() {
  const { currentWebsite } = useWebsite();
  const [saved, setSaved] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");

  useEffect(() => {
    if (currentWebsite) {
      setWebsiteUrl(currentWebsite.url || `https://${currentWebsite.domain}`);
      const githubIntegration = currentWebsite.integrations?.find(i => i.provider === 'github');
      const repo = githubIntegration?.config?.repo || (currentWebsite as any).github_repo;
      if (repo && typeof repo === 'string') {
        const parts = repo.split('/');
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

  return (
    <div className="flex min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>System</span>
            <span>&gt;</span>
            <span className="text-neutral-700">Settings</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Account &amp; Integration Settings</h1>
          <p className="text-neutral-500 text-xs mt-0.5">
            Manage connected SaaS websites, GitHub repository bindings, and API keys.
          </p>
        </header>

        <form onSubmit={handleSave} className="max-w-2xl space-y-6">
          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Settings updated successfully!
            </div>
          )}

          {/* Website Configuration */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-400" /> Target Website Configuration
            </h3>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Website URL</label>
              <input
                type="url"
                placeholder="https://yourwebsite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 text-xs text-neutral-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* GitHub Binding */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-neutral-900" /> GitHub Repository Binding
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Owner / Org</label>
                <input
                  type="text"
                  placeholder="organization-name"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 text-xs text-neutral-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Repo Name</label>
                <input
                  type="text"
                  placeholder="marketing-website"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 text-xs text-neutral-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>


          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </form>
      </div>
    </div>
  );
}
