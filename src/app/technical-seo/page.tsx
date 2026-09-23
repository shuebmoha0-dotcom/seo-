"use client";

import { Sidebar } from "@/components/Sidebar";
import {
  Wrench, Loader2, CheckCircle2, XCircle, AlertTriangle, AlertCircle,
  ChevronRight, ChevronDown, Info, Cpu, ExternalLink, GitPullRequest,
  Link2, Globe, FileCode, Shield, ShieldAlert, Zap, Search, BarChart2,
  RotateCcw, Filter, Download, RefreshCw, ArrowRight, GitBranch,
  CheckSquare, Eye, Layers, Clock, Check
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
  fix_notes?: string;
  fix_applied_at?: string;
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
  critical: { label: "Critical", color: "text-rose-700 border-rose-300", dot: "bg-rose-500", bg: "bg-rose-50" },
  high: { label: "High", color: "text-amber-700 border-amber-300", dot: "bg-amber-500", bg: "bg-amber-50" },
  medium: { label: "Medium", color: "text-blue-700 border-blue-300", dot: "bg-blue-500", bg: "bg-blue-50" },
  low: { label: "Low", color: "text-slate-600 border-slate-300", dot: "bg-slate-400", bg: "bg-slate-50" },
  info: { label: "Info", color: "text-teal-700 border-teal-300", dot: "bg-teal-400", bg: "bg-teal-50" },
};

