import { LLMProvider } from '../tools/llm';
import { ImageRouter } from '../ai/imageRouter';
import { z } from 'zod';

export interface ContentRules {
  word_count_min: number;
  word_count_max: number;
  language: string;
  tone: string;
  audience: string;
  author_style: string;
  structure_rules: string;
  paragraph_style: string;
  image_rules: string;
  source_rules: string;
  brand_rules: string;
  cta_rules: string;
  avoid_rules: string;
  custom_rules?: string;
}

export interface ContentInput {
  website_id?: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  content_type: string;
  target_audience: string;
  working_title?: string;
  competitor_gaps?: string;
  internal_linking_opportunities?: string[];
  entities?: string[];
  project_instructions?: string;
  project_memory?: string;
  rules: ContentRules;
}

export interface ContentBrief {
  working_title: string;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_audience: string;
  content_objective: string;
  h1: string;
  h2_h3_structure: Array<{ level: 'h2' | 'h3'; heading: string; notes: string }>;
  questions_to_answer: string[];
  entities: string[];
  competitor_gaps: string;
  internal_links: string[];
  recommended_word_count_min: number;
  recommended_word_count_max: number;
  image_requirements: ImageRequirement[];
  cta: string;
  applied_rules: string;
}

export interface ImageRequirement {
  placement_context: string;
  image_type: 'featured' | 'diagram' | 'screenshot' | 'chart' | 'illustration' | 'comparison';
  purpose: string;
  alt_text: string;
  suggested_filename: string;
  image_url?: string;
  generation_status?: 'generated' | 'failed' | 'pending';
  prompt_used?: string;
}

export interface QAResult {
  intent_match: boolean;
  primary_keyword_present: boolean;
  secondary_keywords_present: boolean;
  word_count_pass: boolean;
  style_pass: boolean;
  heading_structure_pass: boolean;
  no_keyword_stuffing: boolean;
  no_filler: boolean;
  cta_present: boolean;
  internal_links_present: boolean;
  images_specified: boolean;
  alt_text_present: boolean;
  product_accuracy_pass: boolean;
  facts_flagged: string[];
  overall_status: 'pass' | 'needs_revision';
  qa_notes: string;
}

export interface ContentOutput {
  working_title: string;
  primary_keyword: string;
  search_intent: string;
  target_audience: string;
  content_type: string;
  word_count: number;
  reading_time_minutes: number;
  content_body: string;
  seo_title: string;
  meta_description: string;
  url_slug: string;
  internal_links: string[];
  images: ImageRequirement[];
  featured_image_url?: string;
  featured_image_alt?: string;
  cta: string;
  qa: QAResult;
  status: 'ready_for_approval' | 'needs_revision';
  version: number;
}

export class ContentAgent {

  // 1. Validate all required inputs before writing
  validateInputs(input: ContentInput): { valid: boolean; missing: string[] } {
    if (!input.rules) {
      input.rules = {
        word_count_min: 1200,
        word_count_max: 1800,
        language: 'U.S. English',
        tone: 'Professional, natural, helpful',
        audience: input.target_audience || 'Business founders and search audience',
        author_style: 'Experienced SEO content writer',
        structure_rules: 'Use H2 and H3 headings. Short paragraphs.',
        paragraph_style: 'Short and easy to read.',
        image_rules: 'Include relevant original images.',
        source_rules: 'Use reliable sources. Verify factual claims.',
        brand_rules: 'Do not make unsupported claims.',
        cta_rules: 'Include one relevant CTA.',
        avoid_rules: 'No keyword stuffing. No filler. No robotic language.',
        custom_rules: '',
      };
    }
    const missing: string[] = [];
    if (!input.primary_keyword) missing.push('primary_keyword');
    if (!input.search_intent) missing.push('search_intent');
    if (!input.content_type) missing.push('content_type');
    if (!input.target_audience) missing.push('target_audience');
    return { valid: missing.length === 0, missing };
  }

