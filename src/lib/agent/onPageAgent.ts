import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchIntent =
  | 'informational'
  | 'commercial_investigation'
  | 'transactional'
  | 'navigational'
  | 'comparison'
  | 'local'
  | 'problem_solution';

export type RiskLevel = 'low' | 'medium' | 'high';
export type RecommendationCategory =
  | 'title' | 'meta_description' | 'h1' | 'headings' | 'content_gap'
  | 'keyword_optimization' | 'internal_links' | 'external_links'
  | 'images' | 'url' | 'schema' | 'canonical' | 'search_intent'
  | 'readability' | 'featured_snippet' | 'faq';

export interface PageData {
  url: string;
  title: string;
  meta_description: string;
  h1: string;
  h2s: string[];
  h3s: string[];
  content_body: string;
  word_count: number;
  canonical_url?: string;
  images?: Array<{ src: string; alt: string; filename: string }>;
  internal_links?: Array<{ anchor: string; href: string }>;
  external_links?: Array<{ anchor: string; href: string }>;
  existing_schema?: object;
  robots_meta?: string;
}

export interface OnPageInput {
  page: PageData;
  target_keyword: string;
  secondary_keywords: string[];
  search_intent: SearchIntent;
  content_type: string;
  existing_website_pages?: Array<{ url: string; title: string; topic: string }>;
  project_instructions?: string;
  project_memory?: string;
}

export interface Recommendation {
  category: RecommendationCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  risk_level: RiskLevel;
  issue: string;
  recommendation: string;
  current_value?: string;
  suggested_value?: string;
  reasoning: string;
  requires_approval: boolean;
  auto_applicable: boolean;
}

export interface InternalLinkRecommendation {
  source_page: string;
  target_page: string;
  suggested_anchor: string;
  reason: string;
  risk_level: RiskLevel;
}

export interface SchemaRecommendation {
  schema_type: string;
  justification: string;
  schema_json: string;
  requires_approval: boolean;
}

export interface DiagnosticScores {
  intent_alignment: number;
  content_coverage: number;
  technical: number;
  metadata: number;
  linking: number;
  overall: number;
  note: string;
}

export interface QAResult {
  target_keyword_in_title: boolean;
  target_keyword_in_h1: boolean;
  target_keyword_in_intro: boolean;
  meta_description_exists: boolean;
  meta_description_length_ok: boolean;
  single_h1: boolean;
  logical_heading_structure: boolean;
  no_keyword_stuffing: boolean;
  internal_links_present: boolean;
  images_have_alt_text: boolean;
  canonical_correct: boolean;
  schema_present: boolean;
  content_covers_intent: boolean;
  readability_ok: boolean;
  url_clean: boolean;
  flagged_issues: string[];
  overall_status: 'pass' | 'needs_revision' | 'needs_content_agent';
  qa_notes: string;
}

export interface ContentAgentTask {
  triggered: boolean;
  reason: string;
  specific_gaps: string[];
}

export interface ImageAgentTask {
  triggered: boolean;
  visuals_needed: Array<{
    placement: string;
    image_type: string;
    purpose: string;
    suggested_alt: string;
    suggested_filename: string;
  }>;
}

export interface OnPageAnalysisResult {
  url: string;
  target_keyword: string;
  search_intent: SearchIntent;
  recommendations: Recommendation[];
  internal_link_recommendations: InternalLinkRecommendation[];
  schema_recommendations: SchemaRecommendation[];
  seo_metadata: {
    optimized_title: string;
    optimized_meta_description: string;
    optimized_h1: string;
    optimized_url_slug: string;
  };
  diagnostic_scores: DiagnosticScores;
  qa: QAResult;
  content_agent_task: ContentAgentTask;
  image_agent_task: ImageAgentTask;
  status: 'pass' | 'needs_revision' | 'needs_content_agent';
}

// ─── Agent Class ──────────────────────────────────────────────────────────────

export class OnPageSEOAgent {

