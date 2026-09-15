<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PERMANENT ARCHITECTURAL RULES & AI CONFIGURATION

## 1. AI WRITING MODEL IS LOCKED TO CLAUDE SONNET 5
- **MANDATE**: The primary writer model for all articles, drafts, and long-form prose is STRICTLY `claude-sonnet-5` (Anthropic).
- **PROHIBITION**: DO NOT under any circumstances change, replace, degrade, or substitute the writing model away from Claude Sonnet 5 (do NOT switch to Haiku, GPT-4o, GPT-5, or any other model for article writing). The user explicitly mandated Claude Sonnet 5.

## 2. STRICT TOKEN CONSERVATION & ZERO HIDDEN REASONING TOKENS
- **Zero Thinking Tokens**: Anthropic API calls on `claude-sonnet-5` MUST ALWAYS have extended thinking DISABLED: `providerOptions: { anthropic: { thinking: { type: 'disabled' } } }`. Never enable thinking tokens as it burns 2,000–4,000 hidden tokens per call.
- **Zero Prompt Duplication**: Never inject project memory, instructions, or knowledge banks twice (do not duplicate between `system` and `prompt`). Single-pass injection only.
- **Zero Discarded Reflection Blocks**: Never ask the model to generate intermediate `<reflection>` or scratchpad blocks before drafting. The model must write directly to the output.
- **Word Count Discipline**: Articles must strictly adhere to the requested word count (1,200–1,600 words) without filler or fluff.

## 3. ZERO TABLE OF CONTENTS (STRICTLY PROHIBITED)
- **MANDATE**: Never generate or render a "Table of Contents", "## Table of Contents", or bullet lists of anchor links.
- **PROHIBITION**: No Table of Contents blocks, widgets, or components anywhere in the articles. Flow immediately from the H1 and introduction into the first H2 topic.

## 4. ZERO SILENT SERVERLESS ABANDONMENT (VERCEL LIFECYCLE CONTRACT)
- **Mandatory Lifecycle Awareness**: On Vercel Serverless (Next.js App Router), returning an HTTP response (`NextResponse.json`) terminates the execution container and immediately freezes all unresolved background promises.
- **PROHIBITION**: NEVER return an HTTP response while unawaited critical promises (database writes, notifications, draft saving) are still running.
- **Instant Pre-Ticketing Requirement**: When launching any long-running or autonomous operation (e.g. article drafting), insert a tracking record into the database (`status: 'writing'`) *before* beginning heavy computation so the draft exists in Supabase from second 1.
- **Time-Bounded Sub-Tasks**: Synchronous pipelines must finish under 45 seconds total. Enforce strict timeouts on sub-tasks (e.g., image generation $\le 14$s, keyword lookup $\le 3$s) so no third-party API can stall the pipeline.
- **Guaranteed Error Handling**: Every pipeline must have a top-level `try/catch` that updates the database record to `status: 'failed'` and alerts the user on Telegram with the failure reason. Never fail silently.

## 5. ZERO REGRESSION POLICY & IMPACT RADIUS DISCIPLINE
- **No Cascading Breakages**: When fixing one feature or bug, NEVER touch or destabilize unrelated working code, UI components, or routes.
- **Strict Database Schema Discipline**: Never write queries that assume non-existent database columns. Always verify table schema (e.g., `content_drafts` stores WordPress post URLs inside `revision_notes` JSON, NOT in a raw `wordpress_post_url` column).
- **Compilation Gate**: Before completing any modification, ALWAYS run `npx tsc --noEmit`. Zero TypeScript errors permitted.

## 6. TELEGRAM BOT RELIABILITY CONTRACT
- **Chat ID Preservation**: Always pass the originating `chat_id` into execution handlers so approval cards (`[Approve & Publish] [Reject]`) are delivered directly to the user who requested them.
- **Deduplication**: Keep update deduplication active to prevent double-processing on Telegram network retries.
- **Natural Language Parsing**: Conversational greetings/questions must route to `conversation_response`; actionable instructions must route to `immediate_action` or `scheduled_task`.

## 7. CONTENT PLANNER & MARKDOWN RENDERING INTEGRITY
- **Formatted View Default**: The Content Planner must always default to formatted article view (`📖 Formatted Article View`).
- **Markdown Rendering**: Headings (H1–H4), blockquotes, lists, images, and tables must render cleanly without raw tags or split `![alt]\n(url)` markers.
- **No Flash of Unparsed Content**: Never dump raw markdown or unstyled text onto the preview area.

## 8. COMMERCIAL MULTI-TENANT ARCHITECTURE & ZERO HARDCODED DOMAINS
- **MANDATE**: This platform is a commercial SaaS product built for paying clients across any industry, niche, or CMS. `bizaigenius.com` is strictly a test website, NOT a hardcoded system assumption.
- **PROHIBITION**: NEVER hardcode `bizaigenius.com`, cold email niches, specific author names, or test credentials into production routes, executors, or prompts.
- **Dynamic Multi-Tenant Scope**:
  - Every domain, URL, API call, category, WordPress job, and indexing request must be dynamically resolved from the active `website_id` / client website record.
  - Client niche and topic boundaries must be derived dynamically from the client's `project_memory`, `website_rules`, and live categories.
  - Every feature (indexing, crawling, drafting, scheduling, publishing) must work identically for any client website connected to the platform.




