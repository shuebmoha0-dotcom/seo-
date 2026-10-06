/**
 * Content Quality & Presentation Auditor
 * 
 * Inspects webpage HTML DOM and article content for visual layout,
 * desktop readability, container sizing, and presentation defects.
 * 
 * Flags issues that technical HTTP crawlers miss (e.g. unconstrained 
 * desktop line lengths, bloated Table of Contents, duplicate H1s, and all-caps keyword spam).
 */

export interface PresentationIssue {
  id: string;
  category: 'presentation_layout' | 'typography_readability' | 'spam_formatting';
  severity: 'critical' | 'high' | 'medium' | 'low';
  issue_type: 
    | 'bad_optimized_size_unconstrained_width'
    | 'excessive_table_of_contents'
    | 'all_caps_keyword_stuffing'
    | 'duplicate_h1_in_body'
    | 'malformed_nested_paragraphs'
    | 'gutenberg_invalid_block_syntax'
    | 'malformed_list_syntax';
  title: string;
  description: string;
  evidence: string;
  seo_impact: string;
  business_impact: string;
  recommended_fix: string;
  auto_healable: boolean;
}

export interface PresentationAuditResult {
  url: string;
  passed: boolean;
  score: number; // 0 to 100
  issues: PresentationIssue[];
  metrics: {
    container_type: 'constrained' | 'full_width_unoptimized' | 'narrow' | 'unknown';
    estimated_chars_per_line: number;
    has_table_of_contents: boolean;
    toc_link_count: number;
    all_caps_phrase_count: number;
    body_h1_count: number;
  };
}

