"use client";

import { Sidebar } from "@/components/Sidebar";
import { 
  Bot, Clock, Play, Pause, Settings, Eye, MousePointerClick, Search,
  BarChart3, CheckCircle2, AlertCircle, FileText, Globe, Key, Database,
  TrendingUp, Activity, Link as LinkIcon, Lightbulb, ChevronRight, X, ArrowRight,
  Sparkles, ListChecks, Calendar, ShieldCheck, Zap
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

// Stub data for the UI
const chartData = [
  { date: "May 12", traffic: 9500 },
  { date: "May 15", traffic: 11200 },
  { date: "May 19", traffic: 12400 },
  { date: "May 22", traffic: 11800 },
  { date: "May 26", traffic: 14500 },
  { date: "Jun 2", traffic: 13900 },
  { date: "Jun 9", traffic: 16800 },
  { date: "Jun 12", traffic: 18247 },
];

export default function DashboardPage() {
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [runState, setRunState] = useState("");

  const handleRunNow = () => {
    setIsAgentRunning(true);
    const states = [
      "Starting SEO Agent...",
      "Initializing",
      "Analyzing website",
      "Checking Search Console",
      "Researching keywords",
      "Analyzing competitors",
      "Finding SEO opportunities",
      "Building strategy",
      "Preparing actions",
      "Waiting for approval"
    ];
    let i = 0;
    setRunState(states[0]);
    const interval = setInterval(() => {
      i++;
      if (i < states.length) {
        setRunState(states[i]);
      } else {
        clearInterval(interval);
        setTimeout(() => setIsAgentRunning(false), 2000);
      }
    }, 1500);
  };

  const pendingApprovals = [
    {
      id: "app_1",
      title: "Publish article",
      subtitle: "Best SEO Tools for SaaS Startups",
      type: "Content",
      impact: "High",
      confidence: "91%",
      why: "High volume keyword with low competition matching our ICP.",
      evidence: "Keyword 'seo tools for saas' has 3,200 SV and KD 14.",
      expectedImpact: "Estimated 400-600 monthly organic visitors.",
      risk: "Low. Additive content.",
      affected: "New URL: /blog/best-seo-tools-saas",
      before: "N/A (New Page)",
      after: "Draft ready for publishing",
      agent: "Content Agent"
    },
    {
      id: "app_2",
      title: "Update homepage title",
      subtitle: "Optimize for 'AI SEO Software'",
      type: "On-Page SEO",
      impact: "Medium",
      confidence: "94%",
      why: "Current title is too generic and CTR is below average.",
      evidence: "Avg Position 6.2, but CTR is only 1.4% (industry avg 3.1%).",
      expectedImpact: "Expect 15-20% increase in organic clicks from improved CTR.",
      risk: "Temporary ranking fluctuation possible during re-indexing.",
      affected: "Homepage (index.html)",
      before: "<title>SEO Autopilot - Grow Your Traffic</title>",
      after: "<title>AI SEO Software & Autonomous Agent | SEO Autopilot</title>",
      agent: "On-Page SEO Agent"
    },
    {
      id: "app_3",
      title: "Add 8 internal links",
      subtitle: "Link to new 'Programmatic SEO' guide",
      type: "Internal Linking",
      impact: "Medium",
      confidence: "88%",
      why: "New pillar page needs internal link equity to rank faster.",
      evidence: "8 existing pages mention 'programmatic seo' without linking to the guide.",
      expectedImpact: "Faster indexing and higher initial ranking for the new guide.",
      risk: "None.",
      affected: "8 blog posts",
      before: "Unlinked text mentions",
      after: "Optimized exact-match and partial-match anchor text links",
      agent: "Internal Linking Agent"
    }
  ];

  const activeAlerts = [
    {
      id: "alert_1",
      category: "CRITICAL",
      title: "Homepage organic clicks declined 38%",
      what: "Traffic to the homepage has dropped significantly over the last 7 days.",
      why: "CTR declined from 3.1% to 1.9% while average position remained stable at 6.2.",
      evidence: "Previous 7 days: 4,200 clicks. Current 7 days: 2,600 clicks.",
      target: "/",
      started: "4 days ago",
      next: "Review homepage title and meta description. Sent to On-Page SEO Agent."
    },
    {
      id: "alert_2",
      category: "HIGH",
      title: "Competitor overtook high-value keyword",
      what: "ahrefs.com moved from Pos 8 to Pos 4 for 'enterprise seo software'.",
      why: "They acquired 14 new high-authority backlinks in the last 2 weeks.",
      evidence: "Customer position dropped from Pos 5 to Pos 6.",
      target: "enterprise seo software",
      started: "2 days ago",
      next: "Investigate backlink gap. Sent to Strategy Agent."
    },
    {
      id: "alert_3",
      category: "INFO",
      title: "Experiment Success: Title update",
      what: "CTR improved by 15% after title update.",
      why: "Positive signal for the new 'AI SEO Software' positioning.",
      evidence: "Baseline CTR: 1.4%. 7-day CTR: 1.6%.",
      target: "/",
      started: "Yesterday",
      next: "Keep changes."
    }
  ];

  const recentActivity = [
    { time: "09:20", text: "Waiting for human approval", type: "wait" },
    { time: "09:18", text: "Content Agent completed article draft", type: "content" },
    { time: "09:16", text: "Strategy Agent prioritized 4 actions", type: "strategy" },
    { time: "09:11", text: "Competitor Agent detected 3 competitor changes", type: "competitor" },
    { time: "09:07", text: "Keyword Agent found 12 opportunities", type: "keyword" },
    { time: "09:04", text: "Website crawler analyzed 84 pages", type: "crawl" },
    { time: "09:02", text: "Daily SEO run started", type: "start" },
  ];

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] text-neutral-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden max-w-[1600px] mx-auto">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-neutral-200 px-8 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" /> SEO Command Center
              </h1>
              <div className="flex items-center gap-2 text-xs mt-1">
                <span className="text-neutral-500 font-medium">Project:</span>
                <span className="bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md font-semibold">Acme SaaS</span>
                <span className="text-neutral-300">|</span>
                <a href="#" className="text-indigo-600 hover:underline font-medium">acme.com</a>
                <span className="text-neutral-300">|</span>
                <span className="text-neutral-500">B2B SaaS (US)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-1.5 pr-4">
              <div className="bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </div>
                <span className="text-xs font-bold text-neutral-900">Agent Active</span>
              </div>
              <div className="text-[10px] text-neutral-500 flex flex-col">
                <span>Last: 24m ago</span>
                <span className="font-medium text-neutral-700">Next: Tomorrow 9:00 AM</span>
              </div>
            </div>
            
            <button 
              onClick={handleRunNow}
              disabled={isAgentRunning}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2"
            >
              {isAgentRunning ? <Bot className="w-4 h-4 animate-bounce" /> : <Play className="w-4 h-4" />}
              {isAgentRunning ? "Agent Running..." : "Run Now"}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* RUN STATE BANNER */}
          {isAgentRunning && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Bot className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-900">AI Agent is active</h3>
                  <p className="text-xs text-indigo-700 font-mono mt-0.5">{runState}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "0ms"}}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "150ms"}}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{animationDelay: "300ms"}}></span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* LEFT COLUMN: PRIMARY WORKFLOW */}
            <div className="xl:col-span-8 space-y-8">
              
              {/* PENDING APPROVALS */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" /> 
                    Needs Your Approval
                  </h2>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                    {pendingApprovals.length} Actions Waiting
                  </span>
                </div>
                <div className="space-y-3">
                  {pendingApprovals.map((app) => (
                    <div key={app.id} className="bg-white border-[1.5px] border-amber-200 hover:border-amber-400 rounded-2xl p-5 shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                            {app.type}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${
                            app.impact === 'High' ? 'text-red-700 bg-red-50 border-red-100' : 'text-amber-700 bg-amber-50 border-amber-100'
                          }`}>
                            Impact: {app.impact}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                            Confidence: {app.confidence}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-neutral-900">{app.title}</h3>
                        <p className="text-sm text-neutral-500 mt-0.5">{app.subtitle}</p>
                      </div>
                      <button 
                        onClick={() => setSelectedApproval(app)}
                        className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-colors shrink-0 shadow-sm"
                      >
                        Review Action
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* ACTIVE ALERTS & INSIGHTS */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-500" /> 
                    Active Alerts & Insights
                  </h2>
                </div>
                <div className="space-y-3">
                  {activeAlerts.map((alert) => (
                    <div key={alert.id} className="bg-white border border-neutral-200 hover:border-neutral-300 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden group">
                      <div className={`absolute top-0 left-0 w-1 h-full ${
                        alert.category === 'CRITICAL' ? 'bg-red-500' : 
                        alert.category === 'HIGH' ? 'bg-amber-500' : 
                        alert.category === 'MEDIUM' ? 'bg-indigo-400' : 'bg-emerald-400'
                      }`} />
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                            alert.category === 'CRITICAL' ? 'text-red-700 bg-red-50 border-red-100' : 
                            alert.category === 'HIGH' ? 'text-amber-700 bg-amber-50 border-amber-100' : 
                            alert.category === 'MEDIUM' ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 
                            'text-emerald-700 bg-emerald-50 border-emerald-100'
                          }`}>
                            {alert.category}
                          </span>
                          <span className="text-xs text-neutral-500 font-medium font-mono">{alert.target}</span>
                        </div>
                        <span className="text-xs text-neutral-400 font-medium">{alert.started}</span>
                      </div>
                      <h3 className="text-base font-bold text-neutral-900 mb-1">{alert.title}</h3>
                      <p className="text-sm text-neutral-600 mb-3">{alert.what} {alert.why}</p>
                      
                      <div className="flex flex-col md:flex-row md:items-center gap-4 bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Evidence</span>
                          <span className="text-xs font-mono text-neutral-700">{alert.evidence}</span>
                        </div>
                        <div className="flex-1 md:border-l md:border-neutral-200 md:pl-4">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">Next Step</span>
                          <span className="text-xs font-medium text-indigo-700">{alert.next}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* TOP OPPORTUNITIES */}
              <section>
                <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-400" /> 
                  Highest Value Opportunities
                </h2>
                <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-5 flex items-start gap-4 hover:bg-neutral-50 transition-colors">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-xl mt-1 border border-purple-100">
                      <MousePointerClick className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase">On-Page SEO</span>
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded">High Priority</span>
                      </div>
                      <h4 className="font-bold text-neutral-900 text-sm">Improve homepage CTR</h4>
                      <p className="text-xs text-neutral-600 mt-1 mb-3">
                        <span className="font-semibold text-neutral-900">Evidence:</span> 18,400 impressions but only 1.4% CTR (Avg position 6.2).
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 inline-block font-medium">
                          Recommended action: Test improved title and meta description
                        </p>
                        <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Review</button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* AUTOPILOT TASKS */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-500" /> 
                    Autopilot Schedules
                  </h2>
                  <Link href="/autopilot" className="text-xs font-bold text-indigo-600 hover:underline">
                    Manage Tasks
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        ACTIVE
                      </div>
                      <button className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"><Pause className="w-3.5 h-3.5" /></button>
                    </div>
                    <h3 className="font-bold text-neutral-900 text-sm mb-1">Write one SEO article every day.</h3>
                    <p className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 mt-2">
                      <Clock className="w-3 h-3" /> Every day at 09:00
                    </p>
                    <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center text-[10px]">
                      <span className="text-neutral-500 font-medium">Next run: Tomorrow 09:00</span>
                      <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">1 Approval Waiting</span>
                    </div>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        ACTIVE
                      </div>
                      <button className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"><Pause className="w-3.5 h-3.5" /></button>
                    </div>
                    <h3 className="font-bold text-neutral-900 text-sm mb-1">Research competitors & analyze SERP.</h3>
                    <p className="text-xs text-indigo-600 font-medium flex items-center gap-1.5 mt-2">
                      <Clock className="w-3 h-3" /> Every day at 18:00
                    </p>
                    <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center text-[10px]">
                      <span className="text-neutral-500 font-medium">Next run: Today 18:00</span>
                      <span className="text-emerald-600 font-bold">Up to date</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* AGENT TEAM OVERVIEW GRID */}
              <section>
                <h2 className="text-lg font-bold text-neutral-900 mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-500" /> 
                  Specialized Agent Status
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { name: "Content Agent", icon: FileText, stats: ["12 published", "4 drafts", "3 waiting"] },
                    { name: "Keyword Agent", icon: Search, stats: ["12 new opps", "8 long-tail", "4 page 2"] },
                    { name: "Competitor Agent", icon: Eye, stats: ["7 content gaps", "4 keyword gaps", "2 threats"] },
                    { name: "Backlink Agent", icon: LinkIcon, stats: ["23 prospects", "8 high quality", "4 drafts"] },
                    { name: "Technical Agent", icon: Settings, stats: ["0 critical", "2 high", "5 medium"] },
                    { name: "On-Page Agent", icon: Layout, stats: ["6 priority pages", "12 metadata", "9 links"] }
                  ].map((agent, i) => (
                    <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-neutral-100 text-neutral-600 rounded-lg group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          <agent.icon className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-neutral-900 text-sm">{agent.name}</h4>
                      </div>
                      <ul className="space-y-1.5">
                        {agent.stats.map((s, idx) => (
                          <li key={idx} className="text-xs text-neutral-600 flex items-center gap-2 font-medium">
                            <span className="w-1 h-1 rounded-full bg-indigo-300" /> {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* RIGHT COLUMN: CONTEXT, KPI, TIMELINE */}
            <div className="xl:col-span-4 space-y-6">
              
              {/* TOP KPI AREA */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Organic Clicks</span>
                  <div className="text-2xl font-black text-neutral-900 mb-1">18,247</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                    <TrendingUp className="w-3 h-3" /> 23.6%
                  </span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Impressions</span>
                  <div className="text-2xl font-black text-neutral-900 mb-1">224K</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                    <TrendingUp className="w-3 h-3" /> 16.3%
                  </span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Avg Position</span>
                  <div className="text-2xl font-black text-neutral-900 mb-1">12.4</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                    <TrendingUp className="w-3 h-3" /> 2.7
                  </span>
                </div>
                <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1 block">Conversions</span>
                  <div className="text-2xl font-black text-neutral-900 mb-1">142</div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                    <TrendingUp className="w-3 h-3" /> 8.4%
                  </span>
                </div>
              </div>

              {/* TIMELINE */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-neutral-900 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" /> Recent Activity
                  </h3>
                  <button className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider hover:underline">View All</button>
                </div>
                <div className="relative border-l-2 border-neutral-100 ml-2 space-y-4 pb-2">
                  {recentActivity.map((act, i) => (
                    <div key={i} className="relative pl-5">
                      <div className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${i === 0 ? 'bg-amber-500 animate-pulse' : 'bg-indigo-400'}`} />
                      <div className="text-[10px] font-bold text-neutral-400 mb-0.5">{act.time}</div>
                      <div className={`text-xs ${i === 0 ? 'font-bold text-amber-700' : 'text-neutral-700 font-medium'}`}>{act.text}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DAILY SUMMARY */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-indigo-900 text-xs mb-2 uppercase tracking-wider">Today's SEO Summary</h3>
                <p className="text-xs text-indigo-800 leading-relaxed mb-3">
                  The agent analyzed your website and found <strong className="font-bold">12 opportunities</strong>.
                </p>
                <div className="text-xs text-indigo-800 space-y-2 mb-4">
                  <p><strong className="font-bold text-indigo-900 block mb-0.5">Most important:</strong> Pricing page receiving high impressions but low CTR.</p>
                  <p><strong className="font-bold text-indigo-900 block mb-0.5">Recommended:</strong> Improve title and meta description.</p>
                </div>
                <button className="w-full bg-white border border-indigo-200 text-indigo-700 text-xs font-bold py-2.5 rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                  View Full Report
                </button>
              </div>

              {/* INTEGRATION & MEMORY STATUS */}
              <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-5">
                <div>
                  <h3 className="font-bold text-neutral-900 text-[10px] uppercase tracking-wider mb-3">Connections</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 font-medium flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-neutral-400" /> Search Console</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 font-medium flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-neutral-400" /> Analytics</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-600 font-medium flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-neutral-400" /> WordPress</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-neutral-100">
                  <h3 className="font-bold text-neutral-900 text-[10px] uppercase tracking-wider mb-3">Instructions & Memory</h3>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-bold py-2 rounded-xl transition-colors">
                      Instructions
                    </button>
                    <button className="flex-1 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs font-bold py-2 rounded-xl transition-colors">
                      Memory
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* APPROVAL DETAIL MODAL */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                    {selectedApproval.type}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                    By: {selectedApproval.agent}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-neutral-900">{selectedApproval.title}</h2>
              </div>
              <button onClick={() => setSelectedApproval(null)} className="p-2 hover:bg-neutral-100 rounded-full text-neutral-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[#FAFAFA]">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Why</h4>
                  <p className="text-sm text-neutral-800 font-medium">{selectedApproval.why}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Expected Impact</h4>
                  <p className="text-sm text-emerald-700 font-bold">{selectedApproval.expectedImpact}</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Evidence</h4>
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-sm text-neutral-800 font-mono text-xs">
                  {selectedApproval.evidence}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-3">Proposed Changes</h4>
                <p className="text-xs font-bold text-neutral-900 mb-3">Affected: <span className="font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded">{selectedApproval.affected}</span></p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-red-100 rounded-xl overflow-hidden">
                    <div className="bg-red-50 px-3 py-2 border-b border-red-100 text-[10px] font-bold text-red-700 uppercase tracking-wider">Before</div>
                    <div className="p-3 bg-white text-xs font-mono text-neutral-600">{selectedApproval.before}</div>
                  </div>
                  <div className="border border-emerald-100 rounded-xl overflow-hidden">
                    <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wider">After</div>
                    <div className="p-3 bg-white text-xs font-mono text-emerald-700 font-bold">{selectedApproval.after}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Risk Analysis</h4>
                <p className="text-xs text-amber-700 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4" /> {selectedApproval.risk}
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-200 bg-white rounded-b-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button className="px-5 py-2.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-xl transition-colors">
                  Reject
                </button>
                <button className="px-5 py-2.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-xl transition-colors">
                  Ask Agent to Revise
                </button>
                <button className="px-5 py-2.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-xl transition-colors">
                  Edit Manually
                </button>
              </div>
              <button 
                onClick={() => setSelectedApproval(null)}
                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                Approve & Execute <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Layout helper for Lucide icon
function Layout(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="3" x2="21" y1="9" y2="9" />
      <line x1="9" x2="9" y1="21" y2="9" />
    </svg>
  );
}
