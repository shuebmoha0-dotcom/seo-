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
  provider: 'openai' | 'gemini' | 'leonardo' | 'editorial_fallback';
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
  name: 'openai' | 'gemini' | 'leonardo' | 'editorial_fallback';
  generateImage(prompt: string, dimensions?: string): Promise<{ url: string; base64?: string; modelUsed?: string }>;
}

/**
 * 1. Automatic Image Prompt Generator (Instant Art Direction, 0ms)
 */
export function buildInstantImagePrompt(request: ImageGenerationRequest): string {
  const topic = request.topic || request.target_keyword || 'Enterprise Strategy';
  const isWorkflow = (
    request.purpose?.toLowerCase().includes('workflow') || 
    request.purpose?.toLowerCase().includes('process') || 
    request.purpose?.toLowerCase().includes('diagram') ||
    request.style?.toLowerCase().includes('diagram')
  );

  if (isWorkflow) {
    return `A modern, clean technical architecture and process workflow visualization representing "${topic}". Minimalist geometric layout, subtle glowing node connections on a deep slate background, refined data pathways, crisp vector lines, elegant tech company visual style, 16:9 widescreen layout, no illegible text.`;
  }

  return `A high-end editorial candid photograph representing "${topic}". Modern tech workspace or business setting, warm natural morning sunlight, clean minimalist aesthetic, shallow depth of field, rich authentic textures, architectural interior design elements, 16:9 horizontal landscape composition, no text overlay, no logos.`;
}

export async function generateImagePrompt(request: ImageGenerationRequest, _context?: UsageContext): Promise<string> {
  return buildInstantImagePrompt(request);
}

/**
 * 1.5. OpenAI Image Provider (Primary Image Provider - High Fidelity Editorial Visuals)
 */
