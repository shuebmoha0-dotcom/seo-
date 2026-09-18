import {
  AI_CONFIG,
  IMAGE_PRICING_ESTIMATES,
  PROVIDER_HEALTH,
  recordProviderSuccess,
  recordProviderFailure,
} from './config';
import { TextRouter, UsageContext } from './textRouter';

export interface ImageGenerationRequest {
  topic: string;
  purpose: string;
  style: string;
  dimensions?: '1792x1008' | '1200x675' | '1792x1024' | '1024x1024' | '1024x1792' | '1200x630' | string;
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
  provider: 'openai' | 'gemini' | 'leonardo' | 'pollinations' | 'editorial_fallback';
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
  name: 'openai' | 'gemini' | 'leonardo' | 'pollinations' | 'editorial_fallback';
  generateImage(prompt: string, dimensions?: string): Promise<{ url: string; base64?: string }>;
}

/**
 * 1. Automatic Image Prompt Generator (Instant Art Direction, 0ms)
 */
export function buildInstantImagePrompt(request: ImageGenerationRequest): string {
  const topic = request.topic || request.target_keyword || 'Tech strategy';
  const style = request.desired_visual_style || request.style || 'Modern editorial SaaS illustration';
  const purpose = request.purpose || 'Editorial article visual';
  return `${style} visually representing ${topic}, ${purpose}. Professional 3D isometric conceptual render with floating UI elements, rich indigo and amber studio lighting, balanced composition, 16:9 widescreen landscape format, no text overlay, web banner quality.`;
}

export async function generateImagePrompt(request: ImageGenerationRequest, _context?: UsageContext): Promise<string> {
  return buildInstantImagePrompt(request);
}

/**
 * 1.5. OpenAI Image Provider (Primary Image Provider - Fast, Cheap & High Quality)
 */
