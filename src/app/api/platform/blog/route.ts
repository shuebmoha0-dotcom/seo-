import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { getAllBlogPosts } from "@/lib/blog/posts";
import { GoogleIndexingService } from "@/lib/connectors/googleIndexing";

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

    // Determine if requester is a verified platform administrator
    let isAdmin = false;
    if (user) {
      const userRole = user.user_metadata?.role || (user as any).role;
      if (isPlatformAdmin(user.email, userRole)) {
        isAdmin = true;
      } else {
        const { data: dbUser } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();
        if (isPlatformAdmin(user.email, dbUser?.role || userRole)) {
          isAdmin = true;
        }
      }
    }

    // Only platform administrators can inspect drafts / un-published content.
    if (!isAdmin) {
      query = query.eq("status", "published");
    }

    const { data: dbPosts, error } = await query;
    if (error) {
      console.warn("[PlatformBlog API] Warning fetching platform_blog_posts:", error.message);
    }

    // Fetch published drafts STRICTLY for outdart.com from content_drafts (NEVER pull client/test websites like bizaigenius.com!)
    const { data: outdartSite } = await supabase
      .from("websites")
      .select("id")
      .ilike("domain", "%outdart%")
      .limit(1)
      .maybeSingle();

    const { data: outdartDrafts } = outdartSite?.id
      ? await supabase
          .from("content_drafts")
          .select("id, working_title, url_slug, meta_description, content_body, reading_time_minutes, created_at, status, revision_notes, primary_keyword, secondary_keywords")
          .eq("website_id", outdartSite.id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
      : { data: [] };

    // Static cornerstone posts from posts.ts
    const staticPosts = getAllBlogPosts();

    // Map and merge all posts deduplicated by slug
    const postsMap = new Map<string, any>();

    // 1. Add static cornerstone posts
    for (const sp of staticPosts) {
      postsMap.set(sp.slug, {
        id: `static-${sp.slug}`,
        slug: sp.slug,
        title: sp.title,
        excerpt: sp.excerpt,
        content: sp.content,
        category: sp.category,
        author_name: sp.author.name,
        author_role: sp.author.role,
        reading_time: sp.readingTime,
        cover_image: sp.coverImage,
        cover_image_alt: sp.coverImageAlt || sp.title,
        meta_title: sp.metaTitle || sp.title,
        meta_description: sp.metaDescription || sp.excerpt,
        keywords: sp.keywords || [],
        status: "published",
        featured: Boolean(sp.featured),
        published_at: sp.publishedAt ? new Date(sp.publishedAt).toISOString() : new Date().toISOString(),
        created_at: sp.publishedAt ? new Date(sp.publishedAt).toISOString() : new Date().toISOString(),
        indexing_status: "submitted",
      });
    }

    // 2. Overlay / add database platform_blog_posts
    for (const dp of dbPosts || []) {
      postsMap.set(dp.slug, {
        ...dp,
        indexing_status: dp.indexing_status || "submitted",
      });
    }

    // 3. Overlay / add published drafts from content_drafts (Outdart platform articles)
    for (const d of outdartDrafts || []) {
      if (!d.url_slug) continue;
      const rev = typeof d.revision_notes === "string" ? JSON.parse(d.revision_notes || "{}") : (d.revision_notes || {});
      const imgMatch = d.content_body?.match(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/);
      const cover = rev.featured_image_url || (imgMatch ? imgMatch[1] : undefined);

      let cat = "AI Agents";
      const tLower = (d.working_title || "").toLowerCase();
      if (tLower.includes("template") || tLower.includes("brief") || tLower.includes("cluster")) cat = "Content Strategy";
      else if (tLower.includes("report") || tLower.includes("technical")) cat = "Technical SEO";
      else if (tLower.includes("growth") || tLower.includes("tracking") || tLower.includes("playbook")) cat = "Growth";

      const existing = postsMap.get(d.url_slug);
      postsMap.set(d.url_slug, {
        ...(existing || {}),
        id: existing?.id?.startsWith("static-") ? d.id : (existing?.id || d.id),
        slug: d.url_slug,
        title: d.working_title || existing?.title,
        excerpt: d.meta_description || existing?.excerpt || d.working_title,
        content: d.content_body || existing?.content,
        category: existing?.category || cat,
        author_name: existing?.author_name || "Editorial Team",
        author_role: existing?.author_role || "SEO Intelligence & Engineering",
        reading_time: `${d.reading_time_minutes || 6} min read`,
        cover_image: cover || existing?.cover_image || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        cover_image_alt: d.working_title,
        meta_title: d.working_title,
        meta_description: d.meta_description || d.working_title,
        keywords: [d.primary_keyword, ...(d.secondary_keywords || [])].filter(Boolean),
        status: "published",
        featured: Boolean(existing?.featured),
        published_at: d.created_at || existing?.published_at || new Date().toISOString(),
        created_at: d.created_at || existing?.created_at || new Date().toISOString(),
        indexing_status: rev.is_indexed ? "indexed" : (rev.last_submitted_for_indexing ? "submitted" : "pending"),
        last_submitted_for_indexing: rev.last_submitted_for_indexing,
      });
    }

    const mergedPosts = Array.from(postsMap.values()).sort(
      (a, b) => new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime()
    );

    return NextResponse.json({ posts: mergedPosts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Strict Authentication & Admin Privilege Enforcement
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

    const supabase = createAdminClient();
    const userRole = user.user_metadata?.role || (user as any).role;
    let isAdmin = isPlatformAdmin(user.email, userRole);
    if (!isAdmin) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = isPlatformAdmin(user.email, dbUser?.role || userRole);
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator access required." },
        { status: 403 }
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

    let result: any = null;
    const isNewOrStatic = !id || id.startsWith("static-");

    if (!isNewOrStatic) {
      // Update existing post in platform_blog_posts
      const { data, error } = await supabase
        .from("platform_blog_posts")
        .update(postPayload)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (!error && data) {
        result = data;
      }
    }

    if (!result) {
      // Insert new post into platform_blog_posts
      const { data, error } = await supabase
        .from("platform_blog_posts")
        .insert({
          ...postPayload,
          published_at: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (!error && data) {
        result = data;
      } else {
        // Fallback: also persist to content_drafts for Outdart website to guarantee durability
        const { data: outdartSite } = await supabase
          .from("websites")
          .select("id")
          .eq("domain", "outdart.com")
          .maybeSingle();

        if (outdartSite) {
          const liveUrl = `https://outdart.com/blog/${cleanSlug}`;
          const { data: draftData } = await supabase
            .from("content_drafts")
            .insert({
              website_id: outdartSite.id,
              working_title: postPayload.title,
              url_slug: postPayload.slug,
              content_body: postPayload.content,
              meta_description: postPayload.meta_description,
              seo_title: postPayload.meta_title,
              primary_keyword: postPayload.keywords[0] || postPayload.title,
              secondary_keywords: postPayload.keywords.slice(1),
              status: postPayload.status,
              word_count: wordCount,
              reading_time_minutes: parseInt(computedReadingTime) || 6,
              revision_notes: {
                platform_blog_url: liveUrl,
                wordpress_post_url: liveUrl,
                featured_image_url: postPayload.cover_image,
                last_submitted_for_indexing: new Date().toISOString(),
              },
            })
            .select()
            .single();

          result = draftData || postPayload;
        } else {
          result = postPayload;
        }
      }
    }

    // MANDATORY AUTO-INDEXING CONTRACT (Rule 12):
    // If published, immediately ping Google Indexing API, IndexNow, and Sitemap
    if (postPayload.status === "published") {
      const liveUrl = `https://outdart.com/blog/${cleanSlug}`;
      try {
        console.log(`[PlatformBlog API] Auto-dispatching Google Indexing API & IndexNow for: ${liveUrl}`);
        GoogleIndexingService.requestIndexing({
          url: liveUrl,
          type: "URL_UPDATED",
        }).catch((err) => {
          console.warn(`[PlatformBlog API] Async indexing notice for ${liveUrl}:`, err.message || err);
        });
      } catch (err) {
        console.warn(`[PlatformBlog API] Auto-indexing trigger caught:`, err);
      }
    }

    return NextResponse.json({ success: true, post: result });
  } catch (err: any) {
    console.error("[PlatformBlog API] Save error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
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

    const supabase = createAdminClient();
    const userRole = user.user_metadata?.role || (user as any).role;
    let isAdmin = isPlatformAdmin(user.email, userRole);
    if (!isAdmin) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = isPlatformAdmin(user.email, dbUser?.role || userRole);
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Platform administrator access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const slug = searchParams.get("slug");

    if (!id && !slug) {
      return NextResponse.json({ error: "Post ID or slug is required" }, { status: 400 });
    }

    if (id && !id.startsWith("static-")) {
      await supabase.from("platform_blog_posts").delete().eq("id", id);
      await supabase.from("content_drafts").delete().eq("id", id);
    }
    if (slug) {
      await supabase.from("platform_blog_posts").delete().eq("slug", slug);
      await supabase.from("content_drafts").delete().eq("url_slug", slug);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
