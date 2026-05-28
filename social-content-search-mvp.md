# Social Content Search — MVP Specification

> Aktueller Systemzustand (Code + Architektur) → [`CONTEXT.md`](./CONTEXT.md)

---

## 1. Ziel

Plattformagnostische Web-App für:

- temporären Video-Upload (Admin-only)
- automatische Transkription + semantische Indexierung
- öffentliche Vektor-Suche über Content-Bibliothek
- geplante Veröffentlichung auf Social-Media-Plattformen (OAuth2)

---

## 2. Tech Stack

| Layer | Tech |
|-------|------|
| App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, black theme |
| DB | Supabase Postgres + pgvector extension |
| Storage | Supabase Storage, private bucket `temp_uploads` |
| AI | OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) + AssemblyAI (German) |
| Auth | `ADMIN_SECRET` + `CRON_SECRET` (Bearer tokens) |
| Tests | Vitest |

---

## 3. Datenbank (Kurz)

Siehe `schema.sql` für vollständiges DDL. Kern-Tabellen:

- `content_items` — Masterdatensatz
- `content_documents` — Transkription, Summary, Keywords
- `content_embeddings` — `vector(1536)` für Similarity Search
- `platform_posts` — Zielplattform + Status pro Content Item
- `platform_accounts` — OAuth Tokens (`access_token`, `refresh_token`, `metadata`)
- `processing_jobs` — Verarbeitungs-Warteschlange
- `oauth_states` — CSRF-Schutz (10 Min TTL)

**RLS:** Aktiviert auf `content_items` und `platforms`. `match_content_items` läuft als `SECURITY DEFINER`.

---

## 4. API Endpoints

| Route | Methode | Auth | Zweck |
|---|---|---|---|
| `/api/upload` | POST | `ADMIN_SECRET` | Upload + enqueue transcribe |
| `/api/search` | POST | – | Semantische Suche |
| `/api/jobs/process` | POST | `CRON_SECRET` | Job-Worker |
| `/api/cron/publish-scheduled` | POST | `CRON_SECRET` | Publish-Queue |
| `/api/cron/cleanup-temp-uploads` | POST | `CRON_SECRET` | Cleanup-Queue |
| `/api/auth/:platform` | GET | – | OAuth Redirect |
| `/api/auth/:platform/callback` | GET | – | OAuth Token Exchange |
| `/api/admin/stats` | GET | `ADMIN_SECRET` | Dashboard |

---

## 5. Job Pipeline

1. `transcribe`
2. `generate_summary`
3. `create_combined_document`
4. `create_embedding`
5. `publish_to_platform` (scheduled)
6. `cleanup_temp_upload` (nach allen Plattformen)

---

## 6. Plattform-Adapters

| Plattform | OAuth | Publish | Besonderheit |
|---|---|---|---|
| TikTok | ✅ | `PULL_FROM_URL` | Token rotation |
| YouTube | ✅ | Chunked Upload (8MB) | 308 Resume support |
| LinkedIn | ✅ | Video Asset + UGC Post | Auto-URN fetch |
| Instagram | ✅ (via Meta) | Graph API Container | Experimental |

---

## 7. Search UI-Features

- Thumbnails aus `platform_posts.thumbnail_url`
- YouTube Inline-Embed (`iframe`)
- Plattform-Badges (Farbcodiert)
- Keyword Tags
- Zusammenfassung (3-Zeilen-Clamp)

---

## 8. Sicherheitsanforderungen (umgesetzt)

- [x] Upload nur mit `ADMIN_SECRET`
- [x] `/admin` nie von `/` verlinkt
- [x] `temp_uploads` ist private, Zugriff nur via Service Role
- [x] RLS auf public-facing Tabellen
- [x] `match_content_items` als `SECURITY DEFINER`
- [x] Multi-Platform-Safe Cleanup (keine Race Conditions)
- [x] Fehlende Env-Vars crashen nicht den SSR-Build (`getSupabaseClient()` lazy init)

---

## 9. Env-Variablen (Required)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
ASSEMBLYAI_API_KEY=
APP_BASE_URL=
ADMIN_SECRET=
CRON_SECRET=

# OAuth App Credentials
TIKTOK_CLIENT_KEY=         TIKTOK_CLIENT_SECRET=
YOUTUBE_CLIENT_ID=         YOUTUBE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=        LINKEDIN_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=        FACEBOOK_CLIENT_SECRET=
```

---

## 10. Deployment (Vercel)

1. `output: 'standalone'` in `next.config.ts`
2. Env-Variablen im Dashboard eintragen
3. `schema.sql` + `migrations/` in Supabase SQL Editor ausführen
4. Private Storage Bucket `temp_uploads` anlegen
5. 3 Cronjobs konfigurieren (alle mit `Authorization: Bearer <CRON_SECRET>`)

---

*Detaillierte Architektur, File Tree, Entscheidungsprotokoll → [`CONTEXT.md`](./CONTEXT.md)*