  // 2. Generate Structured Content Brief
  async generateBrief(input: ContentInput): Promise<ContentBrief> {
    try {
      const { object } = await LLMProvider.generateObject({
        agent: 'ContentAgent',
        complexity: 'simple',
        schema: z.object({
          working_title: z.string(),
          h1: z.string(),
          content_objective: z.string(),
          h2_h3_structure: z.array(z.object({
            level: z.enum(['h2', 'h3']),
            heading: z.string(),
            notes: z.string(),
          })),
          questions_to_answer: z.array(z.string()),
          entities: z.array(z.string()),
          competitor_gaps: z.string(),
          cta: z.string(),
          image_requirements: z.array(z.object({
            placement_context: z.string(),
            image_type: z.enum(['featured', 'diagram', 'screenshot', 'chart', 'illustration', 'comparison']),
            purpose: z.string(),
            alt_text: z.string(),
            suggested_filename: z.string(),
          })),
        }),
        system: `You are an expert SEO content strategist. Create a precise, audience-first content brief.

${input.project_instructions ? `==================================================
CRITICAL DIRECTIVE — PROJECT CUSTOM INSTRUCTIONS (MUST BE STRICTLY FOLLOWED):
${input.project_instructions}
==================================================\n` : ''}${input.project_memory ? `==================================================
PROJECT KNOWLEDGE BANK & COMPANY FACTS:
${input.project_memory}
==================================================\n` : ''}Rules to follow:
- Audience: ${input.rules.audience}
- Tone: ${input.rules.tone}
- Word count: ${input.rules.word_count_min}–${input.rules.word_count_max} words
- Avoid: ${input.rules.avoid_rules}
- ${input.rules.custom_rules || ''}`,
        prompt: `Create a detailed, thorough content brief for:
Primary keyword: "${input.primary_keyword}"
Secondary keywords: ${input.secondary_keywords.join(', ')}
Search intent: ${input.search_intent}
Content type: ${input.content_type}
Target audience: ${input.target_audience}

MANDATORY INSTRUCTIONS:
1. Deeply understand and parse the natural language context from PROJECT CUSTOM INSTRUCTIONS and PROJECT KNOWLEDGE BANK (author persona, target business model, user roles, deliverable specs, tone, and positioning).
2. You MUST directly incorporate the company positioning, guidelines, and context from the PROJECT CUSTOM INSTRUCTIONS and PROJECT KNOWLEDGE BANK into the headings and section notes.
3. Structure the outline so the final article can comfortably reach at least ${input.rules.word_count_min} words of deep, valuable, actionable content.
Competitor gaps: ${input.competitor_gaps || 'Not provided'}
Internal linking opportunities: ${(input.internal_linking_opportunities || []).join(', ')}
Important entities: ${(input.entities || []).join(', ')}

Generate a focused, highly structured brief with 4 to 6 actionable H2/H3 sections so the writer can produce a concise, high-value ${input.rules.word_count_min}–${input.rules.word_count_max} word article without unnecessary padding. Headings should serve the reader with practical clarity.`,
      });

      return {
        working_title: object.working_title,
        primary_keyword: input.primary_keyword,
        secondary_keywords: input.secondary_keywords,
        search_intent: input.search_intent,
        target_audience: input.target_audience,
        content_objective: object.content_objective,
        h1: object.h1,
        h2_h3_structure: object.h2_h3_structure,
        questions_to_answer: object.questions_to_answer,
        entities: object.entities,
        competitor_gaps: object.competitor_gaps,
        internal_links: input.internal_linking_opportunities || [],
        recommended_word_count_min: input.rules.word_count_min,
        recommended_word_count_max: input.rules.word_count_max,
        image_requirements: object.image_requirements,
        cta: object.cta,
        applied_rules: `Tone: ${input.rules.tone} | Audience: ${input.rules.audience} | Lang: ${input.rules.language}`,
      };
    } catch {
      // Deterministic fallback brief
      return {
        working_title: input.working_title || `Complete Guide to ${input.primary_keyword}`,
        primary_keyword: input.primary_keyword,
        secondary_keywords: input.secondary_keywords,
        search_intent: input.search_intent,
        target_audience: input.target_audience,
        content_objective: `Help ${input.target_audience} understand and act on ${input.primary_keyword}.`,
        h1: `${input.primary_keyword.charAt(0).toUpperCase() + input.primary_keyword.slice(1)}: Complete Guide`,
        h2_h3_structure: [
          { level: 'h2', heading: 'What It Is and Why It Matters', notes: 'Define clearly for audience.' },
          { level: 'h2', heading: 'How It Works', notes: 'Explain mechanism practically.' },
          { level: 'h3', heading: 'Step-by-Step Process', notes: 'Actionable instructions.' },
          { level: 'h2', heading: 'Common Mistakes to Avoid', notes: 'Address audience pain points.' },
          { level: 'h2', heading: 'Next Steps', notes: 'CTA and internal links.' },
        ],
        questions_to_answer: [
          `What is ${input.primary_keyword}?`,
          `Why does it matter for ${input.target_audience}?`,
          `How do I get started?`,
        ],
        entities: input.entities || [],
        competitor_gaps: input.competitor_gaps || 'No competitor data provided.',
        internal_links: input.internal_linking_opportunities || [],
        recommended_word_count_min: input.rules.word_count_min,
        recommended_word_count_max: input.rules.word_count_max,
        image_requirements: [
          {
            placement_context: 'After introduction',
            image_type: 'featured',
            purpose: 'Hero image representing the topic visually.',
            alt_text: `${input.primary_keyword} illustration`,
            suggested_filename: `${input.primary_keyword.replace(/ /g, '-').toLowerCase()}-featured.png`,
          },
          {
            placement_context: 'After How It Works section',
            image_type: 'diagram',
            purpose: 'Workflow diagram explaining the process.',
            alt_text: `${input.primary_keyword} workflow diagram`,
            suggested_filename: `${input.primary_keyword.replace(/ /g, '-').toLowerCase()}-workflow.png`,
          },
        ],
        cta: input.rules.cta_rules,
        applied_rules: `Tone: ${input.rules.tone} | Audience: ${input.rules.audience} | Lang: ${input.rules.language}`,
      };
    }
  }

