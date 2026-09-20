"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Sparkles, Clock, Calendar, ArrowRight, BookOpen, Layers } from "lucide-react";
import { BlogNavbar } from "@/components/blog/BlogNavbar";
import { BlogFooter } from "@/components/blog/BlogFooter";
import { getAllBlogPosts, getFeaturedBlogPost } from "@/lib/blog/posts";
import { BlogPost } from "@/lib/blog/types";

const CATEGORIES = ["All", "AI Agents", "Content Strategy", "Technical SEO", "Growth"] as const;

export default function BlogIndexPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [posts, setPosts] = useState<BlogPost[]>(() => getAllBlogPosts());

  useEffect(() => {
    fetch("/api/platform/blog")
      .then((res) => res.json())
      .then((data) => {
        if (data.posts && Array.isArray(data.posts) && data.posts.length > 0) {
          const published = data.posts
            .filter((p: any) => p.status === "published")
            .map((d: any) => ({
              slug: d.slug,
              title: d.title,
              excerpt: d.excerpt,
              content: d.content,
              category: d.category,
              author: {
                name: d.author_name || "Editorial Team",
                role: d.author_role || "SEO Intelligence & Engineering",
                avatarUrl: d.author_avatar,
              },
              publishedAt: d.published_at ? d.published_at.slice(0, 10) : "2026-03-01",
              updatedAt: d.updated_at,
              readingTime: d.reading_time || "5 min read",
              coverImage: d.cover_image,
              coverImageAlt: d.cover_image_alt || d.title,
              metaTitle: d.meta_title || d.title,
              metaDescription: d.meta_description || d.excerpt,
              keywords: d.keywords || [],
              featured: Boolean(d.featured),
            }));
          if (published.length > 0) {
            setPosts(published);
          }
        }
      })
      .catch(() => {});
  }, []);

  const featuredPost = useMemo(() => {
    return posts.find((p) => p.featured) || posts[0];
  }, [posts]);

  // Filter posts based on category and search query
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory =
        selectedCategory === "All" || post.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.keywords.some((k) => k.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [posts, selectedCategory, searchQuery]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-indigo-500/20">
      {/* 1. Public Navbar */}
      <BlogNavbar />

      <main className="max-w-7xl mx-auto px-6 pt-12 pb-24 space-y-16">
        {/* 2. Hero Header */}
        <section className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SEO Intelligence & Growth Playbooks</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 leading-tight">
            The Autonomous AI SEO Blog
          </h1>
          <p className="text-base md:text-lg text-neutral-600 leading-relaxed">
            Data-backed strategies on autonomous AI SEO agents, high-density content frameworks, Search Console optimization, and technical site health.
          </p>

          {/* Search Bar */}
          <div className="pt-4 max-w-lg mx-auto relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics, strategies, or keywords..."
              className="w-full pl-11 pr-4 py-3 bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-200 focus:border-indigo-500 rounded-2xl text-sm text-neutral-800 placeholder-neutral-400 outline-none transition-all shadow-xs"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs font-semibold px-4 py-2 rounded-xl transition-all ${
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Featured Post (Only shown when not searching and viewing 'All') */}
        {selectedCategory === "All" && !searchQuery && featuredPost && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Featured Article</span>
            </div>

            <Link
              href={`/blog/${featuredPost.slug}`}
              className="group block bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 items-center">
                <div className="lg:col-span-7 relative h-72 md:h-96 w-full overflow-hidden bg-neutral-200">
                  <img
                    src={featuredPost.coverImage}
                    alt={featuredPost.coverImageAlt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-indigo-700 shadow-sm border border-neutral-200/50">
                      {featuredPost.category}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-5 p-8 md:p-10 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-neutral-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {featuredPost.publishedAt}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {featuredPost.readingTime}
                    </span>
                  </div>

                  <h2 className="text-2xl md:text-3xl font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {featuredPost.title}
                  </h2>

                  <p className="text-sm text-neutral-600 line-clamp-3 leading-relaxed">
                    {featuredPost.excerpt}
                  </p>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700">
                        {featuredPost.author.name[0]}
                      </div>
                      <div className="text-xs">
                        <p className="font-semibold text-neutral-900">{featuredPost.author.name}</p>
                        <p className="text-neutral-500">{featuredPost.author.role}</p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                      <span>Read Guide</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* 4. Article Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
            <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>
                {selectedCategory === "All" ? "All Articles" : `${selectedCategory} Articles`}
              </span>
              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                {filteredPosts.length}
              </span>
            </h2>
          </div>

          {filteredPosts.length === 0 ? (
            <div className="text-center py-20 bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl space-y-3">
              <p className="text-base font-semibold text-neutral-800">No articles match your criteria</p>
              <p className="text-xs text-neutral-500">Try a different search query or category filter.</p>
              <button
                type="button"
                onClick={() => { setSelectedCategory("All"); setSearchQuery(""); }}
                className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post) => (
                <article
                  key={post.slug}
                  className="group flex flex-col bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all hover:border-neutral-300"
                >
                  <Link href={`/blog/${post.slug}`} className="block relative h-52 w-full overflow-hidden bg-neutral-100">
                    <img
                      src={post.coverImage}
                      alt={post.coverImageAlt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-indigo-700 shadow-xs border border-neutral-200/50">
                        {post.category}
                      </span>
                    </div>
                  </Link>

                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-neutral-400 font-medium">
                        <span>{post.publishedAt}</span>
                        <span>•</span>
                        <span>{post.readingTime}</span>
                      </div>

                      <h3 className="text-lg font-bold text-neutral-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2">
                        <Link href={`/blog/${post.slug}`}>
                          {post.title}
                        </Link>
                      </h3>

                      <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs">
                      <span className="text-neutral-500 font-medium">{post.author.name}</span>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 font-bold text-indigo-600 group-hover:translate-x-1 transition-transform"
                      >
                        <span>Read</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 5. Public Footer */}
      <BlogFooter />
    </div>
  );
}
