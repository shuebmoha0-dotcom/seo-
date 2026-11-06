import { generateObject as aiGenerateObject, generateText as aiGenerateText, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  AI_CONFIG,
  PRICING_RATES,
  recordProviderSuccess,
  recordProviderFailure,
  normalizeAnthropicModel,
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

  // ONLY actual long-form prose and article drafting require Claude Sonnet 5
  if (
    agent.includes('content') &&
    (taskType === 'long_form_article' || taskType === 'draft_writing' || taskType === 'article_body' || taskType === 'surgical_edit')
  ) {
    return 'complex';
  }

  // All routine strategy audits, competitor searches, keyword clustering, and diagnostic tasks use simple tier (GPT-5.6 Luna)
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

export function isTokenOrQuotaExhaustedError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  const status = error.status || error.statusCode;

  if (status === 402) return true;
  if (
    message.includes('credit balance is too low') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('billing_hard_limit_reached') ||
    message.includes('billing_not_active') ||
    message.includes('out of tokens') ||
    message.includes('token limit') ||
    message.includes('monthly spend limit') ||
    message.includes('quota exceeded') ||
    message.includes('quota_exceeded')
  ) {
    return true;
  }
  return false;
}

let lastBudgetCheckTime = 0;

/**
   * Sends a private notification EXCLUSIVELY to the Admin Bot when provider tokens/credits run out.
   * Never notifies any other subscriber or client.
   */
export async function notifyAdminOnTokenExhaustion(params: {
  provider: string;
  model: string;
  agent: string;
  errorMessage: string;
}): Promise<void> {
  try {
    const { TelegramService } = await import('@/lib/telegram/telegramService');
    const telegram = new TelegramService();
    const alertText =
      `🚨 *[ADMIN ONLY] AI TOKENS / CREDITS EXHAUSTED*\n\n` +
      `• *Provider:* \`${params.provider.toUpperCase()}\` (\`${params.model}\`)\n` +
      `• *Component:* \`${params.agent}\`\n` +
      `• *Status:* Out of tokens / API quota exhausted\n` +
      `• *Provider Response:* ${params.errorMessage.slice(0, 260)}\n\n` +
      `🔒 _This notification was sent strictly to the Admin Bot and hidden from all other users._`;

    await telegram.notifyAdminOnly(alertText, {
      dedupKey: `token_exhausted_${params.provider}_${params.model}`,
      cooldownMs: 3600000, // 1 hour cooldown per provider
    });
  } catch (err) {
    console.warn('[Model Router] Admin token exhaustion alert error:', err);
  }
}

/**
   * Checks monthly token & budget consumption and sends a private warning EXCLUSIVELY to the Admin Bot
   * when tokens are almost near ending (>= 80%, >= 90%) or fully reached (>= 100%).
   */
