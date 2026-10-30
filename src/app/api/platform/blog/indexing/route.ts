import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/admin";
import { getAllBlogPosts } from "@/lib/blog/posts";
import { GoogleIndexingService } from "@/lib/connectors/googleIndexing";

export async function POST(req: NextRequest) {
  try {
    const authClient = await createClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. You must be authenticated to trigger search engine indexing." },
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
    const { slug, all } = body;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://outdart.com";
    const serviceAccountEmail = "agent-398@gen-lang-client-0938255671.iam.gserviceaccount.com";

    let slugsToIndex: string[] = [];
    if (all) {
      const staticPosts = getAllBlogPosts();
      const staticSlugs = staticPosts.map((p) => p.slug);

      const { data: dbPosts } = await supabase
        .from("platform_blog_posts")
        .select("slug")
        .eq("status", "published");

      const { data: outdartSite } = await supabase
        .from("websites")
        .select("id")
        .ilike("domain", "%outdart%")
        .limit(1)
        .maybeSingle();

      const { data: drafts } = outdartSite?.id
        ? await supabase
            .from("content_drafts")
            .select("url_slug")
            .eq("website_id", outdartSite.id)
            .eq("status", "published")
        : { data: [] };

      const slugSet = new Set<string>([
        ...staticSlugs,
        ...(dbPosts || []).map((p) => p.slug),
        ...(drafts || []).map((d) => d.url_slug).filter(Boolean),
      ]);

      slugsToIndex = Array.from(slugSet);
    } else if (slug) {
      slugsToIndex = [slug];
    } else {
      return NextResponse.json({ error: "Slug or 'all: true' is required." }, { status: 400 });
    }

    console.log(`[PlatformBlog Indexing] Dispatching indexing for ${slugsToIndex.length} URLs...`);

    const results = [];
    let googleSuccessCount = 0;
    let indexNowSuccessCount = 0;
    let gscOwnerRequired = false;

    for (const s of slugsToIndex) {
      const targetUrl = `${siteUrl}/blog/${s}`;
      try {
        const indexRes = await GoogleIndexingService.requestIndexing({
          url: targetUrl,
          type: "URL_UPDATED",
        });

        if (indexRes.google?.submitted) {
          googleSuccessCount++;
        }
        if (indexRes.indexNow?.submitted) {
          indexNowSuccessCount++;
        }
        if (indexRes.blocker?.type === "GSC_OWNER_REQUIRED") {
          gscOwnerRequired = true;
        }

        // Update content_drafts revision_notes if exists
        const { data: draft } = await supabase
          .from("content_drafts")
          .select("id, revision_notes")
          .eq("url_slug", s)
          .maybeSingle();

        if (draft) {
          let rev = typeof draft.revision_notes === "string" ? JSON.parse(draft.revision_notes || "{}") : (draft.revision_notes || {});
          rev.last_submitted_for_indexing = new Date().toISOString();
          rev.indexing_response = indexRes.summary;
          await supabase
            .from("content_drafts")
            .update({ revision_notes: rev })
            .eq("id", draft.id);
        }

        results.push({
          slug: s,
          url: targetUrl,
          google: indexRes.google,
          indexNow: indexRes.indexNow,
          blocker: indexRes.blocker,
        });
      } catch (err: any) {
        results.push({
          slug: s,
          url: targetUrl,
          error: err.message || String(err),
        });
      }
    }

    return NextResponse.json({
      success: true,
      total_requested: slugsToIndex.length,
      google_success_count: googleSuccessCount,
      indexnow_success_count: indexNowSuccessCount,
      gsc_owner_required: gscOwnerRequired,
      service_account_email: serviceAccountEmail,
      results,
      summary: gscOwnerRequired
        ? `⚠️ IndexNow submitted (${indexNowSuccessCount}/${slugsToIndex.length}). Google Indexing requires adding "${serviceAccountEmail}" as Owner in Google Search Console for outdart.com.`
        : `🟢 Submitted ${slugsToIndex.length} URLs to Googlebot & IndexNow crawlers.`,
    });
  } catch (err: any) {
    console.error("[PlatformBlog Indexing] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
