import { TextRouter, UsageContext, TaskComplexity } from '../ai/textRouter';
import { AI_CONFIG, PRICING_RATES } from '../ai/config';

export type AgentName =
  | 'Orchestrator'
  | 'StrategyAgent'
  | 'CompetitorAgent'
  | 'KeywordAgent'
  | 'ContentAgent'
  | 'OnPageAgent'
  | 'TechnicalSEOAgent'
  | 'InternalLinkingAgent'
  | 'BacklinkAgent'
  | 'MonitoringAgent'
  | 'Executor'
  | 'ImageAgent'
  | 'MemoryAgent'
  | 'Reasoning'
  | 'ScheduleAgent';

export type { UsageContext, TaskComplexity };

/**
 * Platform LLM Provider
 * Unified entrypoint that delegates to the centralized Text Model Router.
 * Enforces GPT-5.6 Luna (default) and Claude Sonnet 5 (high complexity) routing & failovers.
 */
export const LLMProvider = {
  /**
   * Generates structured output using Zod schemas with automatic complexity evaluation & failover
   */
  async generateObject<T = any>(options: {
    agent: AgentName | string;
    schema: any;
    prompt?: string;
    system?: string;
    messages?: any[];
    taskType?: string;
    complexity?: TaskComplexity;
    context?: UsageContext;
    [key: string]: any;
  }): Promise<{ object: T; usage: any; model: string; provider: string }> {
    return TextRouter.generateObject<T>(options);
  },

  /**
   * Generates free-form text output with automatic complexity evaluation & failover
   */
  async generateText(options: {
    agent: AgentName | string;
    prompt?: string;
    system?: string;
    messages?: any[];
    taskType?: string;
    complexity?: TaskComplexity;
    context?: UsageContext;
    [key: string]: any;
  }): Promise<{ text: string; usage: any; model: string; provider: string }> {
    return TextRouter.generateText(options);
  },
};

export { TextRouter, AI_CONFIG, PRICING_RATES };
