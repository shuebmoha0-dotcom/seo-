import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outdart.com';
  return NextResponse.json({
    name: 'Outdart Agent Connector',
    slug: 'seo-autopilot-connector',
    version: '1.2.0',
    download_url: siteUrl + '/api/integrations/wordpress/plugin',
    requires: '5.8',
    tested: '6.4',
    requires_php: '7.4',
    author: 'Outdart Team',
    author_profile: 'https://outdart.com',
    last_updated: new Date().toISOString(),
    sections: {
      description: 'Official secure agent connector for Outdart SaaS. Enables autonomous SEO optimization and publishing.',
      changelog: '<h4>1.2.0</h4><ul><li>Fix menu slug collision to show dedicated Settings menu and top-bar shortcut.</li><li>Enhanced Over-The-Air updater with instant check support.</li></ul>'
    }
  });
}
