# ContentOS — Agent Navigation

> Single source of truth for the current codebase state.
> If you change architecture, update this file before committing.

---

## 1. Overview

ContentOS is a minimal, dark-themed social content search engine MVP.

**Core loop:**
1. Admin uploads a video to `/admin` (or via `/api/upload`)
2. Back-end pipeline transcribes → summarizes → embeds → makes searchable
3. Public search at `/` queries vector embeddings via `match_content_items()`
4. Scheduled publishing pushes to connected social accounts via OAuth2 tokens

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`), black theme (`bg-black`) |
| Database | Supabase Postgres + pgvector (`vector(1536)`) |
| Storage | Supabase Storage, **private** bucket `temp_uploads` |
| AI | OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) + AssemblyAI (German transcription) |
| Auth | `ADMIN_SECRET` (Bearer header) + `CRON_SECRET` for cronjobs |
| Tests | Vitest (jsdom), 31 tests, `npx vitest run` |

---

## 3. Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Public /      │────▶│  /api/search     │────▶│  match_content  │
│   (Search)      │     │  (vector search) │     │  _items RPC     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│   /admin        │────▶│  /api/upload     │──────────────┘
│   (Upload)      │     │  + job enqueue   │
└─────────────────┘     └──────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   Job Pipeline      │
                    │  (processing_jobs)    │
                    │                     │
                    │  transcribe →       │
                    │  generate_summary →   │
                    │  create_combined_     │
                    │    document →         │
                    │  create_embedding    │
                    │                     │
                    │  (if scheduled)      │
                    │  publish_to_platform │
                    │  cleanup_temp_upload │
                    └───────────────────────┘
                          │
                          ▼
              ┌─────────────────────────────┐
              │   Platform Adapters         │
              │  tiktok | youtube | linkedin │
              │  instagram (experimental)    │
              │   via OAuth2 tokens          │
              └─────────────────────────────┘
```

---

## 4. File Structure

```
app/
  page.tsx                    # Public search UI (thumbnails, YT embed, badges)
  layout.tsx                  # Black bg, suppressHydrationWarning
  globals.css                 # @import "tailwindcss"
  admin/
    page.tsx                  # Orchestrator (~100 lines)
    components/
      LoginGate.tsx           # Admin login UI
      OAuthPanel.tsx        # Connect/disconnect platform accounts
      DashboardStats.tsx      # Stats cards + pending jobs list
      UploadForm.tsx          # Upload form with validation
  api/
    auth/[platform]/          # OAuth redirect
      route.ts
      callback/
        route.ts              # Token exchange + LinkedIn URN auto-fetch
    admin/
      stats/route.ts          # Dashboard data
      accounts/route.ts       # Connected accounts (service-role)
      disconnect/route.ts     # Deactivate account
    upload/route.ts           # Multipart upload, 500MB validation
    search/route.ts           # Vector search via RPC
    jobs/process/route.ts     # Job worker (cron-guarded)
    cron/
      publish-scheduled/route.ts
      cleanup-temp-uploads/route.ts
lib/
  supabase/
    admin.ts                  # Service-role client (server only)
    client.ts                 # Browser client factory getSupabaseClient() (lazy init)
  auth/
    admin.ts                  # assertAdmin(req), assertCron(req)
  ai/
    assembly.ts               # AssemblyAI transcription
    embeddings.ts             # OpenAI text-embedding-3-small + gpt-4o-mini summary
  oauth/
    core.ts                   # generateState, generatePKCE, validateState
    config.ts                 # Per-platform OAuth URLs, scopes, PKCE flags
    callback-post.ts          # LinkedIn URN fetch after callback
  platforms/
    types.ts                  # PlatformAdapter interface
    account.ts                # getActivePlatformAccount(), persistTokens()
    utils.ts                  # downloadVideo() via fetchWithTimeout
    index.ts                  # Adapter registry
    tiktok.ts, youtube.ts,
    linkedin.ts, instagram.ts  # OAuth2 + publish adapters
  jobs/
    queue.ts                  # enqueueJob(), claimPendingJobs()
    handlers/
      index.ts                # Registry: HANDLERS map + runJob dispatcher
      shared.ts               # addBackoffMinutes, getSignedTempUrl
      transcribe.ts
      generate-summary.ts
      create-combined-document.ts
      create-embedding.ts
      publish-to-platform.ts
      cleanup-temp-upload.ts
  upload/
    validate.ts               # MIME, extension, size checks
    service.ts              # processUpload() — business logic extracted from route
  fetch-timeout.ts            # AbortController fetch wrapper (30s)
  chunked-upload.ts           # YouTube 8MB chunk resume upload
migrations/
  001_oauth.sql              # oauth_states + platform_accounts.user_id
  002_rls.sql                # RLS policies + SECURITY DEFINER RPC
schema.sql                    # Full DDL (tables, indexes, triggers, RPC)
```