export async function monitorTokenBudgetAndAlertAdmin(supabase: any): Promise<void> {
  const now = Date.now();
  // Throttle DB aggregation to once every 3 minutes per instance
  if (now - lastBudgetCheckTime < 180000) return;
  lastBudgetCheckTime = now;

  try {
    const nowDate = new Date();
    const monthStartIso = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1)).toISOString();
    const monthKey = monthStartIso.slice(0, 7); // YYYY-MM

    const { data: rows, error } = await supabase
      .from('usage_events')
      .select('input_tokens, output_tokens, estimated_cost')
      .gte('created_at', monthStartIso);

    if (error || !rows) return;

    let totalTokens = 0;
    let totalCostUsd = 0;
    for (const r of rows) {
      totalTokens += (Number(r.input_tokens) || 0) + (Number(r.output_tokens) || 0);
      totalCostUsd += Number(r.estimated_cost) || 0;
    }

    const monthlyTokenLimit = Number(process.env.MONTHLY_TOKEN_LIMIT || 2000000);
    const monthlyBudgetUsd = Number(process.env.MONTHLY_TOKEN_BUDGET_USD || 50);

    const tokenPct = monthlyTokenLimit > 0 ? (totalTokens / monthlyTokenLimit) * 100 : 0;
    const costPct = monthlyBudgetUsd > 0 ? (totalCostUsd / monthlyBudgetUsd) * 100 : 0;
    const maxPct = Math.max(tokenPct, costPct);

    if (maxPct < 80) return;

    const { TelegramService } = await import('@/lib/telegram/telegramService');
    const telegram = new TelegramService();
    const remainingTokens = Math.max(0, monthlyTokenLimit - totalTokens);
    const remainingUsd = Math.max(0, monthlyBudgetUsd - totalCostUsd);

    if (maxPct >= 100) {
      await telegram.notifyAdminOnly(
        `🚨 *[ADMIN ONLY] TOKEN BUDGET EXHAUSTED (${maxPct.toFixed(1)}%)*\n\n` +
          `• *Monthly Tokens Used:* ${totalTokens.toLocaleString()} / ${monthlyTokenLimit.toLocaleString()}\n` +
          `• *Monthly Spend:* $${totalCostUsd.toFixed(2)} / $${monthlyBudgetUsd.toFixed(2)}\n` +
          `• *Remaining:* 0 tokens ($0.00)\n\n` +
          `🔒 _Sent strictly to the Admin Bot only._`,
        { dedupKey: `token_budget_100_${monthKey}`, cooldownMs: 21600000 }
      );
    } else if (maxPct >= 90) {
      await telegram.notifyAdminOnly(
        `⚠️ *[ADMIN ONLY] TOKENS CRITICALLY LOW (${maxPct.toFixed(1)}% USED)*\n\n` +
          `• *Monthly Tokens Used:* ${totalTokens.toLocaleString()} / ${monthlyTokenLimit.toLocaleString()} (${remainingTokens.toLocaleString()} left)\n` +
          `• *Monthly Spend:* $${totalCostUsd.toFixed(2)} / $${monthlyBudgetUsd.toFixed(2)} ($${remainingUsd.toFixed(2)} left)\n\n` +
          `🔒 _Tokens are almost finished. Sent strictly to the Admin Bot only._`,
        { dedupKey: `token_budget_90_${monthKey}`, cooldownMs: 43200000 }
      );
    } else if (maxPct >= 80) {
      await telegram.notifyAdminOnly(
        `🔔 *[ADMIN ONLY] TOKENS ALMOST NEAR ENDING (${maxPct.toFixed(1)}% USED)*\n\n` +
          `• *Monthly Tokens Used:* ${totalTokens.toLocaleString()} / ${monthlyTokenLimit.toLocaleString()} (${remainingTokens.toLocaleString()} left)\n` +
          `• *Monthly Spend:* $${totalCostUsd.toFixed(2)} / $${monthlyBudgetUsd.toFixed(2)} ($${remainingUsd.toFixed(2)} left)\n\n` +
          `🔒 _Early warning sent strictly to the Admin Bot only._`,
        { dedupKey: `token_budget_80_${monthKey}`, cooldownMs: 86400000 }
      );
    }
  } catch (err) {
    console.warn('[Model Router] Token budget monitor warning:', err);
  }
}

