import { NextRequest, NextResponse } from "next/server";
import { LLMProvider } from "@/lib/tools/llm";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { topic, keyword, category = "AI Agents", status = "published" } = await req.json();

    if (!topic && !keyword) {
      return NextResponse.json(
        { error: "A topic or target keyword is required." },
        { status: 400 }
      );
    }

    const primaryTarget = (keyword || topic).trim();

    // 1. Generate comprehensive article via LLMProvider (Claude Sonnet 5 under the hood)
    const systemPrompt = `You are the lead technical author and SEO strategist for SEO Autopilot (an autonomous enterprise AI SEO agent platform).
Your task is to write a comprehensive, authoritative, high-density 1,200–1,500 word cornerstone guide for the platform's public blog.

STRICT WRITING RULES:
- High Information Density: Short paragraphs (2-3 sentences), crisp headings, zero conversational fluff ("In today's fast-paced world...").
- Structure: Start directly with the H1 title. Follow with an immediate value introduction, 3-4 structured H2 sections, concrete real-world workflows, a comparative Markdown table, and a decisive conclusion.
- Tone: Technical, authoritative, experienced practitioner perspective.
- Length: 1,200 to 1,500 words.
- Internal Positioning: Naturally illustrate how autonomous AI agents, automated rank tracking, Search Console intelligence, and technical crawlers solve these pain points without being overly promotional.
- Return ONLY valid JSON with this exact schema:
{
  "title": "Compelling H1 Title",
  "slug": "url-friendly-slug",
  "excerpt": "2-sentence punchy summary for SERP snippet and article cards",
  "category": "${category}",
  "metaTitle": "SEO Meta Title (under 60 chars)",
  "metaDescription": "SEO Meta Description (under 155 chars)",
  "keywords": ["keyword 1", "keyword 2", "keyword 3", "keyword 4"],
  "content": "Full markdown body of the article starting directly from the H1..."
}`;

    const prompt = `Write a cornerstone blog article targeting: "${primaryTarget}". Category: "${category}". Output strictly the JSON object.`;

    const response = await LLMProvider.generateText({
      agent: "PlatformContentAgent",
      taskType: "long_form_article",
      complexity: "complex",
      system: systemPrompt,
      prompt,
    });

    let articleData: any;
    try {
      const cleanJson = response.text
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      articleData = JSON.parse(cleanJson);
    } catch {
      // Fallback parser if JSON was surrounded by text
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse structured article output from AI.");
      }
      articleData = JSON.parse(jsonMatch[0]);
    }

    const wordCount = (articleData.content || "").trim().split(/\s+/).length;
    const readingTime = `${Math.max(1, Math.round(wordCount / 220))} min read`;

    // Curated high-res Unsplash imagery based on category
    const categoryImages: Record<string, string> = {
      "AI Agents": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      "Content Strategy": "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80",
      "Technical SEO": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
      "Growth": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
      "Case Studies": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80",
    };
    const coverImage = categoryImages[category] || categoryImages["AI Agents"];

    const cleanSlug = (articleData.slug || primaryTarget.toLowerCase())
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 2. Insert into database
    const supabase = createAdminClient();
    const { data: newPost, error: insertError } = await supabase
      .from("platform_blog_posts")
      .insert({
        slug: cleanSlug,
        title: articleData.title,
        excerpt: articleData.excerpt,
        content: articleData.content,
        category: articleData.category || category,
        author_name: "Editorial Team",
        author_role: "SEO Intelligence & Engineering",
        reading_time: readingTime,
        cover_image: coverImage,
        cover_image_alt: articleData.title,
        meta_title: articleData.metaTitle || articleData.title,
        meta_description: articleData.metaDescription || articleData.excerpt,
        keywords: articleData.keywords || [primaryTarget],
        status: status || "published",
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[PlatformBlog Generator] Insert error:", insertError);
      throw insertError;
    }

    return NextResponse.json({ success: true, post: newPost });
  } catch (err: any) {
    console.error("[PlatformBlog Generator] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