  // 1. Deterministic pre-analysis
  private preAnalyze(input: OnPageInput): {
    intentMismatch: boolean;
    keywordInTitle: boolean;
    keywordInH1: boolean;
    keywordInIntro: boolean;
    titleLength: number;
    metaLength: number;
    h1Count: number;
    keywordDensity: number;
    missingAltImages: number;
    hasCanonical: boolean;
    hasSchema: boolean;
    urlIsClean: boolean;
  } {
    const { page, target_keyword } = input;
    const kwLower = target_keyword.toLowerCase();
    const titleLower = page.title?.toLowerCase() || '';
    const h1Lower = page.h1?.toLowerCase() || '';
    const bodyLower = page.content_body?.toLowerCase() || '';
    const introWords = bodyLower.slice(0, 500);

    const words = bodyLower.split(/\s+/).filter(Boolean);
    const kwOccurrences = (bodyLower.match(new RegExp(kwLower, 'g')) || []).length;
    const keywordDensity = words.length > 0 ? (kwOccurrences / words.length) * 100 : 0;

    const missingAltImages = (page.images || []).filter(
      img => !img.alt || img.alt.trim().length < 3
    ).length;

    const urlIsClean = /^[a-z0-9\-\/]+$/.test(
      page.url.replace(/https?:\/\/[^/]+/, '').replace(/\?.*/, '')
    );

    return {
      intentMismatch: false, // evaluated by AI
      keywordInTitle: titleLower.includes(kwLower),
      keywordInH1: h1Lower.includes(kwLower),
      keywordInIntro: introWords.includes(kwLower),
      titleLength: page.title?.length || 0,
      metaLength: page.meta_description?.length || 0,
      h1Count: page.h1 ? 1 : 0, // simplified
      keywordDensity,
      missingAltImages,
      hasCanonical: !!page.canonical_url,
      hasSchema: !!page.existing_schema,
      urlIsClean,
    };
  }

