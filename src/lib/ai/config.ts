/**
 * Centralized AI Model Configuration & Provider Constants
 */

export interface ModelPricing {
  in: number;  // Price per 1K input tokens in USD
  out: number; // Price per 1K output tokens in USD
}

export const AI_CONFIG = {
  // ── Text Models ─────────────────────────────────────────────────────────────
  // GPT-5.6 Luna: Default for fast, routine, cost-sensitive tasks
  LUNA_MODEL: process.env.LUNA_MODEL || 'gpt-5.6-luna',
  
  // Claude Sonnet 5: For deep reasoning, complex analysis, and long-form writing
  SONNET_MODEL: process.env.SONNET_MODEL || 'claude-5-sonnet',

  // ── Image Models ────────────────────────────────────────────────────────────
  // Gemini Image Generation via Google AI Studio (Primary Image Provider)
  GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',

  // Leonardo AI (Fallback Image Provider)
  LEONARDO_IMAGE_MODEL: process.env.LEONARDO_IMAGE_MODEL || 'lucid-origin',

  // ── Retry Policies ──────────────────────────────────────────────────────────
  MAX_RETRIES: 2,
  INITIAL_RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 45000,
};

export const PRICING_RATES: Record<string, ModelPricing> = {
  [AI_CONFIG.LUNA_MODEL]: { in: 0.00015, out: 0.0006 },
  'gpt-5.6-luna': { in: 0.00015, out: 0.0006 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.005, out: 0.015 },
  [AI_CONFIG.SONNET_MODEL]: { in: 0.003, out: 0.015 },
  'claude-5-sonnet': { in: 0.003, out: 0.015 },
  'claude-3-5-sonnet-20241022': { in: 0.003, out: 0.015 },
  'claude-3-5-sonnet-20240620': { in: 0.003, out: 0.015 },
  'claude-3-haiku-20240307': { in: 0.00025, out: 0.00125 },
};

export const IMAGE_PRICING_ESTIMATES: Record<string, number> = {
  [AI_CONFIG.GEMINI_IMAGE_MODEL]: 0.03, // ~$0.030 per image
  'imagen-3.0-generate-002': 0.03,
  [AI_CONFIG.LEONARDO_IMAGE_MODEL]: 0.025, // ~$0.025 per image
};

export type ProviderHealthStatus = 'operational' | 'degraded' | 'unconfigured';

export interface ProviderHealth {
  status: ProviderHealthStatus;
  lastFailureTime?: number;
  consecutiveFailures: number;
  lastError?: string;
}

// In-memory provider health tracking
export const PROVIDER_HEALTH: Record<'luna' | 'sonnet' | 'gemini_image' | 'leonardo_image', ProviderHealth> = {
  luna: { status: 'operational', consecutiveFailures: 0 },
  sonnet: { status: 'operational', consecutiveFailures: 0 },
  gemini_image: { status: 'operational', consecutiveFailures: 0 },
  leonardo_image: { status: 'operational', consecutiveFailures: 0 },
};

export function recordProviderSuccess(provider: keyof typeof PROVIDER_HEALTH) {
  PROVIDER_HEALTH[provider].consecutiveFailures = 0;
  PROVIDER_HEALTH[provider].status = 'operational';
  delete PROVIDER_HEALTH[provider].lastError;
}

export function recordProviderFailure(provider: keyof typeof PROVIDER_HEALTH, error: string) {
  PROVIDER_HEALTH[provider].consecutiveFailures += 1;
  PROVIDER_HEALTH[provider].lastFailureTime = Date.now();
  PROVIDER_HEALTH[provider].lastError = error;
  if (PROVIDER_HEALTH[provider].consecutiveFailures >= 3) {
    PROVIDER_HEALTH[provider].status = 'degraded';
  }
}
