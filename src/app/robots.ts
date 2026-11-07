import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outdart.com';

  const disallowedInternalPaths = [
    '/dashboard',
    '/aeo',
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
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog/', '/llms.txt'],
        disallow: disallowedInternalPaths,
      },
      {
        // Explicitly allow AI Search & Answer Engine crawlers on public content & /llms.txt for LLM Mentions
        userAgent: [
          'OAI-SearchBot',
          'ChatGPT-User',
          'GPTBot',
          'PerplexityBot',
          'ClaudeBot',
          'Claude-Web',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: ['/', '/blog/', '/llms.txt'],
        disallow: disallowedInternalPaths,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
