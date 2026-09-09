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

