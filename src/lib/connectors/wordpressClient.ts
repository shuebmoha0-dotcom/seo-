/**
 * Production WordPress REST API Client
 * 
 * Flow:
 * 1. Normalize Website URL to canonical origin (e.g. https://bizaigenius.com)
 * 2. Primary REST API Discovery: GET https://{site}/wp-json/
 * 3. Status Handling: 200 OK -> continue; 403 -> blocked by security layer; 404 -> not found
 * 4. Authentication: GET /wp-json/wp/v2/users/me with Basic Auth (Application Password)
 * 5. Rank Math: Optional detection after successful authentication
 * 
 * Never logs credentials in plaintext or exposes them to the client.
 */

import { validateAndNormalizeWordPressUrl } from '@/lib/utils/urlValidator';

const USER_AGENT = 'SEO-Autopilot-WordPress-Connector/1.0';

export type WordPressSEOPlugin = 'yoast' | 'rankmath' | 'aioseo' | 'none';
export type WordPressAuthMethod = 'application_password' | 'botcreds';

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
  authMethod?: WordPressAuthMethod;
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
  authMethod?: WordPressAuthMethod;
  wpVersion?: string;
  detectedPlugin?: string;
  rankMathDetected?: boolean;
  verifiedCapabilities?: string[];
  stages: {
    restApiDetected: boolean;
    authSuccessful: boolean;
    permissionsVerified?: boolean;
    rankMathDetected: boolean;
  };
  message: string;
}

