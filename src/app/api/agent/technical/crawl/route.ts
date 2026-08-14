import { NextResponse } from 'next/server';
import { TechnicalSEOAgent } from '@/lib/agent/technicalSeoAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { website_id, start_url, site_tech, max_urls, crawl_depth, project_instructions, is_new_website } = body;

    if (!start_url) return NextResponse.json({ error: 'start_url is required' }, { status: 400 });

    const agent = new TechnicalSEOAgent();
    const result = await agent.analyze({
      start_url,
      site_tech: site_tech || 'unknown',
      max_urls: max_urls || 500,
      crawl_depth: crawl_depth || 3,
      project_instructions,
      is_new_website: is_new_website || false,
    });

    // Persist to Supabase
    const supabase = await createClient();
    if (website_id) {
      const { data: crawl } = await supabase
        .from('technical_crawls')
        .insert({
          website_id,
          start_url,
          site_tech: result.site_tech,
          max_urls: max_urls || 500,
          crawl_depth: crawl_depth || 3,
          total_urls_found: result.total_urls_found,
          total_urls_crawled: result.total_urls_crawled,
          urls_200: result.urls_200,
          urls_301: result.urls_301,
          urls_302: result.urls_302,
          urls_404: result.urls_404,
          urls_5xx: result.urls_5xx,
          urls_noindex: result.urls_noindex,
          urls_indexed: result.urls_indexed,
          urls_orphaned: result.urls_orphaned,
          broken_internal_links: result.broken_internal_links,
          crawlability_score: result.crawlability_score,
          indexability_score: result.indexability_score,
          technical_health_score: result.technical_health_score,
          status: 'completed',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (crawl) {
        for (const issue of result.issues) {
          await supabase.from('technical_issues').insert({
            crawl_id: crawl.id,
            website_id,
            category: issue.category,
            severity: issue.severity,
            issue_type: issue.issue_type,
            title: issue.title,
            description: issue.description,
            evidence: issue.evidence,
            affected_urls: issue.affected_urls,
            affected_url_count: issue.affected_url_count,
            sample_url: issue.sample_url,
            seo_impact: issue.seo_impact,
            business_impact: issue.business_impact,
            recommended_fix: issue.recommended_fix,
            estimated_effort: issue.estimated_effort,
            risk_level: issue.risk_level,
            automation_level: issue.automation_level,
            status: 'open',
          });
        }
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Technical SEO crawl error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