export class ContentPresentationAuditor {
  /**
   * Audits raw HTML or rendered body content of a post
   */
  static auditHtml(html: string, url: string = ''): PresentationAuditResult {
    const issues: PresentationIssue[] = [];
    let score = 100;

    // Extract article / main content scope if full page HTML is provided
    let contentScope = html;
    const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
    const entryMatch = html.match(/class=["'][^"']*entry-content[^"']*["'][\s\S]*?(?:<\/article>|<\/main>|<\/div>\s*<\/div>)/i);
    if (articleMatch) {
      contentScope = articleMatch[0];
    } else if (entryMatch) {
      contentScope = entryMatch[0];
    }

    // ── 1. Container Sizing & Readability Width Audit ─────────────────────────────
    // Check if article text is rendered inside a full-width container without max-width constraints
    const isFullWidthContainer = 
      html.includes('ct-container-full') || 
      html.includes('is-layout-constrained-false') ||
      (html.includes('alignfull') && html.includes('entry-content')) ||
      (html.includes('w-full') && !html.includes('max-w-prose') && !html.includes('max-w-3xl') && !html.includes('max-w-4xl'));

    const hasConstrainedProse = 
      html.includes('ct-container-narrow') || 
      html.includes('max-w-prose') || 
      html.includes('max-w-3xl') || 
      html.includes('max-width: 8') || 
      html.includes('max-width:8') || 
      html.includes('max-width: 7') ||
      html.includes('max-width:7') ||
      html.includes('entry-content-optimized') ||
      html.includes('prose-optimized');

    let containerType: 'constrained' | 'full_width_unoptimized' | 'narrow' | 'unknown' = 'constrained';
    let estimatedCharsPerLine = 75; // Standard optimal reading width

    if (isFullWidthContainer && !hasConstrainedProse) {
      containerType = 'full_width_unoptimized';
      estimatedCharsPerLine = 145; // Stretches across wide desktop screen
      score -= 25;
      issues.push({
        id: 'issue-unconstrained-container-width',
        category: 'presentation_layout',
        severity: 'high',
        issue_type: 'bad_optimized_size_unconstrained_width',
        title: 'Bad Optimized Size: Content container spans full desktop width without readable margins',
        description: 'The article layout uses a full-width container (e.g. ct-container-full) without an optimal prose max-width constraint (65–85 characters / ~800px). On desktop monitors, text lines stretch edge-to-edge, causing eye strain and reading fatigue.',
        evidence: 'Detected unconstrained container layout with estimated ~145+ characters per line on standard desktop screens.',
        seo_impact: 'Increases bounce rate and shortens dwell time because long, unconstrained text lines are difficult to scan on desktop displays.',
        business_impact: 'Makes the website look unprofessional and amateurish compared to top tier publications (Medium, Substack, Stripe Press) that strictly bound reading width to 750px–850px.',
        recommended_fix: 'Wrap post content in a constrained reading container (e.g. max-width: 820px; margin: 0 auto) or switch theme template to Narrow/Constrained.',
        auto_healable: true,
      });
    }

    // ── 2. Table of Contents Audit (Rule 3 Compliance) ───────────────────────────
    // Check exclusively within content scope to avoid false positives on site navigation & scripts
    const hasEzToc = contentScope.includes('ez-toc-container') || contentScope.includes('id="ez-toc-container"');
    const hasLwpToc = contentScope.includes('class="lwptoc') || contentScope.includes('id="lwptoc') || contentScope.includes('id="toc_container"') || /class=["'][^"']*\btable-of-contents\b[^"']*["']/i.test(contentScope);
    const tocMatches = contentScope.match(/class=["'][^"']*(?:ez-toc-link|lwptoc-item)[^"']*["']/gi) || [];
    const tocLinkCount = tocMatches.length;

    // Check for large in-article nav jump lists with anchor links (#)
    const inArticleNavMatches = contentScope.match(/<nav[^>]*>[\s\S]*?href=["']#[^"']+[\s\S]*?<\/nav>/gi) || [];
    const hasExcessiveToc = hasEzToc || hasLwpToc || tocLinkCount > 0 || inArticleNavMatches.length > 0;

    if (hasExcessiveToc) {
      score -= 30;
      issues.push({
        id: 'issue-excessive-table-of-contents',
        category: 'presentation_layout',
        severity: 'high',
        issue_type: 'excessive_table_of_contents',
        title: 'Bloated Table of Contents dominating above-the-fold viewport',
        description: `Detected a massive Table of Contents (${tocLinkCount > 0 ? `${tocLinkCount} anchor links` : 'large nested navigation list'}) pushed to the top of the post. This violates Rule 3 (Zero Table of Contents) and pushes the article's core value below the fold.`,
        evidence: `TOC blocks detected (${hasEzToc ? 'Easy Table of Contents (ez-toc)' : hasLwpToc ? 'LuckyWP TOC' : 'Nested Nav Block'}) with ${tocLinkCount || 'many'} links.`,
        seo_impact: 'Pushes main content below the fold on desktop and mobile viewports, violating Google Helpful Content layout guidelines and cannibalizing heading CTR.',
        business_impact: 'Creates visual clutter and intimidates readers with endless bullet points before they read a single sentence of value.',
        recommended_fix: 'Strip the Table of Contents block completely and transition immediately from the H1 / introduction into the first H2 topic.',
        auto_healable: true,
      });
    }

    // ── 3. Shouting All-Caps Keyword Stuffing Audit ──────────────────────────────
    // Detect unnatural repeating uppercase phrases (length >= 14 chars in all caps, e.g. "AI EMAIL TEMPLATE GENERATOR")
    const allCapsMatches = html.match(/\b[A-Z]{3,}(?:\s+[A-Z]{3,}){2,}\b/g) || [];
    // Filter out standard acronyms (e.g. "REST API", "SEO SAAS CRM") by checking length > 15
    const shoutingPhrases = allCapsMatches.filter(p => p.length >= 16);

    if (shoutingPhrases.length >= 2) {
      score -= 20;
      issues.push({
        id: 'issue-all-caps-keyword-stuffing',
        category: 'spam_formatting',
        severity: 'medium',
        issue_type: 'all_caps_keyword_stuffing',
        title: 'All-Caps Keyword Stuffing: Repeating uppercase keyword phrases detected',
        description: `Found ${shoutingPhrases.length} occurrences of shouting ALL-CAPS keyword phrases (e.g. "${shoutingPhrases[0]}"). Writing target keywords in full uppercase reads like aggressive 2008-era search spam.`,
        evidence: `Sample shouting phrases: ${shoutingPhrases.slice(0, 3).map(p => `"${p}"`).join(', ')}`,
        seo_impact: 'May trigger automated Google spam quality demotions and degrades EEAT trust signals.',
        business_impact: 'Readers perceive ALL-CAPS body text as low-quality affiliate or AI-spun spam.',
        recommended_fix: 'Convert all-caps keyword repetitions into natural title casing or lowercase prose.',
        auto_healable: true,
      });
    }

    // ── 4. Duplicate H1 in Body Audit ────────────────────────────────────────────
    const h1Matches = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
    const bodyH1Count = h1Matches.length;

    if (bodyH1Count > 1) {
      score -= 15;
      issues.push({
        id: 'issue-duplicate-h1-in-body',
        category: 'typography_readability',
        severity: 'medium',
        issue_type: 'duplicate_h1_in_body',
        title: `Multiple H1 tags detected (${bodyH1Count} H1s found on page)`,
        description: 'WordPress themes (like Blocksy) already render the post title inside an <h1> tag in the page header. Adding another <h1> at the start of the post content produces stacked duplicate H1s.',
        evidence: `Page contains ${bodyH1Count} H1 elements.`,
        seo_impact: 'Confuses search engine crawlers regarding the primary topical entity of the document.',
        business_impact: 'Renders awkward, repetitive duplicate headings right above the introduction.',
        recommended_fix: 'Remove the duplicate H1 from the post body so only the theme header renders the single canonical H1.',
        auto_healable: true,
      });
    }

    // ── 5. Malformed Nested Paragraphs ───────────────────────────────────────────
    const hasNestedP = /<p[^>]*>\s*<p[^>]*>/i.test(html);
    if (hasNestedP) {
      score -= 10;
      issues.push({
        id: 'issue-malformed-nested-paragraphs',
        category: 'typography_readability',
        severity: 'low',
        issue_type: 'malformed_nested_paragraphs',
        title: 'Malformed HTML: Nested <p><p> tags from bad copy-paste or migration',
        description: 'Found invalid nested paragraph tags (<p><p>) causing erratic vertical margin spacing.',
        evidence: 'Encountered <p class="wp-block-paragraph"><p> sequences in raw DOM.',
        seo_impact: 'Minor HTML validity degradation; invalid DOM trees can break screen readers.',
        business_impact: 'Causes inconsistent vertical spacing between paragraphs.',
        recommended_fix: 'Clean nested paragraph wrappers into clean single <p> elements.',
        auto_healable: true,
      });
    }

    // ── 6. Gutenberg Block Validation & Malformed List Syntax Audit ────────────────
    const hasPWrappedList = /<p[^>]*>\s*<(?:ul|ol|li)/i.test(html) || /<\/(?:ul|ol|li)>\s*<\/p>/i.test(html);
    const hasListWithBr = /<(?:ul|ol)[^>]*>\s*(?:<br\s*\/?>)+/i.test(html) || /(?:<br\s*\/?>)+\s*<\/(?:ul|ol)>/i.test(html);
    const hasStrayListMarkers = /<li[^>]*>\s*(?:&gt;|>)/i.test(html);
    const hasOuterContainerWrapper = /class=["'][^"']*entry-content-optimized[^"']*["']/i.test(html);

    if (hasPWrappedList || hasListWithBr || hasStrayListMarkers || hasOuterContainerWrapper) {
      score -= 25;
      const issuesFound: string[] = [];
      if (hasPWrappedList) issuesFound.push('illegal <p> wrappers enclosing list elements');
      if (hasListWithBr) issuesFound.push('<br> breaks placed directly inside <ul>/<ol>');
      if (hasStrayListMarkers) issuesFound.push('stray markdown blockquote markers (<li>>text) in bullet lists');
      if (hasOuterContainerWrapper) issuesFound.push('outer div wrapper disrupting root Gutenberg block tree');

      issues.push({
        id: 'issue-gutenberg-invalid-block-syntax',
        category: 'presentation_layout',
        severity: 'high',
        issue_type: 'gutenberg_invalid_block_syntax',
        title: 'Gutenberg Block Validation Error: Corrupted list tags and illegal nested paragraph wrappers',
        description: `Encountered critical Gutenberg DOM validation errors: ${issuesFound.join(', ')}. In WordPress wp-admin, this crashes Gutenberg block rendering and throws "This block contains unexpected or invalid content - Attempt recovery".`,
        evidence: `Detected syntax corruption: ${issuesFound.join('; ')}`,
        seo_impact: 'Breaks HTML DOM validation standards, causes unexpected styling glitches, and can cause search engine parser misinterpretations.',
        business_impact: 'Editors cannot modify posts in Gutenberg without encountering recovery warnings, and readers see broken list formatting.',
        recommended_fix: 'Run Gutenberg DOM normalizer to strip nested <p> wrappers, remove illegal <br> tags from lists, strip stray > markers, and serialize pure Gutenberg core block comments.',
        auto_healable: true,
      });
    }

    const finalScore = Math.max(0, Math.min(100, score));

    return {
      url,
      passed: issues.length === 0,
      score: finalScore,
      issues,
      metrics: {
        container_type: containerType,
        estimated_chars_per_line: estimatedCharsPerLine,
        has_table_of_contents: hasExcessiveToc,
        toc_link_count: tocLinkCount,
        all_caps_phrase_count: shoutingPhrases.length,
        body_h1_count: bodyH1Count,
      },
    };
  }

  /**
   * Cleans and repairs unoptimized post HTML into high-readability constrained content
   */
  static autoRepairHtml(rawContent: string): {
    repairedHtml: string;
    fixesApplied: string[];
  } {
    const fixesApplied: string[] = [];
    let content = rawContent;

    // 1. Remove destructive outer container wrapper if present (entry-content-optimized)
    if (/class=["'][^"']*entry-content-optimized[^"']*["']/i.test(content) || content.includes('max-width: 820px')) {
      content = content.replace(/<div class="entry-content-optimized"[^>]*>/gi, '');
      content = content.replace(/<div[^>]*style="[^"]*max-width:\s*820px[^"]*"[^>]*>/gi, '');
      content = content.replace(/<p[^>]*>\s*(?:<br\s*\/?>\s*)*<\/div>\s*<\/p>/gi, '');
      content = content.replace(/<\/div>\s*(?:<\/p>)?\s*$/gi, '');
      content = content.replace(/<\/div>/gi, '');
      fixesApplied.push('Stripped outer div wrapper to restore clean Gutenberg root block hierarchy');
    }

    // 2. Clean body H1s (convert body <h1> to <h2> so theme header is the sole H1)
    if (/<h1[^>]*>[\s\S]*?<\/h1>/i.test(content)) {
      content = content.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_match, inner) => {
        return `<!-- wp:heading {"level":2} -->\n<h2 class="wp-block-heading">${inner}</h2>\n<!-- /wp:heading -->`;
      });
      fixesApplied.push('Converted body <h1> tags to valid Gutenberg <h2> headings');
    }

    // 3. Strip Table of Contents (ez-toc, lwptoc, and top nav lists)
    if (content.includes('ez-toc') || content.includes('<nav') || content.includes('table-of-contents') || content.includes('[no_toc]')) {
      content = content.replace(/<div id="ez-toc-container"[\s\S]*?<\/ul>(?:\s*<\/p>)?(?:\s*<\/div>)*/gi, '');
      content = content.replace(/<div id="ez-toc-container"[\s\S]*?<\/nav>\s*(?:<\/div>)*/gi, '');
      content = content.replace(/<div id="ez-toc-container"[\s\S]*?<\/div>\s*<\/div>/gi, '');
      content = content.replace(/<div id="ez-toc-container"[\s\S]*?<\/div>/gi, '');
      content = content.replace(/<nav[^>]*>[\s\S]*?(?:ez-toc|table-of-contents|ez-toc-list)[\s\S]*?<\/nav>/gi, '');
      content = content.replace(/<ul[^>]*class=["'][^"']*ez-toc-list[^"']*["'][\s\S]*?<\/ul>/gi, '');
      content = content.replace(/<span class="ez-toc-section"[^>]*><\/span>/gi, '');
      content = content.replace(/<span class="ez-toc-section-end"><\/span>/gi, '');
      content = content.replace(/\[no_toc\]/gi, '');
      fixesApplied.push('Removed bloated Table of Contents and anchor markers');
    }

    // 4. Fix shouting all-caps keyword phrases (convert to title case)
    const shoutingPhrases = content.match(/\b[A-Z]{3,}(?:\s+[A-Z]{3,}){2,}\b/g) || [];
    for (const phrase of shoutingPhrases) {
      if (phrase.length >= 16) {
        const titleCased = phrase
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        content = content.replaceAll(phrase, titleCased);
        fixesApplied.push(`Converted shouting "${phrase}" to natural casing "${titleCased}"`);
      }
    }

    // 5. Clean malformed Gutenberg list and paragraph structures
    const hasListIssues = 
      /<p[^>]*>\s*<ul/i.test(content) || 
      /<p[^>]*>\s*<li/i.test(content) || 
      /<li[^>]*>\s*(?:&gt;|>)/i.test(content) ||
      /<(?:ul|ol)[^>]*>\s*<br/i.test(content);

    if (hasListIssues) {
      // Remove any paragraph wrappers directly surrounding <ul> or <ol>
      content = content.replace(/<p[^>]*>\s*(<!-- wp:list[^>]*-->)?\s*<ul/gi, '$1\n<ul');
      content = content.replace(/<\/ul>\s*(<!-- \/wp:list -->)?\s*<\/p>/gi, '</ul>\n$1');
      content = content.replace(/<p[^>]*>\s*(<!-- wp:list[^>]*-->)?\s*<ol/gi, '$1\n<ol');
      content = content.replace(/<\/ol>\s*(<!-- \/wp:list -->)?\s*<\/p>/gi, '</ol>\n$1');

      // Strip paragraph tags around <li>
      content = content.replace(/<p[^>]*>\s*<li/gi, '<li');
      content = content.replace(/<\/li>\s*<\/p>/gi, '</li>');
      content = content.replace(/<li[^>]*>\s*<p[^>]*>/gi, '<li>');
      content = content.replace(/<\/p>\s*<\/li>/gi, '</li>');

      // Strip stray blockquote markers inside <li>: <li>> or <li>&gt;
      content = content.replace(/<li([^>]*)>\s*(?:&gt;|>)\s*/gi, '<li$1>');

      // Clean the inner content of <ul> and <ol> so it strictly contains clean <li> elements
      content = content.replace(/(<ul[^>]*>)([\s\S]*?)(<\/ul>)/gi, (_match, open, inner, close) => {
        let cleanInner = inner;
        cleanInner = cleanInner.replace(/<\/?p[^>]*>/gi, '');
        cleanInner = cleanInner.replace(/<br\s*\/?>/gi, '');
        cleanInner = cleanInner.replace(/\s*<\/li>\s*<li/gi, '</li>\n<li');
        cleanInner = cleanInner.trim();
        return `${open}\n${cleanInner}\n${close}`;
      });

      content = content.replace(/(<ol[^>]*>)([\s\S]*?)(<\/ol>)/gi, (_match, open, inner, close) => {
        let cleanInner = inner;
        cleanInner = cleanInner.replace(/<\/?p[^>]*>/gi, '');
        cleanInner = cleanInner.replace(/<br\s*\/?>/gi, '');
        cleanInner = cleanInner.replace(/\s*<\/li>\s*<li/gi, '</li>\n<li');
        cleanInner = cleanInner.trim();
        return `${open}\n${cleanInner}\n${close}`;
      });

      // Wrap raw lists with Gutenberg comments if not already wrapped
      content = content.replace(/(?<!<!-- wp:list -->\s*)<ul\s+class="wp-block-list">([\s\S]*?)<\/ul>(?!\s*<!-- \/wp:list -->)/gi, '<!-- wp:list -->\n<ul class="wp-block-list">$1</ul>\n<!-- /wp:list -->');
      content = content.replace(/(?<!<!-- wp:list {"ordered":true} -->\s*)<ol\s+class="wp-block-list">([\s\S]*?)<\/ol>(?!\s*<!-- \/wp:list -->)/gi, '<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">$1</ol>\n<!-- /wp:list -->');

      fixesApplied.push('Cleaned corrupted Gutenberg list elements and stripped stray > markers');
    }

    // 6. Clean nested <p><p> and empty paragraphs
    if (/<p[^>]*>\s*<p[^>]*>/i.test(content)) {
      content = content.replace(/<p[^>]*>\s*<p[^>]*>/gi, '<p class="wp-block-paragraph">');
      content = content.replace(/<\/p>\s*<\/p>/gi, '</p>');
      fixesApplied.push('Cleaned invalid nested <p><p> paragraph tags');
    }
    content = content.replace(/<p[^>]*>\s*(?:<br\s*\/?>\s*)*<\/p>/gi, '');

    return {
      repairedHtml: content.trim(),
      fixesApplied,
    };
  }
}
