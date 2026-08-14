import { WebsiteCrawler } from './crawler';
import { GenericAction } from './types';

export type PermissionLevel = 0 | 1 | 2 | 3 | 4;

export interface ExecutionLimits {
  max_actions_per_run: number;
  max_content_changes_per_day: number;
  max_articles_per_day: number;
  max_execution_cost: number;
  max_runtime_seconds: number;
}

export interface StateMachineLog {
  state: 'OBSERVE' | 'ANALYZE' | 'PRIORITIZE' | 'PLAN' | 'PERMISSION_CHECK' | 'EXECUTE' | 'VERIFY' | 'LEARN' | 'NEXT_TASK';
  description: string;
  timestamp: string;
  status: 'completed' | 'failed' | 'gated';
}

export interface VerificationResult {
  verified: boolean;
  expected: string;
  actual: string | null;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
}

export class AutonomousEngine {
  private crawler: WebsiteCrawler;

  constructor() {
    this.crawler = new WebsiteCrawler('Autonomous-Verification-Agent/2.0');
  }

  // 1. Level 0-4 Permission Gating System
  checkPermission(
    actionType: GenericAction['type'],
    userPermissionLevel: PermissionLevel
  ): { isAllowed: boolean; riskLevel: number; reason: string } {
    
    // Risk level mapping
    let actionRiskLevel = 1;

    if (['update_title', 'update_meta_description', 'add_internal_link'].includes(actionType)) {
      actionRiskLevel = 1; // Low risk
    } else if (['update_content', 'create_schema', 'create_content'].includes(actionType)) {
      actionRiskLevel = 2; // Medium risk
    } else if (['update_robots_txt', 'update_canonical'].includes(actionType)) {
      actionRiskLevel = 3; // Publishing / Infrastructure
    } else {
      actionRiskLevel = 4; // High risk (URL changes, redirects, deletions)
    }

    // High risk Level 4 actions NEVER execute automatically
    if (actionRiskLevel === 4) {
      return {
        isAllowed: false,
        riskLevel: 4,
        reason: 'High-risk action (Level 4) requires mandatory human approval.'
      };
    }

    if (userPermissionLevel >= actionRiskLevel) {
      return {
        isAllowed: true,
        riskLevel: actionRiskLevel,
        reason: `Action risk (Level ${actionRiskLevel}) is within configured site permission limit (Level ${userPermissionLevel}).`
      };
    }

    return {
      isAllowed: false,
      riskLevel: actionRiskLevel,
      reason: `Action risk (Level ${actionRiskLevel}) exceeds site permission limit (Level ${userPermissionLevel}). Human approval required.`
    };
  }

  // 2. Post-Execution Verification Engine (No fake success)
  async verifyExecution(
    targetUrl: string,
    actionType: GenericAction['type'],
    expectedContent: string
  ): Promise<VerificationResult> {
    try {
      const pageData = await this.crawler.crawlPage(targetUrl, new URL(targetUrl).hostname);

      if (pageData.http_status !== 200) {
        return {
          verified: false,
          expected: expectedContent,
          actual: null,
          status: 'FAILED',
          error: `HTTP ${pageData.http_status} server error during verification.`
        };
      }

      let actualContent: string | null = null;

      if (actionType === 'update_title') {
        actualContent = pageData.title;
      } else if (actionType === 'update_meta_description') {
        actualContent = pageData.meta_description;
      } else {
        actualContent = pageData.h1[0] || pageData.body_text;
      }

      // Check if actual content contains or matches expected change
      const verified = actualContent !== null && (
        actualContent.includes(expectedContent) || expectedContent.includes(actualContent)
      );

      return {
        verified,
        expected: expectedContent,
        actual: actualContent,
        status: verified ? 'SUCCESS' : 'FAILED',
        error: verified ? undefined : 'Extracted element does not match expected modification string.'
      };
    } catch (error: any) {
      return {
        verified: false,
        expected: expectedContent,
        actual: null,
        status: 'FAILED',
        error: error.message || 'Verification crawl failed.'
      };
    }
  }

  // 3. Pre-Change Snapshot & Rollback Helper
  createSnapshot(filePath: string, targetUrl: string, beforeContent: string, afterContent: string) {
    return {
      id: `rb_${Date.now()}`,
      file_path: filePath,
      target_url: targetUrl,
      content_before: beforeContent,
      content_after: afterContent,
      created_at: new Date().toISOString()
    };
  }
}
