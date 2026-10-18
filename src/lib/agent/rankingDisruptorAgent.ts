import { createAdminClient } from '@/lib/supabase/admin';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { decryptCredential } from '@/lib/utils/encryption';

export type DisruptorCategory = 
  | 'duplicate_cannibalization'
  | 'malicious_comment_spam'
  | 'open_comments_vulnerability'
  | 'ai_artifact_leak'
  | 'broken_outbound_links'
  | 'orphan_pages';

export interface DisruptorIssue {
  id: string;
  category: DisruptorCategory;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  evidence: string;
  affectedCount: number;
  affectedItems: Array<{
    id?: number | string;
    url?: string;
    title?: string;
    slug?: string;
    detail?: string;
  }>;
  autoFixable: boolean;
  fixAction: string;
  fixActionLabel: string;
}

export interface RankingDisruptorScanResult {
  websiteId: string;
  domain: string;
  siteUrl: string;
  scannedAt: string;
  disruptorCount: number;
  healthImpactScore: number; // 0 to 100
  issues: DisruptorIssue[];
  summary: {
    duplicateSlugsCount: number;
    maliciousCommentsCount: number;
    openCommentsPostsCount: number;
    aiArtifactsCount: number;
    brokenOutboundLinksCount: number;
    orphanPagesCount: number;
  };
}

export class RankingDisruptorAgent {
  /**
   * Helper to resolve WordPress client with authenticated credentials if available
   */
  private static async getWordPressClient(websiteId: string, siteUrl: string): Promise<WordPressClient | null> {
    const supabase = createAdminClient();

    try {
      // 1. Check integrations table
      const { data: intg } = await supabase
        .from('integrations')
        .select('id, config')
        .eq('website_id', websiteId)
        .eq('provider', 'wordpress')
        .eq('status', 'connected')
        .maybeSingle();

      if (intg?.config?.site_url) {
        const { data: creds } = await supabase
          .from('integration_credentials')
          .select('encrypted_value, credential_type')
          .eq('integration_id', intg.id)
          .maybeSingle();

        if (creds?.encrypted_value) {
          const appPassword = decryptCredential(creds.encrypted_value);
          return new WordPressClient({
            siteUrl: intg.config.site_url,
            username: intg.config.username || 'Outdart Agent',
            applicationPassword: appPassword,
            seoPlugin: intg.config.seo_plugin || 'none',
          });
        }
      }

      // 2. Check wordpress_outbound_sites table
      const { data: obSite } = await supabase
        .from('wordpress_outbound_sites')
        .select('*')
        .eq('website_id', websiteId)
        .eq('status', 'active')
        .maybeSingle();

      if (obSite?.site_url) {
        return new WordPressClient({
          siteUrl: obSite.site_url,
          username: 'Outdart Agent',
        });
      }
    } catch (err) {
      console.warn('[RankingDisruptorAgent] WP Client resolution notice:', err);
    }

    return null;
  }

  /**
   * Comprehensive website scan for ranking disruptors
   */
  static async scanWebsite(params: {
    websiteId: string;
    domain: string;
    siteUrl?: string;
  }): Promise<RankingDisruptorScanResult> {
    const { websiteId, domain } = params;
    const siteUrl = (params.siteUrl || `https://${domain}`).replace(/\/+$/, '');
    const supabase = createAdminClient();

    const issues: DisruptorIssue[] = [];
    let duplicateSlugsCount = 0;
    let maliciousCommentsCount = 0;
    let openCommentsPostsCount = 0;
    let aiArtifactsCount = 0;
    let brokenOutboundLinksCount = 0;
    let orphanPagesCount = 0;

    // 1. Fetch live posts (via WP REST or Supabase pages)
    let livePosts: Array<{
      id?: number;
      title: string;
      slug: string;
      link: string;
      content: string;
      comment_status?: string;
      status?: string;
    }> = [];

    const wpClient = await this.getWordPressClient(websiteId, siteUrl);

    try {
      const wpPostsRes = await fetch(`${siteUrl}/wp-json/wp/v2/posts?per_page=100&_fields=id,slug,title,link,content,comment_status,status`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Autonomous-Ranking-Disruptor-Scanner/1.0)' },
        signal: AbortSignal.timeout(6000),
      });

