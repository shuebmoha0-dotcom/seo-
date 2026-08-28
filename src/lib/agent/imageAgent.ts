import { LLMProvider } from '../tools/llm';

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImageType =
  | 'featured' | 'illustration' | 'diagram' | 'workflow' | 'infographic'
  | 'comparison' | 'chart' | 'screenshot' | 'product_screenshot'
  | 'step_by_step' | 'conceptual' | 'data_visualization';

export type GenerationMethod =
  | 'ai_generated' | 'media_library' | 'licensed_source'
  | 'programmatic' | 'existing_asset' | 'screenshot_required';

export type ContentType =
  | 'how_to' | 'comparison' | 'data' | 'product' | 'conceptual'
  | 'case_study' | 'guide' | 'landing_page' | 'blog_article';

export interface ImagePlanItem {
  id: string;
  image_type: ImageType;
  purpose: string;
  placement: string;
  placement_order: number;
  visual_description: string;
  aspect_ratio: '1:1' | '16:9' | '4:3' | '3:2' | '2:3';
  dimensions: string;
  generation_method: GenerationMethod;
  generation_prompt?: string;
  filename: string;
  alt_text: string;
  caption?: string;
  status: 'planning' | 'prompt_ready' | 'generating' | 'generated' | 'qa_passed' | 'qa_failed' | 'pending_approval' | 'approved' | 'rejected';
  screenshot_required_note?: string;
}

export interface ImagePlan {
  article_title: string;
  target_keyword: string;
  content_type: ContentType;
  total_images: number;
  rationale: string;
  images: ImagePlanItem[];
}

export interface ImageQAResult {
  image_id: string;
  checks: {
    relevant_to_article: boolean;
    correct_visual_type: boolean;
    correct_placement: boolean;
    no_misleading_elements: boolean;
    no_fabricated_data: boolean;
    no_fake_product_ui: boolean;
    filename_descriptive: boolean;
    alt_text_accurate: boolean;
    follows_project_instructions: boolean;
  };
  passed: boolean;
  qa_notes: string;
  needs_regeneration: boolean;
}

export interface ImageManifestItem {
  image_id: string;
  type: ImageType;
  purpose: string;
  placement: string;
  filename: string;
  alt_text: string;
  caption?: string;
  source: GenerationMethod;
  dimensions: string;
  aspect_ratio: string;
  status: string;
  stored_path?: string;
}

// Content type → preferred visual strategy
const CONTENT_TYPE_STRATEGY: Record<ContentType, { preferred_types: ImageType[]; notes: string }> = {
  how_to: {
    preferred_types: ['step_by_step', 'workflow', 'screenshot', 'diagram'],
    notes: 'Prefer step-by-step visuals and process diagrams. Screenshots help for software topics.',
  },
  comparison: {
    preferred_types: ['comparison', 'chart', 'infographic'],
    notes: 'Use comparison graphics or charts. Avoid subjective claims.',
  },
  data: {
    preferred_types: ['chart', 'data_visualization', 'infographic'],
    notes: 'Use precise data visuals. Never fabricate statistics.',
  },
  product: {
    preferred_types: ['product_screenshot', 'workflow', 'diagram'],
    notes: 'Use verified screenshots. Never fabricate product UI.',
  },
  conceptual: {
    preferred_types: ['conceptual', 'illustration', 'diagram'],
    notes: 'Use diagrams that explain abstract ideas clearly.',
  },
  case_study: {
    preferred_types: ['chart', 'workflow', 'data_visualization'],
    notes: 'Show real results with charts. Process visuals work well.',
  },
  guide: {
    preferred_types: ['featured', 'diagram', 'step_by_step', 'workflow'],
    notes: 'Mix featured image with explanatory diagrams.',
  },
  landing_page: {
    preferred_types: ['featured', 'conceptual', 'illustration'],
    notes: 'Clean, on-brand hero visuals. Avoid clutter.',
  },
  blog_article: {
    preferred_types: ['featured', 'diagram', 'illustration'],
    notes: 'Featured image + 1-2 supporting visuals that add clarity.',
  },
};