---

## 5. Database Schema (Summary)

Full DDL lives in `schema.sql`. Key tables:

| Table | Purpose |
|-------|---------|
| `content_items` | Master record: title, description, processing_status, visibility |
| `platforms` | 4 active rows: tiktok, youtube, linkedin, instagram |
| `temporary_uploads` | Storage reference + expiry. Status: `available` → `deleted` |
| `platform_posts` | One per target platform; links content_item to a post |
| `platform_accounts` | OAuth tokens (`access_token`, `refresh_token`, `token_expires_at`, `metadata`) |
| `oauth_states` | CSRF state + PKCE verifier, 10 min TTL |
| `processing_jobs` | Queue: `pending`/`running`/`completed`/`failed` |
| `content_documents` | Transcription text, summary, keywords |
| `content_embeddings` | `vector(1536)` per document for similarity search |
| `search_logs` | Audit trail of public queries |

**RLS:** Enabled on `content_items` and `platforms`. Public `SELECT` only if `visibility='public'` AND `processing_status='ready'`. All other tables require service-role.

---

## 6. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/:platform` | GET | – | Redirects to OAuth authorize URL, stores state |
| `/api/auth/:platform/callback` | GET | – | Exchanges code → tokens, upserts `platform_accounts` |
| `/api/upload` | POST | `Bearer ADMIN_SECRET` | Multipart upload, creates content_item + temp_upload + platform_posts + enqueues `transcribe` |
| `/api/search` | POST | – | Vector search via `match_content_items` RPC |
| `/api/jobs/process` | POST | `Bearer CRON_SECRET` | Claims + runs oldest pending jobs |
| `/api/cron/publish-scheduled` | POST | `Bearer CRON_SECRET` | Enqueues publish jobs for due `platform_posts` |
| `/api/cron/cleanup-temp-uploads` | POST | `Bearer CRON_SECRET` | Enqueues cleanup for expired uploads |
| `/api/admin/stats` | GET | `Bearer ADMIN_SECRET` | Dashboard counts |
| `/api/admin/accounts` | GET | `Bearer ADMIN_SECRET` | Connected OAuth accounts |
| `/api/admin/disconnect` | POST | `Bearer ADMIN_SECRET` | Deactivates `platform_accounts` row |

---

## 7. Job Pipeline

Order of execution per content item:

1. `transcribe` — AssemblyAI (German)
2. `generate_summary` — GPT-4o-mini → `content_documents`
3. `create_combined_document` — merges transcription + summary + keywords
4. `create_embedding` — `text-embedding-3-small` → `content_embeddings`

When scheduled:
5. `publish_to_platform` — per `platform_post` row (only after all siblings finished → `cleanup_temp_upload`)
6. `cleanup_temp_upload` — idempotent storage removal

**Multi-platform-safe cleanup:** `handlePublishToPlatform` checks ALL sibling `platform_posts` for the same `content_item_id`. Only if every sibling is in terminal state (`published`/`failed`/`cancelled`) does it enqueue `cleanup_temp_upload`.

---

## 8. OAuth Flow (Admin-only, Option 2)

1. Admin clicks **Verbinden** on `/admin` → `/api/auth/:platform`
2. API generates `state` (+ PKCE for YouTube/LinkedIn) → stores in `oauth_states`
3. Redirects to platform login
4. User grants permission → callback to `/api/auth/:platform/callback`
5. Code exchanged for `access_token` + `refresh_token`
6. Upserted into `platform_accounts` (`user_id` = **null** for admin)
7. **LinkedIn bonus:** auto-fetches `urn:li:person:XXX` via `/v2/me` and stores in `metadata`