      if (wpPostsRes.ok) {
        const rawWp = await wpPostsRes.json();
        if (Array.isArray(rawWp)) {
          livePosts = rawWp.map((p: any) => ({
            id: p.id,
            title: p.title?.rendered || p.slug || '',
            slug: p.slug || '',
            link: p.link || `${siteUrl}/${p.slug}/`,
            content: p.content?.rendered || '',
            comment_status: p.comment_status || 'open',
            status: p.status || 'publish',
          }));
        }
      }
    } catch (_) {
      // Fallback: check database pages
      const { data: dbPages } = await supabase
        .from('pages')
        .select('id, path, title, h1')
        .eq('website_id', websiteId)
        .limit(100);

      if (dbPages && dbPages.length > 0) {
        livePosts = dbPages.map(p => ({
          title: p.title || p.h1 || p.path,
          slug: p.path.replace(/^\/|\/$/g, ''),
          link: `${siteUrl}${p.path.startsWith('/') ? p.path : '/' + p.path}`,
          content: '',
          comment_status: 'unknown',
          status: 'publish',
        }));
      }
    }

    // ── CHECK 1: DUPLICATE SLUG CANNIBALIZATION ──────────────────────────
    const duplicateSlugItems: any[] = [];
    const slugMap = new Map<string, typeof livePosts[0]>();

    for (const p of livePosts) {
      if (!p.slug) continue;
      slugMap.set(p.slug.toLowerCase(), p);
    }

    for (const p of livePosts) {
      if (!p.slug) continue;
      const lower = p.slug.toLowerCase();

      // Check collision pattern: e.g. "cold-email-bounce-rate-2"
      const matchCollision = lower.match(/^(.+?)-([0-9]+)$/);
      if (matchCollision) {
        const rootSlug = matchCollision[1];
        const rootPost = slugMap.get(rootSlug);
        if (rootPost) {
          duplicateSlugItems.push({
            id: p.id,
            url: p.link,
            title: p.title,
            slug: p.slug,
            detail: `Collides with primary authoritative URL: "${rootPost.slug}" (Post ${rootPost.id || ''}). Both URLs are competing for the exact same Google search intent.`,
          });
        }
      }
    }

    if (duplicateSlugItems.length > 0) {
      duplicateSlugsCount = duplicateSlugItems.length;
      issues.push({
        id: 'disruptor-duplicate-cannibalization',
        category: 'duplicate_cannibalization',
        severity: 'critical',
        title: 'Direct Duplicate Slug & Keyword Cannibalization',
        description: `${duplicateSlugItems.length} published URL(s) end in duplicate numeric suffixes (e.g. -2) and directly cannibalize existing authoritative pages on your domain. This splits backlink equity and rank-swaps your URLs in Google.`,
        evidence: duplicateSlugItems.map(i => `${i.slug} (conflicts with ${i.slug.replace(/-[0-9]+$/, '')})`).join(', '),
        affectedCount: duplicateSlugItems.length,
        affectedItems: duplicateSlugItems,
        autoFixable: true,
        fixAction: 'unpublish_duplicate_slugs',
        fixActionLabel: 'Draft Duplicate URLs & Consolidate Authority',
      });
    }

    // ── CHECK 2: MALICIOUS & SPAMBOT COMMENTS ────────────────────────────
    let comments: any[] = [];
    try {
      const commentsRes = await fetch(`${siteUrl}/wp-json/wp/v2/comments?per_page=100`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Autonomous-Ranking-Disruptor-Scanner/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (commentsRes.ok) {
        comments = await commentsRes.json();
      }
    } catch (_) {}

    const spamComments: any[] = [];
    const SPAM_PATTERNS = [
      /[а-яА-ЯёЁ]{4,}/, // Russian / Cyrillic text
      /\b(viagra|cialis|levitra|phentermine|tramadol|darknet|hydra|cannabis|cbd gummies|tor browser|pharmacy online)\b/i,
      /\b(casino|slot machine|online poker|betting site|roulette|vulkan|1xbet|slot88|poker online)\b/i,
      /\b(porn|xxx|escort|nude|sex video|erotic|onlyfans)\b/i,
      /\b(t\.me\/|telegram\.me\/|whatsapp\.com\/|crypto pump|airdrop bonus|buy backlinks)\b/i,
    ];

    if (Array.isArray(comments)) {
      for (const c of comments) {
        const text = `${c.content?.rendered || ''} ${c.author_url || ''} ${c.author_name || ''}`;
        const isSpam = SPAM_PATTERNS.some(re => re.test(text));
        if (isSpam) {
          spamComments.push({
            id: c.id,
            title: `Comment from ${c.author_name || 'Anonymous'}`,
            detail: (c.content?.rendered || '').replace(/<[^>]+>/g, '').slice(0, 120),
            url: c.link || `${siteUrl}/#comment-${c.id}`,
          });
        }
      }
    }

    if (spamComments.length > 0) {
      maliciousCommentsCount = spamComments.length;
      issues.push({
        id: 'disruptor-malicious-comments',
        category: 'malicious_comment_spam',
        severity: 'critical',
        title: 'Toxic Outbound Spambot & Malicious Comments',
        description: `Found ${spamComments.length} malicious spam comments containing Russian text, casino/gambling links, darknet pharmacy links, or automated crypto pumps. Google indexes these outbound links and penalizes domain trust.`,
        evidence: `Detected ${spamComments.length} dirty outbound links in active comments.`,
        affectedCount: spamComments.length,
        affectedItems: spamComments,
        autoFixable: true,
        fixAction: 'purge_malicious_comments',
        fixActionLabel: 'Purge & Permanently Delete Spam Comments',
      });
    }

    // ── CHECK 3: GLOBAL OPEN COMMENTS VULNERABILITY ──────────────────────
    const openCommentsPosts = livePosts.filter(p => p.comment_status === 'open');
    if (openCommentsPosts.length > 0 && (maliciousCommentsCount > 0 || openCommentsPosts.length >= 10)) {
      openCommentsPostsCount = openCommentsPosts.length;
      issues.push({
        id: 'disruptor-open-comments',
        category: 'open_comments_vulnerability',
        severity: 'high',
        title: 'Open Comments Security Vulnerability',
        description: `${openCommentsPosts.length} posts have comments open without bot verification. Automated crawlers continually inject dirty backlinks into your DOM.`,
        evidence: `${openCommentsPosts.length} published posts with comment_status: "open".`,
        affectedCount: openCommentsPosts.length,
        affectedItems: openCommentsPosts.slice(0, 10).map(p => ({
          id: p.id,
          url: p.link,
          title: p.title,
        })),
        autoFixable: true,
        fixAction: 'close_global_comments',
        fixActionLabel: `Close Comments Across All ${openCommentsPosts.length} Posts`,
      });
    }

    // ── CHECK 4: AI FOOTPRINT & LEAKAGE ARTIFACTS ────────────────────────
    const aiArtifactItems: any[] = [];
    const AI_LINK_PATTERN = /https?:\/\/(?:www\.)?(?:claude\.ai\/chat|chatgpt\.com\/c|chat\.openai\.com\/c|perplexity\.ai\/search)[^\s"'>]+/gi;
    const AI_UTM_PATTERN = /\?utm_source=(?:chatgpt\.com|openai|perplexity|claude|chatgpt)[^\s"'>]*/gi;
    const AI_CHATTER_PATTERNS = [
      /(?:^|\n)\s*(?:Sure(?: thing)?|Certainly|Here is an?|Below is an?|Here's an?)\s+(?:comprehensive |in-depth |detailed |article|guide|blog post|breakdown)[\s\S]{0,100}?:/gi,
      /(?:As an AI language model|As an AI,|I hope this helps!|Let me know if you would like me to)/gi,
      /<reflection>[\s\S]*?<\/reflection>/gi,
      /(?:##\s*Table of Contents|\*\*Table of Contents\*\*)/gi,
    ];

    for (const p of livePosts) {
      if (!p.content) continue;
      const issuesFound: string[] = [];

      const privateLinks = p.content.match(AI_LINK_PATTERN);
      if (privateLinks) {
        issuesFound.push(`Contains private AI chat URL(s): ${privateLinks[0]}`);
      }

      const utmMatches = p.content.match(AI_UTM_PATTERN);
      if (utmMatches) {
        issuesFound.push(`Contains ${utmMatches.length} outbound link(s) with "?utm_source=chatgpt.com"`);
      }

      for (const pat of AI_CHATTER_PATTERNS) {
        if (pat.test(p.content)) {
          issuesFound.push('Contains unedited conversational prompt chatter / AI greeting / forbidden TOC');
          break;
        }
      }

      if (issuesFound.length > 0) {
        aiArtifactItems.push({
          id: p.id,
          url: p.link,
          title: p.title,
          slug: p.slug,
          detail: issuesFound.join('; '),
        });
      }
    }

    if (aiArtifactItems.length > 0) {
      aiArtifactsCount = aiArtifactItems.length;
      issues.push({
        id: 'disruptor-ai-artifacts',
        category: 'ai_artifact_leak',
        severity: 'high',
        title: 'AI Footprint & Leakage Artifacts',
        description: `Found ${aiArtifactItems.length} article(s) containing private AI chat links (claude.ai/chat), ?utm_source=chatgpt.com tracking tags, or unedited prompt chatter. Google Helpful Content algorithms flag these as low-quality automated machine dumps.`,
        evidence: aiArtifactItems.map(i => `${i.title}: ${i.detail}`).join(' | '),
        affectedCount: aiArtifactItems.length,
        affectedItems: aiArtifactItems,
        autoFixable: true,
        fixAction: 'clean_ai_artifacts',
        fixActionLabel: 'Scrub AI Links & Clean Machine Footprints',
      });
    }

    // ── SUMMARY & SCORING ────────────────────────────────────────────────
    const totalDisruptors = duplicateSlugsCount + maliciousCommentsCount + openCommentsPostsCount + aiArtifactsCount;
    const healthImpactScore = Math.max(25, 100 - (duplicateSlugsCount * 25) - (maliciousCommentsCount * 5) - (aiArtifactsCount * 15) - (openCommentsPostsCount > 0 ? 10 : 0));

    return {
      websiteId,
      domain,
      siteUrl,
      scannedAt: new Date().toISOString(),
      disruptorCount: issues.length,
      healthImpactScore,
      issues,
      summary: {
        duplicateSlugsCount,
        maliciousCommentsCount,
        openCommentsPostsCount,
        aiArtifactsCount,
        brokenOutboundLinksCount,
        orphanPagesCount,
      },
    };
  }

  /**
   * Executes remediation for a specific disruptor issue
   */
  static async fixIssue(params: {
    websiteId: string;
    issueId: string;
    action: string;
  }): Promise<{ success: boolean; message: string; fixCount: number }> {
    const { websiteId, action } = params;
    const supabase = createAdminClient();

    const { data: website } = await supabase
      .from('websites')
      .select('id, domain, url')
      .eq('id', websiteId)
      .single();

    if (!website) {
      throw new Error('Website not found');
    }

    const siteUrl = (website.url || `https://${website.domain}`).replace(/\/+$/, '');
    const wpClient = await this.getWordPressClient(websiteId, siteUrl);

    // 1. ACTION: Unpublish duplicate slugs (e.g. -2)
    if (action === 'unpublish_duplicate_slugs') {
      const scan = await this.scanWebsite({ websiteId, domain: website.domain, siteUrl });
      const dupIssue = scan.issues.find(i => i.category === 'duplicate_cannibalization');
      if (!dupIssue || dupIssue.affectedItems.length === 0) {
        return { success: true, message: 'No duplicate slugs found to unpublish.', fixCount: 0 };
      }

      let count = 0;
      for (const item of dupIssue.affectedItems) {
        if (wpClient && item.id) {
          try {
            await wpClient.updatePost(Number(item.id), { status: 'draft' });
            count++;
          } catch (e) {
            console.error(`Failed to draft duplicate post ${item.id}:`, e);
          }
        }
      }

      return {
        success: true,
        message: `Successfully set ${count} duplicate post(s) to Draft, eliminating direct keyword cannibalization.`,
        fixCount: count,
      };
    }

    // 2. ACTION: Purge malicious comments
    if (action === 'purge_malicious_comments') {
      const scan = await this.scanWebsite({ websiteId, domain: website.domain, siteUrl });
      const spamIssue = scan.issues.find(i => i.category === 'malicious_comment_spam');
      if (!spamIssue || spamIssue.affectedItems.length === 0) {
        return { success: true, message: 'No spam comments detected.', fixCount: 0 };
      }

      let count = 0;
      if (wpClient) {
        for (const item of spamIssue.affectedItems) {
          if (item.id) {
            const ok = await wpClient.deleteComment(Number(item.id), true);
            if (ok) count++;
          }
        }
      }

      return {
        success: true,
        message: `Permanently deleted ${count} malicious spam comments containing toxic outbound links.`,
        fixCount: count,
      };
    }

    // 3. ACTION: Close global comments
    if (action === 'close_global_comments') {
      let count = 0;
      if (wpClient) {
        const postsRes = await wpClient.getPosts({ per_page: 100, status: 'publish' });
        for (const p of postsRes.data || []) {
          const ok = await wpClient.updatePostCommentStatus(p.id, 'closed');
          if (ok) count++;
        }
      }

      return {
        success: true,
        message: `Set comment_status: "closed" across ${count} published posts to permanently block spambot link injection.`,
        fixCount: count,
      };
    }

    // 4. ACTION: Clean AI artifacts & citation URLs
    if (action === 'clean_ai_artifacts') {
      const scan = await this.scanWebsite({ websiteId, domain: website.domain, siteUrl });
      const aiIssue = scan.issues.find(i => i.category === 'ai_artifact_leak');
      if (!aiIssue || aiIssue.affectedItems.length === 0) {
        return { success: true, message: 'No AI artifacts found to clean.', fixCount: 0 };
      }

      let count = 0;
      if (wpClient) {
        for (const item of aiIssue.affectedItems) {
          if (!item.id) continue;
          try {
            const post = await wpClient.getPost(Number(item.id));
            let body = post.content.raw || post.content.rendered || '';

            // 1. Remove private AI links
            body = body.replace(/https?:\/\/(?:www\.)?(?:claude\.ai\/chat|chatgpt\.com\/c|chat\.openai\.com\/c|perplexity\.ai\/search)[^\s"'>]+/gi, '#');

            // 2. Strip ?utm_source=chatgpt.com params
            body = body.replace(/\?utm_source=(?:chatgpt\.com|openai|perplexity|claude|chatgpt)[^\s"'>]*/gi, '');

            // 3. Remove prompt chatter
            body = body.replace(/(?:^|\n)\s*(?:Sure(?: thing)?|Certainly|Here is an?|Below is an?|Here's an?)\s+(?:comprehensive |in-depth |detailed |article|guide|blog post|breakdown)[\s\S]{0,100}?:/gi, '');
            body = body.replace(/(?:As an AI language model|As an AI,|I hope this helps!|Let me know if you would like me to adjust)/gi, '');
            body = body.replace(/<reflection>[\s\S]*?<\/reflection>/gi, '');
            body = body.replace(/(?:##\s*Table of Contents|\*\*Table of Contents\*\*)/gi, '');

            await wpClient.updatePost(Number(item.id), { content: body });
            count++;
          } catch (e) {
            console.error(`Failed to clean AI artifacts on post ${item.id}:`, e);
          }
        }
      }

      return {
        success: true,
        message: `Cleaned AI artifacts and stripped citation tracking parameters from ${count} article(s).`,
        fixCount: count,
      };
    }

    throw new Error(`Unsupported action: ${action}`);
  }

  /**
   * 1-Click Fix All Ranking Disruptors across all categories
   */
  static async fixAll(websiteId: string): Promise<{
    success: boolean;
    fixes: string[];
  }> {
    const fixes: string[] = [];

    const actions = [
      'unpublish_duplicate_slugs',
      'purge_malicious_comments',
      'close_global_comments',
      'clean_ai_artifacts',
    ];

    for (const action of actions) {
      try {
        const res = await this.fixIssue({ websiteId, issueId: 'all', action });
        if (res.fixCount > 0) {
          fixes.push(res.message);
        }
      } catch (err: any) {
        console.warn(`[RankingDisruptorAgent] Fix ${action} notice:`, err.message);
      }
    }

    return {
      success: true,
      fixes,
    };
  }
}
