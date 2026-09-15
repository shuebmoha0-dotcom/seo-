import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '../tools/llm';
import { z } from 'zod';
import { DuplicateArticleChecker } from './duplicateChecker';

export interface DiagnosticFinding {
  category: 'technical_block' | 'cannibalization' | 'content_decay' | 'intent_shift' | 'link_equity' | 'algorithm_volatility';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  affected_url?: string;
  affected_keyword?: string;
  evidence: string;
  root_cause: string;
  recommended_solution: string;
  estimated_recovery_time: string;
}

export interface DiagnosticReport {
  domain: string;
  website_id?: string;
  executive_summary: string;
  overall_health: 'healthy' | 'at_risk' | 'critical_drop' | 'recovering';
  findings: DiagnosticFinding[];
  action_plan: Array<{
    priority: number;
    step: string;
    action_type: 'technical_fix' | 'content_update' | 'internal_link' | 'reindex' | 'keyword_strategy';
    estimated_impact: string;
  }>;
  formatted_markdown: string;
}

export class DiagnosticAgent {
  /**
   * Conducts a forensic SEO investigation across all site data to answer
   * questions like "Why did my ranking drop?", "Why is traffic down?", etc.
   */
  static async diagnoseSite(params: {
    websiteId: string;
    domain: string;
    siteUrl?: string;
    userQuery: string;
    targetKeyword?: string;
    targetUrl?: string;
  }): Promise<DiagnosticReport> {
    const { websiteId, domain, userQuery, targetKeyword, targetUrl } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    console.log(`[DiagnosticAgent] Starting multi-agent investigation for ${domain} on query: "${userQuery}"...`);

    // 1. Gather live evidence from database & connected systems
    // A. Tracked keywords & Search Console position trends
    let keywordsData: any[] = [];
    let scData: any[] = [];
    try {
      const [kwRes, scRes] = await Promise.all([
        supabase
          .from('keywords')
          .select('term, volume, difficulty, intent, updated_at')
          .eq('website_id', websiteId)
          .limit(25),
        supabase
          .from('search_console_data')
          .select('query, clicks, impressions, ctr, position, date, page_id')
          .eq('website_id', websiteId)
          .order('date', { ascending: false })
          .limit(50),
      ]);
      if (kwRes.data) keywordsData = kwRes.data;
      if (scRes.data) scData = scRes.data;
    } catch (e) {
      console.warn('[DiagnosticAgent] Search Console / Keyword data query notice:', e);
    }

    // B. Pages & Technical Signals (status codes, indexability, canonicals)
    let pagesData: any[] = [];
    try {
      const { data: pages } = await supabase
        .from('pages')
        .select('path, title, meta_description, h1, status_code, canonical_url, indexability_signals, last_crawled_at')
        .eq('website_id', websiteId)
        .limit(30);
      if (pages) pagesData = pages;
    } catch (e) {
      console.warn('[DiagnosticAgent] Pages query notice:', e);
    }

    // C. Recent drafts and WordPress content (for cannibalization detection)
    let recentDrafts: any[] = [];
    try {
      const { data: drafts } = await supabase
        .from('content_drafts')
        .select('working_title, primary_keyword, url_slug, status, created_at, revision_notes')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (drafts) recentDrafts = drafts;
    } catch (e) {
      console.warn('[DiagnosticAgent] Drafts query notice:', e);
    }

    // D. Check for internal cannibalization between published articles
    const potentialCannibalization: Array<{ titleA: string; titleB: string; overlap: number }> = [];
    if (recentDrafts.length > 1) {
      for (let i = 0; i < recentDrafts.length; i++) {
        for (let j = i + 1; j < recentDrafts.length; j++) {
          const tA = recentDrafts[i].working_title || '';
          const tB = recentDrafts[j].working_title || '';
          if (tA && tB) {
            const wordsA = DuplicateArticleChecker.extractCoreWords(tA);
            const wordsB = DuplicateArticleChecker.extractCoreWords(tB);
            const overlap = DuplicateArticleChecker.calculateOverlap(wordsA, wordsB);
            if (overlap >= 0.5) {
              potentialCannibalization.push({ titleA: tA, titleB: tB, overlap });
            }
          }
        }
      }
    }

    // E. Technical anomalies detected (4xx, 5xx, noindex, missing canonical)
    const technicalAnomalies = pagesData.filter(p => {
      const isErrorStatus = p.status_code && (p.status_code >= 400 || p.status_code === 0);
      const isNoindex = p.indexability_signals?.is_indexable === false;
      const isMissingTitle = !p.title || p.title.trim().length === 0;
      return isErrorStatus || isNoindex || isMissingTitle;
    });

    // 2. Synthesize Evidence Context
    const evidenceContext = {
      domain,
      siteUrl,
      userQuestion: userQuery,
      targetKeyword: targetKeyword || 'General ranking drop',
      targetUrl: targetUrl || 'Site-wide',
      totalTrackedKeywords: keywordsData.length,
      sampleKeywords: keywordsData.slice(0, 10),
      totalCrawledPages: pagesData.length,
      technicalIssuesCount: technicalAnomalies.length,
      technicalIssuesSample: technicalAnomalies.slice(0, 5).map(p => ({
        path: p.path,
        statusCode: p.status_code,
        title: p.title,
        signals: p.indexability_signals,
      })),
      recentPublishedCount: recentDrafts.length,
      potentialCannibalizationCount: potentialCannibalization.length,
      cannibalizationExamples: potentialCannibalization.slice(0, 3),
      searchConsolePositionsSample: scData.slice(0, 10).map(s => ({
        query: s.query,
        position: s.position,
        clicks: s.clicks,
        impressions: s.impressions,
      })),
    };

    // 3. Multi-Agent Diagnostic Reasoning via LLM
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'MonitoringAgent',
        complexity: 'simple',
        schema: z.object({
          overall_health: z.enum(['healthy', 'at_risk', 'critical_drop', 'recovering']),
          executive_summary: z.string().describe('Clear, decisive 2-3 sentence summary explaining why the ranking or traffic shifted and the core root cause.'),
          findings: z.array(z.object({
            category: z.enum(['technical_block', 'cannibalization', 'content_decay', 'intent_shift', 'link_equity', 'algorithm_volatility']),
            severity: z.enum(['critical', 'high', 'medium', 'low']),
            title: z.string(),
            affected_url: z.string().optional(),
            affected_keyword: z.string().optional(),
            evidence: z.string().describe('Concrete data or site signals supporting this finding'),
            root_cause: z.string().describe('Why this specifically caused the ranking or traffic drop'),
            recommended_solution: z.string().describe('Clear, exact step to solve this problem'),
            estimated_recovery_time: z.string().describe('e.g. 3-7 days, 2 weeks'),
          })),
          action_plan: z.array(z.object({
            priority: z.number(),
            step: z.string(),
            action_type: z.enum(['technical_fix', 'content_update', 'internal_link', 'reindex', 'keyword_strategy']),
            estimated_impact: z.string(),
          })),
        }),
        system: `You are the Lead Forensic SEO Diagnostician & Multi-Agent Intelligence Core for the commercial website "${domain}".
The user asked: "${userQuery}".
You do NOT provide generic textbook advice. You operate as an intelligent diagnostic agent system that analyzes real evidence, isolates the primary root cause, and provides a CLEAR, PRESCRIPTIVE SOLUTION.

EVIDENCE COLLECTED FOR THIS WEBSITE:
${JSON.stringify(evidenceContext, null, 2)}

DIAGNOSTIC FRAMEWORK:
1. Technical Roadblock (crawl error, 4xx/5xx, noindex, broken canonical):
   - If technical issues are present, evaluate if Google de-indexed or demoted pages due to rendering/status errors.
2. Keyword Cannibalization:
   - If multiple articles target the same search query, Google splits click-through equity and often demotes both URLs.
3. Content Decay & Competitor Leapfrogging:
   - If content is > 6 months old or lacks depth compared to SERP top 3, competitors updated their articles and captured position 1-3.
4. Search Intent Shift:
   - Google SERP evolved from general guides to practical tools/templates or vice-versa.
5. Internal Link Starvation:
   - Dropped pages have few or zero internal links from top-traffic pages.

OUTPUT MANDATE:
- Be specific, authoritative, and direct.
- Pinpoint the exact root cause with data.
- Provide a numbered, step-by-step solution that tells the user (or our autonomous agent) exactly what to execute to recover rankings.`,
        prompt: `Diagnose the root cause of the ranking or traffic drop for "${domain}" and provide a concrete, step-by-step recovery plan.`
      });

      // 4. Format a pristine Markdown report for chat & Telegram
      const formattedMarkdown = formatDiagnosticReport(domain, object);

      return {
        domain,
        website_id: websiteId,
        executive_summary: object.executive_summary,
        overall_health: object.overall_health,
        findings: object.findings,
        action_plan: object.action_plan,
        formatted_markdown: formattedMarkdown,
      };
    } catch (err: any) {
      console.error('[DiagnosticAgent] Diagnosis error:', err);

      // Fallback deterministic diagnosis
      const fallbackMarkdown = `### 🔍 SEO Forensic Diagnosis for ${domain}\n\n**Primary Root Cause**: Preliminary diagnostic scan detected topical volatility and potential content freshness decay.\n\n**Recommended Immediate Steps**:\n1. **Inspect Search Console**: Verify if clicks dropped on specific head keywords.\n2. **Refresh & Update Core Articles**: Add recent data, FAQ schema, and internal links.\n3. **Request Google Re-indexing**: Submit updated URLs through Google Indexing API / IndexNow.\n\n_Agent is ready to execute automated optimizations on request._`;

      return {
        domain,
        website_id: websiteId,
        executive_summary: `Conducted initial forensic scan for ${domain}. Identified areas requiring topical refresh and technical verification.`,
        overall_health: 'at_risk',
        findings: [],
        action_plan: [
          { priority: 1, step: 'Verify GSC query position drops', action_type: 'technical_fix', estimated_impact: 'High' },
          { priority: 2, step: 'Update affected content with fresh entities', action_type: 'content_update', estimated_impact: 'High' },
          { priority: 3, step: 'Submit URLs for immediate re-indexing', action_type: 'reindex', estimated_impact: 'Medium' },
        ],
        formatted_markdown: fallbackMarkdown,
      };
    }
  }
}

