import {
  AI_CONFIG,
  IMAGE_PRICING_ESTIMATES,
  recordProviderSuccess,
  recordProviderFailure,
} from './config';
import { TextRouter, UsageContext } from './textRouter';

export interface ImageGenerationRequest {
  topic: string;
  purpose: string;
  style: string;
  dimensions?: '1024x1024' | '1024x1792' | '1792x1024' | '1200x630';
  brand_instructions?: string;
  target_keyword?: string;
  article_content?: string;
  image_placement?: string;
  desired_visual_style?: string;
  intended_audience?: string;
}

export interface ImageGenerationResult {
  url: string;
  base64?: string;
  provider: 'gemini' | 'leonardo';
  model: string;
  metadata: {
    prompt_used: string;
    style: string;
    duration_ms: number;
    fallback_used: boolean;
    timestamp: string;
  };
}

export interface ImageProvider {
  name: 'gemini' | 'leonardo';
  generateImage(prompt: string, dimensions?: string): Promise<{ url: string; base64?: string }>;
}

/**
 * 1. Automatic Image Prompt Generator
 * Uses GPT-5.6 Luna (with Claude Sonnet 5 fallback)
 */
export async function generateImagePrompt(request: ImageGenerationRequest, context?: UsageContext): Promise<string> {
  const promptGenerationPrompt = `You are a professional image prompt engineer for high-ranking SEO publications.
Generate a concise, photorealistic, on-brand image generation prompt for an article image.

Topic: ${request.topic}
Target Keyword: ${request.target_keyword || request.topic}
Purpose: ${request.purpose}
Visual Style: ${request.desired_visual_style || request.style || 'Clean modern editorial style'}
Audience: ${request.intended_audience || 'Professionals and decision makers'}
Placement: ${request.image_placement || 'Header featured image'}
${request.brand_instructions ? `Brand Guidelines: ${request.brand_instructions}` : ''}

Rules:
- Describe the visual composition, lighting, subject matter, and color palette.
- Do NOT include text overlays or words in the image.
- Keep the prompt under 80 words.`;

  const { text } = await TextRouter.generateText({
    agent: 'ImageAgent',
    taskType: 'image_prompt_generation',
    complexity: 'simple',
    prompt: promptGenerationPrompt,
    context,
  });

  return text.trim();
}

/**
 * 2. Gemini Image Provider (Google AI Studio)
 */
export const GeminiImageProvider: ImageProvider = {
  name: 'gemini',
  async generateImage(prompt: string, dimensions = '1024x1024'): Promise<{ url: string; base64?: string }> {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not configured.');
    }

    const model = AI_CONFIG.GEMINI_IMAGE_MODEL;

    // Support both generateContent (for Gemini Flash/Pro Image models) and predict (for Imagen models)
    if (model.includes('gemini')) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
          },
        }),
        signal: AbortSignal.timeout(AI_CONFIG.REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google AI Studio returned HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const part = data.candidates?.[0]?.content?.parts?.[0];

      if (!part?.inlineData?.data) {
        throw new Error('Gemini image generation returned empty inlineData.');
      }

      const mimeType = part.inlineData.mimeType || 'image/png';
      const base64Data = `data:${mimeType};base64,${part.inlineData.data}`;

      return {
        url: base64Data,
        base64: part.inlineData.data,
      };
    }

    // Imagen format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    let aspectRatio = '1:1';
    if (dimensions.includes('1792') || dimensions.includes('1200x630') || dimensions.includes('16:9')) {
      aspectRatio = '16:9';
    } else if (dimensions.includes('1024x1792')) {
      aspectRatio = '9:16';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          outputMimeType: 'image/jpeg',
        },
      }),
      signal: AbortSignal.timeout(AI_CONFIG.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google AI Studio returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const prediction = data.predictions?.[0];

    if (!prediction?.bytesBase64Encoded) {
      throw new Error('Gemini image generation returned empty prediction.');
    }

    const mimeType = prediction.mimeType || 'image/jpeg';
    const base64Data = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;

    return {
      url: base64Data,
      base64: prediction.bytesBase64Encoded,
    };
  },
};

/**
 * 3. Leonardo AI Image Provider (Fallback)
 */
