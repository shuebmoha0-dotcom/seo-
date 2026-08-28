/**
 * Utility to clean metadata prefix tags from SEO titles and descriptions.
 */
export function cleanMetaString(text?: string): string {
  if (!text) return '';
  return text
    .replace(/^(?:\*\*|\*)?Meta\s+(?:title|description|keywords|intent|slug)(?:\*\*|\*)?\s*:\s*/i, '')
    .replace(/^(?:\*\*|\*)?SEO\s+(?:title|description)(?:\*\*|\*)?\s*:\s*/i, '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

/**
 * Utility to convert Markdown content into clean, semantic HTML and Gutenberg WordPress blocks.
 * Automatically cleans and removes metadata prefixes, duplicate H1s, and raw image prompts.
 */
export function markdownToWordPressHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown.trim();

  // 1. Remove duplicate leading H1 (# Title) because WordPress renders post_title as primary H1
  html = html.replace(/^#\s+[^\n]+\n*/i, '');

  // 2. Remove all meta lines that the AI model may have placed at the top or bottom of the article
  html = html.replace(/^(?:\*\*|\*)?Meta\s+(?:title|description|keywords|intent|slug)(?:\*\*|\*)?\s*:.*$/gmi, '');
  html = html.replace(/^(?:\*\*|\*)?SEO\s+(?:title|description)(?:\*\*|\*)?\s*:.*$/gmi, '');
  html = html.replace(/^(?:\*\*|\*)?Target\s+(?:keyword|audience)(?:\*\*|\*)?\s*:.*$/gmi, '');
  html = html.replace(/^(?:\*\*|\*)?Primary\s+(?:keyword)(?:\*\*|\*)?\s*:.*$/gmi, '');
  html = html.replace(/^(?:\*\*|\*)?Secondary\s+(?:keywords)(?:\*\*|\*)?\s*:.*$/gmi, '');
  html = html.replace(/\[IMAGE:\s*[^\]]+\]/gi, '');

  // Clean empty lines at start
  html = html.replace(/^\s+/, '');

  // 3. Convert Markdown Images safely by protecting URLs with placeholders
  const imagePlaceholders: string[] = [];
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const cleanAlt = (alt || 'Illustration').replace(/"/g, '&quot;').trim();
    const cleanSrc = src.trim();
    const placeholder = `__PROTECTED_IMAGE_BLOCK_${imagePlaceholders.length}__`;
    const imageTag = `\n\n<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->\n<figure class="wp-block-image size-large"><img src="${cleanSrc}" alt="${cleanAlt}" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;display:block;margin:1.5rem auto;" /><figcaption class="wp-element-caption">${cleanAlt}</figcaption></figure>\n<!-- /wp:image -->\n\n`;
    imagePlaceholders.push(imageTag);
    return placeholder;
  });

  // 4. Convert Headings: ### H3, ## H2, # H1
  html = html.replace(/^###\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">$1</h3>\n<!-- /wp:heading -->\n\n');
  html = html.replace(/^##\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":2} -->\n<h2 class="wp-block-heading">$1</h2>\n<!-- /wp:heading -->\n\n');
  html = html.replace(/^#\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":1} -->\n<h1 class="wp-block-heading">$1</h1>\n<!-- /wp:heading -->\n\n');

  // 5. Convert Bold & Italic (safe regex that never mangles URLs)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)__([^_]+)__(?!\w)/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

  // Restore protected images with intact URLs
  imagePlaceholders.forEach((imgTag, idx) => {
    html = html.replace(`__PROTECTED_IMAGE_BLOCK_${idx}__`, imgTag);
  });

  // 6. Convert Links: [anchor text](url) (excluding images which are already protected)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    return `<a href="${url.trim()}">${text.trim()}</a>`;
  });

  // 7. Convert Blockquotes: > quote
  html = html.replace(/^>\s+(.+)$/gm, '\n\n<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>$1</p></blockquote>\n<!-- /wp:quote -->\n\n');

  // 7. Convert Lists: Unordered (- or *)
  html = html.replace(/((?:^(?:-|\*)\s+.+\n?)+)/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map(line => line.replace(/^(?:-|\*)\s+/, '').trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join('\n');
    return `\n\n<!-- wp:list -->\n<ul class="wp-block-list">\n${items}\n</ul>\n<!-- /wp:list -->\n\n`;
  });

  // 8. Convert Lists: Ordered (1. 2. 3.)
  html = html.replace(/((?:^\d+\.\s+.+\n?)+)/gm, (match) => {
    const items = match
      .trim()
      .split('\n')
      .map(line => line.replace(/^\d+\.\s+/, '').trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join('\n');
    return `\n\n<!-- wp:list {"ordered":true} -->\n<ol class="wp-block-list">\n${items}\n</ol>\n<!-- /wp:list -->\n\n`;
  });

  // 9. Convert Paragraphs
  const blocks = html.split(/\n\s*\n/);
  const formattedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<!-- wp:') || trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<figure') || trimmed.startsWith('<table')) {
      return trimmed;
    }
    return `<!-- wp:paragraph -->\n<p>${trimmed.replace(/\n/g, '<br/>')}</p>\n<!-- /wp:paragraph -->`;
  });

  return formattedBlocks.filter(Boolean).join('\n\n');
}
