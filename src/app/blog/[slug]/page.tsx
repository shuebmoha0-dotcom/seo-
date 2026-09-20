import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Sparkles,
  Clock,
  Calendar,
  ArrowLeft,
  ArrowRight,
  Share2,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { BlogNavbar } from "@/components/blog/BlogNavbar";
import { BlogFooter } from "@/components/blog/BlogFooter";
import { getBlogPostBySlug, getAllBlogPosts, getRelatedPosts } from "@/lib/blog/posts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return {
      title: "Article Not Found | SEO Autopilot",
      description: "The requested blog article could not be found.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://seo-hazel-eight.vercel.app";
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  return {
    title: `${post.metaTitle} | SEO Autopilot`,
    description: post.metaDescription,
    keywords: post.keywords,
    authors: [{ name: post.author.name }],
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      type: "article",
      url: postUrl,
      title: post.metaTitle,
      description: post.metaDescription,
      publishedTime: post.publishedAt,
      authors: [post.author.name],
      tags: post.keywords,
      images: [
        {
          url: post.coverImage,
          width: 1200,
          height: 630,
          alt: post.coverImageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle,
      description: post.metaDescription,
      images: [post.coverImage],
    },
  };
}

export default async function BlogPostDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = getRelatedPosts(post.slug, post.category, 3);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://seo-hazel-eight.vercel.app";
  const postUrl = `${siteUrl}/blog/${post.slug}`;

  // Structured Data (JSON-LD) for Google Rich Snippets
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.metaDescription,
    image: post.coverImage,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      "@type": "Organization",
      name: post.author.name,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "SEO Autopilot",
      url: siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/favicon.ico`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: `${siteUrl}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: post.category,
        item: `${siteUrl}/blog?category=${encodeURIComponent(post.category)}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: post.title,
        item: postUrl,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Navbar */}
      <BlogNavbar />

      <main className="max-w-4xl mx-auto px-6 pt-10 pb-20 space-y-10">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-indigo-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <Link href="/blog" className="hover:text-indigo-600 transition-colors">
            Blog
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="text-neutral-400">{post.category}</span>
          <ChevronRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="text-neutral-900 font-semibold truncate max-w-xs">{post.title}</span>
        </nav>

        {/* Back Button */}
        <div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors py-1.5 px-3 rounded-xl hover:bg-neutral-100"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to all articles</span>
          </Link>
        </div>

        {/* Article Header */}
        <header className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 border border-indigo-200 text-indigo-600">
              {post.category}
            </span>
            <span className="text-xs text-neutral-400">•</span>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{post.publishedAt}</span>
            </div>
            <span className="text-xs text-neutral-400">•</span>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Clock className="w-3.5 h-3.5" />
              <span>{post.readingTime}</span>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight">
            {post.title}
          </h1>

          <p className="text-base md:text-lg text-neutral-600 leading-relaxed">
            {post.excerpt}
          </p>

          {/* Author Card */}
          <div className="pt-2 flex items-center justify-between border-y border-neutral-100 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-sm font-bold text-indigo-700">
                {post.author.name[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">{post.author.name}</p>
                <p className="text-xs text-neutral-500">{post.author.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-400">Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors text-xs font-semibold"
                aria-label="Share on Twitter"
              >
                X / Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors text-xs font-semibold"
                aria-label="Share on LinkedIn"
              >
                LinkedIn
              </a>
            </div>
          </div>
        </header>

        {/* Cover Image */}
        <div className="relative h-72 md:h-[420px] w-full rounded-3xl overflow-hidden shadow-sm border border-neutral-200">
          <img
            src={post.coverImage}
            alt={post.coverImageAlt}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Article Body (Markdown Formatted Presentation) */}
        <article className="prose prose-neutral max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-neutral-900 prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-neutral-700 prose-p:leading-relaxed prose-p:text-base prose-li:text-neutral-700 prose-strong:text-neutral-900 prose-blockquote:border-l-indigo-600 prose-blockquote:bg-indigo-50/50 prose-blockquote:p-4 prose-blockquote:rounded-r-xl prose-table:border-neutral-200 prose-th:bg-neutral-50 prose-th:p-3 prose-td:p-3">
          {renderMarkdownArticle(post.content)}
        </article>

        {/* Mid-Article / Post-Article Conversion CTA */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-3xl p-8 md:p-10 space-y-5 my-12 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-700 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Autonomous SEO Platform</span>
          </div>

          <div className="space-y-2 max-w-2xl">
            <h3 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
              Automate this entire search workflow for your own website
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Connect your Google Search Console and CMS in 2 minutes. SEO Autopilot detects unwritten keywords, drafts comprehensive articles, and auto-fixes technical crawl issues 24/7.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm shadow-indigo-500/20"
            >
              <span>Start Free 14-Day Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-xs text-neutral-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>No credit card required</span>
            </span>
          </div>
        </div>

        {/* Related Articles Section */}
        {relatedPosts.length > 0 && (
          <section className="pt-12 border-t border-neutral-200 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-neutral-900">
                Related Articles & Guides
              </h2>
              <Link href="/blog" className="text-xs font-semibold text-indigo-600 hover:underline">
                View all articles →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedPosts.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/blog/${rel.slug}`}
                  className="group flex flex-col bg-neutral-50 hover:bg-white border border-neutral-200 rounded-2xl overflow-hidden p-5 space-y-3 transition-all hover:shadow-md hover:border-neutral-300"
                >
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wide">
                    {rel.category}
                  </span>
                  <h4 className="text-sm font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                    {rel.title}
                  </h4>
                  <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                    {rel.excerpt}
                  </p>
                  <div className="pt-2 text-[11px] font-semibold text-neutral-400">
                    {rel.readingTime}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <BlogFooter />
    </div>
  );
}

