/**
 * Production WordPress REST API Client
 * 
 * Uses WordPress Application Passwords for authentication.
 * Handles API discovery, rate limiting, retries with exponential backoff,
 * media uploads, SEO metadata adapters, and publishing verification.
 * 
 * Credentials are never logged or exposed to agents or frontend.
 */

import { validateAndNormalizeWordPressUrl } from '@/lib/utils/urlValidator';

export type WordPressSEOPlugin = 'yoast' | 'rankmath' | 'aioseo' | 'none';

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  seoPlugin?: WordPressSEOPlugin;
}

export interface WordPressSiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  gmt_offset: string;
  namespaces: string[];
  rest_base: string;
  has_yoast: boolean;
  has_rankmath: boolean;
  has_aioseo: boolean;
}

export interface WordPressUser {
  id: number;
  name: string;
  slug: string;
  roles: string[];
  capabilities: Record<string, boolean>;
}

export interface WordPressPostInput {
  title: string;
  content: string;
  excerpt?: string;
  slug?: string;
  status?: 'draft' | 'publish' | 'pending' | 'future' | 'private';
  category_ids?: number[];
  tag_ids?: number[];
  featured_media?: number;
  author_id?: number;
  seo_title?: string;
  meta_description?: string;
  canonical_url?: string;
  schema?: Record<string, any>;
}

export interface WordPressPostOutput {
  id: number;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string };
  slug: string;
  status: string;
  link: string;
  date: string;
  modified: string;
  featured_media: number;
  categories: number[];
  tags: number[];
}

export interface WordPressPaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;
  page: number;
  perPage: number;
}

export class WordPressClient {
  private siteUrl: string;
  private username: string;
  private applicationPassword: string;
  private seoPlugin: WordPressSEOPlugin;
  private apiBaseUrl: string;

  constructor(credentials: WordPressCredentials) {
    const urlValidation = validateAndNormalizeWordPressUrl(credentials.siteUrl);
    if (!urlValidation.isValid || !urlValidation.normalizedUrl) {
      throw new Error(urlValidation.error || 'Invalid WordPress site URL.');
    }

    this.siteUrl = urlValidation.normalizedUrl;
    this.username = credentials.username.trim();
    this.applicationPassword = credentials.applicationPassword.trim();
    this.seoPlugin = credentials.seoPlugin || 'none';
    this.apiBaseUrl = `${this.siteUrl}/wp-json/wp/v2`;
  }

