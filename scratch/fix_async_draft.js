const fs = require('fs');
let content = fs.readFileSync('src/app/api/agent/content/draft/route.ts', 'utf8');

if (!content.includes('import { after }')) {
  content = content.replace("import { NextResponse } from 'next/server';", "import { NextResponse } from 'next/server';\nimport { after } from 'next/server';");
}

if (!content.includes('export const maxDuration')) {
  content = content.replace("export const dynamic = 'force-dynamic';", "export const dynamic = 'force-dynamic';\nexport const maxDuration = 300;");
}

const targetExecutionBlockStart = `    const output = await agent.runFullPipeline(`;

const replacementBlock = `    
    // Determine execution mode (sync for guest/demo, async for registered users)
    if (!website_id) {
      // SYNCHRONOUS EXECUTION
      const output = await agent.runFullPipeline(
        {
          primary_keyword,
          secondary_keywords: secondary_keywords || [],
          search_intent,
          content_type: content_type || 'blog_article',
          target_audience: target_audience || defaultRules.audience,
          working_title: working_title || undefined,
          competitor_gaps,
          internal_linking_opportunities: internal_linking_opportunities || [],
          entities: entities || [],
          project_instructions: projectInstructions || undefined,
          project_memory: projectMemory || undefined,
          rules: defaultRules,
        },
        revision_notes
      );

      return NextResponse.json({
        success: true,
        draft: {
          id: crypto.randomUUID(),
          working_title: output.working_title,
          primary_keyword,
          search_intent,
          content_type: content_type || 'blog_article',
          word_count: output.word_count,
          reading_time: output.reading_time_minutes,
          status: output.status,
          version: 1,
          seo_title: output.seo_title,
          meta_description: output.meta_description,
          url_slug: output.url_slug,
          content_body: output.content_body,
          qa: output.qa,
          images: output.images,
        }
      });
    }

    // ASYNCHRONOUS EXECUTION
    const placeholderDraft = {
      website_id,
      primary_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent,
      content_type: content_type || 'blog_article',
      target_audience: target_audience || defaultRules.audience,
      working_title: working_title || \`Generating draft for "\${primary_keyword}"...\`,
      status: 'generating',
      current_version: 0,
    };

    const { data: savedDraft, error: draftErr } = await supabase
      .from('content_drafts')
      .insert(placeholderDraft)
      .select()
      .single();

    if (draftErr || !savedDraft) {
      throw new Error(draftErr?.message || 'Failed to create placeholder draft');
    }

    after(async () => {
      try {
        console.log(\`[Content Draft Async] Starting generation for \${savedDraft.id}\`);
        
        const output = await agent.runFullPipeline(
          {
            primary_keyword,
            secondary_keywords: secondary_keywords || [],
            search_intent,
            content_type: content_type || 'blog_article',
            target_audience: target_audience || defaultRules.audience,
            working_title: working_title || undefined,
            competitor_gaps,
            internal_linking_opportunities: internal_linking_opportunities || [],
            entities: entities || [],
            project_instructions: projectInstructions || undefined,
            project_memory: projectMemory || undefined,
            rules: defaultRules,
          },
          revision_notes
        );

        console.log(\`[Content Draft Async] Finished generation for \${savedDraft.id}, updating DB.\`);

        await supabase
          .from('content_drafts')
          .update({
            working_title: output.working_title,
            h1: output.content_body.match(/^# (.+)$/m)?.[1] || output.working_title,
            content_body: output.content_body,
            word_count: output.word_count,
            reading_time_minutes: output.reading_time_minutes,
            seo_title: output.seo_title,
            meta_description: output.meta_description,
            url_slug: output.url_slug,
            status: output.status,
            current_version: 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', savedDraft.id);

        try {
          await supabase.from('content_versions').insert({
            draft_id: savedDraft.id,
            version_number: 1,
            content_body: output.content_body,
            word_count: output.word_count,
            status: output.status,
            qa_results: output.qa,
          });
        } catch (vErr) { }

        try {
          await supabase.from('content_qa_results').insert({
            draft_id: savedDraft.id,
            version_number: 1,
            ...output.qa,
            facts_flagged: output.qa.facts_flagged,
          });
        } catch (qaErr) { }

        if (Array.isArray(output.images)) {
          for (const img of output.images) {
            try {
              await supabase.from('content_images').insert({
                draft_id: savedDraft.id,
                placement_context: img.placement_context || 'Article body',
                image_type: img.image_type || 'featured',
                purpose: img.purpose || 'Visual enhancement',
                alt_text: img.alt_text || '',
                suggested_filename: img.suggested_filename || 'image.webp',
                status: img.generation_status || 'created',
              });
            } catch (imgInsertErr) { }
          }
        }

        try {
          const memoryFact = \`Published Content: "\${output.working_title || output.seo_title}" covering target keyword "\${output.primary_keyword}" (\${output.search_intent} intent). Tailored for \${output.target_audience || 'target audience'}.\`;
          await supabase.from('project_memory').insert({
            website_id,
            category: 'content',
            content: memoryFact,
            source: 'autonomous_article_learning',
            source_detail: \`Generated from article: "\${output.primary_keyword}"\`,
            confidence: 'high',
            is_important: false,
            tags: ['article_coverage', output.primary_keyword],
          });
        } catch (autoLearnErr) { }

      } catch (saveError: any) {
        console.warn('[Draft Save Async] Error:', saveError);
        await supabase.from('content_drafts').update({ status: 'rejected', revision_notes: 'Generation failed: ' + saveError.message }).eq('id', savedDraft.id);
      }
    });

    return NextResponse.json({
      success: true,
      draft: {
        id: savedDraft.id,
        working_title: savedDraft.working_title,
        primary_keyword: savedDraft.primary_keyword,
        search_intent: savedDraft.search_intent,
        content_type: savedDraft.content_type,
        status: savedDraft.status,
        version: savedDraft.current_version,
      }
    });
`;

// Replace from targetExecutionBlockStart to the end of the file, except the catch block of the main try
const startIndex = content.indexOf(targetExecutionBlockStart);
const endIndex = content.lastIndexOf('} catch (error: any) {');

if (startIndex !== -1 && endIndex !== -1) {
   content = content.substring(0, startIndex) + replacementBlock + content.substring(endIndex);
   fs.writeFileSync('src/app/api/agent/content/draft/route.ts', content);
}
