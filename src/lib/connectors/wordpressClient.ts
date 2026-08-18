/**
 * Production WordPress REST API Client
 * 
 * Implements full REST API discovery (/wp-json/ and /wp-json/wp/v2/),
 * URL normalization, redirect handling, Application Password authentication,
 * error classification (401, 403, 404, 429, 5xx), and Rank Math detection.
 * 
 * Credentials are never logged in plaintext or exposed to the client.
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

export interface WordPressConnectionTestResult {
  ok: boolean;
  siteName?: string;
  canonicalUrl?: string;
  username?: string;
  wpVersion?: string;
  detectedPlugin?: string;
  rankMathDetected?: boolean;
  stages: {
    restApiDetected: boolean;
    restV2Detected: boolean;
    authSuccessful: boolean;
    rankMathDetected: boolean;
  };
  message: string;
  diagnostic?: {
    httpStatus?: number;
    finalUrl?: string;
    contentType?: string;
    safeSummary?: string;
  };
}

export class WordPressClient {
  public siteUrl: string;
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
    this.applicationPassword = credentials.applicationPassword.trim().replace(/\s+/g, '');
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
  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retries = 2
  ): Promise<{ data: T; headers: Headers; status: number; finalUrl: string }> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.apiBaseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': this.authHeader,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 SEOAutopilot/1.0',
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      // Handle 401 Unauthorized
      if (response.status === 401) {
        throw new Error('WordPress authentication failed. Please check your WordPress username and Application Password.');
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        throw new Error('WordPress rejected the request. Please check user permissions or security plugin settings.');
      }

      // Handle 404 Not Found
      if (response.status === 404) {
        throw new Error(`WordPress REST endpoint was not found (HTTP 404): ${endpoint}`);
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
        let errMessage = `WordPress server returned an error (HTTP ${response.status}): ${response.statusText}`;
        try {
          const errorJson = await response.json();
          if (errorJson?.message) errMessage = errorJson.message;
        } catch {
          // ignore
        }
        throw new Error(errMessage);
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers, status: response.status, finalUrl: response.url };
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        throw new Error('WordPress site request timed out. Please check if your site is online and responsive.');
      }
      throw err;
    }
  }

  /**
   * STEP 3 & 4: Discover WordPress REST API root and follow redirects to canonical origin
   */
  async getSiteInfo(): Promise<WordPressSiteInfo> {
    const endpoints = [
      `${this.siteUrl}/wp-json/`,
      `${this.siteUrl}/?rest_route=/`,
      `${this.siteUrl}/index.php?rest_route=/`,
    ];

    let lastStatus = 0;
    let lastUrl = endpoints[0];
    let lastContentType = '';
    let lastSummary = '';

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(12000),
        });

        lastStatus = res.status;
        lastUrl = res.url || url;
        lastContentType = res.headers.get('content-type') || '';

        if (res.ok) {
          const text = await res.text();
          lastSummary = text.slice(0, 200);
          try {
            const data = JSON.parse(text);
            const namespaces: string[] = data.namespaces || [];

            // Update canonical siteUrl if redirected
            if (res.url) {
              const parsedRedirect = new URL(res.url);
              this.siteUrl = `${parsedRedirect.protocol}//${parsedRedirect.hostname}${parsedRedirect.port ? `:${parsedRedirect.port}` : ''}`;
              this.apiBaseUrl = `${this.siteUrl}/wp-json/wp/v2`;
            }

            return {
              name: data.name || new URL(this.siteUrl).hostname,
              description: data.description || '',
              url: data.url || this.siteUrl,
              home: data.home || this.siteUrl,
              gmt_offset: data.gmt_offset || '0',
              namespaces,
              rest_base: url,
              has_yoast: namespaces.includes('yoast/v1'),
              has_rankmath: namespaces.includes('rankmath/v1'),
              has_aioseo: namespaces.includes('aioseo/v1'),
            };
          } catch {
            // Not valid JSON
          }
        }
      } catch (err: any) {
        lastSummary = err.message || 'Network error';
      }
    }

    throw new Error(`WordPress REST API discovery failed (HTTP ${lastStatus || 'ERR'} on ${lastUrl}). Content-Type: ${lastContentType || 'unknown'}. Details: ${lastSummary || 'No response'}`);
  }

  /**
   * STEP 3 (Part 2): Test /wp-json/wp/v2/ endpoint
   */
  async verifyRestV2(): Promise<boolean> {
    const v2Url = `${this.siteUrl}/wp-json/wp/v2/`;
    try {
      const res = await fetch(v2Url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * STEP 6: Test Authenticated WordPress Access (/users/me)
   */
  async getCurrentUser(): Promise<WordPressUser> {
    const { data } = await this.request<any>('/users/me?context=edit');
    return {
      id: data.id,
      name: data.name || this.username,
      slug: data.slug || '',
      roles: data.roles || [],
      capabilities: data.capabilities || {},
    };
  }

  /**
   * STEP 8: Comprehensive Step-by-Step Connection Test Pipeline
   */
  async testConnection(): Promise<WordPressConnectionTestResult> {
    const stages = {
      restApiDetected: false,
      restV2Detected: false,
      authSuccessful: false,
      rankMathDetected: false,
    };

    let siteInfo: WordPressSiteInfo;

    // Stage 1: REST API Discovery (/wp-json/)
    try {
      siteInfo = await this.getSiteInfo();
      stages.restApiDetected = true;
    } catch (err: any) {
      return {
        ok: false,
        canonicalUrl: this.siteUrl,
        username: this.username,
        stages,
        message: err.message || 'REST API discovery failed on your WordPress site.',
      };
    }

    // Stage 2: REST API v2 Verification (/wp-json/wp/v2/)
    const v2Ok = await this.verifyRestV2();
    stages.restV2Detected = v2Ok;

    // Stage 3: Authenticated Request (/users/me)
    let user: WordPressUser;
    try {
      user = await this.getCurrentUser();
      stages.authSuccessful = true;
    } catch (authErr: any) {
      return {
        ok: false,
        siteName: siteInfo.name,
        canonicalUrl: this.siteUrl,
        username: this.username,
        stages,
        message: authErr.message || 'WordPress authentication failed. Please check username and Application Password.',
      };
    }

    // Stage 4: Rank Math Detection (Optional)
    const hasRankMath = siteInfo.has_rankmath;
    stages.rankMathDetected = hasRankMath;

    let detectedPlugin = this.seoPlugin;
    if (this.seoPlugin === 'none') {
      if (hasRankMath) detectedPlugin = 'rankmath';
      else if (siteInfo.has_yoast) detectedPlugin = 'yoast';
      else if (siteInfo.has_aioseo) detectedPlugin = 'aioseo';
    }

    const pluginMsg = hasRankMath ? '✓ Rank Math detected' : '○ Rank Math not detected';

    return {
      ok: true,
      siteName: siteInfo.name,
      canonicalUrl: this.siteUrl,
      username: user.name || this.username,
      detectedPlugin,
      rankMathDetected: hasRankMath,
      stages,
      message: `✓ REST API detected\n✓ Authentication successful\n✓ WordPress connected\n${pluginMsg}`,
    };
  }

  /**
   * Helper: Retrieve posts
   */
  async getPosts(params: {
    page?: number;
    per_page?: number;
    status?: string;
    search?: string;
  } = {}): Promise<any> {
    const page = params.page || 1;
    const perPage = params.per_page || 10;
    const searchParams = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      status: params.status || 'any',
      context: 'view',
    });
    if (params.search) searchParams.set('search', params.search);

    const { data, headers } = await this.request<any[]>(`/posts?${searchParams.toString()}`);
    return {
      data,
      total: parseInt(headers.get('X-WP-Total') || data.length.toString(), 10),
      totalPages: parseInt(headers.get('X-WP-TotalPages') || '1', 10),
    };
  }

  /**
   * 5. Get single post by ID
   */
  async getPost(postId: number): Promise<WordPressPostOutput> {
    const { data } = await this.request<any>(`/posts/${postId}`);
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      status: data.status,
      link: data.link,
      date: data.date,
      modified: data.modified,
      featured_media: data.featured_media || 0,
      categories: data.categories || [],
      tags: data.tags || [],
    };
  }

  /**
   * 6. Create post with SEO metadata adapter
   */
  async createPost(input: WordPressPostInput): Promise<WordPressPostOutput> {
    const payload: Record<string, any> = {
      title: input.title,
      content: input.content,
      status: input.status || 'draft',
    };

    if (input.excerpt) payload.excerpt = input.excerpt;
    if (input.slug) payload.slug = input.slug;
    if (input.category_ids?.length) payload.categories = input.category_ids;
    if (input.tag_ids?.length) payload.tags = input.tag_ids;
    if (input.featured_media) payload.featured_media = input.featured_media;

    if (this.seoPlugin === 'yoast' || this.seoPlugin === 'rankmath') {
      const meta: Record<string, any> = {};
      if (this.seoPlugin === 'yoast') {
        if (input.seo_title) meta._yoast_wpseo_title = input.seo_title;
        if (input.meta_description) meta._yoast_wpseo_metadesc = input.meta_description;
        if (input.canonical_url) meta._yoast_wpseo_canonical = input.canonical_url;
      } else if (this.seoPlugin === 'rankmath') {
        if (input.seo_title) meta.rank_math_title = input.seo_title;
        if (input.meta_description) meta.rank_math_description = input.meta_description;
        if (input.canonical_url) meta.rank_math_canonical_url = input.canonical_url;
      }
      if (Object.keys(meta).length > 0) payload.meta = meta;
    }

    const { data } = await this.request<any>('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      status: data.status,
      link: data.link,
      date: data.date,
      modified: data.modified,
      featured_media: data.featured_media || 0,
      categories: data.categories || [],
      tags: data.tags || [],
    };
  }

  /**
   * 7. Update post with SEO metadata adapter
   */
  async updatePost(postId: number, input: Partial<WordPressPostInput>): Promise<WordPressPostOutput> {
    const payload: Record<string, any> = {};
    if (input.title !== undefined) payload.title = input.title;
    if (input.content !== undefined) payload.content = input.content;
    if (input.status !== undefined) payload.status = input.status;
    if (input.excerpt !== undefined) payload.excerpt = input.excerpt;
    if (input.slug !== undefined) payload.slug = input.slug;
    if (input.category_ids) payload.categories = input.category_ids;
    if (input.tag_ids) payload.tags = input.tag_ids;
    if (input.featured_media !== undefined) payload.featured_media = input.featured_media;

    if (input.seo_title || input.meta_description || input.canonical_url) {
      const meta: Record<string, any> = {};
      if (this.seoPlugin === 'yoast') {
        if (input.seo_title) meta._yoast_wpseo_title = input.seo_title;
        if (input.meta_description) meta._yoast_wpseo_metadesc = input.meta_description;
        if (input.canonical_url) meta._yoast_wpseo_canonical = input.canonical_url;
      } else if (this.seoPlugin === 'rankmath') {
        if (input.seo_title) meta.rank_math_title = input.seo_title;
        if (input.meta_description) meta.rank_math_description = input.meta_description;
        if (input.canonical_url) meta.rank_math_canonical_url = input.canonical_url;
      }
      if (Object.keys(meta).length > 0) payload.meta = meta;
    }

    const { data } = await this.request<any>(`/posts/${postId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      slug: data.slug,
      status: data.status,
      link: data.link,
      date: data.date,
      modified: data.modified,
      featured_media: data.featured_media || 0,
      categories: data.categories || [],
      tags: data.tags || [],
    };
  }

  /**
   * 8. Delete post
   */
  async deletePost(postId: number, force = false): Promise<boolean> {
    const { data } = await this.request<any>(`/posts/${postId}?force=${force}`, {
      method: 'DELETE',
    });
    return !!data.deleted;
  }

  /**
   * 9. Upload media
   */
  async uploadMedia(params: {
    buffer: Buffer | Uint8Array;
    filename: string;
    altText?: string;
    title?: string;
    caption?: string;
  }): Promise<{ id: number; url: string; title: string }> {
    const headers: Record<string, string> = {
      'Content-Disposition': `attachment; filename="${params.filename}"`,
      'Content-Type': 'image/webp',
    };

    const { data } = await this.request<any>('/media', {
      method: 'POST',
      headers,
      body: params.buffer as any,
    });

    if (params.altText || params.title || params.caption) {
      await this.request<any>(`/media/${data.id}`, {
        method: 'POST',
        body: JSON.stringify({
          alt_text: params.altText || '',
          title: params.title || params.filename,
          caption: params.caption || '',
        }),
      });
    }

    return {
      id: data.id,
      url: data.source_url || data.guid?.rendered || '',
      title: data.title?.rendered || params.filename,
    };
  }

  /**
   * 10. Set featured image on post
   */
  async setFeaturedImage(postId: number, mediaId: number): Promise<WordPressPostOutput> {
    return this.updatePost(postId, { featured_media: mediaId });
  }

  /**
   * 11. Publish post
   */
  async publishPost(postId: number): Promise<WordPressPostOutput> {
    return this.updatePost(postId, { status: 'publish' });
  }

  /**
   * 12. Verify publication
   */
  async verifyPublication(postId: number): Promise<{
    postId: number;
    isPublished: boolean;
    url: string;
    status: string;
    title: string;
  }> {
    const post = await this.getPost(postId);
    return {
      postId: post.id,
      isPublished: post.status === 'publish',
      url: post.link,
      status: post.status,
      title: post.title.rendered,
    };
  }
}
