import { NextResponse } from 'next/server';
import { KeywordAgent } from '@/lib/agent/keywordAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { opportunity, website_id } = await request.json();

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity data is required' }, { status: 400 });
    }

    const supabase = await createClient();
    let briefContext: { target_audience?: string; domain?: string; primary_niche?: string; project_instructions?: string } | undefined = undefined;

    if (website_id) {
      const [rulesRes, siteRes] = await Promise.all([
        supabase.from('content_rules').select('audience, custom_rules').eq('website_id', website_id).maybeSingle(),
        supabase.from('websites').select('domain').eq('id', website_id).maybeSingle(),
      ]);

      if (rulesRes.data || siteRes.data) {
        briefContext = {
          target_audience: rulesRes.data?.audience || undefined,
          domain: siteRes.data?.domain || undefined,
          project_instructions: rulesRes.data?.custom_rules || undefined,
        };
      }
    }

    const agent = new KeywordAgent();
    const brief = await agent.generateContentBrief(opportunity, briefContext);

    // Persist brief to Supabase
    if (website_id) {
      await supabase.from('content_briefs').insert({
        website_id,
        opportunity_id: opportunity.id || null,
        primary_keyword: brief.primary_keyword,
        secondary_keywords: brief.secondary_keywords,
        search_intent: brief.search_intent,
        target_audience: brief.target_audience,
        content_type: brief.content_type,
        recommended_title: brief.recommended_title,
        h1: brief.h1,
        h2_h3_structure: JSON.parse(JSON.stringify(brief.h2_h3_structure)),
        questions_to_answer: brief.questions_to_answer,
        important_entities: brief.important_entities,
        competitor_observations: brief.competitor_observations,
        content_gaps: brief.content_gaps,
        internal_linking_opportunities: brief.internal_linking_opportunities,
        recommended_word_count_min: brief.recommended_word_count_min,
        recommended_word_count_max: brief.recommended_word_count_max,
        cta_recommendation: brief.cta_recommendation,
      });
    }

    return NextResponse.json({ success: true, brief });
  } catch (error: any) {
    console.error('Content brief generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