const AUTOMATION_CONFIG: Record<AutomationLevel, { label: string; color: string }> = {
  auto: { label: "Auto-fixable", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  semi_auto: { label: "Semi-automatic", color: "text-blue-700 bg-blue-50 border-blue-200" },
  manual: { label: "Manual fix", color: "text-slate-600 bg-slate-100 border-slate-200" },
  requires_approval: { label: "Requires Approval", color: "text-rose-700 bg-rose-50 border-rose-200" },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; icon: any; color: string }> = {
  low: { label: "Low risk", icon: Shield, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  medium: { label: "Medium risk", icon: AlertCircle, color: "text-amber-700 bg-amber-50 border-amber-200" },
  high: { label: "High risk", icon: ShieldAlert, color: "text-rose-700 bg-rose-50 border-rose-200" },
};

const CATEGORY_ICONS: Record<string, any> = {
  crawlability: Globe, indexability: Eye, redirects: ArrowRight,
  broken_links: XCircle, canonicals: Shield, sitemap: FileCode,
  robots: Shield, performance: Zap, structured_data: FileCode,
  duplicates: Layers, orphan_pages: Link2, javascript: Cpu,
  hreflang: Globe, security: ShieldAlert, mobile: Cpu,
  pagination: Layers, internal_links: Link2, other: Info,
};

const TECH_COLORS: Record<string, string> = {
  nextjs: "text-slate-800 bg-slate-100 border-slate-300",
  react: "text-blue-700 bg-blue-50 border-blue-200",
  wordpress: "text-blue-600 bg-blue-50 border-blue-200",
  shopify: "text-emerald-700 bg-emerald-50 border-emerald-200",
  webflow: "text-indigo-700 bg-indigo-50 border-indigo-200",
  astro: "text-orange-700 bg-orange-50 border-orange-200",
  nuxt: "text-green-700 bg-green-50 border-green-200",
  unknown: "text-slate-500 bg-slate-100 border-slate-200",
};

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const r = 26, c = 2 * Math.PI * r, offset = c - (score / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={66} height={66} className="-rotate-90">
        <circle cx={33} cy={33} r={r} fill="none" stroke="#f1f5f9" strokeWidth={6} />
        <circle
          cx={33} cy={33} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
        <text
          x={33} y={33} dominantBaseline="middle" textAnchor="middle"
          fill="#0f172a" fontSize={13} fontWeight="700" className="rotate-90 font-mono"
          transform="rotate(90, 33, 33)"
        >
          {score}
        </text>
      </svg>
      <span className="text-[10px] text-slate-500 font-medium text-center">{label}</span>
    </div>
  );
}

function IssueCard({
  issue,
  expanded,
  onToggle,
  onStatusChange,
  onApplyFix,
  isFixing = false,
}: {
  issue: TechnicalIssue;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: IssueStatus) => void;
  onApplyFix?: (issue: TechnicalIssue) => void;
  isFixing?: boolean;
}) {
  const sv = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.low;
  const at = AUTOMATION_CONFIG[issue.automation_level] || AUTOMATION_CONFIG.manual;
  const rv = RISK_CONFIG[issue.risk_level] || RISK_CONFIG.low;
  const RiskIcon = rv.icon;
  const CatIcon = CATEGORY_ICONS[issue.category] || Info;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden shadow-xs transition-all ${
      issue.status === "fixed" || issue.status === "verified"
        ? "border-emerald-200/80 opacity-75"
        : issue.severity === "critical"
        ? "border-rose-200/90"
        : issue.severity === "high"
        ? "border-amber-200/90"
        : "border-slate-200/80 hover:border-slate-300"
    }`}>
      <div className="p-4 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-start gap-3">
          <div className={`w-1 self-stretch rounded-full shrink-0 ${sv.dot}`} />

          <div className={`p-2 rounded-lg border ${sv.bg} ${sv.color} shrink-0`}>
            <CatIcon className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sv.bg} ${sv.color}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sv.dot}`} />
                {sv.label}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${at.color}`}>
                {at.label}
              </span>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${rv.color}`}>
                <RiskIcon className="w-2.5 h-2.5 inline mr-0.5" />
                {rv.label}
              </span>
              <span className="text-[10px] text-slate-400 capitalize font-medium">
                {issue.category.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-900">{issue.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{issue.description}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={issue.status}
              onChange={(e) => {
                e.stopPropagation();
                onStatusChange(issue.id, e.target.value as IssueStatus);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`text-[11px] font-semibold px-2 py-1 rounded-lg border cursor-pointer focus:outline-none ${
                issue.status === "verified"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : issue.status === "fixed"
                  ? "bg-teal-50 text-teal-700 border-teal-200"
                  : issue.status === "in_progress"
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="in_progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="verified">Verified ✓</option>
              <option value="wont_fix">Won't Fix</option>
            </select>

            {issue.automation_level === "auto" && issue.status === "open" && (
              <button
                disabled={isFixing}
                onClick={(e) => {
                  e.stopPropagation();
                  onApplyFix?.(issue);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
              >
                {isFixing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3" />
                )}
                <span>{isFixing ? "Fixing..." : "Auto-fix"}</span>
              </button>
            )}

            {issue.automation_level !== "auto" && issue.automation_level !== "manual" && issue.status === "open" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(issue.id, "in_progress");
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
              >
                <GitBranch className="w-3 h-3" /> Create PR
              </button>
            )}

            <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3 text-xs bg-slate-50/50">
          <p className="text-slate-700 leading-relaxed">{issue.description}</p>

          {issue.status === "fixed" && issue.fix_notes && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <p className="text-emerald-900 font-semibold mb-0.5 text-[11px] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Remediation Applied
              </p>
              <p className="text-emerald-800 text-[11px] leading-relaxed">{issue.fix_notes}</p>
            </div>
          )}

          {issue.evidence && (
            <div className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-slate-500 font-semibold mb-1 text-[11px]">Audit Evidence</p>
              <p className="font-mono text-slate-800 text-[11px]">{issue.evidence}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-900 font-semibold mb-0.5 text-[11px]">SEO Impact</p>
              <p className="text-amber-800 text-[11px] leading-relaxed">{issue.seo_impact}</p>
            </div>
            <div className="bg-rose-50/70 border border-rose-200 rounded-lg p-3">
              <p className="text-rose-900 font-semibold mb-0.5 text-[11px]">Business Impact</p>
              <p className="text-rose-800 text-[11px] leading-relaxed">{issue.business_impact}</p>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3">
            <p className="text-emerald-900 font-semibold mb-0.5 flex items-center gap-1 text-[11px]">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> Recommended Action
            </p>
            <p className="text-emerald-800 leading-relaxed text-[11px]">{issue.recommended_fix}</p>
          </div>

          <div className="flex gap-4 text-[11px] flex-wrap pt-1">
            <div>
              <span className="text-slate-500 font-medium">Estimated effort: </span>
              <span className="font-semibold text-slate-800">{issue.estimated_effort}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Affected URLs: </span>
              <span className="font-semibold text-slate-800 font-mono">{issue.affected_url_count}</span>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Automation level: </span>
              <span className="font-semibold text-slate-800 capitalize">{issue.automation_level.replace(/_/g, " ")}</span>
            </div>
          </div>

          {issue.affected_urls.length > 0 && (
            <div className="pt-1">
              <p className="text-slate-500 font-semibold mb-1.5 text-[11px]">
                Affected URLs ({issue.affected_url_count})
              </p>
              <div className="space-y-1">
                {issue.affected_urls.slice(0, 5).map((u) => (
                  <div key={u} className="font-mono text-indigo-600 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-[11px] flex items-center justify-between">
                    <span className="truncate">{u}</span>
                    <ExternalLink className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                  </div>
                ))}
                {issue.affected_url_count > 5 && (
                  <p className="text-slate-400 italic text-[11px]">+{issue.affected_url_count - 5} more URLs…</p>
                )}
              </div>
            </div>
          )}

          {issue.automation_level === "requires_approval" && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-rose-800 text-[11px] leading-relaxed">
                <strong>Controlled Risk:</strong> This remediation will create an automated Pull Request for your explicit review and staging confirmation before merging to production.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [fixingIds, setFixingIds] = useState<string[]>([]);
  const [isBatchFixing, setIsBatchFixing] = useState(false);
  const [fixMessage, setFixMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    start_url: "",
    site_tech: "unknown",
    max_urls: "50",
    is_new_website: false,
  });

  useEffect(() => {
    if (currentWebsite) {
      setForm((f) => ({
        ...f,
        start_url: currentWebsite.url || (currentWebsite.domain ? `https://${currentWebsite.domain}` : ""),
        site_tech: currentWebsite.platform === "wordpress" ? "wordpress"
          : currentWebsite.platform === "nextjs" ? "nextjs"
          : "unknown",
      }));
    }

    async function fetchLatestCrawl() {
      if (!currentWebsite) {
        setResult(null);
        setIssues([]);
        return;
      }
      try {
        const res = await fetch(`/api/agent/technical/crawl?website_id=${currentWebsite.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.result) {
            setResult(data.result);
            setIssues(data.result.issues || []);
          }
        }
      } catch (err) {
        console.error("Failed to load previous crawl:", err);
      }
    }
    fetchLatestCrawl();
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
          website_id: currentWebsite?.id,
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

  const handleApplyFix = async (issue: TechnicalIssue) => {
    if (!currentWebsite) return;
    setFixingIds((prev) => [...prev, issue.id]);
    setFixMessage(null);
    try {
      const res = await fetch("/api/agent/technical/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          website_id: currentWebsite.id,
          issue_id: issue.id,
          issue_type: issue.issue_type,
          affected_urls: issue.affected_urls,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIssues((prev) =>
          prev.map((i) =>
            i.id === issue.id
              ? { ...i, status: "fixed" as IssueStatus, fix_notes: data.message }
              : i
          )
        );
        setFixMessage(data.message || `Remediation applied for "${issue.title}".`);
      } else {
        setError(data.error || "Failed to apply auto-fix.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to dispatch fix.");
    } finally {
      setFixingIds((prev) => prev.filter((id) => id !== issue.id));
    }
  };

  const handleApplyAllAutoFixes = async () => {
    if (!currentWebsite) return;
    const targets = issues.filter(
      (i) => i.automation_level === "auto" && i.status === "open"
    );
    if (targets.length === 0) return;

    setIsBatchFixing(true);
    setFixMessage(null);
    let successCount = 0;

    for (const issue of targets) {
      setFixingIds((prev) => [...prev, issue.id]);
      try {
        const res = await fetch("/api/agent/technical/fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            website_id: currentWebsite.id,
            issue_id: issue.id,
            issue_type: issue.issue_type,
            affected_urls: issue.affected_urls,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
          setIssues((prev) =>
            prev.map((i) =>
              i.id === issue.id
                ? { ...i, status: "fixed" as IssueStatus, fix_notes: data.message }
                : i
            )
          );
        }
      } catch (err) {
        console.error("Batch fix error for issue", issue.id, err);
      } finally {
        setFixingIds((prev) => prev.filter((id) => id !== issue.id));
      }
    }

    setIsBatchFixing(false);
    setFixMessage(`Autonomous remediation completed: ${successCount} of ${targets.length} issues resolved.`);
  };

  const handleStatusChange = (id: string, status: IssueStatus) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const filteredIssues = issues.filter((i) => {
    if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterCategory !== "all" && i.category !== filterCategory) return false;
    return true;
  });

  const filteredUrls = result?.urls.filter((u) =>
    !urlSearch || u.url.toLowerCase().includes(urlSearch.toLowerCase())
  ) || [];

  const openCount = issues.filter((i) => i.status === "open").length;
  const critical = issues.filter((i) => i.severity === "critical").length;
  const autoFixable = issues.filter((i) => i.automation_level === "auto" && i.status === "open").length;
  const categories = [...new Set(issues.map((i) => i.category))];

  const r = result;

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-indigo-500/20">
      <Sidebar />

      <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-medium text-slate-400">Autonomous SEO</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-slate-700">Technical Diagnostics &amp; Crawl Engine</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Technical SEO &amp; Crawl Auditor
              </h1>
              {r && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  r.technical_health_score >= 75
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : r.technical_health_score >= 50
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    r.technical_health_score >= 75 ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  Health: {r.technical_health_score}/100
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {currentWebsite
                ? `Autonomous DOM crawler auditing status codes, canonicals, robots directives, and sitemap health for ${currentWebsite.domain}.`
                : "Connect your website to launch an autonomous technical crawl."}
            </p>
          </div>
        </div>

        {/* Crawl Control Command Bar */}
        <form onSubmit={handleCrawl} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Target URL
              </label>
              <input
                value={form.start_url}
                onChange={(e) => setForm((f) => ({ ...f, start_url: e.target.value }))}
                required
                placeholder="https://example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Site Architecture
              </label>
              <select
                value={form.site_tech}
                onChange={(e) => setForm((f) => ({ ...f, site_tech: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                {[
                  ["nextjs", "Next.js App Router"],
                  ["react", "React SPA"],
                  ["astro", "Astro SSG"],
                  ["wordpress", "WordPress CMS"],
                  ["shopify", "Shopify"],
                  ["webflow", "Webflow"],
                  ["unknown", "Auto-Detect Framework"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                Max URLs
              </label>
              <select
                value={form.max_urls}
                onChange={(e) => setForm((f) => ({ ...f, max_urls: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                {["50", "100", "250", "500"].map((n) => (
                  <option key={n} value={n}>{n} URLs</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={crawling || !form.start_url.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-[0.98]"
              >
                {crawling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Crawling...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Start Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Tab Navigation */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-2 shadow-xs flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "overview", label: "Diagnostic Overview", icon: BarChart2, count: null },
            { id: "issues", label: "Discovered Issues", icon: AlertTriangle, count: openCount },
            { id: "urls", label: "Crawl URL Map", icon: Globe, count: r?.total_urls_crawled || 0 },
            { id: "recommendations", label: "Remediation Queue", icon: GitPullRequest, count: null },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                      activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {!r && !crawling && (
          <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl space-y-4 max-w-lg mx-auto shadow-xs">
            <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center mx-auto text-indigo-600">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">No Technical Crawl Data Yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Enter your website URL above and click &ldquo;Start Audit&rdquo; to analyze crawlability, status codes, canonicals, and indexability issues.
              </p>
            </div>
          </div>
        )}

        {r && (
          <>
            {/* ── TAB: OVERVIEW ── */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Health Score Gauges */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">Technical Health Scores</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      Measured against Googlebot webmaster guidelines
                    </p>
                  </div>

                  <div className="flex items-center gap-8 justify-around">
                    <ScoreGauge score={r.technical_health_score} label="Overall Health" />
                    <ScoreGauge score={r.crawlability_score} label="Crawlability" />
                    <ScoreGauge score={r.indexability_score} label="Indexability" />
                  </div>
                </div>

                {/* HTTP Status Breakdown Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "200 OK", value: r.urls_200, color: "text-emerald-600" },
                    { label: "3xx Redirects", value: r.urls_301 + r.urls_302, color: "text-amber-600" },
                    { label: "404 Not Found", value: r.urls_404, color: "text-rose-600" },
                    { label: "5xx Server Errors", value: r.urls_5xx, color: "text-rose-700" },
                  ].map((s, i) => (
                    <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                        {s.label}
                      </span>
                      <span className={`text-2xl font-bold font-mono ${s.color}`}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Indexed URLs", value: r.urls_indexed, color: "text-indigo-600" },
                    { label: "Noindex Directives", value: r.urls_noindex, color: "text-slate-500" },
                    { label: "Orphan Pages", value: r.urls_orphaned, color: "text-orange-600" },
                    { label: "Broken Internal Links", value: r.broken_internal_links, color: "text-rose-600" },
                  ].map((s, i) => (
                    <div key={i} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
                      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                        {s.label}
                      </span>
                      <span className={`text-2xl font-bold font-mono ${s.color}`}>
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Critical Issue Notice */}
                {critical > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-900">
                        {critical} Critical Issue{critical > 1 ? "s" : ""} Blocking Search Indexing
                      </p>
                      <p className="text-rose-700 mt-0.5">
                        These issues are directly preventing search bots from crawling or indexing key pages. Remediate these first.
                      </p>
                    </div>
                  </div>
                )}

                {/* Fix Feedback Notification */}
                {fixMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-900 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">{fixMessage}</span>
                    </div>
                    <button
                      onClick={() => setFixMessage(null)}
                      className="text-emerald-700 hover:text-emerald-950 font-bold px-2 py-0.5 text-xs rounded hover:bg-emerald-100/60 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Auto-fix Banner */}
                {autoFixable > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold text-emerald-900 text-xs">
                          {autoFixable} issue{autoFixable > 1 ? "s" : ""} ready for 1-Click autonomous remediation
                        </p>
                        <p className="text-emerald-700 text-[11px]">
                          Automated fixes dispatched directly to CMS metadata and content presentation queue.
                        </p>
                      </div>
                    </div>
                    <button
                      disabled={isBatchFixing}
                      onClick={handleApplyAllAutoFixes}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
                    >
                      {isBatchFixing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Applying Remediations...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>Apply Auto-fixes</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: ISSUES ── */}
            {activeTab === "issues" && (
              <div className="space-y-4">
                {/* Filter Controls */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  >
                    <option value="all">All Severities</option>
                    {(["critical", "high", "medium", "low", "info"] as Severity[]).map((s) => (
                      <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
                    ))}
                  </select>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:border-indigo-500 shadow-2xs"
                  >
                    <option value="all">All Statuses</option>
                    {["open", "in_progress", "fixed", "verified", "wont_fix"].map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>

                  <span className="text-xs text-slate-500 ml-auto font-mono">
                    {filteredIssues.length} issue{filteredIssues.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {filteredIssues.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200/80 rounded-xl text-slate-500 shadow-xs">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-xs font-semibold text-slate-900">No issues match the selected filters.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        expanded={expandedId === issue.id}
                        onToggle={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                        onStatusChange={handleStatusChange}
                        onApplyFix={handleApplyFix}
                        isFixing={fixingIds.includes(issue.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: URL MAP ── */}
            {activeTab === "urls" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={urlSearch}
                      onChange={(e) => setUrlSearch(e.target.value)}
                      placeholder="Filter URLs by slug..."
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 font-mono shadow-2xs"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {filteredUrls.length} of {r.total_urls_crawled} URLs
                  </span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-4">URL Path</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-center">Indexable</th>
                        <th className="py-3 px-3 text-center">In Sitemap</th>
                        <th className="py-3 px-3 text-center">Inbound Links</th>
                        <th className="py-3 px-3 text-center">Words</th>
                        <th className="py-3 px-4 text-center">Audit Tags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUrls.map((u, i) => {
                        const domainRoot = currentWebsite?.url || (currentWebsite?.domain ? `https://${currentWebsite.domain}` : "");
                        const displayPath = domainRoot ? u.url.replace(domainRoot, "") || "/" : u.url;

                        return (
                          <tr key={i} className="hover:bg-slate-50/75 transition-colors font-mono">
                            <td className="py-2.5 px-4 truncate max-w-sm text-slate-900 font-medium" title={u.url}>
                              {displayPath}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`font-bold ${
                                u.status_code === 200 ? "text-emerald-600"
                                  : u.status_code >= 300 && u.status_code < 400 ? "text-amber-600"
                                  : "text-rose-600"
                              }`}>
                                {u.status_code}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {u.is_indexable ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-500 mx-auto" />
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {u.in_sitemap ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-700">
                              {u.internal_links_in}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-500">
                              {u.word_count || "—"}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                {u.is_orphan && (
                                  <span className="text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                                    Orphan
                                  </span>
                                )}
                                {u.redirect_target && (
                                  <span className="text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                                    Redirect
                                  </span>
                                )}
                                {!u.is_indexable && u.status_code === 200 && (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                    Noindex
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── TAB: REMEDIATION QUEUE ── */}
            {activeTab === "recommendations" && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Autonomous Remediation Protocol</span>
                    <p className="text-indigo-700 mt-0.5">
                      Low-risk issues are applied directly to your CMS or metadata records. High-risk changes (canonicals, 301 redirects, robots.txt) generate a Git branch and Pull Request for explicit human sign-off.
                    </p>
                  </div>
                </div>

                {/* Auto-fixable List */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-3">
                  <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    <span>Auto-Fixable Remediations</span>
                  </h3>
                  {issues.filter((i) => i.automation_level === "auto").length === 0 ? (
                    <p className="text-xs text-slate-500">No auto-fixable issues pending.</p>
                  ) : (
                    issues.filter((i) => i.automation_level === "auto").map((issue) => (
                      <div
                        key={issue.id}
                        className={`flex items-center justify-between gap-4 p-3 rounded-lg border text-xs ${
                          issue.status === "fixed" ? "bg-emerald-50/60 border-emerald-200" : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{issue.title}</p>
                          <p className="text-slate-500 mt-0.5 text-[11px]">{issue.recommended_fix}</p>
                        </div>
                        {issue.status === "fixed" ? (
                          <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Applied
                          </span>
                        ) : (
                          <button
                            disabled={fixingIds.includes(issue.id)}
                            onClick={() => handleApplyFix(issue)}
                            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 transition-colors shadow-2xs flex items-center gap-1"
                          >
                            {fixingIds.includes(issue.id) ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Applying...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3" />
                                <span>Apply Fix</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
