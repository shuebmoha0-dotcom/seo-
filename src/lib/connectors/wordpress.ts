/**
 * WordPress Connector
 * 
 * Implements IConnector for the WordPress REST API.
 * Uses WordPress Application Passwords for authentication.
 * Adapts automatically to Yoast SEO, Rank Math, or All-in-One SEO.
 * Delegates to WordPressClient for rate limiting, retry logic, and SSRF security.
 * Agents never receive or store WordPress credentials directly.
 */

import type {
  IConnector, ConnectorType, Capability, ConnectorMetadata,
  GenericAction, ActionResult
} from './types';
import { ConnectorError, ConnectorErrors, ACTION_CAPABILITY_MAP } from './types';
import { WordPressClient, WordPressSEOPlugin, WordPressAuthMethod } from './wordpressClient';

export interface WordPressConfig {
  site_url: string;
  app_username: string;       // WordPress username
  app_password: string;       // WordPress Application Password or BotCreds key
  auth_method?: WordPressAuthMethod;
  seo_plugin: WordPressSEOPlugin;
  default_author_id?: number;
  media_upload_path?: string;
}

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
  private client: WordPressClient;

  constructor(config: WordPressConfig) {
    this.config = config;
    this.client = new WordPressClient({
      siteUrl: config.site_url,
      username: config.app_username,
      applicationPassword: config.app_password,
      apiKey: config.app_password,
      authMethod: config.auth_method || 'application_password',
      seoPlugin: config.seo_plugin,
    });
  }

  async testConnection(): Promise<{ ok: boolean; message: string; details?: Record<string, any> }> {
    try {
      const test = await this.client.testConnection();
      return {
        ok: test.ok,
        message: test.message,
        details: {
          site_name: test.siteName,
          username: test.username,
          detected_plugin: test.detectedPlugin,
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
      default:
        return {
          success: false,
          error: `Action ${action.type} not supported for WordPress`,
          error_code: ConnectorErrors.UNSUPPORTED_CAPABILITY,
        };
    }
  }

  private async getPage(payload: any): Promise<ActionResult> {
    try {
      const posts = await this.client.getPosts({ search: payload.slug, per_page: 5 });
      if (!posts.data.length) {
        return { success: false, error: 'Page/post not found on WordPress', error_code: ConnectorErrors.NOT_FOUND };
      }
      return { success: true, data: { post: posts.data[0], type: 'post' } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async createDraft(payload: any): Promise<ActionResult> {
    try {
      const post = await this.client.createPost({
        title: payload.title,
        content: payload.content || '',
        status: 'draft',
        excerpt: payload.excerpt || '',
        slug: payload.slug,
        category_ids: payload.category_ids || [],
        tag_ids: payload.tag_ids || [],
        seo_title: payload.seo_title,
        meta_description: payload.meta_description,
        canonical_url: payload.canonical_url,
      });
      return {
        success: true,
        data: { wp_post_id: post.id, edit_url: post.link, status: post.status },
        wp_post_id: post.id,
      };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async updateTitle(payload: any): Promise<ActionResult> {
    try {
      const { post_id, title, seo_title } = payload;
      await this.client.updatePost(post_id, {
        title,
        seo_title,
      });
      return { success: true, data: { post_id, title_updated: true } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async updateMetaDescription(payload: any): Promise<ActionResult> {
    try {
      const { post_id, meta_description } = payload;
      await this.client.updatePost(post_id, { meta_description });
      return { success: true, data: { post_id, meta_updated: true } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async updatePost(payload: any): Promise<ActionResult> {
    try {
      const { post_id, content, title } = payload;
      const updated = await this.client.updatePost(post_id, { content, ...(title ? { title } : {}) });
      return { success: true, data: { post_id, updated: true, link: updated.link } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async addImage(payload: any): Promise<ActionResult> {
    try {
      const media = await this.client.uploadMedia({
        buffer: payload.image_blob || Buffer.from(''),
        filename: payload.filename || 'image.webp',
        altText: payload.alt_text,
        title: payload.title,
        caption: payload.caption,
      });
      return { success: true, data: { media_id: media.id, url: media.url } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async setFeaturedImage(payload: any): Promise<ActionResult> {
    try {
      await this.client.setFeaturedImage(payload.post_id, payload.media_id);
      return { success: true, data: { post_id: payload.post_id, featured_media: payload.media_id } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async publishPost(payload: any): Promise<ActionResult> {
    try {
      const post = await this.client.publishPost(payload.post_id);
      return { success: true, data: { post_id: payload.post_id, link: post.link, status: 'published' } };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.CMS_ERROR };
    }
  }

  private async verifyChange(payload: any): Promise<ActionResult> {
    try {
      const verification = await this.client.verifyPublication(payload.post_id);
      return {
        success: verification.isPublished,
        verification_url: verification.url,
        data: verification,
      };
    } catch (err: any) {
      return { success: false, error: err.message, error_code: ConnectorErrors.VERIFICATION_FAILED };
    }
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
