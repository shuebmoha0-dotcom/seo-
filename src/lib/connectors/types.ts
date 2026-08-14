/**
 * Platform-Agnostic Integration System
 * 
 * All agents interact through generic actions.
 * The execution layer determines which connector performs the work.
 * No agent contains hard-coded WordPress or GitHub logic.
 */

// ─── Capability Registry ──────────────────────────────────────────────────────

export type Capability =
  // Read capabilities
  | 'READ_CONTENT' | 'READ_SITE_STRUCTURE' | 'READ_MEDIA' | 'READ_ANALYTICS'
  | 'READ_REPOSITORY' | 'READ_FILES'
  // Write / content capabilities
  | 'CREATE_DRAFT' | 'UPDATE_CONTENT' | 'UPDATE_METADATA' | 'UPDATE_TITLE'
  | 'UPDATE_META_DESCRIPTION' | 'UPDATE_SCHEMA' | 'ADD_INTERNAL_LINK'
  | 'ADD_MEDIA' | 'UPDATE_MEDIA' | 'SET_FEATURED_IMAGE'
  // Publishing
  | 'PUBLISH_CONTENT' | 'VERIFY_CONTENT'
  // Code-based
  | 'CREATE_BRANCH' | 'MODIFY_FILES' | 'ADD_ASSETS' | 'RUN_VALIDATION'
  | 'CREATE_PULL_REQUEST' | 'VERIFY_DEPLOYMENT'
  // Data
  | 'GET_KEYWORD_DATA' | 'GET_SERP' | 'GET_COMPETITOR_DATA' | 'GET_RANKING_DATA'
  | 'GET_SEARCH_ANALYTICS' | 'GET_GA_DATA'
  // Crawler
  | 'CRAWL_URLS' | 'CRAWL_SITEMAP' | 'DETECT_TECHNOLOGY';

export type ConnectorType =
  | 'wordpress' | 'github' | 'google_search_console' | 'google_analytics'
  | 'crawler' | 'webflow' | 'shopify' | 'gitlab' | 'custom';

export type IntegrationStatus = 'connected' | 'action_required' | 'error' | 'disconnected' | 'testing';

// ─── Generic Action Types (platform-agnostic) ─────────────────────────────────

export type ActionType =
  | 'get_page'
  | 'get_site_structure'
  | 'create_article'
  | 'update_article'
  | 'update_title'
  | 'update_meta_description'
  | 'update_h1'
  | 'add_internal_link'
  | 'add_image'
  | 'set_featured_image'
  | 'update_alt_text'
  | 'update_schema'
  | 'publish_article'
  | 'verify_change'
  | 'create_draft'
  | 'update_canonical'
  | 'get_keyword_data'
  | 'get_serp'
  | 'get_competitor_data'
  | 'get_search_analytics'
  | 'get_ga_data'
  | 'crawl_site';

export interface GenericAction {
  type: ActionType;
  payload: Record<string, any>;
  proposed_by: string;         // which agent proposed this
  approval_id?: string;        // references execution_actions.id
}

export interface ActionResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  error_code?: string;
  pr_url?: string;
  pr_number?: number;
  wp_post_id?: number;
  verification_url?: string;
}

// ─── Connector Interface ──────────────────────────────────────────────────────

export interface IConnector {
  readonly type: ConnectorType;
  readonly capabilities: Set<Capability>;

  /** Test the connection and return health status */
  testConnection(): Promise<{ ok: boolean; message: string; details?: Record<string, any> }>;

  /** Check if this connector can perform the given action */
  canExecute(action: ActionType): boolean;

  /** Execute a platform-agnostic action */
  execute(action: GenericAction): Promise<ActionResult>;

  /** Get connector metadata for display */
  getMetadata(): ConnectorMetadata;
}

export interface ConnectorMetadata {
  type: ConnectorType;
  display_name: string;
  icon: string;
  description: string;
  capabilities: Capability[];
  config: Record<string, any>; // non-sensitive config only
}

// ─── Connector Error Types ────────────────────────────────────────────────────

export class ConnectorError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export const ConnectorErrors = {
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_REVOKED: 'AUTH_REVOKED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  MISSING_SCOPE: 'MISSING_SCOPE',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  UNSUPPORTED_CAPABILITY: 'UNSUPPORTED_CAPABILITY',
  INVALID_REPOSITORY: 'INVALID_REPOSITORY',
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  CMS_ERROR: 'CMS_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

// ─── Action → Capability mapping ──────────────────────────────────────────────

export const ACTION_CAPABILITY_MAP: Record<ActionType, Capability> = {
  get_page:               'READ_CONTENT',
  get_site_structure:     'READ_SITE_STRUCTURE',
  create_article:         'CREATE_DRAFT',
  update_article:         'UPDATE_CONTENT',
  update_title:           'UPDATE_TITLE',
  update_meta_description:'UPDATE_META_DESCRIPTION',
  update_h1:              'UPDATE_CONTENT',
  add_internal_link:      'ADD_INTERNAL_LINK',
  add_image:              'ADD_MEDIA',
  set_featured_image:     'SET_FEATURED_IMAGE',
  update_alt_text:        'UPDATE_MEDIA',
  update_schema:          'UPDATE_SCHEMA',
  publish_article:        'PUBLISH_CONTENT',
  verify_change:          'VERIFY_CONTENT',
  create_draft:           'CREATE_DRAFT',
  update_canonical:       'UPDATE_METADATA',
  get_keyword_data:       'GET_KEYWORD_DATA',
  get_serp:               'GET_SERP',
  get_competitor_data:    'GET_COMPETITOR_DATA',
  get_search_analytics:   'GET_SEARCH_ANALYTICS',
  get_ga_data:            'GET_GA_DATA',
  crawl_site:             'CRAWL_URLS',
};
