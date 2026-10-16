import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outdart.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/api/',
          '/settings',
          '/onboarding',
          '/opportunities',
          '/backlinks',
          '/rank-tracking',
          '/site-explorer',
          '/technical-seo',
          '/content-planner',
          '/image-agent',
          '/on-page-seo',
          '/internal-linking',
          '/keywords',
          '/memory',
          '/schedule',
          '/strategy',
          '/autopilot',
          '/integrations',
          '/usage',
          '/workflows',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
