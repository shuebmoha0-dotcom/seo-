import { generateObject as aiGenerateObject, generateText as aiGenerateText, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  AI_CONFIG,
  PRICING_RATES,
  recordProviderSuccess,
  recordProviderFailure,
} from './config';

export type TaskComplexity = 'simple' | 'complex';

export interface UsageContext {
  user_id?: string;
  project_id?: string;
  website_id?: string;
  task_id?: string;
  task_execution_id?: string;
  agent_execution_id?: string;
}

export interface RouterOptions {
  agent: string;
  taskType?: string;
  complexity?: TaskComplexity;
  prompt?: string;
  system?: string;
  messages?: any[];
  schema?: any;
  context?: UsageContext;
  [key: string]: any;
}

export interface ExecutionLog {
  provider: 'openai' | 'anthropic';
  model: string;
  status: 'success' | 'failed' | 'fallback';
  attemptNumber: number;
  fallbackUsed: boolean;
  durationMs: number;
  tokens?: { prompt: number; completion: number; total: number };
  estimatedCost?: number;
  error?: string;
}

/**
 * Determines whether a task should default to GPT-5.6 Luna or Claude Sonnet 5
 */
export function evaluateTaskComplexity(options: RouterOptions): TaskComplexity {
  if (options.complexity) return options.complexity;

  const agent = options.agent.toLowerCase();
  const taskType = (options.taskType || '').toLowerCase();
  const prompt = options.prompt || '';

  if (
    agent.includes('content') &&
    (taskType.includes('long_form') || taskType.includes('draft') || prompt.length > 2500 || prompt.includes('article') || prompt.includes('word'))
  ) {
    return 'complex';
  }

  if (agent.includes('strategy') && (taskType.includes('roadmap') || taskType.includes('audit') || taskType.includes('strategic'))) {
    return 'complex';
  }

  if (agent.includes('competitor') && taskType.includes('deep_gap_analysis')) {
    return 'complex';
  }

  if (agent.includes('technical') && taskType.includes('complex_architecture')) {
    return 'complex';
  }

  return 'simple';
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode;

  if (status === 429 || (status >= 500 && status <= 504)) return true;
  if (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('network') ||
    message.includes('rate limit') ||
    message.includes('overloaded') ||
    message.includes('fetch failed')
  ) {
    return true;
  }
  return false;
}

export function isConfigurationError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode;

  if (status === 401 || status === 403) return true;
  if (
    message.includes('api key') ||
    message.includes('unauthorized') ||
    message.includes('invalid_api_key') ||
    message.includes('schema') ||
    message.includes('bad request')
  ) {
    return true;
  }
  return false;
}

function resolveModel(provider: 'openai' | 'anthropic', modelName: string): LanguageModel {
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured.');
    }
    let actualModel = modelName;
    if (actualModel === 'claude-sonnet-5' || actualModel.includes('sonnet-5')) {
      actualModel = 'claude-3-5-sonnet-20241022';
    }
    return anthropic(actualModel) as LanguageModel;
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }
  return openai(modelName) as LanguageModel;
}

async function recordUsage(log: ExecutionLog, options: RouterOptions) {
  const rates = PRICING_RATES[log.model] || { in: 0, out: 0 };
  const inputTokens = log.tokens?.prompt || 0;
  const outputTokens = log.tokens?.completion || 0;
  const cost = (inputTokens / 1000) * rates.in + (outputTokens / 1000) * rates.out;

  console.log(
    `[Model Router] ${options.agent} | Model: ${log.model} (${log.provider}) | Status: ${log.status} | Tokens: ${log.tokens?.total || 0} | Cost: $${cost.toFixed(5)} | Duration: ${log.durationMs}ms`
  );

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && !supabaseUrl.includes('placeholder') && supabaseKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('usage_events').insert({
        user_id: options.context?.user_id || null,
        project_id: options.context?.project_id || null,
        task_id: options.context?.task_id || null,
        task_execution_id: options.context?.task_execution_id || null,
        agent_execution_id: options.context?.agent_execution_id || null,
        provider: log.provider,
        model: log.model,
        api_type: 'llm',
        agent_type: options.agent,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        api_calls: 1,
        estimated_cost: parseFloat(cost.toFixed(6)),
        currency: 'USD',
      });
    }
  } catch (err) {
    console.warn('[Model Router] Usage tracking record failed:', err);
  }
}

function extractTokenCounts(usage: any): { prompt: number; completion: number; total: number } {
  if (!usage) return { prompt: 0, completion: 0, total: 0 };
  const prompt = usage.promptTokens ?? usage.inputTokens ?? 0;
  const completion = usage.completionTokens ?? usage.outputTokens ?? 0;
  const total = usage.totalTokens ?? (prompt + completion);
  return { prompt, completion, total };
}

/**
 * Centralized Text Model Router
 */
