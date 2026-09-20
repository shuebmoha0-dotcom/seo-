"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import {
  Sparkles,
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  Loader2,
  X,
  BookOpen,
} from "lucide-react";

interface AdminPost {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author_name?: string;
  author_role?: string;
  reading_time?: string;
  cover_image?: string;
  cover_image_alt?: string;
  meta_title?: string;
  meta_description?: string;
  keywords?: string[];
  status?: string;
  featured?: boolean;
  published_at?: string;
  created_at?: string;
}

const CATEGORIES = ["AI Agents", "Content Strategy", "Technical SEO", "Growth", "Case Studies"];

export default function PlatformBlogAdminPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modals state
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<AdminPost | null>(null);

  // AI Generator Form State
  const [aiTopic, setAiTopic] = useState("");
  const [aiCategory, setAiCategory] = useState("AI Agents");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatorError, setGeneratorError] = useState("");

  // Editor Form State
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState("AI Agents");
  const [formExcerpt, setFormExcerpt] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formMetaTitle, setFormMetaTitle] = useState("");
  const [formMetaDesc, setFormMetaDesc] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");
  const [formStatus, setFormStatus] = useState("published");
  const [formFeatured, setFormFeatured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");

  // Fetch all platform blog posts
  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/platform/blog");
      const data = await res.json();
      if (data.posts && Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error("Failed to load blog posts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchesCat = categoryFilter === "All" || p.category === categoryFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [posts, categoryFilter, searchQuery]);

  // Open editor for new post
  const handleOpenNewPost = () => {
    setEditingPost(null);
    setFormTitle("");
    setFormSlug("");
    setFormCategory("AI Agents");
    setFormExcerpt("");
    setFormContent("# Enter Article Title\n\nWrite your comprehensive editorial prose here...");
    setFormMetaTitle("");
    setFormMetaDesc("");
    setFormCoverImage(
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80"
    );
    setFormStatus("published");
    setFormFeatured(false);
    setEditorTab("write");
    setIsEditorModalOpen(true);
  };

  // Open editor for existing post
  const handleOpenEditPost = (post: AdminPost) => {
    setEditingPost(post);
    setFormTitle(post.title);
    setFormSlug(post.slug);
    setFormCategory(post.category);
    setFormExcerpt(post.excerpt);
    setFormContent(post.content);
    setFormMetaTitle(post.meta_title || post.title);
    setFormMetaDesc(post.meta_description || post.excerpt);
    setFormCoverImage(post.cover_image || "");
    setFormStatus(post.status || "published");
    setFormFeatured(Boolean(post.featured));
    setEditorTab("write");
    setIsEditorModalOpen(true);
  };

  // Save article (insert or update)
  const handleSavePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) {
      alert("Title and content are required.");
      return;
    }

    try {
      setIsSaving(true);
      const payload: any = {
        id: editingPost?.id,
        slug: formSlug.trim() || formTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: formTitle.trim(),
        category: formCategory,
        excerpt: formExcerpt.trim() || formTitle.trim(),
        content: formContent.trim(),
        meta_title: formMetaTitle.trim() || formTitle.trim(),
        meta_description: formMetaDesc.trim() || formExcerpt.trim(),
        cover_image: formCoverImage.trim(),
        status: formStatus,
        featured: formFeatured,
      };

      const res = await fetch("/api/platform/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save post");

      setIsEditorModalOpen(false);
      await fetchPosts();
    } catch (err: any) {
      alert(`Error saving post: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Publish / Draft status
  const handleToggleStatus = async (post: AdminPost) => {
    const nextStatus = post.status === "published" ? "draft" : "published";
    try {
      const res = await fetch("/api/platform/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...post,
          status: nextStatus,
        }),
      });
      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) => (p.slug === post.slug ? { ...p, status: nextStatus } : p))
        );
      }
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  // Delete article
  const handleDeletePost = async (post: AdminPost) => {
    if (!confirm(`Are you sure you want to delete "${post.title}"?`)) return;

    try {
      const res = await fetch(`/api/platform/blog?slug=${encodeURIComponent(post.slug)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.slug !== post.slug));
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Trigger AI generation
  const handleRunAiGenerator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;

    try {
      setIsGenerating(true);
      setGeneratorError("");
      const res = await fetch("/api/platform/blog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          category: aiCategory,
          status: "published",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate article");

      setIsAiModalOpen(false);
      setAiTopic("");
      await fetchPosts();
    } catch (err: any) {
      setGeneratorError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white border-b border-neutral-200 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 shadow-2xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Public SaaS Growth
              </span>
              <span className="text-xs text-neutral-400">•</span>
              <Link
                href="/blog"
                target="_blank"
                className="text-xs font-semibold text-neutral-500 hover:text-indigo-600 inline-flex items-center gap-1 transition-colors"
              >
                <span>View Public Blog</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight mt-1">
              Platform Blog Manager
            </h1>
            <p className="text-xs text-neutral-500">
              Control, write, and generate authoritative articles for your platform's public blog to rank on Google.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setAiTopic("");
                setGeneratorError("");
                setIsAiModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:shadow-indigo-500/20"
            >
              <Sparkles className="w-4 h-4 text-indigo-200" />
              <span>Generate with AI</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewPost}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-bold rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4 text-neutral-600" />
              <span>Write Article</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Total Published
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-neutral-900">
                  {posts.filter((p) => p.status === "published").length}
                </span>
                <span className="text-xs text-emerald-600 font-semibold">Live on Google</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Drafts in Queue
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-neutral-900">
                  {posts.filter((p) => p.status === "draft").length}
                </span>
                <span className="text-xs text-neutral-500 font-medium">Unpublished</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Target Categories
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-neutral-900">
                  {new Set(posts.map((p) => p.category)).size}
                </span>
                <span className="text-xs text-indigo-600 font-semibold">Topic Clusters</span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                Live URL
              </span>
              <div className="truncate">
                <Link
                  href="/blog"
                  target="_blank"
                  className="text-sm font-bold text-indigo-600 hover:underline flex items-center gap-1 truncate"
                >
                  <span>/blog</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </Link>
                <span className="text-[11px] text-neutral-400 block truncate">Public visitor blog</span>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles by title or slug..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 placeholder-neutral-400 outline-none focus:bg-white focus:border-indigo-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              {["All", ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${
                    categoryFilter === cat
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Articles Table */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center space-y-3">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-neutral-500">Loading platform blog articles...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-neutral-300 mx-auto" />
                <p className="text-sm font-bold text-neutral-800">No articles found</p>
                <p className="text-xs text-neutral-500">Try another search or click "Generate with AI" to write one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 bg-neutral-50/80 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-5">Article</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Reading Time</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredPosts.map((post) => (
                      <tr key={post.slug} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3 max-w-lg">
                            {post.cover_image && (
                              <img
                                src={post.cover_image}
                                alt={post.title}
                                className="w-12 h-12 rounded-xl object-cover border border-neutral-200 shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <h3 className="font-bold text-neutral-900 truncate leading-snug">
                                {post.title}
                              </h3>
                              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                                <span className="font-mono text-neutral-500">/blog/{post.slug}</span>
                                {post.featured && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-bold text-[9px] border border-amber-200">
                                    Featured
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                            {post.category}
                          </span>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap text-neutral-500">
                          {post.reading_time || "5 min read"}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(post)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                              post.status === "published"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200"
                            }`}
                          >
                            {post.status === "published" ? "● Published" : "○ Draft"}
                          </button>
                        </td>

                        <td className="py-4 px-4 text-right whitespace-nowrap space-x-2">
                          <Link
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            className="p-1.5 text-neutral-500 hover:text-indigo-600 rounded-lg hover:bg-neutral-100 inline-flex items-center transition-colors"
                            title="View Live on /blog"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleOpenEditPost(post)}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 inline-flex items-center transition-colors"
                            title="Edit Article"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePost(post)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 inline-flex items-center transition-colors"
                            title="Delete Article"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── MODAL 1: AI GENERATOR MODAL ────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900">
                    AI Platform Article Writer
                  </h3>
                  <p className="text-xs text-neutral-500">
                    The agent will research, structure, and draft a 1,400-word article for /blog.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isGenerating && setIsAiModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatorError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{generatorError}</span>
              </div>
            )}

            <form onSubmit={handleRunAiGenerator} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">
                  Target Topic or Primary Keyword *
                </label>
                <input
                  type="text"
                  required
                  disabled={isGenerating}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Best autonomous SEO agents for SaaS in 2026"
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
                <p className="text-[11px] text-neutral-400">
                  Tip: Focus on commercial search intent or technical SEO comparisons.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700">Target Category</label>
                <select
                  disabled={isGenerating}
                  value={aiCategory}
                  onChange={(e) => setAiCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-neutral-100">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isGenerating || !aiTopic.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Drafting 1,400 Words...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Start Autonomous Drafting</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: FULL ARTICLE EDITOR MODAL ────────────────────────────── */}
      {isEditorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-neutral-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {editingPost ? `Edit Article: "${editingPost.title}"` : "Write Platform Article"}
                </h3>
                <p className="text-xs text-neutral-500">
                  Edits are immediately reflected on your public blog.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePost} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Article Title *</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">URL Slug *</label>
                    <input
                      type="text"
                      required
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Category</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-700">Publishing Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500"
                    >
                      <option value="published">Published (Live)</option>
                      <option value="draft">Draft (Hidden)</option>
                    </select>
                  </div>

                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={formFeatured}
                        onChange={(e) => setFormFeatured(e.target.checked)}
                        className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Featured Article (Hero spot)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700">Excerpt / Meta Snippet</label>
                  <textarea
                    rows={2}
                    value={formExcerpt}
                    onChange={(e) => setFormExcerpt(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-900 outline-none focus:bg-white focus:border-indigo-500"
                  />
                </div>

                {/* Content Editor with Tab switcher */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-neutral-700">
                      Article Content (Markdown) *
                    </label>
                    <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setEditorTab("write")}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          editorTab === "write" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500"
                        }`}
                      >
                        Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorTab("preview")}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                          editorTab === "preview" ? "bg-white text-neutral-900 shadow-2xs" : "text-neutral-500"
                        }`}
                      >
                        Preview
                      </button>
                    </div>
                  </div>

                  {editorTab === "write" ? (
                    <textarea
                      rows={14}
                      required
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="w-full font-mono text-xs px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 outline-none focus:bg-white focus:border-indigo-500 leading-relaxed"
                    />
                  ) : (
                    <div className="border border-neutral-200 rounded-xl p-5 bg-white min-h-[300px] overflow-y-auto prose prose-neutral max-w-none text-xs leading-relaxed">
                      <p className="text-neutral-500 text-[11px] mb-2 font-mono">--- Live Article Preview ---</p>
                      <pre className="whitespace-pre-wrap font-sans text-xs">{formContent}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50/50 flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  {formContent.trim().split(/\s+/).length} words
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsEditorModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Save Article</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
