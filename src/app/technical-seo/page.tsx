"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Wrench, Loader2, CheckCircle2, XCircle, AlertTriangle, AlertCircle,
  ChevronRight, ChevronDown, Info, Cpu, ExternalLink, GitPullRequest,
  Link2, Globe, FileCode, Shield, ShieldAlert, Zap, Search, BarChart2,
  RotateCcw, Filter, Download, RefreshCw, ArrowRight, GitBranch,
  CheckSquare, Eye, Layers, Clock
} from "lucide-react";
import { useState, useEffect } from "react";
import { useWebsite } from "@/lib/context/WebsiteContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low" | "info";
type IssueStatus = "open" | "in_progress" | "fixed" | "verified" | "failed" | "wont_fix" | "acknowledged";
type AutomationLevel = "auto" | "semi_auto" | "manual" | "requires_approval";
type RiskLevel = "low" | "medium" | "high";
type Tab = "overview" | "issues" | "urls" | "recommendations";
type SiteTech = "nextjs" | "react" | "astro" | "nuxt" | "static_html" | "webflow" | "wordpress" | "shopify" | "headless_cms" | "custom" | "unknown";

interface TechnicalIssue {
  id: string;
  category: string;
  severity: Severity;
  issue_type: string;
  title: string;
  description: string;
  evidence?: string;
  affected_urls: string[];
  affected_url_count: number;
  sample_url?: string;
  seo_impact: string;
  business_impact: string;
  recommended_fix: string;
  estimated_effort: string;
  risk_level: RiskLevel;
  automation_level: AutomationLevel;
  status: IssueStatus;
  pr_url?: string;
}

interface CrawledUrl {
  url: string;
  status_code: number;
  redirect_target?: string;
  canonical_url?: string;
  is_indexable: boolean;
  in_sitemap: boolean;
  internal_links_in: number;
  is_orphan: boolean;
  has_schema: boolean;
  has_thin_content?: boolean;
  word_count?: number;
  h1?: string;
  title?: string;
  robots_directive?: string;
}

interface CrawlResult {
  total_urls_found: number;
  total_urls_crawled: number;
  urls_200: number;
  urls_301: number;
  urls_302: number;
  urls_404: number;
  urls_5xx: number;
  urls_noindex: number;
  urls_indexed: number;
  urls_orphaned: number;
  broken_internal_links: number;
  crawlability_score: number;
  indexability_score: number;
  technical_health_score: number;
  urls: CrawledUrl[];
  issues: TechnicalIssue[];
  site_tech: SiteTech;
}



// ─── Config ───────────────────────────────────────────────────────────────────
const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; dot: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-700 border-red-300",   dot: "bg-red-500",     bg: "bg-red-50" },
  high:     { label: "High",     color: "text-amber-700 border-amber-300", dot: "bg-amber-500", bg: "bg-amber-50" },
  medium:   { label: "Medium",   color: "text-blue-700 border-blue-300",  dot: "bg-blue-500",   bg: "bg-blue-50" },
  low:      { label: "Low",      color: "text-neutral-600 border-neutral-300", dot: "bg-neutral-400", bg: "bg-neutral-50" },
  info:     { label: "Info",     color: "text-teal-600 border-teal-200",  dot: "bg-teal-400",   bg: "bg-teal-50" },
};