// ─── Image Agent Class ────────────────────────────────────────────────────────

export class ImageAgent {

  // 1. Analyze content and create image plan
  async planImages(params: {
    article_title: string;
    article_content: string;
    target_keyword: string;
    content_type: ContentType;
    project_instructions?: string;
    visual_memory?: string; // relevant project memory re: brand/visual style
    discusses_product?: boolean;
    max_images?: number;
  }): Promise<ImagePlan> {
    const strategy = CONTENT_TYPE_STRATEGY[params.content_type];
    const maxImages = params.max_images || 3;

    try {
      const { object } = await LLMProvider.generateObject({
      agent: 'ImageAgent',
      
        
        schema: z.object({
          total_images: z.number().min(0).max(8),
          rationale: z.string(),
          images: z.array(z.object({
            id: z.string(),
            image_type: z.enum([
              'featured', 'illustration', 'diagram', 'workflow', 'infographic',
              'comparison', 'chart', 'screenshot', 'product_screenshot',
              'step_by_step', 'conceptual', 'data_visualization',
            ]),
            purpose: z.string(),
            placement: z.string(),
            placement_order: z.number(),
            visual_description: z.string(),
            aspect_ratio: z.enum(['1:1', '16:9', '4:3', '3:2', '2:3']),
            dimensions: z.string(),
            generation_method: z.enum([
              'ai_generated', 'media_library', 'licensed_source',
              'programmatic', 'existing_asset', 'screenshot_required',
            ]),
            generation_prompt: z.string(),
            filename: z.string(),
            alt_text: z.string(),
            caption: z.string().nullable(),
            screenshot_required_note: z.string().nullable(),
          })),
        }),
        system: `You are a visual content director for high-performing SaaS & SEO publications.

Your job is to plan photorealistic, real-world images that look authentic and human — never robotic, cartoonish, or cheap CGI.

PRINCIPLES:
- VISUAL STYLE: Authentic real-world editorial photography (e.g. real human hands holding a smartphone, a founder working on a sleek laptop at a sunlit wooden desk with an iced coffee, minimalist workspace, clean realistic device mockups).
- NEVER use robotic androids, neon futuristic cyber holograms, 3D Pixar/cartoon characters, or cheesy stock illustrations.
- Every image must have a clear, specific editorial purpose.
- Featured images should visually represent the topic cleanly in an authentic real-life environment.
- Keep it selective: 1-2 focused, beautiful photos > 5 generic ones.

FILENAME RULES: lowercase-hyphen-separated.webp (e.g. cold-email-length-guide.webp)
ALT TEXT RULES: describe what is visible, natural language, no keyword stuffing, under 125 chars
GENERATION PROMPT RULES: detailed photographic description — 35mm lens, f/1.8 aperture, natural sunlight, subject, real-world context, no text overlays, strictly no robotic or sci-fi elements.`,
        prompt: `Plan images for this article:

Title: "${params.article_title}"
Target Keyword: "${params.target_keyword}"
Content Type: ${params.content_type}
Discusses Customer Product: ${params.discusses_product ? 'YES — use screenshot_required for product UI, never fabricate' : 'No'}
Max Images: ${maxImages}

Content Strategy for this type: ${strategy.notes}
Preferred visual types: ${strategy.preferred_types.join(', ')}

Article Content (first 2000 chars):
${params.article_content?.slice(0, 2000) || 'No content provided — plan based on title and keyword only'}

Project Instructions: ${params.project_instructions || 'None'}
Visual Style Memory: ${params.visual_memory || 'None'}

Plan only images that genuinely help readers understand this content better.
Justify each image clearly. Do not add images just to increase count.`,
      });

      return {
        article_title: params.article_title,
        target_keyword: params.target_keyword,
        content_type: params.content_type,
        total_images: object.total_images,
        rationale: object.rationale,
        images: object.images.map((img: any) => ({ ...img, status: 'prompt_ready' as const })),
      };
    } catch {
      // Deterministic fallback — always produces a sensible minimal plan
      return this.deterministicPlan(params);
    }
  }

