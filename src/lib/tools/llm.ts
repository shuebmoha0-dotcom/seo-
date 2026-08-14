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
  if (provider === 'anthropic') return anthropic(modelName) as LanguageModel;
  return openai(modelName) as LanguageModel;
}

// Cost tracking (mock rates for example)
const PRICING = {
  'gpt-4o': { in: 0.005, out: 0.015 },
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'claude-3-5-sonnet-20240620': { in: 0.003, out: 0.015 }
};

function trackCost(agent: string, modelName: string, usage: any) {
  if (!usage) return;
  const rates = PRICING[modelName as keyof typeof PRICING] || { in: 0, out: 0 };
  const cost = ((usage.promptTokens || 0) / 1000) * rates.in + ((usage.completionTokens || 0) / 1000) * rates.out;
  console.log(`[Cost Tracker] Agent: ${agent} | Model: ${modelName} | Tokens: ${usage.totalTokens} | Est. Cost: $${cost.toFixed(4)}`);
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
      trackCost(options.agent, config.modelName, result.usage);
      return result;
    } catch (error: any) {
      if (config.fallback) {
        console.warn(`[LLM Router] ${config.modelName} unavailable for ${options.agent}. Retrying with fallback: ${config.fallback.modelName}...`);
        const fallbackModel = getModel(config.fallback.provider, config.fallback.modelName);
        const result = await aiGenerateObject({ ...options, model: fallbackModel });
        trackCost(options.agent, config.fallback.modelName, result.usage);
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
      trackCost(options.agent, config.modelName, result.usage);
      return result;
    } catch (error: any) {
      if (config.fallback) {
        console.warn(`[LLM Router] ${config.modelName} unavailable for ${options.agent}. Retrying with fallback: ${config.fallback.modelName}...`);
        const fallbackModel = getModel(config.fallback.provider, config.fallback.modelName);
        const result = await aiGenerateText({ ...options, model: fallbackModel });
        trackCost(options.agent, config.fallback.modelName, result.usage);
        return result;
      }
      throw error;
    }
  }
};
