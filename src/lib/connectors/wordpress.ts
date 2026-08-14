/**
 * WordPress Connector
 * 
 * Uses WordPress REST API with Application Passwords (no admin password required).
 * Adapts automatically to Yoast SEO, Rank Math, or All-in-One SEO.
 * Agents never receive WordPress credentials.
 */

import type {
  IConnector, ConnectorType, Capability, ConnectorMetadata,
  GenericAction, ActionResult
} from './types';
import { ConnectorError, ConnectorErrors, ACTION_CAPABILITY_MAP } from './types';

export type WordPressSEOPlugin = 'yoast' | 'rankmath' | 'aioseo' | 'none';

interface WordPressConfig {
  site_url: string;
  app_username: string;       // WordPress username (not admin pass)
  app_password: string;       // WordPress Application Password
  seo_plugin: WordPressSEOPlugin;
  default_author_id?: number;
  media_upload_path?: string;
}

// SEO plugin field adapter
const SEO_PLUGIN_ADAPTERS: Record<WordPressSEOPlugin, {
  meta_title_field: string;
  meta_desc_field: string;
  canonical_field: string;
  robots_field?: string;
  schema_field?: string;
}> = {
  yoast: {
    meta_title_field: '_yoast_wpseo_title',
    meta_desc_field: '_yoast_wpseo_metadesc',
    canonical_field: '_yoast_wpseo_canonical',
    robots_field: '_yoast_wpseo_meta-robots-noindex',
  },
  rankmath: {
    meta_title_field: 'rank_math_title',
    meta_desc_field: 'rank_math_description',
    canonical_field: 'rank_math_canonical_url',
    robots_field: 'rank_math_robots',
    schema_field: 'rank_math_schema',
  },
  aioseo: {
    meta_title_field: '_aioseo_title',
    meta_desc_field: '_aioseo_description',
    canonical_field: '_aioseo_canonical_url',
  },
  none: {
    meta_title_field: '',
    meta_desc_field: '',
    canonical_field: '',
  },
};

export class WordPressConnector implements IConnector {
  readonly type: ConnectorType = 'wordpress';
  readonly capabilities: Set<Capability> = new Set([
    'READ_CONTENT', 'READ_SITE_STRUCTURE', 'READ_MEDIA',
    'CREATE_DRAFT', 'UPDATE_CONTENT', 'UPDATE_TITLE',
    'UPDATE_META_DESCRIPTION', 'UPDATE_METADATA', 'UPDATE_SCHEMA',
    'ADD_INTERNAL_LINK', 'ADD_MEDIA', 'UPDATE_MEDIA', 'SET_FEATURED_IMAGE',
    'PUBLISH_CONTENT', 'VERIFY_CONTENT',
  ]);

  private config: WordPressConfig;
  private adapter: typeof SEO_PLUGIN_ADAPTERS[WordPressSEOPlugin];

  constructor(config: WordPressConfig) {
    this.config = config;
    this.adapter = SEO_PLUGIN_ADAPTERS[config.seo_plugin];
  }

  private get authHeader(): string {
    const credentials = `${this.config.app_username}:${this.config.app_password}`;
    return 'Basic ' + Buffer.from(credentials).toString('base64');
  }

  private get apiBase(): string {
    return this.config.site_url.replace(/\/$/, '') + '/wp-json/wp/v2';
  }

  private async wpFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = this.apiBase + path;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (res.status === 401) throw new ConnectorError(ConnectorErrors.AUTH_REVOKED, 'WordPress Application Password rejected. Please reconnect.', false);
    if (res.status === 403) throw new ConnectorError(ConnectorErrors.PERMISSION_DENIED, 'WordPress user lacks required permissions.', false);
    if (res.status === 404) throw new ConnectorError(ConnectorErrors.NOT_FOUND, `WordPress resource not found: ${path}`, false);
    if (res.status === 429) throw new ConnectorError(ConnectorErrors.RATE_LIMITED, 'WordPress API rate limit hit. Retry shortly.', true);
    if (!res.ok) throw new ConnectorError(ConnectorErrors.CMS_ERROR, `WordPress API error ${res.status}: ${res.statusText}`, false);