**Multi-user ready:** `user_id` column exists. Admin = null. Future: per-user rows with UUID → add `user_id` to `oauth_states`, `platform_accounts` `upsert` logic, and `/api/admin/accounts` queries.

---

## 9. Platform Adapter Status

| Platform | Status | Token Rotation | Notes |
|----------|--------|----------------|-------|
| **TikTok** | Fully implemented | ✅ Persist new `refresh_token` | `PULL_FROM_URL` flow |
| **YouTube** | Fully implemented | ⚠️ Google never returns new `refresh_token`; persist `expires_at` | Resumable upload, now **chunked** (8MB) |
| **LinkedIn** | Fully implemented | ✅ Persist rotated `refresh_token` | Auto-fetches `owner_urn` on OAuth callback |
| **Instagram** | Experimental | ⚠️ `fb_exchange_token` 60-day swap | Needs Business/Creator account + `instagram_business_account_id` in metadata |

**Fallback:** All adapters fall back to env vars (`TIKTOK_CLIENT_KEY`, etc.) if no active `platform_accounts` row exists. For production, always use DB credentials.

---

## 10. Testing

```bash
npx vitest run          # 31 tests
npx tsc --noEmit        # Type checking
```

Test files mirror source:
- `lib/oauth/core.test.ts`
- `lib/oauth/config.test.ts`
- `lib/oauth/callback-post.test.ts`
- `lib/fetch-timeout.test.ts`
- `lib/upload/validate.test.ts`
- `lib/chunked-upload.test.ts`

Style: Integration-like through public interfaces. Vertical slices (one test, one implementation).

---

## 11. Environment Variables

Copy `.env.example` to `.env.local`. Required:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=
APP_BASE_URL=https://your-domain.com        # for OAuth redirects
ADMIN_SECRET=                               # strong random string
CRON_SECRET=                                # strong random string

# OAuth app credentials (per platform)
TIKTOK_CLIENT_KEY=      TIKTOK_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=      YOUTUBE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=     LINKEDIN_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=     FACEBOOK_CLIENT_SECRET=   # used for Instagram
```

Platform **account tokens** come from `platform_accounts` table after OAuth callback. Env var fallbacks exist but are deprecated.

---

## 12. Deployment (Vercel)

1. `output: 'standalone'` in `next.config.ts` → ready for Vercel
2. **Cronjobs** (3 endpoints, `Authorization: Bearer CRON_SECRET`):
   - `POST /api/cron/publish-scheduled` (5 min)
   - `POST /api/jobs/process` (5 min)
   - `POST /api/cron/cleanup-temp-uploads` (hourly)
3. Environment variables in Vercel dashboard → all secrets
4. Supabase project connected (URL + keys)
5. Run `schema.sql` + migrations in Supabase SQL Editor
6. Create private Storage bucket `temp_uploads`

---

## 13. How to Add a New Platform

1. Create `lib/platforms/{platform}.ts` implementing `PlatformAdapter`
2. Register in `lib/platforms/index.ts`
3. Add OAuth config to `lib/oauth/config.ts` (or add to `platformOAuthConfig`)
4. Run OAuth app setup (redirect URI: `/api/auth/{platform}/callback`)
5. Insert row into `platforms` table + connect via `/admin`
6. Add env vars (`{PLATFORM}_CLIENT_ID`, `{PLATFORM}_CLIENT_SECRET`)
7. Write tests for the adapter + OAuth callback

---

## 14. Key Decisions (Why we chose this)

| Decision | Context | Consequence |
|----------|---------|-------------|
| Lazy `getSupabaseClient()` | Module-level `createClient` crashed SSR when env vars missing | Browser client only instantiates on first call |
| `SECURITY DEFINER` on `match_content_items` | RLS blocked public role from reading embeddings | RPC works for public search without embedding table access |
| Chunked YouTube upload (8MB) | Serverless memory limits hit with direct `arrayBuffer` upload | Lower peak RAM, supports 308 resume |
| OAuth tokens in DB, not env | Multi-user future + token rotation | `platform_accounts` table with `user_id` nullable |
| Anon key + service role separation | RLS policies need service role for admin ops | `supabaseAdmin` for API routes, `getSupabaseClient()` for public reads |

---

*Last updated: 2026-05-28 (after chunked upload, RLS, OAuth URN fetch)*
