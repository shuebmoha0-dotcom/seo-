/**
 * Crawl Comparison Engine
 * 
 * Compares current crawl run (N) against previous crawl run (N-1).
 * Detects regressions, resolved issues, score changes, and indexability drifts.
 * Used by the Monitoring Agent and Technical SEO Agent.
 */

import type { TechnicalIssue } from '@/lib/agent/technicalSeoAgent';

export interface CrawlComparisonResult {
  previous_crawl_id?: string;
  current_crawl_id: string;
  score_delta: number; // e.g. +5 or -3
  crawlability_delta: number;
  indexability_delta: number;
  new_issues: TechnicalIssue[];
  resolved_issues: TechnicalIssue[];
  persistent_issues: TechnicalIssue[];
  new_broken_urls: string[];
  resolved_broken_urls: string[];
}

export function compareCrawls(
  currentCrawl: {
    id: string;
    technical_health_score: number;
    crawlability_score: number;
    indexability_score: number;
    issues: TechnicalIssue[];
    urls: Array<{ url: string; status_code: number }>;
  },
  previousCrawl?: {
    id: string;
    technical_health_score: number;
    crawlability_score: number;
    indexability_score: number;
    issues: TechnicalIssue[];
    urls: Array<{ url: string; status_code: number }>;
  } | null
): CrawlComparisonResult {
  if (!previousCrawl) {
    return {
      current_crawl_id: currentCrawl.id,
      score_delta: 0,
      crawlability_delta: 0,
      indexability_delta: 0,
      new_issues: currentCrawl.issues,
      resolved_issues: [],
      persistent_issues: [],
      new_broken_urls: currentCrawl.urls.filter(u => u.status_code >= 400).map(u => u.url),
      resolved_broken_urls: [],
    };
  }

  // 1. Calculate Score Deltas
  const scoreDelta = (currentCrawl.technical_health_score || 0) - (previousCrawl.technical_health_score || 0);
  const crawlabilityDelta = (currentCrawl.crawlability_score || 0) - (previousCrawl.crawlability_score || 0);
  const indexabilityDelta = (currentCrawl.indexability_score || 0) - (previousCrawl.indexability_score || 0);

  // 2. Map previous issues by issue_type
  const prevIssueMap = new Map<string, TechnicalIssue>();
  for (const issue of previousCrawl.issues) {
    prevIssueMap.set(issue.issue_type, issue);
  }

  const currIssueMap = new Map<string, TechnicalIssue>();
  for (const issue of currentCrawl.issues) {
    currIssueMap.set(issue.issue_type, issue);
  }

  // New issues = In Current, not in Previous
  const newIssues: TechnicalIssue[] = [];
  const persistentIssues: TechnicalIssue[] = [];

  for (const issue of currentCrawl.issues) {
    if (!prevIssueMap.has(issue.issue_type)) {
      newIssues.push(issue);
    } else {
      persistentIssues.push(issue);
    }
  }

  // Resolved issues = In Previous, not in Current
  const resolvedIssues: TechnicalIssue[] = [];
  for (const issue of previousCrawl.issues) {
    if (!currIssueMap.has(issue.issue_type)) {
      resolvedIssues.push(issue);
    }
  }

  // 3. Broken URLs delta
  const prev404s = new Set(previousCrawl.urls.filter(u => u.status_code >= 400).map(u => u.url));
  const curr404s = new Set(currentCrawl.urls.filter(u => u.status_code >= 400).map(u => u.url));

  const newBrokenUrls = Array.from(curr404s).filter(u => !prev404s.has(u));
  const resolvedBrokenUrls = Array.from(prev404s).filter(u => !curr404s.has(u));

  return {
    previous_crawl_id: previousCrawl.id,
    current_crawl_id: currentCrawl.id,
    score_delta: scoreDelta,
    crawlability_delta: crawlabilityDelta,
    indexability_delta: indexabilityDelta,
    new_issues: newIssues,
    resolved_issues: resolvedIssues,
    persistent_issues: persistentIssues,
    new_broken_urls: newBrokenUrls,
    resolved_broken_urls: resolvedBrokenUrls,
  };
}
