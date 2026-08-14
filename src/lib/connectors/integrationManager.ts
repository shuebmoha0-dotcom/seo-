/**
 * Integration Manager
 * 
 * Central registry for all connectors.
 * Agents use execute_action() with generic ActionTypes — never platform-specific APIs.
 * The manager resolves which connector handles each action.
 * Credentials are never exposed to agents.
 */

import type {
  IConnector, ConnectorType, ActionType, GenericAction,
  ActionResult, Capability, IntegrationStatus
} from './types';
import { ACTION_CAPABILITY_MAP, ConnectorError, ConnectorErrors } from './types';

export interface IntegrationHealth {
  provider: ConnectorType;
  display_name: string;
  status: IntegrationStatus;
  message: string;
  last_tested_at?: string;
  last_synced_at?: string;
  capabilities: Capability[];
}

export interface CapabilityCheckResult {
  supported: boolean;
  connector?: ConnectorType;
  message?: string;
}

export class IntegrationManager {
  private connectors = new Map<ConnectorType, IConnector>();

  /** Register a connector. Called during project initialization. */
  register(connector: IConnector): void {
    this.connectors.set(connector.type, connector);
  }

  /** Unregister a connector (e.g. after disconnect) */
  unregister(type: ConnectorType): void {
    this.connectors.delete(type);
  }

  /** Check if a capability is available, and from which connector */
  checkCapability(action: ActionType): CapabilityCheckResult {
    const requiredCapability = ACTION_CAPABILITY_MAP[action];
    if (!requiredCapability) {
      return { supported: false, message: `Unknown action type: ${action}` };
    }

    for (const [type, connector] of this.connectors) {
      if (connector.capabilities.has(requiredCapability)) {
        return { supported: true, connector: type };
      }
    }

    return {
      supported: false,
      message: `Your current integration does not support this action (requires: ${requiredCapability}). Please connect a compatible platform.`,
    };
  }

  /** Execute a generic action via the appropriate connector */
  async execute(action: GenericAction): Promise<ActionResult> {
    const check = this.checkCapability(action.type);

    if (!check.supported) {
      return {
        success: false,
        error: check.message || 'Action not supported by any connected integration.',
        error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY,
      };
    }

    const connector = this.connectors.get(check.connector!);
    if (!connector) {
      return { success: false, error: 'Connector no longer available.', error_code: ConnectorErrors.UNKNOWN };
    }

    try {
      const result = await connector.execute(action);
      return result;
    } catch (err: any) {
      if (err instanceof ConnectorError) {
        return { success: false, error: err.message, error_code: err.code };
      }
      return { success: false, error: err.message || 'Unknown connector error', error_code: ConnectorErrors.UNKNOWN };
    }
  }

  /** Run health checks on all registered connectors */
  async checkAllHealth(): Promise<IntegrationHealth[]> {
    const results: IntegrationHealth[] = [];

    for (const [type, connector] of this.connectors) {
      try {
        const meta = connector.getMetadata();
        const health = await connector.testConnection();
        results.push({
          provider: type,
          display_name: meta.display_name,
          status: health.ok ? 'connected' : 'error',
          message: health.message,
          last_tested_at: new Date().toISOString(),
          capabilities: [...connector.capabilities],
        });
      } catch (err: any) {
        const meta = connector.getMetadata();
        results.push({
          provider: type,
          display_name: meta.display_name,
          status: 'error',
          message: err.message || 'Health check failed',
          capabilities: [],
        });
      }
    }

    return results;
  }

  /** Get the execution connector for a website (WordPress or GitHub) */
  getExecutionConnector(): IConnector | null {
    return this.connectors.get('wordpress') || this.connectors.get('github') || null;
  }

  /** Get all registered connectors */
  getAll(): IConnector[] {
    return [...this.connectors.values()];
  }

  /** Get a specific connector */
  get(type: ConnectorType): IConnector | undefined {
    return this.connectors.get(type);
  }

  /** Check if a connector is registered */
  has(type: ConnectorType): boolean {
    return this.connectors.has(type);
  }

  /** Get all available capabilities across connected integrations */
  getAllCapabilities(): Set<Capability> {
    const all = new Set<Capability>();
    for (const connector of this.connectors.values()) {
      connector.capabilities.forEach(c => all.add(c));
    }
    return all;
  }

  /** List which connector handles each available action */
  getActionMap(): Record<string, ConnectorType> {
    const map: Record<string, ConnectorType> = {};
    for (const [type, connector] of this.connectors) {
      for (const [action, cap] of Object.entries(ACTION_CAPABILITY_MAP)) {
        if (connector.capabilities.has(cap as Capability) && !map[action]) {
          map[action] = type;
        }
      }
    }
    return map;
  }
}

// Singleton for use across the application
let _manager: IntegrationManager | null = null;

export function getIntegrationManager(): IntegrationManager {
  if (!_manager) _manager = new IntegrationManager();
  return _manager;
}

export function resetIntegrationManager(): void {
  _manager = null;
}
