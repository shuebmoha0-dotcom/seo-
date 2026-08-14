"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, GitBranch, Search, ArrowRight, CheckCircle2 } from "lucide-react";

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [gscConnected, setGscConnected] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleCreateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: websiteUrl,
          repo_owner: repoOwner,
          repo_name: repoName,
        }),
      });

      if (res.ok) {
        // Trigger initial crawl in background
        fetch("/api/agent/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: websiteUrl }),
        });
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Failed to connect website", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-white">
      <div className="w-full max-w-xl glass p-8 rounded-3xl relative overflow-hidden">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-neutral-200">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-indigo-600" : "text-neutral-500"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? "bg-indigo-500 text-white" : "bg-neutral-200"}`}>1</div>
            <span className="text-sm font-medium">Website</span>
          </div>
          <div className="h-px bg-neutral-200 w-12" />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-indigo-600" : "text-neutral-500"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? "bg-indigo-500 text-white" : "bg-neutral-200"}`}>2</div>
            <span className="text-sm font-medium">Integrations</span>
          </div>
          <div className="h-px bg-neutral-200 w-12" />
          <div className={`flex items-center gap-2 ${step >= 3 ? "text-indigo-600" : "text-neutral-500"}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 3 ? "bg-indigo-500 text-white" : "bg-neutral-200"}`}>3</div>
            <span className="text-sm font-medium">Repository</span>
          </div>
        </div>

        {/* Step 1: Website Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">Enter your Website URL</h2>
              <p className="text-neutral-500 text-sm">Target SaaS marketing site to analyze and optimize.</p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Target URL</label>
              <div className="relative">
                <Globe className="w-5 h-5 text-neutral-500 absolute left-3 top-3" />
                <input
                  type="url"
                  required
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://my-saas-company.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-neutral-700 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              disabled={!websiteUrl}
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2"
            >
              Continue to Integrations <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: OAuth Connect */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">Connect Integrations</h2>
              <p className="text-neutral-500 text-sm">OAuth authentication for Search Console and GitHub access.</p>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200">
                    <Search className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900">Google Search Console</h4>
                    <p className="text-xs text-neutral-500">Import query performance &amp; CTR data</p>
                  </div>
                </div>
                <button
                  onClick={() => setGscConnected(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${gscConnected ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}`}
                >
                  {gscConnected ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span> : "Connect OAuth"}
                </button>
              </div>

              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl border border-neutral-200">
                    <GitBranch className="w-5 h-5 text-neutral-900" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-900">GitHub OAuth</h4>
                    <p className="text-xs text-neutral-500">Deploy optimizations as Pull Requests</p>
                  </div>
                </div>
                <button
                  onClick={() => setGithubConnected(true)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${githubConnected ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"}`}
                >
                  {githubConnected ? <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Connected</span> : "Connect OAuth"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => setStep(1)} className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium">Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2">
                Continue to Repository <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Repository Connection */}
        {step === 3 && (
          <form onSubmit={handleCreateWebsite} className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">Target Repository</h2>
              <p className="text-neutral-500 text-sm">Select the GitHub repo containing your website code.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Repo Owner</label>
                <input
                  type="text"
                  required
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  placeholder="acme-corp"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 text-neutral-700 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-neutral-500 mb-2">Repo Name</label>
                <input
                  type="text"
                  required
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="marketing-website"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 px-4 text-neutral-700 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStep(2)} className="px-4 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium">Back</button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] flex justify-center items-center gap-2"
              >
                {loading ? "Initializing Agent..." : "Finish Setup & Start Agent"}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