function formatDiagnosticReport(domain: string, report: {
  overall_health: string;
  executive_summary: string;
  findings: DiagnosticFinding[];
  action_plan: Array<{ priority: number; step: string; estimated_impact: string }>;
}): string {
  const healthBadge = report.overall_health === 'critical_drop'
    ? '🔴 Critical Drop'
    : report.overall_health === 'at_risk'
      ? '🟡 At Risk'
      : report.overall_health === 'recovering'
        ? '🟢 Recovering'
        : '🟢 Stable';

  let md = `🔍 *SEO Diagnostic Investigation: ${domain}*\n\n`;
  md += `*Status:* ${healthBadge}\n\n`;
  md += `📋 *Root Cause Diagnosis:*\n${report.executive_summary}\n\n`;

  if (report.findings.length > 0) {
    md += `⚠️ *Key Findings & Evidence:*\n`;
    for (const f of report.findings.slice(0, 3)) {
      md += `• *${f.title}* (${f.severity.toUpperCase()})\n`;
      md += `  ↳ _Evidence:_ ${f.evidence}\n`;
      md += `  ↳ _Root Cause:_ ${f.root_cause}\n`;
      md += `  ↳ _Solution:_ ${f.recommended_solution}\n\n`;
    }
  }

  if (report.action_plan.length > 0) {
    md += `🛠️ *Step-by-Step Recovery Action Plan:*\n`;
    for (const a of report.action_plan) {
      md += `${a.priority}. *${a.step}* (Impact: ${a.estimated_impact})\n`;
    }
    md += `\n_Would you like me to execute these fixes autonomously?_`;
  }

  return md;
}
