# Supabase Setup Guide

This guide walks you through connecting a real Supabase project to the SEO Autopilot platform.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click **New Project**
3. Choose a name (e.g. `seo-autopilot`) and a strong database password
4. Select a region close to your users
5. Wait for the project to provision (~2 min)

---

## Step 2: Add Environment Variables

Create a `.env.local` file in the project root (copy from `.env.example` if it exists):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server only, never expose to browser

# Site URL (for auth redirects)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# DataForSEO
DATAFORSEO_LOGIN=your-login
DATAFORSEO_PASSWORD=your-password
```

> ⚠️ **Never commit `.env.local` to Git.** It is already in `.gitignore`.

Get your keys from **Supabase Dashboard → Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY` → `service_role` key (keep this secret)

---

## Step 3: Run Database Migrations

In the Supabase Dashboard, go to **SQL Editor** and run each migration file in order:

```
supabase/migrations/00000_initial.sql
supabase/migrations/00001_backlink_agent.sql
supabase/migrations/00002_strategy_agent.sql
supabase/migrations/00003_phase2_autonomous.sql
supabase/migrations/00004_keyword_agent.sql
supabase/migrations/00005_content_agent.sql
supabase/migrations/00006_on_page_agent.sql
supabase/migrations/00007_project_memory.sql
supabase/migrations/00008_image_agent.sql
supabase/migrations/00009_technical_seo_agent.sql
supabase/migrations/00010_integration_system.sql
supabase/migrations/00011_scheduled_agent.sql
supabase/migrations/00012_auth_foundation.sql   ← users enhanced + projects
supabase/migrations/00013_task_execution.sql    ← tasks + executions
supabase/migrations/00014_usage_costs.sql       ← usage tracking
supabase/migrations/00015_approvals_notifications_audit.sql
```

Or use the [Supabase CLI](https://supabase.com/docs/guides/cli):
```bash
npx supabase db push
```

---

## Step 4: Configure Email Auth

In Supabase Dashboard → **Authentication → Settings**:

1. Set **Site URL** to your deployment URL (e.g. `https://your-app.vercel.app`)
2. Add to **Redirect URLs**: `https://your-app.vercel.app/auth/callback`
3. Enable **Email Confirmations** if desired

For local dev, also add `http://localhost:3000/auth/callback`.

---

## Step 5: Enable Google OAuth (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID
3. Set Authorized redirect URI to: `https://your-project-ref.supabase.co/auth/v1/callback`
4. In Supabase Dashboard → Authentication → Providers → Google: enable and paste Client ID + Secret

The database schema is already structured to support Google OAuth without changes.

---

## Step 6: Deploy to Vercel

1. Push code to GitHub (already done ✅)
2. Go to [vercel.com](https://vercel.com) → Import the `seo-` repository
3. In **Environment Variables**, add all keys from Step 2
4. Set `NEXT_PUBLIC_SITE_URL` to your Vercel deployment URL
5. Deploy

---

## Verification Checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set (not placeholder)
- [ ] All 16 migration files run successfully
- [ ] Sign up with a new email works
- [ ] Email verification received
- [ ] Login redirects to `/dashboard`
- [ ] Logout redirects to `/login`
- [ ] `/dashboard` without login redirects to `/login`
- [ ] Usage events appear in `usage_events` table after running an agent
