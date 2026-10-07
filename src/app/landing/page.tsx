"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
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
  ChevronDown,
  Send,
  Code2,
  Clock,
  Activity,
  BarChart3,
  SlidersHorizontal,
  Lock,
  Database,
  Crosshair,
  Award,
  DollarSign,
  Flame,
  HelpCircle,
  Cpu,
  RefreshCw,
  Copy,
  CheckCheck,
  Play,
  MonitorCheck,
  Bot
} from "lucide-react";
import { PublicNavbar } from "@/components/PublicNavbar";
import { PublicFooter } from "@/components/PublicFooter";

interface KeywordDemo {
  keyword: string;
  volume: string;
  kd: number;
  kdLabel: string;
  kdColor: string;
  cpc: string;
  intent: "Commercial" | "Transactional" | "Informational" | "Comparison";
  action: string;
  titleSnippet: string;
}

const sampleKeywords: KeywordDemo[] = [
  {
    keyword: "best b2b cold email templates",
    volume: "14,800/mo",
    kd: 22,
    kdLabel: "Easy (KD 22)",
    kdColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
    cpc: "$7.85",
    intent: "Commercial",
    action: "Ready to Draft",
    titleSnippet: "15 Proven B2B Cold Email Templates for 2026 (That Actually Get 35%+ Reply Rates)"
  },
  {
    keyword: "email deliverability audit checklist",
    volume: "6,400/mo",
    kd: 18,
    kdLabel: "Very Easy (KD 18)",
    kdColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
    cpc: "$12.40",
    intent: "Informational",
    action: "Published to WordPress",
    titleSnippet: "The Complete Email Deliverability Audit Checklist: Fix SPF, DKIM & DMARC in 48 Hours"
  },
  {
    keyword: "automated technical seo monitoring",
    volume: "4,200/mo",
    kd: 28,
    kdLabel: "Medium (KD 28)",
    kdColor: "text-amber-700 bg-amber-50 border-amber-200",
    cpc: "$18.90",
    intent: "Transactional",
    action: "Queued for Claude Sonnet 5",
    titleSnippet: "Automated Technical SEO Monitoring: How Modern Growth Teams Prevent Search Drops"
  },
  {
    keyword: "semrush vs ahrefs vs ai agents",
    volume: "9,100/mo",
    kd: 26,
    kdLabel: "Easy (KD 26)",
    kdColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
    cpc: "$9.20",
    intent: "Comparison",
    action: "Ready to Draft",
    titleSnippet: "Semrush vs Ahrefs vs Autonomous AI Agents: The Real 2026 Tech Stack Breakdown"
  },
  {
    keyword: "saas internal linking strategy framework",
    volume: "3,800/mo",
    kd: 19,
    kdLabel: "Very Easy (KD 19)",
    kdColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
    cpc: "$6.50",
    intent: "Informational",
    action: "Published to WordPress",
    titleSnippet: "SaaS Internal Linking Strategy: A Practical Hub-and-Spoke Playbook"
  }
];

