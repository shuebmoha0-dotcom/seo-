import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seo-hazel-eight.vercel.app';
  return NextResponse.json({
    name: 'SEO Autopilot Agent Connector',
    slug: 'seo-autopilot-connector',
    version: '1.2.0',
    download_url: siteUrl + '/api/integrations/wordpress/plugin',
    requires: '5.8',
    tested: '6.4',
    requires_php: '7.4',
    author: 'SEO Autopilot Team',
    author_profile: 'https://seautopilot.io',
    last_updated: new Date().toISOString(),
    sections: {
      description: 'Official secure agent connector for SEO Autopilot SaaS. Enables autonomous SEO optimization and publishing.',
      changelog: '<h4>1.2.0</h4><ul><li>Fix menu slug collision to show dedicated Settings menu and top-bar shortcut.</li><li>Enhanced Over-The-Air updater with instant check support.</li></ul>'
    }
  });
}
