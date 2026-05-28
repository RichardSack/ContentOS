# Backend & Business Logic

> Vollständige API-Referenz, Job-Pipeline und Architektur → siehe [`CONTEXT.md`](./CONTEXT.md)

---

## Anforderungsüberblick

1. Videos werden nur **temporär** gespeichert (Supabase Storage, private bucket `temp_uploads`).
2. Nach erfolgreichem Verarbeiten: Transkription → Zusammenfassung → semantische Embeddings.
3. Public Search: Vektorähnlichkeit via `match_content_items()` über pgvector.
4. OAuth2-Verbindung für Plattformen (Admin-seitig via `/admin`).
5. Geplante Veröffentlichung über 3 Cronjobs.
6. Multi-Platform-Safety: Datei wird erst gelöscht, wenn **alle** Plattformen fertig sind.

---

## Kernkomponenten

| Datei | Zweck |
|-------|-------|
| `lib/supabase/admin.ts` | Service-role Client (bypass RLS). **Nie im Browser verwenden.** |
| `lib/auth/admin.ts` | `assertAdmin(req)` und `assertCron(req)` |
| `lib/ai/assembly.ts` | AssemblyAI Transcription |
| `lib/ai/embeddings.ts` | OpenAI `text-embedding-3-small` + `gpt-4o-mini` summary |
| `lib/jobs/queue.ts` | `enqueueJob()`, `claimPendingJobs()` |
| `lib/jobs/handlers.ts` | 6 Handler: transcribe, summary, combine, embedding, publish, cleanup |
| `lib/platforms/{platform}.ts` | OAuth refresh + publish adapter |
| `lib/oauth/core.ts` | State, PKCE, Validation |
| `lib/oauth/config.ts` | Plattform-spezifische URLs, Scopes, PKCE-Flag |
| `lib/fetch-timeout.ts` | `fetchWithTimeout()` (AbortController, 30s) |
| `lib/chunked-upload.ts` | YouTube 8MB chunked resume upload |
| `lib/upload/validate.ts` | 500MB limit, MIME/extension checks |

---

## Job Pipeline

1. `transcribe` — AssemblyAI (Deutsch)
2. `generate_summary` — GPT-4o-mini
3. `create_combined_document` — Merges transcription + summary + keywords
4. `create_embedding` — `text-embedding-3-small` → `content_embeddings`
5. `publish_to_platform` — per `platform_post`, if scheduled
6. `cleanup_temp_upload` — only after **all** sibling posts are terminal

---

## API Endpoints (Kurz)

| Route | Auth | Zweck |
|---|---|---|
| `POST /api/upload` | `ADMIN_SECRET` | Upload + enqueue transcribe |
| `POST /api/search` | – | Vector search |
| `POST /api/jobs/process` | `CRON_SECRET` | Worker |
| `POST /api/cron/publish-scheduled` | `CRON_SECRET` | Queue publish jobs |
| `POST /api/cron/cleanup-temp-uploads` | `CRON_SECRET` | Queue cleanups |
| `GET /api/admin/stats` | `ADMIN_SECRET` | Dashboard counts |
| `GET /api/admin/accounts` | `ADMIN_SECRET` | Connected accounts |

> 📋 Vollständige Auth-Details, Parameter, Responses → [`CONTEXT.md`](./CONTEXT.md)

---

## Multi-User Vorbereitung

- `platform_accounts.user_id` ist **nullable** → Admin = null
- `oauth_states` speichert `platform_id` + `state` ohne User-Bezug (später erweiterbar)
- `getActivePlatformAccount()` akzeptiert optional `userId` (aktuell ignoriert)

---

## Testing

```bash
npx vitest run    # 31 Tests
npx tsc --noEmit  # Typprüfung
```

---

*Siehe auch:* [`CONTEXT.md`](./CONTEXT.md) für Architektur-Diagramm, Deployment, OAuth Flow
