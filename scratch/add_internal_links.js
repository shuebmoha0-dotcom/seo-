const fs = require('fs');
let content = fs.readFileSync('src/app/api/agent/content/draft/route.ts', 'utf8');

const targetStr = `    const output = await agent.runFullPipeline(`;

const injectedCode = `    // Auto-discover internal links if not provided
    if ((!internal_linking_opportunities || internal_linking_opportunities.length === 0) && website_id) {
      try {
        const { data: existingDrafts } = await supabase
          .from('content_drafts')
          .select('url_slug, seo_title, primary_keyword')
          .eq('website_id', website_id)
          .neq('url_slug', null)
          .limit(15);
          
        if (existingDrafts && existingDrafts.length > 0) {
          internal_linking_opportunities = existingDrafts
            // Don't link to itself if by chance we have the same keyword
            .filter((d: any) => d.primary_keyword !== primary_keyword)
            .map((d: any) => \`/\${d.url_slug} (Topic: \${d.seo_title || d.primary_keyword})\`);
          
          console.log(\`[Content Draft] Auto-discovered \${internal_linking_opportunities.length} internal links for context.\`);
        }
      } catch (e) {
        console.warn('Failed to auto-fetch internal links', e);
      }
    }

    const output = await agent.runFullPipeline(`;

content = content.replace(targetStr, injectedCode);
fs.writeFileSync('src/app/api/agent/content/draft/route.ts', content);