/**
 * Clean helper function to render Markdown blocks (H1-H3, lists, quotes, tables, paragraphs)
 */
function renderMarkdownArticle(content: string) {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: string) => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1).filter((r) => !r.every((c) => c.includes("---")));
      elements.push(
        <div key={key} className="overflow-x-auto my-8">
          <table className="w-full border-collapse border border-neutral-200 text-sm rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                {headers.map((h, i) => (
                  <th key={i} className="p-3.5 text-left font-bold text-neutral-900">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-3.5 text-neutral-700">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (inTable) flushTable(`table-${i}`);
      continue;
    }

    // Skip redundant top-level H1 (handled by article header)
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      continue;
    }

    // Horizontal Rule
    if (trimmed === "---") {
      if (inTable) flushTable(`table-${i}`);
      elements.push(<hr key={i} className="my-8 border-neutral-200" />);
      continue;
    }

    // Table Row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cols = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cols);
      continue;
    } else if (inTable) {
      flushTable(`table-${i}`);
    }

    // H2 Heading
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-2xl md:text-3xl font-extrabold text-neutral-900 mt-10 mb-4 tracking-tight">
          {trimmed.replace("## ", "")}
        </h2>
      );
      continue;
    }

    // H3 Heading
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-lg md:text-xl font-bold text-neutral-900 mt-6 mb-3 tracking-tight">
          {trimmed.replace("### ", "")}
        </h3>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-indigo-600 bg-indigo-50/60 pl-4 py-3 pr-4 rounded-r-xl my-5 text-sm text-neutral-800 leading-relaxed">
          {trimmed.replace("> ", "")}
        </blockquote>
      );
      continue;
    }

    // Unordered List
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.slice(2);
      elements.push(
        <div key={i} className="flex items-start gap-2.5 my-2 pl-2 text-sm md:text-base text-neutral-700 leading-relaxed">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 shrink-0" />
          <span>{renderInlineFormatting(text)}</span>
        </div>
      );
      continue;
    }

    // Ordered List
    if (/^\d+\.\s/.test(trimmed)) {
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={i} className="flex items-start gap-3 my-2 pl-2 text-sm md:text-base text-neutral-700 leading-relaxed">
            <span className="font-bold text-indigo-600 text-sm shrink-0">{numMatch[1]}.</span>
            <span>{renderInlineFormatting(numMatch[2])}</span>
          </div>
        );
        continue;
      }
    }

    // Standard Paragraph
    elements.push(
      <p key={i} className="text-base text-neutral-700 leading-relaxed my-4">
        {renderInlineFormatting(trimmed)}
      </p>
    );
  }

  if (inTable) flushTable("table-end");

  return elements;
}

/**
 * Formats inline bold, code, and links cleanly
 */
function renderInlineFormatting(text: string): React.ReactNode {
  // Simple token parser for **bold** and `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-neutral-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="px-1.5 py-0.5 rounded-md bg-neutral-100 text-indigo-700 font-mono text-xs border border-neutral-200">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
