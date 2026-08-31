import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://seo-hazel-eight.vercel.app';
  return NextResponse.json({
    name: 'SEO Autopilot Agent Connector',
    slug: 'seo-autopilot-connector',
    version: '1.1.8',
    download_url: siteUrl + '/api/integrations/wordpress/plugin',
    requires: '5.8',
    tested: '6.4',
    requires_php: '7.4',
    author: 'SEO Autopilot Team',
    author_profile: 'https://seautopilot.io',
    last_updated: new Date().toISOString(),
    sections: {
      description: 'Official secure agent connector for SEO Autopilot SaaS. Enables autonomous SEO optimization and publishing.',
      changelog: '<h4>1.1.8</h4><ul><li>Added top-level WordPress sidebar menu and direct Settings action link on Plugins page for instant 1-click access.</li></ul><h4>1.1.7</h4><ul><li>Fix Linux/Unix zip path extraction compatibility and add fail-safe self-healing component loader.</li></ul>'
    }
  });
}
