const fs = require('fs');
let content = fs.readFileSync('src/lib/agent/contentAgent.ts', 'utf8');

const regex = /\/\/ -- Automatic Image Generation[\s\S]*?return \{/m;

const newLoop = `// -- Automatic Image Generation via ImageRouter (Gemini via Google AI Studio) --
    let featuredImageUrl = '';
    const featuredImageAlt = brief.image_requirements[0]?.alt_text || \`\${brief.working_title} — illustrated overview\`;
    const enrichedImages: ImageRequirement[] = [];

    try {
      console.log(\`[ContentAgent] Automatically generating images for "\${brief.working_title}" via ImageRouter...\`);
      
      for (let i = 0; i < brief.image_requirements.length; i++) {
        const req = brief.image_requirements[i];
        
        try {
          const generatedImage = await ImageRouter.generate({
            topic: brief.working_title,
            target_keyword: input.primary_keyword,
            purpose: req.purpose,
            style: 'Modern high-tech clean editorial illustration',
            dimensions: '1024x1024',
            image_placement: req.placement_context,
            brand_instructions: input.rules.brand_rules,
          });

          if (generatedImage && generatedImage.url) {
            if (i === 0) featuredImageUrl = generatedImage.url;
            
            const imageMarkdown = \`\\n\\n![\${req.alt_text}](\${generatedImage.url})\\n\\n\`;
            
            if (content.match(/\\[IMAGE:[^\\]]+\\]/)) {
                content = content.replace(/\\[IMAGE:[^\\]]+\\]/, imageMarkdown);
            } else if (i === 0) {
                // Place right after the H1 title
                content = content.replace(/^(# .+\\n)/m, \`$1\${imageMarkdown}\`);
            }

            enrichedImages.push({
              ...req,
              image_url: generatedImage.url,
              generation_status: 'generated',
              prompt_used: generatedImage.metadata.prompt_used,
            });
          } else {
             enrichedImages.push(req);
          }
        } catch (imgErr) {
          console.warn(\`[ContentAgent] Image generation failed for \${req.alt_text}\`, imgErr);
          enrichedImages.push(req);
        }
      }

      // Purge any remaining raw image markers from the text so no bracket prompt tags are ever visible
      content = content.replace(/\\n*\\[IMAGE:[^\\]]+\\]\\n*/g, '\\n\\n');
      
      // Purge any fake AI-generated markdown prompts
      content = content.replace(/!\\[.*?prompt.*?\\]\\([^)]*\\)/gi, '');
      content = content.replace(/\\*\\*Image prompt:?\\*\\*.*/gi, '');
      content = content.replace(/Image prompt:.*/gi, '');

    } catch (err: any) {
      console.warn('[ContentAgent] Global image generation failed:', err.message || err);
      content = content.replace(/\\n*\\[IMAGE:[^\\]]+\\]\\n*/g, '\\n\\n');
      content = content.replace(/!\\[.*?prompt.*?\\]\\([^)]*\\)/gi, '');
      content = content.replace(/\\*\\*Image prompt:?\\*\\*.*/gi, '');
      content = content.replace(/Image prompt:.*/gi, '');
      if (enrichedImages.length === 0) {
        enrichedImages.push(...brief.image_requirements);
      }
    }

    return {`;

content = content.replace(regex, newLoop);
fs.writeFileSync('src/lib/agent/contentAgent.ts', content);
