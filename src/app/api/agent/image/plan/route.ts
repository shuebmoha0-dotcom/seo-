import { NextResponse } from 'next/server';
import { ImageAgent } from '@/lib/agent/imageAgent';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      website_id, article_title, article_content, target_keyword,
      content_type, project_instructions, visual_memory,
      discusses_product, max_images,
    } = body;

    if (!article_title) {
      return NextResponse.json({ error: 'article_title is required' }, { status: 400 });
    }

    const agent = new ImageAgent();
    const plan = await agent.planImages({
      article_title,
      article_content: article_content || '',
      target_keyword: target_keyword || '',
      content_type: content_type || 'blog_article',
      project_instructions,
      visual_memory,
      discusses_product: discusses_product || false,
      max_images: max_images || 3,
    });

    // Run QA on all planned images
    const qaResults = plan.images.map(img =>
      agent.runImageQA(img, article_title, project_instructions)
    );

    // Generate manifest
    const manifest = agent.generateManifest(plan, qaResults);

    // Persist plan to Supabase
    const supabase = await createClient();
    let planId: string | undefined;
    if (website_id) {
      const { data } = await supabase
        .from('image_plans')
        .insert({
          website_id,
          article_title,
          article_url: body.article_url || null,
          target_keyword,
          content_type,
          status: 'pending_approval',
          total_images_planned: plan.images.length,
          project_instructions: project_instructions || null,
          visual_style_notes: visual_memory || null,
        })
        .select()
        .single();

      if (data) {
        planId = data.id;
        for (let i = 0; i < plan.images.length; i++) {
          const img = plan.images[i];
          const qa = qaResults[i];
          await supabase.from('image_assets').insert({
            plan_id: data.id,
            website_id,
            image_type: img.image_type,
            purpose: img.purpose,
            placement: img.placement,
            placement_order: img.placement_order,
            visual_description: img.visual_description,
            aspect_ratio: img.aspect_ratio,
            dimensions: img.dimensions,
            generation_method: img.generation_method,
            generation_prompt: img.generation_prompt || null,
            filename: img.filename,
            alt_text: img.alt_text,
            caption: img.caption || null,
            qa_passed: qa.passed,
            qa_notes: qa.qa_notes,
            qa_checks: qa.checks,
            status: qa.passed ? 'pending_approval' : 'qa_failed',
          });
        }
      }
    }

    return NextResponse.json({ success: true, plan, qa_results: qaResults, manifest, plan_id: planId });
  } catch (error: any) {
    console.error('Image plan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
