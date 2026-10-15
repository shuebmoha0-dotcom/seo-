import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateString;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({
        stats: {
          tracked_keywords: 0,
          crawled_pages: 0,
          technical_issues: 0,
          pending_approvals: 0,
          tracked_competitors: 0,
          health_score: null,
        },
        recent_approvals: [],
        chart_data: [],
      });
    }

    const userClient = await createClient();
    const supabase = userClient || createAdminClient();

    const [
      { count: keywordCount },
      { count: pagesCount },
      { count: issuesCount },
      { data: approvals },
      { count: competitorsCount },
      { data: gscRows },
      { data: topQueries },
      { data: recentDrafts },
      { data: recentIssues },
      { data: gscIntegration },
      { data: latestCrawl },
    ] = await Promise.all([
      // 1. Count Tracked Keywords
      supabase
        .from('keywords')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', websiteId),

      // 2. Count Crawled Pages
      supabase
        .from('pages')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', websiteId),

      // 3. Count Technical Issues
      supabase
        .from('technical_issues')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', websiteId)
        .eq('status', 'open'),

      // 4. Count Pending Approvals
      supabase
        .from('seo_opportunities')
        .select('*')
        .eq('website_id', websiteId)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false })
        .limit(5),

      // 5. Count Competitors
      supabase
        .from('competitors')
        .select('*', { count: 'exact', head: true })
        .eq('website_id', websiteId),

      // 6. Search Console Performance Data (fetch daily totals, up to 500 days)
      supabase
        .from('search_console_data')
        .select('date, clicks, impressions, ctr, position')
        .eq('website_id', websiteId)
        .is('query', null)
        .order('date', { ascending: true })
        .limit(500),

      // 6b. Top Search Queries from Google Search Console
      supabase
        .from('search_console_data')
        .select('query, clicks, impressions, ctr, position')
        .eq('website_id', websiteId)
        .not('query', 'is', null)
        .order('impressions', { ascending: false })
        .limit(10),

      // 7. Recent Content Drafts
      supabase
        .from('content_drafts')
        .select('id, working_title, status, word_count, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(6),

      // 8. Recent Technical Issues (uses sample_url, NOT page_url)
      supabase
        .from('technical_issues')
        .select('id, issue_type, sample_url, severity, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(4),

      // 9. GSC Integration Status
      supabase
        .from('integrations')
        .select('id, status, config, last_synced_at')
        .eq('website_id', websiteId)
        .eq('provider', 'google_search_console')
        .maybeSingle(),

      // 10. Latest Crawl for authentic technical health score
      supabase
        .from('technical_crawls')
        .select('technical_health_score, total_urls_crawled')
        .eq('website_id', websiteId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let finalGscRows = gscRows || [];
    const isGscConnected = gscIntegration?.status === 'connected';

    // Auto-sync live Google Search Console data if stale (> 5 minutes), empty, hourly missing/stale (> 30 mins), or explicitly requested
    const lastSyncTime = gscIntegration?.last_synced_at ? new Date(gscIntegration.last_synced_at).getTime() : 0;
    const isStale = Date.now() - lastSyncTime > 5 * 60 * 1000;
    const forceSync = searchParams.get('sync') === 'true';

    let activeGscConfig = gscIntegration?.config;
    let activeLastSynced = gscIntegration?.last_synced_at;

    const hourlyLastSynced = activeGscConfig?.hourly_data_24h?.lastSyncedAt 
      ? new Date(activeGscConfig.hourly_data_24h.lastSyncedAt).getTime() 
      : 0;
    const isHourlyStale = Date.now() - hourlyLastSynced > 30 * 60 * 1000;

    if (isGscConnected && (isStale || forceSync || finalGscRows.length === 0 || !activeGscConfig?.hourly_data_24h || isHourlyStale)) {
      try {
        const { syncSearchConsoleData } = await import('@/lib/services/gscSyncService');
        await syncSearchConsoleData(websiteId, 480, supabase);
        const [refreshedRows, refreshedIntg] = await Promise.all([
          supabase
            .from('search_console_data')
            .select('date, clicks, impressions, ctr, position')
            .eq('website_id', websiteId)
            .is('query', null)
            .order('date', { ascending: true })
            .limit(500),
          supabase
            .from('integrations')
            .select('config, last_synced_at')
            .eq('website_id', websiteId)
            .eq('provider', 'google_search_console')
            .maybeSingle(),
        ]);
        if (refreshedRows?.data && refreshedRows.data.length > 0) {
          finalGscRows = refreshedRows.data;
        }
        if (refreshedIntg?.data) {
          activeGscConfig = refreshedIntg.data.config;
          activeLastSynced = refreshedIntg.data.last_synced_at;
        }
      } catch (syncErr) {
        console.error('[Dashboard Stats] Auto-sync GSC error:', syncErr);
      }
    }

    const chartData = finalGscRows.map((r: any) => ({
      date: r.date,
      traffic: r.clicks || 0,
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr !== null && r.ctr !== undefined ? Number(r.ctr) : 0,
      position: r.position !== null && r.position !== undefined ? Number(r.position) : 0,
    }));

    const activityList: any[] = [];
    (recentDrafts || []).forEach((d: any) => {
      activityList.push({
        id: `draft-${d.id}`,
        type: 'draft',
        title: d.working_title || 'Content Draft',
        detail: `${d.word_count ? d.word_count + ' words · ' : ''}Status: ${d.status}`,
        timestamp: formatRelativeTime(d.created_at),
        raw_timestamp: d.created_at,
        status: d.status === 'published' ? 'completed' : 'active',
      });
    });

    (recentIssues || []).forEach((iss: any) => {
      activityList.push({
        id: `issue-${iss.id}`,
        type: 'audit',
        title: `Audit: ${iss.issue_type?.replace(/_/g, ' ')}`,
        detail: iss.sample_url || `Severity: ${iss.severity}`,
        timestamp: formatRelativeTime(iss.created_at),
        raw_timestamp: iss.created_at,
        status: iss.status === 'resolved' ? 'completed' : 'queued',
      });
    });

    activityList.sort((a, b) => new Date(b.raw_timestamp || 0).getTime() - new Date(a.raw_timestamp || 0).getTime());

    const authenticHealthScore = latestCrawl?.technical_health_score 
      ?? (issuesCount !== null && issuesCount !== undefined ? Math.max(30, 100 - (issuesCount || 0) * 2) : 80);

    return NextResponse.json({
      stats: {
        tracked_keywords: keywordCount || 0,
        crawled_pages: pagesCount || 0,
        technical_issues: issuesCount || 0,
        pending_approvals: approvals?.length || 0,
        tracked_competitors: competitorsCount || 0,
        health_score: authenticHealthScore,
      },
      recent_approvals: approvals || [],
      recent_activity: activityList.slice(0, 6),
      chart_data: chartData,
      top_queries: (topQueries || []).map((q: any) => ({
        query: q.query,
        clicks: q.clicks || 0,
        impressions: q.impressions || 0,
        ctr: q.ctr !== null && q.ctr !== undefined ? Number(q.ctr) : 0,
        position: q.position !== null && q.position !== undefined ? Number(q.position) : 0,
      })),
      gsc_connected: isGscConnected,
      gsc_property: gscIntegration?.config?.property_url || null,
      gsc_last_synced: activeLastSynced || gscIntegration?.last_synced_at || null,
      gsc_hourly: activeGscConfig?.hourly_data_24h || null,
    });
  } catch (error: any) {
    console.error('[Dashboard Stats GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