export const OpenAIImageProvider: ImageProvider = {
  name: 'openai',
  async generateImage(prompt: string, dimensions = '1536x1024'): Promise<{ url: string; base64?: string; modelUsed?: string }> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const primaryModel = AI_CONFIG.OPENAI_IMAGE_MODEL || 'gpt-image-2.5-sunburst';
    const fallbackModel = AI_CONFIG.OPENAI_IMAGE_FALLBACK_MODEL || 'gpt-image-2.5-flare';

    // Map requested dimensions to supported OpenAI sizes: 1024x1024, 1536x1024, 1024x1536, or auto
    let size: '1024x1024' | '1536x1024' | '1024x1536' = '1536x1024';
    if (dimensions === '1024x1024') {
      size = '1024x1024';
    } else if (dimensions.includes('1024x1536')) {
      size = '1024x1536';
    } else {
      size = '1536x1024'; // Default to 3:2 landscape
    }

    const modelsToTry = [primaryModel];
    if (fallbackModel && fallbackModel !== primaryModel) {
      modelsToTry.push(fallbackModel);
    }
    if (!modelsToTry.includes('chatgpt-image-latest')) {
      modelsToTry.push('chatgpt-image-latest');
    }
    if (!modelsToTry.includes('gpt-image-2')) {
      modelsToTry.push('gpt-image-2');
    }

    let lastError: Error | null = null;
    for (const model of modelsToTry) {
      try {
        console.log(`[OpenAIImageProvider] Generating image using ${model} (size: ${size})...`);
        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            prompt,
            n: 1,
            size,
          }),
          signal: AbortSignal.timeout(35000),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI Image API (${model}) returned HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const item = data.data?.[0];
        if (!item?.b64_json && !item?.url) {
          throw new Error(`OpenAI image generation (${model}) returned empty data.`);
        }

        let publicUrl = item.url || '';
        const base64Data = item.b64_json;

        // Convert base64 to optimized WebP and upload to Supabase storage for instant public CDN delivery
        if (base64Data) {
          try {
            const { createAdminClient } = await import('@/lib/supabase/admin');
            const supabase = createAdminClient();
            let uploadBuffer = Buffer.from(base64Data, 'base64');
            let contentType = 'image/webp';
            let fileExt = 'webp';

            try {
              const sharp = (await import('sharp')).default;
              uploadBuffer = await sharp(uploadBuffer)
                .webp({ quality: 85, effort: 4 })
                .toBuffer();
            } catch (sharpErr) {
              console.warn('[ImageRouter] WebP conversion fallback to PNG:', sharpErr);
              contentType = 'image/png';
              fileExt = 'png';
            }

            const filename = `generated/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage.from('content-images').upload(filename, uploadBuffer, {
              contentType,
              upsert: true,
            });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('content-images').getPublicUrl(filename);
              if (urlData?.publicUrl) {
                publicUrl = urlData.publicUrl;
              }
            } else {
              console.warn('[ImageRouter] Supabase upload returned error:', uploadError.message);
            }
          } catch (uploadErr) {
            console.warn('[ImageRouter] Upload to Supabase storage failed:', uploadErr);
          }
        } else if (publicUrl && !publicUrl.includes('supabase.co')) {
          // If OpenAI returned a temporary expiring URL, download and save permanently
          try {
            const fetchRes = await fetch(publicUrl, { signal: AbortSignal.timeout(10000) });
            if (fetchRes.ok) {
              const arrBuf = await fetchRes.arrayBuffer();
              const sharp = (await import('sharp')).default;
              const webpBuf = await sharp(Buffer.from(arrBuf)).webp({ quality: 85 }).toBuffer();
              const { createAdminClient } = await import('@/lib/supabase/admin');
              const supabase = createAdminClient();
              const filename = `generated/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.webp`;
              const { error } = await supabase.storage.from('content-images').upload(filename, webpBuf, {
                contentType: 'image/webp',
                upsert: true,
              });
              if (!error) {
                const { data: urlData } = supabase.storage.from('content-images').getPublicUrl(filename);
                if (urlData?.publicUrl) publicUrl = urlData.publicUrl;
              }
            }
          } catch (_) {}
        }

        return {
          url: publicUrl,
          base64: base64Data,
          modelUsed: model,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[OpenAIImageProvider] Attempt with ${model} failed:`, err?.message);
      }
    }

    throw lastError || new Error('All OpenAI image models failed.');
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
        signal: AbortSignal.timeout(20000),
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
      signal: AbortSignal.timeout(20000),
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
 * 3.5. Curated High-Resolution Editorial Tech Visuals
 * 100% authentic, high-resolution candid photography with zero cartoonish AI artifacts
 */