  // 2. AI-powered deep analysis
  async analyzeWithAI(input: OnPageInput): Promise<{
    recommendations: Recommendation[];
    seo_metadata: OnPageAnalysisResult['seo_metadata'];
    schema_recommendations: SchemaRecommendation[];
    content_agent_task: ContentAgentTask;
    image_agent_task: ImageAgentTask;
    intent_assessment: string;
    content_gaps: string[];
  }> {
    const pre = this.preAnalyze(input);

    try {
      const { object } = await LLMProvider.generateObject({
      agent: 'OnPageAgent',
      
        
        schema: z.object({
          recommendations: z.array(z.object({
            category: z.enum([
              'title', 'meta_description', 'h1', 'headings', 'content_gap',
              'keyword_optimization', 'internal_links', 'external_links',
              'images', 'url', 'schema', 'canonical', 'search_intent',
              'readability', 'featured_snippet', 'faq',
            ]),
            priority: z.enum(['critical', 'high', 'medium', 'low']),
            risk_level: z.enum(['low', 'medium', 'high']),
            issue: z.string(),
            recommendation: z.string(),
            current_value: z.string().optional(),
            suggested_value: z.string().optional(),
            reasoning: z.string(),
            requires_approval: z.boolean(),
            auto_applicable: z.boolean(),
          })),
          optimized_title: z.string(),
          optimized_meta_description: z.string(),
          optimized_h1: z.string(),
          optimized_url_slug: z.string(),
          schema_type: z.string(),
          schema_json: z.string(),
          schema_justification: z.string(),
          content_agent_needed: z.boolean(),
          content_agent_reason: z.string(),
          content_gaps: z.array(z.string()),
          image_visuals_needed: z.array(z.object({
            placement: z.string(),
            image_type: z.string(),
            purpose: z.string(),
            suggested_alt: z.string(),
            suggested_filename: z.string(),
          })),
          intent_assessment: z.string(),
        }),
        system: `You are an expert On-Page SEO specialist. You optimize pages for searchers, search intent, and content quality — NOT arbitrary checklist scores.

PRINCIPLES:
- Optimize for SEARCHER + SEARCH INTENT + CONTENT QUALITY + TECHNICAL + BUSINESS GOAL
- Never recommend keyword stuffing
- Never recommend changes solely to hit a keyword density target  
- Only recommend URL changes if there is a clear SEO benefit AND flag as HIGH RISK requiring approval
- Only recommend schema that accurately represents visible page content
- If content itself is the problem, flag for Content Agent rather than patching metadata
- Internal links must genuinely help the reader
- Alt text should describe images meaningfully, not just insert keywords

RISK LEVELS:
- LOW: title, meta desc, alt text, minor headings, internal links
- MEDIUM: H1 changes, content additions, heading restructure
- HIGH: URL changes, canonical changes, large content rewrites, schema additions, redirects

APPROVAL REQUIRED: URL changes, canonical changes, large rewrites, removing content, major schema changes`,
        prompt: `Analyze this page for on-page SEO optimization.

URL: ${input.page.url}
TARGET KEYWORD: "${input.target_keyword}"
SECONDARY KEYWORDS: ${input.secondary_keywords.join(', ')}
SEARCH INTENT: ${input.search_intent}
CONTENT TYPE: ${input.content_type}

CURRENT PAGE DATA:
Title (${pre.titleLength} chars): "${input.page.title}"
Meta Description (${pre.metaLength} chars): "${input.page.meta_description}"
H1: "${input.page.h1}"
H2s: ${input.page.h2s.slice(0, 8).join(' | ')}
H3s: ${input.page.h3s.slice(0, 5).join(' | ')}
Word Count: ${input.page.word_count}
Canonical: ${input.page.canonical_url || 'Not set'}
Has Schema: ${pre.hasSchema}
Keyword in title: ${pre.keywordInTitle}
Keyword in H1: ${pre.keywordInH1}
Keyword in intro: ${pre.keywordInIntro}
Keyword density: ${pre.keywordDensity.toFixed(2)}%
Missing alt text images: ${pre.missingAltImages}
URL is clean: ${pre.urlIsClean}

CONTENT PREVIEW (first 1500 chars):
${input.page.content_body?.slice(0, 1500)}

EXISTING SITE PAGES (for internal linking):
${(input.existing_website_pages || []).slice(0, 10).map(p => `- ${p.url}: ${p.title}`).join('\n')}

PROJECT INSTRUCTIONS: ${input.project_instructions || 'None'}

Provide specific, actionable recommendations. Be selective — only flag genuine issues. Do not pad with trivial observations.
Suggest optimized title (≤60 chars), meta description (≤155 chars), H1, and URL slug.
Recommend the most appropriate schema type if justified.
If the content itself fails to satisfy search intent, set content_agent_needed=true.`,
      });

      return {
        recommendations: object.recommendations,
        seo_metadata: {
          optimized_title: object.optimized_title,
          optimized_meta_description: object.optimized_meta_description,
          optimized_h1: object.optimized_h1,
          optimized_url_slug: object.optimized_url_slug,
        },
        schema_recommendations: object.schema_type ? [{
          schema_type: object.schema_type,
          justification: object.schema_justification,
          schema_json: object.schema_json,
          requires_approval: true,
        }] : [],
        content_agent_task: {
          triggered: object.content_agent_needed,
          reason: object.content_agent_reason,
          specific_gaps: object.content_gaps,
        },
        image_agent_task: {
          triggered: object.image_visuals_needed.length > 0,
          visuals_needed: object.image_visuals_needed,
        },
        intent_assessment: object.intent_assessment,
        content_gaps: object.content_gaps,
      };
    } catch {
      // Deterministic fallback analysis
      const pre = this.preAnalyze(input);
      const recs: Recommendation[] = [];

      if (pre.titleLength > 60) {
        recs.push({
          category: 'title', priority: 'high', risk_level: 'low',
          issue: `Title is ${pre.titleLength} characters — exceeds the ~60 char display limit.`,
          recommendation: 'Shorten the title to under 60 characters while keeping the primary keyword.',
          current_value: input.page.title,
          suggested_value: input.page.title.slice(0, 57) + '…',
          reasoning: 'Titles over 60 chars are truncated in SERPs, reducing click-through rate.',
          requires_approval: false, auto_applicable: true,
        });
      }

      if (pre.metaLength === 0) {
        recs.push({
          category: 'meta_description', priority: 'high', risk_level: 'low',
          issue: 'No meta description found.',
          recommendation: `Write a 130–155 character meta description targeting "${input.target_keyword}" and matching ${input.search_intent} intent.`,
          current_value: 'None',
          suggested_value: `Learn everything about ${input.target_keyword}. Practical guide for your business.`,
          reasoning: 'Missing meta descriptions mean Google writes its own, often poorly.',
          requires_approval: false, auto_applicable: true,
        });
      } else if (pre.metaLength > 155) {
        recs.push({
          category: 'meta_description', priority: 'medium', risk_level: 'low',
          issue: `Meta description is ${pre.metaLength} chars — will be truncated in SERPs.`,
          recommendation: 'Rewrite to under 155 characters.',
          current_value: input.page.meta_description,
          suggested_value: input.page.meta_description.slice(0, 152) + '…',
          reasoning: 'Truncated meta descriptions reduce qualified click-through.',
          requires_approval: false, auto_applicable: true,
        });
      }

      if (!pre.keywordInTitle) {
        recs.push({
          category: 'title', priority: 'high', risk_level: 'low',
          issue: `Primary keyword "${input.target_keyword}" is not present in the title.`,
          recommendation: 'Include the primary keyword naturally in the title.',
          current_value: input.page.title,
          reasoning: 'Title keyword relevance is a strong on-page signal.',
          requires_approval: false, auto_applicable: false,
        });
      }

      if (!pre.keywordInH1) {
        recs.push({
          category: 'h1', priority: 'medium', risk_level: 'medium',
          issue: `Primary keyword "${input.target_keyword}" is not in the H1.`,
          recommendation: 'Include the primary keyword in the H1 naturally.',
          current_value: input.page.h1,
          reasoning: 'H1 is a primary relevance signal for the page topic.',
          requires_approval: false, auto_applicable: false,
        });
      }

      if (pre.missingAltImages > 0) {
        recs.push({
          category: 'images', priority: 'medium', risk_level: 'low',
          issue: `${pre.missingAltImages} image(s) missing alt text.`,
          recommendation: 'Add descriptive alt text to all meaningful images.',
          reasoning: 'Alt text improves image search visibility and accessibility.',
          requires_approval: false, auto_applicable: true,
        });
      }

      if (!pre.hasCanonical) {
        recs.push({
          category: 'canonical', priority: 'medium', risk_level: 'medium',
          issue: 'No canonical tag detected.',
          recommendation: 'Add a self-referencing canonical tag to prevent duplicate content issues.',
          reasoning: 'Canonical tags prevent indexation of duplicate/near-duplicate URLs.',
          requires_approval: true, auto_applicable: false,
        });
      }

      return {
        recommendations: recs,
        seo_metadata: {
          optimized_title: input.page.title?.slice(0, 60) || `${input.target_keyword} — Complete Guide`,
          optimized_meta_description: `Learn about ${input.target_keyword}. Practical guide with actionable insights for your business.`,
          optimized_h1: input.page.h1 || input.target_keyword,
          optimized_url_slug: input.target_keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-'),
        },
        schema_recommendations: [],
        content_agent_task: { triggered: false, reason: '', specific_gaps: [] },
        image_agent_task: { triggered: false, visuals_needed: [] },
        intent_assessment: `Page appears to target ${input.search_intent} intent for "${input.target_keyword}".`,
        content_gaps: [],
      };
    }
  }

