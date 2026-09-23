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
    const hasMultipleH1 = h1Tags.length > 1;
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
      has_multiple_h1: hasMultipleH1,
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

  // 3. Compute deterministic issues across all forensic ranking categories
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

  // Issue B: 5xx Server Errors (Crawl Barrier)
  const pages5xx = pages.filter(p => p.status_code >= 500);
  if (pages5xx.length > 0) {
    deterministicIssues.push({
      id: 'issue-5xx',
      category: 'crawlability',
      severity: 'critical',
      issue_type: 'server_errors_5xx',
      title: `${pages5xx.length} server error(s) (5xx) detected during crawl`,
      description: 'URLs returned HTTP 500/502/503 server errors. Search engines immediately abort crawls and de-index pages that fail to respond.',
      evidence: `Sample 5xx URL: ${pages5xx[0].url}`,
      affected_urls: pages5xx.map(p => p.url),
      affected_url_count: pages5xx.length,
      sample_url: pages5xx[0].url,
      seo_impact: 'Severe crawl budget wastage, instant ranking drops, and removal from Google search index.',
      business_impact: 'Complete service disruption and lost customer conversion opportunities.',
      recommended_fix: 'Inspect web server error logs, database connection pooling, and edge routing to resolve internal server exceptions.',
      estimated_effort: 'hours',
      risk_level: 'high',
      automation_level: 'manual',
      status: 'open',
    });
  }

  // Issue C: Unintended Noindex on Content Pages (Indexation Blocker)
  const unintendedNoindex = pages.filter(p => !p.is_indexable && p.status_code === 200 && (p.url.includes('/blog/') || p.url.includes('/post/') || (p.word_count || 0) > 300));
  if (unintendedNoindex.length > 0) {
    deterministicIssues.push({
      id: 'issue-unintended-noindex',
      category: 'indexability',
      severity: 'critical',
      issue_type: 'unintended_noindex_directive',
      title: `${unintendedNoindex.length} published article(s) blocked with 'noindex' tag`,
      description: 'Content pages return HTTP 200 OK but contain <meta name="robots" content="noindex"> or X-Robots-Tag: noindex, physically barring search engines from indexing.',
      evidence: `Sample blocked article: ${unintendedNoindex[0].url}`,
      affected_urls: unintendedNoindex.map(p => p.url),
      affected_url_count: unintendedNoindex.length,
      sample_url: unintendedNoindex[0].url,
      seo_impact: 'Complete organic search blackout. Google is legally instructed not to index these URLs.',
      business_impact: 'Articles produce zero organic traffic, wasting content investments.',
      recommended_fix: 'Remove the noindex directive from page template or SEO plugin meta settings.',
      estimated_effort: 'minutes',
      risk_level: 'medium',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue D: Orphan Pages with Zero Inbound Internal Links
  const orphanPages = pages.filter(p => p.is_orphan || (p.internal_links_in === 0 && p.is_indexable && p.status_code === 200 && !p.url.endsWith('/') && !p.url.endsWith('.com') && !p.url.endsWith('.io')));
  if (orphanPages.length > 0) {
    deterministicIssues.push({
      id: 'issue-orphan-pages',
      category: 'orphan_pages',
      severity: 'high',
      issue_type: 'orphan_pages_zero_inlinks',
      title: `${orphanPages.length} orphan page(s) with zero internal links detected`,
      description: 'Pages exist on the domain but have 0 incoming internal links from navigation, category hubs, or other articles. Googlebot cannot discover them naturally, and zero internal PageRank is transferred.',
      evidence: `Sample orphan page: ${orphanPages[0].url}`,
      affected_urls: orphanPages.map(p => p.url),
      affected_url_count: orphanPages.length,
      sample_url: orphanPages[0].url,
      seo_impact: 'Orphan pages rarely get indexed, receive minimal crawl frequency, and almost never achieve top-10 rankings.',
      business_impact: 'Valuable content sits completely hidden from users and search engines.',
      recommended_fix: 'Insert contextual in-body internal links from topically relevant articles or add to category hubs.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue E: Starved Content / Insufficient Internal Link Equity
  const starvedPages = pages.filter(p => p.is_indexable && p.status_code === 200 && p.internal_links_in >= 1 && p.internal_links_in <= 2 && (p.word_count || 0) > 400);
  if (starvedPages.length > 0) {
    deterministicIssues.push({
      id: 'issue-starved-internal-links',
      category: 'internal_links',
      severity: 'medium',
      issue_type: 'starved_internal_link_equity',
      title: `${starvedPages.length} article(s) starving for internal links (< 3 inbound links)`,
      description: 'Articles have only 1 or 2 internal links across the entire website. In competitive niches, articles need 3-5+ contextual in-content internal links to establish topic cluster authority.',
      evidence: `Sample starved article: ${starvedPages[0].url} (only ${starvedPages[0].internal_links_in} inbound link(s))`,
      affected_urls: starvedPages.map(p => p.url),
      affected_url_count: starvedPages.length,
      sample_url: starvedPages[0].url,
      seo_impact: 'Sub-optimal PageRank distribution prevents pages from ranking for competitive keywords.',
      business_impact: 'Slow ranking velocity and lower search visibility.',
      recommended_fix: 'Cross-link this URL from complementary articles within the same topic cluster using descriptive anchor text.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue F: Thin Content & Low Word Count (Helpful Content Trap)
  const thinPages = pages.filter(p => p.has_thin_content || (p.is_indexable && p.status_code === 200 && (p.word_count || 0) > 0 && (p.word_count || 0) < 350 && (p.url.includes('/blog/') || p.url.includes('/post/') || p.url.split('/').length > 4)));
  if (thinPages.length > 0) {
    deterministicIssues.push({
      id: 'issue-thin-content',
      category: 'indexability',
      severity: 'high',
      issue_type: 'thin_content_helpful_content_risk',
      title: `${thinPages.length} indexable page(s) flagged with thin content (< 350 words)`,
      description: 'Pages have fewer than 350 words of plain text. Google\'s Helpful Content System devalues thin pages that fail to satisfy search intent, and site-wide thin ratios demote the entire domain.',
      evidence: `Sample thin page: ${thinPages[0].url} (${thinPages[0].word_count || 0} words)`,
      affected_urls: thinPages.map(p => p.url),
      affected_url_count: thinPages.length,
      sample_url: thinPages[0].url,
      seo_impact: 'High risk of algorithmic quality demotion and poor SERP dwell time.',
      business_impact: 'Visitors bounce immediately due to lack of comprehensive answers.',
      recommended_fix: 'Expand the article to at least 1,200–1,600 words with practitioner-first insights, real examples, and structured answers.',
      estimated_effort: 'hours',
      risk_level: 'low',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue G: Duplicate Title Tags (Cannibalization)
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

  // Issue H: Keyword Cannibalization (Multiple URLs Sharing Identical H1 Headings)
  const h1Map = new Map<string, string[]>();
  for (const page of pages) {
    if (page.h1 && page.h1.trim().length > 0 && page.is_indexable) {
      const existing = h1Map.get(page.h1.trim()) || [];
      existing.push(page.url);
      h1Map.set(page.h1.trim(), existing);
    }
  }
  const duplicateH1s = Array.from(h1Map.entries()).filter(([_, urls]) => urls.length > 1);
  if (duplicateH1s.length > 0) {
    const affectedUrls = duplicateH1s.flatMap(([_, urls]) => urls);
    deterministicIssues.push({
      id: 'issue-cannibalizing-h1',
      category: 'duplicates',
      severity: 'high',
      issue_type: 'keyword_cannibalization_h1',
      title: `${duplicateH1s.length} set(s) of pages sharing identical H1 headings (Cannibalization)`,
      description: 'Multiple URLs share identical <h1> headings, causing search engines to split impressions or oscillate rankings between competing URLs.',
      evidence: `H1: "${duplicateH1s[0][0]}" shared across ${duplicateH1s[0][1].length} pages`,
      affected_urls: affectedUrls,
      affected_url_count: affectedUrls.length,
      sample_url: affectedUrls[0],
      seo_impact: 'Search engines struggle to pick a canonical ranking entity, causing both pages to underperform.',
      business_impact: 'Internal competition harms conversion rates and splits domain authority.',
      recommended_fix: 'Differentiate the primary H1 headings to target distinct, non-overlapping search intents.',
      estimated_effort: 'hours',
      risk_level: 'low',
      automation_level: 'semi_auto',
      status: 'open',
    });
  }

  // Issue I: Truncated / Overly Long Title Tags
  const longTitles = pages.filter(p => p.title && p.title.length > 65 && p.is_indexable);
  if (longTitles.length > 0) {
    deterministicIssues.push({
      id: 'issue-truncated-titles',
      category: 'crawlability',
      severity: 'medium',
      issue_type: 'title_tag_too_long',
      title: `${longTitles.length} page(s) with title tags exceeding 65 characters`,
      description: 'Title tags exceed Google\'s ~600px desktop display limit and are clipped with ellipses (...) in SERP snippets.',
      evidence: `Example: "${longTitles[0].title}" (${longTitles[0].title!.length} chars)`,
      affected_urls: longTitles.map(p => p.url),
      affected_url_count: longTitles.length,
      sample_url: longTitles[0].url,
      seo_impact: 'Truncated headlines cut off secondary keywords and reduce search click-through rate.',
      business_impact: 'Reduced traffic from existing keyword positions.',
      recommended_fix: 'Shorten titles to 50–60 characters while front-loading the primary target keyword.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue J: Short / Under-Optimized Title Tags
  const shortTitles = pages.filter(p => p.title && p.title.trim().length > 0 && p.title.trim().length < 25 && p.is_indexable && p.status_code === 200);
  if (shortTitles.length > 0) {
    deterministicIssues.push({
      id: 'issue-underoptimized-titles',
      category: 'crawlability',
      severity: 'medium',
      issue_type: 'title_tag_too_short',
      title: `${shortTitles.length} page(s) with short/under-optimized title tags (< 25 chars)`,
      description: 'Titles are too brief and fail to include primary keyword modifiers, secondary phrasing, or brand authority.',
      evidence: `Example: "${shortTitles[0].title}" (${shortTitles[0].title!.length} chars)`,
      affected_urls: shortTitles.map(p => p.url),
      affected_url_count: shortTitles.length,
      sample_url: shortTitles[0].url,
      seo_impact: 'Missed ranking potential for long-tail query variations.',
      business_impact: 'Lower search impression volume.',
      recommended_fix: 'Expand titles to 50–60 characters including high-intent modifiers (e.g. "Guide", "2026", "Tested & Ranked").',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue K: Missing Meta Descriptions
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

  // Issue L: Overly Long Meta Descriptions
  const longMeta = pages.filter(p => p.meta_description && p.meta_description.length > 165 && p.is_indexable);
  if (longMeta.length > 0) {
    deterministicIssues.push({
      id: 'issue-long-meta',
      category: 'indexability',
      severity: 'low',
      issue_type: 'meta_description_too_long',
      title: `${longMeta.length} page(s) with meta descriptions exceeding 165 characters`,
      description: 'Meta descriptions exceed Google snippet display boundaries and are truncated in search results.',
      evidence: `Example (${longMeta[0].meta_description!.length} chars): "${longMeta[0].meta_description!.slice(0, 70)}..."`,
      affected_urls: longMeta.map(p => p.url),
      affected_url_count: longMeta.length,
      sample_url: longMeta[0].url,
      seo_impact: 'Truncated descriptions reduce snippet readability and CTR.',
      business_impact: 'Sub-optimal click-through performance.',
      recommended_fix: 'Trim meta descriptions to 140–160 characters with a clear value proposition.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue M: Missing H1 Tags
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

  // Issue N: Multiple H1 Headings (Presentation & Entity Disruption)
  const multiH1Pages = pages.filter(p => p.has_multiple_h1);
  if (multiH1Pages.length > 0) {
    deterministicIssues.push({
      id: 'issue-multiple-h1',
      category: 'presentation',
      severity: 'medium',
      issue_type: 'multiple_h1_headings',
      title: `${multiH1Pages.length} page(s) with multiple stacked H1 headings`,
      description: 'Multiple <h1> tags were detected in the page DOM, creating competing topical entity signals and disrupting visual typographic hierarchy.',
      evidence: `Sample URL with multiple H1s: ${multiH1Pages[0].url}`,
      affected_urls: multiH1Pages.map(p => p.url),
      affected_url_count: multiH1Pages.length,
      sample_url: multiH1Pages[0].url,
      seo_impact: 'Confuses search engine crawlers regarding document structure and dilutes topical relevance.',
      business_impact: 'Disrupts visual reading flow with awkward duplicate headers above content.',
      recommended_fix: 'Preserve the single page title H1 and downgrade body headings to clean H2 tags.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
      status: 'open',
    });
  }

  // Issue O: Missing Canonical Tags
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

  // Issue P: Non-Self-Referencing / Divergent Canonical URLs
  const nonSelfCanonicals = pages.filter(p => p.canonical_url && !p.canonical_is_self && p.is_indexable && p.status_code === 200 && p.canonical_url.replace(/\/+$/, '') !== p.url.replace(/\/+$/, ''));
  if (nonSelfCanonicals.length > 0) {
    deterministicIssues.push({
      id: 'issue-non-self-canonical',
      category: 'canonicals',
      severity: 'high',
      issue_type: 'non_self_referencing_canonical',
      title: `${nonSelfCanonicals.length} indexable page(s) canonicalized to a different URL`,
      description: 'Pages specify a canonical tag pointing to an external or different URL, explicitly instructing search engines not to index or rank them.',
      evidence: `Page: ${nonSelfCanonicals[0].url} -> Canonical: ${nonSelfCanonicals[0].canonical_url}`,
      affected_urls: nonSelfCanonicals.map(p => p.url),
      affected_url_count: nonSelfCanonicals.length,
      sample_url: nonSelfCanonicals[0].url,
      seo_impact: 'The affected URL will NOT rank; Google assigns all ranking signals to the canonical target.',
      business_impact: 'Accidental loss of indexation and traffic for standalone pages.',
      recommended_fix: 'Verify if canonicalization was intended. If this is unique content, set the canonical tag to self.',
      estimated_effort: 'minutes',
      risk_level: 'medium',
      automation_level: 'requires_approval',
      status: 'open',
    });
  }

  // Issue Q: Missing Schema.org Structured Data
  const missingSchema = pages.filter(p => !p.has_schema && p.is_indexable && p.status_code === 200 && (p.word_count || 0) > 300);
  if (missingSchema.length > 0) {
    deterministicIssues.push({
      id: 'issue-missing-schema',
      category: 'structured_data',
      severity: 'medium',
      issue_type: 'missing_structured_data',
      title: `${missingSchema.length} article(s) missing Schema.org structured data`,
      description: 'Pages lack Article, BlogPosting, or BreadcrumbList JSON-LD schema markup.',
      evidence: `Sample URL without schema: ${missingSchema[0].url}`,
      affected_urls: missingSchema.map(p => p.url),
      affected_url_count: missingSchema.length,
      sample_url: missingSchema[0].url,
      seo_impact: 'Disqualified from Google Rich Results, star ratings, carousel snippets, and entity graph recognition.',
      business_impact: 'Lower visibility in SERPs compared to competitors with rich results.',
      recommended_fix: 'Inject valid JSON-LD Article and BreadcrumbList schema into the document head.',
      estimated_effort: 'minutes',
      risk_level: 'low',
      automation_level: 'auto',
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