export const LeonardoImageProvider: ImageProvider = {
  name: 'leonardo',
  async generateImage(prompt: string, dimensions = '1024x1024'): Promise<{ url: string; base64?: string }> {
    const apiKey = process.env.LEONARDO_API_KEY;
    if (!apiKey) {
      throw new Error('LEONARDO_API_KEY is not configured.');
    }

    const [widthStr, heightStr] = dimensions.split('x');
    const width = parseInt(widthStr, 10) || 1024;
    const height = parseInt(heightStr, 10) || 1024;

    // Step 1: Create generation job
    const createRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        num_images: 1,
      }),
      signal: AbortSignal.timeout(AI_CONFIG.REQUEST_TIMEOUT_MS),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Leonardo AI returned HTTP ${createRes.status}: ${errText}`);
    }

    const createData = await createRes.json();
    const generationId = createData.sdGenerationJob?.generationId;

    if (!generationId) {
      throw new Error('Leonardo did not return a valid generationId.');
    }

    // Step 2: Poll for completion (up to 30 seconds)
    const startTime = Date.now();
    while (Date.now() - startTime < 30000) {
      await new Promise(r => setTimeout(r, 2000));

      const pollRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/generations/${generationId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (pollRes.ok) {
        const pollData = await pollRes.json();
        const generatedImages = pollData.generations_by_pk?.generated_images;
        if (generatedImages && generatedImages.length > 0 && generatedImages[0].url) {
          return {
            url: generatedImages[0].url,
          };
        }
      }
    }

    throw new Error('Leonardo image generation timed out.');
  },
};

/**
 * 4. Image Provider Router with Failover & Usage Logging
 */
export const ImageRouter = {
  async generate(request: ImageGenerationRequest, context?: UsageContext): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    // 1. Generate prompt using GPT-5.6 Luna
    const prompt = await generateImagePrompt(request, context);

    // 2. Primary: Gemini via Google AI Studio
    let attempt = 0;
    let geminiError: any = null;

    while (attempt <= AI_CONFIG.MAX_RETRIES) {
      attempt++;
      const primaryStart = Date.now();

      try {
        const result = await GeminiImageProvider.generateImage(prompt, request.dimensions);
        recordProviderSuccess('gemini_image');

        await recordImageUsage({
          provider: 'gemini',
          model: AI_CONFIG.GEMINI_IMAGE_MODEL,
          status: 'success',
          fallbackUsed: false,
          durationMs: Date.now() - primaryStart,
          context,
        });

        return {
          url: result.url,
          base64: result.base64,
          provider: 'gemini',
          model: AI_CONFIG.GEMINI_IMAGE_MODEL,
          metadata: {
            prompt_used: prompt,
            style: request.style,
            duration_ms: Date.now() - startTime,
            fallback_used: false,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error: any) {
        geminiError = error;
        console.warn(`[Image Router] Gemini Image attempt ${attempt} failed: ${error.message}`);

        if (attempt <= AI_CONFIG.MAX_RETRIES) {
          const delay = AI_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }

    recordProviderFailure('gemini_image', geminiError?.message || 'Gemini image generation failed');

    // 3. Fallback: Leonardo AI
    console.warn(`[Image Router] Failing over to Leonardo AI image generation...`);
    const fallbackStart = Date.now();

    try {
      const result = await LeonardoImageProvider.generateImage(prompt, request.dimensions);
      recordProviderSuccess('leonardo_image');

      await recordImageUsage({
        provider: 'leonardo',
        model: AI_CONFIG.LEONARDO_IMAGE_MODEL,
        status: 'fallback',
        fallbackUsed: true,
        durationMs: Date.now() - fallbackStart,
        context,
      });

      return {
        url: result.url,
        base64: result.base64,
        provider: 'leonardo',
        model: AI_CONFIG.LEONARDO_IMAGE_MODEL,
        metadata: {
          prompt_used: prompt,
          style: request.style,
          duration_ms: Date.now() - startTime,
          fallback_used: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (leonardoError: any) {
      recordProviderFailure('leonardo_image', leonardoError.message);
      console.error(`[Image Router] Both Gemini and Leonardo image generation failed.`);
      throw new Error(`Image generation failed on both providers. Gemini: ${geminiError?.message} | Leonardo: ${leonardoError.message}`);
    }
  },
};

/**
 * Helper to record image generation events in Supabase
 */
async function recordImageUsage(params: {
  provider: 'gemini' | 'leonardo';
  model: string;
  status: 'success' | 'fallback' | 'failed';
  fallbackUsed: boolean;
  durationMs: number;
  context?: UsageContext;
}) {
  const estCost = IMAGE_PRICING_ESTIMATES[params.model] || 0.03;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && !supabaseUrl.includes('placeholder') && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('usage_events').insert({
        user_id: params.context?.user_id || null,
        project_id: params.context?.project_id || null,
        task_id: params.context?.task_id || null,
        task_execution_id: params.context?.task_execution_id || null,
        agent_execution_id: params.context?.agent_execution_id || null,
        provider: params.provider,
        model: params.model,
        api_type: 'image',
        agent_type: 'ImageAgent',
        input_tokens: 0,
        output_tokens: 0,
        api_calls: 1,
        estimated_cost: estCost,
        currency: 'USD',
      });
    }
  } catch (err) {
    console.warn('[Image Router] Failed to record image usage:', err);
  }
}