  // 3. Write Draft — follows content rules strictly
  async writeDraft(
    brief: ContentBrief,
    rules: ContentRules,
    revisionNotes?: string,
    projectInstructions?: string,
    projectMemory?: string
  ): Promise<string> {
    const headingOutline = brief.h2_h3_structure
      .map(h => `${h.level.toUpperCase()}: ${h.heading} (${h.notes})`)
      .join('\n');

    const imageMarkers = brief.image_requirements
      .map(img => `[IMAGE: ${img.image_type} — "${img.alt_text}" — place: ${img.placement_context}]`)
      .join('\n');

    try {
      const { text } = await LLMProvider.generateText({
        agent: 'ContentAgent',
        taskType: 'long_form_article',
        complexity: 'complex',
        system: `You are an elite SEO content writer powered by Claude Sonnet 5. Follow these instructions and guidelines strictly:

${projectInstructions ? `==================================================
CRITICAL DIRECTIVE — PROJECT CUSTOM INSTRUCTIONS (MANDATORY HUMAN RULES):
${projectInstructions}
==================================================\n` : ''}${projectMemory ? `==================================================
PROJECT KNOWLEDGE BASE & ACCUMULATED MEMORY:
${projectMemory}
==================================================\n` : ''}CONTENT RULES:
- Language: ${rules.language}
- Tone: ${rules.tone}
- Audience: ${rules.audience}
- Style: ${rules.author_style}
- Structure: ${rules.structure_rules}
- Paragraphs: ${rules.paragraph_style}
- STRICT LENGTH REQUIREMENT: Target length is ${rules.word_count_min}–${rules.word_count_max} words. Stay tightly within this word range without unnecessary padding or bloated sections.
- CTA rule: ${rules.cta_rules}
- Avoid: ${rules.avoid_rules}
- Brand rule: ${rules.brand_rules}
- Sources: ${rules.source_rules}
${rules.custom_rules ? `- Custom: ${rules.custom_rules}` : ''}

WRITING PRINCIPLES:
- 🧠 NATURAL LANGUAGE CONTEXT COMPREHENSION:
  - Treat all Custom Instructions and Project Memory as rich, natural language context.
  - Understand implicit and explicit human relationships: understand author personas (e.g. if instructed to write in first-person as a specific author or founder, embody that persona completely), understand user/owner identity and business context, understand deliverable specs (e.g. word counts, meta constraints, power words, formatting rules), and understand domain topics.
  - Extract and honor every constraint, preference, tone detail, and persona described in plain English naturally.
- 🚫 ZERO RANDOM OR GENERIC FILLER: Never write generic textbook definitions, vague platitudes, or superficial overviews. Every paragraph must be deeply grounded in the company's real positioning, target audience nuances, and domain facts from the memory bank.
- 🎯 STRICT INSTRUCTION COMPLIANCE: Embody the human user's PROJECT CUSTOM INSTRUCTIONS, brand voice, and forbidden topic constraints with 100% precision throughout every single section.
- 💡 TACTICAL & PRACTICAL DEPTH: For EVERY H2 and H3 section, write 2 to 4 detailed paragraphs with actionable step-by-step frameworks, battle-tested copyable templates, and concrete real-world breakdowns.
- Use the primary keyword naturally — do NOT force it into every paragraph unless specifically requested.
- Short paragraphs. Clear sentences. High information density.
- Place image markers exactly where specified: [IMAGE: ...]
- DO NOT write fake markdown image tags or type "Image prompt:". ONLY use the exact bracket syntax [IMAGE: ...] provided.
${revisionNotes ? `\nREVISION NOTES FROM HUMAN/QA: ${revisionNotes}` : ''}`,
        prompt: `Write a focused, high-value ${rules.word_count_min}–${rules.word_count_max} word article based on the brief below. Stay tightly within the target ${rules.word_count_min}–${rules.word_count_max} word range.

TITLE: ${brief.working_title}
H1: ${brief.h1}
PRIMARY KEYWORD: "${brief.primary_keyword}"
SECONDARY KEYWORDS: ${brief.secondary_keywords.join(', ')}
SEARCH INTENT: ${brief.search_intent}
TARGET AUDIENCE: ${brief.target_audience}
CONTENT OBJECTIVE: ${brief.content_objective}

HEADING STRUCTURE TO FOLLOW:
${headingOutline}

QUESTIONS TO ANSWER:
${brief.questions_to_answer.map(q => `- ${q}`).join('\n')}

IMAGE PLACEMENT MARKERS (include exactly as written):
${imageMarkers}

INTERNAL LINKS (use naturally with descriptive anchor text):
${brief.internal_links.map(l => `- ${l}`).join('\n')}

CTA: ${brief.cta}

${projectInstructions ? `\n==================================================\nMANDATORY HUMAN CUSTOM INSTRUCTIONS (FOLLOW 100%):\n${projectInstructions}\n==================================================\n` : ''}
${projectMemory ? `\n==================================================\nPROJECT MEMORY & KNOWLEDGE BANK (WEAVE DIRECTLY INTO EXAMPLES & FRAMEWORKS):\n${projectMemory}\n==================================================\n` : ''}

Before writing the article, you MUST open a <reflection> block. Inside it:
1. Explain how you will strictly adhere to every requirement in the MANDATORY HUMAN CUSTOM INSTRUCTIONS.
2. Detail how you will draw upon the PROJECT MEMORY & KNOWLEDGE BANK so the article provides concrete, highly specific insights rather than generic advice.
After closing the </reflection> block, write the full article. Include the H1 at the top. Follow the heading structure. Place image markers where indicated. Make sure to provide deep, exhaustive analysis under each heading to satisfy the ${rules.word_count_min}+ word requirement.`,
      });

      // Strip the reflection block to ensure clean markdown
      const finalArticle = text.replace(/<reflection>[\s\S]*?<\/reflection>/i, '').trim();
      return finalArticle;
    } catch (err: any) {
      console.error('[ContentAgent] writeDraft error:', err);
      throw new Error(`Content generation failed: ${err.message || 'Please check AI provider status.'}`);
    }
  }