export const TextRouter = {
  async generateObject<T = any>(options: RouterOptions): Promise<{ object: T; usage: any; model: string; provider: string }> {
    const complexity = evaluateTaskComplexity(options);

    const primary = complexity === 'complex'
      ? { provider: 'anthropic' as const, modelName: AI_CONFIG.SONNET_MODEL, healthKey: 'sonnet' as const }
      : { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const };

    const fallback = complexity === 'complex'
      ? { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const }
      : { provider: 'anthropic' as const, modelName: AI_CONFIG.SONNET_MODEL, healthKey: 'sonnet' as const };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= AI_CONFIG.MAX_RETRIES) {
      attempt++;
      const startTime = Date.now();

      try {
        const model = resolveModel(primary.provider, primary.modelName);
        const result = await aiGenerateObject({
          ...(options as any),
          model,
        });

        recordProviderSuccess(primary.healthKey);
        const tokens = extractTokenCounts(result.usage);
        await recordUsage(
          {
            provider: primary.provider,
            model: primary.modelName,
            status: 'success',
            attemptNumber: attempt,
            fallbackUsed: false,
            durationMs: Date.now() - startTime,
            tokens,
          },
          options
        );

        return {
          object: result.object as T,
          usage: result.usage,
          model: primary.modelName,
          provider: primary.provider,
        };
      } catch (error: any) {
        lastError = error;

        if (isConfigurationError(error)) {
          console.warn(`[Model Router] Primary model configuration error (${primary.modelName}): ${error.message}. Checking fallback...`);
          break;
        }

        if (isTransientError(error) && attempt <= AI_CONFIG.MAX_RETRIES) {
          const delay = AI_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[Model Router] Transient failure on ${primary.modelName} (attempt ${attempt}): ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        break;
      }
    }

    recordProviderFailure(primary.healthKey, lastError?.message || 'Execution failed');

    // Attempt Fallback Model
    console.warn(`[Model Router] Failing over from ${primary.modelName} to ${fallback.modelName} for ${options.agent}...`);
    const fallbackStart = Date.now();

    try {
      const fallbackModel = resolveModel(fallback.provider, fallback.modelName);
      const fallbackResult = await aiGenerateObject({
        ...(options as any),
        model: fallbackModel,
      });

      recordProviderSuccess(fallback.healthKey);
      const tokens = extractTokenCounts(fallbackResult.usage);
      await recordUsage(
        {
          provider: fallback.provider,
          model: fallback.modelName,
          status: 'fallback',
          attemptNumber: 1,
          fallbackUsed: true,
          durationMs: Date.now() - fallbackStart,
          tokens,
        },
        options
      );

      return {
        object: fallbackResult.object as T,
        usage: fallbackResult.usage,
        model: fallback.modelName,
        provider: fallback.provider,
      };
    } catch (fallbackError: any) {
      recordProviderFailure(fallback.healthKey, fallbackError.message);
      console.error(`[Model Router] Both primary (${primary.modelName}) and fallback (${fallback.modelName}) failed.`);
      throw new Error(`AI Model execution failed: ${lastError?.message || fallbackError.message}`);
    }
  },

  async generateText(options: RouterOptions): Promise<{ text: string; usage: any; model: string; provider: string }> {
    const complexity = evaluateTaskComplexity(options);

    const primary = complexity === 'complex'
      ? { provider: 'anthropic' as const, modelName: AI_CONFIG.SONNET_MODEL, healthKey: 'sonnet' as const }
      : { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const };

    const fallback = complexity === 'complex'
      ? { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const }
      : { provider: 'anthropic' as const, modelName: AI_CONFIG.SONNET_MODEL, healthKey: 'sonnet' as const };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= AI_CONFIG.MAX_RETRIES) {
      attempt++;
      const startTime = Date.now();

      try {
        const model = resolveModel(primary.provider, primary.modelName);
        const result = await aiGenerateText({
          ...(options as any),
          model,
        });

        recordProviderSuccess(primary.healthKey);
        const tokens = extractTokenCounts(result.usage);
        await recordUsage(
          {
            provider: primary.provider,
            model: primary.modelName,
            status: 'success',
            attemptNumber: attempt,
            fallbackUsed: false,
            durationMs: Date.now() - startTime,
            tokens,
          },
          options
        );

        return {
          text: result.text,
          usage: result.usage,
          model: primary.modelName,
          provider: primary.provider,
        };
      } catch (error: any) {
        lastError = error;

        if (isConfigurationError(error)) {
          console.warn(`[Model Router] Primary model configuration error (${primary.modelName}): ${error.message}. Checking fallback...`);
          break;
        }

        if (isTransientError(error) && attempt <= AI_CONFIG.MAX_RETRIES) {
          const delay = AI_CONFIG.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[Model Router] Transient failure on ${primary.modelName} (attempt ${attempt}): ${error.message}. Retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        break;
      }
    }

    recordProviderFailure(primary.healthKey, lastError?.message || 'Execution failed');

    // Attempt Fallback
    console.warn(`[Model Router] Failing over from ${primary.modelName} to ${fallback.modelName} for ${options.agent}...`);
    const fallbackStart = Date.now();

    try {
      const fallbackModel = resolveModel(fallback.provider, fallback.modelName);
      const fallbackResult = await aiGenerateText({
        ...(options as any),
        model: fallbackModel,
      });

      recordProviderSuccess(fallback.healthKey);
      const tokens = extractTokenCounts(fallbackResult.usage);
      await recordUsage(
        {
          provider: fallback.provider,
          model: fallback.modelName,
          status: 'fallback',
          attemptNumber: 1,
          fallbackUsed: true,
          durationMs: Date.now() - fallbackStart,
          tokens,
        },
        options
      );

      return {
        text: fallbackResult.text,
        usage: fallbackResult.usage,
        model: fallback.modelName,
        provider: fallback.provider,
      };
    } catch (fallbackError: any) {
      recordProviderFailure(fallback.healthKey, fallbackError.message);
      console.error(`[Model Router] Both primary (${primary.modelName}) and fallback (${fallback.modelName}) failed.`);
      throw new Error(`AI Model execution failed: ${lastError?.message || fallbackError.message}`);
    }
  }
};