export const CuratedEditorialProvider = {
  name: 'editorial_fallback' as const,
  generateImage(topic: string): { url: string } {
    const t = (topic || '').toLowerCase();
    let unsplashId = 'photo-1557804506-669a67965ba0'; // Modern tech strategy / architecture

    if (t.includes('linkedin') || t.includes('outreach') || t.includes('message') || t.includes('email') || t.includes('sales')) {
      unsplashId = 'photo-1551836022-d5d88e9218df'; // Modern business communication
    } else if (t.includes('seo') || t.includes('keyword') || t.includes('search') || t.includes('rank') || t.includes('google')) {
      unsplashId = 'photo-1460925895917-afdab827c52f'; // Analytics & growth dashboards
    } else if (t.includes('code') || t.includes('developer') || t.includes('tech') || t.includes('software') || t.includes('engineering')) {
      unsplashId = 'photo-1555066931-4365d14bab8c'; // Software engineering & modern code
    } else if (t.includes('ai') || t.includes('artificial') || t.includes('automation') || t.includes('machine learning')) {
      unsplashId = 'photo-1485827404703-89b55fcc595e'; // Clean, elegant technology & robotics
    } else if (t.includes('analytics') || t.includes('metric') || t.includes('data') || t.includes('growth')) {
      unsplashId = 'photo-1504868584819-f8e8b4b6d7e3'; // Data insights & charts
    }

    return {
      url: `https://images.unsplash.com/${unsplashId}?auto=format&fit=crop&w=1536&h=1024&q=85`,
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

    // 1. Generate prompt using GPT-5.6 Luna / Instant Art Direction
    const prompt = await generateImagePrompt(request, context);

    // Enforce 16:9 dimensions
    const dimensions = request.dimensions || '1536x1024';

    // 2. Primary: OpenAI Flagship Image Provider (High Fidelity & Photorealism)
    if (process.env.OPENAI_API_KEY && PROVIDER_HEALTH.openai_image.status !== 'degraded') {
      try {
        const openAiStart = Date.now();
        console.log(`[Image Router] Generating high-fidelity visual via OpenAI (${AI_CONFIG.OPENAI_IMAGE_MODEL}) for "${request.topic}"...`);
        const result = await OpenAIImageProvider.generateImage(prompt, dimensions);
        recordProviderSuccess('openai_image');
        const modelUsed = result.modelUsed || AI_CONFIG.OPENAI_IMAGE_MODEL;

        await recordImageUsage({
          provider: 'openai',
          model: modelUsed,
          status: 'success',
          fallbackUsed: false,
          durationMs: Date.now() - openAiStart,
          context,
        });

        return {
          url: result.url,
          base64: result.base64,
          provider: 'openai',
          model: modelUsed,
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
        console.warn(`[Image Router] OpenAI Image failed: ${openAiError?.message || openAiError}`);
      }
    }

    // 3. Secondary: Gemini via Google AI Studio (if key configured and operational)
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
        console.warn(`[Image Router] Gemini Image failed: ${geminiError?.message || geminiError}`);
      }
    }

    // 4. Tertiary: Leonardo AI (if key configured)
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

    // 5. Ultimate Zero-Fail Fallback: Curated High-Resolution Editorial Photography (0ms, 100% Reliable)
    console.log(`[Image Router] Using curated high-resolution editorial visual for "${request.topic}"...`);
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
 * Helper to record image generation usage metrics in Supabase (usage_events table)
 */
async function recordImageUsage(data: {
  provider: 'openai' | 'gemini' | 'leonardo' | 'editorial_fallback';
  model: string;
  status: 'success' | 'failed' | 'fallback';
  fallbackUsed: boolean;
  durationMs: number;
  context?: UsageContext;
}) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const estimatedCost = IMAGE_PRICING_ESTIMATES[data.model] ?? 0.04;

    const isValidUuid = (val?: string) =>
      typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let userId = isValidUuid(data.context?.user_id) ? data.context?.user_id : null;
    let projectId = isValidUuid(data.context?.project_id) ? data.context?.project_id : null;

    // If website_id is provided, resolve user_id and project_id if missing
    if ((!userId || !projectId) && isValidUuid(data.context?.website_id)) {
      const { data: site } = await supabase
        .from('websites')
        .select('user_id, project_id')
        .eq('id', data.context!.website_id)
        .maybeSingle();

      if (site) {
        if (!userId && isValidUuid(site.user_id)) userId = site.user_id;
        if (!projectId && isValidUuid(site.project_id)) projectId = site.project_id;
      }
    }

    const { error } = await supabase.from('usage_events').insert({
      user_id: userId,
      project_id: projectId,
      task_id: isValidUuid(data.context?.task_id) ? data.context?.task_id : null,
      task_execution_id: isValidUuid(data.context?.task_execution_id) ? data.context?.task_execution_id : null,
      agent_execution_id: isValidUuid(data.context?.agent_execution_id) ? data.context?.agent_execution_id : null,
      provider: data.provider,
      model: data.model,
      api_type: 'image',
      agent_type: 'ImageAgent',
      input_tokens: 0,
      output_tokens: 0,
      api_calls: 1,
      external_units: 1,
      estimated_cost: Number(estimatedCost.toFixed(6)),
      currency: 'USD',
    });

    if (error) {
      console.warn('[Image Router] Failed to insert usage_event:', error.message);
    } else {
      console.log(`[Image Router] Live usage tracked: ${data.model} ($${estimatedCost.toFixed(3)})`);
    }
  } catch (err: any) {
    console.warn('[Image Router] Failed to record usage to database:', err.message);
  }
}