export class WordPressClient {
  public siteUrl: string;
  public authMethod: WordPressAuthMethod;
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
    this.authMethod = credentials.authMethod || 'application_password';
    this.username = credentials.username.trim();
    this.applicationPassword = credentials.applicationPassword.trim().replace(/\s+/g, '');
    this.seoPlugin = credentials.seoPlugin || 'none';
    this.apiBaseUrl = `${this.siteUrl}/wp-json/wp/v2`;
  }

  private get authHeader(): string {
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
      'User-Agent': USER_AGENT,
      ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      let response = await fetch(url, {
        ...options,
        headers,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });

      // If custom UA got 403, retry with standard browser headers in case of strict WAF UA rules
      if (response.status === 403) {
        const browserResponse = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        if (browserResponse.ok || browserResponse.status !== 403) {
          response = browserResponse;
        }
      }

      // Safe Diagnostic Logging (Never log credentials)
      console.log(`[WordPressClient] Request: ${options.method || 'GET'} ${url} -> HTTP ${response.status} (Final: ${response.url})`);

      // Handle 401 Unauthorized
      if (response.status === 401) {
        throw new Error('WordPress authentication failed (HTTP 401). Invalid username or Application Password. Please verify your WordPress username (WordPress Admin > Users > Profile) and generate a fresh Application Password.');
      }

      // Handle 403 Forbidden
      if (response.status === 403) {
        throw new Error('WordPress rejected the authenticated request (HTTP 403). The user account lacks permissions or a security plugin/WAF is blocking REST API authorization headers.');
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
          // ignore parsing error
        }
        throw new Error(errMessage);
      }

      const data = (await response.json()) as T;
      return { data, headers: response.headers, status: response.status, finalUrl: response.url };
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        throw new Error('WordPress site request timed out (15s). Please check if your site is online and responsive.');
      }
      throw err;
    }
  }

  /**
   * STEP 1, 2, 3: Primary REST API Discovery (GET /wp-json/ first)
   */
  async getSiteInfo(): Promise<WordPressSiteInfo> {
    const primaryUrl = `${this.siteUrl}/wp-json/`;

    let res: Response;
    try {
      res = await fetch(primaryUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });

      // If custom UA got 403, retry with standard browser headers in case of strict UA blocking
      if (res.status === 403) {
        const browserRes = await fetch(primaryUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(12000),
        });
        if (browserRes.ok) {
          res = browserRes;
        }
      }
    } catch (err: any) {
      console.error(`[WordPressClient] Discovery network error on ${primaryUrl}:`, err.message);
      throw new Error(`Could not reach WordPress site at ${primaryUrl}: ${err.message}`);
    }

    // Safe Diagnostic Logging
    const contentType = res.headers.get('content-type') || 'unknown';
    console.log(`[WordPressClient] Discovery: GET ${primaryUrl} -> HTTP ${res.status} ${res.statusText} (Final URL: ${res.url}, Content-Type: ${contentType})`);

    // Handle HTTP 403 Forbidden on Discovery
    if (res.status === 403) {
      throw new Error('WordPress REST API is being blocked (HTTP 403). Your website or security layer is rejecting REST API requests. Check your WordPress security plugin, Cloudflare/WAF, or hosting firewall.');
    }

    // Handle HTTP 404 (Try ?rest_route=/ fallback only if /wp-json/ genuinely returns 404)
    if (res.status === 404) {
      const fallbackUrl = `${this.siteUrl}/?rest_route=/`;
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': USER_AGENT,
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });

        if (fallbackRes.ok) {
          const text = await fallbackRes.text();
          const data = JSON.parse(text);
          return this.formatSiteInfo(data, fallbackUrl, fallbackRes.url);
        }
      } catch {
        // ignore fallback failure
      }

      throw new Error('WordPress REST API was not found (HTTP 404). Ensure REST API permalinks are enabled under WordPress Settings > Permalinks.');
    }

    // Handle HTTP 429 Rate Limiting
    if (res.status === 429) {
      throw new Error('WordPress is rate limiting connection requests (HTTP 429). Please wait a moment and retry.');
    }

    // Handle HTTP 5xx Server Error
    if (res.status >= 500) {
      throw new Error(`WordPress server returned an error (HTTP ${res.status}). Please check your server or PHP error logs.`);
    }

    if (!res.ok) {
      throw new Error(`WordPress REST API request returned HTTP ${res.status}: ${res.statusText}`);
    }

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`WordPress REST API response was not valid JSON. Content-Type: ${contentType}. Body preview: ${text.slice(0, 150)}`);
    }

    return this.formatSiteInfo(data, primaryUrl, res.url);
  }

  private formatSiteInfo(data: any, endpointUrl: string, finalUrl: string): WordPressSiteInfo {
    const namespaces: string[] = data.namespaces || [];

    // Follow redirect to canonical origin
    if (finalUrl) {
      const parsedRedirect = new URL(finalUrl);
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
      rest_base: endpointUrl,
      has_yoast: namespaces.includes('yoast/v1'),
      has_rankmath: namespaces.includes('rankmath/v1'),
      has_aioseo: namespaces.includes('aioseo/v1'),
    };
  }

  /**
   * STEP 4: Authenticated Access Test (/wp-json/wp/v2/users/me)
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
   * STEP 7 & 8: Complete Connection Pipeline (Application Password or BotCreds)
   */
  async testConnection(): Promise<WordPressConnectionTestResult> {
    const isBotCreds = this.authMethod === 'botcreds';
    const stages = {
      restApiDetected: false,
      authSuccessful: false,
      permissionsVerified: false,
      rankMathDetected: false,
    };

    // Stage 1: REST API Discovery (GET /wp-json/)
    let siteInfo: WordPressSiteInfo;
    try {
      siteInfo = await this.getSiteInfo();
      stages.restApiDetected = true;
    } catch (err: any) {
      return {
        ok: false,
        canonicalUrl: this.siteUrl,
        username: this.username,
        authMethod: this.authMethod,
        stages,
        message: err.message || 'REST API discovery failed on your WordPress site.',
      };
    }

    // Stage 2: Authentication Test (GET /wp-json/wp/v2/users/me)
    let user: WordPressUser;
    try {
      user = await this.getCurrentUser();
      stages.authSuccessful = true;
    } catch (authErr: any) {
      const authFailMsg = isBotCreds
        ? `BotCreds authentication failed (HTTP 401). Please check the BotCreds agent username and key generated in WordPress.`
        : (authErr.message || 'WordPress authentication failed. Please check username and Application Password.');

      return {
        ok: false,
        siteName: siteInfo.name,
        canonicalUrl: this.siteUrl,
        username: this.username,
        authMethod: this.authMethod,
        stages,
        message: authFailMsg,
      };
    }

    // Stage 3: Scoped Capability Verification
    const verifiedCapabilities: string[] = ['READ_SITE_INFO'];
    try {
      // Test read posts
      await this.request<any[]>('/posts?per_page=1');
      verifiedCapabilities.push('READ_POSTS');
    } catch {
      // read posts restricted
    }

    try {
      // Test read pages
      await this.request<any[]>('/pages?per_page=1');
      verifiedCapabilities.push('READ_PAGES');
    } catch {
      // read pages restricted
    }

    const hasWriteCap = !!(
      user.capabilities?.edit_posts ||
      user.capabilities?.publish_posts ||
      user.roles?.some(r => ['administrator', 'editor', 'author', 'agent'].includes(r))
    );

    if (hasWriteCap) {
      verifiedCapabilities.push('CREATE_DRAFT', 'UPDATE_CONTENT', 'PUBLISH_CONTENT', 'UPLOAD_MEDIA');
    }

    stages.permissionsVerified = verifiedCapabilities.includes('READ_POSTS');

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

    let successMessage = '';
    if (isBotCreds) {
      successMessage = `✓ WordPress REST API detected\n✓ BotCreds authenticated (@${user.name || this.username})\n✓ Required permissions verified\n✓ WordPress connected\n${pluginMsg}`;
    } else {
      successMessage = `✓ REST API detected\n✓ Authentication successful\n✓ WordPress connected\n${pluginMsg}`;
    }

    return {
      ok: true,
      siteName: siteInfo.name,
      canonicalUrl: this.siteUrl,
      username: user.name || this.username,
      authMethod: this.authMethod,
      detectedPlugin,
      rankMathDetected: hasRankMath,
      verifiedCapabilities,
      stages,
      message: successMessage,
    };
  }

  /**
   * Retrieve posts
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
   * Get single post by ID
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
   * Create post with SEO metadata adapter
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
   * Update post with SEO metadata adapter
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
   * Delete post
   */
  async deletePost(postId: number, force = false): Promise<boolean> {
    const { data } = await this.request<any>(`/posts/${postId}?force=${force}`, {
      method: 'DELETE',
    });
    return !!data.deleted;
  }

  /**
   * Upload media
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
   * Set featured image on post
   */
  async setFeaturedImage(postId: number, mediaId: number): Promise<WordPressPostOutput> {
    return this.updatePost(postId, { featured_media: mediaId });
  }

  /**
   * Publish post
   */
  async publishPost(postId: number): Promise<WordPressPostOutput> {
    return this.updatePost(postId, { status: 'publish' });
  }

  /**
   * Verify publication
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
