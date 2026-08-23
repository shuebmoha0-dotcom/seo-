import { generateObject as aiGenerateObject, generateText as aiGenerateText, LanguageModel } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export type AgentName = 'Orchestrator' | 'StrategyAgent' | 'CompetitorAgent' | 'KeywordAgent' | 'ContentAgent' | 'OnPageAgent' | 'TechnicalSEOAgent' | 'InternalLinkingAgent' | 'BacklinkAgent' | 'MonitoringAgent' | 'Executor' | 'ImageAgent' | 'MemoryAgent' | 'Reasoning' | 'ScheduleAgent';

interface ModelConfig {
  provider: 'openai' | 'anthropic';
  modelName: string;
  fallback?: { provider: 'openai' | 'anthropic'; modelName: string; };
}

// Centralized mapping (Model Router)
const ROUTER_CONFIG: Record<AgentName, ModelConfig> = {
  Orchestrator: { provider: 'openai', modelName: 'gpt-4o' }, // GPT-5.6 Terra
  StrategyAgent: { provider: 'openai', modelName: 'gpt-4o' }, // GPT-5.6 Sol
  CompetitorAgent: { provider: 'openai', modelName: 'gpt-4o' }, // GPT-5.6 Terra
  KeywordAgent: { provider: 'openai', modelName: 'gpt-4o-mini' }, // GPT-5.6 Luna
  ContentAgent: { 
    provider: 'anthropic', 
    modelName: 'claude-3-5-sonnet-20240620', // Sonnet 5
    fallback: { provider: 'openai', modelName: 'gpt-4o' }
  },
  OnPageAgent: { provider: 'openai', modelName: 'gpt-4o' },
  TechnicalSEOAgent: { provider: 'openai', modelName: 'gpt-4o' },
  InternalLinkingAgent: { provider: 'openai', modelName: 'gpt-4o-mini' },
  BacklinkAgent: { provider: 'openai', modelName: 'gpt-4o-mini' },
  MonitoringAgent: { provider: 'openai', modelName: 'gpt-4o-mini' },
  Executor: { provider: 'openai', modelName: 'gpt-4o-mini' },
  ImageAgent: { provider: 'openai', modelName: 'gpt-4o-mini' },
  MemoryAgent: { provider: 'openai', modelName: 'gpt-4o-mini' },
  Reasoning: { provider: 'openai', modelName: 'gpt-4o' },
  ScheduleAgent: { provider: 'openai', modelName: 'gpt-4o-mini' }
};

function getModel(provider: string, modelName: string): LanguageModel {
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    return anthropic(modelName) as LanguageModel;
  }
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
    // Seamless fallback to GPT-4o if Anthropic key is not configured
    return openai('gpt-4o') as LanguageModel;
  }
  return openai(modelName) as LanguageModel;
}

// Usage context optionally passed per call for DB tracking
export interface UsageContext {
  user_id?: string;
  project_id?: string;
  task_id?: string;
  task_execution_id?: string;
  agent_execution_id?: string;
}

// Cost rates per 1K tokens (USD)
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 0.005, out: 0.015 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'claude-3-5-sonnet-20240620': { in: 0.003, out: 0.015 },
  'claude-3-haiku-20240307': { in: 0.00025, out: 0.00125 },
};

async function trackCost(agent: string, modelName: string, provider: string, usage: any, context?: UsageContext) {
  if (!usage) return;
  const rates = PRICING[modelName as keyof typeof PRICING] || { in: 0, out: 0 };
  const inputTokens = usage.promptTokens || 0;
  const outputTokens = usage.completionTokens || 0;
  const cost = (inputTokens / 1000) * rates.in + (outputTokens / 1000) * rates.out;
  
  console.log(`[Cost Tracker] Agent: ${agent} | Model: ${modelName} | Tokens: ${usage.totalTokens} | Est. Cost: $${cost.toFixed(4)}`);

  // Persist to Supabase usage_events (non-blocking, fails silently in dev)
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (supabaseUrl && !supabaseUrl.includes('placeholder') && supabaseKey && context?.user_id) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('usage_events').insert({
        user_id: context.user_id,
        project_id: context.project_id,
        task_id: context.task_id,
        task_execution_id: context.task_execution_id,
        agent_execution_id: context.agent_execution_id,
        provider,
        model: modelName,
        api_type: 'llm',
        agent_type: agent,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        api_calls: 1,
        estimated_cost: parseFloat(cost.toFixed(6)),
        currency: 'USD'
      });
    }
  } catch (err) {
    // Non-critical — never block agent execution due to usage tracking failure
    console.warn('[Cost Tracker] Failed to persist usage event:', err);
  }
}

/**
 * Platform LLM Provider
 * Abstracts all model routing, fallbacks, and cost tracking.
 */
export const LLMProvider = {
  async generateObject(options: any): Promise<any> {
    const config = ROUTER_CONFIG[options.agent as AgentName];
    if (!config) throw new Error(`Model configuration not found for agent: ${options.agent}`);

    const primaryModel = getModel(config.provider, config.modelName);

    try {
      const result = await aiGenerateObject({ ...options, model: primaryModel });
      trackCost(options.agent, config.modelName, config.provider, result.usage, options.context);
      return result;
    } catch (error: any) {
      if (config.fallback) {
        console.warn(`[LLM Router] ${config.modelName} unavailable for ${options.agent}. Retrying with fallback: ${config.fallback.modelName}...`);
        const fallbackModel = getModel(config.fallback.provider, config.fallback.modelName);
        const result = await aiGenerateObject({ ...options, model: fallbackModel });
        trackCost(options.agent, config.fallback.modelName, config.fallback.provider, result.usage, options.context);
        return result;
      }
      throw error;
    }
  },

  async generateText(options: any): Promise<any> {
    const config = ROUTER_CONFIG[options.agent as AgentName];
    if (!config) throw new Error(`Model configuration not found for agent: ${options.agent}`);

    const primaryModel = getModel(config.provider, config.modelName);

    try {
      const result = await aiGenerateText({ ...options, model: primaryModel });
      trackCost(options.agent, config.modelName, config.provider, result.usage, options.context);
      return result;
    } catch (error: any) {
      if (config.fallback) {
        console.warn(`[LLM Router] ${config.modelName} unavailable for ${options.agent}. Retrying with fallback: ${config.fallback.modelName}...`);
        const fallbackModel = getModel(config.fallback.provider, config.fallback.modelName);
        const result = await aiGenerateText({ ...options, model: fallbackModel });
        trackCost(options.agent, config.fallback.modelName, config.fallback.provider, result.usage, options.context);
        return result;
      }
      throw error;
    }
  }
};