function resolveModel(provider: 'openai' | 'anthropic', modelName: string): LanguageModel {
  if (provider === 'anthropic') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not configured.');
    }
    const canonicalModel = normalizeAnthropicModel(modelName);
    return anthropic(canonicalModel) as LanguageModel;
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
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();

    const isValidUuid = (val?: string) =>
      typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    let websiteId = isValidUuid(options.context?.website_id) ? options.context?.website_id : null;
    let userId = isValidUuid(options.context?.user_id) ? options.context?.user_id : null;
    let projectId = isValidUuid(options.context?.project_id) ? options.context?.project_id : null;

    // If websiteId is missing, check if task_id belongs to a content_draft
    if (!websiteId && isValidUuid(options.context?.task_id)) {
      const { data: draft } = await supabase
        .from('content_drafts')
        .select('website_id')
        .eq('id', options.context!.task_id)
        .maybeSingle();
      if (draft?.website_id && isValidUuid(draft.website_id)) {
        websiteId = draft.website_id;
      }
    }

    // Auto-resolve user_id and project_id from website_id if missing
    if ((!userId || !projectId) && websiteId) {
      const { data: site } = await supabase
        .from('websites')
        .select('user_id, project_id')
        .eq('id', websiteId)
        .maybeSingle();

      if (site) {
        if (!userId && isValidUuid(site.user_id)) userId = site.user_id;
        if (!projectId && isValidUuid(site.project_id)) projectId = site.project_id;
      }
    }

    // If still missing website or user, associate with primary site so events are tracked
    if (!websiteId || !userId) {
      const { data: defaultSite } = await supabase
        .from('websites')
        .select('id, user_id, project_id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultSite) {
        if (!websiteId) websiteId = defaultSite.id;
        if (!userId && isValidUuid(defaultSite.user_id)) userId = defaultSite.user_id;
        if (!projectId && isValidUuid(defaultSite.project_id)) projectId = defaultSite.project_id;
      }
    }

    // Fallback: If still missing user, associate with platform admin so all token events are attributed to shuebmoha0
    const PLATFORM_ADMIN_USER_ID = '0a035c76-db28-4071-9294-db59ca23d1a5';
    if (!userId) {
      userId = PLATFORM_ADMIN_USER_ID;
    }

    const { error: insertErr } = await supabase.from('usage_events').insert({
      user_id: userId,
      project_id: projectId,
      website_id: websiteId,
      task_id: isValidUuid(options.context?.task_id) ? options.context?.task_id : null,
      task_execution_id: isValidUuid(options.context?.task_execution_id) ? options.context?.task_execution_id : null,
      agent_execution_id: isValidUuid(options.context?.agent_execution_id) ? options.context?.agent_execution_id : null,
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

    if (insertErr) {
      console.warn('[Model Router] Usage tracking insert warning:', insertErr.message);
    } else {
      await monitorTokenBudgetAndAlertAdmin(supabase);
    }
  } catch (err) {
    console.warn('[Model Router] Usage tracking record failed:', err);
  }
}

function extractTokenCounts(usage: any): { prompt: number; completion: number; total: number; reasoning: number } {
  if (!usage) return { prompt: 0, completion: 0, total: 0, reasoning: 0 };
  const prompt = usage.promptTokens ?? usage.inputTokens ?? 0;
  const completion = usage.completionTokens ?? usage.outputTokens ?? 0;
  const reasoning = usage.reasoningTokens ?? usage.thinkingTokens ?? 0;
  const total = usage.totalTokens ?? (prompt + completion);
  if (reasoning > 0) {
    console.error(`[CRITICAL TOKEN ALERT] Detected ${reasoning} reasoning tokens! Anthropic thinking must stay disabled.`);
  }
  return { prompt, completion, total, reasoning };
}

/**
 * Centralized Text Model Router
 */