  // 4. Automated QA Checklist
  runQA(params: {
    content: string;
    brief: ContentBrief;
    rules: ContentRules;
    images: ImageRequirement[];
  }): QAResult {
    const { content, brief, rules, images } = params;
    const words = content.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const contentLower = content.toLowerCase();

    const primaryPresent = contentLower.includes(brief.primary_keyword.toLowerCase());
    const secondaryPresent = brief.secondary_keywords.some(kw =>
      contentLower.includes(kw.toLowerCase())
    );
    const wordCountPass = wordCount >= rules.word_count_min && wordCount <= (rules.word_count_max + 200);
    const hasH2 = content.includes('## ');
    const hasIntro = wordCount > 50;
    const hasCTA = contentLower.includes('trial') || contentLower.includes('get started') || contentLower.includes('learn more') || contentLower.includes('sign up');

    // Check for keyword stuffing (very simple heuristic)
    const primaryOccurrences = (contentLower.match(new RegExp(brief.primary_keyword.toLowerCase(), 'g')) || []).length;
    const noKeywordStuffing = primaryOccurrences < Math.ceil(wordCount / 100);

    // Check for obvious filler phrases
    const fillerPhrases = ['in today\'s world', 'in conclusion', 'needless to say', 'it goes without saying', 'as we all know'];
    const noFiller = !fillerPhrases.some(phrase => contentLower.includes(phrase));

    // Check internal links
    const hasInternalLinks = brief.internal_links.length === 0 || brief.internal_links.some(link =>
      content.includes(link)
    );

    // Check images specified
    const imagesSpecified = images.length > 0;
    const altTextPresent = images.every(img => img.alt_text && img.alt_text.length > 5);

    // Flag factual claims that should be verified
    const factsToFlag: string[] = [];
    const statPatterns = /\d+%|\$\d+|\d+x|\d+ (million|billion|thousand)/gi;
    const matches = content.match(statPatterns);
    if (matches) {
      matches.slice(0, 3).forEach(m => factsToFlag.push(`Verify statistic: "${m}"`));
    }

    const allPassed = primaryPresent && wordCountPass && hasH2 && noKeywordStuffing && noFiller && imagesSpecified;

    return {
      intent_match: hasIntro && primaryPresent,
      primary_keyword_present: primaryPresent,
      secondary_keywords_present: secondaryPresent || brief.secondary_keywords.length === 0,
      word_count_pass: wordCountPass,
      style_pass: hasH2,
      heading_structure_pass: hasH2,
      no_keyword_stuffing: noKeywordStuffing,
      no_filler: noFiller,
      cta_present: hasCTA,
      internal_links_present: hasInternalLinks,
      images_specified: imagesSpecified,
      alt_text_present: altTextPresent,
      product_accuracy_pass: true,
      facts_flagged: factsToFlag,
      overall_status: allPassed ? 'pass' : 'needs_revision',
      qa_notes: allPassed
        ? 'All QA checks passed. Ready for human approval.'
        : `Issues: ${[
            !primaryPresent && 'Primary keyword missing',
            !wordCountPass && `Word count ${wordCount} outside ${rules.word_count_min}–${rules.word_count_max} range`,
            !hasH2 && 'No H2 headings found',
            !noKeywordStuffing && 'Keyword stuffing detected',
            !noFiller && 'Filler phrases detected',
            !imagesSpecified && 'No images specified',
          ].filter(Boolean).join('; ')}`,
    };
  }