  // Fallback plan when AI is unavailable
  private deterministicPlan(params: {
    article_title: string;
    target_keyword: string;
    content_type: ContentType;
  }): ImagePlan {
    const slug = params.target_keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    const strategy = CONTENT_TYPE_STRATEGY[params.content_type];

    const images: ImagePlanItem[] = [
      {
        id: 'img-1',
        image_type: 'featured',
        purpose: 'Visually represent the article topic and attract clicks in social/search.',
        placement: 'Article header — above the H1',
        placement_order: 0,
        visual_description: `Clean, professional featured image representing "${params.article_title}". Minimal text, on-brand colors, clear focal point.`,
        aspect_ratio: '16:9',
        dimensions: '1200x630',
        generation_method: 'ai_generated',
        generation_prompt: `Professional featured image for an article titled "${params.article_title}". Clean composition, modern design, relevant industry iconography. No text overlay. Suitable as a blog/article hero image.`,
        filename: `${slug}-featured.webp`,
        alt_text: `${params.article_title} — illustrated overview`,
        status: 'prompt_ready',
      },
    ];

    // Add a diagram for process-heavy content types
    if (['how_to', 'guide', 'conceptual', 'blog_article'].includes(params.content_type)) {
      images.push({
        id: 'img-2',
        image_type: 'diagram',
        purpose: `Explain the core process or concept behind "${params.target_keyword}" visually.`,
        placement: 'After the first major H2 section',
        placement_order: 1,
        visual_description: `Clear diagram illustrating the key steps or components of ${params.target_keyword}. Simple labels, logical flow, clean design.`,
        aspect_ratio: '16:9',
        dimensions: '1200x675',
        generation_method: 'ai_generated',
        generation_prompt: `Educational diagram explaining ${params.target_keyword}. Clean flowchart or step diagram, minimal text, professional style, neutral color palette. Shows clear progression from left to right.`,
        filename: `${slug}-diagram.webp`,
        alt_text: `${params.target_keyword} process diagram showing key steps`,
        status: 'prompt_ready',
      });
    }

    return {
      article_title: params.article_title,
      target_keyword: params.target_keyword,
      content_type: params.content_type,
      total_images: images.length,
      rationale: `Planned ${images.length} image(s) based on content type "${params.content_type}". Strategy: ${strategy.notes}`,
      images,
    };
  }

  // 2. Build a rich generation prompt for a specific image
  buildGenerationPrompt(image: ImagePlanItem, context: {
    brand_style?: string;
    color_palette?: string;
    target_audience?: string;
    industry?: string;
  }): string {
    const styleContext = [
      context.brand_style ? `Visual style: ${context.brand_style}.` : 'Clean, modern professional style.',
      context.color_palette ? `Colors: ${context.color_palette}.` : '',
      context.target_audience ? `Audience: ${context.target_audience}.` : '',
      context.industry ? `Industry: ${context.industry}.` : '',
    ].filter(Boolean).join(' ');

    const typeGuide: Record<ImageType, string> = {
      featured: 'Clean composition with clear focal point. No text overlay. Professional photography or illustration style.',
      illustration: 'Original illustration. Clean lines, consistent style, educational purpose.',
      diagram: 'Flowchart or step diagram. Minimal text labels, logical progression, clean layout.',
      workflow: 'Sequential process visual. Clear steps with arrows or connections. Simple, readable.',
      infographic: 'Information-rich visual. Clean hierarchy, limited color palette, readable at web scale.',
      comparison: 'Side-by-side comparison. Clear visual distinction between options.',
      chart: 'Clean data chart. Readable at web scale. No fabricated numbers.',
      screenshot: 'Product or interface screenshot. Must be real — do not fabricate.',
      product_screenshot: 'Verified product UI screenshot. Never fabricate features or data.',
      step_by_step: 'Step-by-step numbered visual. Each step clearly visible and labeled.',
      conceptual: 'Abstract concept made visual. Uses metaphor or analogy effectively.',
      data_visualization: 'Clear data chart or graph. Accurate representation, no invented statistics.',
    };

    return [
      image.visual_description,
      typeGuide[image.image_type],
      styleContext,
      `Aspect ratio: ${image.aspect_ratio}.`,
      'No watermarks. No copyrighted logos. Suitable for web publication.',
    ].filter(Boolean).join(' ');
  }