  private get authHeader(): string {
    // WordPress Application Passwords use Basic Auth format: username:app_password
    const token = Buffer.from(`${this.username}:${this.applicationPassword}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Safe fetch with retries on 429/5xx, timeouts, and sanitized error messages
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<{ data: T; headers: Headers }> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
      'User-Agent': 'SEOAutopilot-WordPressConnector/1.0',
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      // Handle 401 Unauthorized (invalid application password or username)
      if (response.status === 401) {
        throw new Error('Authentication failed: Invalid WordPress username or Application Password.');
      }

      // Handle 403 Forbidden (user lacks edit permissions)
      if (response.status === 403) {
        throw new Error('Permission denied: The WordPress user does not have permission to perform this action.');
      }

      // Handle 404 Not Found
      if (response.status === 404) {
        throw new Error(`WordPress resource not found (404). Endpoint: ${endpoint}`);
      }

      // Handle 429 Rate Limiting with exponential backoff
      if (response.status === 429 && retries > 0) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '2', 10);
        await new Promise(res => setTimeout(res, (retryAfter || 2) * 1000));
        return this.request<T>(endpoint, options, retries - 1);
      }

      // Handle 5xx Server Errors with backoff
      if (response.status >= 500 && retries > 0) {
        await new Promise(res => setTimeout(res, 1500));
        return this.request<T>(endpoint, options, retries - 1);
      }

      if (!response.ok) {
        let errMessage = `WordPress error (${response.status}): ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson?.message) errMessage = errorJson.message;
        } catch {
          // ignore parsing error
        }
        throw new Error(errMessage);
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers };
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        throw new Error('WordPress site request timed out. Please check if your site is online and responsive.');
      }
      throw err;
    }
  }

  /**
   * 1. Discover WordPress REST API and retrieve site details
   */
  async getSiteInfo(): Promise<WordPressSiteInfo> {
    const discoveryUrl = `${this.siteUrl}/wp-json/`;
    const res = await fetch(discoveryUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error('WordPress REST API not found. Please ensure the REST API is enabled on your WordPress site.');
    }

    const data = await res.json();
    const namespaces: string[] = data.namespaces || [];

    return {
      name: data.name || 'WordPress Site',
      description: data.description || '',
      url: data.url || this.siteUrl,
      home: data.home || this.siteUrl,
      gmt_offset: data.gmt_offset || '0',
      namespaces,
      rest_base: discoveryUrl,
      has_yoast: namespaces.includes('yoast/v1'),
      has_rankmath: namespaces.includes('rankmath/v1'),
      has_aioseo: namespaces.includes('aioseo/v1'),
    };
  }

  /**
   * 2. Verify credentials and get current user info with permissions
   */
  async getCurrentUser(): Promise<WordPressUser> {
    const { data } = await this.request<any>('/users/me?context=edit');
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      roles: data.roles || [],
      capabilities: data.capabilities || {},
    };
  }

  /**
   * 3. Comprehensive Connection Test
   */
  async testConnection(): Promise<{
    ok: boolean;
    siteName?: string;
    username?: string;
    wpVersion?: string;
    detectedPlugin?: string;
    message: string;
  }> {
    try {
      // Step A: Check REST discovery
      const siteInfo = await this.getSiteInfo();

      // Step B: Check authenticated user
      const user = await this.getCurrentUser();

      // Step C: Auto-detect SEO Plugin if not manually set
      let detectedPlugin = this.seoPlugin;
      if (this.seoPlugin === 'none') {
        if (siteInfo.has_yoast) detectedPlugin = 'yoast';
        else if (siteInfo.has_rankmath) detectedPlugin = 'rankmath';
        else if (siteInfo.has_aioseo) detectedPlugin = 'aioseo';
      }

      return {
        ok: true,
        siteName: siteInfo.name,
        username: user.name || this.username,
        detectedPlugin,
        message: `Successfully connected to ${siteInfo.name} as ${user.name || this.username}.`,
      };
    } catch (error: any) {
      return {
        ok: false,
        message: error.message || 'Connection test failed. Please verify your site URL and Application Password.',
      };
    }
  }

  /**
   * 4. Retrieve Posts with pagination
   */
  async getPosts(params: {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
    categories?: number[];
    tags?: number[];
  } = {}): Promise<WordPressPaginatedResult<WordPressPostOutput>> {
    const page = params.page || 1;
    const perPage = Math.min(params.per_page || 10, 50);
    const searchParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      status: params.status || 'any',
      context: 'view',
    });

    if (params.search) searchParams.set('search', params.search);
    if (params.categories?.length) searchParams.set('categories', params.categories.join(','));
    if (params.tags?.length) searchParams.set('tags', params.tags.join(','));

    const { data, headers } = await this.request<WordPressPostOutput[]>(`/posts?${searchParams.toString()}`);

    const total = parseInt(headers.get('X-WP-Total') || data.length.toString(), 10);
    const totalPages = parseInt(headers.get('X-WP-TotalPages') || '1', 10);

    return {
      data,
      total,
      totalPages,
      page,
      perPage,
    };
  }

  /**
   * 5. Get a single post by ID
   */
  async getPost(postId: number): Promise<WordPressPostOutput> {
    const { data } = await this.request<WordPressPostOutput>(`/posts/${postId}?context=edit`);
    return data;
  }

  /**
   * 6. Create a Post (Default status = 'draft')
   */
  async createPost(input: WordPressPostInput): Promise<WordPressPostOutput> {
    const body: Record<string, any> = {
      title: input.title,
      content: input.content,
      status: input.status || 'draft',
      ...(input.excerpt ? { excerpt: input.excerpt } : {}),
      ...(input.slug ? { slug: input.slug } : {}),
      ...(input.category_ids?.length ? { categories: input.category_ids } : {}),
      ...(input.tag_ids?.length ? { tags: input.tag_ids } : {}),
      ...(input.featured_media ? { featured_media: input.featured_media } : {}),
      ...(input.author_id ? { author: input.author_id } : {}),
    };

    // Apply SEO plugin metadata fields
    const meta = this.buildSEOMetaFields(input);
    if (Object.keys(meta).length > 0) {
      body.meta = meta;
    }

    const { data } = await this.request<WordPressPostOutput>('/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return data;
  }

  /**
   * 7. Update an existing Post
   */
  async updatePost(postId: number, input: Partial<WordPressPostInput>): Promise<WordPressPostOutput> {
    const body: Record<string, any> = {};
    if (input.title !== undefined) body.title = input.title;
    if (input.content !== undefined) body.content = input.content;
    if (input.excerpt !== undefined) body.excerpt = input.excerpt;
    if (input.status !== undefined) body.status = input.status;
    if (input.slug !== undefined) body.slug = input.slug;
    if (input.category_ids !== undefined) body.categories = input.category_ids;
    if (input.tag_ids !== undefined) body.tags = input.tag_ids;
    if (input.featured_media !== undefined) body.featured_media = input.featured_media;

    const meta = this.buildSEOMetaFields(input as WordPressPostInput);
    if (Object.keys(meta).length > 0) {
      body.meta = meta;
    }

    const { data } = await this.request<WordPressPostOutput>(`/posts/${postId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return data;
  }

  /**
   * 8. Publish an approved Post
   */
  async publishPost(postId: number): Promise<WordPressPostOutput> {
    const { data } = await this.request<WordPressPostOutput>(`/posts/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'publish' }),
    });

    return data;
  }

  /**
   * 9. Verify Publication
   */
  async verifyPublication(postId: number): Promise<{
    isPublished: boolean;
    url: string;
    title: string;
    publishedAt: string;
  }> {
    const post = await this.getPost(postId);
    const isPublished = post.status === 'publish';

    return {
      isPublished,
      url: post.link,
      title: post.title.rendered,
      publishedAt: post.date,
    };
  }

  /**
   * 10. Upload Media Asset (Image / Document)
   */
  async uploadMedia(params: {
    buffer: Buffer | Blob | Uint8Array;
    filename: string;
    mimeType?: string;
    title?: string;
    altText?: string;
    caption?: string;
  }): Promise<{ id: number; url: string; title: string }> {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const mime = params.mimeType || 'image/webp';

    // Build raw multipart form data payload
    const formData = new FormData();
    const blob = params.buffer instanceof Blob 
      ? params.buffer 
      : new Blob([params.buffer as any], { type: mime });

    formData.append('file', blob, params.filename);
    if (params.title) formData.append('title', params.title);
    if (params.altText) formData.append('alt_text', params.altText);
    if (params.caption) formData.append('caption', params.caption);

    const res = await fetch(`${this.apiBaseUrl}/media`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!res.ok) {
      let errText = `Media upload failed (${res.status})`;
      try {
        const json = await res.json();
        if (json.message) errText = json.message;
      } catch {}
      throw new Error(errText);
    }

    const data = await res.json();
    return {
      id: data.id,
      url: data.source_url || data.guid?.rendered || '',
      title: data.title?.rendered || params.filename,
    };
  }

  /**
   * 11. Helper to attach a featured image to a post
   */
  async setFeaturedImage(postId: number, mediaId: number): Promise<void> {
    await this.request(`/posts/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ featured_media: mediaId }),
    });
  }

  /**
   * 12. Read Categories & Tags
   */
  async getCategories(): Promise<Array<{ id: number; name: string; slug: string; count: number }>> {
    const { data } = await this.request<any[]>('/categories?per_page=100');
    return data.map(c => ({ id: c.id, name: c.name, slug: c.slug, count: c.count }));
  }

  async getTags(): Promise<Array<{ id: number; name: string; slug: string; count: number }>> {
    const { data } = await this.request<any[]>('/tags?per_page=100');
    return data.map(t => ({ id: t.id, name: t.name, slug: t.slug, count: t.count }));
  }

  /**
   * Helper to construct SEO metadata fields for Yoast, Rank Math, or All-in-One SEO
   */
  private buildSEOMetaFields(input: WordPressPostInput): Record<string, any> {
    const meta: Record<string, any> = {};

    if (this.seoPlugin === 'yoast') {
      if (input.seo_title) meta._yoast_wpseo_title = input.seo_title;
      if (input.meta_description) meta._yoast_wpseo_metadesc = input.meta_description;
      if (input.canonical_url) meta._yoast_wpseo_canonical = input.canonical_url;
    } else if (this.seoPlugin === 'rankmath') {
      if (input.seo_title) meta.rank_math_title = input.seo_title;
      if (input.meta_description) meta.rank_math_description = input.meta_description;
      if (input.canonical_url) meta.rank_math_canonical_url = input.canonical_url;
      if (input.schema) meta.rank_math_schema = JSON.stringify(input.schema);
    } else if (this.seoPlugin === 'aioseo') {
      if (input.seo_title) meta._aioseo_title = input.seo_title;
      if (input.meta_description) meta._aioseo_description = input.meta_description;
      if (input.canonical_url) meta._aioseo_canonical_url = input.canonical_url;
    }

    return meta;
  }
}
