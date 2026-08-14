import { openai } from '@ai-sdk/openai';
import { generateImage as aiGenerateImage } from 'ai';

export interface ImageGenerationRequest {
  topic: string;
  purpose: string;
  style: string;
  dimensions?: '1024x1024' | '1024x1792' | '1792x1024';
  brand_instructions?: string;
}

export interface ImageGenerationResult {
  url: string;
  metadata: {
    prompt_used: string;
    style: string;
    timestamp: string;
  };
}

/**
 * Platform-owned Image Generation Tool.
 * Wraps DALL-E 3 (or the configured image model) on the server side.
 */
export async function generate_image(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
  // Construct the prompt enforcing the platform rules
  const prompt = `Create an image for the topic: "${request.topic}". 
Purpose: ${request.purpose}. 
Style: ${request.style}. 
${request.brand_instructions ? `Brand instructions to follow strictly: ${request.brand_instructions}` : ''}
The image should be high-quality, professional, and suitable for a SaaS website or blog. No text in the image unless strictly necessary.`;

  try {
    const { image } = await aiGenerateImage({
      model: openai.image('dall-e-3'),
      prompt,
      size: request.dimensions || '1024x1024',
    });

    return {
      url: image.base64 ? `data:image/png;base64,${image.base64}` : (image as any).url || '', // Handle type definition mismatch
      metadata: {
        prompt_used: prompt,
        style: request.style,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('[Image Tool] Failed to generate image:', error);
    throw new Error('Image generation failed.');
  }
}
