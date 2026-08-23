import { ImageRouter, ImageGenerationRequest, ImageGenerationResult } from '../ai/imageRouter';

export type { ImageGenerationRequest, ImageGenerationResult };

/**
 * Platform Image Generation Entrypoint
 * Routes to Gemini via Google AI Studio as Primary Image Generator,
 * and fails over to Leonardo AI if Gemini is unavailable.
 */
export async function generate_image(request: ImageGenerationRequest, context?: any): Promise<ImageGenerationResult> {
  return ImageRouter.generate(request, context);
}

export { ImageRouter };
