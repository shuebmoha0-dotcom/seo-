import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    const supabase = createAdminClient();
    let query = supabase
      .from("platform_blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    // Unauthenticated visitors are restricted strictly to published articles
    if (!user) {
      query = query.eq("status", "published");
    }

    const { data: posts, error } = await query;
    if (error) {
      console.error("[PlatformBlog API] Error fetching posts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ posts: posts || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Strict Authentication Enforcement
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. You must be authenticated to create or edit platform articles." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      id,
      slug,
      title,
      excerpt,
      content,
      category,
      author_name,
      author_role,
      reading_time,
      cover_image,
      cover_image_alt,
      meta_title,
      meta_description,
      keywords,
      status,
      featured,
    } = body;

    if (!title || !content || !category) {
      return NextResponse.json(
        { error: "Title, content, and category are required." },
        { status: 400 }
      );
    }

    const cleanSlug = (
      slug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    ).trim();

    const wordCount = content.trim().split(/\s+/).length;
    const computedReadingTime = reading_time || `${Math.max(1, Math.round(wordCount / 220))} min read`;

    const supabase = createAdminClient();

    const postPayload = {
      slug: cleanSlug,
      title: title.trim(),
      excerpt: excerpt?.trim() || title.trim(),
      content: content.trim(),
      category: category.trim(),
      author_name: author_name || "Editorial Team",
      author_role: author_role || "SEO Intelligence & Engineering",
      reading_time: computedReadingTime,
      cover_image:
        cover_image ||
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      cover_image_alt: cover_image_alt || title.trim(),
      meta_title: meta_title?.trim() || title.trim(),
      meta_description: meta_description?.trim() || excerpt?.trim() || title.trim(),
      keywords: Array.isArray(keywords) ? keywords : [],
      status: status || "published",
      featured: Boolean(featured),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (id) {
      // Update existing post
      const { data, error } = await supabase
        .from("platform_blog_posts")
        .update(postPayload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Create new post
      const { data, error } = await supabase
        .from("platform_blog_posts")
        .insert({
          ...postPayload,
          published_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ success: true, post: result });
  } catch (err: any) {
    console.error("[PlatformBlog API] Save error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Strict Authentication Enforcement
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. You must be authenticated to delete platform articles." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const slug = searchParams.get("slug");

    if (!id && !slug) {
      return NextResponse.json({ error: "Post ID or slug is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    let query = supabase.from("platform_blog_posts").delete();

    if (id) {
      query = query.eq("id", id);
    } else if (slug) {
      query = query.eq("slug", slug);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