  // 3. Compute diagnostic scores (internal diagnostic — NOT a ranking guarantee)
  computeScores(
    input: OnPageInput,
    recs: Recommendation[],
    qaResult: QAResult,
  ): DiagnosticScores {
    const pre = this.preAnalyze(input);

    const intentScore = qaResult.content_covers_intent ? 85 : 45;
    const technicalScore = Math.max(0, 100
      - (pre.hasCanonical ? 0 : 15)
      - (!pre.urlIsClean ? 10 : 0)
      - (pre.missingAltImages * 5)
      - (qaResult.schema_present ? 0 : 5)
    );
    const metaScore = Math.max(0, 100
      - (pre.keywordInTitle ? 0 : 20)
      - (pre.titleLength > 60 ? 10 : 0)
      - (pre.metaLength === 0 ? 25 : pre.metaLength > 155 ? 10 : 0)
      - (pre.keywordInH1 ? 0 : 15)
    );
    const contentScore = Math.max(0, 100
      - (pre.keywordInIntro ? 0 : 15)
      - (pre.keywordDensity > 3 ? 20 : 0) // penalise stuffing
    );
    const linkingScore = qaResult.internal_links_present ? 80 : 50;

    const overall = Math.round((intentScore + technicalScore + metaScore + contentScore + linkingScore) / 5);

    return {
      intent_alignment: intentScore,
      content_coverage: contentScore,
      technical: technicalScore,
      metadata: metaScore,
      linking: linkingScore,
      overall,
      note: 'Diagnostic scores are internal indicators only. They do not guarantee search rankings.',
    };
  }