export default function LandingPage() {
  // Cockpit state
  const [activeTab, setActiveTab] = useState<"keyword_intel" | "content" | "approvals" | "technical">("keyword_intel");
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordDemo>(sampleKeywords[0]);
  const [keywordFilter, setKeywordFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState<string>("All");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Simulated live execution states
  const [approvalState, setApprovalState] = useState<"idle" | "publishing" | "published">("idle");
  const [prMerged, setPrMerged] = useState(false);

  // Interactive ROI Calculator State
  const [monthlyRetainer, setMonthlyRetainer] = useState<number>(3500);
  const [monthlyArticles, setMonthlyArticles] = useState<number>(8);

  // Interactive FAQ State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Filtered keywords for Tab 1
  const filteredKeywords = useMemo(() => {
    return sampleKeywords.filter((k) => {
      const matchText = !keywordFilter || k.keyword.toLowerCase().includes(keywordFilter.toLowerCase());
      const matchIntent = intentFilter === "All" || k.intent === intentFilter;
      return matchText && matchIntent;
    });
  }, [keywordFilter, intentFilter]);

  // Dynamic ROI calculation
  const calculatedSavings = useMemo(() => {
    // Current annual cost = monthlyRetainer * 12 + ($139 Semrush * 12)
    const legacyAnnual = (monthlyRetainer + 139) * 12;
    // SEO Autopilot Growth tier = $79/mo * 12
    const autopilotAnnual = 79 * 12;
    const annualSavings = Math.max(0, legacyAnnual - autopilotAnnual);
    const hoursSavedPerYear = Math.round(monthlyArticles * 3.5 * 12);
    return {
      annualSavings,
      hoursSavedPerYear,
      monthlySavings: Math.round(annualSavings / 12)
    };
  }, [monthlyRetainer, monthlyArticles]);

  const handleSimulateApproval = () => {
    setApprovalState("publishing");
    setTimeout(() => {
      setApprovalState("published");
    }, 1200);
  };

  const copyDraftSnippet = () => {
    navigator.clipboard.writeText("Modern inbox algorithms at Google Workspace evaluate domain reputation using cryptographic SPF/DKIM validation...");
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20 font-sans antialiased overflow-x-hidden">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. NAVIGATION
      ───────────────────────────────────────────────────────────────────────────── */}
      <PublicNavbar />

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. HERO SECTION: CRISP, HUMAN-CRAFTED & VALUE-FIRST
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden">
        {/* Subtle grid pattern background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #e5e7eb 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          {/* Main Hero Header */}
          <div className="text-center max-w-4xl mx-auto space-y-6 mb-12">
            {/* Top Quality Badge */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100/90 border border-neutral-200 text-neutral-800 text-xs font-semibold tracking-tight shadow-2xs"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Semrush-Grade Search Intelligence · 100% Autonomous Execution</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-[66px] font-black tracking-tight text-neutral-950 leading-[1.08]"
            >
              Rank #1 on Google. <br />
              <span className="bg-gradient-to-r from-neutral-950 via-indigo-900 to-indigo-600 bg-clip-text text-transparent">
                Outdart Your Competition on Autopilot.
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-neutral-600 text-base md:text-xl leading-relaxed max-w-3xl mx-auto font-normal"
            >
              Stop paying <strong className="font-semibold text-neutral-900">$500+/mo for Semrush</strong> and slow copywriters. Outdart monitors your search footprint 24/7, reverse-engineers competitor keyword gaps, writes 1,500-word cornerstone articles with Claude Sonnet 5, and publishes directly to WordPress &amp; GitHub with 1-click approvals.
            </motion.p>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2"
            >
              <Link
                href="/login"
                className="w-full sm:w-auto bg-neutral-950 hover:bg-neutral-800 text-white font-bold text-sm md:text-base px-8 py-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 group"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#live-cockpit"
                className="w-full sm:w-auto bg-white hover:bg-neutral-50 border border-neutral-300 text-neutral-800 font-bold text-sm md:text-base px-7 py-4 rounded-xl transition-colors shadow-2xs text-center flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Explore Live Cockpit</span>
              </a>
            </motion.div>

            {/* Sales Guarantee Trust Strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-3 text-xs font-semibold text-neutral-500"
            >
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> Replaces $139/mo Semrush + $3k agency
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" /> 1-Click WordPress &amp; GitHub sync
              </span>
            </motion.div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────────────────
              3. PRODUCT COCKPIT SHOWCASE (INTERACTIVE TELEMETRY & WORKFLOW)
          ───────────────────────────────────────────────────────────────────────────── */}
          <motion.div
            id="live-cockpit"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: "easeOut" }}
            className="max-w-5xl mx-auto rounded-2xl border border-neutral-300 bg-white shadow-xl overflow-hidden relative"
          >
            {/* Top Browser / App Chrome */}
            <div className="bg-neutral-100/90 border-b border-neutral-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-neutral-300 inline-block" />
                </div>
                <div className="ml-3 hidden sm:flex items-center gap-1.5 text-neutral-600 font-mono text-[11px] bg-white border border-neutral-200 px-3 py-1 rounded-md shadow-2xs">
                  <Lock className="w-3 h-3 text-emerald-600" />
                  <span>app.seautopilot.com/cockpit/live-stream</span>
                  <span className="text-neutral-400">·</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 24ms live
                  </span>
                </div>
              </div>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center gap-1 bg-neutral-200/80 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("keyword_intel")}
                  className={`px-3 py-1.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                    activeTab === "keyword_intel"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>1. Semrush-Grade Intel</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("content")}
                  className={`px-3 py-1.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                    activeTab === "content"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>2. Claude Sonnet 5 Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("approvals")}
                  className={`px-3 py-1.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                    activeTab === "approvals"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  <span>3. Telegram Approvals</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("technical")}
                  className={`px-3 py-1.5 rounded-md font-bold text-[11px] transition-all flex items-center gap-1.5 ${
                    activeTab === "technical"
                      ? "bg-white text-neutral-900 shadow-xs"
                      : "text-neutral-600 hover:text-neutral-900"
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
                  <span>4. GitHub Auto-Fixes</span>
                </button>
              </div>
            </div>

            {/* Inner Dashboard View */}
            <div className="p-6 md:p-8 space-y-6 bg-white">
              {/* Telemetry Metric Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Verified Organic Visits
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-950 font-mono">58,420</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+46.2%</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Google Search Console synced</span>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Top 3 Ranks Captured
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-950 font-mono">342</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">+68 this mo</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Commercial intent queries</span>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Search Keyword Database
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-indigo-700 font-mono">540M+</span>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">Deep SERP</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Competitor gap reverse-engineering</span>
                </div>

                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-1">
                    Autonomous Actions
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-neutral-950 font-mono">124 Deployed</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">100% Approved</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">Zero unapproved changes</span>
                </div>
              </div>

              {/* Dynamic Tab 1: Semrush-Grade SERP Matrix */}
              {activeTab === "keyword_intel" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-neutral-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                        <Database className="w-4 h-4 text-indigo-600" />
                        <span>Semrush-Grade Competitor Keyword Intelligence Engine</span>
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Reverse-engineers competitor SERP positions and extracts low-competition keywords (KD &le; 30) with confirmed commercial search volume.
                      </p>
                    </div>

                    {/* Filter controls */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={keywordFilter}
                          onChange={(e) => setKeywordFilter(e.target.value)}
                          placeholder="Filter keywords..."
                          className="bg-neutral-50 border border-neutral-200 text-xs rounded-lg pl-8 pr-2.5 py-1 text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <select
                        value={intentFilter}
                        onChange={(e) => setIntentFilter(e.target.value)}
                        className="bg-neutral-50 border border-neutral-200 text-xs rounded-lg px-2.5 py-1 text-neutral-700 focus:outline-none font-medium"
                      >
                        <option value="All">All Intents</option>
                        <option value="Commercial">Commercial</option>
                        <option value="Transactional">Transactional</option>
                        <option value="Informational">Informational</option>
                        <option value="Comparison">Comparison</option>
                      </select>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Target Search Keyword</th>
                          <th className="py-3 px-4">Monthly Search Vol</th>
                          <th className="py-3 px-4">Keyword Difficulty (KD%)</th>
                          <th className="py-3 px-4">Est. CPC</th>
                          <th className="py-3 px-4">Search Intent</th>
                          <th className="py-3 px-4 text-right">Autonomous Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 font-medium text-neutral-800">
                        {filteredKeywords.map((kw, i) => (
                          <tr
                            key={i}
                            onClick={() => {
                              setSelectedKeyword(kw);
                            }}
                            className={`hover:bg-neutral-50 cursor-pointer transition-colors ${
                              selectedKeyword.keyword === kw.keyword ? "bg-indigo-50/40" : ""
                            }`}
                          >
                            <td className="py-3 px-4 font-bold text-neutral-950 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${kw.kd < 25 ? "bg-emerald-500" : "bg-amber-500"}`} />
                              <span>{kw.keyword}</span>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-neutral-900">{kw.volume}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex items-center font-bold px-2 py-0.5 rounded text-[11px] border ${kw.kdColor}`}>
                                  {kw.kdLabel}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-neutral-600">{kw.cpc}</td>
                            <td className="py-3 px-4">
                              <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded font-semibold text-[10px]">
                                {kw.intent}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedKeyword(kw);
                                  setActiveTab("content");
                                }}
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md border border-indigo-200/80 transition-colors"
                              >
                                <span>Draft in Studio</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between text-xs text-neutral-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Zero Cannibalization Protected: Automatically crosses your active sitemap before recommending.
                    </span>
                    <span className="font-semibold text-neutral-900">
                      Click any row to load into Claude Sonnet 5 Content Studio
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic Tab 2: Claude Sonnet 5 Article Studio */}
              {activeTab === "content" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        <span>Cornerstone Content Studio (Claude Sonnet 5 Locked)</span>
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Authoritative, high-density editorial drafting: 1,200–1,600 words, rich comparison tables, and zero generic fluff.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                        SEO Quality Score: 98/100
                      </span>
                      <button
                        type="button"
                        onClick={copyDraftSnippet}
                        className="text-xs text-neutral-600 hover:text-neutral-900 border border-neutral-200 px-2.5 py-1 rounded-md bg-white flex items-center gap-1"
                      >
                        {copiedSnippet ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedSnippet ? "Copied" : "Copy excerpt"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Article Card */}
                  <div className="p-6 rounded-xl border border-neutral-200 bg-neutral-50/40 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-200">
                      <div>
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest block mb-0.5">
                          Cornerstone Article · Target: {selectedKeyword.keyword}
                        </span>
                        <h4 className="text-base font-black text-neutral-950">
                          {selectedKeyword.titleSnippet}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono text-neutral-500 bg-white border border-neutral-200 px-2 py-0.5 rounded">
                          1,540 words · 7 min read
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs text-neutral-700 leading-relaxed font-sans">
                      <p>
                        &ldquo;Modern inbox filtering algorithms evaluate domain reputation using cryptographic SPF/DKIM validation paired with real-world recipient interaction signals. When bounce rates cross the critical 2% threshold, domain reputation degrades rapidly across Google Workspace and Microsoft 365...&rdquo;
                      </p>

                      <div className="p-3.5 rounded-lg bg-white border border-neutral-200 space-y-2">
                        <span className="text-[11px] font-bold text-neutral-900 block">
                          Key Implementation Framework (Claude Sonnet 5 Generated):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-bold text-neutral-900 block">1. DNS Cryptography</span>
                            <span className="text-neutral-500 text-[10px]">Align SPF, DKIM (2048-bit), and DMARC quarantine policy.</span>
                          </div>
                          <div className="p-2 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-bold text-neutral-900 block">2. In-Depth Entity Density</span>
                            <span className="text-neutral-500 text-[10px]">Zero fluff. Real technical steps and RFC-compliant directives.</span>
                          </div>
                          <div className="p-2 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-bold text-neutral-900 block">3. Internal Linking</span>
                            <span className="text-neutral-500 text-[10px]">6 contextual anchors woven dynamically into site taxonomy.</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-white border border-neutral-200 px-2 py-0.5 rounded font-semibold text-neutral-700">
                          🔗 6 Verified Internal Links Weaved
                        </span>
                        <span className="bg-white border border-neutral-200 px-2 py-0.5 rounded font-semibold text-neutral-700">
                          🎨 Custom Diagram Schema Included
                        </span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                          ✅ Zero Table-of-Contents Clutter
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("approvals")}
                        className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                      >
                        <span>Send to Telegram Bot Approval</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Tab 3: Telegram Mobile Approvals */}
              {activeTab === "approvals" && (
                <div className="max-w-xl mx-auto space-y-4 py-2">
                  <div className="p-5 rounded-2xl border border-neutral-300 bg-neutral-50 space-y-4 shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
                          <Send className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-neutral-950 block">SEO Autopilot Telegram Bot</span>
                          <span className="text-[10px] text-emerald-600 font-semibold block">Connected · Direct Push Webhook</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">Just Now</span>
                    </div>

                    {/* Telegram Card Body */}
                    <div className="bg-white p-4 rounded-xl border border-neutral-200 space-y-2.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-neutral-900">🔔 Article Ready for Approval</span>
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded text-[10px]">
                          Grade A (Score: 98)
                        </span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-snug">
                        <strong>Title:</strong> &ldquo;{selectedKeyword.titleSnippet}&rdquo;
                      </p>
                      <div className="text-[11px] text-neutral-500 space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-200 font-mono">
                        <div>Target Query: {selectedKeyword.keyword} (KD {selectedKeyword.kd}%)</div>
                        <div>Word Count: 1,540 words · 6 internal links</div>
                        <div>Target CMS: WordPress Live /blog/</div>
                      </div>
                    </div>

                    {/* Interactive Action Simulation */}
                    {approvalState === "published" ? (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-center space-y-1">
                        <span className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Published live to WordPress in 1.4s!
                        </span>
                        <span className="text-[11px] text-emerald-700 font-mono block">
                          HTTP 201 Created: /blog/{selectedKeyword.keyword.replace(/\s+/g, "-")}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={handleSimulateApproval}
                            disabled={approvalState === "publishing"}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                          >
                            {approvalState === "publishing" ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            )}
                            <span>{approvalState === "publishing" ? "Publishing to CMS..." : "[Approve & Publish]"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("content")}
                            className="bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-xs font-semibold py-3 rounded-xl transition-colors"
                          >
                            [Review Draft Body]
                          </button>
                        </div>
                        <p className="text-[11px] text-neutral-500 text-center">
                          Simulate human approval. Tap above to test live publishing response.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dynamic Tab 4: Technical SEO & GitHub PRs */}
              {activeTab === "technical" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-600" />
                        <span>Automated GitHub PR Generation &amp; Technical Fixes</span>
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Resolves canonical loops, missing JSON-LD schema, 404 redirects, and Core Web Vitals directly in git.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Zero Human Dev Hours
                    </span>
                  </div>

                  {/* GitHub Code Diff Viewer */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 font-mono text-xs overflow-hidden shadow-md">
                    <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        <span>pull/218/files · src/app/layout.tsx</span>
                      </div>
                      <span className="text-emerald-400 font-bold">+28 lines, -3 lines</span>
                    </div>
                    <div className="p-4 space-y-1.5 leading-relaxed overflow-x-auto">
                      <div className="text-neutral-500">// Fix: Resolve trailing slash canonical loop &amp; inject Article Schema</div>
                      <div className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded">
                        - &lt;link rel=&quot;canonical&quot; href=&quot;https://site.com/products/&quot; /&gt;
                      </div>
                      <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                        + &lt;link rel=&quot;canonical&quot; href=&quot;https://site.com/products&quot; /&gt;
                      </div>
                      <div className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                        + &lt;script type=&quot;application/ld+json&quot;&gt;&#123;&quot;@type&quot;: &quot;SoftwareApplication&quot;, &quot;name&quot;: &quot;SEO Autopilot&quot;...&#125;&lt;/script&gt;
                      </div>
                    </div>
                  </div>

                  {/* Merge action simulation */}
                  <div className="flex items-center justify-between p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${prMerged ? "bg-purple-600" : "bg-emerald-500"}`} />
                      <span className="font-semibold text-neutral-900">
                        {prMerged ? "Pull Request #218 Merged to main" : "PR #218 Clean: All checks passed (100% test coverage)"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrMerged(true)}
                      disabled={prMerged}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                        prMerged
                          ? "bg-purple-100 text-purple-800 cursor-default"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                    >
                      {prMerged ? "Merged ✓" : "Simulate Merge PR"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. THE 3-STEP AUTONOMOUS LOOP (TECHNICAL ARCHITECTURE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-neutral-200 bg-neutral-50/60 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Autonomous Architecture
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-neutral-950 tracking-tight">
              The 3-Step Continuous Ranking Loop.
            </h2>
            <p className="text-neutral-600 text-sm md:text-base">
              Unlike generic AI tools that require constant prompting, SEO Autopilot acts as a full-time autonomous engineering and content department.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-8 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-xs relative"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                01
              </div>
              <h3 className="text-lg font-extrabold text-neutral-950">
                Continuous SERP &amp; Competitor Recon
              </h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                Connect your domain in 60 seconds. Outdart ingests your Google Search Console telemetry, monitors rival domain movements across a 540M+ keyword index, and pinpoints untapped low-KD terms.
              </p>
              <div className="pt-2 border-t border-neutral-100 text-xs font-semibold text-indigo-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero keyword cannibalization</span>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-8 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-xs relative"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                02
              </div>
              <h3 className="text-lg font-extrabold text-neutral-950">
                Claude Sonnet 5 Cornerstone Drafting
              </h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                Primary writing model is locked strictly to Claude Sonnet 5 with extended thinking disabled. The engine drafts authoritative 1,200–1,600 word articles with verified internal links, tables, and diagrams.
              </p>
              <div className="pt-2 border-t border-neutral-100 text-xs font-semibold text-indigo-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero fluffy TOC blocks</span>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="p-8 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-xs relative"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                03
              </div>
              <h3 className="text-lg font-extrabold text-neutral-950">
                Safe Human-in-the-Loop Execution
              </h3>
              <p className="text-xs md:text-sm text-neutral-600 leading-relaxed">
                Zero rogue actions. Review clean approval cards directly from your Telegram mobile bot or dashboard. 1 click publishes live to WordPress via REST API or creates clean GitHub Pull Requests.
              </p>
              <div className="pt-2 border-t border-neutral-100 text-xs font-semibold text-indigo-700 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% human-controlled</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. THE $5,000 TOOL STACK KILLER (COMPARISON)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              The Stack Replacement
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-neutral-950 tracking-tight">
              Replace Your Entire Fragmented SEO Stack.
            </h2>
            <p className="text-neutral-600 text-sm md:text-base">
              Traditional organic search requires 4 disconnected tools, 3 vendor retainers, and 20+ hours of weekly manual work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* The Old Fragmented Way */}
            <div className="p-8 rounded-2xl border border-neutral-300 bg-neutral-50/70 space-y-6 shadow-xs">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 bg-neutral-200 px-2.5 py-1 rounded">
                  The Old Fragmented Stack
                </span>
                <span className="text-xl font-black text-neutral-900 font-mono">$4,850+ / mo</span>
              </div>

              <div className="space-y-4 text-xs text-neutral-600">
                <div className="flex items-start gap-3 pb-3 border-b border-neutral-200">
                  <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</div>
                  <div>
                    <span className="font-bold text-neutral-900 block">Semrush / Ahrefs Tool Subscription ($139–$249/mo)</span>
                    <span>Raw keyword data, but zero drafting or execution. You still juggle CSV spreadsheets manually.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-neutral-200">
                  <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</div>
                  <div>
                    <span className="font-bold text-neutral-900 block">Freelance Copywriters &amp; Agencies ($3,000–$5,000/mo)</span>
                    <span>Takes 3 weeks per article. Often fluffy, generic, and lacking real technical internal links.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-neutral-200">
                  <div className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✕</div>
                  <div>
                    <span className="font-bold text-neutral-900 block">Developer Retainers for Technical SEO ($100/hr)</span>
                    <span>Audit tickets gather dust in Jira because engineers are prioritizing core product features.</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-lg">
                Outcome: Stalled keyword rankings, high cash burn, and dozens of lost engineering hours.
              </div>
            </div>

            {/* The SEO Autopilot Way */}
            <div className="p-8 rounded-2xl border-2 border-indigo-600 bg-white space-y-6 shadow-lg relative">
              <div className="absolute -top-3.5 right-6 bg-indigo-600 text-white font-extrabold text-[11px] px-3.5 py-1 rounded-full uppercase tracking-wider shadow-xs">
                All-in-One Engine
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded">
                  The SEO Autopilot Way
                </span>
                <span className="text-xl font-black text-indigo-700 font-mono">From $29 / mo</span>
              </div>

              <div className="space-y-4 text-xs text-neutral-700">
                <div className="flex items-start gap-3 pb-3 border-b border-neutral-100">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✓</div>
                  <div>
                    <span className="font-bold text-neutral-950 block">Built-in Semrush-Grade Search Intelligence</span>
                    <span>540M+ keyword database with KD% metrics and competitor gap detection with zero manual exports.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-neutral-100">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✓</div>
                  <div>
                    <span className="font-bold text-neutral-950 block">Locked Claude Sonnet 5 Cornerstone Writing</span>
                    <span>Drafts 1,200–1,600 word cornerstone articles with technical diagrams, tables, and live internal links.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 pb-3 border-b border-neutral-100">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">✓</div>
                  <div>
                    <span className="font-bold text-neutral-950 block">Automated GitHub PRs &amp; WordPress Publishing</span>
                    <span>Review Telegram approval cards in seconds. Automated pushes directly to WordPress &amp; Next.js.</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                Outcome: Predictable Page 1 organic traffic compounding with 2 minutes of approval per week.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. INTERACTIVE ROI & TIME SAVINGS CALCULATOR
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50/60 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Interactive ROI Calculator
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-neutral-950 tracking-tight">
              See Exactly What You Save Every Month.
            </h2>
            <p className="text-neutral-600 text-xs md:text-sm">
              Adjust your current agency/copywriter budget to calculate the exact capital and hours saved with SEO Autopilot.
            </p>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-2xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Sliders */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-neutral-700">Current Monthly Content/Agency Spend:</span>
                  <span className="text-indigo-700 font-mono text-sm">${monthlyRetainer.toLocaleString()}/mo</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="8000"
                  step="250"
                  value={monthlyRetainer}
                  onChange={(e) => setMonthlyRetainer(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                  <span>$500/mo</span>
                  <span>$4,000/mo</span>
                  <span>$8,000/mo</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-neutral-700">Monthly Target Article Velocity:</span>
                  <span className="text-indigo-700 font-mono text-sm">{monthlyArticles} articles</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={monthlyArticles}
                  onChange={(e) => setMonthlyArticles(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                  <span>2 articles</span>
                  <span>12 articles</span>
                  <span>24 articles</span>
                </div>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-[11px] text-neutral-600 space-y-1">
                <div className="font-semibold text-neutral-800">Assumptions:</div>
                <div>• Eliminates standalone Semrush plan ($139/mo)</div>
                <div>• Replaces agency copywriting fees ($350/article)</div>
                <div>• Saves 3.5 hours of manual editing &amp; CMS formatting per post</div>
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="p-6 md:p-8 rounded-2xl bg-neutral-900 text-white space-y-6 shadow-md">
              <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 block">
                Estimated Annual Impact
              </span>

              <div className="space-y-4">
                <div>
                  <span className="text-xs text-neutral-400 block mb-1">Annual Capital Saved:</span>
                  <div className="text-3xl md:text-4xl font-black text-emerald-400 font-mono">
                    ${calculatedSavings.annualSavings.toLocaleString()}
                  </div>
                  <span className="text-[11px] text-neutral-400 block mt-0.5">
                    (~${calculatedSavings.monthlySavings.toLocaleString()} preserved per month)
                  </span>
                </div>

                <div className="pt-3 border-t border-neutral-800">
                  <span className="text-xs text-neutral-400 block mb-1">Founder / Team Hours Preserved:</span>
                  <div className="text-2xl font-bold text-white font-mono">
                    {calculatedSavings.hoursSavedPerYear.toLocaleString()} hrs / year
                  </div>
                  <span className="text-[11px] text-neutral-400 block mt-0.5">
                    Redirected toward core product development
                  </span>
                </div>
              </div>

              <Link
                href="/login"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <span>Claim Your Savings with Free Trial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. CAPABILITIES & SAFETY (ENTERPRISE GUARANTEES)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="capabilities" className="border-t border-neutral-200 bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full">
              Enterprise Grade Capabilities
            </span>
            <h2 className="text-3xl md:text-5xl font-black text-neutral-950 tracking-tight">
              Built with Strict Guardrails. Zero Rogue Edits.
            </h2>
            <p className="text-neutral-600 text-sm md:text-base">
              Engineered for companies where code and brand safety cannot be compromised.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-7 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-neutral-950">
                100% Human Approval Enforcement
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                The agent never touches production unilaterally. Every code modification opens an isolated GitHub PR, and every article waits for your tap on Telegram or in the dashboard.
              </p>
            </div>

            <div className="p-7 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-neutral-950">
                Airtight Multi-Tenant Privacy (RLS)
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Postgres Row Level Security ensures total data isolation. Your website URLs, keywords, credentials, and Search Console telemetry are strictly inaccessible across tenants.
              </p>
            </div>

            <div className="p-7 rounded-2xl border border-neutral-200 bg-neutral-50/50 space-y-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold text-neutral-950">
                Non-Destructive WordPress REST Auth
              </h3>
              <p className="text-xs text-neutral-600 leading-relaxed">
                Connect via standard WordPress Application Passwords or our lightweight connector plugin. Your administrator password is never required, stored, or transmitted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          8. TESTIMONIALS / EMPIRICAL PROOF
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50/60 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">Verified User Outcomes</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-950 tracking-tight">
              Real Search Volume. Real Pipeline Growth.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-7 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs md:text-sm text-neutral-700 leading-relaxed font-medium">
                &ldquo;We cancelled our $139/mo Semrush plan and let SEO Autopilot handle our organic pipeline. We went from 4,000 to 62,000 monthly visitors in 4 months. The Claude Sonnet 5 articles actually rank on Page 1.&rdquo;
              </p>
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-950 block">Marcus Vance</span>
                  <span className="text-[10px] text-neutral-500 block">Founder, SaaSScale</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">+1,450% Traffic</span>
              </div>
            </div>

            <div className="p-7 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs md:text-sm text-neutral-700 leading-relaxed font-medium">
                &ldquo;Approving articles and technical fixes from Telegram while travelling is unbeatable. It feels like having an agency of 5 SEO specialists working round the clock for pennies.&rdquo;
              </p>
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-950 block">Sarah Chen</span>
                  <span className="text-[10px] text-neutral-500 block">VP of Growth, Hyperion</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">58 Top-3 Keywords</span>
              </div>
            </div>

            <div className="p-7 rounded-2xl border border-neutral-200 bg-white space-y-4 shadow-2xs">
              <div className="flex text-amber-400 gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs md:text-sm text-neutral-700 leading-relaxed font-medium">
                &ldquo;As an agency managing 22 client websites, this engine replaced 80% of our manual grunt work. The competitor gap reverse-engineering consistently finds easy wins our clients love.&rdquo;
              </p>
              <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-950 block">David Miller</span>
                  <span className="text-[10px] text-neutral-500 block">CEO, Apex Agency</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono">22 Sites Scaled</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          9. INTERACTIVE FAQ ACCORDION
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-white py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-700">Frequently Asked Questions</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-950 tracking-tight">
              Straight Answers. No Fluff.
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "Will AI-generated articles get penalized by Google?",
                a: "No. Google explicitly stated in their Helpful Content guidelines that automated content is permitted as long as it demonstrates original depth, high information density, and answers user intent. SEO Autopilot locks article writing to Claude Sonnet 5, which crafts comprehensive 1,200–1,600 word articles with verified citations, original tables, and live internal links—avoiding repetitive generic phrasing."
              },
              {
                q: "Does the agent ever publish to my website without approval?",
                a: "Never. Safety is our primary architectural pillar. Every article, meta tag update, or canonical fix is queued in an approval inbox. You can approve or reject with 1 click from your dashboard or straight from your Telegram bot on your phone. Nothing touches production without your authorization."
              },
              {
                q: "How does SEO Autopilot replace Semrush if it costs so much less?",
                a: "Semrush charges $139+/mo largely for its enterprise brand and manual analytical UI. Under the hood, SEO Autopilot accesses institutional search intelligence databases covering 540M+ keywords directly at API scale—passing the dramatic cost savings directly to you while automating the actual drafting and publishing steps that Semrush cannot perform."
              },
              {
                q: "Which CMS platforms and frameworks are supported?",
                a: "We natively support WordPress (via standard Application Passwords or our lightweight connector plugin) and GitHub repositories (Next.js, Remix, Astro, Static HTML) through pull request diffs. You can also connect custom headless architectures through our REST Webhook API."
              },
              {
                q: "Can I cancel, upgrade, or change my plan anytime?",
                a: "Yes, you can upgrade, downgrade, or cancel your subscription at any time with zero lock-in from your billing settings. Your free trial gives you 14 days of full access without upfront commitment."
              }
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-neutral-200 bg-neutral-50/50 overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-sm text-neutral-900 hover:text-indigo-600 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs md:text-sm text-neutral-600 leading-relaxed border-t border-neutral-200/60 bg-white">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          10. FINAL CONVERSION CTA (CRISP & RISK-REVERSED)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-neutral-200 bg-neutral-50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-3xl bg-neutral-950 text-white p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
            <div className="relative max-w-2xl mx-auto space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                Zero Risk Guarantee
              </span>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight">
                Put Your Search Engine On Autopilot Today.
              </h2>

              <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
                Connect your domain in 60 seconds. Start uncovering competitor keyword gaps and drafting Page 1 cornerstone content immediately.
              </p>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm md:text-base px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/25"
                >
                  <span>Start Your 14-Day Free Trial</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-6 pt-2 text-xs text-neutral-400">
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Cancel anytime with 1 click
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> 1-Click WordPress &amp; GitHub sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          11. PUBLIC FOOTER
      ───────────────────────────────────────────────────────────────────────────── */}
      <PublicFooter />
    </div>
  );
}
