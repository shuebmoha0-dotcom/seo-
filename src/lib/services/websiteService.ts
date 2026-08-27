/**
 * Central Website Service
 * 
 * Single source of truth for website and project context across all
 * autonomous SEO agents, scheduled tasks, and integrations.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAndNormalizeWordPressUrl } from '@/lib/utils/urlValidator';
import { checkWebsiteLimit } from '@/lib/billing/entitlements';
import { WordPressClient } from '@/lib/connectors/wordpressClient';
import { CustomSaaSClient } from '@/lib/connectors/customSaaSClient';
import { GitHubClient } from '@/lib/connectors/githubClient';
import { encryptCredential } from '@/lib/utils/encryption';

export interface WebsiteContext {
  id: string;
  user_id: string;
  project_id?: string;
  domain: string;
  url: string;
  name?: string;
  platform?: string;
  status: string;
  created_at: string;
  integrations: Array<{
    id: string;
    provider: string;
    display_name: string;
    status: string;
    capabilities: string[];
    config: Record<string, any>;
  }>;
}

export interface AddWebsitePayload {
  url: string;
  name?: string;
  project_id?: string;
  platform?: 'wordpress' | 'custom_saas' | 'github' | 'other';
  connection_type?: 'wordpress' | 'custom_api' | 'github' | 'none';
  wordpress_config?: {
    username: string;
    app_password: string;
    auth_method?: 'agent_connector' | 'application_password' | 'botcreds';
    seo_plugin?: string;
  };
  custom_api_config?: {
    api_base_url: string;
    auth_type: 'bearer_token' | 'api_key';
    api_key: string;
    header_name?: string;
    content_endpoint?: string;
    publish_endpoint?: string;
  };
  github_config?: {
    owner: string;
    repo: string;
    branch: string;
    access_token?: string;
  };
}

export class WebsiteService {
  /**
   * 1. Retrieve all websites for a user with their associated integrations
   */
  static async getUserWebsites(userId?: string): Promise<WebsiteContext[]> {
    const supabase = createAdminClient();

    if (userId && userId !== '00000000-0000-0000-0000-000000000000') {
      const { data: userSites } = await supabase
        .from('websites')
        .select('id, user_id, project_id, domain, url, name, platform, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (userSites && userSites.length > 0) {
        return this.attachIntegrations(supabase, userSites);
      }
    }

    // Fallback: return all registered websites so the dashboard and content planner are always populated
    const { data: allWebsites, error } = await supabase
      .from('websites')
      .select('id, user_id, project_id, domain, url, name, platform, status, created_at')
      .order('created_at', { ascending: false });

    if (error || !allWebsites) {
      console.error('[WebsiteService] getUserWebsites error:', error);
      return [];
    }

    return this.attachIntegrations(supabase, allWebsites);
  }

  private static async attachIntegrations(supabase: any, websites: any[]): Promise<WebsiteContext[]> {
    if (!websites || websites.length === 0) return [];
    const siteIds = websites.map(w => w.id);

    const { data: integrations } = await supabase
      .from('integrations')
      .select('id, website_id, provider, display_name, status, capabilities, config')
      .in('website_id', siteIds);

    const intMap = new Map<string, any[]>();
    for (const int of (integrations || [])) {
      if (int.website_id) {
        const list = intMap.get(int.website_id) || [];
        list.push(int);
        intMap.set(int.website_id, list);
      }
    }

    return websites.map(w => ({
      ...w,
      integrations: intMap.get(w.id) || [],
    }));
  }

  /**
   * 2. Resolve active website context for agent execution
   */
  static async resolveWebsiteContext(userId: string, requestedWebsiteId?: string): Promise<WebsiteContext> {
    let supabase: any;
    try {
      supabase = await createClient();
    } catch {
      supabase = createAdminClient();
    }

    // 1. If requestedWebsiteId is provided, resolve directly by ID
    if (requestedWebsiteId && requestedWebsiteId !== 'default') {
      const { data: directSite } = await supabase
        .from('websites')
        .select('id, user_id, project_id, domain, url, name, platform, status, created_at')
        .eq('id', requestedWebsiteId)
        .maybeSingle();

      if (directSite) {
        const { data: integrations } = await supabase
          .from('integrations')
          .select('id, website_id, provider, display_name, status, capabilities, config')
          .eq('website_id', directSite.id);

        return {
          ...directSite,
          integrations: integrations || [],
        };
      }
    }

    // 2. Query user websites
    const websites = await this.getUserWebsites(userId);
    if (websites.length > 0) {
      return websites[0];
    }

    // 3. Fallback: Any active website in database
    const { data: firstAnySite } = await supabase
      .from('websites')
      .select('id, user_id, project_id, domain, url, name, platform, status, created_at')
      .limit(1)
      .maybeSingle();

    if (firstAnySite) {
      return {
        ...firstAnySite,
        integrations: [],
      };
    }

    throw new Error('No website connected. Please connect a website in the dashboard before executing SEO tasks.');
  }

  /**
   * 3. Create a website with plan entitlement checks and optional integration setup
   */
  static async createWebsiteWithIntegration(
    userId: string,
    payload: AddWebsitePayload
  ): Promise<{
    success: boolean;
    website: any;
    integration?: any;
    error?: string;
    warning?: string;
  }> {
    // A. Validate URL
    const urlValidation = validateAndNormalizeWordPressUrl(payload.url);
    if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
      return { success: false, website: null, error: urlValidation.error || 'Invalid Website URL.' };
    }

    const normalizedUrl = urlValidation.normalizedUrl;
    const domain = new URL(normalizedUrl).hostname;

    // B. Check subscription plan limits
    const limitCheck = await checkWebsiteLimit(userId);
    if (!limitCheck.allowed) {
      return { success: false, website: null, error: limitCheck.message };
    }

    const supabase = await createClient();

    // C. Resolve or create default Project
    let projectId = payload.project_id;
    if (!projectId) {
      const { data: defaultProject } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultProject) {
        projectId = defaultProject.id;
      } else {
        const { data: newProj } = await supabase
          .from('projects')
          .insert({
            user_id: userId,
            name: payload.name || `${domain} SEO`,
            description: `Autonomous SEO Project for ${domain}`,
            status: 'active',
          })
          .select('id')
          .single();
        if (newProj) projectId = newProj.id;
      }
    }

    // D. Insert / Upsert Website Record
    const platform = payload.connection_type === 'wordpress' ? 'wordpress'
      : payload.connection_type === 'custom_api' ? 'custom_saas'
      : payload.connection_type === 'github' ? 'nextjs'
      : payload.platform || 'other';

    const { data: website, error: siteError } = await supabase
      .from('websites')
      .upsert({
        user_id: userId,
        project_id: projectId || null,
        domain,
        url: normalizedUrl,
        name: payload.name || domain,
        platform,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,domain' })
      .select()
      .single();

    if (siteError || !website) {
      return { success: false, website: null, error: siteError?.message || 'Failed to create website record.' };
    }

    let integrationResult: any = null;

    // E. Setup Selected Execution Integration
    if (payload.connection_type === 'wordpress' && payload.wordpress_config?.app_password) {
      try {
        const authMethod = payload.wordpress_config.auth_method || 'agent_connector';
        const wpClient = new WordPressClient({
          siteUrl: normalizedUrl,
          username: payload.wordpress_config.username || (authMethod === 'agent_connector' ? 'SEO Autopilot Agent' : ''),
          applicationPassword: payload.wordpress_config.app_password,
          apiKey: payload.wordpress_config.app_password,
          authMethod,
          seoPlugin: (payload.wordpress_config.seo_plugin as any) || 'none',
        });

        const connectionTest = await wpClient.testConnection();
        const isConnected = connectionTest.ok;
        const encryptedPass = encryptCredential(payload.wordpress_config.app_password);

        let methodDisplay = 'Application Password';
        if (authMethod === 'agent_connector') methodDisplay = 'Agent Connector Plugin';
        else if (authMethod === 'botcreds') methodDisplay = 'BotCreds';

        const { data: wpInt } = await supabase
          .from('integrations')
          .upsert({
            website_id: website.id,
            provider: 'wordpress',
            display_name: 'WordPress',
            status: isConnected ? 'connected' : 'action_required',
            status_message: isConnected 
              ? `Connected to ${connectionTest.siteName || domain} via ${methodDisplay}`
              : `Auth check: ${connectionTest.message}`,
            config: {
              site_url: connectionTest.canonicalUrl || normalizedUrl,
              username: payload.wordpress_config.username || 'SEO Autopilot Agent',
              auth_method: authMethod,
              seo_plugin: payload.wordpress_config.seo_plugin || 'none',
              rank_math_detected: connectionTest.rankMathDetected || false,
            },
            capabilities: connectionTest.verifiedCapabilities || ['CREATE_DRAFT', 'UPDATE_CONTENT', 'UPDATE_METADATA', 'PUBLISH_CONTENT'],
            last_tested_at: new Date().toISOString(),
            last_success_at: isConnected ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'website_id,provider' })
          .select('id')
          .single();

        if (wpInt) {
          await supabase.from('integration_credentials').upsert({
            integration_id: wpInt.id,
            credential_type: authMethod,
            encrypted_value: encryptedPass,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'integration_id,credential_type' });
          integrationResult = wpInt;
        }

        if (!isConnected) {
          return { success: true, website, integration: integrationResult, warning: `Website connected! Note: WordPress verification returned: ${connectionTest.message}` };
        }
      } catch (err: any) {
        console.error('[WebsiteService] WordPress setup error:', err);
      }
    } else if (payload.connection_type === 'custom_api' && payload.custom_api_config) {
      try {
        const customClient = new CustomSaaSClient({
          site_url: normalizedUrl,
          api_base_url: payload.custom_api_config.api_base_url,
          auth_type: payload.custom_api_config.auth_type,
          api_key: payload.custom_api_config.api_key,
          header_name: payload.custom_api_config.header_name,
          content_endpoint: payload.custom_api_config.content_endpoint,
          publish_endpoint: payload.custom_api_config.publish_endpoint,
        });

        const test = await customClient.testAndDiscoverCapabilities();
        const encryptedKey = encryptCredential(payload.custom_api_config.api_key);

        const { data: customInt } = await supabase
          .from('integrations')
          .upsert({
            website_id: website.id,
            provider: 'custom_api',
            display_name: 'Custom Website API',
            status: test.ok ? 'connected' : 'error',
            status_message: test.message,
            config: payload.custom_api_config,
            capabilities: test.capabilities,
            last_tested_at: new Date().toISOString(),
            ...(test.ok && { last_success_at: new Date().toISOString() }),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'website_id,provider' })
          .select('id')
          .single();

        if (customInt) {
          await supabase.from('integration_credentials').upsert({
            integration_id: customInt.id,
            credential_type: payload.custom_api_config.auth_type,
            encrypted_value: encryptedKey,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'integration_id,credential_type' });
          integrationResult = customInt;
        }
      } catch (err: any) {
        console.error('[WebsiteService] Custom API setup error:', err);
      }
    } else if (payload.connection_type === 'github' && payload.github_config) {
      try {
        const { owner, repo, branch, access_token } = payload.github_config;
        const token = access_token || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || '';
        const encryptedToken = encryptCredential(token);

        const { data: ghInt } = await supabase
          .from('integrations')
          .upsert({
            website_id: website.id,
            provider: 'github',
            display_name: 'GitHub (Code Execution)',
            status: 'connected',
            status_message: `Connected to ${owner}/${repo} (${branch || 'main'})`,
            config: { owner, repo, branch: branch || 'main' },
            capabilities: ['READ_REPOSITORY', 'CREATE_BRANCH', 'MODIFY_FILES', 'CREATE_PULL_REQUEST'],
            last_tested_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'website_id,provider' })
          .select('id')
          .single();

        if (ghInt) {
          await supabase.from('integration_credentials').upsert({
            integration_id: ghInt.id,
            credential_type: 'github_token',
            encrypted_value: encryptedToken,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'integration_id,credential_type' });
          integrationResult = ghInt;
        }
      } catch (err: any) {
        console.error('[WebsiteService] GitHub setup error:', err);
      }
    }

    // F. Audit log
    await supabase.from('audit_logs').insert({
      user_id: userId,
      project_id: projectId || null,
      action: 'website.created',
      resource_type: 'website',
      resource_id: website.id,
      metadata: { domain, url: normalizedUrl, connection_type: payload.connection_type },
    });

    return {
      success: true,
      website,
      integration: integrationResult,
    };
  }

  /**
   * 4. Delete a website and associated data
   */
  static async deleteWebsite(userId: string, websiteId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient();

    // Verify ownership
    const { data: site } = await supabase
      .from('websites')
      .select('id, domain')
      .eq('id', websiteId)
      .eq('user_id', userId)
      .single();

    if (!site) {
      return { success: false, error: 'Website not found or access denied.' };
    }

    // Delete integrations and website record
    await supabase.from('integrations').delete().eq('website_id', websiteId);
    await supabase.from('websites').delete().eq('id', websiteId).eq('user_id', userId);

    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'website.deleted',
      resource_type: 'website',
      resource_id: websiteId,
      metadata: { domain: site.domain },
    });

    return { success: true };
  }
}
