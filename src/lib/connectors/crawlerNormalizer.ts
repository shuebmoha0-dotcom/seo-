/**
 * Crawl Data Normalizer
 * 
 * Takes raw, deeply nested DataForSEO API responses and transforms them
 * into clean, strongly-typed domain models ready for database persistence
 * and SEO agent consumption.
 */

import type { CrawledUrl, TechnicalIssue, SiteTech } from '@/lib/agent/technicalSeoAgent';

export interface NormalizedCrawlSummary {
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
  duplicate_titles_count: number;
  duplicate_meta_count: number;
  missing_h1_count: number;
  missing_meta_count: number;
  crawlability_score: number;
  indexability_score: number;
  technical_health_score: number;
}

export interface NormalizedCrawlResult {
  summary: NormalizedCrawlSummary;
  pages: CrawledUrl[];
  deterministic_issues: TechnicalIssue[];
}

export function normalizeDataForSEOResponse(
  rawPages: any[],
  summaryMetrics?: any,
  siteTech: SiteTech = 'unknown'
): NormalizedCrawlResult {
  const pages: CrawledUrl[] = [];
  const titleMap = new Map<string, string[]>();
  const metaDescMap = new Map<string, string[]>();

  // 1. Process each page item
  for (const item of rawPages) {
    const url = item.url || '';
    const statusCode = item.status_code || 200;
    const meta = item.meta || {};
    const checks = item.checks || {};

    const title = meta.title || undefined;
    const metaDescription = meta.description || undefined;
    const canonicalUrl = meta.canonical || undefined;
    const isIndexable = !(checks.noindex || meta.robots?.noindex || statusCode !== 200);
    const inSitemap = !!checks.in_sitemap;

    const h1Tags: string[] = meta.htags?.h1 || [];
    const h1 = h1Tags.length > 0 ? h1Tags[0] : undefined;
    const wordCount = meta.content?.plain_text_word_count || meta.content?.word_count || 0;

    // Track duplicates
    if (title && title.trim().length > 0) {
      const existing = titleMap.get(title) || [];
      existing.push(url);
      titleMap.set(title, existing);
    }

    if (metaDescription && metaDescription.trim().length > 0) {
      const existing = metaDescMap.get(metaDescription) || [];
      existing.push(url);
      metaDescMap.set(metaDescription, existing);
    }

    pages.push({
      url,
      status_code: statusCode,
      redirect_target: item.redirect_target || undefined,
      canonical_url: canonicalUrl,
      canonical_is_self: canonicalUrl === url,
      robots_directive: meta.robots ? `${meta.robots.noindex ? 'noindex' : 'index'}, ${meta.robots.nofollow ? 'nofollow' : 'follow'}` : 'index, follow',
      in_sitemap: inSitemap,
      is_indexable: isIndexable,
      title,
      meta_description: metaDescription,
      h1,
      word_count: wordCount,
      internal_links_in: item.page_timing?.internal_links_in || 0,
      internal_links_out: item.page_timing?.internal_links_out || 0,
      is_orphan: !!checks.is_orphan,
      has_schema: !!item.schema_types?.length,
      schema_types: item.schema_types || [],
      has_duplicate_title: false, // Calculated in pass 2
      has_duplicate_meta: false,
      has_thin_content: wordCount > 0 && wordCount < 250 && isIndexable,
    });
  }

  // 2. Mark duplicate titles and descriptions
  for (const page of pages) {
    if (page.title && (titleMap.get(page.title)?.length || 0) > 1) {
      page.has_duplicate_title = true;
    }
    if (page.meta_description && (metaDescMap.get(page.meta_description)?.length || 0) > 1) {
      page.has_duplicate_meta = true;
    }
  }

  // 3. Compute deterministic issues
  const deterministicIssues: TechnicalIssue[] = [];

  // Issue A: 4xx Client Errors
  const pages404 = pages.filter(p => p.status_code >= 400 && p.status_code < 500);
  if (pages404.length > 0) {
    deterministicIssues.push({
      id: 'issue-4xx',
      category: 'broken_links',
      severity: 'high',
      issue_type: 'broken_internal_links_404',
      title: `${pages404.length} broken URL(s) returning 4xx status`,
      description: 'URLs return HTTP 404/410 errors which waste crawl budget and cause bad user experience.',
      evidence: `Sample broken URL: ${pages404[0].url}`,
      affected_urls: pages404.map(p => p.url),
      affected_url_count: pages404.length,
      sample_url: pages404[0].url,
      seo_impact: 'Search engines de-index broken URLs; internal links pointing to 404s waste link equity.',
      business_impact: 'Users encounter dead pages leading to immediate bounce rates.',
      recommended_fix: 'Set up 301 redirects to relevant live pages or update internal links pointing to them.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'requires_approval',
      status: 'open',
    });
  }

  // Issue B: Duplicate Title Tags
  const duplicateTitles = Array.from(titleMap.entries()).filter(([_, urls]) => urls.length > 1);
  if (duplicateTitles.length > 0) {
    const affectedUrls = duplicateTitles.flatMap(([_, urls]) => urls);
    deterministicIssues.push({
      id: 'issue-duplicate-titles',
      category: 'duplicates',
      severity: 'high',
      issue_type: 'duplicate_title_tags',
      title: `${duplicateTitles.length} set(s) of pages sharing identical title tags`,
      description: 'Multiple URLs have identical `<title>` tags, causing keyword cannibalization in search results.',
      evidence: `Example: "${duplicateTitles[0][0]}" is shared across ${duplicateTitles[0][1].length} pages.`,
      affected_urls: affectedUrls,
      affected_url_count: affectedUrls.length,
      sample_url: affectedUrls[0],
      seo_impact: 'Search engines cannot differentiate page intent, splitting ranking authority.',
      business_impact: 'Lower CTR and inconsistent SERP snippets.',
      recommended_fix: 'Assign distinct, unique titles targeting the specific primary keyword of each page.',
      estimated_effort: 'hours',
      risk_level: 'low',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue C: Missing Meta Descriptions
  const missingMeta = pages.filter(p => !p.meta_description && p.is_indexable);
  if (missingMeta.length > 0) {
    deterministicIssues.push({
      id: 'issue-missing-meta',
      category: 'indexability',
      severity: 'medium',
      issue_type: 'missing_meta_descriptions',
      title: `${missingMeta.length} indexable page(s) missing meta descriptions`,
      description: 'Pages lack meta descriptions, allowing search engines to generate random text snippets in SERPs.',
      affected_urls: missingMeta.map(p => p.url),
      affected_url_count: missingMeta.length,
      sample_url: missingMeta[0].url,
      seo_impact: 'Reduced click-through rate (CTR) from Google search results.',
      business_impact: 'Fewer clicks despite existing keyword rankings.',
      recommended_fix: 'Generate targeted, 140-160 character meta descriptions with a clear call-to-action.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue D: Missing H1 Tags
  const missingH1 = pages.filter(p => !p.h1 && p.is_indexable && p.status_code === 200);
  if (missingH1.length > 0) {
    deterministicIssues.push({
      id: 'issue-missing-h1',
      category: 'indexability',
      severity: 'medium',
      issue_type: 'missing_h1_tags',
      title: `${missingH1.length} page(s) missing primary H1 heading`,
      description: 'Pages lack an H1 heading tag to define the core topic of the document.',
      affected_urls: missingH1.map(p => p.url),
      affected_url_count: missingH1.length,
      sample_url: missingH1[0].url,
      seo_impact: 'Weak topical relevance signal for search crawlers.',
      business_impact: 'Reduced clarity for users landing on the page.',
      recommended_fix: 'Add a single descriptive H1 tag containing the primary topic keyword.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue E: Missing Canonical Tags
  const missingCanonical = pages.filter(p => !p.canonical_url && p.is_indexable);
  if (missingCanonical.length > 0) {
    deterministicIssues.push({
      id: 'issue-missing-canonicals',
      category: 'canonicals',
      severity: 'medium',
      issue_type: 'missing_canonical_url',
      title: `${missingCanonical.length} page(s) missing canonical URL declaration`,
      description: 'Pages do not specify a canonical tag, which can lead to parameter and trailing-slash duplicate URL indexing.',
      affected_urls: missingCanonical.map(p => p.url),
      affected_url_count: missingCanonical.length,
      sample_url: missingCanonical[0].url,
      seo_impact: 'Potential duplicate indexing if URL parameters or tracking codes are shared.',
      business_impact: 'Diluted link equity across duplicate URL variants.',
      recommended_fix: 'Add self-referencing canonical tags to all indexable pages.',
      estimated_effort: 'minutes',
      risk_level: 'medium',
      automation_level: 'requires_approval',
      status: 'open',
    });
  }

  // 4. Calculate Aggregate Scores
  const total = pages.length || 1;
  const ok200 = pages.filter(p => p.status_code === 200).length;
  const indexed = pages.filter(p => p.is_indexable && p.status_code === 200).length;
  const criticalCount = deterministicIssues.filter(i => i.severity === 'critical').length;
  const highCount = deterministicIssues.filter(i => i.severity === 'high').length;

  const crawlabilityScore = Math.max(0, Math.min(100, Math.round((ok200 / total) * 100) - (criticalCount * 15) - (highCount * 5)));
  const indexabilityScore = Math.max(0, Math.min(100, Math.round((indexed / total) * 100) - (criticalCount * 10) - (highCount * 3)));
  const technicalHealthScore = Math.round((crawlabilityScore + indexabilityScore) / 2);

  const summary: NormalizedCrawlSummary = {
    total_urls_found: total,
    total_urls_crawled: total,
    urls_200: ok200,
    urls_301: pages.filter(p => p.status_code === 301).length,
    urls_302: pages.filter(p => p.status_code === 302).length,
    urls_404: pages.filter(p => p.status_code === 404).length,
    urls_5xx: pages.filter(p => p.status_code >= 500).length,
    urls_noindex: pages.filter(p => !p.is_indexable).length,
    urls_indexed: indexed,
    urls_orphaned: pages.filter(p => p.is_orphan).length,
    broken_internal_links: pages404.length,
    duplicate_titles_count: duplicateTitles.length,
    duplicate_meta_count: Array.from(metaDescMap.values()).filter(urls => urls.length > 1).length,
    missing_h1_count: missingH1.length,
    missing_meta_count: missingMeta.length,
    crawlability_score: crawlabilityScore,
    indexability_score: indexabilityScore,
    technical_health_score: technicalHealthScore,
  };

  return {
    summary,
    pages,
    deterministic_issues: deterministicIssues,
  };
}