  // 4. Automated QA
  runQA(input: OnPageInput, contentAgentNeeded: boolean): QAResult {
    const { page, target_keyword } = input;
    const pre = this.preAnalyze(input);
    const flaggedIssues: string[] = [];

    if (!pre.keywordInTitle) flaggedIssues.push(`Primary keyword "${target_keyword}" not in title`);
    if (!pre.keywordInH1) flaggedIssues.push(`Primary keyword not in H1`);
    if (!pre.keywordInIntro) flaggedIssues.push(`Primary keyword not in introduction`);
    if (pre.metaLength === 0) flaggedIssues.push('Meta description missing');
    if (pre.metaLength > 155) flaggedIssues.push(`Meta description too long (${pre.metaLength} chars)`);
    if (pre.titleLength > 60) flaggedIssues.push(`Title too long (${pre.titleLength} chars)`);
    if (pre.keywordDensity > 3) flaggedIssues.push(`Possible keyword stuffing (${pre.keywordDensity.toFixed(1)}% density)`);
    if (pre.missingAltImages > 0) flaggedIssues.push(`${pre.missingAltImages} image(s) missing alt text`);

    const internalLinksOk = (page.internal_links?.length || 0) > 0;

    const overallStatus = contentAgentNeeded
      ? 'needs_content_agent'
      : flaggedIssues.length === 0
        ? 'pass'
        : flaggedIssues.length <= 2
          ? 'needs_revision'
          : 'needs_revision';

    return {
      target_keyword_in_title: pre.keywordInTitle,
      target_keyword_in_h1: pre.keywordInH1,
      target_keyword_in_intro: pre.keywordInIntro,
      meta_description_exists: pre.metaLength > 0,
      meta_description_length_ok: pre.metaLength >= 70 && pre.metaLength <= 155,
      single_h1: pre.h1Count === 1,
      logical_heading_structure: (page.h2s?.length || 0) > 0,
      no_keyword_stuffing: pre.keywordDensity <= 3,
      internal_links_present: internalLinksOk,
      images_have_alt_text: pre.missingAltImages === 0,
      canonical_correct: pre.hasCanonical,
      schema_present: pre.hasSchema,
      content_covers_intent: !contentAgentNeeded,
      readability_ok: (page.word_count || 0) > 300,
      url_clean: pre.urlIsClean,
      flagged_issues: flaggedIssues,
      overall_status: overallStatus,
      qa_notes: flaggedIssues.length === 0
        ? 'All QA checks passed. Page ready for approval.'
        : `${flaggedIssues.length} issue(s) found: ${flaggedIssues.slice(0, 3).join('; ')}`,
    };
  }

  // 5. Full pipeline
  async analyze(input: OnPageInput): Promise<OnPageAnalysisResult> {
    const aiAnalysis = await this.analyzeWithAI(input);
    const qa = this.runQA(input, aiAnalysis.content_agent_task.triggered);
    const scores = this.computeScores(input, aiAnalysis.recommendations, qa);

    return {
      url: input.page.url,
      target_keyword: input.target_keyword,
      search_intent: input.search_intent,
      recommendations: aiAnalysis.recommendations,
      internal_link_recommendations: [], // derived from recommendations
      schema_recommendations: aiAnalysis.schema_recommendations,
      seo_metadata: aiAnalysis.seo_metadata,
      diagnostic_scores: scores,
      qa,
      content_agent_task: aiAnalysis.content_agent_task,
      image_agent_task: aiAnalysis.image_agent_task,
      status: qa.overall_status === 'pass' ? 'pass' : qa.overall_status,
    };
  }
}
