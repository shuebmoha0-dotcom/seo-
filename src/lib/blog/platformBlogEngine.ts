import { createAdminClient } from '@/lib/supabase/admin';
import { LLMProvider } from '@/lib/tools/llm';
import { TelegramService } from '@/lib/telegram/telegramService';
import { z } from 'zod';

export interface PlatformTopic {
  title: string;
  slug: string;
  targetKeyword: string;
  category: 'AI Agents' | 'Content Strategy' | 'Technical SEO' | 'Growth' | 'Case Studies';
  brief: string;
}

export const PLATFORM_TOPIC_BACKLOG: PlatformTopic[] = [
  {
    title: 'Autonomous AI SEO Agents vs. Traditional SEO: The 2026 Paradigm Shift',
    slug: 'autonomous-ai-seo-agent-vs-traditional-seo',
    targetKeyword: 'autonomous ai seo agent',
    category: 'AI Agents',
    brief: 'A technical deep-dive into how autonomous background agents replace manual SEO agency retainers by combining continuous Search Console auditing, automated keyword discovery, and autonomous publishing.',
  },
  {
    title: 'How to Automate Technical SEO Audits and Auto-Fix Broken Links',
    slug: 'how-to-automate-technical-seo-audits',
    targetKeyword: 'automate technical seo audits',
    category: 'Technical SEO',
    brief: 'Step-by-step engineering architecture for running scheduled headless browser crawls, detecting 404 links, orphan pages, redirect chains, and auto-dispatching pull requests to resolve them.',
  },
  {
    title: 'The Enterprise Editorial Framework: Ranking Long-Form Content Without Fluff',
    slug: 'enterprise-editorial-seo-framework',
    targetKeyword: 'enterprise editorial seo framework',
    category: 'Content Strategy',
    brief: 'How high-growth tech companies produce 1,400-word cornerstone articles that rank #1 on Google by maximizing information density, data visualizations, and comparative tables.',
  },
  {
    title: 'Google Search Console API: Real-Time Indexation and Performance Tracking',
    slug: 'google-search-console-api-real-time-indexing',
    targetKeyword: 'google search console api indexing',
    category: 'Technical SEO',
    brief: 'Detailed guide to leveraging GSC Webmaster APIs, inspection tools, and batch XML sitemaps to reduce Google indexation latency from 3 weeks down to under 24 hours.',
  },
  {
    title: 'Programmatic Internal Linking: Algorithms for Distributing PageRank',
    slug: 'programmatic-internal-linking-algorithms',
    targetKeyword: 'programmatic internal linking',
    category: 'Growth',
    brief: 'Mathematical graph approaches to dynamic internal linking. How autonomous algorithms identify high-authority cornerstone pages and route equity to striking-distance target URLs.',
  },
  {
    title: 'AI Search Optimization (GEO): Ranking in ChatGPT, Claude, and Gemini Answers',
    slug: 'ai-search-optimization-generative-engine-rankings',
    targetKeyword: 'ai search optimization geo',
    category: 'AI Agents',
    brief: 'Optimizing B2B content for LLM retrieval and Generative Engine Optimization (GEO). How to ensure your product is cited in Perplexity, SearchGPT, and Gemini answers.',
  },
  {
    title: 'Competitor Reverse-Engineering: How Autonomous Agents Steal High-Intent Traffic',
    slug: 'competitor-reverse-engineering-seo',
    targetKeyword: 'competitor reverse engineering seo',
    category: 'Growth',
    brief: 'Deconstructing top-ranking competitor search footprints. Finding their top-performing subdirectories, backlink assets, and keyword gaps to systematically outrank them.',
  },
  {
    title: 'Crawl Budget Waste: How Modern SaaS Sites Bleed Search Engine Crawlers',
    slug: 'crawl-budget-waste-modern-saas',
    targetKeyword: 'crawl budget waste saas',
    category: 'Technical SEO',
    brief: 'Identifying and resolving faceted navigation loops, non-canonical URL proliferation, and server response latency that prevent Googlebot from indexing high-converting landing pages.',
  },
  {
    title: 'Headless WordPress SEO: Deploying Autonomous Editorial Agents via REST API',
    slug: 'headless-wordpress-seo-autonomous-agents',
    targetKeyword: 'headless wordpress seo agents',
    category: 'AI Agents',
    brief: 'Connecting AI execution workers to WordPress via secure Application Passwords, native Gutenberg block markup, and programmatic schema injection with zero plugin bloat.',
  },
  {
    title: 'Striking Distance Keyword Strategy: Unlocking 3x Organic Clicks on Positions 4–20',
    slug: 'striking-distance-keyword-scaling-strategy',
    targetKeyword: 'striking distance keyword strategy',
    category: 'Content Strategy',
    brief: 'Why optimizing existing URLs ranking between positions 4 and 20 produces faster ROI than writing new articles from scratch. The surgical optimization playbook.',
  },
];

