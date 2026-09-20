export interface BlogPostAuthor {
  name: string;
  role: string;
  avatarUrl?: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: 'AI Agents' | 'Content Strategy' | 'Technical SEO' | 'Growth' | 'Case Studies';
  author: BlogPostAuthor;
  publishedAt: string; // ISO date string: '2026-03-15'
  updatedAt?: string;
  readingTime: string; // '6 min read'
  coverImage: string;
  coverImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  featured?: boolean;
}