const AUTOMATION_CONFIG: Record<AutomationLevel, { label: string; color: string }> = {
  auto:               { label: "Auto-fixable",       color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  semi_auto:          { label: "Semi-automatic",     color: "text-blue-600 bg-blue-50 border-blue-200" },
  manual:             { label: "Manual fix",         color: "text-neutral-600 bg-neutral-100 border-neutral-200" },
  requires_approval:  { label: "⚠ Requires Approval", color: "text-red-600 bg-red-50 border-red-200" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: any; color: string }> = {
  low:    { label: "Low risk",    icon: Shield,      color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  medium: { label: "Medium risk", icon: AlertCircle, color: "text-amber-600 bg-amber-50 border-amber-200" },
  high:   { label: "High risk",   icon: ShieldAlert, color: "text-red-600 bg-red-50 border-red-200" },
};

const CATEGORY_ICONS: Record<string, any> = {
  crawlability: Globe, indexability: Eye, redirects: ArrowRight,
  broken_links: XCircle, canonicals: Shield, sitemap: FileCode,
  robots: Shield, performance: Zap, structured_data: FileCode,
  duplicates: Layers, orphan_pages: Link2, javascript: Cpu,
  hreflang: Globe, security: ShieldAlert, mobile: Cpu,
  pagination: Layers, internal_links: Link2, other: Info,
};

const STATUS_NEXT: Record<IssueStatus, IssueStatus> = {
  open: "in_progress", in_progress: "fixed", fixed: "verified",
  verified: "verified", failed: "open", wont_fix: "wont_fix", acknowledged: "open",
};

const TECH_COLORS: Record<string, string> = {
  nextjs: "text-neutral-800 bg-neutral-100 border-neutral-300",
  react: "text-blue-700 bg-blue-50 border-blue-200",
  wordpress: "text-blue-600 bg-blue-50 border-blue-200",
  shopify: "text-emerald-700 bg-emerald-50 border-emerald-200",
  webflow: "text-indigo-700 bg-indigo-50 border-indigo-200",
  astro: "text-orange-700 bg-orange-50 border-orange-200",
  nuxt: "text-green-700 bg-green-50 border-green-200",
  unknown: "text-neutral-500 bg-neutral-100 border-neutral-200",
};

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const r = 28, c = 2 * Math.PI * r, offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={70} height={70} className="-rotate-90">
        <circle cx={35} cy={35} r={r} fill="none" stroke="#f3f4f6" strokeWidth={7} />
        <circle cx={35} cy={35} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={35} y={35} dominantBaseline="middle" textAnchor="middle"
          fill="#111827" fontSize={14} fontWeight="700" className="rotate-90"
          transform="rotate(90, 35, 35)">{score}</text>
      </svg>
      <span className="text-[10px] text-neutral-500 font-medium text-center">{label}</span>
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────
function IssueCard({
  issue, expanded, onToggle, onStatusChange,
}: {
  issue: TechnicalIssue;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: IssueStatus) => void;
}) {
  const sv = SEVERITY_CONFIG[issue.severity];
  const at = AUTOMATION_CONFIG[issue.automation_level];
  const rv = RISK_CONFIG[issue.risk_level];
  const RiskIcon = rv.icon;
  const CatIcon = CATEGORY_ICONS[issue.category] || Info;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition-all ${
      issue.status === "fixed" || issue.status === "verified" ? "border-emerald-200 opacity-70"
        : issue.severity === "critical" ? "border-red-200"
          : issue.severity === "high" ? "border-amber-200"
            : "border-neutral-200"
    }`}>
      <div className="p-5 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start gap-4">
          {/* Severity indicator */}
          <div className={`w-1 self-stretch rounded-full shrink-0 ${sv.dot}`} />

          <div className={`p-2.5 rounded-xl border ${sv.bg} ${sv.color} shrink-0`}>
            <CatIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${sv.bg} ${sv.color}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sv.dot}`} />{sv.label}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${at.color}`}>{at.label}</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rv.color}`}>
                <RiskIcon className="w-2.5 h-2.5 inline mr-0.5" />{rv.label}
              </span>
              <span className="text-[10px] text-neutral-500 capitalize">{issue.category.replace(/_/g, " ")}</span>
            </div>
            <p className="text-sm font-semibold text-neutral-900">{issue.title}</p>
            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{issue.description}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status control */}
            <select
              value={issue.status}
              onChange={e => { e.stopPropagation(); onStatusChange(issue.id, e.target.value as IssueStatus); }}
              onClick={e => e.stopPropagation()}
              className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border cursor-pointer focus:outline-none ${
                issue.status === "verified" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : issue.status === "fixed" ? "bg-teal-50 text-teal-700 border-teal-200"
                    : issue.status === "in_progress" ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-neutral-100 text-neutral-600 border-neutral-200"
              }`}
            >
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="verified">Verified ✓</option>
              <option value="wont_fix">Won't Fix</option>
            </select>
            {issue.automation_level === "auto" && (
              <button
                onClick={e => { e.stopPropagation(); onStatusChange(issue.id, "fixed"); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <Zap className="w-3 h-3" /> Auto-fix
              </button>
            )}
            {issue.automation_level !== "auto" && issue.automation_level !== "manual" && issue.status === "open" && (
              <button
                onClick={e => { e.stopPropagation(); onStatusChange(issue.id, "in_progress"); }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> Create PR
              </button>
            )}
            <ChevronRight className={`w-4 h-4 text-neutral-700 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 p-5 space-y-4 text-xs">
          <p className="text-neutral-700 leading-relaxed">{issue.description}</p>

          {issue.evidence && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
              <p className="text-neutral-500 font-semibold mb-1">Evidence</p>
              <p className="font-mono text-neutral-800">{issue.evidence}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-neutral-500 font-semibold mb-1">SEO Impact</p>
              <p className="text-amber-800">{issue.seo_impact}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-neutral-500 font-semibold mb-1">Business Impact</p>
              <p className="text-red-800">{issue.business_impact}</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-neutral-500 font-semibold mb-1 flex items-center gap-1"><CheckSquare className="w-3.5 h-3.5" /> Recommended Fix</p>
            <p className="text-emerald-800 leading-relaxed">{issue.recommended_fix}</p>
          </div>

          <div className="flex gap-4 text-xs flex-wrap">
            <div><span className="text-neutral-500 font-medium">Estimated effort: </span><span className="font-semibold text-neutral-800">{issue.estimated_effort}</span></div>
            <div><span className="text-neutral-500 font-medium">Affected URLs: </span><span className="font-semibold text-neutral-800">{issue.affected_url_count}</span></div>
            <div><span className="text-neutral-500 font-medium">Automation: </span><span className="font-semibold text-neutral-800">{issue.automation_level.replace(/_/g, " ")}</span></div>
          </div>

          {issue.affected_urls.length > 0 && (
            <div>
              <p className="text-neutral-500 font-semibold mb-2">Affected URLs ({issue.affected_url_count})</p>
              <div className="space-y-1">
                {issue.affected_urls.slice(0, 5).map(u => (
                  <div key={u} className="font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5 flex items-center justify-between">
                    <span className="truncate">{u}</span>
                    <ExternalLink className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                  </div>
                ))}
                {issue.affected_url_count > 5 && (
                  <p className="text-neutral-500 italic">+{issue.affected_url_count - 5} more…</p>
                )}
              </div>
            </div>
          )}

          {issue.automation_level === "requires_approval" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700"><strong>High-risk change.</strong> This fix must be reviewed and approved before execution. The agent will create a Pull Request for human review.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TechnicalSEOPage() {
  const { currentWebsite, openAddModal } = useWebsite();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<TechnicalIssue[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [filterStatus, setFilterStatus] = useState<IssueStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [urlSearch, setUrlSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    start_url: "",
    site_tech: "unknown",
    max_urls: "50",
    is_new_website: false,
  });

  useEffect(() => {
    if (currentWebsite) {
      setForm(f => ({
        ...f,
        start_url: currentWebsite.url,
        site_tech: currentWebsite.platform === "wordpress" ? "wordpress"
          : currentWebsite.platform === "nextjs" ? "nextjs"
          : currentWebsite.platform === "shopify" ? "shopify"
          : "unknown"
      }));
    }
  }, [currentWebsite?.id]);

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.start_url.trim()) return;

    setCrawling(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/technical/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_url: form.start_url,
          site_tech: form.site_tech,
          max_urls: parseInt(form.max_urls),
          is_new_website: form.is_new_website,
        }),
      });
      const data = await res.json();
      if (data.result) {
        setResult(data.result);
        setIssues(data.result.issues || []);
      } else {
        setError(data.error || "Crawl completed without issues.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to execute technical crawl.");
    } finally {
      setCrawling(false);
      setActiveTab("overview");
    }
  };

  const handleStatusChange = (id: string, status: IssueStatus) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const filteredIssues = issues.filter(i => {
    if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    return true;
  });

  const filteredUrls = result?.urls.filter(u =>
    !urlSearch || u.url.toLowerCase().includes(urlSearch.toLowerCase())
  ) || [];

  const open = issues.filter(i => i.status === "open").length;
  const critical = issues.filter(i => i.severity === "critical").length;
  const autoFixable = issues.filter(i => i.automation_level === "auto" && i.status === "open").length;
  const categories = [...new Set(issues.map(i => i.category))];

  const r = result;

  return (
    <div className="flex min-h-screen bg-white text-neutral-900">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-8 pt-6 pb-0 bg-white">
          <div className="flex items-center gap-2 text-xs text-neutral-500 mb-1">
            <span>AI Agents</span><ChevronRight className="w-3 h-3" />
            <span className="text-neutral-700 font-medium">Technical SEO Agent</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-neutral-900 tracking-tight flex items-center gap-2">
                <Wrench className="w-6 h-6 text-indigo-500" /> Technical SEO Agent
              </h1>
              <p className="text-neutral-500 text-xs mt-0.5">
                Crawls your website, finds real technical problems, and plans controlled fixes — with human approval for high-risk changes.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {r && (
                <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border ${
                  r.technical_health_score >= 75 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : r.technical_health_score >= 50 ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${r.technical_health_score >= 75 ? "bg-emerald-500" : r.technical_health_score >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
                  Health Score: {r.technical_health_score}/100
                </div>
              )}
              {r && (
                <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border ${TECH_COLORS[r.site_tech] || TECH_COLORS.unknown}`}>
                  {r.site_tech.replace(/_/g, " ").replace(/nextjs/, "Next.js")}
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center">
            {([
              ["overview", "Overview", BarChart2],
              ["issues", `Issues (${open} open)`, AlertTriangle],
              ["urls", `URL Map (${result?.total_urls_crawled || 0})`, Globe],
              ["recommendations", "Fix Queue", GitPullRequest],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setActiveTab(id as Tab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* Crawl form — always visible */}
          <form onSubmit={handleCrawl} className="bg-white border border-neutral-200 rounded-2xl p-5">
            <div className="grid grid-cols-5 gap-4 items-end">
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Website URL *</label>
                <input value={form.start_url} onChange={e => setForm(f => ({ ...f, start_url: e.target.value }))} required
                  placeholder="https://yoursite.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Technology</label>
                <select value={form.site_tech} onChange={e => setForm(f => ({ ...f, site_tech: e.target.value }))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                  {[["nextjs","Next.js"],["react","React"],["astro","Astro"],["nuxt","Nuxt"],["static_html","Static HTML"],["webflow","Webflow"],["wordpress","WordPress"],["shopify","Shopify"],["headless_cms","Headless CMS"],["custom","Custom"],["unknown","Auto-detect"]].map(([v,l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">Max URLs</label>
                <select value={form.max_urls} onChange={e => setForm(f => ({ ...f, max_urls: e.target.value }))}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400">
                  {["100","250","500","1000","2500"].map(n => <option key={n} value={n}>{n} URLs</option>)}
                </select>
              </div>
              <div>
                <button type="submit" disabled={crawling}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                  {crawling ? <><Loader2 className="w-4 h-4 animate-spin" /> Crawling…</> : <><Search className="w-4 h-4" /> Start Crawl</>}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="checkbox" id="new_website" checked={form.is_new_website}
                onChange={e => setForm(f => ({ ...f, is_new_website: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600" />
              <label htmlFor="new_website" className="text-xs text-neutral-600">
                New website mode — prioritize foundations (crawlability, indexability, HTTPS, sitemap, robots, canonicals)
              </label>
            </div>
          </form>

          {!r && !crawling && (
            <div className="p-12 text-center bg-neutral-50 border border-neutral-200 rounded-3xl space-y-3 max-w-lg mx-auto">
              <Wrench className="w-8 h-8 text-neutral-400 mx-auto" />
              <h3 className="text-base font-bold text-neutral-900">No Technical Crawl Data Yet</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                Enter your website URL above and click &ldquo;Start Crawl&rdquo; to analyze crawlability, status codes, canonicals, and indexability issues.
              </p>
            </div>
          )}

          {r && (
            <>
              {/* ── OVERVIEW ── */}
              {activeTab === "overview" && (
                <div className="space-y-5">
                  {/* Scores */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="font-semibold text-neutral-900 text-sm">Technical Health Scores</h3>
                        <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                          <Info className="w-3 h-3" /> Diagnostic indicators — not ranking guarantees.
                        </p>
                      </div>
                      <ScoreGauge score={r.technical_health_score} label="Overall Health" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <ScoreGauge score={r.crawlability_score} label="Crawlability" />
                      <ScoreGauge score={r.indexability_score} label="Indexability" />
                    </div>
                  </div>

                  {/* URL stats */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "200 OK", value: r.urls_200, color: "text-emerald-600" },
                      { label: "3xx Redirects", value: r.urls_301 + r.urls_302, color: "text-amber-600" },
                      { label: "404 Errors", value: r.urls_404, color: "text-red-500" },
                      { label: "5xx Errors", value: r.urls_5xx, color: "text-red-700" },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                        <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Indexed", value: r.urls_indexed, color: "text-indigo-600" },
                      { label: "Noindex", value: r.urls_noindex, color: "text-neutral-500" },
                      { label: "Orphan Pages", value: r.urls_orphaned, color: "text-orange-600" },
                      { label: "Broken Links", value: r.broken_internal_links, color: "text-red-500" },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-neutral-200 rounded-2xl p-4">
                        <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-1">{s.label}</span>
                        <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Alert banners */}
                  {critical > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-red-700">{critical} Critical Issue{critical > 1 ? "s" : ""} Require Immediate Attention</p>
                        <p className="text-red-600 text-xs mt-0.5">These issues are blocking crawling or indexing. Fix them before anything else.</p>
                      </div>
                    </div>
                  )}

                  {autoFixable > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div>
                          <p className="font-semibold text-emerald-700 text-sm">{autoFixable} issue{autoFixable > 1 ? "s" : ""} can be auto-fixed</p>
                          <p className="text-emerald-600 text-xs">Low-risk, automatically reversible changes.</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setIssues(prev => prev.map(i => i.automation_level === "auto" && i.status === "open" ? { ...i, status: "fixed" } : i))}
                        className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-xs font-bold px-4 py-2 rounded-xl transition-colors">
                        Apply Auto-fixes
                      </button>
                    </div>
                  )}

                  {/* Issue summary by severity */}
                  <div className="bg-white border border-neutral-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-neutral-900 text-sm mb-4">Issues by Severity</h3>
                    {(["critical","high","medium","low"] as Severity[]).map(sev => {
                      const count = issues.filter(i => i.severity === sev).length;
                      const openCount = issues.filter(i => i.severity === sev && i.status === "open").length;
                      const sv = SEVERITY_CONFIG[sev];
                      if (count === 0) return null;
                      return (
                        <div key={sev} className="flex items-center gap-3 mb-2 last:mb-0">
                          <span className={`text-[10px] font-bold w-16 shrink-0 px-2 py-0.5 rounded-full border text-center ${sv.bg} ${sv.color}`}>{sv.label}</span>
                          <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${sv.dot}`} style={{ width: `${(count / issues.length) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-neutral-700 w-16 shrink-0 text-right">{openCount} open / {count} total</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── ISSUES ── */}
              {activeTab === "issues" && (
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-700 focus:outline-none">
                      <option value="all">All Severities</option>
                      {(["critical","high","medium","low","info"] as Severity[]).map(s => (
                        <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
                      ))}
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-700 focus:outline-none">
                      <option value="all">All Statuses</option>
                      {["open","in_progress","fixed","verified","wont_fix"].map(s => (
                        <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-xs text-neutral-700 focus:outline-none">
                      <option value="all">All Categories</option>
                      {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                    </select>
                    <span className="text-xs text-neutral-500 ml-auto">{filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}</span>
                  </div>

                  {filteredIssues.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-neutral-200 rounded-2xl text-neutral-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-3 text-emerald-300" />
                      <p className="text-sm">No issues match your filters.</p>
                    </div>
                  ) : (
                    filteredIssues.map(issue => (
                      <IssueCard key={issue.id} issue={issue}
                        expanded={expandedId === issue.id}
                        onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                        onStatusChange={handleStatusChange}
                      />
                    ))
                  )}
                </div>
              )}

              {/* ── URLS ── */}
              {activeTab === "urls" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
                      <input value={urlSearch} onChange={e => setUrlSearch(e.target.value)}
                        placeholder="Filter URLs…"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:border-indigo-400" />
                    </div>
                    <span className="text-xs text-neutral-500">{filteredUrls.length} of {r.total_urls_crawled} URLs</span>
                  </div>

                  <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-0 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      <span className="col-span-5">URL</span>
                      <span className="col-span-1 text-center">Status</span>
                      <span className="col-span-1 text-center">Index</span>
                      <span className="col-span-1 text-center">Sitemap</span>
                      <span className="col-span-1 text-center">Links In</span>
                      <span className="col-span-1 text-center">Words</span>
                      <span className="col-span-2 text-center">Flags</span>
                    </div>

                    <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
                      {filteredUrls.map((u, i) => (
                        <div key={i} className={`grid grid-cols-12 gap-0 px-4 py-3 text-xs hover:bg-neutral-50 transition-colors ${
                          u.status_code === 404 ? "bg-red-50/50"
                            : u.is_orphan ? "bg-orange-50/30"
                              : ""
                        }`}>
                          <div className="col-span-5 truncate font-mono text-neutral-700 pr-2" title={u.url}>
                            {u.url.replace("https://seautopilot.io", "")}
                          </div>
                          <div className="col-span-1 text-center">
                            <span className={`font-bold ${
                              u.status_code === 200 ? "text-emerald-600"
                                : u.status_code >= 300 && u.status_code < 400 ? "text-amber-600"
                                  : u.status_code >= 400 ? "text-red-600" : "text-neutral-600"
                            }`}>{u.status_code}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            {u.is_indexable
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-neutral-700 mx-auto" />
                            }
                          </div>
                          <div className="col-span-1 text-center">
                            {u.in_sitemap
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-neutral-200 mx-auto" />
                            }
                          </div>
                          <div className="col-span-1 text-center text-neutral-600 font-medium">{u.internal_links_in}</div>
                          <div className="col-span-1 text-center text-neutral-500">{u.word_count || "—"}</div>
                          <div className="col-span-2 flex items-center justify-center gap-1 flex-wrap">
                            {u.is_orphan && <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">Orphan</span>}
                            {u.has_thin_content && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Thin</span>}
                            {u.redirect_target && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">Redirect</span>}
                            {!u.is_indexable && u.status_code === 200 && <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 rounded">Noindex</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── FIX QUEUE ── */}
              {activeTab === "recommendations" && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs text-indigo-700">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>Fix Queue — Execution Protocol</strong><br />
                      Low-risk fixes can be applied automatically. High-risk changes create a Pull Request for human review. The agent never modifies production infrastructure directly.
                    </div>
                  </div>

                  {/* Auto-fixable */}
                  <div className="bg-white border border-emerald-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-neutral-900 text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Auto-Fixable ({issues.filter(i => i.automation_level === "auto").length})</h3>
                    {issues.filter(i => i.automation_level === "auto").length === 0
                      ? <p className="text-xs text-neutral-500">No auto-fixable issues found.</p>
                      : issues.filter(i => i.automation_level === "auto").map(issue => (
                        <div key={issue.id} className={`flex items-center justify-between gap-4 p-3 rounded-xl border mb-2 last:mb-0 ${issue.status === "fixed" ? "bg-emerald-50 border-emerald-200" : "bg-neutral-50 border-neutral-200"}`}>
                          <div className="text-xs">
                            <p className="font-semibold text-neutral-800">{issue.title}</p>
                            <p className="text-neutral-500 mt-0.5">{issue.recommended_fix}</p>
                          </div>
                          {issue.status === "fixed"
                            ? <span className="text-emerald-600 text-xs font-bold flex items-center gap-1 shrink-0"><CheckCircle2 className="w-4 h-4" /> Applied</span>
                            : <button onClick={() => handleStatusChange(issue.id, "fixed")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-neutral-900 text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 transition-colors">Apply Fix</button>
                          }
                        </div>
                      ))
                    }
                  </div>

                  {/* Requires approval */}
                  <div className="bg-white border border-red-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-neutral-900 text-sm mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-500" /> Require Human Approval ({issues.filter(i => i.automation_level === "requires_approval").length})</h3>
                    {issues.filter(i => i.automation_level === "requires_approval").map(issue => (
                      <div key={issue.id} className="flex items-center justify-between gap-4 p-3 bg-neutral-50 border border-neutral-200 rounded-xl mb-2 last:mb-0">
                        <div className="text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_CONFIG[issue.severity].bg} ${SEVERITY_CONFIG[issue.severity].color}`}>{SEVERITY_CONFIG[issue.severity].label}</span>
                          </div>
                          <p className="font-semibold text-neutral-800">{issue.title}</p>
                          <p className="text-neutral-500 mt-0.5">{issue.recommended_fix}</p>
                        </div>
                        <button
                          onClick={() => handleStatusChange(issue.id, "in_progress")}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 transition-colors">
                          <GitBranch className="w-3 h-3" /> Create PR
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Semi-auto */}
                  <div className="bg-white border border-blue-200 rounded-2xl p-5">
                    <h3 className="font-semibold text-neutral-900 text-sm mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-500" /> Semi-Automatic ({issues.filter(i => i.automation_level === "semi_auto").length})</h3>
                    {issues.filter(i => i.automation_level === "semi_auto").map(issue => (
                      <div key={issue.id} className="flex items-center justify-between gap-4 p-3 bg-neutral-50 border border-neutral-200 rounded-xl mb-2 last:mb-0">
                        <div className="text-xs">
                          <p className="font-semibold text-neutral-800">{issue.title}</p>
                          <p className="text-neutral-500 mt-0.5">{issue.recommended_fix}</p>
                        </div>
                        <span className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg shrink-0">
                          {issue.estimated_effort}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