const CATEGORY_IMAGES: Record<string, string> = {
  'AI Agents': 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
  'Content Strategy': 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80',
  'Technical SEO': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
  'Growth': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  'Case Studies': 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
};

export class PlatformBlogEngine {
  /**
   * Check if an article was published in the last 24h. If not, generate and publish one.
   */
  static async checkAndPublishDailyPlatformArticle(force = false): Promise<{
    published: boolean;
    reason?: string;
    post?: any;
  }> {
    const supabase = createAdminClient();
    const now = new Date();

    // 1. Check if already published in the last 24 hours
    if (!force) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentPosts, error: checkErr } = await supabase
        .from('platform_blog_posts')
        .select('id, slug, published_at')
        .gte('published_at', oneDayAgo)
        .eq('status', 'published')
        .limit(1);

      if (checkErr) {
        console.warn('[PlatformBlogEngine] Error checking recent platform posts:', checkErr.message);
      } else if (recentPosts && recentPosts.length > 0) {
        return {
          published: false,
          reason: `Daily quota satisfied. Article "${recentPosts[0].slug}" published within the last 24 hours.`,
        };
      }
    }

    // 2. Retrieve existing slugs to prevent duplicates
    const { data: existingRows } = await supabase
      .from('platform_blog_posts')
      .select('slug');

    const existingSlugs = new Set((existingRows || []).map((r) => r.slug.toLowerCase()));

    // 3. Find next topic from backlog
    let chosenTopic = PLATFORM_TOPIC_BACKLOG.find((t) => !existingSlugs.has(t.slug.toLowerCase()));

    // Fallback: If backlog exhausted, derive next high-intent topic dynamically
    if (!chosenTopic) {
      const dynamicSlug = `autonomous-seo-guide-${Date.now()}`;
      chosenTopic = {
        title: 'Continuous Autonomous SEO: Real-Time Algorithmic Adaptation in 2026',
        slug: dynamicSlug,
        targetKeyword: 'autonomous continuous seo',
        category: 'AI Agents',
        brief: 'How real-time search signal indexing and agentic workflows outperform periodic batch campaigns.',
      };
    }

    console.log(`[PlatformBlogEngine] Drafting new daily article: "${chosenTopic.title}" (target: ${chosenTopic.targetKeyword})`);

    // 4. Generate high-density article via Claude Sonnet 5 with thinking disabled
    const systemPrompt = `You are the principal author and search strategist for Outdart (https://outdart.com), an autonomous enterprise AI SEO agent platform.
Write a comprehensive, authoritative, high-density 1,300–1,500 word cornerstone guide for the Outdart platform blog.

STRICT EDITORIAL RULES:
- High Information Density: Short, punchy paragraphs (2-3 sentences max). Zero corporate fluff, zero intros like "In today's fast-paced digital world...".
- Strict Structure: Start directly with the H1 title. Follow with a direct executive thesis, 4-5 structured H2 sections, concrete implementation code or workflows, a comprehensive Markdown comparative table, and an actionable checklist conclusion.
- PROHIBITION: NEVER render a Table of Contents ("Table of Contents", "## Table of Contents", or bullet lists of anchor links). Flow directly from H1 and intro into the first H2.
- In-Body Graphics: Integrate 1-2 relevant technical graphics with markdown syntax: ![Architecture Diagram](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80 "Execution Architecture")
- Tone: Technical, authoritative, experienced practitioner perspective.
- Length: Strictly 1,300 to 1,500 words.`;

    const prompt = `Topic: "${chosenTopic.title}". Target Keyword: "${chosenTopic.targetKeyword}". Brief: ${chosenTopic.brief}.`;

    const { object: articleData } = await LLMProvider.generateObject<{
      title: string;
      slug: string;
      excerpt: string;
      category: string;
      metaTitle: string;
      metaDescription: string;
      keywords: string[];
      content: string;
    }>({
      agent: 'ContentAgent',
      taskType: 'long_form_article',
      complexity: 'complex',
      schema: z.object({
        title: z.string().describe('Compelling H1 Title'),
        slug: z.string().describe('URL-friendly slug'),
        excerpt: z.string().describe('2-sentence punchy summary for SERP snippet and social cards'),
        category: z.string().describe('Category name'),
        metaTitle: z.string().describe('SEO Meta Title under 60 chars'),
        metaDescription: z.string().describe('SEO Meta Description under 155 chars'),
        keywords: z.array(z.string()).describe('Target search keywords'),
        content: z.string().describe('Full markdown body starting directly from the H1 without Table of Contents'),
      }),
      system: systemPrompt,
      prompt,
    });

    // Strip any rogue table of contents if generated
    let finalContent = (articleData.content || '').replace(/##\s*Table of Contents[\s\S]*?(?=##\s*)/i, '');

    const wordCount = finalContent.trim().split(/\s+/).length;
    const readingTime = `${Math.max(1, Math.round(wordCount / 220))} min read`;
    const coverImage = CATEGORY_IMAGES[chosenTopic.category] || CATEGORY_IMAGES['AI Agents'];

    // 5. Insert into Supabase platform_blog_posts table
    const { data: newPost, error: insertError } = await supabase
      .from('platform_blog_posts')
      .insert({
        slug: chosenTopic.slug,
        title: articleData.title || chosenTopic.title,
        excerpt: articleData.excerpt,
        content: finalContent,
        category: chosenTopic.category,
        author_name: 'Editorial Team',
        author_role: 'SEO Intelligence & Engineering',
        reading_time: readingTime,
        cover_image: coverImage,
        cover_image_alt: articleData.title || chosenTopic.title,
        meta_title: articleData.metaTitle || chosenTopic.title,
        meta_description: articleData.metaDescription || articleData.excerpt,
        keywords: articleData.keywords || [chosenTopic.targetKeyword],
        status: 'published',
        published_at: now.toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[PlatformBlogEngine] Insert error:', insertError);
      if (insertError.code === '42501') {
        console.warn('[PlatformBlogEngine] RLS policy notice: SUPABASE_SERVICE_ROLE_KEY must be configured in environment variables to allow background insertion into platform_blog_posts.');
      }
      return {
        published: false,
        reason: `Database insertion rejected: ${insertError.message} (Code: ${insertError.code}). Ensure SUPABASE_SERVICE_ROLE_KEY is set in environment.`,
      };
    }

    console.log(`[PlatformBlogEngine] Successfully published daily platform post: https://outdart.com/blog/${chosenTopic.slug}`);

    // 6. Notify Admin via Telegram (if configured)
    try {
      const telegram = new TelegramService();
      if (telegram.configured) {
        const subscribers = await telegram.getSubscribers();
        const notificationText =
          `🚀 *New Platform Blog Published Live!*\n\n` +
          `📰 *Title:* ${newPost.title}\n` +
          `🔗 *URL:* https://outdart.com/blog/${newPost.slug}\n` +
          `⏱ *Word Count:* ${wordCount} words (${readingTime})\n` +
          `🏷 *Target Keyword:* \`${chosenTopic.targetKeyword}\`\n\n` +
          `_Indexed in sitemap.xml and ranking engine._`;

        for (const sub of subscribers) {
          await telegram.sendMessage(sub.chat_id, notificationText, { parse_mode: 'Markdown' });
        }
      }
    } catch (teleErr) {
      console.warn('[PlatformBlogEngine] Telegram notification notice:', teleErr);
    }

    return {
      published: true,
      post: newPost,
    };
  }
}
