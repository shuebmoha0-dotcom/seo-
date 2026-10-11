import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const supabase = await createClient();

    const [
      { count: keywordCount },
      { count: pagesCount },
      { count: issuesCount },
      { data: approvals },
      { count: competitorsCount },
      { data: gscRows },
      { data: recentDrafts },
      { data: recentIssues },
      { data: gscIntegration }
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

      // 6. Search Console Performance Data (if any)
      supabase
        .from('search_console_data')
        .select('date, clicks, impressions')
        .eq('website_id', websiteId)
        .order('date', { ascending: true })
        .limit(30),

      // 7. Recent Content Drafts
      supabase
        .from('content_drafts')
        .select('id, working_title, status, word_count, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(4),

      // 8. Recent Technical Issues
      supabase
        .from('technical_issues')
        .select('id, issue_type, page_url, severity, created_at')
        .eq('website_id', websiteId)
        .order('created_at', { ascending: false })
        .limit(4),

      // 9. GSC Integration Status
      supabase
        .from('integrations')
        .select('id, status, config, last_synced_at')
        .eq('website_id', websiteId)
        .eq('provider', 'google_search_console')
        .maybeSingle()
    ]);

    let finalGscRows = gscRows || [];
    const isGscConnected = gscIntegration?.status === 'connected';

    // If Search Console is connected but table is empty, auto-sync once in background
    if (isGscConnected && finalGscRows.length === 0) {
      try {
        const { syncSearchConsoleData } = await import('@/lib/services/gscSyncService');
        await syncSearchConsoleData(websiteId);
        const { data: refreshedRows } = await supabase
          .from('search_console_data')
          .select('date, clicks, impressions')
          .eq('website_id', websiteId)
          .order('date', { ascending: true })
          .limit(30);
        if (refreshedRows && refreshedRows.length > 0) {
          finalGscRows = refreshedRows;
        }
      } catch (syncErr) {
        console.error('[Dashboard Stats] Auto-sync GSC error:', syncErr);
      }
    }

    const chartData = finalGscRows.map((r: any) => ({
      date: r.date,
      traffic: r.clicks || 0,
      impressions: r.impressions || 0,
    }));

    const activityList: any[] = [];
    (recentDrafts || []).forEach((d: any) => {
      activityList.push({
        id: `draft-${d.id}`,
        type: 'draft',
        title: d.working_title || 'Content Draft',
        detail: `${d.word_count ? d.word_count + ' words · ' : ''}Status: ${d.status}`,
        timestamp: d.created_at,
        status: d.status === 'published' ? 'completed' : 'active',
      });
    });

    (recentIssues || []).forEach((iss: any) => {
      activityList.push({
        id: `issue-${iss.id}`,
        type: 'audit',
        title: `Audit: ${iss.issue_type?.replace(/_/g, ' ')}`,
        detail: iss.page_url || `Severity: ${iss.severity}`,
        timestamp: iss.created_at,
        status: iss.status === 'resolved' ? 'completed' : 'queued',
      });
    });

    activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({
      stats: {
        tracked_keywords: keywordCount || 0,
        crawled_pages: pagesCount || 0,
        technical_issues: issuesCount || 0,
        pending_approvals: approvals?.length || 0,
        tracked_competitors: competitorsCount || 0,
        health_score: issuesCount !== null && issuesCount !== undefined ? Math.max(20, 100 - (issuesCount || 0) * 5) : null,
      },
      recent_approvals: approvals || [],
      recent_activity: activityList.slice(0, 5),
      chart_data: chartData,
      gsc_connected: isGscConnected,
      gsc_property: gscIntegration?.config?.property_url || null,
      gsc_last_synced: gscIntegration?.last_synced_at || null,
    });
  } catch (error: any) {
    console.error('[Dashboard Stats GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
