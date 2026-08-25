/**
 * Utility to convert Markdown content into clean, semantic HTML and Gutenberg WordPress blocks.
 */
export function markdownToWordPressHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown.trim();

  // 1. Remove duplicate leading H1 if it repeats the article title
  // (WordPress already renders the post_title as the primary H1)
  html = html.replace(/^#\s+[^\n]+\n+/, '');

  // 2. Convert Markdown Images: ![alt](url_or_base64)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
    const cleanAlt = alt || 'Illustration';
    return `\n\n<!-- wp:image {"sizeSlug":"large"} -->\n<figure class="wp-block-image size-large"><img src="${src}" alt="${cleanAlt}"/></figure>\n<!-- /wp:image -->\n\n`;
  });

  // 3. Convert Headings: ### H3, ## H2, # H1
  html = html.replace(/^###\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">$1</h3>\n<!-- /wp:heading -->\n\n');
  html = html.replace(/^##\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":2} -->\n<h2 class="wp-block-heading">$1</h2>\n<!-- /wp:heading -->\n\n');
  html = html.replace(/^#\s+(.+)$/gm, '\n\n<!-- wp:heading {"level":1} -->\n<h1 class="wp-block-heading">$1</h1>\n<!-- /wp:heading -->\n\n');

  // 4. Convert Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Convert Blockquotes: > quote
  html = html.replace(/^>\s+(.+)$/gm, '\n\n<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>$1</p></blockquote>\n<!-- /wp:quote -->\n\n');

  // 6. Convert Lists: Unordered (- or *)
  // Match contiguous list items
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

  // 7. Convert Lists: Ordered (1. 2. 3.)
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

  // 8. Convert Paragraphs
  // Split by double newlines and wrap non-block elements in <p> tags
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