    return res.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; message: string; details?: Record<string, any> }> {
    try {
      const site = await this.wpFetch<any>('/');
      const pluginInfo = this.detectSEOPlugin();
      return {
        ok: true,
        message: `Connected to "${site.name || this.config.site_url}"`,
        details: {
          site_name: site.name,
          wordpress_version: site.description,
          seo_plugin: this.config.seo_plugin,
          seo_plugin_adapter: pluginInfo,
          capabilities: [...this.capabilities],
        },
      };
    } catch (err: any) {
      return { ok: false, message: err.message || 'WordPress connection failed' };
    }
  }

  canExecute(action: string): boolean {
    const requiredCap = ACTION_CAPABILITY_MAP[action as keyof typeof ACTION_CAPABILITY_MAP];
    return requiredCap ? this.capabilities.has(requiredCap) : false;
  }

  async execute(action: GenericAction): Promise<ActionResult> {
    if (!this.canExecute(action.type)) {
      return {
        success: false,
        error: `WordPress connector does not support action: ${action.type}`,
        error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY,
      };
    }

    switch (action.type) {
      case 'get_page':      return this.getPage(action.payload);
      case 'create_draft':  return this.createDraft(action.payload);
      case 'update_title':  return this.updateTitle(action.payload);
      case 'update_meta_description': return this.updateMetaDescription(action.payload);
      case 'update_article': return this.updatePost(action.payload);
      case 'add_image':     return this.addImage(action.payload);
      case 'set_featured_image': return this.setFeaturedImage(action.payload);
      case 'publish_article': return this.publishPost(action.payload);
      case 'verify_change': return this.verifyChange(action.payload);
      case 'update_schema': return this.updateSchema(action.payload);
      default: return { success: false, error: `Action ${action.type} not yet implemented for WordPress`, error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY };
    }
  }

  private async getPage(payload: any): Promise<ActionResult> {
    try {
      const posts = await this.wpFetch<any[]>(`/posts?slug=${payload.slug || ''}&status=any`);
      if (!posts.length) {
        const pages = await this.wpFetch<any[]>(`/pages?slug=${payload.slug || ''}&status=any`);
        if (!pages.length) return { success: false, error: 'Page/post not found', error_code: ConnectorErrors.NOT_FOUND };
        return { success: true, data: { post: pages[0], type: 'page' } };
      }
      return { success: true, data: { post: posts[0], type: 'post' } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async createDraft(payload: any): Promise<ActionResult> {
    try {
      const post = await this.wpFetch<any>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          content: payload.content || '',
          status: 'draft',
          excerpt: payload.excerpt || '',
          categories: payload.category_ids || [],
          tags: payload.tag_ids || [],
        }),
      });
      // Apply SEO metadata if plugin is configured
      if (this.config.seo_plugin !== 'none' && this.adapter.meta_title_field) {
        await this.applyMetaFields(post.id, payload);
      }
      return { success: true, data: { wp_post_id: post.id, edit_url: post.link }, wp_post_id: post.id };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async updateTitle(payload: any): Promise<ActionResult> {
    try {
      const { post_id, title, seo_title } = payload;
      // Update native WP title
      await this.wpFetch<any>(`/posts/${post_id}`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
      // Update SEO plugin title if configured
      if (seo_title && this.config.seo_plugin !== 'none' && this.adapter.meta_title_field) {
        await this.wpFetch<any>(`/posts/${post_id}`, {
          method: 'POST',
          body: JSON.stringify({ meta: { [this.adapter.meta_title_field]: seo_title } }),
        });
      }
      return { success: true, data: { post_id, title_updated: true } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async updateMetaDescription(payload: any): Promise<ActionResult> {
    try {
      const { post_id, meta_description } = payload;
      if (this.config.seo_plugin === 'none' || !this.adapter.meta_desc_field) {
        return { success: false, error: 'No SEO plugin configured. Cannot update meta description via WordPress connector.', error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY };
      }
      await this.wpFetch<any>(`/posts/${post_id}`, {
        method: 'POST',
        body: JSON.stringify({ meta: { [this.adapter.meta_desc_field]: meta_description } }),
      });
      return { success: true, data: { post_id, meta_updated: true } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async updatePost(payload: any): Promise<ActionResult> {
    try {
      const { post_id, content, title } = payload;
      const updated = await this.wpFetch<any>(`/posts/${post_id}`, {
        method: 'POST',
        body: JSON.stringify({ content, ...(title ? { title } : {}) }),
      });
      return { success: true, data: { post_id, updated: true, link: updated.link } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async addImage(payload: any): Promise<ActionResult> {
    // WordPress media upload — requires multipart form
    try {
      const formData = new FormData();
      if (payload.image_blob) formData.append('file', payload.image_blob, payload.filename || 'image.webp');
      formData.append('alt_text', payload.alt_text || '');
      formData.append('title', payload.title || '');
      formData.append('caption', payload.caption || '');

      const res = await fetch(this.apiBase + '/media', {
        method: 'POST',
        headers: { 'Authorization': this.authHeader },
        body: formData,
      });
      if (!res.ok) throw new ConnectorError(ConnectorErrors.CMS_ERROR, 'Media upload failed', false);
      const media = await res.json();
      return { success: true, data: { media_id: media.id, url: media.source_url } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async setFeaturedImage(payload: any): Promise<ActionResult> {
    try {
      await this.wpFetch<any>(`/posts/${payload.post_id}`, {
        method: 'POST',
        body: JSON.stringify({ featured_media: payload.media_id }),
      });
      return { success: true, data: { post_id: payload.post_id, featured_media: payload.media_id } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async publishPost(payload: any): Promise<ActionResult> {
    try {
      const post = await this.wpFetch<any>(`/posts/${payload.post_id}`, {
        method: 'POST',
        body: JSON.stringify({ status: 'publish' }),
      });
      return { success: true, data: { post_id: payload.post_id, link: post.link, status: 'published' } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async verifyChange(payload: any): Promise<ActionResult> {
    try {
      const post = await this.wpFetch<any>(`/posts/${payload.post_id}`);
      return {
        success: true,
        verification_url: post.link,
        data: {
          title: post.title?.rendered,
          status: post.status,
          link: post.link,
          modified: post.modified,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.VERIFICATION_FAILED };
    }
  }

  private async updateSchema(payload: any): Promise<ActionResult> {
    try {
      if (this.config.seo_plugin !== 'rankmath' || !this.adapter.schema_field) {
        return { success: false, error: 'Schema update via connector only supported with Rank Math currently.', error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY };
      }
      await this.wpFetch<any>(`/posts/${payload.post_id}`, {
        method: 'POST',
        body: JSON.stringify({ meta: { [this.adapter.schema_field!]: JSON.stringify(payload.schema) } }),
      });
      return { success: true, data: { schema_updated: true } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: err.code };
    }
  }

  private async applyMetaFields(postId: number, payload: any): Promise<void> {
    const meta: Record<string, string> = {};
    if (payload.seo_title && this.adapter.meta_title_field) meta[this.adapter.meta_title_field] = payload.seo_title;
    if (payload.meta_description && this.adapter.meta_desc_field) meta[this.adapter.meta_desc_field] = payload.meta_description;
    if (payload.canonical && this.adapter.canonical_field) meta[this.adapter.canonical_field] = payload.canonical;
    if (Object.keys(meta).length > 0) {
      await this.wpFetch<any>(`/posts/${postId}`, { method: 'POST', body: JSON.stringify({ meta }) });
    }
  }

  private detectSEOPlugin(): string {
    const adapters: Record<WordPressSEOPlugin, string> = {
      yoast: 'Yoast SEO adapter active',
      rankmath: 'Rank Math adapter active',
      aioseo: 'All-in-One SEO adapter active',
      none: 'No SEO plugin configured',
    };
    return adapters[this.config.seo_plugin];
  }

  getMetadata(): ConnectorMetadata {
    return {
      type: 'wordpress',
      display_name: 'WordPress',
      icon: '🟦',
      description: 'Connect your WordPress site. Uses Application Passwords — your admin password is never required.',
      capabilities: [...this.capabilities],
      config: {
        site_url: this.config.site_url,
        seo_plugin: this.config.seo_plugin,
        username: this.config.app_username,
      },
    };
  }
}
