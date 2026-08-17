import { NextResponse } from 'next/server';
import { OnPageSEOAgent } from '@/lib/agent/onPageAgent';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const websiteId = searchParams.get('website_id');

    if (!websiteId) {
      return NextResponse.json({ result: null });
    }

    const supabase = await createClient();

    const { data: latestAnalysis, error } = await supabase
      .from('on_page_analyses')
      .select(`
        *,
        on_page_recommendations (*)
      `)
      .eq('website_id', websiteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestAnalysis) {
      return NextResponse.json({ result: null });
    }

    const result = {
      url: latestAnalysis.url,
      target_keyword: latestAnalysis.target_keyword,
      search_intent: latestAnalysis.search_intent,
      status: latestAnalysis.qa_overall_status === 'pass' ? 'pass' : 'needs_revision',
      recommendations: (latestAnalysis.on_page_recommendations || []).map((r: any) => ({
        category: r.category,
        priority: r.priority,
        risk_level: r.risk_level,
        issue: r.issue_description,
        recommendation: r.recommended_action,
        current_value: r.current_value,
        suggested_value: r.suggested_value,
        reasoning: r.reasoning,
        requires_approval: r.requires_approval,
        auto_applicable: r.auto_applicable,
      })),
      seo_metadata: {
        optimized_title: latestAnalysis.optimized_title || latestAnalysis.page_title,
        optimized_meta_description: latestAnalysis.optimized_meta_description || latestAnalysis.meta_description,
        optimized_h1: latestAnalysis.optimized_h1 || latestAnalysis.h1,
        optimized_url_slug: latestAnalysis.optimized_url_slug || '',
      },
      schema_recommendations: latestAnalysis.schema_recommendations || [],
      diagnostic_scores: {
        intent_alignment: latestAnalysis.intent_alignment_score || 85,
        content_coverage: latestAnalysis.content_coverage_score || 80,
        technical: latestAnalysis.technical_score || 90,
        metadata: latestAnalysis.metadata_score || 85,
        linking: latestAnalysis.linking_score || 75,
        overall: latestAnalysis.overall_score || 83,
        note: 'Diagnostic indicators evaluating search intent, metadata, and crawlability.',
      },
      qa: latestAnalysis.qa_results || {},
      content_agent_task: {
        triggered: false,
        reason: '',
        specific_gaps: [],
      },
      image_agent_task: {
        triggered: false,
        visuals_needed: [],
      },
    };

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('[On-Page GET] Error:', error);
    return NextResponse.json({ result: null });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      website_id, url, target_keyword, secondary_keywords,
      search_intent, content_type, page_data, existing_website_pages,
      project_instructions, project_memory,
    } = body;

    if (!url || !target_keyword) {
      return NextResponse.json({ error: 'url and target_keyword are required' }, { status: 400 });
    }

    let crawledPage = page_data;

    // If page_data not provided, fetch live HTML from URL
    if (!crawledPage) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'SEOAutopilotBot/1.0' },
          next: { revalidate: 0 },
        });

        if (response.ok) {
          const html = await response.text();

          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
          const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
          const h2Matches = Array.from(html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi)).map(m => m[1].trim());
          const h3Matches = Array.from(html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/gi)).map(m => m[1].trim());
          const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);

          const cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          const words = cleanText.split(/\s+/).filter(Boolean);

          crawledPage = {
            url,
            title: titleMatch ? titleMatch[1].trim() : '',
            meta_description: metaDescMatch ? metaDescMatch[1].trim() : '',
            h1: h1Match ? h1Match[1].trim() : '',
            h2s: h2Matches.slice(0, 10),
            h3s: h3Matches.slice(0, 10),
            content_body: cleanText.slice(0, 5000),
            word_count: words.length,
            canonical_url: canonicalMatch ? canonicalMatch[1].trim() : undefined,
            images: [],
            internal_links: [],
          };
        }
      } catch (e) {
        console.warn('[OnPage Analysis] Failed to fetch live URL HTML:', e);
      }
    }

    const page = crawledPage || {
      url,
      title: '',
      meta_description: '',
      h1: '',
      h2s: [],
      h3s: [],
      content_body: '',
      word_count: 0,
      images: [],
      internal_links: [],
    };

    const agent = new OnPageSEOAgent();
    const result = await agent.analyze({
      page,
      target_keyword,
      secondary_keywords: secondary_keywords || [],
      search_intent: search_intent || 'informational',
      content_type: content_type || 'blog_article',
      existing_website_pages: existing_website_pages || [],
      project_instructions,
      project_memory,
    });

    // Persist to Supabase
    const supabase = await createClient();
    if (website_id) {
      const { data: analysis } = await supabase
        .from('on_page_analyses')
        .insert({
          website_id,
          url,
          page_title: page.title,
          meta_description: page.meta_description,
          h1: page.h1,
          h2s: page.h2s,
          h3s: page.h3s,
          word_count: page.word_count,
          canonical_url: page.canonical_url,
          target_keyword,
          secondary_keywords: secondary_keywords || [],
          search_intent: search_intent || 'informational',
          content_type: content_type || 'blog_article',
          overall_score: result.diagnostic_scores?.overall || 80,
          intent_alignment_score: result.diagnostic_scores?.intent_alignment || 80,
          content_coverage_score: result.diagnostic_scores?.content_coverage || 80,
          technical_score: result.diagnostic_scores?.technical || 80,
          metadata_score: result.diagnostic_scores?.metadata || 80,
          linking_score: result.diagnostic_scores?.linking || 80,
          optimized_title: result.seo_metadata?.optimized_title,
          optimized_meta_description: result.seo_metadata?.optimized_meta_description,
          optimized_h1: result.seo_metadata?.optimized_h1,
          optimized_url_slug: result.seo_metadata?.optimized_url_slug,
          schema_recommendations: result.schema_recommendations || [],
          qa_results: result.qa,
          qa_overall_status: result.status,
        })
        .select()
        .single();

      if (analysis && result.recommendations) {
        for (const rec of result.recommendations) {
          await supabase.from('on_page_recommendations').insert({
            analysis_id: analysis.id,
            category: rec.category,
            priority: rec.priority,
            risk_level: rec.risk_level,
            issue_description: rec.issue,
            recommended_action: rec.recommendation,
            current_value: rec.current_value || null,
            suggested_value: rec.suggested_value || null,
            reasoning: rec.reasoning,
            requires_approval: rec.requires_approval,
            auto_applicable: rec.auto_applicable,
          });
        }
      }
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[On-Page POST] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
