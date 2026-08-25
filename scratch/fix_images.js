const fs = require('fs');
let content = fs.readFileSync('src/lib/agent/contentAgent.ts', 'utf8');

// 1. Fix the prompt in writeDraft
content = content.replace(
    "- Place image markers exactly where specified: [IMAGE: ...]",
    "- Place image markers exactly where specified: [IMAGE: ...]\n- DO NOT write fake markdown image tags or type \"Image prompt:\". ONLY use the exact bracket syntax [IMAGE: ...] provided."
);

// 2. Rewrite the image generation loop
const oldImageLoop = `    // -- Automatic Image Generation via ImageRouter (Gemini via Google AI Studio) --
    let featuredImageUrl = '';
    const featuredImageAlt = brief.image_requirements[0]?.alt_text || \`\${brief.working_title} — illustrated overview\`;
    const enrichedImages: ImageRequirement[] = [];

    try {
      console.log(\`[ContentAgent] Automatically generating featured image for "\${brief.working_title}" via ImageRouter...\`);
      const generatedImage = await ImageRouter.generate({
        topic: brief.working_title,
        target_keyword: input.primary_keyword,
        purpose: brief.image_requirements[0]?.purpose || 'Featured blog post illustration',
        style: 'Modern high-tech clean editorial illustration',
        dimensions: '1024x1024',
        image_placement: 'Header featured image',
        brand_instructions: input.rules.brand_rules,
      });

      featuredImageUrl = generatedImage.url;

      if (featuredImageUrl) {
        const imageMarkdown = \`\\n\\n![\${featuredImageAlt}](\${featuredImageUrl})\\n*\${featuredImageAlt}*\\n\\n\`;

        if (content.includes('[IMAGE: featured') || content.includes('[IMAGE:')) {
          content = content.replace(/\\[IMAGE:[^\\]]+\\]/, imageMarkdown);
        } else {
          // Place right after the H1 title
          content = content.replace(/^(# .+\\n)/m, \`$1\${imageMarkdown}\`);
        }
      }

      // Purge any remaining raw image markers from the text so no bracket prompt tags are ever visible
      content = content.replace(/\\n*\\[IMAGE:[^\\]]+\\]\\n*/g, '\\n\\n');

      for (let i = 0; i < brief.image_requirements.length; i++) {
        const req = brief.image_requirements[i];
        if (i === 0 && featuredImageUrl) {
          enrichedImages.push({
            ...req,
            image_url: featuredImageUrl,
            generation_status: 'generated',
            prompt_used: generatedImage.metadata.prompt_used,
          });
        } else {
          enrichedImages.push(req);
        }
      }
    } catch (imgErr: any) {
      console.warn('[ContentAgent] Automatic image generation failed gracefully:', imgErr.message || imgErr);
      // Clean up bracket markers even on error so article text stays clean
      content = content.replace(/\\n*\\[IMAGE:[^\\]]+\\]\\n*/g, '\\n\\n');
      enrichedImages.push(...brief.image_requirements);
    }`;

const newImageLoop = `    // -- Automatic Image Generation via ImageRouter (Gemini via Google AI Studio) --
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
            
            const imageMarkdown = \`\\n\\n![\${req.alt_text}](\${generatedImage.url})\\n*\${req.alt_text}*\\n\\n\`;
            
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
    }`;

content = content.replace(oldImageLoop, newImageLoop);
fs.writeFileSync('src/lib/agent/contentAgent.ts', content);