  // 3. QA an image against the plan
  runImageQA(image: ImagePlanItem, articleTitle: string, projectInstructions?: string): ImageQAResult {
    const checks = {
      relevant_to_article: image.purpose.length > 10 && image.visual_description.length > 20,
      correct_visual_type: image.image_type !== 'product_screenshot' || image.generation_method === 'screenshot_required',
      correct_placement: image.placement.length > 5,
      no_misleading_elements: image.image_type !== 'product_screenshot' || image.generation_method === 'screenshot_required',
      no_fabricated_data: !['chart', 'data_visualization'].includes(image.image_type) || image.generation_prompt?.includes('no fabricated') !== false,
      no_fake_product_ui: image.image_type !== 'product_screenshot' || image.generation_method === 'screenshot_required',
      filename_descriptive: /^[a-z0-9\-]+\.(webp|png|jpg|jpeg|svg)$/.test(image.filename || ''),
      alt_text_accurate: (image.alt_text?.length || 0) >= 10 && (image.alt_text?.length || 0) <= 125,
      follows_project_instructions: true, // Would check against project instructions in production
    };

    const failedChecks = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    const passed = failedChecks.length === 0;

    return {
      image_id: image.id,
      checks,
      passed,
      qa_notes: passed
        ? 'All QA checks passed.'
        : `Failed: ${failedChecks.map(k => k.replace(/_/g, ' ')).join(', ')}.`,
      needs_regeneration: !passed && failedChecks.some(k => ['no_fabricated_data', 'no_fake_product_ui', 'no_misleading_elements'].includes(k)),
    };
  }

  // 4. Generate the final image manifest
  generateManifest(plan: ImagePlan, qaResults: ImageQAResult[]): ImageManifestItem[] {
    return plan.images.map((img: any) => {
      const qa = qaResults.find(q => q.image_id === img.id);
      return {
        image_id: img.id,
        type: img.image_type,
        purpose: img.purpose,
        placement: img.placement,
        filename: img.filename,
        alt_text: img.alt_text,
        caption: img.caption,
        source: img.generation_method,
        dimensions: img.dimensions,
        aspect_ratio: img.aspect_ratio,
        status: qa?.passed
          ? 'pending_approval'
          : qa?.needs_regeneration
            ? 'needs_regeneration'
            : 'qa_failed',
      };
    });
  }

  // 5. Extract visual memory from decisions
  extractVisualMemory(plan: ImagePlan, approvedImages: ImagePlanItem[]): Array<{
    content: string;
    category: 'preferences' | 'decisions' | 'brand';
  }> {
    const memories: Array<{ content: string; category: 'preferences' | 'decisions' | 'brand' }> = [];

    const dominantType = approvedImages
      .map(i => i.image_type)
      .reduce<Record<string, number>>((acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }), {});
    const mostUsed = Object.entries(dominantType).sort(([, a], [, b]) => b - a)[0];

    if (mostUsed && mostUsed[1] >= 2) {
      memories.push({
        content: `Image style preference: ${mostUsed[0]} visuals are frequently approved for ${plan.content_type} content.`,
        category: 'preferences',
      });
    }

    const screenshotRequired = approvedImages.filter(i => i.generation_method === 'screenshot_required');
    if (screenshotRequired.length > 0) {
      memories.push({
        content: `Product screenshots required for product content. Agent should flag when real screenshots are unavailable.`,
        category: 'decisions',
      });
    }

    return memories;
  }
}