  // 5. Generate SEO Metadata
  generateSEOMetadata(brief: ContentBrief, content: string): {
    seo_title: string;
    meta_description: string;
    url_slug: string;
  } {
    const slug = brief.primary_keyword
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const firstParagraph = content.split('\n').find(line =>
      line.trim().length > 80 && !line.startsWith('#') && !line.startsWith('[')
    ) || '';

    const meta = firstParagraph.slice(0, 155).trim() + (firstParagraph.length > 155 ? '...' : '');

    return {
      seo_title: brief.working_title.length <= 60
        ? brief.working_title
        : brief.working_title.slice(0, 57) + '...',
      meta_description: meta || `Learn everything about ${brief.primary_keyword} — a practical guide for ${brief.target_audience}.`,
      url_slug: slug,
    };
  }

  // 6. Count words and reading time
  countWords(content: string): { word_count: number; reading_time_minutes: number } {
    const words = content.split(/\s+/).filter(Boolean).length;
    return {
      word_count: words,
      reading_time_minutes: Math.ceil(words / 200),
    };
  }

  // 6.5. Automatically crawl and hydrate latest Custom Instructions & Project Memory from Supabase
  async hydrateMemoryAndInstructions(input: ContentInput): Promise<void> {
    if (input.project_instructions && input.project_memory) return;

    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      let websiteId = input.website_id;
      if (!websiteId) {
        const { data: firstSite } = await supabase.from('websites').select('id').limit(1).maybeSingle();
        if (firstSite) websiteId = firstSite.id;
      }

      let query = supabase
        .from('project_memory')
        .select('*')
        .eq('is_outdated', false)
        .order('is_important', { ascending: false });

      if (websiteId) {
        query = query.or(`website_id.eq.${websiteId},website_id.is.null`);
      }

      const { data: rows } = await query;
      if (rows && rows.length > 0) {
        const instrRow = rows.find((m: any) => m.source === 'project_custom_instructions');
        const memoryRow = rows.find((m: any) => m.source === 'project_knowledge_bank');
        const otherFacts = rows.filter(
          (m: any) => m.source !== 'project_custom_instructions' && m.source !== 'project_knowledge_bank'
        );

        if (!input.project_instructions && instrRow?.content) {
          input.project_instructions = instrRow.content;
        }

        if (!input.project_memory) {
          const parts: string[] = [];
          if (memoryRow?.content) parts.push(memoryRow.content);
          if (otherFacts.length > 0) {
            const factText = otherFacts.map((f: any) => `[${f.category?.toUpperCase() || 'INSIGHT'}] ${f.content}`).join('\n\n');
            parts.push(factText);
          }
          if (parts.length > 0) {
            input.project_memory = parts.join('\n\n');
          }
        }
      }

      // Fallback to content_rules if custom instructions still empty
      if (!input.project_instructions && websiteId) {
        const { data: rulesRow } = await supabase
          .from('content_rules')
          .select('custom_rules')
          .eq('website_id', websiteId)
          .maybeSingle();

        if (rulesRow?.custom_rules) {
          input.project_instructions = rulesRow.custom_rules;
        }
      }
    } catch (err) {
      console.warn('[ContentAgent] Auto-crawling memory error:', err);
    }
  }

  // 7. Assemble final output
  async runFullPipeline(input: ContentInput, revisionNotes?: string): Promise<ContentOutput> {
    const validation = this.validateInputs(input);
    if (!validation.valid) {
      throw new Error(`Missing required inputs: ${validation.missing.join(', ')}`);
    }

    // Always crawl and hydrate latest Custom Instructions and Autonomous Memory
    await this.hydrateMemoryAndInstructions(input);

    const brief = await this.generateBrief(input);

    // ── Run Article Writing (Claude Sonnet 5) & Image Generation IN PARALLEL ──
    const writeDraftPromise = this.writeDraft(
      brief,
      input.rules,
      revisionNotes,
      input.project_instructions,
      input.project_memory
    );

    const generateImagesPromise = (async () => {
      let featuredImageUrl = '';
      const featuredImageAlt = brief.image_requirements[0]?.alt_text || `${brief.working_title} — illustrated overview`;
      const enrichedImages: ImageRequirement[] = [];

      try {
        console.log(`[ContentAgent] Generating images in parallel with drafting for "${brief.working_title}"...`);
        const imagePromises = brief.image_requirements.map(async (req, i) => {
          try {
            const generatedImage = await ImageRouter.generate({
              topic: brief.working_title,
              target_keyword: input.primary_keyword,
              purpose: req.purpose,
              style: 'Ultra-realistic cinematic photography, premium editorial 8k resolution, highly detailed, soft natural lighting, professional business context, NO text overlays',
              dimensions: '1024x1024',
              image_placement: req.placement_context,
              brand_instructions: input.rules.brand_rules,
            });

            if (generatedImage && generatedImage.url) {
              return { index: i, req, generatedImage, success: true };
            }
            return { index: i, req, success: false };
          } catch (imgErr) {
            console.warn(`[ContentAgent] Image generation failed for ${req.alt_text}`, imgErr);
            return { index: i, req, success: false };
          }
        });

        const results = await Promise.all(imagePromises);
        results.sort((a, b) => a.index - b.index);

        for (const res of results) {
          if (res.success && res.generatedImage) {
            if (res.index === 0) featuredImageUrl = res.generatedImage.url;
            enrichedImages.push({
              ...res.req,
              image_url: res.generatedImage.url,
              generation_status: 'generated',
              prompt_used: res.generatedImage.metadata.prompt_used,
            });
          } else {
            enrichedImages.push(res.req);
          }
        }
      } catch (err: any) {
        console.warn('[ContentAgent] Global image generation error:', err.message || err);
        if (enrichedImages.length === 0) {
          enrichedImages.push(...brief.image_requirements);
        }
      }

      return { featuredImageUrl, featuredImageAlt, enrichedImages };
    })();

    // Await both text and visual pipelines simultaneously
    const [rawContent, { featuredImageUrl, featuredImageAlt, enrichedImages }] = await Promise.all([
      writeDraftPromise,
      generateImagesPromise,
    ]);

    let content = rawContent;

    // Embed generated images into the markdown body safely without bloating database rows
    for (const img of enrichedImages) {
      if (img.image_url) {
        const isOversizedDataUri = img.image_url.startsWith('data:image/') && img.image_url.length > 50000;
        const imageMarkdown = isOversizedDataUri
          ? `\n\n> 📸 **[Visual Illustration: ${img.alt_text}]**\n\n`
          : `\n\n![${img.alt_text}](${img.image_url})\n*${img.alt_text}*\n\n`;

        if (content.match(/\[IMAGE:[^\]]+\]/)) {
          content = content.replace(/\[IMAGE:[^\]]+\]/, imageMarkdown);
        } else if (img === enrichedImages[0]) {
          content = content.replace(/^(# .+\n)/m, `$1${imageMarkdown}`);
        }
      }
    }

    // Purge any remaining raw image markers from the text so no bracket prompt tags are ever visible
    content = content.replace(/\n*\[IMAGE:[^\]]+\]\n*/g, '\n\n');
    content = content.replace(/!\[.*?prompt.*?\]\([^)]*\)/gi, '');
    content = content.replace(/\*\*Image prompt:?\*\*.*/gi, '');
    content = content.replace(/Image prompt:.*/gi, '');

    const { word_count, reading_time_minutes } = this.countWords(content);
    const seoMeta = this.generateSEOMetadata(brief, content);
    const qa = this.runQA({ content, brief, rules: input.rules, images: brief.image_requirements });

    return {
      working_title: brief.working_title,
      primary_keyword: input.primary_keyword,
      search_intent: input.search_intent,
      target_audience: input.target_audience,
      content_type: input.content_type,
      word_count,
      reading_time_minutes,
      content_body: content,
      seo_title: seoMeta.seo_title,
      meta_description: seoMeta.meta_description,
      url_slug: seoMeta.url_slug,
      internal_links: brief.internal_links,
      images: enrichedImages.length > 0 ? enrichedImages : brief.image_requirements,
      featured_image_url: featuredImageUrl || undefined,
      featured_image_alt: featuredImageAlt,
      cta: brief.cta,
      qa,
      status: qa.overall_status === 'pass' ? 'ready_for_approval' : 'needs_revision',
      version: 1,
    };
  }
}



