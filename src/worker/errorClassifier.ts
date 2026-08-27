/**
 * Error Classifier for Worker Retry Policy
 */

import { WORKER_CONFIG } from './config';

export type ErrorCategory = 'transient' | 'permanent';

export interface ErrorClassification {
  category: ErrorCategory;
  canRetry: boolean;
  nextRetryAt?: string;
  delaySeconds?: number;
  reason: string;
}

export function classifyError(error: any, currentRetryCount: number, maxRetries = WORKER_CONFIG.DEFAULT_MAX_RETRIES): ErrorClassification {
  if (!error) {
    return {
      category: 'permanent',
      canRetry: false,
      reason: 'Unknown error',
    };
  }

  const message = (error.message || String(error)).toLowerCase();
  const status = error.status || error.statusCode || error.code;

  // 1. Permanent Errors (Do not retry)
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    message.includes('unauthorized') ||
    message.includes('invalid_api_key') ||
    message.includes('api key') ||
    message.includes('invalid credentials') ||
    message.includes('permission denied') ||
    message.includes('schema validation') ||
    message.includes('quota exceeded') ||
    message.includes('budget exceeded')
  ) {
    return {
      category: 'permanent',
      canRetry: false,
      reason: `Permanent failure: ${error.message || 'Configuration or authorization error'}`,
    };
  }

  // 2. Transient Errors (Network, Timeout, Rate Limits, 5xx)
  const isTransient =
    status === 429 ||
    (typeof status === 'number' && status >= 500 && status <= 504) ||
    message.includes('timeout') ||
    message.includes('rate limit') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('overloaded') ||
    message.includes('gateway') ||
    message.includes('service unavailable');

  if (isTransient || currentRetryCount < maxRetries) {
    if (currentRetryCount >= maxRetries) {
      return {
        category: 'transient',
        canRetry: false,
        reason: `Exceeded max retry limit (${maxRetries}). Last error: ${error.message}`,
      };
    }

    // Exponential backoff with jitter: backoff = min(initial * 2^(retry - 1), max)
    const baseDelay = WORKER_CONFIG.INITIAL_RETRY_BACKOFF_SECONDS * Math.pow(2, Math.max(0, currentRetryCount));
    const jitter = Math.floor(Math.random() * 5); // 0-4s jitter
    const delaySeconds = Math.min(baseDelay + jitter, WORKER_CONFIG.MAX_RETRY_BACKOFF_SECONDS);
    const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    return {
      category: 'transient',
      canRetry: true,
      nextRetryAt,
      delaySeconds,
      reason: `Transient failure (attempt ${currentRetryCount + 1}/${maxRetries}): ${error.message}. Next retry in ${delaySeconds}s.`,
    };
  }

  return {
    category: 'permanent',
    canRetry: false,
    reason: `Non-retryable error: ${error.message}`,
  };
}
