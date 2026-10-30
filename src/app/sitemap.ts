import { MetadataRoute } from 'next';
import { getLiveBlogPosts } from '@/lib/blog/posts';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://outdart.com').replace(/\/+$/, '');
  const now = new Date();

  // Static core platform marketing pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Dynamic live blog posts from getLiveBlogPosts (merges static cornerstone + platform_blog_posts + outdart content_drafts)
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const livePosts = await getLiveBlogPosts();
    blogRoutes = livePosts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt || now),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.warn('[Sitemap] Dynamic live posts fetch notice:', err);
  }

  // Combine and deduplicate by URL
  const allRoutes = [...staticRoutes, ...blogRoutes];
  const seenUrls = new Set<string>();
  const uniqueRoutes: MetadataRoute.Sitemap = [];

  for (const route of allRoutes) {
    if (!seenUrls.has(route.url)) {
      seenUrls.add(route.url);
      uniqueRoutes.push(route);
    }
  }

  return uniqueRoutes;
}