export const OpenAIImageProvider: ImageProvider = {
  name: 'openai',
  async generateImage(prompt: string, dimensions = '1536x1024'): Promise<{ url: string; base64?: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const model = AI_CONFIG.OPENAI_IMAGE_MODEL || 'gpt-image-1-mini';
    const quality = AI_CONFIG.OPENAI_IMAGE_QUALITY || 'low';

    // Map requested dimensions to supported OpenAI sizes: 1024x1024, 1536x1024, 1024x1536, or auto
    let size: '1024x1024' | '1536x1024' | '1024x1536' = '1536x1024';
    if (dimensions === '1024x1024') {
      size = '1024x1024';
    } else if (dimensions.includes('1024x1536')) {
      size = '1024x1536';
    } else {
      size = '1536x1024'; // Default to 3:2 landscape
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: `${prompt}. Clean editorial SaaS tech illustration, modern aesthetic, isometric perspective, elegant composition, high resolution, no text overlay, web quality.`,
        n: 1,
        size,
        quality,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI Image API returned HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const item = data.data?.[0];
    if (!item?.b64_json && !item?.url) {
      throw new Error('OpenAI image generation returned empty data.');
    }

    let publicUrl = item.url || '';
    const base64Data = item.b64_json;

    // Upload base64 to Supabase storage to get permanent public CDN URL
    if (base64Data) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `generated/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

        const { error } = await supabase.storage.from('content-images').upload(filename, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

        if (!error) {
          const { data: urlData } = supabase.storage.from('content-images').getPublicUrl(filename);
          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
          }
        }
      } catch (uploadErr) {
        console.warn('[ImageRouter] Upload to Supabase storage failed, using data URI fallback:', uploadErr);
      }

      if (!publicUrl) {
        publicUrl = `data:image/png;base64,${base64Data}`;
      }
    }

    return {
      url: publicUrl,
      base64: base64Data,
    };
  },
};

/**
 * 2. Gemini Image Provider (Google AI Studio)
 * Default aspect ratio: 16:9 widescreen landscape
 */
export const GeminiImageProvider: ImageProvider = {
  name: 'gemini',
  async generateImage(prompt: string, dimensions = '1792x1008'): Promise<{ url: string; base64?: string }> {
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
          contents: [{ parts: [{ text: `${prompt}. 16:9 widescreen landscape format, wide horizontal editorial composition.` }] }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: {
              aspectRatio: '16:9',
            },
          },
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Google AI Studio returned HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);

      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini image generation returned empty inlineData.');
      }

      const mimeType = imagePart.inlineData.mimeType || 'image/png';
      let publicUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;
      try {
        const { createAdminClient } = await import('@/lib/supabase/admin');
        const supabase = createAdminClient();
        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
        const filename = `generated/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error } = await supabase.storage.from('content-images').upload(filename, buffer, {
          contentType: mimeType,
          upsert: true,
        });

        if (!error) {
          const { data: urlData } = supabase.storage.from('content-images').getPublicUrl(filename);
          if (urlData?.publicUrl) {
            publicUrl = urlData.publicUrl;
          }
        }
      } catch (uploadErr) {
        console.warn('[ImageRouter] Upload to Supabase storage failed, using fallback:', uploadErr);
      }

      return {
        url: publicUrl,
        base64: imagePart.inlineData.data,
      };
    }

    // Imagen format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instances: [{ prompt: `${prompt}. 16:9 widescreen landscape orientation.` }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          outputMimeType: 'image/jpeg',
        },
      }),
      signal: AbortSignal.timeout(3000),
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
  async generateImage(prompt: string, dimensions = '1344x768'): Promise<{ url: string; base64?: string }> {
    const apiKey = process.env.LEONARDO_API_KEY;
    if (!apiKey) {
      throw new Error('LEONARDO_API_KEY is not configured.');
    }

    // Default to 16:9 widescreen landscape (1344x768)
    const width = 1344;
    const height = 768;

    // Step 1: Create generation job
    const createRes = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        prompt: `${prompt}. 16:9 widescreen horizontal format.`,
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
 * 3.5. Pollinations AI Image Engine
 * Ultra-fast, high-resolution 16:9 widescreen editorial illustration generator
 */
export const PollinationsImageProvider: ImageProvider = {
  name: 'pollinations',
  async generateImage(prompt: string, dimensions = '1200x675'): Promise<{ url: string }> {
    const seed = Math.floor(Math.random() * 1000000);
    const cleanPrompt = prompt
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\w\s.,\-']/gi, ' ')
      .trim()
      .slice(0, 240);

    const [wStr, hStr] = dimensions.split('x');
    const width = parseInt(wStr) || 1200;
    const height = parseInt(hStr) || 675;

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
    return { url };
  },
};

/**
 * 3.6. Curated High-Resolution Editorial Tech Fallback
 */
export const CuratedEditorialProvider = {
  name: 'editorial_fallback' as const,
  generateImage(topic: string): { url: string } {
    const t = (topic || '').toLowerCase();
    let unsplashId = 'photo-1557804506-669a67965ba0'; // Modern collaborative strategy
    if (t.includes('linkedin') || t.includes('outreach') || t.includes('message') || t.includes('email') || t.includes('sales')) {
      unsplashId = 'photo-1551836022-d5d88e9218df'; // Business messaging / networking
    } else if (t.includes('seo') || t.includes('keyword') || t.includes('search') || t.includes('rank') || t.includes('google')) {
      unsplashId = 'photo-1460925895917-afdab827c52f'; // Analytics & search insights
    } else if (t.includes('code') || t.includes('developer') || t.includes('tech') || t.includes('software') || t.includes('ai')) {
      unsplashId = 'photo-1555066931-4365d14bab8c'; // Modern engineering & technology
    }
    return {
      url: `https://images.unsplash.com/${unsplashId}?auto=format&fit=crop&w=1200&h=675&q=80`,
    };
  },
};

/**
 * 4. Image Provider Router with Multi-Tier Failover & Zero-Fail Guarantee
 * Always defaults to 16:9 widescreen landscape
 */
export const ImageRouter = {
  async generate(request: ImageGenerationRequest, context?: UsageContext): Promise<ImageGenerationResult> {
    const startTime = Date.now();

    // 1. Generate prompt using GPT-5.6 Luna
    const prompt = await generateImagePrompt(request, context);

    // Enforce 16:9 dimensions
    const dimensions = request.dimensions || '1200x675';

    // 2. Primary: OpenAI Image Provider (gpt-image-1-mini - Fast, Cheap, & Crisp Quality)
    if (process.env.OPENAI_API_KEY && PROVIDER_HEALTH.openai_image.status !== 'degraded') {
      try {
        const openAiStart = Date.now();
        console.log(`[Image Router] Generating editorial image via OpenAI (${AI_CONFIG.OPENAI_IMAGE_MODEL}) for "${request.topic}"...`);
        const result = await OpenAIImageProvider.generateImage(prompt, dimensions);
        recordProviderSuccess('openai_image');

        await recordImageUsage({
          provider: 'openai',
          model: AI_CONFIG.OPENAI_IMAGE_MODEL,
          status: 'success',
          fallbackUsed: false,
          durationMs: Date.now() - openAiStart,
          context,
        });

        return {
          url: result.url,
          base64: result.base64,
          provider: 'openai',
          model: AI_CONFIG.OPENAI_IMAGE_MODEL,
          metadata: {
            prompt_used: prompt,
            style: request.style,
            duration_ms: Date.now() - startTime,
            fallback_used: false,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (openAiError: any) {
        recordProviderFailure('openai_image', openAiError?.message || 'OpenAI image generation failed');
        console.warn(`[Image Router] OpenAI Image failed, failing over to Gemini: ${openAiError?.message || openAiError}`);
      }
    }

    // 3. Secondary: Gemini via Google AI Studio (if key configured and not degraded)
    const googleKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (googleKey && PROVIDER_HEALTH.gemini_image.status !== 'degraded') {
      try {
        const primaryStart = Date.now();
        const result = await GeminiImageProvider.generateImage(prompt, dimensions);
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
      } catch (geminiError: any) {
        recordProviderFailure('gemini_image', geminiError?.message || 'Gemini image generation failed');
        console.warn(`[Image Router] Gemini Image failed, routing to Pollinations AI: ${geminiError?.message || geminiError}`);
      }
    }

    // 3. Leonardo AI (if key configured)
    if (process.env.LEONARDO_API_KEY) {
      try {
        const leoStart = Date.now();
        const result = await LeonardoImageProvider.generateImage(prompt, dimensions);
        recordProviderSuccess('leonardo_image');

        await recordImageUsage({
          provider: 'leonardo',
          model: AI_CONFIG.LEONARDO_IMAGE_MODEL,
          status: 'fallback',
          fallbackUsed: true,
          durationMs: Date.now() - leoStart,
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
      } catch (leoErr: any) {
        recordProviderFailure('leonardo_image', leoErr?.message || 'Leonardo failed');
      }
    }

    // 4. Guaranteed High-Fidelity AI Image Engine (Pollinations AI)
    try {
      console.log(`[Image Router] Generating editorial 16:9 visual via Pollinations AI for "${request.topic}"...`);
      const polyStart = Date.now();
      const result = await PollinationsImageProvider.generateImage(prompt, dimensions);
      recordProviderSuccess('pollinations_image');

      await recordImageUsage({
        provider: 'pollinations',
        model: 'pollinations-flux',
        status: 'fallback',
        fallbackUsed: true,
        durationMs: Date.now() - polyStart,
        context,
      });

      return {
        url: result.url,
        provider: 'pollinations',
        model: 'pollinations-flux',
        metadata: {
          prompt_used: prompt,
          style: request.style,
          duration_ms: Date.now() - startTime,
          fallback_used: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (polyErr: any) {
      console.warn('[Image Router] Pollinations failed, using curated editorial visual:', polyErr?.message || polyErr);
    }

    // 5. Ultimate Zero-Fail Fallback: Curated High-Res Editorial Photography
    const fallback = CuratedEditorialProvider.generateImage(request.topic);
    return {
      url: fallback.url,
      provider: 'editorial_fallback',
      model: 'curated-editorial-16:9',
      metadata: {
        prompt_used: prompt,
        style: request.style,
        duration_ms: Date.now() - startTime,
        fallback_used: true,
        timestamp: new Date().toISOString(),
      },
    };
  },
};

/**
 * Helper to record image generation usage metrics in Supabase
 */
async function recordImageUsage(data: {
  provider: 'openai' | 'gemini' | 'leonardo' | 'pollinations' | 'editorial_fallback';
  model: string;
  status: 'success' | 'failed' | 'fallback';
  fallbackUsed: boolean;
  durationMs: number;
  context?: UsageContext;
}) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const estimatedCost = IMAGE_PRICING_ESTIMATES[data.model] || 0.0;

    await supabase.from('ai_usage_logs').insert({
      provider: data.provider,
      model: data.model,
      task_type: 'image_generation',
      status: data.status,
      fallback_used: data.fallbackUsed,
      duration_ms: data.durationMs,
      estimated_cost_usd: estimatedCost,
      user_id: data.context?.user_id,
      project_id: data.context?.project_id,
      website_id: data.context?.website_id,
      task_id: data.context?.task_id,
      task_execution_id: data.context?.task_execution_id,
      agent_execution_id: data.context?.agent_execution_id,
      metadata: { dimensions: '16:9' },
    });
  } catch (err: any) {
    console.warn('[Image Router] Failed to record usage to database:', err.message);
  }
}