export const TextRouter = {
  async generateObject<T = any>(options: RouterOptions): Promise<{ object: T; usage: any; model: string; provider: string }> {
    const complexity = evaluateTaskComplexity(options);

    // Claude Sonnet 5 is permanently locked as the primary complex model
    const chosenComplexModel = AI_CONFIG.SONNET_MODEL;

    const primary = complexity === 'complex'
      ? { provider: 'anthropic' as const, modelName: chosenComplexModel, healthKey: 'sonnet' as const }
      : { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const };

    const fallback: { provider: 'openai' | 'anthropic'; modelName: string; healthKey: 'luna' | 'sonnet' } = complexity === 'complex'
      ? { provider: 'openai', modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' }
      : { provider: 'openai', modelName: 'gpt-4o-mini', healthKey: 'luna' };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= AI_CONFIG.MAX_RETRIES) {
      attempt++;
      const startTime = Date.now();

      try {
        const model = resolveModel(primary.provider, primary.modelName);
        // Strict guardrail: ALWAYS disable Anthropic thinking tokens to prevent token eating
        const providerOptions = {
          ...((options as any).providerOptions || {}),
          ...(primary.provider === 'anthropic' ? { anthropic: { thinking: { type: 'disabled' } } } : {}),
        };

        const result = await aiGenerateObject({
          ...(options as any),
          model,
          providerOptions,
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

        if (isTokenOrQuotaExhaustedError(error)) {
          await notifyAdminOnTokenExhaustion({
            provider: primary.provider,
            model: primary.modelName,
            agent: options.agent,
            errorMessage: error.message || 'Provider token/credit quota exhausted',
          });
          break;
        }

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
      const fallbackProviderOptions = {
        ...((options as any).providerOptions || {}),
        ...(fallback.provider === 'anthropic' ? { anthropic: { thinking: { type: 'disabled' } } } : {}),
      };

      const fallbackResult = await aiGenerateObject({
        ...(options as any),
        model: fallbackModel,
        providerOptions: fallbackProviderOptions,
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
      if (isTokenOrQuotaExhaustedError(fallbackError)) {
        await notifyAdminOnTokenExhaustion({
          provider: fallback.provider,
          model: fallback.modelName,
          agent: options.agent,
          errorMessage: fallbackError.message || 'Fallback provider token/credit quota exhausted',
        });
      }
      recordProviderFailure(fallback.healthKey, fallbackError.message);
      console.error(`[Model Router] Both primary (${primary.modelName}) and fallback (${fallback.modelName}) failed.`);
      throw new Error(`AI Model execution failed: ${lastError?.message || fallbackError.message}`);
    }
  },

  async generateText(options: RouterOptions): Promise<{ text: string; usage: any; model: string; provider: string }> {
    const complexity = evaluateTaskComplexity(options);

    // Claude Sonnet 5 is permanently locked as the primary complex model
    const chosenComplexModel = AI_CONFIG.SONNET_MODEL;

    const primary = complexity === 'complex'
      ? { provider: 'anthropic' as const, modelName: chosenComplexModel, healthKey: 'sonnet' as const }
      : { provider: 'openai' as const, modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' as const };

    const fallback: { provider: 'openai' | 'anthropic'; modelName: string; healthKey: 'luna' | 'sonnet' } = complexity === 'complex'
      ? { provider: 'openai', modelName: AI_CONFIG.LUNA_MODEL, healthKey: 'luna' }
      : { provider: 'openai', modelName: 'gpt-4o-mini', healthKey: 'luna' };

    let attempt = 0;
    let lastError: any = null;

    while (attempt <= AI_CONFIG.MAX_RETRIES) {
      attempt++;
      const startTime = Date.now();

      try {
        const model = resolveModel(primary.provider, primary.modelName);
        // Strict guardrail: ALWAYS disable Anthropic thinking tokens to prevent token eating
        const providerOptions = {
          ...((options as any).providerOptions || {}),
          ...(primary.provider === 'anthropic' ? { anthropic: { thinking: { type: 'disabled' } } } : {}),
        };

        const result = await aiGenerateText({
          maxTokens: 8192,
          ...(options as any),
          model,
          providerOptions,
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

        if (isTokenOrQuotaExhaustedError(error)) {
          await notifyAdminOnTokenExhaustion({
            provider: primary.provider,
            model: primary.modelName,
            agent: options.agent,
            errorMessage: error.message || 'Provider token/credit quota exhausted',
          });
          break;
        }

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
      const fallbackProviderOptions = {
        ...((options as any).providerOptions || {}),
        ...(fallback.provider === 'anthropic' ? { anthropic: { thinking: { type: 'disabled' } } } : {}),
      };

      const fallbackResult = await aiGenerateText({
        maxTokens: 8192,
        ...(options as any),
        model: fallbackModel,
        providerOptions: fallbackProviderOptions,
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
      if (isTokenOrQuotaExhaustedError(fallbackError)) {
        await notifyAdminOnTokenExhaustion({
          provider: fallback.provider,
          model: fallback.modelName,
          agent: options.agent,
          errorMessage: fallbackError.message || 'Fallback provider token/credit quota exhausted',
        });
      }
      recordProviderFailure(fallback.healthKey, fallbackError.message);
      console.error(`[Model Router] Both primary (${primary.modelName}) and fallback (${fallback.modelName}) failed.`);
      throw new Error(`AI Model execution failed: ${lastError?.message || fallbackError.message}`);
    }
  }
};
