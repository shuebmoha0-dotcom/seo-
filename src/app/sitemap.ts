import { MetadataRoute } from 'next';
import { getAllBlogPosts } from '@/lib/blog/posts';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outdart.com';
  const now = new Date();

  // Static core platform pages
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

  // Static pre-rendered blog posts
  const staticPosts = getAllBlogPosts().map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt || now),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  // Dynamic database platform blog posts (if any)
  let dbPosts: MetadataRoute.Sitemap = [];
  try {
    const supabase = createAdminClient();
    const { data: posts } = await supabase
      .from('platform_blog_posts')
      .select('slug, updated_at, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (posts && posts.length > 0) {
      dbPosts = posts.map((p) => ({
        url: `${baseUrl}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at || p.created_at || now),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch (_) {}

  // Combine and deduplicate by URL
  const allRoutes = [...staticRoutes, ...staticPosts, ...dbPosts];
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
