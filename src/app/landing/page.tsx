"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Bot,
  CheckCircle2,
  Zap,
  FileText,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  Star,
  Check,
  Globe,
  Terminal,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Send,
  Code2,
  Clock,
  Activity,
  BarChart3,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"crawler" | "content" | "execution" | "approvals">("crawler");
  const [approvedExample, setApprovedExample] = useState(false);

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20 font-sans antialiased overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. NAVIGATION HEADER
      ───────────────────────────────────────────────────────────────────────────── */}
      <PublicNavbar />

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. HERO SECTION
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
        {/* Subtle background radial light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.08)_0%,_transparent_70%)] pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-6">
          {/* Hero Header Content */}
          <div className="text-center max-w-3xl mx-auto space-y-6 mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
              <span>Next-Gen Autonomous SEO Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.1]">
              Put Your Organic Search on True Autopilot.
            </h1>

            <p className="text-neutral-600 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
              An autonomous agent that continuously audits technical debts, discovers high-intent keywords, writes cornerstone content, and deploys fixes via GitHub and WordPress — with 100% human approval.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <Link
                href="/login"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#demo"
                className="w-full sm:w-auto bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 font-bold text-sm px-6 py-3.5 rounded-xl transition-colors shadow-2xs text-center"
              >
                View Live Telemetry
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-medium text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Zero setup fees
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Native GitHub &amp; WordPress connectors
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Cancel anytime
              </span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────────────────
              3. PRODUCT COCKPIT SHOWCASE (HUMAN-BUILT, HIGH-DENSITY MOCKUP)
          ───────────────────────────────────────────────────────────────────────────── */}
          <div id="demo" className="max-w-5xl mx-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden relative">
            {/* Window Chrome / Browser Bar */}
            <div className="bg-neutral-50/90 border-b border-neutral-200 px-4 py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                </div>
                <div className="ml-3 hidden sm:flex items-center gap-1.5 text-neutral-400 font-mono text-[11px] bg-white border border-neutral-200 px-2.5 py-0.5 rounded-md">
                  <Lock className="w-3 h-3 text-neutral-400" />
                  <span>app.seautopilot.io / acme-corp / live-telemetry</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Autonomous Engine: Active</span>
                </span>
                <span className="text-[11px] text-neutral-400 hidden sm:inline">Last sync: 2m ago</span>
              </div>
            </div>

            {/* Inner Dashboard Cockpit */}
            <div className="p-6 md:p-8 space-y-6 bg-white">
              {/* Telemetry Metric Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Organic Monthly Clicks
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-900">42,850</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+38.4%</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Keywords in Top 3
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-900">218</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">+34 this mo</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Crawl Health Score
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-900">99.2%</span>
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">0 critical 404s</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
                  <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1">
                    Autonomous Actions
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-indigo-600">84 Merged</span>
                    <span className="text-xs font-bold text-neutral-500">2 Pending</span>
                  </div>
                </div>
              </div>

              {/* Main Cockpit Split: Left Feed & Right Approval Simulation */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                {/* Left Column: Live Agent Execution Stream */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Live Autonomous Action Stream</span>
                    </h3>
                    <span className="text-[10px] text-neutral-400 font-mono">Continuous Engine</span>
                  </div>

                  {/* Feed Items */}
                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/30 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                          <GitBranch className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-900">GitHub Pull Request #142 Merged</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">Deployed</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Automated Schema.org JSON-LD and OpenGraph metadata injected across 38 dynamic marketing routes.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">12m ago</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-900">Cornerstone Draft Ready for Review</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">Action Required</span>
                          </div>
                          <p className="text-[11px] text-neutral-600 mt-0.5">
                            "Complete Guide to Multi-Tenant SEO Architecture" (1,540 words, 14 internal links, 2 custom diagrams).
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">34m ago</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/30 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800 shrink-0 mt-0.5">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-900">Competitor Keyword Gap Detected</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 font-semibold border border-neutral-200">Rank Tracking</span>
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Competitor dropped from #2 to #6 on "headless cms technical seo" (3,200 search volume). Agent queued counter-article.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-400 shrink-0">1h ago</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Human-In-The-Loop Approval Card */}
                <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-2xl border border-indigo-200/90 bg-gradient-to-b from-indigo-50/50 via-white to-white shadow-sm space-y-4">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs">
                          <Send className="w-3 h-3" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-neutral-900 block leading-tight">Telegram Approval Bot</span>
                          <span className="text-[10px] text-emerald-600 font-semibold block leading-tight">Connected · Instant Push</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">Live Simulation</span>
                    </div>

                    <div className="mt-4 p-3.5 bg-white border border-neutral-200 rounded-xl space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-neutral-900">Proposed SEO Action #104</span>
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">Low Risk</span>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">
                        Update meta descriptions and canonical links across 12 product directory pages to recover ranking drift.
                      </p>
                      <div className="text-[10px] font-mono text-neutral-400 bg-neutral-50 p-2 rounded border border-neutral-100">
                        Target: /products/* · Predicted Impact: +14% CTR
                      </div>
                    </div>
                  </div>

                  {/* Approval Interactive Actions */}
                  <div>
                    {approvedExample ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                        <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Action Approved &amp; Dispatched to GitHub
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="text-[10px] text-neutral-500 text-center block">Try approving this test action:</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setApprovedExample(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-xs"
                          >
                            Approve &amp; Deploy
                          </button>
                          <button
                            type="button"
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                          >
                            Review Code Diff
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. LOGO TICKER / SOCIAL PROOF
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-y border-neutral-200/80 bg-neutral-50/50 py-10">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-6">
            Engineered for high-growth SaaS, engineering teams, and digital agencies
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 text-neutral-400 font-bold text-base md:text-lg tracking-tight">
            <span className="hover:text-neutral-700 transition-colors">ACME CORP</span>
            <span className="hover:text-neutral-700 transition-colors">SCALEOPS</span>
            <span className="hover:text-neutral-700 transition-colors">DATAFORTRESS</span>
            <span className="hover:text-neutral-700 transition-colors">HYPERION AI</span>
            <span className="hover:text-neutral-700 transition-colors">VELOCE LABS</span>
            <span className="hover:text-neutral-700 transition-colors">STACKVENTURE</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. THE 4 CORE AUTONOMOUS PILLARS (CAPABILITIES)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="capabilities" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Complete Autonomy</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
            How the Autonomous Engine Operates
          </h2>
          <p className="text-sm md:text-base text-neutral-600">
            Traditional tools give you a 50-page PDF report. SEO Autopilot diagnoses the problem, writes the fix, and submits the pull request for you.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Technical Crawler */}
          <div className="p-8 rounded-3xl border border-neutral-200 bg-white shadow-xs hover:shadow-md transition-shadow space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Deep Technical Crawler &amp; Auto-Fixes</h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                The agent continuously crawls your live DOM, detecting canonical loops, broken internal links, duplicate H1s, and missing Schema markup. Instead of alerting you to fix it, it generates clean, production-ready code pull requests.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-neutral-900 text-neutral-300 font-mono text-xs overflow-x-auto">
              <span className="text-neutral-500">// Automated Pull Request generated</span><br />
              <span className="text-red-400">- &lt;title&gt;Pricing | Acme&lt;/title&gt;</span><br />
              <span className="text-emerald-400">+ &lt;title&gt;Enterprise SaaS Pricing &amp; Plans | Acme&lt;/title&gt;</span><br />
              <span className="text-emerald-400">+ &lt;meta name="description" content="Transparent pricing..." /&gt;</span>
            </div>
          </div>

          {/* Card 2: Autonomous Content Planner */}
          <div className="p-8 rounded-3xl border border-neutral-200 bg-white shadow-xs hover:shadow-md transition-shadow space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Cornerstone Content Studio</h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                The content agent identifies competitor keyword gaps, clusters buyer intent, and drafts authoritative 1,200–1,600 word articles. It includes rich comparison tables, structured headings, and custom visual infographics.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-900">Article Quality Gate</span>
                <span className="text-indigo-600 font-bold">1,540 Words · Grade A</span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-indigo-600 h-full w-[96%]" />
              </div>
              <span className="text-[10px] text-neutral-500 block">Tested against 18 on-page ranking signals before review</span>
            </div>
          </div>

          {/* Card 3: Direct CMS & GitHub Publishing */}
          <div className="p-8 rounded-3xl border border-neutral-200 bg-white shadow-xs hover:shadow-md transition-shadow space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <GitBranch className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Direct GitHub &amp; WordPress Execution</h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                Connect your Next.js GitHub repository or WordPress CMS via Application Passwords. When an action is approved, the agent pushes directly to your repository or creates native WordPress drafts without requiring your admin password.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <span className="font-bold text-neutral-900 block mb-0.5">GitHub Integration</span>
                <span className="text-[11px] text-neutral-500">Atomic branches &amp; PR diffs</span>
              </div>
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <span className="font-bold text-neutral-900 block mb-0.5">WordPress API</span>
                <span className="text-[11px] text-neutral-500">Yoast / Rank Math sync</span>
              </div>
            </div>
          </div>

          {/* Card 4: Human in the Loop Control */}
          <div className="p-8 rounded-3xl border border-neutral-200 bg-white shadow-xs hover:shadow-md transition-shadow space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">Human-in-the-Loop Safeguard</h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                Zero rogue edits. You retain 100% control over your production website. Receive actionable approval cards directly to your private Telegram bot or review them inside your dashboard with one-click rollbacks.
              </p>
            </div>
            <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs text-emerald-900 font-medium">
                Every code edit, meta tag, and article draft requires explicit human approval before live execution.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. COMPARISON: TRADITIONAL AGENCY VS. SEO AUTOPILOT
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="comparison" className="bg-neutral-50/70 border-y border-neutral-200 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">The Modern Way</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
              Why Founders are Replacing Manual SEO
            </h2>
          </div>

          <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-500">
                  <th className="py-4 px-6 font-bold uppercase tracking-wider">Dimension</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-wider text-neutral-400">Traditional Agency</th>
                  <th className="py-4 px-6 font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50/50">SEO Autopilot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                <tr>
                  <td className="py-4 px-6 font-bold text-neutral-900">Execution Speed</td>
                  <td className="py-4 px-6 text-neutral-500">3–6 weeks per sprint</td>
                  <td className="py-4 px-6 font-bold text-indigo-700 bg-indigo-50/30">Continuous &amp; under 15 minutes</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-bold text-neutral-900">Code Changes</td>
                  <td className="py-4 px-6 text-neutral-500">Sends you a PDF for your developers to build</td>
                  <td className="py-4 px-6 font-bold text-indigo-700 bg-indigo-50/30">Generates ready-to-merge GitHub PRs</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-bold text-neutral-900">Content Production</td>
                  <td className="py-4 px-6 text-neutral-500">2–4 generic blog posts per month</td>
                  <td className="py-4 px-6 font-bold text-indigo-700 bg-indigo-50/30">Continuous cornerstone guides with custom diagrams</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-bold text-neutral-900">Cost</td>
                  <td className="py-4 px-6 text-neutral-500">$4,000 – $8,000 / month retainer</td>
                  <td className="py-4 px-6 font-bold text-indigo-700 bg-indigo-50/30">From $24 / month</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-bold text-neutral-900">Approvals &amp; Control</td>
                  <td className="py-4 px-6 text-neutral-500">Endless email threads and status calls</td>
                  <td className="py-4 px-6 font-bold text-indigo-700 bg-indigo-50/30">1-click Telegram approvals from your phone</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. VERIFIED TRAFFIC PROOF & TESTIMONIALS
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">Real Results</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">
            Built for Businesses that Need Organic Revenue
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs md:text-sm text-neutral-700 leading-relaxed">
              "We grew our organic search traffic from 3,200 to 54,000 monthly visitors in under 5 months. The autonomous GitHub PRs alone saved our engineering team dozens of hours."
            </p>
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">Marcus Vance</span>
                <span className="text-[10px] text-neutral-400 block">CTO, CloudStack</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">+1,580% Traffic</span>
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs md:text-sm text-neutral-700 leading-relaxed">
              "Being able to approve articles and technical fixes from Telegram while at the airport is incredible. It genuinely feels like hiring a senior technical SEO engineer for our team."
            </p>
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">Sarah Chen</span>
                <span className="text-[10px] text-neutral-400 block">Head of Growth, HyperScale</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">42 Top-3 Keywords</span>
            </div>
          </div>

          <div className="p-8 rounded-3xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
            <div className="flex text-amber-400 gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs md:text-sm text-neutral-700 leading-relaxed">
              "As an agency managing 18 client domains, SEO Autopilot eliminated the manual busywork of schema audits and keyword tracking. Our team can now focus entirely on high-level strategy."
            </p>
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">David Miller</span>
                <span className="text-[10px] text-neutral-400 block">Founder, Apex Digital Agency</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">18 Sites Managed</span>
            </div>
          </div>
        </div>
      </section>

      {/* Public Marketing Footer */}
      <PublicFooter />
    </div>
  );
}
